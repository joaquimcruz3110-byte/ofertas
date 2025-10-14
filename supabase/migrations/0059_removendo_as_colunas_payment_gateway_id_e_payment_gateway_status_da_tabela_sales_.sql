ALTER TABLE public.sales
DROP COLUMN IF EXISTS payment_gateway_id,
DROP COLUMN IF EXISTS payment_gateway_status;