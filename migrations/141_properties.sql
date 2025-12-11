-- Migration 141: Properties/Lots Table
-- Part of O-028: Client Hub Enhancement - Properties Level
-- Purpose: Track individual lot addresses within communities
-- Hierarchy: Client -> Community -> Property/Lot -> Project

-- Create properties table
CREATE TABLE IF NOT EXISTS properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,

  -- Identification
  lot_number VARCHAR(50),
  block_number VARCHAR(50),
  address_line1 VARCHAR(255) NOT NULL,
  city VARCHAR(100),
  state VARCHAR(2) DEFAULT 'TX',
  zip VARCHAR(20),

  -- Geolocation (for future map integration)
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),

  -- Site info
  gate_code VARCHAR(50),
  access_notes TEXT,
  homeowner_name VARCHAR(255),
  homeowner_phone VARCHAR(50),
  homeowner_email VARCHAR(255),

  -- Status
  status VARCHAR(20) DEFAULT 'available' CHECK (status IN ('available', 'sold', 'in_progress', 'completed', 'cancelled')),

  -- Metadata
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_properties_community ON properties(community_id);
CREATE INDEX IF NOT EXISTS idx_properties_status ON properties(status);
CREATE INDEX IF NOT EXISTS idx_properties_lot ON properties(lot_number);
CREATE INDEX IF NOT EXISTS idx_properties_address ON properties(address_line1);

-- Create property_contacts table
CREATE TABLE IF NOT EXISTS property_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  role_id UUID REFERENCES contact_roles(id),
  role VARCHAR(100),  -- Legacy text field for backward compatibility
  email VARCHAR(255),
  phone VARCHAR(50),
  is_primary BOOLEAN DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_property_contacts_property ON property_contacts(property_id);

-- Enable RLS
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE property_contacts ENABLE ROW LEVEL SECURITY;

-- RLS policies for properties
DROP POLICY IF EXISTS "Anyone can view properties" ON properties;
CREATE POLICY "Anyone can view properties" ON properties
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Authenticated users can manage properties" ON properties;
CREATE POLICY "Authenticated users can manage properties" ON properties
  FOR ALL USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- RLS policies for property_contacts
DROP POLICY IF EXISTS "Anyone can view property_contacts" ON property_contacts;
CREATE POLICY "Anyone can view property_contacts" ON property_contacts
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Authenticated users can manage property_contacts" ON property_contacts;
CREATE POLICY "Authenticated users can manage property_contacts" ON property_contacts
  FOR ALL USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- Add property entity type to contact_roles
UPDATE contact_roles
SET entity_types = array_append(entity_types, 'property')
WHERE code = 'site_contact' AND NOT ('property' = ANY(entity_types));

-- Add "homeowner" role for property contacts if not exists
INSERT INTO contact_roles (code, label, entity_types, sort_order, is_active)
VALUES ('homeowner', 'Homeowner', '{property}', 9, true)
ON CONFLICT (code) DO NOTHING;

-- Comments for documentation
COMMENT ON TABLE properties IS 'Individual lots/addresses within communities. Level 3 in hierarchy: Client -> Community -> Property -> Project';
COMMENT ON COLUMN properties.lot_number IS 'Builder lot number (e.g., "Lot 42", "42")';
COMMENT ON COLUMN properties.block_number IS 'Block number if applicable (e.g., "Block A", "1")';
COMMENT ON COLUMN properties.status IS 'available: Ready for work, sold: Home sold, in_progress: Active project, completed: Work done, cancelled: Project cancelled';
COMMENT ON COLUMN properties.gate_code IS 'Gate or access code for the property';
COMMENT ON COLUMN properties.access_notes IS 'Special instructions for accessing the property';
