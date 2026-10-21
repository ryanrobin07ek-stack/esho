const activeProducts = data => (Array.isArray(data?.products) ? data.products : [])
  .filter(product => product && product.status !== "archived");

const productCategories = data => {
  const products = activeProducts(data);
  const categories = Array.isArray(data?.categories) ? data.categories : [];
  return categories.filter(category => products.some(product =>
    String(product.category_id ?? product.categoryId ?? "") === String(category.id)
    || String(product.category_name ?? product.categoryName ?? "") === String(category.name)));
};

const slug = value => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

const imageOf = product => {
  const raw = product?.images?.[0] || product?.image || product?.image_uri || product?.imageUrl || "";
  const url = typeof raw === "string" ? raw : raw?.url || raw?.src || "";
  if (!url) return "";
  try {
    const parsed = new URL(url);
    return ["http:", "https:"].includes(parsed.protocol) ? parsed.href : "";
  } catch {
    return "";
  }
};

export function mapAuraData(data) {
  const products = activeProducts(data);
  const categories = productCategories(data);
  const hasHighlightedProducts = products.some(product =>
    product.is_featured || product.featured || product.is_bestseller || product.isBestseller
    || product.is_popular || product.isPopular);
  const categoryById = new Map(categories.map(category => [String(category.id), category]));
  const mappedProducts = products.map((product, index) => {
    const category = categoryById.get(String(product.category_id ?? product.categoryId))
      || categories.find(item => item.name === (product.category_name || product.categoryName));
    const id = String(product.id ?? `product-${index + 1}`);
    const price = Number(product.price ?? product.selling_price ?? product.sellingPrice) || 0;
    const fallbackHighlight = !hasHighlightedProducts && index < 4;
    return {
      id,
      name: String(product.name || ""),
      brand: String(product.brand || data?.store?.name || ""),
      category: slug(category?.slug || category?.name || product.category_name || product.categoryName),
      subcategory: "",
      priceKES: price,
      originalPriceKES: null,
      rating: 0,
      reviewsCount: 0,
      isPopular: Boolean(product.is_featured || product.featured || product.is_popular || product.isPopular || fallbackHighlight),
      isBestseller: Boolean(product.is_featured || product.featured || product.is_bestseller || product.isBestseller || fallbackHighlight),
      badge: "",
      image: imageOf(product),
      volume: "",
      finish: "",
      coverage: "",
      skinType: "",
      description: String(product.description || ""),
      benefits: [],
      ingredients: "",
      howToUse: "",
      shades: []
    };
  });
  const mappedCategories = categories.map(category => {
    const id = slug(category.slug || category.name);
    return {
      id,
      name: String(category.name || ""),
      count: mappedProducts.filter(product => product.category === id).length,
      description: ""
    };
  });
  const brands = [...new Set(mappedProducts.map(product => product.brand).filter(Boolean))]
    .map(name => ({ id: slug(name), name, country: "", tagline: "", description: "" }));
  const store = data?.store || {};
  return {
    auraAppConfig: {
      BRAND_NAME: String(store.name || ""),
      STORE_CURRENCY: String(store.currency || "KES"),
      KES_TO_USD: 1,
      FREE_SHIPPING_THRESHOLD_KES: Number(store.free_shipping_threshold) || 0,
      DEFAULT_SHIPPING_FEE_KES: Number(store.shipping_fee) || 0,
      SUPPORT_PHONE: String(store.phone || ""),
      SUPPORT_EMAIL: String(store.email || ""),
      DEFAULT_TAX_RATE: 0
    },
    auraCatalogue: mappedProducts,
    auraCategories: [
      { id: "all", name: String(store.catalogue_label || "All products"), count: mappedProducts.length, description: "" },
      ...mappedCategories
    ],
    auraBrands: brands
  };
}

export function mapKicksData(data) {
  const products = activeProducts(data);
  const categories = productCategories(data);
  const categoryById = new Map(categories.map(category => [String(category.id), category]));
  const mappedProducts = products.map((product, index) => {
    const category = categoryById.get(String(product.category_id ?? product.categoryId))
      || categories.find(item => item.name === (product.category_name || product.categoryName));
    return {
      brand: String(product.brand || data?.store?.name || ""),
      name: String(product.name || ""),
      cat: String(category?.name || product.category_name || product.categoryName || ""),
      price: Number(product.price ?? product.selling_price ?? product.sellingPrice) || 0,
      orig: null,
      tag: "",
      desc: String(product.description || ""),
      id: String(product.id ?? `product-${index + 1}`),
      stock: Number(product.stock ?? product.quantity) || 0,
      isNew: false
    };
  });
  const brands = [...new Set(mappedProducts.map(product => product.brand).filter(Boolean))];
  const categoryNames = [...new Set(mappedProducts.map(product => product.cat).filter(Boolean))];
  return {
    kicksBrands: brands,
    kicksCategories: categoryNames,
    kicksPhotos: products.map(imageOf),
    kicksBlueprints: mappedProducts,
    kicksExtraVariants: []
  };
}

export function dataForTheme(themeId, data) {
  if (themeId === "aura-luxe-fine-botanical-cosmetics-luxury-beauty") return mapAuraData(data);
  if (themeId === "kicks-vault-curated-sneaker-footwear-archive") return mapKicksData(data);
  return {};
}
