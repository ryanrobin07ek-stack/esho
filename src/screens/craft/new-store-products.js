// New-website wizard: the product list and product form (photos, video, spin and cut-out media).
// One block of AppController.bindWebsiteBuilderEvents, called with this = AppController.
// Moved verbatim from the app script (index.html, then src/app/main.js).
import { AppUtils, LOCAL_PRODUCT_MEDIA_PREFIX, StudioRenderers, WEBSITE_BUILDER_DRAFT_SYNC_KEY } from '../../app/main.js';
import { bindServiceFields } from './service-fields.js';

export function bindWizardProducts() {
  const productList = document.getElementById("website-wizard-product-list");
  const productSearch = document.getElementById("website-wizard-product-search");
  const productCount = document.getElementById("website-wizard-product-count");
  const productForm = document.getElementById("website-wizard-product-form");
  const cancelProductEdit = document.getElementById("website-wizard-cancel-product-edit");
  const createProductButton = document.getElementById("website-wizard-create-product");
  if (createProductButton && productForm) createProductButton.onclick = () => {
    productForm.hidden = !productForm.hidden;
    if (!productForm.hidden) productForm.querySelector('[name="name"]')?.focus();
  };
  if (productList && productSearch && productCount && productForm) {
    let editingProduct = null;
    const media = {
      mode: "image",
      imageFiles: [],
      videoBlob: null,
      videoPath: "",
      spinFrames: [],
      cutoutImages: []
    };
    const mediaStatus = productForm.querySelector("[data-wizard-media-status]");
    const mediaPreview = productForm.querySelector("[data-wizard-media-preview]");
    const serviceFields = bindServiceFields(productForm, productForm.querySelector("[data-wizard-product-stock]"));
    const imageInput = productForm.querySelector("[data-wizard-product-images]");
    const videoInput = productForm.querySelector("[data-wizard-video-file]");
    const nativeMedia = window.EshopNativeMedia;
    const isAndroidApp = nativeMedia?.Capacitor?.getPlatform?.() === "android";
    let previewUrls = [];

    const setMediaStatus = message => {
      if (mediaStatus) mediaStatus.textContent = message;
    };
    const clearMediaPreview = () => {
      previewUrls.forEach(url => URL.revokeObjectURL(url));
      previewUrls = [];
      mediaPreview?.replaceChildren();
      if (mediaPreview) mediaPreview.hidden = true;
    };
    const showMediaPreview = (files, video = false) => {
      clearMediaPreview();
      if (!mediaPreview || !files.length) return;
      files.slice(0, video ? 1 : 8).forEach(file => {
        const url = URL.createObjectURL(file);
        previewUrls.push(url);
        if (video) {
          const element = document.createElement("video");
          element.src = url;
          element.controls = true;
          element.playsInline = true;
          mediaPreview.append(element);
        } else {
          const element = document.createElement("img");
          element.src = url;
          element.alt = "Selected product photo";
          mediaPreview.append(element);
        }
      });
      mediaPreview.hidden = false;
    };
    const setMediaMode = (mode, reset = false) => {
      if (reset) {
        media.imageFiles = [];
        media.videoBlob = null;
        media.videoPath = "";
        media.spinFrames = [];
        media.cutoutImages = [];
        if (imageInput) imageInput.value = "";
        if (videoInput) videoInput.value = "";
        clearMediaPreview();
      }
      media.mode = mode;
      productForm.querySelectorAll("[data-wizard-media-mode]").forEach(button => {
        button.setAttribute("aria-pressed", String(button.dataset.wizardMediaMode === mode));
      });
      const photoLabel = productForm.querySelector("[data-wizard-photo-label]");
      const videoOptions = productForm.querySelector("[data-wizard-video-options]");
      if (photoLabel) photoLabel.hidden = mode !== "image";
      if (videoOptions) videoOptions.hidden = mode !== "video" && mode !== "spin";
      setMediaStatus(mode === "spin"
        ? isAndroidApp ? "Choose or record a product video. Craft will generate 24 rotatable frames on this Android device." : "360° processing requires the Android Craft app and Google Play services."
        : mode === "cutout"
          ? isAndroidApp ? "Choose product photos for on-device background removal." : "Cutout requires the Android Craft app and Google Play services."
          : mode === "video"
            ? "Choose or record a product video. MP4, WebM, and QuickTime are supported."
            : "Add up to 8 photos. Images are compressed before saving.");
    };
    const bindProductFields = product => {
      const taxonomyHost = productForm.querySelector("[data-wizard-product-taxonomy]");
      const variantsHost = productForm.querySelector("[data-wizard-product-variants]");
      if (!taxonomyHost || !variantsHost) throw new Error("The new-website product form is missing product details.");
      taxonomyHost.innerHTML = window.EshopProductTaxonomy.createProductTaxonomyFields({
        categoryId: product?.taxonomy_category_id || product?.taxonomyCategoryId || "",
        categoryName: product?.taxonomy_category_name || product?.taxonomyCategoryName || "",
        customCategory: product?.taxonomy_custom_category || product?.taxonomyCustomCategory || "",
        attributes: product?.taxonomy_attributes || product?.taxonomyAttributes || [],
        // One Category field: the shop's own categories, with Add to search the standard ones.
        storeCategories: StudioRenderers.websiteBuilderDraft().categories.map(category => ({ value: category.id, name: category.name })),
        storeCategoryFieldName: "category_id",
        storeCategoryValue: product?.category_id ?? ""
      });
      window.EshopProductTaxonomy.bindProductTaxonomyFields(taxonomyHost, undefined, {
        onCategoryCreate: name => {
          const draft = StudioRenderers.websiteBuilderDraft();
          let category = draft.categories.find(item => item.name.toLocaleLowerCase() === name.toLocaleLowerCase());
          if (!category) {
            category = { id: Date.now() + draft.categories.length, name };
            draft.categories.push(category);
            StudioRenderers.saveWebsiteBuilderDraft(draft);
          }
          return { value: category.id, name: category.name };
        }
      });
      variantsHost.innerHTML = window.EshopProductVariants.createProductVariantFields({
        // Without the saved options list, a third option and every per-value price reset to 0
        // the moment a product was reopened for editing.
        options: Array.isArray(product?.options) ? product.options : [],
        option1Name: product?.option1_name || "",
        option2Name: product?.option2_name || "",
        sizes: product?.sizes || [],
        colors: product?.colors || [],
        variants: product?.variants || []
      });
      window.EshopProductVariants.bindProductVariantFields(variantsHost.firstElementChild || variantsHost);
      // The new-store wizard is where most products are made, and it had no way to charge by
      // attribute; only the Craft store form and the till did.
      const pricingHost = productForm.querySelector("[data-wizard-product-attribute-pricing]");
      if (pricingHost) {
        pricingHost.innerHTML = window.EshopAttributePricing.createAttributePricingFields({
          pricedAttributes: product?.priced_attributes || []
        });
        window.EshopAttributePricing.bindAttributePricingFields(
          pricingHost.firstElementChild || pricingHost,
          () => window.EshopProductTaxonomy.readAvailableTaxonomyAttributes(productForm)
        );
      }
    };
    // Picking a category changes which attributes exist, so the pricing editor follows at once.
    productForm.addEventListener("product-taxonomy-change", () => {
      productForm.querySelector("[data-wizard-product-attribute-pricing] [data-attribute-pricing]")
        ?.refreshAttributePricing?.();
    });
    const renderDraftProducts = () => {
      const allProducts = StudioRenderers.websiteBuilderDraft().products;
      const query = productSearch.value.trim().toLocaleLowerCase();
      const matches = allProducts.filter(product =>
        `${product.name || ""} ${product.sku || ""} ${product.category_name || ""}`.toLocaleLowerCase().includes(query));
      const visible = matches.slice(0, 50);
      productCount.textContent = query
        ? `Showing ${visible.length} of ${matches.length} matches · ${allProducts.length} total`
        : `Showing ${visible.length} of ${allProducts.length} products`;
      productList.innerHTML = visible.map(product => {
        const image = Array.isArray(product.images)
          ? product.images.find(value => typeof value === "string" && /^(data:image\/|https?:\/\/|\/)/i.test(value))
          : "";
        return `<article class="website-wizard-product-row">
          ${image ? `<img class="website-wizard-product-thumb" src="${AppUtils.escapeHTML(image)}" alt="">` : `<span class="website-wizard-product-thumb" aria-hidden="true"></span>`}
          <span class="website-wizard-product-copy"><strong>${AppUtils.escapeHTML(product.name || "Unnamed product")}</strong><span>${AppUtils.escapeHTML(product.category_name || "Uncategorized")}</span></span>
          <strong>Sell ${AppUtils.escapeHTML(String(product.price ?? 0))}</strong>
          <span class="website-wizard-product-actions"><button class="btn-secondary website-wizard-compact-action" type="button" data-edit-wizard-product="${AppUtils.escapeHTML(String(product.id))}">Edit</button><button class="btn-secondary website-wizard-compact-action" type="button" data-remove-wizard-product="${AppUtils.escapeHTML(String(product.id))}" aria-label="Remove ${AppUtils.escapeHTML(product.name || "product")} from this website">Remove</button></span>
        </article>`;
      }).join("") || `<p class="studio-panel-note">${query ? "No products match your search." : "No products yet. Add from Store or create one below."}</p>`;
    };
    const selectNativeVideo = async record => {
      if (!isAndroidApp || !nativeMedia?.Camera) return null;
      const selected = record
        ? await nativeMedia.Camera.recordVideo({ isPersistent: true, includeMetadata: true })
        : (await nativeMedia.Camera.chooseFromGallery({
          mediaType: nativeMedia.MediaTypeSelection.Video,
          includeMetadata: true
        })).results?.[0];
      return selected || null;
    };
    const loadSelectedVideo = async (record = false) => {
      if (!isAndroidApp) {
        videoInput?.click();
        return;
      }
      try {
        setMediaStatus(record ? "Opening video camera…" : "Opening video gallery…");
        const selected = await selectNativeVideo(record);
        if (!selected?.uri) {
          setMediaStatus("No video was selected.");
          return;
        }
        const url = selected.webPath || nativeMedia.Capacitor.convertFileSrc(selected.uri);
        const response = await fetch(url);
        if (!response.ok) throw new Error("The selected video could not be opened.");
        media.videoBlob = await response.blob();
        media.videoPath = await AppUtils.storeLocalProductVideo(media.videoBlob);
        showMediaPreview([media.videoBlob], true);
        setMediaStatus("Video selected and saved locally.");
      } catch (error) {
        console.error("New-website product video could not be selected.", error);
        setMediaStatus(error instanceof Error ? error.message : "The product video could not be selected.");
      }
    };
    const processSpinVideo = async record => {
      if (!isAndroidApp || !nativeMedia?.ProductCutout || !nativeMedia?.Camera) {
        setMediaStatus("360° processing requires the Android Craft app and Google Play services.");
        return;
      }
      try {
        setMediaStatus(record ? "Opening video camera…" : "Opening video gallery…");
        const selected = await selectNativeVideo(record);
        if (!selected?.uri) {
          setMediaStatus("No video was selected.");
          return;
        }
        setMediaStatus("Generating 24 product spin frames…");
        const result = await nativeMedia.ProductCutout.processVideo({
          path: selected.uri,
          count: 24,
          width: 720
        });
        media.spinFrames = (result.frames || []).map(path =>
          String(path).startsWith(LOCAL_PRODUCT_MEDIA_PREFIX) ? String(path) : `${LOCAL_PRODUCT_MEDIA_PREFIX}${path}`);
        if (!media.spinFrames.length) throw new Error("No 360° frames were generated. Try a clearer product video.");
        clearMediaPreview();
        const image = document.createElement("img");
        image.src = nativeMedia.Capacitor.convertFileSrc(result.frames[0]);
        image.alt = "Generated 360-degree product preview";
        mediaPreview?.append(image);
        if (mediaPreview) mediaPreview.hidden = false;
        setMediaStatus(`${media.spinFrames.length} rotatable product frames are ready.`);
      } catch (error) {
        console.error("New-website 360 product media could not be processed.", error);
        setMediaStatus(error instanceof Error ? error.message : "360° product media could not be processed.");
      }
    };
    const processCutoutPhotos = async () => {
      if (!isAndroidApp || !nativeMedia?.ProductCutout || !nativeMedia?.Camera) {
        setMediaStatus("Cutout requires the Android Craft app and Google Play services.");
        return;
      }
      try {
        setMediaStatus("Choose up to 8 product photos…");
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
        setMediaStatus("Removing photo backgrounds…");
        const processed = await nativeMedia.ProductCutout.cutoutImages({ paths, width: 1200 });
        media.cutoutImages = (processed.images || []).map(path =>
          String(path).startsWith(LOCAL_PRODUCT_MEDIA_PREFIX) ? String(path) : `${LOCAL_PRODUCT_MEDIA_PREFIX}${path}`);
        if (!media.cutoutImages.length) throw new Error("No cutout photos were created.");
        clearMediaPreview();
        media.cutoutImages.forEach(path => {
          const image = document.createElement("img");
          image.src = nativeMedia.Capacitor.convertFileSrc(path.slice(LOCAL_PRODUCT_MEDIA_PREFIX.length));
          image.alt = "Product photo with background removed";
          mediaPreview?.append(image);
        });
        if (mediaPreview) mediaPreview.hidden = false;
        setMediaStatus(`${media.cutoutImages.length} cutout photos are ready.`);
      } catch (error) {
        console.error("New-website product cutout could not be processed.", error);
        setMediaStatus(error instanceof Error ? error.message : "Product photo background removal failed.");
      }
    };
    const resetProductForm = () => {
      editingProduct = null;
      productForm.reset();
      productForm.elements.id.value = "";
      productForm.querySelector('button[type="submit"]').textContent = "Add product";
      if (cancelProductEdit) cancelProductEdit.hidden = true;
      bindProductFields(null);
      serviceFields.apply();
      setMediaMode("image", true);
    };

    bindProductFields(null);
    setMediaMode("image");
    productSearch.oninput = renderDraftProducts;
    renderDraftProducts();
    productList.onclick = event => {
      const editButton = event.target.closest("[data-edit-wizard-product]");
      if (editButton) {
        editingProduct = StudioRenderers.websiteBuilderDraft().products.find(item =>
          String(item.id) === editButton.dataset.editWizardProduct);
        if (!editingProduct) return;
        productForm.hidden = false;
        productForm.elements.id.value = String(editingProduct.id);
        productForm.elements.name.value = editingProduct.name || "";
        productForm.elements.price.value = String(editingProduct.price ?? "");
        productForm.elements.cost_price.value = String(editingProduct.cost_price ?? "");
        productForm.elements.stock.value = String(editingProduct.stock ?? 0);
        productForm.elements.sku.value = editingProduct.sku || "";
        productForm.elements.description.value = editingProduct.description || "";
        productForm.elements.category_id.value = String(editingProduct.category_id ?? "");
        serviceFields.load(editingProduct);
        productForm.querySelector('button[type="submit"]').textContent = "Save product";
        if (cancelProductEdit) cancelProductEdit.hidden = false;
        bindProductFields(editingProduct);
        setMediaMode(editingProduct.media_type === "spin" ? "spin"
          : editingProduct.media_type === "video" ? "video"
            : editingProduct.media_type === "cutout" ? "cutout" : "image");
        media.videoPath = editingProduct.video_path || "";
        media.spinFrames = Array.isArray(editingProduct.spin_frames) ? editingProduct.spin_frames.slice() : [];
        media.cutoutImages = editingProduct.media_type === "cutout" && Array.isArray(editingProduct.images)
          ? editingProduct.images.slice()
          : [];
        productForm.scrollIntoView({ behavior: "smooth", block: "center" });
        productForm.elements.name.focus();
        return;
      }
      const button = event.target.closest("[data-remove-wizard-product]");
      if (!button) return;
      const draft = StudioRenderers.websiteBuilderDraft();
      draft.products = draft.products.filter(product =>
        String(product.id) !== button.dataset.removeWizardProduct);
      window.localStorage.removeItem(WEBSITE_BUILDER_DRAFT_SYNC_KEY);
      StudioRenderers.saveWebsiteBuilderDraft(draft);
      this.handleRoute(this.currentRoute());
    };
    productForm.querySelectorAll("[data-wizard-media-mode]").forEach(button => {
      button.addEventListener("click", () => {
        const mode = button.dataset.wizardMediaMode;
        setMediaMode(mode, mode !== media.mode);
        if (mode === "cutout") void processCutoutPhotos();
      });
    });
    imageInput?.addEventListener("change", () => {
      media.imageFiles = Array.from(imageInput.files || []);
      if (media.imageFiles.length > 8) {
        media.imageFiles = [];
        imageInput.value = "";
        clearMediaPreview();
        setMediaStatus("Choose up to 8 product photos.");
        return;
      }
      showMediaPreview(media.imageFiles);
      setMediaStatus(`${media.imageFiles.length} photo${media.imageFiles.length === 1 ? "" : "s"} selected.`);
    });
    videoInput?.addEventListener("change", () => {
      media.videoBlob = videoInput.files?.[0] || null;
      media.videoPath = "";
      if (media.videoBlob) {
        showMediaPreview([media.videoBlob], true);
        setMediaStatus(`${media.videoBlob.name} selected. It will be saved locally with this draft.`);
      }
    });
    productForm.querySelector("[data-wizard-video-pick]")?.addEventListener("click", () => {
      if (media.mode === "spin") void processSpinVideo(false);
      else void loadSelectedVideo(false);
    });
    productForm.querySelector("[data-wizard-video-record]")?.addEventListener("click", () => {
      if (media.mode === "spin") void processSpinVideo(true);
      else void loadSelectedVideo(true);
    });
    productForm.onsubmit = async event => {
      event.preventDefault();
      const submit = productForm.querySelector('button[type="submit"]');
      const draft = StudioRenderers.websiteBuilderDraft();
      const category = draft.categories.find(item => String(item.id) === String(productForm.elements.category_id.value));
      const name = productForm.elements.name.value.trim();
      const price = Number(productForm.elements.price.value);
      const costText = productForm.elements.cost_price.value.trim();
      const costPrice = costText ? Number(costText) : null;
      // A service is sold as time: it keeps a duration and counts no stock.
      const durationMinutes = serviceFields.read();
      const stock = durationMinutes ? 0 : Number(productForm.elements.stock.value);
      if (!category) {
        AppUtils.showToast("Add or choose a category for this product.", "danger");
        return;
      }
      if (!name || !Number.isFinite(price) || price < 0 ||
          (costPrice !== null && (!Number.isFinite(costPrice) || costPrice < 0)) ||
          !Number.isSafeInteger(stock) || stock < 0) {
        AppUtils.showToast("Enter a product name, valid selling and cost prices, and whole-number stock.", "danger");
        return;
      }
      if (media.mode === "video" && !media.videoPath && !media.videoBlob && !editingProduct?.video_path) {
        AppUtils.showToast("Choose a product video before saving.", "danger");
        return;
      }
      if (media.mode === "spin" && !media.spinFrames.length && !editingProduct?.spin_frames?.length) {
        AppUtils.showToast("Generate 360° frames before saving this product.", "danger");
        return;
      }
      if (media.mode === "cutout" && !media.cutoutImages.length &&
          !(editingProduct?.media_type === "cutout" && editingProduct.images?.length)) {
        AppUtils.showToast("Choose photos and remove their backgrounds before saving.", "danger");
        return;
      }
      if (submit) submit.disabled = true;
      try {
        const taxonomy = window.EshopProductTaxonomy.readProductTaxonomyFields(productForm);
        const variants = window.EshopProductVariants.readProductVariantFields(productForm);
        const imageFiles = media.mode === "image" ? media.imageFiles : [];
        if (imageFiles.length > 8 || imageFiles.some(file => !file.type.startsWith("image/") || file.size > 5 * 1024 * 1024)) {
          throw new Error("Choose up to 8 product photos, each smaller than 5 MB.");
        }
        const images = media.mode === "image"
          ? imageFiles.length
            ? await Promise.all(imageFiles.map(file => AppUtils.compressImageFile(file, { maxDimension: 1200, maxBytes: 250_000 })))
            : Array.isArray(editingProduct?.images) ? editingProduct.images.slice(0, 8) : []
          : media.mode === "spin"
            ? media.spinFrames.length ? [media.spinFrames[0]] : editingProduct.images.slice(0, 8)
            : media.mode === "cutout"
              ? media.cutoutImages.length ? media.cutoutImages.slice(0, 8) : editingProduct.images.slice(0, 8)
              : Array.isArray(editingProduct?.images) ? editingProduct.images.slice(0, 8) : [];
        const videoPath = media.mode === "video"
          ? media.videoPath || (media.videoBlob ? await AppUtils.storeLocalProductVideo(media.videoBlob) : editingProduct?.video_path || "")
          : "";
        const spinFrames = media.mode === "spin" ? media.spinFrames.slice() : [];
        const values = {
          name,
          sku: productForm.elements.sku.value.trim(),
          price,
          cost_price: costPrice ?? 0,
          category_id: category.id,
          category_name: category.name,
          description: productForm.elements.description.value.trim(),
          images,
          media_type: media.mode === "image" ? "image" : media.mode === "spin" ? "spin" : media.mode,
          spin_frames: spinFrames,
          video_url: "",
          video_path: videoPath,
          taxonomy_category_id: taxonomy.taxonomyCategoryId || null,
          taxonomy_category_name: taxonomy.taxonomyCategoryName || "",
          taxonomy_custom_category: taxonomy.taxonomyCustomCategory || null,
          taxonomy_attributes: taxonomy.taxonomyAttributes,
          priced_attributes: window.EshopAttributePricing.readAttributePricingFields(
            productForm.querySelector("[data-wizard-product-attribute-pricing] [data-attribute-pricing]")
          ),
          ...variants,
          stock: durationMinutes ? null : variants.stock ?? stock,
          duration_minutes: durationMinutes
        };
        if (editingProduct) {
          const target = draft.products.find(product => String(product.id) === String(editingProduct.id));
          if (!target) throw new Error("That product is no longer in this website draft.");
          Object.assign(target, values);
        } else {
          draft.products.push({ id: Date.now() + draft.products.length, ...values });
        }
        StudioRenderers.saveWebsiteBuilderDraft(draft);
        this.handleRoute(this.currentRoute());
      } catch (error) {
        console.error("New-website product could not be saved.", error);
        setMediaStatus(error instanceof Error ? error.message : "Product could not be saved.");
        AppUtils.showToast(error instanceof Error ? error.message : "Product could not be saved.", "danger");
      } finally {
        if (submit) submit.disabled = false;
      }
    };
    if (cancelProductEdit) cancelProductEdit.onclick = resetProductForm;
  }
}
