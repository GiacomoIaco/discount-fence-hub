-- ============================================================================
-- RESTORE CHAT AND ANNOUNCEMENTS MENUS
-- Fixes issue where personal chat/announcements were incorrectly hidden
-- Message Center (SMS admin) and Chat (personal) should remain separate
-- ============================================================================

-- 1. RESTORE DIRECT MESSAGES (CHAT) MENU ITEM
UPDATE menu_visibility
SET
  show_on_desktop = true,
  show_on_tablet = true,
  show_on_mobile = true,
  updated_at = NOW()
WHERE menu_id = 'direct-messages';

-- 2. RESTORE TEAM COMMUNICATION (ANNOUNCEMENTS) MENU ITEM
UPDATE menu_visibility
SET
  show_on_desktop = true,
  show_on_tablet = true,
  show_on_mobile = true,
  updated_at = NOW()
WHERE menu_id = 'team-communication';

-- 3. REVERT MESSAGE CENTER NAME (keep it as Messages, not Inbox)
UPDATE menu_visibility
SET
  menu_name = 'Messages',
  updated_at = NOW()
WHERE menu_id = 'message-center';

SELECT 'Migration 264 complete: Chat and Announcements menus restored';
