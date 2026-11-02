const sessions = new Map();
let currentContext = null;
let isOpen = false;
let resizeListenerInstalled = false;

const screenTitles = [
  [/\/(?:account\/dashboard|account\/main-shop|store\/revenue)/, "Sales & analytics"],
  [/\/(?:account\/inventory|store\/inventory|pos\/inventory)/, "Inventory"],
  [/\/(?:account\/products|store\/products|pos\/products)/, "Products"],
  [/\/(?:store\/orders|pos\/sales)/, "Orders & sales"],
  [/\/(?:account\/tenants)/, "Shops & tenants"],
  [/\/(?:account\/web|store\/website)/, "Website"],
  [/\/pos(?:\/|$)/, "Point of sale"]
];

const styles = `
.craft-ai-launcher{position:fixed;z-index:10020;right:22px;bottom:var(--craft-ai-bottom-offset,22px);display:flex;align-items:center;gap:9px;padding:12px 17px;border:0;border-radius:999px;background:#18181b;color:#fff;box-shadow:0 10px 32px #0003;font:600 14px/1.1 var(--font-main,Arial,sans-serif);cursor:pointer}
.craft-ai-launcher:hover{background:#333337}.craft-ai-launcher:focus-visible,.craft-ai-panel button:focus-visible,.craft-ai-panel textarea:focus-visible{outline:3px solid #8ab4ff;outline-offset:2px}
.craft-ai-panel{position:fixed;z-index:10021;right:22px;bottom:calc(var(--craft-ai-bottom-offset,22px) + 58px);width:min(420px,calc(100vw - 28px));height:min(640px,calc(100dvh - var(--craft-ai-bottom-offset,22px) - 92px));display:flex;flex-direction:column;overflow:hidden;border:1px solid #e2e2e5;border-radius:18px;background:#fff;color:#18181b;box-shadow:0 20px 70px #0003;font-family:var(--font-main,Arial,sans-serif)}
.craft-ai-panel[hidden]{display:none}.craft-ai-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:16px 18px;border-bottom:1px solid #eee}.craft-ai-head h2{margin:0;font-size:16px}.craft-ai-head p{margin:4px 0 0;color:#66666b;font-size:12px}.craft-ai-head-actions{display:flex;gap:6px}.craft-ai-panel button{cursor:pointer}.craft-ai-icon-button{width:34px;height:34px;border:1px solid #e2e2e5;border-radius:9px;background:#fff;color:#333;font-size:18px}.craft-ai-messages{flex:1;overflow:auto;display:flex;flex-direction:column;gap:12px;padding:16px}.craft-ai-bubble{max-width:92%;padding:11px 13px;border-radius:13px;background:#f5f5f5;color:#222;font-size:13px;line-height:1.5;white-space:pre-wrap;overflow-wrap:anywhere}.craft-ai-bubble[data-role=user]{align-self:flex-end;background:#18181b;color:#fff}.craft-ai-bubble[data-role=assistant]{align-self:flex-start}.craft-ai-suggestions{display:flex;flex-wrap:wrap;gap:7px;padding:0 16px 12px;color:#666;font-size:11px;line-height:1.5}.craft-ai-suggestions[hidden]{display:none}.craft-ai-form{display:grid;grid-template-columns:1fr auto;gap:8px;padding:12px 14px;border-top:1px solid #eee}.craft-ai-form textarea{min-height:44px;max-height:110px;resize:vertical;padding:10px;border:1px solid #ddd;border-radius:10px;font:13px/1.4 var(--font-main,Arial,sans-serif)}.craft-ai-form button{align-self:end;min-height:42px;padding:0 15px;border:0;border-radius:10px;background:#18181b;color:#fff;font-weight:600}.craft-ai-form button:disabled{opacity:.55;cursor:wait}.craft-ai-disclosure{margin:0;padding:0 16px 12px;color:#777;font-size:10px;line-height:1.4}.craft-ai-status{min-height:16px;padding:0 16px 8px;color:#8b2525;font-size:11px}
@media(max-width:600px){.craft-ai-launcher{right:14px}.craft-ai-panel{right:8px;width:calc(100vw - 16px);height:min(680px,calc(100dvh - var(--craft-ai-bottom-offset,22px) - 80px));border-radius:16px}}
`;

function titleFor(path) {
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
  bubble.textContent = text;
  container.append(bubble);
  container.scrollTop = container.scrollHeight;
  return bubble;
}

function isEligibleScreen(path) {
  return (path.startsWith("/account/") || path === "/account" ||
    path === "/pos" || path.startsWith("/pos/") || path.startsWith("/store/")) &&
    !path.startsWith("/account/profile");
}

function localDate(value) {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function paidSale(sale) {
  const excludedStatuses = new Set(["refunded", "voided", "cancelled", "canceled", "failed"]);
  const paymentStatus = String(sale.payment_status || "").toLowerCase();
  const saleStatus = String(sale.status || "").toLowerCase();
  return Boolean(Number(sale.paid)) && !excludedStatuses.has(paymentStatus) &&
    !excludedStatuses.has(saleStatus);
}

async function readLocalPosAnalytics(path) {
  const supportsLocalPos = path.startsWith("/account") || path.startsWith("/pos") ||
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

  const now = Date.now();
  const currentStart = now - 30 * 24 * 60 * 60 * 1000;
  const previousStart = now - 60 * 24 * 60 * 60 * 1000;
  let paidSalesCurrent = 0;
  let paidSalesPrevious = 0;
  let revenueCurrent = 0;
  let revenuePrevious = 0;
  let grossProfitCurrent = 0;
  let grossProfitPrevious = 0;
  let costedLinesCurrent = 0;
  let costedLinesPrevious = 0;
  let expensesCurrent = 0;
  let expensesPrevious = 0;
  const productUnits = new Map();
  const expenseCategories = new Map();

  for (const sale of sales) {
    const createdAt = localDate(sale.created_at);
    if (createdAt === null || createdAt < previousStart) continue;
    const inCurrentPeriod = createdAt >= currentStart;
    if (paidSale(sale)) {
      if (inCurrentPeriod) {
        paidSalesCurrent += 1;
        revenueCurrent += Number(sale.total) || Number(sale.total_cents || 0) / 100;
      } else {
        paidSalesPrevious += 1;
        revenuePrevious += Number(sale.total) || Number(sale.total_cents || 0) / 100;
      }
      for (const item of Array.isArray(sale.items) ? sale.items : []) {
        const name = String(item.name || "").trim().slice(0, 120);
        const units = Number(item.quantity) || 0;
        if (units > 0) {
          const itemRevenue = Number(item.unitPrice || 0) * units;
          const cost = Number(item.historicalUnitCost);
          const hasCost = Number.isFinite(cost) && cost >= 0;
          if (inCurrentPeriod) {
            if (name) productUnits.set(name, (productUnits.get(name) || 0) + units);
            if (hasCost) {
              grossProfitCurrent += itemRevenue - cost * units;
              costedLinesCurrent += 1;
            }
          } else if (hasCost) {
            grossProfitPrevious += itemRevenue - cost * units;
            costedLinesPrevious += 1;
          }
        }
      }
    }
  }

  for (const expense of expenses) {
    const createdAt = localDate(expense.date || expense.created_at || expense.createdAt);
    if (createdAt === null || createdAt < previousStart) continue;
    const amount = Number(expense.amount) || Number(expense.amount_cents || 0) / 100;
    if (createdAt >= currentStart) {
      expensesCurrent += amount;
      const category = String(expense.category || "Other").trim().slice(0, 100) || "Other";
      expenseCategories.set(category, (expenseCategories.get(category) || 0) + amount);
    } else expensesPrevious += amount;
  }

  const activeProducts = products.filter(product => product.active !== false);
  return {
    currency: /^[A-Z]{3}$/.test(settings?.currency || "") ? settings.currency : "KES",
    paid_sales_last_30_days: paidSalesCurrent,
    paid_sales_previous_30_days: paidSalesPrevious,
    paid_revenue_last_30_days: Number(revenueCurrent.toFixed(2)),
    paid_revenue_previous_30_days: Number(revenuePrevious.toFixed(2)),
    expenses_last_30_days: Number(expensesCurrent.toFixed(2)),
    expenses_previous_30_days: Number(expensesPrevious.toFixed(2)),
    low_stock_products: activeProducts.filter(product => Number(product.stock) > 0 &&
      Number(product.stock) <= Number(product.lowStockThreshold ?? 3)).length,
    out_of_stock_products: activeProducts.filter(product => Number(product.stock) <= 0).length,
    product_count: activeProducts.length,
    inactive_product_count: products.length - activeProducts.length,
    inventory_units: activeProducts.reduce((total, product) => total + Math.max(0, Number(product.stock) || 0), 0),
    estimated_gross_profit_last_30_days: Number(grossProfitCurrent.toFixed(2)),
    estimated_gross_profit_previous_30_days: Number(grossProfitPrevious.toFixed(2)),
    gross_profit_costed_line_items_last_30_days: costedLinesCurrent,
    gross_profit_costed_line_items_previous_30_days: costedLinesPrevious,
    top_products: [...productUnits.entries()]
      .sort((left, right) => right[1] - left[1])
      .slice(0, 10)
      .map(([name, units]) => ({ name, units })),
    inventory_products: activeProducts
      .map(product => ({
        name: String(product.name || "").trim().slice(0, 120),
        category: String(product.categoryName || "Uncategorized").trim().slice(0, 100),
        stock: Math.max(0, Number(product.stock) || 0),
        price: Math.max(0, Number(product.price) || 0),
        low_stock_threshold: Math.max(0, Number(product.lowStockThreshold ?? 3) || 0)
      }))
      .filter(product => product.name)
      .sort((left, right) => left.stock - right.stock)
      .slice(0, 30),
    expense_categories_last_30_days: [...expenseCategories.entries()]
      .sort((left, right) => right[1] - left[1])
      .slice(0, 10)
      .map(([category, amount]) => ({ category, amount: Number(amount.toFixed(2)) }))
  };
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
  launcher.innerHTML = `<span aria-hidden="true">✦</span><span>Ask AI</span>`;

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
    appendMessage(messages, "assistant", "Ask me anything about this shop, its products, stock, sales, expenses, storefront, or how to use this screen. I can only report on data available to your account, and I won't change anything for you.");
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
      const localAnalytics = await readLocalPosAnalytics(ctx.path);
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
      pending.textContent = result.answer;
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
  mount(context) {
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
