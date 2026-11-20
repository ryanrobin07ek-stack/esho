// Storefront product screen (/product/:slug) and its gallery, options and add-to-bag controls.
// Moved verbatim from the app script (index.html, then src/app/main.js).
import { AppController, AppUtils, SQLiteEngine, StoreRenderers } from '../../app/main.js';

export const productScreen = {
  renderProduct(slug) {
    const product = SQLiteEngine.getProductBySlug(slug);
    if (!product) {
      return `
        ${StoreRenderers.renderNavbar()}
        <main class="container" style="padding: 80px 0; text-align: center;">
          <h1 class="section-heading">Product Not Found</h1>
          <p style="color: var(--text-muted); margin: 16px 0 24px;">This product is no longer active in our catalog.</p>
          <a href="/categories" class="hero-cta" data-route="/categories">Browse Catalog</a>
        </main>
        ${StoreRenderers.renderFooter()}
      `;
    }

    const category = SQLiteEngine.select("categories", c => c.id === product.category_id)[0] || { name: "Collection", slug: "categories" };
    const related = SQLiteEngine.getRelatedProducts(product, 4);
    const isFav = SQLiteEngine.isFavorite(product.id);
    const hasDiscount = product.discount && product.discount > 0;
    const images = product.images || [];
    const option1Name = product.option1_name || (product.sizes?.length ? "Size / Dimension" : "");
    const option2Name = product.option2_name || (product.colors?.length ? "Artisanal Finish" : "");
    const defaultVariant = (product.variants || []).find(variant =>
      (variant.option1_value ?? variant.size ?? "") === (product.sizes?.[0] || "") &&
      (variant.option2_value ?? variant.color ?? "") === (product.colors?.[0] || ""));
    const defaultPrice = defaultVariant?.price ?? product.price;
    const defaultStock = defaultVariant?.stock ?? product.stock;

    AppUtils.updateSEO({
      title: `${product.name} — ${product.brand}`,
      description: product.description,
      image: images[0],
      schema: {
        "@context": "https://schema.org",
        "@type": "Product",
        "name": product.name,
        "image": images,
        "description": product.description,
        "sku": product.sku,
        "brand": {
          "@type": "Brand",
          "name": product.brand
        },
        "offers": {
          "@type": "Offer",
          "url": `${window.location.origin}/product/${product.slug}`,
          "priceCurrency": "USD",
          "price": product.price,
          "availability": product.stock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
          "itemCondition": "https://schema.org/NewCondition"
        },
        "aggregateRating": {
          "@type": "AggregateRating",
          "ratingValue": product.rating,
          "reviewCount": product.review_count || 12
        }
      }
    });

    return `
      ${StoreRenderers.renderNavbar()}
      <main class="product-page-section">
        <div class="container">
          <div class="breadcrumbs">
            <a href="/" data-route="/">Home</a>
            <span>/</span>
            <a href="/category/${category.slug}" data-route="/category/${category.slug}">${AppUtils.escapeHTML(category.name)}</a>
            <span>/</span>
            <span>${AppUtils.escapeHTML(product.name)}</span>
          </div>

          <div class="product-detail-layout">
            <!-- Left: Switchable Image Gallery -->
            <div class="product-gallery">
              <div class="gallery-main-view">
                ${images[0] ? `<img id="main-product-img" src="${AppUtils.escapeHTML(images[0])}" alt="${AppUtils.escapeHTML(product.name)}" class="gallery-main-img" width="600" height="800">` : ""}
                ${product.is_flagship ? `<span class="product-badge badge-flagship" style="position: absolute; top: 16px; left: 16px;">Flagship Curation</span>` : ""}
              </div>
              <div class="gallery-thumbnails-rail">
                ${images.map((img, i) => `
                  <button class="gallery-thumb-btn ${i === 0 ? 'active' : ''}" data-action="switch-thumb" data-src="${img}" aria-label="View photo ${i+1}">
                    <img src="${img}" alt="Thumbnail ${i+1}" class="gallery-thumb-img">
                  </button>
                `).join("")}
              </div>
            </div>

            <!-- Right: Product Information & Purchase CTAs -->
            <div class="product-info-panel">
              <div>
                <span class="product-sku-tag">${AppUtils.escapeHTML(product.brand)} &bull; SKU: ${AppUtils.escapeHTML(product.sku)}</span>
                <h1 class="product-main-title">${AppUtils.escapeHTML(product.name)}</h1>
                <div style="display: flex; align-items: center; gap: 8px; margin-top: 8px;">
                  <span class="star-icon">★</span>
                  <span style="font-weight: 600;">${product.rating.toFixed(1)}</span>
                  <span style="color: var(--text-muted);">(${product.review_count} client reviews)</span>
                  <span style="margin: 0 4px; color: var(--border);">&bull;</span>
                  <span id="product-stock-status" style="color: ${defaultStock > 0 ? 'var(--success)' : 'var(--danger)'}; font-size: 0.8125rem; font-weight: 600;">
                    ${defaultStock > 10 ? 'In Stock (Ready to dispatch)' : (defaultStock > 0 ? `Low Stock (${defaultStock} units remain)` : 'Sold Out')}
                  </span>
                </div>
              </div>

              <div class="product-price-box">
                <span class="price-current">${AppUtils.formatMoney(defaultPrice)}</span>
                ${hasDiscount ? `<span class="price-original">${AppUtils.formatMoney(product.original_price)}</span>` : ""}
                ${hasDiscount ? `<span class="price-discount">Save ${product.discount}%</span>` : ""}
              </div>

              <p style="font-size: 1rem; line-height: 1.6; color: var(--text-muted);">
                ${AppUtils.escapeHTML(product.description)}
              </p>

              <!-- Product option selectors -->
              ${product.sizes && product.sizes.length ? `
                <div>
                  <div class="options-title">
                    <span>Select ${AppUtils.escapeHTML(option1Name || "Option 1")}</span>
                    ${/size|dimension/i.test(option1Name) ? `<a href="/help" data-route="/help" style="color: var(--text-muted); font-size: 0.8125rem; text-decoration: underline;">Sizing Guide</a>` : ""}
                  </div>
                  <div class="options-chips" id="product-size-chips">
                    ${product.sizes.map((s, idx) => `
                      <button class="option-chip ${idx === 0 ? 'active' : ''}" data-val="${AppUtils.escapeHTML(s)}">${AppUtils.escapeHTML(s)}</button>
                    `).join("")}
                  </div>
                </div>
              ` : ""}

              ${product.colors && product.colors.length ? `
                <div>
                  <div class="options-title"><span>${AppUtils.escapeHTML(option2Name || "Option 2")}</span></div>
                  <div class="options-chips" id="product-color-chips">
                    ${product.colors.map((c, idx) => `
                      <button class="option-chip ${idx === 0 ? 'active' : ''}" data-val="${AppUtils.escapeHTML(c)}">${AppUtils.escapeHTML(c)}</button>
                    `).join("")}
                  </div>
                </div>
              ` : ""}

              <!-- Quantity and Purchase Buttons -->
              <div style="display: flex; gap: 16px; align-items: center;">
                <div class="quantity-stepper">
                  <button class="stepper-btn" id="prod-qty-dec">&minus;</button>
                  <input type="text" id="prod-qty-input" class="stepper-input" value="1" readonly>
                  <button class="stepper-btn" id="prod-qty-inc">&plus;</button>
                </div>
                <div class="cta-button-group" style="flex: 1;">
                  <button class="btn-primary" id="btn-add-to-bag" data-id="${product.id}">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
                    <span>Add to Bag</span>
                  </button>
                  <button class="btn-secondary" id="btn-buy-now" data-id="${product.id}">
                    <span>Buy Now</span>
                  </button>
                  <button class="btn-fav-large ${isFav ? 'active' : ''}" id="btn-prod-fav" data-id="${product.id}" aria-label="Save to favorites">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="${isFav ? '#E11D48' : 'none'}" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
                  </button>
                </div>
              </div>

              <!-- Accordions: Specifications, Shipping, Provenance -->
              <div class="accordion-list">
                <div class="accordion-item">
                  <button class="accordion-trigger" data-accordion="specs">
                    <span>Specifications &amp; Provenance</span>
                    <span>+</span>
                  </button>
                  <div class="accordion-body active" id="acc-specs">
                    <p>${AppUtils.escapeHTML(product.details || "Manufactured with certified materials meeting our ethical craftsmanship charter. Detailed provenance documentation accompanied upon dispatch.")}</p>
                    <ul style="margin: 12px 0 0 20px; line-height: 1.8;">
                      <li>Category: ${AppUtils.escapeHTML(category.name)}</li>
                      <li>Item SKU: ${AppUtils.escapeHTML(product.sku)}</li>
                      <li>Authenticity: 100% Guaranteed Original Masterwork</li>
                    </ul>
                  </div>
                </div>

                <div class="accordion-item">
                  <button class="accordion-trigger" data-accordion="shipping">
                    <span>Carbon-Neutral Delivery &amp; Returns</span>
                    <span>+</span>
                  </button>
                  <div class="accordion-body" id="acc-shipping">
                    <p>Complimentary express courier delivery on orders exceeding $150. All shipments are carbon-neutral certified. Dispatched within 24 business hours from our central warehouse.</p>
                    <p style="margin-top: 8px;">Enjoy 30 days of risk-free evaluation. Complimentary prepaid return labels enclosed in every order box.</p>
                  </div>
                </div>

                <div class="accordion-item">
                  <button class="accordion-trigger" data-accordion="care">
                    <span>Care &amp; Longevity Instructions</span>
                    <span>+</span>
                  </button>
                  <div class="accordion-body" id="acc-care">
                    <p>Store in the provided breathable cotton dust bag when not in rotation. Avoid prolonged direct sunlight and moisture exposure. Periodic specialist conditioning will ensure generations of enduring patina.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Verified Client Reviews -->
          <section style="margin-top: 80px; padding-top: 48px; border-top: 1px solid var(--border);">
            <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 32px;">
              <div>
                <span class="section-eyebrow">Client Feedback</span>
                <h2 class="section-heading">Verified Reviews (${product.review_count})</h2>
              </div>
              <div style="display: flex; align-items: center; gap: 8px;">
                <span style="font-size: 1.75rem; font-weight: 700;">${product.rating.toFixed(1)}</span>
                <div style="font-size: 0.8125rem; color: var(--text-muted);">
                  <div>★★★★★</div>
                  <div>Based on ${product.review_count} client evaluations</div>
                </div>
              </div>
            </div>

            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px;">
              <div style="background: var(--surface); padding: 24px; border: 1px solid var(--border); border-radius: var(--radius);">
                <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                  <span style="font-weight: 600;">Marcus V.</span>
                  <span style="color: var(--text-dim); font-size: 0.8125rem;">2 weeks ago</span>
                </div>
                <div style="color: #D97706; margin-bottom: 8px;">★★★★★</div>
                <div style="font-weight: 600; margin-bottom: 6px; font-size: 0.9375rem;">Exceptional tactile quality</div>
                <p style="font-size: 0.875rem; color: var(--text-muted); line-height: 1.5;">The weight and craftsmanship exceeded my expectations. Substantial finishing and pristine packaging.</p>
              </div>

              <div style="background: var(--surface); padding: 24px; border: 1px solid var(--border); border-radius: var(--radius);">
                <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                  <span style="font-weight: 600;">Helena S.</span>
                  <span style="color: var(--text-dim); font-size: 0.8125rem;">1 month ago</span>
                </div>
                <div style="color: #D97706; margin-bottom: 8px;">★★★★★</div>
                <div style="font-weight: 600; margin-bottom: 6px; font-size: 0.9375rem;">Timeless aesthetic balance</div>
                <p style="font-size: 0.875rem; color: var(--text-muted); line-height: 1.5;">Quiet luxury in its purest form. Sizing is true to spec and the drape is flawless.</p>
              </div>

              <div style="background: var(--surface); padding: 24px; border: 1px solid var(--border); border-radius: var(--radius);">
                <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                  <span style="font-weight: 600;">David L.</span>
                  <span style="color: var(--text-dim); font-size: 0.8125rem;">1 month ago</span>
                </div>
                <div style="color: #D97706; margin-bottom: 8px;">★★★★★</div>
                <div style="font-weight: 600; margin-bottom: 6px; font-size: 0.9375rem;">Worth every dollar</div>
                <p style="font-size: 0.875rem; color: var(--text-muted); line-height: 1.5;">Fast carbon-neutral courier to Zurich. The craftsmanship matches bespoke savile row standards.</p>
              </div>
            </div>
          </section>

          <!-- Related Products Section -->
          ${related.length ? `
            <section style="margin-top: 80px; padding-top: 48px; border-top: 1px solid var(--border);">
              <div style="margin-bottom: 32px;">
                <span class="section-eyebrow">Complementary Curation</span>
                <h2 class="section-heading">You May Also Appreciate</h2>
              </div>
              <div class="products-grid">
                ${related.map(p => StoreRenderers.renderProductCard(p)).join("")}
              </div>
            </section>
          ` : ""}
        </div>
      </main>
      ${StoreRenderers.renderFooter()}
    `;
  },
};

export const productController = {
  initProductDetail() {
    // Gallery Thumbnails
    const thumbs = document.querySelectorAll("[data-action='switch-thumb']");
    const mainImg = document.getElementById("main-product-img");
    thumbs.forEach(btn => {
      btn.onclick = () => {
        thumbs.forEach(t => t.classList.remove("active"));
        btn.classList.add("active");
        const src = btn.getAttribute("data-src");
        if (mainImg && src) mainImg.src = src;
      };
    });

    // Option Chips
    document.querySelectorAll(".options-chips .option-chip").forEach(chip => {
      chip.onclick = () => {
        const parent = chip.parentElement;
        if (parent) {
          parent.querySelectorAll(".option-chip").forEach(c => c.classList.remove("active"));
          chip.classList.add("active");
        }
        const productId = Number(document.getElementById("btn-add-to-bag")?.getAttribute("data-id"));
        const product = productId ? SQLiteEngine.getProductById(productId) : null;
        if (!product) return;
        const value1 = document.querySelector("#product-size-chips .option-chip.active")?.getAttribute("data-val") || "";
        const value2 = document.querySelector("#product-color-chips .option-chip.active")?.getAttribute("data-val") || "";
        const variant = (product.variants || []).find(item =>
          (item.option1_value ?? item.size ?? "") === value1 &&
          (item.option2_value ?? item.color ?? "") === value2);
        const price = document.querySelector(".product-price-box .price-current");
        if (price) price.textContent = AppUtils.formatMoney(variant?.price ?? product.price);
        const stock = document.getElementById("product-stock-status");
        if (stock) {
          const quantity = Number(variant?.stock ?? product.stock);
          stock.textContent = quantity > 10
            ? "In Stock (Ready to dispatch)"
            : quantity > 0 ? `Low Stock (${quantity} units remain)` : "Sold Out";
          stock.style.color = quantity > 0 ? "var(--success)" : "var(--danger)";
        }
      };
    });

    // Quantity Stepper
    const qtyInput = document.getElementById("prod-qty-input");
    const btnInc = document.getElementById("prod-qty-inc");
    const btnDec = document.getElementById("prod-qty-dec");
    if (qtyInput && btnInc && btnDec) {
      btnInc.onclick = () => { qtyInput.value = Math.min(20, (Number(qtyInput.value) || 1) + 1); };
      btnDec.onclick = () => { qtyInput.value = Math.max(1, (Number(qtyInput.value) || 1) - 1); };
    }

    // Add to Bag Button
    const btnAdd = document.getElementById("btn-add-to-bag");
    if (btnAdd) {
      btnAdd.onclick = () => {
        const prodId = Number(btnAdd.getAttribute("data-id"));
        const qty = Number(qtyInput ? qtyInput.value : 1);
        const activeSize = document.querySelector("#product-size-chips .option-chip.active");
        const activeColor = document.querySelector("#product-color-chips .option-chip.active");
        if (!SQLiteEngine.addToCart(prodId, qty, activeSize ? activeSize.getAttribute("data-val") : null, activeColor ? activeColor.getAttribute("data-val") : null)) return;
        AppUtils.showToast("Artifact added to your shopping bag");
        this.updateNavBadges();
      };
    }

    // Buy Now Button
    const btnBuyNow = document.getElementById("btn-buy-now");
    if (btnBuyNow) {
      btnBuyNow.onclick = () => {
        const prodId = Number(btnBuyNow.getAttribute("data-id"));
        const qty = Number(qtyInput ? qtyInput.value : 1);
        const activeSize = document.querySelector("#product-size-chips .option-chip.active");
        const activeColor = document.querySelector("#product-color-chips .option-chip.active");
        if (!SQLiteEngine.addToCart(prodId, qty, activeSize ? activeSize.getAttribute("data-val") : null, activeColor ? activeColor.getAttribute("data-val") : null)) return;
        this.navigate("/checkout");
      };
    }

    // Accordions
    document.querySelectorAll(".accordion-trigger").forEach(trig => {
      trig.onclick = () => {
        const targetId = "acc-" + trig.getAttribute("data-accordion");
        const body = document.getElementById(targetId);
        if (body) {
          const isOpen = body.classList.contains("active");
          body.classList.toggle("active", !isOpen);
          trig.querySelector("span:last-child").textContent = isOpen ? "+" : "−";
        }
      };
    });
  },
};

// Screen entry points. The router (handleRoute in src/app/main.js) still draws this screen
// itself, through StoreRenderers.renderProduct(); mount()/unmount() draw and set up this one screen on their own.
export function mount(root, slug) {
  root.innerHTML = StoreRenderers.renderProduct(slug);
  AppController.initProductDetail();
}

export function unmount() {}
