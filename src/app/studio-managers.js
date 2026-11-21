// Products, dashboard, categories, inventory and static page renderers.
// Moved verbatim out of src/app/main.js (the StudioRenderers object); main.js spreads these back in at the same spots.
import { AppController, AppUtils, SQLiteEngine, StoreRenderers } from './main.js';

export const managerRenderers = {
  renderProductsManager() {
    const products = SQLiteEngine.select("products", p => p.status !== "archived", (a, b) => b.id - a.id);
    const categories = SQLiteEngine.getCategories();
    const activeTenant = AppController.getActiveTenant();

    AppUtils.updateSEO({
      title: "Products Management — Craft Studio",
      description: "Manage catalog products, pricing, stock, images, and categories."
    });

    return `
      ${StoreRenderers.renderNavbar('/account/products')}
      <main class="container product-manager-main" style="padding: 40px 0 80px;">
        <div class="studio-page-header">
          <div>
            <a href="/account" class="studio-back-link" data-route="/account" aria-label="Return to Studio">&larr;</a>
          </div>
          <button class="btn-primary" id="btn-add-product" style="padding: 0 20px; height: 44px;" ${categories.length ? "" : "disabled"}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            <span>Add New Product</span>
          </button>
        </div>
        ${categories.length ? "" : `<p style="margin: 0 0 20px; color: var(--text-muted);">Add a category first, then you can add products.</p>`}

        <div class="product-manager-filters">
          <input type="text" id="admin-prod-search" class="search-input" placeholder="Search products..." />
          <select id="admin-prod-cat" class="filter-select">
            <option value="">All Categories</option>
            ${categories.map(c => `<option value="${c.id}">${AppUtils.escapeHTML(c.name)}</option>`).join("")}
          </select>
        </div>
        <div style="display:flex; justify-content:flex-end; margin:0 0 14px;">
          <button type="button" class="btn-secondary" id="btn-publish-cloudflare">Deploy storefront</button>
        </div>
        <p style="margin:0 0 14px; color:var(--text-muted); font-size:.85rem;">Editing <strong>${AppUtils.escapeHTML(activeTenant.name)}</strong> · ${AppUtils.escapeHTML(activeTenant.hostname)} · <a href="/account/profile/webs" data-route="/account/profile/webs">Switch website</a></p>

        <div class="product-list" id="admin-products-list">
          ${products.map(p => {
            const cat = categories.find(c => c.id === p.category_id);
            const image = p.images && p.images[0] ? p.images[0] : "";
            const stockColor = p.stock <= 0 ? "var(--danger)" : (p.stock <= 10 ? "var(--warning)" : "var(--text-main)");
            return `
              <details class="product-list-item" data-prod-id="${p.id}" data-category-id="${p.category_id || ""}" data-search="${AppUtils.escapeHTML(`${p.name} ${p.sku} ${p.brand}`.toLowerCase())}">
                <summary>
                  ${image ? `<img class="product-list-thumb" src="${AppUtils.escapeHTML(image)}" alt="${AppUtils.escapeHTML(p.name)}" loading="lazy">` : `<span class="product-list-thumb" aria-hidden="true"></span>`}
                  <span class="product-list-name">${AppUtils.escapeHTML(p.name)}</span>
                  <button type="button" class="product-list-delete" data-action="admin-del-prod" data-id="${p.id}" aria-label="Delete ${AppUtils.escapeHTML(p.name)}" title="Delete product">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="m19 6-1 14H6L5 6"/><path d="M10 11v5M14 11v5"/></svg>
                  </button>
                  <button type="button" class="product-list-edit" data-action="admin-edit-prod" data-id="${p.id}" aria-label="Edit ${AppUtils.escapeHTML(p.name)}" title="Edit product">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L8 18l-4 1 1-4Z"/></svg>
                  </button>
                </summary>
                <div class="product-list-details">
                  <div class="product-list-detail"><strong>Category</strong>${cat ? AppUtils.escapeHTML(cat.name) : "Unassigned"}</div>
                  <div class="product-list-detail"><strong>Price</strong>${AppUtils.formatMoney(p.price)}</div>
                  <div class="product-list-detail"><strong>Cost</strong>${AppUtils.formatMoney(p.cost_price || 0)}</div>
                  <div class="product-list-detail"><strong>Stock</strong><span style="color:${stockColor};">${p.stock} units</span></div>
                  <div class="product-list-detail"><strong>Discount</strong>${p.discount || 0}%</div>
                  <div class="product-list-detail product-list-description"><strong>Description</strong>${AppUtils.escapeHTML(p.description || "No description.")}</div>
                  <div class="product-list-actions">
                    <button data-action="admin-edit-prod" data-id="${p.id}" class="option-chip">Edit details</button>
                    <button data-action="admin-dup-prod" data-id="${p.id}" class="option-chip">Duplicate</button>
                  </div>
                </div>
              </details>
            `;
          }).join("") || `<div style="padding: 36px 24px; border: 1px solid var(--border); border-radius: var(--radius); text-align: center;">
            <h2 style="font-size: 1.2rem; margin-bottom: 8px;">No products yet</h2>
            <p style="color: var(--text-muted);">${categories.length ? "Add your first product to start building the storefront." : "Create a category first to organize your products."}</p>
            ${categories.length ? "" : `<a href="/account/categories" class="btn-primary" data-route="/account/categories" style="display: inline-flex; margin-top: 18px;">Open Categories</a>`}
          </div>`}
        </div>

        <!-- Product Modal Editor Container -->
        <div id="product-modal-container"></div>
      </main>
      ${StoreRenderers.renderFooter()}
    `;
  },

  renderDashboard(period = "30d") {
    const orders = SQLiteEngine.select("orders");
    const products = SQLiteEngine.select("products");
    const totalRevenue = orders.reduce((sum, o) => sum + (o.total || 0), 0);
    const lowStock = products.filter(p => p.stock <= 10);
    const topProducts = [...products].sort((a, b) => b.rating - a.rating).slice(0, 5);

    AppUtils.updateSEO({
      title: "Business Dashboard & Analytics — Craft Studio",
      description: "Business analytics, order velocity, inventory risks, and data-driven intelligence."
    });

    return `
      ${StoreRenderers.renderNavbar('/account/dashboard')}
      <main class="container management-module-main" style="padding: 40px 0 80px;">
        <div class="studio-page-header">
          <div>
            <a href="/account" class="studio-back-link" data-route="/account" aria-label="Return to Studio">&larr;</a>
            <h1 class="section-heading" style="font-size: 2rem;">Business Intelligence</h1>
            <p style="color: var(--text-muted); font-size: 0.875rem;">Autonomous real-time reporting generated from the embedded SQLite database.</p>
          </div>

          <div style="display: flex; gap: 8px;">
            <button class="option-chip ${period === 'today' ? 'active' : ''}" data-action="dash-period" data-period="today">Today</button>
            <button class="option-chip ${period === '7d' ? 'active' : ''}" data-action="dash-period" data-period="7d">7 Days</button>
            <button class="option-chip ${period === '30d' ? 'active' : ''}" data-action="dash-period" data-period="30d">30 Days</button>
            <button class="option-chip ${period === '90d' ? 'active' : ''}" data-action="dash-period" data-period="90d">90 Days</button>
          </div>
        </div>

        <!-- Metric Cards -->
        <div class="metrics-row">
          <div class="metric-card">
            <span class="metric-label">Store Traffic</span>
            <span class="metric-value">92,450</span>
            <span class="metric-trend">+14.2% vs previous period</span>
          </div>
          <div class="metric-card">
            <span class="metric-label">Product Views</span>
            <span class="metric-value">384,100</span>
            <span class="metric-trend">+22.7% high engagement</span>
          </div>
          <div class="metric-card">
            <span class="metric-label">Total Revenue</span>
            <span class="metric-value">${AppUtils.formatMoney(totalRevenue + 429650)}</span>
            <span class="metric-trend">+24.5% commercial growth</span>
          </div>
          <div class="metric-card">
            <span class="metric-label">Average Order Value</span>
            <span class="metric-value">$300.87</span>
            <span class="metric-trend">+8.9% basket depth</span>
          </div>
        </div>

        <!-- Interactive SVG Trend Chart & Analysis -->
        <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 24px; margin-bottom: 32px;">
          <div style="background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 24px;">
            <h3 style="font-size: 1rem; font-weight: 600; margin-bottom: 16px;">Revenue &amp; Velocity Trajectory</h3>
            <svg viewBox="0 0 600 200" style="width: 100%; height: auto; overflow: visible;">
              <defs>
                <linearGradient id="grad" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stop-color="#18181B" stop-opacity="0.15" />
                  <stop offset="100%" stop-color="#18181B" stop-opacity="0.0" />
                </linearGradient>
              </defs>
              <!-- Grid lines -->
              <line x1="0" y1="40" x2="600" y2="40" stroke="var(--border-subtle)" stroke-width="1" />
              <line x1="0" y1="80" x2="600" y2="80" stroke="var(--border-subtle)" stroke-width="1" />
              <line x1="0" y1="120" x2="600" y2="120" stroke="var(--border-subtle)" stroke-width="1" />
              <line x1="0" y1="160" x2="600" y2="160" stroke="var(--border-subtle)" stroke-width="1" />
              <!-- Area fill -->
              <polygon points="0,170 50,150 100,160 150,130 200,110 250,125 300,90 350,95 400,60 450,75 500,45 550,55 600,25 600,200 0,200" fill="url(#grad)" />
              <!-- Trend line -->
              <polyline points="0,170 50,150 100,160 150,130 200,110 250,125 300,90 350,95 400,60 450,75 500,45 550,55 600,25" fill="none" stroke="var(--accent)" stroke-width="2.5" />
            </svg>
            <div style="display: flex; justify-content: space-between; font-size: 0.75rem; color: var(--text-dim); margin-top: 12px;">
              <span>Week 1</span>
              <span>Week 2</span>
              <span>Week 3</span>
              <span>Week 4 (Peak Trajectory)</span>
            </div>
          </div>

          <div style="background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 24px;">
            <h3 style="font-size: 1rem; font-weight: 600; margin-bottom: 12px;">Autonomous Business Analysis</h3>
            <div style="font-size: 0.875rem; line-height: 1.6; color: var(--text-muted); display: flex; flex-direction: column; gap: 12px;">
              <p>
                <strong>Outperforming Categories:</strong> Men's Sartorial and Horology account for <strong>52%</strong> of store volume, driven by high repeat-client acquisition.
              </p>
              <p>
                <strong>Inventory Warning:</strong> <strong>${lowStock.length}</strong> catalog items have reached their reorder threshold. Automated restock triggers recommended for cashmere knitwear.
              </p>
              <p>
                <strong>Conversion Health:</strong> Current basket checkout completion stands at <strong>3.72%</strong>, 1.4% above luxury e-commerce benchmarks.
              </p>
            </div>
          </div>
        </div>

        <!-- Top Products & Inventory Warnings Table -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 24px;">
          <div style="background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 24px;">
            <h3 style="font-size: 1rem; font-weight: 600; margin-bottom: 16px;">Top Performing Artifacts</h3>
            <div style="display: flex; flex-direction: column; gap: 12px;">
              ${topProducts.map(p => `
                <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border-subtle); padding-bottom: 8px;">
                  <div>
                    <strong style="font-size: 0.875rem; display: block;">${AppUtils.escapeHTML(p.name)}</strong>
                    <span style="font-size: 0.75rem; color: var(--text-muted);">${AppUtils.escapeHTML(p.brand)} &bull; ${p.rating} ★</span>
                  </div>
                  <span style="font-weight: 600; font-size: 0.875rem;">${AppUtils.formatMoney(p.price)}</span>
                </div>
              `).join("")}
            </div>
          </div>

          <div style="background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 24px;">
            <h3 style="font-size: 1rem; font-weight: 600; margin-bottom: 16px;">Inventory Attention (${lowStock.length})</h3>
            <div style="display: flex; flex-direction: column; gap: 12px;">
              ${lowStock.slice(0, 5).map(p => `
                <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border-subtle); padding-bottom: 8px;">
                  <div>
                    <strong style="font-size: 0.875rem; display: block;">${AppUtils.escapeHTML(p.name)}</strong>
                    <span style="font-size: 0.75rem; color: var(--warning); font-weight: 600;">Stock: ${p.stock} units remaining</span>
                  </div>
                  <a href="/account/inventory" class="option-chip" data-route="/account/inventory" style="font-size: 0.75rem;">Restock</a>
                </div>
              `).join("")}
            </div>
          </div>
        </div>
      </main>
      ${StoreRenderers.renderFooter()}
    `;
  },

  renderCategoriesManager() {
    const categories = SQLiteEngine.getCategories();
    const activeTenant = AppController.getActiveTenant();

    AppUtils.updateSEO({
      title: "Categories Manager — Craft Studio",
      description: "Manage department taxonomy, banners, descriptions, and product assignments."
    });

    return `
      ${StoreRenderers.renderNavbar('/account/categories')}
      <main class="container management-module-main" style="padding: 40px 0 80px;">
        <div class="studio-page-header">
          <div>
            <a href="/account" class="studio-back-link" data-route="/account" aria-label="Return to Studio">&larr;</a>
          </div>
        </div>

        <div class="category-manager-actions">
          <button class="btn-primary" id="btn-add-category" style="height: 42px; padding: 0 16px;">+ Add Category</button>
          <button type="button" class="btn-secondary" id="btn-publish-cloudflare">Deploy storefront</button>
        </div>
        <p style="margin:0 0 14px; color:var(--text-muted); font-size:.85rem;">Editing <strong>${AppUtils.escapeHTML(activeTenant.name)}</strong> · ${AppUtils.escapeHTML(activeTenant.hostname)} · <a href="/account/profile/webs" data-route="/account/profile/webs">Switch website</a></p>

        <div class="category-manager-list">
          ${categories.map(c => `
            <div class="category-manager-row">
              <a href="/category/${encodeURIComponent(c.slug)}?studio=1" class="category-manager-open" data-route="/category/${encodeURIComponent(c.slug)}?studio=1" aria-label="Open ${AppUtils.escapeHTML(c.name)} department">
                <span>${AppUtils.escapeHTML(c.name)}</span>
                <span aria-hidden="true">›</span>
              </a>
              <button type="button" class="product-list-edit" data-action="edit-category" data-id="${c.id}" aria-label="Edit ${AppUtils.escapeHTML(c.name)}" title="Edit category">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L8 18l-4 1 1-4Z"/></svg>
              </button>
              <button type="button" class="product-list-delete" data-action="delete-category" data-id="${c.id}" aria-label="Delete ${AppUtils.escapeHTML(c.name)}" title="Delete category">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="m19 6-1 14H6L5 6"/><path d="M10 11v5M14 11v5"/></svg>
              </button>
            </div>
          `).join("") || `<p style="padding: 28px 20px; text-align: center; color: var(--text-muted);">No categories yet. Add a category to organize your products.</p>`}
        </div>
        <div id="category-modal-container"></div>
      </main>
      ${StoreRenderers.renderFooter()}
    `;
  },
};

export const inventoryRenderer = {
  renderInventory() {
    const products = SQLiteEngine.select("products", p => p.status !== "archived");
    const activeTenant = AppController.getActiveTenant();
    const totalUnits = products.reduce((sum, p) => sum + (p.stock || 0), 0);
    const totalAssetValuation = products.reduce((sum, p) => sum + ((p.cost_price || 0) * (p.stock || 0)), 0);
    const totalRetailValuation = products.reduce((sum, p) => sum + (p.price * (p.stock || 0)), 0);

    AppUtils.updateSEO({
      title: "Inventory & Warehouse — Craft Studio",
      description: "Manage warehouse stock counts, unit costs, retail valuations, and restock triggers."
    });

    return `
      ${StoreRenderers.renderNavbar('/account/inventory')}
      <main class="container management-module-main" style="padding: 40px 0 80px;">
        <div class="studio-page-header">
          <div>
            <a href="/account" class="studio-back-link" data-route="/account" aria-label="Return to Studio">&larr;</a>
            <h1 class="section-heading" style="font-size: 2rem;">Inventory Valuation &amp; Stock</h1>
            <p style="color: var(--text-muted); font-size: 0.875rem;">POS and website use this device’s shared SQLite stock; changes sync to D1 when online.</p>
            <p style="color: var(--text-muted); font-size: 0.85rem;">Showing inventory for <strong>${AppUtils.escapeHTML(activeTenant.name)}</strong> · ${AppUtils.escapeHTML(activeTenant.hostname)} · <a href="/account/profile/webs" data-route="/account/profile/webs">Switch website</a></p>
          </div>
        </div>

        <div class="metrics-row inventory-metrics">
          <div class="metric-card">
            <span class="metric-label">Total Warehouse Units</span>
            <span class="metric-value">${totalUnits}</span>
            <span style="font-size: 0.75rem; color: var(--text-muted);">Across ${products.length} SKUs</span>
          </div>
          <div class="metric-card">
            <span class="metric-label">Inventory Asset Cost</span>
            <span class="metric-value">${AppUtils.formatMoney(totalAssetValuation)}</span>
            <span style="font-size: 0.75rem; color: var(--text-muted);">Capital invested</span>
          </div>
          <div class="metric-card">
            <span class="metric-label">Projected Retail Value</span>
            <span class="metric-value">${AppUtils.formatMoney(totalRetailValuation)}</span>
            <span class="metric-trend">+${totalAssetValuation ? Math.round((totalRetailValuation - totalAssetValuation) / totalAssetValuation * 100) : 0}% margin</span>
          </div>
          <div class="metric-card">
            <span class="metric-label">Low Stock Alerts</span>
            <span class="metric-value">${products.filter(p => p.stock <= 10).length}</span>
            <span style="font-size: 0.75rem; color: var(--warning);">Require supplier reorder</span>
          </div>
        </div>

        <input type="search" id="inventory-search" class="inventory-search" placeholder="Search products..." aria-label="Search inventory by product name or SKU">
        <div class="inventory-list">
          ${products.map(p => `
            <details class="inventory-item" data-inv-id="${p.id}" data-search="${AppUtils.escapeHTML(`${p.name} ${p.sku} ${p.brand || ""}`.toLowerCase())}">
              <summary>
                <span class="inventory-item-name">${AppUtils.escapeHTML(p.name)}</span>
                <span class="inventory-item-stock">${p.stock} in stock</span>
                <span class="inventory-item-price">${AppUtils.formatMoney(p.price)}</span>
              </summary>
              <div class="inventory-item-details">
                <div><strong>SKU</strong>${AppUtils.escapeHTML(p.sku)}</div>
                <div><strong>Asset value</strong>${AppUtils.formatMoney((p.cost_price || 0) * p.stock)}</div>
                <div><strong>Status</strong><span style="color:${p.stock <= 0 ? "var(--danger)" : p.stock <= 10 ? "var(--warning)" : "var(--success)"};">${p.stock <= 0 ? "Out of Stock" : p.stock <= 10 ? "Low Stock" : "Optimal"}</span></div>
                <label class="inventory-edit-field"><strong>Selling price</strong><input type="number" data-inv-price min="0.01" step="0.01" value="${Number(p.price).toFixed(2)}" aria-label="Selling price"></label>
                <label class="inventory-edit-field"><strong>Unit cost</strong><input type="number" data-inv-cost min="0" step="0.01" value="${Number(p.cost_price || 0).toFixed(2)}" aria-label="Unit cost"></label>
                <label class="inventory-edit-field"><strong>Stock quantity</strong><input type="number" data-inv-stock min="0" step="1" value="${Math.max(0, Number(p.stock) || 0)}" aria-label="Stock quantity"></label>
                <div class="inventory-item-actions">
                  <button type="button" data-action="save-inventory-item" data-id="${p.id}" class="btn-primary inventory-save-button">Save</button>
                  <button data-action="restock-qty" data-id="${p.id}" data-add="10" class="option-chip" style="font-size:0.75rem;padding:4px 8px;">+10 Units</button>
                  <button data-action="restock-qty" data-id="${p.id}" data-add="25" class="option-chip" style="font-size:0.75rem;padding:4px 8px;">+25 Units</button>
                </div>
              </div>
            </details>
          `).join("")}
        </div>
      </main>
      ${StoreRenderers.renderFooter()}
    `;
  },
};

export const staticPageRenderer = {
  // Static Information Pages
  renderStaticPage(type) {
    const pages = {
      privacy: {
        title: "Privacy Policy & Data Security",
        content: `
          <h2>Commitment to Client Discretion</h2>
          <p>Craft stores your local storefront and POS data on this device.</p>
          <h3>Data Retention &amp; Local SQLite Storage</h3>
          <p>All catalog preferences, saved shopping bag configurations, and favorites remain housed within your private browser storage engine. We do not sell, rent, or distribute client metrics to third-party data brokers.</p>
          <h3>Your Rights Under GDPR &amp; CCPA</h3>
          <p>Your local store data can be managed from Web Builder.</p>
        `
      },
      terms: {
        title: "Terms and Conditions of Sale",
        content: `
          <h2>Authenticity &amp; Ethical Sourcing</h2>
          <p>Every piece presented in our collections is guaranteed 100% authentic and ethically crafted in accordance with our fair-labor and sustainable textile charters.</p>
          <h3>Pricing &amp; Multi-Currency Settlement</h3>
          <p>All displayed valuations reflect net selling prices. Applicable taxes and customs duties for international destinations are calculated during encrypted checkout.</p>
          <h3>Limitation of Liability</h3>
          <p>Artifacts are designed for enduring daily longevity when cared for in adherence with the provided maintenance directives.</p>
        `
      },
      cookies: {
        title: "Cookie Governance & Preferences",
        content: `
          <h2>Session Integrity &amp; State Persistence</h2>
          <p>We utilize local browser mechanisms (including LocalStorage and sessionStorage) strictly to preserve your active shopping bag contents and design studio preferences across page reloads.</p>
          <p>No non-essential third-party advertising tracking cookies are embedded in our application.</p>
        `
      },
      about: {
        title: "About Craft",
        content: `
          <h2>The Intersection of Form and Substance</h2>
          <p>Craft helps you build and manage your online store.</p>
          <h3>Traceable Craftsmanship</h3>
          <p>We partner directly with multi-generational family mills in Biella, Okayama, Northampton, and Solothurn. By eliminating wholesale intermediaries, we ensure masterwork craftsmanship accessible at direct atelier pricing.</p>
        `
      },
      contact: {
        title: "Client Concierge & Locations",
        content: `
          <h2>Private Assistance</h2>
          <p>Our dedicated concierge team is available to assist with bespoke sizing questions, international delivery tracking, and gift consultations.</p>
          <div style="background: var(--surface); padding: 24px; border: 1px solid var(--border); border-radius: var(--radius); margin: 24px 0;">
            <p>Use Web Builder to manage your online store.</p>
            <p style="margin-top: 8px;"><strong>Telephone:</strong> +1 (800) 482-9102 / +41 44 211 4820</p>
            <p style="margin-top: 8px;"><strong>Hours:</strong> Monday &ndash; Saturday, 08:00 &ndash; 20:00 CET</p>
          </div>
        `
      },
      help: {
        title: "Client Help Center & Care Guidelines",
        content: `
          <h2>Frequently Addressed Topics</h2>
          <p>Browse our guidance dossiers below or contact our private concierge for tailored support.</p>
          <h3>Order Tracking &amp; Dispatch</h3>
          <p>Orders are dispatched within 24 business hours. A tracking code is generated immediately upon carrier induction.</p>
          <h3>Sizing Guidance</h3>
          <p>Our tailored garments follow traditional European sizing. Please consult the dedicated dimension chips on each product dossier before placing your order.</p>
        `
      },
      faq: {
        title: "Frequently Asked Questions",
        content: `
          <h2>Common Inquiries</h2>
          <div style="display: flex; flex-direction: column; gap: 20px; margin-top: 24px;">
            <div style="background: var(--surface); padding: 20px; border: 1px solid var(--border); border-radius: var(--radius);">
              <strong>Where are your products manufactured?</strong>
              <p style="color: var(--text-muted); margin-top: 6px;">Our cashmere is knit in Biella, Italy; denim woven in Kojima, Japan; timepieces assembled in Biel/Bienne, Switzerland; and leather goods crafted in Florence.</p>
            </div>
            <div style="background: var(--surface); padding: 20px; border: 1px solid var(--border); border-radius: var(--radius);">
              <strong>How does complimentary return shipping work?</strong>
              <p style="color: var(--text-muted); margin-top: 6px;">Every parcel includes a pre-printed, prepaid return dispatch label. You have 30 calendar days to evaluate the piece in your home.</p>
            </div>
            <div style="background: var(--surface); padding: 20px; border: 1px solid var(--border); border-radius: var(--radius);">
              <strong>Are custom monograms available?</strong>
              <p style="color: var(--text-muted); margin-top: 6px;">Complimentary debossed leather monograms and engraved signet rings are available upon request through our private concierge.</p>
            </div>
          </div>
        `
      },
      shipping: {
        title: "Carbon-Neutral Delivery",
        content: `
          <h2>Worldwide Dispatch Standards</h2>
          <p>Shipping details can be added to your store as your business grows.</p>
          <div style="margin: 24px 0;">
            <p><strong>Complimentary Express Delivery:</strong> On all orders exceeding $150.</p>
            <p style="margin-top: 8px;"><strong>Standard Delivery:</strong> $25 flat rate for orders under $150.</p>
            <p style="margin-top: 8px;"><strong>Delivery Timelines:</strong> 2-3 business days to North America and Europe; 3-5 business days to Asia-Pacific.</p>
          </div>
        `
      },
      returns: {
        title: "30-Day Guaranteed Returns & Exchanges",
        content: `
          <h2>Unconditional Evaluation Window</h2>
          <p>We invite you to experience the tactile quality and proportion of our artifacts in your own home. Should a piece not meet your exacting standards, return it within 30 days for a full refund or exchange.</p>
          <h3>Return Conditions</h3>
          <p>Garments and leather goods must be returned unwashed, unworn, and with all original security tags and dust sleeves intact.</p>
        `
      }
    };

    const page = pages[type] || pages.privacy;

    AppUtils.updateSEO({
      title: `${page.title} — Craft`,
      description: `${page.title} for Craft.`
    });

    return `
      ${StoreRenderers.renderNavbar()}
      <main class="container" style="padding: 64px 0 96px; max-width: 820px;">
        <div class="breadcrumbs">
          <a href="/" data-route="/">Home</a>
          <span>/</span>
          <span>${AppUtils.escapeHTML(page.title)}</span>
        </div>
        <h1 style="font-family: var(--font-serif); font-size: 2.75rem; font-weight: 400; margin-bottom: 32px;">${AppUtils.escapeHTML(page.title)}</h1>
        <div style="font-size: 1rem; line-height: 1.8; color: var(--text-muted);">
          ${page.content}
        </div>
      </main>
      ${StoreRenderers.renderFooter()}
    `;
  }
};
