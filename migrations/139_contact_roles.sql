-- Migration: Contact Roles System
-- Part of O-028: Client Hub Enhancement Phase A
-- Creates standardized contact roles for clients, communities, and properties

-- ============================================
-- CONTACT ROLES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS contact_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(50) UNIQUE NOT NULL,
  label VARCHAR(100) NOT NULL,
  entity_types TEXT[] DEFAULT '{client,community}',  -- Which entities can use this role
  sort_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed initial roles
INSERT INTO contact_roles (code, label, entity_types, sort_order) VALUES
  ('executive', 'Executive', '{client}', 1),
  ('procurement', 'Procurement', '{client}', 2),
  ('accounts_payable', 'Accounts Payable', '{client}', 3),
  ('project_manager', 'Project Manager', '{client,community}', 4),
  ('superintendent', 'Superintendent', '{community}', 5),
  ('assistant_superintendent', 'Assistant Superintendent', '{community}', 6),
  ('foreman', 'Foreman', '{community}', 7),
  ('site_contact', 'Site Contact', '{community,property}', 8),
  ('other', 'Other', '{client,community,property}', 99)
ON CONFLICT (code) DO NOTHING;

-- ============================================
-- ADD role_id TO EXISTING CONTACT TABLES
-- ============================================

-- Add role_id to client_contacts
ALTER TABLE client_contacts
ADD COLUMN IF NOT EXISTS role_id UUID REFERENCES contact_roles(id);

-- Add role_id to community_contacts
ALTER TABLE community_contacts
ADD COLUMN IF NOT EXISTS role_id UUID REFERENCES contact_roles(id);

-- ============================================
-- MIGRATE EXISTING ROLE TEXT TO role_id
-- ============================================

-- Map existing text roles to role_ids for client_contacts
UPDATE client_contacts cc
SET role_id = cr.id
FROM contact_roles cr
WHERE cc.role IS NOT NULL
  AND cc.role_id IS NULL
  AND LOWER(cc.role) LIKE '%' || LOWER(cr.code) || '%';

-- Map existing text roles to role_ids for community_contacts
UPDATE community_contacts cc
SET role_id = cr.id
FROM contact_roles cr
WHERE cc.role IS NOT NULL
  AND cc.role_id IS NULL
  AND LOWER(cc.role) LIKE '%' || LOWER(cr.code) || '%';

-- Set remaining unmapped contacts to 'other'
UPDATE client_contacts
SET role_id = (SELECT id FROM contact_roles WHERE code = 'other')
WHERE role IS NOT NULL AND role_id IS NULL;

UPDATE community_contacts
SET role_id = (SELECT id FROM contact_roles WHERE code = 'other')
WHERE role IS NOT NULL AND role_id IS NULL;

-- ============================================
-- RLS POLICIES
-- ============================================

ALTER TABLE contact_roles ENABLE ROW LEVEL SECURITY;

-- Everyone can read contact roles
CREATE POLICY "contact_roles_read_all" ON contact_roles
  FOR SELECT USING (true);

-- Only admins can modify contact roles
CREATE POLICY "contact_roles_admin_write" ON contact_roles
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_contact_roles_entity_types ON contact_roles USING GIN(entity_types);
CREATE INDEX IF NOT EXISTS idx_client_contacts_role_id ON client_contacts(role_id);
CREATE INDEX IF NOT EXISTS idx_community_contacts_role_id ON community_contacts(role_id);
