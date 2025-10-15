-- Políticas para lojistas
CREATE POLICY "Shopkeepers can insert their own products" ON public.products
FOR INSERT TO authenticated WITH CHECK (auth.uid() = shopkeeper_id AND public.is_lojista());

CREATE POLICY "Shopkeepers can update their own products" ON public.products
FOR UPDATE TO authenticated USING (auth.uid() = shopkeeper_id AND public.is_lojista());

CREATE POLICY "Shopkeepers can delete their own products" ON public.products
FOR DELETE TO authenticated USING (auth.uid() = shopkeeper_id AND public.is_lojista());

-- Política para administradores (gerenciar todos os produtos)
CREATE POLICY "Admins can manage all products" ON public.products
FOR ALL TO authenticated USING (public.is_admin());