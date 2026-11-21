// AppUtils: escaping, image/video helpers, money and date formatting, toasts and SEO.
// Moved verbatim out of src/app/main.js; main.js spreads these back in at the same spots.
import { INDEXEDDB_PRODUCT_MEDIA_PREFIX, LOCAL_PRODUCT_MEDIA_PREFIX, openLocalProductMediaDatabase } from './main.js';

export const appUtilsMethods = {
  escapeHTML(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  },

  async compressImageFile(file, {
    maxDimension = 1800,
    maxBytes = 1_500_000,
    maxInputBytes = 5 * 1024 * 1024
  } = {}) {
    if (!(file instanceof Blob) || !file.type.startsWith("image/") || file.size > maxInputBytes) {
      throw new Error("Choose an image smaller than 5 MB.");
    }
    let bitmap;
    let objectUrl = "";
    try {
      bitmap = new Image();
      objectUrl = URL.createObjectURL(file);
      bitmap.src = objectUrl;
      await new Promise((resolve, reject) => {
        bitmap.onload = resolve;
        bitmap.onerror = () => reject(new Error("The selected image could not be decoded."));
      });
      const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      const context = canvas.getContext("2d", { alpha: true });
      if (!context) throw new Error("The selected image could not be compressed.");
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      let quality = 0.84;
      let blob = await new Promise((resolve, reject) => canvas.toBlob(
        value => value ? resolve(value) : reject(new Error("The selected image could not be compressed.")),
        "image/webp",
        quality
      ));
      while (blob.size > maxBytes && quality > 0.5) {
        quality = Math.max(0.5, quality - 0.12);
        blob = await new Promise((resolve, reject) => canvas.toBlob(
          value => value ? resolve(value) : reject(new Error("The selected image could not be compressed.")),
          "image/webp",
          quality
        ));
      }
      if (blob.size > maxBytes && (canvas.width > 480 || canvas.height > 480)) {
        const reduced = document.createElement("canvas");
        reduced.width = Math.max(1, Math.round(canvas.width * 0.72));
        reduced.height = Math.max(1, Math.round(canvas.height * 0.72));
        const reducedContext = reduced.getContext("2d", { alpha: true });
        if (!reducedContext) throw new Error("The selected image could not be compressed.");
        reducedContext.drawImage(canvas, 0, 0, reduced.width, reduced.height);
        blob = await new Promise((resolve, reject) => reduced.toBlob(
          value => value ? resolve(value) : reject(new Error("The selected image could not be compressed.")),
          "image/webp",
          0.72
        ));
        reduced.width = 0;
        reduced.height = 0;
      }
      if (blob.size > maxBytes) throw new Error("This image is still too large after compression. Choose a smaller photo.");
      return await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => typeof reader.result === "string"
          ? resolve(reader.result)
          : reject(new Error("The compressed image could not be read."));
        reader.onerror = () => reject(new Error("The compressed image could not be read."));
        reader.readAsDataURL(blob);
      });
    } finally {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    }
  },

  async storeLocalProductVideo(blob) {
    if (!(blob instanceof Blob) || !blob.size || blob.size > 50_000_000) {
      throw new Error("Videos must be between 1 byte and 50 MB.");
    }
    const database = await openLocalProductMediaDatabase();
    const key = crypto.randomUUID();
    await new Promise((resolve, reject) => {
      const transaction = database.transaction("files", "readwrite");
      transaction.objectStore("files").put(blob, key);
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(new Error("The video could not be saved to local storage."));
      transaction.onabort = () => reject(new Error("The video could not be saved to local storage."));
    });
    return `${INDEXEDDB_PRODUCT_MEDIA_PREFIX}${key}`;
  },

  async readLocalProductMedia(reference) {
    if (typeof reference !== "string") throw new Error("The saved product media reference is invalid.");
    if (reference.startsWith(LOCAL_PRODUCT_MEDIA_PREFIX)) {
      const path = reference.slice(LOCAL_PRODUCT_MEDIA_PREFIX.length);
      const nativeMedia = window.EshopNativeMedia;
      if (!path || !nativeMedia?.Capacitor) throw new Error("This media file is only available in the Craft Android app.");
      const response = await fetch(nativeMedia.Capacitor.convertFileSrc(path));
      if (!response.ok) throw new Error("The saved product media file could not be opened.");
      return response.blob();
    }
    if (reference.startsWith(INDEXEDDB_PRODUCT_MEDIA_PREFIX)) {
      const key = reference.slice(INDEXEDDB_PRODUCT_MEDIA_PREFIX.length);
      const database = await openLocalProductMediaDatabase();
      const blob = await new Promise((resolve, reject) => {
        const request = database.transaction("files", "readonly").objectStore("files").get(key);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(new Error("The saved product video could not be read."));
      });
      if (!(blob instanceof Blob)) throw new Error("The saved product video is missing from local storage.");
      return blob;
    }
    throw new Error("The saved product media reference is not a local file.");
  },

  formatMoney(num) {
    return "$" + Number(num || 0).toLocaleString("en-US", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    });
  },

  // Every cloud-backed screen refuses without a Craft account session, so the shell can offer the
  // way in instead of printing an error the owner cannot act on.
  // One readable date for everything the owner reads. Order and receipt rows used to print the raw
  // database timestamp ("2026-11-16T10:42:57.637Z"), which is not a date a shop owner can use.
  formatDateTime(value, { withTime = true } = {}) {
    if (!value) return "Date unavailable";
    const parsed = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(parsed.getTime())) return "Date unavailable";
    const day = parsed.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
    if (!withTime) return day;
    return `${day}, ${parsed.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`;
  },

  craftAccountSignedIn() {
    try {
      return Boolean(window.localStorage.getItem("ESHOP_ACCOUNT_SESSION_V1")
        && window.localStorage.getItem("ESHOP_ACCOUNT_USERNAME_V1"));
    } catch {
      return false;
    }
  },

  showToast(message, type = "success") {
    let container = document.getElementById("toast-container");
    if (!container) {
      container = document.createElement("div");
      container.id = "toast-container";
      container.className = "toast-container";
      document.body.appendChild(container);
    }
    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    toast.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg>
      <span>${this.escapeHTML(message)}</span>
    `;
    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transform = "translateY(10px)";
      setTimeout(() => toast.remove(), 300);
    }, 3200);
  },

  updateSEO({ title, description, url, image, schema }) {
    const fullTitle = title.includes("Craft") ? title : `${title} — Craft`;
    document.title = fullTitle;

    const setMeta = (nameOrProp, val, isProp = false) => {
      let el = document.querySelector(isProp ? `meta[property="${nameOrProp}"]` : `meta[name="${nameOrProp}"]`);
      if (!el) {
        el = document.createElement("meta");
        if (isProp) el.setAttribute("property", nameOrProp);
        else el.setAttribute("name", nameOrProp);
        document.head.appendChild(el);
      }
      el.setAttribute("content", val || "");
    };

    setMeta("description", description);
    setMeta("og:title", fullTitle, true);
    setMeta("og:description", description, true);
    setMeta("og:url", url || window.location.href, true);
    if (image) setMeta("og:image", image, true);
    setMeta("twitter:title", fullTitle);
    setMeta("twitter:description", description);

    // Schema JSON-LD
    let script = document.getElementById("structured-data-jsonld");
    if (!script) {
      script = document.createElement("script");
      script.id = "structured-data-jsonld";
      script.type = "application/ld+json";
      document.head.appendChild(script);
    }
    if (schema) {
      script.textContent = JSON.stringify(schema);
    } else {
      script.textContent = JSON.stringify({
        "@context": "https://schema.org",
        "@type": "WebSite",
        "name": "Craft",
        "url": window.location.origin
      });
    }
  }
};
