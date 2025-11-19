-- Migration 036: Initiative Week Locks
-- Implements locking mechanism for weekly updates

-- ============================================
-- 1. Create Week Locks Table
-- ============================================

CREATE TABLE IF NOT EXISTS initiative_week_locks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Week identification
  week_start_date DATE NOT NULL,

  -- Lock status
  locked BOOLEAN DEFAULT FALSE,
  locked_at TIMESTAMPTZ,
  locked_by UUID REFERENCES auth.users(id),
  lock_reason TEXT, -- 'auto_friday_2pm', 'auto_monday_12pm', 'manual'

  -- Grace period tracking
  in_grace_period BOOLEAN DEFAULT FALSE,
  grace_period_ends_at TIMESTAMPTZ,

  -- Override/unlock tracking
  unlocked_by UUID REFERENCES auth.users(id),
  unlocked_at TIMESTAMPTZ,
  unlock_reason TEXT,

  -- Email tracking
  summary_email_sent BOOLEAN DEFAULT FALSE,
  summary_email_sent_at TIMESTAMPTZ,
  reminder_email_sent BOOLEAN DEFAULT FALSE,
  reminder_email_sent_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(week_start_date)
);

CREATE INDEX IF NOT EXISTS idx_week_locks_date ON initiative_week_locks(week_start_date);
CREATE INDEX IF NOT EXISTS idx_week_locks_locked ON initiative_week_locks(locked) WHERE locked = TRUE;
CREATE INDEX IF NOT EXISTS idx_week_locks_grace ON initiative_week_locks(in_grace_period) WHERE in_grace_period = TRUE;

COMMENT ON TABLE initiative_week_locks IS 'Tracks locking status of weeks for initiative updates';
COMMENT ON COLUMN initiative_week_locks.lock_reason IS 'Why was it locked: auto_friday_2pm, auto_monday_12pm, manual';
COMMENT ON COLUMN initiative_week_locks.in_grace_period IS 'True from Friday 2pm to Monday 12pm';

-- ============================================
-- 2. Helper Functions
-- ============================================

-- Function to check if a week is locked
CREATE OR REPLACE FUNCTION is_week_locked(p_week_start_date DATE)
RETURNS BOOLEAN AS $$
DECLARE
  v_locked BOOLEAN;
  v_in_grace BOOLEAN;
BEGIN
  SELECT locked, in_grace_period
  INTO v_locked, v_in_grace
  FROM initiative_week_locks
  WHERE week_start_date = p_week_start_date;

  -- If no record exists, week is not locked
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  -- If in grace period, treat as unlocked
  IF v_in_grace THEN
    RETURN FALSE;
  END IF;

  RETURN v_locked;
END;
$$ LANGUAGE plpgsql;

-- Function to lock a week
CREATE OR REPLACE FUNCTION lock_week(
  p_week_start_date DATE,
  p_locked_by UUID DEFAULT NULL,
  p_lock_reason TEXT DEFAULT 'manual'
)
RETURNS void AS $$
BEGIN
  INSERT INTO initiative_week_locks (
    week_start_date,
    locked,
    locked_at,
    locked_by,
    lock_reason,
    in_grace_period,
    grace_period_ends_at
  )
  VALUES (
    p_week_start_date,
    TRUE,
    NOW(),
    p_locked_by,
    p_lock_reason,
    CASE WHEN p_lock_reason = 'auto_friday_2pm' THEN TRUE ELSE FALSE END,
    CASE WHEN p_lock_reason = 'auto_friday_2pm' THEN
      -- Set grace period to end Monday 12pm
      (p_week_start_date + INTERVAL '7 days')::DATE + TIME '12:00:00'
    ELSE NULL END
  )
  ON CONFLICT (week_start_date)
  DO UPDATE SET
    locked = TRUE,
    locked_at = NOW(),
    locked_by = p_locked_by,
    lock_reason = p_lock_reason,
    in_grace_period = CASE WHEN p_lock_reason = 'auto_friday_2pm' THEN TRUE ELSE FALSE END,
    grace_period_ends_at = CASE WHEN p_lock_reason = 'auto_friday_2pm' THEN
      (p_week_start_date + INTERVAL '7 days')::DATE + TIME '12:00:00'
    ELSE NULL END,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- Function to unlock a week (CEO override)
CREATE OR REPLACE FUNCTION unlock_week(
  p_week_start_date DATE,
  p_unlocked_by UUID,
  p_unlock_reason TEXT
)
RETURNS void AS $$
BEGIN
  UPDATE initiative_week_locks
  SET
    locked = FALSE,
    in_grace_period = FALSE,
    unlocked_by = p_unlocked_by,
    unlocked_at = NOW(),
    unlock_reason = p_unlock_reason,
    updated_at = NOW()
  WHERE week_start_date = p_week_start_date;

  -- Create record if it doesn't exist
  IF NOT FOUND THEN
    INSERT INTO initiative_week_locks (
      week_start_date,
      locked,
      unlocked_by,
      unlocked_at,
      unlock_reason
    )
    VALUES (
      p_week_start_date,
      FALSE,
      p_unlocked_by,
      NOW(),
      p_unlock_reason
    );
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to end grace period
CREATE OR REPLACE FUNCTION end_grace_period(p_week_start_date DATE)
RETURNS void AS $$
BEGIN
  UPDATE initiative_week_locks
  SET
    in_grace_period = FALSE,
    lock_reason = 'auto_monday_12pm',
    updated_at = NOW()
  WHERE week_start_date = p_week_start_date
    AND in_grace_period = TRUE;
END;
$$ LANGUAGE plpgsql;

-- Function to mark email as sent
CREATE OR REPLACE FUNCTION mark_summary_email_sent(p_week_start_date DATE)
RETURNS void AS $$
BEGIN
  UPDATE initiative_week_locks
  SET
    summary_email_sent = TRUE,
    summary_email_sent_at = NOW(),
    updated_at = NOW()
  WHERE week_start_date = p_week_start_date;

  -- Create record if it doesn't exist
  IF NOT FOUND THEN
    INSERT INTO initiative_week_locks (
      week_start_date,
      summary_email_sent,
      summary_email_sent_at
    )
    VALUES (
      p_week_start_date,
      TRUE,
      NOW()
    );
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to mark reminder email as sent
CREATE OR REPLACE FUNCTION mark_reminder_email_sent(p_week_start_date DATE)
RETURNS void AS $$
BEGIN
  UPDATE initiative_week_locks
  SET
    reminder_email_sent = TRUE,
    reminder_email_sent_at = NOW(),
    updated_at = NOW()
  WHERE week_start_date = p_week_start_date;

  -- Create record if it doesn't exist
  IF NOT FOUND THEN
    INSERT INTO initiative_week_locks (
      week_start_date,
      reminder_email_sent,
      reminder_email_sent_at
    )
    VALUES (
      p_week_start_date,
      TRUE,
      NOW()
    );
  END IF;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 3. Row Level Security
-- ============================================

ALTER TABLE initiative_week_locks ENABLE ROW LEVEL SECURITY;

-- Everyone can view week locks
CREATE POLICY "Everyone can view week locks"
  ON initiative_week_locks
  FOR SELECT
  USING (true);

-- Only admins can modify week locks
CREATE POLICY "Admins can modify week locks"
  ON initiative_week_locks
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

-- ============================================
-- 4. Triggers
-- ============================================

CREATE TRIGGER update_initiative_week_locks_updated_at
  BEFORE UPDATE ON initiative_week_locks
  FOR EACH ROW
  EXECUTE FUNCTION update_project_updated_at();
