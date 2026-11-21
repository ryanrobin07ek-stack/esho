// Publish-to-Craft modal.
// Moved verbatim out of src/app/main.js (the AppController object); main.js spreads these back in at the same spots.
import { AppUtils, INDEXEDDB_PRODUCT_MEDIA_PREFIX, LOCAL_PRODUCT_MEDIA_PREFIX, SQLiteEngine, StudioRenderers } from './main.js';
import { DOMAIN } from './domain.js';

export const publishModalController = {
  openCloudflarePublishModal(publishImmediately = false) {
    if (this.isWebsiteBuilderDraftTenant(this.getActiveTenant().id)) {
      AppUtils.showToast("A local website draft cannot be published. Finish setup to create its live shop.", "danger");
      return;
    }
    const modalContainer = document.getElementById("product-modal-container") ||
      document.getElementById("category-modal-container");
    if (!modalContainer) return;

    const tenant = this.getActiveTenant();
    const connection = this.cloudflareConnection(tenant.id);
    const token = connection.token;
    const apiUrl = new URL("/api/catalog", connection.origin);
    modalContainer.innerHTML = `
      <div class="modal-overlay active" id="cloudflare-publish-modal-overlay">
        <div class="modal-card" role="dialog" aria-modal="true" aria-labelledby="cloudflare-publish-title">
          <button class="modal-close-btn" id="cloudflare-publish-close" aria-label="Close">&times;</button>
          <h2 class="product-editor-title" id="cloudflare-publish-title">Deploy storefront</h2>
          <p style="color:var(--text-muted); margin:0 0 16px;">Publish <strong>${AppUtils.escapeHTML(tenant.name)}</strong>'s Products and Categories to <strong>${AppUtils.escapeHTML(tenant.hostname)}</strong>.</p>
          <form id="cloudflare-publish-form" style="display:flex; flex-direction:column; gap:14px;">
            <p style="color:var(--text-muted); font-size:0.8rem; margin:0;">Uploaded photos are compressed on this device, saved locally, then uploaded to R2 when you publish. Their R2 links are included in the live website catalog.</p>
            <div style="display:flex; gap:10px; margin-top:6px;">
              <button type="submit" class="btn-primary" id="cloudflare-publish-submit" style="flex:1;">Publish catalog</button>
              <button type="button" class="btn-secondary" id="cloudflare-publish-cancel">Cancel</button>
            </div>
          </form>
        </div>
      </div>
    `;

    const close = () => { modalContainer.innerHTML = ""; };
    document.getElementById("cloudflare-publish-close").onclick = close;
    document.getElementById("cloudflare-publish-cancel").onclick = close;
    document.getElementById("cloudflare-publish-modal-overlay").onclick = event => {
      if (event.target.id === "cloudflare-publish-modal-overlay") close();
    };

    const form = document.getElementById("cloudflare-publish-form");
    form.onsubmit = async event => {
      event.preventDefault();
      if (!token) {
        AppUtils.showToast("Sign in to the Craft account that owns this website before publishing.", "danger");
        return;
      }
      apiUrl.search = `?tenant=${encodeURIComponent(tenant.id)}`;
      apiUrl.hash = "";

      const products = SQLiteEngine.select("products", product => product.status !== "archived");
      const categories = SQLiteEngine.getCategories();
      const store = SQLiteEngine.getStore();
      const submitButton = document.getElementById("cloudflare-publish-submit");
      submitButton.disabled = true;
      submitButton.textContent = "Preparing images…";
      await new Promise(resolve => requestAnimationFrame(() => resolve()));
      try {
        const themeId = String(store.website_theme_id || "litrus-mixer");
        const litrusMixerTheme = themeId === "litrus-mixer";
        const themeClient = litrusMixerTheme ? null : await window.EshopThemeRuntime.loadThemeSkeleton();
        const selectedTheme = StudioRenderers.websiteThemes().find(theme => theme.id === themeId);
        const appEditableTheme = selectedTheme?.editor_mode === "app";
        const liquidHtmlTheme = selectedTheme?.editor_mode === "liquid-html";
        if (themeId !== "classic" && !appEditableTheme && !liquidHtmlTheme && !litrusMixerTheme &&
            !themeClient?.isSupportedThemeId(themeId)) {
          throw new Error(`Theme "${themeId}" cannot be published yet because its shop-data mapping is not verified.`);
        }
        await window.ShopSQLite.flush();
        const mapWithConcurrency = async (items, limit, worker) => {
          const results = new Array(items.length);
          let nextIndex = 0;
          let failed = false;
          let failure;
          const workerCount = Math.min(items.length, Math.max(1, limit));
          await Promise.all(Array.from({ length: workerCount }, async () => {
            while (!failed) {
              const index = nextIndex++;
              if (index >= items.length) return;
              try {
                results[index] = await worker(items[index], index);
              } catch (error) {
                failed = true;
                failure = error;
              }
            }
          }));
          if (failed) throw failure;
          return results;
        };
        const uploadedImages = new Map();
        const uploadedProductImages = new Map();
        let imageCount = 0;
        let uploadedR2ImageCount = 0;
        let reusedR2ImageCount = 0;
        let fallbackProductImageCount = 0;
        const recordImageStorage = result => {
          if (result.reused) reusedR2ImageCount += 1;
          else uploadedR2ImageCount += 1;
        };
        const publishImage = async image => {
          if (typeof image !== "string" || !/^data:image\//i.test(image)) return image || "";
          if (!uploadedImages.has(image)) {
            imageCount += 1;
            submitButton.textContent = `Uploading image ${imageCount}…`;
            const upload = this.uploadCatalogImage(image, apiUrl, tenant, token, recordImageStorage).catch(error => {
              uploadedImages.delete(image);
              throw error;
            });
            uploadedImages.set(image, upload);
          }
          return uploadedImages.get(image);
        };
        const publishProductImage = async image => {
          if (typeof image !== "string" || !image || /^data:image\//i.test(image)) {
            return publishImage(image);
          }
          if (image.startsWith(LOCAL_PRODUCT_MEDIA_PREFIX) ||
              image.startsWith(INDEXEDDB_PRODUCT_MEDIA_PREFIX)) {
            const blob = await AppUtils.readLocalProductMedia(image);
            const file = new File([blob], "product-media", { type: blob.type || "image/png" });
            const compressedImage = await AppUtils.compressImageFile(file, {
              maxDimension: 1800,
              maxBytes: 2_500_000,
              maxInputBytes: 40 * 1024 * 1024
            });
            return publishImage(compressedImage);
          }
          let imageUrl;
          try {
            imageUrl = new URL(image);
          } catch {
            return image;
          }
          if (!["http:", "https:"].includes(imageUrl.protocol)) return image;
          const ownHostname = String(tenant.hostname || "").toLowerCase();
          if (DOMAIN.isOwnHost(imageUrl.hostname) ||
              imageUrl.hostname === ownHostname) return image;
          if (!uploadedProductImages.has(image)) {
            imageCount += 1;
            submitButton.textContent = `Uploading image ${imageCount}…`;
            uploadedProductImages.set(image, (async () => {
              try {
                const uploadedUrl = await this.uploadCatalogImage(
                  image, apiUrl, tenant, token, recordImageStorage
                );
                return uploadedUrl;
              } catch (error) {
                fallbackProductImageCount += 1;
                console.warn("External product image could not be copied to R2; keeping its original URL.", error);
                return image;
              }
            })());
          }
          return uploadedProductImages.get(image);
        };
        const publishProducts = await mapWithConcurrency(products, 2, async product => {
          const { video_path: videoPath, ...publishableProduct } = product;
          let videoUrl = product.video_url || "";
          if (videoPath) {
            submitButton.textContent = "Uploading product video…";
            videoUrl = await this.uploadCatalogVideo(
              await AppUtils.readLocalProductMedia(videoPath),
              apiUrl,
              tenant,
              token
            );
          }
          return {
            ...publishableProduct,
            images: await mapWithConcurrency(
              Array.isArray(product.images) ? product.images : [],
              1,
              publishProductImage
            ),
            spin_frames: await mapWithConcurrency(
              Array.isArray(product.spin_frames) ? product.spin_frames : [],
              1,
              publishProductImage
            ),
            video_url: videoUrl
          };
        });
        const publishCategories = await mapWithConcurrency(categories, 2, async category => ({
          ...category,
          image: await publishImage(category.image || "")
        }));
        const publishStore = {
          ...store,
          hold_duration_hours: Number(StudioRenderers.getWorkspaceSetting("max_hold_hours", 24)),
          website_theme_id: themeId,
          element_edits: await mapWithConcurrency(
            Array.isArray(store.element_edits) ? store.element_edits : [],
            2,
            async edit => ({
              ...edit,
              src: edit.kind === "image" ? await publishImage(edit.src || "") : edit.src,
              originalSrc: edit.kind === "image" ? await publishImage(edit.originalSrc || "") : edit.originalSrc
            })
          )
        };
        submitButton.textContent = "Publishing catalog…";
        const response = await fetch(apiUrl.href, {
          method: "PUT",
          headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            products: publishProducts,
            categories: publishCategories,
            store: publishStore,
            pages: SQLiteEngine.getPages()
          })
        });
        const responseText = await response.text();
        let result;
        try {
          result = JSON.parse(responseText);
        } catch {
          throw new Error(responseText || `Cloudflare returned HTTP ${response.status}.`);
        }
        if (!response.ok) throw new Error(result.error || `Cloudflare returned HTTP ${response.status}.`);
        if (result.ok !== true) throw new Error("Cloudflare did not confirm the catalog publish.");

        if (themeId !== "classic") {
          if (!selectedTheme) throw new Error("The selected theme is no longer available.");
          submitButton.textContent = "Filling and publishing storefront…";
          const filledCatalog = {
            products: publishProducts,
            categories: publishCategories,
            store: publishStore,
            pages: SQLiteEngine.getPages()
          };
          let filledHtml;
          if (litrusMixerTheme) {
            filledHtml = StudioRenderers.getWorkspaceSetting(
              `liquid-html-theme-draft:litrus-mixer:tenant:${tenant.id}`, "");
            if (typeof filledHtml !== "string" ||
                !filledHtml.includes('<meta name="eshop-filled-theme" content="litrus-mixer">')) {
              throw new Error("Publish the Litrus Mixer design from Preview before publishing this shop.");
            }
          } else if (appEditableTheme) {
            const renderLiquidStorefront = window.EshopLiquidStorefront?.render;
            if (typeof renderLiquidStorefront !== "function") {
              throw new Error("My Own Theme's Liquid renderer is not ready.");
            }
            const viewerSettingKey = `liquid-theme-viewer:${tenant.id}:${themeId}`;
            let viewerSettings = StudioRenderers.getWorkspaceSetting(viewerSettingKey, null);
            if (typeof viewerSettings === "string") {
              try {
                viewerSettings = JSON.parse(viewerSettings);
              } catch (error) {
                throw new Error(`Saved My Own Theme settings are invalid: ${error.message}`);
              }
            }
            if (viewerSettings !== null &&
                (!viewerSettings || typeof viewerSettings !== "object" || Array.isArray(viewerSettings))) {
              throw new Error("Saved My Own Theme settings are invalid.");
            }
            const themeRoot = new URL("/liquid-themes/my-own-theme/", window.location.origin);
            filledHtml = await renderLiquidStorefront(filledCatalog, {
              baseUrl: `https://${tenant.hostname}/`,
              settings: viewerSettings,
              loadFile: async path => {
                const response = await fetch(new URL(path, themeRoot), { cache: "no-store" });
                if (!response.ok) throw new Error(`Could not load My Own Theme file ${path} (${response.status}).`);
                return response.text();
              }
            });
          } else if (liquidHtmlTheme) {
            const renderTheme = window.EshopLiquidHtmlThemeRenderer?.render;
            if (typeof renderTheme !== "function") {
              throw new Error(`${selectedTheme.name}'s Liquid renderer is not ready.`);
            }
            const savedThemeDesign = StudioRenderers.getWorkspaceSetting(
              `liquid-html-theme-draft:${themeId}`, "");
            const themeRoot = new URL(`/theme-packages/${themeId}/`, window.location.origin);
            filledHtml = await renderTheme(themeId, filledCatalog, {
              baseUrl: `https://${tenant.hostname}/`,
              loadFile: async path => {
                if (path === "index.html" && savedThemeDesign) return savedThemeDesign;
                const response = await fetch(new URL(path, themeRoot), { cache: "no-store" });
                if (!response.ok) {
                  throw new Error(`Could not load ${selectedTheme.name} file ${path} (${response.status}).`);
                }
                return response.text();
              }
            });
          } else {
            filledHtml = await themeClient.fillThemeForShop(themeId, filledCatalog, {
              baseHref: selectedTheme.preview_url,
              authorization: token,
              tenantId: tenant.id
            });
          }
          const themePublishUrl = new URL("/api/theme-publish", apiUrl.origin);
          themePublishUrl.search = `?tenant=${encodeURIComponent(tenant.id)}`;
          const themeResponse = await fetch(themePublishUrl.href, {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${token}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              theme_id: themeId,
              catalog_updated_at: result.updated_at,
              html: filledHtml
            })
          });
          const themeResponseText = await themeResponse.text();
          let themeResult;
          try {
            themeResult = JSON.parse(themeResponseText);
          } catch {
            throw new Error(themeResponseText || `Cloudflare returned HTTP ${themeResponse.status}.`);
          }
          if (!themeResponse.ok || themeResult.ok !== true) {
            throw new Error(themeResult.error || `Filled storefront publish failed (${themeResponse.status}).`);
          }
        }

        close();
        AppUtils.showToast(
          `Published ${result.product_count} products and ${result.category_count} categories; ` +
          `${uploadedR2ImageCount} new image${uploadedR2ImageCount === 1 ? "" : "s"} saved to R2` +
          (reusedR2ImageCount ? `, ${reusedR2ImageCount} reused` : "") +
          "." +
          (fallbackProductImageCount
            ? ` ${fallbackProductImageCount} external product image${fallbackProductImageCount === 1 ? "" : "s"} kept its original URL after upload failed.`
            : "")
        );
      } catch (error) {
        console.error("Cloudflare storefront publishing failed.", error);
        AppUtils.showToast(error.message || "Could not publish the catalog to Cloudflare.", "danger");
        submitButton.disabled = false;
        submitButton.textContent = "Publish catalog";
      }
    };
    if (publishImmediately) form.requestSubmit();
  },
};
