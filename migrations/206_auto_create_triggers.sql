-- Migration 206: Auto-Create Project Triggers
-- Automatically creates projects when quotes/jobs are created without one

-- ============================================
-- 1. Auto-create Project when Quote created without project_id
-- ============================================

CREATE OR REPLACE FUNCTION auto_create_project_for_quote()
RETURNS TRIGGER AS $$
DECLARE
  v_project_id UUID;
  v_client_name TEXT;
  v_property_address TEXT;
BEGIN
  -- Only create project if quote has client but no project
  IF NEW.project_id IS NULL AND NEW.client_id IS NOT NULL THEN
    -- Get client name for project name
    SELECT COALESCE(company_name, name) INTO v_client_name
    FROM clients WHERE id = NEW.client_id;

    -- Get property address if available
    IF NEW.property_id IS NOT NULL THEN
      SELECT address_line1 INTO v_property_address
      FROM properties WHERE id = NEW.property_id;
    END IF;

    -- Create the project
    INSERT INTO projects (
      client_id,
      community_id,
      property_id,
      qbo_class_id,
      assigned_rep_user_id,
      source,
      name,
      status
    )
    VALUES (
      NEW.client_id,
      NEW.community_id,
      NEW.property_id,
      NEW.qbo_class_id,
      NEW.sales_rep_user_id,
      'direct_quote',
      COALESCE(
        v_client_name || ' - ' || v_property_address,
        v_client_name || ' - ' || to_char(now(), 'Mon DD, YYYY'),
        'Project ' || to_char(now(), 'YYYY-MM-DD HH24:MI')
      ),
      'active'
    )
    RETURNING id INTO v_project_id;

    -- Set the project_id on the quote
    NEW.project_id := v_project_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_auto_create_project_for_quote ON quotes;
CREATE TRIGGER trg_auto_create_project_for_quote
BEFORE INSERT ON quotes
FOR EACH ROW
EXECUTE FUNCTION auto_create_project_for_quote();

-- ============================================
-- 2. Create Project from Request when converting
-- ============================================

CREATE OR REPLACE FUNCTION create_project_from_request()
RETURNS TRIGGER AS $$
DECLARE
  v_project_id UUID;
  v_client_name TEXT;
BEGIN
  -- Only create project if:
  -- 1. Request is being converted to a quote (converted_to_quote_id is being set)
  -- 2. No project exists yet (converted_to_project_id is null)
  IF NEW.converted_to_quote_id IS NOT NULL
     AND OLD.converted_to_quote_id IS NULL
     AND NEW.converted_to_project_id IS NULL THEN

    -- Get client name
    SELECT COALESCE(company_name, name) INTO v_client_name
    FROM clients WHERE id = NEW.client_id;

    -- Create project from request data
    INSERT INTO projects (
      client_id,
      community_id,
      property_id,
      qbo_class_id,
      assigned_rep_user_id,
      source,
      source_request_id,
      name,
      description,
      status
    )
    VALUES (
      NEW.client_id,
      NEW.community_id,
      NEW.property_id,
      NEW.qbo_class_id,
      NEW.assigned_rep_user_id,
      'request',
      NEW.id,
      COALESCE(
        v_client_name || ' - ' || NEW.request_number,
        'Project from ' || NEW.request_number
      ),
      NEW.description,
      'active'
    )
    RETURNING id INTO v_project_id;

    -- Set the project_id on the request
    NEW.converted_to_project_id := v_project_id;

    -- Update the quote with the project_id
    UPDATE quotes
    SET project_id = v_project_id
    WHERE id = NEW.converted_to_quote_id
      AND project_id IS NULL;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_create_project_from_request ON service_requests;
CREATE TRIGGER trg_create_project_from_request
BEFORE UPDATE ON service_requests
FOR EACH ROW
WHEN (OLD.converted_to_quote_id IS NULL AND NEW.converted_to_quote_id IS NOT NULL)
EXECUTE FUNCTION create_project_from_request();

-- ============================================
-- 3. Update Project when Quote accepted
-- ============================================

CREATE OR REPLACE FUNCTION update_project_on_quote_accepted()
RETURNS TRIGGER AS $$
BEGIN
  -- When a quote is accepted, update the project
  IF NEW.acceptance_status = 'accepted'
     AND (OLD.acceptance_status IS NULL OR OLD.acceptance_status != 'accepted')
     AND NEW.project_id IS NOT NULL THEN

    -- Set the accepted_quote_id on the project
    UPDATE projects
    SET accepted_quote_id = NEW.id
    WHERE id = NEW.project_id;

    -- Mark other pending quotes as superseded
    UPDATE quotes
    SET acceptance_status = 'superseded',
        superseded_by_quote_id = NEW.id
    WHERE project_id = NEW.project_id
      AND id != NEW.id
      AND acceptance_status = 'pending';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_project_on_quote_accepted ON quotes;
CREATE TRIGGER trg_update_project_on_quote_accepted
AFTER UPDATE ON quotes
FOR EACH ROW
WHEN (OLD.acceptance_status IS DISTINCT FROM NEW.acceptance_status)
EXECUTE FUNCTION update_project_on_quote_accepted();

-- ============================================
-- 4. Link Job to Project via Quote
-- ============================================

CREATE OR REPLACE FUNCTION link_job_to_project_from_quote()
RETURNS TRIGGER AS $$
BEGIN
  -- If job has quote_id but no project_id, get project from quote
  IF NEW.project_id IS NULL AND NEW.quote_id IS NOT NULL THEN
    SELECT project_id INTO NEW.project_id
    FROM quotes
    WHERE id = NEW.quote_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_link_job_to_project ON jobs;
CREATE TRIGGER trg_link_job_to_project
BEFORE INSERT ON jobs
FOR EACH ROW
EXECUTE FUNCTION link_job_to_project_from_quote();

-- ============================================
-- 5. Auto-create initial visit when job is scheduled
-- ============================================

CREATE OR REPLACE FUNCTION auto_create_initial_visit()
RETURNS TRIGGER AS $$
BEGIN
  -- When job gets scheduled_date and crew, create initial visit if none exists
  IF NEW.scheduled_date IS NOT NULL
     AND NEW.assigned_crew_id IS NOT NULL
     AND (OLD.scheduled_date IS NULL OR OLD.assigned_crew_id IS NULL) THEN

    -- Check if initial visit already exists
    IF NOT EXISTS (
      SELECT 1 FROM job_visits
      WHERE job_id = NEW.id AND visit_type = 'initial'
    ) THEN
      INSERT INTO job_visits (
        job_id,
        visit_number,
        visit_type,
        scheduled_date,
        assigned_crew_id,
        status
      )
      VALUES (
        NEW.id,
        1,
        'initial',
        NEW.scheduled_date,
        NEW.assigned_crew_id,
        'scheduled'
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_auto_create_initial_visit ON jobs;
CREATE TRIGGER trg_auto_create_initial_visit
AFTER INSERT OR UPDATE ON jobs
FOR EACH ROW
EXECUTE FUNCTION auto_create_initial_visit();

-- ============================================
-- 6. Cascade project info to new quotes/jobs
-- ============================================

-- When a quote is created with project_id, inherit project's client/property if not set
CREATE OR REPLACE FUNCTION inherit_project_info_to_quote()
RETURNS TRIGGER AS $$
DECLARE
  v_project RECORD;
BEGIN
  IF NEW.project_id IS NOT NULL THEN
    SELECT * INTO v_project FROM projects WHERE id = NEW.project_id;

    -- Inherit client_id if not set
    IF NEW.client_id IS NULL AND v_project.client_id IS NOT NULL THEN
      NEW.client_id := v_project.client_id;
    END IF;

    -- Inherit property_id if not set
    IF NEW.property_id IS NULL AND v_project.property_id IS NOT NULL THEN
      NEW.property_id := v_project.property_id;
    END IF;

    -- Inherit community_id if not set
    IF NEW.community_id IS NULL AND v_project.community_id IS NOT NULL THEN
      NEW.community_id := v_project.community_id;
    END IF;

    -- Inherit qbo_class_id if not set
    IF NEW.qbo_class_id IS NULL AND v_project.qbo_class_id IS NOT NULL THEN
      NEW.qbo_class_id := v_project.qbo_class_id;
    END IF;

    -- Inherit assigned rep if not set
    IF NEW.sales_rep_user_id IS NULL AND v_project.assigned_rep_user_id IS NOT NULL THEN
      NEW.sales_rep_user_id := v_project.assigned_rep_user_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_inherit_project_info_to_quote ON quotes;
CREATE TRIGGER trg_inherit_project_info_to_quote
BEFORE INSERT ON quotes
FOR EACH ROW
WHEN (NEW.project_id IS NOT NULL)
EXECUTE FUNCTION inherit_project_info_to_quote();

-- Same for jobs
CREATE OR REPLACE FUNCTION inherit_project_info_to_job()
RETURNS TRIGGER AS $$
DECLARE
  v_project RECORD;
BEGIN
  IF NEW.project_id IS NOT NULL THEN
    SELECT * INTO v_project FROM projects WHERE id = NEW.project_id;

    -- Inherit client_id if not set
    IF NEW.client_id IS NULL AND v_project.client_id IS NOT NULL THEN
      NEW.client_id := v_project.client_id;
    END IF;

    -- Inherit property_id if not set
    IF NEW.property_id IS NULL AND v_project.property_id IS NOT NULL THEN
      NEW.property_id := v_project.property_id;
    END IF;

    -- Inherit community_id if not set
    IF NEW.community_id IS NULL AND v_project.community_id IS NOT NULL THEN
      NEW.community_id := v_project.community_id;
    END IF;

    -- Inherit qbo_class_id if not set
    IF NEW.qbo_class_id IS NULL AND v_project.qbo_class_id IS NOT NULL THEN
      NEW.qbo_class_id := v_project.qbo_class_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_inherit_project_info_to_job ON jobs;
CREATE TRIGGER trg_inherit_project_info_to_job
BEFORE INSERT ON jobs
FOR EACH ROW
WHEN (NEW.project_id IS NOT NULL)
EXECUTE FUNCTION inherit_project_info_to_job();

SELECT 'Migration 206 complete: Auto-create triggers installed';
