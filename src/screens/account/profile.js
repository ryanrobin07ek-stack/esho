// Profile screen (/account/profile and its sub-pages).
// Moved verbatim from the app script (index.html, then src/app/main.js).
import { AppController, AppUtils, SQLiteEngine, StoreRenderers, StudioRenderers } from '../../app/main.js';
import { DOMAIN } from '../../app/domain.js';

export const profileScreen = {
  renderProfileScreen(path = "/account/profile") {
    const sections = [
      { id: "home", label: "Home", route: "/" },
      { id: "profile", label: "Profile" },
      { id: "accounts", label: "Accounts" },
      { id: "webs", label: "Webs" },
      { id: "recommended-actions", label: "Recommended actions" },
      { id: "link-devices", label: "Link devices" },
      { id: "privacy", label: "Privacy" },
      { id: "updates", label: "Updates" }
    ];
    const requestedSection = path.slice("/account/profile".length).replace(/^\/+|\/+$/g, "");
    const [sectionId, ...sectionRouteParts] = requestedSection.split("/");
    const activeSection = sections.find(section => section.id === sectionId)?.id || "profile";
    let activeLabel = sections.find(section => section.id === activeSection)?.label || "Profile";
    let websiteDetailId = "";
    let websiteDetailSection = "settings";
    if (activeSection === "webs" && sectionRouteParts.length) {
      try {
        websiteDetailId = decodeURIComponent(sectionRouteParts[0]);
        websiteDetailSection = sectionRouteParts[1] || "settings";
      } catch (error) {
        console.warn("Website settings route contains an invalid encoded ID.", error);
      }
    }
    const store = SQLiteEngine.getStore();
    const activeTenant = AppController.getActiveTenant();
    const isDrawer = path === "/account/profile";
    const websites = AppController.tenantCatalogs()
      .filter(website => website && typeof website.tenant_id === "string")
      .map(website => {
        const id = website.tenant_id;
        return {
          id,
          name: website.name || website.store?.name || (id === "main" ? "Craft" : id),
          hostname: website.hostname || DOMAIN.shopHost(id),
          store: id === activeTenant.id ? store : website.store || {},
          products: Array.isArray(website.products) ? website.products : [],
          categories: Array.isArray(website.categories) ? website.categories : []
        };
      });
    if (!websites.some(website => website.id === "main")) {
      websites.unshift({
        id: "main",
        name: "Craft",
        hostname: DOMAIN.apex,
        store: activeTenant.id === "main" ? store : {},
        products: [],
        categories: []
      });
    }
    if (!websites.some(website => website.id === activeTenant.id)) {
      websites.push({
        id: activeTenant.id,
        name: activeTenant.name || store.name || activeTenant.id,
        hostname: activeTenant.hostname,
        store,
        products: [],
        categories: []
      });
    }
    const selectedWebsite = websites.find(website => website.id === websiteDetailId);
    if (selectedWebsite) activeLabel = websiteDetailSection === "domains"
      ? `${selectedWebsite.name} · Domains`
      : websiteDetailSection === "stats"
        ? `${selectedWebsite.name} · Stats`
        : selectedWebsite.name;
    const profileValue = value => AppUtils.escapeHTML(String(value || "").trim() || "Not added yet");
    const renderWebsiteCards = (deleteLabel, ariaLabel = "Your websites") =>
      StudioRenderers.renderWebsiteManagementCards(websites, deleteLabel, ariaLabel);
    const websiteCards = renderWebsiteCards("Delete web");
    // Recommended actions existed in every menu and rendered nothing at all. These are read from the
    // shop's own data, so a step only appears while it is genuinely outstanding.
    const recommendedActionsScreen = (() => {
      const allProducts = SQLiteEngine.select("products") || [];
      const liveProducts = allProducts.filter(product => product && product.status !== "archived");
      const posProducts = liveProducts.filter(product => product.sku);
      const withPhotos = liveProducts.filter(product => product.img || (product.images || []).length);
      const withCost = liveProducts.filter(product => Number(product.cost_price) > 0);
      const categories = SQLiteEngine.getCategories() || [];
      const published = websites.some(website => website.published);
      const actions = [];
      if (!liveProducts.length) {
        actions.push({ title: "Add your first product", note: "Nothing can be sold or published until the shop has something in it.", route: "/store/manage/products", label: "Add a product" });
      }
      if (liveProducts.length && !categories.length) {
        actions.push({ title: "Group your products into categories", note: "Customers browse by category, and your reports read better with them.", route: "/store/manage/categories", label: "Add a category" });
      }
      if (liveProducts.length && withPhotos.length < liveProducts.length) {
        actions.push({ title: `Add photos to ${liveProducts.length - withPhotos.length} product${liveProducts.length - withPhotos.length === 1 ? "" : "s"}`, note: "Products without a photo are the ones customers skip.", route: "/store/manage/products", label: "Open products" });
      }
      if (liveProducts.length && withCost.length < liveProducts.length) {
        actions.push({ title: `Set a buying price on ${liveProducts.length - withCost.length} product${liveProducts.length - withCost.length === 1 ? "" : "s"}`, note: "Without a buying price the profit figures are only a guess.", route: "/store/manage/products", label: "Open products" });
      }
      if (!published) {
        actions.push({ title: "Publish your website", note: "Your shop is not online until you publish it.", route: "/account/web/studio/websites/list", label: "Open websites" });
      }
      if (!String(store.phone || "").trim() && !String(store.email || "").trim()) {
        actions.push({ title: "Add a phone number or email", note: "Customers need a way to reach you, and receipts carry it.", route: "/account/profile/profile", label: "Edit shop details" });
      }
      actions.push({ title: "Connect payments", note: "Connect Paystack so customers can pay online. Counter sales work without it.", route: "/account/web/studio/payments", label: "Open payments" });
      if (!posProducts.length && liveProducts.length) {
        actions.push({ title: "Give your products a code", note: "A product code links the counter and the website so stock stays in step.", route: "/store/manage/products", label: "Open products" });
      }
      return `<div class="profile-cards">
        <article class="profile-card">
          <h2>What to do next</h2>
          <p>${actions.length} step${actions.length === 1 ? "" : "s"} worth doing for this shop.</p>
        </article>
        ${actions.map(action => `<article class="profile-card">
          <h2>${AppUtils.escapeHTML(action.title)}</h2>
          <p>${AppUtils.escapeHTML(action.note)}</p>
          <a class="btn-secondary" href="${action.route}" data-route="${action.route}">${AppUtils.escapeHTML(action.label)}</a>
        </article>`).join("")}
      </div>`;
    })();
    const websiteSettingsScreen = selectedWebsite ? `
      <article class="profile-page-card profile-website-settings">
        <h2>${AppUtils.escapeHTML(selectedWebsite.name)}</h2>
        ${selectedWebsite.id === activeTenant.id
          ? '<p class="profile-website-note">This is the website currently selected for Products, Inventory, Categories, and website editing.</p>'
          : '<p class="profile-website-note">Select this website to manage its own Products, Inventory, Categories, and website content.</p>'}
        <div class="profile-page-details">
          <p>Domain: <a href="https://${AppUtils.escapeHTML(selectedWebsite.hostname)}" target="_blank" rel="noopener">${AppUtils.escapeHTML(selectedWebsite.hostname)}</a></p>
          <p>Store details: ${profileValue(selectedWebsite.store.description)}</p>
          <p>Location: ${profileValue(selectedWebsite.store.location)}</p>
          <p>Email: ${profileValue(selectedWebsite.store.email)}</p>
          <p>Phone: ${profileValue(selectedWebsite.store.phone)}</p>
          <p>${selectedWebsite.products.length} products · ${selectedWebsite.categories.length} categories</p>
        </div>
        <div class="profile-website-actions">
          <button class="btn-primary" type="button" data-manage-website="${AppUtils.escapeHTML(selectedWebsite.id)}">Manage this web</button>
          <a class="btn-primary" href="https://${AppUtils.escapeHTML(selectedWebsite.hostname)}" target="_blank" rel="noopener">Browse web</a>
          <a class="btn-secondary" href="/account/profile/webs/${encodeURIComponent(selectedWebsite.id)}/domains" data-route="/account/profile/webs/${encodeURIComponent(selectedWebsite.id)}/domains">Manage domains</a>
          <button class="btn-secondary" type="button" data-edit-store="${AppUtils.escapeHTML(selectedWebsite.id)}">Edit store details</button>
          <button class="btn-secondary" type="button" data-edit-website="${AppUtils.escapeHTML(selectedWebsite.id)}">Edit website design</button>
          <button class="btn-secondary profile-website-delete" type="button" data-delete-website="${AppUtils.escapeHTML(selectedWebsite.id)}"${selectedWebsite.id === "main" ? ' disabled title="The main Craft domain cannot be deleted."' : ""}>Delete web</button>
        </div>
        ${selectedWebsite.id === "main" ? "" : `
          <section class="profile-page-card" aria-labelledby="google-search-heading" style="margin-top:18px;">
            <h3 id="google-search-heading">Google Search</h3>
            <p>Search Console setup is optional. Craft automatically publishes this shop’s sitemap. To ask Google to index it, add the shop yourself in Search Console, choose the HTML tag verification method, and paste the complete tag here. Craft publishes the tag; you then verify the site and submit its sitemap in your Google account. No Google login or Cloudflare access is needed.</p>
            <ol>
              <li><a href="https://search.google.com/search-console" target="_blank" rel="noopener">Open Google Search Console</a> and add <code>https://${AppUtils.escapeHTML(selectedWebsite.hostname)}/</code> as a URL-prefix property.</li>
              <li>Choose <strong>HTML tag</strong>, copy the complete <code>&lt;meta name="google-site-verification" ...&gt;</code> tag, and paste it below.</li>
              <li>Save the tag here, return to Search Console and choose <strong>Verify</strong>. Then submit <code>https://${AppUtils.escapeHTML(selectedWebsite.hostname)}/sitemap.xml</code>.</li>
            </ol>
            <label for="search-console-verification-tag">Google HTML verification tag</label>
            <input id="search-console-verification-tag" type="text" autocomplete="off" spellcheck="false" placeholder='<meta name="google-site-verification" content="...">' style="width:100%;margin:8px 0 12px;">
            <p id="google-search-status" role="status" aria-live="polite">Checking verification tag…</p>
            <div class="profile-website-actions">
              <button class="btn-primary" type="button" data-search-console-save="${AppUtils.escapeHTML(selectedWebsite.id)}">Publish verification tag</button>
              <button class="btn-secondary" type="button" data-search-console-remove="${AppUtils.escapeHTML(selectedWebsite.id)}">Remove verification tag</button>
            </div>
          </section>`}
        ${selectedWebsite.id === "main" ? '<p class="profile-website-note">The main Craft website is required and cannot be deleted.</p>' : ""}
      </article>` : `
      <article class="profile-page-card">
        <h2>Website not found</h2>
        <p>This website is not saved in this app. Return to Webs and choose one of your saved websites.</p>
      </article>`;
    const websiteDomainScreen = selectedWebsite ? `
      <article class="profile-page-card profile-website-domains">
        <a class="profile-page-back" href="/account/profile/webs/${encodeURIComponent(selectedWebsite.id)}" data-route="/account/profile/webs/${encodeURIComponent(selectedWebsite.id)}" aria-label="Back to website settings">&larr; Website settings</a>
        <h2 style="margin-top:14px;">Website domains</h2>
        <p>Your Craft address</p>
        <p class="profile-website-domain"><a href="https://${AppUtils.escapeHTML(selectedWebsite.hostname)}" target="_blank" rel="noopener">${AppUtils.escapeHTML(selectedWebsite.hostname)}</a></p>
        ${selectedWebsite.id === "main" ? `
          <p>The main Craft domain is fixed. To use a different address, create a separate shop and connect its own subdomain.</p>
        ` : `
          <h3 id="custom-domain-heading">Connect a custom subdomain</h3>
          <p>Connect a subdomain you control, such as <code>shop.example.com</code>. Root domains such as <code>example.com</code> are not supported yet. Your Craft address keeps working as a fallback.</p>
          <label for="custom-domain-hostname">Custom subdomain</label>
          <input id="custom-domain-hostname" type="text" autocomplete="url" spellcheck="false" placeholder="shop.example.com" style="width:100%;margin:8px 0 12px;">
          <p id="custom-domain-status" role="status" aria-live="polite">Checking custom domain…</p>
          <div class="profile-website-actions">
            <button class="btn-primary" type="button" data-custom-domain-action="connect" data-tenant-id="${AppUtils.escapeHTML(selectedWebsite.id)}">Connect subdomain</button>
            <button class="btn-secondary" type="button" data-custom-domain-action="check" data-tenant-id="${AppUtils.escapeHTML(selectedWebsite.id)}" disabled>Check status</button>
            <button class="btn-secondary" type="button" data-custom-domain-action="remove" data-tenant-id="${AppUtils.escapeHTML(selectedWebsite.id)}" disabled>Remove subdomain</button>
          </div>
          <p class="profile-website-note">To change an existing custom domain, remove it here first, then connect the replacement.</p>
        `}
      </article>` : `
      <article class="profile-page-card">
        <h2>Website not found</h2>
        <p>This website is not saved in this app. Return to Webs and choose one of your saved websites.</p>
      </article>`;
    const websiteStatsScreen = selectedWebsite ? `
      <article class="profile-page-card">
        <div class="studio-panel-heading">
          <div><h2>Website usage</h2><p class="studio-panel-note">Storage and tenant-scoped database records for ${AppUtils.escapeHTML(selectedWebsite.name)}.</p></div>
          <button class="btn-secondary" type="button" data-load-website-stats="${AppUtils.escapeHTML(selectedWebsite.id)}">Refresh</button>
        </div>
        <p data-website-stats-status role="status" aria-live="polite">Load usage statistics for this website.</p>
        <div data-website-stats-content></div>
        <p class="profile-website-note">D1 is shared between websites, so this reports rows scoped to this website, not a fictional per-website database size.</p>
      </article>` : `
      <article class="profile-page-card"><h2>Website not found</h2><p>This website is not saved in this app.</p></article>`;
    const accountsScreen = `
      ${renderWebsiteCards("Delete account", "Shop accounts")}
      <a class="btn-primary profile-add-account" href="/account/web/studio/websites/webmaker" data-start-new-website>Create a new website</a>`;
    const privacyAgreement = window.localStorage.getItem("ESHOP_PRIVACY_POLICY_AGREED_V1") !== "declined";
    const privacyPolicy = `
      <article class="profile-page-card profile-privacy-policy">
        <h2>Privacy Policy</h2>
        <p>This policy describes how the Craft Studio app handles information in the app and on websites you publish.</p>
        <h3>Information in the app</h3>
        <p>Shop details, products, inventory, website pages, settings, and order information are stored in the app’s local database on this device.</p>
        <h3>Published websites</h3>
        <p>When you publish a website, its public shop details, products, pages, and linked images are sent to the hosting service you configured and can be viewed by visitors at its domain.</p>
        <h3>Google Search Console</h3>
        <p>If you choose to verify a shop in Google Search Console, Craft stores the public HTML verification code for that shop and publishes it in the shop website’s page metadata. Craft does not connect to your Google account. You can remove the code from the website settings at any time.</p>
        <h3>Google sign-in</h3>
        <p>If you choose to sign in or create a Craft account with Google, Craft receives your Google account’s verified email address and a unique account identifier so you can sign in again. Craft does not request access to Gmail, Drive, or Search Console through account sign-in. You can unlink Google from your Craft account settings.</p>
        <h3>Access and security</h3>
        <p>Shop access keys are stored on this device and sent over HTTPS when you manage or publish a shop. Keep your device and keys private.</p>
        <h3>Your choices</h3>
        <p>You can manage or delete websites from the Webs screen. Removing a published website deletes its hosted catalog and makes its shop address unavailable. This policy covers the Studio app; external hosting or services may have their own terms.</p>
      </article>
      <label class="profile-page-card profile-privacy-agreement">
        <input id="privacy-policy-agreement" type="checkbox" ${privacyAgreement ? "checked" : ""}>
        <span>I agree to the Privacy Policy.</span>
      </label>`;
    const updatesScreen = `
      <article class="profile-page-card">
        <h2>Current version</h2>
        <p>1.0.0</p>
        <h2 style="margin-top:18px;">Recent versions</h2>
        <p>No recent version history is available.</p>
        <h2 style="margin-top:18px;">Current version details</h2>
        <p>Includes Studio website management, separate profile sections, and profile and website details.</p>
      </article>`;
    const linkedDevicesScreen = `
      <article class="profile-page-card">
        <h2>Cloud POS sync</h2>
        <p>Supplier contacts, purchase orders, parked tickets, and sales can sync between devices through your shop’s Cloudflare account. Each device must be signed in to the same shop and have cloud sync enabled in POS settings.</p>
        <a class="btn-primary" href="/pos/more/settings" data-route="/pos/more/settings">Open POS sync settings</a>
      </article>
      <article class="profile-page-card">
        <h2>Connect another device</h2>
        <p>Sign in to the same shop account on the other device, open POS sync settings, and enable cloud sync for that shop. Keep the shop owner key private; anyone with it can access the shop’s synced POS records.</p>
      </article>`;
    const profileCards = `
      <article class="profile-page-card">
        <div class="profile-page-identity">
          <span class="profile-page-avatar" role="img" aria-label="Profile picture placeholder">
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M5 21v-2a7 7 0 0 1 14 0v2z"/></svg>
          </span>
          <div><h2>Full name</h2><p>Your full name</p></div>
        </div>
      </article>
      <article class="profile-page-card"><h2>Store name</h2><p>${profileValue(store.name)}</p></article>
      <article class="profile-page-card">
        <h2>Store details</h2>
        <div class="profile-page-details">
          <p>${profileValue(store.description)}</p>
          <p>Location: ${profileValue(store.location)}</p>
          <p>Email: ${profileValue(store.email)}</p>
          <p>Phone: ${profileValue(store.phone)}</p>
        </div>
      </article>
      <article class="profile-page-card">
        <h2>Web domains</h2>
        <div class="profile-page-domains">
          ${websites.map(website => `<a href="https://${AppUtils.escapeHTML(website.hostname)}" target="_blank" rel="noopener">${AppUtils.escapeHTML(website.hostname)}</a>`).join("") || "<p>No domains added yet.</p>"}
        </div>
      </article>`;
    AppUtils.updateSEO({ title: "Profile — Craft Studio", description: "Profile screen." });
    if (isDrawer) {
      return `
        ${StoreRenderers.renderNavbar("/account/profile", "Profile")}
        <main id="main-content" class="profile-menu-overlay" aria-label="Profile menu">
          <a class="profile-menu-backdrop" href="/account" data-route="/account" aria-label="Close profile menu"></a>
          <nav class="profile-sidebar" aria-label="Profile sections">
            <div class="profile-sidebar-header">
              <span>Profile</span>
              <a class="profile-sidebar-close" href="/account" data-route="/account" aria-label="Close profile menu">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="m18 6-12 12M6 6l12 12"/></svg>
              </a>
            </div>
            ${sections.map(section => {
              const href = section.route || `/account/profile/${section.id}`;
              return `<a class="profile-sidebar-link" href="${href}" data-route="${href}">${section.label}</a>`;
            }).join("")}
            <a class="profile-sidebar-logout" href="/" data-route="/" data-home-screen aria-label="Log out">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 17l5-5-5-5M15 12H3"/><path d="M12 3h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-6"/></svg>
              <span>Log out</span>
            </a>
          </nav>
        </main>
      `;
    }
    return `
      ${StoreRenderers.renderNavbar("/account/profile", activeLabel)}
      <main id="main-content" class="container profile-page-container" aria-label="${AppUtils.escapeHTML(activeLabel)} screen">
        <header class="profile-page-header">
          <a class="profile-page-back" href="/account/profile" data-route="/account/profile" aria-label="Back to profile menu">&larr;</a>
          <h1 class="profile-page-title">${AppUtils.escapeHTML(activeLabel)}</h1>
        </header>
        <section class="profile-page-content" aria-label="${AppUtils.escapeHTML(activeLabel)} details">
          ${websiteDetailId ? websiteDetailSection === "domains" ? websiteDomainScreen : websiteDetailSection === "stats" ? websiteStatsScreen : websiteSettingsScreen : activeSection === "profile" ? profileCards : activeSection === "accounts" ? accountsScreen : activeSection === "webs" ? websiteCards : activeSection === "privacy" ? privacyPolicy : activeSection === "updates" ? updatesScreen : activeSection === "link-devices" ? linkedDevicesScreen : activeSection === "recommended-actions" ? recommendedActionsScreen : ""}
        </section>
      </main>
      ${StoreRenderers.renderFooter()}
    `;
  },
};

// Screen entry points. The router (handleRoute in src/app/main.js) still draws this screen
// itself, through StudioRenderers.renderProfileScreen(); mount()/unmount() draw and set up this one screen on their own.
export function mount(root, path = "/account/profile") {
  root.innerHTML = StudioRenderers.renderProfileScreen(path);
}

export function unmount() {}
