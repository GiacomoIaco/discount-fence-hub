-- ============================================
-- Migration 099: Fix Mobile Menu Visibility
-- ============================================
-- Fixes platform settings for mobile navigation

-- 1. AI Sales Coach and Pre-Stain Calculator should be available on both platforms
UPDATE menu_visibility
SET available_on = 'both', updated_at = NOW()
WHERE menu_id IN ('sales-coach', 'stain-calculator');

-- 2. My Requests should be desktop-only (mobile Requests hub already includes this functionality)
UPDATE menu_visibility
SET available_on = 'desktop', updated_at = NOW()
WHERE menu_id = 'my-requests';
