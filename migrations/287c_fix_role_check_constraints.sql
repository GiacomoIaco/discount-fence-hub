-- Migration 287c: Update CHECK constraints on role columns to include all AppRoles
-- Both user_profiles.role and user_invitations.role had CHECK constraints that
-- only allowed the 4 legacy values ('sales','operations','sales-manager','admin').
-- Since invitation flows now use AppRole values (yard, crew, front_desk, etc.),
-- these constraints must be updated.

-- Fix user_invitations.role CHECK constraint
ALTER TABLE user_invitations DROP CONSTRAINT IF EXISTS user_invitations_role_check;
ALTER TABLE user_invitations ADD CONSTRAINT user_invitations_role_check
  CHECK (role = ANY (ARRAY[
    -- Legacy values
    'sales', 'operations', 'sales-manager', 'admin',
    -- AppRole values
    'owner', 'sales_rep', 'sales_manager', 'ops_manager',
    'front_desk', 'yard', 'crew'
  ]));

-- Fix user_profiles.role CHECK constraint (keep legacy values valid for existing data)
ALTER TABLE user_profiles DROP CONSTRAINT IF EXISTS user_profiles_role_check;
ALTER TABLE user_profiles ADD CONSTRAINT user_profiles_role_check
  CHECK (role = ANY (ARRAY[
    -- Legacy values (currently in use)
    'sales', 'operations', 'sales-manager', 'admin',
    -- AppRole values (for forward compatibility)
    'owner', 'sales_rep', 'sales_manager', 'ops_manager',
    'front_desk', 'yard', 'crew'
  ]));
