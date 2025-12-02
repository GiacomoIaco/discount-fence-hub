-- ============================================
-- BOM TABLES RLS POLICIES
-- Created: 2025-12-01
-- Purpose: Enable RLS and add policies for BOM calculator tables
-- ============================================

-- Enable RLS on all BOM tables
ALTER TABLE business_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE labor_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE labor_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE wood_vertical_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE wood_horizontal_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE iron_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE bom_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_labor ENABLE ROW LEVEL SECURITY;

-- ============================================
-- BUSINESS UNITS - Read-only for authenticated users
-- ============================================
DROP POLICY IF EXISTS "business_units_select" ON business_units;
CREATE POLICY "business_units_select" ON business_units
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "business_units_admin_all" ON business_units;
CREATE POLICY "business_units_admin_all" ON business_units
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- ============================================
-- MATERIALS - Read for all, write for admins
-- ============================================
DROP POLICY IF EXISTS "materials_select" ON materials;
CREATE POLICY "materials_select" ON materials
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "materials_admin_insert" ON materials;
CREATE POLICY "materials_admin_insert" ON materials
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin'
    )
  );

DROP POLICY IF EXISTS "materials_admin_update" ON materials;
CREATE POLICY "materials_admin_update" ON materials
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin'
    )
  );

DROP POLICY IF EXISTS "materials_admin_delete" ON materials;
CREATE POLICY "materials_admin_delete" ON materials
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- ============================================
-- LABOR CODES - Read for all, write for admins
-- ============================================
DROP POLICY IF EXISTS "labor_codes_select" ON labor_codes;
CREATE POLICY "labor_codes_select" ON labor_codes
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "labor_codes_admin_insert" ON labor_codes;
CREATE POLICY "labor_codes_admin_insert" ON labor_codes
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin'
    )
  );

DROP POLICY IF EXISTS "labor_codes_admin_update" ON labor_codes;
CREATE POLICY "labor_codes_admin_update" ON labor_codes
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin'
    )
  );

DROP POLICY IF EXISTS "labor_codes_admin_delete" ON labor_codes;
CREATE POLICY "labor_codes_admin_delete" ON labor_codes
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- ============================================
-- LABOR RATES - Read for all, write for admins
-- ============================================
DROP POLICY IF EXISTS "labor_rates_select" ON labor_rates;
CREATE POLICY "labor_rates_select" ON labor_rates
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "labor_rates_admin_insert" ON labor_rates;
CREATE POLICY "labor_rates_admin_insert" ON labor_rates
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin'
    )
  );

DROP POLICY IF EXISTS "labor_rates_admin_update" ON labor_rates;
CREATE POLICY "labor_rates_admin_update" ON labor_rates
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin'
    )
  );

DROP POLICY IF EXISTS "labor_rates_admin_delete" ON labor_rates;
CREATE POLICY "labor_rates_admin_delete" ON labor_rates
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- ============================================
-- WOOD VERTICAL PRODUCTS - Read for all, write for admins
-- ============================================
DROP POLICY IF EXISTS "wood_vertical_products_select" ON wood_vertical_products;
CREATE POLICY "wood_vertical_products_select" ON wood_vertical_products
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "wood_vertical_products_admin_all" ON wood_vertical_products;
CREATE POLICY "wood_vertical_products_admin_all" ON wood_vertical_products
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- ============================================
-- WOOD HORIZONTAL PRODUCTS - Read for all, write for admins
-- ============================================
DROP POLICY IF EXISTS "wood_horizontal_products_select" ON wood_horizontal_products;
CREATE POLICY "wood_horizontal_products_select" ON wood_horizontal_products
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "wood_horizontal_products_admin_all" ON wood_horizontal_products;
CREATE POLICY "wood_horizontal_products_admin_all" ON wood_horizontal_products
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- ============================================
-- IRON PRODUCTS - Read for all, write for admins
-- ============================================
DROP POLICY IF EXISTS "iron_products_select" ON iron_products;
CREATE POLICY "iron_products_select" ON iron_products
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "iron_products_admin_all" ON iron_products;
CREATE POLICY "iron_products_admin_all" ON iron_products
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- ============================================
-- BOM PROJECTS - Users can manage their own projects
-- ============================================
DROP POLICY IF EXISTS "bom_projects_select" ON bom_projects;
CREATE POLICY "bom_projects_select" ON bom_projects
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "bom_projects_insert" ON bom_projects;
CREATE POLICY "bom_projects_insert" ON bom_projects
  FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid() OR created_by IS NULL);

DROP POLICY IF EXISTS "bom_projects_update" ON bom_projects;
CREATE POLICY "bom_projects_update" ON bom_projects
  FOR UPDATE TO authenticated
  USING (
    created_by = auth.uid() OR
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin')
  );

DROP POLICY IF EXISTS "bom_projects_delete" ON bom_projects;
CREATE POLICY "bom_projects_delete" ON bom_projects
  FOR DELETE TO authenticated
  USING (
    created_by = auth.uid() OR
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ============================================
-- PROJECT LINE ITEMS - Access based on project ownership
-- ============================================
DROP POLICY IF EXISTS "project_line_items_select" ON project_line_items;
CREATE POLICY "project_line_items_select" ON project_line_items
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "project_line_items_insert" ON project_line_items;
CREATE POLICY "project_line_items_insert" ON project_line_items
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM bom_projects
      WHERE id = project_id
      AND (created_by = auth.uid() OR created_by IS NULL)
    )
  );

DROP POLICY IF EXISTS "project_line_items_update" ON project_line_items;
CREATE POLICY "project_line_items_update" ON project_line_items
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM bom_projects
      WHERE id = project_id
      AND (created_by = auth.uid() OR EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin'))
    )
  );

DROP POLICY IF EXISTS "project_line_items_delete" ON project_line_items;
CREATE POLICY "project_line_items_delete" ON project_line_items
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM bom_projects
      WHERE id = project_id
      AND (created_by = auth.uid() OR EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin'))
    )
  );

-- ============================================
-- PROJECT MATERIALS - Access based on project ownership
-- ============================================
DROP POLICY IF EXISTS "project_materials_select" ON project_materials;
CREATE POLICY "project_materials_select" ON project_materials
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "project_materials_insert" ON project_materials;
CREATE POLICY "project_materials_insert" ON project_materials
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM bom_projects
      WHERE id = project_id
      AND (created_by = auth.uid() OR created_by IS NULL)
    )
  );

DROP POLICY IF EXISTS "project_materials_update" ON project_materials;
CREATE POLICY "project_materials_update" ON project_materials
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM bom_projects
      WHERE id = project_id
      AND (created_by = auth.uid() OR EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin'))
    )
  );

DROP POLICY IF EXISTS "project_materials_delete" ON project_materials;
CREATE POLICY "project_materials_delete" ON project_materials
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM bom_projects
      WHERE id = project_id
      AND (created_by = auth.uid() OR EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin'))
    )
  );

-- ============================================
-- PROJECT LABOR - Access based on project ownership
-- ============================================
DROP POLICY IF EXISTS "project_labor_select" ON project_labor;
CREATE POLICY "project_labor_select" ON project_labor
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "project_labor_insert" ON project_labor;
CREATE POLICY "project_labor_insert" ON project_labor
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM bom_projects
      WHERE id = project_id
      AND (created_by = auth.uid() OR created_by IS NULL)
    )
  );

DROP POLICY IF EXISTS "project_labor_update" ON project_labor;
CREATE POLICY "project_labor_update" ON project_labor
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM bom_projects
      WHERE id = project_id
      AND (created_by = auth.uid() OR EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin'))
    )
  );

DROP POLICY IF EXISTS "project_labor_delete" ON project_labor;
CREATE POLICY "project_labor_delete" ON project_labor
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM bom_projects
      WHERE id = project_id
      AND (created_by = auth.uid() OR EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin'))
    )
  );
