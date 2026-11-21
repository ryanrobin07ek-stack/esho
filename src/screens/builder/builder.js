// Shop builder screen (/account/web/site): the Litrus Mixer toolbar and iframe, and the wiring that
// sends the shop catalog and theme into the iframe and saves what it sends back (message protocol in
// src/litrus-host.js). setupLitrusBuilder is the /account/web/site block of AppController.postRenderSetup,
// called with this = AppController.
// Moved verbatim from the app script (index.html, then src/app/main.js).
import { AppController, AppUtils, SQLiteEngine, StoreRenderers, StudioRenderers } from '../../app/main.js';
import { DOMAIN } from '../../app/domain.js';

export const builderScreen = {
  renderWebsiteEditor(isNewWebsite = false) {
    const editorParams = new URLSearchParams(AppController.currentRoute().split("?")[1] || "");
    const draftEditor = isNewWebsite && editorParams.get("edit") === "1";
    const tenant = AppController.getActiveTenant();
    const store = SQLiteEngine.getStore();
    const appAccountSession = window.localStorage.getItem("ESHOP_ACCOUNT_SESSION_V1");
    const newWebsiteDraft = isNewWebsite ? StudioRenderers.websiteBuilderDraft() : null;
    const requestedTheme = editorParams.get("theme") ||
      (isNewWebsite
        ? newWebsiteDraft.selected_theme || ""
        : store.website_theme_id) || "litrus-mixer";
    const availableThemes = this.websiteThemesForPicker();
    const selectedTheme = !isNewWebsite
      ? requestedTheme
      : availableThemes.some(theme => theme.id === requestedTheme)
        ? requestedTheme
        : availableThemes[0]?.id || "litrus-mixer";
    if (draftEditor && newWebsiteDraft && editorParams.has("theme")) {
      newWebsiteDraft.selected_theme = selectedTheme;
      this.saveWebsiteBuilderDraft(newWebsiteDraft);
    }
    const editorReturnRoute = draftEditor
      ? "/account/web/studio/websites/list"
      : `/account/profile/webs/${encodeURIComponent(tenant.id)}`;
    AppUtils.updateSEO({
      title: "Litrus Mixer — Craft",
      description: "Build and preview your storefront with Litrus Mixer."
    });
    if (isNewWebsite && !draftEditor) {
    if (!appAccountSession) {
      const continueTo = `/account/web/site?new=1&finish=1&theme=${encodeURIComponent(selectedTheme)}`;
      const accountRoute = `/app-account?continue=${encodeURIComponent(continueTo)}`;
      return `
        ${StoreRenderers.renderNavbar("/account")}
        <main class="container" style="padding:20px 0 48px;max-width:620px;">
          <a href="/account/web/site?new=1&edit=1&theme=${encodeURIComponent(selectedTheme)}" class="studio-back-link" data-route="/account/web/site?new=1&edit=1&theme=${encodeURIComponent(selectedTheme)}" aria-label="Back to website editor">&larr;</a>
          <section class="profile-page-card" style="margin-top:16px;">
            <h1 class="section-heading" style="font-size:1.5rem;margin:0;">Sign in to create your website</h1>
            <p style="margin:8px 0 16px;color:var(--text-muted);">Your editor draft is saved on this device. Sign in or create your Craft app account to finish creating the website.</p>
            <a class="btn-primary" href="${AppUtils.escapeHTML(accountRoute)}" data-route="${AppUtils.escapeHTML(accountRoute)}">Open app account</a>
          </section>
        </main>
        ${StoreRenderers.renderFooter()}
      `;
    }
      return `
      ${StoreRenderers.renderNavbar("/account")}
      <main class="container" style="padding:16px 0 48px;max-width:760px;">
        <a href="/account/web/site?new=1&edit=1&theme=${encodeURIComponent(selectedTheme)}" class="studio-back-link" data-route="/account/web/site?new=1&edit=1&theme=${encodeURIComponent(selectedTheme)}" aria-label="Back to website editor">&larr;</a>
        <header style="margin:12px 0 18px;">
          <span class="studio-workspace-kicker">NEW WEBSITE · FINAL SETUP</span>
          <h1 class="section-heading" style="font-size:1.55rem;margin:4px 0;">Create your website</h1>
          <p style="margin:3px 0 0;color:var(--text-muted);font-size:.85rem;">Your design is saved on this device. Choose the name and address to create the website now.</p>
        </header>
        <form id="new-website-form" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,220px),1fr));gap:8px;padding:12px;border:1px solid var(--border);border-radius:var(--radius-lg);">
          <label class="form-field"><span class="form-label">Shop / website name</span><input class="form-input" name="name" required maxlength="120" placeholder="My Shop" value="${AppUtils.escapeHTML(newWebsiteDraft.shop_name || "")}"></label>
          <label class="form-field"><span class="form-label">Website address</span><span style="display:flex;align-items:center;gap:5px;"><input class="form-input" name="id" required maxlength="40" pattern="[A-Za-z0-9-]+" placeholder="my-store" value="${AppUtils.escapeHTML(newWebsiteDraft.shop_address || String(newWebsiteDraft.shop_name || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40).replace(/-$/g, ""))}"><span style="white-space:nowrap;font-size:.8rem;">.${DOMAIN.root}</span></span></label>
          <label style="grid-column:1/-1;display:flex;align-items:flex-start;gap:8px;font-size:.84rem;"><input type="checkbox" name="confirm_domain" required><span>I confirm this website address and domain before publishing.</span></label>
          <p class="studio-panel-note" style="grid-column:1/-1;">App-account Paystack payments are shared across your websites. Payment settings belong to your signed-in app account. Every website registered to your app account will use this account at checkout.</p>
          <p id="new-website-error" role="alert" hidden style="grid-column:1/-1;color:#b42318;margin:0;"></p>
          <button class="btn-primary" type="submit" style="min-height:42px;align-self:end;">Set up</button>
        </form>
      </main>
      ${StoreRenderers.renderFooter()}
    `;
    }
      return `
        <style>
          /* Flat and compact, like the editor panels: white bar, 1px lines, one 10px radius, 44px targets. */
          .builder-litrus-toolbar{z-index:1;min-height:54px;padding:5px 8px;display:flex;align-items:center;gap:6px;overflow:visible;box-sizing:border-box;background:#fff;color:#111;border-bottom:1px solid #c7ccd2;box-shadow:none}
          .builder-litrus-toolbar button,.builder-litrus-toolbar a,.builder-litrus-device-controls summary{height:44px;min-height:44px;min-width:44px;padding:0 12px;box-sizing:border-box;display:inline-flex;align-items:center;justify-content:center;white-space:nowrap;border:1px solid #c7ccd2;border-radius:10px;background:#fff;color:#111;font:600 12px system-ui,sans-serif;text-decoration:none;cursor:pointer;box-shadow:none}
          .builder-litrus-toolbar button:focus-visible,.builder-litrus-toolbar a:focus-visible,.builder-litrus-device-controls summary:focus-visible{outline:2px solid #111;outline-offset:2px}
          .builder-litrus-toolbar [hidden]{display:none!important}
          .builder-litrus-toolbar #builder-litrus-publish{background:#111;color:#fff;border-color:#111}
          .builder-litrus-toolbar #builder-litrus-save[data-save-state="saved"]{color:#5f6670}
          .builder-litrus-toolbar #builder-litrus-save[data-save-state="dirty"]{border-color:#111;font-weight:700}
          .builder-litrus-toolbar #builder-litrus-save[data-save-state="saving"]{cursor:progress;color:#5f6670}
          .builder-litrus-toolbar #builder-litrus-save[data-save-state="error"]{border-color:#b42318;color:#b42318}
          .builder-litrus-save-short{display:none}
          .builder-litrus-device-controls{position:relative;margin-left:auto}
          .builder-litrus-device-controls[hidden]{display:none!important}
          .builder-litrus-device-controls summary{gap:6px;list-style:none}
          .builder-litrus-device-controls summary::-webkit-details-marker{display:none}
          .builder-litrus-device-controls summary svg{width:17px;height:17px}
          .builder-litrus-device-menu{position:absolute;top:50px;right:0;z-index:20;display:grid;min-width:150px;gap:4px;padding:6px;border:1px solid #c7ccd2;border-radius:10px;background:#fff;box-shadow:none}
          .builder-litrus-device-menu button{width:100%;justify-content:flex-start}
          .builder-litrus-device-menu button[aria-pressed="true"]{background:#111;color:#fff;border-color:#111}
          @media(max-width:400px){.builder-litrus-save-long{display:none}.builder-litrus-save-short{display:inline}}
          @media(max-width:520px){.builder-litrus-toolbar{gap:4px;padding-inline:5px}.builder-litrus-toolbar button,.builder-litrus-toolbar a,.builder-litrus-device-controls summary{padding-inline:8px;font-size:11px}}
        </style>
        <main style="width:100%;min-width:0;height:100dvh;min-height:0;display:grid;grid-template-columns:minmax(0,1fr);grid-template-rows:auto minmax(0,1fr);overflow:hidden;background:#eceff2;color:#111;">
          <header class="builder-litrus-toolbar" aria-label="Shop builder controls">
            <button id="builder-litrus-publish" type="button">Publish</button>
            <button id="builder-litrus-save" type="button" data-save-state="saved" aria-live="polite" title="All changes are saved"><span class="builder-litrus-save-long">Saved</span><span class="builder-litrus-save-short">Saved</span></button>
            ${draftEditor ? "" : `<a id="builder-litrus-store-details" href="/account/web/store?tenant=${encodeURIComponent(tenant.id)}" data-route="/account/web/store?tenant=${encodeURIComponent(tenant.id)}">Store</a>`}
            <button id="builder-litrus-sections" type="button">Sections</button>
            <button id="builder-litrus-advanced" type="button">Advanced</button>
            <details class="builder-litrus-device-controls" id="builder-litrus-devices" hidden>
              <summary aria-label="Devices"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="13" height="15" rx="2"/><path d="M8 16h3M19 8h2v12h-7v-1"/></svg><span>Devices</span></summary>
              <div class="builder-litrus-device-menu" role="group" aria-label="Preview device">
                <button type="button" data-litrus-preview-device="fit" aria-pressed="true">Fit</button>
                <button type="button" data-litrus-preview-device="phone" aria-pressed="false">Phone</button>
                <button type="button" data-litrus-preview-device="tablet" aria-pressed="false">Tablet</button>
                <button type="button" data-litrus-preview-device="laptop" aria-pressed="false">Laptop</button>
              </div>
            </details>
          </header>
          <iframe id="builder-litrus-mixer" title="Shop builder" src="/litrus-mixer/index.html?craft=1" allow="clipboard-read; clipboard-write" style="display:block;width:100%;min-width:0;height:100%;border:0;background:#eceff2;"></iframe>
        </main>
        <div id="product-modal-container"></div>
      `;
  },
};

export function setupLitrusBuilder(params, path) {
  if (path === "/account/web/site") {
    const litrusFrame = document.getElementById("builder-litrus-mixer");
    if (litrusFrame) {
      // Releasing the taxonomy here was a guess at the crash, and it was the wrong one: the app
      // dies on a single 54 MB bitmap allocation, not on the taxonomy. All the release bought was
      // a quarter-second re-decode the next time a product form opened, so it is gone.
      const isDraftEditor = params.get("new") === "1" && params.get("edit") === "1";
      const draftId = isDraftEditor ? StudioRenderers.websiteBuilderDraft().draft_id : "";
      // The shop this editor session belongs to. Everything the editor sends is applied to this
      // shop only, never to whichever shop happens to be active when the message arrives.
      const openedTenantId = this.getActiveTenant().id;
      const litrusScope = isDraftEditor ? `draft:${draftId || "new"}` : `tenant:${openedTenantId}`;
      const litrusRecipeKey = `litrus-mixer-recipe:${litrusScope}`;
      const litrusDesignKey = `liquid-html-theme-draft:litrus-mixer:${litrusScope}`;
      const savedLitrusRecipe = StudioRenderers.getWorkspaceSetting(litrusRecipeKey, null);
      const savedLitrusHtml = isDraftEditor ? "" : StudioRenderers.getWorkspaceSetting(litrusDesignKey, "");
      let litrusSaveQueue = Promise.resolve();
      const validLitrusHtml = html => window.EshopLitrusHost.isValidHtml(html);
      const saveLitrusDesign = payload => {
        const save = litrusSaveQueue.then(async () => {
          if (!window.ShopSQLite) throw new Error("The app database is not ready.");
          await this.saveLitrusMixerCatalog(payload, isDraftEditor, openedTenantId);
          StudioRenderers.setWorkspaceSetting(litrusDesignKey, payload.html);
          if (payload.recipe?.litrus === "mixer-recipe" && payload.recipe.v === 1) {
            StudioRenderers.setWorkspaceSetting(litrusRecipeKey, payload.recipe);
          }
          await window.ShopSQLite.flush();
        });
        litrusSaveQueue = save.catch(() => {});
        return save;
      };
      const sendCatalog = () => {
        try {
          const store = SQLiteEngine.getStore();
          // A new-store draft has its own products and categories. Sending the Main Store's
          // catalogue here filled the new store with every Store product, and the first autosave
          // then wrote that list over the draft, so the owner's own products vanished.
          const draftSource = isDraftEditor ? StudioRenderers.websiteBuilderDraft() : null;
          const categories = draftSource
            ? (Array.isArray(draftSource.categories) ? draftSource.categories : [])
            : SQLiteEngine.getCategories();
          const products = (draftSource
            ? (Array.isArray(draftSource.products) ? draftSource.products : [])
            : SQLiteEngine.select("products", product => product.status !== "archived"))
            .map(product => {
              const productCategoryIds = Array.isArray(product.category_ids) &&
                  String(product.category_ids[0] ?? "") === String(product.category_id ?? "")
                ? product.category_ids
                : product.category_id == null ? [] : [product.category_id];
              return {
                id: product.id,
                name: product.name,
                price: product.price ?? product.selling_price ?? 0,
                description: product.description || "",
                images: Array.isArray(product.images) ? product.images : [],
                image: (Array.isArray(product.images) ? product.images[0] : "") ||
                  product.imageUri || product.image || "",
                media_type: product.media_type || "image",
                // Up to 36 base64 frames per product, all of it serialised into one postMessage.
                // That is what the 54 MB allocation was that killed the app when the builder
                // opened. The builder only previews; the saved frames are kept here and restored
                // on the way back, so sending a count instead loses nothing but the spin preview.
                spin_frame_count: Array.isArray(product.spin_frames) ? product.spin_frames.length : 0,
                video_url: product.video_url || "",
                booking_enabled: product.booking_enabled === true || product.booking_enabled === 1,
                // Only a service carries a duration. Defaulting every product to an hour made
                // the builder treat the whole catalogue as bookable time.
                duration_minutes: window.EshopServiceModel.serviceDuration(product) || null,
                // The builder's product page shows these; without them a product's options and
                // attributes were saved but never visible while designing the site.
                options: Array.isArray(product.options) ? product.options : [],
                option1_name: product.option1_name || "",
                option2_name: product.option2_name || "",
                variants: Array.isArray(product.variants) ? product.variants.slice(0, 100) : [],
                priced_attributes: Array.isArray(product.priced_attributes) ? product.priced_attributes : [],
                taxonomy_attributes: Array.isArray(product.taxonomy_attributes) ? product.taxonomy_attributes : [],
                category_names: categories
                  .filter(category => productCategoryIds.some(id => String(category.id) === String(id)))
                  .map(category => category.name)
              };
            });
          const draft = isDraftEditor ? StudioRenderers.websiteBuilderDraft() : null;
          litrusFrame.contentWindow?.postMessage({
            type: "craft-litrus-catalog",
            recipe: savedLitrusRecipe,
            catalog: {
              existing_html: validLitrusHtml(savedLitrusHtml) ? savedLitrusHtml : "",
              shop: {
                name: draft?.shop_name || (isDraftEditor ? "" : store.name),
                is_new_shop_draft: isDraftEditor,
                draft_id: draft?.draft_id || "",
                currency: store.currency || "KES",
                offer_type: window.EshopServiceModel.offerTypeForCatalogue(products, store.offer_type),
                service_days: Array.isArray(store.service_days) ? store.service_days : [1, 2, 3, 4, 5, 6],
                service_open_time: store.service_open_time || "09:00",
                service_close_time: store.service_close_time || "17:00",
                service_timezone: store.service_timezone || "Africa/Nairobi",
                service_buffer_minutes: Number(store.service_buffer_minutes) || 0,
                service_deposit_percent: Number(store.service_deposit_percent) || 0,
                payment_options: store.payment_options && typeof store.payment_options === "object" ? store.payment_options : null,
                service_capacity: Math.min(20, Math.max(1, Math.round(Number(store.service_capacity)) || 1)),
                service_cancel_cutoff_hours: store.service_cancel_cutoff_hours === undefined || store.service_cancel_cutoff_hours === "" || !Number.isFinite(Number(store.service_cancel_cutoff_hours)) ? 2 : Math.min(168, Math.max(0, Math.round(Number(store.service_cancel_cutoff_hours)))),
                service_max_reschedules: store.service_max_reschedules === undefined || store.service_max_reschedules === "" || !Number.isFinite(Number(store.service_max_reschedules)) ? 2 : Math.min(10, Math.max(0, Math.round(Number(store.service_max_reschedules)))),
                tagline: store.tagline || "",
                description: store.description || "",
                email: store.email || "",
                phone: store.phone || "",
                whatsapp: store.whatsapp || store.whatsapp_number || "",
                address: store.location_address || store.address || "",
                delivery_fee: store.delivery_fee || "",
                free_delivery_over: store.free_delivery_over || "",
                about: store.about || ""
              },
              categories: categories.map(category => ({ id: category.id, name: category.name })),
              products
            }
          }, window.location.origin);
        } catch (error) {
          console.error("Craft could not send the shop catalog to Litrus Mixer.", error);
          AppUtils.showToast(error.message || "Could not load the shop catalog into Litrus Mixer.", "danger");
        }
      };
      if (this.litrusMixerMessageHandler) {
        window.removeEventListener("message", this.litrusMixerMessageHandler);
      }
      const litrusHost = window.EshopLitrusHost;
      this.litrusMixerMessageHandler = litrusHost.createMessageHandler({
        // Pinned when the editor opens: the handler refuses messages once another shop is active.
        tenantId: openedTenantId,
        isDraftEditor,
        getActiveTenantId: () => this.getActiveTenant().id,
        getFrameWindow: () => litrusFrame.contentWindow,
        origin: window.location.origin,
        sendTheme: () => {
          const appTheme = getComputedStyle(document.documentElement);
          const themeValue = (property, fallback) => appTheme.getPropertyValue(property).trim() || fallback;
          litrusFrame.contentWindow?.postMessage({
            type: "craft-litrus-theme",
            theme: {
              background: themeValue("--surface-subtle", "#f5f5f5"),
              surface: themeValue("--surface", "#fff"),
              text: themeValue("--text-main", "#18181b"),
              muted: themeValue("--text-muted", "#66666b"),
              border: themeValue("--border", "#e2e2e5"),
              accent: themeValue("--accent", "#18181b"),
              accentText: themeValue("--accent-contrast", "#fff")
            }
          }, window.location.origin);
        },
        sendCatalog,
        saveDesign: saveLitrusDesign,
        searchImages: ({ tenantId, isDraft, images }) => this.cloudflareRequest(
          isDraft ? "/api/images/draft-search" : `/api/images/search?tenant=${encodeURIComponent(tenantId)}`,
          { method: "POST", body: JSON.stringify({ images }) },
          tenantId,
          isDraft
        ),
        reply: (frameWindow, message) => frameWindow.postMessage(message, window.location.origin),
        setMode: mode => {
          const devices = document.getElementById("builder-litrus-devices");
          const previewing = mode === "preview";
          const sections = document.getElementById("builder-litrus-sections");
          const advanced = document.getElementById("builder-litrus-advanced");
          if (sections) sections.hidden = previewing;
          if (advanced) advanced.hidden = previewing;
          if (devices) {
            devices.hidden = !previewing;
            if (devices.hidden) devices.open = false;
          }
        },
        toast: (message, type) => AppUtils.showToast(message, type),
        finishDraft: () => this.navigate("/account/web/site?new=1&finish=1&theme=litrus-mixer"),
        openPublish: () => this.openCloudflarePublishModal(true)
      });
      window.addEventListener("message", this.litrusMixerMessageHandler);
      releaseLitrusLeaveGuard.call(this);
      // Nothing is saved until the owner presses Save (or Publish, which saves first). The button shows
      // the editor's save state, and leaving the editor with unsaved changes asks first.
      const saveButton = document.getElementById("builder-litrus-save");
      let lastSaveError = "";
      const showSaveState = ({ state, error }) => {
        if (!saveButton) return;
        const [long, short] = SAVE_LABELS[state] || SAVE_LABELS.saved;
        saveButton.dataset.saveState = state in SAVE_LABELS ? state : "saved";
        saveButton.querySelector(".builder-litrus-save-long").textContent = long;
        saveButton.querySelector(".builder-litrus-save-short").textContent = short;
        saveButton.title = state === "error" ? `Could not save: ${error}` : state === "dirty" ? "Save your changes"
          : state === "saving" ? "Saving your changes" : "All changes are saved";
        saveButton.disabled = state === "saving";
        if (state === "error" && error && error !== lastSaveError) {
          AppUtils.showToast(`Could not save the website: ${error}`, "danger");
        }
        lastSaveError = state === "error" ? error : "";
      };
      const watchSaveState = () => {
        const frameWindow = litrusFrame.contentWindow;
        if (typeof frameWindow?.craftLitrusWatchSaveState !== "function") return;
        this.litrusStopWatchingSave?.();
        this.litrusStopWatchingSave = frameWindow.craftLitrusWatchSaveState(showSaveState);
      };
      litrusFrame.addEventListener("load", watchSaveState);
      watchSaveState();
      saveButton?.addEventListener("click", () => {
        void litrusFrame.contentWindow?.craftLitrusSave?.();
      });
      const hasUnsavedChanges = () => {
        try {
          return Boolean(litrusFrame.contentWindow?.craftLitrusHasUnsavedChanges?.());
        } catch (error) {
          console.error("Could not check the website editor for unsaved changes.", error);
          return false;
        }
      };
      // Any route change (Android back, a link, the Store button, even reopening this screen) rebuilds
      // the editor, so it is asked before every one.
      this.routeLeaveGuard = () => !litrusFrame.isConnected || !hasUnsavedChanges() ||
        window.confirm("Your website changes are not saved. Leave without saving?");
      this.litrusBeforeUnload = event => {
        if (!hasUnsavedChanges()) return;
        event.preventDefault();
        event.returnValue = "";
      };
      window.addEventListener("beforeunload", this.litrusBeforeUnload);
      const publishButton = document.getElementById("builder-litrus-publish");
      const sectionsButton = document.getElementById("builder-litrus-sections");
      const advancedButton = document.getElementById("builder-litrus-advanced");
      sectionsButton?.addEventListener("click", () => {
        litrusFrame.contentWindow?.craftLitrusShowSections?.();
      });
      advancedButton?.addEventListener("click", () => {
        litrusFrame.contentWindow?.craftLitrusSetMode?.("advanced");
      });
      publishButton?.addEventListener("click", () => {
        litrusFrame.contentDocument?.getElementById("craftPublish")?.click();
      });
      document.querySelectorAll("[data-litrus-preview-device]").forEach(button => {
        button.addEventListener("click", () => {
          const device = button.dataset.litrusPreviewDevice;
          const previewButton = litrusFrame.contentDocument?.querySelector(
            `[data-preview-device="${device}"]`
          );
          if (!previewButton) return;
          previewButton.click();
          document.querySelectorAll("[data-litrus-preview-device]").forEach(control => {
            control.setAttribute("aria-pressed", control === button ? "true" : "false");
          });
          const devices = document.getElementById("builder-litrus-devices");
          if (devices) devices.open = false;
        });
      });
    } else {
      releaseLitrusLeaveGuard.call(this);
      if (this.litrusMixerMessageHandler) {
        window.removeEventListener("message", this.litrusMixerMessageHandler);
        this.litrusMixerMessageHandler = null;
      }
    }
  }
}

const SAVE_LABELS = {
  saved: ["Saved", "Saved"],
  dirty: ["Unsaved changes", "Save"],
  saving: ["Saving…", "Saving…"],
  error: ["Save failed", "Retry"]
};

// Stops asking before leaving, once the builder screen is gone or about to be rebuilt.
function releaseLitrusLeaveGuard() {
  this.routeLeaveGuard = null;
  this.litrusStopWatchingSave?.();
  this.litrusStopWatchingSave = null;
  if (this.litrusBeforeUnload) window.removeEventListener("beforeunload", this.litrusBeforeUnload);
  this.litrusBeforeUnload = null;
}

// Screen entry points. The router (handleRoute in src/app/main.js) still draws this screen itself,
// through StudioRenderers.renderWebsiteEditor() and postRenderSetup(); mount()/unmount() draw and wire
// this one screen on their own.
export function mount(root, params = new URLSearchParams()) {
  root.innerHTML = StudioRenderers.renderWebsiteEditor(params.get("new") === "1");
  setupLitrusBuilder.call(AppController, params, "/account/web/site");
}

// Stops listening to the Litrus iframe, as postRenderSetup does when the screen has no builder frame.
export function unmount() {
  releaseLitrusLeaveGuard.call(AppController);
  if (AppController.litrusMixerMessageHandler) {
    window.removeEventListener("message", AppController.litrusMixerMessageHandler);
    AppController.litrusMixerMessageHandler = null;
  }
}
