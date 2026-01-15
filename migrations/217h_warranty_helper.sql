-- Migration 217h: Warranty Helper Function
-- PART 8 of Request-Project Lifecycle Architecture

-- Function to create a warranty project from an existing project
CREATE OR REPLACE FUNCTION create_warranty_project(
  p_parent_project_id UUID,
  p_warranty_type TEXT DEFAULT 'workmanship',
  p_description TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_parent projects%ROWTYPE;
  v_new_project_id UUID;
  v_project_number TEXT;
BEGIN
  -- Get parent project
  SELECT * INTO v_parent FROM projects WHERE id = p_parent_project_id;

  IF v_parent.id IS NULL THEN
    RAISE EXCEPTION 'Parent project not found';
  END IF;

  -- Generate project number
  SELECT 'W-' || LPAD(COALESCE(
    (SELECT MAX(SUBSTRING(project_number FROM 3)::integer) + 1
     FROM projects WHERE project_number LIKE 'W-%'), 1)::text, 5, '0')
  INTO v_project_number;

  -- Create warranty project
  INSERT INTO projects (
    project_number,
    name,
    client_id,
    property_id,
    community_id,
    qbo_class_id,
    assigned_rep_user_id,
    project_type,
    parent_project_id,
    warranty_type,
    description,
    status
  ) VALUES (
    v_project_number,
    'Warranty: ' || v_parent.name,
    v_parent.client_id,
    v_parent.property_id,
    v_parent.community_id,
    v_parent.qbo_class_id,
    v_parent.assigned_rep_user_id,
    'warranty',
    p_parent_project_id,
    p_warranty_type,
    p_description,
    'active'
  )
  RETURNING id INTO v_new_project_id;

  RETURN v_new_project_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION create_warranty_project(UUID, TEXT, TEXT) TO authenticated;

SELECT 'Migration 217h complete: Warranty helper function';
