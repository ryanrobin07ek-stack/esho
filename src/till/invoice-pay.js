// Online payment for invoices: ask the cloud for a pay link, share it, and record an invoice as paid once the
// customer has paid through Paystack. The invoice itself never leaves the device; the cloud only knows the
// invoice number, the amount and who is paying.
import { rows, run } from './db.js';
import { markInvoicePaid } from './payments.js';
import { listSales } from './sales.js';
import { listProducts } from './products.js';

const linkKey = (invoiceNumber) => `invoice_pay_link:${invoiceNumber}`;
const AUTO_CHECK_EVERY_MS = 30_000;

// What the customer paid with, as the till names it.
const METHOD_BY_CHANNEL = { card: 'Card', mobile_money: 'Mobile money', bank: 'Bank', bank_transfer: 'Bank', ussd: 'Mobile money' };

export function createInvoicePay({ state, toast, refresh, queueCloudRecord, queueProduct, syncInventorySales }) {
  let checking = false;
  let lastCheckedAt = 0;

  const bridge = () => window.EshopInventoryBridge;
  const paymentTenantId = () => state.settings?.cloudSyncTenantId || bridge()?.activeWebsiteId?.() || '';

  async function savedLink(invoiceNumber) {
    return (await rows('SELECT value FROM pos_settings WHERE key=?', [linkKey(invoiceNumber)]))[0]?.value || '';
  }

  async function createLink(invoice) {
    const tenantId = paymentTenantId();
    if (!tenantId || typeof bridge()?.createInvoicePaymentLink !== 'function') {
      throw new Error('Connect this till to a shop in Payments before sending a pay link.');
    }
    if (navigator.onLine === false) throw new Error('You are offline. Connect to the internet to create a pay link.');
    const contact = String(invoice.customer_contact || '').trim();
    const result = await bridge().createInvoicePaymentLink(tenantId, {
      invoice_number: invoice.invoice_number,
      amount: invoice.total,
      currency: invoice.currency,
      customer_name: invoice.customer_name,
      customer_email: contact.includes('@') ? contact : ''
    });
    if (result?.url) {
      await run('INSERT OR REPLACE INTO pos_settings (key,value) VALUES (?,?)', [linkKey(invoice.invoice_number), result.url]);
    }
    return result;
  }

  // Hands the link to the owner to send: the phone's share sheet if there is one, else the clipboard.
  async function shareLink(invoice, url) {
    const text = `Pay invoice ${invoice.invoice_number} (${invoice.currency} ${Number(invoice.total).toLocaleString(undefined, {
      minimumFractionDigits: 2, maximumFractionDigits: 2
    })}) online:`;
    try {
      if (typeof navigator.share === 'function') {
        await navigator.share({ title: `Invoice ${invoice.invoice_number}`, text, url });
        return;
      }
    } catch (error) {
      if (error?.name === 'AbortError') return;
    }
    try {
      await navigator.clipboard.writeText(`${text} ${url}`);
      toast('Pay link copied. Paste it into WhatsApp, SMS or email.');
    } catch {
      window.prompt('Copy this pay link and send it to your customer', url);
    }
  }

  // Records a paid invoice as a sale and queues what that sale changed, exactly as marking it paid by hand does.
  async function settleInvoice(invoiceId, method, mpesaRef = '') {
    const result = await markInvoicePaid(invoiceId, method, { mpesaRef });
    try {
      const savedSale = (await listSales()).find((item) => item.id === result.id);
      if (savedSale) await queueCloudRecord('sale', savedSale.receipt_number, savedSale);
      const productsAfter = await listProducts();
      for (const productId of result.productIds) {
        const product = productsAfter.find((item) => item.id === productId);
        if (product) await queueProduct(product);
      }
      await syncInventorySales();
    } catch (error) {
      await refresh();
      toast(`Invoice ${result.invoiceNumber} paid as receipt ${result.receiptNumber}, but sync failed: ${error instanceof Error ? error.message : 'unknown error'}`, true);
      return { ...result, syncFailed: true };
    }
    toast(`Invoice ${result.invoiceNumber} marked paid · receipt ${result.receiptNumber}.`);
    await refresh();
    return result;
  }

  // Asks the cloud which of the invoices that have a pay link have been paid, and records those.
  async function syncOnlinePayments({ manual = false } = {}) {
    if (checking) return 0;
    if (!manual && Date.now() - lastCheckedAt < AUTO_CHECK_EVERY_MS) return 0;
    const tenantId = paymentTenantId();
    if (!tenantId || typeof bridge()?.listInvoicePayments !== 'function' || navigator.onLine === false) {
      if (manual) toast('Connect to the internet and to a shop to check online payments.', true);
      return 0;
    }
    const unpaid = (state.invoices || []).filter((invoice) => invoice.status !== 'paid');
    const withLinks = [];
    for (const invoice of unpaid) if (await savedLink(invoice.invoice_number)) withLinks.push(invoice);
    if (!withLinks.length) {
      if (manual) toast('No unpaid invoice has a pay link yet.');
      return 0;
    }
    checking = true;
    lastCheckedAt = Date.now();
    let recorded = 0;
    try {
      const { payments = [] } = await bridge().listInvoicePayments(tenantId);
      const paid = new Map(payments.filter((payment) => payment.status === 'paid').map((payment) => [payment.invoice_number, payment]));
      for (const invoice of withLinks) {
        const payment = paid.get(invoice.invoice_number);
        if (!payment) continue;
        const method = METHOD_BY_CHANNEL[payment.channel] || 'Other';
        try {
          // The till only accepts a short M-Pesa code as a reference, so Paystack's own reference stays in the cloud.
          await settleInvoice(invoice.id, method);
          recorded += 1;
        } catch (error) {
          // Already paid by hand in the meantime, or the invoice changed: leave it for the owner to see.
          console.warn(`Could not record the online payment for ${invoice.invoice_number}.`, error);
        }
      }
      if (manual && !recorded) toast('No new online payments yet.');
    } catch (error) {
      if (manual) toast(error instanceof Error ? error.message : 'Could not check online payments.', true);
    } finally {
      checking = false;
    }
    return recorded;
  }

  return { createLink, shareLink, settleInvoice, syncOnlinePayments, savedLink };
}
