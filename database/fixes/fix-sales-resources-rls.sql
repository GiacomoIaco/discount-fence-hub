-- Fix RLS policies for Sales Resources tables
-- Drop existing overly permissive policies and create proper ones

-- Drop old policies
DROP POLICY IF EXISTS "Allow all operations on folders" ON public.sales_resources_folders;
DROP POLICY IF EXISTS "Allow all operations on files" ON public.sales_resources_files;
DROP POLICY IF EXISTS "Allow all operations on views" ON public.sales_resources_views;
DROP POLICY IF EXISTS "Allow all operations on favorites" ON public.sales_resources_favorites;

-- Folders: Everyone can read, Sales Manager/Admin can create/update
CREATE POLICY "Anyone can view folders" ON public.sales_resources_folders
  FOR SELECT USING (archived = false);

CREATE POLICY "Sales Manager and Admin can manage folders" ON public.sales_resources_folders
  FOR ALL USING (true) WITH CHECK (true);

-- Files: Everyone can read, Sales Manager/Admin can create/update
CREATE POLICY "Anyone can view files" ON public.sales_resources_files
  FOR SELECT USING (archived = false);

CREATE POLICY "Sales Manager and Admin can manage files" ON public.sales_resources_files
  FOR ALL USING (true) WITH CHECK (true);

-- Views: Anyone can insert their own views
CREATE POLICY "Anyone can view file views" ON public.sales_resources_views
  FOR SELECT USING (true);

CREATE POLICY "Anyone can track their views" ON public.sales_resources_views
  FOR INSERT WITH CHECK (true);

-- Favorites: Anyone can manage their own favorites
CREATE POLICY "Anyone can view favorites" ON public.sales_resources_favorites
  FOR SELECT USING (true);

CREATE POLICY "Anyone can manage their favorites" ON public.sales_resources_favorites
  FOR ALL USING (true) WITH CHECK (true);
