-- ============================================================================
-- BOM Calculator Database Schema for Supabase PostgreSQL
-- ============================================================================
-- This schema supports TWO calculators:
-- 1. SKU Builder Calculator: Standard cost for single SKU (catalog pricing)
-- 2. Project Calculator: Multi-SKU projects with aggregation & manual overrides
-- ============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- REFERENCE TABLES (Core Data)
-- ============================================================================

-- Business Units: Location + Client Type determines labor rates
CREATE TABLE business_units (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code TEXT UNIQUE NOT NULL, -- 'ATX-RES', 'SA-HB', 'HOU-RES', etc.
  name TEXT NOT NULL, -- 'Austin Residential'
  location TEXT NOT NULL, -- 'ATX', 'SA', 'HOU'
  business_type TEXT NOT NULL, -- 'Residential', 'Home Builders'
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_business_units_code ON business_units(code);
CREATE INDEX idx_business_units_active ON business_units(is_active) WHERE is_active = true;

-- Materials Master: All fence materials (posts, pickets, rails, hardware, concrete)
CREATE TABLE materials (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  material_sku TEXT UNIQUE NOT NULL, -- 'PS13', 'P601', 'RA01', 'HW08', etc.
  material_name TEXT NOT NULL,
  category TEXT NOT NULL, -- '01-Post', '02-Pickets', '03-Rails', '06-Concrete', '08-Hardware'
  sub_category TEXT,
  unit_type TEXT NOT NULL, -- 'Each', 'Bags', 'Coils', 'Pounds', etc.
  unit_cost DECIMAL(10,2) NOT NULL,

  -- Physical dimensions (for calculations)
  length_ft DECIMAL(10,2), -- 8, 10, 12 (for posts, rails)
  width_nominal INTEGER, -- 4, 6, 8 (nominal width)
  actual_width DECIMAL(10,2), -- 3.5, 5.5, 7.25 (actual width for calculations)
  thickness TEXT, -- '5/8"', '3/4"', '16ga'
  quantity_per_unit DECIMAL(10,2) DEFAULT 1.0, -- e.g., 300 nails per box

  -- Categorization
  fence_category_standard TEXT[], -- ['Vertical W', 'Horizontal W', 'Iron']
  is_bom_default BOOLEAN DEFAULT false, -- Is this a default material?

  -- Inventory
  status TEXT DEFAULT 'Active',
  normally_stocked BOOLEAN DEFAULT false,
  current_stock_qty INTEGER,

  -- Metadata
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_materials_sku ON materials(material_sku);
CREATE INDEX idx_materials_category ON materials(category);
CREATE INDEX idx_materials_active ON materials(status) WHERE status = 'Active';
CREATE INDEX idx_materials_stocked ON materials(normally_stocked) WHERE normally_stocked = true;

-- Labor Codes: Activity definitions (independent of rate)
CREATE TABLE labor_codes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  labor_sku TEXT UNIQUE NOT NULL, -- 'W03', 'M03', 'IR01', etc.
  description TEXT NOT NULL, -- 'Nail Up - Vertical up to 6'' High'
  fence_category_standard TEXT[], -- ['Vertical W', 'Horizontal W', 'Iron']
  unit_type TEXT NOT NULL, -- 'Per LF', 'Per Gate', 'Per EA'
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_labor_codes_sku ON labor_codes(labor_sku);
CREATE INDEX idx_labor_codes_active ON labor_codes(is_active) WHERE is_active = true;

-- Labor Rates: Business Unit specific rates (junction table)
CREATE TABLE labor_rates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  labor_code_id UUID NOT NULL REFERENCES labor_codes(id) ON DELETE CASCADE,
  business_unit_id UUID NOT NULL REFERENCES business_units(id) ON DELETE CASCADE,
  rate DECIMAL(10,2) NOT NULL, -- e.g., $2.50/LF, $30.00/Gate
  qbo_labor_code TEXT, -- QuickBooks Online reference code
  effective_date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(labor_code_id, business_unit_id, effective_date)
);

CREATE INDEX idx_labor_rates_code ON labor_rates(labor_code_id);
CREATE INDEX idx_labor_rates_bu ON labor_rates(business_unit_id);
CREATE INDEX idx_labor_rates_effective ON labor_rates(effective_date);

-- ============================================================================
-- SKU TABLES (Product Definitions - Fence Type Specific)
-- ============================================================================

-- Wood Vertical Products (most common: A01, B01, C01, D01 series)
CREATE TABLE wood_vertical_products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sku_code TEXT UNIQUE NOT NULL, -- 'A01', 'B04', 'C06', etc.
  sku_name TEXT NOT NULL, -- '6'' Ver 1x6 : 2R : WOOD Post'

  -- Physical specifications
  height INTEGER NOT NULL, -- feet (6, 8)
  rail_count INTEGER NOT NULL, -- 2, 3, 4
  post_type TEXT NOT NULL CHECK (post_type IN ('WOOD', 'STEEL')), -- CRITICAL for labor codes!
  style TEXT NOT NULL, -- 'Standard', 'Good Neighbor-RES', 'Good Neighbor-HB', 'Board-on-Board'
  post_spacing DECIMAL(10,2) DEFAULT 8.0, -- feet (8.0 standard, 7.71 for Good Neighbor)

  -- Direct material references (for calculations)
  post_material_id UUID NOT NULL REFERENCES materials(id),
  picket_material_id UUID NOT NULL REFERENCES materials(id),
  rail_material_id UUID NOT NULL REFERENCES materials(id),
  cap_material_id UUID REFERENCES materials(id), -- optional
  trim_material_id UUID REFERENCES materials(id), -- optional
  rot_board_material_id UUID REFERENCES materials(id), -- optional

  -- Standard cost (from SKU Builder Calculator - cached for catalog pricing)
  standard_material_cost DECIMAL(10,2),
  standard_labor_cost DECIMAL(10,2),
  standard_cost_per_foot DECIMAL(10,2),
  standard_cost_calculated_at TIMESTAMPTZ,

  -- Metadata
  product_description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_wv_sku ON wood_vertical_products(sku_code);
CREATE INDEX idx_wv_active ON wood_vertical_products(is_active) WHERE is_active = true;
CREATE INDEX idx_wv_height ON wood_vertical_products(height);
CREATE INDEX idx_wv_post_type ON wood_vertical_products(post_type);
CREATE INDEX idx_wv_style ON wood_vertical_products(style);

-- Wood Horizontal Products
CREATE TABLE wood_horizontal_products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sku_code TEXT UNIQUE NOT NULL,
  sku_name TEXT NOT NULL,

  -- Physical specifications
  height INTEGER NOT NULL, -- feet
  post_type TEXT NOT NULL CHECK (post_type IN ('WOOD', 'STEEL')),
  style TEXT NOT NULL, -- 'Standard', 'Good Neighbor', 'Exposed'
  post_spacing DECIMAL(10,2) DEFAULT 6.0, -- feet (6.0 for horizontal)
  board_width_actual DECIMAL(10,2) NOT NULL, -- actual width in inches (5.5 for 1x6)

  -- Direct material references
  post_material_id UUID NOT NULL REFERENCES materials(id),
  board_material_id UUID NOT NULL REFERENCES materials(id), -- horizontal boards
  nailer_material_id UUID REFERENCES materials(id), -- vertical support between posts
  cap_material_id UUID REFERENCES materials(id), -- optional

  -- Standard cost (cached)
  standard_material_cost DECIMAL(10,2),
  standard_labor_cost DECIMAL(10,2),
  standard_cost_per_foot DECIMAL(10,2),
  standard_cost_calculated_at TIMESTAMPTZ,

  -- Metadata
  product_description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_wh_sku ON wood_horizontal_products(sku_code);
CREATE INDEX idx_wh_active ON wood_horizontal_products(is_active) WHERE is_active = true;
CREATE INDEX idx_wh_height ON wood_horizontal_products(height);
CREATE INDEX idx_wh_post_type ON wood_horizontal_products(post_type);

-- Iron Products
CREATE TABLE iron_products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sku_code TEXT UNIQUE NOT NULL,
  sku_name TEXT NOT NULL,

  -- Physical specifications
  height INTEGER NOT NULL, -- feet
  post_type TEXT NOT NULL DEFAULT 'STEEL' CHECK (post_type = 'STEEL'), -- always steel for iron
  style TEXT NOT NULL, -- 'Standard 2 Rail', 'Ameristar/3 Rail', 'Iron Rail'
  panel_width DECIMAL(10,2) DEFAULT 8.0, -- feet (8.0 standard)
  rails_per_panel INTEGER, -- 2 or 3

  -- Direct material references
  post_material_id UUID NOT NULL REFERENCES materials(id),
  panel_material_id UUID REFERENCES materials(id), -- for pre-welded panels
  bracket_material_id UUID REFERENCES materials(id), -- for Ameristar/Centurion
  rail_material_id UUID REFERENCES materials(id), -- for Iron Rail style
  picket_material_id UUID REFERENCES materials(id), -- for Iron Rail style

  -- Standard cost (cached)
  standard_material_cost DECIMAL(10,2),
  standard_labor_cost DECIMAL(10,2),
  standard_cost_per_foot DECIMAL(10,2),
  standard_cost_calculated_at TIMESTAMPTZ,

  -- Metadata
  product_description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_iron_sku ON iron_products(sku_code);
CREATE INDEX idx_iron_active ON iron_products(is_active) WHERE is_active = true;
CREATE INDEX idx_iron_height ON iron_products(height);
CREATE INDEX idx_iron_style ON iron_products(style);

-- ============================================================================
-- PROJECT TABLES (Multi-SKU Estimates with Aggregation)
-- ============================================================================

-- Projects (main project record)
CREATE TABLE bom_projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_name TEXT NOT NULL,
  customer_name TEXT,
  business_unit_id UUID NOT NULL REFERENCES business_units(id),

  -- Project-level settings
  concrete_type TEXT NOT NULL DEFAULT '3-part', -- '3-part', 'yellow-bags', 'red-bags'

  -- Calculated totals (cached after calculation)
  total_linear_feet DECIMAL(10,2),
  total_material_cost DECIMAL(10,2),
  total_labor_cost DECIMAL(10,2),
  manual_adjustments DECIMAL(10,2) DEFAULT 0, -- +/- manual cost adjustments
  total_project_cost DECIMAL(10,2),
  cost_per_foot DECIMAL(10,2),

  -- Metadata
  status TEXT DEFAULT 'draft', -- 'draft', 'quoted', 'approved', 'completed'
  notes TEXT,
  created_by UUID, -- references auth.users(id) in your app
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_projects_customer ON bom_projects(customer_name);
CREATE INDEX idx_projects_bu ON bom_projects(business_unit_id);
CREATE INDEX idx_projects_status ON bom_projects(status);
CREATE INDEX idx_projects_created ON bom_projects(created_at DESC);

-- Project Line Items (each SKU in the project)
CREATE TABLE project_line_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES bom_projects(id) ON DELETE CASCADE,

  -- SKU reference (polymorphic - references one of the product tables)
  fence_type TEXT NOT NULL, -- 'wood_vertical', 'wood_horizontal', 'iron'
  product_id UUID NOT NULL, -- Foreign key to wood_vertical_products/wood_horizontal/iron
  product_sku_code TEXT NOT NULL, -- Denormalized for display
  product_name TEXT NOT NULL, -- Denormalized for display

  -- User inputs
  total_footage DECIMAL(10,2) NOT NULL,
  buffer DECIMAL(10,2) DEFAULT 5.0, -- material waste buffer
  net_length DECIMAL(10,2) NOT NULL, -- total_footage - buffer
  number_of_lines INTEGER DEFAULT 1 CHECK (number_of_lines BETWEEN 1 AND 5),
  number_of_gates INTEGER DEFAULT 0 CHECK (number_of_gates BETWEEN 0 AND 3),

  -- Calculated quantities (BEFORE rounding - stored as decimals!)
  calculated_posts DECIMAL(10,2),
  calculated_pickets DECIMAL(10,2),
  calculated_rails DECIMAL(10,2),
  calculated_panels DECIMAL(10,2), -- for iron
  calculated_boards DECIMAL(10,2), -- for horizontal
  calculated_nailers DECIMAL(10,2), -- for horizontal

  -- Manual overrides (if user adjusts at project level - NOT sticky to SKU)
  adjusted_posts INTEGER,
  adjusted_pickets INTEGER,
  adjusted_rails INTEGER,
  adjusted_panels INTEGER,

  -- Metadata
  sort_order INTEGER DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_line_items_project ON project_line_items(project_id);
CREATE INDEX idx_line_items_fence_type ON project_line_items(fence_type);
CREATE INDEX idx_line_items_sort ON project_line_items(project_id, sort_order);

-- Project Materials (Aggregated BOM - project level)
CREATE TABLE project_materials (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES bom_projects(id) ON DELETE CASCADE,
  material_id UUID NOT NULL REFERENCES materials(id),

  -- Quantities
  calculated_quantity DECIMAL(10,2) NOT NULL, -- Sum from all line items (DECIMAL!)
  rounded_quantity INTEGER, -- After project-level rounding: Math.ceil(calculated_quantity)
  manual_quantity INTEGER, -- If user overrides
  final_quantity INTEGER GENERATED ALWAYS AS (
    COALESCE(manual_quantity, rounded_quantity)
  ) STORED,

  -- Costs (snapshot at calculation time)
  unit_cost DECIMAL(10,2) NOT NULL, -- Snapshot from materials table
  extended_cost DECIMAL(10,2) GENERATED ALWAYS AS (
    final_quantity * unit_cost
  ) STORED,

  -- Metadata
  aggregation_level TEXT NOT NULL DEFAULT 'project', -- 'project' or 'line-item'
  calculation_note TEXT, -- e.g., "Aggregated from 3 line items"
  is_manual_addition BOOLEAN DEFAULT false, -- User added this material manually

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_id, material_id)
);

CREATE INDEX idx_project_materials_project ON project_materials(project_id);
CREATE INDEX idx_project_materials_material ON project_materials(material_id);
CREATE INDEX idx_project_materials_manual ON project_materials(is_manual_addition) WHERE is_manual_addition = true;

-- Project Labor (Aggregated BOL - project level)
CREATE TABLE project_labor (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES bom_projects(id) ON DELETE CASCADE,
  labor_code_id UUID NOT NULL REFERENCES labor_codes(id),

  -- Quantities
  calculated_quantity DECIMAL(10,2) NOT NULL, -- Based on net_length or gate count
  manual_quantity DECIMAL(10,2), -- If user overrides
  final_quantity DECIMAL(10,2) GENERATED ALWAYS AS (
    COALESCE(manual_quantity, calculated_quantity)
  ) STORED,

  -- Costs (snapshot at calculation time)
  labor_rate DECIMAL(10,2) NOT NULL, -- Snapshot from labor_rates for this BU
  extended_cost DECIMAL(10,2) GENERATED ALWAYS AS (
    final_quantity * labor_rate
  ) STORED,

  -- Metadata
  is_manual_addition BOOLEAN DEFAULT false, -- User added this labor manually
  calculation_note TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_id, labor_code_id)
);

CREATE INDEX idx_project_labor_project ON project_labor(project_id);
CREATE INDEX idx_project_labor_code ON project_labor(labor_code_id);
CREATE INDEX idx_project_labor_manual ON project_labor(is_manual_addition) WHERE is_manual_addition = true;

-- ============================================================================
-- TRIGGERS FOR UPDATED_AT
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all tables with updated_at
CREATE TRIGGER update_business_units_updated_at BEFORE UPDATE ON business_units
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_materials_updated_at BEFORE UPDATE ON materials
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_labor_codes_updated_at BEFORE UPDATE ON labor_codes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_labor_rates_updated_at BEFORE UPDATE ON labor_rates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_wood_vertical_updated_at BEFORE UPDATE ON wood_vertical_products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_wood_horizontal_updated_at BEFORE UPDATE ON wood_horizontal_products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_iron_products_updated_at BEFORE UPDATE ON iron_products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_bom_projects_updated_at BEFORE UPDATE ON bom_projects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_project_line_items_updated_at BEFORE UPDATE ON project_line_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_project_materials_updated_at BEFORE UPDATE ON project_materials
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_project_labor_updated_at BEFORE UPDATE ON project_labor
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE business_units IS 'Business units determine labor rates: Location + Client Type (ATX-RES, SA-HB, etc.)';
COMMENT ON TABLE materials IS 'All fence materials: posts, pickets, rails, hardware, concrete';
COMMENT ON TABLE labor_codes IS 'Labor activity definitions (independent of rate)';
COMMENT ON TABLE labor_rates IS 'BU-specific labor rates (junction table: labor_code × business_unit)';
COMMENT ON TABLE wood_vertical_products IS 'Wood vertical fence SKUs (A01-A06, B01-B06, C01-C06, D01-D06 series)';
COMMENT ON TABLE wood_horizontal_products IS 'Wood horizontal fence SKUs';
COMMENT ON TABLE iron_products IS 'Iron/metal fence SKUs';
COMMENT ON TABLE bom_projects IS 'Multi-SKU project estimates with aggregated BOM/BOL';
COMMENT ON TABLE project_line_items IS 'Individual SKUs in a project (stores decimal calculations before rounding)';
COMMENT ON TABLE project_materials IS 'Aggregated materials for project (rounded at project level)';
COMMENT ON TABLE project_labor IS 'Aggregated labor for project';

-- ============================================================================
-- END OF SCHEMA
-- ============================================================================
