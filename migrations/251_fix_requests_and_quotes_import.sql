-- ============================================
-- MIGRATION 251: Fix Requests Table & Quotes Import
-- ============================================
-- Problems:
--   1. Requests table has partial unique index that doesn't work with PostgREST upsert
--   2. Requests table has RLS enabled but no policies (blocks all writes)
-- Fix: Create proper unique constraint and add RLS policies

-- ============================================
-- 1. FIX REQUESTS TABLE UNIQUE CONSTRAINT
-- ============================================

-- Drop the partial unique index
DROP INDEX IF EXISTS idx_res_requests_key;

-- Create a proper unique constraint (not partial)
-- First, ensure no nulls or duplicates
UPDATE jobber_residential_requests
SET request_key = 'orphan_' || id::TEXT
WHERE request_key IS NULL;

-- Add proper unique constraint
ALTER TABLE jobber_residential_requests
DROP CONSTRAINT IF EXISTS jobber_residential_requests_request_key_key;

ALTER TABLE jobber_residential_requests
ADD CONSTRAINT jobber_residential_requests_request_key_key UNIQUE (request_key);

-- ============================================
-- 2. ADD RLS POLICIES FOR REQUESTS TABLE
-- ============================================

-- Drop existing policies if any
DROP POLICY IF EXISTS "Allow authenticated read requests" ON jobber_residential_requests;
DROP POLICY IF EXISTS "Allow authenticated insert requests" ON jobber_residential_requests;
DROP POLICY IF EXISTS "Allow authenticated update requests" ON jobber_residential_requests;
DROP POLICY IF EXISTS "Allow authenticated delete requests" ON jobber_residential_requests;

-- Create policies for authenticated users
CREATE POLICY "Allow authenticated read requests"
ON jobber_residential_requests FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Allow authenticated insert requests"
ON jobber_residential_requests FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Allow authenticated update requests"
ON jobber_residential_requests FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Allow authenticated delete requests"
ON jobber_residential_requests FOR DELETE
TO authenticated
USING (true);

-- Also allow service role (for imports)
DROP POLICY IF EXISTS "Allow service role full access requests" ON jobber_residential_requests;
CREATE POLICY "Allow service role full access requests"
ON jobber_residential_requests FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- ============================================
-- 3. VERIFY QUOTES TABLE HAS PROPER POLICIES
-- ============================================

-- Add service role policy if missing
DROP POLICY IF EXISTS "Allow service role full access quotes" ON jobber_residential_quotes;
CREATE POLICY "Allow service role full access quotes"
ON jobber_residential_quotes FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- ============================================
-- VERIFICATION
-- ============================================
/*
-- Check constraints
SELECT conname, contype
FROM pg_constraint
WHERE conrelid = 'jobber_residential_requests'::regclass;

-- Check policies
SELECT policyname, cmd, roles
FROM pg_policies
WHERE tablename = 'jobber_residential_requests';
*/
