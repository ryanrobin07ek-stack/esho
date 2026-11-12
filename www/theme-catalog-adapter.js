(() => {
  const initialScript = document.currentScript;
  const catalog = window.__ESHOP_THEME_CATALOG__;
  if (!catalog || !Array.isArray(catalog.products) || !Array.isArray(catalog.categories)) {
    window.addEventListener("eshop:catalog-ready", () => {
      if (window.__ESHOP_THEME_CATALOG_RESTARTED__) return;
      window.__ESHOP_THEME_CATALOG_RESTARTED__ = true;
      if (initialScript?.src) {
        const retryScript = initialScript.cloneNode(false);
        document.head.append(retryScript);
      }
    }, { once: true });
    return;
  }

  const products = catalog.products.filter(product => product && product.status !== "archived");
  const categories = catalog.categories;
  const categoryById = new Map(categories.map(category => [String(category.id), category]));
  const normalize = value => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const slug = value => normalize(value).replace(/\s+/g, "-");
  const commerceCardClasses = [
    "product-card", "product-item", "product-tile", "pcard", "service-card", "menu-item-card",
    "dish-card", "quick-item-card", "safari-card", "property-card", "experience-card", "dest-card",
    "location-card", "rail-card"
  ];
  const cardQuery = "[data-product-id], [class]";
  const categoryOf = product => categoryById.get(String(product.category_id ?? product.categoryId))
    || categories.find(category => normalize(category.name) === normalize(product.categoryName || product.category_name))
    || null;
  const imageOf = product => product.images?.[0] || product.image || product.image_uri || product.imageUrl || "";
  const priceOf = product => Number(product.price ?? product.selling_price ?? product.sellingPrice) || 0;
  const currency = catalog.store?.currency || "KES";
  const store = catalog.store || {};
  const wishlistStorageKey = "storefront.wishlist";
  const holdStorageKey = `eshop-holds:${location.host}`;
  const socialLinks = [
    ["Facebook", store.facebook_url],
    ["Instagram", store.instagram_url],
    ["TikTok", store.tiktok_url],
    ["YouTube", store.youtube_url],
    ["X", store.x_url]
  ].filter(([, href]) => typeof href === "string" && /^https:\/\//i.test(href));
  const contactIcons = {
    WhatsApp: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.5 11.8a8.5 8.5 0 0 1-12.6 7.4L3 20.5l1.4-4.7a8.5 8.5 0 1 1 16.1-4Zm-8.5-7a7 7 0 0 0-6 10.6l.3.5-.8 2.5 2.6-.8.5.3a7 7 0 1 0 3.4-13.1Zm3.9 10.1c-.2-.1-1.2-.6-1.4-.6s-.3-.1-.5.1-.5.6-.7.7-.2.2-.5.1a5.7 5.7 0 0 1-1.7-1.1 6.3 6.3 0 0 1-1.2-1.5c-.1-.2 0-.3.1-.4l.3-.4.2-.3v-.3l-.6-1.4c-.2-.4-.4-.3-.5-.3h-.4c-.1 0-.3 0-.5.2s-.7.7-.7 1.7.7 2 .8 2.2a8 8 0 0 0 3.1 2.8c.4.2.8.3 1 .4.4.1.8.1 1.1.1.4-.1 1.2-.5 1.4-1s.2-.9.2-1-.1-.2-.3-.3Z"/></svg>',
    Chat: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3a9 9 0 0 0-7.6 13.8L3 21l4.4-1.4A9 9 0 1 0 12 3Zm0 16a7 7 0 0 1-3.6-1l-.5-.3-2.3.7.7-2.3-.3-.5A7 7 0 1 1 12 19Zm-3.5-7h7a1 1 0 0 0 0-2h-7a1 1 0 0 0 0 2Zm0 3h4a1 1 0 0 0 0-2h-4a1 1 0 0 0 0 2Z"/></svg>',
    Facebook: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13.5 21v-8h2.7l.4-3h-3.1V8.1c0-.9.3-1.5 1.6-1.5h1.6V3.9c-.3 0-1.3-.1-2.4-.1-2.4 0-4.1 1.5-4.1 4.2V10H7.5v3h2.7v8h3.3Z"/></svg>',
    Instagram: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="3.5" width="17" height="17" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.8" r=".8" fill="currentColor" stroke="none"/></svg>',
    TikTok: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 3v11.1a4 4 0 1 1-3.5-4V6.8a7 7 0 1 0 6.5 7V9.5a8 8 0 0 0 4 1.1V7.5A5.5 5.5 0 0 1 14 3Z"/></svg>',
    YouTube: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 7.2a2.5 2.5 0 0 0-1.8-1.8C17.6 5 12 5 12 5s-5.6 0-7.2.4A2.5 2.5 0 0 0 3 7.2 26 26 0 0 0 2.6 12 26 26 0 0 0 3 16.8a2.5 2.5 0 0 0 1.8 1.8C6.4 19 12 19 12 19s5.6 0 7.2-.4a2.5 2.5 0 0 0 1.8-1.8 26 26 0 0 0 .4-4.8 26 26 0 0 0-.4-4.8ZM10 15.2V8.8l5.5 3.2-5.5 3.2Z"/></svg>',
    X: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18.9 3h2.8l-6.2 7.1L22.8 21h-5.7l-4.5-6-5.2 6H4.6l6.6-7.6L4.2 3h5.8l4 5.5L18.9 3Zm-1 16h1.6L9.1 4.9H7.4L17.9 19Z"/></svg>',
    Location: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/></svg>'
  };
  const iconLink = (label, href, floating = false) => {
    if (!href || !/^https:\/\//i.test(href)) return null;
    const key = label === "Chat with us" ? "Chat" : label;
    const icon = contactIcons[key];
    if (!icon) return null;
    const link = document.createElement("a");
    link.href = href;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.setAttribute("aria-label", label);
    link.title = label;
    link.dataset.eshopContactIcon = key.toLowerCase();
    if (floating) link.dataset.eshopFloatingContact = "";
    link.innerHTML = icon;
    link.style.cssText = `width:${floating ? 52 : 42}px;height:${floating ? 52 : 42}px;display:grid;place-items:center;flex:none;border-radius:50%;background:${key === "WhatsApp" ? "#25D366" : key === "Chat" ? "#202124" : "transparent"};color:${key === "WhatsApp" ? "#fff" : "inherit"};border:${key === "WhatsApp" || key === "Chat" ? "0" : "1px solid currentColor"};box-shadow:${floating ? "0 3px 14px #0004" : "none"};text-decoration:none`;
    const svg = link.querySelector("svg");
    svg.style.cssText = `display:block;width:${floating ? 27 : 22}px;height:${floating ? 27 : 22}px;fill:${key === "Instagram" || key === "Location" ? "none" : "currentColor"};stroke:currentColor;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round`;
    return link;
  };
  function applyStoreAppearance() {
    const validHex = value => /^#[0-9a-f]{6}$/i.test(value || "");
    const accent = validHex(store.primary_color) ? store.primary_color : "";
    const accent2 = validHex(store.accent2_color) ? store.accent2_color : accent;
    const accent3 = validHex(store.accent3_color) ? store.accent3_color : accent2;
    const background = validHex(store.background_color) ? store.background_color : "";
    const surface = validHex(store.surface_color) ? store.surface_color : "";
    const text = validHex(store.text_color) ? store.text_color : "";
    const fullFilter = Boolean(store.color_theme);
    const accentActive = Boolean(accent && (fullFilter || accent.toLowerCase() !== "#18181b"
      || validHex(store.accent2_color) || validHex(store.accent3_color)));
    if (!accentActive && !fullFilter && !background && !surface && !text) return;
    const rootData = document.documentElement.dataset;
    if (store.color_theme) { if (rootData.eshopColorFilter !== String(store.color_theme)) rootData.eshopColorFilter = store.color_theme; }
    else if ("eshopColorFilter" in rootData) delete rootData.eshopColorFilter;
    if (store.design_theme) { if (rootData.designTheme !== String(store.design_theme)) rootData.designTheme = store.design_theme; }
    else if ("designTheme" in rootData) delete rootData.designTheme;
    let style = document.getElementById("eshop-public-color-filter");
    if (!style) {
      style = document.createElement("style");
      style.id = "eshop-public-color-filter";
      document.head.append(style);
    }
    const foreground = text || "#17172f";
    const pageBackground = background || "#f4f1ff";
    const cardSurface = surface || "#ffffff";
    const secondary = validHex(accent2) ? accent2 : accentActive ? accent : "#5b5cf0";
    const tertiary = validHex(accent3) ? accent3 : secondary;
    const primary = accentActive ? accent : secondary;
    const contrast = color => {
      const channels = color.slice(1).match(/.{2}/g).map(channel => parseInt(channel, 16) / 255);
      const luminance = channels.map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4)
        .reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
      return luminance > 0.179 ? "#17172f" : "#ffffff";
    };
    const selectors = "[data-eshop-product-id],[class*='product-card'],[class*='product-tile'],[class*='product-item'],[class*='service-card'],[class*='property-card'],[class*='menu-item-card']";
    const variables = `${background || fullFilter ? `--background:${pageBackground};--eshop-color-background:${pageBackground};` : ""}` +
      `${text || fullFilter ? `--foreground:${foreground};--eshop-color-foreground:${foreground};` : ""}` +
      `${surface || fullFilter ? `--surface:${cardSurface};--surface-2:${cardSurface};--eshop-color-surface:${cardSurface};` : ""}` +
      `${accentActive ? `--accent:${primary};--primary-color:${primary};--signal:${primary};--signal-foreground:${contrast(primary)};--accent-foreground:${contrast(primary)};--eshop-editor-accent:${primary};--eshop-accent-secondary:${secondary};--eshop-accent-tertiary:${tertiary};--eshop-accent-gradient:linear-gradient(115deg,${primary},${secondary} 52%,${tertiary});` : ""}` +
      `${fullFilter ? `color-scheme:${contrast(pageBackground) === "#ffffff" ? "dark" : "light"};` : ""}`;
    const accentRules = accentActive ? `:root{${variables}}[type='submit'],.btn-primary,[class*='button-primary'],[class*='primary-button'],[class*='add-to-cart']{background:${primary}!important;background-image:linear-gradient(115deg,${primary},${secondary} 52%,${tertiary})!important;color:${contrast(primary)}!important;}` +
      `[class*='price'],[data-price]{color:${primary}!important;}` : variables ? `:root{${variables}}` : "";
    const nextCss = accentRules + (fullFilter
      ? `html[data-eshop-color-filter] body{background:${pageBackground}!important;color:${foreground}!important;}` +
        `html[data-eshop-color-filter] header,html[data-eshop-color-filter] nav,html[data-eshop-color-filter] footer{background-color:${cardSurface}!important;color:${foreground}!important;border-color:${primary}44!important;}` +
        `html[data-eshop-color-filter] section,html[data-eshop-color-filter] article,html[data-eshop-color-filter] aside,html[data-eshop-color-filter] [class*='card'],html[data-eshop-color-filter] [class*='tile'],html[data-eshop-color-filter] [class*='panel'],html[data-eshop-color-filter] :is(${selectors}){border-color:${primary}33!important;}` +
        `html[data-eshop-color-filter] :is(${selectors}){background-color:${cardSurface}!important;color:${foreground}!important;}` +
        `html[data-eshop-color-filter] h1,html[data-eshop-color-filter] h2,html[data-eshop-color-filter] h3,html[data-eshop-color-filter] h4,html[data-eshop-color-filter] p{color:inherit;}` +
        `html[data-eshop-color-filter] a:not([data-eshop-contact-icon]):not([class*='button']):not([class*='btn']){color:${secondary};}` +
        `html[data-eshop-color-filter] [type='submit'],html[data-eshop-color-filter] .btn-primary,html[data-eshop-color-filter] [class*='button-primary'],html[data-eshop-color-filter] [class*='primary-button'],html[data-eshop-color-filter] [class*='add-to-cart']{background:${primary}!important;background-image:var(--eshop-accent-gradient)!important;color:${contrast(primary)}!important;border-color:transparent!important;}` +
        `html[data-eshop-color-filter] [class*='badge'],html[data-eshop-color-filter] [class*='pill'],html[data-eshop-color-filter] [class*='tag'],html[data-eshop-color-filter] [class*='category']{border-color:${secondary}66!important;}` +
        `html[data-eshop-color-filter] [class*='price'],html[data-eshop-color-filter] [data-price]{color:${primary}!important;}` +
        `html[data-eshop-color-filter] input,html[data-eshop-color-filter] select,html[data-eshop-color-filter] textarea{background-color:${cardSurface}!important;color:${foreground}!important;border-color:${primary}55!important;}` +
        `html[data-eshop-color-filter] hr,html[data-eshop-color-filter] [class*='divider']{border-color:${primary}33!important;}`
      : "");
    if (style.textContent !== nextCss) style.textContent = nextCss;
  }
  const formatPrice = amount => {
    try {
      return new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: 2 }).format(amount);
    } catch {
      return `${currency} ${Number(amount).toLocaleString()}`;
    }
  };
  const cartStorageKey = `eshop-cart:${location.host}`;
  let cart = [];
  let wishlist = [];
  let customerHolds = [];
  let categoryBar = null;
  let searchInput = null;
  let activeCategoryId = "";
  let activeSearch = "";
  let commerceDialog = null;
  let commerceStatus = "";
  try {
    const savedCart = JSON.parse(localStorage.getItem(cartStorageKey) || "[]");
    if (Array.isArray(savedCart)) {
      cart = savedCart.filter(item => products.some(product => String(product.id) === String(item.product_id))
        && Number.isSafeInteger(Number(item.quantity)) && Number(item.quantity) > 0)
        .map(item => ({ product_id: String(item.product_id), quantity: Number(item.quantity) }));
    }
  } catch (error) {
    console.warn("Saved storefront bag could not be read.", error);
  }
  try {
    const savedWishlist = JSON.parse(localStorage.getItem(wishlistStorageKey) || "[]");
    if (Array.isArray(savedWishlist)) {
      wishlist = [...new Set(savedWishlist.map(String))]
        .filter(id => products.some(product => String(product.id) === id))
        .slice(0, 100);
    }
    const savedHolds = JSON.parse(localStorage.getItem(holdStorageKey) || "[]");
    if (Array.isArray(savedHolds)) {
      customerHolds = savedHolds.filter(hold => hold && typeof hold.id === "string"
        && products.some(product => String(product.id) === String(hold.product_id))
        && Date.parse(hold.expires_at) > Date.now());
    }
  } catch (error) {
    console.warn("Saved storefront preferences could not be read.", error);
  }
  const saveCart = () => {
    try {
      localStorage.setItem(cartStorageKey, JSON.stringify(cart));
    } catch (error) {
      console.warn("Storefront bag could not be saved on this device.", error);
    }
  };
  const setCommerceStatus = message => {
    commerceStatus = message;
    const status = commerceDialog?.querySelector("[data-eshop-commerce-status]");
    if (status) status.textContent = message;
  };
  const findProduct = id => products.find(product => String(product.id) === String(id));
  const trackEvent = (productId, type, count = 1) => {
    if (typeof window.__ESHOP_TRACK_STOREFRONT_EVENT__ === "function") {
      window.__ESHOP_TRACK_STOREFRONT_EVENT__(String(productId), type, count);
    }
  };
  const saveWishlist = () => {
    try {
      localStorage.setItem(wishlistStorageKey, JSON.stringify(wishlist));
    } catch (error) {
      console.warn("Wishlist could not be saved on this device.", error);
    }
  };
  const saveCustomerHolds = () => {
    try {
      localStorage.setItem(holdStorageKey, JSON.stringify(customerHolds));
    } catch (error) {
      console.warn("Product hold could not be saved on this device.", error);
    }
  };
  const toggleWishlist = product => {
    if (!product) return;
    const id = String(product.id);
    const saved = !wishlist.includes(id);
    wishlist = saved ? [...wishlist, id].slice(-100) : wishlist.filter(item => item !== id);
    saveWishlist();
    if (saved) trackEvent(id, "wishlist_add");
    updateWishlistCount();
    updateWishlistButtons();
    setCommerceStatus(saved ? `${product.name} saved to your wishlist.` : `${product.name} removed from your wishlist.`);
  };
  const updateWishlistCount = () => {
    document.querySelectorAll("[data-eshop-wishlist-count]").forEach(node => {
      if (node.textContent !== String(wishlist.length)) node.textContent = String(wishlist.length);
    });
  };
  const updateWishlistButtons = () => {
    document.querySelectorAll("[data-eshop-wishlist-toggle]").forEach(button => {
      const saved = wishlist.includes(String(button.dataset.productId));
      button.textContent = saved ? "♥ Saved to wishlist" : "♡ Save to wishlist";
      button.setAttribute("aria-pressed", String(saved));
    });
  };
  const requestProductHold = async (form, product) => {
    const fields = new FormData(form);
    const quantity = Number(commerceDialog?.querySelector("[data-eshop-product-quantity]")?.value) || 1;
    const submit = form.querySelector("button[type='submit']");
    if (submit) submit.disabled = true;
    setCommerceStatus("Reserving the requested quantity…");
    try {
      const response = await fetch("/api/product-holds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idempotency_key: crypto.randomUUID(),
          product_id: String(product.id),
          quantity,
          customer_name: fields.get("customer_name"),
          contact: fields.get("contact")
        })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not hold this product.");
      const hold = result.hold;
      customerHolds = [...customerHolds.filter(item => item.id !== hold.id), {
        id: hold.id,
        product_id: String(hold.product_id),
        quantity: Number(hold.quantity),
        expires_at: hold.expires_at,
        customer_name: String(fields.get("customer_name") || "").trim(),
        contact: String(fields.get("contact") || "").trim()
      }];
      saveCustomerHolds();
      setCommerceStatus(`Held ${quantity} ${product.name} until ${new Date(hold.expires_at).toLocaleString()}.`);
      form.reset();
    } catch (error) {
      console.error("Product hold request failed.", error);
      setCommerceStatus(error.message || "Could not hold this product. Please try again.");
    } finally {
      if (submit) submit.disabled = false;
    }
  };
  const addToBag = (product, quantity = 1) => {
    if (!product || Number(product.stock) <= 0) {
      setCommerceStatus("This item is currently out of stock.");
      return;
    }
    const item = cart.find(entry => entry.product_id === String(product.id));
    const nextQuantity = (item?.quantity || 0) + quantity;
    if (nextQuantity > Number(product.stock)) {
      setCommerceStatus(`Only ${Number(product.stock)} ${product.name} are available.`);
      return;
    }
    if (item) item.quantity = nextQuantity;
    else cart.push({ product_id: String(product.id), quantity });
    saveCart();
    trackEvent(product.id, "cart_add", quantity);
    setCommerceStatus(`${product.name} added to your bag.`);
    updateBagCount();
  };
  const updateBagCount = () => {
    const count = cart.reduce((total, item) => total + item.quantity, 0);
    document.querySelectorAll("[data-eshop-bag-count]").forEach(node => { if (node.textContent !== String(count)) node.textContent = String(count); });
  };
  const ensureCommerceDialog = () => {
    if (commerceDialog) return commerceDialog;
    commerceDialog = document.createElement("dialog");
    commerceDialog.dataset.eshopCommerceDialog = "";
    commerceDialog.setAttribute("aria-label", "Storefront product and bag");
    commerceDialog.style.cssText = "width:min(620px,calc(100vw - 24px));max-width:620px;max-height:min(88dvh,820px);overflow:auto;padding:0;border:1px solid #8886;border-radius:18px;background:var(--surface,#fff);color:var(--foreground,#17172f);box-shadow:0 24px 80px #0005";
    commerceDialog.addEventListener("click", event => {
      if (event.target === commerceDialog) commerceDialog.close();
    });
    commerceDialog.addEventListener("close", () => { commerceDialog.innerHTML = ""; });
    document.body.append(commerceDialog);
    return commerceDialog;
  };
  const openCommerceDialog = () => {
    const dialog = ensureCommerceDialog();
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
    return dialog;
  };
  const createButton = (text, action, primary = false) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = text;
    button.dataset.eshopCommerceAction = action;
    button.style.cssText = `min-height:44px;padding:10px 15px;border:1px solid ${primary ? "transparent" : "currentColor"};border-radius:999px;background:${primary ? "var(--eshop-accent-gradient,#222)" : "transparent"};color:${primary ? "var(--signal-foreground,#fff)" : "inherit"};font:inherit;font-weight:700;cursor:pointer`;
    return button;
  };
  const openProduct = product => {
    if (!product) return;
    trackEvent(product.id, "view");
    const dialog = openCommerceDialog();
    dialog.innerHTML = "";
    const panel = document.createElement("article");
    panel.style.cssText = "display:grid;grid-template-columns:minmax(0,1fr);gap:16px;padding:20px";
    const close = createButton("Close", "close");
    close.style.justifySelf = "end";
    panel.append(close);
    const imageSource = imageOf(product);
    if (/^(https:\/\/|\/)/i.test(imageSource)) {
      const image = document.createElement("img");
      image.src = imageSource;
      image.alt = String(product.name || "Product");
      image.loading = "lazy";
      image.width = 800;
      image.height = 800;
      image.style.cssText = "width:100%;max-height:320px;object-fit:cover;border-radius:12px;background:var(--surface-2,#eee)";
      panel.append(image);
    }
    const heading = document.createElement("h2");
    heading.textContent = product.name || "Product";
    heading.style.cssText = "margin:0;font-size:1.4rem";
    panel.append(heading);
    const price = document.createElement("strong");
    price.textContent = formatPrice(priceOf(product));
    price.style.cssText = "font-size:1.2rem;color:var(--signal,#5b5cf0)";
    panel.append(price);
    const description = document.createElement("p");
    description.textContent = product.description || "";
    description.style.cssText = "white-space:pre-wrap;line-height:1.65";
    panel.append(description);
    const stock = document.createElement("p");
    stock.textContent = Number(product.stock) > 0 ? `${product.stock} in stock` : "Out of stock";
    panel.append(stock);
    const quantity = document.createElement("input");
    quantity.type = "number";
    quantity.min = "1";
    quantity.max = String(Math.max(1, Number(product.stock) || 1));
    quantity.value = "1";
    quantity.dataset.eshopProductQuantity = "";
    quantity.setAttribute("aria-label", "Quantity");
    quantity.style.cssText = "width:100px;min-height:44px;padding:8px;border:1px solid currentColor;border-radius:8px;background:var(--surface,#fff);color:inherit";
    panel.append(quantity);
    const add = createButton("Add to bag", "add-detail", true);
    add.dataset.productId = String(product.id);
    add.disabled = Number(product.stock) <= 0;
    panel.append(add);
    const wish = createButton(wishlist.includes(String(product.id)) ? "♥ Saved to wishlist" : "♡ Save to wishlist", "toggle-wishlist");
    wish.dataset.productId = String(product.id);
    wish.dataset.eshopWishlistToggle = "";
    panel.append(wish);
    if (product.booking_enabled === true && Number(product.stock) > 0) {
      const holdForm = document.createElement("form");
      holdForm.dataset.eshopProductHoldForm = "";
      holdForm.style.cssText = "display:grid;gap:10px;padding:14px;border:1px solid #8885;border-radius:12px";
      const holdNote = document.createElement("p");
      const holdHours = Number(store.hold_duration_hours) || 24;
      holdNote.textContent = `Request a hold for up to ${holdHours} hour${holdHours === 1 ? "" : "s"}. The selected quantity is reserved immediately.`;
      holdNote.style.margin = "0";
      holdForm.append(holdNote);
      [["customer_name", "Full name", "text"], ["contact", "Email address or phone", "text"]].forEach(([name, label, type]) => {
        const input = document.createElement("input");
        input.name = name;
        input.type = type;
        input.placeholder = label;
        input.autocomplete = name === "customer_name" ? "name" : "email tel";
        input.required = true;
        input.setAttribute("aria-label", label);
        input.style.cssText = "min-height:44px;padding:10px;border:1px solid #8888;border-radius:8px;background:var(--surface,#fff);color:inherit;font:inherit";
        holdForm.append(input);
      });
      const holdSubmit = document.createElement("button");
      holdSubmit.type = "submit";
      holdSubmit.textContent = "Reserve this product";
      holdSubmit.style.cssText = "min-height:44px;border:1px solid currentColor;border-radius:999px;background:transparent;color:inherit;font:inherit;font-weight:700";
      holdForm.append(holdSubmit);
      holdForm.addEventListener("submit", event => {
        event.preventDefault();
        void requestProductHold(holdForm, product);
      });
      panel.append(holdForm);
    }
    const status = document.createElement("p");
    status.dataset.eshopCommerceStatus = "";
    status.setAttribute("role", "status");
    status.textContent = commerceStatus;
    status.style.minHeight = "1.4em";
    panel.append(status);
    dialog.append(panel);
    if (commerceStatus) setCommerceStatus(commerceStatus);
  };
  const openBag = () => {
    const dialog = openCommerceDialog();
    dialog.innerHTML = "";
    const panel = document.createElement("section");
    panel.style.cssText = "display:grid;gap:16px;padding:20px";
    const header = document.createElement("header");
    header.style.cssText = "display:flex;align-items:center;justify-content:space-between;gap:12px";
    const title = document.createElement("h2");
    title.textContent = "Your bag";
    title.style.margin = "0";
    header.append(title, createButton("Close", "close"));
    panel.append(header);
    const items = cart.map(item => ({ item, product: findProduct(item.product_id) })).filter(row => row.product);
    if (!items.length) {
      const empty = document.createElement("p");
      empty.textContent = "Your bag is empty. Browse the catalog and add an item.";
      panel.append(empty);
    } else {
      const lines = document.createElement("div");
      lines.style.cssText = "display:grid;gap:10px";
      items.forEach(({ item, product }) => {
        const line = document.createElement("article");
        line.style.cssText = "display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;align-items:center;padding:12px;border:1px solid #8885;border-radius:12px";
        const name = document.createElement("strong");
        name.textContent = product.name;
        const subtotal = document.createElement("span");
        subtotal.textContent = `${formatPrice(priceOf(product) * item.quantity)} · Qty ${item.quantity}`;
        const remove = createButton("Remove", "remove-item");
        remove.dataset.productId = item.product_id;
        line.append(name, subtotal, remove);
        lines.append(line);
      });
      panel.append(lines);
      const total = items.reduce((sum, row) => sum + priceOf(row.product) * row.item.quantity, 0);
      const totalLabel = document.createElement("strong");
      totalLabel.textContent = `Total: ${formatPrice(total)}`;
      panel.append(totalLabel);
      const form = document.createElement("form");
      form.dataset.eshopCheckoutForm = "";
      form.style.cssText = "display:grid;gap:10px";
      [
        ["customer_name", "Full name", "text", true],
        ["customer_email", "Email address", "email", true],
        ["customer_phone", "Phone (optional)", "tel", false]
      ].forEach(([name, label, type, required]) => {
        const input = document.createElement("input");
        input.name = name;
        input.type = type;
        input.placeholder = label;
        input.autocomplete = name === "customer_name" ? "name" : name === "customer_email" ? "email" : "tel";
        input.required = required;
        input.setAttribute("aria-label", label);
        input.style.cssText = "min-height:44px;padding:10px;border:1px solid #8888;border-radius:8px;background:var(--surface,#fff);color:inherit;font:inherit";
        form.append(input);
      });
      const submit = document.createElement("button");
      submit.type = "submit";
      submit.textContent = "Place order & pay";
      submit.style.cssText = "min-height:48px;border:0;border-radius:999px;background:var(--eshop-accent-gradient,#222);color:var(--signal-foreground,#fff);font:inherit;font-weight:800";
      form.append(submit);
      form.addEventListener("submit", async event => {
        event.preventDefault();
        submit.disabled = true;
        const fields = new FormData(form);
        const idempotencyKey = crypto.randomUUID();
        const cartProductIds = new Set(items.map(row => String(row.item.product_id)));
        const orderName = String(fields.get("customer_name") || "").trim().replace(/\s+/g, " ").toLocaleLowerCase();
        const orderEmail = String(fields.get("customer_email") || "").trim().toLocaleLowerCase();
        const orderPhone = String(fields.get("customer_phone") || "").replace(/\D/g, "");
        const holdIds = customerHolds.filter(hold => cartProductIds.has(String(hold.product_id))
          && Date.parse(hold.expires_at) > Date.now()
          && String(hold.customer_name || "").trim().replace(/\s+/g, " ").toLocaleLowerCase() === orderName
          && (String(hold.contact || "").includes("@")
            ? String(hold.contact).trim().toLocaleLowerCase() === orderEmail
            : String(hold.contact || "").replace(/\D/g, "") === orderPhone)).map(hold => hold.id);
        setCommerceStatus("Creating your order securely…");
        try {
          const orderResponse = await fetch("/api/orders", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              idempotency_key: idempotencyKey,
              customer_name: fields.get("customer_name"),
              customer_email: fields.get("customer_email"),
              customer_phone: fields.get("customer_phone"),
              hold_ids: holdIds,
              items: items.map(row => ({ product_id: row.item.product_id, quantity: row.item.quantity }))
            })
          });
          const orderResult = await orderResponse.json();
          if (!orderResponse.ok) throw new Error(orderResult.error || "Could not create this order.");
          const orderNumber = orderResult.order?.order_number;
          if (!orderNumber) throw new Error("The order was created without a reference number. Contact the shop before retrying.");
          cart = [];
          saveCart();
          updateBagCount();
          setCommerceStatus(`Order ${orderNumber} created. Starting secure payment…`);
          const paymentResponse = await fetch("/api/payments/paystack/initialize", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ order_number: orderNumber })
          });
          const payment = await paymentResponse.json();
          if (!paymentResponse.ok) throw new Error(`Order ${orderNumber} was saved, but payment could not start: ${payment.error || "Try again later."}`);
          const paymentUrl = new URL(payment.authorization_url);
          if (paymentUrl.protocol !== "https:" || paymentUrl.hostname !== "checkout.paystack.com") {
            throw new Error(`Order ${orderNumber} was saved, but the payment link was invalid. Contact the shop.`);
          }
          location.assign(paymentUrl.toString());
        } catch (error) {
          console.error("Storefront checkout failed.", error);
          setCommerceStatus(error.message || "Checkout failed. Please retry or contact the shop.");
          const message = dialog.querySelector("[data-eshop-commerce-status]");
          if (!message) {
            const alert = document.createElement("p");
            alert.dataset.eshopCommerceStatus = "";
            alert.setAttribute("role", "alert");
            alert.style.cssText = "padding:10px;border-radius:8px;background:#b91c1c;color:#fff";
            alert.textContent = commerceStatus;
            form.before(alert);
          }
          submit.disabled = false;
        }
      });
      panel.append(form);
    }
    const status = document.createElement("p");
    status.dataset.eshopCommerceStatus = "";
    status.setAttribute("role", "status");
    status.textContent = commerceStatus;
    status.style.cssText = "min-height:1.4em";
    panel.append(status);
    dialog.append(panel);
  };
  const openWishlist = () => {
    const dialog = openCommerceDialog();
    dialog.innerHTML = "";
    const panel = document.createElement("section");
    panel.style.cssText = "display:grid;gap:14px;padding:20px";
    const header = document.createElement("header");
    header.style.cssText = "display:flex;align-items:center;justify-content:space-between;gap:12px";
    const title = document.createElement("h2");
    title.textContent = "Your wishlist";
    title.style.margin = "0";
    header.append(title, createButton("Close", "close"));
    panel.append(header);
    const savedProducts = wishlist.map(findProduct).filter(Boolean);
    if (!savedProducts.length) {
      const empty = document.createElement("p");
      empty.textContent = "Your wishlist is empty. Save products to find them here.";
      panel.append(empty);
    }
    savedProducts.forEach(product => {
      const row = document.createElement("article");
      row.style.cssText = "display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;align-items:center;padding:12px;border:1px solid #8885;border-radius:12px";
      const name = document.createElement("strong");
      name.textContent = `${product.name} · ${formatPrice(priceOf(product))}`;
      const actions = document.createElement("div");
      actions.style.cssText = "display:flex;gap:6px;flex-wrap:wrap";
      const view = createButton("View", "open-product");
      view.dataset.productId = String(product.id);
      const remove = createButton("Remove", "remove-wishlist");
      remove.dataset.productId = String(product.id);
      actions.append(view, remove);
      row.append(name, actions);
      panel.append(row);
    });
    dialog.append(panel);
  };
  const cardSelector = element => {
    const classes = String(element.className || "").split(/\s+/);
    const hasCardClass = classes.some(name => commerceCardClasses.includes(name));
    const commerceNamed = classes.some(name => /(?:product|service|menu|dish|safari|property|experience|destination|location|room|stay|package|tour|treatment|booking)[\w-]*card/i.test(name));
    const genericProductCard = classes.some(name => /(?:^|-)card(?:-|$)/i.test(name))
      && Boolean(element.querySelector("img"))
      && Boolean(element.querySelector("[class*='price'], [data-price]"))
      && /(?:KES|KSh|USD|[$€£])\s?[\d,.]+|[\d,.]+\s?(?:KES|KSh|USD)/i.test(element.textContent);
    return hasCardClass || commerceNamed || genericProductCard || (element.hasAttribute("data-product-id")
      && /^(ARTICLE|DIV|LI)$/.test(element.tagName));
  };
  const isProductCard = element => {
    if (!cardSelector(element) || element.closest("[data-eshop-catalog-ignore]")) return false;
    let parent = element.parentElement;
    while (parent && parent !== document.documentElement) {
      if (cardSelector(parent)) return false;
      parent = parent.parentElement;
    }
    return true;
  };
  const labelNode = (card, selector) => [...card.querySelectorAll(selector)].find(element =>
    ![...element.children].some(child => child.matches(selector)));
  const setText = (element, value) => {
    const text = String(value);
    if (element && element.textContent !== text) element.textContent = text;
  };
  const setData = (element, key, value) => {
    if (element.dataset[key] !== value) element.dataset[key] = value;
  };
  const gridLabel = (parent, index) => {
    const section = parent.closest("section");
    const heading = section && [...section.querySelectorAll("h1, h2, h3, h4")]
      .find(element => !element.closest("[data-eshop-product-card]"));
    const label = section?.getAttribute("aria-label")
      || heading?.textContent?.trim()
      || parent.getAttribute("aria-label")
      || parent.id
      || `Products ${index + 1}`;
    return label.replace(/\s+/g, " ").trim().slice(0, 100);
  };
  const gridKey = (label, occurrence) => `${slug(label) || "products"}-${occurrence}`;

  function setCardProduct(card, product) {
    const category = categoryOf(product);
    const id = String(product.id ?? "");
    setData(card, "eshopProductCard", "");
    setData(card, "eshopProductId", id);
    setData(card, "eshopCategoryId", category ? String(category.id) : "");
    setData(card, "productId", id);
    setData(card, "id", id);
    card.querySelectorAll("[data-product-id], [data-id]").forEach(element => {
      if (element.hasAttribute("data-product-id")) setData(element, "productId", id);
      if (element.hasAttribute("data-id")) setData(element, "id", id);
    });

    const title = labelNode(card, "h1, h2, h3, h4, h5, h6, [class*='product-title'], [class*='card-title'], [class*='product-name'], [class*='service-title'], [class*='item-name'], [class*='dish-name']");
    setText(title, product.name || "Product");
    const categoryLabel = labelNode(card, "[class*='category-name'], [class*='category-label'], [data-product-category]");
    if (categoryLabel && category) setText(categoryLabel, category.name);
    const price = labelNode(card, ".price-current, .current-price, .product-price, .card-price, [class*='service-card-price'], [data-price]")
      || [...card.querySelectorAll("*")].find(element => element.children.length === 0
        && /(?:KES|KSh|USD|[$€£])\s?[\d,.]+|[\d,.]+\s?(?:KES|KSh|USD)/i.test(element.textContent));
    setText(price, formatPrice(priceOf(product)));
    for (const image of card.querySelectorAll("img")) {
      setData(image, "eshopProductImage", "");
      if (image.parentElement) setData(image.parentElement, "eshopProductImageFrame", "");
      const source = imageOf(product);
      if (source && image.getAttribute("src") !== source) image.setAttribute("src", source);
      if (image.getAttribute("alt") !== String(product.name || "Product")) {
        image.setAttribute("alt", String(product.name || "Product"));
      }
      if (image.loading !== "lazy") image.loading = "lazy";
      if (image.width !== 800) image.width = 800;
      if (image.height !== 920) image.height = 920;
    }
    const productLink = card.querySelector("a[href]");
    if (productLink) {
      const linkHref = `#eshop-product-${encodeURIComponent(id)}`;
      const linkLabel = `View ${product.name || "product"} details`;
      if (productLink.getAttribute("href") !== linkHref) productLink.setAttribute("href", linkHref);
      setData(productLink, "eshopProductOpen", "");
      setData(productLink, "productId", id);
      if (productLink.getAttribute("aria-label") !== linkLabel) productLink.setAttribute("aria-label", linkLabel);
    }
    let addButton = card.querySelector("[data-eshop-add-to-bag]");
    if (!addButton) {
      addButton = document.createElement("button");
      addButton.type = "button";
      addButton.dataset.eshopAddToBag = "";
      addButton.style.cssText = "display:block;width:100%;min-height:42px;margin-top:10px;padding:8px 12px;border:0;border-radius:999px;background:var(--eshop-accent-gradient,var(--accent,#222));color:var(--signal-foreground,#fff);font:inherit;font-weight:700;cursor:pointer";
      card.append(addButton);
    }
    addButton.dataset.productId = id;
    addButton.textContent = Number(product.stock) > 0 ? "Add to bag" : "Sold out";
    addButton.disabled = Number(product.stock) <= 0;
    let wishButton = card.querySelector("[data-eshop-wishlist-toggle]");
    if (!wishButton) {
      wishButton = document.createElement("button");
      wishButton.type = "button";
      wishButton.dataset.eshopWishlistToggle = "";
      wishButton.dataset.eshopCommerceAction = "toggle-wishlist";
      wishButton.style.cssText = "display:block;width:100%;min-height:38px;margin-top:8px;padding:7px 12px;border:1px solid currentColor;border-radius:999px;background:transparent;color:inherit;font:inherit;font-weight:600;cursor:pointer";
      card.append(wishButton);
    }
    wishButton.dataset.productId = id;
    wishButton.textContent = wishlist.includes(id) ? "♥ Saved to wishlist" : "♡ Save to wishlist";
    wishButton.setAttribute("aria-pressed", String(wishlist.includes(id)));
  }

  function productsForGrid(label) {
    const key = normalize(label);
    const category = categories.find(item => {
      const name = normalize(item.name);
      const categorySlug = normalize(item.slug);
      return (name && key.includes(name)) || (categorySlug && key.includes(categorySlug));
    });
    if (category) return products.filter(product => String(categoryOf(product)?.id) === String(category.id));
    if (/\b(featured|editor.?pick|spotlight)\b/.test(key)) {
      const featured = products.filter(product => product.is_featured || product.featured || product.is_flagship);
      if (featured.length) return featured.slice(0, 8);
    }
    if (/\b(new|arrival|latest)\b/.test(key)) {
      const latest = products.filter(product => product.is_new || product.is_new_arrival || product.isNew);
      if (latest.length) return latest.slice(0, 8);
    }
    if (/\b(best|seller|popular|trending)\b/.test(key)) {
      const popular = products.filter(product => product.is_bestseller || product.is_best_seller || product.isBestseller);
      if (popular.length) return popular.slice(0, 8);
    }
    return products.slice(0, 8);
  }

  function adaptProductGrids() {
    const groups = new Map();
    for (const card of document.querySelectorAll(cardQuery)) {
      if (!isProductCard(card) || !card.parentElement) continue;
      const siblings = [...card.parentElement.children].filter(isProductCard);
      if (!siblings.length) continue;
      groups.set(card.parentElement, siblings);
    }

    const labelOccurrences = new Map();
    let gridIndex = 0;
    for (const [parent, cards] of groups) {
      const template = cards[0];
      if (!template) continue;
      cards.forEach(card => setData(card, "eshopProductCard", ""));
      const label = gridLabel(parent, gridIndex);
      const normalizedLabel = slug(label) || "products";
      const occurrence = (labelOccurrences.get(normalizedLabel) || 0) + 1;
      labelOccurrences.set(normalizedLabel, occurrence);
      setData(parent, "eshopProductGrid", "");
      setData(parent, "eshopGridLabel", label);
      setData(parent, "eshopGridKey", gridKey(label, occurrence));
      gridIndex += 1;
      const current = [...cards];
      const gridProducts = productsForGrid(label);
      const desired = gridProducts.length;
      for (let index = 0; index < Math.min(current.length, desired); index += 1) {
        setCardProduct(current[index], gridProducts[index]);
      }
      for (let index = current.length - 1; index >= desired; index -= 1) current[index].remove();
      for (let index = current.length; index < desired; index += 1) {
        const card = template.cloneNode(true);
        setCardProduct(card, gridProducts[index]);
        parent.append(card);
      }
      if (!desired) {
        if (!parent.hasAttribute("data-eshop-empty-catalog")) parent.setAttribute("data-eshop-empty-catalog", "");
        if (!parent.querySelector("[data-eshop-empty-message]")) {
          const message = document.createElement("p");
          message.dataset.eshopEmptyMessage = "";
          message.textContent = "No products are available yet.";
          parent.append(message);
        }
      } else {
        if (parent.hasAttribute("data-eshop-empty-catalog")) parent.removeAttribute("data-eshop-empty-catalog");
        parent.querySelector("[data-eshop-empty-message]")?.remove();
      }
    }
  }

  function applyActiveCategoryFilter() {
    for (const card of document.querySelectorAll("[data-eshop-product-id]")) {
      const product = findProduct(card.dataset.eshopProductId);
      const categoryMatches = !activeCategoryId || card.dataset.eshopCategoryId === activeCategoryId;
      const searchText = [product?.name, product?.brand, product?.sku, product?.description]
        .filter(Boolean).join(" ").toLocaleLowerCase();
      const searchMatches = !activeSearch || searchText.includes(activeSearch);
      const hidden = !categoryMatches || !searchMatches;
      card.hidden = hidden;
      if (hidden) card.style.setProperty("display", "none", "important");
      else card.style.removeProperty("display");
    }
  }

  function createFallbackCatalog() {
    const section = document.createElement("section");
    section.dataset.eshopCatalogFallback = "";
    section.setAttribute("aria-label", "Shop products");
    section.style.cssText = "max-width:1240px;margin:40px auto;padding:24px clamp(16px,4vw,40px)";
    const heading = document.createElement("h2");
    heading.textContent = "Complete catalogue";
    heading.style.cssText = "margin:0 0 20px;font-size:clamp(1.7rem,4vw,2.5rem)";
    section.append(heading);
    const grid = document.createElement("div");
    grid.dataset.eshopFallbackGrid = "";
    grid.style.cssText = "display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,220px),1fr));gap:16px";
    for (const product of products) {
      const card = document.createElement("article");
      card.dataset.eshopProductId = String(product.id);
      card.dataset.eshopCategoryId = String(categoryOf(product)?.id || "");
      card.style.cssText = "overflow:hidden;padding:12px;border:1px solid #8884;border-radius:var(--radius,14px);background:var(--surface,#fff);color:var(--foreground,inherit)";
      const source = imageOf(product);
      if (/^(https:\/\/|\/)/i.test(source)) {
        const image = document.createElement("img");
        image.src = source;
        image.alt = String(product.name || "Product");
        image.loading = "lazy";
        image.width = 800;
        image.height = 800;
        image.style.cssText = "width:100%;aspect-ratio:1/1;object-fit:cover;border-radius:10px;background:var(--surface-2,#eee)";
        card.append(image);
      }
      const name = document.createElement("h3");
      name.textContent = product.name || "Product";
      name.style.cssText = "margin:12px 0 6px;font-size:1rem";
      const price = document.createElement("strong");
      price.textContent = formatPrice(priceOf(product));
      price.style.cssText = "display:block;color:var(--signal,#5b5cf0)";
      const details = createButton("View details", "open-product");
      details.dataset.productId = String(product.id);
      const add = createButton(Number(product.stock) > 0 ? "Add to bag" : "Sold out", "add-to-bag", true);
      add.dataset.eshopAddToBag = "";
      add.dataset.productId = String(product.id);
      add.disabled = Number(product.stock) <= 0;
      card.append(name, price, details, add);
      grid.append(card);
    }
    if (!products.length) {
      const empty = document.createElement("p");
      empty.textContent = "No published products are available yet.";
      grid.append(empty);
    }
    section.append(grid);
    const target = document.querySelector("main") || document.querySelector("[role='main']");
    if (target) target.append(section);
    else {
      const footer = document.querySelector("footer");
      if (footer?.parentElement) footer.before(section);
      else document.body.append(section);
    }
    return section;
  }

  function ensureCategoryBrowser() {
    if (!products.length && !categories.length) return;
    if (categoryBar && !categoryBar.isConnected) {
      categoryBar = null;
      searchInput = null;
    }
    if (!document.querySelector("[data-eshop-catalog-fallback]")) createFallbackCatalog();
    const firstProduct = document.querySelector("[data-eshop-product-id]");
    if (!categoryBar) {
      categoryBar = document.createElement("section");
      categoryBar.dataset.eshopCategoryBrowser = "";
      categoryBar.setAttribute("aria-label", "Browse products by category");
      categoryBar.style.cssText = "max-width:1240px;margin:22px auto;padding:14px clamp(16px,4vw,40px);display:grid;gap:10px";
      const heading = document.createElement("h2");
      heading.textContent = "Shop by category";
      heading.style.cssText = "margin:0;font-size:1.1rem";
      const controls = document.createElement("div");
      controls.style.cssText = "display:flex;gap:8px;overflow-x:auto;padding:2px 0;scrollbar-width:thin";
      const addFilter = (label, id) => {
        const button = createButton(label, "filter-category");
        button.dataset.categoryId = id;
        button.setAttribute("aria-pressed", String(id === activeCategoryId));
        button.style.flex = "0 0 auto";
        controls.append(button);
      };
      addFilter("All products", "");
      categories.forEach(category => addFilter(category.name, String(category.id)));
      const searchRow = document.createElement("div");
      searchRow.style.cssText = "display:flex;gap:10px;align-items:center";
      searchInput = document.createElement("input");
      searchInput.type = "search";
      searchInput.placeholder = "Search products";
      searchInput.setAttribute("aria-label", "Search products");
      searchInput.style.cssText = "flex:1;min-width:0;min-height:44px;padding:10px 14px;border:1px solid #8888;border-radius:999px;background:var(--surface,#fff);color:inherit;font:inherit";
      searchInput.addEventListener("input", () => {
        activeSearch = searchInput.value.trim().toLocaleLowerCase();
        applyActiveCategoryFilter();
      });
      const bag = createButton("Bag", "open-bag", true);
      bag.dataset.eshopBagCount = "";
      bag.style.minWidth = "92px";
      bag.addEventListener("click", openBag);
      const wish = createButton("Saved", "open-wishlist");
      wish.dataset.eshopWishlistCount = "";
      wish.style.minWidth = "92px";
      wish.addEventListener("click", openWishlist);
      searchRow.append(searchInput, wish, bag);
      categoryBar.append(heading, controls, searchRow);
      const target = firstProduct?.closest("[data-eshop-product-grid]") || firstProduct?.parentElement
        || document.querySelector("main") || document.querySelector("[role='main']") || document.body;
      if (target?.parentElement) target.before(categoryBar);
      else document.body.prepend(categoryBar);
    }
    updateBagCount();
    updateWishlistCount();
  }

  function bindCommerceActions() {
    if (document.documentElement.dataset.eshopCommerceBound) return;
    document.documentElement.dataset.eshopCommerceBound = "1";
    document.addEventListener("click", event => {
      const target = event.target instanceof Element ? event.target : null;
      if (!target) return;
      const add = target.closest("[data-eshop-add-to-bag]");
      if (add) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        addToBag(findProduct(add.dataset.productId));
        return;
      }
      const action = target.closest("[data-eshop-commerce-action]");
      if (action) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        if (action.dataset.eshopCommerceAction === "close") commerceDialog?.close();
        if (action.dataset.eshopCommerceAction === "open-bag") openBag();
        if (action.dataset.eshopCommerceAction === "open-wishlist") openWishlist();
        if (action.dataset.eshopCommerceAction === "toggle-wishlist") toggleWishlist(findProduct(action.dataset.productId));
        if (action.dataset.eshopCommerceAction === "remove-wishlist") {
          const product = findProduct(action.dataset.productId);
          if (product && wishlist.includes(String(product.id))) toggleWishlist(product);
          openWishlist();
        }
        if (action.dataset.eshopCommerceAction === "filter-category") {
          activeCategoryId = action.dataset.categoryId || "";
          categoryBar?.querySelectorAll("[data-eshop-commerce-action='filter-category']").forEach(button => {
            button.setAttribute("aria-pressed", String(button.dataset.categoryId === activeCategoryId));
          });
          applyActiveCategoryFilter();
        }
        if (action.dataset.eshopCommerceAction === "open-product") openProduct(findProduct(action.dataset.productId));
        if (action.dataset.eshopCommerceAction === "add-detail") {
          const quantity = Number(commerceDialog?.querySelector("input[type='number']")?.value) || 1;
          addToBag(findProduct(action.dataset.productId), quantity);
          commerceDialog?.close();
          openBag();
        }
        if (action.dataset.eshopCommerceAction === "remove-item") {
          cart = cart.filter(item => item.product_id !== action.dataset.productId);
          saveCart();
          updateBagCount();
          openBag();
        }
        return;
      }
      const productLink = target.closest("[data-eshop-product-open]");
      if (productLink) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        openProduct(findProduct(productLink.dataset.productId));
      }
    }, true);
  }

  function applyContactFooter() {
    document.querySelectorAll("a[href^='tel:']").forEach(link => link.remove());
    let footer = document.querySelector("footer");
    if (!footer && document.body) {
      footer = document.createElement("footer");
      footer.className = "eshop-generated-contact-footer";
      document.body.append(footer);
    }
    if (!footer) return;
    const obsoleteFooterLinks = /whats.?app|chat with|instagram|facebook|tiktok|youtube|(^|\s)x($|\s)|get directions|call\s/i;
    footer.querySelectorAll("a:not([data-eshop-contact-icon])").forEach(link => {
      const label = `${link.textContent || ""} ${link.getAttribute("href") || ""}`.toLocaleLowerCase();
      if (obsoleteFooterLinks.test(label)) link.remove();
    });
    footer.querySelectorAll("p,span,li").forEach(node => {
      if (node.children.length) return;
      if (/\b(phone|call|telephone|tel)\b/i.test(node.textContent || "")) node.remove();
    });
    const address = String(store.location_address || store.location || "").trim();
    const place = String(store.location_name || "").trim();
    const addressQuery = encodeURIComponent([place, address].filter(Boolean).join(", "));
    const phoneDigits = String(store.phone || "").replace(/[^\d]/g, "");
    const whatsappUrl = /^https:\/\/wa\.me\/[\d]+(?:\?.*)?$/i.test(store.whatsapp_url || "")
      ? store.whatsapp_url
      : phoneDigits ? `https://wa.me/${phoneDigits}` : "";
    const mapUrl = /^https:\/\//i.test(store.location_map_embed_url || "")
      ? store.location_map_embed_url
      : addressQuery ? `https://www.google.com/maps?q=${addressQuery}&output=embed` : "";
    const directionsUrl = /^https:\/\//i.test(store.location_map_link || "")
      ? store.location_map_link
      : addressQuery ? `https://www.google.com/maps/search/?api=1&query=${addressQuery}` : "";
    const existing = footer.querySelector("[data-eshop-contact-footer]");
    const signature = JSON.stringify([
      store.whatsapp_enabled, store.whatsapp_url, store.phone, store.chatbot_enabled,
      store.chatbot_url, store.facebook_url, store.instagram_url, store.tiktok_url,
      store.youtube_url, store.x_url, address, place, mapUrl, directionsUrl
    ]);
    if (existing?.dataset.eshopContactSignature === signature) return;
    existing?.remove();
    document.querySelector("[data-eshop-floating-contacts]")?.remove();
    const contacts = document.createElement("section");
    contacts.dataset.eshopContactFooter = "";
    contacts.dataset.eshopContactSignature = signature;
    contacts.setAttribute("aria-label", "Store contact information");
    contacts.style.cssText = "display:grid;gap:14px;margin:24px auto 0;padding:18px 0 0;max-width:1100px;border-top:1px solid currentColor;font:inherit";
    const links = document.createElement("div");
    links.setAttribute("aria-label", "Social media and contact links");
    links.style.cssText = "display:flex;flex-wrap:wrap;align-items:center;gap:10px";
    if (store.whatsapp_enabled) {
      const link = iconLink("WhatsApp", whatsappUrl);
      if (link) links.append(link);
    }
    if (store.chatbot_enabled) {
      const link = iconLink("Chat with us", store.chatbot_url);
      if (link) links.append(link);
    }
    socialLinks.forEach(([label, href]) => {
      const link = iconLink(label, href);
      if (link) links.append(link);
    });
    if (directionsUrl) {
      const link = iconLink("Store location", directionsUrl);
      if (link) links.append(link);
    }
    if (links.childElementCount) contacts.append(links);
    if (address || place) {
      const location = document.createElement("div");
      const heading = document.createElement("strong");
      heading.textContent = place || "Find us";
      location.append(heading);
      if (address) {
        const text = document.createElement("p");
        text.textContent = address;
        text.style.margin = "5px 0";
        location.append(text);
      }
      if (mapUrl) {
        const frame = document.createElement("iframe");
        frame.src = mapUrl;
        frame.title = `${place || "Store"} location map`;
        frame.loading = "lazy";
        frame.referrerPolicy = "no-referrer-when-downgrade";
        frame.style.cssText = "display:block;width:100%;max-width:640px;height:220px;border:0;border-radius:var(--radius,8px)";
        location.append(frame);
      }
      contacts.append(location);
    }
    if (contacts.childElementCount) footer.append(contacts);
    const floatingLinks = [];
    if (store.whatsapp_enabled) {
      const link = iconLink("WhatsApp", whatsappUrl, true);
      if (link) floatingLinks.push(link);
    }
    if (store.chatbot_enabled) {
      const link = iconLink("Chat with us", store.chatbot_url, true);
      if (link) floatingLinks.push(link);
    }
    if (floatingLinks.length) {
      const rail = document.createElement("aside");
      rail.dataset.eshopFloatingContacts = "";
      rail.setAttribute("aria-label", "Quick contact");
      rail.style.cssText = "position:fixed;right:max(14px,env(safe-area-inset-right));bottom:max(22px,env(safe-area-inset-bottom));z-index:2147483000;display:flex;flex-direction:column;gap:11px;align-items:center";
      floatingLinks.forEach(link => rail.append(link));
      document.body.append(rail);
    }
  }

  function apply() {
    adaptProductGrids();
    bindCommerceActions();
    ensureCategoryBrowser();
    applyActiveCategoryFilter();
    applyStoreAppearance();
    applyContactFooter();
  }

  // The observer is paused while apply() runs, so the adapter's own DOM writes
  // can never re-trigger it. Theme-made changes are batched into one pass.
  const observerOptions = { childList: true, subtree: true };
  let observer = null;
  let applyTimer = 0;
  let passTimes = [];
  function safeApply() {
    applyTimer = 0;
    const now = Date.now();
    passTimes = passTimes.filter(time => now - time < 1000);
    if (passTimes.length >= 10) {
      console.warn("[eshop adapter] throttled: too many re-applies per second");
      applyTimer = setTimeout(safeApply, 500);
      return;
    }
    passTimes.push(now);
    if (observer) observer.disconnect();
    try {
      apply();
    } finally {
      if (observer) {
        observer.takeRecords();
        observer.observe(document.documentElement, observerOptions);
      }
    }
  }
  function scheduleApply() {
    if (!applyTimer) applyTimer = setTimeout(safeApply, 60);
  }

  observer = new MutationObserver(scheduleApply);
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", safeApply, { once: true });
  else safeApply();
  observer.observe(document.documentElement, observerOptions);
})();
