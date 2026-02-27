-- ============================================================================
-- 280b: Fix infinite recursion in todo RLS policies
--
-- Problem: todo_items SELECT checks todo_item_followers, which checks
-- todo_items back → infinite loop. Same issue for todo_item_comments.
-- Fix: SECURITY DEFINER helpers that bypass RLS for cross-table checks.
-- ============================================================================

-- Helper: Check if user follows a todo item (bypasses RLS on todo_item_followers)
CREATE OR REPLACE FUNCTION is_todo_item_follower(p_item_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM todo_item_followers
    WHERE item_id = p_item_id AND user_id = auth.uid()
  );
$$;

-- Helper: Check if a todo item belongs to an accessible list (bypasses RLS on todo_items)
CREATE OR REPLACE FUNCTION is_todo_item_in_accessible_list(p_item_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM todo_items
    WHERE id = p_item_id AND is_todo_list_accessible(list_id)
  );
$$;

-- Helper: Get list_id from a todo item (bypasses RLS on todo_items)
CREATE OR REPLACE FUNCTION get_todo_item_list_id(p_item_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT list_id FROM todo_items WHERE id = p_item_id;
$$;

GRANT EXECUTE ON FUNCTION is_todo_item_follower(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION is_todo_item_in_accessible_list(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_todo_item_list_id(uuid) TO authenticated;

-- ============================================================================
-- Fix todo_items SELECT — replace direct todo_item_followers query with helper
-- ============================================================================
DROP POLICY "todo_items_select" ON todo_items;
CREATE POLICY "todo_items_select" ON todo_items FOR SELECT TO authenticated
  USING (
    is_todo_list_accessible(list_id)
    OR assigned_to = auth.uid()
    OR is_todo_item_follower(id)
    OR is_current_user_admin()
  );

-- ============================================================================
-- Fix todo_item_followers — replace direct todo_items queries with helpers
-- ============================================================================
DROP POLICY "todo_item_followers_select" ON todo_item_followers;
CREATE POLICY "todo_item_followers_select" ON todo_item_followers FOR SELECT TO authenticated
  USING (is_todo_item_in_accessible_list(item_id) OR is_current_user_admin());

DROP POLICY "todo_item_followers_insert" ON todo_item_followers;
CREATE POLICY "todo_item_followers_insert" ON todo_item_followers FOR INSERT TO authenticated
  WITH CHECK (is_todo_item_in_accessible_list(item_id) OR is_current_user_admin());

DROP POLICY "todo_item_followers_delete" ON todo_item_followers;
CREATE POLICY "todo_item_followers_delete" ON todo_item_followers FOR DELETE TO authenticated
  USING (
    user_id = auth.uid()
    OR is_todo_list_owner(get_todo_item_list_id(item_id))
    OR is_current_user_admin()
  );

-- ============================================================================
-- Fix todo_item_comments — replace direct todo_items queries with helpers
-- ============================================================================
DROP POLICY "todo_item_comments_select" ON todo_item_comments;
CREATE POLICY "todo_item_comments_select" ON todo_item_comments FOR SELECT TO authenticated
  USING (is_todo_item_in_accessible_list(item_id) OR is_current_user_admin());

DROP POLICY "todo_item_comments_insert" ON todo_item_comments;
CREATE POLICY "todo_item_comments_insert" ON todo_item_comments FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND (is_todo_item_in_accessible_list(item_id) OR is_current_user_admin())
  );
