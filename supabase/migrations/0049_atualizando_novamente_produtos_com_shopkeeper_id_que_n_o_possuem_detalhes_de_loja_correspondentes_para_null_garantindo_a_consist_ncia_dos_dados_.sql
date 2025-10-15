UPDATE public.products
SET shopkeeper_id = NULL
WHERE NOT EXISTS (SELECT 1 FROM public.shop_details WHERE public.shop_details.id = public.products.shopkeeper_id);