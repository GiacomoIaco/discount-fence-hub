-- Survey Hub Schema
-- Comprehensive survey system for external customer surveys

-- 1. SURVEYS (Templates)
CREATE TABLE IF NOT EXISTS surveys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE,  -- Auto-generated: SVY-001, SVY-002, etc.
  title TEXT NOT NULL,
  description TEXT,
  survey_json JSONB NOT NULL,  -- SurveyJS format

  -- Categorization
  category TEXT DEFAULT 'custom',  -- 'nps', 'csat', 'feedback', 'onboarding', 'custom'
  tags TEXT[] DEFAULT '{}',

  -- Settings
  is_anonymous BOOLEAN DEFAULT false,
  collect_respondent_info BOOLEAN DEFAULT true,  -- name, email, phone fields
  allow_multiple_responses BOOLEAN DEFAULT false,

  -- Branding
  brand_config JSONB DEFAULT '{}',  -- { "logo": "url", "primaryColor": "#hex", "backgroundImage": "url" }

  -- Status
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'archived')),

  -- Metadata
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Auto-generate survey codes
CREATE SEQUENCE IF NOT EXISTS survey_code_seq START 1;

CREATE OR REPLACE FUNCTION generate_survey_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.code IS NULL THEN
    NEW.code := 'SVY-' || LPAD(nextval('survey_code_seq')::TEXT, 3, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS survey_code_trigger ON surveys;
CREATE TRIGGER survey_code_trigger
  BEFORE INSERT ON surveys
  FOR EACH ROW
  EXECUTE FUNCTION generate_survey_code();

-- 2. SURVEY POPULATIONS (Audiences)
CREATE TABLE IF NOT EXISTS survey_populations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  population_type TEXT NOT NULL CHECK (population_type IN ('app_users', 'db_clients', 'imported', 'mixed')),

  -- Dynamic filters (for app_users and db_clients)
  filters JSONB DEFAULT '{}',  -- { "roles": ["sales"], "client_type": "builder" }

  -- Import tracking
  import_source TEXT,  -- 'csv', 'manual', 'crm'
  last_synced_at TIMESTAMPTZ,

  -- Stats
  contact_count INTEGER DEFAULT 0,

  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. POPULATION CONTACTS (Individual contacts in a population)
CREATE TABLE IF NOT EXISTS survey_population_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  population_id UUID NOT NULL REFERENCES survey_populations(id) ON DELETE CASCADE,

  -- Contact info
  contact_name TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  contact_company TEXT,

  -- Metadata for segmentation
  metadata JSONB DEFAULT '{}',  -- { "client_type": "builder", "region": "DFW", "account_manager": "John" }

  -- Link to app user if exists
  user_id UUID REFERENCES user_profiles(id),

  -- Status
  is_active BOOLEAN DEFAULT true,
  unsubscribed_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  -- Ensure unique contact per population (by email or phone)
  UNIQUE(population_id, contact_email),
  CONSTRAINT contact_has_email_or_phone CHECK (contact_email IS NOT NULL OR contact_phone IS NOT NULL)
);

-- 4. SURVEY CAMPAIGNS (Scheduling)
CREATE TABLE IF NOT EXISTS survey_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE,  -- Auto-generated: CMP-001
  name TEXT NOT NULL,
  survey_id UUID NOT NULL REFERENCES surveys(id),
  population_id UUID NOT NULL REFERENCES survey_populations(id),

  -- Schedule
  schedule_type TEXT NOT NULL CHECK (schedule_type IN ('one_time', 'recurring')),

  -- One-time settings
  send_at TIMESTAMPTZ,

  -- Recurring settings
  recurrence_interval INTEGER,  -- e.g., 6 for "every 6 weeks"
  recurrence_unit TEXT CHECK (recurrence_unit IN ('days', 'weeks', 'months')),
  recurrence_time TIME DEFAULT '09:00:00',  -- Time of day to send (UTC)
  next_send_at TIMESTAMPTZ,
  last_sent_at TIMESTAMPTZ,

  -- Delivery
  delivery_methods TEXT[] DEFAULT ARRAY['email'],  -- 'email', 'sms'

  -- Reminders
  send_reminders BOOLEAN DEFAULT true,
  reminder_days INTEGER[] DEFAULT ARRAY[3, 7],  -- days after initial send

  -- Expiration
  response_deadline_days INTEGER DEFAULT 14,  -- responses accepted for N days

  -- Status
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'active', 'paused', 'completed')),

  -- Stats
  total_distributions INTEGER DEFAULT 0,

  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Auto-generate campaign codes
CREATE SEQUENCE IF NOT EXISTS campaign_code_seq START 1;

CREATE OR REPLACE FUNCTION generate_campaign_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.code IS NULL THEN
    NEW.code := 'CMP-' || LPAD(nextval('campaign_code_seq')::TEXT, 3, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS campaign_code_trigger ON survey_campaigns;
CREATE TRIGGER campaign_code_trigger
  BEFORE INSERT ON survey_campaigns
  FOR EACH ROW
  EXECUTE FUNCTION generate_campaign_code();

-- 5. SURVEY DISTRIBUTIONS (Each send instance/wave)
CREATE TABLE IF NOT EXISTS survey_distributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES survey_campaigns(id),
  survey_id UUID NOT NULL REFERENCES surveys(id),
  population_id UUID REFERENCES survey_populations(id),

  -- Instance tracking for recurring campaigns
  distribution_number INTEGER DEFAULT 1,  -- 1st, 2nd, 3rd wave

  -- Public access
  public_token TEXT UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),

  -- Timing
  sent_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,

  -- Reminder tracking
  reminder_1_sent_at TIMESTAMPTZ,
  reminder_2_sent_at TIMESTAMPTZ,

  -- Stats (denormalized for performance)
  total_sent INTEGER DEFAULT 0,
  total_delivered INTEGER DEFAULT 0,
  total_opened INTEGER DEFAULT 0,
  total_started INTEGER DEFAULT 0,
  total_completed INTEGER DEFAULT 0,

  -- Computed metrics
  response_rate DECIMAL(5,2),
  avg_completion_time INTEGER,  -- seconds
  nps_score INTEGER,  -- -100 to 100

  created_at TIMESTAMPTZ DEFAULT now()
);

-- 6. SURVEY RECIPIENTS (Individual sends within a distribution)
CREATE TABLE IF NOT EXISTS survey_recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  distribution_id UUID NOT NULL REFERENCES survey_distributions(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES survey_population_contacts(id),

  -- Recipient info (copied for historical record)
  recipient_name TEXT,
  recipient_email TEXT,
  recipient_phone TEXT,
  recipient_company TEXT,
  recipient_metadata JSONB DEFAULT '{}',

  -- For app users
  user_id UUID REFERENCES user_profiles(id),

  -- Unique response token (for tracking who responded - pseudonymous)
  response_token TEXT UNIQUE DEFAULT encode(gen_random_bytes(12), 'hex'),

  -- Delivery status
  email_status TEXT DEFAULT 'pending' CHECK (email_status IN ('pending', 'sent', 'delivered', 'opened', 'bounced', 'failed')),
  email_sent_at TIMESTAMPTZ,
  email_delivered_at TIMESTAMPTZ,
  email_opened_at TIMESTAMPTZ,
  email_error TEXT,

  sms_status TEXT DEFAULT 'pending' CHECK (sms_status IN ('pending', 'sent', 'delivered', 'failed')),
  sms_sent_at TIMESTAMPTZ,
  sms_delivered_at TIMESTAMPTZ,
  sms_error TEXT,

  -- Reminders
  reminder_1_sent_at TIMESTAMPTZ,
  reminder_2_sent_at TIMESTAMPTZ,

  -- Response status
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT now()
);

-- 7. SURVEY RESPONSES
CREATE TABLE IF NOT EXISTS survey_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  distribution_id UUID NOT NULL REFERENCES survey_distributions(id),
  recipient_id UUID REFERENCES survey_recipients(id),  -- NULL if truly anonymous

  -- Response data
  response_data JSONB NOT NULL,  -- Full SurveyJS response object

  -- Extracted metrics (for fast querying)
  nps_score INTEGER CHECK (nps_score BETWEEN 0 AND 10),
  csat_score INTEGER CHECK (csat_score BETWEEN 1 AND 5),

  -- Respondent info (if collected in survey)
  respondent_name TEXT,
  respondent_email TEXT,
  respondent_phone TEXT,
  respondent_company TEXT,
  respondent_metadata JSONB DEFAULT '{}',

  -- Context
  is_anonymous BOOLEAN DEFAULT false,
  ip_address INET,
  user_agent TEXT,
  device_type TEXT,  -- 'mobile', 'tablet', 'desktop'

  -- Timing
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ DEFAULT now(),
  time_to_complete INTEGER,  -- seconds

  created_at TIMESTAMPTZ DEFAULT now()
);

-- 8. SURVEY ANALYTICS SNAPSHOTS (Pre-computed for trend analysis)
CREATE TABLE IF NOT EXISTS survey_analytics_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  distribution_id UUID NOT NULL REFERENCES survey_distributions(id) ON DELETE CASCADE,
  survey_id UUID NOT NULL REFERENCES surveys(id),
  campaign_id UUID REFERENCES survey_campaigns(id),

  -- Snapshot date
  snapshot_date DATE DEFAULT CURRENT_DATE,

  -- Response metrics
  total_recipients INTEGER,
  total_responses INTEGER,
  response_rate DECIMAL(5,2),
  avg_completion_time INTEGER,

  -- NPS metrics
  nps_score INTEGER,  -- -100 to 100
  nps_promoters INTEGER,  -- 9-10
  nps_passives INTEGER,   -- 7-8
  nps_detractors INTEGER, -- 0-6

  -- CSAT metrics
  csat_score DECIMAL(3,2),  -- 1.00 to 5.00
  csat_distribution JSONB,  -- { "1": 5, "2": 10, "3": 20, "4": 30, "5": 35 }

  -- Per-question analytics
  question_analytics JSONB,  -- { "q1": { "avg": 4.2, "distribution": {...} }, ... }

  -- Segmented analytics
  segment_analytics JSONB,  -- { "by_company": {...}, "by_region": {...} }

  -- Trend vs previous (computed)
  prev_distribution_id UUID REFERENCES survey_distributions(id),
  nps_change INTEGER,
  response_rate_change DECIMAL(5,2),

  computed_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(distribution_id, snapshot_date)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_surveys_status ON surveys(status);
CREATE INDEX IF NOT EXISTS idx_surveys_created_by ON surveys(created_by);

CREATE INDEX IF NOT EXISTS idx_population_contacts_population ON survey_population_contacts(population_id);
CREATE INDEX IF NOT EXISTS idx_population_contacts_email ON survey_population_contacts(contact_email);

CREATE INDEX IF NOT EXISTS idx_campaigns_status ON survey_campaigns(status);
CREATE INDEX IF NOT EXISTS idx_campaigns_next_send ON survey_campaigns(next_send_at) WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_distributions_campaign ON survey_distributions(campaign_id);
CREATE INDEX IF NOT EXISTS idx_distributions_token ON survey_distributions(public_token);
CREATE INDEX IF NOT EXISTS idx_distributions_sent_at ON survey_distributions(sent_at);

CREATE INDEX IF NOT EXISTS idx_recipients_distribution ON survey_recipients(distribution_id);
CREATE INDEX IF NOT EXISTS idx_recipients_token ON survey_recipients(response_token);
CREATE INDEX IF NOT EXISTS idx_recipients_email ON survey_recipients(recipient_email);

CREATE INDEX IF NOT EXISTS idx_responses_distribution ON survey_responses(distribution_id);
CREATE INDEX IF NOT EXISTS idx_responses_recipient ON survey_responses(recipient_id);
CREATE INDEX IF NOT EXISTS idx_responses_completed ON survey_responses(completed_at);

CREATE INDEX IF NOT EXISTS idx_analytics_campaign ON survey_analytics_snapshots(campaign_id);
CREATE INDEX IF NOT EXISTS idx_analytics_distribution ON survey_analytics_snapshots(distribution_id);

-- RLS Policies
ALTER TABLE surveys ENABLE ROW LEVEL SECURITY;
ALTER TABLE survey_populations ENABLE ROW LEVEL SECURITY;
ALTER TABLE survey_population_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE survey_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE survey_distributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE survey_recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE survey_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE survey_analytics_snapshots ENABLE ROW LEVEL SECURITY;

-- Admin/manager can see all surveys
CREATE POLICY surveys_select ON surveys FOR SELECT USING (true);
CREATE POLICY surveys_insert ON surveys FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY surveys_update ON surveys FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY surveys_delete ON surveys FOR DELETE USING (auth.uid() IS NOT NULL);

CREATE POLICY populations_select ON survey_populations FOR SELECT USING (true);
CREATE POLICY populations_insert ON survey_populations FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY populations_update ON survey_populations FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY populations_delete ON survey_populations FOR DELETE USING (auth.uid() IS NOT NULL);

CREATE POLICY contacts_select ON survey_population_contacts FOR SELECT USING (true);
CREATE POLICY contacts_insert ON survey_population_contacts FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY contacts_update ON survey_population_contacts FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY contacts_delete ON survey_population_contacts FOR DELETE USING (auth.uid() IS NOT NULL);

CREATE POLICY campaigns_select ON survey_campaigns FOR SELECT USING (true);
CREATE POLICY campaigns_insert ON survey_campaigns FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY campaigns_update ON survey_campaigns FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY campaigns_delete ON survey_campaigns FOR DELETE USING (auth.uid() IS NOT NULL);

CREATE POLICY distributions_select ON survey_distributions FOR SELECT USING (true);
CREATE POLICY distributions_insert ON survey_distributions FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY distributions_update ON survey_distributions FOR UPDATE USING (auth.uid() IS NOT NULL);

CREATE POLICY recipients_select ON survey_recipients FOR SELECT USING (true);
CREATE POLICY recipients_insert ON survey_recipients FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY recipients_update ON survey_recipients FOR UPDATE USING (auth.uid() IS NOT NULL);

-- Responses can be inserted without auth (public survey submissions)
CREATE POLICY responses_select ON survey_responses FOR SELECT USING (true);
CREATE POLICY responses_insert ON survey_responses FOR INSERT WITH CHECK (true);

CREATE POLICY analytics_select ON survey_analytics_snapshots FOR SELECT USING (true);
CREATE POLICY analytics_insert ON survey_analytics_snapshots FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Function to update population contact count
CREATE OR REPLACE FUNCTION update_population_contact_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE survey_populations
    SET contact_count = contact_count + 1, updated_at = now()
    WHERE id = NEW.population_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE survey_populations
    SET contact_count = contact_count - 1, updated_at = now()
    WHERE id = OLD.population_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS population_contact_count_trigger ON survey_population_contacts;
CREATE TRIGGER population_contact_count_trigger
  AFTER INSERT OR DELETE ON survey_population_contacts
  FOR EACH ROW
  EXECUTE FUNCTION update_population_contact_count();

-- Function to update distribution stats
CREATE OR REPLACE FUNCTION update_distribution_stats()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.completed_at IS NOT NULL THEN
    UPDATE survey_distributions
    SET total_completed = total_completed + 1,
        response_rate = ROUND((total_completed + 1)::DECIMAL / NULLIF(total_sent, 0) * 100, 2)
    WHERE id = NEW.distribution_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS distribution_stats_trigger ON survey_responses;
CREATE TRIGGER distribution_stats_trigger
  AFTER INSERT ON survey_responses
  FOR EACH ROW
  EXECUTE FUNCTION update_distribution_stats();

COMMENT ON TABLE surveys IS 'Survey templates with SurveyJS JSON configuration';
COMMENT ON TABLE survey_populations IS 'Audience groups for survey distribution';
COMMENT ON TABLE survey_population_contacts IS 'Individual contacts within a population';
COMMENT ON TABLE survey_campaigns IS 'Scheduled survey sends (one-time or recurring)';
COMMENT ON TABLE survey_distributions IS 'Each instance of sending a survey (a wave)';
COMMENT ON TABLE survey_recipients IS 'Individual recipients and their delivery/response status';
COMMENT ON TABLE survey_responses IS 'Submitted survey responses';
COMMENT ON TABLE survey_analytics_snapshots IS 'Pre-computed analytics for trend analysis';
