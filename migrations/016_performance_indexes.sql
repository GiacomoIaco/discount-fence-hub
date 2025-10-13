-- ============================================
-- PERFORMANCE OPTIMIZATION INDEXES
-- Created: 2025-10-12
-- Purpose: Add indexes for frequently queried columns to improve performance
-- CORRECTED: Uses actual schema column names (stage, not status)
-- ============================================

-- ============================================
-- REQUESTS TABLE INDEXES
-- ============================================

-- Index for filtering requests by stage (used in dashboard views)
CREATE INDEX IF NOT EXISTS idx_requests_stage_created
  ON requests(stage, created_at DESC)
  WHERE stage IS NOT NULL;

-- Index for filtering requests by submitter (user's own requests)
CREATE INDEX IF NOT EXISTS idx_requests_submitter_created
  ON requests(submitter_id, created_at DESC)
  WHERE submitter_id IS NOT NULL;

-- Index for filtering by assigned user (operations viewing assigned requests)
CREATE INDEX IF NOT EXISTS idx_requests_assigned_created
  ON requests(assigned_to, created_at DESC)
  WHERE assigned_to IS NOT NULL;

-- Note: Pinned requests use a separate request_pins table (migration 005)
-- No index needed on requests table itself

-- Index for request type filtering
CREATE INDEX IF NOT EXISTS idx_requests_type_created
  ON requests(request_type, created_at DESC);

-- Index for urgency filtering
CREATE INDEX IF NOT EXISTS idx_requests_urgency
  ON requests(urgency)
  WHERE urgency IS NOT NULL;

-- ============================================
-- REQUEST_NOTES TABLE INDEXES
-- ============================================

-- Index for fetching notes for a specific request (most common query)
CREATE INDEX IF NOT EXISTS idx_request_notes_request_created
  ON request_notes(request_id, created_at DESC);

-- Index for user's own notes
CREATE INDEX IF NOT EXISTS idx_request_notes_user_created
  ON request_notes(user_id, created_at DESC)
  WHERE user_id IS NOT NULL;

-- Index for note type filtering
CREATE INDEX IF NOT EXISTS idx_request_notes_type
  ON request_notes(note_type)
  WHERE note_type IS NOT NULL;

-- ============================================
-- REQUEST_VIEWS TABLE INDEXES (if table exists from migration 010)
-- ============================================

-- Index for checking if user has viewed a request
CREATE INDEX IF NOT EXISTS idx_request_views_user_request
  ON request_views(user_id, request_id);

-- Index for request view counts (uses last_viewed_at column)
CREATE INDEX IF NOT EXISTS idx_request_views_request_last_viewed
  ON request_views(request_id, last_viewed_at DESC);

-- ============================================
-- REQUEST_ACTIVITY_LOG TABLE INDEXES
-- ============================================

-- Index for fetching activity for a specific request
CREATE INDEX IF NOT EXISTS idx_activity_log_request_created
  ON request_activity_log(request_id, created_at DESC);

-- Index for filtering by activity action
CREATE INDEX IF NOT EXISTS idx_activity_log_action
  ON request_activity_log(action, created_at DESC)
  WHERE action IS NOT NULL;

-- Index for user's activity
CREATE INDEX IF NOT EXISTS idx_activity_log_user_created
  ON request_activity_log(user_id, created_at DESC)
  WHERE user_id IS NOT NULL;

-- ============================================
-- DIRECT_MESSAGES TABLE INDEXES
-- ============================================

-- Index for fetching messages in a conversation (most common query)
CREATE INDEX IF NOT EXISTS idx_direct_messages_conversation_created
  ON direct_messages(conversation_id, created_at DESC);

-- Index for sender's messages
CREATE INDEX IF NOT EXISTS idx_direct_messages_sender_created
  ON direct_messages(sender_id, created_at DESC);

-- Note: Read status is tracked via conversation_participants.last_read_at, not on direct_messages

-- ============================================
-- CONVERSATION_PARTICIPANTS TABLE INDEXES
-- ============================================

-- Index for user's conversations
CREATE INDEX IF NOT EXISTS idx_conversation_participants_user_conv
  ON conversation_participants(user_id, conversation_id);

-- Index for finding participants in a conversation
CREATE INDEX IF NOT EXISTS idx_conversation_participants_conv_user
  ON conversation_participants(conversation_id, user_id);

-- Index for last read tracking (for unread counts)
CREATE INDEX IF NOT EXISTS idx_conversation_participants_last_read
  ON conversation_participants(user_id, last_read_at DESC);

-- ============================================
-- CONVERSATIONS TABLE INDEXES
-- ============================================

-- Index for recent conversations
CREATE INDEX IF NOT EXISTS idx_conversations_last_message
  ON conversations(last_message_at DESC);

-- Index for updated conversations
CREATE INDEX IF NOT EXISTS idx_conversations_updated
  ON conversations(updated_at DESC);

-- ============================================
-- REQUEST_ATTACHMENTS TABLE INDEXES (if exists)
-- ============================================

-- Index for fetching attachments for a request
CREATE INDEX IF NOT EXISTS idx_request_attachments_request_uploaded
  ON request_attachments(request_id, uploaded_at DESC);

-- Index for user's uploaded files
CREATE INDEX IF NOT EXISTS idx_request_attachments_uploader_uploaded
  ON request_attachments(user_id, uploaded_at DESC)
  WHERE user_id IS NOT NULL;

-- Index for file type filtering
CREATE INDEX IF NOT EXISTS idx_request_attachments_file_type
  ON request_attachments(file_type)
  WHERE file_type IS NOT NULL;

-- ============================================
-- USER_PROFILES TABLE INDEXES
-- ============================================

-- Index for filtering users by role
CREATE INDEX IF NOT EXISTS idx_user_profiles_role_active
  ON user_profiles(role)
  WHERE is_active = TRUE;

-- Index for active users
CREATE INDEX IF NOT EXISTS idx_user_profiles_active
  ON user_profiles(is_active, full_name)
  WHERE is_active = TRUE;

-- Index for email lookup (unique column, but index helps)
CREATE INDEX IF NOT EXISTS idx_user_profiles_email_lower
  ON user_profiles(LOWER(email));

-- Full-text search index for user names
CREATE INDEX IF NOT EXISTS idx_user_profiles_name_search
  ON user_profiles USING gin(to_tsvector('english', COALESCE(full_name, '')));

-- ============================================
-- USER_INVITATIONS TABLE INDEXES (if exists)
-- ============================================

-- Index for pending invitations (uses is_used = false, not status)
CREATE INDEX IF NOT EXISTS idx_user_invitations_pending
  ON user_invitations(is_used, invited_at DESC)
  WHERE is_used = false;

-- Index for email lookup
CREATE INDEX IF NOT EXISTS idx_user_invitations_email_lower
  ON user_invitations(LOWER(email));

-- Index for inviter's sent invitations
CREATE INDEX IF NOT EXISTS idx_user_invitations_inviter_created
  ON user_invitations(invited_by, invited_at DESC)
  WHERE invited_by IS NOT NULL;

-- ============================================
-- RECORDINGS TABLE INDEXES (Sales Coach - if exists from migration 014)
-- ============================================

-- Index for user's recordings (no deleted_at column, uses uploaded_at not date)
CREATE INDEX IF NOT EXISTS idx_recordings_user_date
  ON recordings(user_id, uploaded_at DESC);

-- Index for status filtering (uses uploaded_at not date)
CREATE INDEX IF NOT EXISTS idx_recordings_status_date
  ON recordings(status, uploaded_at DESC);

-- Index for date range queries (uses uploaded_at not date)
CREATE INDEX IF NOT EXISTS idx_recordings_date_active
  ON recordings(uploaded_at DESC);

-- Note: recording_analysis, recording_insights, and recording_goals tables do not exist
-- Analysis data is stored as JSONB within the recordings table itself (migration 014)

-- ============================================
-- REQUEST_PINS TABLE INDEXES (from migration 005)
-- ============================================

-- Index for user's pinned requests
CREATE INDEX IF NOT EXISTS idx_request_pins_user_pinned
  ON request_pins(user_id, pinned_at DESC);

-- ============================================
-- REQUEST_ASSIGNMENT_RULES INDEXES (if exists from migration 002)
-- ============================================

-- Index for active assignment rules
CREATE INDEX IF NOT EXISTS idx_assignment_rules_type_active
  ON request_assignment_rules(request_type, priority DESC)
  WHERE is_active = TRUE;

-- ============================================
-- ANALYZE TABLE STATISTICS
-- Helps Postgres query planner make better decisions
-- ============================================

-- Analyze core tables (skip if table doesn't exist)
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'requests') THEN
    ANALYZE requests;
  END IF;

  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'request_notes') THEN
    ANALYZE request_notes;
  END IF;

  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'request_views') THEN
    ANALYZE request_views;
  END IF;

  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'request_activity_log') THEN
    ANALYZE request_activity_log;
  END IF;

  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'direct_messages') THEN
    ANALYZE direct_messages;
  END IF;

  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'conversations') THEN
    ANALYZE conversations;
  END IF;

  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'request_attachments') THEN
    ANALYZE request_attachments;
  END IF;

  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'user_profiles') THEN
    ANALYZE user_profiles;
  END IF;

  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'user_invitations') THEN
    ANALYZE user_invitations;
  END IF;

  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'recordings') THEN
    ANALYZE recordings;
  END IF;
END $$;

-- ============================================
-- PERFORMANCE NOTES
-- ============================================

/*
EXPECTED IMPROVEMENTS:

1. Request queries (getMyRequests, getRequestsByStage):
   - Before: Full table scan (slow with 1000+ requests)
   - After: Index scan (10-50x faster)

2. Message history (getMessages):
   - Before: Full table scan per conversation
   - After: Index scan (5-10x faster)

3. User search/filtering:
   - Before: Full table scan
   - After: Index scan + full-text search (50-100x faster)

4. Activity logs:
   - Before: Sequential scan
   - After: Index scan (20-30x faster)

5. Request notes:
   - Before: Full scan to find notes for request
   - After: Index lookup (10x faster)

MONITORING:
- Monitor index usage: SELECT * FROM pg_stat_user_indexes WHERE schemaname = 'public';
- Check index size: SELECT pg_size_pretty(pg_indexes_size('requests'));
- Unused indexes: Check pg_stat_user_indexes.idx_scan = 0 after 30 days

MAINTENANCE:
- Indexes auto-update on INSERT/UPDATE/DELETE
- Run ANALYZE periodically (weekly) for large tables
- VACUUM periodically to reclaim space
*/
