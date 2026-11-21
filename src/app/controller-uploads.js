// Catalog image and video upload.
// Moved verbatim out of src/app/main.js (the AppController object); main.js spreads these back in at the same spots.
import { AppUtils } from './main.js';

export const uploadsController = {
  async uploadCatalogImage(image, apiUrl, tenant, token, onStored) {
    if (typeof image !== "string" || !image) return image || "";
    const isDataImage = /^data:image\//i.test(image);
    let imageSource = image;
    if (!isDataImage) {
      if (image.startsWith("/")) return image;
      let sourceUrl;
      try {
        sourceUrl = new URL(image);
      } catch {
        return image;
      }
      if (!["http:", "https:"].includes(sourceUrl.protocol)) return image;
      const tenantHostname = String(tenant.hostname || "").toLowerCase();
      const isRrobinDomain = sourceUrl.hostname === "rrobin.co.ke" ||
        sourceUrl.hostname.endsWith(".rrobin.co.ke");
      if (isRrobinDomain || sourceUrl.hostname === tenantHostname) return image;
      imageSource = sourceUrl.href;
    }
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(imageSource));
    const fingerprint = [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, "0")).join("");
    const cacheKey = `ESHOP_CATALOG_MEDIA_UPLOADS_V1:${tenant.id}`;
    let uploadedMedia = {};
    try {
      const savedMedia = window.localStorage.getItem(cacheKey);
      uploadedMedia = savedMedia ? JSON.parse(savedMedia) : {};
    } catch (error) {
      console.warn("Previously uploaded catalog image cache could not be read; image may be uploaded again.", error);
    }
    if (!uploadedMedia || typeof uploadedMedia !== "object" || Array.isArray(uploadedMedia)) uploadedMedia = {};
    const cachedUrl = uploadedMedia[fingerprint];
    if (typeof cachedUrl === "string") {
      try {
        const cachedPublicUrl = new URL(cachedUrl);
        if (cachedPublicUrl.protocol === "https:" && cachedPublicUrl.pathname.startsWith(`/media/${tenant.id}/`)) {
          if (onStored) onStored({ reused: true });
          return cachedPublicUrl.href;
        }
      } catch (error) {
        console.warn("Cached catalog image URL is invalid; uploading the image again.", error);
      }
    }
    const source = await fetch(imageSource, isDataImage
      ? undefined
      : { mode: "cors", credentials: "omit", cache: "force-cache" });
    if (!source.ok) throw new Error("A saved product image could not be read for publishing.");
    const sourceBlob = await source.blob();
    if (!sourceBlob.type.startsWith("image/")) {
      throw new Error("The product image URL did not return an image.");
    }
    const compressedDataUrl = await AppUtils.compressImageFile(
      new File([sourceBlob], "catalog-image", { type: sourceBlob.type }),
      // Catalogue photos are what a customer pins and zooms on a modern phone screen, so they are
      // kept at 1600px. The small copy baked into the published HTML is made separately by the editor.
      { maxDimension: 1600, maxBytes: 2_800_000 }
    );
    const compressedResponse = await fetch(compressedDataUrl);
    if (!compressedResponse.ok) throw new Error("A compressed product image could not be prepared for publishing.");
    const compressedBlob = await compressedResponse.blob();
    const endpoint = new URL("/api/media", apiUrl.origin);
    endpoint.searchParams.set("tenant", tenant.id);
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": compressedBlob.type
      },
      body: compressedBlob
    });
    const responseText = await response.text();
    let result;
    try {
      result = JSON.parse(responseText);
    } catch {
      throw new Error(responseText || `Cloudflare image upload returned HTTP ${response.status}.`);
    }
    if (!response.ok || result.ok !== true || typeof result.url !== "string") {
      throw new Error(result.error || `Cloudflare image upload returned HTTP ${response.status}.`);
    }
    const publicUrl = new URL(result.url);
    if (publicUrl.protocol !== "https:" || !publicUrl.pathname.startsWith(`/media/${tenant.id}/`)) {
      throw new Error("Cloudflare returned an invalid public image URL.");
    }
    if (onStored) onStored({ reused: result.reused === true });
    uploadedMedia[fingerprint] = publicUrl.href;
    try {
      window.localStorage.setItem(cacheKey, JSON.stringify(uploadedMedia));
    } catch (error) {
      console.error("Uploaded image URL could not be cached; a future publish may upload this unchanged image again.", error);
    }
    return publicUrl.href;
  },

  async uploadCatalogVideo(blob, apiUrl, tenant, token) {
    if (!(blob instanceof Blob) || !blob.size) throw new Error("Choose a video to upload.");
    if (blob.size > 50_000_000) throw new Error("Videos must be smaller than 50 MB.");
    const contentType = String(blob.type || "").split(";")[0].toLowerCase();
    if (!["video/mp4", "video/webm", "video/quicktime"].includes(contentType)) {
      throw new Error("Choose an MP4, WebM, or QuickTime video.");
    }
    const endpoint = new URL("/api/media", apiUrl.origin);
    endpoint.searchParams.set("tenant", tenant.id);
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": contentType
      },
      body: blob
    });
    const responseText = await response.text();
    let result;
    try {
      result = JSON.parse(responseText);
    } catch {
      throw new Error(responseText || `Cloudflare video upload returned HTTP ${response.status}.`);
    }
    if (!response.ok || result.ok !== true || typeof result.url !== "string") {
      throw new Error(result.error || `Cloudflare video upload returned HTTP ${response.status}.`);
    }
    const publicUrl = new URL(result.url);
    if (publicUrl.protocol !== "https:" || !publicUrl.pathname.startsWith(`/media/${tenant.id}/`)) {
      throw new Error("Cloudflare returned an invalid public video URL.");
    }
    return publicUrl.href;
  },
};
