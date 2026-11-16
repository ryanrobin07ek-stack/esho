ALTER TABLE paystack_subaccounts ADD COLUMN account_mode TEXT NOT NULL DEFAULT 'unknown';
ALTER TABLE paystack_subaccounts ADD COLUMN is_verified INTEGER NOT NULL DEFAULT 0;

ALTER TABLE storefront_orders ADD COLUMN payment_subaccount_code TEXT;
ALTER TABLE storefront_service_appointments ADD COLUMN payment_subaccount_code TEXT;
