// Global event wiring (bindEvents).
// Moved verbatim out of src/app/main.js (the AppController object); main.js spreads these back in at the same spots.
import { AppUtils, SQLiteEngine, StoreRenderers, StudioRenderers, categories, demoAnalytics, plans, products, storeInfo } from './main.js';
import { DOMAIN } from './domain.js';

export const eventsController = {
  bindEvents() {
    // The Android back button is handled by src/back-button.js (installed from src/bootstrap.js).

    document.addEventListener("change", (e) => {
      const agreement = e.target.closest("#privacy-policy-agreement");
      if (agreement) {
        try {
          window.localStorage.setItem("ESHOP_PRIVACY_POLICY_AGREED_V1", agreement.checked ? "accepted" : "declined");
        } catch (error) {
          console.error("Privacy agreement choice could not be saved.", error);
          AppUtils.showToast(error.message || "Privacy agreement choice could not be saved.", "danger");
        }
        return;
      }
      const syncMode = e.target.closest('input[name="device-sync-mode"]');
      if (syncMode) {
        try {
          window.localStorage.setItem("ESHOP_DEVICE_SYNC_MODE_V1", syncMode.value);
          const customOptions = document.getElementById("device-sync-custom-options");
          if (customOptions) customOptions.hidden = syncMode.value !== "custom";
        } catch (error) {
          console.error("Device sync preference could not be saved.", error);
          AppUtils.showToast(error.message || "Device sync preference could not be saved.", "danger");
        }
        return;
      }
      const syncField = e.target.closest("[data-device-sync-field]");
      if (syncField) {
        try {
          window.localStorage.setItem(`ESHOP_DEVICE_SYNC_FIELD_V1:${syncField.dataset.deviceSyncField}`, String(syncField.checked));
        } catch (error) {
          console.error("Custom device sync preferences could not be saved.", error);
          AppUtils.showToast(error.message || "Custom device sync preferences could not be saved.", "danger");
        }
      }
    });

    document.addEventListener("click", async (e) => {
      // 1. Intercept internal data-route links
      const startNewWebsite = e.target.closest("[data-start-new-website]");
      if (startNewWebsite) {
        e.preventDefault();
        try {
          // An unfinished draft is offered back instead of being thrown away without a word.
          const unfinished = StudioRenderers.websiteBuilderDraft();
          const hasWork = Boolean(unfinished.shop_name || unfinished.categories?.length || unfinished.products?.length);
          if (hasWork && window.confirm(`You have an unfinished website${unfinished.shop_name ? ` (${unfinished.shop_name})` : ""}.\n\nOK continues it. Cancel starts a new one and discards it.`)) {
            this.navigate("/account/web/studio/websites/webmaker");
            return;
          }
          await StudioRenderers.resetWebsiteBuilderDraft();
          this.navigate("/account/web/studio/websites/webmaker");
        } catch (error) {
          console.error("The previous website draft could not be cleared.", error);
          AppUtils.showToast(error.message || "Could not start a clean website draft.", "danger");
        }
        return;
      }
      const link = e.target.closest("[data-route]");
      if (link && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        const route = link.getAttribute("data-route");
        this.navigate(route, link.hasAttribute("data-home-screen"));
        return;
      }

      const loadWebsiteStats = e.target.closest("[data-load-website-stats]");
      if (loadWebsiteStats) {
        const tenantId = loadWebsiteStats.dataset.loadWebsiteStats || "";
        const status = document.querySelector("[data-website-stats-status]");
        const content = document.querySelector("[data-website-stats-content]");
        const website = this.tenantCatalogs().find(item => item.tenant_id === tenantId);
        const credential = window.localStorage.getItem("ESHOP_ACCOUNT_SESSION_V1") ||
          website?.owner_token || "";
        loadWebsiteStats.disabled = true;
        if (status) status.textContent = "Loading usage…";
        if (content) content.replaceChildren();
        try {
          if (!credential) throw new Error("Sign in to the account that owns this website.");
          const result = await this.cloudflareRequest(
            `/api/tenants/${encodeURIComponent(tenantId)}/usage`,
            {},
            tenantId,
            false,
            credential
          );
          const r2 = result.r2 || {};
          const d1 = result.d1 || {};
          const formatBytes = value => {
            const bytes = Number(value) || 0;
            if (bytes < 1024) return `${bytes} B`;
            const units = ["KB", "MB", "GB", "TB"];
            let size = bytes / 1024;
            let unit = 0;
            while (size >= 1024 && unit < units.length - 1) {
              size /= 1024;
              unit++;
            }
            return `${size.toFixed(1)} ${units[unit]}`;
          };
          if (content) content.innerHTML = `
            <div class="website-usage-grid">
              <div class="website-usage-card"><span>R2 objects</span><strong>${Number(r2.objects) || 0}</strong><small>${AppUtils.escapeHTML(formatBytes(r2.bytes))}${r2.complete === false ? " · partial scan" : ""}</small></div>
              <div class="website-usage-card"><span>D1 records</span><strong>${Number(d1.total_records) || 0}</strong><small>Tenant-scoped rows</small></div>
            </div>
            <div class="website-usage-tables" aria-label="Database records by table">
              ${(Array.isArray(d1.tables) ? d1.tables : []).map(table => `<div class="website-usage-table-row"><span>${AppUtils.escapeHTML(table.name)}</span><strong>${Number(table.count) || 0}</strong></div>`).join("") || "<p>No tenant-scoped D1 records yet.</p>"}
            </div>`;
          if (status) status.textContent = "Usage updated.";
        } catch (error) {
          console.error("Website usage could not be loaded.", error);
          if (status) status.textContent = error.message || "Website usage could not be loaded.";
          AppUtils.showToast(error.message || "Website usage could not be loaded.", "danger");
        } finally {
          loadWebsiteStats.disabled = false;
        }
        return;
      }

      const customDomainAction = e.target.closest("[data-custom-domain-action]");
      if (customDomainAction) {
        const tenantId = customDomainAction.dataset.tenantId || "";
        const action = customDomainAction.dataset.customDomainAction;
        const hostnameInput = document.getElementById("custom-domain-hostname");
        const status = document.getElementById("custom-domain-status");
        const sessionToken = window.localStorage.getItem("ESHOP_ACCOUNT_SESSION_V1") || "";
        if (!sessionToken) {
          if (status) status.textContent = "Sign in to the account that owns this shop to manage its domain.";
          return;
        }
        if (action === "remove" && !confirm("Disconnect this custom subdomain from the shop?")) return;
        customDomainAction.disabled = true;
        try {
          let result;
          if (action === "connect") {
            const hostname = hostnameInput?.value.trim() || "";
            if (!hostname) throw new Error("Enter the subdomain you want to connect.");
            result = await this.cloudflareRequest(
              `/api/custom-hostnames?tenant_id=${encodeURIComponent(tenantId)}`,
              { method: "POST", body: JSON.stringify({ hostname }) },
              tenantId,
              false,
              sessionToken
            );
          } else if (action === "remove") {
            result = await this.cloudflareRequest(
              `/api/custom-hostnames?tenant_id=${encodeURIComponent(tenantId)}`,
              { method: "DELETE" },
              tenantId,
              false,
              sessionToken
            );
            if (hostnameInput) hostnameInput.value = "";
          } else {
            result = await this.cloudflareRequest(
              `/api/custom-hostnames?tenant_id=${encodeURIComponent(tenantId)}`,
              {},
              tenantId,
              false,
              sessionToken
            );
          }
          await StoreRenderers.loadCustomHostnameStatus(tenantId, result);
        } catch (error) {
          console.error("Custom domain action failed.", error);
          if (status) status.textContent = error.message || "Custom domain action failed.";
          AppUtils.showToast(error.message || "Custom domain action failed.", "danger");
          customDomainAction.disabled = false;
        }
        return;
      }

      const searchConsoleSave = e.target.closest("[data-search-console-save]");
      const searchConsoleRemove = e.target.closest("[data-search-console-remove]");
      const searchConsoleAction = searchConsoleSave || searchConsoleRemove;
      if (searchConsoleAction) {
        const tenantId = searchConsoleSave?.dataset.searchConsoleSave ||
          searchConsoleRemove?.dataset.searchConsoleRemove;
        const sessionToken = window.localStorage.getItem("ESHOP_ACCOUNT_SESSION_V1") || "";
        const status = document.getElementById("google-search-status");
        const verificationTag = document.getElementById("search-console-verification-tag");
        if (!sessionToken) {
          if (status) status.textContent = "Sign in to your Craft account to manage this shop’s verification tag.";
          return;
        }
        if (searchConsoleRemove && !confirm("Remove the Google Search Console verification tag from this shop?")) {
          return;
        }
        searchConsoleAction.disabled = true;
        try {
          if (searchConsoleSave) {
            const tag = verificationTag?.value.trim() || "";
            if (!tag) throw new Error("Paste the complete HTML verification tag from Google Search Console first.");
            await this.cloudflareRequest(
              `/api/search-console/verification?tenant_id=${encodeURIComponent(tenantId)}`,
              { method: "POST", body: JSON.stringify({ verification_tag: tag }) },
              tenantId,
              false,
              sessionToken
            );
            AppUtils.showToast("Google verification tag published. Return to Search Console and click Verify.");
          } else {
            await this.cloudflareRequest(
              `/api/search-console/verification?tenant_id=${encodeURIComponent(tenantId)}`,
              { method: "DELETE" },
              tenantId,
              false,
              sessionToken
            );
            if (verificationTag) verificationTag.value = "";
            AppUtils.showToast("Google verification tag removed from this shop.");
          }
          await StoreRenderers.loadGoogleSearchStatus(tenantId);
        } catch (error) {
          console.error("Search Console verification tag could not be updated.", error);
          if (status) status.textContent = error.message || "Search Console verification tag could not be updated.";
          AppUtils.showToast(error.message || "Google Search Console action failed.", "danger");
        } finally {
          searchConsoleAction.disabled = false;
        }
        return;
      }

      const deleteWebsite = e.target.closest("[data-delete-website]");
      if (deleteWebsite) {
        const tenantId = deleteWebsite.dataset.deleteWebsite;
        if (tenantId === "main") {
          AppUtils.showToast("The main Craft website cannot be deleted.", "danger");
          return;
        }
        const website = this.tenantCatalogs().find(item => item.tenant_id === tenantId);
        const websiteName = website?.name || website?.store?.name || tenantId;
        const hostname = website?.hostname || `${tenantId}.${DOMAIN.root}`;
        if (!confirm(`Permanently delete "${websiteName}" (${hostname}) and its live catalog? This cannot be undone.`)) return;
        deleteWebsite.disabled = true;
        deleteWebsite.textContent = "Deleting…";
        try {
          if (this.getActiveTenant().id === tenantId) {
            await this.loadTenantCatalog({ id: "main", name: "Craft", hostname: DOMAIN.apex });
          }
          await this.cloudflareRequest(`/api/tenants/${encodeURIComponent(tenantId)}`, {
            method: "DELETE"
          }, tenantId);
          const catalogs = this.tenantCatalogs();
          const index = catalogs.findIndex(item => item.tenant_id === tenantId);
          if (index >= 0) catalogs.splice(index, 1);
          SQLiteEngine.save();
          AppUtils.showToast(`Website "${websiteName}" deleted.`);
          this.navigate("/account/profile/webs");
        } catch (error) {
          console.error(`Website "${websiteName}" could not be deleted.`, error);
          AppUtils.showToast(error.message || "Website could not be deleted.", "danger");
          deleteWebsite.disabled = false;
          deleteWebsite.textContent = "Delete web";
        }
        return;
      }

      const manageWebsite = e.target.closest("[data-manage-website]");
      if (manageWebsite && this.isWebsiteBuilderDraftTenant(manageWebsite.dataset.manageWebsite)) {
        // A draft is not a shop yet: managing it means finishing its products in the wizard, not opening the main store.
        this.navigate("/account/web/studio/websites/webmaker");
        return;
      }
      if (manageWebsite) {
        const website = this.tenantCatalogs().find(item => item.tenant_id === manageWebsite.dataset.manageWebsite);
        if (!website) {
          AppUtils.showToast("This website is not saved on this device.", "danger");
          return;
        }
        try {
          this.setActiveTenantCatalog({
            id: website.tenant_id,
            name: website.name || website.store?.name || website.tenant_id,
            hostname: website.hostname || DOMAIN.shopHost(website.tenant_id),
            owner_token: website.owner_token || ""
          }, website);
          AppUtils.showToast(`Now managing ${website.name || website.store?.name || website.tenant_id}. Products, Inventory, and Categories now use this website.`);
          this.navigate("/account/web/studio/store/products");
        } catch (error) {
          console.error("Could not switch to the selected website catalog.", error);
          AppUtils.showToast(error.message || "Could not select this website.", "danger");
        }
        return;
      }

      const editWebsite = e.target.closest("[data-edit-website]");
      if (editWebsite && this.isWebsiteBuilderDraftTenant(editWebsite.dataset.editWebsite)) {
        // Editing a draft opens the new-website editor. If the draft has no product or category yet, the editor sends the owner back to the wizard.
        const draftTheme = StudioRenderers.websiteBuilderDraft().selected_theme || "litrus-mixer";
        this.navigate(`/account/web/site?new=1&edit=1&theme=${encodeURIComponent(draftTheme)}`);
        return;
      }
      if (editWebsite) {
        const website = this.tenantCatalogs().find(item => item.tenant_id === editWebsite.dataset.editWebsite);
        if (!website) {
          AppUtils.showToast("This website is no longer saved on this device.", "danger");
          return;
        }
        try {
          this.setActiveTenantCatalog({
            id: website.tenant_id,
            name: website.name || website.tenant_id,
            hostname: website.hostname || `${website.tenant_id}.${DOMAIN.root}`,
            owner_token: website.owner_token || ""
          }, website);
          this.navigate(`/account/web/site?tenant=${encodeURIComponent(website.tenant_id)}`);
        } catch (error) {
          AppUtils.showToast(error.message || "Could not open this website.", "danger");
        }
        return;
      }

      const editStore = e.target.closest("[data-edit-store]");
      if (editStore) {
        const website = this.tenantCatalogs().find(item => item.tenant_id === editStore.dataset.editStore);
        if (!website) {
          AppUtils.showToast("This website is no longer saved on this device.", "danger");
          return;
        }
        try {
          this.setActiveTenantCatalog({
            id: website.tenant_id,
            name: website.name || website.tenant_id,
            hostname: website.hostname || `${website.tenant_id}.${DOMAIN.root}`,
            owner_token: website.owner_token || ""
          }, website);
          this.navigate("/account/web/store");
        } catch (error) {
          AppUtils.showToast(error.message || "Could not open this store.", "danger");
        }
        return;
      }

      if (e.target.closest("#btn-add-website-category")) {
        this.openCategoryModal(null);
        return;
      }
      if (e.target.closest("#btn-add-website-product")) {
        if (!SQLiteEngine.getCategories().length) {
          AppUtils.showToast("Add a category before adding products.", "danger");
          this.navigate("/account/categories");
          return;
        }
        this.openProductModal(null);
        return;
      }

      // 2. Mobile Menu Toggle
      if (e.target.closest("#mobile-menu-toggle")) {
        const drawer = document.getElementById("mobile-nav-drawer");
        if (drawer) drawer.classList.add("active");
        return;
      }
      if (e.target.closest("#mobile-drawer-close") || e.target.id === "mobile-nav-drawer") {
        const drawer = document.getElementById("mobile-nav-drawer");
        if (drawer) drawer.classList.remove("active");
        return;
      }

      if (e.target.closest("#btn-add-category")) {
        this.openCategoryModal(null);
        return;
      }

      const addDepartmentProductBtn = e.target.closest("[data-action='studio-add-department-product']");
      if (addDepartmentProductBtn) {
        this.openProductModal(null, Number(addDepartmentProductBtn.getAttribute("data-category-id")));
        return;
      }

      const editCategoryBtn = e.target.closest("[data-action='edit-category']");
      if (editCategoryBtn) {
        const id = Number(editCategoryBtn.getAttribute("data-id"));
        const category = SQLiteEngine.getCategories().find(item => item.id === id);
        if (category) this.openCategoryModal(category);
        return;
      }

      const deleteCategoryBtn = e.target.closest("[data-action='delete-category']");
      if (deleteCategoryBtn) {
        const id = Number(deleteCategoryBtn.getAttribute("data-id"));
        const category = SQLiteEngine.getCategories().find(item => item.id === id);
        if (!category) return;
        const productCount = SQLiteEngine.select("products", product => product.category_id === id).length;
        const affectedProducts = productCount
          ? ` ${productCount} assigned product${productCount === 1 ? " will" : "s will"} become unassigned.`
          : "";
        if (confirm(`Delete "${category.name}"?${affectedProducts}`)) {
          SQLiteEngine.deleteCategory(id);
          AppUtils.showToast("Category deleted");
          this.handleRoute("/account/categories", false);
        }
        return;
      }

      // 3. Quick Add to Bag on product cards
      const quickAddBtn = e.target.closest("[data-action='quick-add']");
      if (quickAddBtn) {
        e.stopPropagation();
        const prodId = Number(quickAddBtn.getAttribute("data-id"));
        SQLiteEngine.addToCart(prodId, 1);
        AppUtils.showToast("Artifact added to your shopping bag");
        this.updateNavBadges();
        return;
      }

      // 4. Toggle Favorites Heart
      const favBtn = e.target.closest("[data-action='toggle-fav']");
      if (favBtn) {
        e.stopPropagation();
        const prodId = Number(favBtn.getAttribute("data-id"));
        const added = SQLiteEngine.toggleFavorite(prodId);
        favBtn.classList.toggle("active", added);
        const svg = favBtn.querySelector("svg");
        if (svg) svg.setAttribute("fill", added ? "#E11D48" : "none");
        AppUtils.showToast(added ? "Saved to your favorites" : "Removed from favorites");
        return;
      }

      // 5. Bag quantity adjusters
      const cartQtyBtn = e.target.closest("[data-action='cart-qty']");
      if (cartQtyBtn) {
        const cartId = Number(cartQtyBtn.getAttribute("data-id"));
        const delta = Number(cartQtyBtn.getAttribute("data-delta"));
        SQLiteEngine.updateCartQty(cartId, delta);
        this.handleRoute("/bag", false);
        return;
      }

      // 6. Bag remove item
      const cartRemoveBtn = e.target.closest("[data-action='cart-remove']");
      if (cartRemoveBtn) {
        const cartId = Number(cartRemoveBtn.getAttribute("data-id"));
        SQLiteEngine.removeCartItem(cartId);
        this.handleRoute("/bag", false);
        return;
      }

      // 8. Admin Products: Edit
      const editProdBtn = e.target.closest("[data-action='admin-edit-prod']");
      if (editProdBtn) {
        const id = Number(editProdBtn.getAttribute("data-id"));
        const prod = SQLiteEngine.getProductById(id);
        if (prod) this.openProductModal(prod);
        return;
      }

      // 9. Admin Products: Duplicate
      const dupProdBtn = e.target.closest("[data-action='admin-dup-prod']");
      if (dupProdBtn) {
        const id = Number(dupProdBtn.getAttribute("data-id"));
        SQLiteEngine.duplicateProduct(id);
        AppUtils.showToast("Artifact duplicated");
        this.handleRoute("/account/products", false);
        return;
      }

      // 10. Admin Products: Delete
      const delProdBtn = e.target.closest("[data-action='admin-del-prod']");
      if (delProdBtn) {
        e.preventDefault();
        e.stopPropagation();
        if (confirm("Are you sure you wish to delete this artifact from the SQLite catalog?")) {
          const id = Number(delProdBtn.getAttribute("data-id"));
          SQLiteEngine.deleteProduct(id);
          AppUtils.showToast("Artifact deleted from catalog");
          this.handleRoute("/account/products", false);
        }
        return;
      }

      const saveInventoryBtn = e.target.closest("[data-action='save-inventory-item']");
      if (saveInventoryBtn) {
        const row = saveInventoryBtn.closest(".inventory-item");
        const productId = Number(saveInventoryBtn.getAttribute("data-id"));
        const product = SQLiteEngine.getProductById(productId);
        if (!row || !product) {
          AppUtils.showToast("Could not find this inventory item", "danger");
          return;
        }

        const priceInput = row.querySelector("[data-inv-price]");
        const costInput = row.querySelector("[data-inv-cost]");
        const stockInput = row.querySelector("[data-inv-stock]");
        const inputs = [priceInput, costInput, stockInput];
        const invalidInput = inputs.find(input => !input || !input.reportValidity());
        if (invalidInput) return;

        const price = Number(priceInput.value);
        const costPrice = Number(costInput.value);
        const stock = Number(stockInput.value);
        if (!Number.isFinite(price) || price <= 0 || !Number.isFinite(costPrice) || costPrice < 0 || !Number.isInteger(stock) || stock < 0) {
          AppUtils.showToast("Enter valid prices and a whole-number stock quantity", "danger");
          return;
        }

        SQLiteEngine.saveProduct({ ...product, price, cost_price: costPrice, stock });
        await window.EshopInventoryBridge?.setLocalStock(this.getActiveTenant().id, product.sku, stock);
        AppUtils.showToast("Inventory details updated");
        this.handleRoute("/account/inventory", false);
        return;
      }

      // 11. Quick Restock Units
      const restockBtn = e.target.closest("[data-action='restock-qty']");
      if (restockBtn) {
        const id = Number(restockBtn.getAttribute("data-id"));
        const add = Number(restockBtn.getAttribute("data-add"));
        const prod = SQLiteEngine.getProductById(id);
        if (prod) {
          const newStock = prod.stock + add;
          SQLiteEngine.updateInventoryStock(id, newStock);
          await window.EshopInventoryBridge?.setLocalStock(this.getActiveTenant().id, prod.sku, newStock);
          AppUtils.showToast(`Restocked +${add} units in SQLite database`);
          this.handleRoute("/account/inventory", false);
        }
        return;
      }

      // 12. Dashboard period selector
      const dashPeriodBtn = e.target.closest("[data-action='dash-period']");
      if (dashPeriodBtn) {
        const period = dashPeriodBtn.getAttribute("data-period");
        this.navigate(`/account/dashboard?period=${period}`);
        return;
      }

      // 13. Upgrade Plan selection
      const planBtn = e.target.closest("[data-action='upgrade-plan']");
      if (planBtn) {
        const slug = planBtn.getAttribute("data-slug");
        SQLiteEngine.selectPlan(slug);
        AppUtils.showToast(`Selected ${slug.toUpperCase()} tier! Upgrade processed.`);
        this.handleRoute("/account/plans", false);
        return;
      }

      // 14. Reset Database
      if (e.target.id === "btn-reset-database") {
        if (confirm("Reset the embedded SQLite database to the default seed state?")) {
          SQLiteEngine.reset(categories, products, storeInfo, plans, demoAnalytics);
          AppUtils.showToast("Database restored to initial seed state");
          this.handleRoute("/account", false);
        }
        return;
      }
    });

    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState !== "visible") return;
      const searchConsoleButton = document.querySelector("[data-search-console-save], [data-search-console-remove]");
      const tenantId = searchConsoleButton?.dataset.searchConsoleSave ||
        searchConsoleButton?.dataset.searchConsoleRemove;
      if (tenantId) StoreRenderers.loadGoogleSearchStatus(tenantId);
    });

    // Mobile Search Input
    document.addEventListener("keydown", (e) => {
      if (e.target && e.target.id === "mobile-search-input" && e.key === "Enter") {
        const q = e.target.value.trim();
        const drawer = document.getElementById("mobile-nav-drawer");
        if (drawer) drawer.classList.remove("active");
        if (q) this.navigate(`/search?q=${encodeURIComponent(q)}`);
      }
    });
  }
};
