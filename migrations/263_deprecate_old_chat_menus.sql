-- ============================================================================
-- UNIFIED COMMUNICATION HUB - PHASE 7: Deprecate Old Chat Systems
-- Hides legacy Chat and Announcements menu items in favor of unified Messages
-- ============================================================================

-- ============================================================================
-- 1. HIDE LEGACY DIRECT MESSAGES (CHAT) MENU ITEM
-- The old Chat section is replaced by the unified Messages inbox
-- ============================================================================

UPDATE menu_visibility
SET
  show_on_desktop = false,
  show_on_tablet = false,
  show_on_mobile = false,
  updated_at = NOW()
WHERE menu_id = 'direct-messages';

-- ============================================================================
-- 2. HIDE LEGACY TEAM COMMUNICATION (ANNOUNCEMENTS) MENU ITEM
-- Announcements are now visible in the unified Messages inbox
-- ============================================================================

UPDATE menu_visibility
SET
  show_on_desktop = false,
  show_on_tablet = false,
  show_on_mobile = false,
  updated_at = NOW()
WHERE menu_id = 'team-communication';

-- ============================================================================
-- 3. ENHANCE UNIFIED MESSAGES (MESSAGE CENTER) MENU ITEM
-- Make it more prominent as the single communication destination
-- ============================================================================

UPDATE menu_visibility
SET
  menu_name = 'Inbox',
  sort_order = 25,  -- Place in communication section
  category = 'communication',
  mobile_style = '{
    "bgColor": "bg-white border-2 border-emerald-200",
    "iconBg": "bg-emerald-100",
    "iconColor": "text-emerald-600",
    "description": "All messages, chat & announcements"
  }'::jsonb,
  updated_at = NOW()
WHERE menu_id = 'message-center';

-- ============================================================================
-- 4. ADD DEPRECATION COMMENTS TO DATABASE
-- ============================================================================

COMMENT ON TABLE chat_migration_mapping IS
  'Migration tracking for chat → mc_conversations. Legacy system deprecated as of Phase 7.';

-- ============================================================================
-- 5. LOG THE DEPRECATION
-- ============================================================================

SELECT 'Migration 263 complete: Old Chat and Announcements menus deprecated. Use unified Inbox.';
