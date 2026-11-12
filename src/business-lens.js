const $ = (value) => window.AppUtils.escapeHTML(String(value ?? ""));
const sum = (rows, pick) => rows.reduce((total, row) => total + (Number(pick(row)) || 0), 0);
const paid = sale => sale.paid && !["refunded", "voided", "cancelled", "canceled", "failed"].includes(sale.status);
const localDate = value => {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
};
const dayStart = date => new Date(date.getFullYear(), date.getMonth(), date.getDate());
const money = (value, currency = "KES") => {
  const code = /^[A-Z]{3}$/.test(currency) ? currency : "KES";
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency: code, maximumFractionDigits: 2 }).format(Number(value) || 0);
  } catch {
    return `${code} ${(Number(value) || 0).toFixed(2)}`;
  }
};
const filterStorageKey = "ESHOP_BUSINESS_LENS_FILTERS_V2";
const shortMoney = (value, currency) => {
  const amount = Number(value) || 0;
  return amount >= 1000000 ? `${money(amount / 1000000, currency)}m`
    : amount >= 10000 ? `${money(amount / 1000, currency)}k` : money(amount, currency);
};
const safePercent = (value, total) => total ? value / total * 100 : 0;
const dateLabel = value => localDate(value)?.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) || "Date unavailable";
const card = (title, body, subtitle = "") => `<article class="bl-card"><header><h2>${title}</h2>${subtitle ? `<p>${subtitle}</p>` : ""}</header>${body}</article>`;
const metric = (label, value, detail = "") => `<article class="bl-kpi"><span>${label}</span><strong>${value}</strong>${detail ? `<small>${detail}</small>` : ""}</article>`;
const listRows = rows => rows.length ? rows.join("") : `<p class="bl-empty">No recorded data for this view yet. Nothing here is sample data.</p>`;
const row = (label, value, detail = "") => `<div class="bl-row"><div><strong>${$(label)}</strong>${detail ? `<small>${$(detail)}</small>` : ""}</div><b>${value}</b></div>`;
const barRows = (items, label, value, formatter, color = "var(--accent)") => {
  const max = Math.max(1, ...items.map(item => Number(value(item)) || 0));
  return listRows(items.map(item => {
    const amount = Number(value(item)) || 0;
    const width = Math.max(0, Math.min(100, amount / max * 100));
    return `<div class="bl-bar-row"><div><span>${$(label(item))}</span><b>${formatter(amount, item)}</b></div><i><span style="width:${width}%;background:${color}"></span></i></div>`;
  }));
};
const lineChart = (series, keys, currency) => {
  if (!series.length || !series.some(point => keys.some(key => Number(point[key]) > 0))) return `<p class="bl-empty">More recorded activity is needed to chart this period.</p>`;
  const width = 640, height = 210, padX = 28, padY = 20;
  const values=series.flatMap(point=>keys.map(key=>Number(point[key])||0));
  const minimum=Math.min(0,...values), maximum=Math.max(1,...values);
  const yFor=value=>padY+(maximum-value)/(maximum-minimum||1)*(height-padY*2);
  const colors = ["#191919", "#737373", "#a3a3a3", "#d4d4d4"];
  const lines = keys.map((key, index) => {
    const points = series.map((point, i) => {
      const x = padX + (series.length === 1 ? 0 : i * (width - padX * 2) / (series.length - 1));
      const y = yFor(Number(point[key])||0);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(" ");
    return `<polyline fill="none" stroke="${colors[index % colors.length]}" stroke-width="2.5" points="${points}"/>`;
  }).join("");
  const labels = [series[0], series[Math.floor((series.length - 1) / 2)], series[series.length - 1]]
    .filter((point, index, rows) => point && rows.indexOf(point) === index)
    .map(point => `<span>${$(point.label)}</span>`).join("");
  return `<svg class="bl-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="Revenue chart"><line x1="${padX}" y1="${yFor(0)}" x2="${width - padX}" y2="${yFor(0)}" stroke="currentColor" opacity=".14"/>${lines}</svg><div class="bl-chart-labels">${labels}</div><div class="bl-legend">${keys.map((key,index)=>`<span><i style="background:${colors[index%colors.length]}"></i>${$(key)}</span>`).join("")}</div>`;
};
const table = (headers, rows) => `<div class="bl-table-wrap"><table class="bl-table"><thead><tr>${headers.map(header=>`<th>${header}</th>`).join("")}</tr></thead><tbody>${rows.length ? rows.join("") : `<tr><td colspan="${headers.length}" class="bl-empty">No matching records.</td></tr>`}</tbody></table></div>`;
const filterSelect = (key,label,value,options) => `<label class="bl-inline-filter"><span>${$(label)}</span><select data-business-filter="${$(key)}">${options.map(([option,text])=>`<option value="${$(option)}" ${value===option?"selected":""}>${$(text)}</option>`).join("")}</select></label>`;

function normalizeSnapshot(snapshot, context) {
  const productNames = new Map(snapshot.products.map(product => [product.name.trim().toLowerCase(), product]));
  const sales = snapshot.sales.map(sale => {
    const items = sale.lineItems.map((item, index) => {
      const product = productNames.get(String(item.name).trim().toLowerCase());
      return {
        productId: String(item.productId || product?.sku || product?.name || item.name || index),
        name: item.name || "Item",
        category: product?.categoryName || "Uncategorized",
        quantity: Number(item.quantity) || 1,
        unitPrice: Number(item.unitPrice) || 0,
        lineTotal: (Number(item.quantity) || 1) * (Number(item.unitPrice) || 0),
        costPrice: Number(item.costPrice ?? product?.costPrice) || 0
      };
    });
    return {
      ...sale,
      id: String(sale.id || sale.reference),
      channel: sale.channel === "Website" ? "web" : "pos",
      createdAt: sale.date,
      paid: ["paid", "completed", "confirmed"].includes(sale.status) || Number(sale.collected) >= Number(sale.total),
      paymentMethod: sale.paymentMethod || "other",
      customerId: sale.customerEmail || sale.customerPhone || "",
      customerName: sale.customerName || "",
      customerEmail: sale.customerEmail || "",
      customerPhone: sale.customerPhone || "",
      city: sale.city || "",
      country: sale.country || "",
      subtotal: Number(sale.subtotal) || Number(sale.total) || 0,
      discount: Number(sale.discount) || 0,
      tax: Number(sale.tax) || 0,
      items,
      profit: sum(items, item => item.lineTotal - item.costPrice * item.quantity),
      cogs: sum(items, item => item.costPrice * item.quantity)
    };
  });
  const visits = context.visits.map(visit => ({
    ...visit,
    createdAt: visit.created_at,
    visitorId: visit.visitor_id,
    referrer: visit.referrer || "",
    device: visit.device || "unknown"
  }));
  const expenses = (snapshot.expenses || []).map(expense => ({
    ...expense, date: expense.date || expense.expense_date, amount: Number(expense.amount) || 0
  }));
  return { ...snapshot, sales, visits, expenses };
}

function mergeStorefrontOrders(sales, orders) {
  const remoteSales = orders.map((order, index) => {
    const total = Number(order.total) || 0;
    const orderStatus = String(order.status || "").toLowerCase();
    const paymentStatus = String(order.payment_status || "").toLowerCase();
    const reversedStatuses = ["refunded", "voided", "cancelled", "canceled", "failed"];
    const reversed = reversedStatuses.includes(orderStatus) || reversedStatuses.includes(paymentStatus);
    const paid = !reversed && (paymentStatus === "paid" || ["paid", "completed"].includes(orderStatus));
    const reference = String(order.order_number || order.id || `WEB-${index}`);
    const items = Array.isArray(order.items) ? order.items : [];
    return {
      channel: "Website",
      id: reference,
      reference,
      date: String(order.created_at || ""),
      currency: String(order.currency || "KES").toUpperCase(),
      status: reversed ? orderStatus || paymentStatus : paid ? "paid" : paymentStatus || orderStatus || "pending",
      total,
      collected: reversed ? 0 : paid ? total : Math.max(0, Number(order.amount_paid) || 0),
      subtotal: Number(order.subtotal) || total,
      discount: Number(order.discount) || 0,
      tax: Number(order.tax) || 0,
      customerName: String(order.customer_name || ""),
      customerEmail: String(order.customer_email || ""),
      customerPhone: String(order.customer_phone || ""),
      city: String(order.city || ""),
      country: String(order.country || ""),
      paymentMethod: String(order.payment_method || (paid ? "Paystack" : "other")),
      lineItems: items.map(item => ({
        productId: String(item.product_id || item.productId || item.sku || item.name || ""),
        name: String(item.name || "Item"),
        quantity: Number(item.quantity) || 1,
        unitPrice: Number(item.unit_price ?? item.price ?? item.unitPrice) || 0,
        costPrice: item.costPrice == null && item.unitCost == null
          ? null
          : Number(item.costPrice ?? item.unitCost) || 0
      })),
      itemCount: items.length
    };
  });
  const remoteReferences = new Set(remoteSales.map(sale => sale.reference));
  return [
    ...sales.filter(sale => sale.channel !== "Website" || !remoteReferences.has(String(sale.reference))),
    ...remoteSales
  ];
}

function analyse(data, filters) {
  const now = new Date();
  const ranges = { today: 0, "7d": 6, "30d": 29, "90d": 89 };
  const firstSaleDate = data.sales.reduce((first, sale) => {
    const date = localDate(sale.createdAt);
    return date && (!first || date < first) ? date : first;
  }, null) || now;
  const start = filters.range === "custom" && filters.from ? dayStart(new Date(`${filters.from}T00:00:00`))
    : filters.range === "all" ? dayStart(firstSaleDate)
      : filters.range === "ytd" ? new Date(now.getFullYear(), 0, 1)
        : filters.range === "month" ? new Date(now.getFullYear(), now.getMonth(), 1)
          : dayStart(new Date(now.getFullYear(), now.getMonth(), now.getDate() - (ranges[filters.range] ?? 29)));
  const end = filters.range === "custom" && filters.to ? new Date(`${filters.to}T23:59:59`) : new Date();
  const scoped = data.sales.filter(sale => {
    const time = localDate(sale.createdAt)?.getTime() ?? NaN;
    return Number.isFinite(time) && time >= start.getTime() && time <= end.getTime()
      && (filters.channel === "all" || sale.channel === filters.channel)
      && (filters.category === "all" || sale.items.some(item => item.category === filters.category));
  });
  const currentPaid = scoped.filter(paid);
  const revenue = sum(currentPaid, sale => sale.total);
  const previousStart = new Date(start.getTime() - Math.max(1, end.getTime() - start.getTime()));
  const previous = filters.range === "all" ? [] : data.sales.filter(sale => {
    const time = localDate(sale.createdAt)?.getTime() ?? NaN;
    return Number.isFinite(time) && time >= previousStart.getTime() && time < start.getTime() && (filters.channel === "all" || sale.channel === filters.channel);
  }).filter(paid);
  const previousRevenue = sum(previous, sale => sale.total);
  const days = Math.max(1, Math.ceil((end - start) / 86400000));
  const salesInRange = scoped.filter(sale => (localDate(sale.createdAt)?.getTime() ?? 0) >= start.getTime());
  const visitors = data.visits.filter(visit => {
    const time = localDate(visit.createdAt)?.getTime() ?? NaN;
    return Number.isFinite(time) && time >= start.getTime() && time <= end.getTime();
  });
  const products = new Map();
  currentPaid.forEach(sale => sale.items.forEach(item => {
    const entry = products.get(item.productId) || { ...item, units: 0, revenue: 0, cogs: 0, profit: 0, orders: new Set(), web: 0, pos: 0, webUnits: 0, posUnits: 0 };
    entry.units += item.quantity;
    entry.revenue += item.lineTotal;
    entry.cogs += item.costPrice * item.quantity;
    entry.profit += item.lineTotal - item.costPrice * item.quantity;
    entry.orders.add(sale.id);
    entry[sale.channel] += item.lineTotal;
    entry[`${sale.channel}Units`] += item.quantity;
    products.set(item.productId, entry);
  }));
  const productStats = [...products.values()].map(product => ({ ...product, orders: product.orders.size, margin: safePercent(product.profit, product.revenue) }))
    .sort((a,b)=>b.revenue-a.revenue);
  let cumulative = 0;
  productStats.forEach(product => {
    product.share = safePercent(product.revenue, sum(productStats, item => item.revenue));
    cumulative += product.share;
    product.cumulative = cumulative;
    product.abc = cumulative <= 80 ? "A" : cumulative <= 95 ? "B" : "C";
  });
  const customersMap = new Map();
  data.sales.filter(paid).forEach(sale => {
    const id = sale.customerId || `anonymous-${sale.channel}-${sale.id}`;
    const customer = customersMap.get(id) || { id, name: sale.customerName || "Walk-in", email: sale.customerEmail, phone: sale.customerPhone, city: sale.city, country: sale.country, orders: [], revenue: 0, units: 0, products: new Map() };
    customer.orders.push(sale);
    customer.revenue += sale.total;
    sale.items.forEach(item => {
      customer.units += item.quantity;
      customer.products.set(item.name, (customer.products.get(item.name) || 0) + item.lineTotal);
    });
    customersMap.set(id, customer);
  });
  const customers = [...customersMap.values()].map(customer => {
    customer.orders.sort((a,b)=>String(a.createdAt).localeCompare(String(b.createdAt)));
    const first = localDate(customer.orders[0]?.createdAt) || now;
    const last = localDate(customer.orders.at(-1)?.createdAt) || now;
    customer.last = last;
    customer.recency = Math.max(0, Math.floor((now-last)/86400000));
    const gaps = customer.orders.slice(1).map((sale,index)=>Math.max(1,(new Date(sale.createdAt)-new Date(customer.orders[index].createdAt))/86400000));
    customer.cadence = gaps.length ? gaps.reduce((a,b)=>a+b,0)/gaps.length : 0;
    customer.aov = customer.revenue / customer.orders.length;
    customer.clv = customer.aov * Math.min(52,365/(customer.cadence || 90)) * (customer.orders.length > 1 ? 1 : .35);
    customer.risk = Math.min(100, Math.round(customer.recency/(customer.cadence ? customer.cadence*1.5 : 60)*100));
    customer.segment = customer.recency < 30 && customer.orders.length >= 4 ? "Champions"
      : customer.recency > 90 && customer.orders.length >= 3 ? "At risk"
        : customer.orders.length > 1 ? "Loyal" : "New customer";
    customer.firstOrder = first;
    customer.topProduct = [...customer.products.entries()].sort((a,b)=>b[1]-a[1])[0]?.[0] || "—";
    return customer;
  }).sort((a,b)=>b.revenue-a.revenue);
  const rfmGroups = [
    [...customers].sort((a,b)=>a.recency-b.recency),
    [...customers].sort((a,b)=>b.orders.length-a.orders.length),
    [...customers].sort((a,b)=>b.revenue-a.revenue)
  ];
  const quintile = (index,length) => length<=1?5:5-Math.min(4,Math.floor(index/length*5));
  rfmGroups.forEach((group,scoreIndex)=>group.forEach((customer,index)=>{
    customer[["rScore","fScore","mScore"][scoreIndex]]=quintile(index,group.length);
  }));
  customers.forEach(customer=>{
    const {rScore:r,fScore:f,mScore:m}=customer;
    customer.rfm=`${r}${f}${m}`;
    customer.segment=r>=4&&f>=4&&m>=4?"Champions":f>=4&&r>=3?"Loyal":r>=4&&f>=2&&m>=3?"Potential loyalist":r===5&&f<=2?"New customer":r>=4&&f<=2?"Promising":r===3&&f===3?"Needs attention":r<=2&&f>=4&&m>=4?"Cannot lose":r<=2&&f>=3?"At risk":r<=2&&f<=2&&m>=3?"Hibernating":"Lost";
  });
  const seriesMap = new Map();
  const granularity = filters.granularity || (days > 180 ? "month" : days > 62 ? "week" : "day");
  const bucket = date => {
    if (granularity === "month") return { key:`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}`, label:`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}` };
    if (granularity === "week") {
      const week = dayStart(date); week.setDate(week.getDate()-((week.getDay()+6)%7));
      return { key:week.toISOString().slice(0,10), label:week.toLocaleDateString(undefined,{day:"numeric",month:"short"}) };
    }
    return { key:dayStart(date).toISOString().slice(0,10), label:date.toLocaleDateString(undefined,{day:"numeric",month:"short"}) };
  };
  salesInRange.filter(paid).forEach(sale => {
    const date = localDate(sale.createdAt); if (!date) return;
    const { key, label } = bucket(date), point = seriesMap.get(key) || {label,revenue:0,web:0,pos:0,orders:0,profit:0,expenses:0};
    point.revenue += sale.total; point[sale.channel] += sale.total; point.orders += 1; point.profit += sale.profit;
    seriesMap.set(key,point);
  });
  data.expenses.filter(expense => (localDate(expense.date)?.getTime() ?? 0) >= start.getTime() && (localDate(expense.date)?.getTime() ?? 0) <= end.getTime())
    .forEach(expense => {
      const date = localDate(expense.date);
      if (!date) return;
      const { key, label } = bucket(date);
      const point = seriesMap.get(key) || { label, revenue: 0, web: 0, pos: 0, orders: 0, profit: 0, expenses: 0 };
      point.expenses += expense.amount;
      seriesMap.set(key, point);
    });
  const series = [...seriesMap.entries()].sort((left,right)=>left[0].localeCompare(right[0])).map(([,point])=>point);
  const channelRevenue = { web:sum(currentPaid.filter(sale=>sale.channel==="web"),sale=>sale.total), pos:sum(currentPaid.filter(sale=>sale.channel==="pos"),sale=>sale.total) };
  const expenses = sum(data.expenses.filter(expense => (localDate(expense.date)?.getTime() ?? 0) >= start.getTime() && (localDate(expense.date)?.getTime() ?? 0) <= end.getTime()),expense=>expense.amount);
  const cogs = sum(currentPaid,sale=>sale.cogs), grossProfit = revenue - cogs, netProfit = grossProfit-expenses;
  const stock = data.products.map(product=>{
    const sold = sum(productStats.filter(item=>item.name===product.name),item=>item.units);
    const velocity=sold/days, cover=velocity>0?(Number(product.stock)||0)/velocity:(Number(product.stock)>0?Infinity:0);
    const status=Number(product.stock)<=0?"out":cover<=3?"critical":Number(product.stock)<=5||cover<=7?"low":sold===0?"dead":cover>120?"overstocked":"healthy";
    return {...product,category:product.categoryName||product.category||"Uncategorized",sold,velocity,cover,status,reorder:Math.max(0,Math.ceil(velocity*21-(Number(product.stock)||0)))};
  });
  const payments = new Map();
  const channelPayments = new Map();
  currentPaid.forEach(sale=>{
    const key=sale.paymentMethod||"other";
    const item=payments.get(key)||{method:key,revenue:0,orders:0};
    item.revenue+=sale.total;item.orders++;payments.set(key,item);
    const paymentKey=`${sale.channel}:${key}`;
    const channelItem=channelPayments.get(paymentKey)||{channel:sale.channel,method:key,revenue:0,orders:0};
    channelItem.revenue+=sale.total;channelItem.orders++;channelPayments.set(paymentKey,channelItem);
  });
  const pages = new Map(); visitors.forEach(visit=>pages.set(visit.path||"/",(pages.get(visit.path||"/")||0)+1));
  const devices = new Map(); visitors.forEach(visit=>devices.set(visit.device||"unknown",(devices.get(visit.device||"unknown")||0)+1));
  const sources = new Map(); visitors.forEach(visit=>{let source="Direct / none";try{if(visit.referrer)source=new URL(visit.referrer).hostname.replace(/^www\./,"");}catch{}sources.set(source,(sources.get(source)||0)+1);});
  const webVisitors = new Set(visitors.map(visit=>visit.visitorId)).size;
  const productVisitors = new Set(visitors.filter(visit=>visit.path.startsWith("/product")).map(visit=>visit.visitorId)).size;
  const checkoutVisitors = new Set(visitors.filter(visit=>visit.path.startsWith("/checkout")).map(visit=>visit.visitorId)).size;
  const categoryStats = new Map(); currentPaid.forEach(sale=>sale.items.forEach(item=>{const name=item.category||"Uncategorized";categoryStats.set(name,(categoryStats.get(name)||0)+item.lineTotal);}));
  const singles=new Map(), pairCounts=new Map(), baskets=currentPaid.map(sale=>[...new Set(sale.items.map(item=>item.name))]).filter(items=>items.length>1);
  baskets.forEach(items=>{items.forEach(item=>singles.set(item,(singles.get(item)||0)+1));for(let i=0;i<items.length;i++)for(let j=i+1;j<items.length;j++){const [left,right]=[items[i],items[j]].sort();const key=`${left} + ${right}`;pairCounts.set(key,(pairCounts.get(key)||0)+1);}});
  const pairs=[...pairCounts.entries()].map(([pair,count])=>({pair,count,lift:count*baskets.length/Math.max(1,(singles.get(pair.split(" + ")[0])||0)*(singles.get(pair.split(" + ")[1])||0))})).sort((x,y)=>y.lift-x.lift||y.count-x.count);
  const paidCustomerIds = new Set(currentPaid.map(sale=>sale.customerId).filter(Boolean));
  const kpis = {
    revenue, previousRevenue, delta: filters.range === "all" ? 0 : previousRevenue ? (revenue-previousRevenue)/Math.abs(previousRevenue)*100 : revenue ? 100 : 0,
    orders:currentPaid.length, units:sum(currentPaid,sale=>sum(sale.items,item=>item.quantity)), customers:paidCustomerIds.size,
    web:channelRevenue.web,pos:channelRevenue.pos, webOrders:currentPaid.filter(sale=>sale.channel==="web").length,posOrders:currentPaid.filter(sale=>sale.channel==="pos").length,
    aov:currentPaid.length?revenue/currentPaid.length:0,profit:grossProfit,margin:safePercent(grossProfit,revenue),expenses,netProfit,
    stockValue:sum(data.products,product=>(Number(product.stock)||0)*(Number(product.costPrice)||0))
  };
  const insights = [];
  if(previousRevenue && kpis.delta <= -15) insights.push({tone:"critical",type:"revenue",title:`Revenue declined ${Math.abs(kpis.delta).toFixed(0)}%`,detail:`Current ${money(revenue,data.currency)} versus ${money(previousRevenue,data.currency)} in the previous equal period.`,action:"Check traffic, in-stock availability, and average basket before changing prices."});
  if(previousRevenue && kpis.delta >= 15) insights.push({tone:"positive",type:"revenue",title:`Revenue grew ${kpis.delta.toFixed(0)}%`,detail:`Current ${money(revenue,data.currency)} versus ${money(previousRevenue,data.currency)} in the previous equal period.`,action:"Protect stock on leading products and keep the channels driving growth available."});
  const leadingProduct=productStats[0];
  if(leadingProduct && leadingProduct.share>35) insights.push({tone:"warning",type:"products",title:`${leadingProduct.name} contributes ${leadingProduct.share.toFixed(0)}% of sales revenue`,detail:`${leadingProduct.units} units generated ${money(leadingProduct.revenue,data.currency)} in the selected period.`,action:"Protect its stock and develop another strong seller to reduce concentration risk."});
  const thinMargin=productStats.find(item=>item.units>=3&&item.margin<10);
  if(thinMargin) insights.push({tone:"warning",type:"products",title:`${thinMargin.name} sells with a thin estimated margin`,detail:`${thinMargin.units} units · ${thinMargin.margin.toFixed(1)}% estimated margin.`,action:"Verify its recorded buying cost, then review price or supplier terms."});
  const repeatRate=safePercent(customers.filter(customer=>customer.orders.length>1).length,customers.length);
  if(customers.length>4) insights.push({tone:repeatRate<15?"warning":"neutral",type:"customers",title:`Repeat-customer rate is ${repeatRate.toFixed(0)}%`,detail:`${customers.filter(customer=>customer.orders.length>1).length} of ${customers.length} identified buyers made more than one recorded purchase.`,action:"Capture contact details consistently and use opt-in follow-up to encourage a return visit."});
  const channelAovGap=kpis.webOrders&&kpis.posOrders?((kpis.web/kpis.webOrders)-(kpis.pos/kpis.posOrders))/Math.max(1,kpis.pos/kpis.posOrders)*100:0;
  if(Math.abs(channelAovGap)>20) insights.push({tone:"neutral",type:"channels",title:`Average order size differs by ${Math.abs(channelAovGap).toFixed(0)}% across channels`,detail:`Web ${money(kpis.webOrders?kpis.web/kpis.webOrders:0,data.currency)} · counter ${money(kpis.posOrders?kpis.pos/kpis.posOrders:0,data.currency)}.`,action:"Compare channel product mix and attach rates before adjusting promotions."});
  const lowStock=stock.filter(item=>["out","critical"].includes(item.status));
  if(lowStock.length) insights.push({tone:"critical",type:"inventory",title:`${lowStock.length} product lines need immediate stock attention`,detail:lowStock.slice(0,5).map(item=>`${item.name}: ${item.stock} left`).join(" · "),action:"Review Inventory and update stock before promoting these products."});
  if(revenue && !data.products.some(product=>Number(product.costPrice)>0)) insights.push({tone:"warning",type:"finance",title:"Profit is a ceiling because product costs are missing",detail:"The available catalogue has no recorded unit cost for products sold in this period.",action:"Add buying prices in product management before relying on margin estimates."});
  if(kpis.netProfit<0 && expenses) insights.push({tone:"critical",type:"finance",title:"Recorded operating costs exceed gross profit",detail:`Gross profit ${money(grossProfit,data.currency)} · recorded expenses ${money(expenses,data.currency)}.`,action:"Review the expense ledger and product cost prices."});
  if(!insights.length) insights.push({tone:"neutral",type:"general",title:"No urgent signals in the current data",detail:"Insights are based on the recorded local sales, stock, visits and expenses.",action:"Keep records up to date; filters and recorded history determine what can be assessed."});
  const categoryCapital = new Map();
  data.products.forEach(product => {
    const category = product.categoryName || product.category || "Uncategorized";
    const amount = Math.max(0, Number(product.stock) || 0) * Math.max(0, Number(product.costPrice) || 0);
    const current = categoryCapital.get(category) || { category, units: 0, capital: 0, products: 0 };
    current.units += Math.max(0, Number(product.stock) || 0);
    current.capital += amount;
    current.products++;
    categoryCapital.set(category, current);
  });
  const trading = Array.from({ length: 28 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (27 - index));
    const daySales = currentPaid.filter(sale => {
      const soldAt = localDate(sale.createdAt);
      return soldAt && dayStart(soldAt).getTime() === date.getTime();
    });
    return { date, revenue: sum(daySales, sale => sale.total), orders: daySales.length };
  });
  const weekdayRevenue = [0, 0, 0, 0, 0, 0, 0];
  currentPaid.forEach(sale => {
    const date = localDate(sale.createdAt);
    if (date) weekdayRevenue[date.getDay()] += sale.total;
  });
  const weekdayValues = weekdayRevenue.filter((_, day) => day >= 1 && day <= 5);
  const weekendValues = weekdayRevenue.filter((_, day) => day === 0 || day === 6);
  const weekdaysOpen = new Set(currentPaid.map(sale => localDate(sale.createdAt)?.getDay()).filter(day => day >= 1 && day <= 5)).size;
  const weekendDaysOpen = new Set(currentPaid.map(sale => localDate(sale.createdAt)?.getDay()).filter(day => day === 0 || day === 6)).size;
  const tradingComparison = {
    weekday: sum(weekdayValues, value => value) / Math.max(1, weekdaysOpen),
    weekend: sum(weekendValues, value => value) / Math.max(1, weekendDaysOpen)
  };
  const expenseCategories = new Map();
  data.expenses.filter(expense => {
    const time=localDate(expense.date)?.getTime()??NaN;
    return Number.isFinite(time)&&time>=start.getTime()&&time<=end.getTime();
  }).forEach(expense => {
    const category=expense.category||"Uncategorized";
    expenseCategories.set(category,(expenseCategories.get(category)||0)+expense.amount);
  });
  const geography = new Map();
  data.sales.filter(paid).forEach(sale => {
    const place=[sale.city,sale.country].filter(Boolean).join(", ");
    if(!place)return;
    const item=geography.get(place)||{place,customerIds:new Set(),revenue:0};
    item.customerIds.add(sale.customerId||`${sale.channel}:${sale.id}`);
    item.revenue+=sale.total;
    geography.set(place,item);
  });
  const geographyRows=[...geography.values()].map(item=>({place:item.place,customers:item.customerIds.size,revenue:item.revenue}));
  return { ...data, filters, start, end, days, scoped, currentPaid, previous, visitors, webVisitors, productVisitors, checkoutVisitors, productStats, customers, series, channelRevenue, categoryStats, categoryCapital: [...categoryCapital.values()].sort((x,y)=>y.capital-x.capital), expenseCategories:[...expenseCategories.entries()].sort((x,y)=>y[1]-x[1]), geography:geographyRows.sort((x,y)=>y.revenue-x.revenue), pairs, stock, payments:[...payments.values()], channelPayments:[...channelPayments.values()], pages:[...pages.entries()].sort((a,b)=>b[1]-a[1]), devices:[...devices.entries()].sort((a,b)=>b[1]-a[1]), sources:[...sources.entries()].sort((a,b)=>b[1]-a[1]), kpis, insights, grossProfit, netProfit, expenseTotal:expenses, cogs, trading, weekdayRevenue, tradingComparison };
}

function renderOverview(a) {
  const {kpis,currency,series,insights,productStats,categoryStats,payments,scoped}=a;
  const revenueNote = a.filters.range === "all"
    ? "All recorded time"
    : `${kpis.delta>=0?"+":""}${kpis.delta.toFixed(1)}% vs previous equal period`;
  return `<div class="bl-kpis">${metric("Revenue",shortMoney(kpis.revenue,currency),revenueNote)}${metric("Paid orders",kpis.orders,`${kpis.units} units`)}${metric("Gross profit",shortMoney(kpis.profit,currency),`${kpis.margin.toFixed(1)}% estimated margin`)}${metric("Customers",kpis.customers,`${a.customers.filter(customer=>customer.orders.length>1).length} repeat`)}${metric("Average order",money(kpis.aov,currency))}${metric("Net after recorded expenses",shortMoney(kpis.netProfit,currency))}${metric("Web visitors",a.webVisitors,`${a.visitors.length} page views`)}${metric("Stock value at cost",shortMoney(kpis.stockValue,currency))}</div>
    ${card("Business performance","<div class='bl-chart-tabs'><span>Revenue · Web · Counter</span></div>"+lineChart(series,["web","pos"],currency))}
    <div class="bl-two">${card("Priority insights",listRows(insights.slice(0,4).map(item=>`<div class="bl-insight ${item.tone}"><strong>${$(item.title)}</strong><p>${$(item.detail)}</p><small>Next: ${$(item.action)}</small></div>`)))}${card("Break-even position",`<div class="bl-big-number">${money(kpis.netProfit,currency)}</div><p>Gross profit less recorded expenses for the selected period.</p><div class="bl-rule">${row("Gross revenue",money(kpis.revenue,currency))}${row("Cost of goods (available cost data)",money(a.cogs,currency))}${row("Recorded operating expenses",money(kpis.expenses,currency))}</div>`)}</div>
    <div class="bl-two">${card("Top products",barRows(productStats.slice(0,7),item=>item.name,item=>item.revenue,(value)=>shortMoney(value,currency)))}${card("Revenue by category",barRows([...categoryStats.entries()].sort((x,y)=>y[1]-x[1]).slice(0,7),item=>item[0],item=>item[1],value=>shortMoney(value,currency)))}</div>
    <div class="bl-two">${card("Payment methods",barRows(payments,item=>item.method,item=>item.revenue,value=>shortMoney(value,currency)))}${card("Latest transactions",listRows([...scoped].slice(0,6).map(sale=>row(sale.reference, money(sale.collected,currency),`${sale.channel} · ${dateLabel(sale.date)} · ${sale.status}`))))}</div>`;
}

function renderInsights(a) {
  const severity=a.filters.insightSeverity||"all", type=a.filters.insightType||"all";
  const filtered=a.insights.filter(item=>(severity==="all"||item.tone===severity)&&(type==="all"||item.type===type));
  return `<div class="bl-insight-summary">${metric("Critical",a.insights.filter(item=>item.tone==="critical").length)}${metric("Worth watching",a.insights.filter(item=>item.tone==="warning").length)}${metric("Positive",a.insights.filter(item=>item.tone==="positive").length)}</div><div class="bl-filter-row">${filterSelect("insightSeverity","Severity",severity,[["all","All severity"],["critical","Critical"],["warning","Watch"],["positive","Positive"],["neutral","Neutral"]])}${filterSelect("insightType","Signal type",type,[["all","All types"],["revenue","Revenue"],["products","Products"],["customers","Customers"],["channels","Channels"],["inventory","Inventory"],["finance","Finance"],["general","General"]])}</div>${listRows(filtered.map(item=>`<article class="bl-insight ${item.tone}"><span>${$(item.tone)} · BUSINESS SIGNAL · ${$(item.type||"general").toUpperCase()}</span><h2>${$(item.title)}</h2><p>${$(item.detail)}</p><b>Action: ${$(item.action)}</b></article>`))}`;
}

function forecastSeries(series) {
  const values=series.map(point=>point.revenue);
  if(values.length<4)return [];
  const alpha=.4,beta=.25,damping=.92;
  let level=values[0],trend=values[1]-values[0];
  const residuals=[];
  for(let index=1;index<values.length;index++){
    const actual=values[index],predicted=level+trend;
    residuals.push(actual-predicted);
    const nextLevel=alpha*actual+(1-alpha)*(level+trend);
    trend=beta*(nextLevel-level)+(1-beta)*trend;
    level=nextLevel;
  }
  const sigma=Math.sqrt(residuals.reduce((total,value)=>total+value*value,0)/Math.max(1,residuals.length));
  let damped=trend,cumulative=0;
  return Array.from({length:7},(_,index)=>{
    const step=index+1;
    cumulative+=Math.pow(damping,step);
    const predicted=Math.max(0,level+cumulative*damped);
    const spread=sigma*Math.sqrt(step)*1.28;
    damped=trend;
    return {label:`+${step}`,revenue:predicted,lower:Math.max(0,predicted-spread),upper:predicted+spread};
  });
}

function renderRevenue(a) {
  const periodLabel = a.filters.range === "all" ? "All recorded time" : `${a.days} days`;
  const anomalies=a.series.length>7?a.series.map((item,index)=>{
    const recent=a.series.slice(Math.max(0,index-14),index).map(point=>point.revenue);
    const mean=sum(recent,value=>value)/Math.max(1,recent.length);
    const deviation=Math.sqrt(recent.reduce((total,value)=>total+Math.pow(value-mean,2),0)/Math.max(1,recent.length));
    return {item,index,mean,z:deviation?(item.revenue-mean)/deviation:0};
  }).filter(({index,z})=>index>=5&&Math.abs(z)>=2).slice(-8):[];
  const forecast=forecastSeries(a.series);
  const hours=Array.from({length:24},(_,hour)=>({hour,revenue:0})); const weekdays=Array.from({length:7},(_,day)=>({day,revenue:0,label:["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][day]}));
  a.currentPaid.forEach(sale=>{const date=localDate(sale.createdAt);if(date){hours[date.getHours()].revenue+=sale.total;weekdays[date.getDay()].revenue+=sale.total;}});
  const max=Math.max(1,...hours.map(item=>item.revenue));
  const anomalyRows = anomalies.map(({item,index}) => {
    const previous = a.series.slice(Math.max(0,index-5),index);
    const baseline = sum(previous,point=>point.revenue)/Math.max(1,previous.length);
    return row(item.label,money(item.revenue,a.currency),`Recent baseline: ${money(item.mean ?? baseline,a.currency)} · ${item.z.toFixed(1)}σ`);
  });
  const periodRows = a.series.map(point=>`<tr><td>${$(point.label)}</td><td>${money(point.revenue,a.currency)}</td><td>${money(point.web,a.currency)}</td><td>${money(point.pos,a.currency)}</td><td>${point.orders}</td><td>${money(point.profit,a.currency)}</td></tr>`);
  return `<div class="bl-kpis">${metric("Revenue this period",money(a.kpis.revenue,a.currency),periodLabel)}${metric("Daily average",money(a.kpis.revenue/a.days,a.currency))}${metric("Forecast next 7 periods",forecast.length?money(sum(forecast,item=>item.revenue),a.currency):"Not enough history",forecast.length?"Simple recent-average projection":"Needs four periods")} ${metric("Unusual periods",anomalies.length,"Review period table")}</div>
    ${card("This period · channel split",lineChart(a.series,["web","pos"],a.currency))}
    <div class="bl-two">${card("Forecast · estimate and range",forecast.length?`${lineChart(forecast,["revenue"],a.currency)}<p class="bl-caption">Projection uncertainty is shown as lower/upper estimates in the table; this is not a guarantee.</p>${table(["Period","Projection","Lower estimate","Upper estimate"],forecast.map(item=>`<tr><td>${item.label}</td><td>${money(item.revenue,a.currency)}</td><td>${money(item.lower,a.currency)}</td><td>${money(item.upper,a.currency)}</td></tr>`))}`:`<p class="bl-empty">At least four historical periods are needed to project. This view does not invent a forecast.</p>`)}${card("Profit vs running costs",lineChart(a.series.map(point=>({...point,expenses:point.expenses,net:point.profit-point.expenses})),["profit","expenses","net"],a.currency))}</div>
    ${card("Trading rhythm",`<p class="bl-caption">Paid sales by local device time · weekday bars show revenue for each day; hourly bars include all 24 hours.</p><div class="bl-heat">${weekdays.map(day=>`<div><span>${day.label}</span><i style="height:${Math.max(3,day.revenue/Math.max(1,...weekdays.map(item=>item.revenue))*38)}px"></i><small>${shortMoney(day.revenue,a.currency)}</small></div>`).join("")}</div><div class="bl-hour-bars">${hours.map(item=>`<div title="${item.hour}:00 · ${money(item.revenue,a.currency)}"><i style="height:${Math.max(2,item.revenue/max*50)}px"></i><span>${item.hour}</span></div>`).join("")}</div><div class="bl-two bl-trading-compare">${metric("Average weekday revenue",money(a.tradingComparison.weekday,a.currency),"Per weekday with recorded sales")}${metric("Average weekend-day revenue",money(a.tradingComparison.weekend,a.currency),"Per weekend day with recorded sales")}</div><p class="bl-caption">Last 28 calendar days · each square is a local date; darker means more revenue.</p><div class="bl-trading-calendar">${a.trading.map(day=>`<div title="${dateLabel(day.date)} · ${money(day.revenue,a.currency)} · ${day.orders} orders" style="--activity:${day.revenue?Math.min(.9,.18+day.revenue/Math.max(1,...a.trading.map(item=>item.revenue))*.72):.06}"><span>${day.date.getDate()}</span></div>`).join("")}</div>`) }
    <div class="bl-two">${card("Statistical outliers",anomalyRows.length?listRows(anomalyRows):`<p class="bl-empty">${a.series.length>7?"No periods crossed the 2σ review threshold.":"At least eight recorded periods are required to assess statistical outliers."}</p>`)}${card("Period breakdown",table(["Period","Revenue","Web","Counter","Orders","Gross profit"],periodRows))}</div>`;
}

function renderChannels(a) {
  const total=a.kpis.revenue||1;
  const byProduct=a.productStats.map(item=>({...item,webShare:safePercent(item.web,item.revenue),posShare:safePercent(item.pos,item.revenue)}));
  return `<div class="bl-kpis">${metric("Storefront revenue",money(a.kpis.web,a.currency),`${a.kpis.webOrders} paid orders · ${safePercent(a.kpis.web,total).toFixed(1)}%`)}${metric("Counter revenue",money(a.kpis.pos,a.currency),`${a.kpis.posOrders} paid orders · ${safePercent(a.kpis.pos,total).toFixed(1)}%`)}${metric("Storefront average order",money(a.kpis.webOrders?a.kpis.web/a.kpis.webOrders:0,a.currency))}${metric("Counter average order",money(a.kpis.posOrders?a.kpis.pos/a.kpis.posOrders:0,a.currency))}</div>
    ${card("Revenue by channel over time",lineChart(a.series,["web","pos"],a.currency))}
    ${card("Side by side",table(["Measure","Storefront","Counter"],[
      ["Revenue",money(a.kpis.web,a.currency),money(a.kpis.pos,a.currency)],
      ["Paid orders",a.kpis.webOrders,a.kpis.posOrders],
      ["Average order",money(a.kpis.webOrders?a.kpis.web/a.kpis.webOrders:0,a.currency),money(a.kpis.posOrders?a.kpis.pos/a.kpis.posOrders:0,a.currency)],
      ["Units",sum(a.currentPaid.filter(s=>s.channel==="web"),s=>sum(s.items,i=>i.quantity)),sum(a.currentPaid.filter(s=>s.channel==="pos"),s=>sum(s.items,i=>i.quantity))],
      ["Estimated gross profit",money(sum(a.currentPaid.filter(s=>s.channel==="web"),s=>s.profit),a.currency),money(sum(a.currentPaid.filter(s=>s.channel==="pos"),s=>s.profit),a.currency)]
    ].map(cells=>`<tr>${cells.map(cell=>`<td>${cell}</td>`).join("")}</tr>`)))}
    <div class="bl-two">${card("Web payment methods",barRows(a.channelPayments.filter(item=>item.channel==="web"),item=>item.method,item=>item.revenue,value=>money(value,a.currency)))}${card("Counter payment methods",barRows(a.channelPayments.filter(item=>item.channel==="pos"),item=>item.method,item=>item.revenue,value=>money(value,a.currency)))}</div>
    <div class="bl-two">${card("Products by sales channel",listRows(byProduct.slice(0,12).map(item=>`<div class="bl-channel-product"><strong>${$(item.name)}</strong><div><span>Web ${money(item.web,a.currency)} · ${item.webUnits} units</span><i><b style="width:${item.webShare}%"></b></i><span>Counter ${money(item.pos,a.currency)} · ${item.posUnits} units</span><i><b style="width:${item.posShare}%;background:#888"></b></i></div></div>`)))}${card("Payment-provider records",listRows(a.channelPayments.map(item=>row(`${item.channel} · ${item.method}`,money(item.revenue,a.currency),`${item.orders} payments`))))}</div>`;
}

function renderProducts(a, snapshot) {
  const top=a.productStats.slice(0,10), max=Math.max(1,...top.map(item=>item.revenue));
  const pairs=a.pairs.filter(item=>item.count>=2).slice(0,12);
  const items=a.productStats.map(item=>`<tr><td>${$(item.name)}</td><td>${$(item.category)}</td><td>${item.units}</td><td>${money(item.revenue,a.currency)}</td><td>${money(item.profit,a.currency)}</td><td>${item.margin.toFixed(1)}%</td><td>${item.abc}</td><td>${money(item.web,a.currency)} / ${money(item.pos,a.currency)}</td></tr>`);
  return `<div class="bl-kpis">${metric("Products sold",a.productStats.length,`${a.kpis.units} units`)}${metric("A-class lines",a.productStats.filter(item=>item.abc==="A").length,"Top 80% revenue contribution")}${metric("Best margin",a.productStats.length?`${a.productStats.reduce((best,item)=>item.margin>best.margin?item:best).margin.toFixed(1)}%`:"—")}${metric("Catalogue lines",snapshot.products.length)}</div>
    <div class="bl-two">    ${card("Product leaderboard · revenue",barRows(top,item=>item.name,item=>item.revenue,value=>money(value,a.currency)))}
    ${card("Fastest movers · units sold",barRows([...a.productStats].sort((x,y)=>y.units-x.units).slice(0,10),item=>item.name,item=>item.units,value=>`${value} units`))}${card("Pareto · revenue contribution",listRows(a.productStats.slice(0,12).map((item,index)=>`<div class="bl-bar-row"><div><span>${index+1}. ${$(item.name)} · ${item.abc}</span><b>${item.share.toFixed(1)}% · cum. ${item.cumulative.toFixed(1)}%</b></div><i><span style="width:${Math.min(100,item.cumulative||item.share)}%"></span></i></div>`)))}</div>
    ${card("Volume against margin",`<div class="bl-scatter">${a.productStats.filter(item=>item.units).map(item=>`<span title="${$(item.name)} · ${item.units} units · ${item.margin.toFixed(1)}% margin" style="left:${Math.min(96,Math.max(2,item.units/Math.max(1,...a.productStats.map(p=>p.units))*94))}%;bottom:${Math.min(92,Math.max(3,item.margin/Math.max(1,...a.productStats.map(p=>p.margin))*88))}%">${$(item.name.slice(0,2))}</span>`).join("")||`<p class="bl-empty">No paid product sales in this period.</p>`}</div><p class="bl-caption">Horizontal: units sold · vertical: margin percentage. Margin is estimated from recorded unit costs.</p>`)}
    ${card("Category performance",barRows([...a.categoryStats.entries()].sort((x,y)=>y[1]-x[1]),item=>item[0],item=>item[1],value=>money(value,a.currency)))}
    ${card("Frequently bought together",listRows(pairs.map(item=>row(item.pair,item.count,`Lift ${item.lift.toFixed(2)} · observed in ${item.count} baskets; above 1 means more frequent than chance.`))))}
    ${card("Every product",table(["Product","Category","Units","Revenue","Profit*","Margin*","ABC","Web / counter"],items))}
    <p class="bl-caption">*Profit and margin are only estimates where the matching product has a recorded cost price. Existing catalogue management remains available from the Store products and POS screens.</p>
    <div class="bl-actions"><a href="/account/products" data-route="/account/products">Edit website products</a><a href="/pos/products" data-route="/pos/products">Edit POS products</a></div>`;
}

function renderInventory(a) {
  const health=a.stock, statusCount=status=>health.filter(item=>item.status===status).length;
  const selectedStatus=a.filters.stockStatus||"all";
  const filteredHealth=health.filter(item=>selectedStatus==="all"||item.status===selectedStatus);
  return `<div class="bl-kpis">${metric("Stock at cost",money(a.kpis.stockValue,a.currency))}${metric("Needs reorder",statusCount("out")+statusCount("critical")+statusCount("low"))}${metric("Dead stock",statusCount("dead"),"No sales in the selected range")}${metric("Tracked lines",health.length,`${statusCount("healthy")} healthy · ${statusCount("overstocked")} overstocked`)}</div>
    ${card("Stock status mix",barRows(["out","critical","low","healthy","overstocked","dead"].map(status=>({status,count:statusCount(status)})).filter(item=>item.count),item=>item.status,item=>item.count,value=>value))}
    ${card("Inventory capital by category · recorded cost",barRows(a.categoryCapital,item=>item.category,item=>item.capital,value=>money(value,a.currency)))}
    ${card("Capital and units by category",table(["Category","Products","Units in stock","Capital at cost","Capital share"],a.categoryCapital.map(item=>`<tr><td>${$(item.category)}</td><td>${item.products}</td><td>${item.units}</td><td>${money(item.capital,a.currency)}</td><td>${safePercent(item.capital,a.kpis.stockValue).toFixed(1)}%</td></tr>`)))}
    ${card("Fastest movers · units by sales channel",table(["Product","Units sold","Storefront units","Counter units","Units / day"],[...a.productStats].sort((x,y)=>y.units-x.units).slice(0,12).map(item=>`<tr><td>${$(item.name)}</td><td>${item.units}</td><td>${item.webUnits}</td><td>${item.posUnits}</td><td>${(item.units/a.days).toFixed(2)}</td></tr>`)))}
    ${card("Suggested reorder · 21-day cover",table(["Product","Stock","Velocity/day","Cover days","Order"],health.filter(item=>item.reorder>0).map(item=>`<tr><td>${$(item.name)}<small>${$(item.category)}</small></td><td>${item.stock}</td><td>${item.velocity.toFixed(2)}</td><td>${Number.isFinite(item.cover)?`${item.cover.toFixed(0)}d`:"No sales"}</td><td><b>${item.reorder}</b></td></tr>`)))}
    <div class="bl-filter-row">${filterSelect("stockStatus","Stock health",selectedStatus,[["all","All stock health"],["out","Out of stock"],["critical","Critical"],["low","Low"],["healthy","Healthy"],["overstocked","Overstocked"],["dead","No sales"]])}</div>
    ${card("Full stock position",table(["Product","Category","Stock","Value at cost","Units sold","Status"],filteredHealth.map(item=>`<tr><td>${$(item.name)}</td><td>${$(item.category)}</td><td>${item.stock??"—"}</td><td>${money((Number(item.stock)||0)*(Number(item.costPrice)||0),a.currency)}</td><td>${item.sold}</td><td>${$(item.status)}</td></tr>`)))}
    <div class="bl-actions"><a href="/store/inventory" data-route="/store/inventory">Edit website inventory</a><a href="/pos/inventory" data-route="/pos/inventory">Open POS inventory</a></div>`;
}

function renderTransactions(a) {
  const status=a.filters.transactionStatus||"all", payment=a.filters.transactionPayment||"all", query=(a.filters.transactionQuery||"").trim().toLowerCase();
  const transactions=a.scoped.filter(sale=>(status==="all"||(status==="paid"?paid(sale):!paid(sale)))&&(payment==="all"||sale.paymentMethod===payment)&&(!query||[sale.reference,sale.customerName,sale.customerEmail,sale.customerPhone].some(value=>String(value||"").toLowerCase().includes(query))));
  return `<div class="bl-kpis">${metric("Matching transactions",transactions.length)}${metric("Value",money(sum(transactions,sale=>sale.total),a.currency))}${metric("Collected",money(sum(transactions,sale=>sale.collected),a.currency))}${metric("Outstanding",money(sum(transactions,sale=>Math.max(0,sale.total-sale.collected)),a.currency))}</div>
    <form class="bl-filter-row" data-business-filter-form><label class="bl-inline-filter"><span>Search receipt / customer</span><input name="transactionQuery" value="${$(a.filters.transactionQuery||"")}" placeholder="Name, phone, email or receipt"></label>${filterSelect("transactionStatus","Payment status",status,[["all","All statuses"],["paid","Paid"],["unpaid","Not fully paid"]])}${filterSelect("transactionPayment","Payment method",payment,[["all","All methods"],...a.payments.map(item=>[item.method,item.method])])}<button type="submit">Apply</button></form>
    ${card("All transactions · select a receipt to expand",table(["Receipt / date","Channel","Status","Total","Collected","Items"],[...transactions].sort((x,y)=>String(y.date).localeCompare(String(x.date))).map(sale=>`<tr><td><details><summary>${$(sale.reference)}<small>${dateLabel(sale.date)}</small></summary><div class="bl-receipt">${sale.lineItems.map(item=>`<div>${$(item.name)} · ${item.quantity} × ${money(item.unitPrice,a.currency)} = ${money(item.quantity*item.unitPrice,a.currency)}</div>`).join("")}<hr><b>Total ${money(sale.total,a.currency)} · paid ${money(sale.collected,a.currency)}</b></div></details></td><td>${$(sale.channel)}</td><td>${$(sale.status)}</td><td>${money(sale.total,a.currency)}</td><td>${money(sale.collected,a.currency)}</td><td>${sale.itemCount}</td></tr>`)))}
    <div class="bl-actions"><button type="button" data-business-export="transactions">Export transactions CSV</button></div>`;
}

function renderCustomers(a, context) {
  const customerRows=a.customers.map(customer=>`<tr><td>${$(customer.name)}<small>${$(customer.email||customer.phone||"No contact")} · ${$(customer.segment)}</small></td><td>${customer.orders.length}</td><td>${money(customer.revenue,a.currency)}</td><td>${money(customer.clv,a.currency)}</td><td>${customer.recency}d · ${customer.risk}%</td><td>${$(customer.topProduct)}</td></tr>`);
  const repeat=a.customers.filter(customer=>customer.orders.length>1);
  const quiet=a.customers.filter(customer=>customer.recency>=90&&(customer.email||customer.phone)).slice(0,10);
  const cohortMap=new Map();
  a.customers.forEach(customer=>{const key=`${customer.firstOrder.getFullYear()}-${String(customer.firstOrder.getMonth()+1).padStart(2,"0")}`;cohortMap.set(key,(cohortMap.get(key)||0)+1);});
  const retentionRows=[...cohortMap.entries()].sort((x,y)=>x[0].localeCompare(y[0])).slice(-12).map(([month,count])=>{
    const ids=a.customers.filter(customer=>`${customer.firstOrder.getFullYear()}-${String(customer.firstOrder.getMonth()+1).padStart(2,"0")}`===month);
    const mature30=ids.filter(customer=>Date.now()-customer.firstOrder.getTime()>=30*86400000);
    const mature90=ids.filter(customer=>Date.now()-customer.firstOrder.getTime()>=90*86400000);
    const within=(group,days)=>group.filter(customer=>customer.orders.slice(1).some(sale=>{
      const purchase=localDate(sale.createdAt);
      return purchase&&purchase-customer.firstOrder<=days*86400000;
    })).length;
    return `<tr><td>${$(month)}</td><td>${count}</td><td>${mature30.length?`${within(mature30,30)} / ${mature30.length} · ${safePercent(within(mature30,30),mature30.length).toFixed(1)}%`:"Not mature"}</td><td>${mature90.length?`${within(mature90,90)} / ${mature90.length} · ${safePercent(within(mature90,90),mature90.length).toFixed(1)}%`:"Not mature"}</td></tr>`;
  });
  const points=context.points||[];
  return `<div class="bl-kpis">${metric("Known customers",a.customers.filter(customer=>customer.email||customer.phone).length)}${metric("Repeat rate",`${safePercent(repeat.length,a.customers.length).toFixed(1)}%`)}${metric("Projected 12-month value",money(sum(a.customers,customer=>customer.clv),a.currency))}${metric("Value at risk",money(sum(a.customers.filter(customer=>customer.segment==="At risk"),customer=>customer.revenue),a.currency))}${metric("Loyalty balances",points.length)}</div>
    <div class="bl-two">${card("Customer segments",barRows(["Champions","Loyal","Potential loyalist","New customer","At risk","Other"].map(segment=>({segment,count:a.customers.filter(customer=>segment==="Other"?!["Champions","Loyal","Potential loyalist","New customer","At risk"].includes(customer.segment):customer.segment===segment).length})).filter(item=>item.count),item=>item.segment,item=>item.count,value=>value))}${card("Win-back queue · known contacts inactive 90+ days",listRows(quiet.map(customer=>row(customer.name,money(customer.revenue,a.currency),`${customer.orders.length} orders · ${customer.recency}d since last purchase · ${customer.phone||customer.email}`))))}</div>
    ${card("Customer retention by first-purchase cohort",`<p class="bl-caption">Share of identified buyers returning within 30 or 90 days. Only cohorts old enough for each window are included.</p>${table(["Cohort","Customers","30-day return","90-day return"],retentionRows)}`)}
    <div class="bl-two">${card("Customer revenue leaderboard",table(["Customer","Lifetime revenue","Orders","Top product"],a.customers.slice(0,12).map(customer=>`<tr><td>${$(customer.name)}</td><td>${money(customer.revenue,a.currency)}</td><td>${customer.orders.length}</td><td>${$(customer.topProduct)}</td></tr>`)))}${card("Geographic revenue concentration",a.geography.length?`${barRows(a.geography.slice(0,10),item=>item.place,item=>item.revenue,value=>money(value,a.currency))}${table(["City / country","Identified customers","Revenue","Share of located revenue"],a.geography.slice(0,12).map(item=>`<tr><td>${$(item.place)}</td><td>${item.customers}</td><td>${money(item.revenue,a.currency)}</td><td>${safePercent(item.revenue,sum(a.geography,place=>place.revenue)).toFixed(1)}%</td></tr>`))}`:`<p class="bl-empty">No customer location is recorded on available orders. Geography is not inferred.</p>`)}</div>
    ${card("Spend distribution",barRows([{label:"Under 1k",min:0,max:1000},{label:"1k–5k",min:1000,max:5000},{label:"5k–20k",min:5000,max:20000},{label:"20k+",min:20000,max:Infinity}].map(band=>({...band,count:a.customers.filter(customer=>customer.revenue>=band.min&&customer.revenue<band.max).length})),item=>item.label,item=>item.count,value=>value))}
    ${card("Customer book · RFM, lifetime value and buying rhythm",table(["Customer","Orders","Lifetime spend","12-month value*","Recency / risk","Top product"],customerRows))}
    <p class="bl-caption">*CLV is an estimate based on the customer's observed purchase interval and average order; anonymous counter orders are kept separate rather than merged into a false customer.</p>
    <div class="bl-actions"><a href="/account/customers/loyalty" data-route="/account/customers/loyalty">Manage loyalty points</a><a href="/account/customers/loyalty" data-route="/account/customers/loyalty">Adjust points</a></div>`;
}

function renderMarketing(a, context) {
  const subscribers=context.newsletter||[];
  const channelRows=["web","pos"].map(channel=>{
    const sales=a.currentPaid.filter(sale=>sale.channel===channel);
    const label=channel==="web"?"Owned storefront":"Owned counter / POS";
    return `<tr><td>${label}</td><td>${money(sum(sales,sale=>sale.total),a.currency)}</td><td>${sales.length}</td><td>${sum(sales,sale=>sum(sale.items,item=>item.quantity))}</td><td>${money(sales.length?sum(sales,sale=>sale.total)/sales.length:0,a.currency)}</td></tr>`;
  });
  const categoryChannels=new Map();
  a.currentPaid.forEach(sale=>sale.items.forEach(item=>{
    const name=item.category||"Uncategorized", value=categoryChannels.get(name)||{category:name,web:0,pos:0};
    value[sale.channel]+=item.lineTotal;categoryChannels.set(name,value);
  }));
  return `<div class="bl-kpis">${metric("Unique storefront visitors",a.webVisitors)}${metric("Product viewers",a.productVisitors)}${metric("Checkout visitors",a.checkoutVisitors)}${metric("Newsletter subscribers",subscribers.length)}</div>
    ${card("Conversion funnel · unique browser IDs",barRows([{label:"Visitors",value:a.webVisitors},{label:"Product pages",value:a.productVisitors},{label:"Reached checkout",value:a.checkoutVisitors},{label:"Orders placed",value:a.kpis.webOrders},{label:"Paid",value:a.currentPaid.filter(sale=>sale.channel==="web").length}],item=>item.label,item=>item.value,value=>`${value} · ${safePercent(value,a.webVisitors).toFixed(1)}%`))}
    <div class="bl-two">${card("Traffic sources",barRows(a.sources,item=>item[0],item=>item[1],value=>`${value} visits`))}${card("Devices",barRows(a.devices,item=>item[0],item=>item[1],value=>`${value} visits`))}</div>
    ${card("Owned sales-channel comparison",table(["Owned channel","Paid revenue","Orders","Units","Average order"],channelRows))}
    <div class="bl-two">${card("Fastest movers by owned channel",table(["Product","Storefront units","Counter units","Total units"],[...a.productStats].sort((x,y)=>y.units-x.units).slice(0,12).map(item=>`<tr><td>${$(item.name)}</td><td>${item.webUnits}</td><td>${item.posUnits}</td><td>${item.units}</td></tr>`)))}${card("Category sales by owned channel",table(["Category","Storefront revenue","Counter revenue"],[...categoryChannels.values()].sort((x,y)=>y.web+y.pos-x.web-x.pos).map(item=>`<tr><td>${$(item.category)}</td><td>${money(item.web,a.currency)}</td><td>${money(item.pos,a.currency)}</td></tr>`)))}</div>
    ${card("Shared stock capital by category · not attributable to a sales channel",table(["Category","Stock capital"],a.categoryCapital.map(item=>`<tr><td>${$(item.category)}</td><td>${money(item.capital,a.currency)}</td></tr>`)))}
    ${card("Most visited pages",table(["Path","Views"],a.pages.slice(0,15).map(([path,views])=>`<tr><td>${$(path)}</td><td>${views}</td></tr>`)))}
    ${card("Owned audience · newsletter subscribers",table(["Name","Email","Phone","Joined"],subscribers.map(item=>`<tr><td>${$(item.name)}</td><td>${$(item.email)}</td><td>${$(item.phone)}</td><td>${dateLabel(item.created_at)}</td></tr>`)))}
    ${card("Push notification broadcast",`<p>Broadcast delivery requires a configured push service and opted-in devices. This local store does not expose the Electron app's push endpoint, so no message is represented as sent here.</p><a href="/account/customers/newsletter" data-route="/account/customers/newsletter">Open newsletter management</a>`)}
    <p class="bl-caption">Storefront visits and device details are browser-local. No visitors or geographic information are invented or shared across devices.</p>`;
}

function renderFinance(a) {
  const expenses=a.expenses.filter(expense=>(localDate(expense.date)?.getTime()??0)>=a.start.getTime()&&(localDate(expense.date)?.getTime()??0)<=a.end.getTime());
  const grossRevenue=sum(a.currentPaid,sale=>sale.subtotal);
  const discount=sum(a.currentPaid,sale=>sale.discount);
  const refunds=sum(a.scoped.filter(sale=>sale.status==="refunded"),sale=>sale.total);
  const margin=a.kpis.revenue?a.grossProfit/a.kpis.revenue:0;
  const breakEven=margin>0?a.expenseTotal/margin:0;
  return `<div class="bl-kpis">${metric("Net revenue",money(a.kpis.revenue-refunds,a.currency),`${money(refunds,a.currency)} refunds`)}${metric("Gross profit",money(a.grossProfit,a.currency),`${a.kpis.margin.toFixed(1)}% estimated margin`)}${metric("Operating profit",money(a.netProfit,a.currency))}${metric("Daily recorded expenses",money(a.expenseTotal/a.days,a.currency),`${a.days} days`)}</div>
    ${card("From revenue to profit",table(["Profit and loss line","Amount"],[
      ["Gross revenue",money(grossRevenue,a.currency)],["Discounts",`−${money(discount,a.currency)}`],["Refunds",`−${money(refunds,a.currency)}`],["Net revenue",money(a.kpis.revenue-refunds,a.currency)],["Cost of goods (known costs)",`−${money(a.cogs,a.currency)}`],["Gross profit",money(a.grossProfit,a.currency)],["Operating expenses",`−${money(a.expenseTotal,a.currency)}`],["Operating profit",money(a.netProfit,a.currency)]
    ].map(([label,value])=>`<tr><td>${$(label)}</td><td>${value}</td></tr>`)))}
    <div class="bl-two">${card("Break-even",`<div class="bl-big-number">${breakEven?money(breakEven,a.currency):"Not measurable"}</div><p>Approximate revenue needed to cover current expenses at recorded gross margin.</p><div class="bl-rule">${row("Actual revenue",money(a.kpis.revenue,a.currency))}${row("Gap",money(Math.abs(a.kpis.revenue-breakEven),a.currency),a.kpis.revenue>=breakEven?"Above estimate":"Below estimate")}</div>`)}${card("Expense category breakdown",barRows(a.expenseCategories.map(([category,amount])=>({category,amount})),item=>item.category,item=>item.amount,value=>money(value,a.currency)))}</div>
    ${card("Finance trends · revenue, gross profit and recorded expenses",lineChart(a.series,["revenue","profit","expenses"],a.currency))}
    ${card("Expense ledger",table(["Date","Category","Description","Amount","Note"],expenses.map(item=>`<tr><td>${dateLabel(item.date)}</td><td>${$(item.category)}</td><td>${$(item.label)}</td><td>${money(item.amount,a.currency)}</td><td>${$(item.note||"")}</td></tr>`)))}
    <p class="bl-caption">Expense entries come from the POS register. Missing sale-time unit costs make profit and break-even optimistic; finance does not silently count unknown cost as a verified margin.</p>`;
}

function renderStores(a, snapshot, context) {
  const instances=snapshot.instances||[];
  const branches=context.remoteBranches||[];
  const branchRows=branches.map(branch=>{const sales=branch.snapshot?.sales||[];const paidSales=sales.filter(sale=>sale.paid||["paid","completed","confirmed"].includes(sale.status));const revenue=sum(paidSales,sale=>sale.collected??sale.total);return `<tr><td>${$(branch.store_name)}</td><td>${$(branch.store_id)}</td><td>${money(revenue,a.currency)}</td><td>${paidSales.length}</td><td>${dateLabel(branch.updated_at)}</td></tr>`;});
  return `<div class="bl-kpis">${metric("Registered tills",instances.length)}${metric("Synced branches",branches.length)}${metric("Group revenue · this register",money(a.kpis.revenue,a.currency))}${metric("Current register",$(instances[0]?.name||"Primary store"))}</div>
    ${card("Cloud branch sync",`<p>Explicitly upload this register's sales, expenses, product stock, visits and newsletter list to the tenant's private R2 archive. Refresh to see other registers already synced to this shop.</p><div class="bl-actions"><button type="button" data-business-sync>Sync this register to cloud</button><button type="button" data-business-branches>Refresh branches</button></div><p class="bl-sync-status" role="status" aria-live="polite"></p>`)}
    ${card("Synced register scorecard",table(["Register","Register ID","Revenue","Paid sales","Last sync"],branchRows))}
    ${card("Store / register scorecard",table(["Register","Mode","State","Revenue","Orders"],instances.map(instance=>{const sales=a.currentPaid.filter(sale=>sale.storeId===String(instance.id)||sale.storeName===instance.name);return `<tr><td>${$(instance.name)}</td><td>${$(instance.mode)}</td><td>${$(instance.status)}</td><td>${money(sum(sales,sale=>sale.total),a.currency)}</td><td>${sales.length}</td></tr>`;})))}
    ${card("Storefront sales by local register",table(["Register","Counter sales","Web sales","Total"],[...new Set(a.currentPaid.map(sale=>sale.storeName||"Primary store"))].map(name=>{const sales=a.currentPaid.filter(sale=>(sale.storeName||"Primary store")===name);return `<tr><td>${$(name)}</td><td>${money(sum(sales.filter(s=>s.channel==="pos"),s=>s.total),a.currency)}</td><td>${money(sum(sales.filter(s=>s.channel==="web"),s=>s.total),a.currency)}</td><td>${money(sum(sales,s=>s.total),a.currency)}</td></tr>`;})))}
    <p class="bl-caption">Cloud sync is manual and owner-authorized. Data is archived per tenant and register in R2; local records remain intact if sync is unavailable.</p>
    <div class="bl-actions"><a href="/pos/instances" data-route="/pos/instances">Manage POS registers</a></div>`;
}

function renderSettings(a, context) {
  const settings=context.settings||{};
  return `<div class="bl-kpis">${metric("Reporting currency",$(a.currency))}${metric("Current time range",$(a.filters.range))}${metric("Channel filter",$(a.filters.channel==="all"?"All channels":a.filters.channel))}${metric("Interval",$(a.filters.granularity))}</div>
    ${card("Business analysis preferences",`<form class="bl-settings-form" data-business-settings><label>Date range<select name="range"><option value="today" ${a.filters.range==="today"?"selected":""}>Today</option><option value="7d" ${a.filters.range==="7d"?"selected":""}>Last 7 days</option><option value="30d" ${a.filters.range==="30d"?"selected":""}>Last 30 days</option><option value="90d" ${a.filters.range==="90d"?"selected":""}>Last 90 days</option><option value="month" ${a.filters.range==="month"?"selected":""}>This month</option><option value="ytd" ${a.filters.range==="ytd"?"selected":""}>Year to date</option><option value="all" ${a.filters.range==="all"?"selected":""}>All recorded time</option><option value="custom" ${a.filters.range==="custom"?"selected":""}>Custom</option></select></label><label>Custom from<input type="date" name="from" value="${$(a.filters.from||"")}"></label><label>Custom to<input type="date" name="to" value="${$(a.filters.to||"")}"></label><label>Channel<select name="channel"><option value="all" ${a.filters.channel==="all"?"selected":""}>All</option><option value="web" ${a.filters.channel==="web"?"selected":""}>Storefront</option><option value="pos" ${a.filters.channel==="pos"?"selected":""}>Counter / POS</option></select></label><label>Category<select name="category"><option value="all">All categories</option>${a.categories.map(category=>{const name=category.name||category;return `<option value="${$(name)}" ${a.filters.category===name?"selected":""}>${$(name)}</option>`;}).join("")}</select></label><label>Chart interval<select name="granularity"><option value="day" ${a.filters.granularity==="day"?"selected":""}>Daily</option><option value="week" ${a.filters.granularity==="week"?"selected":""}>Weekly</option><option value="month" ${a.filters.granularity==="month"?"selected":""}>Monthly</option></select></label><button type="submit">Save and apply</button></form>`)}
    ${card("Register settings",`<div class="bl-rule">${row("POS currency",$(settings.currency||a.currency))}${row("Tax rate",`${Number(settings.taxRate)||0}%`)}${row("Active register",$(context.instances?.[0]?.name||"Primary store"))}</div><a href="/pos/settings" data-route="/pos/settings">Open register settings</a>`)}
    <p class="bl-caption">Preferences are saved locally for this app. They do not change products, orders, stock, accounts or POS settings.</p>`;
}

function renderHelp(a) {
  return `<div class="bl-help">${[
    ["Revenue", "Paid, non-refunded orders in the selected date window. Website and counter totals are separated where the source records allow."],
    ["Profit and costs", "Gross profit subtracts known unit costs from line revenue. Missing costs are not verified profit; recorded operating expenses come from POS."],
    ["Forecast", "A short projection is shown only after there is enough recorded history. It is a planning estimate, not a promise."],
    ["Customer metrics", "Customers are matched by saved email or phone. Anonymous counter tickets stay separate. Lifetime value and churn are estimates based on observed buying rhythm."],
    ["Inventory health", "Cover and reorder estimates combine current stock with observed sales velocity. They are suggestions and do not place supplier orders."],
    ["Storefront traffic", "Visits are recorded locally on the browser/device. They are not global web analytics or cross-device visitor counts."],
    ["Newsletter and push", "Subscriber records are local. Push broadcast delivery needs a configured service; this screen never reports local drafts as delivered."],
    ["Stores", "This app reads the active local POS register. It cannot claim to show other branches unless those records are synced into this installation."]
  ].map(([title,body])=>`<details><summary>${$(title)}</summary><p>${$(body)}</p></details>`).join("")}</div>${card("Data and privacy",`<p>Analysis is computed from existing local catalogue, sales, expenses, visits, and newsletter records. Changing filters only changes the view. It does not erase, migrate, or overwrite store data.</p>`)}`;
}

function renderCategoryInsights(a) {
  const categories=[...a.categoryStats.entries()].sort((x,y)=>y[1]-x[1]);
  return `<div class="bl-kpis">${metric("Categories with sales",categories.length)}${metric("Category revenue",money(sum(categories,item=>item[1]),a.currency))}${metric("Catalogue categories",a.categories.length)}</div>${card("Category performance",barRows(categories,item=>item[0],item=>item[1],value=>money(value,a.currency)))}${card("Category detail",table(["Category","Revenue","Share","Products"],categories.map(([name,value])=>`<tr><td>${$(name)}</td><td>${money(value,a.currency)}</td><td>${safePercent(value,a.kpis.revenue).toFixed(1)}%</td><td>${a.productStats.filter(item=>item.category===name).length}</td></tr>`)))}<div class="bl-actions"><a href="/store/categories" data-route="/store/categories">Manage Store categories</a></div>`;
}

function renderNewsletter(a, context) {
  const subscribers=context.newsletter||[];
  const growth=new Map();subscribers.forEach(item=>{const date=localDate(item.created_at);if(date){const key=`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}`;growth.set(key,(growth.get(key)||0)+1);}});
  let running=0;
  return `<div class="bl-kpis">${metric("Subscribers",subscribers.length)}${metric("Joined this period",subscribers.filter(item=>(localDate(item.created_at)?.getTime()||0)>=a.start.getTime()).length)}${metric("With a phone",subscribers.filter(item=>item.phone).length)}${metric("Push delivery","VAPID setup required","Email consent is separate")}</div>
    ${card("Device notifications",`<p>Visitors can opt in on this device. Broadcasts go only to devices that explicitly allow notifications.</p><div class="bl-actions"><button type="button" data-enable-notifications>Enable notifications on this device</button><button type="button" data-disable-notifications>Turn off notifications here</button></div><p class="bl-push-status" role="status" aria-live="polite"></p>`)}
    ${card("Send a push update",`<form class="bl-settings-form" data-business-broadcast><label>Title<input name="title" maxlength="80" required></label><label>Message<textarea name="body" maxlength="240" rows="3" required></textarea></label><label>Open path<input name="url" value="/" maxlength="300" required></label><button type="submit">Send to opted-in devices</button><p role="status" aria-live="polite"></p></form>`)}
    ${card("List growth",barRows([...growth.entries()].sort((x,y)=>x[0].localeCompare(y[0])).map(([month,count])=>({month,count,total:(running+=count)})),item=>item.month,item=>item.total,value=>`${value} total`))}
    ${card("Subscriber list",table(["Name","Email","Phone","Joined"],subscribers.map(item=>`<tr><td>${$(item.name)}</td><td>${$(item.email)}</td><td>${$(item.phone)}</td><td>${dateLabel(item.created_at)}</td></tr>`)))}
    ${card("Push notification privacy",`<p>Push permission is separate from newsletter email consent. Only explicitly opted-in devices receive broadcasts; expired endpoints are removed. Delivery requires VAPID keys configured on the Cloudflare Worker.</p>`)}`;
}

function renderMarketingAndNewsletter(a,context,path) { return path.endsWith("/newsletter") ? renderNewsletter(a,context) : renderMarketing(a,context); }

function render(a, path, snapshot, context) {
  const views={
    "/account/main-shop":()=>renderOverview(a),
    "/account/main-shop/insights":()=>renderInsights(a),
    "/store/revenue":()=>renderRevenue(a),
    "/store/channels":()=>renderChannels(a),
    "/store/sales":()=>renderTransactions(a),
    "/store/products":()=>renderProducts(a,snapshot),
    "/store/inventory":()=>renderInventory(a),
    "/store/categories":()=>renderCategoryInsights(a),
    "/account/customers":()=>renderCustomers(a,context),
    "/account/main-shop/marketing":()=>renderMarketingAndNewsletter(a,context,path),
    "/account/customers/newsletter":()=>renderNewsletter(a,context),
    "/account/main-shop/finance":()=>renderFinance(a),
    "/account/main-shop/stores":()=>renderStores(a,snapshot,context),
    "/account/main-shop/settings":()=>renderSettings(a,context),
    "/account/main-shop/help":()=>renderHelp(a)
  };
  return views[path]?.() || renderOverview(a);
}

window.BusinessLens = {
  mergeStorefrontOrders,
  render(snapshot, path, context = {}) {
    const raw = normalizeSnapshot(snapshot, context);
    let filters = { range:"all", channel:"all", category:"all", granularity:"day" };
    try { filters = { ...filters, ...JSON.parse(localStorage.getItem(filterStorageKey) || "{}") }; } catch {}
    const analysis = analyse(raw, filters);
    return render(analysis, path, snapshot, { ...context, filters });
  },
  readFilters() {
    try { return JSON.parse(localStorage.getItem(filterStorageKey) || "{}"); } catch { return {}; }
  },
  saveFilters(filters) {
    localStorage.setItem(filterStorageKey, JSON.stringify(filters));
  }
};
