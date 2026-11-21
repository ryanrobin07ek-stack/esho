// Local product media storage (IndexedDB) helpers.
// Moved verbatim out of src/app/main.js.

export const LOCAL_PRODUCT_MEDIA_PREFIX = "craft-local-media:";

export const INDEXEDDB_PRODUCT_MEDIA_PREFIX = "craft-indexeddb-media:";

export let localProductMediaDatabasePromise;

export const openLocalProductMediaDatabase = () => {
  if (!localProductMediaDatabasePromise) {
    localProductMediaDatabasePromise = new Promise((resolve, reject) => {
      const request = indexedDB.open("craft-product-media", 1);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains("files")) request.result.createObjectStore("files");
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(new Error("Local video storage could not be opened."));
      request.onblocked = () => reject(new Error("Local video storage is busy. Close other Craft tabs and try again."));
    });
  }
  return localProductMediaDatabasePromise;
};
