DROP POLICY IF EXISTS "Shopkeepers can insert their own payout details" ON public.shopkeeper_payout_details;
DROP POLICY IF EXISTS "Shopkeepers can update their own payout details" ON public.shopkeeper_payout_details;
DROP POLICY IF EXISTS "Admins can view all payout details" ON public.shopkeeper_payout_details;
DROP POLICY IF EXISTS "Shopkeepers can view their own payout details" ON public.shopkeeper_payout_details;
ALTER TABLE public.shopkeeper_payout_details DISABLE ROW LEVEL SECURITY;
DROP TABLE IF EXISTS public.shopkeeper_payout_details;