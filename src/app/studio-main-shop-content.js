// renderMainShopContent: the Main Store content router.
// Moved verbatim out of src/app/main.js (the StudioRenderers object); main.js spreads these back in at the same spots.
import { AppController, AppUtils, SQLiteEngine } from './main.js';
import { renderCrmCustomers } from '../screens/craft/crm-customers.js';
import { renderCrmNotifications } from '../screens/craft/crm-notifications.js';
import { renderCrmPoints } from '../screens/craft/crm-points.js';
import { renderCrmSubscribers } from '../screens/craft/crm-subscribers.js';
import { renderDashboardOverview } from '../screens/craft/dashboard-overview.js';
import { renderDashboardPerformance } from '../screens/craft/dashboard-performance.js';
import { renderDashboardProductIntelligence } from '../screens/craft/dashboard-product-intelligence.js';
import { renderDashboardTraffic } from '../screens/craft/dashboard-traffic.js';
import { renderDashboardVisits } from '../screens/craft/dashboard-visits.js';
import { renderPayments } from '../screens/craft/payments.js';
import { renderStoreBookings } from '../screens/craft/store-bookings.js';
import { renderStoreCategories } from '../screens/craft/store-categories.js';
import { renderStoreInventory } from '../screens/craft/store-inventory.js';
import { renderStoreOrders } from '../screens/craft/store-orders.js';
import { renderStoreProducts } from '../screens/craft/store-products.js';

export const mainShopContentRenderer = {
  renderMainShopContent(path, snapshot, skipBusinessLens = false) {
    const { products, categories, sales, posCategories } = snapshot;
    const activeTenant = AppController.getActiveTenant();
    if (path === "/store/split-shop") return this.renderSplitShop(snapshot, activeTenant);
    const currencies = [...new Set(sales.map(sale => sale.currency))];
    const revenueByCurrency = new Map();
    const channelByCurrency = new Map();
    sales.forEach(sale => {
      const revenue = revenueByCurrency.get(sale.currency) || 0;
      revenueByCurrency.set(sale.currency, revenue + sale.collected);
      const channel = channelByCurrency.get(sale.channel) || new Map();
      channel.set(sale.currency, (channel.get(sale.currency) || 0) + sale.collected);
      channelByCurrency.set(sale.channel, channel);
    });
    const revenueText = (amounts) => [...amounts.entries()]
      .map(([currency, amount]) => this.formatMainShopMoney(amount, currency)).join(" + ") || this.formatMainShopMoney(0, "KES");
    const stockUnits = products.reduce((sum, product) => sum + Math.max(0, Number(product.stock) || 0), 0);
    const existingProductOptions = products.map((product, index) =>
      `<option value="${index}">${AppUtils.escapeHTML(product.name)} · ${AppUtils.escapeHTML(product.categoryName)} · ${[...product.sources].map(source => source === "Website" ? "Web" : source).join("/")}</option>`
    ).join("");
    const webProducts = SQLiteEngine.select("products", product => product.status !== "archived");
    const webVisits = [
      ...SQLiteEngine.select("web_visits", visit => visit.tenant_id === activeTenant.id && AppController.isStorefrontVisitPath(visit.path),
        (a, b) => String(b.created_at).localeCompare(String(a.created_at))),
      ...(snapshot.remoteVisits || []).filter(visit => AppController.isStorefrontVisitPath(visit.path))
    ];
    const visitAnalyticsPage = ["/account/main-shop/visits", "/account/main-shop/traffic"].includes(path);
    const analyticsCutoff = Date.now() - this.analyticsDays() * 86400000;
    const analyticsVisits = visitAnalyticsPage
      ? webVisits.filter(visit => {
        const time = new Date(visit.created_at).getTime();
        return Number.isFinite(time) && time >= analyticsCutoff;
      })
      : webVisits;
    const cloudflareRecentVisits = snapshot.remoteAnalytics?.recent_visits || [];
    const storefrontVisitCount = snapshot.remoteAnalytics ? Number(snapshot.remoteAnalytics.visits) || 0 : analyticsVisits.length;
    const storefrontUniqueCount = snapshot.remoteAnalytics
      ? Number(snapshot.remoteAnalytics.unique_visitors) || 0
      : new Set(analyticsVisits.map(visit => visit.visitor_id)).size;
    const recentVisitRows = snapshot.remoteAnalytics
      ? cloudflareRecentVisits.slice(0, 5).map(visit => `<article class="studio-list-row"><div><strong>${AppUtils.escapeHTML(visit.path || "/")}</strong><span>${AppUtils.escapeHTML(visit.device || "Unknown device")}</span></div><span>${AppUtils.escapeHTML(visit.created_at || "")}</span></article>`).join("")
      : webVisits.slice(0, 5).map(visit => `<article class="studio-list-row"><div><strong>${AppUtils.escapeHTML(visit.path || "/")}</strong><span>${AppUtils.escapeHTML(visit.device || "Unknown device")}</span></div><span>${AppUtils.escapeHTML(visit.created_at || "")}</span></article>`).join("");
    const webEvents = [
      ...SQLiteEngine.select("web_events", event => event.tenant_id === activeTenant.id, (a, b) => String(a.created_at).localeCompare(String(b.created_at))),
      ...(snapshot.remoteEvents || [])
    ];
    const webSales = sales.filter(sale => sale.channel === "Website");
    const customers = this.getWorkspaceCustomers(sales);
    const bookings = SQLiteEngine.select("booking_holds", item => item.tenant_id === activeTenant.id, (a, b) => String(b.created_at).localeCompare(String(a.created_at)));
    const newsletterByEmail = new Map();
    [
      ...SQLiteEngine.select("newsletter_subscribers", item => item.tenant_id === activeTenant.id, (a, b) => String(b.created_at).localeCompare(String(a.created_at))),
      ...(snapshot.remoteNewsletter || [])
    ].forEach(item => newsletterByEmail.set(String(item.email || "").toLowerCase(), item));
    const newsletterSubscribers = [...newsletterByEmail.values()];
    const currency = snapshot.currency || "KES";
    const today = new Date();
    const dayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
    const weekStart = dayStart - 6 * 86400000;
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).getTime();
    const datedSales = webSales.map(sale => ({ ...sale, time: new Date(sale.date).getTime() })).filter(sale => Number.isFinite(sale.time));
    // Revenue = paid, non-reversed sales (src/revenue-definition.js, shared with Business Lens and the AI helper).
    const paidSales = datedSales.filter(sale => window.EshopRevenue.isPaidSale(sale));
    const salesIn = (from) => datedSales.filter(sale => sale.time >= from);
    const revenueIn = (from) => window.EshopRevenue.sumRevenue(salesIn(from));
    const visitsIn = (from) => webVisits.filter(visit => new Date(visit.created_at).getTime() >= from);
    const uniqueIn = (from) => new Set(visitsIn(from).map(visit => visit.visitor_id)).size;
    const metric = (label, value, note = "", route = "") => route
      ? `<a class="studio-data-card studio-data-card-link" href="${route}" data-route="${route}"><span>${label}</span><strong>${value}</strong>${note ? `<small>${note}</small>` : ""}</a>`
      : `<article class="studio-data-card"><span>${label}</span><strong>${value}</strong>${note ? `<small>${note}</small>` : ""}</article>`;
    const orderRows = orders => orders.map(order => {
      const amount = Number(order.total) || 0;
      const status = String(order.status || "awaiting payment").replaceAll("_", " ");
      return `<article class="studio-list-row studio-order-card"><div><strong>${AppUtils.escapeHTML(order.order_number || `WEB-${order.id}`)}</strong><span>${AppUtils.escapeHTML(order.customer_name || "Web customer")} · ${AppUtils.escapeHTML(AppUtils.formatDateTime(order.created_at))}</span></div><div class="studio-row-end"><strong>${this.formatMainShopMoney(amount, order.currency || currency)}</strong><span>${AppUtils.escapeHTML(status)}</span></div></article>`;
    }).join("") || ((snapshot.remoteOrders || []).length
      ? ""
      : `<p class="store-workspace-empty">No web orders recorded yet.</p>`);
    const remoteOrderRows = (snapshot.remoteOrders || []).map(order => this.renderRemoteOrderRow(order, currency)).join("") || `<p class="store-workspace-empty">No server-backed orders loaded.</p>`;
    const businessOrderRows = [...sales].sort((a, b) => String(b.date).localeCompare(String(a.date))).map(sale =>
      `<article class="studio-list-row studio-order-card"><div><strong>${AppUtils.escapeHTML(sale.reference)}</strong><span>${AppUtils.escapeHTML(sale.customerName || "Customer not recorded")} · ${AppUtils.escapeHTML(AppUtils.formatDateTime(sale.date))}</span><small>${AppUtils.escapeHTML(sale.channel)} · ${sale.itemCount} item${sale.itemCount === 1 ? "" : "s"}</small></div><div class="studio-row-end"><strong>${this.formatMainShopMoney(sale.total, sale.currency || currency)}</strong><span>${AppUtils.escapeHTML(sale.status)}</span></div></article>`
    ).join("") || `<p class="store-workspace-empty">No business orders or POS receipts recorded yet.</p>`;
    const paymentActivityRows = [...sales].sort((a, b) => String(b.date).localeCompare(String(a.date))).map(sale =>
      `<article class="studio-list-row"><div><strong>${AppUtils.escapeHTML(sale.reference)}</strong><span>${AppUtils.escapeHTML(sale.channel)} · ${AppUtils.escapeHTML(sale.paymentMethod || "Method not recorded")} · ${AppUtils.escapeHTML(sale.date || "")}</span></div><div class="studio-row-end"><strong>${this.formatMainShopMoney(sale.collected, sale.currency || currency)}</strong><span>${AppUtils.escapeHTML(sale.status || "Awaiting payment")}</span></div></article>`
    ).join("");
      const remoteHolds = snapshot.remoteHolds || [];
      const remoteHoldRows = remoteHolds.map(hold => {
        const expired = hold.status === "approved" && new Date(hold.expires_at).getTime() <= Date.now();
        const status = expired ? "Expired" : String(hold.status || "pending");
        const actions = hold.status === "pending"
          ? `<button type="button" class="btn-secondary" data-product-hold-action="approve" data-hold-id="${AppUtils.escapeHTML(hold.id)}">Approve with configured duration</button><button type="button" class="btn-secondary" data-product-hold-action="reject" data-hold-id="${AppUtils.escapeHTML(hold.id)}">Reject</button>`
          : hold.status === "approved" && !expired
            ? `<button type="button" class="btn-secondary" data-product-hold-action="release" data-hold-id="${AppUtils.escapeHTML(hold.id)}">Release hold</button>`
            : "";
        return `<article class="studio-list-row"><div><strong>${AppUtils.escapeHTML(hold.product_name)} · ${Number(hold.quantity) || 0}</strong><span>${AppUtils.escapeHTML(hold.customer_name)} · ${AppUtils.escapeHTML(hold.contact)} · Requested ${AppUtils.escapeHTML(hold.created_at || "")}</span>${hold.expires_at ? `<small>Expires ${AppUtils.escapeHTML(hold.expires_at)}</small>` : ""}</div><div class="studio-row-end"><span>${AppUtils.escapeHTML(status)}</span>${actions}</div></article>`;
      }).join("") || `<p class="store-workspace-empty">${snapshot.remoteHolds ? "No storefront hold requests yet." : "Load customer requests from the live storefront."}</p>`;
      const remoteProductAnalytics = snapshot.remoteProductAnalytics;
      const productInterestById = new Map((remoteProductAnalytics?.product_interest || []).map(item => [String(item.product_id), item]));
      const productEventsById = new Map((remoteProductAnalytics?.product_activity || [])
        .map(item => [String(item.product_id), item]));
      const productViewsById = new Map((remoteProductAnalytics?.product_views || [])
        .filter(item => item.product_id != null)
        .map(item => [String(item.product_id), Number(item.views) || 0]));
      const productViewsBySlug = new Map((remoteProductAnalytics?.product_views || []).map(item => [
        String(item.path || "").split("/").filter(Boolean).pop() || "",
        Number(item.views) || 0
      ]));
      const productActivityItems = remoteProductAnalytics
        ? SQLiteEngine.select("products", product => product.status !== "archived").map(product => {
          const interest = productInterestById.get(String(product.id)) || {};
          const events = productEventsById.get(String(product.id)) || {};
          return {
            name: product.name,
            views: Number(events.views) || productViewsById.get(String(product.id)) ||
              productViewsBySlug.get(String(product.slug || "")) ||
              productViewsBySlug.get(String(product.id)) || 0,
            cartAdds: Number(events.cart_adds) || Number(interest.cart_quantity) || 0,
            wishlistAdds: Number(events.wishlist_adds) || Number(interest.wishlist_count) || 0,
            bookings: Number(events.bookings) || 0
          };
        })
        : [];
      const rankedProductRows = (metricName, unitLabel, emptyLabel) => productActivityItems
        .filter(item => item[metricName] > 0)
        .sort((a, b) => b[metricName] - a[metricName] || a.name.localeCompare(b.name))
        .slice(0, 10)
        .map(item => `<article class="studio-list-row"><strong>${AppUtils.escapeHTML(item.name)}</strong><span>${item[metricName]} ${unitLabel}</span></article>`)
        .join("") || `<p class="store-workspace-empty">${emptyLabel}</p>`;
      const mostViewedProductRows = rankedProductRows("views", "views", "No product views recorded yet.");
      const mostCartedProductRows = rankedProductRows("cartAdds", "cart additions", "No cart additions recorded yet.");
      const mostWishlistedProductRows = rankedProductRows("wishlistAdds", "wishlist saves", "No wishlist saves recorded yet.");
      const mostBookedProductRows = rankedProductRows("bookings", "bookings", "No bookings recorded yet.");
    const customerRows = customers.map(customer => `<article class="studio-list-row"><div><strong>${AppUtils.escapeHTML(customer.name)}</strong><span>${AppUtils.escapeHTML(customer.email || customer.phone || "No contact saved")} · ${customer.orders} order${customer.orders === 1 ? "" : "s"}</span></div><div class="studio-row-end"><strong>${customer.points} pts</strong><span>${this.formatMainShopMoney(customer.spent, currency)} collected</span></div></article>`).join("");
    if (path === "/account/web" || path.startsWith("/account/web/studio/")) {
      const page = this.webStudioPage(path);
      if (page.route === "/account/web/studio/store/orders") {
        return renderStoreOrders.call(this, { orderRows, remoteOrderRows, snapshot });
      }
      if (page.route === "/account/web/studio/store/bookings") {
        return renderStoreBookings.call(this, { bookings, remoteHoldRows, remoteHolds, snapshot });
      }
      if (page.section.title === "Websites") return this.renderWebStudioWebsiteTool(page);
      if (page.route === "/account/web/studio/crm/notifications") {
        return renderCrmNotifications.call(this, { snapshot });
      }
      let content = this.renderMainShopContent(page.contentPath, snapshot, true);
      const studioRoutes = new Map([
        ["/account/dashboard", "/account/web/studio/dashboard/overview"],
        ["/account/main-shop/visits", "/account/web/studio/dashboard/visits"],
        ["/account/main-shop/traffic", "/account/web/studio/dashboard/traffic"],
        ["/account/main-shop/performance", "/account/web/studio/dashboard/performance"],
        ["/account/main-shop/product-intelligence", "/account/web/studio/dashboard/product-intelligence"],
        ["/store/products", "/account/web/studio/store/products"],
        ["/store/categories", "/account/web/studio/store/categories"],
        ["/store/inventory", "/account/web/studio/store/inventory"],
        ["/store/orders", "/account/web/studio/store/orders"],
        ["/store/bookings", "/account/web/studio/store/bookings"],
        ["/account/customers", "/account/web/studio/crm/customers"],
        ["/account/customers/loyalty", "/account/web/studio/crm/points"],
        ["/account/customers/newsletter", "/account/web/studio/crm/subscribers"],
        ["/account/payments", "/account/web/studio/payments"]
      ]);
      for (const [legacyRoute, studioRoute] of studioRoutes) {
        content = content.replaceAll(`href="${legacyRoute}" data-route="${legacyRoute}"`, `href="${studioRoute}" data-route="${studioRoute}"`);
      }
      return content;
    }
    const businessPath = path.replace(/\/$/, "") || "/account/main-shop";
    if (!skipBusinessLens && /^\/store\/manage(?:\/|$)/.test(businessPath)) {
      return this.renderMainStoreManagement(businessPath, snapshot);
    }
    if (!skipBusinessLens && businessPath === "/store/products/manage") {
      return this.renderMainStoreProductManagement(snapshot);
    }
    if (!skipBusinessLens && window.BusinessLens && [
      "/account/main-shop", "/account/main-shop/marketing",
      "/account/main-shop/finance", "/account/main-shop/stores", "/account/main-shop/settings",
      "/account/main-shop/help", "/store/revenue", "/store/channels", "/store/sales",
      "/store/products", "/store/inventory", "/store/categories", "/account/customers",
    ].includes(businessPath)) {
      const dashboard = window.BusinessLens.render(snapshot, businessPath, {
        visits: webVisits,
        events: webEvents,
        newsletter: newsletterSubscribers,
        remoteBranches: snapshot.remoteBranches || [],
        customers,
        points: [
          ...SQLiteEngine.select("customer_points", entry => entry.tenant_id === activeTenant.id),
          ...(snapshot.remotePoints || [])
        ],
        settings: snapshot.settings,
        instances: snapshot.instances,
        activeTenant
      });
      const mainStoreShortcuts = businessPath === "/account/main-shop"
        ? `<nav class="main-store-shortcuts" aria-label="Main Store shortcuts">
            <a href="/store/products" data-route="/store/products">Products</a>
            <a href="/account/customers" data-route="/account/customers">Customers</a>
            <a href="/store/channels" data-route="/store/channels">Channels</a>
            <a href="/store/inventory" data-route="/store/inventory">Inventory</a>
            <a href="/account/main-shop/finance" data-route="/account/main-shop/finance">Finance</a>
            <a href="/store/revenue" data-route="/store/revenue">Revenue</a>
          </nav>`
        : "";
      return `${mainStoreShortcuts}${dashboard}`;
    }
    const visitPages = new Map();
    const visitDevices = new Map();
    analyticsVisits.forEach(visit => {
      visitPages.set(visit.path, (visitPages.get(visit.path) || 0) + 1);
      visitDevices.set(visit.device, (visitDevices.get(visit.device) || 0) + 1);
    });
    const pageRows = snapshot.remoteAnalytics
      ? (snapshot.remoteAnalytics.pages || []).map(page => `<article class="studio-list-row"><strong>${AppUtils.escapeHTML(page.path || "/")}</strong><strong>${Number(page.visits) || 0}</strong></article>`).join("")
      : [...visitPages.entries()].sort((a, b) => b[1] - a[1]).map(([pagePath, count]) => `<article class="studio-list-row"><strong>${AppUtils.escapeHTML(pagePath || "/")}</strong><strong>${count}</strong></article>`).join("");
    const deviceRows = snapshot.remoteAnalytics
      ? (snapshot.remoteAnalytics.devices || []).map(item => `<article class="studio-list-row"><strong>${AppUtils.escapeHTML(item.device || "Unknown")}</strong><strong>${Number(item.visits) || 0}</strong></article>`).join("")
      : [...visitDevices.entries()].map(([device, count]) => `<article class="studio-list-row"><strong>${AppUtils.escapeHTML(device || "Unknown")}</strong><strong>${count}</strong></article>`).join("");
    const locationCard = (title, items, label) => `<article class="studio-location-card"><h3>${title}</h3>${items.length
      ? items.map(item => `<div class="studio-location-row"><strong>${AppUtils.escapeHTML(label(item) || "Unknown")}</strong><span>${Number(item.visits) || 0}</span></div>`).join("")
      : `<p class="store-workspace-empty">No data</p>`}</article>`;
    const locationGrid = snapshot.remoteAnalytics
      ? `<div class="studio-location-grid">${locationCard("Countries", snapshot.remoteAnalytics.countries || [], item => item.country)}${locationCard("Regions", snapshot.remoteAnalytics.regions || [], item => [item.region, item.country].filter(Boolean).join(", "))}</div>`
      : "";
    const analyticsLoadCard = `<article class="studio-panel studio-analytics-load"><div class="studio-panel-heading"><h2>Analytics</h2><button type="button" class="btn-secondary" data-business-cloud-analytics>Load</button></div><p class="studio-panel-note" data-analytics-status role="status" ${snapshot.remoteAnalyticsError ? "" : "hidden"}>${snapshot.remoteAnalyticsError ? "Could not load analytics." : ""}</p></article>`;
    const openCheckouts = new Map();
    const productActivity = new Map();
    webEvents.forEach(event => {
      if (event.event === "checkout_started") openCheckouts.set(event.session_id, event);
      if (event.event === "order_created") {
        const checkout = openCheckouts.get(event.session_id);
        if (checkout && checkout.created_at <= event.created_at) openCheckouts.delete(event.session_id);
      }
      if (event.product_name && ["add_to_cart", "favorite_added", "favorite_removed"].includes(event.event)) {
        const activity = productActivity.get(event.product_name) || { basketAdds: 0, favorites: 0 };
        if (event.event === "add_to_cart") activity.basketAdds += Number(event.quantity) || 1;
        if (event.event === "favorite_added") activity.favorites += 1;
        if (event.event === "favorite_removed") activity.favorites = Math.max(0, activity.favorites - 1);
        productActivity.set(event.product_name, activity);
      }
    });
    const abandonedRows = [...openCheckouts.values()].sort((a, b) => String(b.created_at).localeCompare(String(a.created_at))).map(checkout => {
      const sessionItems = webEvents.filter(event => event.session_id === checkout.session_id && event.event === "add_to_cart" && event.created_at <= checkout.created_at)
        .slice(-5).map(event => event.product_name).filter(Boolean);
      return `<article class="studio-list-row"><div><strong>Checkout started</strong><span>${AppUtils.escapeHTML(checkout.created_at)} · ${AppUtils.escapeHTML(sessionItems.join(", ") || "Basket items unavailable")}</span></div><span>Not yet ordered</span></article>`;
    }).join("");
    const activityRows = [...productActivity.entries()].sort((a, b) => (b[1].basketAdds + b[1].favorites) - (a[1].basketAdds + a[1].favorites)).slice(0, 10)
      .map(([name, activity]) => `<article class="studio-list-row"><strong>${AppUtils.escapeHTML(name)}</strong><span>${activity.favorites} likes · ${activity.basketAdds} added to basket</span></article>`).join("");
    if (path === "/account" || path === "/account/main-shop" || path === "/account/main-shop/" || path === "/account/dashboard") {
      return renderDashboardOverview.call(this, { currency, metric, paidSales, recentVisitRows, snapshot, storefrontVisitCount, webSales });
    }
    if (path === "/account/main-shop/visits") {
      return renderDashboardVisits.call(this, { analyticsLoadCard, analyticsVisits, locationGrid, metric, recentVisitRows, snapshot, storefrontUniqueCount, storefrontVisitCount });
    }
    if (path === "/account/main-shop/traffic") {
      return renderDashboardTraffic.call(this, { analyticsLoadCard, analyticsVisits, deviceRows, locationGrid, metric, pageRows, snapshot, storefrontUniqueCount, storefrontVisitCount });
    }
    if (path === "/account/main-shop/performance" || path === "/store/revenue") {
      return renderDashboardPerformance.call(this, { abandonedRows, activityRows, currency, dayStart, metric, monthStart, orderRows, paidSales, revenueIn, salesIn, uniqueIn, weekStart });
    }
    if (path === "/account/main-shop/product-intelligence") {
      return renderDashboardProductIntelligence.call(this, { mostBookedProductRows, mostCartedProductRows, mostViewedProductRows, mostWishlistedProductRows, remoteProductAnalytics, snapshot });
    }
    if (path === "/account/customers" || path === "/account/customers/") {
      return renderCrmCustomers.call(this, { customerRows, customers, metric, newsletterSubscribers });
    }
    if (path === "/account/customers/loyalty") {
      return renderCrmPoints.call(this, { currency, customerRows, customers, metric });
    }
    if (path === "/account/customers/bookings" || path === "/store/bookings") {
      const maxHours = Number(this.getWorkspaceSetting("max_hold_hours", 24));
      return `<section class="studio-workspace-section">
        <p class="studio-panel-note">Hold requests are recorded for staff follow-up; they do not reserve stock or change POS inventory.</p>
        <form class="store-workspace-form" data-studio-form="booking-settings"><h2>Hold settings</h2><label>Maximum hold duration (hours)<input name="maxHoldHours" type="number" min="1" max="720" step="1" value="${maxHours}" required></label><button type="submit" class="btn-primary">Save hold settings</button><p role="status"></p></form>
        <form class="store-workspace-form" data-studio-form="booking-create"><h2>Create a product hold</h2><div class="studio-form-grid"><label>Product<select name="productId" required><option value="">Select a web product</option>${webProducts.map(product => `<option value="${product.id}">${AppUtils.escapeHTML(product.name)} · ${this.formatMainShopMoney(product.price, currency)}</option>`).join("")}</select></label><label>Quantity<input name="quantity" type="number" min="1" step="1" value="1" required></label><label>Customer name<input name="customerName" maxlength="120" required></label><label>Phone or email<input name="contact" maxlength="180" required></label><label>Hold duration in hours<input name="hours" type="number" min="1" max="${maxHours}" value="${maxHours}" required></label></div><button type="submit" class="btn-primary">Record hold</button><p role="status"></p></form>
        <article class="studio-panel"><div class="studio-panel-heading"><h2>Bookings &amp; holds</h2></div>${bookings.map(booking => {
          const expired = new Date(booking.expires_at).getTime() <= Date.now();
          return `<article class="studio-list-row"><div><strong>${AppUtils.escapeHTML(booking.product_name)} · ${booking.quantity}</strong><span>${AppUtils.escapeHTML(booking.customer_name)} · ${AppUtils.escapeHTML(booking.contact)} · Expires ${AppUtils.escapeHTML(booking.expires_at)}</span></div><div class="studio-row-end"><span>${expired ? "Expired" : AppUtils.escapeHTML(booking.status || "On hold")}</span>${!expired && booking.status !== "released" ? `<button type="button" class="btn-secondary" data-release-hold="${booking.id}">Release</button>` : ""}</div></article>`;
        }).join("") || `<p class="store-workspace-empty">No holds recorded yet.</p>`}</article></section>`;
    }
    if (["/account/customers/newsletter", "/account/web/studio/crm/newsletter"].includes(path)) {
      return renderCrmSubscribers.call(this, { metric, snapshot });
    }
    if (path === "/account/payments") {
      return renderPayments.call(this, { activeTenant });
    }
    if (path === "/store/orders" || path === "/store/sales" || path === "/store/payments") {
      const orders = SQLiteEngine.select("orders", null, (a, b) => String(b.created_at).localeCompare(String(a.created_at)));
      const view = path === "/store/sales" ? "sales" : path === "/store/payments" ? "payments" : "orders";
      return `<section class="studio-workspace-section">
        ${view === "orders" ? `${this.renderUnifiedOrderList(snapshot, sales, currency)}
          <article class="studio-panel"><div class="studio-panel-heading"><h2>Website orders and bookings</h2><button type="button" class="btn-secondary studio-load-button" data-business-online-orders-load aria-label="Load online orders">Load</button></div>
            <p class="studio-panel-note" data-online-orders-status>${snapshot.remoteOrdersError ? AppUtils.escapeHTML(snapshot.remoteOrdersError) : "Load the latest website orders and bookings into the list above. They are stored privately for this shop."}</p>
            ${this.renderOrderAttentionSummary(snapshot.remoteOrders)}</article>
          ${this.renderOwnerAlertsPanel(snapshot)}
          ${this.renderDiscountPanel(snapshot)}`
          : view === "sales" ? `<div class="studio-metric-grid">${metric("Order value", this.formatMainShopMoney(webSales.reduce((sum, sale) => sum + sale.total, 0), currency))}${metric("Paid orders", paidSales.length)}${metric("Unpaid orders", orders.filter(order => !["paid", "completed"].includes(String(order.status || "").toLowerCase())).length)}</div><article class="studio-panel"><div class="studio-panel-heading"><h2>Sales history</h2></div>${orderRows(orders)}</article>`
            : `<article class="studio-panel"><div class="studio-panel-heading"><h2>Payment activity · all channels</h2></div>${paymentActivityRows || `<p class="store-workspace-empty">No payment activity recorded yet.</p>`}</article>`}
        </section>`;
    }
    if (path === "/account/main-shop") {
      const metrics = [
        ["Products", products.length, "/store/products"],
        ["Categories", categories.length, "/store/categories"],
        ["Units in stock", stockUnits, "/store/inventory"],
        ["Collected revenue · all channels", revenueText(revenueByCurrency), "/store/revenue"]
      ];
      return `
        <div class="pos-metrics" aria-label="Whole business totals">
          ${metrics.map(([label, value, route]) => `<a class="metric-card" href="${route}" data-route="${route}" style="text-decoration:none;color:inherit;"><span class="metric-label">${label}</span><span class="metric-value">${value}</span></a>`).join("")}
        </div>
      `;
    }
    if (path === "/store/products") {
      return renderStoreProducts.call(this, { activeTenant, currency, snapshot, webProducts });
    }
    if (path === "/store/categories") {
      return renderStoreCategories.call(this, { currency, snapshot, webProducts });
    }
    if (path === "/store/inventory") {
      return renderStoreInventory.call(this, { webProducts });
    }
    if (path === "/store/revenue") {
      const revenueLines = sales.flatMap(sale => {
        const itemsTotal = sale.lineItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
        const collectedRatio = sale.total > 0 ? Math.min(1, sale.collected / sale.total) : 0;
        return sale.lineItems.map(item => ({
          name: item.name,
          currency: sale.currency,
          amount: item.quantity * item.unitPrice * (itemsTotal > 0 ? collectedRatio : 0)
        }));
      });
      return `
        <div class="store-revenue-screen">
          <div class="store-workspace-list">${revenueLines.map(product => `
            <article class="store-workspace-row">
              <div><strong>${AppUtils.escapeHTML(product.name)}</strong></div>
              <strong>${this.formatMainShopMoney(product.amount, product.currency)}</strong>
            </article>
          `).join("") || `<p class="store-workspace-empty">No product revenue recorded yet.</p>`}</div>
        </div>`;
    }
    if (path === "/store/sales") {
      const currenciesFor = channel => {
        const values = channelByCurrency.get(channel) || new Map();
        return revenueText(values);
      };
      return `
        <div class="store-revenue-screen">
        <div class="pos-metrics" aria-label="Collected revenue across the business">
          <div class="metric-card"><span class="metric-label">All channels collected</span><span class="metric-value">${revenueText(revenueByCurrency)}</span></div>
          <div class="metric-card"><span class="metric-label">Website collected</span><span class="metric-value">${currenciesFor("Website")}</span></div>
          <div class="metric-card"><span class="metric-label">POS collected</span><span class="metric-value">${currenciesFor("POS")}</span></div>
          <div class="metric-card"><span class="metric-label">Recorded sales</span><span class="metric-value">${sales.length}</span></div>
        </div>
        <h2 style="margin:28px 0 12px;">Website + POS sales</h2>
        <div class="store-workspace-list">${sales.map(sale => `
          <details class="store-sale-receipt">
            <summary class="store-workspace-row">
              <div><strong>${AppUtils.escapeHTML(sale.reference)}</strong><span>${AppUtils.escapeHTML(sale.channel)} · ${AppUtils.escapeHTML(AppUtils.formatDateTime(sale.date))} · ${AppUtils.escapeHTML(sale.status)}</span></div>
              <div><strong>${this.formatMainShopMoney(sale.collected, sale.currency)} collected</strong><span>${this.formatMainShopMoney(sale.total, sale.currency)} total · ${sale.itemCount} items</span></div>
            </summary>
            <div class="store-product-detail">
              <h3>Receipt · ${AppUtils.escapeHTML(sale.reference)}</h3>
              <p>${AppUtils.escapeHTML(AppUtils.formatDateTime(sale.date))} · ${AppUtils.escapeHTML(sale.channel)} · ${AppUtils.escapeHTML(sale.status)}</p>
              ${sale.lineItems.map(item => `<div class="store-workspace-row"><div><strong>${AppUtils.escapeHTML(item.name)}</strong><span>${item.quantity} × ${this.formatMainShopMoney(item.unitPrice, sale.currency)}</span></div><strong>${this.formatMainShopMoney(item.quantity * item.unitPrice, sale.currency)}</strong></div>`).join("") || `<p>No item details are available for this sale.</p>`}
              <div class="store-product-detail-grid"><div><strong>Sale total</strong> <span>${this.formatMainShopMoney(sale.total, sale.currency)}</span></div><div><strong>Collected</strong> <span>${this.formatMainShopMoney(sale.collected, sale.currency)}</span></div><div><strong>Balance</strong> <span>${this.formatMainShopMoney(Math.max(0, sale.total - sale.collected), sale.currency)}</span></div></div>
            </div>
          </details>
        `).join("") || `<p class="store-workspace-empty">No sales have been recorded in either channel yet.</p>`}</div></div>`;
    }
    return `<p class="store-workspace-empty">This business screen is unavailable.</p>`;
  },
};
