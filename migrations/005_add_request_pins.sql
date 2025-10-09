-- Add request pins/stars feature
-- Run this in Supabase SQL Editor

-- ============================================
-- 1. CREATE REQUEST PINS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS request_pins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pinned_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(request_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_request_pins_request_id ON request_pins(request_id);
CREATE INDEX IF NOT EXISTS idx_request_pins_user_id ON request_pins(user_id);
CREATE INDEX IF NOT EXISTS idx_request_pins_user_request ON request_pins(user_id, request_id);

-- ============================================
-- 2. ROW LEVEL SECURITY
-- ============================================

ALTER TABLE request_pins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own pins" ON request_pins;
CREATE POLICY "Users can view their own pins"
  ON request_pins FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can create their own pins" ON request_pins;
CREATE POLICY "Users can create their own pins"
  ON request_pins FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete their own pins" ON request_pins;
CREATE POLICY "Users can delete their own pins"
  ON request_pins FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- ============================================
-- 3. HELPER FUNCTIONS
-- ============================================

-- Function to toggle pin status
CREATE OR REPLACE FUNCTION toggle_request_pin(req_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  pin_exists BOOLEAN;
BEGIN
  -- Check if pin exists
  SELECT EXISTS (
    SELECT 1 FROM request_pins
    WHERE request_id = req_id AND user_id = auth.uid()
  ) INTO pin_exists;

  IF pin_exists THEN
    -- Unpin
    DELETE FROM request_pins
    WHERE request_id = req_id AND user_id = auth.uid();
    RETURN FALSE;
  ELSE
    -- Pin
    INSERT INTO request_pins (request_id, user_id)
    VALUES (req_id, auth.uid());
    RETURN TRUE;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- SUCCESS MESSAGE
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '✅ Request pins feature installed successfully!';
  RAISE NOTICE '';
  RAISE NOTICE 'New features:';
  RAISE NOTICE '• Pin/star important requests to keep them at the top';
  RAISE NOTICE '• Personal pins - each user has their own pinned requests';
  RAISE NOTICE '';
  RAISE NOTICE 'Usage:';
  RAISE NOTICE '  SELECT toggle_request_pin(request_id);  -- Returns TRUE if pinned, FALSE if unpinned';
END $$;
