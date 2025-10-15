-- Create products table
CREATE TABLE public.products (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  price DECIMAL(10, 2) NOT NULL,
  quantity INTEGER NOT NULL,
  category VARCHAR(255),
  photo_url TEXT,
  discount DECIMAL(5, 2) DEFAULT 0.00,
  shopkeeper_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS (REQUIRED)
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- Create policies for each operation
CREATE POLICY "Public products are viewable by everyone" ON public.products
FOR SELECT USING (true);

CREATE POLICY "Shopkeepers can insert their own products" ON public.products
FOR INSERT TO authenticated WITH CHECK (auth.uid() = shopkeeper_id AND (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'lojista');

CREATE POLICY "Shopkeepers can update their own products" ON public.products
FOR UPDATE TO authenticated USING (auth.uid() = shopkeeper_id AND (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'lojista');

CREATE POLICY "Shopkeepers can delete their own products" ON public.products
FOR DELETE TO authenticated USING (auth.uid() = shopkeeper_id AND (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'lojista');

-- Admins can manage all products
CREATE POLICY "Admins can manage all products" ON public.products
FOR ALL TO authenticated USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'administrador');