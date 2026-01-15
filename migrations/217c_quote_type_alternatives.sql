-- Migration 217c: Quote Type & Alternative Quotes
-- PART 3 of Request-Project Lifecycle Architecture

-- Quote type for change orders, warranty quotes, etc.
ALTER TABLE quotes
  ADD COLUMN IF NOT EXISTS quote_type TEXT DEFAULT 'original'
    CHECK (quote_type IN ('original', 'change_order', 'warranty', 'revision'));

-- For mutually exclusive quote options (Option A vs Option B)
ALTER TABLE quotes
  ADD COLUMN IF NOT EXISTS quote_group TEXT,
  ADD COLUMN IF NOT EXISTS is_alternative BOOLEAN DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_quotes_type ON quotes(quote_type);
CREATE INDEX IF NOT EXISTS idx_quotes_group ON quotes(quote_group)
  WHERE quote_group IS NOT NULL;

-- Auto-decline alternatives when one is accepted
CREATE OR REPLACE FUNCTION trg_auto_decline_alternatives()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.acceptance_status = 'accepted' AND NEW.quote_group IS NOT NULL THEN
    UPDATE quotes
    SET acceptance_status = 'declined',
        declined_at = NOW(),
        internal_notes = COALESCE(internal_notes, '') ||
          E'\n[Auto-declined: Alternative quote ' || NEW.quote_number || ' was accepted]'
    WHERE quote_group = NEW.quote_group
      AND id != NEW.id
      AND acceptance_status NOT IN ('accepted', 'declined', 'superseded');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_quote_accepted_decline_alternatives ON quotes;
CREATE TRIGGER trg_quote_accepted_decline_alternatives
  AFTER UPDATE ON quotes
  FOR EACH ROW
  WHEN (OLD.acceptance_status IS DISTINCT FROM 'accepted' AND NEW.acceptance_status = 'accepted')
  EXECUTE FUNCTION trg_auto_decline_alternatives();

-- Optional Line Items (for upgrades/add-ons)
ALTER TABLE quote_line_items
  ADD COLUMN IF NOT EXISTS is_optional BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_selected BOOLEAN DEFAULT true;

SELECT 'Migration 217c complete: Quote type, alternatives & optional line items';
