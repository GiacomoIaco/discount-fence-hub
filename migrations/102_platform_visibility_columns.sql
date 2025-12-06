-- ============================================
-- Migration 102: Platform Visibility Columns
-- ============================================
-- Replaces single 'available_on' column with 3 boolean columns
-- for granular control: desktop, tablet, mobile (phone)

-- ============================================
-- 1. ADD NEW BOOLEAN COLUMNS
-- ============================================

ALTER TABLE menu_visibility
ADD COLUMN IF NOT EXISTS show_on_desktop BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS show_on_tablet BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS show_on_mobile BOOLEAN DEFAULT true;

COMMENT ON COLUMN menu_visibility.show_on_desktop IS 'Show on desktop screens (>= 1024px)';
COMMENT ON COLUMN menu_visibility.show_on_tablet IS 'Show on tablet screens (640px - 1024px)';
COMMENT ON COLUMN menu_visibility.show_on_mobile IS 'Show on mobile/phone screens (< 640px)';

-- ============================================
-- 2. MIGRATE EXISTING DATA
-- ============================================

-- Convert 'available_on' values to the new boolean columns
UPDATE menu_visibility
SET
  show_on_desktop = CASE
    WHEN available_on = 'desktop' THEN true
    WHEN available_on = 'mobile' THEN false
    WHEN available_on = 'both' THEN true
    ELSE true  -- default to showing
  END,
  show_on_tablet = CASE
    WHEN available_on = 'desktop' THEN true  -- tablets are closer to desktop
    WHEN available_on = 'mobile' THEN true   -- but also work for mobile features
    WHEN available_on = 'both' THEN true
    ELSE true
  END,
  show_on_mobile = CASE
    WHEN available_on = 'desktop' THEN false
    WHEN available_on = 'mobile' THEN true
    WHEN available_on = 'both' THEN true
    ELSE true
  END
WHERE available_on IS NOT NULL;

-- ============================================
-- 3. SET SPECIFIC DEFAULTS FOR KNOWN ITEMS
-- ============================================

-- BOM Calculator - desktop only (complex UI)
UPDATE menu_visibility
SET show_on_desktop = true, show_on_tablet = false, show_on_mobile = false
WHERE menu_id = 'bom-calculator';

-- Yard - tablet and mobile (field workers)
UPDATE menu_visibility
SET show_on_desktop = true, show_on_tablet = true, show_on_mobile = true
WHERE menu_id = 'bom-yard';

-- My Requests - desktop only (mobile has Requests hub)
UPDATE menu_visibility
SET show_on_desktop = true, show_on_tablet = true, show_on_mobile = false
WHERE menu_id = 'my-requests';

-- ============================================
-- 4. CREATE INDEX FOR FILTERING
-- ============================================

CREATE INDEX IF NOT EXISTS idx_menu_visibility_platforms
ON menu_visibility(show_on_desktop, show_on_tablet, show_on_mobile);
