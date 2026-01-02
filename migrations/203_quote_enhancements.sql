-- Migration 203: Quote Enhancements
-- Adds acceptance tracking and project linking to quotes

-- ============================================
-- 1. Add acceptance status tracking
-- ============================================

-- Acceptance status for multiple quotes per project
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS acceptance_status TEXT DEFAULT 'pending'
  CHECK (acceptance_status IN ('pending', 'accepted', 'declined', 'superseded'));

-- Track which quote superseded this one (version tracking)
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS superseded_by_quote_id UUID REFERENCES quotes(id) ON DELETE SET NULL;

-- Timestamps for acceptance lifecycle
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMPTZ;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS declined_at TIMESTAMPTZ;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS declined_reason TEXT;

-- ============================================
-- 2. Ensure project_id exists and is indexed
-- ============================================

-- Add project_id if it doesn't exist
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id) ON DELETE SET NULL;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_quotes_project ON quotes(project_id);
CREATE INDEX IF NOT EXISTS idx_quotes_acceptance ON quotes(acceptance_status);
CREATE INDEX IF NOT EXISTS idx_quotes_superseded_by ON quotes(superseded_by_quote_id);

-- ============================================
-- 3. Add version number for quote revisions
-- ============================================

ALTER TABLE quotes ADD COLUMN IF NOT EXISTS version_number INTEGER DEFAULT 1;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS is_revision_of_quote_id UUID REFERENCES quotes(id) ON DELETE SET NULL;

-- ============================================
-- 4. Add comments for documentation
-- ============================================

COMMENT ON COLUMN quotes.acceptance_status IS 'pending=under review, accepted=client approved, declined=client rejected, superseded=replaced by newer version';
COMMENT ON COLUMN quotes.superseded_by_quote_id IS 'If this quote was superseded, points to the newer quote that replaced it';
COMMENT ON COLUMN quotes.accepted_at IS 'Timestamp when client accepted this quote';
COMMENT ON COLUMN quotes.declined_at IS 'Timestamp when client declined this quote';
COMMENT ON COLUMN quotes.declined_reason IS 'Optional reason why client declined';
COMMENT ON COLUMN quotes.version_number IS 'Version number for quote revisions (1, 2, 3...)';
COMMENT ON COLUMN quotes.is_revision_of_quote_id IS 'If this is a revision, points to the original quote';

-- ============================================
-- 5. Trigger to update acceptance timestamps
-- ============================================

CREATE OR REPLACE FUNCTION update_quote_acceptance_timestamps()
RETURNS TRIGGER AS $$
BEGIN
  -- Set accepted_at when status changes to accepted
  IF NEW.acceptance_status = 'accepted' AND OLD.acceptance_status != 'accepted' THEN
    NEW.accepted_at := now();
  END IF;

  -- Set declined_at when status changes to declined
  IF NEW.acceptance_status = 'declined' AND OLD.acceptance_status != 'declined' THEN
    NEW.declined_at := now();
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_quote_acceptance_timestamps ON quotes;
CREATE TRIGGER trg_quote_acceptance_timestamps
BEFORE UPDATE ON quotes
FOR EACH ROW
WHEN (OLD.acceptance_status IS DISTINCT FROM NEW.acceptance_status)
EXECUTE FUNCTION update_quote_acceptance_timestamps();

-- ============================================
-- 6. Function to accept a quote (marks others as superseded)
-- ============================================

CREATE OR REPLACE FUNCTION accept_quote(p_quote_id UUID)
RETURNS void AS $$
DECLARE
  v_project_id UUID;
BEGIN
  -- Get the project_id for this quote
  SELECT project_id INTO v_project_id FROM quotes WHERE id = p_quote_id;

  IF v_project_id IS NULL THEN
    RAISE EXCEPTION 'Quote must be linked to a project before accepting';
  END IF;

  -- Mark this quote as accepted
  UPDATE quotes
  SET acceptance_status = 'accepted'
  WHERE id = p_quote_id;

  -- Mark other pending quotes in the same project as superseded
  UPDATE quotes
  SET acceptance_status = 'superseded',
      superseded_by_quote_id = p_quote_id
  WHERE project_id = v_project_id
    AND id != p_quote_id
    AND acceptance_status = 'pending';

  -- Update the project's accepted_quote_id
  UPDATE projects
  SET accepted_quote_id = p_quote_id
  WHERE id = v_project_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

SELECT 'Migration 203 complete: Quote enhancements added';
