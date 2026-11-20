// Settings screen (/account/settings).
// Moved verbatim from the app script (index.html, then src/app/main.js).
import { AppController, AppUtils, SQLiteEngine, StoreRenderers, StudioRenderers } from '../../app/main.js';

export const settingsScreen = {
  renderSettings() {
    const store = SQLiteEngine.getStore();
    const appearance = AppController.getStudioAppearance();
    const storeColors = [
      { name: "White", value: "#FFFFFF" },
      { name: "Black", value: "#18181B" },
      { name: "Slate", value: "#475569" },
      { name: "Espresso", value: "#7C4A2D" },
      { name: "Home blue", value: "#244EE8" },
      { name: "Navy", value: "#1E3A8A" },
      { name: "Sky blue", value: "#0284C7" },
      { name: "Teal", value: "#0F766E" },
      { name: "Emerald", value: "#059669" },
      { name: "Moss", value: "#4D7C0F" },
      { name: "Violet", value: "#7C3AED" },
      { name: "Plum", value: "#9333EA" },
      { name: "Rose", value: "#E11D48" },
      { name: "Coral", value: "#E85D4F" },
      { name: "Amber", value: "#D97706" }
    ];
    const currentColor = /^#[0-9a-f]{6}$/i.test(appearance.primary_color || "") ? appearance.primary_color.toUpperCase() : "#18181B";
    const isPresetColor = storeColors.some(color => color.value === currentColor);

    AppUtils.updateSEO({
      title: "Settings — Craft Studio",
      description: "Customize store typography, color palettes, card border radius, and store preferences."
    });

    return `
      ${StoreRenderers.renderNavbar('/account/settings')}
      <main class="container store-settings-main">
        <div class="studio-page-header store-settings-header">
          <div>
            <a href="/account" class="studio-back-link" data-route="/account" aria-label="Return to Studio">&larr;</a>
            <h1 class="section-heading">Settings</h1>
          </div>
        </div>

        <form id="store-settings-form" class="store-settings-form">
          <div class="form-group-card store-settings-card">
            <h3 class="form-card-title">App appearance</h3>
            <div class="form-field">
              <span class="form-label">App accent color</span>
              <div class="store-design-options store-color-options">
                ${storeColors.map(color => `
                  <label class="store-design-choice">
                    <input type="radio" name="primaryColor" value="${color.value}" ${currentColor === color.value ? "checked" : ""} />
                    <span class="store-color-swatch" style="--swatch:${color.value};"></span><span>${color.name}</span>
                  </label>
                `).join("")}
                <label class="store-design-choice store-custom-color-choice">
                  <input type="radio" name="primaryColor" value="${currentColor}" ${isPresetColor ? "" : "checked"} />
                  <input type="color" id="custom-store-color" class="store-custom-color" value="${currentColor}" aria-label="Choose a custom accent color" />
                  <span>Custom</span>
                </label>
              </div>
            </div>

            <div class="form-field" style="margin-top:14px;">
              <span class="form-label">Card corners</span>
              <div class="store-design-options">
                <label class="store-design-choice">
                  <input type="radio" name="cardRadius" value="0px" ${appearance.card_radius === '0px' || appearance.card_radius === 'sharp' ? 'checked' : ''} />
                  <span>Sharp</span>
                </label>
                <label class="store-design-choice">
                  <input type="radio" name="cardRadius" value="4px" ${appearance.card_radius === '4px' || appearance.card_radius === 'minimal' || !appearance.card_radius ? 'checked' : ''} />
                  <span>Subtle</span>
                </label>
                <label class="store-design-choice">
                  <input type="radio" name="cardRadius" value="10px" ${appearance.card_radius === '10px' || appearance.card_radius === 'rounded' ? 'checked' : ''} />
                  <span>Rounded</span>
                </label>
              </div>
            </div>

          </div>

          <div class="form-group-card store-settings-card">
            <h3 class="form-card-title">Storefront Announcement</h3>
            <div class="form-field">
              <label class="form-label">Banner Notice Text</label>
              <input type="text" name="announcement" class="form-input" value="${AppUtils.escapeHTML(store.announcement || '')}" />
            </div>
            <div style="margin-top: 12px;">
              <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; font-size: 0.875rem;">
                <input type="checkbox" name="announcementActive" ${store.announcement_active ? 'checked' : ''} />
                <span>Display Announcement Bar</span>
              </label>
            </div>
          </div>

          <button type="submit" class="btn-primary" style="min-height:44px;">Save store design</button>
        </form>
      </main>
      ${StoreRenderers.renderFooter()}
    `;
  },
};

// Screen entry points. The router (handleRoute in src/app/main.js) still draws this screen
// itself, through StudioRenderers.renderSettings(); mount()/unmount() draw and set up this one screen on their own.
export function mount(root) {
  root.innerHTML = StudioRenderers.renderSettings();
}

export function unmount() {}
