-- Migration: 091_fix_yard_tables_rls.sql
-- Description: Fix RLS policies for all yard-related tables
-- Ensures authenticated users can manage yard areas, slots, and locations

-- ============================================
-- 1. DROP EXISTING POLICIES (if they exist)
-- ============================================

-- yard_areas policies
DROP POLICY IF EXISTS "Allow authenticated read yard_areas" ON yard_areas;
DROP POLICY IF EXISTS "Allow authenticated manage yard_areas" ON yard_areas;

-- yard_slots policies
DROP POLICY IF EXISTS "Allow authenticated read yard_slots" ON yard_slots;
DROP POLICY IF EXISTS "Allow authenticated manage yard_slots" ON yard_slots;

-- material_locations policies
DROP POLICY IF EXISTS "Allow authenticated read material_locations" ON material_locations;
DROP POLICY IF EXISTS "Allow authenticated manage material_locations" ON material_locations;

-- ============================================
-- 2. ENABLE RLS (idempotent)
-- ============================================

ALTER TABLE yard_areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE yard_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE material_locations ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 3. CREATE POLICIES FOR yard_areas
-- ============================================

CREATE POLICY "yard_areas_select"
ON yard_areas FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "yard_areas_insert"
ON yard_areas FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "yard_areas_update"
ON yard_areas FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "yard_areas_delete"
ON yard_areas FOR DELETE
TO authenticated
USING (true);

-- ============================================
-- 4. CREATE POLICIES FOR yard_slots
-- ============================================

CREATE POLICY "yard_slots_select"
ON yard_slots FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "yard_slots_insert"
ON yard_slots FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "yard_slots_update"
ON yard_slots FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "yard_slots_delete"
ON yard_slots FOR DELETE
TO authenticated
USING (true);

-- ============================================
-- 5. CREATE POLICIES FOR material_locations
-- ============================================

CREATE POLICY "material_locations_select"
ON material_locations FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "material_locations_insert"
ON material_locations FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "material_locations_update"
ON material_locations FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "material_locations_delete"
ON material_locations FOR DELETE
TO authenticated
USING (true);
