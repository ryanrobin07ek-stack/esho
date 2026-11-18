// The ONE definition of revenue used by the owner app.
//
// Business Lens reports (src/business-lens.js) and the Craft AI helper (src/local-analytics.js,
// the "local_analytics" it sends to the Worker) both import this file, so a number the owner sees
// on a report and a number the AI quotes cannot drift apart. The Worker's own online-order totals
// (cloudflare/worker.js buildAiAnalyticsContext) follow the same rule in SQL:
// payment_status = 'paid', summed over total_cents.
//
// REVENUE = the sum of `total` of every sale or order that is
//   - FULLY PAID (a POS receipt with its paid flag set, or an online order whose payment is
//     "paid"; credit, pending, part-paid and failed sales are not revenue yet), and
//   - NOT REVERSED (status or payment status refunded, voided, cancelled/canceled or failed;
//     a reversed sale is removed from revenue entirely instead of being netted off later), and
//   - counted on the day it was created, in the shop's currency.
//
// `total` is what the customer paid: AFTER discounts and INCLUDING tax. Discounts are therefore
// already deducted and are only reported separately (never subtracted a second time). POS receipts
// and online orders are both sales; each channel can also be reported on its own, and the whole
// shop's revenue is the sum of both channels.
//
// NET SALES (the POS overview's "Net sales · before tax") is a different, explicitly labelled
// measure: sales after discounts and before tax, counting every recorded POS sale including unpaid
// credit sales. It is never called "revenue".
//
// SERVICES: appointments are not sales and are not part of revenue. A service business reports
// them next to revenue: completed appointments (service price), deposits collected, and deposit
// refunds owed. The AI context carries them under `service_business`.

export const REVERSED_SALE_STATUSES = Object.freeze(['refunded', 'voided', 'cancelled', 'canceled', 'failed']);
const PAID_STATUSES = Object.freeze(['paid', 'completed', 'confirmed']);

export const REVENUE_DEFINITION = 'Revenue is the total (after discounts, including tax) of fully paid sales and orders that were not refunded, voided, cancelled or failed. ' +
  'Unpaid or part-paid sales and credit sales are not revenue yet. Discounts are already deducted. ' +
  'Whole-shop revenue is POS receipts plus online orders. Appointments are not sales: completed services and deposits are reported separately under service_business.';

const lower = value => String(value ?? '').trim().toLowerCase();

/** True when the sale or order was refunded, voided, cancelled or failed. Accepts POS rows, lens sales and online orders. */
export function isReversedSale(sale) {
  if (!sale) return false;
  return [sale.status, sale.payment_status, sale.paymentStatus]
    .some(value => REVERSED_SALE_STATUSES.includes(lower(value)));
}

/**
 * True when the sale counts as revenue. A `paid` flag (POS rows store 0/1; Business Lens sales
 * store a boolean) is authoritative when present; records without one (online orders) are paid
 * when their payment status or status says so.
 */
export function isPaidSale(sale) {
  if (!sale || isReversedSale(sale)) return false;
  if (sale.paid !== undefined && sale.paid !== null) return sale.paid === true || Number(sale.paid) > 0;
  return [sale.payment_status, sale.paymentStatus, sale.status].some(value => PAID_STATUSES.includes(lower(value)));
}

/** The revenue a sale contributes: its total in money units (cents-only rows are converted). */
export function saleRevenue(sale) {
  if (!isPaidSale(sale)) return 0;
  const total = Number(sale.total);
  if (Number.isFinite(total) && total !== 0) return total;
  const cents = Number(sale.total_cents);
  return Number.isFinite(cents) ? cents / 100 : 0;
}

/** Total revenue of a list of sales. */
export function sumRevenue(sales) {
  return sales.reduce((total, sale) => total + saleRevenue(sale), 0);
}

/** Money the sale is still owed (unpaid or part-paid, not reversed). Reported next to revenue, never inside it. */
export function saleOutstanding(sale) {
  if (!sale || isReversedSale(sale) || isPaidSale(sale)) return 0;
  const total = Number(sale.total) || Number(sale.total_cents || 0) / 100;
  const paid = Number(sale.amountPaid) || Number(sale.amount_paid_cents || 0) / 100 || 0;
  return Math.max(0, total - paid);
}

/** Discount given on a sale, in money units. */
export function saleDiscount(sale) {
  const discount = Number(sale?.discount);
  if (Number.isFinite(discount)) return Math.max(0, discount);
  return Math.max(0, Number(sale?.discount_cents || 0) / 100);
}
