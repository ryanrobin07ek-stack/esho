(function (global) {
  global.LITRUS_LIVE_CATALOG_VERSION = 1;
  function litrusRefreshPublishedCatalog(data, catalog) {
    if (!data || !catalog || !Array.isArray(catalog.products) || !Array.isArray(catalog.categories)) return;
    const slug = value => String(value || "").toLocaleLowerCase().replace(/&/g, " and ")
      .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "x";
    const fallbackProductImage = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 244 200" preserveAspectRatio="xMidYMid slice">' +
      '<rect width="100%" height="100%" fill="#e9d8c4"/>' +
      '<rect x="62" y="58" width="120" height="100" rx="14" fill="rgba(0,0,0,.28)"/>' +
      '<circle cx="122" cy="108" r="22" fill="rgba(255,255,255,.45)"/></svg>'
    );
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
        img: images[0] || frames[0] || "",
        images,
        media_type: ["image", "cutout", "spin", "video"].includes(product.media_type) ? product.media_type : "image",
        spin_frames: frames,
        video_url: typeof product.video_url === "string" ? product.video_url : "",
        booking_enabled: product.booking_enabled === true || product.booking_enabled === 1,
        // Only a service carries a duration. Defaulting every product to an hour made the whole
        // catalogue look bookable, which is what hid a mixed shop's real services.
        duration_minutes: Number(product.duration_minutes) > 0 ? Number(product.duration_minutes) : 0,
        stock: Number(product.stock) || 0,
        variants: Array.isArray(product.variants) ? product.variants.slice(0, 100).map(variant => ({
          ...(variant && typeof variant === "object" ? variant : {}),
          size: variant?.size ?? variant?.option1_value ?? "",
          color: variant?.color ?? variant?.option2_value ?? ""
        })) : [],
        option1_name: String(product.option1_name || product.variants?.[0]?.option1_name ||
          (product.sizes?.length || product.variants?.[0]?.option1_value || product.variants?.[0]?.size ? "Size" : "")),
        option2_name: String(product.option2_name || product.variants?.[0]?.option2_name ||
          (product.colors?.length || product.variants?.[0]?.option2_value || product.variants?.[0]?.color ? "Color" : "")),
        sizes: Array.isArray(product.sizes) && product.sizes.length ? product.sizes.slice(0, 20) :
          [...new Set((product.variants || []).map(variant => String(variant.option1_value ?? variant.size ?? "")).filter(Boolean))].slice(0, 20),
        colors: Array.isArray(product.colors) && product.colors.length ? product.colors.slice(0, 20) :
          [...new Set((product.variants || []).map(variant => String(variant.option2_value ?? variant.color ?? "")).filter(Boolean))].slice(0, 20),
        taxonomy_category_id: product.taxonomy_category_id || null,
        taxonomy_category_name: String(product.taxonomy_category_name || product.taxonomy_custom_category || ""),
        taxonomy_attributes: Array.isArray(product.taxonomy_attributes) ? product.taxonomy_attributes.slice(0, 30) : [],
        priced_attributes: Array.isArray(product.priced_attributes) ? product.priced_attributes.slice(0, 5) : []
      };
    }).filter(product => product.id && product.name);
    const store = catalog.store || {};
    const previousProducts = Array.isArray(data.shop.products) ? data.shop.products.slice() : [];
    data.shop = {
      ...data.shop,
      name: String(store.name || data.shop.name),
      cur: String(store.currency || data.shop.cur || "KES"),
      offerType: store.offer_type === "services" ? "services" :
        store.offer_type === "products" ? "products" : String(data.shop.offerType || ""),
      serviceTimezone: String(store.service_timezone || "Africa/Nairobi"),
      serviceDepositPercent: Number(store.service_deposit_percent) || 0,
      // Mirrors the Worker: a missing or invalid value means the default of 2 hours.
      serviceCancelCutoffHours: (() => {
        const hours = Number(store.service_cancel_cutoff_hours);
        return store.service_cancel_cutoff_hours !== null && store.service_cancel_cutoff_hours !== "" &&
          Number.isInteger(hours) && hours >= 0 && hours <= 168 ? hours : 2;
      })(),
      // The Worker publishes the shop's real Paystack connection as store.paystack_connected. An absent
      // flag (an older Worker) is "unknown" (null), which keeps the original behaviour: Paystack offered,
      // email required. Only an explicit 0/false hides Paystack and makes the email optional.
      paystackConnected: store.paystack_connected === true || store.paystack_connected === 1 || store.paystack_connected === "1"
        ? true
        : store.paystack_connected === false || store.paystack_connected === 0 || store.paystack_connected === "0" ? false : null,
      directPayments: directPaymentChoices(store.payment_options),
      wa: String(store.whatsapp || store.whatsapp_number || data.shop.wa ||
        (store.whatsapp_enabled ? (String(store.whatsapp_url || "").match(/wa\.me\/\+?(\d{7,15})/i) || [])[1] || "" : "")),
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
    // A service is a property of the product. Asking the shop instead left a shop selling goods
    // and time unable to book anything, and called every shelf item in a salon a service.
    const sellsTime = product => Number(product?.duration_minutes) > 0
       // A shop that sells nothing but services is the fallback: its products were saved before
       // durations were ever asked for, so none of them carries one.
       || data.shop.offerType === "services";
    const updateCard = (card, product) => {
      card.dataset.pid = product.id;
      card.dataset.cats = product.cats.join("|");
      const title = card.querySelector(".p-title");
      if (title) title.textContent = product.name;
      const price = card.querySelector(".p-price");
      if (price) {
        // A shirt priced 1,000 to 1,500 used to read "KES 1,000" on every card, because the card
        // only ever showed the base price. Browsing now shows the lowest it can actually be bought for.
        const base = Number(product.price) || 0;
        const offered = (product.variants || [])
          .map(variant => (variant && variant.price != null ? Number(variant.price) : base))
          .filter(amount => Number.isFinite(amount) && amount > 0);
        const asMoney = amount => (data.shop.cur ? data.shop.cur + " " : "") + amount.toLocaleString("en-US");
        const varies = offered.length > 1 && Math.min(...offered) !== Math.max(...offered);
        price.textContent = varies ? "from " + asMoney(Math.min(...offered)) : asMoney(base);
      }
      const description = card.querySelector(".p-desc");
      if (description) description.textContent = product.desc;
      card.dataset.price = String(product.price);
      card.dataset.sizes = product.sizes.join("|");
      card.dataset.colors = product.colors.join("|");
      card.dataset.taxonomyAttributes = JSON.stringify(product.taxonomy_attributes);
      card.dataset.categoryId = String(product.category_id || "");
      card.dataset.productType = product.taxonomy_category_name;
      const addButtons = sellsTime(product)
        ? card.querySelectorAll("[data-add], .sole-product-add, .p-btn, [data-act='addqty']")
        : card.querySelectorAll("[data-add]");
      addButtons.forEach(button => {
        if (sellsTime(product)) {
          button.removeAttribute("data-add");
          button.removeAttribute("data-act");
          button.dataset.go = `p/${product.id}`;
          button.textContent = "Book now";
          button.hidden = false;
          button.style.display = "";
          button.setAttribute("aria-label", `Book ${product.name}`);
        } else {
          button.setAttribute("data-add", product.id);
          const visibleLabel = String(button.textContent || "").trim();
          if (visibleLabel && !button.hasAttribute("aria-label")) button.setAttribute("aria-label", `${visibleLabel}: ${product.name}`);
          button.removeAttribute("data-go");
          button.hidden = false;
          button.style.display = "";
        }
      });
      const image = card.querySelector(".p-img-wrapper img,.p-image img,img");
      if (image) {
        image.alt = product.name;
        image.dataset.litrusFallback = fallbackProductImage;
        image.setAttribute("onerror", "this.onerror=null;this.src=this.dataset.litrusFallback");
        image.setAttribute("loading", "lazy");
        image.setAttribute("decoding", "async");
        image.src = product.img || fallbackProductImage;
      }
      litrusDecorateCard(card, product, image);
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
        info.querySelectorAll("[data-litrus-service-booking-form]").forEach(form => form.remove());
        const buyArea = page.querySelector(".sp-buy");
        if (buyArea) {
          buyArea.hidden = sellsTime(product);
          buyArea.style.display = sellsTime(product) ? "none" : "";
        }
        if (!sellsTime(product) && product.booking_enabled && product.stock > 0) {
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
        if (sellsTime(product)) {
          page.querySelectorAll(".sp-info .sp-buy, .sp-info [data-act='buynow'], .sp-info ul.sp-points")
            .forEach(element => element.remove());
          const form = document.createElement("form");
          form.className = "sp-hold-form sp-service-booking-form";
          form.dataset.litrusServiceBookingForm = "";
          form.dataset.serviceId = product.id;
          const heading = document.createElement("h2");
          heading.textContent = "Book this service";
          const note = document.createElement("p");
          note.textContent = `${product.duration_minutes} minutes · Times use ${data.shop.serviceTimezone}. ${serviceDepositText(data, product)}. The shop will confirm your request before anything is booked. ${serviceCutoffText(data)}`;
          const dateLabel = document.createElement("label");
          dateLabel.textContent = "Choose a date";
          const date = document.createElement("input");
          date.name = "date";
          date.type = "date";
          date.min = shopTodayDate(data.shop.serviceTimezone);
          date.required = true;
          dateLabel.append(date);
          const slotLabel = document.createElement("label");
          slotLabel.textContent = "Available time";
          const slots = document.createElement("select");
          slots.name = "starts_at";
          slots.required = true;
          slots.disabled = true;
          const initialSlot = document.createElement("option");
          initialSlot.value = "";
          initialSlot.textContent = "Choose a date and show times";
          slots.append(initialSlot);
          slotLabel.append(slots);
          const loadSlots = document.createElement("button");
          loadSlots.type = "button";
          loadSlots.className = "sp-btn";
          loadSlots.dataset.serviceLoadSlots = "";
          loadSlots.textContent = "Show available times";
          const nameLabel = document.createElement("label");
          nameLabel.textContent = "Your name";
          const name = document.createElement("input");
          name.name = "customer_name";
          name.autocomplete = "name";
          name.required = true;
          nameLabel.append(name);
          // Many customers have only a phone. The booking and its manage link are shown here and kept on
          // this device, so email is optional; the phone below stays required.
          // A deposit is charged through Paystack, which needs an email for the receipt.
          const takesDeposit = (Number(data.shop.serviceDepositPercent) || 0) > 0;
          const emailLabel = document.createElement("label");
          emailLabel.textContent = takesDeposit ? "Email (for the deposit receipt)" : "Email (optional)";
          const email = document.createElement("input");
          email.name = "customer_email";
          email.type = "email";
          email.autocomplete = "email";
          email.required = takesDeposit;
          emailLabel.append(email);
          const phoneLabel = document.createElement("label");
          phoneLabel.textContent = "Phone";
          const phone = document.createElement("input");
          phone.name = "customer_phone";
          phone.type = "tel";
          phone.inputMode = "tel";
          phone.autocomplete = "tel";
          phone.required = true;
          phoneLabel.append(phone);
          const submit = document.createElement("button");
          submit.type = "submit";
          submit.className = "sp-btn";
          submit.textContent = "Request booking";
          const status = document.createElement("p");
          status.className = "sp-service-booking-status";
          status.setAttribute("role", "status");
          form.append(heading, note, dateLabel, loadSlots, slotLabel, nameLabel, emailLabel, phoneLabel, submit, status);
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
          // The main photo is the largest thing on the page: load it first and never lazily.
          image.setAttribute("fetchpriority", "high");
          image.setAttribute("decoding", "async");
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
            thumbnail.setAttribute("loading", "lazy");
            thumbnail.setAttribute("width", "64");
            thumbnail.setAttribute("height", "64");
            thumbnail.alt = "";
            thumbnail.style.cssText = "width:100%;height:100%;object-fit:cover";
            button.append(thumbnail);
            thumbnails.append(button);
          });
          gallery.append(thumbnails);
        }
      }
      const variants = product.variants.filter(variant => variant &&
        (variant.option1_value || variant.option2_value || variant.size || variant.color));
      const buyArea = page.querySelector(".sp-buy");
      if (variants.length && buyArea) {
        const picker = document.createElement("div");
        picker.className = "sp-variant-picker";
        picker.dataset.productVariantPicker = product.id;
        picker.style.cssText = "display:grid;gap:10px;margin:16px 0";
        // Every option the product carries gets its own dropdown. The first two keep the names
        // "size" and "color" so storefronts and carts built on them still match.
        const optionKey = position => (position === 1 ? "size" : position === 2 ? "color" : `option${position}`);
        const optionValueOf = (variant, position) => String((position === 1
          ? variant.option1_value ?? variant.size
          : position === 2
            ? variant.option2_value ?? variant.color
            : variant[`option${position}_value`]) ?? "");
        const dimensions = [];
        for (let position = 1; position <= 4; position += 1) {
          const values = [...new Set(variants.map(variant => optionValueOf(variant, position)).filter(Boolean))];
          if (!values.length) continue;
          const name = String(product[`option${position}_name`]
            || variants.find(variant => variant[`option${position}_name`])?.[`option${position}_name`]
            || `Option ${position}`);
          dimensions.push([optionKey(position), name, values, `Choose ${name.toLowerCase()}`, position]);
        }
        dimensions.forEach(([name, labelText, values, placeholder, position]) => {
          if (!values.length) return;
          const label = document.createElement("label");
          label.textContent = labelText;
          label.style.cssText = "display:grid;gap:6px";
          const select = document.createElement("select");
          select.dataset.variantOption = name;
          select.dataset.variantOptionPosition = String(position);
          select.required = true;
          select.style.cssText = "min-height:44px;padding:8px";
          const empty = document.createElement("option");
          empty.value = "";
          empty.textContent = placeholder;
          select.append(empty);
          values.forEach(value => {
            const option = document.createElement("option");
            option.value = value;
            // Say a size is gone before the customer picks it, instead of greying the button after.
            const matching = variants.filter(variant => optionValueOf(variant, position) === value);
            const soldOut = matching.length > 0 && matching.every(variant => Number(variant.stock) <= 0);
            option.textContent = soldOut ? value + " \u00b7 sold out" : value;
            option.disabled = soldOut;
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
      // Attributes the owner charges for become choices the shopper makes, and the price follows.
      const priced = (product.priced_attributes || []).filter(attribute =>
        attribute && attribute.attributeName && Array.isArray(attribute.values) && attribute.values.length);
      if (priced.length && buyArea) {
        const pricedHost = document.createElement("div");
        pricedHost.className = "sp-priced-attributes";
        pricedHost.dataset.productPricedAttributes = product.id;
        pricedHost.style.cssText = "display:grid;gap:10px;margin:16px 0";
        priced.forEach(attribute => {
          const label = document.createElement("label");
          label.textContent = attribute.attributeName;
          label.style.cssText = "display:grid;gap:6px";
          const select = document.createElement("select");
          select.dataset.pricedAttribute = attribute.attributeName;
          select.style.cssText = "min-height:44px;padding:8px";
          const empty = document.createElement("option");
          empty.value = "";
          empty.textContent = `Choose ${attribute.attributeName.toLowerCase()}`;
          select.append(empty);
          attribute.values.slice(0, 20).forEach(value => {
            const option = document.createElement("option");
            option.value = String(value.value ?? "");
            const delta = Number(value.priceDelta ?? value.price_delta) || 0;
            // Say what a choice costs before it is made, rather than only after the total moves.
            const shown = (data.shop.cur ? `${data.shop.cur} ` : "") + Math.abs(delta).toLocaleString("en-US");
            option.textContent = delta === 0 ? option.value : `${option.value} (${delta > 0 ? "+" : "-"}${shown})`;
            select.append(option);
          });
          label.append(select);
          pricedHost.append(label);
        });
        buyArea.prepend(pricedHost);
      }
      // What the product is made of, in the customer's words. These were collected by the owner and
      // published, then only ever used to build filter dropdowns, so a shopper never saw them.
      const specs = (product.taxonomy_attributes || [])
        .filter(attribute => attribute && attribute.attributeName && attribute.value);
      if (specs.length) {
        const info = page.querySelector(".sp-info") || buyArea?.parentElement;
        if (info) {
          const details = document.createElement("div");
          details.className = "sp-specs";
          details.dataset.productSpecs = product.id;
          details.style.cssText = "display:grid;gap:6px;margin:18px 0";
          const heading = document.createElement("h3");
          heading.textContent = "Details";
          heading.style.cssText = "margin:0;font-size:.95rem";
          details.append(heading);
          const list = document.createElement("dl");
          list.style.cssText = "display:grid;grid-template-columns:auto 1fr;gap:4px 14px;margin:0;font-size:.86rem";
          specs.slice(0, 20).forEach(attribute => {
            const term = document.createElement("dt");
            term.textContent = attribute.attributeName;
            term.style.cssText = "opacity:.65";
            const value = document.createElement("dd");
            value.textContent = attribute.value;
            value.style.cssText = "margin:0";
            list.append(term, value);
          });
          details.append(list);
          info.append(details);
        }
      }
      fillProducts(page.querySelector(".prods"), related.filter(item => item.id !== product.id).slice(0, 4));
      return page.innerHTML;
    };
    const listHtml = (source, title, list) => {
      const serviceMode = data.shop.offerType === "services";
      const page = parse(source);
      page.querySelectorAll("[data-catalog-filters]").forEach(filters => filters.remove());
      const main = page.querySelector(".sp-main");
      const heading = page.querySelector(".sp-top h1");
      if (main) main.dataset.route = title === "All products" || title === "All services" ? "shop" : `c/${slug(title)}`;
      if (heading) heading.textContent = title;
      const subtitle = page.querySelector(".sp-top p");
      if (subtitle) subtitle.textContent = list.length + (serviceMode
        ? list.length === 1 ? " service" : " services"
        : list.length === 1 ? " item" : " items");
      let section = page.querySelector(".sp-main .prods");
      if (!section) {
        section = document.createElement("section");
        section.className = "prods";
        if (main) main.append(section);
      }
      if (main && !serviceMode) {
        const sizes = [...new Set(list.flatMap(product => product.sizes))].sort();
        const colors = [...new Set(list.flatMap(product => product.colors))].sort();
        const option1Names = [...new Set(list.map(product => product.option1_name).filter(Boolean))];
        const option2Names = [...new Set(list.map(product => product.option2_name).filter(Boolean))];
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
        if (option1Names.length === 1) addSelect("size", option1Names[0], sizes);
        if (option2Names.length === 1) addSelect("color", option2Names[0], colors);
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
    // Sites published before testimonials became owner-entered still carry invented reviewers
    // and trust claims in their saved homepage. Never show those to real customers.
    let removedUnverified = false;
    home.querySelectorAll(".akta-testimonials, .marlin-testimonial").forEach(section => {
      if (section.hasAttribute("data-litrus-owner-testimonials")) return;
      section.remove();
      removedUnverified = true;
    });
    const homeSection = home.querySelector(".sp-main .prods");
    fillProducts(homeSection, products);
    const categoryTiles = home.querySelector(".litrus-categories, .cats");
    if (categoryTiles) {
      const heading = categoryTiles.querySelector(".sole-category-heading");
      const styledTemplate = categoryTiles.querySelector("[data-litrus-category]");
      if (styledTemplate) {
        const categoryContainer = styledTemplate.parentElement;
        const items = categories.flatMap(category => {
          const copies = categoryContainer.classList.contains("cat-marquee") ? 4 : 1;
          return Array.from({ length: copies }, () => {
            const item = styledTemplate.cloneNode(true);
            item.href = "#";
            item.dataset.go = `c/${category.slug}`;
            item.dataset.litrusCategory = category.slug;
            item.querySelectorAll("[data-litrus-category-name]").forEach(label => {
              label.textContent = category.name;
            });
            const image = item.querySelector("img");
            if (image) {
              image.alt = category.name;
              if (category.image) image.src = category.image;
            }
            return item;
          });
        });
        categoryContainer.replaceChildren(...items);
      } else {
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
    }
    if (homeSection || categoryTiles || removedUnverified) pages.home = home.innerHTML;
    pages.shop = listHtml(
      pages.shop || pages.home,
      data.shop.offerType === "services" ? "All services" : "All products",
      products
    );
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
    const productAliases = {};
    previousProducts.forEach(previous => {
      const match = products.find(product =>
        product.name.trim().toLocaleLowerCase() === String(previous.name || "").trim().toLocaleLowerCase() &&
        Number(product.price) === Number(previous.num || previous.price)
      );
      if (match && String(previous.id) !== match.id) {
        pages[`p/${previous.id}`] = pages[`p/${match.id}`];
        productAliases[String(previous.id)] = match.id;
      }
    });
    data.shop.productAliases = productAliases;    if (data.shell && typeof data.shell.head === "string") {
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
        all.textContent = data.shop.offerType === "services" ? "All services" : "All products";
        nav.replaceChildren(...links, all);
      }
      if (data.shop.offerType === "services") {
        relabelBookingButtons(shell);
        const search = shell.querySelector(".sole-searchbar input, input[type='search']");
        if (search) {
          search.placeholder = "Search services";
          search.setAttribute("aria-label", "Search services");
        }
      }
      data.shell.head = shell.innerHTML;
    }
    if (data.shop.offerType === "services") {
      const replacements = [
        ["Add to bag", "Book now"],
        ["Buy now", "Book now"],
        ["See all products", "See all services"],
        ["All products", "All services"],
        ["All shoes", "All services"],
        ["Delivery & returns", "Booking & cancellations"],
        ["Delivery and returns", "Booking & cancellations"],
        ["Search products", "Search services"]
      ];
      const relabel = html => {
        const page = parse(html);
        // Baked pages carry their own copy of the header, so they get the same "Book" button as the shell.
        relabelBookingButtons(page);
        const walker = document.createTreeWalker(page, NodeFilter.SHOW_TEXT);
        let node;
        while ((node = walker.nextNode())) {
          if (node.parentElement && /^(SCRIPT|STYLE|TEXTAREA)$/.test(node.parentElement.tagName)) continue;
          let text = node.nodeValue;
          for (const [from, to] of replacements) text = text.split(from).join(to);
          if (text !== node.nodeValue) node.nodeValue = text;
        }
        return page.innerHTML;
      };
      Object.keys(pages).forEach(route => {
        pages[route] = relabel(pages[route]);
      });
      if (data.shell) {
        ["head", "foot"].forEach(key => {
          if (typeof data.shell[key] === "string") data.shell[key] = relabel(data.shell[key]);
        });
        if (typeof data.shell.tail === "string") {
          const tail = parse(data.shell.tail);
          tail.querySelectorAll(".sp-float").forEach(element => element.remove());
          data.shell.tail = tail.innerHTML;
        }
      }
    }
  }

  // A services shop has no bag: the header button leads to the services list instead of an empty cart.
  function relabelBookingButtons(container) {
    container.querySelectorAll(".sole-cart-button, .sp-cartbtn").forEach(button => {
      button.dataset.go = "shop";
      button.setAttribute("aria-label", "Book a service");
      button.textContent = button.classList.contains("sp-cartbtn") ? "Book now" : "Book";
    });
  }

  // Listing cards show the product's media without loading it: a badge for video and 360 spin, the
  // cutout treatment for cutouts, and a hover (mouse only) preview that loads on demand for one card.
  function litrusDecorateCard(card, product, image) {
    ["data-media", "data-video-url", "data-card-spin"].forEach(name => card.removeAttribute(name));
    card.querySelectorAll(".litrus-media-badge").forEach(badge => badge.remove());
    const type = product.media_type;
    const frames = Array.isArray(product.spin_frames) ? product.spin_frames : [];
    const kind = type === "video" && product.video_url ? "video" : type === "spin" && frames.length > 1 ? "spin" : type === "cutout" ? "cutout" : "";
    if (!kind) return;
    card.dataset.media = kind;
    if (kind === "cutout") {
      if (image) {
        image.classList.add("sp-cutout", "litrus-cutout");
        image.style.objectFit = "contain";
        image.style.mixBlendMode = "normal";
        image.style.padding = "6%";
        image.style.boxSizing = "border-box";
      }
      return;
    }
    if (kind === "video") card.dataset.videoUrl = product.video_url;
    else {
      // At most 12 evenly spread frames, and only fetched when someone hovers this card.
      const step = Math.max(1, Math.ceil(frames.length / 12));
      card.dataset.cardSpin = JSON.stringify(frames.filter((frame, index) => index % step === 0).slice(0, 12));
    }
    const holder = image && image.parentElement && image.parentElement !== card ? image.parentElement : card;
    if (holder !== card && !holder.style.position) holder.style.position = "relative";
    const badge = document.createElement("span");
    badge.className = "litrus-media-badge";
    badge.setAttribute("role", "img");
    badge.setAttribute("aria-label", kind === "video" ? "Has a product video" : "Has a 360 degree view");
    badge.textContent = kind === "video" ? "▶ Video" : "360°";
    badge.style.cssText = "position:absolute;left:10px;top:46px;z-index:3;padding:4px 8px;border-radius:999px;" +
      "background:rgba(0,0,0,.72);color:#fff;font:600 11px/1.2 system-ui,sans-serif;letter-spacing:.02em;pointer-events:none";
    holder.append(badge);
  }

  function litrusInitCardPreview(root) {
    let active = null;
    const stop = () => {
      if (!active) return;
      active.cleanup();
      active = null;
    };
    root.addEventListener("pointerover", event => {
      if (event.pointerType && event.pointerType !== "mouse") return;
      const card = event.target.closest && event.target.closest("[data-media][data-pid]");
      if (!card || (active && active.card === card)) return;
      stop();
      const image = card.querySelector(".p-img-wrapper img,.p-image img,img");
      if (!image) return;
      if (card.dataset.media === "video" && card.dataset.videoUrl) {
        const video = document.createElement("video");
        video.src = card.dataset.videoUrl;
        video.muted = true;
        video.loop = true;
        video.playsInline = true;
        video.setAttribute("playsinline", "");
        video.setAttribute("aria-hidden", "true");
        video.className = "litrus-card-preview";
        video.style.cssText = "position:absolute;inset:0;width:100%;height:100%;object-fit:cover;z-index:2;pointer-events:none";
        const holder = image.parentElement;
        if (!holder) return;
        holder.append(video);
        const playing = video.play();
        if (playing && playing.catch) playing.catch(() => {});
        active = { card, cleanup: () => { video.pause(); video.removeAttribute("src"); video.load(); video.remove(); } };
      } else if (card.dataset.media === "spin" && card.dataset.cardSpin) {
        let frames = [];
        try { frames = JSON.parse(card.dataset.cardSpin); } catch { return; }
        if (!Array.isArray(frames) || frames.length < 2) return;
        const original = image.src;
        frames.forEach(frame => { const preload = new Image(); preload.src = frame; });
        const move = pointer => {
          const rect = image.getBoundingClientRect();
          const ratio = rect.width ? Math.min(0.999, Math.max(0, (pointer.clientX - rect.left) / rect.width)) : 0;
          image.src = frames[Math.floor(ratio * frames.length)];
        };
        const listener = pointer => move(pointer);
        card.addEventListener("pointermove", listener);
        active = { card, cleanup: () => { card.removeEventListener("pointermove", listener); image.src = original; } };
      }
    });
    root.addEventListener("pointerout", event => {
      if (!active) return;
      const next = event.relatedTarget;
      if (next && active.card.contains(next)) return;
      stop();
    });
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

  // Email is needed for the Paystack receipt. Every other way of paying may leave it blank, unless the
  // Worker has not said whether Paystack is connected (an older Worker, which rejects orders without an
  // email) or it has already refused an order without one.
  function checkoutEmailAlwaysRequired(form) {
    return form.dataset.eshopEmailRequired === "always";
  }

  function syncCheckoutEmail(form) {
    const email = form.querySelector('input[name="email"]');
    if (!email) return;
    const paying = form.querySelector('input[name="pay"]:checked')?.value === "paystack";
    const always = checkoutEmailAlwaysRequired(form);
    email.required = paying || always;
    const note = email.closest("label")?.querySelector("small");
    if (note) note.textContent = paying ? "(required for your Paystack receipt)" : always ? "(required)" : "(optional)";
  }

  // The ways to pay the shop directly that the owner switched on (Payments → "Ways customers can pay you
  // directly", saved as store.payment_options). Same rules as src/screens/craft/direct-payments.js.
  function directPaymentChoices(raw) {
    const source = raw && typeof raw === "object" ? raw : {};
    const clean = (value, max) => String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
    const choices = [];
    const mpesa = source.mpesa && typeof source.mpesa === "object" ? source.mpesa : {};
    const kind = ["till", "paybill", "phone"].includes(mpesa.kind) ? mpesa.kind : "till";
    const number = kind === "phone" ? clean(mpesa.number, 20).replace(/[^\d+ ]/g, "") : String(mpesa.number || "").replace(/\D/g, "").slice(0, 12);
    if (mpesa.enabled === true && number) {
      const account = clean(mpesa.account, 40);
      choices.push(kind === "paybill"
        ? { value: "M-Pesa", title: `M-Pesa Paybill ${number}`, detail: `Account: ${account || "your order number"}` }
        : kind === "phone"
          ? { value: "M-Pesa", title: `M-Pesa: send money to ${number}`, detail: "Use your order number as the message" }
          : { value: "M-Pesa", title: `M-Pesa Buy Goods, Till ${number}`, detail: "Pay when the shop confirms your order" });
    }
    if (source.cash && source.cash.enabled === true) {
      choices.push({ value: "Cash", title: "Cash on delivery or pickup", detail: "Pay when you receive your order" });
    }
    const bank = clean(source.bank && source.bank.details, 300);
    if (source.bank && source.bank.enabled === true && bank) {
      choices.push({ value: "Bank transfer", title: "Bank transfer", detail: bank });
    }
    return choices;
  }

  function paymentChoice(value, title, detail, checked) {
    const option = document.createElement("label");
    option.className = "sp-radio";
    const input = document.createElement("input");
    input.type = "radio";
    input.name = "pay";
    input.value = value;
    input.checked = checked;
    const label = document.createElement("span");
    label.textContent = title;
    const hint = document.createElement("small");
    hint.textContent = detail;
    label.append(hint);
    option.append(input, label);
    return option;
  }

  // The template's payment choices (Mobile money, Cash, Bank or card) are placeholders: the shop never
  // set them up and the order only records "paystack" or "manual". On a live shop they are replaced by
  // what is true. With Paystack: Paystack (preselected) or paying the shop directly. Without Paystack:
  // no choices, only a note that the shop will arrange payment. When the Worker does not say (an older
  // Worker), the original behaviour stays: Paystack offered next to the template's choices.
  function installPaystackOption(form, data) {
    if (form.dataset.eshopPaystackOption === "true") return;
    form.dataset.eshopPaystackOption = "true";
    const connected = data?.shop?.paystackConnected;
    if (connected === null || connected === undefined) form.dataset.eshopEmailRequired = "always";
    // Pages built now mark the group; older published pages only have the radios inside it.
    const group = form.querySelector("[data-pay-group]") || form.querySelector('input[name="pay"]')?.closest(".sp-radios");
    if (!group) {
      syncCheckoutEmail(form);
      return;
    }
    // The page's own "will contact you" note is replaced by what this shop really offers.
    form.querySelector("[data-pay-template-note]")?.remove();
    const shopName = String(data?.shop?.name || "").trim() || "The shop";
    const direct = Array.isArray(data?.shop?.directPayments) ? data.shop.directPayments : [];
    const directChoices = checkFirst => direct.map((choice, index) =>
      paymentChoice(choice.value, choice.title, choice.detail, checkFirst && index === 0));
    if (connected === false && direct.length) {
      group.replaceChildren(...directChoices(true));
      syncCheckoutEmail(form);
      return;
    }
    if (connected === false) {
      const note = document.createElement("p");
      note.className = "sp-pay-note";
      note.dataset.eshopPayNote = "";
      note.textContent = `${shopName} will contact you to confirm your order and how to pay.`;
      group.replaceWith(note);
      syncCheckoutEmail(form);
      return;
    }
    const paystack = paymentChoice("paystack", "Pay securely with Paystack", "M-Pesa or card", true);
    if (connected === true) {
      group.replaceChildren(paystack, ...(direct.length ? directChoices(false) : [paymentChoice("Pay the shop directly", "Pay the shop directly",
        `${shopName} confirms your order and how to pay`, false)]));
    } else {
      group.prepend(paystack);
    }
    form.querySelectorAll('input[name="pay"]').forEach(item => {
      item.checked = item.value === "paystack";
    });
    syncCheckoutEmail(form);
  }

  function storefrontRequestError(result, response, fallback) {
    const error = new Error(result && typeof result.error === "string" && result.error
      ? result.error
      : `${fallback} (${response.status}).`);
    error.status = response.status;
    if (result && typeof result.error_code === "string") error.code = result.error_code;
    return error;
  }

  function friendlyRequestError(error, fallback) {
    if (error instanceof Error && !error.status &&
        (error instanceof TypeError || /failed to fetch|network|load failed/i.test(error.message))) {
      return "Could not reach the shop. Check your connection and try again.";
    }
    return error instanceof Error && error.message ? error.message : fallback;
  }

  async function postStorefrontJson(path, payload, fallback = "Checkout failed") {
    const response = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw storefrontRequestError(result, response, fallback);
    return result;
  }

  async function getStorefrontJson(path) {
    const response = await fetch(path);
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw storefrontRequestError(result, response, "Request failed");
    return result;
  }

  function readLocalJson(key, fallback) {
    try {
      const value = localStorage.getItem(key);
      return value ? JSON.parse(value) : fallback;
    } catch {
      return fallback;
    }
  }

  function writeLocalJson(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  }

  function formatShopMoney(data, amount) {
    return `${data.shop.cur ? `${data.shop.cur} ` : ""}${Number(amount || 0).toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
  }

  function findCatalogProduct(data, id) {
    const products = Array.isArray(data?.shop?.products) ? data.shop.products : [];
    const value = String(id ?? "").trim();
    if (!value) return null;
    const direct = products.find(product => String(product.id) === value);
    if (direct) return direct;
    const alias = data.shop.productAliases && data.shop.productAliases[value];
    return alias ? products.find(product => String(product.id) === String(alias)) || null : null;
  }

  // Analytics must only ever receive real catalogue ids: template or stale ids are resolved
  // through the alias map and dropped when they match nothing the shop sells.
  function canonicalProductId(data, id) {
    const product = findCatalogProduct(data, id);
    return product ? String(product.id) : "";
  }

  function trackStorefrontEvent(data, productId, type, count = 1) {
    const id = canonicalProductId(data, productId);
    if (!id || typeof global.__ESHOP_TRACK_STOREFRONT_EVENT__ !== "function") return;
    global.__ESHOP_TRACK_STOREFRONT_EVENT__(id, type, count);
  }

  function shopTodayDate(timeZone) {
    try {
      const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone, year: "numeric", month: "2-digit", day: "2-digit"
      }).formatToParts(new Date());
      const part = type => parts.find(item => item.type === type)?.value;
      return `${part("year")}-${part("month")}-${part("day")}`;
    } catch {
      return new Date().toISOString().slice(0, 10);
    }
  }

  function formatServiceTime(startsAt, timeZone) {
    const date = new Date(startsAt);
    if (!Number.isFinite(date.getTime())) return String(startsAt || "");
    try {
      return new Intl.DateTimeFormat("en", {
        timeZone, weekday: "long", day: "numeric", month: "long", year: "numeric",
        hour: "numeric", minute: "2-digit"
      }).format(date);
    } catch {
      return date.toISOString();
    }
  }

  function serviceDepositText(data, product) {
    const percent = Number(data.shop.serviceDepositPercent) || 0;
    if (percent <= 0) return "No deposit required";
    const cents = Math.ceil(Math.round(Number(product?.price || 0) * 100) * percent / 100);
    return cents > 0
      ? `${percent}% deposit (${formatShopMoney(data, cents / 100)}) after the shop approves your time`
      : `${percent}% deposit after approval`;
  }

  function serviceCutoffText(data) {
    const hours = Number(data.shop.serviceCancelCutoffHours);
    if (!Number.isFinite(hours)) return "";
    return hours > 0
      ? `You can cancel or move your booking online until ${hours} hour${hours === 1 ? "" : "s"} before it starts.`
      : "You can cancel or move your booking online until it starts.";
  }

  function serviceReference(appointment) {
    const explicit = String(appointment?.reference || "").trim();
    if (explicit) return explicit.slice(0, 40);
    return String(appointment?.id || "").replace(/[^a-z0-9]/gi, "").slice(0, 8).toUpperCase();
  }

  const SERVICE_REQUEST_WAIT_MS = 24 * 60 * 60 * 1000;
  const serviceRequestsKey = () => `eshop-appointments:${location.host}`;
  const SERVICE_PHONE_PATTERN = /^\+?[0-9][0-9 ()-]{6,22}$/;
  const SERVICE_EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  function storedServiceRequests() {
    const saved = readLocalJson(serviceRequestsKey(), []);
    return Array.isArray(saved)
      ? saved.filter(item => item && typeof item.id === "string" && Date.parse(item.starts_at) > Date.now())
      : [];
  }

  function saveServiceRequest(entry) {
    const list = storedServiceRequests().filter(item => item.id !== entry.id);
    list.push(entry);
    return writeLocalJson(serviceRequestsKey(), list.slice(-20));
  }

  function appendShopContact(container, data, reference) {
    const note = document.createElement("p");
    note.append(reference
      ? `Need to change or cancel this request? Contact the shop and quote reference ${reference}`
      : "Need to change or cancel a request? Contact the shop and quote your reference");
    const methods = [];
    const phone = String(data.shop.phone || "").trim();
    const email = String(data.shop.email || "").trim();
    const whatsapp = String(data.shop.wa || "").replace(/\D/g, "");
    if (whatsapp) methods.push(["WhatsApp", `https://wa.me/${whatsapp}${reference ? `?text=${encodeURIComponent(`Booking reference ${reference}`)}` : ""}`]);
    if (phone) methods.push([phone, `tel:${phone.replace(/[^\d+]/g, "")}`]);
    if (email) methods.push([email, `mailto:${email}`]);
    if (methods.length) {
      note.append(": ");
      methods.forEach(([label, href], index) => {
        if (index) note.append(", ");
        const link = document.createElement("a");
        link.href = href;
        link.textContent = label;
        if (href.startsWith("https://")) {
          link.target = "_blank";
          link.rel = "noopener noreferrer";
        }
        note.append(link);
      });
    }
    note.append(".");
    container.append(note);
  }

  function renderServiceRequestList(form, data) {
    if (!form || !form.parentNode) return;
    const requests = storedServiceRequests();
    form.parentNode.querySelectorAll("[data-litrus-service-requests]").forEach(element => element.remove());
    if (!requests.length) return;
    const section = document.createElement("section");
    section.className = "sp-service-requests";
    section.dataset.litrusServiceRequests = "";
    section.setAttribute("aria-label", "Your booking requests");
    const heading = document.createElement("h3");
    heading.textContent = "Your booking requests on this device";
    const list = document.createElement("ul");
    requests.slice().reverse().forEach(request => {
      const item = document.createElement("li");
      // The shop only sees a request for a limited time. After a day the page cannot tell whether it
      // was confirmed, so it points the customer to the shop instead of promising a confirmation.
      const requestedAt = Date.parse(request.requested_at);
      const stale = Number.isFinite(requestedAt) && Date.now() - requestedAt > SERVICE_REQUEST_WAIT_MS;
      const manageToken = SERVICE_TOKEN_PATTERN.test(String(request.manage_token || "")) ? request.manage_token : "";
      if (manageToken) {
        // The saved link is the truth: the page cannot know here whether the shop has confirmed.
        item.append(`${request.service_name || "Service"} · ${formatServiceTime(request.starts_at, request.timezone || data.shop.serviceTimezone)} · Reference ${request.reference || serviceReference(request)} · `);
        const manage = document.createElement("a");
        manage.href = serviceManageHref(manageToken);
        manage.dataset.serviceManageLink = "";
        manage.textContent = "View status, change or cancel";
        item.append(manage);
      } else {
        item.textContent = `${request.service_name || "Service"} · ${formatServiceTime(request.starts_at, request.timezone || data.shop.serviceTimezone)} · Reference ${request.reference || serviceReference(request)} · ${stale ? "Requested over a day ago: contact the shop if you have not heard back" : "Waiting for the shop to confirm"}`;
      }
      list.append(item);
    });
    section.append(heading, list);
    appendShopContact(section, data, "");
    form.insertAdjacentElement("afterend", section);
  }

  function resetServiceSlots(form) {
    const slots = form.elements.namedItem("starts_at");
    if (!slots) return;
    slots.disabled = true;
    slots.replaceChildren();
    const empty = document.createElement("option");
    empty.value = "";
    empty.textContent = "Choose a date and show times";
    slots.append(empty);
  }

  // Older Android WebViews and non-secure pages have no crypto.randomUUID, so every request key
  // (booking, order, reservation) is built the same way and falls back to getRandomValues.
  function newRequestKey() {
    const cryptoApi = global.crypto;
    if (typeof cryptoApi?.randomUUID === "function") return cryptoApi.randomUUID();
    if (typeof cryptoApi?.getRandomValues !== "function") {
      throw new Error("Secure requests are not supported by this browser. Update your browser or contact the shop.");
    }
    const bytes = cryptoApi.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }

  async function loadServiceAvailability(form, notice = "") {
    const date = form.elements.namedItem("date");
    const slots = form.elements.namedItem("starts_at");
    const status = form.querySelector(".sp-service-booking-status");
    const button = form.querySelector("[data-service-load-slots]");
    const say = text => {
      if (status) status.textContent = text;
    };
    if (!date?.value || !slots || !button) {
      say("Choose a date first.");
      return;
    }
    if (date.min && date.value < date.min) {
      say("Choose today or a later date.");
      return;
    }
    const requestedDate = date.value;
    button.disabled = true;
    slots.disabled = true;
    slots.setAttribute("aria-busy", "true");
    slots.replaceChildren();
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "Loading available times…";
    slots.append(placeholder);
    say("");
    try {
      const query = new URLSearchParams({ service_id: form.dataset.serviceId, date: date.value });
      const result = await getStorefrontJson(`/api/service-appointments/availability?${query}`);
      if (date.value !== requestedDate) return;
      // Times that have already passed (a page left open, a clock that moved on) are never offered.
      const available = (Array.isArray(result.slots) ? result.slots : []).filter(slot =>
        slot && typeof slot.starts_at === "string" && Date.parse(slot.starts_at) > Date.now());
      slots.replaceChildren();
      const empty = document.createElement("option");
      empty.value = "";
      empty.textContent = available.length ? "Choose a time" : "No available times for this date";
      slots.append(empty);
      available.forEach(slot => slots.append(serviceSlotOption(slot, result.capacity)));
      slots.disabled = !available.length;
      say(available.length
        ? notice
        : `${notice ? `${notice} ` : ""}No times are available on this date. The shop may be closed that day or fully booked. Try another date.`);
    } catch (error) {
      slots.replaceChildren();
      const empty = document.createElement("option");
      empty.value = "";
      empty.textContent = "Could not load times";
      slots.append(empty);
      say(serviceErrorMessage(error, "Could not load available times."));
    } finally {
      button.disabled = false;
      slots.removeAttribute("aria-busy");
    }
  }

  function showServiceConfirmation(form, data, appointment, sent) {
    const status = form.querySelector(".sp-service-booking-status");
    const product = findCatalogProduct(data, form.dataset.serviceId);
    const timezone = data.shop.serviceTimezone;
    const reference = serviceReference(appointment);
    form.querySelectorAll(".sp-service-booking-confirmation").forEach(element => element.remove());
    const panel = document.createElement("section");
    panel.className = "sp-service-booking-confirmation";
    panel.setAttribute("role", "region");
    panel.setAttribute("aria-label", "Booking request received");
    panel.tabIndex = -1;
    const heading = document.createElement("h3");
    heading.textContent = "Request received";
    const summary = document.createElement("p");
    summary.textContent = "The shop will confirm your booking. Nothing is booked until you hear back from them.";
    const details = document.createElement("ul");
    [
      ["Service", appointment.service_name || product?.name || "Your service"],
      ["Requested time", formatServiceTime(appointment.starts_at || sent.startsAt, timezone)],
      ["Reference", reference || "Not provided"]
    ].forEach(([label, text]) => {
      const item = document.createElement("li");
      item.textContent = `${label}: ${text}`;
      details.append(item);
    });
    panel.append(heading, summary, details);
    const depositPercent = Number(data.shop.serviceDepositPercent) || 0;
    const paymentUrl = String(appointment.payment_authorization_url || "");
    let paymentLink = null;
    try {
      const url = new URL(paymentUrl);
      if (url.protocol === "https:" && url.hostname === "checkout.paystack.com") paymentLink = url;
    } catch {
      paymentLink = null;
    }
    if (paymentLink) {
      const pay = document.createElement("a");
      pay.className = "sp-btn";
      pay.href = paymentLink.href;
      pay.textContent = "Pay deposit";
      panel.append(pay);
    } else if (depositPercent > 0) {
      const deposit = document.createElement("p");
      deposit.textContent = `${serviceDepositText(data, product)}. The shop sends you the payment link once they approve.`;
      panel.append(deposit);
    }
    if (SERVICE_TOKEN_PATTERN.test(String(sent.token || ""))) {
      const manage = document.createElement("p");
      manage.append("Save this link: it lets you view your booking's status, move it or cancel it. ");
      const link = document.createElement("a");
      link.className = "sp-btn";
      link.href = serviceManageHref(sent.token);
      link.dataset.serviceManageLink = "";
      link.textContent = "Manage this booking";
      manage.append(link);
      panel.append(manage);
    }
    appendShopContact(panel, data, reference);
    const another = document.createElement("button");
    another.type = "button";
    another.className = "sp-btn ghost";
    another.dataset.serviceNewRequest = "";
    another.textContent = "Request another time";
    panel.append(another);
    Array.from(form.children).forEach(child => {
      if (child === status) return;
      child.hidden = true;
      child.dataset.litrusHiddenByConfirmation = "";
    });
    form.insertBefore(panel, status || null);
    if (typeof panel.focus === "function") panel.focus();
  }

  function reopenServiceForm(form) {
    form.querySelectorAll(".sp-service-booking-confirmation").forEach(element => element.remove());
    form.querySelectorAll("[data-litrus-hidden-by-confirmation]").forEach(child => {
      child.hidden = false;
      delete child.dataset.litrusHiddenByConfirmation;
    });
    const status = form.querySelector(".sp-service-booking-status");
    if (status) status.textContent = "";
    const date = form.elements.namedItem("date");
    if (date && typeof date.focus === "function") date.focus();
  }

  async function requestServiceAppointment(form, data) {
    const submit = form.querySelector('button[type="submit"]');
    const status = form.querySelector(".sp-service-booking-status");
    const say = text => {
      if (status) status.textContent = text;
    };
    const field = name => form.elements.namedItem(name);
    const startsAt = String(field("starts_at")?.value || "");
    const customer = {
      customer_name: String(field("customer_name")?.value || "").trim(),
      customer_email: String(field("customer_email")?.value || "").trim(),
      customer_phone: String(field("customer_phone")?.value || "").trim()
    };
    if (!startsAt) {
      say("Choose a date, then pick one of the available times.");
      field("date")?.focus?.();
      return;
    }
    if (!(Date.parse(startsAt) > Date.now())) {
      say("That time has already passed. Pick another time.");
      void loadServiceAvailability(form, "That time has already passed.");
      return;
    }
    if (!customer.customer_name) {
      say("Enter your name so the shop knows who to expect.");
      field("customer_name")?.focus?.();
      return;
    }
    // Email is optional (the phone below is required), unless the shop takes a deposit, which is paid
    // through Paystack and needs an email for the receipt. A typed email must always be valid.
    const emailNeeded = (Number(data?.shop?.serviceDepositPercent) || 0) > 0;
    if (customer.customer_email ? !SERVICE_EMAIL_PATTERN.test(customer.customer_email) : emailNeeded) {
      say(customer.customer_email || !emailNeeded
        ? "Enter a valid email address, or leave it blank."
        : "Add your email address so the shop can send your deposit receipt.");
      field("customer_email")?.focus?.();
      return;
    }
    if (!SERVICE_PHONE_PATTERN.test(customer.customer_phone)) {
      say("Enter a phone number the shop can call, for example +254 700 000000.");
      field("customer_phone")?.focus?.();
      return;
    }
    if (submit) submit.disabled = true;
    form.setAttribute("aria-busy", "true");
    say("Sending appointment request…");
    try {
      const product = findCatalogProduct(data, form.dataset.serviceId);
      // The length the customer was shown travels with the request. The Worker books from the
      // published service, so this is what lets it spot a page that is out of date.
      const duration = Number(product?.duration_minutes);
      const validDuration = Number.isSafeInteger(duration) && duration >= 15 && duration <= 240 && duration % 15 === 0;
      const payload = {
        service_id: form.dataset.serviceId,
        starts_at: startsAt,
        ...(validDuration ? { duration_minutes: duration } : {}),
        ...customer
      };
      // The key is tied to what is being requested, so changing the time or details after a
      // failed attempt can never be answered with an older request's result.
      const signature = JSON.stringify(payload);
      if (form.dataset.requestSignature !== signature || !form.dataset.idempotencyKey) {
        form.dataset.requestSignature = signature;
        form.dataset.idempotencyKey = newRequestKey();
      }
      const result = await postStorefrontJson("/api/service-appointments", {
        idempotency_key: form.dataset.idempotencyKey,
        ...payload
      }, "Booking request failed");
      const appointment = result.appointment && typeof result.appointment === "object" ? result.appointment : {};
      const timezone = data.shop.serviceTimezone;
      form.reset();
      delete form.dataset.idempotencyKey;
      delete form.dataset.requestSignature;
      resetServiceSlots(form);
      const manageToken = SERVICE_TOKEN_PATTERN.test(String(result.manage_token || "")) ? result.manage_token : "";
      showServiceConfirmation(form, data, appointment, { startsAt, token: manageToken });
      say(`Your request was sent to ${data.shop.name}. It is pending shop approval; we will contact you by email or phone.`);
      if (appointment.id) {
        saveServiceRequest({
          id: String(appointment.id),
          reference: serviceReference(appointment),
          service_id: payload.service_id,
          service_name: String(appointment.service_name || product?.name || ""),
          starts_at: String(appointment.starts_at || startsAt),
          timezone,
          requested_at: new Date().toISOString(),
          ...(manageToken ? { manage_token: manageToken } : {})
        });
        renderServiceRequestList(form, data);
      }
      if (result.duplicate !== true) trackStorefrontEvent(data, payload.service_id, "booking_submitted");
    } catch (error) {
      const message = serviceErrorMessage(error, "Could not send this appointment request.");
      say(message);
      if (error && error.status === 409) {
        // The slot was taken (or closed) while the customer filled in the form: refresh the list.
        void loadServiceAvailability(form, message);
      }
    } finally {
      if (submit) submit.disabled = false;
      form.removeAttribute("aria-busy");
    }
  }

  function orderItemFromCartLine(item) {
    const line = { product_id: String(item.id), quantity: Number(item.q) };
    const picked = Array.isArray(item.attributes) ? item.attributes : [];
    if (picked.length) {
      line.attributes = picked.slice(0, 5).map(pick => ({
        attribute_name: String(pick?.attributeName ?? pick?.attribute_name ?? "").trim().slice(0, 80),
        value: String(pick?.value ?? "").trim().slice(0, 80)
      })).filter(pick => pick.attribute_name && pick.value);
    }
    const variantId = String(item.variantId ?? "").trim();
    if (!variantId) return line;
    // Variant identifiers and labels travel with the line so the Worker can price the variant
    // and the owner can see which size/option was ordered. Prices are never sent: the Worker prices.
    const clip = value => String(value ?? "").trim().slice(0, 80);
    line.variant_id = variantId.slice(0, 180);
    const labels = [];
    [["option1", item.option1_name || "Size", item.size], ["option2", item.option2_name || "Color", item.color]]
      .forEach(([key, name, value]) => {
        if (!clip(value)) return;
        line[`${key}_name`] = clip(name);
        line[`${key}_value`] = clip(value);
        labels.push(`${clip(name)}: ${clip(value)}`);
      });
    if (labels.length) line.variant_label = labels.join(" / ");
    return line;
  }

  function normalizedHoldName(value) {
    return String(value || "").trim().replace(/\s+/g, " ").toLocaleLowerCase();
  }

  // The customer's own holds: unexpired, for products in this cart, and matching the name and
  // contact they reserved with (the Worker rejects the whole order if any claimed hold does not match).
  function matchingHoldIds(data, productIds, customer) {
    const holds = readLocalJson(`eshop-holds:${location.host}`, []);
    if (!Array.isArray(holds)) return [];
    const digits = value => String(value || "").replace(/\D/g, "");
    const ids = [];
    for (const hold of holds) {
      if (!hold || typeof hold.id !== "string" || !/^[a-f0-9-]{36}$/i.test(hold.id)) continue;
      const holdProduct = canonicalProductId(data, hold.product_id) || String(hold.product_id);
      if (!productIds.has(holdProduct)) continue;
      if (!(Date.parse(hold.expires_at) > Date.now())) continue;
      if (normalizedHoldName(hold.customer_name) !== normalizedHoldName(customer.name)) continue;
      const contact = String(hold.contact || "").trim();
      const contactMatches = SERVICE_EMAIL_PATTERN.test(contact)
        ? contact.toLocaleLowerCase() === customer.email
        : digits(contact).length >= 7 && digits(contact) === digits(customer.phone);
      if (contactMatches && !ids.includes(hold.id)) ids.push(hold.id);
    }
    return ids.slice(0, 50);
  }

  function removeStoredHolds(holdIds) {
    if (!holdIds || !holdIds.length) return;
    const key = `eshop-holds:${location.host}`;
    const holds = readLocalJson(key, []);
    if (!Array.isArray(holds)) return;
    writeLocalJson(key, holds.filter(hold => !(hold && holdIds.includes(hold.id))));
  }

  function normalizeDiscountCode(value) {
    const code = String(value || "").trim().toUpperCase().replace(/\s+/g, "");
    if (!code) return "";
    return /^[A-Z0-9][A-Z0-9_-]{1,39}$/.test(code) ? code : null;
  }

  // What the Worker should charge for the lines, computed from the published catalogue.
  function expectedSubtotalCents(data, lines) {
    let total = 0;
    for (const line of lines) {
      const product = findCatalogProduct(data, line.id);
      if (!product) return null;
      let unit = Number(product.price);
      if (String(line.variantId ?? "").trim()) {
        const variant = (product.variants || []).find(item => String(item.id) === String(line.variantId));
        if (!variant) return null;
        if (variant.price !== null && variant.price !== undefined && variant.price !== "") unit = Number(variant.price);
      }
      const cents = Math.round(unit * 100);
      if (!Number.isSafeInteger(cents) || cents < 0) return null;
      total += cents * Number(line.q);
    }
    return total;
  }

  function serverDiscountCents(created) {
    for (const value of [created?.discount_cents, created?.order?.discount_cents]) {
      if (value === undefined || value === null || value === "") continue;
      const cents = Number(value);
      if (Number.isSafeInteger(cents) && cents >= 0) return cents;
    }
    const major = Number(created?.order?.discount);
    return Number.isFinite(major) && major > 0 ? Math.round(major * 100) : 0;
  }

  function installDiscountField(form) {
    if (!form || form.querySelector("[data-litrus-discount]")) return;
    const block = document.createElement("div");
    block.className = "sp-discount";
    block.dataset.litrusDiscount = "";
    const label = document.createElement("label");
    label.append("Discount code ");
    const optional = document.createElement("small");
    optional.textContent = "(optional)";
    const input = document.createElement("input");
    input.name = "discount_code";
    input.type = "text";
    input.autocomplete = "off";
    input.autocapitalize = "characters";
    input.spellcheck = false;
    input.maxLength = 40;
    label.append(optional, input);
    const apply = document.createElement("button");
    apply.type = "button";
    apply.className = "sp-btn ghost";
    apply.dataset.discountApply = "";
    apply.textContent = "Apply";
    apply.setAttribute("aria-label", "Apply discount code");
    const status = document.createElement("p");
    status.className = "sp-discount-status";
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");
    block.append(label, apply, status);
    const anchor = form.querySelector(".sp-err");
    if (anchor && anchor.parentNode) anchor.parentNode.insertBefore(block, anchor);
    else form.append(block);
  }

  function readCartLines(data) {
    let cart;
    try {
      cart = JSON.parse(localStorage.getItem(`sp:${data.shop.key}:cart`) || "[]");
    } catch {
      return null;
    }
    return Array.isArray(cart) ? cart.filter(item =>
      item && (typeof item.id === "string" || typeof item.id === "number") &&
      Number.isSafeInteger(Number(item.q)) && Number(item.q) > 0
    ) : [];
  }

  // Delivery follows the same rule as the checkout summary and the Worker: charged for delivery
  // orders under the free-delivery threshold, measured on the subtotal before any discount.
  function deliveryCents(data, subtotalCents, delivery) {
    const fee = Math.round(Number(data.shop.fee) * 100);
    const free = Math.round(Number(data.shop.free) * 100);
    if (delivery === "pickup" || !(fee > 0)) return 0;
    return free > 0 && subtotalCents >= free ? 0 : fee;
  }

  function clearCheckoutDiscount(form) {
    delete form.dataset.discountPreview;
    const summary = document.getElementById("spSum") || form.parentElement?.querySelector(".sp-sum");
    if (!summary) return;
    summary.querySelectorAll("[data-litrus-discount-row]").forEach(row => row.remove());
    const totalAmount = summary.querySelector(".sp-total b");
    if (totalAmount && totalAmount.dataset.litrusBaseTotal) {
      totalAmount.textContent = totalAmount.dataset.litrusBaseTotal;
      delete totalAmount.dataset.litrusBaseTotal;
    }
  }

  // Re-draws the previewed discount after the checkout summary is rebuilt (for example when the
  // customer switches between delivery and pickup).
  function refreshDiscountPreview(form, data) {
    let preview;
    try {
      preview = JSON.parse(form.dataset.discountPreview || "null");
    } catch {
      preview = null;
    }
    if (!preview || !preview.code || !(preview.cents > 0)) return;
    const lines = readCartLines(data);
    const subtotal = lines ? expectedSubtotalCents(data, lines) : null;
    const delivery = form.querySelector('[name="dm"]:checked')?.value || "delivery";
    const total = subtotal === null ? NaN : (subtotal - preview.cents + deliveryCents(data, subtotal, delivery)) / 100;
    showCheckoutDiscount(form, data, { total }, preview.cents, preview.code);
  }

  // Asks the Worker what the code is worth for this cart before anything is ordered. Shops running an
  // older Worker have no such check, so the customer is told the code is verified when they order.
  async function applyDiscountCodeInput(form, data) {
    const input = form.elements.namedItem("discount_code");
    const status = form.querySelector(".sp-discount-status");
    const apply = form.querySelector("[data-discount-apply]");
    if (!input || !status) return;
    const code = normalizeDiscountCode(input.value);
    if (code === null) {
      clearCheckoutDiscount(form);
      status.textContent = "Enter the code exactly as the shop gave it to you.";
      return;
    }
    input.value = code;
    clearCheckoutDiscount(form);
    if (!code) {
      status.textContent = "No discount code entered.";
      return;
    }
    const lines = readCartLines(data);
    if (!lines || !lines.length) {
      status.textContent = "Your cart is empty.";
      return;
    }
    const items = lines.map(orderItemFromCartLine).map(item => {
      const line = { product_id: item.product_id, quantity: item.quantity };
      if (item.variant_id) line.variant_id = item.variant_id;
      return line;
    });
    if (apply) apply.disabled = true;
    status.textContent = "Checking the code…";
    try {
      const result = await postStorefrontJson("/api/discounts/validate", { code, items }, "Could not check the code");
      if (normalizeDiscountCode(input.value) !== code) return;
      const cents = Number(result.discount_cents);
      if (result.valid !== true || !Number.isSafeInteger(cents) || cents < 1) {
        status.textContent = typeof result.error === "string" && result.error
          ? result.error
          : "That code cannot be used on this order.";
        return;
      }
      form.dataset.discountPreview = JSON.stringify({ code, cents });
      refreshDiscountPreview(form, data);
    } catch (error) {
      status.textContent = error && [404, 405, 501].includes(error.status)
        ? `Code ${code} added. The shop checks it when you place your order, and the discount shows in your total.`
        : friendlyRequestError(error, "Could not check the code. You can still place the order; the shop checks it then.");
    } finally {
      if (apply) apply.disabled = false;
    }
  }

  function showCheckoutDiscount(form, data, order, discountCents, code) {
    const summary = document.getElementById("spSum") || form.parentElement?.querySelector(".sp-sum");
    if (summary) {
      summary.querySelectorAll("[data-litrus-discount-row]").forEach(row => row.remove());
      const total = summary.querySelector(".sp-total");
      if (total) {
        const row = document.createElement("div");
        row.className = "sp-row";
        row.dataset.litrusDiscountRow = "";
        const label = document.createElement("span");
        label.textContent = `Discount (${code})`;
        const amount = document.createElement("b");
        amount.textContent = `−${formatShopMoney(data, discountCents / 100)}`;
        row.append(label, amount);
        total.before(row);
        const totalAmount = total.querySelector("b");
        if (totalAmount && Number.isFinite(Number(order.total))) {
          if (!totalAmount.dataset.litrusBaseTotal) totalAmount.dataset.litrusBaseTotal = totalAmount.textContent;
          totalAmount.textContent = formatShopMoney(data, order.total);
        }
      }
    }
    const status = form.querySelector(".sp-discount-status");
    if (status) status.textContent = `Discount applied: −${formatShopMoney(data, discountCents / 100)}.`;
  }

  function itemVariantLabel(item, sentItems) {
    if (item.variant_label) return String(item.variant_label);
    const sent = (sentItems || []).filter(line => String(line.product_id) === String(item.product_id) && line.variant_label);
    if (item.variant_id) {
      const exact = sent.find(line => String(line.variant_id) === String(item.variant_id));
      if (exact) return exact.variant_label;
    }
    return sent.length === 1 ? sent[0].variant_label : "";
  }

  function showManualOrder(root, order, customer, delivery, payment, via, data, sentItems = [], discountCode = "", discountCents = 0) {
    const discount = discountCents > 0 ? discountCents / 100 : Number(order.discount) || 0;
    const message = [
      `New order ${order.order_number} for ${data.shop.name}`,
      "",
      `Name: ${customer.name}`,
      `Phone: ${customer.phone}`,
      ...(customer.email ? [`Email: ${customer.email}`] : []),
      `Delivery: ${delivery === "pickup" ? "Pickup" : [customer.address, customer.town].filter(Boolean).join(", ")}`,
      `Payment: ${payment}`,
      "",
      "Items:",
      ...order.items.map(item => {
        const label = itemVariantLabel(item, sentItems);
        return `- ${item.quantity} x ${item.name}${label ? ` (${label})` : ""} (${item.unit_price} ${order.currency})`;
      }),
      "",
      `Subtotal: ${order.subtotal} ${order.currency}`,
      ...(discount > 0 ? [`Discount${discountCode ? ` (${discountCode})` : ""}: -${discount} ${order.currency}`] : []),
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
    back.addEventListener("click", goBackToShop);
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
    const payment = selected("pay") || (data.shop.paystackConnected !== false ? "paystack" : "Pay the shop directly");
    const paying = payment === "paystack";
    const via = selected("via") || value("via") || "none";
    const lines = readCartLines(data);
    if (!lines) {
      if (error) error.textContent = "Your cart could not be read. Refresh the shop and try again.";
      return;
    }
    const items = lines.map(orderItemFromCartLine);
    if (!customer.name) {
      if (error) error.textContent = "Please enter your name.";
      return;
    }
    if (customer.phone.replace(/\D/g, "").length < 7) {
      if (error) error.textContent = "Please enter a phone number we can reach you on.";
      return;
    }
    if (!customer.email && (paying || checkoutEmailAlwaysRequired(form))) {
      if (error) error.textContent = paying
        ? "Enter your email address for your Paystack receipt."
        : "Enter your email address so the shop can confirm your order.";
      return;
    }
    if (customer.email && !SERVICE_EMAIL_PATTERN.test(customer.email)) {
      if (error) error.textContent = paying
        ? "Enter a valid email address for your Paystack receipt."
        : "That email address does not look right. Check it or leave it blank.";
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
    const discountCode = normalizeDiscountCode(form.elements.namedItem("discount_code")?.value);
    if (discountCode === null) {
      if (error) error.textContent = "That discount code does not look right. Check it or clear the field.";
      return;
    }
    const holdIds = matchingHoldIds(data, new Set(lines.map(line => canonicalProductId(data, line.id) || String(line.id))), customer);
    if (error) error.textContent = "";
    let requestKey;
    try {
      requestKey = newRequestKey();
    } catch (caught) {
      if (error) error.textContent = caught instanceof Error ? caught.message : "Your order could not be sent.";
      return;
    }
    // The key follows what is being bought. Clearing a code the shop could not apply keeps the key,
    // so the retry returns the order already saved instead of creating a second full-price order.
    const signature = JSON.stringify({ items, customer, delivery, holdIds });
    const codeChanged = discountCode !== "" && discountCode !== (form.dataset.keyDiscountCode || "");
    if (form.dataset.cartSignature !== signature || !form.dataset.idempotencyKey || codeChanged) {
      form.dataset.cartSignature = signature;
      form.dataset.idempotencyKey = requestKey;
      form.dataset.keyDiscountCode = discountCode;
    }
    if (submit) submit.disabled = true;
    try {
      if (form.dataset.checkoutTracked !== form.dataset.idempotencyKey) {
        form.dataset.checkoutTracked = form.dataset.idempotencyKey;
        new Set(items.map(item => item.product_id)).forEach(productId => trackStorefrontEvent(data, productId, "checkout_start"));
      }
      const payload = {
        idempotency_key: form.dataset.idempotencyKey,
        customer_name: customer.name,
        customer_phone: customer.phone,
        shipping_address: delivery === "pickup" ? "Store pickup" : customer.address || customer.town,
        city: customer.town,
        delivery_method: delivery,
        payment_method: paying ? "paystack" : "manual",
        items
      };
      if (customer.email) payload.customer_email = customer.email;
      if (holdIds.length) payload.hold_ids = holdIds;
      if (discountCode) payload.discount_code = discountCode;
      let created;
      try {
        created = await postStorefrontJson("/api/orders", payload);
      } catch (caught) {
        if (!(holdIds.length && caught && caught.status === 409 && /\bholds?\b/i.test(caught.message))) throw caught;
        // A reservation that expired or was released must not block the order: forget it and
        // let the Worker check ordinary stock instead.
        removeStoredHolds(holdIds);
        delete payload.hold_ids;
        form.dataset.idempotencyKey = newRequestKey();
        form.dataset.cartSignature = JSON.stringify({ items, customer, delivery, holdIds: [] });
        form.dataset.keyDiscountCode = discountCode;
        payload.idempotency_key = form.dataset.idempotencyKey;
        created = await postStorefrontJson("/api/orders", payload);
      }
      if (!created.order?.order_number) throw new Error("The shop did not confirm the order.");
      const order = created.order;
      const expectedCents = expectedSubtotalCents(data, lines);
      const serverCents = order.subtotal === undefined || order.subtotal === null ? NaN : Math.round(Number(order.subtotal) * 100);
      if (expectedCents !== null && Number.isFinite(serverCents) && serverCents !== expectedCents) {
        throw new Error(`The shop priced your items at ${formatShopMoney(data, serverCents / 100)} but your cart shows ${formatShopMoney(data, expectedCents / 100)}. Nothing was charged. Refresh the page and try again, or contact the shop.`);
      }
      const discountCents = serverDiscountCents(created);
      if (discountCode) {
        if (discountCents <= 0) {
          throw new Error(`The code ${discountCode} could not be applied to this order. Clear it to continue without a discount.`);
        }
        showCheckoutDiscount(form, data, order, discountCents, discountCode);
      }
      const purchased = items.map(item => ({ product_id: item.product_id, quantity: item.quantity }));
      if (paying) {
        // The purchase is counted when the payment is verified on return, not when it is only started.
        writeLocalJson(`sp:${data.shop.key}:pending-order`, {
          order_number: order.order_number, items: purchased, hold_ids: holdIds
        });
        const initialized = await postStorefrontJson("/api/payments/paystack/initialize", {
          order_number: order.order_number
        });
        const checkout = new URL(initialized.authorization_url);
        if (checkout.protocol !== "https:" || checkout.hostname !== "checkout.paystack.com") {
          throw new Error("Paystack returned an unsafe checkout link.");
        }
        location.assign(checkout.href);
        return;
      }
      purchased.forEach(item => trackStorefrontEvent(data, item.product_id, "purchase", item.quantity));
      removeStoredHolds(holdIds);
      showManualOrder(root, order, customer, delivery, payment, via, data, items, discountCode, discountCents);
    } catch (caught) {
      let message = friendlyRequestError(caught, "Your order could not be sent.");
      if (caught && caught.code === "discount_invalid") {
        // Nothing was ordered, so the customer can clear the code or try another and order again.
        message = `${message} Clear the code or try another one to continue.`;
        clearCheckoutDiscount(form);
        const codeStatus = form.querySelector(".sp-discount-status");
        if (codeStatus) codeStatus.textContent = message;
        form.elements.namedItem("discount_code")?.focus?.();
      } else if (caught && (caught.code === "variant_unavailable" || caught.code === "variant_required")) {
        message = `${message} Open the product again and choose an option.`;
      } else if (caught && caught.status === 400 && !customer.email) {
        message = "The shop could not take this order without an email address. Add your email and try again.";
        form.dataset.eshopEmailRequired = "always";
        syncCheckoutEmail(form);
        form.elements.namedItem("email")?.focus?.();
      }
      if (error) error.textContent = message;
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
    message.setAttribute("role", "status");
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
      const confirmedOrder = result.order_number || orderNumber;
      const pendingKey = `sp:${data.shop.key}:pending-order`;
      const pending = readLocalJson(pendingKey, null);
      const trackedKey = `sp:${data.shop.key}:purchase-tracked`;
      if (pending && Array.isArray(pending.items) && (!confirmedOrder || pending.order_number === confirmedOrder) &&
          readLocalJson(trackedKey, "") !== reference) {
        writeLocalJson(trackedKey, reference);
        pending.items.forEach(item => trackStorefrontEvent(data, item.product_id, "purchase", Number(item.quantity) || 1));
        removeStoredHolds(Array.isArray(pending.hold_ids) ? pending.hold_ids : []);
        try {
          localStorage.removeItem(pendingKey);
        } catch {
          // The pending record is only a convenience for analytics and hold clean-up.
        }
      }
      localStorage.setItem(`sp:${data.shop.key}:cart`, "[]");
      message.textContent = `Payment confirmed. Order ${confirmedOrder} is complete.`;
    } catch (caught) {
      message.textContent = caught instanceof Error ? caught.message : "Payment could not be verified.";
    }
    const back = document.createElement("a");
    back.className = "sp-btn";
    back.href = "/#/";
    back.addEventListener("click", goBackToShop);
    back.textContent = "Continue shopping";
    root.append(back);
  }

  // These pages are rendered once at load and nothing listens for hashchange, so a plain "/#/" link
  // would only change the address bar. Set the route and reload so the shop itself opens.
  function goBackToShop(event) {
    event.preventDefault();
    try {
      location.hash = "/";
    } catch {
      /* the reload below still opens the shop */
    }
    location.reload();
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
      const request = {
        product_id: String(product.id),
        quantity: Number(fields.get("quantity")) || 1,
        customer_name: fields.get("customer_name"),
        contact: fields.get("contact")
      };
      // One key per reservation: retrying after a dropped connection returns the hold the Worker
      // already made instead of reserving the stock a second time.
      const signature = JSON.stringify(request);
      if (form.dataset.holdSignature !== signature || !form.dataset.holdKey) {
        form.dataset.holdSignature = signature;
        form.dataset.holdKey = newRequestKey();
      }
      const response = await fetch("/api/product-holds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idempotency_key: form.dataset.holdKey, ...request })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Could not hold this product.");
      const hold = result.hold;
      if (!hold?.id || !hold?.expires_at) throw new Error("The shop did not confirm this product hold.");
      delete form.dataset.holdKey;
      delete form.dataset.holdSignature;
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

  // ---- customer self-service (manage link) --------------------------------------------------

  const SERVICE_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

  // Plain-language text for every error_code the booking endpoints return. cutoff_passed keeps the
  // Worker's own sentence because it names the exact number of hours.
  const SERVICE_ERROR_MESSAGES = {
    slot_unavailable: "That time is no longer available. Pick another time from the list.",
    service_changed: "This service was updated. Reload the page and choose a time again.",
    service_unavailable: "This service cannot be booked right now.",
    shop_not_found: "This shop could not be found.",
    invalid_request: "Check the details you entered and try again.",
    rate_limited: "Too many requests from this connection. Wait a little and try again.",
    too_large: "That request was too large. Shorten your details and try again.",
    storage_unavailable: "Booking is temporarily unavailable. Try again later.",
    appointment_not_found: "This booking link is not valid. Use the link from your confirmation.",
    not_changeable: "This booking can no longer be changed online.",
    appointment_busy: "The shop is still setting up this booking. Try again in a moment.",
    appointment_started: "This appointment has already started.",
    appointment_changed: "This booking just changed. Reload the page to see where it stands.",
    slot_unchanged: "That is your current time. Choose a different one.",
    reschedule_limit: "This booking cannot be moved again online. Contact the shop."
  };

  function serviceErrorMessage(error, fallback) {
    const mapped = error && typeof error.code === "string" ? SERVICE_ERROR_MESSAGES[error.code] : "";
    return mapped || friendlyRequestError(error, fallback);
  }

  function serviceManageHref(token) {
    return `#/booking/${token}`;
  }

  function removeStoredServiceRequestByToken(token) {
    const list = readLocalJson(serviceRequestsKey(), []);
    if (!Array.isArray(list)) return;
    writeLocalJson(serviceRequestsKey(), list.filter(item => !item || item.manage_token !== token));
  }

  function serviceStatusText(appointment) {
    if (appointment.status === "pending") {
      return appointment.expired
        ? "The shop did not reply to this request in time. Contact the shop or request another time."
        : "Waiting for the shop to confirm. Nothing is booked until they do.";
    }
    if (appointment.status === "confirming") return "The shop is confirming this booking.";
    if (appointment.status === "confirmed") return "Confirmed by the shop";
    if (appointment.status === "rejected") return "The shop could not take this request";
    if (appointment.status === "cancelled") {
      return appointment.cancelled_by === "shop" ? "Cancelled by the shop" : "Cancelled";
    }
    if (appointment.status === "completed") return "Completed";
    if (appointment.status === "no_show") return "Marked as missed by the shop";
    return String(appointment.status || "");
  }

  function renderServiceManagePage(root, data, token) {
    const section = document.createElement("main");
    section.className = "sp sp-main";
    const content = document.createElement("div");
    content.className = "sp-wrap sp-done sp-service-manage";
    const heading = document.createElement("h1");
    heading.textContent = "Your booking";
    const details = document.createElement("ul");
    const message = document.createElement("p");
    message.setAttribute("role", "status");
    message.textContent = "Loading your booking…";
    const actions = document.createElement("div");
    actions.className = "sp-service-manage-actions";
    const back = document.createElement("a");
    back.className = "sp-btn ghost";
    back.href = "/#/";
    back.addEventListener("click", goBackToShop);
    back.textContent = "Back to the shop";
    content.append(heading, details, message, actions, back);
    section.append(content);
    root.replaceChildren(section);
    const say = text => {
      message.textContent = text;
    };

    async function call(payload) {
      return postStorefrontJson("/api/service-appointments/manage", { token, ...payload }, "Request failed");
    }

    function draw(appointment, notice = "") {
      details.replaceChildren();
      actions.replaceChildren();
      const timezone = appointment.timezone || data.shop.serviceTimezone;
      const rows = [
        ["Service", appointment.service_name || "Your service"],
        ["When", formatServiceTime(appointment.starts_at, timezone)],
        ["Status", serviceStatusText(appointment)],
        ["Reference", appointment.reference || ""]
      ];
      const deposit = Number(appointment.deposit_cents) || 0;
      if (deposit > 0) {
        const amount = formatShopMoney(data, deposit / 100);
        const paid = appointment.payment_status === "paid";
        rows.push(["Deposit", appointment.deposit_refunded
          ? `${amount} paid and refunded by the shop`
          : appointment.deposit_refund_due
            ? `${amount} paid; the shop has been asked to refund it`
            : paid ? `${amount} paid` : `${amount} due once the shop confirms`]);
      }
      rows.forEach(([label, text]) => {
        if (!text) return;
        const item = document.createElement("li");
        item.textContent = `${label}: ${text}`;
        details.append(item);
      });
      if (appointment.status === "cancelled" && appointment.cancel_reason && appointment.cancelled_by === "shop") {
        const reason = document.createElement("li");
        reason.textContent = `Reason: ${appointment.cancel_reason}`;
        details.append(reason);
      }
      say(notice);
      let paymentLink = null;
      try {
        const url = new URL(String(appointment.payment_authorization_url || ""));
        if (url.protocol === "https:" && url.hostname === "checkout.paystack.com") paymentLink = url;
      } catch {
        paymentLink = null;
      }
      if (paymentLink) {
        const pay = document.createElement("a");
        pay.className = "sp-btn";
        pay.href = paymentLink.href;
        pay.textContent = "Pay deposit";
        actions.append(pay);
      }
      const live = (appointment.status === "pending" && !appointment.expired) || appointment.status === "confirmed";
      const future = Date.parse(appointment.starts_at) > Date.now();
      if (appointment.can_cancel) {
        drawCancel(appointment);
        if (appointment.can_reschedule) drawReschedule(appointment);
        else if (live) {
          const limit = document.createElement("p");
          limit.textContent = "This booking cannot be moved online again. Contact the shop to change it.";
          actions.append(limit);
        }
      } else if (live && future) {
        const closed = document.createElement("p");
        const hours = Number(appointment.cancel_cutoff_hours);
        closed.textContent = Number.isFinite(hours) && hours > 0
          ? `Changes online close ${hours} hour${hours === 1 ? "" : "s"} before the start.`
          : "This booking can no longer be changed online.";
        actions.append(closed);
        appendShopContact(actions, data, appointment.reference || "");
      } else if (appointment.status !== "cancelled" || appointment.cancelled_by === "shop") {
        appendShopContact(actions, data, appointment.reference || "");
      }
      if (appointment.status === "cancelled") removeStoredServiceRequestByToken(token);
    }

    function drawCancel(appointment) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "sp-btn ghost";
      button.textContent = "Cancel this booking";
      const paid = appointment.payment_status === "paid" && Number(appointment.deposit_cents) > 0;
      let armed = false;
      button.addEventListener("click", async () => {
        if (!armed) {
          armed = true;
          button.textContent = paid
            ? "Tap again to cancel. The shop will be asked to refund your deposit."
            : "Tap again to confirm cancelling";
          return;
        }
        button.disabled = true;
        say("Cancelling…");
        try {
          const result = await call({ action: "cancel" });
          draw(result.appointment, "Your booking was cancelled. The shop has been told.");
        } catch (error) {
          button.disabled = false;
          armed = false;
          button.textContent = "Cancel this booking";
          say(serviceErrorMessage(error, "Could not cancel this booking."));
        }
      });
      actions.append(button);
    }

    function drawReschedule(appointment) {
      const form = document.createElement("form");
      form.className = "sp-hold-form";
      const title = document.createElement("h2");
      title.textContent = "Move to another time";
      const note = document.createElement("p");
      const remaining = Number(appointment.reschedules_remaining) || 0;
      note.textContent = `You can move this booking ${remaining} more time${remaining === 1 ? "" : "s"}. Times use ${timezoneLabel(appointment)}.`;
      const dateLabel = document.createElement("label");
      dateLabel.textContent = "Choose a date";
      const date = document.createElement("input");
      date.type = "date";
      date.required = true;
      date.min = shopTodayDate(appointment.timezone || data.shop.serviceTimezone);
      dateLabel.append(date);
      const slotLabel = document.createElement("label");
      slotLabel.textContent = "Available time";
      const slots = document.createElement("select");
      slots.required = true;
      slots.disabled = true;
      const first = document.createElement("option");
      first.value = "";
      first.textContent = "Choose a date first";
      slots.append(first);
      slotLabel.append(slots);
      const submit = document.createElement("button");
      submit.type = "submit";
      submit.className = "sp-btn";
      submit.textContent = "Move booking";
      form.append(title, note, dateLabel, slotLabel, submit);
      actions.append(form);

      async function loadSlots(notice = "") {
        if (!date.value) return;
        const requested = date.value;
        slots.disabled = true;
        slots.replaceChildren();
        const loading = document.createElement("option");
        loading.value = "";
        loading.textContent = "Loading available times…";
        slots.append(loading);
        try {
          const result = await call({ action: "slots", date: requested });
          if (date.value !== requested) return;
          const available = (Array.isArray(result.slots) ? result.slots : []).filter(slot =>
            slot && typeof slot.starts_at === "string" && Date.parse(slot.starts_at) > Date.now() &&
            slot.starts_at !== appointment.starts_at);
          slots.replaceChildren();
          const empty = document.createElement("option");
          empty.value = "";
          empty.textContent = available.length ? "Choose a time" : "No available times for this date";
          slots.append(empty);
          available.forEach(slot => slots.append(serviceSlotOption(slot, result.capacity)));
          slots.disabled = !available.length;
          say(available.length ? notice : "No times are available on this date. Try another date.");
        } catch (error) {
          slots.replaceChildren();
          const failed = document.createElement("option");
          failed.value = "";
          failed.textContent = "Could not load times";
          slots.append(failed);
          say(serviceErrorMessage(error, "Could not load available times."));
        }
      }
      date.addEventListener("change", () => void loadSlots());
      form.addEventListener("submit", async event => {
        event.preventDefault();
        if (!slots.value) {
          say("Choose a date, then pick one of the available times.");
          return;
        }
        submit.disabled = true;
        say("Moving your booking…");
        try {
          const result = await call({ action: "reschedule", starts_at: slots.value });
          draw(result.appointment, "Your booking was moved. The shop has been told.");
        } catch (error) {
          submit.disabled = false;
          const failure = serviceErrorMessage(error, "Could not move this booking.");
          say(failure);
          if (error && (error.code === "slot_unavailable" || error.status === 409)) void loadSlots(failure);
        }
      });
    }

    function timezoneLabel(appointment) {
      return appointment.timezone || data.shop.serviceTimezone;
    }

    call({ action: "view" }).then(result => draw(result.appointment)).catch(error => {
      details.replaceChildren();
      actions.replaceChildren();
      say(serviceErrorMessage(error, "Could not load this booking."));
      if (error && error.code === "appointment_not_found") removeStoredServiceRequestByToken(token);
    });
  }

  function serviceSlotOption(slot, capacity) {
    const option = document.createElement("option");
    option.value = slot.starts_at;
    const remaining = Number(slot.remaining);
    // Spots left are only mentioned for shops that can take several bookings at once.
    option.textContent = Number(capacity) > 1 && Number.isFinite(remaining) && remaining > 0
      ? `${slot.label} · ${remaining} spot${remaining === 1 ? "" : "s"} left`
      : String(slot.label || "");
    return option;
  }

  async function verifyServiceDepositReturn(root) {
    const section = document.createElement("main");
    section.className = "sp sp-main";
    const content = document.createElement("div");
    content.className = "sp-wrap sp-done";
    const heading = document.createElement("h1");
    heading.textContent = "Appointment deposit";
    const status = document.createElement("p");
    status.setAttribute("role", "status");
    status.textContent = "Verifying your payment…";
    const back = document.createElement("a");
    back.className = "sp-btn ghost";
    back.href = "/#/";
    back.addEventListener("click", goBackToShop);
    back.textContent = "Back to the shop";
    content.append(heading, status, back);
    section.append(content);
    root.replaceChildren(section);
    const reference = new URLSearchParams(location.hash.split("?")[1] || "").get("reference") || "";
    if (!reference) {
      status.textContent = "The payment reference is missing. Contact the shop to confirm your appointment.";
      return;
    }
    try {
      const query = new URLSearchParams({ reference });
      const result = await getStorefrontJson(`/api/service-appointments/payment?${query}`);
      const paymentStatus = result.appointment?.payment_status;
      status.textContent = paymentStatus === "paid"
        ? "Payment received. Your appointment is confirmed."
        : paymentStatus === "failed"
          ? "The deposit payment did not go through. Contact the shop to try again; nothing further was charged."
          : "Payment is not confirmed yet. Refresh this page or contact the shop.";
    } catch (error) {
      status.textContent = friendlyRequestError(error, "Could not verify the payment. Contact the shop.");
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
    if (/^#\/service-payment(?:\?|$)/.test(location.hash)) {
      void verifyServiceDepositReturn(root);
      return;
    }
    const manageRoute = location.hash.match(/^#\/booking\/([A-Za-z0-9_-]{43})$/);
    if (manageRoute) {
      renderServiceManagePage(root, data, manageRoute[1]);
      return;
    }
    const trackEvent = (productId, type, count = 1) => trackStorefrontEvent(data, productId, type, count);
    root.addEventListener("click", event => {
      const target = event.target instanceof Element ? event.target : null;
      const manageLink = target?.closest("[data-service-manage-link]");
      if (manageLink) {
        // The manage page is rendered at load (like the payment return), so open it with a reload.
        event.preventDefault();
        location.hash = String(manageLink.getAttribute("href") || "").replace(/^#/, "");
        location.reload();
        return;
      }
      const availabilityButton = target?.closest("[data-service-load-slots]");
      if (availabilityButton) {
        event.preventDefault();
        const form = availabilityButton.closest("[data-litrus-service-booking-form]");
        if (form) void loadServiceAvailability(form);
        return;
      }
      const discountApply = target?.closest("[data-discount-apply]");
      if (discountApply) {
        event.preventDefault();
        const checkoutForm = discountApply.closest("form");
        if (checkoutForm) void applyDiscountCodeInput(checkoutForm, data);
        return;
      }
      const newRequest = target?.closest("[data-service-new-request]");
      if (newRequest) {
        event.preventDefault();
        const bookingForm = newRequest.closest("[data-litrus-service-booking-form]");
        if (bookingForm) reopenServiceForm(bookingForm);
        return;
      }
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
    {
      root.addEventListener("click", event => {
        const target = event.target instanceof Element ? event.target : null;
        const button = target?.closest(".sole-product-add, .p-btn, [data-add], [data-act='addqty'], [data-act='buynow']");
        if (!button || button.closest(".sp-service-booking-form")) return;
        const card = button.closest("[data-pid]");
        const serviceId = button.dataset.pid || button.dataset.add || card?.dataset.pid;
        if (!serviceId) return;
        const tapped = data.shop.products.find(item => String(item.id) === String(serviceId));
        // Only time is booked. A shelf item in the same shop still goes into the bag.
        if (!(Number(tapped?.duration_minutes) > 0) && data.shop.offerType !== "services") return;
        event.preventDefault();
        event.stopImmediatePropagation();
        const route = `p/${serviceId}`;
        if (typeof global.LITRUS_RUNTIME?.go === "function") global.LITRUS_RUNTIME.go(route);
        else location.hash = `#/${route}`;
      }, true);
    }
    root.addEventListener("keydown", event => {
      const input = event.target instanceof HTMLInputElement && event.target.name === "discount_code" ? event.target : null;
      if (!input || event.key !== "Enter") return;
      // Enter in the code field applies the code; it must not submit the whole checkout.
      event.preventDefault();
      const checkoutForm = input.closest("form");
      if (checkoutForm) void applyDiscountCodeInput(checkoutForm, data);
    });
    root.addEventListener("input", event => {
      const input = event.target instanceof HTMLInputElement && event.target.name === "discount_code" ? event.target : null;
      const checkoutForm = input?.closest("form");
      if (!checkoutForm || !checkoutForm.dataset.discountPreview) return;
      // Editing the code drops the previewed discount until the new code is applied.
      let applied = "";
      try {
        applied = JSON.parse(checkoutForm.dataset.discountPreview).code || "";
      } catch {
        applied = "";
      }
      if (normalizeDiscountCode(input.value) !== applied) {
        clearCheckoutDiscount(checkoutForm);
        const codeStatus = checkoutForm.querySelector(".sp-discount-status");
        if (codeStatus) codeStatus.textContent = "";
      }
    });
    // The price has to follow the option the shopper picks. The editor preview syncs this in its
    // own runtime, but a published page only loads this file, and pages are rebuilt from HTML, so
    // the picker is synced here with every other delegated control.
    // What the chosen priced attributes add to (or take off) the price of this product.
    const pricedAttributeDelta = (product, info) => {
      const offered = Array.isArray(product?.priced_attributes) ? product.priced_attributes : [];
      if (!offered.length || !info) return 0;
      return [...info.querySelectorAll("[data-priced-attribute]")].reduce((total, select) => {
        if (!select.value) return total;
        const attribute = offered.find(item => item && item.attributeName === select.dataset.pricedAttribute);
        const match = (attribute?.values || []).find(value =>
          String(value.value ?? "").toLowerCase() === select.value.toLowerCase());
        return total + (Number(match?.priceDelta ?? match?.price_delta) || 0);
      }, 0);
    };
    const showPrice = (info, amount) => {
      const priceNode = info?.querySelector(".sp-price");
      if (!priceNode) return;
      priceNode.textContent = (data.shop.cur ? `${data.shop.cur} ` : "")
        + Math.max(0, Math.round(amount * 100) / 100).toLocaleString("en-US");
    };
    // Picking a priced attribute on a product with no variants must still move the price.
    const syncPricedAttributes = host => {
      const product = data.shop.products.find(item => String(item.id) === String(host.dataset.productPricedAttributes));
      if (!product) return;
      const info = host.closest(".sp-info") || host.closest(".sp-pdp") || root;
      const picker = info.querySelector("[data-product-variant-picker]");
      if (picker) {
        syncVariantPrice(picker);
        return;
      }
      showPrice(info, Number(product.price) + pricedAttributeDelta(product, info));
      const picked = JSON.stringify([...info.querySelectorAll("[data-priced-attribute]")]
        .filter(select => select.value)
        .map(select => ({ attributeName: select.dataset.pricedAttribute, value: select.value })));
      info.querySelectorAll("[data-act='addqty'], [data-act='buynow']")
        .forEach(button => { button.dataset.pricedAttributes = picked; });
    };
    const syncVariantPrice = picker => {
      const product = data.shop.products.find(item => String(item.id) === String(picker.dataset.productVariantPicker));
      const variants = Array.isArray(product?.variants) ? product.variants : [];
      if (!variants.length) return;
      const selects = [...picker.querySelectorAll("[data-variant-option]")];
      const optionValue = (variant, select) => {
        const position = Number(select.dataset.variantOptionPosition)
          || (select.dataset.variantOption === "size" ? 1 : 2);
        if (position === 1) return String(variant.option1_value ?? variant.size ?? "");
        if (position === 2) return String(variant.option2_value ?? variant.color ?? "");
        return String(variant[`option${position}_value`] ?? "");
      };
      const chosen = selects.length > 0 && selects.every(select => select.value)
        ? variants.find(variant => selects.every(select => optionValue(variant, select) === select.value))
        : null;
      const info = picker.closest(".sp-info") || picker.closest(".sp-pdp") || root;
      const base = chosen && chosen.price !== null && chosen.price !== undefined && chosen.price !== ""
        ? Number(chosen.price)
        : Number(product.price);
      showPrice(info, base + pricedAttributeDelta(product, info));
      const pickedForLine = JSON.stringify([...info.querySelectorAll("[data-priced-attribute]")]
        .filter(select => select.value)
        .map(select => ({ attributeName: select.dataset.pricedAttribute, value: select.value })));
      info.querySelectorAll("[data-act='addqty'], [data-act='buynow'], [data-variant-required]")
        .forEach(button => { button.dataset.pricedAttributes = pickedForLine; });
      info.querySelectorAll("[data-variant-required]").forEach(button => {
        if (chosen) {
          button.dataset.variantId = String(chosen.id);
          button.disabled = Number(chosen.stock) <= 0;
        } else {
          delete button.dataset.variantId;
          button.disabled = true;
        }
      });
    };
    root.addEventListener("change", event => {
      const picker = event.target instanceof Element
        ? event.target.closest("[data-product-variant-picker]")
        : null;
      if (picker) syncVariantPrice(picker);
      const pricedHost = event.target instanceof Element
        ? event.target.closest("[data-product-priced-attributes]")
        : null;
      if (pricedHost) syncPricedAttributes(pricedHost);
      const field = event.target instanceof HTMLInputElement && event.target.form?.id === "spco" ? event.target : null;
      if (field && field.name === "pay") syncCheckoutEmail(field.form);
      if (field && field.name === "dm") {
        const checkoutForm = field.form;
        // The page rebuilds the order summary on this change, so redraw the discount just after it.
        setTimeout(() => refreshDiscountPreview(checkoutForm, data), 0);
      }
      const date = event.target instanceof HTMLInputElement && event.target.matches('input[name="date"]')
        ? event.target
        : null;
      const form = date?.closest("[data-litrus-service-booking-form]");
      if (!date || !form) return;
      resetServiceSlots(form);
      const status = form.querySelector(".sp-service-booking-status");
      if (status) status.textContent = "";
      // Picking a date shows its times straight away; the button stays as a manual refresh.
      if (date.value) void loadServiceAvailability(form);
    });
    root.addEventListener("submit", event => {
      const appointmentForm = event.target instanceof HTMLFormElement && event.target.matches("[data-litrus-service-booking-form]")
        ? event.target
        : null;
      if (appointmentForm) {
        event.preventDefault();
        event.stopImmediatePropagation();
        void requestServiceAppointment(appointmentForm, data);
        return;
      }
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
          if (form) {
            installPaystackOption(form, data);
            installDiscountField(form);
          }
        }
        root.querySelectorAll("[data-litrus-service-booking-form]").forEach(form => renderServiceRequestList(form, data));
      }
    });
    litrusInitLiveSpin(document);
    litrusInitCardPreview(document);
  }

  global.litrusRefreshPublishedCatalog = litrusRefreshPublishedCatalog;
  global.litrusInitLiveSpin = litrusInitLiveSpin;
  global.litrusDecorateCard = litrusDecorateCard;
  global.litrusInitCardPreview = litrusInitCardPreview;
  global.litrusStartLiveStore = litrusStartLiveStore;
  global.litrusDirectPaymentChoices = directPaymentChoices;
})(window);
