ALTER TABLE public.products
ADD CONSTRAINT fk_products_shopkeeper_id_shop_details
FOREIGN KEY (shopkeeper_id) REFERENCES public.shop_details(id) ON DELETE SET NULL;