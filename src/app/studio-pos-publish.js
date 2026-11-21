// Publish products to the till and add website products to it.
// Moved verbatim out of src/app/main.js (the StudioRenderers object); main.js spreads these back in at the same spots.
import { AppController, SQLiteEngine } from './main.js';

export const posPublishActions = {
  async publishPosProduct(product) {
    const categoryName = String(product.categoryName || "Uncategorized").trim();
    let category = SQLiteEngine.getCategories().find(item =>
      item.name.trim().toLocaleLowerCase() === categoryName.toLocaleLowerCase());
    if (!category) {
      SQLiteEngine.saveCategory({ name: categoryName });
      category = SQLiteEngine.getCategories().find(item =>
        item.name.trim().toLocaleLowerCase() === categoryName.toLocaleLowerCase());
    }
    if (!category) throw new Error(`Could not create website category "${categoryName}".`);
    const sku = String(product.sku || "").trim();
    const webProduct = sku
      ? SQLiteEngine.select("products").find(item => String(item.sku || "").trim() === sku)
      : null;
    SQLiteEngine.saveProduct({
      ...(webProduct || {}),
      ...(webProduct ? { id: webProduct.id } : {}),
      name: product.name,
      sku: product.sku,
      category_id: category.id,
      price: Number(product.price) || 0,
      cost_price: product.buyingPrice == null ? 0 : Number(product.buyingPrice),
      stock: product.stock == null ? 0 : Number(product.stock),
      images: product.imageUri ? [product.imageUri] : webProduct?.images || [],
      taxonomy_category_id: product.taxonomyCategoryId || webProduct?.taxonomy_category_id || null,
      taxonomy_custom_category: product.taxonomyCustomCategory || webProduct?.taxonomy_custom_category || null,
      taxonomy_attributes: product.taxonomyAttributes || webProduct?.taxonomy_attributes || []
    });
    AppController.cacheActiveTenantCatalog();
    await window.ShopSQLite.flush();
    await window.EshopInventoryBridge?.setLocalStock(AppController.getActiveTenant().id, product.sku, Number(product.stock) || 0);
  },

  async addWebsiteProductToPos(productId) {
    const websiteProduct = SQLiteEngine.getProductById(productId);
    if (!websiteProduct) throw new Error("That website product no longer exists. Refresh the Store screen.");
    const categoryName = SQLiteEngine.getCategories().find(category =>
      Number(category.id) === Number(websiteProduct.category_id))?.name || "Uncategorized";
    let posCategory = (await window.ShopPOS.listCategories()).find(category =>
      category.name.trim().toLocaleLowerCase() === categoryName.toLocaleLowerCase());
    if (!posCategory) {
      await window.ShopPOS.addCategory(categoryName);
      posCategory = (await window.ShopPOS.listCategories()).find(category =>
        category.name.trim().toLocaleLowerCase() === categoryName.toLocaleLowerCase());
    }
    if (!posCategory) throw new Error(`Could not create POS category "${categoryName}".`);
    const posId = await window.ShopPOS.saveProduct({
      name: websiteProduct.name,
      categoryId: posCategory.id,
      price: Number(websiteProduct.price) || 0,
      buyingPrice: websiteProduct.cost_price ?? "",
      stock: websiteProduct.stock ?? 0,
      sku: websiteProduct.sku || "",
      imageUri: websiteProduct.images?.[0] || "",
      taxonomyCategoryId: websiteProduct.taxonomy_category_id || "",
      taxonomyCustomCategory: websiteProduct.taxonomy_custom_category || "",
      taxonomyAttributes: websiteProduct.taxonomy_attributes || []
    });
    const posProduct = (await window.ShopPOS.listProducts()).find(item => Number(item.id) === Number(posId));
    if (!posProduct) throw new Error("The POS product saved, but could not be reloaded to link its SKU.");
    if (!websiteProduct.sku) {
      SQLiteEngine.saveProduct({ ...websiteProduct, sku: posProduct.sku });
      AppController.cacheActiveTenantCatalog();
      await window.ShopSQLite.flush();
    }
    await window.EshopInventoryBridge?.setLocalStock(AppController.getActiveTenant().id, posProduct.sku, Number(posProduct.stock) || 0);
  },
};
