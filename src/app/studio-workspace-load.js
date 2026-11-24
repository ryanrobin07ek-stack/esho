// loadMainShopWorkspace: the Main Store / Craft workspace screen wiring.
// Moved verbatim out of src/app/main.js (the StudioRenderers object); main.js spreads these back in at the same spots.
import { AppController, AppUtils, LOCAL_PRODUCT_MEDIA_PREFIX, SQLiteEngine } from './main.js';

export const mainShopWorkspaceLoader = {
  async loadMainShopWorkspace(path) {
    const content = document.getElementById("store-workspace-content");
    if (!content) return;
    const activeTenant = AppController.getActiveTenant();
    try {
      if (!window.ShopPOS?.listProducts || !window.ShopPOS?.listSales) {
        throw new Error("POS inventory is not ready. Close and reopen the app, then try again.");
      }
      const snapshot = await this.getMainShopSnapshot();
      let renderSnapshot = snapshot;
      try {
        const remoteBranches = JSON.parse(
          window.localStorage.getItem(`ESHOP_BUSINESS_BRANCHES_V1:${AppController.getActiveTenant().id}`) || "[]"
        );
        if (Array.isArray(remoteBranches)) renderSnapshot = this.mergeRemoteBusinessData(snapshot, remoteBranches);
      } catch (error) {
        console.warn("Could not read the cached business branch snapshot.", error);
      }
      const remoteLoads = [];
      const combinedSalesPaths = new Set([
        "/account/main-shop", "/account/main-shop/marketing",
        "/account/main-shop/finance", "/account/main-shop/stores", "/account/main-shop/settings",
        "/account/main-shop/help", "/store/revenue", "/store/channels", "/store/sales",
        "/store/products", "/store/inventory", "/store/categories", "/store/orders",
        "/store/payments", "/account/customers", "/account/customers/loyalty",
        "/account/web/studio/crm/customers", "/account/web/studio/crm/points"
      ]);
      const ordersPage = /\/(?:store\/orders|orders-bookings)(?:\/|$)/.test(path);
      const bookingsPage = /\/(?:store\/bookings|orders-bookings)(?:\/|$)/.test(path);
      if (combinedSalesPaths.has(path) || ordersPage) {
        remoteLoads.push({
          key: "remoteOrders",
          load: () => window.EshopInventoryBridge.listStorefrontOrders(activeTenant.id)
        });
      }
      if (ordersPage) {
        remoteLoads.push({
          key: "remoteDiscounts",
          load: () => window.EshopInventoryBridge.listDiscountCodes(activeTenant.id)
        });
      }
      if (ordersPage || /\/crm\/notifications(?:\/|$)/.test(path)) {
        remoteLoads.push({
          key: "remoteAlerts",
          load: () => window.BusinessNotifications.owner.list(activeTenant.id)
        });
      }
      const storefrontAnalyticsPaths = new Set([
        "/account/web", "/account/dashboard",
        "/account/web/studio/dashboard/overview",
        "/account/web/studio/dashboard/visits",
        "/account/web/studio/dashboard/traffic",
        "/account/main-shop/visits", "/account/main-shop/traffic"
      ]);
      if (storefrontAnalyticsPaths.has(path)) {
        remoteLoads.push({
          key: "remoteAnalytics",
          load: () => window.EshopInventoryBridge.fetchStorefrontAnalytics(activeTenant.id, this.analyticsDays())
        });
      }
      if (bookingsPage) {
        remoteLoads.push({
          key: "remoteHolds",
          load: () => window.EshopInventoryBridge.listStorefrontHolds(activeTenant.id)
        });
        remoteLoads.push({
          key: "remoteAppointments",
          load: () => window.EshopInventoryBridge.listServiceAppointments(activeTenant.id, this.serviceAppointmentFilter().query)
        });
      }
      if (/\/product-intelligence(?:\/|$)/.test(path)) {
        remoteLoads.push({
          key: "remoteProductAnalytics",
          load: () => window.EshopInventoryBridge.fetchStorefrontEventAnalytics(activeTenant.id, 30)
        });
      }
      if (/\/(?:newsletter|subscribers)(?:\/|$)/.test(path)) {
        remoteLoads.push({
          key: "remoteNewsletter",
          load: () => window.EshopInventoryBridge.listNewsletterSubscribers(activeTenant.id)
        });
      }
      if (/\/split-shop(?:\/|$)/.test(path)) {
        remoteLoads.push({
          key: "remoteAllocations",
          load: () => window.EshopInventoryBridge.request(activeTenant.id, "allocations", "GET")
        });
      }
      const remoteResults = await Promise.allSettled(remoteLoads.map(item => item.load()));
      remoteResults.forEach((result, index) => {
        const key = remoteLoads[index].key;
        if (result.status === "fulfilled") {
          renderSnapshot[key] = key === "remoteOrders"
            ? (Array.isArray(result.value.orders) ? result.value.orders : [])
            : key === "remoteDiscounts"
              ? (Array.isArray(result.value.discounts) ? result.value.discounts : [])
            : key === "remoteHolds"
              ? (Array.isArray(result.value.holds) ? result.value.holds : [])
            : key === "remoteAppointments"
              ? (Array.isArray(result.value.appointments) ? result.value.appointments : [])
            : key === "remoteNewsletter"
              ? (Array.isArray(result.value.subscribers) ? result.value.subscribers : [])
            : key === "remoteAllocations"
              ? (Array.isArray(result.value.allocations) ? result.value.allocations : [])
              : result.value;
          if (key === "remoteAppointments") {
            renderSnapshot.remoteAppointmentsMeta = {
              filter: this.serviceAppointmentFilter().key,
              counts: result.value.counts || null,
              hasMore: result.value.has_more === true,
              fetched: renderSnapshot.remoteAppointments.length
            };
          }
          if (key === "remoteProductAnalytics") {
            renderSnapshot.remoteProductAnalyticsUpdatedAt = new Date().toISOString();
          }
          delete renderSnapshot[`${key}Error`];
        } else {
          renderSnapshot[`${key}Error`] = result.reason instanceof Error
            ? result.reason.message
            : "Could not load live shop data.";
          console.error(`Could not load live ${key} for the active shop.`, result.reason);
        }
      });
      if (Array.isArray(renderSnapshot.remoteOrders) && window.BusinessLens?.mergeStorefrontOrders) {
        renderSnapshot.sales = window.BusinessLens.mergeStorefrontOrders(
          renderSnapshot.sales,
          renderSnapshot.remoteOrders
        );
      }
      this.mainShopSnapshotCache = {
        tenantId: activeTenant.id,
        snapshot: renderSnapshot
      };
      const currentContent = document.getElementById("store-workspace-content");
      if (!currentContent || AppController.currentRoute().split("?")[0] !== path) return;
      currentContent.innerHTML = this.renderMainShopContent(path, renderSnapshot);
      if (/\/split-shop(?:\/|$)/.test(path)) this.bindSplitShopEvents(renderSnapshot, path);
      if (path === "/account/web/studio/websites/webmaker") AppController.bindWebsiteBuilderEvents();
      if (path === "/account/web/studio/websites/add") {
        const additionsForm = currentContent.querySelector("#website-additions-form");
        const saveAdditions = async () => {
          if (!additionsForm) return false;
          const data = new FormData(additionsForm);
          const status = additionsForm.querySelector('[role="status"]');
          const fields = ["instagram_url", "facebook_url", "tiktok_url", "youtube_url", "x_url", "whatsapp_url", "chatbot_url", "location_map_embed_url", "location_map_link"];
          for (const name of fields) {
            const value = String(data.get(name) || "").trim();
            let valid = false;
            try {
              const url = new URL(value);
              valid = url.protocol === "https:" && !!url.hostname && !url.username && !url.password;
            } catch {}
            if (value && !valid) {
              if (status) status.textContent = `${name.replaceAll("_", " ")} must be a valid HTTPS link.`;
              additionsForm.elements.namedItem(name)?.focus();
              return false;
            }
          }
          SQLiteEngine.updateStore({
            phone: String(data.get("phone") || "").trim(),
            whatsapp_enabled: data.get("whatsapp_enabled") === "on" ? 1 : 0,
            chatbot_enabled: data.get("chatbot_enabled") === "on" ? 1 : 0,
            location_name: String(data.get("location_name") || "").trim(),
            location_address: String(data.get("location_address") || "").trim(),
            ...Object.fromEntries(fields.map(name => [name, String(data.get(name) || "").trim()]))
          });
          try {
            AppController.cacheActiveTenantCatalog();
            if (!window.ShopSQLite) throw new Error("The app SQLite database is not ready.");
            await window.ShopSQLite.flush();
            if (status) status.textContent = "Saved on this device. Tap Publish changes here to send these settings live.";
            return true;
          } catch (error) {
            console.error("Website contact settings could not be saved.", error);
            if (status) status.textContent = error.message || "Could not save website additions.";
            return false;
          }
        };
        additionsForm?.addEventListener("submit", async event => {
          event.preventDefault();
          await saveAdditions();
        });
        const publishButton = additionsForm?.querySelector("[data-additions-publish]");
        publishButton?.addEventListener("click", async () => {
          if (!await saveAdditions()) return;
          publishButton.disabled = true;
          const status = additionsForm.querySelector('[role="status"]');
          try {
            const tenantId = AppController.getActiveTenant().id;
            const data = new FormData(additionsForm);
            const phone = String(data.get("phone") || "").trim();
            const store = {
              phone,
              whatsapp_enabled: data.get("whatsapp_enabled") === "on" ? 1 : 0,
              whatsapp_url: String(data.get("whatsapp_url") || "").trim() ||
                (phone.replace(/[^\d]/g, "") ? `https://wa.me/${phone.replace(/[^\d]/g, "")}` : ""),
              chatbot_enabled: data.get("chatbot_enabled") === "on" ? 1 : 0,
              location_name: String(data.get("location_name") || "").trim(),
              location_address: String(data.get("location_address") || "").trim(),
              ...Object.fromEntries(["instagram_url", "facebook_url", "tiktok_url", "youtube_url", "x_url", "chatbot_url", "location_map_embed_url", "location_map_link"]
                .map(name => [name, String(data.get(name) || "").trim()]))
            };
            const result = await AppController.cloudflareRequest(
              `/api/catalog?tenant=${encodeURIComponent(tenantId)}`,
              { method: "PATCH", body: JSON.stringify({ store }) },
              tenantId
            );
            if (status) status.textContent = `Published contact and location settings. Existing ${result.product_count} products and ${result.category_count} categories were left unchanged.`;
          } catch (error) {
            if (error.message?.includes("Publish the website catalog before publishing settings")) {
              if (status) status.textContent = "This site needs its first full catalog publish before settings can be published separately.";
              AppController.openCloudflarePublishModal();
            } else if (error.message?.includes("require a full publish")) {
              // The published page has these details built in, so they only show after a full publish from the editor.
              if (status) {
                status.textContent = "Saved. Your live website shows these details after you publish it from the Website editor. ";
                const openEditor = document.createElement("a");
                openEditor.href = "/account/web/studio/websites/editor";
                openEditor.setAttribute("data-route", "/account/web/studio/websites/editor");
                openEditor.textContent = "Open Website editor";
                status.appendChild(openEditor);
              }
            } else {
              console.error("Website settings could not be published.", error);
              if (status) status.textContent = error.message || "Could not publish website settings.";
            }
          } finally {
            publishButton.disabled = false;
          }
        });
      }
      currentContent.querySelectorAll("[data-bulk-removal]").forEach(control => {
        const selectAll = control.querySelector("[data-bulk-select-all]");
        const count = control.querySelector("[data-bulk-selection-count]");
        const removeButton = control.querySelector("[data-bulk-remove]");
        const holdButtons = [...control.querySelectorAll("[data-bulk-product-holds]")];
        const items = [...currentContent.querySelectorAll("[data-bulk-item]")];
        if (!selectAll || !count || !removeButton || !items.length) return;
        const updateSelection = () => {
          const selectedCount = items.filter(item => item.checked).length;
          count.textContent = `${selectedCount} selected`;
          removeButton.disabled = selectedCount === 0;
          holdButtons.forEach(button => { button.disabled = selectedCount === 0; });
          selectAll.checked = selectedCount === items.length;
          selectAll.indeterminate = selectedCount > 0 && selectedCount < items.length;
        };
        selectAll.onchange = () => {
          items.forEach(item => { item.checked = selectAll.checked; });
          updateSelection();
        };
        items.forEach(item => { item.onchange = updateSelection; });
        holdButtons.forEach(button => {
          button.onclick = async () => {
            const selectedIds = items.filter(item => item.checked).map(item => Number(item.dataset.bulkItem));
            if (!selectedIds.length) return;
            const enabled = button.dataset.bulkProductHolds === "enable";
            holdButtons.forEach(action => { action.disabled = true; });
            try {
              const updatedCount = AppController.setWebsiteProductHoldState(selectedIds, enabled);
              if (!updatedCount) throw new Error("No selected active website products could be updated.");
              await window.ShopSQLite.flush();
              await this.loadMainShopWorkspace(path);
              AppUtils.showToast(`${updatedCount} selected product${updatedCount === 1 ? "" : "s"} ${enabled ? "enabled" : "disabled"} for holds. Publish to update the live site.`);
            } catch (error) {
              console.error("Selected website product hold settings could not be updated.", error);
              AppUtils.showToast(error instanceof Error ? error.message : "Selected product hold settings could not be updated.", "danger");
              updateSelection();
            }
          };
        });
        removeButton.onclick = async () => {
          const selectedIds = items.filter(item => item.checked).map(item => Number(item.dataset.bulkItem));
          if (!selectedIds.length) return;
          const isProductList = control.dataset.bulkRemoval === "products";
          const selectedRecords = isProductList
            ? selectedIds.map(id => SQLiteEngine.select("products", product =>
              product.status !== "archived" && Number(product.id) === id
            )[0]).filter(Boolean)
            : selectedIds.map(id => SQLiteEngine.getCategories().find(category => Number(category.id) === id)).filter(Boolean);
          if (!selectedRecords.length) {
            AppUtils.showToast("The selected website items could not be found. Refresh and try again.", "danger");
            return;
          }
          const itemNames = selectedRecords.slice(0, 3).map(item => `"${item.name}"`).join(", ");
          const remainingCount = selectedRecords.length - 3;
          const selectionLabel = `${itemNames}${remainingCount > 0 ? ` and ${remainingCount} more` : ""}`;
          const confirmation = isProductList
            ? `Remove ${selectedRecords.length} product${selectedRecords.length === 1 ? "" : "s"} (${selectionLabel}) from this website? Separate Store/POS inventory records will not be deleted. Publish afterward to update the live site.`
            : `Remove ${selectedRecords.length} categor${selectedRecords.length === 1 ? "y" : "ies"} (${selectionLabel}) from this website? Store/POS categories will not be deleted; products will remain on this website as uncategorized. Publish afterward to update the live site.`;
          if (!window.confirm(confirmation)) return;
          removeButton.disabled = true;
          try {
            if (isProductList) selectedIds.forEach(id => SQLiteEngine.deleteProduct(id));
            else selectedIds.forEach(id => SQLiteEngine.deleteCategory(id));
            await window.ShopSQLite.flush();
            AppController.cacheActiveTenantCatalog();
            await this.loadMainShopWorkspace(path);
            AppUtils.showToast(`${selectedRecords.length} website ${isProductList ? "product" : "categor" + (selectedRecords.length === 1 ? "y" : "ies")} removed. Publish to update the live site.`);
          } catch (error) {
            console.error("Selected website items could not be removed.", error);
            AppUtils.showToast(error instanceof Error ? error.message : "Selected website items could not be removed.", "danger");
            removeButton.disabled = false;
          }
        };
        updateSelection();
      });
      currentContent.querySelectorAll("[data-store-holds-all]").forEach(button => {
        button.addEventListener("click", async () => {
          const products = SQLiteEngine.select("products", product => product.status !== "archived");
          const productIds = products.map(product => Number(product.id));
          if (!productIds.length) return;
          const enabled = button.dataset.storeHoldsAll === "enable";
          const actionButtons = [...currentContent.querySelectorAll("[data-store-holds-all]")];
          actionButtons.forEach(action => { action.disabled = true; });
          try {
            const updatedCount = AppController.setWebsiteProductHoldState(productIds, enabled);
            if (!updatedCount) throw new Error("No active website products could be updated.");
            await window.ShopSQLite.flush();
            await this.loadMainShopWorkspace(path);
            AppUtils.showToast(`Customer holds ${enabled ? "enabled" : "disabled"} for all ${updatedCount} active website products. Publish to update the live site.`);
          } catch (error) {
            console.error("All website product hold settings could not be updated.", error);
            AppUtils.showToast(error instanceof Error ? error.message : "All product hold settings could not be updated.", "danger");
            actionButtons.forEach(action => { action.disabled = false; });
          }
        });
      });
      document.querySelectorAll(".business-filter").forEach(control => control.addEventListener("change", () => {
        const filters = { ...window.BusinessLens.readFilters(), [control.dataset.filter]: control.value };
        if (control.dataset.filter === "from" || control.dataset.filter === "to") filters.range = "custom";
        window.BusinessLens.saveFilters(filters);
        void this.loadMainShopWorkspace(path);
      }));
      currentContent.querySelectorAll("[data-business-filter]").forEach(control => control.addEventListener("change", () => {
        const filters = { ...window.BusinessLens.readFilters(), [control.dataset.businessFilter]: control.value };
        window.BusinessLens.saveFilters(filters);
        void this.loadMainShopWorkspace(path);
      }));
      currentContent.querySelectorAll("[data-business-filter-form]").forEach(form => form.addEventListener("submit", event => {
        event.preventDefault();
        const filters = { ...window.BusinessLens.readFilters(), ...Object.fromEntries(new FormData(form).entries()) };
        window.BusinessLens.saveFilters(filters);
        void this.loadMainShopWorkspace(path);
      }));
      const businessSettings = currentContent.querySelector("[data-business-settings]");
      if (businessSettings) businessSettings.addEventListener("submit", event => {
        event.preventDefault();
        const formData = new FormData(businessSettings);
        const filters = Object.fromEntries(formData.entries());
        window.BusinessLens.saveFilters(filters);
        void this.loadMainShopWorkspace(path);
      });
      this.bindBusinessCloudActions(currentContent, path, renderSnapshot, activeTenant.id);
      if (["/store/products/manage", "/store/manage/products"].includes(path)) {
        this.bindMainStoreProductManagement(currentContent, renderSnapshot, path);
      }
      if (path === "/store/manage/categories") this.bindMainStoreCategories(currentContent, renderSnapshot, path);
      const exportButton = currentContent.querySelector('[data-business-export="transactions"]');
      if (exportButton) exportButton.addEventListener("click", () => {
        const headers = ["receipt", "channel", "date", "status", "currency", "total", "collected", "items"];
        const records = renderSnapshot.sales.map(sale => [
          sale.reference, sale.channel, sale.date, sale.status, sale.currency, sale.total, sale.collected,
          sale.lineItems.map(item => `${item.quantity}x ${item.name}`).join("; ")
        ]);
        const csvValue = value => `"${String(value ?? "").replaceAll('"', '""')}"`;
        const csv = [headers, ...records].map(record => record.map(csvValue).join(",")).join("\r\n");
        const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
        const link = document.createElement("a");
        link.href = url;
        link.download = "business-transactions.csv";
        link.click();
        URL.revokeObjectURL(url);
      });
      const bindForm = (selector, handler) => {
        document.querySelectorAll(selector).forEach(form => form.addEventListener("submit", async event => {
          event.preventDefault();
          const status = form.querySelector('[role="status"]');
          const submit = form.querySelector('button[type="submit"]');
          if (submit) submit.disabled = true;
          if (status) status.textContent = "";
          try {
            await handler(new FormData(form));
            await this.loadMainShopWorkspace(path);
          } catch (error) {
            console.error("Main shop update failed.", error);
            if (status) status.textContent = error instanceof Error ? error.message : "The change could not be saved.";
            if (submit) submit.disabled = false;
          }
        }));
      };
      const webProductMediaState = new WeakMap();
      const setWebProductMediaStatus = (form, text) => {
        const element = form.querySelector("[data-web-product-media-status]");
        if (element) element.textContent = text;
      };
      const webProductForm = currentContent.querySelector('[data-studio-form="web-product"]');
      if (webProductForm) {
        const isWebProductField = element =>
          Boolean(element?.matches?.('input:not([type="hidden"]), select, textarea'));
        webProductForm.addEventListener("focusin", event => {
          if (isWebProductField(event.target)) document.body.classList.add("web-product-field-focused");
        });
        webProductForm.addEventListener("focusout", () => {
          requestAnimationFrame(() => {
            if (!isWebProductField(document.activeElement)) {
              document.body.classList.remove("web-product-field-focused");
            }
          });
        });
        const taxonomyHost = webProductForm.querySelector("[data-web-product-taxonomy]");
        const variantsHost = webProductForm.querySelector("[data-web-product-variants]");
        const pricingHost = webProductForm.querySelector("[data-web-product-attribute-pricing]");
        if (!taxonomyHost || !variantsHost || !pricingHost) throw new Error("The Web product form is missing category, options or attribute pricing controls.");
        const websiteCategories = SQLiteEngine.getCategories();
        const bindProductDetails = product => {
          taxonomyHost.innerHTML = window.EshopProductTaxonomy.createProductTaxonomyFields({
            categoryId: product?.taxonomy_category_id || "",
            categoryName: product?.taxonomy_category_name || "",
            customCategory: product?.taxonomy_custom_category || "",
            attributes: product?.taxonomy_attributes || [],
            storeCategories: websiteCategories.map(category => ({ value: category.id, name: category.name })),
            storeCategoryFieldName: "categoryId",
            storeCategoryValue: product?.category_id ?? ""
          });
          window.EshopProductTaxonomy.bindProductTaxonomyFields(taxonomyHost, undefined, {
            onCategoryCreate: async name => {
              let category = SQLiteEngine.getCategories().find(item =>
                item.name.trim().toLocaleLowerCase() === name.trim().toLocaleLowerCase());
              if (!category) {
                SQLiteEngine.saveCategory({ name });
                category = SQLiteEngine.getCategories().find(item =>
                  item.name.trim().toLocaleLowerCase() === name.trim().toLocaleLowerCase());
              }
              if (!category) throw new Error(`Could not save Web category "${name}".`);
              await window.ShopSQLite.flush();
              AppController.cacheActiveTenantCatalog();
              return { value: category.id, name: category.name };
            }
          });
          variantsHost.innerHTML = window.EshopProductVariants.createProductVariantFields({
            // Reopening a product must bring back its third option and per-value prices too.
            options: Array.isArray(product?.options) ? product.options : [],
            option1Name: product?.option1_name || "",
            option2Name: product?.option2_name || "",
            sizes: product?.sizes || [],
            colors: product?.colors || [],
            variants: product?.variants || []
          });
          window.EshopProductVariants.bindProductVariantFields(variantsHost.firstElementChild || variantsHost);
          // Charging by attribute: the choices on offer are the chosen category's own attributes.
          pricingHost.innerHTML = window.EshopAttributePricing.createAttributePricingFields({
            pricedAttributes: product?.priced_attributes || []
          });
          window.EshopAttributePricing.bindAttributePricingFields(
            pricingHost.firstElementChild || pricingHost,
            () => window.EshopProductTaxonomy.readAvailableTaxonomyAttributes(webProductForm)
          );
        };
        // Picking a category changes which attributes exist, so the pricing editor is told at once
        // rather than waiting for the form to be reopened.
        webProductForm.addEventListener("product-taxonomy-change", () => {
          pricingHost.firstElementChild?.refreshAttributePricing?.();
        });
        bindProductDetails(null);
        const mediaStatus = webProductForm.querySelector("[data-web-product-media-status]");
        const imageInput = webProductForm.querySelector("[data-web-product-image]");
        const spinModeButton = webProductForm.querySelector('[data-web-product-media-mode="3d"]');
        if (spinModeButton) spinModeButton.textContent = "360° spin";
        const videoOptions = webProductForm.querySelector("[data-web-product-video-options]");
        const videoRecordInput = webProductForm.querySelector("[data-web-product-record-file]");
        const videoPickInput = webProductForm.querySelector("[data-web-product-video-file]");
        const mediaPreview = webProductForm.querySelector("[data-web-product-media-preview]");
        if (imageInput) {
          imageInput.multiple = true;
          const imageLabel = imageInput.closest(".web-product-file");
          if (imageLabel?.firstChild?.nodeType === Node.TEXT_NODE) {
            imageLabel.firstChild.textContent = "Add photos (up to 8) ";
          }
        }
        const spinOptions = document.createElement("div");
        spinOptions.className = "web-product-spin-options";
        spinOptions.hidden = true;
        const spinProfileLabel = document.createElement("label");
        spinProfileLabel.textContent = "360 speed and detail";
        const spinProfileSelect = document.createElement("select");
        spinProfileSelect.name = "spinProfile";
        [
          ["high", "High detail — 36 frames, 720 px"],
          ["balanced", "Balanced — 24 frames, 720 px"],
          ["fast", "Faster — 18 frames, 480 px"]
        ].forEach(([value, label]) => {
          const option = document.createElement("option");
          option.value = value;
          option.textContent = label;
          spinProfileSelect.append(option);
        });
        spinProfileLabel.append(spinProfileSelect);
        const spinProfileNote = document.createElement("p");
        spinProfileNote.className = "studio-panel-note";
        spinProfileNote.textContent = "More frames and higher resolution take longer to process.";
        spinOptions.append(spinProfileLabel, spinProfileNote);
        videoOptions.insertAdjacentElement("afterend", spinOptions);
        const nativeMedia = window.EshopNativeMedia;
        const isAndroidApp = nativeMedia?.Capacitor?.getPlatform?.() === "android";
        const media = {
          mode: "keep",
          cutoutPaths: [],
          spinFrames: [],
          videoBlob: null,
          videoPath: "",
          videoPoster: null,
          videoPreviewUrl: "",
          imagePreviewUrls: []
        };
        const setMediaStatus = text => {
          if (mediaStatus) mediaStatus.textContent = text;
        };
        const showMediaProgress = (progress, activity) => {
          if (progress.phase === "model") {
            if (progress.state === "paused") {
              setMediaStatus("Google Play services paused the background-removal model download. Waiting for it to resume…");
            } else if (progress.state === "installing") {
              setMediaStatus("Installing the background-removal model…");
            } else if (progress.state === "downloading" && progress.total > 0) {
              setMediaStatus(`Downloading background-removal model… ${progress.done}%`);
            } else {
              setMediaStatus("Preparing the background-removal model through Google Play services…");
            }
            return;
          }
          setMediaStatus(`${activity} ${progress.done} of ${progress.total}…`);
        };
        const clearMediaPreview = () => {
          if (media.videoPreviewUrl.startsWith("blob:")) URL.revokeObjectURL(media.videoPreviewUrl);
          media.videoPreviewUrl = "";
          media.imagePreviewUrls.forEach(url => URL.revokeObjectURL(url));
          media.imagePreviewUrls = [];
          if (mediaPreview) {
            mediaPreview.replaceChildren();
            mediaPreview.hidden = true;
          }
        };
        const showImagePreviews = (urls, spin = false) => {
          clearMediaPreview();
          if (!mediaPreview || !urls.length) return;
          media.imagePreviewUrls = urls.filter(url => url.startsWith("blob:"));
          const images = spin ? urls.slice(0, 1) : urls;
          images.forEach((url, imageIndex) => {
            const image = document.createElement("img");
            image.src = url;
            image.alt = spin ? "Drag to rotate the 3D product preview" : `Processed product image ${imageIndex + 1}`;
            if (spin) {
              image.dataset.spinPreview = "";
              let frame = 0;
              let pointerId = -1;
              let lastX = 0;
              image.addEventListener("pointerdown", event => {
                pointerId = event.pointerId;
                lastX = event.clientX;
                image.setPointerCapture(pointerId);
              });
              image.addEventListener("pointermove", event => {
                if (event.pointerId !== pointerId) return;
                const step = Math.trunc((event.clientX - lastX) / 6);
                if (!step) return;
                frame = ((frame - step % urls.length) % urls.length + urls.length) % urls.length;
                lastX = event.clientX;
                image.src = urls[frame];
              });
              image.addEventListener("pointerup", () => { pointerId = -1; });
              image.addEventListener("pointercancel", () => { pointerId = -1; });
              image.title = "Drag left or right to rotate";
            }
            mediaPreview.append(image);
          });
          mediaPreview.hidden = false;
        };
        const showVideoPreview = file => {
          clearMediaPreview();
          if (!mediaPreview) return;
          media.videoPreviewUrl = URL.createObjectURL(file);
          const video = document.createElement("video");
          video.src = media.videoPreviewUrl;
          video.controls = true;
          video.playsInline = true;
          video.setAttribute("aria-label", "Selected product video");
          mediaPreview.append(video);
          mediaPreview.hidden = false;
        };
        const setMediaError = error => {
          setMediaStatus(error instanceof Error ? error.message : "Product media could not be processed.");
        };
        const nativeFileUrl = path => nativeMedia.Capacitor.convertFileSrc(path);
        const makeVideoPoster = async file => {
          const sourceUrl = URL.createObjectURL(file);
          const video = document.createElement("video");
          video.muted = true;
          video.playsInline = true;
          video.preload = "auto";
          video.src = sourceUrl;
          try {
            await new Promise((resolve, reject) => {
              if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
                resolve();
                return;
              }
              video.addEventListener("loadeddata", resolve, { once: true });
              video.addEventListener("error", () => reject(new Error("The video preview could not be decoded.")), { once: true });
            });
            const canvas = document.createElement("canvas");
            const scale = Math.min(1, 800 / Math.max(video.videoWidth, video.videoHeight));
            canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
            canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
            const context = canvas.getContext("2d");
            if (!context) throw new Error("A video thumbnail could not be created.");
            context.drawImage(video, 0, 0, canvas.width, canvas.height);
            const blob = await new Promise((resolve, reject) => canvas.toBlob(
              value => value ? resolve(value) : reject(new Error("A video thumbnail could not be created.")),
              "image/webp",
              0.82
            ));
            return new File([blob], "product-video-poster.webp", { type: blob.type });
          } finally {
            video.pause();
            video.removeAttribute("src");
            URL.revokeObjectURL(sourceUrl);
          }
        };
        const processCutoutImages = async paths => {
          if (!paths.length) return;
          setMediaStatus("Preparing Google Play services background removal…");
          const listener = await nativeMedia.ProductCutout.addListener("progress", progress => {
            showMediaProgress(progress, "Removing backgrounds");
          });
          try {
            const result = await nativeMedia.ProductCutout.cutoutImages({ paths, width: 1200 });
            media.cutoutPaths = result.images;
            showImagePreviews(result.images.map(nativeFileUrl));
            setMediaStatus(`${result.images.length} cutout image${result.images.length === 1 ? "" : "s"} ready to save.`);
          } finally {
            await listener.remove();
          }
        };
        const chooseCutoutImages = async () => {
          try {
            setMediaStatus("Choose up to 8 product photos.");
            const result = await nativeMedia.Camera.chooseFromGallery({
              mediaType: nativeMedia.MediaTypeSelection.Photo,
              allowMultipleSelection: true,
              limit: 8,
              quality: 100
            });
            const paths = (result.results || []).map(item => item.uri).filter(Boolean).slice(0, 8);
            if (!paths.length) {
              setMediaStatus("No product photos were selected.");
              return;
            }
            await processCutoutImages(paths);
          } catch (error) {
            setMediaError(error);
          }
        };
        const selectedVideoBlob = async item => {
          if (item instanceof Blob) return item;
          const path = item.webPath || nativeMedia.Capacitor.convertFileSrc(item.uri || "");
          const response = await fetch(path);
          if (!response.ok) throw new Error("The selected video could not be opened.");
          const blob = await response.blob();
          const uri = String(item.uri || item.webPath || "");
          const extension = uri.split(/[?#]/)[0].split(".").pop()?.toLowerCase() || "";
          const format = String(item.metadata?.format || extension).toLowerCase();
          const formats = {
            mp4: { type: "video/mp4", extension: "mp4" },
            m4v: { type: "video/mp4", extension: "mp4" },
            webm: { type: "video/webm", extension: "webm" },
            mov: { type: "video/quicktime", extension: "mov" },
            quicktime: { type: "video/quicktime", extension: "mov" }
          };
          const match = formats[format];
          const contentType = blob.type.startsWith("video/") ? blob.type : match?.type;
          if (!contentType || !["video/mp4", "video/webm", "video/quicktime"].includes(contentType)) {
            throw new Error("This video format is not supported. Choose an MP4, WebM, or QuickTime video.");
          }
          const fileExtension = contentType === "video/webm" ? "webm" : contentType === "video/quicktime" ? "mov" : "mp4";
          return new File([blob], `product-video.${match?.extension || fileExtension}`, { type: contentType });
        };
        const chooseVideo = async record => {
          try {
            if (!isAndroidApp) {
              (record ? videoRecordInput : videoPickInput).click();
              return;
            }
            setMediaStatus(record ? "Opening video camera…" : "Opening video gallery…");
            const selected = record
              ? await nativeMedia.Camera.recordVideo({ isPersistent: true, includeMetadata: true })
              : (await nativeMedia.Camera.chooseFromGallery({
                mediaType: nativeMedia.MediaTypeSelection.Video,
                includeMetadata: true
              })).results?.[0];
            if (!selected?.uri) {
              setMediaStatus("No video was selected.");
              return;
            }
            if (media.mode === "3d") {
              const spinProfiles = {
                high: { count: 36, width: 720 },
                balanced: { count: 24, width: 720 },
                fast: { count: 18, width: 480 }
              };
              const spinProfile = spinProfiles[spinProfileSelect.value] || spinProfiles.high;
              setMediaStatus(`Preparing the model and generating ${spinProfile.count} 360 frames…`);
              const listener = await nativeMedia.ProductCutout.addListener("progress", progress => {
                showMediaProgress(progress, "Processing 360 frames");
              });
              try {
                const result = await nativeMedia.ProductCutout.processVideo({
                  path: selected.uri,
                  ...spinProfile
                });
                media.spinFrames = result.frames;
                showImagePreviews(result.frames.map(nativeFileUrl), true);
                setMediaStatus(`${result.frames.length} 360 frames ready. Drag the preview to check it.`);
              } finally {
                await listener.remove();
              }
              return;
            }
            media.videoBlob = await selectedVideoBlob(selected);
            const extension = media.videoBlob.name.split(".").pop()?.toLowerCase();
            if (!["mp4", "webm", "mov"].includes(extension)) {
              throw new Error("This video format is not supported. Choose an MP4, WebM, or QuickTime video.");
            }
            const persistentVideo = await nativeMedia.ProductCutout.persistVideo({
              path: selected.uri,
              extension
            });
            media.videoPath = `${LOCAL_PRODUCT_MEDIA_PREFIX}${persistentVideo.path}`;
            try {
              media.videoPoster = await makeVideoPoster(media.videoBlob);
            } catch (error) {
              media.videoPoster = null;
              setMediaStatus(`Video selected. A preview image could not be made: ${error.message}`);
            }
            showVideoPreview(media.videoBlob);
            if (media.videoPoster) setMediaStatus(`${media.videoBlob.name} selected.`);
          } catch (error) {
            setMediaError(error);
          }
        };
        const resetMediaSelection = () => {
          media.cutoutPaths = [];
          media.spinFrames = [];
          media.videoBlob = null;
          media.videoPath = "";
          media.videoPoster = null;
          clearMediaPreview();
          if (imageInput) imageInput.value = "";
          videoRecordInput.value = "";
          videoPickInput.value = "";
        };
        const updateMediaMode = mode => {
          media.mode = mode;
          resetMediaSelection();
          webProductForm.querySelectorAll("[data-web-product-media-mode]").forEach(button => {
            button.setAttribute("aria-pressed", String(button.dataset.webProductMediaMode === mode));
          });
          const videoMode = mode === "3d" || mode === "video";
          videoOptions.hidden = !videoMode;
          spinOptions.hidden = mode !== "3d";
          if (imageInput) imageInput.disabled = videoMode;
          setMediaStatus(mode === "3d"
            ? isAndroidApp
              ? "Record or choose a video. Craft will create 36 transparent spin frames on this Android device."
              : "3D processing requires the Android Craft app and Google Play services."
            : mode === "video"
              ? "Record or choose a product video. MP4, WebM, and QuickTime are supported."
              : mode === "cutout"
                ? isAndroidApp
                  ? "Choose product photos for on-device ML Kit background removal."
                  : "Cutout requires the Android Craft app and Google Play services."
                : "Keep the selected image as-is.");
        };
        const productMediaUrl = reference => {
          const value = String(reference || "");
          if (!value.startsWith(LOCAL_PRODUCT_MEDIA_PREFIX)) return value;
          return nativeMedia?.Capacitor ? nativeFileUrl(value.slice(LOCAL_PRODUCT_MEDIA_PREFIX.length)) : "";
        };
        const showExistingProductMedia = product => {
          const images = Array.isArray(product.images) ? product.images : [];
          if (media.mode === "3d" && Array.isArray(product.spin_frames) && product.spin_frames.length) {
            showImagePreviews(product.spin_frames.map(productMediaUrl).filter(Boolean), true);
          } else {
            showImagePreviews(images.map(productMediaUrl).filter(Boolean));
          }
          setMediaStatus("Existing media will be kept unless you choose replacement media.");
        };
        // A service is a property of the product: the form says so per item, not per shop.
        const applyWebItemType = () => {
          const typeField = webProductForm.querySelector("[data-web-product-item-type]");
          const durationField = webProductForm.querySelector("[data-web-product-duration]");
          const stockField = webProductForm.querySelector("[data-web-product-stock]");
          const stockInput = stockField?.querySelector('[name="stock"]');
          const isService = typeField?.value === "service";
          if (durationField) durationField.hidden = !isService;
          if (stockField) stockField.hidden = isService;
          // A hidden required field would refuse the save with nothing on screen to fix.
          if (stockInput) stockInput.required = !isService;
        };
        webProductForm.querySelector("[data-web-product-item-type]")?.addEventListener("change", applyWebItemType);
        const setEditingProduct = product => {
          webProductForm.reset();
          webProductForm.querySelector('[name="productId"]').value = String(product.id);
          webProductForm.querySelector("h2").textContent = "Edit web product";
          webProductForm.querySelector('button[type="submit"]').textContent = "Save changes";
          webProductForm.querySelector("[data-web-product-cancel]").hidden = false;
          webProductForm.querySelector('[name="name"]').value = product.name || "";
          webProductForm.querySelector('[name="price"]').value = product.price ?? "";
          webProductForm.querySelector('[name="costPrice"]').value = product.cost_price ?? "";
          webProductForm.querySelector('[name="stock"]').value = product.stock ?? 0;
          webProductForm.querySelector('[name="booking_enabled"]').checked = Boolean(product.booking_enabled);
          const savedMinutes = window.EshopServiceModel.serviceDuration(product);
          webProductForm.querySelector("[data-web-product-item-type]").value = savedMinutes ? "service" : "product";
          if (savedMinutes) webProductForm.querySelector('[name="durationMinutes"]').value = String(savedMinutes);
          applyWebItemType();
          bindProductDetails(product);
          const mediaMode = product.media_type === "spin" ? "3d"
            : ["video", "cutout"].includes(product.media_type) ? product.media_type : "keep";
          updateMediaMode(mediaMode);
          media.videoPath = mediaMode === "video" ? product.video_path || "" : "";
          showExistingProductMedia(product);
          webProductForm.querySelector('[name="name"]').focus();
        };
        const resetProductEdit = () => {
          webProductForm.reset();
          webProductForm.querySelector('[name="productId"]').value = "";
          webProductForm.querySelector("h2").textContent = "Create web-only product";
          webProductForm.querySelector('button[type="submit"]').textContent = "Save web product";
          webProductForm.querySelector("[data-web-product-cancel]").hidden = true;
          bindProductDetails(null);
          updateMediaMode("keep");
          applyWebItemType();
        };
        currentContent.querySelectorAll("[data-edit-web-product]").forEach(button => {
          button.addEventListener("click", () => {
            const product = SQLiteEngine.getProductById(Number(button.dataset.editWebProduct));
            if (!product) {
              AppUtils.showToast("Product not found. Refresh the Store workspace and try again.", "danger");
              return;
            }
            webProductForm.hidden = false;
            setEditingProduct(product);
          });
        });
        webProductForm.querySelector("[data-web-product-cancel]")?.addEventListener("click", () => {
          resetProductEdit();
          webProductForm.querySelector('[name="name"]').focus();
        });
        webProductForm.querySelectorAll("[data-web-product-media-mode]").forEach(button => {
          button.addEventListener("click", () => updateMediaMode(button.dataset.webProductMediaMode));
        });
        imageInput?.addEventListener("click", event => {
          if (media.mode === "cutout" && isAndroidApp) {
            event.preventDefault();
            void chooseCutoutImages();
          }
        });
        webProductForm.querySelector("[data-web-product-video-record]")?.addEventListener("click", () => {
          void chooseVideo(true);
        });
        webProductForm.querySelector("[data-web-product-video-pick]")?.addEventListener("click", () => {
          void chooseVideo(false);
        });
        for (const input of [videoRecordInput, videoPickInput]) {
          input?.addEventListener("change", async () => {
            const file = input.files?.[0];
            if (!file) return;
            if (media.mode === "3d") {
              setMediaStatus("3D frame processing is currently available in the Android Craft app.");
              return;
            }
            try {
              media.videoBlob = file;
              try {
                media.videoPoster = await makeVideoPoster(file);
              } catch (error) {
                media.videoPoster = null;
                setMediaStatus(`Video selected. A preview image could not be made: ${error.message}`);
              }
              showVideoPreview(file);
              if (media.videoPoster) setMediaStatus(`${file.name} selected.`);
            } catch (error) {
              setMediaError(error);
            }
          });
        }
        imageInput?.addEventListener("change", () => {
          const files = Array.from(imageInput.files || []);
          if (!files.length) return;
          if (files.length > 8) {
            imageInput.value = "";
            clearMediaPreview();
            setMediaStatus("Choose up to 8 product photos.");
            return;
          }
          if (media.mode === "cutout") {
            setMediaStatus(isAndroidApp
              ? "Use Add file to choose photos from the Android gallery for cutout."
              : "Cutout requires the Android Craft app and Google Play services.");
            return;
          }
          showImagePreviews(files.map(file => URL.createObjectURL(file)));
          setMediaStatus(`${files.length} product photo${files.length === 1 ? "" : "s"} selected.`);
        });
        webProductMediaState.set(webProductForm, media);
      }
      document.querySelectorAll("[data-studio-form]").forEach(form => {
        form.addEventListener("submit", async event => {
          event.preventDefault();
          const data = new FormData(form);
          const status = form.querySelector('[role="status"]');
          const button = form.querySelector('button[type="submit"]');
          if (button) button.disabled = true;
          if (status) status.textContent = "";
          try {
            const kind = form.dataset.studioForm;
            const wasEditingWebProduct = kind === "web-product" && String(data.get("productId") || "").trim() !== "";
            if (kind === "web-category") {
              const name = String(data.get("name") || "").trim();
              if (!name) throw new Error("Enter a category name.");
              if (SQLiteEngine.getCategories().some(item => item.name.trim().toLocaleLowerCase() === name.toLocaleLowerCase())) {
                throw new Error("That website category already exists.");
              }
              SQLiteEngine.saveCategory({ name });
              await window.ShopSQLite.flush();
              AppController.cacheActiveTenantCatalog();
            } else if (kind === "web-product") {
              const mediaMode = form.querySelector('[data-web-product-media-mode][aria-pressed="true"]')?.dataset.webProductMediaMode || "keep";
              const media = webProductMediaState.get(form);
              const productIdText = String(data.get("productId") || "").trim();
              const productId = productIdText ? Number(productIdText) : null;
              const existingProduct = productIdText && Number.isSafeInteger(productId) && productId > 0
                ? SQLiteEngine.getProductById(productId)
                : null;
              if (productIdText && !existingProduct) throw new Error("That Web product could not be found. Refresh and try again.");
              const name = String(data.get("name") || "").trim();
              const price = Number(data.get("price"));
              const costText = String(data.get("costPrice") || "").trim();
              const costPrice = costText === "" ? null : Number(costText);
              const stock = Number(data.get("stock"));
              const categoryId = Number(data.get("categoryId"));
              const taxonomy = window.EshopProductTaxonomy.readProductTaxonomyFields(form);
              // A service is sold as time, so it carries a duration and counts no stock.
              const sellsTime = String(data.get("itemType") || "product") === "service";
              const durationMinutes = sellsTime
                ? window.EshopServiceModel.normalizeServiceDuration(data.get("durationMinutes")) ||
                  window.EshopServiceModel.DEFAULT_SERVICE_MINUTES
                : 0;
              if (sellsTime && !durationMinutes) throw new Error("Choose how long this service takes.");
              if (!name || !Number.isFinite(price) || price < 0 ||
                (costPrice !== null && (!Number.isFinite(costPrice) || costPrice < 0)) ||
                (!sellsTime && (!Number.isSafeInteger(stock) || stock < 0)) ||
                !Number.isSafeInteger(categoryId) ||
                !SQLiteEngine.getCategories().some(category => Number(category.id) === categoryId)) {
                throw new Error("Enter a product name, category, valid prices, and whole-number stock quantity.");
              }
              if (!media) throw new Error("Product media could not be initialized. Reopen the product form and try again.");
              const productVariants = window.EshopProductVariants.readProductVariantFields(form);
              const pricedAttributes = window.EshopAttributePricing.readAttributePricingFields(
                form.querySelector("[data-attribute-pricing]")
              );
              const imageFiles = data.getAll("image").filter(file => file instanceof File && file.size > 0);
              if (imageFiles.length > 8) throw new Error("Choose up to 8 product photos.");
              const existingImages = Array.isArray(existingProduct?.images) ? existingProduct.images.slice(0, 8) : [];
              const isExistingPhotoProduct = !existingProduct?.media_type || existingProduct.media_type === "image";
              let images = mediaMode === "keep" && isExistingPhotoProduct ? existingImages : [];
              let spinFrames = [];
              let videoPath = "";
              let videoUrl = "";
              if (imageFiles.length) {
                if (mediaMode === "keep") {
                  setWebProductMediaStatus(form, "Compressing product image for local SQLite storage…");
                  images = [];
                  for (const imageFile of imageFiles) {
                    images.push(await AppUtils.compressImageFile(imageFile));
                  }
                } else if (mediaMode === "cutout") {
                  throw new Error("Choose photos from the Android gallery to create cutout images.");
                }
              }
              if (mediaMode === "cutout") {
                if (window.EshopNativeMedia?.Capacitor?.getPlatform?.() !== "android") {
                  throw new Error("Cutout requires the Android Craft app and Google Play services.");
                }
                if (media.cutoutPaths.length) {
                  images = media.cutoutPaths.map(path => `${LOCAL_PRODUCT_MEDIA_PREFIX}${path}`);
                } else if (existingProduct?.media_type === "cutout" && existingImages.length) {
                  images = existingImages;
                } else {
                  throw new Error("Choose at least one product photo for cutout.");
                }
              } else if (mediaMode === "3d") {
                if (media.spinFrames.length) {
                  spinFrames = media.spinFrames.map(path => `${LOCAL_PRODUCT_MEDIA_PREFIX}${path}`);
                  images = spinFrames.length ? [spinFrames[0]] : [];
                } else if (existingProduct?.media_type === "spin" && Array.isArray(existingProduct.spin_frames) && existingProduct.spin_frames.length) {
                  spinFrames = existingProduct.spin_frames.slice();
                  images = existingImages;
                } else {
                  throw new Error("Record or choose a video to generate the 360 spin frames.");
                }
              } else if (mediaMode === "video") {
                if (media.videoBlob instanceof Blob && media.videoBlob.size) {
                  setWebProductMediaStatus(form, "Saving product video to local storage…");
                  videoPath = media.videoPath || await AppUtils.storeLocalProductVideo(media.videoBlob);
                  if (media.videoPoster) {
                    images = [await AppUtils.compressImageFile(media.videoPoster)];
                  }
                } else if (existingProduct?.media_type === "video" &&
                  (media.videoPath || existingProduct.video_path || existingProduct.video_url)) {
                  videoPath = media.videoPath || existingProduct.video_path;
                  images = existingImages;
                  videoUrl = existingProduct.video_url || "";
                } else {
                  throw new Error("Record or choose a product video before saving.");
                }
              }
              SQLiteEngine.saveProduct({
                ...(existingProduct ? { id: existingProduct.id, sku: existingProduct.sku } : {}),
                name, category_id: categoryId,
                price,
                stock: sellsTime ? null : productVariants.stock ?? stock,
                duration_minutes: sellsTime ? durationMinutes : null,
                cost_price: costPrice ?? 0,
                taxonomy_category_id: taxonomy.taxonomyCategoryId || null,
                taxonomy_category_name: taxonomy.taxonomyCategoryName || "",
                taxonomy_custom_category: taxonomy.taxonomyCustomCategory || null,
                taxonomy_attributes: taxonomy.taxonomyAttributes,
                priced_attributes: pricedAttributes,
                ...productVariants,
                booking_enabled: data.get("booking_enabled") === "on",
                description: existingProduct?.description || "",
                images,
                media_type: mediaMode === "keep" ? "image" : mediaMode === "3d" ? "spin" : mediaMode,
                spin_frames: spinFrames,
                video_url: videoUrl,
                video_path: videoPath,
                status: existingProduct?.status || "active"
              });
              await window.ShopSQLite.flush();
              AppController.cacheActiveTenantCatalog();
            } else if (kind === "loyalty-settings") {
              const visits = Number(data.get("pointsPerVisit"));
              const spend = Number(data.get("pointsPerCurrency"));
              if (!Number.isSafeInteger(visits) || visits < 0 || !Number.isSafeInteger(spend) || spend < 0) throw new Error("Points rules must be zero or a positive whole number.");
              this.setWorkspaceSetting("points_per_visit", visits);
              this.setWorkspaceSetting("points_per_currency", spend);
              await window.ShopSQLite.flush();
            } else if (kind === "points-adjust") {
              const customerKey = String(data.get("customerKey") || "");
              const manualValue = String(data.get("delta") || "").trim();
              const manualDelta = manualValue ? Number(manualValue) : 0;
              const purchaseValue = String(data.get("purchaseAmount") || "").trim();
              const purchaseAmount = purchaseValue ? Number(purchaseValue) : 0;
              const reason = String(data.get("reason") || "").trim();
              const pointsPerCurrency = Number(this.getWorkspaceSetting("points_per_currency", 0));
              const pointsPerVisit = Number(this.getWorkspaceSetting("points_per_visit", 0));
              const purchasePoints = purchaseValue ? Math.floor(purchaseAmount) * pointsPerCurrency : 0;
              const visitPoints = data.get("verifiedVisit") === "yes" ? pointsPerVisit : 0;
              const delta = manualDelta + purchasePoints + visitPoints;
              if (!customerKey || (manualValue && (!Number.isSafeInteger(manualDelta) || manualDelta === 0 || !reason))
                || (purchaseValue && (!Number.isFinite(purchaseAmount) || purchaseAmount <= 0))
                || (!manualValue && !purchaseValue && !visitPoints) || !Number.isSafeInteger(delta) || delta === 0) {
                throw new Error("Choose a customer and enter a valid purchase, verified visit, or manual adjustment. Manual adjustments need a reason.");
              }
              const customer = this.getWorkspaceCustomers(snapshot.sales).find(item => item.key === customerKey);
              if (!customer) throw new Error("Customer not found. Refresh and try again.");
              if (customer.points + delta < 0) throw new Error("Points balance cannot be negative.");
              const reasons = [];
              if (purchasePoints) reasons.push(`Verified paid purchase (${purchaseAmount} ${snapshot.currency || "KES"})`);
              if (visitPoints) reasons.push("Verified visit");
              if (manualDelta) reasons.push(reason);
              SQLiteEngine.insert("customer_points", { tenant_id: activeTenant.id, customer_key: customerKey, customer_name: customer.name, delta, reason: reasons.join(" · "), created_at: new Date().toISOString() });
              await window.ShopSQLite.flush();
            } else if (kind === "booking-settings") {
              const hours = Number(data.get("maxHoldHours"));
              if (!Number.isSafeInteger(hours) || hours < 1 || hours > 720) throw new Error("Hold duration must be between 1 and 720 hours.");
              this.setWorkspaceSetting("max_hold_hours", hours);
              await window.ShopSQLite.flush();
              AppController.cacheActiveTenantCatalog();
            } else if (kind === "booking-create") {
              const product = SQLiteEngine.getProductById(Number(data.get("productId")));
              const quantity = Number(data.get("quantity"));
              const hours = Number(data.get("hours"));
              const maxHours = Number(this.getWorkspaceSetting("max_hold_hours", 24));
              const customerName = String(data.get("customerName") || "").trim();
              const contact = String(data.get("contact") || "").trim();
              if (!product || !Number.isSafeInteger(quantity) || quantity < 1 || !Number.isSafeInteger(hours) || hours < 1 || hours > maxHours || !customerName || !contact) throw new Error("Check the product, quantity, customer, contact, and hold duration.");
              if (product.stock != null && Number(product.stock) < quantity) throw new Error("The website stock is lower than the requested hold quantity.");
              const createdAt = new Date();
              SQLiteEngine.insert("booking_holds", {
                tenant_id: activeTenant.id,
                product_id: product.id, product_name: product.name, quantity,
                customer_name: customerName, contact, status: "on hold",
                created_at: createdAt.toISOString(), expires_at: new Date(createdAt.getTime() + hours * 3600000).toISOString()
              });
              await window.ShopSQLite.flush();
            } else if (kind === "newsletter-add") {
              const email = String(data.get("email") || "").trim().toLocaleLowerCase();
              if (!email) throw new Error("Enter an email address.");
              if (SQLiteEngine.select("newsletter_subscribers", item => item.tenant_id === activeTenant.id && item.email.toLocaleLowerCase() === email).length) throw new Error("This email is already subscribed.");
              SQLiteEngine.insert("newsletter_subscribers", { tenant_id: activeTenant.id, name: String(data.get("name") || "").trim(), email, created_at: new Date().toISOString() });
              await window.ShopSQLite.flush();
            } else if (kind === "newsletter-draft") {
              const subject = String(data.get("subject") || "").trim();
              const message = String(data.get("message") || "").trim();
              if (!subject || !message) throw new Error("Enter both a subject and message.");
              this.setWorkspaceSetting("newsletter_draft", { subject, message, saved_at: new Date().toISOString() });
              await window.ShopSQLite.flush();
            } else {
              throw new Error("This action is not available.");
            }
            await this.loadMainShopWorkspace(path);
            if (kind === "web-product" && !wasEditingWebProduct) {
              const nextProductForm = document.querySelector('[data-studio-form="web-product"]');
              if (nextProductForm) {
                nextProductForm.hidden = false;
                nextProductForm.querySelector('[name="name"]')?.focus();
              }
            }
          } catch (error) {
            console.error("Studio workspace action failed.", error);
            if (status) status.textContent = error instanceof Error ? error.message : "The change could not be saved.";
            if (button) button.disabled = false;
          }
        });
      });
      currentContent.querySelectorAll("[data-web-product-booking]").forEach(input => {
        input.addEventListener("change", async () => {
          const productId = Number(input.dataset.webProductBooking);
          const product = SQLiteEngine.getProductById(productId);
          if (!product) {
            AppUtils.showToast("Product not found. Refresh the Store workspace and try again.", "danger");
            input.checked = false;
            return;
          }
          input.disabled = true;
          try {
            if (!AppController.setWebsiteProductHoldState([productId], input.checked)) {
              throw new Error("Product not found. Refresh the Store workspace and try again.");
            }
            await window.ShopSQLite.flush();
            AppUtils.showToast(`Customer holds ${input.checked ? "enabled" : "disabled"} for ${product.name}. Publish the storefront to apply this change.`);
          } catch (error) {
            input.checked = !input.checked;
            AppUtils.showToast(error instanceof Error ? error.message : "The product hold setting could not be saved.", "danger");
          } finally {
            input.disabled = false;
          }
        });
      });
      document.getElementById("store-add-product-trigger")?.addEventListener("click", () => {
        const form = document.querySelector("[data-store-web-import]");
        if (form) form.hidden = !form.hidden;
      });
      document.getElementById("store-create-web-product")?.addEventListener("click", () => {
        const form = document.querySelector('[data-studio-form="web-product"]');
        if (form) {
          form.hidden = !form.hidden;
          form.querySelector('[name="name"]')?.focus();
        }
      });
      document.querySelectorAll("[data-release-hold]").forEach(button => button.addEventListener("click", async () => {
        const id = Number(button.dataset.releaseHold);
        SQLiteEngine.update("booking_holds", hold => hold.tenant_id === activeTenant.id && Number(hold.id) === id, hold => ({ ...hold, status: "released", released_at: new Date().toISOString() }));
        await window.ShopSQLite.flush();
        await this.loadMainShopWorkspace(path);
      }));
      document.querySelectorAll("[data-remove-subscriber]").forEach(button => button.addEventListener("click", async () => {
        SQLiteEngine.delete("newsletter_subscribers", item => item.tenant_id === activeTenant.id && Number(item.id) === Number(button.dataset.removeSubscriber));
        await window.ShopSQLite.flush();
        await this.loadMainShopWorkspace(path);
      }));
      bindForm(".store-product-form", async data => {
        const imageFile = data.get("productImage");
        let imageUri = "";
        if (imageFile instanceof File && imageFile.size > 0) {
          imageUri = await AppUtils.compressImageFile(imageFile);
        }
        let posCategory = (await window.ShopPOS.listCategories()).find(category =>
          category.name.trim().toLocaleLowerCase() === String(data.get("categoryName")).trim().toLocaleLowerCase());
        if (!posCategory) {
          await window.ShopPOS.addCategory(data.get("categoryName"));
          posCategory = (await window.ShopPOS.listCategories()).find(category =>
            category.name.trim().toLocaleLowerCase() === String(data.get("categoryName")).trim().toLocaleLowerCase());
        }
        if (!posCategory) throw new Error("The selected category could not be created in POS.");
        const id = await window.ShopPOS.saveProduct({
          name: data.get("name"), categoryId: posCategory.id, price: Number(data.get("price")),
          buyingPrice: data.get("buyingPrice"), stock: Number(data.get("stock")), imageUri
        });
        const product = (await window.ShopPOS.listProducts()).find(item => Number(item.id) === Number(id));
        if (!product) throw new Error("The POS product saved, but could not be reloaded for the website catalog.");
        await this.publishPosProduct(product);
      });
      const syncExistingProduct = async (product, targetCategoryName = "") => {
        if (!product.posProductId && product.webProductId) {
          await this.addWebsiteProductToPos(product.webProductId);
        } else if (product.posProductId && !product.webProductId) {
          const posProduct = (await window.ShopPOS.listProducts()).find(item => Number(item.id) === product.posProductId);
          if (!posProduct) throw new Error("That POS product no longer exists. Refresh the Store screen.");
          await this.publishPosProduct(posProduct);
        }
        if (!targetCategoryName || targetCategoryName.toLocaleLowerCase() === product.categoryName.toLocaleLowerCase()) return;
        const posCategories = await window.ShopPOS.listCategories();
        let posCategory = posCategories.find(item => item.name.trim().toLocaleLowerCase() === targetCategoryName.toLocaleLowerCase());
        if (!posCategory) {
          await window.ShopPOS.addCategory(targetCategoryName);
          posCategory = (await window.ShopPOS.listCategories()).find(item => item.name.trim().toLocaleLowerCase() === targetCategoryName.toLocaleLowerCase());
        }
        let webCategory = SQLiteEngine.getCategories().find(item => item.name.trim().toLocaleLowerCase() === targetCategoryName.toLocaleLowerCase());
        if (!webCategory) {
          SQLiteEngine.saveCategory({ name: targetCategoryName });
          webCategory = SQLiteEngine.getCategories().find(item => item.name.trim().toLocaleLowerCase() === targetCategoryName.toLocaleLowerCase());
        }
        if (!posCategory || !webCategory) throw new Error("Could not add the selected category to both catalogs.");
        const posProduct = (await window.ShopPOS.listProducts()).find(item =>
          (product.posProductId && Number(item.id) === product.posProductId)
          || (product.sku && item.sku.toLocaleUpperCase() === product.sku.toLocaleUpperCase())
          || item.name.toLocaleLowerCase() === product.name.toLocaleLowerCase());
        const webProduct = SQLiteEngine.select("products").find(item =>
          (product.webProductId && Number(item.id) === product.webProductId)
          || (product.sku && String(item.sku || "").toLocaleUpperCase() === product.sku.toLocaleUpperCase())
          || item.name.toLocaleLowerCase() === product.name.toLocaleLowerCase());
        if (posProduct) await window.ShopPOS.saveProduct({ ...posProduct, categoryId: posCategory.id });
        if (webProduct) SQLiteEngine.saveProduct({ ...webProduct, category_id: webCategory.id });
        await window.ShopSQLite.flush();
        AppController.cacheActiveTenantCatalog();
      };
      document.querySelectorAll(".store-existing-product-form").forEach(form => {
        if (form.matches("[data-store-web-import]")) {
          const selectAll = form.querySelector("[data-store-import-select-all]");
          const products = [...form.querySelectorAll("[data-store-import-product]")];
          const submitButton = form.querySelector('button[type="submit"]');
          const selectionCount = form.querySelector("[data-store-import-count]");
          const updateSelection = () => {
            const selectedCount = products.filter(input => input.checked).length;
            if (selectionCount) selectionCount.textContent = `${selectedCount} selected`;
            if (submitButton) submitButton.disabled = selectedCount === 0;
            if (selectAll) {
              selectAll.checked = products.length > 0 && selectedCount === products.length;
              selectAll.indeterminate = selectedCount > 0 && selectedCount < products.length;
            }
          };
          selectAll?.addEventListener("change", () => {
            products.forEach(input => { input.checked = selectAll.checked; });
            updateSelection();
          });
          products.forEach(input => input.addEventListener("change", updateSelection));
          updateSelection();
        }
        form.addEventListener("submit", async event => {
          event.preventDefault();
          const status = form.querySelector('[role="status"]');
          const button = form.querySelector('button[type="submit"]');
          if (form.matches("[data-store-web-import]")) {
            const selectedProducts = [...form.querySelectorAll("[data-store-import-product]:checked")]
              .map(input => snapshot.products[Number(input.dataset.storeImportProduct)])
              .filter(Boolean);
            if (!selectedProducts.length) {
              if (status) status.textContent = "Select at least one Store product.";
              return;
            }
            button.disabled = true;
            if (status) status.textContent = `Adding ${selectedProducts.length} product${selectedProducts.length === 1 ? "" : "s"}…`;
            let addedCount = 0;
            try {
              for (const product of selectedProducts) {
                await syncExistingProduct(product);
                addedCount += 1;
              }
              await this.loadMainShopWorkspace(path);
              AppUtils.showToast(`${addedCount} Store product${addedCount === 1 ? "" : "s"} added to this website.`);
            } catch (error) {
              console.error("Selected Store products could not all be added.", error);
              if (status) status.textContent = `${addedCount} of ${selectedProducts.length} products added. ${error instanceof Error ? error.message : "The remaining products could not be added."}`;
              button.disabled = false;
              AppUtils.showToast("Some selected Store products could not be added. Review the message and retry.", "danger");
            }
            return;
          }
          const selectedValue = new FormData(form).get("existingProduct");
          const selectedIndex = selectedValue === "" ? -1 : Number(selectedValue);
          const selectedProduct = snapshot.products[selectedIndex];
          if (!selectedProduct) {
            if (status) status.textContent = "Choose a product from inventory.";
            return;
          }
          button.disabled = true;
          if (status) status.textContent = "";
          try {
            await syncExistingProduct(selectedProduct, form.dataset.categoryName || "");
            await this.loadMainShopWorkspace(path);
            AppUtils.showToast("Product added from inventory and synced to POS and Web.");
          } catch (error) {
            console.error("Existing inventory product could not be added.", error);
            if (status) status.textContent = error instanceof Error ? error.message : "Product could not be added.";
            button.disabled = false;
          }
        });
      });
      const addProductTrigger = document.getElementById("store-add-product-trigger");
      const newProductForm = document.getElementById("store-product-form");
      const mainExistingForm = document.querySelector("#store-workspace-content > .store-existing-product-form");
      if (addProductTrigger && newProductForm) {
        addProductTrigger.addEventListener("click", () => {
          if (mainExistingForm) mainExistingForm.hidden = false;
          addProductTrigger.hidden = true;
        });
        document.getElementById("store-cancel-product")?.addEventListener("click", () => {
          newProductForm.reset();
          newProductForm.hidden = true;
          if (mainExistingForm) mainExistingForm.hidden = false;
          addProductTrigger.hidden = false;
        });
      }
      document.querySelectorAll(".store-create-product-trigger").forEach(button => {
        button.addEventListener("click", () => {
          const existingForm = button.closest(".store-existing-product-form");
          const productForm = existingForm?.nextElementSibling?.matches(".store-product-form")
            ? existingForm.nextElementSibling
            : (mainExistingForm ? document.getElementById("store-product-form") : null);
          if (existingForm) existingForm.hidden = true;
          if (productForm) {
            productForm.hidden = false;
            productForm.querySelector('[name="name"]')?.focus();
          }
        });
      });
      document.querySelectorAll(".store-cancel-create-product").forEach(button => {
        button.addEventListener("click", () => {
          const productForm = button.closest(".store-product-form");
          const existingForm = productForm?.previousElementSibling;
          if (productForm) {
            productForm.reset();
            productForm.hidden = true;
          }
          if (existingForm?.matches(".store-existing-product-form")) existingForm.hidden = false;
        });
      });
      document.querySelectorAll('.store-product-form [name="productImage"]').forEach(imageInput => {
        const imagePreview = imageInput.form.querySelector(".store-product-image-preview");
        imageInput.addEventListener("change", () => {
          const file = imageInput.files?.[0];
          if (!file) {
            if (imagePreview) {
              imagePreview.hidden = true;
              imagePreview.removeAttribute("src");
            }
            return;
          }
          if (!file.type.startsWith("image/") || file.size > 5 * 1024 * 1024) {
            AppUtils.showToast("Choose an image smaller than 5 MB.", "danger");
            imageInput.value = "";
            if (imagePreview) {
              imagePreview.hidden = true;
              imagePreview.removeAttribute("src");
            }
            return;
          }
          if (imagePreview) {
            imagePreview.src = URL.createObjectURL(file);
            imagePreview.hidden = false;
          }
        });
      });
      bindForm("store-category-form", async data => {
        const name = String(data.get("name") || "").trim();
        if (!name) throw new Error("Enter a category name.");
        const existsInPos = (await window.ShopPOS.listCategories()).some(category =>
          category.name.trim().toLocaleLowerCase() === name.toLocaleLowerCase());
        if (!existsInPos) await window.ShopPOS.addCategory(name);
        const webCategory = SQLiteEngine.getCategories().some(category =>
          category.name.trim().toLocaleLowerCase() === name.toLocaleLowerCase());
        if (!webCategory) SQLiteEngine.saveCategory({ name });
        await window.ShopSQLite.flush();
        AppController.cacheActiveTenantCatalog();
      });
      document.querySelectorAll(".store-stock-form").forEach(form => {
        form.addEventListener("submit", async event => {
          event.preventDefault();
          const button = form.querySelector('button[type="submit"]');
          button.disabled = true;
          try {
            const stock = Number(new FormData(form).get("stock"));
            if (!Number.isSafeInteger(stock) || stock < 0) throw new Error("Enter a whole-number stock quantity.");
            const posId = Number(form.dataset.posId || 0);
            const webId = Number(form.dataset.webId || 0);
            if (posId) {
              const posProduct = (await window.ShopPOS.listProducts()).find(item => Number(item.id) === posId);
              if (!posProduct) throw new Error("That POS product no longer exists. Refresh the Store screen.");
              await window.ShopPOS.saveProduct({ ...posProduct, id: posId, stock });
            }
            if (webId) {
              const webProduct = SQLiteEngine.getProductById(webId);
              if (!webProduct) throw new Error("That website product no longer exists. Refresh the Store screen.");
              SQLiteEngine.saveProduct({ ...webProduct, stock });
              await window.EshopInventoryBridge?.setLocalStock(AppController.getActiveTenant().id, webProduct.sku, stock);
              await window.ShopSQLite.flush();
              AppController.cacheActiveTenantCatalog();
            }
            await this.loadMainShopWorkspace(path);
          } catch (error) {
            console.error("Main shop stock update failed.", error);
            AppUtils.showToast(error instanceof Error ? error.message : "Stock could not be updated.", "danger");
            button.disabled = false;
          }
        });
      });
      const search = document.getElementById("store-product-search");
      const sourceFilter = document.getElementById("store-product-source");
      if (search || sourceFilter) {
        const filterProducts = () => {
        const query = search?.value.trim().toLocaleLowerCase() || "";
        const source = sourceFilter?.value || "all";
        document.querySelectorAll("[data-store-search]").forEach(row => {
          const matchesSearch = row.dataset.storeSearch.includes(query);
          const sources = (row.dataset.storeSources || "").split(",");
          const matchesSource = source === "all" || sources.includes(source);
          row.hidden = !matchesSearch || !matchesSource;
        });
        };
        search?.addEventListener("input", filterProducts);
        sourceFilter?.addEventListener("change", filterProducts);
      }
      const deployButton = document.getElementById("btn-publish-cloudflare");
      if (deployButton) deployButton.onclick = () => AppController.openCloudflarePublishModal();
      document.querySelectorAll("[data-store-publish-product]").forEach(button => {
        button.addEventListener("click", async () => {
          button.disabled = true;
          try {
            const product = (await window.ShopPOS.listProducts()).find(item =>
              Number(item.id) === Number(button.dataset.storePublishProduct));
            if (!product) throw new Error("That POS product no longer exists. Refresh the Store screen.");
            await this.publishPosProduct(product);
            await this.loadMainShopWorkspace(path);
            AppUtils.showToast("Product added to the website catalog.");
          } catch (error) {
            console.error("POS product could not be added to the website.", error);
            AppUtils.showToast(error instanceof Error ? error.message : "Product could not be added to the website.", "danger");
            button.disabled = false;
          }
        });
      });
      document.querySelectorAll("[data-store-pos-product]").forEach(button => {
        button.addEventListener("click", async () => {
          button.disabled = true;
          try {
            await this.addWebsiteProductToPos(Number(button.dataset.storePosProduct));
            await this.loadMainShopWorkspace(path);
            AppUtils.showToast("Product added to POS.");
          } catch (error) {
            console.error("Website product could not be added to POS.", error);
            AppUtils.showToast(error instanceof Error ? error.message : "Product could not be added to POS.", "danger");
            button.disabled = false;
          }
        });
      });
      document.querySelectorAll("[data-store-website-category]").forEach(button => {
        button.addEventListener("click", async () => {
          button.disabled = true;
          try {
            const name = button.dataset.storeWebsiteCategory;
            if (!SQLiteEngine.getCategories().some(category => category.name.trim().toLocaleLowerCase() === name.trim().toLocaleLowerCase())) {
              SQLiteEngine.saveCategory({ name });
              await window.ShopSQLite.flush();
              AppController.cacheActiveTenantCatalog();
            }
            await this.loadMainShopWorkspace(path);
          } catch (error) {
            console.error("POS category could not be added to the website.", error);
            AppUtils.showToast(error instanceof Error ? error.message : "Category could not be added to the website.", "danger");
            button.disabled = false;
          }
        });
      });
      document.querySelectorAll("[data-remove-website-product]").forEach(button => {
        button.addEventListener("click", async event => {
          event.preventDefault();
          event.stopPropagation();
          const productId = Number(button.dataset.removeWebsiteProduct);
          const product = SQLiteEngine.select("products", item =>
            item.status !== "archived" && Number(item.id) === productId
          )[0];
          if (!product) {
            AppUtils.showToast("That website product could not be found. Refresh the page and try again.", "danger");
            return;
          }
          if (!window.confirm(`Remove "${product.name}" from this website? Its separate Store/POS inventory will not be deleted. Publish the website afterward to apply this change online.`)) return;
          button.disabled = true;
          try {
            SQLiteEngine.deleteProduct(productId);
            await window.ShopSQLite.flush();
            AppController.cacheActiveTenantCatalog();
            await this.loadMainShopWorkspace(path);
            AppUtils.showToast(`"${product.name}" removed from this website. Publish to update the live site.`);
          } catch (error) {
            console.error("Website product could not be removed.", error);
            AppUtils.showToast(error instanceof Error ? error.message : "Website product could not be removed.", "danger");
            button.disabled = false;
          }
        });
      });
      document.querySelectorAll("[data-remove-website-category]").forEach(button => {
        button.addEventListener("click", async event => {
          event.preventDefault();
          event.stopPropagation();
          const categoryId = Number(button.dataset.removeWebsiteCategory);
          const category = SQLiteEngine.getCategories().find(item => Number(item.id) === categoryId);
          if (!category) {
            AppUtils.showToast("That website category could not be found. Refresh the page and try again.", "danger");
            return;
          }
          const productCount = SQLiteEngine.select("products", product =>
            product.status !== "archived" && Number(product.category_id) === categoryId
          ).length;
          const reassignment = productCount
            ? ` ${productCount} website product${productCount === 1 ? " will" : "s will"} remain on this website as uncategorized.`
            : "";
          if (!window.confirm(`Remove the "${category.name}" category from this website? This does not remove its separate Store/POS category.${reassignment} Publish the website afterward to apply this change online.`)) return;
          button.disabled = true;
          try {
            SQLiteEngine.deleteCategory(categoryId);
            await window.ShopSQLite.flush();
            AppController.cacheActiveTenantCatalog();
            await this.loadMainShopWorkspace(path);
            AppUtils.showToast(`"${category.name}" category removed from this website. Publish to update the live site.`);
          } catch (error) {
            console.error("Website category could not be removed.", error);
            AppUtils.showToast(error instanceof Error ? error.message : "Website category could not be removed.", "danger");
            button.disabled = false;
          }
        });
      });
      document.querySelectorAll("[data-store-pos-category]").forEach(button => {
        button.addEventListener("click", async () => {
          button.disabled = true;
          try {
            const name = button.dataset.storePosCategory;
            if (!(await window.ShopPOS.listCategories()).some(category => category.name.trim().toLocaleLowerCase() === name.trim().toLocaleLowerCase())) {
              await window.ShopPOS.addCategory(name);
            }
            await this.loadMainShopWorkspace(path);
          } catch (error) {
            console.error("Website category could not be added to POS.", error);
            AppUtils.showToast(error instanceof Error ? error.message : "Category could not be added to POS.", "danger");
            button.disabled = false;
          }
        });
      });
    } catch (error) {
      console.error("Main shop data could not be loaded.", error);
      content.innerHTML = `<p class="store-workspace-empty" role="alert">${AppUtils.escapeHTML(error instanceof Error ? error.message : "Business records could not be loaded.")}</p>`;
    }
  },
};
