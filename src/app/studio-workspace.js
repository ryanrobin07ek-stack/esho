// Account, Main Store and web studio workspace shells.
// Moved verbatim out of src/app/main.js (the StudioRenderers object); main.js spreads these back in at the same spots.
import { AppController, AppUtils, SQLiteEngine, StoreRenderers, WEBSITE_BUILDER_DRAFT_TENANT_ID } from './main.js';
import { navIcon } from '../nav-icons.js';
import { DOMAIN } from './domain.js';

export const workspaceShells = {
  renderAccount() {
    const modules = [
      { title: "Point of Sale", description: "Open checkout, POS inventory, receipts, and sales reporting.", route: "/pos" },
      { title: "Products Manager", description: "Manage products, pricing, imagery, and specifications with live SQLite sync.", route: "/account/products" },
      { title: "Inventory", description: "Review stock counts, valuations, and low-stock items.", route: "/account/inventory" },
      { title: "Categories", description: "Organize collections, reassign products, and manage department details.", route: "/account/categories" },
      { title: "Business Dashboard", description: "Explore sales volume, conversion metrics, and business performance.", route: "/account/dashboard" },
      { title: "Build Your Web", description: "Edit store details and pages, then open the customer-facing storefront.", route: "/account/web" },
      { title: "Store Settings", description: "Adjust your storefront appearance and preferences.", route: "/account/settings" },
      { title: "My shops", description: "Manage the websites linked to your account.", route: "/account/tenants" },
      { title: "Plans & Tiering", description: "View available plans and features.", route: "/account/plans" },
    ];

    AppUtils.updateSEO({
      title: "Web Builder — Craft",
      description: "Build and preview your Craft online store."
    });

    return `
      ${StoreRenderers.renderNavbar("/account")}
      <main class="container account-dashboard-main" style="padding:32px 0 80px;">
        <div style="margin:0 0 24px;">
          <span class="section-eyebrow studio-architecture-eyebrow">Studio Architecture</span>
          <h1 class="section-heading studio-architecture-title" style="margin-top:8px;text-align:center;">Management</h1>
        </div>
        <nav class="studio-nav-grid" aria-label="Management modules">
          ${modules.map(module => `
            <a href="${module.route}" class="studio-card ${module.className || ""}" data-route="${module.route}">
              <h2 class="studio-card-title">${module.title}</h2>
              <p class="studio-card-desc">${module.description}</p>
            </a>
          `).join("")}
        </nav>
      </main>
      ${StoreRenderers.renderFooter()}
    `;
  },

  renderMainShop() {
    return this.renderMainShopWorkspace("/account/main-shop");
  },

  renderWorkspaceSidebar(title, items, activeRoute) {
    const label = AppUtils.escapeHTML(title);
    const route = AppUtils.escapeHTML(activeRoute);
    const profileLinks = [
      { title: "Profile", route: "/account/profile/profile" },
      { title: "Webs", route: "/account/profile/webs" },
      { title: "Accounts", route: "/account/profile/accounts" },
      { title: "Privacy", route: "/account/profile/privacy" },
      { title: "Recommended actions", route: "/account/profile/recommended-actions" },
      { title: "Link devices", route: "/account/profile/link-devices" },
      // Both of these existed with no way in: the owner could only reach them by asking the AI
      // helper for a link. Every menu in the app opens this list, so they belong here.
      { title: "App settings", route: "/account/settings" },
      { title: "Plans", route: "/account/plans" },
      { title: "Updates", route: "/account/profile/updates" }
    ];
    return `<details class="workspace-menu">
      <summary aria-label="Open ${label} menu" title="Open menu">
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="12" cy="5" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="12" cy="19" r="1.8"/></svg>
      </summary>
      <a class="workspace-sidebar-scrim" href="${route}" data-route="${route}" aria-label="Close ${label} menu"></a>
      <aside class="workspace-sidebar" aria-label="${label} menu">
        <h2>${label}</h2>
        <nav class="workspace-sidebar-links" aria-label="${label} pages">
          ${items.map(item => item.disabled
            ? `<a href="#" class="workspace-sidebar-link" aria-disabled="true" tabindex="-1">${AppUtils.escapeHTML(item.title)}</a>`
            : `<a href="${AppUtils.escapeHTML(item.route)}" data-route="${AppUtils.escapeHTML(item.route)}" class="workspace-sidebar-link ${item.route === activeRoute ? "is-active" : ""}" ${item.route === activeRoute ? 'aria-current="page"' : ""}>${AppUtils.escapeHTML(item.title)}</a>`).join("")}
        </nav>
        <div class="workspace-sidebar-divider" aria-hidden="true"></div>
        <nav class="workspace-sidebar-links" aria-label="Profile and app links">
          ${profileLinks.map(item => `<a href="${item.route}" data-route="${item.route}" class="workspace-sidebar-link">${item.title}</a>`).join("")}
        </nav>
        <a class="workspace-sidebar-link workspace-sidebar-logout" href="/" data-route="/" data-home-screen aria-label="Log out"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 17l5-5-5-5M15 12H3"/><path d="M12 3h7a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-7"/></svg><span>Log out</span></a>
      </aside>
    </details>`;
  },

  analyticsDays() {
    const stored = window.BusinessLens?.readFilters?.()?.analyticsDays;
    if (stored == null || String(stored).trim() === "") return 30;
    const days = Number(stored);
    return Number.isFinite(days) ? Math.min(365, Math.max(1, Math.trunc(days))) : 30;
  },

  renderWorkspaceLoading(label) {
    const accessibleLabel = AppUtils.escapeHTML(`Loading ${label}`);
    return `<div class="workspace-loading-skeleton" role="status" aria-label="${accessibleLabel}" aria-busy="true">
      <div class="studio-metric-grid" aria-hidden="true">
        ${Array.from({ length: 3 }, () => `<article class="studio-data-card"><span class="workspace-skeleton-line is-short"></span><strong class="workspace-skeleton-line is-value"></strong><small class="workspace-skeleton-line is-medium"></small></article>`).join("")}
      </div>
      <article class="studio-panel workspace-skeleton-panel" aria-hidden="true">
        <span class="workspace-skeleton-line is-short"></span>
        <span class="workspace-skeleton-line is-long"></span>
        <span class="workspace-skeleton-line is-medium"></span>
        <span class="workspace-skeleton-line is-long"></span>
        <span class="workspace-skeleton-line is-medium"></span>
      </article>
    </div>`;
  },

  renderMainShopWorkspace(path) {
    if (path === "/account/main-shop/insights") path = "/account/main-shop";
    if (path === "/account/web" || path.startsWith("/account/web/studio/")) {
      return this.renderWebStudioWorkspace(path);
    }
    const businessFilters = window.BusinessLens?.readFilters?.() || {};
    const bottomItems = [
      { route: "/account/main-shop", title: "Overview", section: "overview", icon: navIcon("overview") },
      { route: "/store/revenue", title: "Sales", section: "sales", icon: navIcon("sales") },
      { route: "/account/customers", title: "Customers", section: "customers", icon: navIcon("customers") },
      { route: "/store/manage/products", title: "Catalogue", section: "store", icon: navIcon("products") },
      { route: "/account/main-shop/finance", title: "More", section: "more", icon: navIcon("more") }
    ];
    const isStoreManagement = path === "/store/manage" || path.startsWith("/store/manage/");
    const section = isStoreManagement ? "store"
      : path === "/account/main-shop" ? "overview"
      : ["/store/revenue", "/store/channels", "/store/sales", "/store/orders", "/store/payments"].includes(path) ? "sales"
        : ["/store/products", "/store/inventory", "/store/categories", "/store/split-shop"].includes(path) ? "products"
          : path.startsWith("/account/customers") || path === "/account/main-shop/marketing" ? "customers"
            : path.startsWith("/account/main-shop/") ? "more"
              : path.startsWith("/store/") ? "products" : "overview";
    const pagesBySection = {
      overview: [
        { route: "/account/main-shop", title: "Overview" }
      ],
      sales: [
        { route: "/store/revenue", title: "Revenue" },
        { route: "/store/channels", title: "Channels" },
        { route: "/store/sales", title: "Transactions" },
        { route: "/store/orders", title: "Orders" },
        { route: "/store/payments", title: "Payments" }
      ],
      products: [
        { route: "/store/products", title: "Products" },
        { route: "/store/products/manage", title: "Edit products" },
        { route: "/store/inventory", title: "Inventory" },
        { route: "/store/categories", title: "Categories" },
        { route: "/store/split-shop", title: "Split products" }
      ],
      store: [
        { route: "/store/products", title: "Web products" },
        { route: "/store/products/manage", title: "Edit products" },
        { route: "/store/inventory", title: "Inventory" },
        { route: "/store/categories", title: "Web categories" },
        { route: "/store/split-shop", title: "Split products" }
      ],
      customers: [
        { route: "/account/customers", title: "Customers" },
        { route: "/account/main-shop/marketing", title: "Marketing" },
        { route: "/account/customers/newsletter", title: "Newsletter" }
      ],
      more: [
        { route: "/account/main-shop/finance", title: "Finance" },
        { route: "/account/main-shop/stores", title: "Stores" },
        { route: "/account/main-shop/settings", title: "Settings" },
        { route: "/account/main-shop/help", title: "Help" }
      ]
    };
    const pages = pagesBySection[section];
    const canonicalPath = path === "/account/main-shop/" ? "/account/main-shop"
      : path === "/store/sales" ? "/store/sales"
        : path;
    const page = isStoreManagement
      ? { title: path.endsWith("/categories") ? "Categories" : "Products" }
      : pages.find(item => item.route === canonicalPath) || pages[0];
    const sectionSidebar = this.renderWorkspaceSidebar(
      section === "store" ? "Store" : `${section[0].toUpperCase()}${section.slice(1)} screens`,
      pages,
      canonicalPath
    );
    const showBusinessFilters = !isStoreManagement && path !== "/store/products/manage";
    const cachedSnapshot = this.getCachedMainShopSnapshot();
    const initialContent = cachedSnapshot
      ? this.renderMainShopContent(path, cachedSnapshot)
      : this.renderWorkspaceLoading("business records");
    AppUtils.updateSEO({
      title: `${page.title} — Craft`,
      description: "Business overview, sales, product, customer, finance and store intelligence."
    });
    return `
      <main class="container account-dashboard-main store-workspace-shell studio-workspace business-lens-shell" style="padding:12px 0 92px;">
        <header class="studio-workspace-heading">
          <a class="studio-workspace-back" href="/" data-route="/" data-home-screen aria-label="Back to Craft home"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 12H5m7 7-7-7 7-7"/></svg></a>
          <h1 class="studio-workspace-tab-title">${AppUtils.escapeHTML(page.title)}</h1>
          <div class="studio-workspace-header-actions">
            ${AppUtils.craftAccountSignedIn() ? "" : `<a href="/app-account" data-route="/app-account"
              class="btn-primary studio-signin-btn" title="Sign in to load orders, alerts and publishing">Sign in</a>`}
            ${showBusinessFilters ? `<button type="button" class="studio-preview-link bl-filter-toggle" data-business-filter-toggle aria-label="Show filters" aria-controls="business-date-filters" aria-expanded="false">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 5h16l-6.5 7.5v5l-3 1.5v-6.5L4 5z"/></svg>
            </button>` : ""}
            ${sectionSidebar}
          </div>
        </header>
        ${showBusinessFilters ? `<nav id="business-date-filters" class="bl-date-filter" aria-label="Business filters" hidden>
          <label><span>Range</span><select class="business-filter" data-filter="range"><option value="today" ${businessFilters.range === "today" ? "selected" : ""}>Today</option><option value="7d" ${businessFilters.range === "7d" ? "selected" : ""}>7 days</option><option value="30d" ${(!businessFilters.range || businessFilters.range === "30d") ? "selected" : ""}>30 days</option><option value="90d" ${businessFilters.range === "90d" ? "selected" : ""}>90 days</option><option value="month" ${businessFilters.range === "month" ? "selected" : ""}>This month</option><option value="ytd" ${businessFilters.range === "ytd" ? "selected" : ""}>Year to date</option><option value="all" ${businessFilters.range === "all" ? "selected" : ""}>All time</option><option value="custom" ${businessFilters.range === "custom" ? "selected" : ""}>Custom</option></select></label>
          <label><span>From</span><input class="business-filter" data-filter="from" type="date" value="${AppUtils.escapeHTML(businessFilters.from || "")}"></label>
          <label><span>To</span><input class="business-filter" data-filter="to" type="date" value="${AppUtils.escapeHTML(businessFilters.to || "")}"></label>
          <label><span>Channel</span><select class="business-filter" data-filter="channel"><option value="all" ${(!businessFilters.channel || businessFilters.channel === "all") ? "selected" : ""}>All</option><option value="web" ${businessFilters.channel === "web" ? "selected" : ""}>Web</option><option value="pos" ${businessFilters.channel === "pos" ? "selected" : ""}>Counter</option></select></label>
          <label><span>Category</span><select class="business-filter" data-filter="category"><option value="all">All</option>${SQLiteEngine.getCategories().map(category => `<option value="${AppUtils.escapeHTML(category.name)}" ${businessFilters.category === category.name ? "selected" : ""}>${AppUtils.escapeHTML(category.name)}</option>`).join("")}</select></label>
          <label><span>Interval</span><select class="business-filter" data-filter="granularity"><option value="day" ${(!businessFilters.granularity || businessFilters.granularity === "day") ? "selected" : ""}>Daily</option><option value="week" ${businessFilters.granularity === "week" ? "selected" : ""}>Weekly</option><option value="month" ${businessFilters.granularity === "month" ? "selected" : ""}>Monthly</option></select></label>
        </nav>` : ""}
        <nav class="studio-workspace-bottom-nav" aria-label="Business sections">
          ${bottomItems.map(item => `
            <a href="${item.route}" class="studio-workspace-bottom-link ${item.section === section ? "is-active" : ""}" data-route="${item.route}" ${item.section === section ? 'aria-current="page"' : ""}>
              <span class="studio-nav-icon" aria-hidden="true">${item.icon}</span>
              <span>${item.title}</span>
            </a>
          `).join("")}
        </nav>
        <section id="store-workspace-content" class="store-workspace-content business-lens-content" aria-live="polite" style="min-height:180px;padding-top:10px;">
          ${initialContent}
        </section>
      </main>
    `;
  },

  renderWebsiteManagementCards(websites, deleteLabel = "Delete web", ariaLabel = "Your websites") {
    const activeTenant = AppController.getActiveTenant();
    const visibleWebsites = websites
      .filter(website => website.id !== "main")
      .sort((a, b) => Number(b.id === activeTenant.id) - Number(a.id === activeTenant.id));
    const value = input => AppUtils.escapeHTML(String(input || "").trim() || "Not added yet");
    return `
      <section class="profile-page-websites" aria-label="${AppUtils.escapeHTML(ariaLabel)}">
        ${visibleWebsites.map(website => `
          <article class="profile-page-card profile-website-card">
            <header class="profile-website-card-heading">
              <div>
                <h2><a class="profile-website-settings-link" href="/account/profile/webs/${encodeURIComponent(website.id)}" data-route="/account/profile/webs/${encodeURIComponent(website.id)}">${AppUtils.escapeHTML(website.name)}</a></h2>
                ${website.id === WEBSITE_BUILDER_DRAFT_TENANT_ID
                  // A draft has no web address yet: plain text, and no "open live website" button.
                  ? `<p class="profile-website-domain">${AppUtils.escapeHTML(website.hostname)}</p>`
                  : `<p class="profile-website-domain"><a href="https://${AppUtils.escapeHTML(website.hostname)}" target="_blank" rel="noopener">${AppUtils.escapeHTML(website.hostname)}</a></p>`}
              </div>
              ${website.id === WEBSITE_BUILDER_DRAFT_TENANT_ID ? "" : `<a class="profile-website-live" href="https://${AppUtils.escapeHTML(website.hostname)}" target="_blank" rel="noopener" aria-label="Open ${AppUtils.escapeHTML(website.name)} live website">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18"/></svg>
              </a>`}
            </header>
            ${website.id === activeTenant.id ? '<span class="profile-current-website-badge">Currently managing</span>' : ""}
            <div class="profile-page-details">
              <p>Store details: ${value(website.store.description)}</p>
              <p>Location: ${value(website.store.location_address || website.store.location)}</p>
              <p>Email: ${value(website.store.email)}</p>
              <p>Phone: ${value(website.store.phone)}</p>
              <p>${website.products.length} products · ${website.categories.length} categories</p>
            </div>
            <div class="website-management-actions">
              <button class="btn-primary" type="button" data-edit-website="${AppUtils.escapeHTML(website.id)}">Edit</button>
              ${website.id === WEBSITE_BUILDER_DRAFT_TENANT_ID ? "" /* A draft has no domain, no visitors and nothing on the server to delete yet. */ : `
              <a class="btn-secondary" href="/account/profile/webs/${encodeURIComponent(website.id)}/domains" data-route="/account/profile/webs/${encodeURIComponent(website.id)}/domains">Domains</a>
              <a class="btn-secondary" href="/account/profile/webs/${encodeURIComponent(website.id)}/stats" data-route="/account/profile/webs/${encodeURIComponent(website.id)}/stats">Stats</a>
              <button class="btn-secondary profile-website-delete" type="button" data-delete-website="${AppUtils.escapeHTML(website.id)}"${website.id === "main" ? ' disabled title="The main Craft domain cannot be deleted."' : ""}>${deleteLabel}</button>`}
            </div>
            <button class="btn-primary website-management-manage" type="button" data-manage-website="${AppUtils.escapeHTML(website.id)}">Manage this web</button>
          </article>
        `).join("")}
      </section>`;
  },

  webStudioNavigation() {
    const activeTenant = AppController.getActiveTenant();
    const domainTenantId = AppController.isWebsiteBuilderDraftTenant(activeTenant.id) ? "main" : activeTenant.id;
    const domainsRoute = `/account/profile/webs/${encodeURIComponent(domainTenantId)}/domains`;
    return [
      {
        title: "Overview",
        route: "/account/web/studio/dashboard/overview",
        icon: navIcon("overview"),
        tabs: [
          { title: "Overview", route: "/account/web/studio/dashboard/overview", contentPath: "/account/dashboard" },
          { title: "Visits", route: "/account/web/studio/dashboard/visits", contentPath: "/account/main-shop/visits" },
          { title: "Traffic", route: "/account/web/studio/dashboard/traffic", contentPath: "/account/main-shop/traffic" },
          { title: "Performance", route: "/account/web/studio/dashboard/performance", contentPath: "/account/main-shop/performance" },
          { title: "Product intelligence", route: "/account/web/studio/dashboard/product-intelligence", contentPath: "/account/main-shop/product-intelligence" }
        ]
      },
      {
        title: "Web shop",
        route: "/account/web/studio/store/products",
        icon: navIcon("products"),
        tabs: [
          { title: "Products", route: "/account/web/studio/store/products", contentPath: "/store/products" },
          { title: "Categories", route: "/account/web/studio/store/categories", contentPath: "/store/categories" },
          { title: "Inventory", route: "/account/web/studio/store/inventory", contentPath: "/store/inventory" },
          { title: "Orders", route: "/account/web/studio/store/orders", contentPath: "/account/web/studio/store/orders" },
          { title: "Bookings", route: "/account/web/studio/store/bookings", contentPath: "/account/web/studio/store/bookings" }
        ]
      },
      {
        title: "Customers",
        route: "/account/web/studio/crm/customers",
        icon: navIcon("customers"),
        tabs: [
          { title: "Customers", route: "/account/web/studio/crm/customers", contentPath: "/account/customers" },
          { title: "Points", route: "/account/web/studio/crm/points", contentPath: "/account/customers/loyalty" },
          { title: "Subscribers", route: "/account/web/studio/crm/subscribers", contentPath: "/account/customers/newsletter" },
          { title: "Notifications", route: "/account/web/studio/crm/notifications", contentPath: "/account/web/studio/crm/notifications" }
        ]
      },
      {
        title: "Websites",
        route: "/account/web/studio/websites/list",
        icon: navIcon("websites"),
        tabs: [
          { title: "Websites", route: "/account/web/studio/websites/list", contentPath: "/account/web/studio/websites/list" },
          { title: "Domains", route: domainsRoute, contentPath: domainsRoute },
          { title: "New web", route: "/account/web/studio/websites/webmaker", contentPath: "/account/web/studio/websites/webmaker" },
          { title: "Add", route: "/account/web/studio/websites/add", contentPath: "/account/web/studio/websites/add" },
          { title: "Website editor", route: "/account/web/studio/websites/editor", contentPath: "/account/web/studio/websites/editor" }
        ]
      },
      {
        title: "Payments",
        route: "/account/web/studio/payments",
        icon: navIcon("payments"),
        tabs: [{ title: "Payments", route: "/account/web/studio/payments", contentPath: "/account/payments" }]
      }
    ];
  },

  webStudioPage(path) {
    const sections = this.webStudioNavigation();
    const initialPath = path === "/account/web"
      ? "/account/web/studio/dashboard/overview"
      : path;
    const route = ({
      "/account/web/studio/store/orders-bookings": "/account/web/studio/store/orders",
      "/account/web/studio/crm/repeat-customers": "/account/web/studio/crm/customers",
      "/account/web/studio/crm/newsletter": "/account/web/studio/crm/subscribers"
    })[initialPath] || initialPath;
    for (const section of sections) {
      const tab = section.tabs.find(item => item.route === route && !item.disabled);
      if (tab) return { ...tab, section };
    }
    return { ...sections[0].tabs[0], section: sections[0] };
  },

  renderWebStudioWebsiteList() {
    const activeTenant = AppController.getActiveTenant();
    const activeStore = SQLiteEngine.getStore();
    const websites = AppController.tenantCatalogs()
      .filter(website => website && typeof website.tenant_id === "string")
      .map(website => ({
        id: website.tenant_id,
        name: website.name || website.store?.name || website.tenant_id,
        hostname: website.hostname || DOMAIN.shopHost(website.tenant_id),
        store: website.tenant_id === activeTenant.id ? activeStore : website.store || {},
        products: Array.isArray(website.products) ? website.products : [],
        categories: Array.isArray(website.categories) ? website.categories : []
      }));
    if (!websites.some(website => website.id === "main")) {
      websites.unshift({
        id: "main",
        name: "Craft",
        hostname: DOMAIN.apex,
        store: activeTenant.id === "main" ? activeStore : {},
        products: [],
        categories: []
      });
    }
    if (!websites.some(website => website.id === activeTenant.id)) {
      websites.push({
        id: activeTenant.id,
        name: activeTenant.name || activeStore.name || activeTenant.id,
        hostname: activeTenant.hostname || `${activeTenant.id}.${DOMAIN.root}`,
        store: activeStore,
        products: [],
        categories: []
      });
    }
    return `<section class="studio-workspace-section">
      <header class="website-management-heading">
        <div><h2>Your websites</h2><p>Choose a website to edit or manage.</p></div>
        <a class="btn-primary website-management-new" href="/account/web/studio/websites/webmaker" data-start-new-website>+ New web</a>
      </header>
      ${this.renderWebsiteManagementCards(websites)}
    </section>`;
  },
};

export const webStudioShells = {
  renderWebStudioWebsiteTool(page) {
    if (page.route === "/account/web/studio/websites/list") {
      return this.renderWebStudioWebsiteList();
    }
    if (page.route === "/account/web/studio/websites/webmaker") {
      return this.renderNewWebsiteProducts();
    }
    if (page.route === "/account/web/studio/websites/add") {
      const store = SQLiteEngine.getStore();
      const field = (name, label, type = "url", placeholder = "") => `<label class="form-field"><span class="form-label">${label}</span><input class="form-input" name="${name}" type="${type}" maxlength="500" value="${AppUtils.escapeHTML(store[name] || "")}" placeholder="${placeholder}" ${type === "url" ? 'inputmode="url"' : ""}></label>`;
      return `<section class="studio-workspace-section"><form id="website-additions-form" class="studio-panel">
        <span class="studio-workspace-kicker">CONTACT &amp; DISCOVERY</span><h2>Add to your website</h2>
        <p class="studio-panel-note">Saved links, enabled contact buttons, and the location map are injected into the footer across published themes.</p>
        <div class="studio-dashboard-grid">${field("phone", "Phone number", "tel", "+254…")}
        <label class="form-field"><span class="form-label">WhatsApp button</span><span><input type="checkbox" name="whatsapp_enabled" ${store.whatsapp_enabled ? "checked" : ""}> Enabled</span></label>
        ${field("whatsapp_url", "WhatsApp link", "url", "https://wa.me/254…")}
        <label class="form-field"><span class="form-label">Chatbot contact button</span><span><input type="checkbox" name="chatbot_enabled" ${store.chatbot_enabled ? "checked" : ""}> Enabled</span></label>
        ${field("chatbot_url", "Chatbot or chat-service URL", "url", "https://…")}
        ${field("instagram_url", "Instagram")}${field("facebook_url", "Facebook")}${field("tiktok_url", "TikTok")}${field("youtube_url", "YouTube")}${field("x_url", "X")}
        ${field("location_name", "Location name", "text", "Main shop")}${field("location_address", "Location address", "text", "Street, town, country")}
        ${field("location_map_embed_url", "Map embed URL (optional)", "url", "https://www.google.com/maps…")}${field("location_map_link", "Map directions link (optional)", "url", "https://maps.google.com…")}</div>
        <p class="studio-panel-note">If map URLs are blank, a map and directions link are created from the location address.</p>
        <p id="website-additions-status" role="status" aria-live="polite"></p>
        <div class="studio-inline-actions"><button class="btn-primary" type="submit">Save additions</button><button class="btn-secondary" type="button" data-additions-publish>Publish changes</button></div>
      </form><div id="product-modal-container"></div></section>`;
    }
    if (page.route === "/account/web/studio/websites/editor") {
      return `<section class="studio-workspace-section"><article class="studio-panel studio-feature-panel">
        <span class="studio-workspace-kicker">WEBSITE DESIGN</span><h2>Website editor</h2>
        <p>Design your storefront in Litrus Mixer: sections, products, colours and publishing.</p>
        <a class="btn-primary" href="/account/web/site?tenant=${encodeURIComponent(AppController.getActiveTenant().id)}" data-route="/account/web/site?tenant=${encodeURIComponent(AppController.getActiveTenant().id)}">Open Litrus Mixer</a>
      </article></section>`;
    }
    return `<p class="store-workspace-empty">This website screen is unavailable.</p>`;
  },

  renderWebStudioWorkspace(path) {
    const sections = this.webStudioNavigation();
    const page = this.webStudioPage(path);
    const showAnalyticsFilter = [
      "/account/web/studio/dashboard/visits",
      "/account/web/studio/dashboard/traffic"
    ].includes(path);
    const cachedSnapshot = this.getCachedMainShopSnapshot();
    const initialContent = page.section.title === "Websites"
      ? this.renderWebStudioWebsiteTool(page)
      : cachedSnapshot
      ? this.renderMainShopContent(path, cachedSnapshot)
      : this.renderWorkspaceLoading("Web Studio");
    AppUtils.updateSEO({ title: `${page.title} — Web Studio`, description: "Manage your website, visitors, customers, store, and payments." });
    return `
      <main class="container account-dashboard-main store-workspace-shell studio-workspace web-studio-shell" style="padding:16px 0 100px;">
        <header class="studio-workspace-heading">
          <a class="studio-workspace-back" href="/" data-route="/" data-home-screen aria-label="Back to Craft home"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 12H5m7 7-7-7 7-7"/></svg></a>
          <h1 class="studio-workspace-tab-title">${AppUtils.escapeHTML(page.title)}</h1>
          <div class="studio-workspace-header-actions">
            ${AppUtils.craftAccountSignedIn() ? "" : `<a href="/app-account" data-route="/app-account"
              class="btn-primary studio-signin-btn" title="Sign in to load orders, alerts and publishing">Sign in</a>`}
            ${showAnalyticsFilter ? `<button type="button" class="studio-analytics-filter-toggle" data-business-filter-toggle aria-label="Show filters" aria-controls="business-date-filters" aria-expanded="false"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 5h16l-6.5 7.5v5l-3 1.5v-6.5L4 5z"/></svg></button>` : ""}
            ${this.renderWorkspaceSidebar(`${page.section.title} screens`, page.section.tabs, page.route)}
          </div>
        </header>
        ${showAnalyticsFilter ? `<nav id="business-date-filters" class="bl-date-filter" aria-label="Analytics filters" hidden><label><span>Days</span><input class="business-filter" data-filter="analyticsDays" type="number" inputmode="numeric" min="1" max="365" value="${this.analyticsDays()}"></label></nav>` : ""}
        <section id="store-workspace-content" class="store-workspace-content studio-workspace-section" aria-live="polite" style="min-height:180px;padding-top:10px;">
          ${initialContent}
        </section>
        <nav class="studio-workspace-bottom-nav" aria-label="Web Studio sections">
          ${sections.map(section => `<a href="${section.route}" class="studio-workspace-bottom-link ${section.title === page.section.title ? "is-active" : ""}" data-route="${section.route}" ${section.title === page.section.title ? 'aria-current="page"' : ""}><span class="studio-nav-icon" aria-hidden="true">${section.icon}</span><span>${section.title}</span></a>`).join("")}
        </nav>
      </main>`;
  },
};
