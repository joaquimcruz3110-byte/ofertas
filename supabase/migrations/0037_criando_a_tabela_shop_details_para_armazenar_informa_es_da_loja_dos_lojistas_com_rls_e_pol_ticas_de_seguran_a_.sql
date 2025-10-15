-- Create shop_details table
CREATE TABLE public.shop_details (
  id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE PRIMARY KEY,
  shop_name TEXT NOT NULL,
  shop_description TEXT,
  shop_logo_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS (REQUIRED for security)
ALTER TABLE public.shop_details ENABLE ROW LEVEL SECURITY;

-- Policies for shop_details table
-- Lojistas can SELECT their own shop details
CREATE POLICY "Shopkeepers can view their own shop details" ON public.shop_details
FOR SELECT TO authenticated USING (auth.uid() = id);

-- Lojistas can INSERT their own shop details (only if they don't have one yet)
CREATE POLICY "Shopkeepers can insert their own shop details" ON public.shop_details
FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- Lojistas can UPDATE their own shop details
CREATE POLICY "Shopkeepers can update their own shop details" ON public.shop_details
FOR UPDATE TO authenticated USING (auth.uid() = id);

-- Lojistas can DELETE their own shop details (e.g., if they close their shop)
CREATE POLICY "Shopkeepers can delete their own shop details" ON public.shop_details
FOR DELETE TO authenticated USING (auth.uid() = id);

-- Admins can view all shop details
CREATE POLICY "Admins can view all shop details" ON public.shop_details
FOR SELECT TO authenticated USING (public.is_admin());