
-- Add image_url column to avisos table
ALTER TABLE public.avisos ADD COLUMN IF NOT EXISTS image_url text;

-- Create storage bucket for general uploads (products, avisos)
INSERT INTO storage.buckets (id, name, public) 
VALUES ('clinic-uploads', 'clinic-uploads', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload to clinic-uploads
CREATE POLICY "Authenticated users can upload" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'clinic-uploads');

-- Allow public read access
CREATE POLICY "Public read access clinic-uploads" ON storage.objects
FOR SELECT TO public
USING (bucket_id = 'clinic-uploads');

-- Allow authenticated users to delete their uploads
CREATE POLICY "Authenticated users can delete clinic-uploads" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'clinic-uploads');
