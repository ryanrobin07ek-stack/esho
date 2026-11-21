// The ways a shop lets customers pay it directly (Craft → Payments → "Ways customers can pay you
// directly"): M-Pesa Till, Paybill or phone number, cash, and bank transfer. Published with the shop's
// store settings and shown at the storefront checkout next to Paystack. This is display text only: no
// money moves through it, and the Worker never trusts it for a payment (Paystack readiness is checked
// separately). Same rules as src/screens/craft/direct-payments.js; keep the two in step.

const MPESA_KINDS = ["till", "paybill", "phone"];
const digits = value => String(value ?? "").replace(/\D/g, "");
const text = (value, max) => String(typeof value === "string" || typeof value === "number" ? value : "")
  .replace(/[\u0000-\u001f\u007f<>]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);

/** Always returns the full, clean shape; anything missing, broken or unusable counts as switched off. */
export function normalizePaymentOptions(raw) {
  const source = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  const mpesa = source.mpesa && typeof source.mpesa === "object" ? source.mpesa : {};
  const kind = MPESA_KINDS.includes(mpesa.kind) ? mpesa.kind : "till";
  const number = kind === "phone"
    ? text(mpesa.number, 20).replace(/[^\d+ ]/g, "")
    : digits(mpesa.number).slice(0, 12);
  const bankDetails = text(source.bank?.details, 300);
  return {
    mpesa: {
      enabled: mpesa.enabled === true && Boolean(number),
      kind,
      number,
      account: kind === "paybill" ? text(mpesa.account, 40) : ""
    },
    cash: { enabled: source.cash?.enabled === true },
    bank: { enabled: source.bank?.enabled === true && Boolean(bankDetails), details: bankDetails }
  };
}
