-- ============================================
-- BOM CALCULATOR SYSTEM
-- Created: 2025-10-13
-- Purpose: Bill of Materials (BOM) and Bill of Labor (BOL) calculator for fence projects
-- Supports: SKU Builder (catalog pricing) + Project Calculator (multi-SKU estimates)
-- ============================================

-- ============================================
-- SCHEMA: REFERENCE TABLES
-- ============================================

-- Business Units: Location + Client Type determines labor rates
CREATE TABLE business_units (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code TEXT UNIQUE NOT NULL, -- 'ATX-RES', 'SA-HB', 'HOU-RES', etc.
  name TEXT NOT NULL,
  location TEXT NOT NULL, -- 'ATX', 'SA', 'HOU'
  business_type TEXT NOT NULL, -- 'Residential', 'Home Builders'
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Materials Master: All fence materials
CREATE TABLE materials (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  material_sku TEXT UNIQUE NOT NULL,
  material_name TEXT NOT NULL,
  category TEXT NOT NULL, -- '01-Post', '02-Pickets', '03-Rails', etc.
  sub_category TEXT,
  unit_type TEXT NOT NULL,
  unit_cost DECIMAL(10,2) NOT NULL,

  -- Physical dimensions (for calculations)
  length_ft DECIMAL(10,2),
  width_nominal INTEGER,
  actual_width DECIMAL(10,2), -- actual width for calculations (e.g., 5.5" for 1x6)
  thickness TEXT,
  quantity_per_unit DECIMAL(10,2) DEFAULT 1.0,

  -- Categorization
  fence_category_standard TEXT[],
  is_bom_default BOOLEAN DEFAULT false,

  -- Inventory
  status TEXT DEFAULT 'Active',
  normally_stocked BOOLEAN DEFAULT false,
  current_stock_qty INTEGER,

  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Labor Codes: Activity definitions (independent of rate)
CREATE TABLE labor_codes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  labor_sku TEXT UNIQUE NOT NULL,
  description TEXT NOT NULL,
  fence_category_standard TEXT[],
  unit_type TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Labor Rates: Business Unit specific rates (junction table)
CREATE TABLE labor_rates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  labor_code_id UUID NOT NULL REFERENCES labor_codes(id) ON DELETE CASCADE,
  business_unit_id UUID NOT NULL REFERENCES business_units(id) ON DELETE CASCADE,
  rate DECIMAL(10,2) NOT NULL,
  qbo_labor_code TEXT,
  effective_date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(labor_code_id, business_unit_id, effective_date)
);

-- ============================================
-- SCHEMA: SKU TABLES (Product Definitions)
-- ============================================

-- Wood Vertical Products
CREATE TABLE wood_vertical_products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sku_code TEXT UNIQUE NOT NULL,
  sku_name TEXT NOT NULL,

  -- Physical specifications
  height INTEGER NOT NULL,
  rail_count INTEGER NOT NULL,
  post_type TEXT NOT NULL CHECK (post_type IN ('WOOD', 'STEEL')), -- CRITICAL for labor codes!
  style TEXT NOT NULL,
  post_spacing DECIMAL(10,2) DEFAULT 8.0,

  -- Direct material references
  post_material_id UUID NOT NULL REFERENCES materials(id),
  picket_material_id UUID NOT NULL REFERENCES materials(id),
  rail_material_id UUID NOT NULL REFERENCES materials(id),
  cap_material_id UUID REFERENCES materials(id),
  trim_material_id UUID REFERENCES materials(id),
  rot_board_material_id UUID REFERENCES materials(id),

  -- Standard cost (cached from SKU Builder Calculator)
  standard_material_cost DECIMAL(10,2),
  standard_labor_cost DECIMAL(10,2),
  standard_cost_per_foot DECIMAL(10,2),
  standard_cost_calculated_at TIMESTAMPTZ,

  product_description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Wood Horizontal Products
CREATE TABLE wood_horizontal_products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sku_code TEXT UNIQUE NOT NULL,
  sku_name TEXT NOT NULL,

  height INTEGER NOT NULL,
  post_type TEXT NOT NULL CHECK (post_type IN ('WOOD', 'STEEL')),
  style TEXT NOT NULL,
  post_spacing DECIMAL(10,2) DEFAULT 6.0,
  board_width_actual DECIMAL(10,2) NOT NULL,

  post_material_id UUID NOT NULL REFERENCES materials(id),
  board_material_id UUID NOT NULL REFERENCES materials(id),
  nailer_material_id UUID REFERENCES materials(id),
  cap_material_id UUID REFERENCES materials(id),

  standard_material_cost DECIMAL(10,2),
  standard_labor_cost DECIMAL(10,2),
  standard_cost_per_foot DECIMAL(10,2),
  standard_cost_calculated_at TIMESTAMPTZ,

  product_description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Iron Products
CREATE TABLE iron_products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sku_code TEXT UNIQUE NOT NULL,
  sku_name TEXT NOT NULL,

  height INTEGER NOT NULL,
  post_type TEXT NOT NULL DEFAULT 'STEEL' CHECK (post_type = 'STEEL'),
  style TEXT NOT NULL,
  panel_width DECIMAL(10,2) DEFAULT 8.0,
  rails_per_panel INTEGER,

  post_material_id UUID NOT NULL REFERENCES materials(id),
  panel_material_id UUID REFERENCES materials(id),
  bracket_material_id UUID REFERENCES materials(id),
  rail_material_id UUID REFERENCES materials(id),
  picket_material_id UUID REFERENCES materials(id),

  standard_material_cost DECIMAL(10,2),
  standard_labor_cost DECIMAL(10,2),
  standard_cost_per_foot DECIMAL(10,2),
  standard_cost_calculated_at TIMESTAMPTZ,

  product_description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- SCHEMA: PROJECT TABLES
-- ============================================

-- Projects (main project record)
CREATE TABLE bom_projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_name TEXT NOT NULL,
  customer_name TEXT,
  business_unit_id UUID NOT NULL REFERENCES business_units(id),

  concrete_type TEXT NOT NULL DEFAULT '3-part',

  -- Calculated totals (cached)
  total_linear_feet DECIMAL(10,2),
  total_material_cost DECIMAL(10,2),
  total_labor_cost DECIMAL(10,2),
  manual_adjustments DECIMAL(10,2) DEFAULT 0,
  total_project_cost DECIMAL(10,2),
  cost_per_foot DECIMAL(10,2),

  status TEXT DEFAULT 'draft',
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Project Line Items (each SKU in the project)
CREATE TABLE project_line_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES bom_projects(id) ON DELETE CASCADE,

  fence_type TEXT NOT NULL,
  product_id UUID NOT NULL,
  product_sku_code TEXT NOT NULL,
  product_name TEXT NOT NULL,

  total_footage DECIMAL(10,2) NOT NULL,
  buffer DECIMAL(10,2) DEFAULT 5.0,
  net_length DECIMAL(10,2) NOT NULL,
  number_of_lines INTEGER DEFAULT 1 CHECK (number_of_lines BETWEEN 1 AND 5),
  number_of_gates INTEGER DEFAULT 0 CHECK (number_of_gates BETWEEN 0 AND 3),

  -- Calculated quantities (BEFORE rounding - stored as decimals!)
  calculated_posts DECIMAL(10,2),
  calculated_pickets DECIMAL(10,2),
  calculated_rails DECIMAL(10,2),
  calculated_panels DECIMAL(10,2),
  calculated_boards DECIMAL(10,2),
  calculated_nailers DECIMAL(10,2),

  -- Manual overrides (project-level only)
  adjusted_posts INTEGER,
  adjusted_pickets INTEGER,
  adjusted_rails INTEGER,
  adjusted_panels INTEGER,

  sort_order INTEGER DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Project Materials (Aggregated BOM)
CREATE TABLE project_materials (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES bom_projects(id) ON DELETE CASCADE,
  material_id UUID NOT NULL REFERENCES materials(id),

  calculated_quantity DECIMAL(10,2) NOT NULL,
  rounded_quantity INTEGER,
  manual_quantity INTEGER,
  final_quantity INTEGER GENERATED ALWAYS AS (
    COALESCE(manual_quantity, rounded_quantity)
  ) STORED,

  unit_cost DECIMAL(10,2) NOT NULL,
  extended_cost DECIMAL(10,2) GENERATED ALWAYS AS (
    COALESCE(manual_quantity, rounded_quantity) * unit_cost
  ) STORED,

  aggregation_level TEXT NOT NULL DEFAULT 'project',
  calculation_note TEXT,
  is_manual_addition BOOLEAN DEFAULT false,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_id, material_id)
);

-- Project Labor (Aggregated BOL)
CREATE TABLE project_labor (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES bom_projects(id) ON DELETE CASCADE,
  labor_code_id UUID NOT NULL REFERENCES labor_codes(id),

  calculated_quantity DECIMAL(10,2) NOT NULL,
  manual_quantity DECIMAL(10,2),
  final_quantity DECIMAL(10,2) GENERATED ALWAYS AS (
    COALESCE(manual_quantity, calculated_quantity)
  ) STORED,

  labor_rate DECIMAL(10,2) NOT NULL,
  extended_cost DECIMAL(10,2) GENERATED ALWAYS AS (
    COALESCE(manual_quantity, calculated_quantity) * labor_rate
  ) STORED,

  is_manual_addition BOOLEAN DEFAULT false,
  calculation_note TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_id, labor_code_id)
);

-- ============================================
-- TRIGGERS FOR UPDATED_AT
-- ============================================

CREATE OR REPLACE FUNCTION update_bom_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_business_units_updated_at BEFORE UPDATE ON business_units
  FOR EACH ROW EXECUTE FUNCTION update_bom_updated_at();

CREATE TRIGGER update_materials_updated_at BEFORE UPDATE ON materials
  FOR EACH ROW EXECUTE FUNCTION update_bom_updated_at();

CREATE TRIGGER update_labor_codes_updated_at BEFORE UPDATE ON labor_codes
  FOR EACH ROW EXECUTE FUNCTION update_bom_updated_at();

CREATE TRIGGER update_labor_rates_updated_at BEFORE UPDATE ON labor_rates
  FOR EACH ROW EXECUTE FUNCTION update_bom_updated_at();

CREATE TRIGGER update_wood_vertical_updated_at BEFORE UPDATE ON wood_vertical_products
  FOR EACH ROW EXECUTE FUNCTION update_bom_updated_at();

CREATE TRIGGER update_wood_horizontal_updated_at BEFORE UPDATE ON wood_horizontal_products
  FOR EACH ROW EXECUTE FUNCTION update_bom_updated_at();

CREATE TRIGGER update_iron_products_updated_at BEFORE UPDATE ON iron_products
  FOR EACH ROW EXECUTE FUNCTION update_bom_updated_at();

CREATE TRIGGER update_bom_projects_updated_at BEFORE UPDATE ON bom_projects
  FOR EACH ROW EXECUTE FUNCTION update_bom_updated_at();

CREATE TRIGGER update_project_line_items_updated_at BEFORE UPDATE ON project_line_items
  FOR EACH ROW EXECUTE FUNCTION update_bom_updated_at();

CREATE TRIGGER update_project_materials_updated_at BEFORE UPDATE ON project_materials
  FOR EACH ROW EXECUTE FUNCTION update_bom_updated_at();

CREATE TRIGGER update_project_labor_updated_at BEFORE UPDATE ON project_labor
  FOR EACH ROW EXECUTE FUNCTION update_bom_updated_at();

-- ============================================
-- SEED DATA: BUSINESS UNITS
-- ============================================

INSERT INTO business_units (code, name, location, business_type, is_active) VALUES
  ('ATX-RES', 'Austin Residential', 'ATX', 'Residential', true),
  ('SA-RES', 'San Antonio Residential', 'SA', 'Residential', true),
  ('HOU-HB', 'Houston Home Builders', 'HOU', 'Home Builders', true),
  ('ATX-HB', 'Austin Home Builders', 'ATX', 'Home Builders', true),
  ('SA-HB', 'San Antonio Home Builders', 'SA', 'Home Builders', true),
  ('HOU-RES', 'Houston Residential', 'HOU', 'Residential', true)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  location = EXCLUDED.location,
  business_type = EXCLUDED.business_type,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();

-- ============================================
-- SEED DATA: LABOR CODES
-- ============================================

INSERT INTO labor_codes (labor_sku, description, fence_category_standard, unit_type, is_active) VALUES
  -- Iron Labor Codes
  ('IR01', 'Iron Set Post 8'' O.C.', ARRAY['Iron'], 'Per LF', true),
  ('IR02', 'Iron Weld Standard Fence', ARRAY['Iron'], 'Per LF', true),
  ('IR04', 'Set and Weld Railing - 8'' or 10'' OC', ARRAY['Iron'], 'Per LF', true),
  ('IR05', 'Set Post 8'' O.C. Ameristar/3 rail brackets', ARRAY['Iron'], 'Per LF', true),
  ('IR06', 'Weld/Bracket Fence - Ameristar/3 rail - up to 6 FT', ARRAY['Iron'], 'Per LF', true),
  ('IR07', 'Iron Gate - Single', ARRAY['Iron'], 'Per Gate', true),

  -- Service Codes
  ('LB04', 'Rock Fee', ARRAY['Vertical W', 'Horizontal W', 'Iron'], 'Per LF', true),
  ('W01', 'Tear Out and Haul Off', ARRAY['Vertical W', 'Horizontal W'], 'Per LF', true),

  -- Wood Posts - Steel Post Installation
  ('M03', 'Steel Post - Nail Up - Vertical up to 6'' High', ARRAY['Vertical W'], 'Per LF', true),
  ('M04', 'Steel Post - Nail Up - Vertical 7'' or 8'' High', ARRAY['Vertical W'], 'Per LF', true),
  ('M06', 'Steel Post - Goodneighbor Style', ARRAY['Vertical W', 'Horizontal W'], 'Per LF', true),
  ('M07', 'Steel Post - Cap and Trim', ARRAY['Vertical W'], 'Per LF', true),

  -- Wood Posts - Wood Post Installation
  ('W02', 'Set Post 8'' OC', ARRAY['Vertical W', 'Horizontal W', 'Iron'], 'Per LF', true),
  ('W03', 'Nail Up - Vertical up to 6'' High', ARRAY['Vertical W'], 'Per LF', true),
  ('W04', 'Nail Up - Vertical 7'' or 8'' High', ARRAY['Vertical W'], 'Per LF', true),
  ('W05', 'Additional Rail', ARRAY['Vertical W'], 'Per LF', true),
  ('W06', 'Goodneighbor Style', ARRAY['Vertical W'], 'Per LF', true),
  ('W07', 'Cap and Trim', ARRAY['Vertical W'], 'Per LF', true),
  ('W08', 'Just Trim/Additional Trim', ARRAY['Vertical W'], 'Per LF', true),
  ('W09', 'Just CAP', ARRAY['Vertical W', 'Horizontal W'], 'Per LF', true),

  -- Gates - Wood Vertical
  ('W10', 'Wood Gate - Vert - Single (up to 6FT)', ARRAY['Vertical W'], 'Per Gate', true),
  ('W11', 'Wood Gate - Vertical - Single (8FT)', ARRAY['Vertical W'], 'Per Gate', true),

  -- Wood Horizontal Installation
  ('W12', 'Horizontal Set Post 6'' OC', ARRAY['Horizontal W'], 'Per LF', true),
  ('W13', 'Horizontal Nail Up 6'' High', ARRAY['Horizontal W'], 'Per LF', true),
  ('W15', 'Horizontal Wood Gate Single', ARRAY['Horizontal W'], 'Per Gate', true),
  ('W16', 'Set Post for Exposed Horizontal Fence', ARRAY['Horizontal W'], 'Per LF', true),
  ('W17', 'Nail up Exposed Horizontal fence', ARRAY['Horizontal W'], 'Per LF', true),
  ('W18', 'Horizontal Nail Up 7'' or 8'' High Horizontal', ARRAY['Horizontal W'], 'Per LF', true),

  -- Custom Labor
  ('CLB', 'Custom Labor fee', ARRAY[]::TEXT[], 'Per LF', true)
ON CONFLICT (labor_sku) DO UPDATE SET
  description = EXCLUDED.description,
  fence_category_standard = EXCLUDED.fence_category_standard,
  unit_type = EXCLUDED.unit_type,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();

-- ============================================
-- SEED DATA: MATERIALS (Sample - Add more as needed)
-- ============================================

INSERT INTO materials (material_sku, material_name, category, sub_category, unit_type, unit_cost, length_ft, width_nominal, actual_width, thickness, fence_category_standard, is_bom_default, status, normally_stocked) VALUES
  -- Posts
  ('PS13', '4x4 PTP 8ft', '01-Post', 'Wood', 'Each', 12.50, 8.0, 4, 3.5, NULL, ARRAY['Vertical W', 'Horizontal W'], true, 'Active', true),
  ('PS14', '4x4 PTP 10ft', '01-Post', 'Wood', 'Each', 15.75, 10.0, 4, 3.5, NULL, ARRAY['Vertical W', 'Horizontal W'], false, 'Active', true),
  ('PS04', '2" Square Tubing 8ft (16ga)', '01-Post', 'Steel', 'Each', 18.75, 8.0, 2, 2.0, '16ga', ARRAY['Vertical W', 'Horizontal W'], true, 'Active', true),
  ('IPS01', '2" x 2" Iron Post 8ft', '01-Post', 'Iron', 'Each', 32.00, 8.0, 2, 2.0, '14ga', ARRAY['Iron'], true, 'Active', true),

  -- Pickets
  ('P601', '1x6 x 6ft Sierra Placer (SPF)', '02-Pickets', '1x6', 'Each', 3.25, 6.0, 6, 5.5, '5/8"', ARRAY['Vertical W'], true, 'Active', true),
  ('P602', '1x6 x 6ft Dog-Ear SPF', '02-Pickets', '1x6', 'Each', 3.50, 6.0, 6, 5.5, '5/8"', ARRAY['Vertical W'], true, 'Active', true),

  -- Rails
  ('RA01', '2x4 x 8ft SPF', '03-Rails', '2x4', 'Each', 5.50, 8.0, 4, 3.5, NULL, ARRAY['Vertical W', 'Horizontal W'], true, 'Active', true),

  -- Cap/Trim
  ('CAP01', '1x6 x 8ft Cap Board SPF', '04-Cap/Trim', 'Cap', 'Each', 4.25, 8.0, 6, 5.5, '5/8"', ARRAY['Vertical W', 'Horizontal W'], false, 'Active', true),
  ('CTN03', '1x4 x 8ft Trim SPF', '04-Cap/Trim', 'Trim', 'Each', 4.50, 8.0, 4, 3.5, '5/8"', ARRAY['Vertical W'], false, 'Active', true),

  -- Concrete
  ('CTS', 'Concrete Sand & Gravel Mix 50lb', '06-Concrete', '3-Part', 'Bags', 4.25, NULL, NULL, NULL, NULL, ARRAY['Vertical W', 'Horizontal W', 'Iron'], true, 'Active', true),
  ('CTP', 'Portland Cement 94lb', '06-Concrete', '3-Part', 'Bags', 12.75, NULL, NULL, NULL, NULL, ARRAY['Vertical W', 'Horizontal W', 'Iron'], true, 'Active', true),
  ('CTQ', 'QuickRock 50lb', '06-Concrete', '3-Part', 'Bags', 5.50, NULL, NULL, NULL, NULL, ARRAY['Vertical W', 'Horizontal W', 'Iron'], true, 'Active', true),

  -- Horizontal Boards
  ('HB601', '1x6 x 8ft Horizontal Board SPF', '07-Horizontal Boards', '1x6', 'Each', 3.75, 8.0, 6, 5.5, '5/8"', ARRAY['Horizontal W'], true, 'Active', true),
  ('NL01', '2x4 x 8ft Nailer SPF', '07-Horizontal Boards', 'Nailer', 'Each', 5.50, 8.0, 4, 3.5, NULL, ARRAY['Horizontal W'], true, 'Active', true),

  -- Hardware
  ('HW07', '16d Galvanized Framing Nails (box of 28)', '08-Hardware', 'Nails', 'Box', 8.50, NULL, NULL, NULL, '16d', ARRAY['Vertical W', 'Horizontal W'], true, 'Active', true),
  ('HW08', '8d Galvanized Picket Nails (box of 300)', '08-Hardware', 'Nails', 'Box', 12.75, NULL, NULL, NULL, '8d', ARRAY['Vertical W'], true, 'Active', true),
  ('HW20', 'Gate Hinge Set (2 hinges)', '08-Hardware', 'Gate', 'Set', 18.75, NULL, NULL, NULL, NULL, ARRAY['Vertical W', 'Horizontal W'], true, 'Active', true),
  ('HW21', 'Gate Latch', '08-Hardware', 'Gate', 'Each', 12.50, NULL, NULL, NULL, NULL, ARRAY['Vertical W', 'Horizontal W'], true, 'Active', true),

  -- Iron
  ('IP01', 'Standard 2-Rail Iron Panel 8ft x 4ft', '09-Iron', 'Panel', 'Each', 85.00, 8.0, NULL, NULL, NULL, ARRAY['Iron'], true, 'Active', true),
  ('IP02', 'Standard 2-Rail Iron Panel 8ft x 6ft', '09-Iron', 'Panel', 'Each', 125.00, 8.0, NULL, NULL, NULL, ARRAY['Iron'], true, 'Active', true),
  ('IB01', 'Ameristar Rail Bracket', '09-Iron', 'Bracket', 'Each', 2.75, NULL, NULL, NULL, NULL, ARRAY['Iron'], true, 'Active', true),
  ('IPC01', 'Iron Post Cap 2" x 2"', '09-Iron', 'Post Cap', 'Each', 8.50, NULL, NULL, NULL, NULL, ARRAY['Iron'], true, 'Active', true)
ON CONFLICT (material_sku) DO UPDATE SET
  material_name = EXCLUDED.material_name,
  category = EXCLUDED.category,
  unit_cost = EXCLUDED.unit_cost,
  updated_at = NOW();

-- ============================================
-- SEED DATA: LABOR RATES (Sample - Complete matrix in production)
-- ============================================

INSERT INTO labor_rates (labor_code_id, business_unit_id, rate, qbo_labor_code, effective_date)
SELECT
  lc.id, bu.id, rates.rate, rates.qbo_code, '2025-01-01'::DATE
FROM labor_codes lc
CROSS JOIN business_units bu
INNER JOIN (VALUES
  ('W02', 'ATX-RES', 2.50, 'LAB-W02-ATX-RES'),
  ('W02', 'ATX-HB', 2.00, 'LAB-W02-ATX-HB'),
  ('W02', 'SA-RES', 2.25, 'LAB-W02-SA-RES'),
  ('W02', 'SA-HB', 1.85, 'LAB-W02-SA-HB'),
  ('W02', 'HOU-RES', 2.00, 'LAB-W02-HOU-RES'),
  ('W02', 'HOU-HB', 1.65, 'LAB-W02-HOU-HB'),
  ('W03', 'ATX-RES', 3.75, 'LAB-W03-ATX-RES'),
  ('W03', 'ATX-HB', 3.00, 'LAB-W03-ATX-HB'),
  ('W03', 'SA-RES', 3.50, 'LAB-W03-SA-RES'),
  ('W03', 'SA-HB', 2.75, 'LAB-W03-SA-HB'),
  ('W03', 'HOU-RES', 3.25, 'LAB-W03-HOU-RES'),
  ('W03', 'HOU-HB', 2.50, 'LAB-W03-HOU-HB'),
  ('M03', 'ATX-RES', 4.25, 'LAB-M03-ATX-RES'),
  ('M03', 'ATX-HB', 3.50, 'LAB-M03-ATX-HB'),
  ('M03', 'SA-RES', 4.00, 'LAB-M03-SA-RES'),
  ('M03', 'SA-HB', 3.25, 'LAB-M03-SA-HB'),
  ('M03', 'HOU-RES', 3.75, 'LAB-M03-HOU-RES'),
  ('M03', 'HOU-HB', 3.00, 'LAB-M03-HOU-HB')
  -- Add remaining labor rate combinations as needed
) AS rates(labor_sku, bu_code, rate, qbo_code)
  ON lc.labor_sku = rates.labor_sku
  AND bu.code = rates.bu_code
ON CONFLICT (labor_code_id, business_unit_id, effective_date) DO UPDATE SET
  rate = EXCLUDED.rate,
  qbo_labor_code = EXCLUDED.qbo_labor_code,
  updated_at = NOW();

-- ============================================
-- SEED DATA: SAMPLE PRODUCTS
-- ============================================

-- Wood Vertical: A Series
INSERT INTO wood_vertical_products (sku_code, sku_name, height, rail_count, post_type, style, post_spacing, post_material_id, picket_material_id, rail_material_id, is_active) VALUES
  ('A01', '6'' Ver 1x6 : 2R : WOOD Post', 6, 2, 'WOOD', 'Standard', 8.0,
    (SELECT id FROM materials WHERE material_sku = 'PS13'),
    (SELECT id FROM materials WHERE material_sku = 'P601'),
    (SELECT id FROM materials WHERE material_sku = 'RA01'), true),
  ('C01', '6'' Ver 1x6 : 2R : STEEL Post', 6, 2, 'STEEL', 'Standard', 8.0,
    (SELECT id FROM materials WHERE material_sku = 'PS04'),
    (SELECT id FROM materials WHERE material_sku = 'P601'),
    (SELECT id FROM materials WHERE material_sku = 'RA01'), true)
ON CONFLICT (sku_code) DO NOTHING;

-- Wood Horizontal: H Series
INSERT INTO wood_horizontal_products (sku_code, sku_name, height, post_type, style, post_spacing, board_width_actual, post_material_id, board_material_id, nailer_material_id, is_active) VALUES
  ('H01', '6'' Hor 1x6 : WOOD Post', 6, 'WOOD', 'Standard', 6.0, 5.5,
    (SELECT id FROM materials WHERE material_sku = 'PS13'),
    (SELECT id FROM materials WHERE material_sku = 'HB601'),
    (SELECT id FROM materials WHERE material_sku = 'NL01'), true)
ON CONFLICT (sku_code) DO NOTHING;

-- Iron: I Series
INSERT INTO iron_products (sku_code, sku_name, height, post_type, style, panel_width, rails_per_panel, post_material_id, panel_material_id, is_active) VALUES
  ('I01', '4'' Iron 2-Rail Standard', 4, 'STEEL', 'Standard 2 Rail', 8.0, 2,
    (SELECT id FROM materials WHERE material_sku = 'IPS01'),
    (SELECT id FROM materials WHERE material_sku = 'IP01'), true),
  ('I02', '6'' Iron 2-Rail Standard', 6, 'STEEL', 'Standard 2 Rail', 8.0, 2,
    (SELECT id FROM materials WHERE material_sku = 'IPS01'),
    (SELECT id FROM materials WHERE material_sku = 'IP02'), true)
ON CONFLICT (sku_code) DO NOTHING;

-- ============================================
-- PERFORMANCE INDEXES
-- ============================================

-- Business Units
CREATE INDEX IF NOT EXISTS idx_business_units_code ON business_units(code);
CREATE INDEX IF NOT EXISTS idx_business_units_active ON business_units(is_active) WHERE is_active = true;

-- Materials
CREATE INDEX IF NOT EXISTS idx_materials_sku ON materials(material_sku);
CREATE INDEX IF NOT EXISTS idx_materials_category ON materials(category);
CREATE INDEX IF NOT EXISTS idx_materials_active ON materials(status) WHERE status = 'Active';

-- Labor Codes
CREATE INDEX IF NOT EXISTS idx_labor_codes_sku ON labor_codes(labor_sku);
CREATE INDEX IF NOT EXISTS idx_labor_codes_active ON labor_codes(is_active) WHERE is_active = true;

-- Labor Rates
CREATE INDEX IF NOT EXISTS idx_labor_rates_code ON labor_rates(labor_code_id);
CREATE INDEX IF NOT EXISTS idx_labor_rates_bu ON labor_rates(business_unit_id);
CREATE INDEX IF NOT EXISTS idx_labor_rates_effective ON labor_rates(effective_date);

-- Products
CREATE INDEX IF NOT EXISTS idx_wv_sku ON wood_vertical_products(sku_code);
CREATE INDEX IF NOT EXISTS idx_wv_active ON wood_vertical_products(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_wv_post_type ON wood_vertical_products(post_type);

CREATE INDEX IF NOT EXISTS idx_wh_sku ON wood_horizontal_products(sku_code);
CREATE INDEX IF NOT EXISTS idx_wh_active ON wood_horizontal_products(is_active) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_iron_sku ON iron_products(sku_code);
CREATE INDEX IF NOT EXISTS idx_iron_active ON iron_products(is_active) WHERE is_active = true;

-- Projects
CREATE INDEX IF NOT EXISTS idx_projects_customer ON bom_projects(customer_name);
CREATE INDEX IF NOT EXISTS idx_projects_bu ON bom_projects(business_unit_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON bom_projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_created ON bom_projects(created_at DESC);

-- Line Items
CREATE INDEX IF NOT EXISTS idx_line_items_project ON project_line_items(project_id);
CREATE INDEX IF NOT EXISTS idx_line_items_sort ON project_line_items(project_id, sort_order);

-- Project Materials
CREATE INDEX IF NOT EXISTS idx_project_materials_project ON project_materials(project_id);
CREATE INDEX IF NOT EXISTS idx_project_materials_material ON project_materials(material_id);

-- Project Labor
CREATE INDEX IF NOT EXISTS idx_project_labor_project ON project_labor(project_id);
CREATE INDEX IF NOT EXISTS idx_project_labor_code ON project_labor(labor_code_id);

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON TABLE business_units IS 'Business units determine labor rates: Location + Client Type';
COMMENT ON TABLE materials IS 'All fence materials: posts, pickets, rails, hardware, concrete';
COMMENT ON TABLE labor_codes IS 'Labor activity definitions (independent of rate)';
COMMENT ON TABLE labor_rates IS 'BU-specific labor rates (junction: labor_code × business_unit)';
COMMENT ON TABLE wood_vertical_products IS 'Wood vertical fence SKUs';
COMMENT ON TABLE wood_horizontal_products IS 'Wood horizontal fence SKUs';
COMMENT ON TABLE iron_products IS 'Iron/metal fence SKUs';
COMMENT ON TABLE bom_projects IS 'Multi-SKU project estimates';
COMMENT ON TABLE project_line_items IS 'Individual SKUs in a project (stores decimal calculations)';
COMMENT ON TABLE project_materials IS 'Aggregated materials (rounded at project level)';
COMMENT ON TABLE project_labor IS 'Aggregated labor for project';
