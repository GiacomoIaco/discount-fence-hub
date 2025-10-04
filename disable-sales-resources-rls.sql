-- Temporarily disable RLS on Sales Resources tables for testing
-- This allows all operations while we debug

ALTER TABLE public.sales_resources_folders DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_resources_files DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_resources_views DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_resources_favorites DISABLE ROW LEVEL SECURITY;
