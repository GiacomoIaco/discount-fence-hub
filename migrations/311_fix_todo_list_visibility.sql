-- ============================================================================
-- 311: Fix todo list visibility bugs
--
-- Bug 1: todo_lists_select policy has broken column reference:
--   `WHERE list_id = id` resolves to `todo_list_members.list_id = todo_list_members.id`
--   instead of `todo_list_members.list_id = todo_lists.id`.
--   This means the membership check ALWAYS fails for non-admin users.
--
-- Bug 2: is_current_user_admin() bypass in todo policies means admins/owners
--   see ALL todo lists including other users' Personal/Private lists.
--   This is wrong for a personal productivity tool.
--
-- Fix: Use is_todo_list_accessible() SECURITY DEFINER helper (which correctly
-- checks membership by parameter, not ambiguous column name) and remove
-- admin bypass from SELECT policies.
-- ============================================================================

-- ============================================================================
-- 1. Fix todo_lists SELECT — use helper function, remove admin bypass
-- ============================================================================
DROP POLICY "todo_lists_select" ON todo_lists;
CREATE POLICY "todo_lists_select" ON todo_lists FOR SELECT TO authenticated
  USING (
    visibility = 'open'
    OR created_by = auth.uid()
    OR is_todo_list_accessible(id)
  );

-- ============================================================================
-- 2. Fix todo_list_members SELECT — remove admin bypass
-- ============================================================================
DROP POLICY "todo_list_members_select" ON todo_list_members;
CREATE POLICY "todo_list_members_select" ON todo_list_members FOR SELECT TO authenticated
  USING (is_todo_list_accessible(list_id));

-- ============================================================================
-- 3. Fix todo_sections SELECT — remove admin bypass
-- ============================================================================
DROP POLICY "todo_sections_select" ON todo_sections;
CREATE POLICY "todo_sections_select" ON todo_sections FOR SELECT TO authenticated
  USING (is_todo_list_accessible(list_id));

-- ============================================================================
-- 4. Fix todo_items SELECT — remove admin bypass, keep assigned/follower access
-- ============================================================================
DROP POLICY "todo_items_select" ON todo_items;
CREATE POLICY "todo_items_select" ON todo_items FOR SELECT TO authenticated
  USING (
    is_todo_list_accessible(list_id)
    OR assigned_to = auth.uid()
    OR is_todo_item_follower(id)
  );

-- ============================================================================
-- 5. Fix todo_item_followers SELECT — remove admin bypass
-- ============================================================================
DROP POLICY "todo_item_followers_select" ON todo_item_followers;
CREATE POLICY "todo_item_followers_select" ON todo_item_followers FOR SELECT TO authenticated
  USING (is_todo_item_in_accessible_list(item_id));

-- ============================================================================
-- 6. Fix todo_item_comments SELECT — remove admin bypass
-- ============================================================================
DROP POLICY "todo_item_comments_select" ON todo_item_comments;
CREATE POLICY "todo_item_comments_select" ON todo_item_comments FOR SELECT TO authenticated
  USING (is_todo_item_in_accessible_list(item_id));

-- ============================================================================
-- 7. Fix INSERT/UPDATE/DELETE policies — remove admin bypass from write ops too
--    (access should be based on list ownership/membership, not app-wide admin role)
-- ============================================================================

-- todo_sections: insert/update based on list access, delete by list owner only
DROP POLICY "todo_sections_insert" ON todo_sections;
CREATE POLICY "todo_sections_insert" ON todo_sections FOR INSERT TO authenticated
  WITH CHECK (is_todo_list_accessible(list_id));

DROP POLICY "todo_sections_update" ON todo_sections;
CREATE POLICY "todo_sections_update" ON todo_sections FOR UPDATE TO authenticated
  USING (is_todo_list_accessible(list_id));

DROP POLICY "todo_sections_delete" ON todo_sections;
CREATE POLICY "todo_sections_delete" ON todo_sections FOR DELETE TO authenticated
  USING (is_todo_list_owner(list_id));

-- todo_items: insert/update based on list access, delete by creator or list owner
DROP POLICY "todo_items_insert" ON todo_items;
CREATE POLICY "todo_items_insert" ON todo_items FOR INSERT TO authenticated
  WITH CHECK (is_todo_list_accessible(list_id));

DROP POLICY "todo_items_update" ON todo_items;
CREATE POLICY "todo_items_update" ON todo_items FOR UPDATE TO authenticated
  USING (is_todo_list_accessible(list_id));

DROP POLICY "todo_items_delete" ON todo_items;
CREATE POLICY "todo_items_delete" ON todo_items FOR DELETE TO authenticated
  USING (created_by = auth.uid() OR is_todo_list_owner(list_id));

-- todo_list_members: insert by list owner, delete by owner or self-remove
DROP POLICY "todo_list_members_insert" ON todo_list_members;
CREATE POLICY "todo_list_members_insert" ON todo_list_members FOR INSERT TO authenticated
  WITH CHECK (is_todo_list_owner(list_id));

DROP POLICY "todo_list_members_delete" ON todo_list_members;
CREATE POLICY "todo_list_members_delete" ON todo_list_members FOR DELETE TO authenticated
  USING (is_todo_list_owner(list_id) OR user_id = auth.uid());

-- todo_item_followers: insert by list member, delete by self or list owner
DROP POLICY "todo_item_followers_insert" ON todo_item_followers;
CREATE POLICY "todo_item_followers_insert" ON todo_item_followers FOR INSERT TO authenticated
  WITH CHECK (is_todo_item_in_accessible_list(item_id));

DROP POLICY "todo_item_followers_delete" ON todo_item_followers;
CREATE POLICY "todo_item_followers_delete" ON todo_item_followers FOR DELETE TO authenticated
  USING (
    user_id = auth.uid()
    OR is_todo_list_owner(get_todo_item_list_id(item_id))
  );

-- todo_item_comments: insert by list member (own user_id), delete own comments
DROP POLICY "todo_item_comments_insert" ON todo_item_comments;
CREATE POLICY "todo_item_comments_insert" ON todo_item_comments FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND is_todo_item_in_accessible_list(item_id)
  );

DROP POLICY "todo_item_comments_delete" ON todo_item_comments;
CREATE POLICY "todo_item_comments_delete" ON todo_item_comments FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- todo_lists: update/delete by creator only (no admin bypass)
DROP POLICY "todo_lists_update" ON todo_lists;
CREATE POLICY "todo_lists_update" ON todo_lists FOR UPDATE TO authenticated
  USING (created_by = auth.uid());

DROP POLICY "todo_lists_delete" ON todo_lists;
CREATE POLICY "todo_lists_delete" ON todo_lists FOR DELETE TO authenticated
  USING (created_by = auth.uid());

-- ============================================================================
-- 8. Fix todo_item_attachments — remove admin bypass
-- ============================================================================
DROP POLICY "todo_item_attachments_select" ON todo_item_attachments;
CREATE POLICY "todo_item_attachments_select" ON todo_item_attachments FOR SELECT TO authenticated
  USING (is_todo_item_in_accessible_list(item_id));

DROP POLICY "todo_item_attachments_insert" ON todo_item_attachments;
CREATE POLICY "todo_item_attachments_insert" ON todo_item_attachments FOR INSERT TO authenticated
  WITH CHECK (uploaded_by = auth.uid() AND is_todo_item_in_accessible_list(item_id));

DROP POLICY "todo_item_attachments_delete" ON todo_item_attachments;
CREATE POLICY "todo_item_attachments_delete" ON todo_item_attachments FOR DELETE TO authenticated
  USING (uploaded_by = auth.uid());
