-- Drop the existing policy first to allow recreation
DROP POLICY IF EXISTS "Shopkeepers can update their own shop details" ON public.shop_details;

-- Add the mercadopago_account_id column if it doesn't exist
ALTER TABLE public.shop_details
ADD COLUMN IF NOT EXISTS mercadopago_account_id TEXT DEFAULT NULL;

-- Recreate the policy to allow shopkeepers to update their own shop details, including the new column
CREATE POLICY "Shopkeepers can update their own shop details" ON public.shop_details
FOR UPDATE TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);