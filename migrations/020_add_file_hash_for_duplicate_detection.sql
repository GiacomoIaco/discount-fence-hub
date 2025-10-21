-- Migration: Add file_hash column for duplicate detection
-- Description: Adds file_hash column to photos table for detecting duplicate uploads
-- Created: 2025-10-21

-- Add file_hash column (nullable for existing photos)
ALTER TABLE photos
ADD COLUMN IF NOT EXISTS file_hash TEXT;

-- Create index for faster duplicate lookups
CREATE INDEX IF NOT EXISTS idx_photos_file_hash ON photos(file_hash) WHERE file_hash IS NOT NULL;

-- Add comment
COMMENT ON COLUMN photos.file_hash IS 'SHA-256 hash of file content for duplicate detection';

-- Optional: Add unique constraint if you want to prevent any duplicates
-- Note: Only uncomment this if you want to strictly enforce no duplicates
-- ALTER TABLE photos ADD CONSTRAINT unique_file_hash UNIQUE (file_hash);
