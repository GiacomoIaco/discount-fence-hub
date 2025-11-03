-- Fence Measurement Feature Tables
-- This migration creates tables for AR-based fence measurement and project management
-- Used by both mobile app (React Native) and web dashboard

-- ============================================
-- 1. FENCE PROJECTS (Main project table)
-- ============================================
CREATE TABLE IF NOT EXISTS public.fence_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Project Identification
  project_name TEXT NOT NULL,
  project_number TEXT, -- Auto-generated: FP-YYYY-NNNN

  -- Client Information
  client_name TEXT NOT NULL,
  client_phone TEXT,
  client_email TEXT,

  -- Site Location
  site_address TEXT NOT NULL,
  site_city TEXT,
  site_state TEXT,
  site_zip TEXT,
  site_country TEXT DEFAULT 'USA',

  -- GPS Coordinates
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  reverse_geocoded_address TEXT,

  -- Sales Representative
  created_by UUID REFERENCES public.sales_reps(id) ON DELETE SET NULL,
  sales_rep_name TEXT, -- Denormalized for display
  sales_rep_email TEXT,

  -- Project Status
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'measuring', 'review', 'approved', 'completed', 'cancelled')),

  -- Measurement Summary (calculated fields)
  total_linear_feet DECIMAL(10, 2) DEFAULT 0,
  total_area_sqft DECIMAL(10, 2) DEFAULT 0,
  num_segments INTEGER DEFAULT 0,
  num_gates INTEGER DEFAULT 0,
  num_obstacles INTEGER DEFAULT 0,
  perimeter_feet DECIMAL(10, 2) DEFAULT 0,

  -- Calibration Data
  calibration_used BOOLEAN DEFAULT false,
  calibration_reference_length_feet DECIMAL(10, 2), -- Known length used for calibration
  calibration_measured_length_feet DECIMAL(10, 2), -- What AR measured
  calibration_factor DECIMAL(10, 6), -- Correction factor
  calibration_timestamp TIMESTAMPTZ,

  -- Device & Precision Metadata
  device_model TEXT, -- e.g., "iPhone 14 Pro"
  device_os TEXT, -- e.g., "iOS 17.2"
  has_lidar BOOLEAN DEFAULT false,
  avg_confidence_score DECIMAL(3, 2), -- 0.00 to 1.00
  estimated_accuracy_cm DECIMAL(5, 2),

  -- Notes & Details
  notes TEXT,
  special_instructions TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  measuring_started_at TIMESTAMPTZ,
  measuring_completed_at TIMESTAMPTZ,
  approved_at TIMESTAMPTZ,
  approved_by UUID REFERENCES public.sales_reps(id),

  -- Sync Management (for offline-first mobile app)
  synced BOOLEAN DEFAULT false,
  last_synced_at TIMESTAMPTZ,
  sync_version INTEGER DEFAULT 1,

  -- Soft Delete
  deleted BOOLEAN DEFAULT false,
  deleted_at TIMESTAMPTZ,
  deleted_by UUID REFERENCES public.sales_reps(id)
);

-- ============================================
-- 2. FENCE SEGMENTS (Polyline vertices)
-- ============================================
CREATE TABLE IF NOT EXISTS public.fence_segments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.fence_projects(id) ON DELETE CASCADE,

  -- Segment Order (for polyline)
  segment_index INTEGER NOT NULL, -- 0, 1, 2...

  -- 3D World Coordinates (from ARKit/ARCore)
  start_x DECIMAL(10, 4) NOT NULL,
  start_y DECIMAL(10, 4) NOT NULL,
  start_z DECIMAL(10, 4) NOT NULL,
  end_x DECIMAL(10, 4) NOT NULL,
  end_y DECIMAL(10, 4) NOT NULL,
  end_z DECIMAL(10, 4) NOT NULL,

  -- Calculated Measurements
  length_feet DECIMAL(10, 2) NOT NULL,
  length_inches DECIMAL(5, 2) NOT NULL,
  length_meters DECIMAL(10, 4), -- For international users

  -- Fence Specifications
  fence_style TEXT, -- 'board-on-board', 'shadowbox', 'privacy', 'picket', 'chain-link', 'vinyl', 'composite'
  fence_height_feet DECIMAL(4, 2),
  fence_height_inches INTEGER,
  post_type TEXT, -- '4x4', '6x6', 'steel', 'vinyl'
  post_spacing_feet DECIMAL(4, 2) DEFAULT 8,

  -- Terrain & Slope
  slope_percent DECIMAL(5, 2), -- e.g., 5.25 = 5.25% grade
  slope_angle_degrees DECIMAL(5, 2),
  terrain_type TEXT, -- 'flat', 'sloped', 'stepped', 'varied'

  -- Quality Metadata
  confidence_score DECIMAL(3, 2), -- ARKit/ARCore confidence (0-1)
  measurement_timestamp TIMESTAMPTZ DEFAULT now(),

  -- Additional Data
  notes TEXT,
  requires_special_post BOOLEAN DEFAULT false,
  requires_gate BOOLEAN DEFAULT false,

  created_at TIMESTAMPTZ DEFAULT now(),

  -- Ensure segments are ordered within project
  UNIQUE(project_id, segment_index)
);

-- ============================================
-- 3. FENCE GATES
-- ============================================
CREATE TABLE IF NOT EXISTS public.fence_gates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.fence_projects(id) ON DELETE CASCADE,

  -- Position (on which segment)
  segment_id UUID REFERENCES public.fence_segments(id) ON DELETE SET NULL,
  position_on_segment DECIMAL(3, 2) CHECK (position_on_segment >= 0 AND position_on_segment <= 1), -- 0.0 to 1.0

  -- Or absolute position if not on segment
  position_x DECIMAL(10, 4),
  position_y DECIMAL(10, 4),
  position_z DECIMAL(10, 4),

  -- Gate Properties
  gate_name TEXT, -- e.g., "Front Entry", "Side Gate"
  gate_type TEXT NOT NULL DEFAULT 'single-swing' CHECK (gate_type IN ('single-swing', 'double-swing', 'sliding', 'rolling')),

  -- Dimensions
  width_feet DECIMAL(5, 2) NOT NULL,
  width_inches INTEGER,
  height_feet DECIMAL(5, 2),
  height_inches INTEGER,

  -- Operation
  swing_direction TEXT CHECK (swing_direction IN ('inward', 'outward', 'left', 'right', 'bi-directional')),
  opens_to TEXT, -- 'yard', 'street', 'driveway', etc.

  -- Hardware & Features
  hardware_type TEXT, -- 'self-closing', 'standard', 'magnetic', 'hydraulic'
  lock_type TEXT, -- 'key', 'keypad', 'smart-lock', 'bolt', 'none'
  hinge_type TEXT,
  has_latch BOOLEAN DEFAULT true,
  has_spring BOOLEAN DEFAULT false,
  has_closer BOOLEAN DEFAULT false,

  -- Material
  material TEXT, -- 'wood', 'vinyl', 'aluminum', 'steel', 'composite'

  -- Special Requirements
  ada_compliant BOOLEAN DEFAULT false,
  fire_rated BOOLEAN DEFAULT false,

  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- 4. FENCE OBSTACLES
-- ============================================
CREATE TABLE IF NOT EXISTS public.fence_obstacles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.fence_projects(id) ON DELETE CASCADE,

  -- 3D Position
  position_x DECIMAL(10, 4) NOT NULL,
  position_y DECIMAL(10, 4) NOT NULL,
  position_z DECIMAL(10, 4) NOT NULL,

  -- Shape & Dimensions
  shape TEXT NOT NULL DEFAULT 'circle' CHECK (shape IN ('circle', 'rectangle', 'polygon', 'irregular')),

  -- For circle
  radius_feet DECIMAL(5, 2),

  -- For rectangle
  width_feet DECIMAL(5, 2),
  depth_feet DECIMAL(5, 2),

  -- For polygon (JSON array of points)
  polygon_points JSONB,

  -- Obstacle Type
  obstacle_type TEXT NOT NULL CHECK (obstacle_type IN (
    'tree', 'boulder', 'rock', 'stump',
    'utility-box', 'electric-meter', 'gas-meter', 'water-meter',
    'ac-unit', 'generator', 'propane-tank',
    'pool', 'hot-tub', 'pond', 'fountain',
    'deck', 'patio', 'shed', 'building',
    'slope', 'hill', 'ditch', 'creek',
    'driveway', 'sidewalk', 'path',
    'sprinkler-head', 'drain', 'vent',
    'custom'
  )),

  -- Details
  label TEXT NOT NULL, -- User-friendly name
  description TEXT,

  -- Impact on Installation
  requires_removal BOOLEAN DEFAULT false,
  requires_gate BOOLEAN DEFAULT false,
  requires_special_post BOOLEAN DEFAULT false,
  affects_fence_route BOOLEAN DEFAULT true,

  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- 5. FENCE PROJECT PHOTOS
-- ============================================
CREATE TABLE IF NOT EXISTS public.fence_project_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.fence_projects(id) ON DELETE CASCADE,

  -- Photo Type/Category
  photo_type TEXT NOT NULL CHECK (photo_type IN (
    'site-overview',     -- General site photos
    'measurement',       -- Photos taken during AR measurement
    'detail',           -- Close-up details
    'obstacle',         -- Photos of obstacles
    'gate-location',    -- Proposed gate locations
    'property-line',    -- Property boundaries
    'existing-fence',   -- Current fence (if any)
    'reference',        -- Reference points for calibration
    'annotation'        -- Photos with drawn annotations
  )),

  -- Storage Paths (Supabase Storage)
  storage_path TEXT NOT NULL, -- Full resolution
  thumbnail_path TEXT,         -- 300px thumbnail

  -- Photo Metadata
  caption TEXT,
  description TEXT,

  -- Location (where photo was taken)
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),

  -- Related to specific segment/gate/obstacle
  related_segment_id UUID REFERENCES public.fence_segments(id) ON DELETE SET NULL,
  related_gate_id UUID REFERENCES public.fence_gates(id) ON DELETE SET NULL,
  related_obstacle_id UUID REFERENCES public.fence_obstacles(id) ON DELETE SET NULL,

  -- Image Properties
  width_px INTEGER,
  height_px INTEGER,
  file_size_bytes INTEGER,
  mime_type TEXT DEFAULT 'image/jpeg',

  -- Timestamps
  taken_at TIMESTAMPTZ DEFAULT now(),
  uploaded_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),

  -- Order for display
  display_order INTEGER DEFAULT 0
);

-- ============================================
-- 6. FENCE DRAWINGS (Canvas data)
-- ============================================
CREATE TABLE IF NOT EXISTS public.fence_drawings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.fence_projects(id) ON DELETE CASCADE,

  -- Drawing Type
  drawing_type TEXT NOT NULL DEFAULT 'plan-view' CHECK (drawing_type IN (
    'plan-view',      -- Top-down site plan
    'elevation',      -- Side view
    'detail',         -- Detail drawing
    'annotation'      -- Annotated photo
  )),

  -- Canvas Data (Skia canvas state)
  canvas_data JSONB NOT NULL, -- {paths: [], shapes: [], text: [], etc.}

  -- Canvas Dimensions & Scale
  canvas_width INTEGER NOT NULL DEFAULT 1920,
  canvas_height INTEGER NOT NULL DEFAULT 1080,
  scale_factor DECIMAL(10, 4), -- pixels per foot (e.g., 20 = 1 inch = 20 pixels at 1 inch = 1 foot scale)
  scale_ratio TEXT, -- e.g., "1:50", "1/4 inch = 1 foot"

  -- Drawing Origin Point (for alignment)
  origin_x DECIMAL(10, 4) DEFAULT 0,
  origin_y DECIMAL(10, 4) DEFAULT 0,

  -- Rendering Output (cached image)
  rendered_image_path TEXT, -- PNG export from Skia canvas

  -- Metadata
  name TEXT,
  notes TEXT,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  -- Version control for canvas edits
  version INTEGER DEFAULT 1
);

-- ============================================
-- 7. FENCE PROJECT EXPORTS (PDFs, etc.)
-- ============================================
CREATE TABLE IF NOT EXISTS public.fence_project_exports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.fence_projects(id) ON DELETE CASCADE,

  -- Export Type
  export_type TEXT NOT NULL CHECK (export_type IN ('pdf', 'json', 'csv', 'dxf')),

  -- File Storage
  storage_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size_bytes INTEGER,
  mime_type TEXT,

  -- PDF-Specific Options
  num_pages INTEGER,
  includes_photos BOOLEAN DEFAULT true,
  includes_bom BOOLEAN DEFAULT false,
  includes_drawings BOOLEAN DEFAULT true,
  includes_measurements BOOLEAN DEFAULT true,

  -- Template Used
  template_name TEXT, -- e.g., "standard", "detailed", "presentation"
  branding_logo_path TEXT,

  -- Export Metadata
  exported_by UUID REFERENCES public.sales_reps(id),
  exported_at TIMESTAMPTZ DEFAULT now(),
  export_settings JSONB, -- Full export configuration

  -- Sharing & Distribution
  shared_via TEXT, -- 'email', 'text', 'airdrop', 'cloud', 'download'
  shared_at TIMESTAMPTZ,
  recipient_email TEXT,
  recipient_phone TEXT,

  -- Download tracking
  download_count INTEGER DEFAULT 0,
  last_downloaded_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- 8. FENCE STYLE PRESETS
-- ============================================
CREATE TABLE IF NOT EXISTS public.fence_style_presets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Preset Identification
  preset_name TEXT NOT NULL,
  preset_code TEXT UNIQUE, -- e.g., "BB-6FT-CEDAR"

  -- Fence Style
  style TEXT NOT NULL, -- 'board-on-board', 'privacy', etc.
  material TEXT, -- 'cedar', 'pine', 'vinyl', 'composite'

  -- Default Dimensions
  default_height_feet DECIMAL(4, 2),
  default_height_inches INTEGER,
  default_post_type TEXT,
  default_post_spacing_feet DECIMAL(4, 2) DEFAULT 8,

  -- Construction Details
  picket_width_inches DECIMAL(4, 2),
  picket_spacing_inches DECIMAL(4, 2),
  rail_count INTEGER,
  rail_type TEXT, -- '2x4', '2x6'
  cap_style TEXT, -- 'flat', 'dog-ear', 'gothic', 'french-gothic'

  -- Material Specifications
  wood_grade TEXT, -- 'select', '#1', '#2', 'utility'
  wood_treatment TEXT, -- 'pressure-treated', 'natural', 'stained'

  -- Pricing (optional)
  estimated_cost_per_linear_foot DECIMAL(10, 2),

  -- Company-wide vs User-specific
  is_global BOOLEAN DEFAULT true,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES public.sales_reps(id),

  -- Visual
  thumbnail_image_path TEXT,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================

-- Projects
CREATE INDEX IF NOT EXISTS idx_fence_projects_user ON public.fence_projects(created_by) WHERE deleted = false;
CREATE INDEX IF NOT EXISTS idx_fence_projects_status ON public.fence_projects(status) WHERE deleted = false;
CREATE INDEX IF NOT EXISTS idx_fence_projects_created ON public.fence_projects(created_at DESC) WHERE deleted = false;
CREATE INDEX IF NOT EXISTS idx_fence_projects_location ON public.fence_projects(latitude, longitude) WHERE deleted = false;
CREATE INDEX IF NOT EXISTS idx_fence_projects_sync ON public.fence_projects(synced, last_synced_at);

-- Segments
CREATE INDEX IF NOT EXISTS idx_fence_segments_project ON public.fence_segments(project_id, segment_index);
CREATE INDEX IF NOT EXISTS idx_fence_segments_confidence ON public.fence_segments(confidence_score);

-- Gates
CREATE INDEX IF NOT EXISTS idx_fence_gates_project ON public.fence_gates(project_id);
CREATE INDEX IF NOT EXISTS idx_fence_gates_segment ON public.fence_gates(segment_id);

-- Obstacles
CREATE INDEX IF NOT EXISTS idx_fence_obstacles_project ON public.fence_obstacles(project_id);
CREATE INDEX IF NOT EXISTS idx_fence_obstacles_type ON public.fence_obstacles(obstacle_type);

-- Photos
CREATE INDEX IF NOT EXISTS idx_fence_photos_project ON public.fence_project_photos(project_id, photo_type);
CREATE INDEX IF NOT EXISTS idx_fence_photos_segment ON public.fence_project_photos(related_segment_id) WHERE related_segment_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_fence_photos_order ON public.fence_project_photos(project_id, display_order);

-- Drawings
CREATE INDEX IF NOT EXISTS idx_fence_drawings_project ON public.fence_drawings(project_id, drawing_type);

-- Exports
CREATE INDEX IF NOT EXISTS idx_fence_exports_project ON public.fence_project_exports(project_id, export_type);
CREATE INDEX IF NOT EXISTS idx_fence_exports_user ON public.fence_project_exports(exported_by, exported_at DESC);

-- Presets
CREATE INDEX IF NOT EXISTS idx_fence_presets_active ON public.fence_style_presets(is_active, is_global);

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

ALTER TABLE public.fence_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fence_segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fence_gates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fence_obstacles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fence_project_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fence_drawings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fence_project_exports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fence_style_presets ENABLE ROW LEVEL SECURITY;

-- ============================================
-- RLS POLICIES
-- ============================================

-- Projects: Users can CRUD their own projects, managers/admins can see all
DROP POLICY IF EXISTS "Users can view their own fence projects" ON public.fence_projects;
CREATE POLICY "Users can view their own fence projects" ON public.fence_projects
  FOR SELECT
  USING (
    auth.uid() IN (SELECT id FROM public.sales_reps WHERE id = created_by)
    OR auth.uid() IN (SELECT id FROM public.sales_reps WHERE role IN ('sales-manager', 'admin'))
  );

DROP POLICY IF EXISTS "Users can create fence projects" ON public.fence_projects;
CREATE POLICY "Users can create fence projects" ON public.fence_projects
  FOR INSERT
  WITH CHECK (auth.uid() IN (SELECT id FROM public.sales_reps));

DROP POLICY IF EXISTS "Users can update their own fence projects" ON public.fence_projects;
CREATE POLICY "Users can update their own fence projects" ON public.fence_projects
  FOR UPDATE
  USING (
    auth.uid() IN (SELECT id FROM public.sales_reps WHERE id = created_by)
    OR auth.uid() IN (SELECT id FROM public.sales_reps WHERE role IN ('sales-manager', 'admin'))
  );

DROP POLICY IF EXISTS "Users can delete their own fence projects" ON public.fence_projects;
CREATE POLICY "Users can delete their own fence projects" ON public.fence_projects
  FOR DELETE
  USING (
    auth.uid() IN (SELECT id FROM public.sales_reps WHERE id = created_by)
    OR auth.uid() IN (SELECT id FROM public.sales_reps WHERE role IN ('sales-manager', 'admin'))
  );

-- Segments: Access follows project ownership
DROP POLICY IF EXISTS "Users can access segments in their projects" ON public.fence_segments;
CREATE POLICY "Users can access segments in their projects" ON public.fence_segments
  FOR ALL
  USING (
    project_id IN (
      SELECT id FROM public.fence_projects
      WHERE created_by = auth.uid()
      OR auth.uid() IN (SELECT id FROM public.sales_reps WHERE role IN ('sales-manager', 'admin'))
    )
  );

-- Gates: Access follows project ownership
DROP POLICY IF EXISTS "Users can access gates in their projects" ON public.fence_gates;
CREATE POLICY "Users can access gates in their projects" ON public.fence_gates
  FOR ALL
  USING (
    project_id IN (
      SELECT id FROM public.fence_projects
      WHERE created_by = auth.uid()
      OR auth.uid() IN (SELECT id FROM public.sales_reps WHERE role IN ('sales-manager', 'admin'))
    )
  );

-- Obstacles: Access follows project ownership
DROP POLICY IF EXISTS "Users can access obstacles in their projects" ON public.fence_obstacles;
CREATE POLICY "Users can access obstacles in their projects" ON public.fence_obstacles
  FOR ALL
  USING (
    project_id IN (
      SELECT id FROM public.fence_projects
      WHERE created_by = auth.uid()
      OR auth.uid() IN (SELECT id FROM public.sales_reps WHERE role IN ('sales-manager', 'admin'))
    )
  );

-- Photos: Access follows project ownership
DROP POLICY IF EXISTS "Users can access photos in their projects" ON public.fence_project_photos;
CREATE POLICY "Users can access photos in their projects" ON public.fence_project_photos
  FOR ALL
  USING (
    project_id IN (
      SELECT id FROM public.fence_projects
      WHERE created_by = auth.uid()
      OR auth.uid() IN (SELECT id FROM public.sales_reps WHERE role IN ('sales-manager', 'admin'))
    )
  );

-- Drawings: Access follows project ownership
DROP POLICY IF EXISTS "Users can access drawings in their projects" ON public.fence_drawings;
CREATE POLICY "Users can access drawings in their projects" ON public.fence_drawings
  FOR ALL
  USING (
    project_id IN (
      SELECT id FROM public.fence_projects
      WHERE created_by = auth.uid()
      OR auth.uid() IN (SELECT id FROM public.sales_reps WHERE role IN ('sales-manager', 'admin'))
    )
  );

-- Exports: Access follows project ownership
DROP POLICY IF EXISTS "Users can access exports in their projects" ON public.fence_project_exports;
CREATE POLICY "Users can access exports in their projects" ON public.fence_project_exports
  FOR ALL
  USING (
    project_id IN (
      SELECT id FROM public.fence_projects
      WHERE created_by = auth.uid()
      OR auth.uid() IN (SELECT id FROM public.sales_reps WHERE role IN ('sales-manager', 'admin'))
    )
  );

-- Presets: All authenticated users can read global presets
DROP POLICY IF EXISTS "Users can view fence style presets" ON public.fence_style_presets;
CREATE POLICY "Users can view fence style presets" ON public.fence_style_presets
  FOR SELECT
  USING (
    is_global = true
    OR created_by = auth.uid()
    OR auth.uid() IN (SELECT id FROM public.sales_reps WHERE role IN ('sales-manager', 'admin'))
  );

DROP POLICY IF EXISTS "Managers can manage fence style presets" ON public.fence_style_presets;
CREATE POLICY "Managers can manage fence style presets" ON public.fence_style_presets
  FOR ALL
  USING (auth.uid() IN (SELECT id FROM public.sales_reps WHERE role IN ('sales-manager', 'admin')));

-- ============================================
-- FUNCTIONS & TRIGGERS
-- ============================================

-- Update updated_at timestamp
CREATE OR REPLACE FUNCTION update_fence_project_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_fence_project_timestamp ON public.fence_projects;
CREATE TRIGGER trigger_update_fence_project_timestamp
  BEFORE UPDATE ON public.fence_projects
  FOR EACH ROW
  EXECUTE FUNCTION update_fence_project_updated_at();

-- Auto-generate project number
CREATE OR REPLACE FUNCTION generate_fence_project_number()
RETURNS TRIGGER AS $$
DECLARE
  year_part TEXT;
  sequence_num INTEGER;
  new_project_number TEXT;
BEGIN
  IF NEW.project_number IS NULL THEN
    year_part := TO_CHAR(now(), 'YYYY');

    -- Get the next sequence number for this year
    SELECT COALESCE(MAX(
      CAST(SUBSTRING(project_number FROM '\d+$') AS INTEGER)
    ), 0) + 1
    INTO sequence_num
    FROM public.fence_projects
    WHERE project_number LIKE 'FP-' || year_part || '-%';

    new_project_number := 'FP-' || year_part || '-' || LPAD(sequence_num::TEXT, 4, '0');
    NEW.project_number := new_project_number;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_generate_project_number ON public.fence_projects;
CREATE TRIGGER trigger_generate_project_number
  BEFORE INSERT ON public.fence_projects
  FOR EACH ROW
  EXECUTE FUNCTION generate_fence_project_number();

-- Update project summary when segments change
CREATE OR REPLACE FUNCTION update_fence_project_summary()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.fence_projects
  SET
    num_segments = (SELECT COUNT(*) FROM public.fence_segments WHERE project_id = COALESCE(NEW.project_id, OLD.project_id)),
    total_linear_feet = (SELECT COALESCE(SUM(length_feet), 0) FROM public.fence_segments WHERE project_id = COALESCE(NEW.project_id, OLD.project_id)),
    avg_confidence_score = (SELECT COALESCE(AVG(confidence_score), 0) FROM public.fence_segments WHERE project_id = COALESCE(NEW.project_id, OLD.project_id)),
    updated_at = now()
  WHERE id = COALESCE(NEW.project_id, OLD.project_id);

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_project_summary_insert ON public.fence_segments;
CREATE TRIGGER trigger_update_project_summary_insert
  AFTER INSERT ON public.fence_segments
  FOR EACH ROW
  EXECUTE FUNCTION update_fence_project_summary();

DROP TRIGGER IF EXISTS trigger_update_project_summary_update ON public.fence_segments;
CREATE TRIGGER trigger_update_project_summary_update
  AFTER UPDATE ON public.fence_segments
  FOR EACH ROW
  EXECUTE FUNCTION update_fence_project_summary();

DROP TRIGGER IF EXISTS trigger_update_project_summary_delete ON public.fence_segments;
CREATE TRIGGER trigger_update_project_summary_delete
  AFTER DELETE ON public.fence_segments
  FOR EACH ROW
  EXECUTE FUNCTION update_fence_project_summary();

-- Update gate count
CREATE OR REPLACE FUNCTION update_fence_gate_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.fence_projects
  SET
    num_gates = (SELECT COUNT(*) FROM public.fence_gates WHERE project_id = COALESCE(NEW.project_id, OLD.project_id)),
    updated_at = now()
  WHERE id = COALESCE(NEW.project_id, OLD.project_id);

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_gate_count_insert ON public.fence_gates;
CREATE TRIGGER trigger_update_gate_count_insert
  AFTER INSERT ON public.fence_gates
  FOR EACH ROW
  EXECUTE FUNCTION update_fence_gate_count();

DROP TRIGGER IF EXISTS trigger_update_gate_count_delete ON public.fence_gates;
CREATE TRIGGER trigger_update_gate_count_delete
  AFTER DELETE ON public.fence_gates
  FOR EACH ROW
  EXECUTE FUNCTION update_fence_gate_count();

-- Update obstacle count
CREATE OR REPLACE FUNCTION update_fence_obstacle_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.fence_projects
  SET
    num_obstacles = (SELECT COUNT(*) FROM public.fence_obstacles WHERE project_id = COALESCE(NEW.project_id, OLD.project_id)),
    updated_at = now()
  WHERE id = COALESCE(NEW.project_id, OLD.project_id);

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_obstacle_count_insert ON public.fence_obstacles;
CREATE TRIGGER trigger_update_obstacle_count_insert
  AFTER INSERT ON public.fence_obstacles
  FOR EACH ROW
  EXECUTE FUNCTION update_fence_obstacle_count();

DROP TRIGGER IF EXISTS trigger_update_obstacle_count_delete ON public.fence_obstacles;
CREATE TRIGGER trigger_update_obstacle_count_delete
  AFTER DELETE ON public.fence_obstacles
  FOR EACH ROW
  EXECUTE FUNCTION update_fence_obstacle_count();

-- ============================================
-- INSERT DEFAULT FENCE STYLE PRESETS
-- ============================================

INSERT INTO public.fence_style_presets (preset_name, preset_code, style, material, default_height_feet, default_height_inches, default_post_type, picket_width_inches, picket_spacing_inches, rail_count, cap_style, is_global)
VALUES
  ('6ft Board-on-Board Cedar', 'BB-6FT-CEDAR', 'board-on-board', 'cedar', 6.00, 72, '4x4', 6.0, 0.5, 3, 'dog-ear', true),
  ('6ft Privacy Fence Pine', 'PRIV-6FT-PINE', 'privacy', 'pine', 6.00, 72, '4x4', 6.0, 0.0, 3, 'flat', true),
  ('4ft Picket Fence White', 'PICKET-4FT-WHITE', 'picket', 'vinyl', 4.00, 48, 'vinyl', 3.5, 3.5, 2, 'gothic', true),
  ('8ft Privacy Vinyl', 'PRIV-8FT-VINYL', 'privacy', 'vinyl', 8.00, 96, 'vinyl', 6.0, 0.0, 3, 'flat', true),
  ('6ft Shadowbox Cedar', 'SHADOW-6FT-CEDAR', 'shadowbox', 'cedar', 6.00, 72, '4x4', 6.0, 2.0, 3, 'dog-ear', true)
ON CONFLICT (preset_code) DO NOTHING;

-- ============================================
-- STORAGE BUCKETS (Run separately in Supabase dashboard or via migration)
-- ============================================

-- Create storage buckets for fence project files
-- Run these commands in Supabase dashboard:
--
-- INSERT INTO storage.buckets (id, name, public) VALUES ('fence-photos', 'fence-photos', false);
-- INSERT INTO storage.buckets (id, name, public) VALUES ('fence-pdfs', 'fence-pdfs', false);
-- INSERT INTO storage.buckets (id, name, public) VALUES ('fence-drawings', 'fence-drawings', false);

-- Storage bucket policies (run in Supabase dashboard):
--
-- CREATE POLICY "Users can upload fence photos" ON storage.objects FOR INSERT
--   WITH CHECK (bucket_id = 'fence-photos' AND auth.role() = 'authenticated');
--
-- CREATE POLICY "Users can view fence photos" ON storage.objects FOR SELECT
--   USING (bucket_id = 'fence-photos' AND auth.role() = 'authenticated');

COMMENT ON TABLE public.fence_projects IS 'Main table for fence measurement projects created via mobile AR app';
COMMENT ON TABLE public.fence_segments IS 'Individual fence segments (polyline) with AR-measured coordinates';
COMMENT ON TABLE public.fence_gates IS 'Gate locations and specifications';
COMMENT ON TABLE public.fence_obstacles IS 'Obstacles detected or marked during measurement';
COMMENT ON TABLE public.fence_project_photos IS 'Photos attached to fence projects';
COMMENT ON TABLE public.fence_drawings IS 'Canvas drawings (Skia) for plan views and annotations';
COMMENT ON TABLE public.fence_project_exports IS 'Exported PDFs, JSON, and other formats';
COMMENT ON TABLE public.fence_style_presets IS 'Reusable fence style presets for quick entry';
