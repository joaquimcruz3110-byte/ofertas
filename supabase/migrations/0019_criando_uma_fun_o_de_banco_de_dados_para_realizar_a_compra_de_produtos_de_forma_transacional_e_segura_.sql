CREATE OR REPLACE FUNCTION public.perform_purchase(
  p_product_id UUID,
  p_buyer_id UUID,
  p_quantity INTEGER,
  p_total_price NUMERIC,
  p_commission_rate NUMERIC
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER -- Permite que a função seja executada com os privilégios do criador (admin)
AS $$
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
$$;

-- Conceder permissão de execução para usuários autenticados
GRANT EXECUTE ON FUNCTION public.perform_purchase TO authenticated;