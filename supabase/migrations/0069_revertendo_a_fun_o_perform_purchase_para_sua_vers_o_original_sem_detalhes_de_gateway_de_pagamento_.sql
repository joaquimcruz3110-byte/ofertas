CREATE OR REPLACE FUNCTION public.perform_purchase(p_product_id uuid, p_buyer_id uuid, p_quantity integer, p_total_price numeric, p_commission_rate numeric)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  -- 1. Decrementar a quantidade do produto
  UPDATE public.products
  SET quantity = quantity - p_quantity
  WHERE id = p_product_id AND quantity >= p_quantity;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Product not available or insufficient quantity.';
  END IF;

  -- 2. Inserir o registro de venda
  INSERT INTO public.sales (product_id, buyer_id, quantity, total_price, commission_rate)
  VALUES (p_product_id, p_buyer_id, p_quantity, p_total_price, p_commission_rate);
END;
$function$;