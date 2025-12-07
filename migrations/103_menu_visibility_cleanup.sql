-- ============================================
-- Migration 103: Menu Visibility Cleanup
-- ============================================
-- 1. Add supported_platforms to track what's actually possible
-- 2. Rename bom-calculator to ops-hub
-- 3. Remove duplicate/redundant menu items
-- 4. Set correct supported platforms for each feature

-- ============================================
-- 1. ADD SUPPORTED_PLATFORMS COLUMN
-- ============================================

ALTER TABLE menu_visibility
ADD COLUMN IF NOT EXISTS supported_on_desktop BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS supported_on_tablet BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS supported_on_mobile BOOLEAN DEFAULT true;

COMMENT ON COLUMN menu_visibility.supported_on_desktop IS 'True if feature has a desktop-compatible UI';
COMMENT ON COLUMN menu_visibility.supported_on_tablet IS 'True if feature has a tablet-compatible UI';
COMMENT ON COLUMN menu_visibility.supported_on_mobile IS 'True if feature has a mobile-compatible UI';

-- ============================================
-- 2. SET SUPPORTED PLATFORMS FOR EACH FEATURE
-- ============================================

-- Ops Hub (formerly BOM Calculator) - desktop only (complex UI)
UPDATE menu_visibility
SET
  supported_on_desktop = true,
  supported_on_tablet = false,
  supported_on_mobile = false,
  show_on_desktop = true,
  show_on_tablet = false,
  show_on_mobile = false
WHERE menu_id = 'bom-calculator';

-- Yard - all platforms (has mobile view)
UPDATE menu_visibility
SET
  supported_on_desktop = true,
  supported_on_tablet = true,
  supported_on_mobile = true
WHERE menu_id = 'bom-yard';

-- Requests - all platforms (unified hub)
UPDATE menu_visibility
SET
  supported_on_desktop = true,
  supported_on_tablet = true,
  supported_on_mobile = true,
  show_on_desktop = true,
  show_on_tablet = true,
  show_on_mobile = true
WHERE menu_id = 'requests';

-- Leadership - desktop/tablet only (complex dashboard)
UPDATE menu_visibility
SET
  supported_on_desktop = true,
  supported_on_tablet = true,
  supported_on_mobile = false,
  show_on_mobile = false
WHERE menu_id = 'leadership';

-- Analytics - desktop/tablet only
UPDATE menu_visibility
SET
  supported_on_desktop = true,
  supported_on_tablet = true,
  supported_on_mobile = false,
  show_on_mobile = false
WHERE menu_id = 'analytics';

-- All other features - supported on all platforms by default
UPDATE menu_visibility
SET
  supported_on_desktop = true,
  supported_on_tablet = true,
  supported_on_mobile = true
WHERE menu_id NOT IN ('bom-calculator', 'bom-yard', 'requests', 'leadership', 'analytics');

-- ============================================
-- 3. RENAME BOM CALCULATOR TO OPS HUB
-- ============================================

UPDATE menu_visibility
SET menu_name = 'Ops Hub'
WHERE menu_id = 'bom-calculator';

-- ============================================
-- 4. REMOVE MY-REQUESTS (MERGED INTO REQUESTS)
-- ============================================

-- Delete my-requests since it's now part of unified Requests
DELETE FROM menu_visibility WHERE menu_id = 'my-requests';

-- ============================================
-- 5. UPDATE YARD TO HIDE ON DESKTOP SIDEBAR
-- ============================================
-- Yard is accessed through Ops Hub on desktop, only show on mobile

UPDATE menu_visibility
SET
  show_on_desktop = false,
  show_on_tablet = true,
  show_on_mobile = true
WHERE menu_id = 'bom-yard';
