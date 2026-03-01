-- ============================================================================
-- 285: TODO CHECKLIST / SUBTASKS
-- ============================================================================

-- Checklist items table (lightweight subtasks within a todo item)
CREATE TABLE IF NOT EXISTS todo_checklist_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_item_id uuid NOT NULL REFERENCES todo_items(id) ON DELETE CASCADE,
  title text NOT NULL,
  is_completed boolean NOT NULL DEFAULT false,
  assigned_to uuid REFERENCES auth.users(id),
  sort_order int NOT NULL DEFAULT 0,
  completed_at timestamptz,
  completed_by uuid REFERENCES auth.users(id),
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_checklist_items_parent ON todo_checklist_items(parent_item_id);
CREATE INDEX IF NOT EXISTS idx_checklist_items_assigned ON todo_checklist_items(assigned_to) WHERE assigned_to IS NOT NULL;

-- Auto-set completed_at/completed_by on toggle
CREATE OR REPLACE FUNCTION set_checklist_item_completed()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_completed = true AND (OLD IS NULL OR OLD.is_completed IS DISTINCT FROM true) THEN
    NEW.completed_at = now();
    NEW.completed_by = auth.uid();
  ELSIF NEW.is_completed = false AND (OLD IS NOT NULL AND OLD.is_completed = true) THEN
    NEW.completed_at = NULL;
    NEW.completed_by = NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_checklist_item_completed
  BEFORE INSERT OR UPDATE OF is_completed ON todo_checklist_items
  FOR EACH ROW EXECUTE FUNCTION set_checklist_item_completed();

-- Updated_at trigger
CREATE TRIGGER trg_checklist_items_updated_at
  BEFORE UPDATE ON todo_checklist_items
  FOR EACH ROW EXECUTE FUNCTION update_todo_updated_at();

-- RLS
ALTER TABLE todo_checklist_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "checklist_items_select" ON todo_checklist_items FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM todo_items ti WHERE ti.id = parent_item_id AND is_todo_list_accessible(ti.list_id))
  );

CREATE POLICY "checklist_items_insert" ON todo_checklist_items FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM todo_items ti WHERE ti.id = parent_item_id AND is_todo_list_accessible(ti.list_id))
  );

CREATE POLICY "checklist_items_update" ON todo_checklist_items FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM todo_items ti WHERE ti.id = parent_item_id AND is_todo_list_accessible(ti.list_id))
  );

CREATE POLICY "checklist_items_delete" ON todo_checklist_items FOR DELETE TO authenticated
  USING (
    created_by = auth.uid()
    OR EXISTS (SELECT 1 FROM todo_items ti WHERE ti.id = parent_item_id AND ti.created_by = auth.uid())
  );
