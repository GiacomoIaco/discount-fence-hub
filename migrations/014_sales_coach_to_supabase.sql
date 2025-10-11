-- Migration: AI Sales Coach Data to Supabase
-- Version: 014
-- Date: 2025-10-10
--
-- CRITICAL: This migration moves AI Sales Coach data from localStorage to Supabase
-- to prevent data loss when browser cache is cleared.
--
-- What this creates:
-- 1. recordings table - Store all sales call recordings with transcriptions and analysis
-- 2. sales_processes table - Custom sales processes defined by users/managers
-- 3. knowledge_bases table - Company-specific sales knowledge and best practices
-- 4. manager_reviews table - Manager reviews and feedback on recordings
--
-- This solves the CRITICAL data loss issue identified in the architectural analysis.

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- 1. RECORDINGS TABLE
-- =====================================================
-- Stores all sales call recordings with their transcriptions and AI analysis
CREATE TABLE IF NOT EXISTS recordings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_name TEXT NOT NULL,
  meeting_date DATE NOT NULL,
  duration TEXT NOT NULL, -- Format: "MM:SS"
  status TEXT NOT NULL CHECK (status IN ('uploaded', 'transcribing', 'analyzing', 'completed', 'failed')),
  process_type TEXT NOT NULL DEFAULT 'standard',

  -- Timestamps
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Transcription data (stored as JSONB for flexibility)
  transcription JSONB, -- { text, duration, confidence, speakers: [{id, label, segments}] }

  -- Analysis data (stored as JSONB due to complex nested structure)
  analysis JSONB, -- { overallScore, processSteps, metrics, strengths, improvements, keyMoments, etc. }

  -- Error tracking
  error_message TEXT
);

-- Indexes for common queries
CREATE INDEX idx_recordings_user_id ON recordings(user_id);
CREATE INDEX idx_recordings_status ON recordings(status);
CREATE INDEX idx_recordings_uploaded_at ON recordings(uploaded_at DESC);
CREATE INDEX idx_recordings_user_status ON recordings(user_id, status);
CREATE INDEX idx_recordings_user_date ON recordings(user_id, uploaded_at DESC);

-- Enable Row Level Security
ALTER TABLE recordings ENABLE ROW LEVEL SECURITY;

-- RLS Policies for recordings
-- Users can see their own recordings
CREATE POLICY "Users can view own recordings"
  ON recordings FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own recordings
CREATE POLICY "Users can insert own recordings"
  ON recordings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own recordings
CREATE POLICY "Users can update own recordings"
  ON recordings FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete their own recordings
CREATE POLICY "Users can delete own recordings"
  ON recordings FOR DELETE
  USING (auth.uid() = user_id);

-- Managers can view all recordings (assuming role-based access)
CREATE POLICY "Managers can view all recordings"
  ON recordings FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role IN ('admin', 'sales_manager')
    )
  );

-- =====================================================
-- 2. SALES PROCESSES TABLE
-- =====================================================
-- Stores custom sales processes that users can define
CREATE TABLE IF NOT EXISTS sales_processes (
  id TEXT PRIMARY KEY, -- Using TEXT to match localStorage format (e.g., 'standard', 'custom_1')
  name TEXT NOT NULL,
  steps JSONB NOT NULL, -- Array of { name, description, keyBehaviors[] }
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_default BOOLEAN DEFAULT FALSE
);

-- Indexes
CREATE INDEX idx_sales_processes_created_by ON sales_processes(created_by);
CREATE INDEX idx_sales_processes_is_default ON sales_processes(is_default);

-- Enable RLS
ALTER TABLE sales_processes ENABLE ROW LEVEL SECURITY;

-- RLS Policies for sales_processes
-- Everyone can read default processes
CREATE POLICY "Anyone can view default processes"
  ON sales_processes FOR SELECT
  USING (is_default = true);

-- Users can read their own custom processes
CREATE POLICY "Users can view own processes"
  ON sales_processes FOR SELECT
  USING (created_by = auth.uid());

-- Users can create their own processes
CREATE POLICY "Users can create own processes"
  ON sales_processes FOR INSERT
  WITH CHECK (created_by = auth.uid());

-- Users can update their own processes
CREATE POLICY "Users can update own processes"
  ON sales_processes FOR UPDATE
  USING (created_by = auth.uid());

-- Users can delete their own processes (except defaults)
CREATE POLICY "Users can delete own processes"
  ON sales_processes FOR DELETE
  USING (created_by = auth.uid() AND is_default = false);

-- Admins can manage all processes
CREATE POLICY "Admins can manage all processes"
  ON sales_processes FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

-- =====================================================
-- 3. KNOWLEDGE BASES TABLE
-- =====================================================
-- Stores company-specific knowledge for AI analysis
CREATE TABLE IF NOT EXISTS knowledge_bases (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_info TEXT,
  products TEXT[], -- Array of product names
  common_objections TEXT[], -- Array of common objections
  best_practices TEXT[], -- Array of best practices
  industry_context TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  is_active BOOLEAN DEFAULT TRUE -- Allow multiple versions but only one active
);

-- Indexes
CREATE INDEX idx_knowledge_bases_is_active ON knowledge_bases(is_active);
CREATE INDEX idx_knowledge_bases_created_at ON knowledge_bases(created_at DESC);

-- Enable RLS
ALTER TABLE knowledge_bases ENABLE ROW LEVEL SECURITY;

-- RLS Policies for knowledge_bases
-- Everyone can read active knowledge base
CREATE POLICY "Anyone can view active knowledge base"
  ON knowledge_bases FOR SELECT
  USING (is_active = true);

-- Admins and managers can view all knowledge bases
CREATE POLICY "Admins can view all knowledge bases"
  ON knowledge_bases FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role IN ('admin', 'sales_manager')
    )
  );

-- Only admins can modify knowledge bases
CREATE POLICY "Admins can manage knowledge bases"
  ON knowledge_bases FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

-- =====================================================
-- 4. MANAGER REVIEWS TABLE
-- =====================================================
-- Stores manager reviews and feedback on recordings
CREATE TABLE IF NOT EXISTS manager_reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  recording_id UUID NOT NULL REFERENCES recordings(id) ON DELETE CASCADE,
  reviewer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reviewer_name TEXT NOT NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comments TEXT NOT NULL,
  key_takeaways TEXT[], -- Array of key takeaways
  action_items TEXT[], -- Array of action items
  reviewed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  CONSTRAINT manager_reviews_one_per_recording UNIQUE (recording_id)
);

-- Indexes
CREATE INDEX idx_manager_reviews_recording_id ON manager_reviews(recording_id);
CREATE INDEX idx_manager_reviews_reviewer_id ON manager_reviews(reviewer_id);
CREATE INDEX idx_manager_reviews_reviewed_at ON manager_reviews(reviewed_at DESC);

-- Enable RLS
ALTER TABLE manager_reviews ENABLE ROW LEVEL SECURITY;

-- RLS Policies for manager_reviews
-- Recording owner can view reviews on their recordings
CREATE POLICY "Recording owners can view reviews"
  ON manager_reviews FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM recordings
      WHERE recordings.id = manager_reviews.recording_id
      AND recordings.user_id = auth.uid()
    )
  );

-- Reviewers can view their own reviews
CREATE POLICY "Reviewers can view own reviews"
  ON manager_reviews FOR SELECT
  USING (reviewer_id = auth.uid());

-- Only managers can create reviews
CREATE POLICY "Managers can create reviews"
  ON manager_reviews FOR INSERT
  WITH CHECK (
    reviewer_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role IN ('admin', 'sales_manager')
    )
  );

-- Managers can update their own reviews
CREATE POLICY "Managers can update own reviews"
  ON manager_reviews FOR UPDATE
  USING (reviewer_id = auth.uid());

-- Managers can delete their own reviews
CREATE POLICY "Managers can delete own reviews"
  ON manager_reviews FOR DELETE
  USING (reviewer_id = auth.uid());

-- =====================================================
-- 5. FUNCTIONS AND TRIGGERS
-- =====================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_recordings_updated_at
  BEFORE UPDATE ON recordings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sales_processes_updated_at
  BEFORE UPDATE ON sales_processes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_knowledge_bases_updated_at
  BEFORE UPDATE ON knowledge_bases
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_manager_reviews_updated_at
  BEFORE UPDATE ON manager_reviews
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 6. HELPER VIEWS
-- =====================================================

-- View for recording statistics by user
CREATE OR REPLACE VIEW recording_stats AS
SELECT
  user_id,
  COUNT(*) as total_recordings,
  COUNT(*) FILTER (WHERE status = 'completed') as completed_recordings,
  COUNT(*) FILTER (WHERE status = 'failed') as failed_recordings,
  AVG((analysis->>'overallScore')::numeric) FILTER (WHERE status = 'completed') as average_score,
  MAX(uploaded_at) as last_upload
FROM recordings
GROUP BY user_id;

-- View for leaderboard data
CREATE OR REPLACE VIEW recordings_leaderboard AS
SELECT
  r.user_id,
  up.full_name as user_name,
  COUNT(*) as total_recordings,
  COUNT(*) FILTER (WHERE r.status = 'completed') as completed_recordings,
  ROUND(AVG((r.analysis->>'overallScore')::numeric) FILTER (WHERE r.status = 'completed'), 0) as average_score,
  RANK() OVER (ORDER BY AVG((r.analysis->>'overallScore')::numeric) FILTER (WHERE r.status = 'completed') DESC NULLS LAST) as rank
FROM recordings r
JOIN user_profiles up ON r.user_id = up.id
WHERE r.status = 'completed'
GROUP BY r.user_id, up.full_name
ORDER BY average_score DESC NULLS LAST;

-- =====================================================
-- 7. SEED DEFAULT DATA
-- =====================================================

-- Insert default sales process (standard 5-step)
INSERT INTO sales_processes (id, name, steps, is_default, created_at)
VALUES (
  'standard',
  'Standard 5-Step Sales Process',
  '[
    {
      "name": "Greeting & Rapport Building",
      "description": "Establish connection and build trust",
      "keyBehaviors": [
        "Warm and professional greeting",
        "Small talk to establish rapport",
        "Set agenda for the meeting",
        "Build initial trust"
      ]
    },
    {
      "name": "Needs Discovery",
      "description": "Understand client pain points and goals through questions",
      "keyBehaviors": [
        "Ask open-ended questions",
        "Active listening",
        "Probe for pain points",
        "Understand budget and timeline",
        "Identify decision makers"
      ]
    },
    {
      "name": "Product Presentation",
      "description": "Present solution matching their specific needs",
      "keyBehaviors": [
        "Tailor presentation to discovered needs",
        "Focus on benefits not features",
        "Use stories and examples",
        "Address specific pain points",
        "Demonstrate value clearly"
      ]
    },
    {
      "name": "Objection Handling",
      "description": "Address concerns and hesitations professionally",
      "keyBehaviors": [
        "Listen to objections fully",
        "Validate concerns",
        "Provide evidence-based responses",
        "Reframe objections as opportunities",
        "Confirm resolution"
      ]
    },
    {
      "name": "Closing",
      "description": "Ask for commitment and establish next steps",
      "keyBehaviors": [
        "Trial close throughout",
        "Ask for the sale directly",
        "Create urgency when appropriate",
        "Outline clear next steps",
        "Confirm commitment"
      ]
    }
  ]'::jsonb,
  true,
  NOW()
)
ON CONFLICT (id) DO NOTHING;

-- Insert default empty knowledge base (to be populated by admin)
INSERT INTO knowledge_bases (
  company_info,
  products,
  common_objections,
  best_practices,
  industry_context,
  is_active
)
VALUES (
  'Discount Fence USA - Premium fence installation services',
  ARRAY['Wood Fencing', 'Vinyl Fencing', 'Chain Link', 'Aluminum Fencing', 'Custom Gates'],
  ARRAY[
    'Price is too high',
    'Need to think about it',
    'Want to get other quotes',
    'Timing is not right',
    'Not sure about quality'
  ],
  ARRAY[
    'Always qualify budget early',
    'Build rapport before presenting',
    'Use social proof and testimonials',
    'Address objections proactively',
    'Follow up within 24 hours'
  ],
  'Residential and commercial fence installation',
  true
)
ON CONFLICT DO NOTHING;

-- =====================================================
-- 8. COMMENTS FOR DOCUMENTATION
-- =====================================================

COMMENT ON TABLE recordings IS 'Stores all AI Sales Coach recordings with transcriptions and analysis. Migrated from localStorage to prevent data loss.';
COMMENT ON TABLE sales_processes IS 'Custom sales processes that can be defined by users or administrators.';
COMMENT ON TABLE knowledge_bases IS 'Company-specific knowledge used by AI for contextual analysis of sales calls.';
COMMENT ON TABLE manager_reviews IS 'Manager reviews and coaching feedback on sales recordings.';

COMMENT ON COLUMN recordings.transcription IS 'JSONB: { text, duration, confidence, speakers: [{id, label, segments}] }';
COMMENT ON COLUMN recordings.analysis IS 'JSONB: { overallScore, processSteps, metrics, strengths, improvements, keyMoments, coachingPriorities, predictedOutcome, sentiment }';
COMMENT ON COLUMN sales_processes.steps IS 'JSONB: Array of { name, description, keyBehaviors[] }';
COMMENT ON COLUMN knowledge_bases.products IS 'Array of product names for context in sales conversations';
COMMENT ON COLUMN knowledge_bases.common_objections IS 'Array of common objections to help AI identify and coach on objection handling';

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================
-- Next steps:
-- 1. Run this migration: npm run migrate:apply
-- 2. Update recordings.ts to use Supabase (dual-write first)
-- 3. Create migration tool for users to move localStorage data
-- 4. Test thoroughly before production rollout
