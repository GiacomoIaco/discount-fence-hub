-- ============================================
-- Migration 105: Seed Roadmap Items
-- ============================================
-- Populates roadmap_items from existing markdown roadmaps
-- Consolidates ideas from 3 files into single source of truth

-- First, set the sequences to start at appropriate numbers
-- (we'll manually set codes for initial items, then let auto-generation take over)

-- ============================================
-- OPS HUB ITEMS (O-XXX)
-- From: docs/BOM_CALCULATOR_HUB_ROADMAP.md
-- ============================================

-- Completed items
INSERT INTO roadmap_items (code, hub, title, raw_idea, status, importance, complexity, completed_at) VALUES
('O-001', 'ops-hub', 'Foundation & Formula Corrections', 'Fix Picket Waste Factor, Math.ceil() for Cap/Trim, Nailer formula, Gate Post Logic, W05 Labor Code, Rot Board, Steel Post Hardware, Nail calculations', 'done', 5, 'L', '2024-12-04'),
('O-002', 'ops-hub', 'Price History & Analytics Dashboard', 'Price history tables, Analytics dashboard page, PriceHistoryModal, Track material and labor price changes over time', 'done', 4, 'M', '2024-12-04'),
('O-003', 'ops-hub', 'Component System & Configurator', 'Component system tables, Component Configurator page, Fence-type-specific config, Attribute-based filtering, Material dropdowns use configured rules', 'done', 5, 'L', '2024-12-05'),
('O-004', 'ops-hub', 'Yard Workflow Core', 'yard_spots table, project_code field, project_signoffs, status_history, YardSchedulePage, YardSpotsPage, PickListPDF, CrewSignoffModal, YardMobilePage', 'done', 5, 'XL', '2024-12-05'),
('O-005', 'ops-hub', 'Stocking Areas (Yard Locations)', 'yard_areas table, yard_slots table, material_locations, YardAreasPage with 3-column layout, Pick list views by Category or Location', 'done', 4, 'L', '2024-12-05'),
('O-006', 'ops-hub', 'Mobile Yard Access', 'Yard user role, auto-redirect to BOM Hub, QR code on pick list links to project, Mobile-first yard interface', 'done', 4, 'M', '2024-12-06'),
('O-007', 'ops-hub', 'Interactive Pick List', 'Pick list view in app, Tap to mark items picked, Large checkboxes, Progress indicator, 3-dot menu, Pick progress persistence', 'done', 4, 'M', '2024-12-06'),
('O-008', 'ops-hub', 'Staging Prioritization', 'Staging target date calculation (pickup - 2 business days), Urgency badges (OVERDUE/TODAY/TOMORROW/FUTURE), Urgency filter buttons, Auto-sort by urgency', 'done', 4, 'M', '2024-12-06'),
('O-009', 'ops-hub', 'Claim Workflow Improvements', 'Paper-first workflow, Enter project code or scan QR, Claim/Release functionality, Show claimed status on Desktop, Assign Worker from Desktop', 'done', 4, 'M', '2024-12-06'),
('O-010', 'ops-hub', 'Yard Operations Analytics', 'Worker leaderboard, Daily/weekly staging volume, Average time metrics, Stale projects alert, Yard performance comparison', 'done', 3, 'M', '2024-12-06');

-- In Progress / Planned items
INSERT INTO roadmap_items (code, hub, title, raw_idea, status, importance, complexity) VALUES
('O-011', 'ops-hub', 'High Contrast Mode for Outdoor Use', 'Increase contrast for outdoor visibility on tablets/phones in bright sunlight', 'idea', 2, 'S'),
('O-012', 'ops-hub', 'Sound Feedback for Pick States', 'Audio feedback when items picked or errors occur', 'idea', 2, 'S'),
('O-013', 'ops-hub', 'Partial Pickup Support', 'Allow partial pickups with notes explaining what was taken', 'idea', 3, 'M'),
('O-014', 'ops-hub', 'Sort by Pick Sequence', 'Optimize pick list order based on yard layout for faster picking', 'idea', 3, 'M'),
('O-015', 'ops-hub', 'Calendar View of Pickups', 'Visual calendar showing scheduled pickups by date', 'idea', 3, 'M'),
('O-016', 'ops-hub', 'Damage/Shortage Reporting', 'Report damaged or missing materials with photo capture', 'idea', 4, 'M'),
('O-017', 'ops-hub', 'Yard Notifications', 'Alert yard when new project scheduled, daily summary of upcoming pickups', 'idea', 3, 'M'),
('O-018', 'ops-hub', 'Stale Projects Banner', 'Banner on Pick Lists page for projects 3+ days in yard', 'idea', 3, 'S'),
('O-019', 'ops-hub', 'Price Book System', 'Multiple pricing tiers (Retail, Builder, Commercial), Markup methods, Price book management, Customer assignment', 'approved', 5, 'XL'),
('O-020', 'ops-hub', 'ServiceTitan Export', 'Export BOM/BOL to ServiceTitan format, Template management, Validation, Export history', 'approved', 4, 'L'),
('O-021', 'ops-hub', 'QuickBooks Online Integration', 'Sync products with QBO, Pull costs from QBO, Price change management, Reconciliation', 'idea', 4, 'XL');

-- ============================================
-- REQUESTS ITEMS (R-XXX)
-- From: docs/development/ROADMAP.md
-- ============================================

INSERT INTO roadmap_items (code, hub, title, raw_idea, status, importance, complexity) VALUES
('R-001', 'requests', 'Filter by Assignee', 'Add dropdown filter to Operations Queue to filter requests by assigned person', 'idea', 4, 'S'),
('R-002', 'requests', 'Filter by Requestor/Submitter', 'Add dropdown filter to find requests from specific submitters', 'idea', 3, 'S'),
('R-003', 'requests', 'Assignment Rules UI', 'Admin UI to configure auto-assignment rules. Backend exists, needs visual rule builder', 'idea', 4, 'M'),
('R-004', 'requests', 'Email Notifications', 'Assignment notifications, Status change notifications, Comment/note notifications via Supabase edge functions', 'idea', 4, 'L'),
('R-005', 'requests', 'Bulk Operations', 'Bulk assign, bulk stage change, bulk archive, checkbox selection UI', 'idea', 3, 'M'),
('R-006', 'requests', 'Enhanced Request Detail View', 'Submitter name/photo in header, submitted_at timestamp, full assignment history, photo gallery, download all photos', 'idea', 2, 'M');

-- ============================================
-- GENERAL/APP-WIDE ITEMS (G-XXX)
-- From: docs/development/DEVELOPMENT_ROADMAP.md
-- ============================================

INSERT INTO roadmap_items (code, hub, title, raw_idea, status, importance, complexity, completed_at) VALUES
('G-001', 'general', 'Error Boundaries', 'ErrorBoundary component with professional error UI, try again & go home recovery, collapsible error details', 'done', 5, 'S', '2024-11-01'),
('G-002', 'general', 'Toast Notifications', 'Replaced 88 alert() calls with react-hot-toast, 4 toast types: Success, Error, Warning, Info', 'done', 5, 'M', '2024-11-01'),
('G-003', 'general', 'Loading Skeletons', '5 skeleton components: RequestList, PhotoGallery, UserProfile, AnalyticsChart, base Skeleton', 'done', 3, 'S', '2024-11-01'),
('G-004', 'general', 'PWA Icons', 'favicon.ico, apple-touch-icon.png, manifest icons 192x192 and 512x512', 'done', 3, 'S', '2024-11-01');

INSERT INTO roadmap_items (code, hub, title, raw_idea, status, importance, complexity) VALUES
('G-005', 'general', 'Role-Based Dashboards', 'Different home screens for Sales, Operations, Sales Manager, Admin with role-specific widgets and quick actions', 'idea', 4, 'L');

-- ============================================
-- SETTINGS ITEMS (S-XXX)
-- New ideas from recent discussions
-- ============================================

INSERT INTO roadmap_items (code, hub, title, raw_idea, status, importance, complexity) VALUES
('S-001', 'settings', 'Permissions System with Power Levels', 'Separate visibility from authorization. Add power_level to roles so Head of Ops has same menu as Ops but higher permissions. Replace hardcoded admin checks with power level checks.', 'idea', 4, 'L'),
('S-002', 'settings', 'Dynamic User Types', 'Add User Type button to create new roles dynamically. Manage permissions from Menu Visibility. Currently roles are hardcoded in TypeScript.', 'idea', 3, 'L'),
('S-003', 'settings', 'Roadmap Hub', 'In-app roadmap viewer with hub-prefixed codes (O-XXX, R-XXX), status workflow, Claude integration for expanding ideas', 'in_progress', 4, 'M');

-- ============================================
-- ANALYTICS ITEMS (A-XXX)
-- ============================================

INSERT INTO roadmap_items (code, hub, title, raw_idea, status, importance, complexity) VALUES
('A-001', 'analytics', 'Seasonal Pattern Analysis', 'Identify seasonal trends in fence installations, pricing, demand. Needs more historical data.', 'idea', 3, 'M'),
('A-002', 'analytics', 'Year-over-Year Comparisons', 'Compare metrics across years. Needs more historical data to be useful.', 'idea', 3, 'M'),
('A-003', 'analytics', 'Export to Excel/PDF', 'Export analytics charts and data to Excel or PDF format for reporting', 'idea', 3, 'M'),
('A-004', 'analytics', 'Scheduled Automated Reports', 'Auto-generate and email reports on schedule (daily/weekly/monthly)', 'idea', 3, 'L');

-- ============================================
-- CHAT ITEMS (C-XXX)
-- ============================================

INSERT INTO roadmap_items (code, hub, title, raw_idea, status, importance, complexity) VALUES
('C-001', 'chat', 'Message Reactions', 'Allow users to react to messages with emojis', 'idea', 2, 'S'),
('C-002', 'chat', 'Message Threading', 'Reply to specific messages in a thread format', 'idea', 2, 'M'),
('C-003', 'chat', 'Read Receipts', 'Show who has read messages in group chats', 'idea', 2, 'S');

-- ============================================
-- UPDATE SEQUENCES TO CONTINUE FROM MAX
-- ============================================

SELECT setval('roadmap_seq_ops', (SELECT COALESCE(MAX(SUBSTRING(code FROM 3)::INTEGER), 0) FROM roadmap_items WHERE hub = 'ops-hub'));
SELECT setval('roadmap_seq_requests', (SELECT COALESCE(MAX(SUBSTRING(code FROM 3)::INTEGER), 0) FROM roadmap_items WHERE hub = 'requests'));
SELECT setval('roadmap_seq_general', (SELECT COALESCE(MAX(SUBSTRING(code FROM 3)::INTEGER), 0) FROM roadmap_items WHERE hub = 'general'));
SELECT setval('roadmap_seq_settings', (SELECT COALESCE(MAX(SUBSTRING(code FROM 3)::INTEGER), 0) FROM roadmap_items WHERE hub = 'settings'));
SELECT setval('roadmap_seq_analytics', (SELECT COALESCE(MAX(SUBSTRING(code FROM 3)::INTEGER), 0) FROM roadmap_items WHERE hub = 'analytics'));
SELECT setval('roadmap_seq_chat', (SELECT COALESCE(MAX(SUBSTRING(code FROM 3)::INTEGER), 0) FROM roadmap_items WHERE hub = 'chat'));
SELECT setval('roadmap_seq_leadership', 0);
