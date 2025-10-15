-- Create notifications table
CREATE TABLE public.notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS (REQUIRED)
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Policies for notifications table
-- Shopkeepers can only see their own notifications
CREATE POLICY "Shopkeepers can view their own notifications" ON public.notifications
FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Shopkeepers can insert notifications (e.g., via webhook or internal system)
-- This policy allows the webhook to insert notifications for shopkeepers
CREATE POLICY "Authenticated users can insert notifications" ON public.notifications
FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'administrador'));

-- Shopkeepers can update their own notifications (e.g., mark as read)
CREATE POLICY "Shopkeepers can update their own notifications" ON public.notifications
FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- Shopkeepers can delete their own notifications
CREATE POLICY "Shopkeepers can delete their own notifications" ON public.notifications
FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Admins can manage all notifications
CREATE POLICY "Admins can manage all notifications" ON public.notifications
FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'administrador'));