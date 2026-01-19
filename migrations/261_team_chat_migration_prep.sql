-- ============================================================================
-- UNIFIED COMMUNICATION HUB - PHASE 5: Team Chat Migration Preparation
-- This migration prepares infrastructure for migrating direct_messages to mc_messages
-- Actual data migration will be done in a separate step after testing
-- ============================================================================

-- ============================================================================
-- 1. ADD 'in_app' CHANNEL SUPPORT IF NOT EXISTS
-- ============================================================================

-- Ensure 'in_app' is a valid message channel
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum
    WHERE enumlabel = 'in_app'
      AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'message_channel')
  ) THEN
    ALTER TYPE message_channel ADD VALUE 'in_app';
  END IF;
END
$$;

-- ============================================================================
-- 2. ADD TEAM CONVERSATION TYPE IF NOT EXISTS
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum
    WHERE enumlabel = 'team_direct'
      AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'conversation_type')
  ) THEN
    -- Already exists from mc_conversations, skip
    NULL;
  END IF;
END
$$;

-- ============================================================================
-- 3. CREATE MAPPING TABLE FOR MIGRATION TRACKING
-- ============================================================================

CREATE TABLE IF NOT EXISTS chat_migration_mapping (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_conversation_id UUID NOT NULL UNIQUE,
  mc_conversation_id UUID NOT NULL UNIQUE REFERENCES mc_conversations(id) ON DELETE CASCADE,
  migrated_at TIMESTAMPTZ DEFAULT NOW(),
  message_count INT DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_chat_migration_legacy ON chat_migration_mapping(legacy_conversation_id);

-- ============================================================================
-- 4. CREATE HELPER FUNCTION TO MIGRATE A SINGLE CONVERSATION
-- ============================================================================

CREATE OR REPLACE FUNCTION migrate_conversation_to_mc(p_legacy_conv_id UUID)
RETURNS UUID AS $$
DECLARE
  v_mc_conv_id UUID;
  v_participant_count INT;
  v_is_group BOOLEAN;
  v_title TEXT;
  v_migrated_count INT := 0;
BEGIN
  -- Check if already migrated
  SELECT mc_conversation_id INTO v_mc_conv_id
  FROM chat_migration_mapping
  WHERE legacy_conversation_id = p_legacy_conv_id;

  IF v_mc_conv_id IS NOT NULL THEN
    RETURN v_mc_conv_id;
  END IF;

  -- Get participant count to determine if group
  SELECT COUNT(*) INTO v_participant_count
  FROM conversation_participants
  WHERE conversation_id = p_legacy_conv_id;

  v_is_group := v_participant_count > 2;

  -- Get title from group_conversations if exists (table may not exist)
  BEGIN
    EXECUTE 'SELECT name FROM group_conversations WHERE conversation_id = $1'
    INTO v_title
    USING p_legacy_conv_id;
  EXCEPTION WHEN undefined_table THEN
    v_title := NULL;
  END;

  -- Create mc_conversation
  INSERT INTO mc_conversations (
    conversation_type,
    title,
    is_group,
    participant_count,
    status,
    created_at
  )
  SELECT
    CASE WHEN v_is_group THEN 'team_group'::conversation_type ELSE 'team_direct'::conversation_type END,
    v_title,
    v_is_group,
    v_participant_count,
    'active',
    COALESCE(c.created_at, NOW())
  FROM conversations c
  WHERE c.id = p_legacy_conv_id
  RETURNING id INTO v_mc_conv_id;

  -- Migrate participants
  INSERT INTO mc_conversation_participants (
    conversation_id,
    contact_id,
    role,
    is_muted,
    joined_at
  )
  SELECT
    v_mc_conv_id,
    mc.id,
    'member',
    COALESCE(cp.is_archived, false),
    cp.joined_at
  FROM conversation_participants cp
  JOIN mc_contacts mc ON mc.employee_id = cp.user_id
  WHERE cp.conversation_id = p_legacy_conv_id;

  -- Migrate messages
  INSERT INTO mc_messages (
    conversation_id,
    channel,
    direction,
    body,
    from_user_id,
    status,
    created_at
  )
  SELECT
    v_mc_conv_id,
    'in_app',
    'outbound',
    dm.content,
    dm.sender_id,
    'sent',
    dm.created_at
  FROM direct_messages dm
  WHERE dm.conversation_id = p_legacy_conv_id
    AND dm.is_deleted = false;

  GET DIAGNOSTICS v_migrated_count = ROW_COUNT;

  -- Update mc_conversation with last message info
  UPDATE mc_conversations
  SET
    last_message_at = (
      SELECT MAX(created_at) FROM mc_messages WHERE conversation_id = v_mc_conv_id
    ),
    last_message_preview = (
      SELECT body FROM mc_messages
      WHERE conversation_id = v_mc_conv_id
      ORDER BY created_at DESC LIMIT 1
    )
  WHERE id = v_mc_conv_id;

  -- Record the migration
  INSERT INTO chat_migration_mapping (legacy_conversation_id, mc_conversation_id, message_count)
  VALUES (p_legacy_conv_id, v_mc_conv_id, v_migrated_count);

  RETURN v_mc_conv_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 5. CREATE VIEW FOR UNIFIED TEAM CONVERSATIONS
-- Shows both migrated (mc_conversations) and legacy (conversations) data
-- Note: We only include mc_conversations here since legacy system varies by installation
-- ============================================================================

CREATE OR REPLACE VIEW unified_team_conversations AS
-- Team conversations from mc_conversations
SELECT
  mc.id,
  mc.conversation_type::text as conversation_type,
  mc.title,
  mc.is_group,
  mc.participant_count,
  mc.status::text as status,
  mc.last_message_at,
  mc.last_message_preview,
  mc.unread_count,
  mc.created_at,
  'mc' as source
FROM mc_conversations mc
WHERE mc.conversation_type IN ('team_direct', 'team_group')
  AND mc.status = 'active';

-- ============================================================================
-- 6. CREATE FUNCTION TO GET USER'S TEAM CONVERSATIONS (MC ONLY)
-- ============================================================================

CREATE OR REPLACE FUNCTION get_unified_team_conversations(p_user_id UUID DEFAULT NULL)
RETURNS TABLE (
  id UUID,
  conversation_type TEXT,
  title TEXT,
  is_group BOOLEAN,
  participant_count INT,
  status TEXT,
  last_message_at TIMESTAMPTZ,
  last_message_preview TEXT,
  unread_count INT,
  created_at TIMESTAMPTZ,
  source TEXT,
  participants JSONB
) AS $$
DECLARE
  v_user_id UUID := COALESCE(p_user_id, auth.uid());
BEGIN
  RETURN QUERY
  SELECT
    mc.id,
    mc.conversation_type::TEXT,
    mc.title,
    mc.is_group,
    mc.participant_count::INT,
    mc.status::TEXT,
    mc.last_message_at,
    mc.last_message_preview,
    COALESCE(mc.unread_count, 0)::INT,
    mc.created_at,
    'mc'::TEXT as source,
    (
      SELECT jsonb_agg(jsonb_build_object(
        'user_id', up.id,
        'full_name', up.full_name,
        'avatar_url', up.avatar_url
      ))
      FROM mc_conversation_participants mcp
      JOIN mc_contacts mco ON mco.id = mcp.contact_id
      JOIN user_profiles up ON up.id = mco.employee_id
      WHERE mcp.conversation_id = mc.id
        AND mcp.left_at IS NULL
    ) as participants
  FROM mc_conversations mc
  WHERE mc.conversation_type IN ('team_direct', 'team_group')
    AND mc.status = 'active'
    AND EXISTS (
      SELECT 1
      FROM mc_conversation_participants mcp
      JOIN mc_contacts mco ON mco.id = mcp.contact_id
      WHERE mcp.conversation_id = mc.id
        AND mco.employee_id = v_user_id
        AND mcp.left_at IS NULL
    )
  ORDER BY mc.last_message_at DESC NULLS LAST;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- ============================================================================
-- 7. COMMENTS
-- ============================================================================

COMMENT ON TABLE chat_migration_mapping IS 'Tracks which legacy conversations have been migrated to mc_conversations';
COMMENT ON FUNCTION migrate_conversation_to_mc IS 'Migrates a single legacy conversation to mc_conversations';
COMMENT ON VIEW unified_team_conversations IS 'Unified view of team conversations from both legacy and mc systems';
COMMENT ON FUNCTION get_unified_team_conversations IS 'Returns all team conversations for a user, from both systems';

SELECT 'Migration 261 complete: Team chat migration infrastructure ready';
