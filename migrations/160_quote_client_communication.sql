-- Migration 160: Quote Client Communication
-- Adds fields for client quote viewing and communication tracking

-- Add view token for secure client access
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS view_token VARCHAR(255);
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS view_token_created_at TIMESTAMPTZ;

-- Add phone tracking for SMS sends
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS sent_to_phone VARCHAR(50);

-- Add client response tracking
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS client_viewed_count INT DEFAULT 0;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS client_response_notes TEXT;

-- Create index on view_token for fast lookups
CREATE INDEX IF NOT EXISTS idx_quotes_view_token ON quotes(view_token) WHERE view_token IS NOT NULL;
