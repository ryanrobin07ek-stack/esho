// Catalogue > Categories actions: create, rename and delete a category (and queue it for sync).
import { run, stmt, transaction } from '../../till/db.js';
import { addCategory, listCategories, listProducts } from '../../till/products.js';

export function createCatalogueCategoryActions({ queueCategory, loadState, queueProduct }) {
  async function createCategory(name) {
    const value = String(name || '').trim();
    if (!value) throw new Error('Enter a category name.');
    await addCategory(value);
    const category = (await listCategories()).find((item) => item.name.toLocaleLowerCase() === value.toLocaleLowerCase());
    if (!category) throw new Error(`The category "${value}" was added but could not be reloaded.`);
    await queueCategory(category);
    await loadState();
    return category;
  }

  async function renameCategory(id, name) {
    const categoryId = Number(id);
    const value = String(name || '').trim();
    const categories = await listCategories();
    const category = categories.find((item) => item.id === categoryId);
    if (!category) throw new Error('This category is no longer available.');
    if (!value || category.name.toLocaleLowerCase() === 'other') {
      throw new Error('Enter a valid category name. The default Other category cannot be renamed.');
    }
    if (categories.some((item) => item.id !== categoryId && item.name.trim().toLocaleLowerCase() === value.toLocaleLowerCase())) {
      throw new Error(`The category "${value}" already exists.`);
    }

    await run('UPDATE pos_categories SET name=? WHERE id=?', [value, categoryId]);
    const renamed = (await listCategories()).find((item) => item.id === categoryId);
    if (!renamed) throw new Error('The category was renamed but could not be reloaded.');
    await queueCategory(category, true);
    await queueCategory(renamed);
    for (const product of (await listProducts()).filter((item) => item.categoryId === categoryId)) {
      await queueProduct(product);
    }
    await loadState();
    return renamed;
  }

  async function deleteCategory(id) {
    const categoryId = Number(id);
    const categories = await listCategories();
    const category = categories.find((item) => item.id === categoryId);
    if (!category) throw new Error('This category is no longer available.');
    if (category.name.toLocaleLowerCase() === 'other') {
      throw new Error('The default Other category cannot be deleted.');
    }
    const fallback = categories.find((item) => item.name.toLocaleLowerCase() === 'other');
    if (!fallback) throw new Error('The default Other category is missing; the category cannot be safely deleted.');
    const affectedProducts = (await listProducts()).filter((item) => item.categoryId === categoryId);
    await transaction([
      ...affectedProducts.map((product) => stmt('UPDATE pos_products SET category_id=? WHERE id=?', [fallback.id, product.id])),
      stmt('DELETE FROM pos_categories WHERE id=?', [categoryId])
    ]);
    await queueCategory(category, true);
    const fallbackProducts = await listProducts();
    for (const product of fallbackProducts.filter((item) => affectedProducts.some(affected => affected.id === item.id))) {
      await queueProduct(product);
    }
    await loadState();
    return true;
  }

  return { createCategory, renameCategory, deleteCategory };
}
