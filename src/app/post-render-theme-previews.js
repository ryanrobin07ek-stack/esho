// Hosted theme previews (lazy-loaded storefront theme frames).
// Moved verbatim out of AppController.postRenderSetup in src/app/main.js; it is called there with this = AppController.
import { AppController, StudioRenderers } from './main.js';

export function bindThemePreviews(draftEditor) {
  const loadHostedThemePreview = async (frame, theme, catalog, assetUrl = theme.preview_url) => {
    const themeUrl = new URL(assetUrl || "", window.location.origin);
    if (theme.studio_url || theme.editor_mode === "app" ||
        theme.editor_mode === "liquid-html") {
      const expectedAssetUrls = theme.id === "craft-main-storefront"
        ? [new URL("/liquid-themes/my-own-theme/studio.html", window.location.origin).href]
        : [new URL(`/theme-packages/${theme.id}/index.html`, window.location.origin).href];
      if (theme.studio_url && theme.id !== "craft-main-storefront") expectedAssetUrls.push(
        new URL(`/theme-packages/${theme.id}/studio.html`, window.location.origin).href);
      if (!expectedAssetUrls.includes(themeUrl.href)) {
        throw new Error("The selected local theme asset URL is invalid.");
      }
      const response = await fetch(themeUrl.href, { cache: "no-store" });
      if (!response.ok) throw new Error(`Could not load the selected theme preview (${response.status}).`);
      let source = await response.text();
      const isThemeStudioAsset = Boolean(theme.studio_url &&
        themeUrl.href === new URL(theme.studio_url, window.location.origin).href);
      if (theme.editor_mode === "liquid-html" && !isThemeStudioAsset) {
        const renderTheme = window.EshopLiquidHtmlThemeRenderer?.render;
        if (typeof renderTheme !== "function") {
          throw new Error(`${theme.name}'s Liquid renderer is not ready.`);
        }
        const themeRoot = new URL(".", themeUrl).href;
        return renderTheme(theme.id, catalog, {
          baseUrl: themeRoot,
          loadFile: async path => {
            if (path === "index.html") return source;
            const response = await fetch(new URL(path, themeRoot), { cache: "no-store" });
            if (!response.ok) throw new Error(`Could not load ${theme.name} file ${path} (${response.status}).`);
            return response.text();
          }
        });
      }
      if (isThemeStudioAsset && theme.id === "craft-main-storefront") {
        const routeParams = new URLSearchParams(AppController.currentRoute().split("?")[1] || "");
        const viewerTenantId = AppController.getActiveTenant().id;
        const viewerSettingKey = `liquid-theme-viewer:${viewerTenantId}:${routeParams.get("new") === "1" ? "draft:" : ""}${theme.id}`;
        let savedSettings = StudioRenderers.getWorkspaceSetting(viewerSettingKey, null);
        if (typeof savedSettings === "string") {
          try {
            savedSettings = JSON.parse(savedSettings);
          } catch (error) {
            throw new Error(`Saved My Own Theme settings are invalid: ${error.message}`);
          }
        }
        if (savedSettings !== null &&
            (!savedSettings || typeof savedSettings !== "object" || Array.isArray(savedSettings))) {
          throw new Error("Saved My Own Theme settings are invalid.");
        }
        const config = JSON.stringify({
          embedded: true,
          key: viewerSettingKey,
          settings: savedSettings,
          catalog: {
            store: {
              name: String(catalog.store?.name || catalog.store?.title || ""),
              title: String(catalog.store?.title || ""),
              tagline: String(catalog.store?.tagline || ""),
              description: String(catalog.store?.description || ""),
              currency: String(catalog.store?.currency || "KES")
            },
            products: (Array.isArray(catalog.products) ? catalog.products : [])
              .filter(product => product && product.status !== "archived")
              .map(product => ({
                name: String(product.name || ""),
                description: String(product.description || ""),
                price: Number(product.price ?? product.selling_price ?? product.sellingPrice ?? product.price_cents) || 0,
                images: Array.isArray(product.images) ? product.images : [],
                image: product.image || product.imageUri || product.image_uri || ""
              })),
            categories: (Array.isArray(catalog.categories) ? catalog.categories : [])
              .filter(category => category && category.status !== "archived" && category.published !== false)
              .map(category => ({
                name: String(category.name || ""),
                description: String(category.description || ""),
                image: category.image || category.imageUri || category.image_uri || ""
              }))
          }
        }).replace(/</g, "\\u003c");
        const baseHref = new URL(".", themeUrl).href.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
        const bootstrap = `<base href="${baseHref}"><script>window.EshopThemeViewerConfig=${config};document.documentElement.dataset.eshopEmbedded="true";<\/script>`;
        return source.replace(/<head\b[^>]*>/i, match => `${match}${bootstrap}`);
      }
      if (theme.editor_mode === "app" && !isThemeStudioAsset) {
        const { fillEditableStorefrontTheme, craftStudioAppearance } =
          await window.EshopThemeRuntime.loadEditableStorefrontTheme();
        let savedStudio = null;
        if (theme.id === "craft-main-storefront") {
          try {
            const raw = window.localStorage.getItem("craft.main-storefront.studio.v1");
            savedStudio = raw ? JSON.parse(raw) : null;
          } catch (error) {
            console.warn("Could not read saved Craft Studio theme settings.", error);
          }
        }
        const studioData = this.getActiveTenant().id === "main" && !draftEditor
          ? savedStudio
          : craftStudioAppearance(savedStudio);
        return fillEditableStorefrontTheme(
          source,
          catalog,
          themeUrl.href,
          studioData
        );
      }
      const scriptTagName = "scr" + "ipt";
      const configPattern = new RegExp(`(<${scriptTagName}\\b[^>]*\\bid=["']ff-config["'][^>]*>)([\\s\\S]*?)(<\\/${scriptTagName}>)`, "i");
      const configScript = source.match(configPattern);
      const siteDataPattern = new RegExp(`(<${scriptTagName}\\b[^>]*\\bid=["']ff-site-data["'][^>]*>)([\\s\\S]*?)(<\\/${scriptTagName}>)`, "i");
      const siteDataScript = source.match(siteDataPattern);
      if (!configScript || !siteDataScript) {
        const embeddedDataPattern = new RegExp(`(<${scriptTagName}\\b[^>]*\\bid=["'](?:data|embeddedData)["'][^>]*>)([\\s\\S]*?)(<\\/${scriptTagName}>)`, "i");
        const embeddedDataScript = source.match(embeddedDataPattern);
        if (!embeddedDataScript) throw new Error(`The ${theme.name} theme has no supported catalog data.`);
        const themeData = JSON.parse(embeddedDataScript[2]);
        const sourceCategories = Array.isArray(catalog.categories) ? catalog.categories : [];
        const safeId = (value, fallback) => String(value ?? fallback)
          .trim().replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "") || String(fallback);
        const slugify = value => String(value || "").trim().toLocaleLowerCase()
          .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
          .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "item";
        const uniqueSlug = (value, id, used) => {
          const base = slugify(value);
          const slug = used.has(base) ? `${base}-${slugify(id)}` : base;
          used.add(slug);
          return slug;
        };
        const usedCategorySlugs = new Set();
        const previewCategories = sourceCategories.map((category, index) => {
          const id = `eshop-category-${safeId(category.id, index + 1)}`;
          return {
            id,
            slug: uniqueSlug(category.slug || category.name, id, usedCategorySlugs),
            name: String(category.name || "Category"),
            description: String(category.description || ""),
            parentId: category.parent_id == null && category.parentId == null
              ? null
              : `eshop-category-${safeId(category.parent_id ?? category.parentId, "")}`,
            hue: Number(category.hue) || 200,
            media: String(category.image || category.media || ""),
            published: category.status !== "archived" && category.published !== false && category.published !== 0,
            position: Number(category.position) || index
          };
        });
        const categoryBySourceId = new Map(sourceCategories.map((category, index) =>
          [String(category.id), previewCategories[index]]));
        const categoryByName = new Map(previewCategories.map(category =>
          [category.name.trim().toLocaleLowerCase(), category]));
        const usedProductSlugs = new Set();
        const products = (Array.isArray(catalog.products) ? catalog.products : [])
          .filter(product => product && product.status !== "archived")
          .map((product, index) => {
            const id = `eshop-product-${safeId(product.id, index + 1)}`;
            const category = categoryBySourceId.get(String(product.category_id ?? product.categoryId ?? ""))
              || categoryByName.get(String(product.category_name || product.categoryName || product.category || "")
                .trim().toLocaleLowerCase());
            const rawImage = product.images?.[0] || product.imageUri || product.image_uri || product.image || "";
            const image = typeof rawImage === "string" ? rawImage : rawImage?.url || rawImage?.src || "";
            const template = themeData.products?.[index] || {};
            return {
              ...template,
              id,
              slug: uniqueSlug(product.slug || product.name, id, usedProductSlugs),
              name: String(product.name || "Product"),
              description: String(product.description || ""),
              price: Number(product.price ?? product.selling_price ?? product.sellingPrice ?? product.price_cents) || 0,
              salePrice: Number(product.sale_price ?? product.salePrice) || null,
              stock: Math.max(0, Number(product.stock ?? product.stock_count) || 0),
              badge: String(product.badge || ""),
              featured: Boolean(product.featured ?? product.is_featured),
              published: product.status !== "archived" && product.published !== false && product.published !== 0,
              position: Number(product.position) || index,
              categoryIds: category ? [category.id] : [],
              hue: Number(product.hue ?? template.hue) || 200,
              media: String(image),
              dietary: Array.isArray(product.dietary) ? product.dietary : [],
              portion: String(product.portion || ""),
              colors: Array.isArray(product.colors) ? product.colors : [],
              sizes: Array.isArray(product.sizes) ? product.sizes : []
            };
          });
        const mergedThemeData = { ...themeData, categories: previewCategories, products };
        const safeThemeData = JSON.stringify(mergedThemeData).replace(/</g, "\\u003c");
        source = source.replace(embeddedDataScript[0],
          `${embeddedDataScript[1]}${safeThemeData}${embeddedDataScript[3]}`);
        const baseHref = new URL(".", themeUrl).href.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
        return source.replace(/<head\b[^>]*>/i, match =>
          `${match}<base href="${baseHref}">`);
      }
      const storageConfig = JSON.parse(configScript[2]).storage || {};
      const baseSiteData = JSON.parse(siteDataScript[2]);
      let siteData = baseSiteData;
      if (storageConfig.siteKey) {
        const savedThemeSite = window.localStorage.getItem(storageConfig.siteKey);
        if (savedThemeSite) {
          const parsedThemeSite = JSON.parse(savedThemeSite);
          if (!parsedThemeSite || typeof parsedThemeSite !== "object" || Array.isArray(parsedThemeSite)) {
            throw new Error(`The saved ${theme.name} Studio settings are invalid.`);
          }
          siteData = { ...baseSiteData, ...parsedThemeSite };
        }
      }
      const themeStorageKeys = [storageConfig.siteKey, storageConfig.revisionKey]
        .filter(key => typeof key === "string" && key);
      if (theme.editor_mode === "app" && theme.id === "craft-main-storefront") {
        themeStorageKeys.push(
          "craft.main-storefront.studio.v1",
          "storefront.cart",
          "storefront.wishlist"
        );
      }
      const products = Array.isArray(catalog.products) ? catalog.products : [];
      const savedTemplates = Array.isArray(siteData.products) ? siteData.products : [];
      const templates = savedTemplates.length
        ? savedTemplates
        : (Array.isArray(baseSiteData.products) ? baseSiteData.products : []);
      if (products.length && !templates.length) throw new Error(`The ${theme.name} storefront has no product template.`);
      const previewIds = products.map((product, index) =>
        templates[index]?.id ?? `eshop-preview-${index + 1}`);
      const toSlug = value => String(value || "").trim().toLocaleLowerCase()
        .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "product";
      const previewCategories = Array.isArray(catalog.categories) ? catalog.categories : [];
      siteData.categories = previewCategories.map((category, index) => ({
        id: `eshop-category-${index + 1}`,
        name: String(category.name || "Category"),
        slug: toSlug(category.name),
        description: ""
      }));
      const previewCategoryById = new Map(previewCategories.map((category, index) =>
        [String(category.id), siteData.categories[index]]));
      siteData.products = products.map((product, index) => {
        const template = templates[index % templates.length];
        const productCategoryId = product.category_id ?? product.categoryId;
        const productCategoryName = String(
          product.category_name || product.categoryName || product.category || ""
        ).toLocaleLowerCase();
        const categoryIndex = previewCategoryById.has(String(productCategoryId))
          ? previewCategories.findIndex(item => String(item.id) === String(productCategoryId))
          : previewCategories.findIndex(item => String(item.name).toLocaleLowerCase() === productCategoryName);
        const category = categoryIndex >= 0 ? siteData.categories[categoryIndex] : null;
        const rawImage = product.images?.[0] || product.imageUri || product.image_uri || product.image || "";
        const image = typeof rawImage === "string" ? rawImage : rawImage?.url || rawImage?.src || "";
        return {
          ...template,
          id: previewIds[index],
          slug: toSlug(product.name),
          name: String(product.name || "Product"),
          brand: String(product.brand || ""),
          price: Number(product.price ?? product.price_cents ?? template.price) || 0,
          comparePrice: null,
          description: String(product.description || ""),
          category: category ? toSlug(category.name) : "",
          subcategories: [],
          rating: 0,
          reviewCount: 0,
          badge: "",
          attributes: {},
          colors: [],
          sizes: [],
          reviews: [],
          specs: [],
          materials: [],
          technology: [],
          careGuide: "",
          fitAdvice: "",
          unit: "",
          coveragePerUnit: null,
          weightKg: null,
          leadTimeDays: null,
          assemblyRequired: false,
          assemblyFee: null,
          bulkTiers: [],
          warranty: "",
          whatsInTheBox: [],
          highlights: [],
          stock: Math.max(0, Number(product.stock) || 0),
          image,
          gallery: image ? [image] : []
        };
      });
      const originalIds = new Map(templates.map((product, index) =>
        [String(product.id), previewIds[index % previewIds.length] || ""]));
      const rewriteProductRefs = (value, key = "") => {
        if (Array.isArray(value)) {
          if (/productids$/i.test(key)) return [...previewIds];
          return value.map(item => rewriteProductRefs(item));
        }
        if (value && typeof value === "object") {
          return Object.fromEntries(Object.entries(value).map(([childKey, child]) =>
            [childKey, rewriteProductRefs(child, childKey)]));
        }
        if (typeof value === "string" && /productid$/i.test(key)) {
          return originalIds.get(value) ?? previewIds[0] ?? "";
        }
        return value;
      };
      siteData.sections = rewriteProductRefs(siteData.sections);
      source = source.replace(siteDataScript[0],
        `${siteDataScript[1]}${JSON.stringify(siteData)}${siteDataScript[3]}`);
      const baseHref = new URL(".", themeUrl).href.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
      const base = `<base href="${baseHref}">`;
      const studioStorageRead = isThemeStudioAsset ? "get.call(this,key)" : "null";
      const isolatedStorage = theme.studio_url
        ? "<scr" + "ipt>(()=>{const p=Storage.prototype;const get=p.getItem;const set=p.setItem;const remove=p.removeItem;const allowed=new Set(" + JSON.stringify(themeStorageKeys) + ");const siteKey=" + JSON.stringify(storageConfig.siteKey || "") + ";window.addEventListener('storage',event=>{if(event.key===siteKey)event.stopImmediatePropagation()},true);p.getItem=function(key){if(String(key)===siteKey)return " + studioStorageRead + ";return allowed.has(String(key))?get.call(this,key):null};p.setItem=function(key,value){if(allowed.has(String(key)))set.call(this,key,value)};p.removeItem=function(key){if(allowed.has(String(key)))remove.call(this,key)};p.clear=()=>{}})();<\/scr" + "ipt>"
        : "<scr" + "ipt>(()=>{const storage=Storage.prototype;storage.getItem=()=>null;storage.setItem=()=>{};storage.removeItem=()=>{};storage.clear=()=>{}})();<\/scr" + "ipt>";
      const srcdocUrlShim = "<scr" + "ipt>(()=>{const NativeURL=window.URL;window.URL=class extends NativeURL{constructor(input,base){super(input,base===\"null\"?document.baseURI:base)}}})();<\/scr" + "ipt>";
      return /<head\b[^>]*>/i.test(source)
        ? source.replace(/<head\b[^>]*>/i, match => `${match}${base}${isolatedStorage}${srcdocUrlShim}`)
        : `${base}${isolatedStorage}${srcdocUrlShim}${source}`;
    }
    if (themeUrl.origin !== "https://eshop-storefront.ryanrobin07-ek.workers.dev" ||
        themeUrl.pathname !== `/themes/${theme.id}/index.html` ||
        !/^[a-z0-9][a-z0-9-]{0,63}$/.test(theme.id)) {
      throw new Error("The selected theme URL is invalid.");
    }
    const { fillThemeForShop } = await window.EshopThemeRuntime.loadThemeSkeleton();
    const filledHtml = await fillThemeForShop(theme.id, catalog, {
      baseHref: themeUrl.href
    });
    const apiGuard = `<script>(()=>{const blocked=path=>/^\\/api\\//.test(path);const deny=()=>Promise.reject(new Error("Live website APIs are disabled in editor preview."));const originalFetch=window.fetch.bind(window);window.fetch=(input,init)=>{const url=new URL(typeof input==="string"?input:input.url,document.baseURI);return blocked(url.pathname)?deny():originalFetch(input,init)};const originalOpen=XMLHttpRequest.prototype.open;XMLHttpRequest.prototype.open=function(method,url,...args){if(blocked(new URL(url,document.baseURI).pathname))throw new DOMException("Live website APIs are disabled in editor preview.","AbortError");return originalOpen.call(this,method,url,...args)};const beacon=navigator.sendBeacon?.bind(navigator);if(beacon)navigator.sendBeacon=(url,...args)=>blocked(new URL(url,document.baseURI).pathname)?false:beacon(url,...args)})();<\/script>`;
    return filledHtml.replace(/<head\b[^>]*>/i, match => `${match}${apiGuard}`);
  };
  const themePreviewFrames = [...document.querySelectorAll("[data-theme-storefront-preview]")]
    .filter(frame => frame.dataset.themePreviewDirect !== "1");
  const themePreviewQueue = [];
  const routedHostedPreviewDocuments = new WeakSet();
  let activeThemePreviewLoads = 0;
  const pumpThemePreviewQueue = () => {
    while (activeThemePreviewLoads < 2 && themePreviewQueue.length) {
      const frame = themePreviewQueue.shift();
      if (!frame.isConnected) continue;
      activeThemePreviewLoads += 1;
      void (async () => {
        try {
          const theme = StudioRenderers.websiteThemes().find(item =>
            item.id === frame.dataset.themeStorefrontPreview &&
            (item.preview_url === frame.dataset.themePreviewRemote ||
              item.studio_url === frame.dataset.themePreviewRemote));
          if (!theme) throw new Error("The selected theme preview is unavailable.");
          const draft = StudioRenderers.websiteBuilderDraft();
          const html = await loadHostedThemePreview(frame, theme, {
            products: draft.products,
            categories: draft.categories,
            store: { name: "Your new website", title: "Your new website", currency: "KES" },
            pages: []
          }, frame.dataset.themePreviewRemote);
          if (!frame.isConnected) return;
          frame.dataset.themePreviewLoaded = "1";
          frame.srcdoc = html;
        } catch (error) {
          console.error("Could not load the hosted theme preview.", error);
          const placeholder = frame.parentElement?.querySelector("[data-theme-preview-placeholder]");
          if (placeholder) placeholder.textContent = error.message || "Filled theme preview unavailable.";
        } finally {
          activeThemePreviewLoads -= 1;
          pumpThemePreviewQueue();
        }
      })();
    }
  };
  themePreviewFrames.forEach(frame => {
    frame.addEventListener("load", () => {
      if (frame.dataset.themePreviewLoaded !== "1" ||
          frame.contentDocument?.URL !== "about:srcdoc") return;
      const previewDocument = frame.contentDocument;
      const previewWindow = frame.contentWindow;
      if (previewDocument && previewWindow && !routedHostedPreviewDocuments.has(previewDocument)) {
        routedHostedPreviewDocuments.add(previewDocument);
        previewDocument.addEventListener("click", event => {
          const target = event.target?.closest?.("a[href]");
          const href = target?.getAttribute("href")?.trim();
          if (!href?.startsWith("#/")) return;
          event.preventDefault();
          event.stopImmediatePropagation();
          previewWindow.location.hash = href;
        }, true);
      }
      frame.style.visibility = "visible";
      const placeholder = frame.parentElement?.querySelector("[data-theme-preview-placeholder]");
      if (placeholder) placeholder.hidden = true;
    });
  });
  if (themePreviewFrames.length && typeof IntersectionObserver === "function") {
    const themePreviewObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        const frame = entry.target;
        if (!entry.isIntersecting || frame.dataset.themePreviewQueued === "1") return;
        themePreviewObserver.unobserve(frame);
        frame.dataset.themePreviewQueued = "1";
        themePreviewQueue.push(frame);
      });
      pumpThemePreviewQueue();
    }, { rootMargin: "300px 0px" });
    themePreviewFrames.forEach(frame => {
      if (frame.dataset.themePreviewRemote) themePreviewObserver.observe(frame);
      else {
        const placeholder = frame.parentElement?.querySelector("[data-theme-preview-placeholder]");
        if (placeholder) placeholder.textContent = "Theme preview unavailable.";
      }
    });
  } else {
    themePreviewFrames.forEach(frame => {
      const placeholder = frame.parentElement?.querySelector("[data-theme-preview-placeholder]");
      if (placeholder) placeholder.textContent = "Theme preview is unavailable in this browser.";
    });
  }
}
