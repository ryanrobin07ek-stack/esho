(() => {
  "use strict";
  const dataElement = document.getElementById("eshop-editable-storefront-data");
  if (!dataElement) return;

  let data;
  try {
    data = JSON.parse(dataElement.textContent || "{}");
  } catch (error) {
    console.error("The editable storefront data is invalid.", error);
    return;
  }

  const layout = data.sectionLayout && typeof data.sectionLayout === "object"
    ? data.sectionLayout
    : { order: [], hidden: [], removed: [], added: [] };
  layout.order = Array.isArray(layout.order) ? layout.order : [];
  layout.hidden = Array.isArray(layout.hidden) ? layout.hidden : [];
  layout.removed = Array.isArray(layout.removed) ? layout.removed : [];
  layout.added = Array.isArray(layout.added) ? layout.added : [];
  const applyText = (element, tag, className, text) => {
    const child = document.createElement(tag);
    if (className) child.className = className;
    child.textContent = text;
    element.append(child);
    return child;
  };
  if (!document.getElementById("eshop-editor-section-style")) {
    const style = document.createElement("style");
    style.id = "eshop-editor-section-style";
    style.textContent = "[data-eshop-editor-section-id][hidden]{display:none!important}";
    document.head.append(style);
  }

  function addSectionNode(section) {
    const node = document.createElement("section");
    node.className = "section";
    node.dataset.eshopEditorSectionId = section.id;
    node.dataset.eshopEditorAdded = "";
    const heading = String(section.title || "New section");

    if (section.type === "image") {
      const image = document.createElement("img");
      image.alt = "";
      image.style.cssText = "width:100%;max-height:420px;object-fit:cover;background:var(--ph,#eef2f6)";
      node.append(image);
      const content = document.createElement("div");
      content.className = "container";
      applyText(content, "h2", "section-title", heading);
      if (section.body) applyText(content, "p", "slot-text", section.body);
      node.append(content);
    } else if (section.type === "products") {
      const content = document.createElement("div");
      content.className = "container";
      const header = document.createElement("div");
      header.className = "section-head";
      applyText(header, "h2", "section-title", heading);
      content.append(header);
      const grid = document.createElement("div");
      grid.className = "product-grid";
      for (const product of data.products || []) {
        const card = document.createElement("article");
        card.className = "product-card";
        card.dataset.productId = String(product.id);
        const link = document.createElement("a");
        link.className = "product-media";
        link.href = `#/product/${encodeURIComponent(product.id)}`;
        const image = product.images?.[0];
        if (image) {
          const img = document.createElement("img");
          img.src = image;
          img.alt = "";
          img.loading = "lazy";
          link.append(img);
        }
        card.append(link);
        const info = document.createElement("div");
        info.className = "product-info";
        applyText(info, "a", "product-name", product.name);
        info.lastElementChild.href = link.href;
        applyText(info, "span", "product-price", new Intl.NumberFormat(undefined, {
          style: "currency", currency: data.currency || "KES"
        }).format(Number(product.price) || 0));
        card.append(info);
        grid.append(card);
      }
      content.append(grid);
      node.append(content);
    } else if (section.type === "categories") {
      const content = document.createElement("div");
      content.className = "container";
      applyText(content, "h2", "section-title", heading);
      const rail = document.createElement("div");
      rail.className = "cat-rail";
      for (const category of data.categories || []) {
        const link = document.createElement("a");
        link.className = "cat-item";
        link.href = `#/category/${encodeURIComponent(category.id)}`;
        const circle = document.createElement("span");
        circle.className = "cat-circle";
        if (category.image) {
          const image = document.createElement("img");
          image.src = category.image;
          image.alt = "";
          image.loading = "lazy";
          circle.append(image);
        }
        link.append(circle);
        applyText(link, "span", "cat-name", category.name);
        rail.append(link);
      }
      content.append(rail);
      node.append(content);
    } else {
      const content = document.createElement("div");
      content.className = "container";
      applyText(content, "h2", "section-title", heading);
      if (section.body) applyText(content, "p", "slot-text", section.body);
      node.append(content);
    }
    return node;
  }

  function render() {
    const layout = window.__ESHOP_EDITOR_SECTION_LAYOUT__ || data.sectionLayout || {
      order: [], hidden: [], removed: [], added: []
    };
    layout.order = Array.isArray(layout.order) ? layout.order : [];
    layout.hidden = Array.isArray(layout.hidden) ? layout.hidden : [];
    layout.removed = Array.isArray(layout.removed) ? layout.removed : [];
    layout.added = Array.isArray(layout.added) ? layout.added : [];
    const app = document.getElementById("app");
    if (!app) return;
    const container = app.querySelector(":scope > .container");
    if (!container || (location.hash && !/^#\/?(home)?(?:\?|$)/.test(location.hash))) return;

    let sections = [...container.querySelectorAll(":scope > section")];
    if (sections.some(section => !section.dataset.eshopEditorSectionId)) {
      sections.forEach((section, index) => {
        if (section.dataset.eshopEditorSectionId) return;
        if (section.matches(".newsletter")) {
          section.dataset.eshopEditorSectionId = "base-newsletter";
          return;
        }
        if (section.matches(".cat-section")) {
          const categoryLink = section.querySelector('a[href*="#/category/"]');
          const categoryId = categoryLink?.getAttribute("href")?.split("#/category/")[1] || "placeholder";
          const safeCategoryId = decodeURIComponent(categoryId).toLowerCase()
            .replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "") || "placeholder";
          section.dataset.eshopEditorSectionId = `base-category-${safeCategoryId}`;
          return;
        }
        const label = (section.getAttribute("aria-label") ||
          section.querySelector("h1,h2,h3")?.textContent || "").trim().toLowerCase();
        const knownId = label === "categories" ? "base-categories"
          : label === "products" ? "base-products"
            : label === "newsletter" ? "base-newsletter" : "";
        section.dataset.eshopEditorSectionId = knownId || `base-${index}`;
      });
    }

    for (const section of layout.added) {
      if (!section?.id || sections.some(existing => existing.dataset.eshopEditorSectionId === section.id)) continue;
      container.append(addSectionNode(section));
      sections.push(container.lastElementChild);
    }

    sections = [...container.querySelectorAll(":scope > section")];
    const byId = new Map(sections.map(section => [section.dataset.eshopEditorSectionId, section]));
    for (const id of layout.removed) byId.get(id)?.remove();
    const removed = new Set(layout.removed);
    for (const section of sections) {
      const id = section.dataset.eshopEditorSectionId;
      section.hidden = layout.hidden.includes(id);
    }
    const ordered = layout.order.map(id => byId.get(id))
      .filter(section => section && !removed.has(section.dataset.eshopEditorSectionId));
    const included = new Set(ordered);
    for (const section of sections) {
      if (!removed.has(section.dataset.eshopEditorSectionId) && !included.has(section)) ordered.push(section);
    }
    const current = [...container.querySelectorAll(":scope > section")].filter(section =>
      !removed.has(section.dataset.eshopEditorSectionId));
    if (current.some((section, index) => section !== ordered[index])) {
      for (const section of ordered) container.append(section);
    }
  }

  let queued = false;
  const schedule = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      render();
    });
  };

  window.__ESHOP_EDITOR_SECTION_LAYOUT__ = layout;
  window.__ESHOP_APPLY_SECTION_LAYOUT__ = render;
  render();
  new MutationObserver(schedule).observe(document.getElementById("app") || document.body, {
    childList: true,
    subtree: true
  });
  window.addEventListener("hashchange", schedule);
})();
