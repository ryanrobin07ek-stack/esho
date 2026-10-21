// Generic product mapper: any theme that declares a `fieldMap` in its schema needs NO custom JS.
// fieldMap = { array, fields:{id,name,price,comparePrice,image,category,description,featured,bestseller}, defaults, shape }
const NEGATIVE_FLAG = /out|sold|preorder|discontinu|hidden|disabled|archiv|inactive|draft/i;
function mapGeneric(schema, data) {
  const fm = schema.fieldMap;
  if (!fm || !fm.fields) return {};
  const f = fm.fields;
  const cats = Array.isArray(data.categories) ? data.categories : [];
  const products = (Array.isArray(data.products) ? data.products : []).map((p, i) => {
    const cat = cats.find(c => String(c.id) === String(p.category_id ?? p.categoryId))
      || cats.find(c => c.name === (p.category_name || p.categoryName));
    const item = {};
    for (const [k, v] of Object.entries(fm.shape || {})) item[k] = typeof v === "boolean" ? !NEGATIVE_FLAG.test(k) : (Array.isArray(v) ? [] : v);
    Object.assign(item, fm.defaults || {});
    const put = (key, value) => { if (key) item[key] = value; };
    put(f.id, String(p.id ?? "product-" + (i + 1)));
    put(f.name, String(p.name || ""));
    put(f.price, Number(p.price ?? p.selling_price ?? p.sellingPrice) || 0);
    if (f.comparePrice) put(f.comparePrice, Number(p.comparePrice ?? p.compare_at_price) || 0);
    const img = imageOf(p);
    put(f.image, Array.isArray(fm.shape?.[f.image]) ? (img ? [img] : []) : img);
    put(f.category, cat ? String(cat.name) : String(p.category_name || p.categoryName || ""));
    put(f.description, String(p.description || ""));
    if (f.featured && (p.featured != null || p.is_featured != null)) put(f.featured, Boolean(p.featured ?? p.is_featured));
    if (f.bestseller && (p.bestseller != null || p.is_bestseller != null)) put(f.bestseller, Boolean(p.bestseller ?? p.is_bestseller));
    return item;
  });
  return { products };
}
