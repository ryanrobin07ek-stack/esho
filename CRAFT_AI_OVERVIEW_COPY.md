# Craft AI overview copy

Reusable screen wording and `{{variable}}` templates for Craft AI. Variable names are suggested data keys; format money with the shop currency and omit or qualify a sentence when its source value is unavailable. Do not invent missing analytics.

## Home — `/`

### Today’s sales summary

- **Sales today:** `{{sales_today_amount}}`
  - `{{sales_today_count}} sale(s) recorded`
- **Orders:** `{{orders_today_count}}`
  - Today across POS and web
- **Average order:** `{{average_order_today}}`
  - Today

### Yesterday’s sales

- `{{yesterday_sales_count}} sale(s)`

### Needs attention

- **Store checks**
- **Low stock:** `{{low_stock_count}}` — 5 units or fewer
- **Payment follow-up:** `{{payment_follow_up_count}}` — unpaid or part-paid sales

### Recent orders

Show up to three recent sales. Each row has:

- Item: `{{item_name}}` (or `{{item_count}} items` if no item name is available)
- Channel: `{{channel_label}}` (`Web` or `POS`)
- Amount: `{{order_total}}`
- Caption: Payment

When there are no rows: **No sales recorded yet.**

## Business Lens — `/account/main-shop`

### Overview metrics

| Label | Reusable copy |
|---|---|
| Revenue | `{{revenue}}` · `{{revenue_period_note}}` (`All recorded time` or `{{change_percent}}% vs previous equal period`) |
| Paid orders | `{{paid_order_count}}` · `{{unit_count}} units` |
| Gross profit | `{{gross_profit}}` · `{{estimated_margin_percent}}% estimated margin` |
| Customers | `{{customer_count}}` · `{{repeat_customer_count}} repeat` |
| Average order | `{{average_order_value}}` |
| Net after recorded expenses | `{{net_after_recorded_expenses}}` |
| Web visitors | `{{web_visitor_count}}` · `{{page_view_count}} page views` |
| Stock value at cost | `{{stock_value_at_cost}}` |

### Business performance

Chart title: **Business performance**

Series labels: **Revenue · Web · Counter**

### Priority signals

For each signal:

```text
{{signal_title}}
{{signal_detail}}
Next: {{recommended_action}}
```

### Break-even position

Display `{{net_after_recorded_expenses}}` and:

> Gross profit less recorded expenses for the selected period.

Rows:

- **Gross revenue:** `{{gross_revenue}}`
- **Cost of goods (available cost data):** `{{cost_of_goods}}`
- **Recorded operating expenses:** `{{recorded_operating_expenses}}`

### Top products and Revenue by category

Show the leading product or category and its recorded revenue: `{{name}}` — `{{revenue}}`.

### Payment methods

Show each method and recorded payment total: `{{payment_method}}` — `{{payment_total}}`.

### Latest transactions

Show up to six transactions:

```text
{{transaction_reference}} · {{collected_amount}}
{{channel}} · {{transaction_date}} · {{transaction_status}}
```

## Web Studio overview — `/account/web/studio/dashboard/overview`

### Metrics

- **Gross web revenue:** `{{gross_web_revenue}}`
- **Customer visits:** `{{customer_visits}}`
- **Awaiting payments:** `{{awaiting_payment_count}}`

### Recent activity — Storefront visit history

Controls: **Load**, **View all**

Status copy:

- On load error: **Could not load visits.**
- With remote analytics: **Recent visits.**
- Before analytics load: **Analytics not loaded.**
- Empty list: **No visits yet.**

Each visit row shows `{{visit_path}}`, `{{device}}`, and `{{visit_date}}`.

### Web shop — What’s moving

Control: **Performance**

Each product row: `{{product_name}}` — `{{units_sold}} sold`.

Empty state:

> No paid product sales yet. Completed sales will show the products gaining momentum.

## POS overview — `/pos/overview`

Period choices: **Today**, **Last 7 days**, **Last 30 days**, **Last 90 days**, **All time**.

Overview sections: **Summary**, **Revenue**, **Profit**, **Products**, **Stock**, **Payments**, **Reports**.

### Summary

#### Business totals

| Label | Reusable copy |
|---|---|
| Sales recorded | `{{recorded_sales_total}}` · `{{receipt_count}} receipts · includes unpaid sales` |
| Revenue | `{{net_sales_before_tax}}` · `Before tax · {{recorded_sales_count}} recorded sales` |
| Profit | `{{estimated_gross_profit}}` · `Sale-time costs cover {{cost_coverage_percent}}% of units` |
| Operating profit | `{{operating_profit}}` · `{{recorded_expenses}} expenses · recorded costs only` |
| Credit | `{{unpaid_balance}}` · All unpaid balances |

Other Summary cards:

- **Recent revenue** — revenue history chart.
- **Period comparison** — **Net sales · before tax**, **Recorded expenses**.
- **Top products** — empty state: **Product rankings appear after sales are recorded.**
- **Revenue pace estimate** — `{{pace_estimate}}`; `Estimated next 7 days from average daily net sales before tax over the last 7 days. A simple pace estimate, not a guarantee.`
- **Quick insights**
  - `{{recorded_sales_count}} sales recorded for this period.` / **No sales recorded for this period.**
  - `{{low_stock_count}} products need stock attention.` / **No low-stock alerts.**
  - `{{missing_unit_cost_count}} products have no unit cost, so profit may be understated.` / **All products have a recorded unit cost.**
- **Monthly net-sales goal**
  - `{{month_revenue}} of {{monthly_goal}}` · `{{goal_progress_percent}}%`
  - **Monthly target reached.** or `{{required_daily_revenue}} per remaining day is needed to reach the goal; straight-line pace projects {{projected_month_revenue}}.`

### Revenue

- **Net sales · before tax:** `{{net_sales_before_tax}}` · `{{recorded_sales_count}} recorded sales`
- **Payments received:** `{{payments_received}}` · `{{confirmed_payment_count}} confirmed payments · includes tax`
- **Average recorded sale:** `{{average_recorded_sale}}` · Net subtotal per receipt
- **Net sales by receipt date**
- Empty state: **No sales recorded in this period.**

### Profit

Metrics: **Net sales · before tax**, **Cost of goods** (Historical unit costs), **Gross profit** (Revenue less cost of goods), and **Operating profit** (After recorded expenses).

**Profit and loss** rows: Net sales · before tax; Tax on recorded sales; Recorded receipt total · including tax; Payments received this period; Recorded cost of goods; Gross profit; Recorded operating expenses; Operating profit.

Explain that sales revenue is the pre-tax subtotal of recorded receipts by receipt-created date, whether paid or unpaid. Tax is separate and is not profit. Payments follow payment dates and may include partial or cross-period settlements. Profit uses saved sale-time unit costs and recorded POS expenses only; disclose incomplete cost coverage.

Other cards: **Recorded operating-profit trend**, **Expenses**.

### Products

**Product performance** table columns: Product, Units, Revenue, Gross profit.

When no products have sales: **No product sales in this period.**

### Stock

**Stock health** metrics:

- **Known stock cost:** `{{known_stock_cost}}` · Tracked stock with saved buying cost
- **Retail value:** `{{retail_stock_value}}` · Tracked stock at current prices
- **No sale in 60 days:** `{{dormant_stock_value}}` · `{{dormant_product_count}} dormant stocked products`

Table columns: Product, On hand, 30d units, Days cover, Cost value, Retail value.

Explain: Days cover is current stock divided by units sold per day during the last 30 days. It is a rough run rate and does not account for lead time or seasonality.

### Payments

- **Payments received:** `{{payments_received}}` · `{{confirmed_payment_count}} confirmed payments`
- **Outstanding credit:** `{{outstanding_credit}}` · `{{unpaid_receipt_count}} unpaid receipts`
- **Payment method totals:** `{{payment_method}}` — `{{payment_total}}`
- Empty state: **No confirmed payments in this period.**

### Reports

Reports card headings and reusable dynamic copy:

- **Needs attention** — `{{product_name}} is out of stock`; `{{product_name}} · {{units_left}} left`; overdue receipt: `Overdue {{receipt_number}} · due {{due_date}} · {{remaining_balance}} remaining`. If clear: **No stock, overdue-credit, or product-cost alerts from the saved data.**
- **Sales trends** — **Net sales before tax**, **Sales created**, **Average recorded sale**, **Busiest day**, **Strongest recorded hour**. Missing time history: **Not enough sales history yet.**
- **Revenue rhythm** — **Best average weekday**, **Slowest observed weekday**, **Strongest month segment**. Include the displayed threshold/explanation when showing a pattern.
- **Product performance** — **Top seller**, **Highest fully costed gross profit**. Empty state: **Not enough sales history to rank products.**
- **Category performance** — `{{category_name}}`, units, mix share, cost coverage, recorded sales, and change vs prior period.
- **Basket patterns** — `{{product_a}} + {{product_b}}` · `{{receipt_count}} sales`. Clarify that co-occurrence is descriptive, not proof of cause.
- **Customers** — Identified customers, First known purchase in period, New-in-period customers with a later repeat, Repeat customers, Single-purchase customers, Loyal · 3+ purchases, Lapsed repeat customers, Top 20% spend share, Identified-customer sales.
- **Busy days and hours** — weekday receipt counts and sales, **Strongest hour**.
- **Recorded cost changes** — `Latest saved cost {{latest_cost}} · up {{change_percent}}% vs earlier recorded costs`.
- **Payment mix changes** — `{{share_percent}}% of payment collections · {{change_percentage_points}} percentage points vs prior period`; if no comparison: **No prior-period baseline**.
- **Large-receipt review**, **Cash receipt review**, **Seasonality and selling periods**, **Data quality and confidence**, **Actionable recommendations**, **Goals and benchmarks**, **Priority alerts**.

Common Reports empty or caution copy:

- **No confirmed payments in this period.**
- **No multi-product baskets recorded in this period yet.**
- **No active data-backed priority alerts. Continue recording accurate costs, receipts, and stock counts.**
- State clearly when recorded costs, customer details, item lines, dates, or history are incomplete; do not present estimates as guaranteed outcomes.

## Craft AI screen links

Craft AI's trusted screen directory provides the app destinations below. For navigation answers, the assistant uses `[[screen:screen-id]]`; the app turns a known ID into an internal, clickable link. Unknown IDs remain plain text and never become links.

| Screen ID | Destination | Use for |
|---|---|---|
| `web-products` | `/account/web/studio/store/products` | Add a website product, import a Store product, or publish web listings |
| `products-manager` | `/account/products` | Advanced web catalog editing |
| `pos-products` | `/pos/catalogue/products?new=1` | Add a POS-register product |
| `web-overview` | `/account/web/studio/dashboard/overview` | Website overview metrics and visit activity |
| `business-overview` | `/account/main-shop` | Main Store overview |
| `pos-overview` | `/pos/overview` | POS performance and reports |
