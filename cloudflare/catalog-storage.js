// How a shop's published catalogue is stored in catalog_snapshots.payload / admin_payload.
//
// It used to be stored as plain JSON and refused above 900 KB, which stopped publishing at about 100
// products. A D1 value can be up to about 2 MB, and catalogue JSON compresses 5 to 10 times. So a large
// catalogue is stored as a small JSON wrapper:
//   { "catalog_gzip": "<base64 gzip of the full JSON>", "store": {...}, "categories": [...], "product_count": N }
// The wrapper stays valid JSON, so the shop directory's json_extract on store fields keeps working
// (it reads product_count instead of counting products). Small catalogues are stored exactly as before.

export const COMPRESS_ABOVE_BYTES = 700_000;
export const MAX_STORED_CATALOG_BYTES = 1_900_000;

const encoder = new TextEncoder();
const byteLength = text => encoder.encode(text).byteLength;

async function streamBytes(bytes, transform) {
  const stream = new Blob([bytes]).stream().pipeThrough(transform);
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

function toBase64(bytes) {
  let binary = '';
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }
  return btoa(binary);
}

function fromBase64(text) {
  const binary = atob(text);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

/**
 * The text to store for a catalogue JSON string. Returns { text, bytes, compressed }; the caller refuses
 * anything above MAX_STORED_CATALOG_BYTES.
 */
export async function encodeCatalogForStorage(json, catalog = null) {
  if (byteLength(json) <= COMPRESS_ABOVE_BYTES) return { text: json, bytes: byteLength(json), compressed: false };
  const source = catalog || JSON.parse(json);
  const gzip = await streamBytes(encoder.encode(json), new CompressionStream('gzip'));
  const text = JSON.stringify({
    catalog_gzip: toBase64(gzip),
    store: source?.store || {},
    categories: Array.isArray(source?.categories) ? source.categories : [],
    product_count: Array.isArray(source?.products) ? source.products.length : 0
  });
  return { text, bytes: byteLength(text), compressed: true };
}

/** Parses a stored catalogue value, plain or compressed, into the full catalogue object. */
export async function readStoredCatalog(text) {
  const value = JSON.parse(text);
  if (!value || typeof value.catalog_gzip !== 'string') return value;
  const json = await streamBytes(fromBase64(value.catalog_gzip), new DecompressionStream('gzip'));
  return JSON.parse(new TextDecoder().decode(json));
}
