-- Adicionar a coluna external_reference à tabela sales
ALTER TABLE public.sales
ADD COLUMN external_reference TEXT UNIQUE;

-- Atualizar a função perform_purchase para aceitar p_external_reference
CREATE OR REPLACE FUNCTION public.perform_purchase(
  p_product_id uuid,
  p_buyer_id uuid,
  p_quantity integer,
  p_total_price numeric,
  p_commission_rate numeric,
  p_external_reference TEXT DEFAULT NULL -- Novo parâmetro
)
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
  INSERT INTO public.sales (product_id, buyer_id, quantity, total_price, commission_rate, external_reference)
  VALUES (p_product_id, p_buyer_id, p_quantity, p_total_price, p_commission_rate, p_external_reference);
END;
$function$;