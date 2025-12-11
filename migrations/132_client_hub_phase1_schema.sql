-- Migration: Client Hub Phase 1 - Geography, Clients, Communities
-- Part of O-027: Pricebook++ Client Hierarchy & Community Management System

-- ============================================
-- PHASE 1: GEOGRAPHIES (Labor rate zones)
-- ============================================

CREATE TABLE IF NOT EXISTS geographies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(20) NOT NULL UNIQUE,          -- 'AUS', 'SAT', 'HOU', etc.
  name VARCHAR(100) NOT NULL,                -- 'Austin', 'San Antonio', 'Houston'
  state VARCHAR(2) DEFAULT 'TX',

  -- Labor rates for this geography
  base_labor_rate DECIMAL(10,2),             -- Base hourly rate
  labor_rate_multiplier DECIMAL(5,3) DEFAULT 1.000,  -- Multiplier vs standard

  -- Metadata
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES user_profiles(id),
  updated_by UUID REFERENCES user_profiles(id)
);

-- ============================================
-- PHASE 2: CLIENTS
-- ============================================

CREATE TABLE IF NOT EXISTS clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Basic info
  name VARCHAR(255) NOT NULL,
  code VARCHAR(20) UNIQUE,                   -- Short code like 'PERRY', 'HIGHLAND'

  -- Classification
  business_unit VARCHAR(50) NOT NULL,        -- 'residential', 'commercial', 'builders'
  client_type VARCHAR(50) NOT NULL,          -- 'large_builder', 'custom_builder', 'landscaper', 'pool_company', 'homeowner', 'other'

  -- Contact info
  primary_contact_name VARCHAR(255),
  primary_contact_email VARCHAR(255),
  primary_contact_phone VARCHAR(50),
  billing_email VARCHAR(255),

  -- Address
  address_line1 VARCHAR(255),
  address_line2 VARCHAR(255),
  city VARCHAR(100),
  state VARCHAR(2) DEFAULT 'TX',
  zip VARCHAR(20),

  -- Pricing (Phase 4 - nullable for now)
  default_rate_sheet_id UUID,                -- FK added in Phase 4

  -- Invoicing preferences
  invoicing_frequency VARCHAR(20) DEFAULT 'per_job',  -- 'per_job', 'weekly', 'monthly'
  payment_terms INTEGER DEFAULT 30,          -- Days
  requires_po BOOLEAN DEFAULT false,

  -- Integration
  quickbooks_id VARCHAR(100),
  servicetitan_id VARCHAR(100),

  -- Status
  status VARCHAR(20) DEFAULT 'active',       -- 'prospect', 'onboarding', 'active', 'inactive'
  onboarding_started_at TIMESTAMPTZ,
  onboarding_completed_at TIMESTAMPTZ,

  -- Metadata
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES user_profiles(id),
  updated_by UUID REFERENCES user_profiles(id)
);

-- Client contacts (multiple contacts per client with roles)
CREATE TABLE IF NOT EXISTS client_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,

  name VARCHAR(255) NOT NULL,
  role VARCHAR(100),                         -- 'purchaser', 'accounts_payable', 'project_manager', etc.
  email VARCHAR(255),
  phone VARCHAR(50),
  is_primary BOOLEAN DEFAULT false,

  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- PHASE 3: COMMUNITIES (Optional children of Clients)
-- ============================================

CREATE TABLE IF NOT EXISTS communities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  geography_id UUID REFERENCES geographies(id),

  -- Basic info
  name VARCHAR(255) NOT NULL,
  code VARCHAR(50),                          -- e.g., 'PERRY-SIXCREEK'

  -- Address/Location
  address_line1 VARCHAR(255),
  city VARCHAR(100),
  state VARCHAR(2) DEFAULT 'TX',
  zip VARCHAR(20),

  -- Pricing (Phase 4 - nullable for now)
  rate_sheet_id UUID,                        -- Override client's default if set

  -- SKU Restrictions - THE KEY FEATURE!
  approved_sku_ids UUID[],                   -- Array of allowed SKU IDs (empty = all allowed)
  restrict_skus BOOLEAN DEFAULT false,       -- If true, only approved_sku_ids can be used

  -- Status
  status VARCHAR(20) DEFAULT 'active',       -- 'onboarding', 'active', 'inactive', 'completed'
  onboarding_started_at TIMESTAMPTZ,
  onboarding_completed_at TIMESTAMPTZ,

  -- Metadata
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES user_profiles(id),
  updated_by UUID REFERENCES user_profiles(id),

  UNIQUE(client_id, name)
);

-- Community contacts (superintendents, etc.)
CREATE TABLE IF NOT EXISTS community_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,

  name VARCHAR(255) NOT NULL,
  role VARCHAR(100) DEFAULT 'superintendent',  -- 'superintendent', 'foreman', 'assistant', etc.
  email VARCHAR(255),
  phone VARCHAR(50),
  is_primary BOOLEAN DEFAULT false,

  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- ONBOARDING CHECKLISTS
-- ============================================

-- Checklist templates
CREATE TABLE IF NOT EXISTS onboarding_checklist_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type VARCHAR(20) NOT NULL,          -- 'client' or 'community'
  name VARCHAR(255) NOT NULL,
  items JSONB NOT NULL DEFAULT '[]',         -- [{name, required, order}]
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Actual checklist progress for clients/communities
CREATE TABLE IF NOT EXISTS onboarding_checklists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type VARCHAR(20) NOT NULL,          -- 'client' or 'community'
  entity_id UUID NOT NULL,                   -- client_id or community_id
  template_id UUID REFERENCES onboarding_checklist_templates(id),

  items JSONB NOT NULL DEFAULT '[]',         -- [{name, required, completed, completed_at, completed_by, notes}]

  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- DOCUMENT STORAGE (for contracts, etc.)
-- ============================================

CREATE TABLE IF NOT EXISTS client_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Can be attached to client or community
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  community_id UUID REFERENCES communities(id) ON DELETE CASCADE,

  document_type VARCHAR(50) NOT NULL,        -- 'contract', 'pricing_agreement', 'w9', 'insurance', 'other'
  name VARCHAR(255) NOT NULL,
  file_url TEXT NOT NULL,
  file_size INTEGER,
  mime_type VARCHAR(100),

  -- Validity
  effective_date DATE,
  expiration_date DATE,

  uploaded_at TIMESTAMPTZ DEFAULT NOW(),
  uploaded_by UUID REFERENCES user_profiles(id),

  CONSTRAINT document_has_parent CHECK (client_id IS NOT NULL OR community_id IS NOT NULL)
);

-- ============================================
-- AUDIT LOG
-- ============================================

CREATE TABLE IF NOT EXISTS client_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  entity_type VARCHAR(20) NOT NULL,          -- 'client', 'community', 'contact', 'document'
  entity_id UUID NOT NULL,
  action VARCHAR(20) NOT NULL,               -- 'created', 'updated', 'deleted'

  changes JSONB,                             -- {field: {old, new}}

  performed_at TIMESTAMPTZ DEFAULT NOW(),
  performed_by UUID REFERENCES user_profiles(id)
);

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_clients_business_unit ON clients(business_unit);
CREATE INDEX IF NOT EXISTS idx_clients_client_type ON clients(client_type);
CREATE INDEX IF NOT EXISTS idx_clients_status ON clients(status);
CREATE INDEX IF NOT EXISTS idx_clients_quickbooks_id ON clients(quickbooks_id);

CREATE INDEX IF NOT EXISTS idx_communities_client_id ON communities(client_id);
CREATE INDEX IF NOT EXISTS idx_communities_geography_id ON communities(geography_id);
CREATE INDEX IF NOT EXISTS idx_communities_status ON communities(status);

CREATE INDEX IF NOT EXISTS idx_client_contacts_client_id ON client_contacts(client_id);
CREATE INDEX IF NOT EXISTS idx_community_contacts_community_id ON community_contacts(community_id);

CREATE INDEX IF NOT EXISTS idx_client_documents_client_id ON client_documents(client_id);
CREATE INDEX IF NOT EXISTS idx_client_documents_community_id ON client_documents(community_id);

CREATE INDEX IF NOT EXISTS idx_client_audit_log_entity ON client_audit_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_client_audit_log_performed_at ON client_audit_log(performed_at);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE geographies ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE communities ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE onboarding_checklist_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE onboarding_checklists ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_audit_log ENABLE ROW LEVEL SECURITY;

-- Policies: All authenticated users can read, admins/ops can write
DROP POLICY IF EXISTS "geographies_read" ON geographies;
CREATE POLICY "geographies_read" ON geographies FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "geographies_write" ON geographies;
CREATE POLICY "geographies_write" ON geographies FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('admin', 'operations'))
);

DROP POLICY IF EXISTS "clients_read" ON clients;
CREATE POLICY "clients_read" ON clients FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "clients_write" ON clients;
CREATE POLICY "clients_write" ON clients FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('admin', 'operations', 'sales-manager'))
);

DROP POLICY IF EXISTS "client_contacts_read" ON client_contacts;
CREATE POLICY "client_contacts_read" ON client_contacts FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "client_contacts_write" ON client_contacts;
CREATE POLICY "client_contacts_write" ON client_contacts FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('admin', 'operations', 'sales-manager'))
);

DROP POLICY IF EXISTS "communities_read" ON communities;
CREATE POLICY "communities_read" ON communities FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "communities_write" ON communities;
CREATE POLICY "communities_write" ON communities FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('admin', 'operations', 'sales-manager'))
);

DROP POLICY IF EXISTS "community_contacts_read" ON community_contacts;
CREATE POLICY "community_contacts_read" ON community_contacts FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "community_contacts_write" ON community_contacts;
CREATE POLICY "community_contacts_write" ON community_contacts FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('admin', 'operations', 'sales-manager'))
);

DROP POLICY IF EXISTS "onboarding_templates_read" ON onboarding_checklist_templates;
CREATE POLICY "onboarding_templates_read" ON onboarding_checklist_templates FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "onboarding_templates_write" ON onboarding_checklist_templates;
CREATE POLICY "onboarding_templates_write" ON onboarding_checklist_templates FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('admin', 'operations'))
);

DROP POLICY IF EXISTS "onboarding_checklists_read" ON onboarding_checklists;
CREATE POLICY "onboarding_checklists_read" ON onboarding_checklists FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "onboarding_checklists_write" ON onboarding_checklists;
CREATE POLICY "onboarding_checklists_write" ON onboarding_checklists FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('admin', 'operations', 'sales-manager'))
);

DROP POLICY IF EXISTS "client_documents_read" ON client_documents;
CREATE POLICY "client_documents_read" ON client_documents FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "client_documents_write" ON client_documents;
CREATE POLICY "client_documents_write" ON client_documents FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('admin', 'operations', 'sales-manager'))
);

DROP POLICY IF EXISTS "client_audit_log_read" ON client_audit_log;
CREATE POLICY "client_audit_log_read" ON client_audit_log FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "client_audit_log_write" ON client_audit_log;
CREATE POLICY "client_audit_log_write" ON client_audit_log FOR INSERT TO authenticated WITH CHECK (true);

-- ============================================
-- SEED DATA: Default Geographies
-- ============================================

INSERT INTO geographies (code, name, state, base_labor_rate, labor_rate_multiplier)
VALUES
  ('AUS', 'Austin', 'TX', 45.00, 1.000),
  ('SAT', 'San Antonio', 'TX', 42.00, 0.933),
  ('HOU', 'Houston', 'TX', 44.00, 0.978),
  ('DFW', 'Dallas-Fort Worth', 'TX', 46.00, 1.022)
ON CONFLICT (code) DO NOTHING;

-- ============================================
-- SEED DATA: Default Onboarding Checklists
-- ============================================

INSERT INTO onboarding_checklist_templates (entity_type, name, is_default, items)
VALUES
  ('client', 'Standard Client Onboarding', true, '[
    {"name": "QuickBooks customer created", "required": true, "order": 1},
    {"name": "Contract signed", "required": true, "order": 2},
    {"name": "W-9 received", "required": false, "order": 3},
    {"name": "Insurance certificate received", "required": false, "order": 4},
    {"name": "Primary contact verified", "required": true, "order": 5},
    {"name": "Billing contact verified", "required": true, "order": 6},
    {"name": "Payment terms confirmed", "required": true, "order": 7},
    {"name": "Rate sheet assigned", "required": false, "order": 8},
    {"name": "Welcome email sent", "required": false, "order": 9}
  ]'),
  ('community', 'Standard Community Onboarding', true, '[
    {"name": "Community address verified", "required": true, "order": 1},
    {"name": "Superintendent contact added", "required": true, "order": 2},
    {"name": "Geography/zone assigned", "required": true, "order": 3},
    {"name": "Approved SKUs selected", "required": false, "order": 4},
    {"name": "Site visit completed", "required": false, "order": 5},
    {"name": "Access instructions documented", "required": false, "order": 6}
  ]')
ON CONFLICT DO NOTHING;
