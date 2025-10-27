-- Fix storage bucket RLS policies for sales-resources bucket
-- This allows file uploads to work

-- Allow everyone to upload files (permissions controlled in app)
CREATE POLICY "Allow all uploads to sales-resources"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'sales-resources');

-- Allow everyone to update files
CREATE POLICY "Allow all updates to sales-resources"
ON storage.objects FOR UPDATE
USING (bucket_id = 'sales-resources');

-- Allow everyone to read files
CREATE POLICY "Allow all reads from sales-resources"
ON storage.objects FOR SELECT
USING (bucket_id = 'sales-resources');

-- Allow everyone to delete files
CREATE POLICY "Allow all deletes from sales-resources"
ON storage.objects FOR DELETE
USING (bucket_id = 'sales-resources');
