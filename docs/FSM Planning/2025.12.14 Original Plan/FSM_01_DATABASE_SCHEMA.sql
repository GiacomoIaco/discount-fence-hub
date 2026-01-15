-- ============================================================================
-- FSM_01_DATABASE_SCHEMA.sql
-- Complete Database Schema for FSM (Field Service Management) Extension
-- ============================================================================
-- Version: 1.0
-- For: Claude Code Implementation
-- Run in: Supabase SQL Editor
-- ============================================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- SECTION 1: RESOURCE MANAGEMENT TABLES
-- ============================================================================

-- Territories (Geographic zones for assignment optimization)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS territories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Identification
  code TEXT UNIQUE NOT NULL,           -- 'ATX-NORTH', 'SA-DOWNTOWN'
  name TEXT NOT NULL,                  -- 'Austin North'
  
  -- Business Unit Link
  business_unit_id UUID REFERENCES business_units(id),
  
  -- Geographic Bounds
  bounds JSONB,                        -- GeoJSON polygon (optional)
  center_lat DECIMAL(9,6),
  center_lng DECIMAL(9,6),
  
  -- Zip Code Coverage (simpler approach)
  zip_codes TEXT[] DEFAULT '{}',       -- ['78701', '78702', '78703']
  
  -- Default Assignments
  primary_crew_id UUID,                -- Will reference crews(id) after creation
  backup_crew_ids UUID[] DEFAULT '{}',
  primary_rep_id UUID REFERENCES auth.users(id),
  
  -- Metrics (cached, updated periodically)
  avg_jobs_per_week DECIMAL(4,1) DEFAULT 0,
  avg_revenue_per_week DECIMAL(10,2) DEFAULT 0,
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_territories_bu ON territories(business_unit_id);
CREATE INDEX idx_territories_active ON territories(is_active) WHERE is_active = true;
CREATE INDEX idx_territories_zip ON territories USING GIN(zip_codes);

-- Crews (Installation Teams)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS crews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Identification
  crew_code TEXT UNIQUE NOT NULL,      -- 'ATX-CREW-01'
  crew_name TEXT NOT NULL,             -- 'Austin Team Alpha'
  
  -- Assignment
  business_unit_id UUID NOT NULL REFERENCES business_units(id),
  territory_id UUID REFERENCES territories(id),
  
  -- Lead Tech
  lead_tech_id UUID REFERENCES auth.users(id),
  
  -- Capabilities
  skill_tags TEXT[] DEFAULT '{}',      -- ['wood_vertical', 'iron', 'commercial']
  max_daily_footage INTEGER DEFAULT 300,  -- Capacity planning
  
  -- Contact
  contact_phone TEXT,
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_crews_bu ON crews(business_unit_id);
CREATE INDEX idx_crews_territory ON crews(territory_id);
CREATE INDEX idx_crews_active ON crews(is_active) WHERE is_active = true;
CREATE INDEX idx_crews_skills ON crews USING GIN(skill_tags);

-- Add foreign key to territories now that crews exists
ALTER TABLE territories 
  ADD CONSTRAINT fk_territories_primary_crew 
  FOREIGN KEY (primary_crew_id) REFERENCES crews(id);

-- Crew Members (Junction table for crew composition)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS crew_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  crew_id UUID NOT NULL REFERENCES crews(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  
  -- Role
  role TEXT DEFAULT 'member',          -- 'lead', 'member', 'helper'
  is_primary BOOLEAN DEFAULT false,    -- Primary assignment (vs backup)
  
  -- Duration
  start_date DATE DEFAULT CURRENT_DATE,
  end_date DATE,                       -- NULL = still active
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraints
  UNIQUE(crew_id, user_id)
);

CREATE INDEX idx_crew_members_crew ON crew_members(crew_id);
CREATE INDEX idx_crew_members_user ON crew_members(user_id);

-- Sales Reps (Extends user_profiles for rep-specific data)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sales_reps (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID UNIQUE NOT NULL REFERENCES auth.users(id),
  
  -- Assignment
  business_unit_id UUID REFERENCES business_units(id),
  territory_ids UUID[] DEFAULT '{}',   -- Can cover multiple territories
  
  -- Capabilities
  handles_residential BOOLEAN DEFAULT true,
  handles_commercial BOOLEAN DEFAULT true,
  handles_builders BOOLEAN DEFAULT true,
  specialties TEXT[] DEFAULT '{}',     -- ['iron', 'large_projects', 'custom']
  
  -- Performance Metrics (cached, updated periodically)
  ytd_quotes_sent INTEGER DEFAULT 0,
  ytd_quotes_won INTEGER DEFAULT 0,
  ytd_revenue DECIMAL(12,2) DEFAULT 0,
  win_rate DECIMAL(5,2),               -- Calculated: won/sent * 100
  avg_response_time_hours DECIMAL(4,1),
  
  -- QUO Integration (for Project Radar)
  quo_user_id TEXT,
  quo_phone_numbers TEXT[] DEFAULT '{}',
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sales_reps_user ON sales_reps(user_id);
CREATE INDEX idx_sales_reps_bu ON sales_reps(business_unit_id);
CREATE INDEX idx_sales_reps_active ON sales_reps(is_active) WHERE is_active = true;

-- Crew Availability (Block time, vacations, limited availability)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS crew_availability (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  crew_id UUID NOT NULL REFERENCES crews(id) ON DELETE CASCADE,
  
  -- Date Range
  date_start DATE NOT NULL,
  date_end DATE,                       -- NULL = single day or ongoing
  
  -- Availability Type
  availability_type TEXT NOT NULL CHECK (availability_type IN ('available', 'unavailable', 'limited')),
  reason TEXT,                         -- 'vacation', 'equipment_maintenance', 'training'
  
  -- For limited availability
  max_hours DECIMAL(4,1),
  max_footage INTEGER,
  
  -- Notes
  notes TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_crew_availability_crew ON crew_availability(crew_id);
CREATE INDEX idx_crew_availability_dates ON crew_availability(date_start, date_end);


-- ============================================================================
-- SECTION 2: FSM PIPELINE TABLES
-- ============================================================================

-- Service Requests (Initial inquiries before estimates)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS service_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Request Identification
  request_number TEXT UNIQUE,          -- Auto-generated: 'REQ-2024-001234'
  
  -- Request Details
  request_type TEXT NOT NULL CHECK (request_type IN (
    'new_fence', 'repair', 'gate_only', 'consultation', 'warranty', 'other'
  )),
  title TEXT NOT NULL,
  description TEXT,
  
  -- Customer (may not be in Client Hub yet)
  customer_name TEXT,
  customer_phone TEXT,
  customer_email TEXT,
  customer_address TEXT,
  
  -- Client Hub Links (if customer exists)
  client_id UUID REFERENCES clients(id),
  community_id UUID REFERENCES communities(id),
  property_id UUID REFERENCES properties(id),
  
  -- Fence Details (preliminary)
  estimated_footage INTEGER,
  fence_type_preference TEXT,          -- 'wood', 'iron', 'not_sure'
  
  -- Source & Assignment
  source TEXT NOT NULL CHECK (source IN (
    'phone', 'website', 'walk_in', 'project_radar', 'referral', 'other'
  )),
  source_reference TEXT,               -- Conversation ID, referral name, etc.
  source_conversation_id UUID,         -- Project Radar conversation link
  
  received_by UUID REFERENCES auth.users(id),
  assigned_to UUID REFERENCES auth.users(id),
  
  -- Business Unit
  business_unit_id UUID REFERENCES business_units(id),
  
  -- Status
  status TEXT DEFAULT 'new' CHECK (status IN (
    'new', 'contacted', 'site_visit_scheduled', 'qualified', 'converted', 'declined', 'duplicate'
  )),
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  
  -- Decline/Close Reason
  decline_reason TEXT,
  
  -- Timestamps
  received_at TIMESTAMPTZ DEFAULT NOW(),
  first_contact_at TIMESTAMPTZ,
  site_visit_at TIMESTAMPTZ,
  converted_at TIMESTAMPTZ,
  
  -- Standard timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_service_requests_status ON service_requests(status);
CREATE INDEX idx_service_requests_assigned ON service_requests(assigned_to);
CREATE INDEX idx_service_requests_client ON service_requests(client_id);
CREATE INDEX idx_service_requests_bu ON service_requests(business_unit_id);
CREATE INDEX idx_service_requests_source ON service_requests(source);
CREATE INDEX idx_service_requests_date ON service_requests(received_at DESC);

-- Auto-generate request number
CREATE OR REPLACE FUNCTION generate_request_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.request_number IS NULL THEN
    NEW.request_number := 'REQ-' || TO_CHAR(NOW(), 'YYYY') || '-' || 
      LPAD(NEXTVAL('request_number_seq')::TEXT, 6, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE SEQUENCE IF NOT EXISTS request_number_seq START 1;

CREATE TRIGGER set_request_number
  BEFORE INSERT ON service_requests
  FOR EACH ROW
  EXECUTE FUNCTION generate_request_number();


-- Quotes (Estimates/Proposals)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS quotes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Links
  project_id UUID REFERENCES bom_projects(id),  -- BOM Calculator project
  request_id UUID REFERENCES service_requests(id),
  
  -- Quote Identification
  quote_number TEXT UNIQUE NOT NULL,   -- Auto-generated: 'QUO-2024-001234'
  version INTEGER DEFAULT 1,
  is_active BOOLEAN DEFAULT true,      -- Latest version is active
  parent_quote_id UUID REFERENCES quotes(id),  -- For versioning
  
  -- Customer
  client_id UUID REFERENCES clients(id),
  community_id UUID REFERENCES communities(id),
  property_id UUID REFERENCES properties(id),
  
  -- Site Info
  site_address TEXT NOT NULL,
  site_contact_name TEXT,
  site_contact_phone TEXT,
  
  -- Business Context
  business_unit_id UUID NOT NULL REFERENCES business_units(id),
  rate_sheet_id UUID REFERENCES rate_sheets(id),
  
  -- Pricing Summary
  material_total DECIMAL(10,2) NOT NULL DEFAULT 0,
  labor_total DECIMAL(10,2) NOT NULL DEFAULT 0,
  subtotal DECIMAL(10,2) NOT NULL DEFAULT 0,
  
  -- Tax & Discounts
  tax_rate DECIMAL(5,4) DEFAULT 0,
  tax_amount DECIMAL(10,2) DEFAULT 0,
  discount_type TEXT CHECK (discount_type IN ('percentage', 'fixed')),
  discount_value DECIMAL(10,2) DEFAULT 0,
  discount_amount DECIMAL(10,2) DEFAULT 0,
  discount_reason TEXT,
  
  -- Final Total
  grand_total DECIMAL(10,2) NOT NULL DEFAULT 0,
  
  -- Margin Tracking (internal, not shown to customer)
  cost_total DECIMAL(10,2),
  margin_amount DECIMAL(10,2),
  margin_percent DECIMAL(5,2),
  
  -- Validity
  valid_from DATE DEFAULT CURRENT_DATE,
  valid_until DATE,                    -- Quote expiration
  
  -- Status
  status TEXT DEFAULT 'draft' CHECK (status IN (
    'draft', 'pending_approval', 'approved', 'sent', 'viewed', 
    'accepted', 'rejected', 'expired', 'revised'
  )),
  
  -- Delivery Tracking
  sent_at TIMESTAMPTZ,
  sent_via TEXT CHECK (sent_via IN ('email', 'sms', 'in_person', 'portal')),
  sent_to_email TEXT,
  sent_to_phone TEXT,
  viewed_at TIMESTAMPTZ,
  responded_at TIMESTAMPTZ,
  
  -- Customer Response
  customer_notes TEXT,
  rejection_reason TEXT,
  
  -- Internal
  internal_notes TEXT,
  
  -- Creator & Approver
  created_by UUID REFERENCES auth.users(id),
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMPTZ,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_quotes_project ON quotes(project_id);
CREATE INDEX idx_quotes_request ON quotes(request_id);
CREATE INDEX idx_quotes_client ON quotes(client_id);
CREATE INDEX idx_quotes_status ON quotes(status);
CREATE INDEX idx_quotes_created ON quotes(created_at DESC);
CREATE INDEX idx_quotes_bu ON quotes(business_unit_id);

-- Auto-generate quote number
CREATE OR REPLACE FUNCTION generate_quote_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.quote_number IS NULL THEN
    NEW.quote_number := 'QUO-' || TO_CHAR(NOW(), 'YYYY') || '-' || 
      LPAD(NEXTVAL('quote_number_seq')::TEXT, 6, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE SEQUENCE IF NOT EXISTS quote_number_seq START 1;

CREATE TRIGGER set_quote_number
  BEFORE INSERT ON quotes
  FOR EACH ROW
  EXECUTE FUNCTION generate_quote_number();


-- Quote Line Items (Links to BOM Calculator line items)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS quote_line_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  quote_id UUID NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  
  -- Source Reference
  bom_line_item_id UUID,               -- Reference to project_line_items if exists
  
  -- Product Reference
  product_type TEXT NOT NULL,          -- 'wood_vertical', 'wood_horizontal', 'iron'
  product_id UUID,                     -- FK to specific product table
  sku_code TEXT NOT NULL,
  sku_name TEXT NOT NULL,
  
  -- Specifications
  linear_feet DECIMAL(10,2) NOT NULL,
  height_ft INTEGER NOT NULL,
  style TEXT,
  post_type TEXT,                      -- 'WOOD', 'STEEL'
  
  -- Gates
  gate_count INTEGER DEFAULT 0,
  gate_details JSONB,                  -- [{type: 'single', width: 4}, {type: 'double', width: 12}]
  
  -- Calculated Quantities (snapshot from BOM Calculator)
  calculated_materials JSONB,          -- Material quantities
  calculated_labor JSONB,              -- Labor items
  
  -- Pricing
  material_cost DECIMAL(10,2) NOT NULL DEFAULT 0,
  labor_cost DECIMAL(10,2) NOT NULL DEFAULT 0,
  unit_price DECIMAL(10,2),            -- Price per LF
  line_total DECIMAL(10,2) NOT NULL DEFAULT 0,
  
  -- Display
  display_order INTEGER DEFAULT 0,
  description TEXT,
  notes TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_quote_line_items_quote ON quote_line_items(quote_id);


-- Jobs (Scheduled Work)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Links
  project_id UUID REFERENCES bom_projects(id),
  quote_id UUID REFERENCES quotes(id),
  request_id UUID REFERENCES service_requests(id),
  
  -- Job Identification
  job_number TEXT UNIQUE NOT NULL,     -- Auto-generated: 'JOB-2024-001234'
  job_type TEXT NOT NULL CHECK (job_type IN (
    'installation', 'repair', 'warranty', 'service', 'inspection'
  )),
  
  -- Customer
  client_id UUID REFERENCES clients(id),
  community_id UUID REFERENCES communities(id),
  property_id UUID REFERENCES properties(id),
  
  -- Scheduling
  scheduled_date DATE NOT NULL,
  scheduled_time_start TIME,
  scheduled_time_end TIME,
  estimated_duration_hours DECIMAL(4,1),
  
  -- Assignment
  assigned_crew_id UUID REFERENCES crews(id),
  assigned_techs UUID[] DEFAULT '{}', -- Array of user IDs for specific techs
  
  -- Location
  site_address TEXT NOT NULL,
  site_lat DECIMAL(9,6),
  site_lng DECIMAL(9,6),
  site_access_notes TEXT,
  site_contact_name TEXT,
  site_contact_phone TEXT,
  gate_code TEXT,
  
  -- Business Context
  business_unit_id UUID NOT NULL REFERENCES business_units(id),
  
  -- Status
  status TEXT DEFAULT 'scheduled' CHECK (status IN (
    'scheduled', 'confirmed', 'en_route', 'arrived', 'in_progress',
    'completed', 'partial', 'rescheduled', 'cancelled', 'no_show'
  )),
  
  -- Execution Tracking
  confirmed_at TIMESTAMPTZ,
  confirmed_by UUID REFERENCES auth.users(id),
  departed_at TIMESTAMPTZ,
  arrived_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  
  -- Completion Details
  completion_notes TEXT,
  completion_photos TEXT[] DEFAULT '{}',
  customer_signature_url TEXT,
  actual_duration_hours DECIMAL(4,1),
  actual_footage_installed INTEGER,
  
  -- Issues
  has_issues BOOLEAN DEFAULT false,
  issue_notes TEXT,
  requires_return_visit BOOLEAN DEFAULT false,
  return_visit_reason TEXT,
  
  -- Rescheduling
  original_date DATE,
  reschedule_reason TEXT,
  rescheduled_by UUID REFERENCES auth.users(id),
  
  -- Internal
  internal_notes TEXT,
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_jobs_project ON jobs(project_id);
CREATE INDEX idx_jobs_quote ON jobs(quote_id);
CREATE INDEX idx_jobs_client ON jobs(client_id);
CREATE INDEX idx_jobs_crew ON jobs(assigned_crew_id);
CREATE INDEX idx_jobs_date ON jobs(scheduled_date);
CREATE INDEX idx_jobs_status ON jobs(status);
CREATE INDEX idx_jobs_bu ON jobs(business_unit_id);

-- Auto-generate job number
CREATE OR REPLACE FUNCTION generate_job_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.job_number IS NULL THEN
    NEW.job_number := 'JOB-' || TO_CHAR(NOW(), 'YYYY') || '-' || 
      LPAD(NEXTVAL('job_number_seq')::TEXT, 6, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE SEQUENCE IF NOT EXISTS job_number_seq START 1;

CREATE TRIGGER set_job_number
  BEFORE INSERT ON jobs
  FOR EACH ROW
  EXECUTE FUNCTION generate_job_number();


-- Invoices
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Links
  project_id UUID REFERENCES bom_projects(id),
  job_id UUID REFERENCES jobs(id),
  quote_id UUID REFERENCES quotes(id),
  
  -- Invoice Identification
  invoice_number TEXT UNIQUE NOT NULL, -- Auto-generated
  
  -- Customer/Billing
  client_id UUID NOT NULL REFERENCES clients(id),
  billing_address JSONB,               -- {line1, line2, city, state, zip}
  billing_contact_name TEXT,
  billing_contact_email TEXT,
  po_number TEXT,                      -- Purchase order if required
  
  -- Business Context
  business_unit_id UUID NOT NULL REFERENCES business_units(id),
  
  -- Amounts
  subtotal DECIMAL(10,2) NOT NULL DEFAULT 0,
  tax_rate DECIMAL(5,4) DEFAULT 0,
  tax_amount DECIMAL(10,2) DEFAULT 0,
  discount_amount DECIMAL(10,2) DEFAULT 0,
  total_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  amount_paid DECIMAL(10,2) DEFAULT 0,
  amount_due DECIMAL(10,2) GENERATED ALWAYS AS (total_amount - amount_paid) STORED,
  
  -- Dates
  invoice_date DATE DEFAULT CURRENT_DATE,
  due_date DATE,
  
  -- Status
  status TEXT DEFAULT 'draft' CHECK (status IN (
    'draft', 'pending_approval', 'approved', 'sent', 'viewed',
    'partial', 'paid', 'overdue', 'void', 'disputed'
  )),
  
  -- Delivery
  sent_at TIMESTAMPTZ,
  sent_via TEXT,
  sent_to_email TEXT,
  viewed_at TIMESTAMPTZ,
  
  -- Payment
  paid_at TIMESTAMPTZ,
  payment_method TEXT,
  payment_reference TEXT,
  
  -- Integration
  qbo_invoice_id TEXT,                 -- QuickBooks ID
  service_titan_invoice_id TEXT,
  
  -- Internal
  internal_notes TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_invoices_project ON invoices(project_id);
CREATE INDEX idx_invoices_job ON invoices(job_id);
CREATE INDEX idx_invoices_client ON invoices(client_id);
CREATE INDEX idx_invoices_status ON invoices(status);
CREATE INDEX idx_invoices_date ON invoices(invoice_date DESC);
CREATE INDEX idx_invoices_due ON invoices(due_date) WHERE status NOT IN ('paid', 'void');

-- Auto-generate invoice number
CREATE OR REPLACE FUNCTION generate_invoice_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.invoice_number IS NULL THEN
    NEW.invoice_number := 'INV-' || TO_CHAR(NOW(), 'YYYY') || '-' || 
      LPAD(NEXTVAL('invoice_number_seq')::TEXT, 6, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE SEQUENCE IF NOT EXISTS invoice_number_seq START 1;

CREATE TRIGGER set_invoice_number
  BEFORE INSERT ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION generate_invoice_number();


-- Invoice Line Items
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS invoice_line_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  
  -- Item Details
  item_type TEXT NOT NULL CHECK (item_type IN ('material', 'labor', 'other', 'discount')),
  description TEXT NOT NULL,
  sku_code TEXT,
  
  -- Quantities & Pricing
  quantity DECIMAL(10,2) NOT NULL DEFAULT 1,
  unit_price DECIMAL(10,2) NOT NULL DEFAULT 0,
  line_total DECIMAL(10,2) NOT NULL DEFAULT 0,
  
  -- Tax
  is_taxable BOOLEAN DEFAULT true,
  
  -- Display
  display_order INTEGER DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_invoice_line_items_invoice ON invoice_line_items(invoice_id);


-- ============================================================================
-- SECTION 3: SCHEDULING TABLES
-- ============================================================================

-- Schedule Entries (Calendar blocks)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS schedule_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Reference
  job_id UUID REFERENCES jobs(id) ON DELETE CASCADE,
  crew_id UUID NOT NULL REFERENCES crews(id),
  
  -- Time Block
  entry_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  
  -- Type
  entry_type TEXT NOT NULL CHECK (entry_type IN (
    'job', 'travel', 'break', 'blocked', 'meeting', 'training'
  )),
  
  -- Status
  status TEXT DEFAULT 'scheduled' CHECK (status IN (
    'scheduled', 'confirmed', 'in_progress', 'completed', 'cancelled'
  )),
  
  -- Location (for route optimization)
  location_lat DECIMAL(9,6),
  location_lng DECIMAL(9,6),
  location_address TEXT,
  
  -- Job-specific
  estimated_footage INTEGER,           -- For job entries
  
  -- Notes
  title TEXT,
  notes TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_schedule_crew_date ON schedule_entries(crew_id, entry_date);
CREATE INDEX idx_schedule_date ON schedule_entries(entry_date);
CREATE INDEX idx_schedule_job ON schedule_entries(job_id);


-- ============================================================================
-- SECTION 4: HISTORY & AUDIT TABLES
-- ============================================================================

-- Labor Rate History
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS labor_rate_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  labor_code_id UUID NOT NULL REFERENCES labor_codes(id),
  business_unit_id UUID NOT NULL REFERENCES business_units(id),
  
  old_rate DECIMAL(10,2),
  new_rate DECIMAL(10,2) NOT NULL,
  effective_date DATE NOT NULL,
  
  changed_by UUID REFERENCES auth.users(id),
  change_reason TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_labor_rate_history_lookup ON labor_rate_history(labor_code_id, business_unit_id);
CREATE INDEX idx_labor_rate_history_date ON labor_rate_history(created_at DESC);

-- Material Price History
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS material_price_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  material_id UUID NOT NULL REFERENCES materials(id),
  material_sku TEXT NOT NULL,
  
  old_price DECIMAL(10,2),
  new_price DECIMAL(10,2) NOT NULL,
  
  change_type TEXT,                    -- 'percentage', 'fixed', 'csv', 'manual'
  change_value DECIMAL(10,2),          -- The % or $ amount used
  
  changed_by UUID REFERENCES auth.users(id),
  change_reason TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_material_price_history_material ON material_price_history(material_id);
CREATE INDEX idx_material_price_history_sku ON material_price_history(material_sku);
CREATE INDEX idx_material_price_history_date ON material_price_history(created_at DESC);


-- ============================================================================
-- SECTION 5: EXTEND EXISTING TABLES
-- ============================================================================

-- Add FSM fields to bom_projects
-- ----------------------------------------------------------------------------
DO $$ 
BEGIN
  -- Project type
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'bom_projects' AND column_name = 'project_type') THEN
    ALTER TABLE bom_projects ADD COLUMN project_type TEXT DEFAULT 'estimate';
  END IF;
  
  -- Quote link
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'bom_projects' AND column_name = 'quote_id') THEN
    ALTER TABLE bom_projects ADD COLUMN quote_id UUID REFERENCES quotes(id);
  END IF;
  
  -- Job link
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'bom_projects' AND column_name = 'job_id') THEN
    ALTER TABLE bom_projects ADD COLUMN job_id UUID REFERENCES jobs(id);
  END IF;
  
  -- Request link
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'bom_projects' AND column_name = 'request_id') THEN
    ALTER TABLE bom_projects ADD COLUMN request_id UUID REFERENCES service_requests(id);
  END IF;
  
  -- Assigned rep
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'bom_projects' AND column_name = 'assigned_rep_id') THEN
    ALTER TABLE bom_projects ADD COLUMN assigned_rep_id UUID REFERENCES auth.users(id);
  END IF;
  
  -- Assigned crew
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'bom_projects' AND column_name = 'assigned_crew_id') THEN
    ALTER TABLE bom_projects ADD COLUMN assigned_crew_id UUID REFERENCES crews(id);
  END IF;
  
  -- Scheduling fields
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'bom_projects' AND column_name = 'scheduled_date') THEN
    ALTER TABLE bom_projects ADD COLUMN scheduled_date DATE;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'bom_projects' AND column_name = 'scheduled_time') THEN
    ALTER TABLE bom_projects ADD COLUMN scheduled_time TIME;
  END IF;
  
  -- Financial tracking
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'bom_projects' AND column_name = 'quoted_price') THEN
    ALTER TABLE bom_projects ADD COLUMN quoted_price DECIMAL(10,2);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'bom_projects' AND column_name = 'invoiced_amount') THEN
    ALTER TABLE bom_projects ADD COLUMN invoiced_amount DECIMAL(10,2);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'bom_projects' AND column_name = 'paid_amount') THEN
    ALTER TABLE bom_projects ADD COLUMN paid_amount DECIMAL(10,2);
  END IF;
END $$;


-- ============================================================================
-- SECTION 6: HELPER FUNCTIONS
-- ============================================================================

-- Update labor rate with history tracking
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_labor_rate(
  p_labor_code_id UUID,
  p_business_unit_id UUID,
  p_new_rate DECIMAL(10,2),
  p_effective_date DATE,
  p_changed_by UUID,
  p_change_reason TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_old_rate DECIMAL(10,2);
  v_rate_id UUID;
  v_history_id UUID;
BEGIN
  -- Get current rate
  SELECT rate, id INTO v_old_rate, v_rate_id
  FROM labor_rates
  WHERE labor_code_id = p_labor_code_id
    AND business_unit_id = p_business_unit_id;
  
  -- Update rate
  UPDATE labor_rates
  SET rate = p_new_rate,
      effective_date = p_effective_date,
      updated_at = NOW()
  WHERE id = v_rate_id;
  
  -- Record history
  INSERT INTO labor_rate_history (
    labor_code_id, business_unit_id, old_rate, new_rate,
    effective_date, changed_by, change_reason
  ) VALUES (
    p_labor_code_id, p_business_unit_id, v_old_rate, p_new_rate,
    p_effective_date, p_changed_by, p_change_reason
  ) RETURNING id INTO v_history_id;
  
  RETURN v_history_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update material price with history tracking
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_material_price(
  p_material_id UUID,
  p_new_price DECIMAL(10,2),
  p_change_type TEXT,
  p_change_value DECIMAL(10,2),
  p_changed_by UUID,
  p_change_reason TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_old_price DECIMAL(10,2);
  v_material_sku TEXT;
  v_history_id UUID;
BEGIN
  -- Get current price and SKU
  SELECT unit_cost, material_sku INTO v_old_price, v_material_sku
  FROM materials
  WHERE id = p_material_id;
  
  -- Update price
  UPDATE materials
  SET unit_cost = p_new_price,
      updated_at = NOW()
  WHERE id = p_material_id;
  
  -- Record history
  INSERT INTO material_price_history (
    material_id, material_sku, old_price, new_price,
    change_type, change_value, changed_by, change_reason
  ) VALUES (
    p_material_id, v_material_sku, v_old_price, p_new_price,
    p_change_type, p_change_value, p_changed_by, p_change_reason
  ) RETURNING id INTO v_history_id;
  
  RETURN v_history_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Find territory by zip code
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION find_territory_by_zip(p_zip_code TEXT)
RETURNS UUID AS $$
DECLARE
  v_territory_id UUID;
BEGIN
  SELECT id INTO v_territory_id
  FROM territories
  WHERE p_zip_code = ANY(zip_codes)
    AND is_active = true
  LIMIT 1;
  
  RETURN v_territory_id;
END;
$$ LANGUAGE plpgsql;

-- Get crew availability for date range
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_crew_availability(
  p_crew_id UUID,
  p_start_date DATE,
  p_end_date DATE
) RETURNS TABLE (
  date DATE,
  availability_type TEXT,
  reason TEXT,
  scheduled_hours DECIMAL,
  scheduled_footage INTEGER,
  available_hours DECIMAL,
  available_footage INTEGER
) AS $$
BEGIN
  RETURN QUERY
  WITH date_series AS (
    SELECT generate_series(p_start_date, p_end_date, '1 day'::interval)::date AS date
  ),
  availability AS (
    SELECT 
      ca.date_start,
      ca.date_end,
      ca.availability_type,
      ca.reason,
      ca.max_hours,
      ca.max_footage
    FROM crew_availability ca
    WHERE ca.crew_id = p_crew_id
      AND ca.date_start <= p_end_date
      AND (ca.date_end IS NULL OR ca.date_end >= p_start_date)
  ),
  scheduled AS (
    SELECT 
      se.entry_date,
      SUM(EXTRACT(EPOCH FROM (se.end_time - se.start_time)) / 3600) AS hours,
      SUM(se.estimated_footage) AS footage
    FROM schedule_entries se
    WHERE se.crew_id = p_crew_id
      AND se.entry_date BETWEEN p_start_date AND p_end_date
      AND se.status NOT IN ('cancelled')
    GROUP BY se.entry_date
  )
  SELECT 
    ds.date,
    COALESCE(a.availability_type, 'available') AS availability_type,
    a.reason,
    COALESCE(s.hours, 0)::DECIMAL AS scheduled_hours,
    COALESCE(s.footage, 0)::INTEGER AS scheduled_footage,
    CASE 
      WHEN a.availability_type = 'unavailable' THEN 0
      WHEN a.max_hours IS NOT NULL THEN GREATEST(0, a.max_hours - COALESCE(s.hours, 0))
      ELSE 8 - COALESCE(s.hours, 0)  -- Default 8 hour day
    END::DECIMAL AS available_hours,
    CASE 
      WHEN a.availability_type = 'unavailable' THEN 0
      WHEN a.max_footage IS NOT NULL THEN GREATEST(0, a.max_footage - COALESCE(s.footage, 0))
      ELSE (SELECT c.max_daily_footage FROM crews c WHERE c.id = p_crew_id) - COALESCE(s.footage, 0)
    END::INTEGER AS available_footage
  FROM date_series ds
  LEFT JOIN availability a ON ds.date BETWEEN a.date_start AND COALESCE(a.date_end, ds.date)
  LEFT JOIN scheduled s ON ds.date = s.entry_date
  ORDER BY ds.date;
END;
$$ LANGUAGE plpgsql;


-- ============================================================================
-- SECTION 7: VIEWS
-- ============================================================================

-- Quote Summary View
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_quote_summary AS
SELECT 
  q.*,
  c.name AS client_name,
  c.code AS client_code,
  bu.code AS business_unit_code,
  bu.name AS business_unit_name,
  sr.request_number,
  p.project_code,
  u.email AS created_by_email,
  up.full_name AS created_by_name
FROM quotes q
LEFT JOIN clients c ON q.client_id = c.id
LEFT JOIN business_units bu ON q.business_unit_id = bu.id
LEFT JOIN service_requests sr ON q.request_id = sr.id
LEFT JOIN bom_projects p ON q.project_id = p.id
LEFT JOIN auth.users u ON q.created_by = u.id
LEFT JOIN user_profiles up ON q.created_by = up.id;

-- Job Schedule View
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_job_schedule AS
SELECT 
  j.*,
  c.name AS client_name,
  cr.crew_code,
  cr.crew_name,
  bu.code AS business_unit_code,
  q.quote_number,
  q.grand_total AS quote_total,
  p.project_code,
  p.project_name
FROM jobs j
LEFT JOIN clients c ON j.client_id = c.id
LEFT JOIN crews cr ON j.assigned_crew_id = cr.id
LEFT JOIN business_units bu ON j.business_unit_id = bu.id
LEFT JOIN quotes q ON j.quote_id = q.id
LEFT JOIN bom_projects p ON j.project_id = p.id;

-- Request Pipeline View
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_request_pipeline AS
SELECT 
  sr.*,
  c.name AS client_name,
  bu.code AS business_unit_code,
  u_assigned.email AS assigned_to_email,
  up_assigned.full_name AS assigned_to_name,
  (SELECT COUNT(*) FROM quotes q WHERE q.request_id = sr.id) AS quote_count,
  (SELECT q.quote_number FROM quotes q WHERE q.request_id = sr.id AND q.is_active ORDER BY q.created_at DESC LIMIT 1) AS latest_quote
FROM service_requests sr
LEFT JOIN clients c ON sr.client_id = c.id
LEFT JOIN business_units bu ON sr.business_unit_id = bu.id
LEFT JOIN auth.users u_assigned ON sr.assigned_to = u_assigned.id
LEFT JOIN user_profiles up_assigned ON sr.assigned_to = up_assigned.id;


-- ============================================================================
-- SECTION 8: ROW LEVEL SECURITY
-- ============================================================================

-- Enable RLS on new tables
ALTER TABLE territories ENABLE ROW LEVEL SECURITY;
ALTER TABLE crews ENABLE ROW LEVEL SECURITY;
ALTER TABLE crew_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_reps ENABLE ROW LEVEL SECURITY;
ALTER TABLE crew_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE quote_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedule_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE labor_rate_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE material_price_history ENABLE ROW LEVEL SECURITY;

-- Basic policies (allow authenticated users - refine based on roles later)
-- ----------------------------------------------------------------------------
CREATE POLICY "Allow authenticated read" ON territories FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated read" ON crews FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated read" ON crew_members FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated read" ON sales_reps FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated read" ON crew_availability FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated read" ON service_requests FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated read" ON quotes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated read" ON quote_line_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated read" ON jobs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated read" ON invoices FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated read" ON invoice_line_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated read" ON schedule_entries FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated read" ON labor_rate_history FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated read" ON material_price_history FOR SELECT TO authenticated USING (true);

-- Write policies for admin/ops roles (simplified - expand based on your role system)
CREATE POLICY "Allow admin write" ON territories FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow admin write" ON crews FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow admin write" ON crew_members FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow admin write" ON sales_reps FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow admin write" ON crew_availability FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow admin write" ON service_requests FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow admin write" ON quotes FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow admin write" ON quote_line_items FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow admin write" ON jobs FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow admin write" ON invoices FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow admin write" ON invoice_line_items FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow admin write" ON schedule_entries FOR ALL TO authenticated USING (true) WITH CHECK (true);


-- ============================================================================
-- END OF SCHEMA
-- ============================================================================
