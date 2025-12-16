-- ============================================================================
-- SCHEDULE ENTRIES SYSTEM
-- Migration 170: Core scheduling tables for calendar MVP
-- ============================================================================

-- ============================================================================
-- SCHEDULE ENTRIES
-- Main table for all scheduled items (jobs, assessments, blocked time, meetings)
-- ============================================================================
CREATE TABLE IF NOT EXISTS schedule_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Type of schedule item
  entry_type TEXT NOT NULL CHECK (entry_type IN (
    'job_visit',      -- Installation work
    'assessment',     -- Sales rep site visit
    'blocked',        -- Time off, vacation
    'meeting'         -- Team meetings
  )),

  -- Reference to source entity (one of these should be set based on entry_type)
  job_id UUID REFERENCES jobs(id) ON DELETE CASCADE,
  service_request_id UUID REFERENCES service_requests(id) ON DELETE CASCADE,

  -- Assignment (crew for job_visit, sales_rep for assessment, either for blocked/meeting)
  crew_id UUID REFERENCES crews(id) ON DELETE SET NULL,
  sales_rep_id UUID REFERENCES sales_reps(id) ON DELETE SET NULL,

  -- Timing
  scheduled_date DATE NOT NULL,
  start_time TIME,
  end_time TIME,
  is_all_day BOOLEAN DEFAULT false,

  -- Multi-day support
  is_multi_day BOOLEAN DEFAULT false,
  multi_day_sequence INTEGER,          -- Day 1, Day 2, etc.
  parent_entry_id UUID REFERENCES schedule_entries(id) ON DELETE CASCADE,
  total_days INTEGER DEFAULT 1,

  -- Capacity tracking (for jobs)
  estimated_footage INTEGER,           -- Linear feet for this visit
  estimated_hours DECIMAL(4,2),        -- Hours for this visit

  -- Status workflow
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN (
    'scheduled',      -- Date/time assigned
    'confirmed',      -- Customer confirmed
    'in_progress',    -- Work started
    'completed',      -- Done
    'cancelled'       -- Cancelled
  )),

  -- Display
  title TEXT,
  notes TEXT,
  color TEXT,                          -- Override default color if needed

  -- Location (denormalized for quick access)
  location_address TEXT,
  location_city TEXT,
  location_zip TEXT,

  -- Metadata
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_schedule_entries_date ON schedule_entries(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_schedule_entries_crew ON schedule_entries(crew_id, scheduled_date);
CREATE INDEX IF NOT EXISTS idx_schedule_entries_rep ON schedule_entries(sales_rep_id, scheduled_date);
CREATE INDEX IF NOT EXISTS idx_schedule_entries_job ON schedule_entries(job_id);
CREATE INDEX IF NOT EXISTS idx_schedule_entries_request ON schedule_entries(service_request_id);
CREATE INDEX IF NOT EXISTS idx_schedule_entries_status ON schedule_entries(status);
CREATE INDEX IF NOT EXISTS idx_schedule_entries_type_date ON schedule_entries(entry_type, scheduled_date);

-- ============================================================================
-- CREW DAILY CAPACITY
-- Pre-calculated daily capacity for quick lookups
-- ============================================================================
CREATE TABLE IF NOT EXISTS crew_daily_capacity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  crew_id UUID NOT NULL REFERENCES crews(id) ON DELETE CASCADE,
  capacity_date DATE NOT NULL,

  -- Footage capacity (using max_daily_lf from crews table as default)
  max_footage INTEGER NOT NULL DEFAULT 200,
  scheduled_footage INTEGER NOT NULL DEFAULT 0,
  available_footage INTEGER GENERATED ALWAYS AS (max_footage - scheduled_footage) STORED,

  -- Hour capacity
  max_hours DECIMAL(4,2) NOT NULL DEFAULT 10.0,
  scheduled_hours DECIMAL(4,2) NOT NULL DEFAULT 0,
  available_hours DECIMAL(4,2) GENERATED ALWAYS AS (max_hours - scheduled_hours) STORED,

  -- Utilization
  utilization_percent INTEGER GENERATED ALWAYS AS (
    CASE WHEN max_footage > 0
    THEN ROUND((scheduled_footage::DECIMAL / max_footage) * 100)
    ELSE 0 END
  ) STORED,

  -- Status flags
  is_available BOOLEAN DEFAULT true,              -- Not blocked/vacation
  is_over_capacity BOOLEAN GENERATED ALWAYS AS (scheduled_footage > max_footage) STORED,

  -- Jobs scheduled
  job_count INTEGER NOT NULL DEFAULT 0,

  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(crew_id, capacity_date)
);

-- Index for capacity lookups
CREATE INDEX IF NOT EXISTS idx_crew_capacity_lookup ON crew_daily_capacity(crew_id, capacity_date);
CREATE INDEX IF NOT EXISTS idx_crew_capacity_available ON crew_daily_capacity(capacity_date, is_available, available_footage);

-- ============================================================================
-- TRIGGER: Auto-update crew_daily_capacity when schedule_entries change
-- ============================================================================
CREATE OR REPLACE FUNCTION update_crew_daily_capacity()
RETURNS TRIGGER AS $$
DECLARE
  v_max_footage INTEGER;
BEGIN
  -- Handle INSERT or UPDATE
  IF TG_OP IN ('INSERT', 'UPDATE') AND NEW.crew_id IS NOT NULL AND NEW.entry_type = 'job_visit' THEN
    -- Get crew's max daily footage
    SELECT COALESCE(max_daily_lf, 200) INTO v_max_footage
    FROM crews WHERE id = NEW.crew_id;

    INSERT INTO crew_daily_capacity (crew_id, capacity_date, max_footage, scheduled_footage, scheduled_hours, job_count)
    SELECT
      NEW.crew_id,
      NEW.scheduled_date,
      v_max_footage,
      COALESCE(SUM(estimated_footage), 0),
      COALESCE(SUM(estimated_hours), 0),
      COUNT(*)
    FROM schedule_entries
    WHERE crew_id = NEW.crew_id
      AND scheduled_date = NEW.scheduled_date
      AND entry_type = 'job_visit'
      AND status NOT IN ('cancelled')
    ON CONFLICT (crew_id, capacity_date)
    DO UPDATE SET
      scheduled_footage = EXCLUDED.scheduled_footage,
      scheduled_hours = EXCLUDED.scheduled_hours,
      job_count = EXCLUDED.job_count,
      updated_at = NOW();
  END IF;

  -- Handle DELETE or UPDATE (old values)
  IF TG_OP IN ('DELETE', 'UPDATE') AND OLD.crew_id IS NOT NULL AND OLD.entry_type = 'job_visit' THEN
    -- Get crew's max daily footage
    SELECT COALESCE(max_daily_lf, 200) INTO v_max_footage
    FROM crews WHERE id = OLD.crew_id;

    INSERT INTO crew_daily_capacity (crew_id, capacity_date, max_footage, scheduled_footage, scheduled_hours, job_count)
    SELECT
      OLD.crew_id,
      OLD.scheduled_date,
      v_max_footage,
      COALESCE(SUM(estimated_footage), 0),
      COALESCE(SUM(estimated_hours), 0),
      COUNT(*)
    FROM schedule_entries
    WHERE crew_id = OLD.crew_id
      AND scheduled_date = OLD.scheduled_date
      AND entry_type = 'job_visit'
      AND status NOT IN ('cancelled')
    ON CONFLICT (crew_id, capacity_date)
    DO UPDATE SET
      scheduled_footage = EXCLUDED.scheduled_footage,
      scheduled_hours = EXCLUDED.scheduled_hours,
      job_count = EXCLUDED.job_count,
      updated_at = NOW();
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS trigger_update_crew_capacity ON schedule_entries;
CREATE TRIGGER trigger_update_crew_capacity
AFTER INSERT OR UPDATE OR DELETE ON schedule_entries
FOR EACH ROW EXECUTE FUNCTION update_crew_daily_capacity();

-- ============================================================================
-- TRIGGER: Auto-update updated_at timestamp
-- ============================================================================
CREATE OR REPLACE FUNCTION update_schedule_entries_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_schedule_entries_updated_at ON schedule_entries;
CREATE TRIGGER trigger_schedule_entries_updated_at
BEFORE UPDATE ON schedule_entries
FOR EACH ROW EXECUTE FUNCTION update_schedule_entries_updated_at();

-- ============================================================================
-- RLS POLICIES
-- ============================================================================
ALTER TABLE schedule_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE crew_daily_capacity ENABLE ROW LEVEL SECURITY;

-- Schedule entries: authenticated users can read and write
CREATE POLICY "schedule_entries_select" ON schedule_entries
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "schedule_entries_insert" ON schedule_entries
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "schedule_entries_update" ON schedule_entries
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "schedule_entries_delete" ON schedule_entries
  FOR DELETE TO authenticated USING (true);

-- Crew capacity: authenticated users can read, system manages writes
CREATE POLICY "crew_capacity_select" ON crew_daily_capacity
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "crew_capacity_insert" ON crew_daily_capacity
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "crew_capacity_update" ON crew_daily_capacity
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- ============================================================================
-- HELPER FUNCTION: Get schedule entries for date range
-- ============================================================================
CREATE OR REPLACE FUNCTION get_schedule_entries(
  p_start_date DATE,
  p_end_date DATE,
  p_crew_ids UUID[] DEFAULT NULL,
  p_rep_ids UUID[] DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  entry_type TEXT,
  job_id UUID,
  service_request_id UUID,
  crew_id UUID,
  sales_rep_id UUID,
  scheduled_date DATE,
  start_time TIME,
  end_time TIME,
  is_all_day BOOLEAN,
  estimated_footage INTEGER,
  estimated_hours DECIMAL(4,2),
  status TEXT,
  title TEXT,
  notes TEXT,
  color TEXT,
  location_address TEXT,
  location_city TEXT,
  location_zip TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    se.id,
    se.entry_type,
    se.job_id,
    se.service_request_id,
    se.crew_id,
    se.sales_rep_id,
    se.scheduled_date,
    se.start_time,
    se.end_time,
    se.is_all_day,
    se.estimated_footage,
    se.estimated_hours,
    se.status,
    se.title,
    se.notes,
    se.color,
    se.location_address,
    se.location_city,
    se.location_zip,
    se.created_at,
    se.updated_at
  FROM schedule_entries se
  WHERE se.scheduled_date >= p_start_date
    AND se.scheduled_date <= p_end_date
    AND se.status != 'cancelled'
    AND (p_crew_ids IS NULL OR se.crew_id = ANY(p_crew_ids))
    AND (p_rep_ids IS NULL OR se.sales_rep_id = ANY(p_rep_ids))
  ORDER BY se.scheduled_date, se.start_time;
END;
$$ LANGUAGE plpgsql;
