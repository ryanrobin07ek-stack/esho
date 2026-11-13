(function (global) {
  global.LITRUS_LIVE_CATALOG_VERSION = 1;
  function litrusRefreshPublishedCatalog(data, catalog) {
    if (!data || !catalog || !Array.isArray(catalog.products) || !Array.isArray(catalog.categories)) return;
    const slug = value => String(value || "").toLocaleLowerCase().replace(/&/g, " and ")
      .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "x";
    const categorySlugs = new Set();
    const categories = catalog.categories.map(category => {
      const name = String(category.name || "").trim();
      const base = slug(name);
      let categorySlug = base;
      let suffix = 2;
      while (categorySlugs.has(categorySlug)) categorySlug = `${base}-${suffix++}`;
      categorySlugs.add(categorySlug);
      return {
        id: String(category.id),
        name,
        slug: categorySlug,
        image: typeof category.image === "string" ? category.image : ""
      };
    }).filter(category => category.name);
    const categoryNames = new Map(categories.map(category => [category.id, category.name]));
    const products = catalog.products.filter(product => product && product.status !== "archived").map(product => {
      const images = Array.isArray(product.images)
        ? product.images.filter(value => typeof value === "string" && value).slice(0, 8)
        : [];
      const frames = Array.isArray(product.spin_frames)
        ? product.spin_frames.filter(value => typeof value === "string" && value).slice(0, 36)
        : [];
      const price = Number(product.price) || 0;
      return {
        id: String(product.id),
        name: String(product.name || ""),
        price,
        num: price,
        desc: String(product.description || ""),
        category_id: product.category_id || null,
        cats: categoryNames.has(String(product.category_id)) ? [categoryNames.get(String(product.category_id))] : [],
        img: images[0] || "",
        images,
        media_type: ["image", "cutout", "spin", "video"].includes(product.media_type) ? product.media_type : "image",
        spin_frames: frames,
        video_url: typeof product.video_url === "string" ? product.video_url : "",
        booking_enabled: product.booking_enabled === true || product.booking_enabled === 1,
        stock: Number(product.stock) || 0,
        variants: Array.isArray(product.variants) ? product.variants.slice(0, 100) : [],
        sizes: Array.isArray(product.sizes) ? product.sizes.slice(0, 20) : [],
        colors: Array.isArray(product.colors) ? product.colors.slice(0, 20) : [],
        taxonomy_category_id: product.taxonomy_category_id || null,
        taxonomy_category_name: String(product.taxonomy_category_name || product.taxonomy_custom_category || ""),
        taxonomy_attributes: Array.isArray(product.taxonomy_attributes) ? product.taxonomy_attributes.slice(0, 30) : []
      };
    }).filter(product => product.id && product.name);
    const store = catalog.store || {};
    const previousProducts = Array.isArray(data.shop.products) ? data.shop.products.slice() : [];
    data.shop = {
      ...data.shop,
      name: String(store.name || data.shop.name),
      cur: String(store.currency || data.shop.cur || "KES"),
      wa: String(store.whatsapp || store.whatsapp_number || data.shop.wa || ""),
      email: String(store.email || ""),
      phone: String(store.phone || ""),
      addr: String(store.location_address || store.address || ""),
      fee: Number(store.delivery_fee) || 0,
      free: Number(store.free_delivery_over) || 0,
      cats: categories.map(category => ({ name: category.name, slug: category.slug })),
      products
    };
    const parse = html => {
      const container = document.createElement("div");
      container.innerHTML = String(html || "");
      return container;
    };
    const updateCard = (card, product) => {
      card.dataset.pid = product.id;
      card.dataset.cats = product.cats.join("|");
      const title = card.querySelector(".p-title");
      if (title) title.textContent = product.name;
      const price = card.querySelector(".p-price");
      if (price) price.textContent = (data.shop.cur ? `${data.shop.cur} ` : "") + product.price.toLocaleString("en-US");
      const description = card.querySelector(".p-desc");
      if (description) description.textContent = product.desc;
      card.dataset.price = String(product.price);
      card.dataset.sizes = product.sizes.join("|");
      card.dataset.colors = product.colors.join("|");
      card.dataset.taxonomyAttributes = JSON.stringify(product.taxonomy_attributes);
      card.dataset.categoryId = String(product.category_id || "");
      card.dataset.productType = product.taxonomy_category_name;
      card.querySelectorAll("[data-add]").forEach(button => button.setAttribute("data-add", product.id));
      const image = card.querySelector(".p-img-wrapper img,.p-image img,img");
      if (image) {
        image.alt = product.name;
        if (product.img) image.src = product.img;
        else image.removeAttribute("src");
      }
      return card;
    };
    const cardTemplate = () => {
      const template = parse(data.templates && data.templates.productCard);
      return template.firstElementChild;
    };
    const fillProducts = (section, list) => {
      if (!section) return;
      const template = section.querySelector("[data-pid]") || cardTemplate();
      if (!template) return;
      const cards = list.map(product => updateCard(template.cloneNode(true), product));
      const children = Array.from(section.children);
      const splitRight = children.find(child => child.classList.contains("split-right"));
      const marquee = children.filter(child => child.classList.contains("mq0") || child.classList.contains("mq1"));
      const tabGrid = children.find(child => child.classList.contains("tgrid"));
      if (splitRight) {
        splitRight.replaceChildren(...cards);
        return;
      }
      if (marquee.length) {
        marquee.forEach(row => row.replaceChildren(
          ...cards.map(card => card.cloneNode(true)),
          ...cards.map(card => card.cloneNode(true))
        ));
        return;
      }
      if (tabGrid) {
        tabGrid.replaceChildren(...cards);
        const tabBar = children.find(child => child.classList.contains("tabs-bar"));
        if (tabBar) {
          const names = [...new Set(products.flatMap(product => product.cats))].slice(0, 5);
          tabBar.replaceChildren(...[["", "All"], ...names.map(name => [name, name])].map(([key, label], index) => {
            const button = document.createElement("button");
            button.type = "button";
            button.setAttribute("role", "tab");
            button.dataset.tab = key;
            button.setAttribute("aria-selected", index ? "false" : "true");
            if (!index) button.className = "on";
            button.textContent = label;
            return button;
          }));
        }
        return;
      }
      section.replaceChildren(...cards);
    };
    const pages = data.pages || {};
    const detailTemplate = Object.keys(pages)
      .map(key => key.indexOf("p/") === 0 ? parse(pages[key]).querySelector(".sp-pdp") : null)
      .find(Boolean);
    const detailKey = Object.keys(pages).find(key => key.indexOf("p/") === 0 &&
      parse(pages[key]).querySelector(".sp-pdp"));
    const detailBase = detailTemplate ? parse(pages[detailKey]) : null;
    const renderDetails = (product, related) => {
      const page = detailBase ? detailBase.cloneNode(true) : document.createElement("div");
      if (!page.querySelector(".sp-main")) {
        page.innerHTML = '<main class="sp sp-main"><div class="sp-top"><nav class="sp-crumbs"><a href="#" data-go="home">Home</a></nav><h1></h1></div><div class="sp-wrap sp-pdp"><div class="sp-gallery"></div><div class="sp-info"><div class="sp-price"></div><p class="sp-desc"></p><div class="sp-buy"><button type="button" class="sp-btn" data-act="addqty">Add to bag</button></div><button type="button" class="sp-btn ghost" data-act="buynow">Buy now</button></div></div></main>';
      }
      const main = page.querySelector(".sp-main");
      const heading = page.querySelector(".sp-top h1");
      if (main) main.dataset.route = `p/${product.id}`;
      if (heading) heading.textContent = product.name;
      const price = page.querySelector(".sp-price");
      if (price) price.textContent = (data.shop.cur ? `${data.shop.cur} ` : "") + product.price.toLocaleString("en-US");
      const description = page.querySelector(".sp-desc");
      if (description) description.textContent = product.desc;
      page.querySelectorAll(".sp-buy [data-act='addqty']").forEach(button => {
        button.textContent = "Add to bag";
        button.dataset.pid = product.id;
      });
      page.querySelectorAll("[data-pid],[data-add]").forEach(button => button.setAttribute("data-pid", product.id));
      const info = page.querySelector(".sp-info");
      if (info) {
        info.querySelectorAll("[data-litrus-product-hold-form]").forEach(form => form.remove());
        if (product.booking_enabled && product.stock > 0) {
          const form = document.createElement("form");
          form.className = "sp-hold-form";
          form.dataset.litrusProductHoldForm = "";
          form.dataset.productId = product.id;
          const heading = document.createElement("h2");
          heading.textContent = "Reserve this product";
          const note = document.createElement("p");
          note.textContent = `Reserve up to ${product.stock} available.`;
          const quantityLabel = document.createElement("label");
          quantityLabel.textContent = "Quantity";
          const quantity = document.createElement("input");
          quantity.name = "quantity";
          quantity.type = "number";
          quantity.min = "1";
          quantity.max = String(product.stock);
          quantity.value = "1";
          quantity.required = true;
          quantityLabel.append(quantity);
          const nameLabel = document.createElement("label");
          nameLabel.textContent = "Your name";
          const name = document.createElement("input");
          name.name = "customer_name";
          name.autocomplete = "name";
          name.required = true;
          nameLabel.append(name);
          const contactLabel = document.createElement("label");
          contactLabel.textContent = "Email or phone";
          const contact = document.createElement("input");
          contact.name = "contact";
          contact.autocomplete = "email tel";
          contact.required = true;
          contactLabel.append(contact);
          const submit = document.createElement("button");
          submit.type = "submit";
          submit.className = "sp-btn";
          submit.textContent = "Reserve this product";
          const status = document.createElement("p");
          status.className = "sp-hold-status";
          status.setAttribute("role", "status");
          form.append(heading, note, quantityLabel, nameLabel, contactLabel, submit, status);
          info.append(form);
        }
      }
      const gallery = page.querySelector(".sp-gallery");
      if (gallery) {
        gallery.replaceChildren();
        const productImages = product.images.length ? product.images : product.img ? [product.img] : [];
        if (product.media_type === "video" && product.video_url) {
          const video = document.createElement("video");
          video.src = product.video_url;
          video.controls = true;
          video.playsInline = true;
          video.preload = "metadata";
          video.setAttribute("aria-label", `${product.name} product video`);
          if (product.img) video.poster = product.img;
          gallery.append(video);
        } else if (product.media_type === "spin" && product.spin_frames.length > 1) {
          const image = document.createElement("img");
          image.src = product.spin_frames[0];
          image.alt = product.name;
          image.draggable = false;
          image.dataset.spinFrames = JSON.stringify(product.spin_frames);
          gallery.append(image);
        } else if (productImages.length) {
          const image = document.createElement("img");
          image.src = productImages[0];
          image.alt = product.name;
          if (product.media_type === "cutout") image.className = "sp-cutout";
          gallery.append(image);
        }
        if (productImages.length > 1 && product.media_type !== "spin") {
          const thumbnails = document.createElement("div");
          thumbnails.className = "sp-gallery-thumbs";
          thumbnails.style.cssText = "display:flex;flex-wrap:wrap;gap:8px;margin-top:12px";
          productImages.forEach((url, index) => {
            const button = document.createElement("button");
            button.type = "button";
            button.dataset.galleryImage = url;
            button.setAttribute("aria-label", `Show product photo ${index + 1}`);
            button.style.cssText = "width:64px;height:64px;padding:2px;border:1px solid #d5d5d5;background:#fff";
            const thumbnail = document.createElement("img");
            thumbnail.src = url;
            thumbnail.alt = "";
            thumbnail.style.cssText = "width:100%;height:100%;object-fit:cover";
            button.append(thumbnail);
            thumbnails.append(button);
          });
          gallery.append(thumbnails);
        }
      }
      const variants = product.variants.filter(variant => variant && (variant.size || variant.color));
      const buyArea = page.querySelector(".sp-buy");
      if (variants.length && buyArea) {
        const picker = document.createElement("div");
        picker.className = "sp-variant-picker";
        picker.dataset.productVariantPicker = product.id;
        picker.style.cssText = "display:grid;gap:10px;margin:16px 0";
        const dimensions = [
          ["size", [...new Set(variants.map(variant => String(variant.size || "")).filter(Boolean))], "Choose size"],
          ["color", [...new Set(variants.map(variant => String(variant.color || "")).filter(Boolean))], "Choose color"]
        ];
        dimensions.forEach(([name, values, placeholder]) => {
          if (!values.length) return;
          const label = document.createElement("label");
          label.textContent = name === "size" ? "Size" : "Color";
          label.style.cssText = "display:grid;gap:6px";
          const select = document.createElement("select");
          select.dataset.variantOption = name;
          select.required = true;
          select.style.cssText = "min-height:44px;padding:8px";
          const empty = document.createElement("option");
          empty.value = "";
          empty.textContent = placeholder;
          select.append(empty);
          values.forEach(value => {
            const option = document.createElement("option");
            option.value = value;
            option.textContent = value;
            select.append(option);
          });
          label.append(select);
          picker.append(label);
        });
        buyArea.prepend(picker);
        page.querySelectorAll(".sp-buy [data-act='addqty']").forEach(button => {
          button.disabled = true;
          button.dataset.variantRequired = "true";
        });
      }
      fillProducts(page.querySelector(".prods"), related.filter(item => item.id !== product.id).slice(0, 4));
      return page.innerHTML;
    };
    const listHtml = (source, title, list) => {
      const page = parse(source);
      page.querySelectorAll("[data-catalog-filters]").forEach(filters => filters.remove());
      const main = page.querySelector(".sp-main");
      const heading = page.querySelector(".sp-top h1");
      if (main) main.dataset.route = title === "All products" ? "shop" : `c/${slug(title)}`;
      if (heading) heading.textContent = title;
      const subtitle = page.querySelector(".sp-top p");
      if (subtitle) subtitle.textContent = list.length + (list.length === 1 ? " item" : " items");
      let section = page.querySelector(".sp-main .prods");
      if (!section) {
        section = document.createElement("section");
        section.className = "prods";
        if (main) main.append(section);
      }
      if (main) {
        const sizes = [...new Set(list.flatMap(product => product.sizes))].sort();
        const colors = [...new Set(list.flatMap(product => product.colors))].sort();
        const productTypes = [...new Set(list.map(product => product.taxonomy_category_name).filter(Boolean))].sort();
        const filters = document.createElement("form");
        filters.className = "sp-catalog-filters";
        filters.dataset.catalogFilters = "";
        filters.style.cssText = "display:flex;flex-wrap:wrap;gap:12px;align-items:end;margin:16px 0 24px;padding:16px;border:1px solid #dedee2;border-radius:12px";
        filters.addEventListener("submit", event => event.preventDefault());
        const addSelect = (name, labelText, values) => {
          if (!values.length) return;
          const label = document.createElement("label");
          label.textContent = labelText;
          label.style.cssText = "display:grid;gap:6px;min-width:140px";
          const select = document.createElement("select");
          select.dataset.catalogFilter = name;
          select.style.cssText = "min-height:40px;padding:6px";
          const all = document.createElement("option");
          all.value = "";
          all.textContent = `All ${labelText.toLocaleLowerCase()}s`;
          select.append(all);
          values.forEach(value => {
            const option = document.createElement("option");
            option.value = String(value.id ?? value);
            option.textContent = String(value.name ?? value);
            select.append(option);
          });
          label.append(select);
          filters.append(label);
        };
        if (title === "All products") addSelect("category", "Category", categories);
        addSelect("product-type", "Product type", productTypes);
        [["min-price", "Minimum price"], ["max-price", "Maximum price"]].forEach(([name, labelText]) => {
          const label = document.createElement("label");
          label.textContent = labelText;
          label.style.cssText = "display:grid;gap:6px;min-width:140px";
          const input = document.createElement("input");
          input.type = "number";
          input.min = "0";
          input.step = "0.01";
          input.dataset.catalogFilter = name;
          input.style.cssText = "min-height:40px;padding:6px";
          label.append(input);
          filters.append(label);
        });
        addSelect("size", "Size", sizes);
        addSelect("color", "Color", colors);
        const attributes = new Map();
        list.forEach(product => product.taxonomy_attributes.forEach(attribute => {
          if (!attribute?.attributeName || !attribute.value) return;
          if (!attributes.has(attribute.attributeName)) attributes.set(attribute.attributeName, new Set());
          attributes.get(attribute.attributeName).add(attribute.value);
        }));
        [...attributes.entries()].sort(([left], [right]) => left.localeCompare(right)).forEach(([name, values]) => {
          addSelect(`attribute:${name}`, name, [...values].sort());
        });
        if (filters.children.length && section.parentElement === main) main.insertBefore(filters, section);
      }
      fillProducts(section, list);
      return page.innerHTML;
    };
    const home = parse(pages.home);
    const homeSection = home.querySelector(".sp-main .prods");
    fillProducts(homeSection, products);
    const categoryTiles = home.querySelector(".cats");
    if (categoryTiles) {
      const heading = categoryTiles.querySelector(".sole-category-heading");
      const tileTemplate = categoryTiles.querySelector(".sole-category-chip") || categoryTiles.querySelector("a[href]") || (() => {
        const tile = document.createElement("a");
        tile.className = "sole-category-chip";
        return tile;
      })();
      categoryTiles.replaceChildren(...(heading ? [heading] : []), ...categories.map(category => {
        const tile = tileTemplate.cloneNode(true);
        const label = tile.querySelector("span,h4") || tile;
        tile.setAttribute("href", "#");
        tile.dataset.go = `c/${category.slug}`;
        if (label) label.textContent = category.name;
        const image = tile.querySelector("img");
        if (image && !tile.classList.contains("sole-category-chip")) {
          image.alt = category.name;
          if (category.image) image.src = category.image;
        }
        return tile;
      }));
    }
    if (homeSection || categoryTiles) pages.home = home.innerHTML;
    pages.shop = listHtml(pages.shop || pages.home, "All products", products);
    Object.keys(pages).filter(key => key.indexOf("c/") === 0 || key.indexOf("p/") === 0)
      .forEach(key => delete pages[key]);
    categories.forEach(category => {
      pages[`c/${category.slug}`] = listHtml(
        pages.shop,
        category.name,
        products.filter(product => product.cats.includes(category.name))
      );
    });
    products.forEach(product => {
      pages[`p/${product.id}`] = renderDetails(product, products);
    });
    previousProducts.forEach(previous => {
      const match = products.find(product =>
        product.name.trim().toLocaleLowerCase() === String(previous.name || "").trim().toLocaleLowerCase() &&
        Number(product.price) === Number(previous.num || previous.price)
      );
      if (match && String(previous.id) !== match.id) pages[`p/${previous.id}`] = pages[`p/${match.id}`];
    });
    if (data.shell && typeof data.shell.head === "string") {
      const shell = parse(data.shell.head);
      const nav = shell.querySelector(".sp-nav");
      if (nav) {
        const links = categories.map(category => {
          const link = document.createElement("a");
          link.href = "#";
          link.dataset.go = `c/${category.slug}`;
          link.textContent = category.name;
          return link;
        });
        const all = document.createElement("a");
        all.href = "#";
        all.dataset.go = "shop";
        all.textContent = "All products";
        nav.replaceChildren(...links, all);
        data.shell.head = shell.innerHTML;
      }
    }
  }

  function litrusInitLiveSpin(root) {
    let image = null;
    let frames = [];
    let startX = 0;
    let index = 0;
    root.addEventListener("pointerdown", event => {
      const target = event.target.closest && event.target.closest("img[data-spin-frames]");
      if (!target) return;
      try {
        frames = JSON.parse(target.dataset.spinFrames);
      } catch {
        return;
      }
      if (!Array.isArray(frames) || frames.length < 2) return;
      image = target;
      startX = event.clientX;
      index = Math.max(0, frames.indexOf(image.src));
      image.setPointerCapture(event.pointerId);
    });
    root.addEventListener("pointermove", event => {
      if (!image || !frames.length) return;
      const next = (index + Math.round((startX - event.clientX) / 12) + frames.length * 100) % frames.length;
      image.src = frames[next];
    });
    const stop = () => {
      image = null;
      frames = [];
    };
    root.addEventListener("pointerup", stop);
    root.addEventListener("pointercancel", stop);
  }

  function installPaystackOption(form) {
    if (form.dataset.eshopPaystackOption === "true") return;
    const group = form.querySelector('input[name="pay"]')?.closest(".sp-radios");
    if (!group) return;
    const option = document.createElement("label");
    option.className = "sp-radio";
    const input = document.createElement("input");
    input.type = "radio";
    input.name = "pay";
    input.value = "paystack";
    input.checked = true;
    const label = document.createElement("span");
    label.textContent = "Pay securely with Paystack";
    const hint = document.createElement("small");
    hint.textContent = "M-Pesa or card";
    label.append(hint);
    option.append(input, label);
    group.prepend(option);
    form.querySelectorAll('input[name="pay"]').forEach(item => {
      item.checked = item === input;
    });
    const email = form.querySelector('input[name="email"]');
    if (email) {
      email.required = true;
      const note = email.closest("label")?.querySelector("small");
      if (note) note.textContent = "(required for your order and Paystack receipt)";
    }
    form.dataset.eshopPaystackOption = "true";
  }

  async function postStorefrontJson(path, payload) {
    const response = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || `Checkout failed (${response.status}).`);
    return result;
  }

  function showManualOrder(root, order, customer, delivery, payment, via, data) {
    const message = [
      `New order ${order.order_number} for ${data.shop.name}`,
      "",
      `Name: ${customer.name}`,
      `Phone: ${customer.phone}`,
      `Email: ${customer.email}`,
      `Delivery: ${delivery === "pickup" ? "Pickup" : [customer.address, customer.town].filter(Boolean).join(", ")}`,
      `Payment: ${payment}`,
      "",
      "Items:",
      ...order.items.map(item => `- ${item.quantity} x ${item.name} (${item.unit_price} ${order.currency})`),
      "",
      `Subtotal: ${order.subtotal} ${order.currency}`,
      `Delivery: ${order.shipping} ${order.currency}`,
      `Total: ${order.total} ${order.currency}`
    ].join("\n");
    const section = document.createElement("main");
    section.className = "sp sp-main";
    const content = document.createElement("div");
    content.className = "sp-wrap sp-done";
    const heading = document.createElement("h1");
    heading.textContent = `Thank you, ${customer.name.split(/\s+/)[0]}!`;
    const confirmation = document.createElement("p");
    confirmation.textContent = `Order ${order.order_number} has been saved.`;
    const summary = document.createElement("pre");
    summary.className = "sp-order-message";
    summary.textContent = message;
    content.append(heading, confirmation, summary);
    if (via === "wa" && data.shop.wa) {
      const link = document.createElement("a");
      link.className = "sp-btn";
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.href = `https://wa.me/${String(data.shop.wa).replace(/\D/g, "")}?text=${encodeURIComponent(message)}`;
      link.textContent = "Send order on WhatsApp";
      content.append(link);
    } else if (via === "mail" && data.shop.email) {
      const link = document.createElement("a");
      link.className = "sp-btn";
      link.href = `mailto:${data.shop.email}?subject=${encodeURIComponent(`Order ${order.order_number} - ${data.shop.name}`)}&body=${encodeURIComponent(message)}`;
      link.textContent = "Send order by email";
      content.append(link);
    }
    const back = document.createElement("a");
    back.className = "sp-btn ghost";
    back.href = "/#/";
    back.textContent = "Back to the shop";
    content.append(back);
    section.append(content);
    root.replaceChildren(section);
    try {
      localStorage.setItem(`sp:${data.shop.key}:cart`, "[]");
    } catch (error) {
      console.warn("The saved order is complete, but the cart could not be cleared.", error);
    }
  }

  async function startStorefrontCheckout(form, root, data) {
    const error = form.querySelector(".sp-err");
    const submit = form.querySelector('button[type="submit"]');
    const value = name => String(form.elements[name]?.value || "").trim();
    const selected = name => form.querySelector(`[name="${name}"]:checked`)?.value || "";
    const customer = {
      name: value("name"),
      phone: value("phone"),
      email: value("email").toLowerCase(),
      town: value("town"),
      address: value("addr")
    };
    const delivery = selected("dm") || "delivery";
    const payment = selected("pay") || "paystack";
    const via = selected("via") || value("via") || "none";
    let cart;
    try {
      cart = JSON.parse(localStorage.getItem(`sp:${data.shop.key}:cart`) || "[]");
    } catch {
      if (error) error.textContent = "Your cart could not be read. Refresh the shop and try again.";
      return;
    }
    const items = Array.isArray(cart) ? cart.filter(item =>
      item && (typeof item.id === "string" || typeof item.id === "number") &&
      Number.isSafeInteger(Number(item.q)) && Number(item.q) > 0
    ).map(item => ({ product_id: String(item.id), quantity: Number(item.q) })) : [];
    if (!customer.name) {
      if (error) error.textContent = "Please enter your name.";
      return;
    }
    if (customer.phone.replace(/\D/g, "").length < 7) {
      if (error) error.textContent = "Please enter a phone number we can reach you on.";
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.email)) {
      if (error) error.textContent = "Enter a valid email address for your order and Paystack receipt.";
      return;
    }
    if (delivery === "delivery" && !customer.address && !customer.town) {
      if (error) error.textContent = "Please tell us where to deliver.";
      return;
    }
    if (!items.length) {
      if (error) error.textContent = "Your cart is empty.";
      return;
    }
    if (error) error.textContent = "";
    const signature = JSON.stringify({ items, customer, delivery });
    if (form.dataset.cartSignature !== signature || !form.dataset.idempotencyKey) {
      form.dataset.cartSignature = signature;
      form.dataset.idempotencyKey = crypto.randomUUID();
    }
    if (submit) submit.disabled = true;
    try {
      const created = await postStorefrontJson("/api/orders", {
        idempotency_key: form.dataset.idempotencyKey,
        customer_name: customer.name,
        customer_email: customer.email,
        customer_phone: customer.phone,
        shipping_address: delivery === "pickup" ? "Store pickup" : customer.address || customer.town,
        city: customer.town,
        delivery_method: delivery,
        items
      });
      if (!created.order?.order_number) throw new Error("The shop did not confirm the order.");
      if (payment === "paystack") {
        const initialized = await postStorefrontJson("/api/payments/paystack/initialize", {
          order_number: created.order.order_number
        });
        const checkout = new URL(initialized.authorization_url);
        if (checkout.protocol !== "https:" || checkout.hostname !== "checkout.paystack.com") {
          throw new Error("Paystack returned an unsafe checkout link.");
        }
        location.assign(checkout.href);
        return;
      }
      showManualOrder(root, created.order, customer, delivery, payment, via, data);
    } catch (caught) {
      if (error) error.textContent = caught instanceof Error ? caught.message : "Your order could not be sent.";
      if (submit) submit.disabled = false;
    }
  }

  async function verifyStorefrontPaymentReturn(root, data) {
    const match = location.hash.match(/^#\/checkout\/confirmation(?:\?(.*))?$/);
    if (!match) return;
    const query = new URLSearchParams(match[1] || "");
    const reference = query.get("reference") || "";
    const orderNumber = query.get("orderId") || "";
    const message = document.createElement("p");
    message.textContent = "Checking your Paystack payment…";
    root.replaceChildren(message);
    try {
      if (!/^ESHOP_[A-F0-9]{32}$/.test(reference)) {
        throw new Error("The payment reference is invalid.");
      }
      const response = await fetch(`/api/payments/paystack/verify?reference=${encodeURIComponent(reference)}`, {
        cache: "no-store"
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Paystack payment could not be verified.");
      if (result.payment_status !== "paid") {
        throw new Error("Payment is not confirmed yet. Your order is saved; contact the shop if you were charged.");
      }
      localStorage.setItem(`sp:${data.shop.key}:cart`, "[]");
      message.textContent = `Payment confirmed. Order ${result.order_number || orderNumber} is complete.`;
    } catch (caught) {
      message.textContent = caught instanceof Error ? caught.message : "Payment could not be verified.";
    }
    const back = document.createElement("a");
    back.className = "sp-btn";
    back.href = "/#/";
    back.textContent = "Continue shopping";
    root.append(back);
  }

  async function requestProductHold(form, data) {
    const product = data.shop.products.find(item => String(item.id) === String(form.dataset.productId));
    const submit = form.querySelector("button[type='submit']");
    const status = form.querySelector(".sp-hold-status");
    const fields = new FormData(form);
    if (!product) {
      if (status) status.textContent = "This product is no longer available.";
      return;
    }
    if (submit) submit.disabled = true;
    if (status) status.textContent = "Reserving the requested quantity…";
    try {
      const response = await fetch("/api/product-holds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idempotency_key: crypto.randomUUID(),
          product_id: String(product.id),
          quantity: Number(fields.get("quantity")) || 1,
          customer_name: fields.get("customer_name"),
          contact: fields.get("contact")
        })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Could not hold this product.");
      const hold = result.hold;
      if (!hold?.id || !hold?.expires_at) throw new Error("The shop did not confirm this product hold.");
      const key = `eshop-holds:${location.host}`;
      let holds = [];
      try {
        const saved = JSON.parse(localStorage.getItem(key) || "[]");
        if (Array.isArray(saved)) holds = saved;
      } catch (error) {
        console.warn("Saved product holds could not be read.", error);
      }
      holds.push({
        id: hold.id,
        product_id: String(hold.product_id),
        quantity: Number(hold.quantity),
        expires_at: hold.expires_at,
        customer_name: String(fields.get("customer_name") || "").trim(),
        contact: String(fields.get("contact") || "").trim()
      });
      try {
        localStorage.setItem(key, JSON.stringify(holds.slice(-100)));
      } catch (error) {
        console.warn("Product hold could not be saved on this device.", error);
        if (status) status.textContent = `Held ${hold.quantity} ${product.name}, but this device could not save the reservation for checkout.`;
        form.reset();
        return;
      }
      if (status) status.textContent = `Held ${hold.quantity} ${product.name} until ${new Date(hold.expires_at).toLocaleString()}.`;
      form.reset();
    } catch (error) {
      console.error("Product hold request failed.", error);
      if (status) status.textContent = error instanceof Error ? error.message : "Could not hold this product. Please try again.";
    } finally {
      if (submit) submit.disabled = false;
    }
  }

  function litrusStartLiveStore(data) {
    const catalog = global.__ESHOP_THEME_CATALOG__;
    if (!catalog || !Array.isArray(catalog.products) || !Array.isArray(catalog.categories)) {
      console.error("The published Litrus catalogue is missing from this storefront.");
      return;
    }
    litrusRefreshPublishedCatalog(data, catalog);
    const root = document.getElementById("store");
    if (!root) return;
    if (/^#\/checkout\/confirmation(?:\?|$)/.test(location.hash)) {
      void verifyStorefrontPaymentReturn(root, data);
      return;
    }
    const trackEvent = (productId, type, count = 1) => {
      if (typeof global.__ESHOP_TRACK_STOREFRONT_EVENT__ === "function") {
        global.__ESHOP_TRACK_STOREFRONT_EVENT__(String(productId), type, count);
      }
    };
    root.addEventListener("click", event => {
      const target = event.target instanceof Element ? event.target : null;
      const action = target?.closest("[data-act]");
      if (action) {
        const type = action.dataset.act;
        const productId = action.dataset.pid || action.dataset.add;
        if (productId && ["addqty", "buynow", "inc"].includes(type)) {
          trackEvent(productId, "cart_add", type === "inc" ? 1 :
            Number(root.querySelector(".sp-qtyv")?.value) || 1);
        }
        return;
      }
      const add = target?.closest("[data-add]");
      const productId = add?.dataset.add;
      if (productId) trackEvent(productId, "cart_add");
    }, true);
    root.addEventListener("submit", event => {
      const form = event.target instanceof HTMLFormElement && event.target.matches("[data-litrus-product-hold-form]")
        ? event.target
        : null;
      if (form) {
        event.preventDefault();
        event.stopImmediatePropagation();
        void requestProductHold(form, data);
        return;
      }
      if (event.target?.id !== "spco") return;
      event.preventDefault();
      event.stopImmediatePropagation();
      void startStorefrontCheckout(event.target, root, data);
    }, true);
    global.LITRUS_RUNTIME = global.SPRT({
      root,
      hash: true,
      shop: () => data.shop,
      page: route => data.pages[route] == null ? null : data.pages[route],
      shell: () => data.shell,
      scrollTop: () => scrollTo(0, 0),
      after: (wrap, route) => {
        const productRoute = String(route).match(/^p\/(.+)$/);
        if (productRoute) trackEvent(productRoute[1], "view");
        if (route === "checkout") {
          const form = root.querySelector("#spco");
          if (form) installPaystackOption(form);
        }
      }
    });
    litrusInitLiveSpin(document);
  }

  global.litrusRefreshPublishedCatalog = litrusRefreshPublishedCatalog;
  global.litrusInitLiveSpin = litrusInitLiveSpin;
  global.litrusStartLiveStore = litrusStartLiveStore;
})(window);
