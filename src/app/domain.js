// The one place that knows which domain this build serves.
// Default build: rrobin.co.ke. Another deployment sets VITE_DOMAIN_ROOT at build time (for example craft.ke).
const DEFAULT_ROOT = "rrobin.co.ke";
const ROOT_PATTERN = /^[a-z0-9-]+(\.[a-z0-9-]+)+$/;

function validRoot(root) {
  return typeof root === "string" && ROOT_PATTERN.test(root) ? root : DEFAULT_ROOT;
}

// The main store normally lives on the root itself. A root that already hosts another site (craft.ke) puts the main
// store on one label under it (app.craft.ke); anything else is ignored and the root is used.
function validMainHost(root, mainHost) {
  if (typeof mainHost !== "string") return root;
  const host = mainHost.trim().toLowerCase();
  const label = host.endsWith(`.${root}`) ? host.slice(0, -(root.length + 1)) : "";
  return /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label) ? host : root;
}

export function createDomain(root, mainHost) {
  const safeRoot = validRoot(root);
  const safeMain = validMainHost(safeRoot, mainHost);
  return {
    root: safeRoot,
    apex: safeMain,
    shopHost(id) {
      return id === "main" ? safeMain : `${id}.${safeRoot}`;
    },
    isOwnHost(hostname) {
      const host = String(hostname || "").toLowerCase();
      return host === safeRoot || host === `www.${safeRoot}` || host.endsWith(`.${safeRoot}`);
    },
    customersTarget: `customers.${safeRoot}`,
  };
}

export const DOMAIN = createDomain(import.meta.env?.VITE_DOMAIN_ROOT, import.meta.env?.VITE_MAIN_HOST);
