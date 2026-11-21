// The one place that knows which domain this build serves.
// Default build: rrobin.co.ke. Another deployment sets VITE_DOMAIN_ROOT at build time (for example craft.ke).
const DEFAULT_ROOT = "rrobin.co.ke";
const ROOT_PATTERN = /^[a-z0-9-]+(\.[a-z0-9-]+)+$/;

function validRoot(root) {
  return typeof root === "string" && ROOT_PATTERN.test(root) ? root : DEFAULT_ROOT;
}

export function createDomain(root) {
  const safeRoot = validRoot(root);
  return {
    root: safeRoot,
    apex: safeRoot,
    shopHost(id) {
      return id === "main" ? safeRoot : `${id}.${safeRoot}`;
    },
    isOwnHost(hostname) {
      const host = String(hostname || "").toLowerCase();
      return host === safeRoot || host === `www.${safeRoot}` || host.endsWith(`.${safeRoot}`);
    },
    customersTarget: `customers.${safeRoot}`,
  };
}

export const DOMAIN = createDomain(import.meta.env?.VITE_DOMAIN_ROOT);
