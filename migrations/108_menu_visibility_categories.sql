-- ============================================
-- Migration 108: Add categories to menu_visibility
-- ============================================
-- Enables dynamic navigation grouping instead of hardcoded arrays
-- Categories determine how items are grouped in mobile navigation

-- ============================================
-- 1. ADD CATEGORY AND SORT_ORDER COLUMNS
-- ============================================

ALTER TABLE menu_visibility
ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'tools';

ALTER TABLE menu_visibility
ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 100;

ALTER TABLE menu_visibility
ADD COLUMN IF NOT EXISTS mobile_style JSONB DEFAULT '{}';

-- ============================================
-- 2. UPDATE EXISTING ITEMS WITH CATEGORIES
-- ============================================

-- Main tools (shown prominently at top)
UPDATE menu_visibility SET category = 'main', sort_order = 10 WHERE menu_id = 'dashboard';
UPDATE menu_visibility SET category = 'main', sort_order = 20 WHERE menu_id = 'presentation';
UPDATE menu_visibility SET category = 'main', sort_order = 30 WHERE menu_id = 'sales-coach';
UPDATE menu_visibility SET category = 'main', sort_order = 40 WHERE menu_id = 'photo-gallery';
UPDATE menu_visibility SET category = 'main', sort_order = 50 WHERE menu_id = 'stain-calculator';

-- Communication
UPDATE menu_visibility SET category = 'communication', sort_order = 10 WHERE menu_id = 'team-communication';
UPDATE menu_visibility SET category = 'communication', sort_order = 20 WHERE menu_id = 'direct-messages';

-- Requests
UPDATE menu_visibility SET category = 'requests', sort_order = 10 WHERE menu_id = 'requests';
UPDATE menu_visibility SET category = 'requests', sort_order = 20 WHERE menu_id = 'my-requests';

-- Operations / Yard
UPDATE menu_visibility SET category = 'operations', sort_order = 10 WHERE menu_id = 'bom-calculator';
UPDATE menu_visibility SET category = 'operations', sort_order = 20 WHERE menu_id = 'bom-yard';

-- Admin / Leadership
UPDATE menu_visibility SET category = 'admin', sort_order = 10 WHERE menu_id = 'leadership';
UPDATE menu_visibility SET category = 'admin', sort_order = 20 WHERE menu_id = 'analytics';

-- Tools
UPDATE menu_visibility SET category = 'tools', sort_order = 10 WHERE menu_id = 'sales-resources';
UPDATE menu_visibility SET category = 'tools', sort_order = 20 WHERE menu_id = 'my-todos';
UPDATE menu_visibility SET category = 'tools', sort_order = 30 WHERE menu_id = 'roadmap';

-- System (always last)
UPDATE menu_visibility SET category = 'system', sort_order = 100 WHERE menu_id = 'team';

-- ============================================
-- 3. ADD MOBILE STYLING FOR EACH ITEM
-- ============================================
-- This moves the hardcoded styling from SalesRepView to database

UPDATE menu_visibility SET mobile_style = '{
  "gradient": "from-blue-600 to-blue-700",
  "iconBg": "bg-white/20",
  "description": "Show customers why we are #1"
}'::jsonb WHERE menu_id = 'presentation';

UPDATE menu_visibility SET mobile_style = '{
  "gradient": "from-purple-600 to-purple-700",
  "iconBg": "bg-white/20",
  "description": "Record & analyze meetings"
}'::jsonb WHERE menu_id = 'sales-coach';

UPDATE menu_visibility SET mobile_style = '{
  "bgColor": "bg-white border-2 border-gray-200",
  "iconBg": "bg-green-100",
  "iconColor": "text-green-600",
  "description": "Browse & capture job photos"
}'::jsonb WHERE menu_id = 'photo-gallery';

UPDATE menu_visibility SET mobile_style = '{
  "bgColor": "bg-white border-2 border-gray-200",
  "iconBg": "bg-orange-100",
  "iconColor": "text-orange-600",
  "description": "Show ROI vs DIY staining"
}'::jsonb WHERE menu_id = 'stain-calculator';

UPDATE menu_visibility SET mobile_style = '{
  "gradient": "from-blue-600 to-blue-700",
  "iconBg": "bg-white/20",
  "description": "Direct messages with team"
}'::jsonb WHERE menu_id = 'direct-messages';

UPDATE menu_visibility SET mobile_style = '{
  "gradient": "from-indigo-600 to-indigo-700",
  "iconBg": "bg-white/20",
  "description": "Team updates & announcements"
}'::jsonb WHERE menu_id = 'team-communication';

UPDATE menu_visibility SET mobile_style = '{
  "gradient": "from-green-600 to-green-700",
  "iconBg": "bg-white/20",
  "description": "Submit & track all requests"
}'::jsonb WHERE menu_id = 'requests';

UPDATE menu_visibility SET mobile_style = '{
  "bgColor": "bg-white border-2 border-gray-200",
  "iconBg": "bg-blue-100",
  "iconColor": "text-blue-600",
  "description": "Track your submitted requests"
}'::jsonb WHERE menu_id = 'my-requests';

UPDATE menu_visibility SET mobile_style = '{
  "gradient": "from-amber-600 to-amber-700",
  "iconBg": "bg-white/20",
  "description": "Manage pick lists & staging"
}'::jsonb WHERE menu_id = 'bom-yard';

UPDATE menu_visibility SET mobile_style = '{
  "bgColor": "bg-white border-2 border-gray-200",
  "iconBg": "bg-cyan-100",
  "iconColor": "text-cyan-600",
  "description": "Bill of materials calculator"
}'::jsonb WHERE menu_id = 'bom-calculator';

UPDATE menu_visibility SET mobile_style = '{
  "bgColor": "bg-white border border-gray-200",
  "iconBg": "bg-indigo-100",
  "iconColor": "text-indigo-600",
  "description": "Guides, catalogs & training"
}'::jsonb WHERE menu_id = 'sales-resources';

UPDATE menu_visibility SET mobile_style = '{
  "bgColor": "bg-white border-2 border-gray-200",
  "iconBg": "bg-purple-100",
  "iconColor": "text-purple-600",
  "description": "Your tasks and to-do items"
}'::jsonb WHERE menu_id = 'my-todos';

UPDATE menu_visibility SET mobile_style = '{
  "bgColor": "bg-white border border-gray-200",
  "iconBg": "bg-gray-100",
  "iconColor": "text-gray-600",
  "description": "App settings & preferences"
}'::jsonb WHERE menu_id = 'team';

UPDATE menu_visibility SET mobile_style = '{
  "bgColor": "bg-white border-2 border-gray-200",
  "iconBg": "bg-teal-100",
  "iconColor": "text-teal-600",
  "description": "View reports & metrics"
}'::jsonb WHERE menu_id = 'analytics';

UPDATE menu_visibility SET mobile_style = '{
  "gradient": "from-slate-700 to-slate-800",
  "iconBg": "bg-white/20",
  "description": "Goals, targets & team overview"
}'::jsonb WHERE menu_id = 'leadership';

UPDATE menu_visibility SET mobile_style = '{
  "gradient": "from-gray-700 to-gray-800",
  "iconBg": "bg-white/20",
  "description": "Overview & quick stats"
}'::jsonb WHERE menu_id = 'dashboard';

UPDATE menu_visibility SET mobile_style = '{
  "gradient": "from-indigo-600 to-purple-600",
  "iconBg": "bg-white/20",
  "description": "Feature ideas & development roadmap"
}'::jsonb WHERE menu_id = 'roadmap';

-- ============================================
-- 4. CREATE INDEX FOR CATEGORY ORDERING
-- ============================================

CREATE INDEX IF NOT EXISTS idx_menu_visibility_category_order
ON menu_visibility(category, sort_order);
