-- ============================================================================
-- 280: Standalone To-Dos System
-- Decoupled from Leadership Hub's project_initiatives/project_tasks tables
-- ============================================================================

-- ============================================================================
-- TABLES
-- ============================================================================

-- 1. Todo Lists (Boards)
CREATE TABLE IF NOT EXISTS todo_lists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  visibility text NOT NULL DEFAULT 'personal' CHECK (visibility IN ('open', 'private', 'personal')),
  color text DEFAULT 'blue-900',
  created_by uuid NOT NULL REFERENCES auth.users(id),
  archived_at timestamptz,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_todo_lists_created_by ON todo_lists(created_by);
CREATE INDEX idx_todo_lists_visibility ON todo_lists(visibility) WHERE archived_at IS NULL;

-- 2. Todo List Members (access control for private lists)
CREATE TABLE IF NOT EXISTS todo_list_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id uuid NOT NULL REFERENCES todo_lists(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id),
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'member')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(list_id, user_id)
);

CREATE INDEX idx_todo_list_members_user ON todo_list_members(user_id);
CREATE INDEX idx_todo_list_members_list ON todo_list_members(list_id);

-- 3. Todo Sections (groups within a list)
CREATE TABLE IF NOT EXISTS todo_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id uuid NOT NULL REFERENCES todo_lists(id) ON DELETE CASCADE,
  title text NOT NULL,
  color text DEFAULT 'blue-900',
  is_collapsed boolean NOT NULL DEFAULT false,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_todo_sections_list ON todo_sections(list_id);

-- 4. Todo Items (tasks) — list_id denormalized for fast RLS checks
CREATE TABLE IF NOT EXISTS todo_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id uuid NOT NULL REFERENCES todo_sections(id) ON DELETE CASCADE,
  list_id uuid NOT NULL REFERENCES todo_lists(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  notes text,
  status text NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'done', 'blocked')),
  assigned_to uuid REFERENCES auth.users(id),
  created_by uuid NOT NULL REFERENCES auth.users(id),
  due_date date,
  is_high_priority boolean NOT NULL DEFAULT false,
  sort_order int NOT NULL DEFAULT 0,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_todo_items_section ON todo_items(section_id);
CREATE INDEX idx_todo_items_list ON todo_items(list_id);
CREATE INDEX idx_todo_items_assigned ON todo_items(assigned_to) WHERE assigned_to IS NOT NULL;
CREATE INDEX idx_todo_items_created_by ON todo_items(created_by);
CREATE INDEX idx_todo_items_status ON todo_items(status) WHERE status != 'done';

-- 5. Todo Item Followers ("involved" people)
CREATE TABLE IF NOT EXISTS todo_item_followers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES todo_items(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(item_id, user_id)
);

CREATE INDEX idx_todo_item_followers_user ON todo_item_followers(user_id);
CREATE INDEX idx_todo_item_followers_item ON todo_item_followers(item_id);

-- 6. Todo Item Comments
CREATE TABLE IF NOT EXISTS todo_item_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES todo_items(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id),
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_todo_item_comments_item ON todo_item_comments(item_id);

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Check if current user can access a todo list
CREATE OR REPLACE FUNCTION is_todo_list_accessible(p_list_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM todo_lists
    WHERE id = p_list_id
      AND archived_at IS NULL
      AND (
        visibility = 'open'
        OR created_by = auth.uid()
        OR EXISTS (
          SELECT 1 FROM todo_list_members
          WHERE list_id = p_list_id AND user_id = auth.uid()
        )
      )
  );
$$;

-- Check if current user is owner of a todo list
CREATE OR REPLACE FUNCTION is_todo_list_owner(p_list_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM todo_lists
    WHERE id = p_list_id AND created_by = auth.uid()
  );
$$;

GRANT EXECUTE ON FUNCTION is_todo_list_accessible(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION is_todo_list_owner(uuid) TO authenticated;

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

ALTER TABLE todo_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE todo_list_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE todo_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE todo_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE todo_item_followers ENABLE ROW LEVEL SECURITY;
ALTER TABLE todo_item_comments ENABLE ROW LEVEL SECURITY;

-- === todo_lists ===
CREATE POLICY "todo_lists_select" ON todo_lists FOR SELECT TO authenticated
  USING (
    is_current_user_admin()
    OR visibility = 'open'
    OR created_by = auth.uid()
    OR EXISTS (SELECT 1 FROM todo_list_members WHERE list_id = id AND user_id = auth.uid())
  );

CREATE POLICY "todo_lists_insert" ON todo_lists FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "todo_lists_update" ON todo_lists FOR UPDATE TO authenticated
  USING (created_by = auth.uid() OR is_current_user_admin());

CREATE POLICY "todo_lists_delete" ON todo_lists FOR DELETE TO authenticated
  USING (created_by = auth.uid() OR is_current_user_admin());

-- === todo_list_members ===
CREATE POLICY "todo_list_members_select" ON todo_list_members FOR SELECT TO authenticated
  USING (is_todo_list_accessible(list_id) OR is_current_user_admin());

CREATE POLICY "todo_list_members_insert" ON todo_list_members FOR INSERT TO authenticated
  WITH CHECK (is_todo_list_owner(list_id) OR is_current_user_admin());

CREATE POLICY "todo_list_members_delete" ON todo_list_members FOR DELETE TO authenticated
  USING (is_todo_list_owner(list_id) OR user_id = auth.uid() OR is_current_user_admin());

-- === todo_sections ===
CREATE POLICY "todo_sections_select" ON todo_sections FOR SELECT TO authenticated
  USING (is_todo_list_accessible(list_id) OR is_current_user_admin());

CREATE POLICY "todo_sections_insert" ON todo_sections FOR INSERT TO authenticated
  WITH CHECK (is_todo_list_accessible(list_id) OR is_current_user_admin());

CREATE POLICY "todo_sections_update" ON todo_sections FOR UPDATE TO authenticated
  USING (is_todo_list_accessible(list_id) OR is_current_user_admin());

CREATE POLICY "todo_sections_delete" ON todo_sections FOR DELETE TO authenticated
  USING (is_todo_list_owner(list_id) OR is_current_user_admin());

-- === todo_items ===
CREATE POLICY "todo_items_select" ON todo_items FOR SELECT TO authenticated
  USING (
    is_todo_list_accessible(list_id)
    OR assigned_to = auth.uid()
    OR EXISTS (SELECT 1 FROM todo_item_followers WHERE item_id = id AND user_id = auth.uid())
    OR is_current_user_admin()
  );

CREATE POLICY "todo_items_insert" ON todo_items FOR INSERT TO authenticated
  WITH CHECK (is_todo_list_accessible(list_id) OR is_current_user_admin());

CREATE POLICY "todo_items_update" ON todo_items FOR UPDATE TO authenticated
  USING (is_todo_list_accessible(list_id) OR is_current_user_admin());

CREATE POLICY "todo_items_delete" ON todo_items FOR DELETE TO authenticated
  USING (
    created_by = auth.uid()
    OR is_todo_list_owner(list_id)
    OR is_current_user_admin()
  );

-- === todo_item_followers ===
CREATE POLICY "todo_item_followers_select" ON todo_item_followers FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM todo_items WHERE id = item_id AND is_todo_list_accessible(list_id))
    OR is_current_user_admin()
  );

CREATE POLICY "todo_item_followers_insert" ON todo_item_followers FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM todo_items WHERE id = item_id AND is_todo_list_accessible(list_id))
    OR is_current_user_admin()
  );

CREATE POLICY "todo_item_followers_delete" ON todo_item_followers FOR DELETE TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM todo_items ti WHERE ti.id = item_id AND is_todo_list_owner(ti.list_id))
    OR is_current_user_admin()
  );

-- === todo_item_comments ===
CREATE POLICY "todo_item_comments_select" ON todo_item_comments FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM todo_items WHERE id = item_id AND is_todo_list_accessible(list_id))
    OR is_current_user_admin()
  );

CREATE POLICY "todo_item_comments_insert" ON todo_item_comments FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND (
      EXISTS (SELECT 1 FROM todo_items WHERE id = item_id AND is_todo_list_accessible(list_id))
      OR is_current_user_admin()
    )
  );

CREATE POLICY "todo_item_comments_delete" ON todo_item_comments FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR is_current_user_admin());

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_todo_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_todo_lists_updated_at
  BEFORE UPDATE ON todo_lists
  FOR EACH ROW EXECUTE FUNCTION update_todo_updated_at();

CREATE TRIGGER trg_todo_sections_updated_at
  BEFORE UPDATE ON todo_sections
  FOR EACH ROW EXECUTE FUNCTION update_todo_updated_at();

CREATE TRIGGER trg_todo_items_updated_at
  BEFORE UPDATE ON todo_items
  FOR EACH ROW EXECUTE FUNCTION update_todo_updated_at();

CREATE TRIGGER trg_todo_item_comments_updated_at
  BEFORE UPDATE ON todo_item_comments
  FOR EACH ROW EXECUTE FUNCTION update_todo_updated_at();

-- Auto-set completed_at when status changes to 'done'
CREATE OR REPLACE FUNCTION set_todo_item_completed_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status = 'done' AND (OLD.status IS DISTINCT FROM 'done') THEN
    NEW.completed_at = now();
  ELSIF NEW.status != 'done' AND OLD.status = 'done' THEN
    NEW.completed_at = NULL;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_todo_items_completed_at
  BEFORE UPDATE ON todo_items
  FOR EACH ROW EXECUTE FUNCTION set_todo_item_completed_at();

-- Auto-insert list creator as owner member
CREATE OR REPLACE FUNCTION auto_add_todo_list_owner()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO todo_list_members (list_id, user_id, role)
  VALUES (NEW.id, NEW.created_by, 'owner')
  ON CONFLICT (list_id, user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_todo_list_auto_owner
  AFTER INSERT ON todo_lists
  FOR EACH ROW EXECUTE FUNCTION auto_add_todo_list_owner();

-- ============================================================================
-- RPC: Ensure Default Todo List
-- Creates a "Personal" list + "To Do" section if user has no lists
-- ============================================================================

CREATE OR REPLACE FUNCTION ensure_default_todo_list()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_list_id uuid;
  v_section_id uuid;
  v_list_count int;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Check if user already has any lists
  SELECT count(*) INTO v_list_count
  FROM todo_lists
  WHERE created_by = v_user_id AND archived_at IS NULL;

  IF v_list_count > 0 THEN
    -- Return existing first list
    SELECT id INTO v_list_id
    FROM todo_lists
    WHERE created_by = v_user_id AND archived_at IS NULL
    ORDER BY sort_order, created_at
    LIMIT 1;

    RETURN json_build_object('list_id', v_list_id, 'created', false);
  END IF;

  -- Create default personal list
  INSERT INTO todo_lists (title, visibility, color, created_by, sort_order)
  VALUES ('Personal', 'personal', 'blue-900', v_user_id, 0)
  RETURNING id INTO v_list_id;

  -- Create default section
  INSERT INTO todo_sections (list_id, title, color, sort_order)
  VALUES (v_list_id, 'To Do', 'blue-900', 0)
  RETURNING id INTO v_section_id;

  RETURN json_build_object('list_id', v_list_id, 'section_id', v_section_id, 'created', true);
END;
$$;

GRANT EXECUTE ON FUNCTION ensure_default_todo_list() TO authenticated;
