-- ============================================================================
-- BOM/BOL Calculator - Complete Supabase Database Schema
-- ============================================================================
-- Version: 2.0
-- Target: PostgreSQL 14+ (Supabase)
-- Purpose: Fence estimation system with explicit component references
--
-- Key Design Principles:
-- 1. Fence-type specific product tables (not generic)
-- 2. Explicit component references via foreign keys
-- 3. Relational integrity enforced at database level
-- 4. Optimized for queries and reporting
-- ============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- REFERENCE TABLES
-- ============================================================================

-- Materials Master: All materials catalog
-- ----------------------------------------------------------------------------
CREATE TABLE materials (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    material_sku VARCHAR(20) UNIQUE NOT NULL,
    material_name VARCHAR(255) NOT NULL,
    category VARCHAR(50) NOT NULL,  -- '01-Post', '02-Picket', '03-Rail', etc.
    
    -- Physical properties
    length_ft DECIMAL(5,2),
    width_actual DECIMAL(5,2),      -- Actual width in inches (e.g., 5.5" for 1x6)
    width_nominal DECIMAL(5,2),     -- Nominal width (e.g., 6" for 1x6)
    thickness VARCHAR(20),           -- As text to handle varied formats
    material_type VARCHAR(50),       -- 'Wood', 'Steel', 'Iron', 'Hardware', 'Concrete'
    
    -- NEW: Three-tier filtering for smart material selection
    fence_categories TEXT[],         -- ['Wood Vertical', 'Wood Horizontal', 'Iron']
    component_types TEXT[],          -- ['POSTS', 'PICKETS', 'RAILS']
    sub_components TEXT[],           -- ['Wood Post 4x4', 'Steel Post 2.5']
    
    -- Pricing
    unit_cost DECIMAL(10,2) NOT NULL,
    unit_type VARCHAR(20),           -- 'EA', 'LF', 'BDL', 'BOX'
    
    -- Integration IDs
    service_titan_id VARCHAR(50),
    qbo_item_id VARCHAR(50),
    
    -- Metadata
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_materials_category ON materials(category);
CREATE INDEX idx_materials_fence_categories ON materials USING GIN(fence_categories);
CREATE INDEX idx_materials_component_types ON materials USING GIN(component_types);
CREATE INDEX idx_materials_active ON materials(active);
CREATE INDEX idx_materials_sku ON materials(material_sku);

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_materials_updated_at BEFORE UPDATE ON materials
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- Business Units: Company locations and customer types
-- ----------------------------------------------------------------------------
CREATE TABLE business_units (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    bu_code VARCHAR(20) UNIQUE NOT NULL,
    bu_name VARCHAR(255) NOT NULL,
    location VARCHAR(50) NOT NULL,
    customer_type VARCHAR(20) NOT NULL,  -- 'Residential', 'Home Builder'
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Seed data
INSERT INTO business_units (bu_code, bu_name, location, customer_type) VALUES
    ('ATX-RES', 'Austin Residential', 'Austin', 'Residential'),
    ('ATX-HB', 'Austin Home Builder', 'Austin', 'Home Builder'),
    ('SA-RES', 'San Antonio Residential', 'San Antonio', 'Residential'),
    ('SA-HB', 'San Antonio Home Builder', 'San Antonio', 'Home Builder'),
    ('HOU-RES', 'Houston Residential', 'Houston', 'Residential'),
    ('HOU-HB', 'Houston Home Builder', 'Houston', 'Home Builder');


-- Labor Codes: Labor tasks with BU-specific rates (MATRIX APPROACH)
-- ----------------------------------------------------------------------------
CREATE TABLE labor_codes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    labor_sku VARCHAR(20) UNIQUE NOT NULL,
    labor_description VARCHAR(255) NOT NULL,
    fence_categories TEXT[],              -- ['Wood Vertical', 'Wood Horizontal']
    unit_type VARCHAR(20),                -- 'PER_LF', 'PER_GATE', 'PER_PROJECT'
    
    -- Rates per business unit (matrix columns)
    rate_atx_res DECIMAL(10,2),
    rate_atx_hb DECIMAL(10,2),
    rate_sa_res DECIMAL(10,2),
    rate_sa_hb DECIMAL(10,2),
    rate_hou_res DECIMAL(10,2),
    rate_hou_hb DECIMAL(10,2),
    
    -- Service availability (which BUs offer this service)
    available_in_bus TEXT[],
    
    -- QuickBooks integration (generated on demand, not stored)
    -- Format: R{CODE} for residential, B{CODE}-{LOC} for builder
    -- Example: RW02, BW02-SA, MW03-HOU
    
    active BOOLEAN DEFAULT true,
    last_modified TIMESTAMP DEFAULT NOW(),
    modified_by VARCHAR(100)
);

CREATE INDEX idx_labor_codes_fence_categories ON labor_codes USING GIN(fence_categories);
CREATE INDEX idx_labor_codes_active ON labor_codes(active);

CREATE TRIGGER update_labor_codes_last_modified BEFORE UPDATE ON labor_codes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ============================================================================
-- PRODUCT CATALOG TABLES (Fence-Type Specific)
-- ============================================================================

-- Wood Vertical Products: Explicit component references
-- ----------------------------------------------------------------------------
CREATE TABLE wood_vertical_products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sku_code VARCHAR(50) UNIQUE NOT NULL,
    sku_name VARCHAR(255) NOT NULL,
    
    -- Configuration
    style VARCHAR(50) NOT NULL,           -- 'Standard', 'Good Neighbor - Residential', etc.
    height INTEGER NOT NULL CHECK (height BETWEEN 3 AND 8),
    rail_count INTEGER NOT NULL CHECK (rail_count BETWEEN 2 AND 4),
    post_spacing DECIMAL(5,2) DEFAULT 8.0,
    
    -- EXPLICIT component references (foreign keys)
    post_material_id UUID NOT NULL REFERENCES materials(id),
    post_type VARCHAR(20) NOT NULL CHECK (post_type IN ('WOOD', 'STEEL')),  -- CRITICAL!
    picket_material_id UUID NOT NULL REFERENCES materials(id),
    rail_material_id UUID NOT NULL REFERENCES materials(id),
    
    -- Optional components
    cap_material_id UUID REFERENCES materials(id),
    trim_material_id UUID REFERENCES materials(id),
    rot_board_material_id UUID REFERENCES materials(id),
    
    -- Hardware (required)
    picket_nail_id UUID NOT NULL REFERENCES materials(id),
    framing_nail_id UUID NOT NULL REFERENCES materials(id),
    
    -- Concrete configuration
    concrete_type VARCHAR(20) DEFAULT '3-PART' CHECK (concrete_type IN ('3-PART', 'YELLOW', 'RED')),
    
    -- Cached costs (updated on save/recalc)
    base_material_cost DECIMAL(10,2),
    base_labor_cost DECIMAL(10,2),
    last_calculated_at TIMESTAMP,
    
    -- Metadata
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    created_by VARCHAR(100)
);

CREATE INDEX idx_wv_products_style ON wood_vertical_products(style);
CREATE INDEX idx_wv_products_height ON wood_vertical_products(height);
CREATE INDEX idx_wv_products_post_type ON wood_vertical_products(post_type);
CREATE INDEX idx_wv_products_active ON wood_vertical_products(active);
CREATE INDEX idx_wv_products_sku ON wood_vertical_products(sku_code);

CREATE TRIGGER update_wv_products_updated_at BEFORE UPDATE ON wood_vertical_products
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- Wood Horizontal Products
-- ----------------------------------------------------------------------------
CREATE TABLE wood_horizontal_products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sku_code VARCHAR(50) UNIQUE NOT NULL,
    sku_name VARCHAR(255) NOT NULL,
    
    -- Configuration
    style VARCHAR(50) NOT NULL,
    height INTEGER NOT NULL CHECK (height BETWEEN 3 AND 8),
    post_spacing DECIMAL(5,2) DEFAULT 6.0,  -- Typically 6ft for horizontal
    
    -- EXPLICIT components
    post_material_id UUID NOT NULL REFERENCES materials(id),
    post_type VARCHAR(20) NOT NULL CHECK (post_type IN ('WOOD', 'STEEL')),
    board_material_id UUID NOT NULL REFERENCES materials(id),
    nailer_material_id UUID NOT NULL REFERENCES materials(id),
    
    -- Optional
    cap_material_id UUID REFERENCES materials(id),
    trim_material_id UUID REFERENCES materials(id),
    
    -- Hardware
    board_nail_id UUID NOT NULL REFERENCES materials(id),
    structure_nail_id UUID NOT NULL REFERENCES materials(id),
    
    concrete_type VARCHAR(20) DEFAULT '3-PART',
    
    -- Cached costs
    base_material_cost DECIMAL(10,2),
    base_labor_cost DECIMAL(10,2),
    last_calculated_at TIMESTAMP,
    
    -- Metadata
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    created_by VARCHAR(100)
);

CREATE INDEX idx_wh_products_style ON wood_horizontal_products(style);
CREATE INDEX idx_wh_products_height ON wood_horizontal_products(height);
CREATE INDEX idx_wh_products_active ON wood_horizontal_products(active);

CREATE TRIGGER update_wh_products_updated_at BEFORE UPDATE ON wood_horizontal_products
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- Iron Products
-- ----------------------------------------------------------------------------
CREATE TABLE iron_products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sku_code VARCHAR(50) UNIQUE NOT NULL,
    sku_name VARCHAR(255) NOT NULL,
    
    -- Configuration
    style VARCHAR(50) NOT NULL,  -- 'Standard 2 Rail', 'Ameristar/3 Rail', 'Iron Rail'
    height INTEGER NOT NULL CHECK (height BETWEEN 3 AND 8),
    post_spacing DECIMAL(5,2) DEFAULT 8.0,
    
    -- EXPLICIT components
    post_material_id UUID NOT NULL REFERENCES materials(id),
    panel_material_id UUID REFERENCES materials(id),        -- For standard/Ameristar
    rail_material_id UUID REFERENCES materials(id),         -- For rail style
    picket_material_id UUID REFERENCES materials(id),       -- For rail style
    bracket_material_id UUID REFERENCES materials(id),      -- For Ameristar only
    welding_supply_id UUID REFERENCES materials(id),
    
    -- Optional finishes
    primer_material_id UUID REFERENCES materials(id),
    paint_material_id UUID REFERENCES materials(id),
    
    concrete_type VARCHAR(20) DEFAULT 'BAGS-HEAVY',
    
    -- Cached costs
    base_material_cost DECIMAL(10,2),
    base_labor_cost DECIMAL(10,2),
    last_calculated_at TIMESTAMP,
    
    -- Metadata
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    created_by VARCHAR(100)
);

CREATE INDEX idx_iron_products_style ON iron_products(style);
CREATE INDEX idx_iron_products_height ON iron_products(height);
CREATE INDEX idx_iron_products_active ON iron_products(active);

CREATE TRIGGER update_iron_products_updated_at BEFORE UPDATE ON iron_products
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ============================================================================
-- PROJECT MANAGEMENT TABLES
-- ============================================================================

-- Projects: Top-level project information
-- ----------------------------------------------------------------------------
CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_number VARCHAR(50) UNIQUE,
    
    -- Customer information
    customer_name VARCHAR(255) NOT NULL,
    customer_address TEXT,
    customer_phone VARCHAR(20),
    customer_email VARCHAR(100),
    
    -- Business context
    business_unit_id UUID NOT NULL REFERENCES business_units(id),
    assigned_to VARCHAR(100),  -- User ID/email
    
    -- Project measurements
    total_footage DECIMAL(10,2) NOT NULL,
    error_buffer DECIMAL(10,2) DEFAULT 5.0,
    net_length DECIMAL(10,2) NOT NULL,
    number_of_lines INTEGER DEFAULT 1,
    number_of_gates INTEGER DEFAULT 0,
    
    -- Totals (aggregated from line items)
    total_material_cost DECIMAL(10,2),
    total_labor_cost DECIMAL(10,2),
    total_cost DECIMAL(10,2),
    
    -- Status workflow
    status VARCHAR(50) DEFAULT 'DRAFT',
    -- Status values: 'DRAFT', 'APPROVED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'
    
    -- Integration
    service_titan_id VARCHAR(50),
    qbo_estimate_id VARCHAR(50),
    
    -- Audit trail
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    created_by VARCHAR(100),
    approved_at TIMESTAMP,
    approved_by VARCHAR(100)
);

CREATE INDEX idx_projects_status ON projects(status);
CREATE INDEX idx_projects_bu ON projects(business_unit_id);
CREATE INDEX idx_projects_created ON projects(created_at DESC);
CREATE INDEX idx_projects_customer ON projects(customer_name);
CREATE INDEX idx_projects_st_id ON projects(service_titan_id);

CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON projects
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- Project Line Items: Individual fence sections within a project
-- ----------------------------------------------------------------------------
CREATE TABLE project_line_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    line_number INTEGER NOT NULL,
    
    -- SKU selection (polymorphic reference to fence-specific tables)
    fence_type VARCHAR(50) NOT NULL,  -- 'Wood Vertical', 'Wood Horizontal', 'Iron'
    sku_id UUID NOT NULL,             -- References wood_vertical_products.id, etc.
    sku_code VARCHAR(50) NOT NULL,
    
    -- Line item measurements
    net_length DECIMAL(10,2) NOT NULL,
    number_of_lines INTEGER DEFAULT 1,
    number_of_gates INTEGER DEFAULT 0,
    
    -- Costs for this line
    material_cost DECIMAL(10,2),
    labor_cost DECIMAL(10,2),
    line_total DECIMAL(10,2),
    
    created_at TIMESTAMP DEFAULT NOW(),
    
    CONSTRAINT unique_project_line UNIQUE(project_id, line_number)
);

CREATE INDEX idx_line_items_project ON project_line_items(project_id);
CREATE INDEX idx_line_items_fence_type ON project_line_items(fence_type);


-- Project BOM: Calculated bill of materials
-- ----------------------------------------------------------------------------
CREATE TABLE project_bom (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    line_item_id UUID REFERENCES project_line_items(id) ON DELETE CASCADE,
    
    -- Material reference
    material_id UUID NOT NULL REFERENCES materials(id),
    material_sku VARCHAR(20) NOT NULL,
    material_name VARCHAR(255) NOT NULL,
    
    -- Quantities
    calculated_quantity DECIMAL(10,2) NOT NULL,
    manual_adjustment DECIMAL(10,2) DEFAULT 0,
    final_quantity DECIMAL(10,2) NOT NULL,  -- calculated + adjustment
    
    -- Costs
    unit_cost DECIMAL(10,2) NOT NULL,
    extended_cost DECIMAL(10,2) NOT NULL,
    
    -- Metadata
    component_type VARCHAR(50),  -- 'POSTS', 'PICKETS', 'RAILS', etc.
    formula_used TEXT,           -- For audit trail
    
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_bom_project ON project_bom(project_id);
CREATE INDEX idx_bom_line_item ON project_bom(line_item_id);
CREATE INDEX idx_bom_material ON project_bom(material_id);


-- Project BOL: Calculated bill of labor
-- ----------------------------------------------------------------------------
CREATE TABLE project_bol (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    line_item_id UUID REFERENCES project_line_items(id) ON DELETE CASCADE,
    
    -- Labor reference
    labor_code_id UUID NOT NULL REFERENCES labor_codes(id),
    labor_sku VARCHAR(20) NOT NULL,
    labor_description VARCHAR(255) NOT NULL,
    
    -- Calculation
    quantity DECIMAL(10,2) NOT NULL,  -- Usually LF, gates, projects
    rate DECIMAL(10,2) NOT NULL,      -- BU-specific rate
    calculated_cost DECIMAL(10,2) NOT NULL,
    manual_adjustment DECIMAL(10,2) DEFAULT 0,
    final_cost DECIMAL(10,2) NOT NULL,  -- calculated + adjustment
    
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_bol_project ON project_bol(project_id);
CREATE INDEX idx_bol_line_item ON project_bol(line_item_id);
CREATE INDEX idx_bol_labor_code ON project_bol(labor_code_id);


-- ============================================================================
-- USER MANAGEMENT (Optional - if not using larger app's auth)
-- ============================================================================

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255),
    role VARCHAR(50) DEFAULT 'ESTIMATOR',  -- 'ADMIN', 'ESTIMATOR', 'YARD', 'MANAGER'
    business_unit_ids UUID[],              -- Can access multiple BUs
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    last_login TIMESTAMP
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);


-- ============================================================================
-- USEFUL VIEWS
-- ============================================================================

-- View: All products with material details (for reporting)
-- ----------------------------------------------------------------------------
CREATE VIEW v_wood_vertical_products_detailed AS
SELECT 
    p.id,
    p.sku_code,
    p.sku_name,
    p.style,
    p.height,
    p.post_type,
    p.rail_count,
    
    post_mat.material_name as post_material,
    post_mat.unit_cost as post_cost,
    
    picket_mat.material_name as picket_material,
    picket_mat.unit_cost as picket_cost,
    
    rail_mat.material_name as rail_material,
    rail_mat.unit_cost as rail_cost,
    
    p.base_material_cost,
    p.base_labor_cost,
    p.active
FROM wood_vertical_products p
LEFT JOIN materials post_mat ON p.post_material_id = post_mat.id
LEFT JOIN materials picket_mat ON p.picket_material_id = picket_mat.id
LEFT JOIN materials rail_mat ON p.rail_material_id = rail_mat.id;


-- View: Project summary with costs
-- ----------------------------------------------------------------------------
CREATE VIEW v_project_summary AS
SELECT 
    p.id,
    p.project_number,
    p.customer_name,
    bu.bu_name as business_unit,
    p.net_length,
    p.number_of_lines,
    p.number_of_gates,
    p.status,
    p.total_material_cost,
    p.total_labor_cost,
    p.total_cost,
    ROUND(p.total_cost / NULLIF(p.net_length, 0), 2) as cost_per_foot,
    p.created_at,
    p.created_by
FROM projects p
JOIN business_units bu ON p.business_unit_id = bu.id;


-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE labor_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE wood_vertical_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE wood_horizontal_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE iron_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_bom ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_bol ENABLE ROW LEVEL SECURITY;

-- Example policy: Users can view all reference data
CREATE POLICY "Anyone can view materials" ON materials FOR SELECT USING (true);
CREATE POLICY "Anyone can view business units" ON business_units FOR SELECT USING (true);
CREATE POLICY "Anyone can view labor codes" ON labor_codes FOR SELECT USING (true);
CREATE POLICY "Anyone can view products" ON wood_vertical_products FOR SELECT USING (active = true);

-- Example policy: Users can only see their own projects
-- (Adjust based on larger app's auth)
CREATE POLICY "Users can view own projects" ON projects FOR SELECT
    USING (auth.uid() = created_by::uuid);

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function: Get BU-specific labor rate
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_labor_rate(
    p_labor_sku VARCHAR,
    p_business_unit VARCHAR
)
RETURNS DECIMAL(10,2) AS $$
DECLARE
    v_rate DECIMAL(10,2);
    v_rate_field VARCHAR;
BEGIN
    -- Map BU code to rate column
    v_rate_field := 'rate_' || LOWER(REPLACE(p_business_unit, '-', '_'));
    
    -- Get rate using dynamic SQL
    EXECUTE format('SELECT %I FROM labor_codes WHERE labor_sku = $1', v_rate_field)
    INTO v_rate
    USING p_labor_sku;
    
    RETURN COALESCE(v_rate, 0);
END;
$$ LANGUAGE plpgsql;


-- Function: Generate QBO code
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION generate_qbo_code(
    p_labor_sku VARCHAR,
    p_business_unit VARCHAR
)
RETURNS VARCHAR AS $$
DECLARE
    v_prefix VARCHAR;
    v_suffix VARCHAR;
BEGIN
    -- Determine prefix (R for residential, B for builder)
    v_prefix := CASE 
        WHEN p_business_unit LIKE '%-RES' THEN 'R'
        WHEN p_business_unit LIKE '%-HB' THEN 'B'
        ELSE 'R'
    END;
    
    -- Determine suffix (location for builders)
    v_suffix := CASE 
        WHEN p_business_unit LIKE '%-HB' AND p_business_unit NOT LIKE 'ATX-%' THEN
            '-' || LEFT(p_business_unit, 3)
        ELSE ''
    END;
    
    RETURN v_prefix || p_labor_sku || v_suffix;
END;
$$ LANGUAGE plpgsql;


-- ============================================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE materials IS 'Materials catalog with three-tier filtering for smart selection';
COMMENT ON TABLE wood_vertical_products IS 'Fence-specific product table with explicit component references';
COMMENT ON TABLE labor_codes IS 'Labor tasks with matrix of BU-specific rates';
COMMENT ON TABLE projects IS 'Top-level project information with aggregated totals';
COMMENT ON TABLE project_bom IS 'Calculated bill of materials with manual adjustments';
COMMENT ON TABLE project_bol IS 'Calculated bill of labor with BU-specific rates';

COMMENT ON COLUMN wood_vertical_products.post_type IS 'CRITICAL: Determines W vs M labor codes. Must be WOOD or STEEL';
COMMENT ON COLUMN materials.fence_categories IS 'Which fence types can use this material';
COMMENT ON COLUMN materials.component_types IS 'What role this material serves (POSTS, PICKETS, etc)';
COMMENT ON COLUMN labor_codes.rate_atx_res IS 'Rate for Austin Residential business unit';

-- ============================================================================
-- END OF SCHEMA
-- ============================================================================
