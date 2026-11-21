// Theme settings and the app shell theme.
// Moved verbatim out of src/app/main.js (the AppController object); main.js spreads these back in at the same spots.
import { SQLiteEngine } from './main.js';

export const themeController = {
  applyThemeSettings(appearance = this.getStudioAppearance()) {
    const themeTarget = document.documentElement;
    if (/^#[0-9a-f]{6}$/i.test(appearance.primary_color || "")) {
      const channels = appearance.primary_color.slice(1).match(/.{2}/g).map(channel => parseInt(channel, 16));
      const toHex = values => `#${values.map(channel => Math.round(channel).toString(16).padStart(2, "0")).join("")}`;
      const mixHex = (channelsToMix, target, amount) => toHex(channelsToMix.map((channel, index) =>
        channel + (parseInt(target.slice(1).slice(index * 2, index * 2 + 2), 16) - channel) * amount));
      const luminance = channels
        .map(channel => {
          const value = channel / 255;
          return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
        })
        .reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
      const isWhiteAccent = appearance.primary_color.toUpperCase() === "#FFFFFF";
      const isDarkAccent = luminance <= 0.179;
      const foreground = "#18181B";
      const accentForeground = isWhiteAccent || !isDarkAccent ? "#18181B" : "#FFFFFF";
      const surfaceTarget = isDarkAccent && !isWhiteAccent ? "#000000" : "#FFFFFF";
      const blend = amount => mixHex(channels, surfaceTarget, amount);
      themeTarget.style.setProperty("--accent", appearance.primary_color);
      themeTarget.style.setProperty("--accent-hover", isWhiteAccent ? "#F4F4F5" : toHex(channels.map(channel => channel * 0.82)));
      themeTarget.style.setProperty("--accent-light", isWhiteAccent ? "#F4F4F5" : blend(isDarkAccent ? 0.7 : 0.82));
      themeTarget.style.setProperty("--accent-contrast", accentForeground);
      themeTarget.style.setProperty("--bg", "#FFFFFF");
      themeTarget.style.setProperty("--surface", "#FFFFFF");
      themeTarget.style.setProperty("--surface-subtle", "#F5F5F5");
      themeTarget.style.setProperty("--surface-hover", "#EBEBEB");
      themeTarget.style.setProperty("--border", "#E2E2E5");
      themeTarget.style.setProperty("--border-subtle", "#F0F0F1");
      themeTarget.style.setProperty("--text-main", foreground);
      themeTarget.style.setProperty("--text-muted", "#66666B");
      themeTarget.style.setProperty("--text-dim", "#8A8A90");
      themeTarget.style.setProperty("--badge-bg", "#F0F0F1");
      themeTarget.style.setProperty("--badge-text", foreground);
      const themeColor = document.querySelector('meta[name="theme-color"]');
      if (themeColor) themeColor.setAttribute("content", appearance.primary_color);
    }
    const radii = {
      "0px": ["0px", "0px", "0px"],
      "4px": ["4px", "2px", "6px"],
      "10px": ["10px", "5px", "14px"]
    };
    const [radius, smallRadius, largeRadius] = radii[appearance.card_radius] || radii["4px"];
    themeTarget.style.setProperty("--radius", radius);
    themeTarget.style.setProperty("--radius-sm", smallRadius);
    themeTarget.style.setProperty("--radius-lg", largeRadius);
  },

  setAppShellTheme(path, params = new URLSearchParams()) {
    const isAppShell = path === "/" || path === "" || path === "/account" ||
      path.startsWith("/account/") || path === "/app-account" || path === "/pos" ||
      path.startsWith("/pos/") || path === "/store" || path.startsWith("/store/");
    const isAppScreen = isAppShell || path === "/categories" ||
      path === "/store" || path.startsWith("/store/");
    const isNewLitrusEditor = path === "/account/web/site" &&
      params.get("new") === "1" && params.get("edit") === "1" &&
      params.get("theme") === "litrus-mixer";
    const isExistingLitrusEditor = path === "/account/web/site" &&
      params.get("new") !== "1" &&
      SQLiteEngine.getStore().website_theme_id === "litrus-mixer";
    const isCraftAppUi = isAppShell && path !== "/account/web/site";
    const showScreenFade = isAppScreen && path !== "/" &&
      !isNewLitrusEditor && !isExistingLitrusEditor;
    document.body.classList.toggle("app-shell", isAppShell);
    document.body.classList.toggle("craft-app-ui", isCraftAppUi);
    document.body.classList.toggle("app-screen-fade-active", showScreenFade);
    if (isAppShell) {
      this.applyThemeSettings();
      return;
    }

    ["--accent", "--accent-hover", "--accent-light", "--accent-contrast", "--bg",
      "--surface", "--surface-subtle", "--surface-hover", "--border", "--border-subtle",
      "--text-main", "--text-muted", "--text-dim", "--badge-bg", "--badge-text",
      "--radius", "--radius-sm", "--radius-lg"]
      .forEach(property => document.documentElement.style.removeProperty(property));
    const themeColor = document.querySelector('meta[name="theme-color"]');
    if (themeColor) themeColor.setAttribute("content", "#18181B");
  },
};
