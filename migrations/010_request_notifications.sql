-- Migration: Request Notifications
-- Description: Add tracking for request views and notifications
-- Created: 2025-10-10

-- Create request_views table to track when users last viewed each request
CREATE TABLE IF NOT EXISTS request_views (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  request_id UUID NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  last_viewed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(request_id, user_id)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_request_views_user_id ON request_views(user_id);
CREATE INDEX IF NOT EXISTS idx_request_views_request_id ON request_views(request_id);

-- Enable RLS
ALTER TABLE request_views ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own views
CREATE POLICY "Users can view own request views"
  ON request_views
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Policy: Users can insert their own views
CREATE POLICY "Users can insert own request views"
  ON request_views
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own views
CREATE POLICY "Users can update own request views"
  ON request_views
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Function to update request updated_at timestamp
CREATE OR REPLACE FUNCTION update_request_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at on requests table
DROP TRIGGER IF EXISTS update_requests_updated_at ON requests;
CREATE TRIGGER update_requests_updated_at
  BEFORE UPDATE ON requests
  FOR EACH ROW
  EXECUTE FUNCTION update_request_updated_at();

-- Add comment
COMMENT ON TABLE request_views IS 'Tracks when users last viewed each request for notification purposes';
