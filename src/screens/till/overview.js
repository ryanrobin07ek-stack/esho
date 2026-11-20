// Overview screen: summary, revenue, profit, products, stock, payments and reports tabs.
import { isReversedSale } from '../../revenue-definition.js';
import { escapeHtml, fromCents, localDateKey, money } from '../../till/format.js';

export function createOverviewScreen({
  state, card, renderRevenueChart, metric, renderProfitChart
}) {
  function renderOverview(params = new URLSearchParams()) {
    const { sales, products, expenses, payments, settings } = state;
    const period = ['today', '7d', '30d', '90d', 'all'].includes(params.get('range')) ? params.get('range') : '30d';
    const requestedTab = params.get('tab') === 'Insights' ? 'Reports' : params.get('tab');
    const tab = ['Summary', 'Revenue', 'Profit', 'Products', 'Stock', 'Payments', 'Reports'].includes(requestedTab)
      ? requestedTab : 'Summary';
    const firstDate = new Date();
    firstDate.setHours(0, 0, 0, 0);
    if (period === '7d') firstDate.setDate(firstDate.getDate() - 6);
    if (period === '30d') firstDate.setDate(firstDate.getDate() - 29);
    if (period === '90d') firstDate.setDate(firstDate.getDate() - 89);
    const fromDate = period === 'all' ? '' : `${firstDate.getFullYear()}-${String(firstDate.getMonth() + 1).padStart(2, '0')}-${String(firstDate.getDate()).padStart(2, '0')}`;
    const periodDays = { today: 1, '7d': 7, '30d': 30, '90d': 90 }[period];
    const previousStart = periodDays ? new Date(firstDate) : null;
    if (previousStart) previousStart.setDate(previousStart.getDate() - periodDays);
    const previousStartKey = previousStart
      ? `${previousStart.getFullYear()}-${String(previousStart.getMonth() + 1).padStart(2, '0')}-${String(previousStart.getDate()).padStart(2, '0')}`
      : '';
    const inRange = (date) => !fromDate || localDateKey(date) >= fromDate;
    const selectedSales = sales.filter((sale) => sale.currency === settings.currency
      && inRange(sale.created_at) && !isReversedSale(sale));
    const paidSales = selectedSales.filter((sale) => sale.paid);
    const recordedSales = selectedSales;
    const recordedSalesTotal = selectedSales.reduce((sum, sale) => sum + sale.total, 0);
    const selectedExpenses = expenses.filter((expense) => expense.currency === settings.currency && inRange(expense.expense_date));
    const selectedPayments = payments.filter((payment) => payment.currency === settings.currency && inRange(payment.created_at));
    const paymentRevenue = selectedPayments.reduce((sum, payment) => sum + fromCents(payment.amount_cents), 0);
    const revenue = recordedSales.reduce((sum, sale) => sum + (sale.netSales ?? sale.subtotal), 0);
    const taxCollected = recordedSales.reduce((sum, sale) => sum + sale.tax, 0);
    const grossReceipts = recordedSales.reduce((sum, sale) => sum + sale.total, 0);
    const currentMonth = new Date();
    const monthStart = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
    const monthStartKey = `${monthStart.getFullYear()}-${String(monthStart.getMonth() + 1).padStart(2, '0')}-01`;
    const nextMonthStart = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1);
    const monthEndDay = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).getDate();
    const monthRevenue = sales.filter((sale) => sale.currency === settings.currency
      && localDateKey(sale.created_at) >= monthStartKey
      && localDateKey(sale.created_at) < `${nextMonthStart.getFullYear()}-${String(nextMonthStart.getMonth() + 1).padStart(2, '0')}-01`)
      .reduce((sum, sale) => sum + (sale.netSales ?? sale.subtotal), 0);
    const monthlyGoal = settings.monthlyRevenueGoal == null || settings.monthlyRevenueGoalCurrency !== settings.currency
      ? null : fromCents(settings.monthlyRevenueGoal);
    const staleGoalCurrency = monthlyGoal === null && settings.monthlyRevenueGoal != null
      ? settings.monthlyRevenueGoalCurrency : null;
    const monthProgress = monthlyGoal ? monthRevenue / monthlyGoal * 100 : null;
    const elapsedMonthDays = currentMonth.getDate();
    const requiredDailyRevenue = monthlyGoal ? Math.max(0, monthlyGoal - monthRevenue) / Math.max(1, monthEndDay - elapsedMonthDays) : null;
    const monthRunRate = monthRevenue / Math.max(1, elapsedMonthDays) * monthEndDay;
    const cogs = recordedSales.reduce((sum, sale) => sum + sale.items.reduce((lineSum, item) =>
      lineSum + (item.historicalUnitCost == null ? 0 : item.historicalUnitCost * item.quantity), 0), 0);
    const costCoverageUnits = recordedSales.reduce((sum, sale) => sum + sale.items.reduce((lineSum, item) =>
      lineSum + (item.historicalUnitCost == null ? 0 : item.quantity), 0), 0);
    const totalSoldUnits = recordedSales.reduce((sum, sale) => sum + sale.items.reduce((lineSum, item) => lineSum + item.quantity, 0), 0);
    const costCoverage = totalSoldUnits ? costCoverageUnits / totalSoldUnits * 100 : 0;
    const operatingExpenses = selectedExpenses.reduce((sum, expense) => sum + fromCents(expense.amount_cents), 0);
    const productSales = new Map();
    recordedSales.forEach((sale) => sale.items.forEach((item) => {
      const current = productSales.get(item.productId) || { id: item.productId, name: item.name, units: 0, revenue: 0, cost: 0, knownCostUnits: 0 };
      current.units += item.quantity;
      current.revenue += item.quantity * item.unitPrice;
      if (item.historicalUnitCost != null) {
        current.cost += item.historicalUnitCost * item.quantity;
        current.knownCostUnits += item.quantity;
      }
      productSales.set(item.productId, current);
    }));
    const productById = new Map(products.map((product) => [product.id, product]));
    const categories = new Map();
    const basketPairs = new Map();
    recordedSales.forEach((sale) => {
      const productIds = [...new Set(sale.items.map((item) => Number(item.productId)).filter(Boolean))].sort((a, b) => a - b);
      for (let index = 0; index < productIds.length; index += 1) {
        for (let next = index + 1; next < productIds.length; next += 1) {
          const first = productIds[index];
          const second = productIds[next];
          const key = `${first}:${second}`;
          const pair = basketPairs.get(key) || { first: productById.get(first)?.name || sale.items.find((item) => item.productId === first)?.name || 'Product', second: productById.get(second)?.name || sale.items.find((item) => item.productId === second)?.name || 'Product', count: 0 };
          pair.count += 1;
          basketPairs.set(key, pair);
        }
      }
      sale.items.forEach((item) => {
        const category = productById.get(Number(item.productId))?.categoryName || 'Uncategorized';
        const current = categories.get(category) || { name: category, units: 0, revenue: 0, cost: 0, knownCostUnits: 0, orders: new Set() };
        current.units += item.quantity;
        current.revenue += item.quantity * item.unitPrice;
        if (item.historicalUnitCost != null) {
          current.cost += item.historicalUnitCost * item.quantity;
          current.knownCostUnits += item.quantity;
        }
        current.orders.add(sale.id);
        categories.set(category, current);
      });
    });
    const categoryRows = [...categories.values()].sort((a, b) => b.revenue - a.revenue);
    const totalCategoryRevenue = categoryRows.reduce((sum, category) => sum + category.revenue, 0);
    const frequentPairs = [...basketPairs.values()].sort((a, b) => b.count - a.count).slice(0, 5);
    const previousSales = periodDays ? sales.filter((sale) => sale.currency === settings.currency && !isReversedSale(sale)
      && localDateKey(sale.created_at) >= previousStartKey && localDateKey(sale.created_at) < fromDate) : [];
    const previousCategoryRevenue = new Map();
    previousSales.forEach((sale) => sale.items.forEach((item) => {
      const category = productById.get(Number(item.productId))?.categoryName || 'Uncategorized';
      previousCategoryRevenue.set(category, (previousCategoryRevenue.get(category) || 0) + item.quantity * item.unitPrice);
    }));
    const categoryChanges = categoryRows.map((category) => {
      const previous = previousCategoryRevenue.get(category.name) || 0;
      return { ...category, previous, change: previous ? (category.revenue - previous) / previous * 100 : null,
        share: totalCategoryRevenue ? category.revenue / totalCategoryRevenue * 100 : 0,
        margin: category.revenue && category.knownCostUnits === category.units
          ? (category.revenue - category.cost) / category.revenue * 100 : null };
    });
    const byMethod = {};
    selectedPayments.forEach((payment) => {
      const method = payment.method || 'Not recorded';
      byMethod[method] = (byMethod[method] || 0) + fromCents(payment.amount_cents);
    });
    const lowStock = products.filter((product) => product.active && product.stock !== null
      && product.stock > 0 && product.stock <= product.lowStockThreshold);
    const outOfStock = products.filter((product) => product.active && product.stock === 0);
    const now = new Date();
    const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const overdueCredit = sales.filter((sale) => !sale.paid && sale.currency === settings.currency
      && sale.due_date && sale.due_date < todayKey);
    const daily = {};
    recordedSales.forEach((sale) => {
      const date = new Date(sale.created_at);
      const day = Number.isFinite(date.getTime())
        ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
        : localDateKey(sale.created_at);
      daily[day] = (daily[day] || 0) + (sale.netSales ?? sale.subtotal);
    });
    const previousPayments = periodDays ? payments.filter((payment) => payment.currency === settings.currency
      && localDateKey(payment.created_at) >= previousStartKey
      && localDateKey(payment.created_at) < fromDate) : [];
    const previousExpenses = periodDays ? expenses.filter((expense) => expense.currency === settings.currency
      && expense.expense_date >= previousStartKey && expense.expense_date < fromDate) : [];
    const previousRevenue = previousSales.reduce((sum, sale) => sum + (sale.netSales ?? sale.subtotal), 0);
    const previousPaymentRevenue = previousPayments.reduce((sum, payment) => sum + fromCents(payment.amount_cents), 0);
    const previousExpenseTotal = previousExpenses.reduce((sum, expense) => sum + fromCents(expense.amount_cents), 0);
    const previousByMethod = {};
    previousPayments.forEach((payment) => {
      const method = payment.method || 'Not recorded';
      previousByMethod[method] = (previousByMethod[method] || 0) + fromCents(payment.amount_cents);
    });
    const changeLabel = (current, previous) => !periodDays
      ? 'All-time totals'
      : previous > 0 ? `${((current - previous) / previous * 100).toFixed(0)}% vs prior period`
        : current > 0 ? 'New activity in this period' : 'No change';
    const weekdayTotals = Array.from({ length: 7 }, () => 0);
    const weekdayCounts = Array.from({ length: 7 }, () => 0);
    const hourTotals = Array.from({ length: 24 }, () => 0);
    const hourCounts = Array.from({ length: 24 }, () => 0);
    recordedSales.forEach((sale) => {
      const date = new Date(sale.created_at);
      if (!Number.isFinite(date.getTime())) return;
      const amount = (sale.netSales ?? sale.subtotal);
      weekdayTotals[date.getDay()] += amount;
      hourTotals[date.getHours()] += amount;
      weekdayCounts[date.getDay()] += 1;
      hourCounts[date.getHours()] += 1;
    });
    const weekdayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const busiestWeekday = weekdayTotals.indexOf(Math.max(...weekdayTotals));
    const busiestHour = hourTotals.indexOf(Math.max(...hourTotals));
    const recentDate = new Date();
    recentDate.setDate(recentDate.getDate() - 59);
    const recentDateKey = `${recentDate.getFullYear()}-${String(recentDate.getMonth() + 1).padStart(2, '0')}-${String(recentDate.getDate()).padStart(2, '0')}`;
    const recentMonth = new Date();
    recentMonth.setDate(recentMonth.getDate() - 29);
    const recentMonthKey = `${recentMonth.getFullYear()}-${String(recentMonth.getMonth() + 1).padStart(2, '0')}-${String(recentMonth.getDate()).padStart(2, '0')}`;
    const recentProductUnits = new Map();
    sales.filter((sale) => sale.currency === settings.currency && localDateKey(sale.created_at) >= recentMonthKey)
      .forEach((sale) => sale.items.forEach((item) =>
        recentProductUnits.set(item.productId, (recentProductUnits.get(item.productId) || 0) + item.quantity)));
    const recentlySoldProductIds = new Set(sales.filter((sale) => sale.currency === settings.currency
      && localDateKey(sale.created_at) >= recentDateKey).flatMap((sale) => sale.items.map((item) => item.productId)));
    const dormantStock = products.filter((product) => product.stock > 0 && !recentlySoldProductIds.has(product.id));
    const restockSuggestions = lowStock.map((product) => {
      const monthlyUnits = recentProductUnits.get(product.id) || 0;
      const dailyVelocity = monthlyUnits / 30;
      const targetUnits = dailyVelocity ? Math.ceil(dailyVelocity * 14) : 0;
      return { ...product, monthlyUnits, dailyVelocity, daysCover: dailyVelocity ? product.stock / dailyVelocity : null,
        suggestedUnits: Math.max(0, targetUnits - (product.stock || 0)) };
    });
    const stockMetrics = products.map((product) => {
      const monthlyUnits = recentProductUnits.get(product.id) || 0;
      const dailyVelocity = monthlyUnits / 30;
      return { ...product, monthlyUnits, daysCover: product.stock === null || !dailyVelocity ? null : product.stock / dailyVelocity,
        costValue: product.stock === null || product.buyingPrice == null ? null : product.stock * product.buyingPrice,
        retailValue: product.stock === null ? null : product.stock * product.price };
    });
    const inventoryCostValue = products.reduce((sum, product) =>
      sum + (product.stock === null || product.buyingPrice == null ? 0 : product.stock * product.buyingPrice), 0);
    const inventoryRetailValue = products.reduce((sum, product) =>
      sum + (product.stock === null ? 0 : product.stock * product.price), 0);
    const dormantStockValue = dormantStock.reduce((sum, product) =>
      sum + (product.buyingPrice == null ? 0 : product.stock * product.buyingPrice), 0);
    const expensesByCategory = {};
    selectedExpenses.forEach((expense) => {
      expensesByCategory[expense.category] = (expensesByCategory[expense.category] || 0) + fromCents(expense.amount_cents);
    });
    const customersByPhone = new Map();
    sales.filter((sale) => sale.currency === settings.currency && sale.customer_phone && sale.customer_name)
      .forEach((sale) => {
        const phone = String(sale.customer_phone).replace(/\D/g, '');
        if (!phone) return;
        const customer = customersByPhone.get(phone) || { name: sale.customer_name, orders: 0, spend: 0, firstSale: '', lastSale: '' };
        customer.orders += 1;
        customer.spend += (sale.netSales ?? sale.subtotal);
        customer.firstSale = !customer.firstSale || sale.created_at < customer.firstSale ? sale.created_at : customer.firstSale;
        customer.lastSale = sale.created_at > customer.lastSale ? sale.created_at : customer.lastSale;
        customersByPhone.set(phone, customer);
      });
    const customers = [...customersByPhone.values()].sort((a, b) => b.spend - a.spend);
    const repeatCustomers = customers.filter((customer) => customer.orders > 1);
    const inactiveCustomers = customers.filter((customer) => localDateKey(customer.lastSale) < recentDateKey);
    const oneTimeCustomers = customers.filter((customer) => customer.orders === 1);
    const loyalCustomers = customers.filter((customer) => customer.orders >= 3);
    const lapsedRepeatCustomers = customers.filter((customer) => customer.orders > 1
      && localDateKey(customer.lastSale) < recentDateKey);
    const customerRevenue = customers.reduce((sum, customer) => sum + customer.spend, 0);
    const customerConcentration = customerRevenue && customers.length
      ? customers.slice(0, Math.max(1, Math.ceil(customers.length * 0.2))).reduce((sum, customer) => sum + customer.spend, 0) / customerRevenue * 100 : 0;
    const customerRepeatRate = customers.length ? repeatCustomers.length / customers.length * 100 : 0;
    const newCustomersInRange = customers.filter((customer) => inRange(customer.firstSale));
    const repeatBuyersInRange = newCustomersInRange.filter((customer) => customer.orders > 1);
    const recentDailyValues = Array.from({ length: 7 }, (_, offset) => {
      const date = new Date();
      date.setDate(date.getDate() - (6 - offset));
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      return daily[key] || 0;
    });
    const paceEstimate = recentDailyValues.filter((amount) => amount > 0).length >= 4
      ? recentDailyValues.reduce((sum, amount) => sum + amount, 0) : null;
    const periods = [['today', 'Today'], ['7d', '7 days'], ['30d', '30 days'], ['90d', '90 days'], ['all', 'All time']];
    const routeFor = (nextTab, nextPeriod = period) => `/pos/overview?tab=${encodeURIComponent(nextTab)}&range=${encodeURIComponent(nextPeriod)}`;
    const rangeLinks = periods.map(([value, label]) => `<a class="pos-range ${value === period ? 'is-active' : ''}" href="${routeFor(tab, value)}" data-route="${routeFor(tab, value)}">${label}</a>`).join('');
    const revenueSeries = Object.entries(daily).sort(([first], [second]) => first.localeCompare(second));
    const revenueTable = [...revenueSeries].reverse()
      .map(([date, amount]) => `<tr><td>${escapeHtml(date)}</td><td>${money(amount, settings.currency)}</td></tr>`).join('');
    const operatingProfitByDate = {};
    recordedSales.forEach((sale) => {
      const key = localDateKey(sale.created_at);
      operatingProfitByDate[key] = (operatingProfitByDate[key] || 0) + (sale.netSales ?? sale.subtotal) - sale.items.reduce((sum, item) =>
        sum + (item.historicalUnitCost == null ? 0 : item.historicalUnitCost * item.quantity), 0);
    });
    selectedExpenses.forEach((expense) => {
      operatingProfitByDate[expense.expense_date] = (operatingProfitByDate[expense.expense_date] || 0) - fromCents(expense.amount_cents);
    });
    const operatingProfitSeries = Object.entries(operatingProfitByDate).sort(([first], [second]) => first.localeCompare(second)).slice(-14);
    const rankedProducts = [...productSales.values()].sort((first, second) => second.revenue - first.revenue);
    const rankedEarners = rankedProducts.filter((item) => item.units > 0 && item.knownCostUnits === item.units)
      .sort((first, second) => (second.revenue - second.cost) - (first.revenue - first.cost));
    const productRevenue = rankedProducts.reduce((sum, item) => sum + item.revenue, 0);
    let cumulativeProductRevenue = 0;
    const productContribution = rankedProducts.map((item) => {
      const share = productRevenue ? item.revenue / productRevenue * 100 : 0;
      cumulativeProductRevenue += share;
      return { ...item, share, pareto: cumulativeProductRevenue - share < 80 ? 'A' : cumulativeProductRevenue - share < 95 ? 'B' : 'C' };
    });
    const topProductRows = productContribution.slice(0, 5).map((item, index) =>
      `<div class="pos-category-row"><strong>${index + 1}. ${escapeHtml(item.name)}<small>${item.units} units · ${item.share.toFixed(0)}% item revenue · ${item.knownCostUnits === item.units && item.revenue > 0 ? `${((item.revenue - item.cost) / item.revenue * 100).toFixed(0)}% known-cost margin` : `${item.knownCostUnits} of ${item.units} units costed`} · ${item.pareto} group</small></strong><b>${money(item.revenue, settings.currency)}</b></div>`).join('');
    const costHistory = new Map();
    sales.filter((sale) => sale.currency === settings.currency).forEach((sale) => sale.items.forEach((item) => {
      if (item.historicalUnitCost == null) return;
      const history = costHistory.get(item.productId) || { name: item.name, entries: [] };
      history.entries.push({ date: sale.created_at, cost: item.historicalUnitCost });
      costHistory.set(item.productId, history);
    }));
    const costIncreases = [...costHistory.values()].flatMap((item) => {
      const entries = item.entries.sort((a, b) => a.date.localeCompare(b.date));
      if (entries.length < 2) return [];
      const prior = entries.slice(0, -1).reduce((sum, entry) => sum + entry.cost, 0) / (entries.length - 1);
      const latest = entries[entries.length - 1].cost;
      return prior > 0 && latest > prior * 1.02 ? [{ name: item.name, change: (latest / prior - 1) * 100, latest }] : [];
    }).sort((a, b) => b.change - a.change);
    const belowCostProducts = rankedProducts.filter((item) => item.knownCostUnits === item.units && item.revenue > 0 && item.cost > item.revenue);
    const lowMarginProducts = rankedProducts.filter((item) => item.units >= 3 && item.knownCostUnits === item.units
      && item.revenue > 0 && (item.revenue - item.cost) / item.revenue < 0.1);
    const medianValue = (values) => {
      if (!values.length) return 0;
      const sorted = [...values].sort((first, second) => first - second);
      const middle = Math.floor(sorted.length / 2);
      return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
    };
    const receiptValues = recordedSales.map((sale) => sale.total);
    const receiptMedian = medianValue(receiptValues);
    const receiptMad = medianValue(receiptValues.map((amount) => Math.abs(amount - receiptMedian)));
    const largeReceiptThreshold = Math.max(receiptMedian * 2.5, receiptMedian + receiptMad * 3);
    const largeReceipts = recordedSales.length >= 10 && receiptMedian > 0
      ? [...recordedSales].filter((sale) => sale.total >= largeReceiptThreshold).sort((a, b) => b.total - a.total).slice(0, 3)
      : [];
    const timePatternDays = new Set(recordedSales.map((sale) => localDateKey(sale.created_at))).size;
    const hasTimePatterns = recordedSales.length >= 7 && timePatternDays >= 3;
    const breakEvenRevenue = revenue > cogs && operatingExpenses > 0 && costCoverage >= 99.999
      ? operatingExpenses / ((revenue - cogs) / revenue) : null;
    const cashSaleValues = paidSales.filter((sale) => sale.payment_method === 'Cash').map((sale) => sale.total);
    const medianCashSale = medianValue(cashSaleValues);
    const largeCashSales = cashSaleValues.length >= 10 && medianCashSale > 0
      ? paidSales.filter((sale) => sale.payment_method === 'Cash' && sale.total >= medianCashSale * 3)
        .sort((a, b) => b.total - a.total).slice(0, 5) : [];
    const overnightSales = recordedSales.filter((sale) => {
      const date = new Date(sale.created_at);
      return Number.isFinite(date.getTime()) && date.getHours() >= 0 && date.getHours() < 5;
    });
    const monthSegments = (() => {
      const datedSales = sales.filter((sale) => sale.currency === settings.currency)
        .map((sale) => ({ sale, date: new Date(sale.created_at) }))
        .filter((item) => Number.isFinite(item.date.getTime())
          && (item.date.getFullYear() < currentMonth.getFullYear()
            || (item.date.getFullYear() === currentMonth.getFullYear() && item.date.getMonth() < currentMonth.getMonth())));
      const observedMonths = new Set(datedSales.map(({ date }) => `${date.getFullYear()}-${date.getMonth()}`));
      if (observedMonths.size < 3 || datedSales.length < 30) return [];
      const segments = [
        { label: 'days 1–7', matches: (day) => day <= 7 },
        { label: 'days 8–14', matches: (day) => day >= 8 && day <= 14 },
        { label: 'days 15–21', matches: (day) => day >= 15 && day <= 21 },
        { label: 'month end', matches: (day) => day >= 22 }
      ];
      return segments.map((segment) => {
        const matches = datedSales.filter(({ date }) => segment.matches(date.getDate()));
        const activeMonths = new Set(matches.map(({ date }) => `${date.getFullYear()}-${date.getMonth()}`)).size;
          const observedMonthKeys = observedMonths;
        const calendarDays = [...observedMonthKeys].reduce((total, key) => {
          const [year, month] = key.split('-').map(Number);
          const lastDay = new Date(year, month + 1, 0).getDate();
          const segmentDays = segment.label === 'days 1–7' || segment.label === 'days 8–14' || segment.label === 'days 15–21'
            ? 7 : lastDay - 21;
          return total + segmentDays;
        }, 0);
        const amount = matches.reduce((sum, { sale }) => sum + (sale.netSales ?? sale.subtotal), 0);
        return { label: segment.label, amount, days: calendarDays, activeMonths,
          averagePerCalendarDay: calendarDays ? amount / calendarDays : 0 };
      }).filter((segment) => segment.activeMonths >= 2);
    })();
    const weekdayDayCounts = Array.from({ length: 7 }, () => 0);
    const firstSaleTimestamp = sales.filter((sale) => sale.currency === settings.currency).reduce((earliest, sale) => {
      const timestamp = Date.parse(sale.created_at);
      return Number.isFinite(timestamp) ? Math.min(earliest, timestamp) : earliest;
    }, Number.POSITIVE_INFINITY);
    const observedStart = period === 'all' && Number.isFinite(firstSaleTimestamp)
      ? new Date(firstSaleTimestamp) : firstDate;
    const dayCursor = Number.isFinite(observedStart.getTime()) ? new Date(observedStart) : new Date();
    dayCursor.setHours(0, 0, 0, 0);
    const observationEnd = new Date();
    observationEnd.setHours(0, 0, 0, 0);
    while (dayCursor <= observationEnd) {
      weekdayDayCounts[dayCursor.getDay()] += 1;
      dayCursor.setDate(dayCursor.getDate() + 1);
    }
    const weekdayDailyAverage = weekdayTotals.map((amount, day) => weekdayDayCounts[day] ? amount / weekdayDayCounts[day] : 0);
    const weekdayAverageRows = weekdayNames.map((name, day) => ({
      name, total: weekdayTotals[day], average: weekdayDailyAverage[day], count: weekdayCounts[day], dates: weekdayDayCounts[day]
    })).filter((day) => day.dates > 0).sort((a, b) => b.average - a.average);
    const validSalesDates = sales.map((sale) => new Date(sale.created_at)).filter((date) => Number.isFinite(date.getTime()));
    const dataQuality = {
      recordedSalesWithoutCustomer: recordedSales.filter((sale) => !sale.customer_phone || !sale.customer_name).length,
      recordedSalesWithoutLines: recordedSales.filter((sale) => !sale.items.length).length,
      recordedSalesWithoutCosts: recordedSales.filter((sale) => sale.items.some((item) => item.historicalUnitCost == null)).length,
      invalidDates: sales.length - validSalesDates.length
    };
    const alertCards = [];
    if (outOfStock.length) alertCards.push({
      id: `stock-out-${outOfStock.map((product) => product.id).sort((a, b) => a - b).join('-')}`,
      severity: 'critical', title: `${outOfStock.length} product${outOfStock.length === 1 ? '' : 's'} out of stock`,
      detail: `${outOfStock.slice(0, 4).map((product) => escapeHtml(product.name)).join(', ')}. Check inventory and recent demand before replenishing.`,
      href: '/pos/inventory'
    });
    if (belowCostProducts.length) alertCards.push({
      id: `below-cost-${belowCostProducts.map((product) => product.id).sort((a, b) => a - b).join('-')}`,
      severity: 'critical', title: `${belowCostProducts.length} product${belowCostProducts.length === 1 ? '' : 's'} have recorded costs above sales`,
      detail: `${belowCostProducts.slice(0, 4).map((product) => escapeHtml(product.name)).join(', ')}. Check the saved cost and realized prices; missing cost history can distort this signal.`,
      href: '/pos/overview?tab=Products'
    });
    if (overdueCredit.length) alertCards.push({
      id: `overdue-credit-${overdueCredit.map((sale) => sale.id).sort((a, b) => a - b).join('-')}`,
      severity: 'warning', title: `${overdueCredit.length} unpaid sale${overdueCredit.length === 1 ? '' : 's'} past due`,
      detail: `Outstanding overdue balance: ${money(overdueCredit.reduce((sum, sale) => sum + sale.total - sale.amountPaid, 0), settings.currency)}.`,
      href: '/pos/sales'
    });
    if (largeCashSales.length) alertCards.push({
      id: `large-cash-${largeCashSales.map((sale) => sale.id).sort((a, b) => a - b).join('-')}`,
      severity: 'warning', title: `${largeCashSales.length} unusually large cash receipt${largeCashSales.length === 1 ? '' : 's'} to review`,
      detail: `At least 3× the median cash receipt (${money(medianCashSale, settings.currency)}). This is a review prompt, not a fraud finding.`,
      href: '/pos/sales'
    });
    if (largeReceipts.length) alertCards.push({
      id: `large-receipt-${largeReceipts.map((sale) => sale.id).sort((a, b) => a - b).join('-')}`,
      severity: 'warning', title: `${largeReceipts.length} receipt${largeReceipts.length === 1 ? '' : 's'} exceed the robust size threshold`,
      detail: `At least the greater of 2.5× the median receipt (${money(receiptMedian, settings.currency)}) or median + 3 MAD. This is a review prompt, not a fraud finding.`,
      href: '/pos/sales'
    });
    if (overnightSales.length >= 2 && recordedSales.length >= 10) alertCards.push({
      id: `overnight-sales-${monthStartKey}`,
      severity: 'warning', title: `${overnightSales.length} receipts created between midnight and 5am`,
      detail: 'Review the receipts if the store is normally closed at those times. Timestamps use the device clock and can be inaccurate.',
      href: '/pos/sales'
    });
    if (costIncreases.length) alertCards.push({
      id: `cost-increase-${costIncreases.map((item) => item.name).sort().join('|')}`,
      severity: 'warning', title: `${costIncreases.length} recorded product cost${costIncreases.length === 1 ? '' : 's'} increased`,
      detail: `${costIncreases.slice(0, 3).map((item) => `${escapeHtml(item.name)} +${item.change.toFixed(0)}%`).join(', ')}. Based on saved sale-time costs, not supplier invoices.`,
      href: '/pos/overview?tab=Products'
    });
    if (monthlyGoal && monthRunRate < monthlyGoal && elapsedMonthDays >= 7) alertCards.push({
      id: `monthly-goal-pacing-${currentMonth.getFullYear()}-${currentMonth.getMonth()}`,
      severity: 'neutral', title: 'Monthly revenue goal is behind the current pace',
      detail: `The straight-line run rate is ${money(monthRunRate, settings.currency)} for this month against ${money(monthlyGoal, settings.currency)}. This is a descriptive pace, not a forecast.`,
      href: '/pos/overview?tab=Insights'
    });
    const savedPreferences = settings.insightPreferences;
    const activeAlerts = alertCards.filter((item) => !savedPreferences.dismissed.includes(item.id)
      && !(Number(savedPreferences.snoozed[item.id]) > Date.now()))
      .sort((a, b) => ({ critical: 0, warning: 1, neutral: 2 }[a.severity] - { critical: 0, warning: 1, neutral: 2 }[b.severity]));
    const dismissedAlertCount = savedPreferences.dismissed.length;
    const monthlyBenchmarks = (() => {
      const totals = new Map();
      sales.filter((sale) => sale.currency === settings.currency).forEach((sale) => {
        const date = new Date(sale.created_at);
        if (!Number.isFinite(date.getTime()) || (date.getFullYear() === currentMonth.getFullYear() && date.getMonth() === currentMonth.getMonth())) return;
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        totals.set(key, (totals.get(key) || 0) + (sale.netSales ?? sale.subtotal));
      });
      return [...totals.entries()].sort((a, b) => b[1] - a[1]);
    })();
    const unpaidSales = selectedSales.filter((sale) => !sale.paid);
    const credit = unpaidSales.reduce((sum, sale) => sum + sale.total - sale.amountPaid, 0);
    const missingCosts = products.filter((product) => product.buyingPrice == null).length;
    let panel = '';
    if (tab === 'Summary') {
      panel = `<section class="pos-overview-card" aria-label="Business totals">
        <div class="pos-overview-metrics">
          ${overviewMetric('Sales recorded', money(recordedSalesTotal, settings.currency), `${selectedSales.length} receipts · includes unpaid sales`)}
          ${overviewMetric('Net sales', money(revenue, settings.currency), `Before tax, after discounts · ${recordedSales.length} recorded sales`)}
          ${overviewMetric('Profit', money(revenue - cogs, settings.currency), `Sale-time costs cover ${costCoverage.toFixed(0)}% of units`)}
          ${overviewMetric('Operating profit', money(revenue - cogs - operatingExpenses, settings.currency), `${money(operatingExpenses, settings.currency)} expenses · recorded costs only`)}
          ${overviewMetric('Credit', money(credit, settings.currency), 'All unpaid balances')}
        </div>
      </section>
      ${card(`<h3>Recent net sales</h3>${renderRevenueChart(revenueSeries, settings.currency)}`, 'pos-revenue-card')}
      ${card(`<h3>Period comparison</h3>
        <div class="pos-insight-row"><strong>Net sales · before tax</strong><span>${money(revenue, settings.currency)} · ${changeLabel(revenue, previousRevenue)}</span></div>
        <div class="pos-insight-row"><strong>Recorded expenses</strong><span>${money(operatingExpenses, settings.currency)} · ${changeLabel(operatingExpenses, previousExpenseTotal)}</span></div>`, 'pos-period-comparison-card')}
      ${card(`<h3>Top products</h3>${topProductRows || '<p class="pos-help">Product rankings appear after sales are recorded.</p>'}`)}
      ${paceEstimate === null ? '' : card(`<h3>Net sales pace estimate</h3><strong>${money(paceEstimate, settings.currency)}</strong><p class="pos-help">Estimated next 7 days from average daily net sales before tax over the last 7 days. A simple pace estimate, not a guarantee.</p>`)}
      ${card(`<h3>Quick insights</h3><div class="pos-insights">
        <p>${selectedSales.length ? `${selectedSales.length} sales recorded for this period.` : 'No sales recorded for this period.'}</p>
        <p>${lowStock.length ? `${lowStock.length} products need stock attention.` : 'No low-stock alerts.'}</p>
        <p>${missingCosts ? `${missingCosts} products have no unit cost, so profit may be understated.` : 'All products have a recorded unit cost.'}</p>
      </div>`)}
      ${monthlyGoal ? card(`<h3>Monthly net-sales goal</h3>
        <div class="pos-insight-row"><strong>${money(monthRevenue, settings.currency)} of ${money(monthlyGoal, settings.currency)}</strong><span>${Math.min(100, monthProgress).toFixed(0)}%</span></div>
        <div class="pos-goal-track" role="progressbar" aria-label="Monthly revenue goal progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.min(100, monthProgress).toFixed(0)}"><span style="width:${Math.min(100, monthProgress).toFixed(1)}%"></span></div>
        <p class="pos-help">${monthRevenue >= monthlyGoal ? 'Monthly target reached.' : `${money(requiredDailyRevenue, settings.currency)} per remaining day is needed to reach the goal; straight-line pace projects ${money(monthRunRate, settings.currency)}.`}</p>`) : ''}`;
    } else if (tab === 'Revenue') {
      panel = `<div class="pos-metrics">${metric('Net sales · before tax', money(revenue, settings.currency), `${recordedSales.length} recorded sales`)}
        ${metric('Payments received', money(paymentRevenue, settings.currency), `${selectedPayments.length} confirmed payments · includes tax`)}
        ${metric('Average recorded sale', money(recordedSales.length ? revenue / recordedSales.length : 0, settings.currency), 'Net subtotal per receipt')}</div>
        ${card(`<h3>Net sales by receipt date</h3>${renderRevenueChart(revenueSeries, settings.currency)}<div class="pos-table-wrap"><table class="pos-table"><thead><tr><th>Date</th><th>Net sales · before tax</th></tr></thead><tbody>${revenueTable || '<tr><td colspan="2">No sales recorded in this period.</td></tr>'}</tbody></table></div>`)}`;
    } else if (tab === 'Profit') {
      panel = `<div class="pos-metrics">${metric('Net sales · before tax', money(revenue, settings.currency), `${recordedSales.length} recorded sales`)}
        ${metric('Cost of goods', money(cogs, settings.currency), 'Historical unit costs')}
        ${metric('Gross profit', money(revenue - cogs, settings.currency), 'Net sales less cost of goods')}
        ${metric('Operating profit', money(revenue - cogs - operatingExpenses, settings.currency), 'After recorded expenses')}</div>
        ${card(`<h3>Profit and loss</h3>
          <div class="pos-total-line"><span>Net sales · before tax</span><b>${money(revenue, settings.currency)}</b></div>
          <div class="pos-total-line"><span>Tax on recorded sales</span><b>${money(taxCollected, settings.currency)}</b></div>
          <div class="pos-total-line"><span>Recorded receipt total · including tax</span><b>${money(grossReceipts, settings.currency)}</b></div>
          <div class="pos-total-line"><span>Payments received this period</span><b>${money(paymentRevenue, settings.currency)}</b></div>
          <div class="pos-total-line"><span>Recorded cost of goods</span><b>− ${money(cogs, settings.currency)}</b></div>
          <div class="pos-total-line"><strong>Gross profit</strong><b>${money(revenue - cogs, settings.currency)}</b></div>
          <div class="pos-total-line"><span>Recorded operating expenses</span><b>− ${money(operatingExpenses, settings.currency)}</b></div>
          <div class="pos-total-line"><strong>Operating profit</strong><b>${money(revenue - cogs - operatingExpenses, settings.currency)}</b></div>
          ${breakEvenRevenue === null ? `<p class="pos-help">${costCoverage < 99.999 ? `Break-even is withheld because saved sale-time costs cover only ${costCoverage.toFixed(0)}% of sold units.` : 'Break-even needs positive recorded sales, recorded product costs below sales, and expenses in this period.'}</p>` : `<p class="pos-help">Approximate sales needed to cover this period’s recorded expenses at the current gross margin: ${money(breakEvenRevenue, settings.currency)}. This does not separate fixed and variable costs.</p>`}
          <p class="pos-help">Sales revenue is the pre-tax subtotal of all recorded receipts by receipt-created date, whether paid or unpaid. Tax is shown separately, not treated as profit. Payments received follow payment dates and can include partial or cross-period settlements.</p>
          <p class="pos-help">${costCoverage < 99.999 ? `Only ${costCoverage.toFixed(0)}% of sold units have saved sale-time costs; missing costs make profit estimates too high.` : 'Profit uses saved sale-time unit costs and recorded POS expenses only.'}</p>`)
        }
        ${card(`<h3>Recorded operating-profit trend</h3>${renderProfitChart(operatingProfitSeries, settings.currency)}
          <p class="pos-help">Daily view uses pre-tax subtotals of recorded receipts by sale-created date, less saved line costs and expenses entered for that date. It may not match payment-date cash totals above.</p>`)}
        ${card(`<h3>Expenses</h3>${selectedExpenses.map((expense) => `<div class="pos-category-row"><strong>${escapeHtml(expense.label)}<small>${escapeHtml(expense.category)} · ${escapeHtml(expense.expense_date)}</small></strong><b>${money(fromCents(expense.amount_cents), expense.currency)}</b></div>`).join('') || '<p class="pos-help">No expenses in this period.</p>'}`)}`;
    } else if (tab === 'Products') {
      panel = card(`<h3>Product performance</h3><div class="pos-table-wrap"><table class="pos-table"><thead><tr><th>Product</th><th>Units</th><th>Revenue</th><th>Gross profit</th></tr></thead><tbody>
        ${rankedProducts.map((item) => `<tr><td>${escapeHtml(item.name)}</td><td>${item.units}</td><td>${money(item.revenue, settings.currency)}</td><td>${item.knownCostUnits === item.units ? money(item.revenue - item.cost, settings.currency) : 'Incomplete costs'}</td></tr>`).join('') || '<tr><td colspan="4">No product sales in this period.</td></tr>'}
        </tbody></table></div>`);
    } else if (tab === 'Stock') {
      panel = `${card(`<h3>Stock health</h3><div class="pos-metrics">${metric('Known stock cost', money(inventoryCostValue, settings.currency), 'Tracked stock with saved buying cost')}
          ${metric('Retail value', money(inventoryRetailValue, settings.currency), 'Tracked stock at current prices')}
          ${metric('No sale in 60 days', money(dormantStockValue, settings.currency), `${dormantStock.length} dormant stocked products`)}</div>
        <div class="pos-table-wrap"><table class="pos-table"><thead><tr><th>Product</th><th>On hand</th><th>30d units</th><th>Days cover</th><th>Cost value</th><th>Retail value</th></tr></thead><tbody>
        ${stockMetrics.map((product) => `<tr><td>${escapeHtml(product.name)}</td><td>${product.stock === null ? 'Untracked' : product.stock}</td><td>${product.monthlyUnits || '—'}</td>
          <td>${product.stock === null ? 'Untracked' : product.daysCover === null ? 'No recent pace' : product.daysCover.toFixed(0)}</td>
          <td>${product.costValue === null ? '—' : money(product.costValue, settings.currency)}</td>
          <td>${product.retailValue === null ? '—' : money(product.retailValue, settings.currency)}</td></tr>`).join('') || '<tr><td colspan="6">No inventory yet.</td></tr>'}
        </tbody></table></div>
        <p class="pos-help">Days cover is current stock divided by units sold per day during the last 30 days. It is a rough run rate and does not account for lead time or seasonality.</p>`)}`;
    } else if (tab === 'Payments') {
      panel = `<div class="pos-metrics">${metric('Payments received', money(paymentRevenue, settings.currency), `${selectedPayments.length} confirmed payments`)}
        ${metric('Outstanding credit', money(credit, settings.currency), `${unpaidSales.length} unpaid receipts`)}</div>
        ${card(`<h3>Payment method totals</h3>${Object.entries(byMethod).map(([method, amount]) => `<div class="pos-category-row"><strong>${escapeHtml(method)}</strong><b>${money(amount, settings.currency)}</b></div>`).join('') || '<p class="pos-help">No confirmed payments in this period.</p>'}`)}`;
    } else {
      const topProducts = productContribution.slice(0, 5);
      const expenseRows = Object.entries(expensesByCategory).sort((a, b) => b[1] - a[1]);
      const customerRows = customers.slice(0, 5);
      const topSeller = [...rankedProducts].sort((a, b) => b.units - a.units)[0];
      const topEarner = rankedEarners[0];
      const weekdayRows = weekdayNames.map((name, day) => ({ name, amount: weekdayTotals[day], count: weekdayCounts[day] }))
        .filter((day) => day.count).sort((a, b) => b.amount - a.amount);
      const busiestHourEntry = hourTotals.map((amount, hour) => ({ amount, hour, count: hourCounts[hour] }))
        .filter((entry) => entry.count).sort((a, b) => b.amount - a.amount)[0];
      panel = `<div class="pos-insights-dashboard">
        ${card(`<h3>Needs attention</h3>
          ${outOfStock.map((product) => `<div class="pos-insight-row"><div><strong>${escapeHtml(product.name)} is out of stock</strong><p>Review stock levels in Inventory.</p></div><a href="/pos/inventory" data-route="/pos/inventory" class="btn-secondary">Review</a></div>`).join('')}
          ${restockSuggestions.filter((product) => product.stock > 0).map((product) => `<div class="pos-insight-row"><div><strong>${escapeHtml(product.name)} · ${product.stock} left</strong><p>${product.monthlyUnits ? `Recent pace: ${product.monthlyUnits} units in 30 days · consider about ${product.suggestedUnits} more for 14-day cover.` : 'At or below the current 10-unit low-stock alert level; record sales to estimate restock pace.'}</p></div><a href="/pos/inventory" data-route="/pos/inventory" class="btn-secondary">Restock</a></div>`).join('')}
          ${overdueCredit.map((sale) => `<div class="pos-insight-row"><div><strong>Overdue ${escapeHtml(sale.receipt_number)}</strong><p>${escapeHtml(sale.customer_name || 'Customer')} · due ${escapeHtml(sale.due_date)} · ${money(sale.total - sale.amountPaid, sale.currency)} remaining</p></div><a href="/pos/sales?open=${sale.id}" data-route="/pos/sales?open=${sale.id}" class="btn-secondary">Review</a></div>`).join('')}
          ${missingCosts ? `<p class="pos-help">${missingCosts} products have no recorded unit cost; profit estimates may be understated.</p>` : ''}
          ${dormantStock.length ? `<p class="pos-help">${dormantStock.length} stocked products had no recorded sale in the last 60 days: ${dormantStock.slice(0, 4).map((product) => escapeHtml(product.name)).join(', ')}. Known buying-cost value tied in these items: ${money(dormantStockValue, settings.currency)}; products without a saved cost are excluded.</p>` : ''}
          ${!outOfStock.length && !lowStock.length && !overdueCredit.length && !missingCosts && !dormantStock.length ? '<p class="pos-help">No stock, overdue-credit, or product-cost alerts from the saved data.</p>' : ''}`)}
        ${card(`<h3>Sales trends</h3>
          <div class="pos-insight-row"><strong>Net sales before tax</strong><span>${money(revenue, settings.currency)} · ${changeLabel(revenue, previousRevenue)}</span></div>
          <div class="pos-insight-row"><strong>Sales created</strong><span>${selectedSales.length} in this period</span></div>
          <div class="pos-insight-row"><strong>Average recorded sale</strong><span>${money(recordedSales.length ? revenue / recordedSales.length : 0, settings.currency)}</span></div>
          <div class="pos-insight-row"><strong>Busiest day</strong><span>${hasTimePatterns ? weekdayNames[busiestWeekday] : 'Not enough sales history yet'}</span></div>
          <div class="pos-insight-row"><strong>Strongest recorded hour</strong><span>${hasTimePatterns ? `${String(busiestHour).padStart(2, '0')}:00` : 'Not enough sales history yet'}</span></div>
          ${paceEstimate === null ? '<p class="pos-help">Sales pace estimate needs recorded sales on at least four separate days.</p>' : `<p class="pos-help">At the recent pace, the next 7 days net-sales estimate is ${money(paceEstimate, settings.currency)} before tax. This is a simple estimate, not a guarantee.</p>`}`)}
        ${card(`<h3>Revenue rhythm</h3>
          ${weekdayAverageRows.length && recordedSales.length >= 14
            ? `<div class="pos-insight-row"><strong>Best average weekday</strong><span>${escapeHtml(weekdayAverageRows[0].name)} · ${money(weekdayAverageRows[0].average, settings.currency)}/calendar day</span></div>
              ${weekdayAverageRows.length > 1 ? `<div class="pos-insight-row"><strong>Slowest observed weekday</strong><span>${escapeHtml(weekdayAverageRows[weekdayAverageRows.length - 1].name)} · ${money(weekdayAverageRows[weekdayAverageRows.length - 1].average, settings.currency)}/calendar day</span></div>` : ''}
              <p class="pos-help">Weekday averages divide pre-tax net sales by every calendar occurrence in the selected range, including zero-sales days. Need at least 14 recorded sales for comparison.</p>`
            : '<p class="pos-help">Weekday patterns need at least 14 recorded sales in this period.</p>'}
          ${monthSegments.length ? (() => {
            const topSegment = [...monthSegments].sort((a, b) => b.averagePerCalendarDay - a.averagePerCalendarDay)[0];
            return `<div class="pos-insight-row"><strong>Strongest month segment</strong><span>${escapeHtml(topSegment.label)} · ${money(topSegment.averagePerCalendarDay, settings.currency)} per calendar day</span></div><p class="pos-help">Based on at least 30 recorded sales over three or more months; revenue is divided by observed calendar days in each segment. This is descriptive, not proof of a payday effect.</p>`;
          })() : '<p class="pos-help">Month-segment patterns need at least 30 recorded sales across 3 different months.</p>'}`)}
        ${card(`<h3>Product performance</h3>
          ${topProducts.map((item) => `<div class="pos-category-row"><strong>${escapeHtml(item.name)}<small>${item.units} units · ${item.share.toFixed(0)}% of sold-item revenue · ${item.knownCostUnits === item.units && item.revenue > 0 ? `${((item.revenue - item.cost) / item.revenue * 100).toFixed(0)}% fully costed margin` : `${item.knownCostUnits}/${item.units} units costed`} · ${item.pareto} contribution group</small></strong><b>${money(item.revenue, settings.currency)}</b></div>`).join('')
            || '<p class="pos-help">Not enough sales history to rank products.</p>'}
          <div class="pos-insight-row"><strong>Top seller</strong><span>${topSeller ? `${escapeHtml(topSeller.name)} · ${topSeller.units} units` : 'Not enough sales yet'}</span></div>
          <div class="pos-insight-row"><strong>Highest fully costed gross profit</strong><span>${topEarner ? `${escapeHtml(topEarner.name)} · ${money(topEarner.revenue - topEarner.cost, settings.currency)}` : 'No product has complete sale-time costs yet'}</span></div>
          ${belowCostProducts.map((item) => `<p class="pos-help">${escapeHtml(item.name)} has recorded costs above its sales revenue; review its price or saved costs.</p>`).join('')}
          ${lowMarginProducts.map((item) => {
            const averageCost = item.cost / item.units;
            const targetPrice = averageCost / 0.9;
            const currentPrice = item.revenue / item.units;
            return `<p class="pos-help">${escapeHtml(item.name)} has a ${((item.revenue - item.cost) / item.revenue * 100).toFixed(0)}% fully costed margin. Reaching a 10% gross margin would require about ${money(Math.max(0, targetPrice - currentPrice), settings.currency)} more per unit at its average recorded cost; check market pricing before changing it.</p>`;
          }).join('')}
          <p class="pos-help">Margins use saved sale-time unit costs; missing costs count as zero, so actual profit may be lower.</p>`)}
        ${card(`<h3>Category performance</h3>
          ${categoryChanges.map((category) => `<div class="pos-category-row"><strong>${escapeHtml(category.name)}<small>${category.units} units · ${category.share.toFixed(0)}% mix · ${category.margin === null ? `${category.knownCostUnits}/${category.units} units costed` : `${category.margin.toFixed(0)}% fully costed margin`} · ${category.orders.size} recorded sales${category.change === null ? '' : ` · ${category.change >= 0 ? '+' : ''}${category.change.toFixed(0)}% vs prior period`}</small></strong><b>${money(category.revenue, settings.currency)}</b></div>`).join('')
            || '<p class="pos-help">Category comparisons appear after recorded sales. Categories use each product’s current assignment.</p>'}
          ${categoryChanges.length && !categoryChanges.some((category) => category.previous > 0) ? '<p class="pos-help">A prior-period category comparison needs sales in both periods.</p>' : ''}`)}
        ${card(`<h3>Basket patterns</h3>
          ${frequentPairs.map((pair) => `<div class="pos-category-row"><strong>${escapeHtml(pair.first)} + ${escapeHtml(pair.second)}<small>Recorded together</small></strong><b>${pair.count} sales</b></div>`).join('')
            || '<p class="pos-help">No multi-product baskets recorded in this period yet.</p>'}
          <p class="pos-help">Pairs count recorded receipts containing both products; this is descriptive, not proof that one product caused the other sale.</p>`)}
        ${card(`<h3>Customers</h3>
          <div class="pos-insight-row"><strong>Identified customers</strong><span>${customers.length}</span></div>
          <div class="pos-insight-row"><strong>First known purchase in period</strong><span>${newCustomersInRange.length}</span></div>
          <div class="pos-insight-row"><strong>New-in-period customers with a later repeat</strong><span>${repeatBuyersInRange.length}</span></div>
          <div class="pos-insight-row"><strong>Repeat customers</strong><span>${repeatCustomers.length} · ${customerRepeatRate.toFixed(0)}% of identified</span></div>
          <div class="pos-insight-row"><strong>Single-purchase customers</strong><span>${oneTimeCustomers.length}</span></div>
          <div class="pos-insight-row"><strong>Loyal · 3+ purchases</strong><span>${loyalCustomers.length}</span></div>
          <div class="pos-insight-row"><strong>Lapsed repeat customers</strong><span>${lapsedRepeatCustomers.length} · no sale in 60+ days</span></div>
          <div class="pos-insight-row"><strong>Top 20% spend share</strong><span>${customerConcentration.toFixed(0)}% of identified-customer revenue</span></div>
          <div class="pos-insight-row"><strong>Identified-customer sales</strong><span>${money(customerRevenue, settings.currency)}</span></div>
          ${customerRows.map((customer) => `<div class="pos-category-row"><strong>${escapeHtml(customer.name)}<small>${customer.orders} recorded sales</small></strong><b>${money(customer.spend, settings.currency)}</b></div>`).join('')
            || '<p class="pos-help">Save customer name and phone at checkout to see repeat and top-customer patterns.</p>'}
          <p class="pos-help">${inactiveCustomers.length} identified customers have no sale recorded in 60+ days.</p>
          <p class="pos-help">Customers are matched using their saved phone number and recorded receipts.</p>`)}
        ${card(`<h3>Busy days and hours</h3>
          ${weekdayRows.map((day) => `<div class="pos-category-row"><strong>${day.name}<small>${day.count} recorded receipts</small></strong><b>${money(day.amount, settings.currency)}</b></div>`).join('')
            || '<p class="pos-help">Day and hour patterns need recorded receipts.</p>'}
          <div class="pos-insight-row"><strong>Strongest hour</strong><span>${busiestHourEntry ? `${String(busiestHourEntry.hour).padStart(2, '0')}:00 · ${busiestHourEntry.count} receipts` : 'Not enough sales yet'}</span></div>
          <p class="pos-help">Net sales by receipt-created time; these totals are not normalized for different opening hours.</p>`)}
        ${card(`<h3>Recorded cost changes</h3>
          ${costIncreases.slice(0, 5).map((item) => `<div class="pos-insight-row"><strong>${escapeHtml(item.name)}</strong><span>Latest saved cost ${money(item.latest, settings.currency)} · up ${item.change.toFixed(0)}% vs earlier recorded costs</span></div>`).join('')
            || '<p class="pos-help">No increases can be confirmed from repeated sale-time cost records. This does not compare supplier invoices.</p>'}`)}
        ${card(`<h3>Payment mix changes</h3>
          ${Object.entries(byMethod).sort((a, b) => b[1] - a[1]).map(([method, amount]) => {
            const priorAmount = previousByMethod[method] || 0;
            const currentShare = paymentRevenue ? amount / paymentRevenue * 100 : 0;
            const priorShare = previousPaymentRevenue ? priorAmount / previousPaymentRevenue * 100 : 0;
            const shift = previousPaymentRevenue ? `${currentShare - priorShare >= 0 ? '+' : ''}${(currentShare - priorShare).toFixed(0)} percentage points vs prior period` : 'No prior-period baseline';
            return `<div class="pos-category-row"><strong>${escapeHtml(method)}<small>${currentShare.toFixed(0)}% of payment collections · ${shift}</small></strong><b>${money(amount, settings.currency)}</b></div>`;
          }).join('') || '<p class="pos-help">No confirmed payments in this period.</p>'}
          <p class="pos-help">Payments are manually recorded in the POS; this does not reconcile mobile-money statements.</p>`)}
        ${card(`<h3>Large-receipt review</h3>
          ${largeReceipts.map((sale) => `<div class="pos-insight-row"><div><strong>${escapeHtml(sale.receipt_number)} · ${money(sale.total, settings.currency)}</strong><p>${escapeHtml(sale.customer_name || 'No customer saved')} · ${escapeHtml(sale.created_at.slice(0, 16).replace('T', ' '))}</p></div><a href="/pos/sales?open=${sale.id}" data-route="/pos/sales?open=${sale.id}" class="btn-secondary">Review</a></div>`).join('')
            || `<p class="pos-help">${recordedSales.length < 10 ? 'Large-receipt review needs at least 10 recorded sales in this period.' : 'No recorded receipt exceeds the robust median/MAD review threshold.'}</p>`}
          <p class="pos-help">Threshold is the greater of 2.5× the median or median + 3 median absolute deviations. This is a review prompt, not a fraud finding.</p>`)}
        ${card(`<h3>Cash receipt review</h3>
          ${largeCashSales.map((sale) => `<div class="pos-insight-row"><div><strong>${escapeHtml(sale.receipt_number)} · ${money(sale.total, settings.currency)}</strong><p>${escapeHtml(sale.created_at.slice(0, 16).replace('T', ' '))}</p></div><a href="/pos/sales?open=${sale.id}" data-route="/pos/sales?open=${sale.id}" class="btn-secondary">Review</a></div>`).join('')
            || `<p class="pos-help">${cashSaleValues.length < 10 ? 'Unusual cash-sale screening requires at least 10 paid cash receipts.' : 'No cash receipt is at least 3× the median paid cash receipt.'}</p>`}
          <p class="pos-help">Median-based review reduces sensitivity to a few very large sales. This is not a fraud finding.</p>`)}
        ${card(`<h3>Seasonality and selling periods</h3>
          ${monthSegments.length ? monthSegments.map((segment) => `<div class="pos-category-row"><strong>${escapeHtml(segment.label)}<small>Revenue across ${segment.days} calendar days · sales in ${segment.activeMonths} months</small></strong><b>${money(segment.averagePerCalendarDay, settings.currency)}/day</b></div>`).join('')
            : '<p class="pos-help">Not enough history for a month-of-year or month-segment pattern: need 30 recorded sales across at least 3 months. We do not label one month as seasonal from a single observation.</p>'}
          <p class="pos-help">These patterns can reflect opening days, recording habits, promotions, or seasonality. They are not causal or a forecast.</p>`)}
        ${card(`<h3>Data quality and confidence</h3>
          <div class="pos-insight-row"><strong>Receipts with missing line costs</strong><span>${dataQuality.recordedSalesWithoutCosts} of ${recordedSales.length}</span></div>
          <div class="pos-insight-row"><strong>Receipts without customer details</strong><span>${dataQuality.recordedSalesWithoutCustomer}</span></div>
          <div class="pos-insight-row"><strong>Receipts without item lines</strong><span>${dataQuality.recordedSalesWithoutLines}</span></div>
          <div class="pos-insight-row"><strong>Receipts with unreadable dates</strong><span>${dataQuality.invalidDates}</span></div>
          <p class="pos-help">Known-cost coverage is ${totalSoldUnits ? costCoverage.toFixed(0) : '0'}% of units in recorded receipts. Expenses are user-entered; missing records cannot be inferred.</p>`)}
        ${card(`<h3>Actionable recommendations</h3>
          ${missingCosts ? `<p class="pos-help">Add buying costs for ${missingCosts} products to improve profit and product-margin estimates.</p>` : ''}
          ${belowCostProducts.length ? `<p class="pos-help">Review the price or saved buying cost for ${belowCostProducts.slice(0, 3).map((item) => escapeHtml(item.name)).join(', ')}; recorded costs exceed sales revenue.</p>` : ''}
          ${dormantStock.length ? `<p class="pos-help">Review ${dormantStock.slice(0, 3).map((product) => escapeHtml(product.name)).join(', ')}: these items have stock but no sale in 60 days.</p>` : ''}
          ${topSeller && topEarner && topSeller.id !== topEarner.id ? `<p class="pos-help">${escapeHtml(topSeller.name)} sells the most units, while ${escapeHtml(topEarner.name)} has the highest recorded gross profit. Compare their pricing and costs.</p>` : ''}
          ${frequentPairs.length ? `<p class="pos-help">Consider testing a bundle for ${escapeHtml(frequentPairs[0].first)} and ${escapeHtml(frequentPairs[0].second)}; they appeared together in ${frequentPairs[0].count} recorded sales.</p>` : ''}
          ${!missingCosts && !belowCostProducts.length && !lowMarginProducts.length && !dormantStock.length && !(topSeller && topEarner && topSeller.id !== topEarner.id) && !frequentPairs.length ? '<p class="pos-help">No specific product action stands out from the currently recorded data.</p>' : ''}`)}
        ${card(`<h3>Goals and benchmarks</h3>
          ${monthlyGoal ? `<div class="pos-insight-row"><strong>Current month</strong><span>${money(monthRevenue, settings.currency)} / ${money(monthlyGoal, settings.currency)} · ${Math.min(100, monthProgress).toFixed(0)}%</span></div>
            <div class="pos-goal-track" role="progressbar" aria-label="Monthly revenue goal progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.min(100, monthProgress).toFixed(0)}"><span style="width:${Math.min(100, monthProgress).toFixed(1)}%"></span></div>
            <p class="pos-help">${monthRevenue >= monthlyGoal ? 'You reached this month’s target.' : `Needed per remaining day: ${money(requiredDailyRevenue, settings.currency)}. Straight-line month-end pace: ${money(monthRunRate, settings.currency)}; this assumes the current daily average continues.`}</p>`
            : `<p class="pos-help">${staleGoalCurrency ? `A saved goal is in ${escapeHtml(staleGoalCurrency)} while the store now uses ${escapeHtml(settings.currency)}. Save a new goal in the current currency to restart tracking.` : 'Set a monthly sales target to track progress, required daily pace, and a simple run-rate comparison.'}</p>`}
          ${monthlyBenchmarks.length ? `<p class="pos-help">Best complete recorded month: ${escapeHtml(monthlyBenchmarks[0][0])} · ${money(monthlyBenchmarks[0][1], settings.currency)}. Personal historical benchmark only, not an industry comparison.</p>` : '<p class="pos-help">A complete-month benchmark appears after at least one previous month with recorded sales.</p>'}
          <form class="pos-inline-form" data-pos-form="revenue-goal">
            <label for="pos-monthly-goal">Monthly net-sales target · before tax</label>
            <input id="pos-monthly-goal" name="amount" type="number" min="0.01" step="0.01" required value="${monthlyGoal == null ? '' : monthlyGoal}" placeholder="e.g. 50000">
            <button class="btn-secondary">${monthlyGoal ? 'Update goal' : 'Save goal'}</button>
            ${monthlyGoal ? '<button class="btn-secondary" type="button" data-pos-action="clear-revenue-goal">Remove</button>' : ''}
          </form>`) }
        ${card(`<h3>Priority alerts</h3>
          ${activeAlerts.map((alert) => `<div class="pos-insight-alert is-${alert.severity}">
            <div><strong>${escapeHtml(alert.title)}</strong><p>${alert.detail}</p><a href="${alert.href}" data-route="${alert.href}">Review details</a></div>
            <div class="pos-alert-actions"><button type="button" data-pos-action="snooze-alert" data-key="${escapeHtml(alert.id)}">Snooze 24h</button><button type="button" data-pos-action="dismiss-alert" data-key="${escapeHtml(alert.id)}">Dismiss</button></div>
          </div>`).join('') || '<p class="pos-help">No active data-backed priority alerts. Continue recording accurate costs, receipts, and stock counts.</p>'}
          ${dismissedAlertCount ? `<button type="button" class="btn-secondary" data-pos-action="restore-alerts">Restore ${dismissedAlertCount} dismissed alert${dismissedAlertCount === 1 ? '' : 's'}</button>` : ''}
          <p class="pos-help">Alerts are ranked by severity and are review prompts, not diagnoses. Dismissals stay saved until restored; snoozes expire after 24 hours.</p>`)}
        ${card(`<h3>Money and cash flow</h3>
          ${Object.entries(byMethod).sort((a, b) => b[1] - a[1]).map(([method, amount]) => `<div class="pos-category-row"><strong>${escapeHtml(method)}<small>${paymentRevenue ? (amount / paymentRevenue * 100).toFixed(0) : 0}% of payment collections</small></strong><b>${money(amount, settings.currency)}</b></div>`).join('')
            || '<p class="pos-help">No confirmed payments in this period.</p>'}
          <div class="pos-insight-row"><strong>Confirmed payments received</strong><span>${money(paymentRevenue, settings.currency)} · may include tax and partial settlements</span></div>
          <div class="pos-insight-row"><strong>Outstanding credit</strong><span>${money(credit, settings.currency)}${overdueCredit.length ? ` · ${overdueCredit.length} overdue` : ''}</span></div>
          <div class="pos-insight-row"><strong>Recorded expenses</strong><span>${money(operatingExpenses, settings.currency)} · ${changeLabel(operatingExpenses, previousExpenseTotal)}</span></div>
          ${expenseRows.map(([category, amount]) => `<div class="pos-category-row"><strong>${escapeHtml(category)}<small>Expense category</small></strong><b>${money(amount, settings.currency)}</b></div>`).join('')}
          <p class="pos-help">Only manually recorded POS payments and expenses are included.</p>`)}
      </div>`;
    }
    return `<section class="pos-content">
      <div class="pos-overview-controls">
        <nav class="pos-ranges" aria-label="Analytics period">${rangeLinks}</nav>
        <button type="button" class="pos-overview-refresh" data-pos-action="refresh-overview"
          aria-label="Refresh overview" title="Refresh overview">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M20 11a8 8 0 0 0-14.9-3M4 4v4h4M4 13a8 8 0 0 0 14.9 3M20 20v-4h-4"/>
          </svg>
        </button>
      </div>
      ${panel}
    </section>`;
  }

  function overviewMetric(label, value, detail) {
    return `<div class="pos-overview-metric"><small>${label}</small><strong>${value}</strong><span>${escapeHtml(detail)}</span></div>`;
  }

  return { renderOverview };
}
