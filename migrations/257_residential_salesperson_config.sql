-- Residential Salesperson Configuration
-- Tracks which salespeople should be included in comparison group for metrics

CREATE TABLE IF NOT EXISTS residential_salesperson_config (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  salesperson_name TEXT NOT NULL UNIQUE,
  is_comparison_group BOOLEAN DEFAULT false,  -- Include in team averages/comparisons
  is_active BOOLEAN DEFAULT true,             -- Still employed/active
  notes TEXT,                                 -- "Fired Jan 2025", "Operations", etc.
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE residential_salesperson_config ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read
CREATE POLICY "Allow authenticated read on residential_salesperson_config"
  ON residential_salesperson_config FOR SELECT
  TO authenticated
  USING (true);

-- Allow all authenticated users to insert/update (could restrict to admins later)
CREATE POLICY "Allow authenticated insert on residential_salesperson_config"
  ON residential_salesperson_config FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow authenticated update on residential_salesperson_config"
  ON residential_salesperson_config FOR UPDATE
  TO authenticated
  USING (true);

-- Create index for quick lookups
CREATE INDEX IF NOT EXISTS idx_residential_salesperson_config_name
  ON residential_salesperson_config(salesperson_name);

CREATE INDEX IF NOT EXISTS idx_residential_salesperson_config_comparison
  ON residential_salesperson_config(is_comparison_group)
  WHERE is_comparison_group = true;

-- Auto-populate from existing data in jobber_residential_opportunities
INSERT INTO residential_salesperson_config (salesperson_name, is_comparison_group, is_active, notes)
SELECT DISTINCT
  salesperson,
  false,  -- Default to NOT in comparison group - admin will enable
  true,   -- Assume active by default
  null
FROM jobber_residential_opportunities
WHERE salesperson IS NOT NULL AND salesperson != ''
ON CONFLICT (salesperson_name) DO NOTHING;

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_residential_salesperson_config_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER residential_salesperson_config_updated_at
  BEFORE UPDATE ON residential_salesperson_config
  FOR EACH ROW
  EXECUTE FUNCTION update_residential_salesperson_config_updated_at();

-- Track migration
INSERT INTO schema_migrations (version, name, applied_by, execution_time_ms)
VALUES ('257', 'residential_salesperson_config', 'manual', 0)
ON CONFLICT (version) DO NOTHING;
