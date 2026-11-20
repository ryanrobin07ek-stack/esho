// Saving a checkout: save the sale, clear the cart, queue the sale and its stock for sync.
import { listProducts } from './products.js';
import { listSales, saveSale } from './sales.js';

export function createTillCheckout({
  state, toast, refresh, queueCloudRecord, syncInventorySales, queueProduct
}) {
  async function saveCheckout(data, method, paid) {
    const items = state.cart.map((item) => ({ ...item }));
    let sale;
    try {
      sale = await saveSale(items, { ...data, paymentMethod: method, paid });
    } catch (error) {
      if (!(error instanceof Error) || !/in stock, \d+ requested/.test(error.message)
        || !confirm(`${error.message}\n\nSell anyway? Stock will not go below zero.`)) throw error;
      sale = await saveSale(items, {
        ...data, paymentMethod: method, paid, allowOutOfStock: true
      });
    }
    state.cart = [];
    state.paymentMethod = '';
    state.discount = 0;
    state.discountDialogOpen = false;
    let pendingSharedSales = 0;
    try {
      const savedSale = (await listSales()).find((item) => item.id === sale.id);
      if (savedSale) await queueCloudRecord('sale', savedSale.receipt_number, savedSale);
      const productsAfterSale = await listProducts();
      for (const productId of new Set(items.map((item) => item.productId))) {
        const product = productsAfterSale.find((item) => item.id === productId);
        if (!product) throw new Error('The sale was saved, but an updated product could not be loaded for sync.');
        await queueProduct(product);
      }
      if (state.activeTicketId) {
        await queueCloudRecord('ticket', state.activeTicketId, { id: state.activeTicketId }, true);
        state.activeTicketId = '';
      }
      pendingSharedSales = await syncInventorySales();
    } catch (error) {
      await refresh();
      toast(`Receipt ${sale.receiptNumber} saved, but sync failed: ${error instanceof Error ? error.message : 'unknown error'}`, true);
      return;
    }
    toast(`Receipt ${sale.receiptNumber} saved${pendingSharedSales ? ' · shared stock sync pending' : ''}.`);
    await refresh();
  }

  return { saveCheckout };
}
