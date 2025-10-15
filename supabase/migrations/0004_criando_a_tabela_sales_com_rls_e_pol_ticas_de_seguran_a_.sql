-- Create sales table
CREATE TABLE public.sales (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  buyer_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  quantity INTEGER NOT NULL,
  total_price DECIMAL(10, 2) NOT NULL,
  commission_rate DECIMAL(5, 2) NOT NULL,
  sale_date TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS (REQUIRED)
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;

-- Policies: Buyers can see their own sales, shopkeepers can see sales of their products, admins can see all sales
CREATE POLICY "Buyers can view their own sales" ON public.sales
FOR SELECT TO authenticated USING (auth.uid() = buyer_id);

CREATE POLICY "Shopkeepers can view sales of their products" ON public.sales
FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.products WHERE products.id = sales.product_id AND products.shopkeeper_id = auth.uid())
);

CREATE POLICY "Admins can view all sales" ON public.sales
FOR SELECT TO authenticated USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'administrador');

CREATE POLICY "Authenticated users can insert sales" ON public.sales
FOR INSERT TO authenticated WITH CHECK (auth.uid() = buyer_id);

-- No update/delete policies for sales to maintain transaction integrity, unless specifically requested.