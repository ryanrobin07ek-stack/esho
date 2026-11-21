// Search inputs.
// Moved verbatim out of src/app/main.js (the AppController object); main.js spreads these back in at the same spots.
import { AppUtils, SQLiteEngine } from './main.js';

export const searchInputsController = {
  initSearchInputs() {
    const input = document.getElementById("navbar-search-input");
    const dropdown = document.getElementById("search-quick-dropdown");
    if (!input || !dropdown) return;

    let debounceTimer = null;
    input.addEventListener("input", (e) => {
      clearTimeout(debounceTimer);
      const q = e.target.value.trim();
      if (q.length < 2) {
        dropdown.classList.remove("active");
        dropdown.innerHTML = "";
        return;
      }
      debounceTimer = setTimeout(() => {
        const results = SQLiteEngine.getProducts({ query: q, limit: 5 }).items;
        if (!results.length) {
          dropdown.innerHTML = `<div style="padding: 16px; font-size: 0.8125rem; color: var(--text-muted); text-align: center;">No pieces found for "${AppUtils.escapeHTML(q)}"</div>`;
        } else {
          dropdown.innerHTML = `
            ${results.map(p => `
              <a href="/product/${p.slug}" class="search-result-item" data-route="/product/${p.slug}">
                <img src="${p.images && p.images[0] ? p.images[0] : ''}" alt="" class="search-result-thumb">
                <div style="flex: 1;">
                  <div style="font-weight: 500; font-size: 0.875rem;">${AppUtils.escapeHTML(p.name)}</div>
                  <div style="font-size: 0.75rem; color: var(--text-muted);">${AppUtils.escapeHTML(p.brand)} &bull; ${AppUtils.formatMoney(p.price)}</div>
                </div>
              </a>
            `).join("")}
            <a href="/search?q=${encodeURIComponent(q)}" class="search-result-item" data-route="/search?q=${encodeURIComponent(q)}" style="font-weight: 600; font-size: 0.8125rem; justify-content: center; background: var(--surface-subtle);">
              View all results for "${AppUtils.escapeHTML(q)}" &rarr;
            </a>
          `;
        }
        dropdown.classList.add("active");
      }, 180);
    });

    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        const q = input.value.trim();
        dropdown.classList.remove("active");
        if (q) this.navigate(`/search?q=${encodeURIComponent(q)}`);
      }
    });

    document.addEventListener("click", (e) => {
      if (!e.target.closest(".search-box")) {
        dropdown.classList.remove("active");
      }
    });
  },
};
