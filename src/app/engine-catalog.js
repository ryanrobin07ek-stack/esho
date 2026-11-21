// SQLiteEngine: product, category and page reads.
// Moved verbatim out of src/app/main.js; main.js spreads these back in at the same spots.

export const engineCatalog = {
  // High-Level Storefront & Studio API
  getProducts(options = {}) {
    const {
      categorySlug,
      categoryId,
      query,
      sort,
      minPrice,
      maxPrice,
      inStockOnly,
      featuredOnly,
      bestsellersOnly,
      flagshipOnly,
      newOnly,
      limit,
      offset
    } = options;

    let targetCatId = categoryId;
    if (categorySlug && !targetCatId) {
      const cat = (this.db.tables.categories || []).find(c => c.slug === categorySlug);
      if (cat) targetCatId = cat.id;
    }

    const predicate = (p) => {
      if (p.status === "archived") return false;
      if (targetCatId && p.category_id !== targetCatId) return false;
      if (featuredOnly && !p.is_featured) return false;
      if (bestsellersOnly && !p.is_bestseller) return false;
      if (flagshipOnly && !p.is_flagship) return false;
      if (newOnly && !p.is_new) return false;
      if (inStockOnly && p.stock <= 0) return false;
      if (minPrice !== undefined && p.price < minPrice) return false;
      if (maxPrice !== undefined && p.price > maxPrice) return false;
      if (query) {
        const q = query.toLowerCase().trim();
        const inName = p.name.toLowerCase().includes(q);
        const inBrand = p.brand.toLowerCase().includes(q);
        const inDesc = p.description.toLowerCase().includes(q);
        const inSku = p.sku.toLowerCase().includes(q);
        const inTags = Array.isArray(p.tags) && p.tags.some(t => t.toLowerCase().includes(q));
        if (!inName && !inBrand && !inDesc && !inSku && !inTags) return false;
      }
      return true;
    };

    let sortFn = null;
    if (sort === "price-asc") {
      sortFn = (a, b) => a.price - b.price;
    } else if (sort === "price-desc") {
      sortFn = (a, b) => b.price - a.price;
    } else if (sort === "rating") {
      sortFn = (a, b) => b.rating - a.rating;
    } else if (sort === "newest") {
      sortFn = (a, b) => (b.is_new ? 1 : 0) - (a.is_new ? 1 : 0) || b.id - a.id;
    } else if (sort === "bestseller") {
      sortFn = (a, b) => (b.is_bestseller ? 1 : 0) - (a.is_bestseller ? 1 : 0);
    } else {
      // Default: featured first, then flagship, then rating
      sortFn = (a, b) => (b.is_flagship ? 1 : 0) - (a.is_flagship ? 1 : 0) || (b.is_featured ? 1 : 0) - (a.is_featured ? 1 : 0) || b.rating - a.rating;
    }

    const allMatched = this.select("products", predicate, sortFn);
    const totalCount = allMatched.length;
    const items = this.select("products", predicate, sortFn, limit, offset);

    return {
      items,
      totalCount
    };
  },

  getProductBySlug(slug) {
    const list = this.select("products", p => p.slug === slug);
    return list.length ? list[0] : null;
  },

  getProductById(id) {
    const list = this.select("products", p => Number(p.id) === Number(id));
    return list.length ? list[0] : null;
  },

  getRelatedProducts(product, limit = 4) {
    if (!product) return [];
    const list = this.select(
      "products",
      p => p.id !== product.id && (p.category_id === product.category_id || (Array.isArray(p.tags) && p.tags.some(t => (product.tags || []).includes(t)))),
      (a, b) => (b.category_id === product.category_id ? 1 : 0) - (a.category_id === product.category_id ? 1 : 0) || b.rating - a.rating,
      limit
    );
    return list;
  },

  getCategories() {
    return this.select("categories", null, (a, b) => a.id - b.id);
  },

  getCategoryBySlug(slug) {
    const list = this.select("categories", c => c.slug === slug);
    return list.length ? list[0] : null;
  },

  getPages(publishedOnly = false) {
    return this.select("pages", page => !publishedOnly || page.published);
  },

  getPageBySlug(slug, publishedOnly = false) {
    const pages = this.select("pages", page => page.slug === slug && (!publishedOnly || page.published));
    return pages[0] || null;
  },
};
