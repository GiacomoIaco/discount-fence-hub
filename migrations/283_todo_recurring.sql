-- ============================================================================
-- 283: RECURRING TASKS
-- ============================================================================

-- Add recurrence columns to todo_items
ALTER TABLE todo_items
  ADD COLUMN IF NOT EXISTS recurrence_rule text,
  ADD COLUMN IF NOT EXISTS recurrence_interval int DEFAULT 1,
  ADD COLUMN IF NOT EXISTS recurrence_days text[],
  ADD COLUMN IF NOT EXISTS recurrence_end_date date,
  ADD COLUMN IF NOT EXISTS recurrence_parent_id uuid REFERENCES todo_items(id) ON DELETE SET NULL;

-- Index for finding recurring tasks efficiently
CREATE INDEX IF NOT EXISTS idx_todo_items_recurrence ON todo_items(recurrence_rule) WHERE recurrence_rule IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_todo_items_recurrence_parent ON todo_items(recurrence_parent_id) WHERE recurrence_parent_id IS NOT NULL;

-- Function to create next recurring instance
CREATE OR REPLACE FUNCTION create_next_recurring_todo(p_item_id uuid)
RETURNS uuid AS $$
DECLARE
  v_item todo_items%ROWTYPE;
  v_new_id uuid;
  v_next_due date;
BEGIN
  SELECT * INTO v_item FROM todo_items WHERE id = p_item_id;

  IF v_item IS NULL OR v_item.recurrence_rule IS NULL THEN
    RETURN NULL;
  END IF;

  -- Calculate next due date
  IF v_item.recurrence_rule = 'daily' THEN
    v_next_due := COALESCE(v_item.due_date, CURRENT_DATE) + COALESCE(v_item.recurrence_interval, 1);
  ELSIF v_item.recurrence_rule = 'weekly' THEN
    v_next_due := COALESCE(v_item.due_date, CURRENT_DATE) + (COALESCE(v_item.recurrence_interval, 1) * 7);
  ELSIF v_item.recurrence_rule = 'monthly' THEN
    v_next_due := COALESCE(v_item.due_date, CURRENT_DATE) + (COALESCE(v_item.recurrence_interval, 1)::text || ' months')::interval;
  ELSE
    -- Custom with specific days - find next matching day
    v_next_due := COALESCE(v_item.due_date, CURRENT_DATE) + 1;
    WHILE NOT (
      lower(to_char(v_next_due, 'dy')) = ANY(v_item.recurrence_days)
    ) AND v_next_due < CURRENT_DATE + 365 LOOP
      v_next_due := v_next_due + 1;
    END LOOP;
  END IF;

  -- Check if past end date
  IF v_item.recurrence_end_date IS NOT NULL AND v_next_due > v_item.recurrence_end_date THEN
    RETURN NULL;
  END IF;

  -- Create new instance
  INSERT INTO todo_items (
    section_id, list_id, title, description, notes, status,
    assigned_to, created_by, due_date, is_high_priority, sort_order,
    recurrence_rule, recurrence_interval, recurrence_days,
    recurrence_end_date, recurrence_parent_id
  ) VALUES (
    v_item.section_id, v_item.list_id, v_item.title, v_item.description,
    v_item.notes, 'todo', v_item.assigned_to, v_item.created_by,
    v_next_due, v_item.is_high_priority, v_item.sort_order,
    v_item.recurrence_rule, v_item.recurrence_interval, v_item.recurrence_days,
    v_item.recurrence_end_date, COALESCE(v_item.recurrence_parent_id, v_item.id)
  ) RETURNING id INTO v_new_id;

  -- Copy followers
  INSERT INTO todo_item_followers (item_id, user_id)
  SELECT v_new_id, user_id FROM todo_item_followers WHERE item_id = p_item_id;

  RETURN v_new_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
