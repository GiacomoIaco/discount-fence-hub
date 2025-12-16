-- Migration: Custom Fields System
-- Allows users to define custom fields with Jobber-style transferability
-- Reference: https://help.getjobber.com/hc/en-us/articles/115009735928-Custom-Fields

-- Custom Field Definitions
-- Defines what custom fields exist for each entity type
CREATE TABLE IF NOT EXISTS custom_field_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Entity type this field applies to
  -- 'client', 'community', 'property', 'request', 'quote', 'job', 'invoice'
  entity_type VARCHAR(50) NOT NULL,

  -- Field identification
  field_name VARCHAR(100) NOT NULL,
  field_label VARCHAR(255) NOT NULL,

  -- Field type: 'text', 'number', 'date', 'select', 'boolean', 'textarea', 'url', 'email', 'phone'
  field_type VARCHAR(50) NOT NULL,

  -- For select type: [{value, label}]
  options JSONB,

  -- Placeholder text for input
  placeholder TEXT,

  -- ============================================
  -- TRANSFERABILITY (Jobber-style)
  -- ============================================
  -- If true, value transfers forward in workflow
  -- Quote → Job → Invoice
  -- Request → Quote → Job → Invoice
  is_transferable BOOLEAN DEFAULT false,

  -- Which entity types this field transfers TO
  -- e.g., a Quote field with transfers_to = ['job', 'invoice']
  -- means when Quote → Job, the value copies over
  transfers_to VARCHAR(50)[] DEFAULT '{}',

  -- ============================================
  -- VISIBILITY
  -- ============================================
  -- If true, appears on customer-facing documents (PDFs, portals)
  is_client_facing BOOLEAN DEFAULT false,

  -- If true, appears in reports
  show_in_reports BOOLEAN DEFAULT true,

  -- ============================================
  -- VALIDATION & DISPLAY
  -- ============================================
  is_required BOOLEAN DEFAULT false,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,

  -- Help text shown below the field
  help_text TEXT,

  -- Default value for new entities
  default_value JSONB,

  -- ============================================
  -- METADATA
  -- ============================================
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(entity_type, field_name)
);

-- Custom Field Values
-- Stores the actual values for each entity's custom fields
CREATE TABLE IF NOT EXISTS custom_field_values (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  definition_id UUID NOT NULL REFERENCES custom_field_definitions(id) ON DELETE CASCADE,

  -- Denormalized for faster queries
  entity_type VARCHAR(50) NOT NULL,
  entity_id UUID NOT NULL,

  -- The actual value (string, number, boolean, etc.)
  value JSONB NOT NULL,

  -- Track where this value originated (for transferred fields)
  -- e.g., if transferred from quote, source_entity_type='quote', source_entity_id=<quote_id>
  source_entity_type VARCHAR(50),
  source_entity_id UUID,

  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id),

  UNIQUE(definition_id, entity_id)
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_cfd_entity_type ON custom_field_definitions(entity_type) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_cfd_transferable ON custom_field_definitions(entity_type) WHERE is_transferable = true;
CREATE INDEX IF NOT EXISTS idx_cfv_entity ON custom_field_values(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_cfv_definition ON custom_field_values(definition_id);
CREATE INDEX IF NOT EXISTS idx_cfv_source ON custom_field_values(source_entity_type, source_entity_id) WHERE source_entity_id IS NOT NULL;

-- ============================================
-- COMMENTS
-- ============================================
COMMENT ON TABLE custom_field_definitions IS 'Defines custom fields that can be added to various entities';
COMMENT ON TABLE custom_field_values IS 'Stores values for custom fields on specific entities';
COMMENT ON COLUMN custom_field_definitions.is_transferable IS 'If true, value copies forward when entity converts (Quote→Job→Invoice)';
COMMENT ON COLUMN custom_field_definitions.transfers_to IS 'Array of entity types this field transfers to';
COMMENT ON COLUMN custom_field_definitions.is_client_facing IS 'If true, shows on customer-facing PDFs and portals';

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================
ALTER TABLE custom_field_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_field_values ENABLE ROW LEVEL SECURITY;

-- RLS Policies - Allow authenticated users to read/write
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'custom_field_definitions'
    AND policyname = 'Authenticated users can manage custom field definitions'
  ) THEN
    CREATE POLICY "Authenticated users can manage custom field definitions"
      ON custom_field_definitions FOR ALL TO authenticated
      USING (true) WITH CHECK (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'custom_field_values'
    AND policyname = 'Authenticated users can manage custom field values'
  ) THEN
    CREATE POLICY "Authenticated users can manage custom field values"
      ON custom_field_values FOR ALL TO authenticated
      USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ============================================
-- DEFAULT CUSTOM FIELDS FOR FENCE COMPANY
-- ============================================

-- Client custom fields
INSERT INTO custom_field_definitions (entity_type, field_name, field_label, field_type, sort_order, is_active, is_client_facing)
VALUES
  ('client', 'warranty_contact', 'Warranty Contact', 'text', 1, true, false),
  ('client', 'warranty_email', 'Warranty Email', 'email', 2, true, false),
  ('client', 'warranty_phone', 'Warranty Phone', 'phone', 3, true, false),
  ('client', 'tax_exempt', 'Tax Exempt', 'boolean', 4, true, false),
  ('client', 'tax_exempt_number', 'Tax Exempt Number', 'text', 5, true, false)
ON CONFLICT (entity_type, field_name) DO NOTHING;

-- Community custom fields
INSERT INTO custom_field_definitions (entity_type, field_name, field_label, field_type, sort_order, is_active)
VALUES
  ('community', 'hoa_name', 'HOA Name', 'text', 1, true),
  ('community', 'hoa_contact', 'HOA Contact', 'text', 2, true),
  ('community', 'hoa_phone', 'HOA Phone', 'phone', 3, true),
  ('community', 'permit_required', 'Permit Required', 'boolean', 4, true),
  ('community', 'average_lot_size', 'Average Lot Size (sq ft)', 'number', 5, true),
  ('community', 'fence_height_restriction', 'Fence Height Restriction', 'text', 6, true)
ON CONFLICT (entity_type, field_name) DO NOTHING;

-- Property custom fields
INSERT INTO custom_field_definitions (entity_type, field_name, field_label, field_type, sort_order, is_active)
VALUES
  ('property', 'pool_present', 'Pool Present', 'boolean', 1, true),
  ('property', 'existing_fence', 'Existing Fence', 'boolean', 2, true),
  ('property', 'fence_removal_needed', 'Fence Removal Needed', 'boolean', 3, true),
  ('property', 'easement_notes', 'Easement Notes', 'textarea', 4, true)
ON CONFLICT (entity_type, field_name) DO NOTHING;

-- Quote custom fields (TRANSFERABLE to Job and Invoice)
INSERT INTO custom_field_definitions (entity_type, field_name, field_label, field_type, sort_order, is_active, is_transferable, transfers_to, is_client_facing)
VALUES
  ('quote', 'po_number', 'PO Number', 'text', 1, true, true, ARRAY['job', 'invoice'], true),
  ('quote', 'special_instructions', 'Special Instructions', 'textarea', 2, true, true, ARRAY['job'], false),
  ('quote', 'permit_number', 'Permit Number', 'text', 3, true, true, ARRAY['job', 'invoice'], true),
  ('quote', 'hoa_approval_date', 'HOA Approval Date', 'date', 4, true, true, ARRAY['job'], false)
ON CONFLICT (entity_type, field_name) DO NOTHING;

-- Job custom fields
INSERT INTO custom_field_definitions (entity_type, field_name, field_label, field_type, sort_order, is_active, is_client_facing)
VALUES
  ('job', 'inspection_required', 'Inspection Required', 'boolean', 1, true, false),
  ('job', 'inspection_date', 'Inspection Date', 'date', 2, true, false),
  ('job', 'inspection_passed', 'Inspection Passed', 'boolean', 3, true, false),
  ('job', 'warranty_start_date', 'Warranty Start Date', 'date', 4, true, true)
ON CONFLICT (entity_type, field_name) DO NOTHING;

-- Invoice custom fields
INSERT INTO custom_field_definitions (entity_type, field_name, field_label, field_type, sort_order, is_active, is_client_facing)
VALUES
  ('invoice', 'lien_waiver_sent', 'Lien Waiver Sent', 'boolean', 1, true, false),
  ('invoice', 'lien_waiver_signed', 'Lien Waiver Signed', 'boolean', 2, true, false)
ON CONFLICT (entity_type, field_name) DO NOTHING;

-- ============================================
-- FUNCTION: Transfer Custom Fields
-- Called when converting Quote→Job or Job→Invoice
-- ============================================
CREATE OR REPLACE FUNCTION transfer_custom_fields(
  p_source_entity_type VARCHAR(50),
  p_source_entity_id UUID,
  p_target_entity_type VARCHAR(50),
  p_target_entity_id UUID
) RETURNS INTEGER AS $$
DECLARE
  transferred_count INTEGER := 0;
  field_record RECORD;
BEGIN
  -- Find all transferable fields from source that should transfer to target
  FOR field_record IN
    SELECT
      cfd.id as definition_id,
      cfv.value
    FROM custom_field_definitions cfd
    JOIN custom_field_values cfv ON cfv.definition_id = cfd.id
    WHERE cfd.entity_type = p_source_entity_type
      AND cfd.is_transferable = true
      AND p_target_entity_type = ANY(cfd.transfers_to)
      AND cfv.entity_id = p_source_entity_id
      AND cfd.is_active = true
  LOOP
    -- Insert or update the value on the target entity
    INSERT INTO custom_field_values (
      definition_id,
      entity_type,
      entity_id,
      value,
      source_entity_type,
      source_entity_id,
      updated_at
    ) VALUES (
      field_record.definition_id,
      p_target_entity_type,
      p_target_entity_id,
      field_record.value,
      p_source_entity_type,
      p_source_entity_id,
      NOW()
    )
    ON CONFLICT (definition_id, entity_id) DO UPDATE
    SET value = EXCLUDED.value,
        source_entity_type = EXCLUDED.source_entity_type,
        source_entity_id = EXCLUDED.source_entity_id,
        updated_at = NOW();

    transferred_count := transferred_count + 1;
  END LOOP;

  RETURN transferred_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION transfer_custom_fields IS 'Transfers custom field values from source entity to target entity based on transferability rules';
