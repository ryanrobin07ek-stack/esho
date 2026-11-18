import { CRAFT_AI_SCREEN_DIRECTORY } from "./craft-ai-screens.js";
import { buildLocalAnalytics } from "./local-analytics.js";

const sessions = new Map();
let currentContext = null;
let isOpen = false;
let resizeListenerInstalled = false;
const screenLinks = new Map(CRAFT_AI_SCREEN_DIRECTORY.map(screen => [screen.id, screen]));

const screenTitles = [
  [/^\/$/, "Craft home"],
  [/\/(?:account\/dashboard|account\/main-shop|store\/revenue)/, "Sales & analytics"],
  [/\/(?:account\/inventory|store\/inventory|pos\/inventory)/, "Inventory"],
  [/\/(?:account\/products|store\/products|pos\/products)/, "Products"],
  [/\/(?:store\/orders|pos\/sales)/, "Orders & sales"],
  [/\/(?:account\/tenants)/, "Shops & tenants"],
  [/\/account\/web/, "Website"],
  [/\/pos(?:\/|$)/, "Point of sale"]
];

const styles = `
.craft-ai-launcher{position:fixed;z-index:10020;right:22px;bottom:var(--craft-ai-bottom-offset,22px);display:flex;align-items:center;padding:12px 17px;border:1px solid #ffffff52;border-radius:999px;background:#18181b99;color:#fff;backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);box-shadow:0 10px 32px #0003;font:600 14px/1.1 var(--font-main,Arial,sans-serif);cursor:pointer}
.craft-ai-launcher:hover{background:#333337bb}.craft-ai-launcher:focus-visible,.craft-ai-panel button:focus-visible,.craft-ai-panel textarea:focus-visible{outline:3px solid #8ab4ff;outline-offset:2px}
.craft-ai-panel{position:fixed;z-index:10021;right:22px;bottom:calc(var(--craft-ai-bottom-offset,22px) + 58px);width:min(420px,calc(100vw - 28px));height:min(640px,calc(100dvh - var(--craft-ai-bottom-offset,22px) - 92px));display:flex;flex-direction:column;overflow:hidden;border:1px solid #e2e2e5;border-radius:18px;background:#fff;color:#18181b;box-shadow:0 20px 70px #0003;font-family:var(--font-main,Arial,sans-serif)}
.craft-ai-panel[hidden]{display:none}.craft-ai-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:16px 18px;border-bottom:1px solid #eee}.craft-ai-head h2{margin:0;font-size:16px}.craft-ai-head p{margin:4px 0 0;color:#66666b;font-size:12px}.craft-ai-head-actions{display:flex;gap:6px}.craft-ai-panel button{cursor:pointer}.craft-ai-icon-button{width:34px;height:34px;border:1px solid #e2e2e5;border-radius:9px;background:#fff;color:#333;font-size:18px}.craft-ai-messages{flex:1;overflow:auto;display:flex;flex-direction:column;gap:12px;padding:16px}.craft-ai-bubble{max-width:92%;padding:11px 13px;border-radius:13px;background:#f5f5f5;color:#222;font-size:13px;line-height:1.5;white-space:pre-wrap;overflow-wrap:anywhere}.craft-ai-bubble[data-role=user]{align-self:flex-end;background:#18181b;color:#fff}.craft-ai-bubble[data-role=assistant]{align-self:flex-start}.craft-ai-screen-link{color:#155eef;text-decoration:underline;text-underline-offset:2px}.craft-ai-suggestions{display:flex;flex-wrap:wrap;gap:7px;padding:0 16px 12px;color:#666;font-size:11px;line-height:1.5}.craft-ai-suggestions[hidden]{display:none}.craft-ai-form{display:grid;grid-template-columns:1fr auto;gap:8px;padding:12px 14px;border-top:1px solid #eee}.craft-ai-form textarea{min-height:44px;max-height:110px;resize:vertical;padding:10px;border:1px solid #ddd;border-radius:10px;font:13px/1.4 var(--font-main,Arial,sans-serif)}.craft-ai-form button{align-self:end;min-height:42px;padding:0 15px;border:0;border-radius:10px;background:#18181b;color:#fff;font-weight:600}.craft-ai-form button:disabled{opacity:.55;cursor:wait}.craft-ai-disclosure{margin:0;padding:0 16px 12px;color:#777;font-size:10px;line-height:1.4}.craft-ai-status{min-height:16px;padding:0 16px 8px;color:#8b2525;font-size:11px}
@media(max-width:600px){.craft-ai-launcher{right:14px}.craft-ai-panel{right:8px;width:calc(100vw - 16px);height:min(680px,calc(100dvh - var(--craft-ai-bottom-offset,22px) - 80px));border-radius:16px}}
`;

function titleFor(path) {
  const route = path.split(/[?#]/, 1)[0].replace(/\/+$/, "") || "/";
  const knownScreen = CRAFT_AI_SCREEN_DIRECTORY.find(screen => screen.route.split(/[?#]/, 1)[0] === route);
  if (knownScreen) return knownScreen.title;
  return screenTitles.find(([pattern]) => pattern.test(path))?.[1] || "Shop workspace";
}

function currentSession() {
  if (!currentContext) return [];
  if (!sessions.has(currentContext.tenantId)) sessions.set(currentContext.tenantId, []);
  return sessions.get(currentContext.tenantId);
}

function appendMessage(container, role, text) {
  const bubble = document.createElement("div");
  bubble.className = "craft-ai-bubble";
  bubble.dataset.role = role;
  if (role === "assistant") {
    let offset = 0;
    const linkPattern = /\[\[screen:([a-z0-9-]+)\]\]/gi;
    for (const match of text.matchAll(linkPattern)) {
      bubble.append(document.createTextNode(text.slice(offset, match.index)));
      const screen = screenLinks.get(match[1]);
      if (screen) {
        const link = document.createElement("a");
        link.className = "craft-ai-screen-link";
        link.href = screen.route;
        link.dataset.route = screen.route;
        link.textContent = screen.title;
        bubble.append(link);
      } else {
        bubble.append(document.createTextNode(match[0]));
      }
      offset = match.index + match[0].length;
    }
    bubble.append(document.createTextNode(text.slice(offset)));
  } else {
    bubble.textContent = text;
  }
  container.append(bubble);
  container.scrollTop = container.scrollHeight;
  return bubble;
}

function isEligibleScreen(path) {
  return (path === "/" || path.startsWith("/account/") || path === "/account" ||
    path === "/pos" || path.startsWith("/pos/") || path.startsWith("/store/")) &&
    path !== "/account/web/site" && !path.startsWith("/account/profile");
}

const withTimeout = (promise, ms, message) => Promise.race([
  Promise.resolve(promise),
  new Promise((_, reject) => setTimeout(() => reject(new Error(message)), ms))
]);

// The Worker returns at most 200 appointments per page (newest first) and reports shop-wide counts.
// Ask for everything dated in the last 30 days or later, follow has_more, and say when it was still cut short.
const APPOINTMENT_PAGE_SIZE = 200;
const APPOINTMENT_MAX_PAGES = 5;
async function loadRecentAppointments(bridge, tenantId) {
  const from = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const appointments = [];
  let counts = null;
  let truncated = false;
  for (let page = 0; page < APPOINTMENT_MAX_PAGES; page += 1) {
    const result = await bridge.listServiceAppointments(tenantId, {
      from, limit: APPOINTMENT_PAGE_SIZE, offset: page * APPOINTMENT_PAGE_SIZE
    });
    if (!Array.isArray(result?.appointments)) {
      if (page === 0) throw new Error("The appointment list was not returned.");
      truncated = true;
      break;
    }
    appointments.push(...result.appointments);
    if (page === 0 && result.counts && typeof result.counts === "object") counts = result.counts;
    if (!result.has_more) return { appointments, counts, truncated: false };
    truncated = true;
  }
  return { appointments, counts, truncated };
}

async function readLocalPosAnalytics(path, ctx = {}) {
  const supportsLocalPos = path === "/" || path.startsWith("/account") || path.startsWith("/pos") ||
    path.startsWith("/store/");
  const shop = window.ShopPOS;
  if (!supportsLocalPos || !shop?.listSales || !shop?.listProducts || !shop?.listExpenses) return null;

  const [sales, products, expenses, settings] = await Promise.all([
    shop.listSales(),
    shop.listProducts(),
    shop.listExpenses(),
    shop.getSettings?.() || Promise.resolve({})
  ]);
  if (!Array.isArray(sales) || !Array.isArray(products) || !Array.isArray(expenses)) {
    throw new Error("The local register returned incomplete analytics data.");
  }

  // Service shops: the bookable services and the appointment requests are part of the picture.
  // Appointments live on the storefront server, so a slow or failed load must never block the answer.
  let services = [];
  try {
    services = typeof ctx.listServices === "function" ? ctx.listServices() || [] : [];
  } catch (error) {
    console.warn("Craft AI could not read the shop's services.", error);
  }
  const offerType = ctx.offerType === "services" ? "services" : "products";
  let appointments = null;
  let appointmentMeta = null;
  const bridge = window.EshopInventoryBridge;
  if ((offerType === "services" || services.length) && ctx.tenantId &&
      typeof bridge?.listServiceAppointments === "function") {
    try {
      const loaded = await withTimeout(loadRecentAppointments(bridge, ctx.tenantId), 8000, "Appointments took too long to load.");
      appointments = loaded.appointments;
      appointmentMeta = { counts: loaded.counts, truncated: loaded.truncated };
    } catch (error) {
      console.warn("Craft AI could not load appointment requests.", error);
    }
  }
  return buildLocalAnalytics({ sales, products, expenses, settings, offerType, services, appointments, appointmentMeta });
}

function addStyles() {
  if (document.getElementById("craft-ai-styles")) return;
  const style = document.createElement("style");
  style.id = "craft-ai-styles";
  style.textContent = styles;
  document.head.append(style);
}

function updateBottomOffset() {
  const root = document.getElementById("craft-ai-root");
  if (!root) return;
  const navs = [...document.querySelectorAll(
    ".pos-bottom-nav, .studio-workspace-bottom-nav, .store-bottom-nav"
  )];
  const visibleNavs = navs.filter(nav => {
    const rect = nav.getBoundingClientRect();
    const style = getComputedStyle(nav);
    return style.display !== "none" && style.visibility !== "hidden" &&
      rect.width > 0 && rect.height > 0 && rect.top < window.innerHeight &&
      rect.bottom > window.innerHeight - 160;
  });
  const nav = visibleNavs.sort((left, right) =>
    left.getBoundingClientRect().top - right.getBoundingClientRect().top
  )[0];
  const offset = nav
    ? Math.ceil(window.innerHeight - nav.getBoundingClientRect().top + 12)
    : 22;
  root.style.setProperty("--craft-ai-bottom-offset", `${offset}px`);
}

function renderPanel() {
  document.getElementById("craft-ai-root")?.remove();
  if (!currentContext || !isEligibleScreen(currentContext.path)) return;

  const root = document.createElement("div");
  root.id = "craft-ai-root";
  const launcher = document.createElement("button");
  launcher.type = "button";
  launcher.className = "craft-ai-launcher";
  launcher.setAttribute("aria-expanded", String(isOpen));
  launcher.setAttribute("aria-controls", "craft-ai-panel");
  launcher.setAttribute("aria-label", "Ask Craft AI about this shop");
  launcher.textContent = "AI";

  const panel = document.createElement("section");
  panel.id = "craft-ai-panel";
  panel.className = "craft-ai-panel";
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-label", "Craft AI business assistant");
  panel.hidden = !isOpen;

  const header = document.createElement("header");
  header.className = "craft-ai-head";
  header.innerHTML = `<div><h2>Craft AI</h2><p>${titleFor(currentContext.path)} · ${escapeText(currentContext.tenantName)}</p></div>`;
  const actions = document.createElement("div");
  actions.className = "craft-ai-head-actions";
  const clear = document.createElement("button");
  clear.type = "button";
  clear.className = "craft-ai-icon-button";
  clear.setAttribute("aria-label", "Clear conversation");
  clear.title = "Clear conversation";
  clear.textContent = "↻";
  const close = document.createElement("button");
  close.type = "button";
  close.className = "craft-ai-icon-button";
  close.setAttribute("aria-label", "Close Craft AI");
  close.textContent = "×";
  actions.append(clear, close);
  header.append(actions);

  const messages = document.createElement("div");
  messages.className = "craft-ai-messages";
  messages.setAttribute("aria-live", "polite");
  const history = currentSession();
  if (!history.length) {
    appendMessage(messages, "assistant", "Ask me about this shop, its products, stock, sales, expenses, storefront, or how to use this screen. I can also link you to the right app screen. I can only report on data available to your account, and I won't change anything for you.");
  } else {
    history.forEach(item => appendMessage(messages, item.role, item.content));
  }

  const suggestions = document.createElement("div");
  suggestions.className = "craft-ai-suggestions";
  suggestions.textContent = "Questions are open-ended. Ask about products, categories, stock, costs, sales, expenses, traffic, or app features.";
  suggestions.hidden = Boolean(history.length);

  const status = document.createElement("div");
  status.className = "craft-ai-status";
  status.setAttribute("role", "status");
  const form = document.createElement("form");
  form.className = "craft-ai-form";
  const textarea = document.createElement("textarea");
  textarea.name = "question";
  textarea.maxLength = 1200;
  textarea.placeholder = "Ask a follow-up…";
  textarea.setAttribute("aria-label", "Ask Craft AI a question");
  textarea.required = true;
  textarea.addEventListener("input", () => {
    if (textarea.value.trim()) suggestions.hidden = true;
  });
  const send = document.createElement("button");
  send.type = "submit";
  send.textContent = "Send";
  form.append(textarea, send);

  const disclosure = document.createElement("p");
  disclosure.className = "craft-ai-disclosure";
  disclosure.textContent = "Your question and aggregate shop metrics are processed by OpenRouter and the selected AI model. Customer contact details are excluded; don't include personal customer information.";

  panel.append(header, messages, suggestions, status, form, disclosure);
  root.append(panel, launcher);
  document.body.append(root);
  updateBottomOffset();
  if (!resizeListenerInstalled) {
    window.addEventListener("resize", updateBottomOffset, { passive: true });
    resizeListenerInstalled = true;
  }

  const setOpen = value => {
    isOpen = value;
    panel.hidden = !value;
    launcher.setAttribute("aria-expanded", String(value));
    if (value) textarea.focus();
  };
  launcher.addEventListener("click", () => setOpen(panel.hidden));
  close.addEventListener("click", () => setOpen(false));
  clear.addEventListener("click", () => {
    sessions.set(currentContext.tenantId, []);
    messages.replaceChildren();
    appendMessage(messages, "assistant", "Conversation cleared. What would you like to understand about this shop?");
    status.textContent = "";
    suggestions.hidden = false;
  });
  form.addEventListener("submit", event => {
    event.preventDefault();
    submitQuestion(textarea.value.trim(), { textarea, messages, status, send });
  });

  async function submitQuestion(question, controls = {}) {
    const input = controls.textarea || textarea;
    const output = controls.messages || messages;
    const messageStatus = controls.status || status;
    const sendButton = controls.send || send;
    if (!question || sendButton.disabled) return;
    const ctx = currentContext;
    const session = currentSession();
    const priorHistory = session.slice(-8);
    input.value = "";
    input.blur();
    suggestions.hidden = true;
    sendButton.disabled = true;
    messageStatus.textContent = "";
    appendMessage(output, "user", question);
    const pending = appendMessage(output, "assistant", "Checking the latest shop metrics…");
    try {
      const body = { question, history: priorHistory, screen: ctx.path };
      const localAnalytics = await readLocalPosAnalytics(ctx.path, ctx);
      if (localAnalytics) body.local_analytics = localAnalytics;
      const endpoint = new URL(`/api/ai/assistant?tenant=${encodeURIComponent(ctx.tenantId)}`, ctx.origin);
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${ctx.token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || `Craft AI returned HTTP ${response.status}.`);
      if (typeof result.answer !== "string" || !result.answer) {
        throw new Error("Craft AI returned an empty answer.");
      }
      pending.remove();
      appendMessage(output, "assistant", result.answer);
      session.push({ role: "user", content: question }, { role: "assistant", content: result.answer });
      if (session.length > 8) session.splice(0, session.length - 8);
      output.scrollTop = output.scrollHeight;
    } catch (error) {
      pending.textContent = "I couldn't answer that yet.";
      messageStatus.textContent = error instanceof Error ? error.message : "Craft AI request failed.";
    } finally {
      sendButton.disabled = false;
    }
  }
}

function escapeText(value) {
  const element = document.createElement("span");
  element.textContent = value;
  return element.innerHTML;
}

window.CraftAI = {
  readLocalAnalytics: readLocalPosAnalytics,
  mount(context) {
    if (currentContext &&
        (currentContext.path !== context.path || currentContext.tenantId !== context.tenantId)) {
      isOpen = false;
    }
    currentContext = context;
    if (!isEligibleScreen(context.path) || context.tenantId === "__new_website_draft__") {
      isOpen = false;
      document.getElementById("craft-ai-root")?.remove();
      return;
    }
    addStyles();
    renderPanel();
  }
};
