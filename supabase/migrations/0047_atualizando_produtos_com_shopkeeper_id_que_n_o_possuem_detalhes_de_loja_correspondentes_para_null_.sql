UPDATE public.products
SET shopkeeper_id = NULL
WHERE shopkeeper_id IS NOT NULL AND shopkeeper_id NOT IN (SELECT id FROM public.shop_details);