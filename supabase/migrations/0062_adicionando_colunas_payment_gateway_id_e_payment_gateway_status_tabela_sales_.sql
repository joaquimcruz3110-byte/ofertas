ALTER TABLE public.sales
    ADD COLUMN IF NOT EXISTS payment_gateway_id TEXT,
    ADD COLUMN IF NOT EXISTS payment_gateway_status TEXT;