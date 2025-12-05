# BOM Calculator HUB - Roadmap (Phases 0-7)

**Created:** December 5, 2024
**Last Updated:** December 5, 2024
**Status:** Active Development

---

## Overview

This document tracks the implementation phases for the BOM Calculator HUB feature. Each phase builds on the previous to create a comprehensive materials and labor management system for Discount Fence USA.

---

## Phase Summary

| Phase | Name | Status | Completed |
|-------|------|--------|-----------|
| Phase 0 | Foundation & Formula Corrections | Completed | Dec 4, 2024 |
| Phase 1 | Price History & Analytics Dashboard | Completed | Dec 4, 2024 |
| Phase 2 | Component System & Configurator | Completed | Dec 5, 2024 |
| Phase 3 | Yard Workflow | Completed | Dec 5, 2024 |
| Phase 4 | Advanced Analytics | Planned | - |
| Phase 5 | Price Book | Planned | - |
| Phase 6 | ServiceTitan Export | Planned | - |
| Phase 7 | QuickBooks Online Integration | Planned | - |

---

## Completed Phases

### Phase 0: Foundation & Formula Corrections
**Completed:** December 4, 2024

- [x] Fix Picket Waste Factor for Good Neighbor (1.11 instead of 1.10)
- [x] Add Math.ceil() to Cap/Trim calculations
- [x] Fix Nailer formula for Wood Horizontal
- [x] Gate Post Logic (Calculator only)
- [x] W05 Labor Code for additional rails
- [x] Rot Board calculation
- [x] Steel Post Hardware (brackets, screws, post caps)
- [x] Nail calculations (picket nails, frame nails)
- [x] Wood Horizontal enhancements (top nailer, vertical trim)

### Phase 1: Price History & Analytics Dashboard
**Completed:** December 4, 2024

- [x] Price history tables (migration 078)
- [x] Analytics dashboard page
- [x] PriceHistoryModal component
- [x] Track material price changes over time
- [x] Track labor rate changes over time

### Phase 2: Component System & Configurator
**Completed:** December 5, 2024

- [x] Component system tables (migration 079)
- [x] Component Configurator page
- [x] Fence-type-specific component configuration
- [x] Attribute-based filtering (e.g., post_type for posts)
- [x] v_component_eligible_materials view
- [x] v_fence_type_components view
- [x] Integrate Component Configurator into SKU Builder
- [x] All material dropdowns use configured rules with fallback
- [x] Rot Board dropdown for Wood Vertical

### Phase 3: Yard Workflow
**Completed:** December 5, 2024

- [x] Database migration (085_yard_workflow.sql)
  - yard_spots table with default 5 spots per yard
  - project_code field (ABC-123 format) with auto-generation
  - project_signoffs table for crew sign-off photos
  - project_status_history for audit trail
  - Views: v_yard_schedule, v_pick_list
- [x] Yard section in BOM Hub sidebar
- [x] YardSchedulePage (Pick Lists)
  - Filter by yard, date, status
  - Search by project code, name, customer
  - Status workflow: To Stage → Staged → Loaded → Complete
  - Spot assignment when staging
- [x] YardSpotsPage
  - Manage spots per yard
  - Add/edit/remove spots
  - View occupancy status
- [x] PickListPDF generator
  - 3-copy PDF with large project code
  - Materials grouped by category (2-column for 10+ items)
  - QR code, signature line, partial pickup checkbox
- [x] CrewSignoffModal
  - Camera capture or file upload
  - GPS location capture
  - Partial pickup checkbox with notes
  - Photo uploaded to Supabase storage
- [x] YardMobilePage
  - Tablet-friendly simplified UI
  - Large touch targets
  - Auto-refresh every 30 seconds
  - Quick actions: Print, Sign-off, Stage, Mark Loaded

---

## Planned Phases

### Phase 4: Advanced Analytics
**Status:** Planned

### Overview
Comprehensive analytics dashboard with multiple tabs for deep insights into materials, labor, projects, and business performance.

### Core Features

#### 4.1 Pick List Management (Legacy - Moved to Phase 3)
- [x] View BOM without costs/labor for scheduled projects
- [x] Filter by date (today, tomorrow, date range)
- [x] Filter by yard location (ATX, SA, HOU)
- [ ] Sort by pick sequence (optimized for yard layout)
- [ ] Search by project name, customer, or project ID

#### 3.2 Print Pick List
- [ ] Generate 1-page pick list PDF
- [ ] Print 3 identical copies
- [ ] Include: Project info, materials, quantities, QR code
- [ ] QR code links to digital version for quick lookup
- [ ] Organized by material category for efficient picking

#### 3.3 Status Tracking
- [ ] Status workflow: To Be Staged → Staged → Loaded
- [ ] Additional statuses: Partially Loaded, Issue
- [ ] "Issue" status includes notes field for problems
- [ ] Status change history with timestamps
- [ ] Color-coded status indicators

#### 3.4 Crew Sign-off (Photo Capture)
- [ ] Capture photo of signed pick list
- [ ] Auto-capture metadata: date, time, user, GPS
- [ ] Store crew name (text input, not OCR)
- [ ] Photo stored in Supabase storage
- [ ] View sign-off history for any project

#### 3.5 Yard Spot Management
- [ ] Define staging spots per yard
- [ ] Assign project/bundle to spot
- [ ] Visual yard map showing spot assignments
- [ ] View all spots and their current status
- [ ] Clear spot when project is loaded

### Additional Features (Phase 3)

#### 3.6 Schedule Dashboard
- [ ] Calendar view of scheduled pickups
- [ ] Color-coded by status
- [ ] Filter by yard, date range, status
- [ ] Quick stats: projects due today, staged, loaded

#### 3.7 Mobile-First "Yard" Role
- [ ] New user role: "yard"
- [ ] Simplified UI for tablet/outdoor use
- [ ] Large touch targets, high contrast
- [ ] Offline capability (sync when connected)
- [ ] QR/barcode scanner for quick lookup

#### 3.8 Notifications
- [ ] Alert yard when new project scheduled
- [ ] Alert operations when project loaded
- [ ] Daily summary of upcoming pickups

#### 3.9 Damage/Shortage Reporting
- [ ] Report damaged materials during staging
- [ ] Report shortages
- [ ] Photo capture of issues
- [ ] Auto-notify purchasing (future)

### Deferred to Future Phase
- Material Availability Check (requires Inventory system)
- Crew Assignment (requires Crew Management system)

### Database Changes (Planned)
```sql
-- Yard spots table
CREATE TABLE yard_spots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  yard_id UUID REFERENCES business_units(id),
  spot_code TEXT NOT NULL,
  spot_name TEXT,
  spot_type TEXT, -- 'staging', 'loading', 'storage'
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Project yard status tracking
CREATE TABLE project_yard_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES bom_projects(id),
  yard_id UUID REFERENCES business_units(id),
  status TEXT NOT NULL, -- 'to_be_staged', 'staged', 'loaded', 'partially_loaded', 'issue'
  spot_id UUID REFERENCES yard_spots(id),
  scheduled_date DATE,
  status_changed_at TIMESTAMPTZ DEFAULT now(),
  status_changed_by UUID REFERENCES auth.users(id),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Crew sign-off records
CREATE TABLE project_signoffs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES bom_projects(id),
  crew_name TEXT NOT NULL,
  signed_at TIMESTAMPTZ DEFAULT now(),
  photo_url TEXT,
  photo_path TEXT,
  gps_latitude DECIMAL,
  gps_longitude DECIMAL,
  uploaded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Status change history
CREATE TABLE project_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES bom_projects(id),
  old_status TEXT,
  new_status TEXT NOT NULL,
  changed_by UUID REFERENCES auth.users(id),
  changed_at TIMESTAMPTZ DEFAULT now(),
  notes TEXT
);
```

---

## Phase 4: Advanced Analytics
**Status:** Planned

### Overview
Comprehensive analytics dashboard with multiple tabs for deep insights into materials, labor, projects, and business performance.

### Tabs

#### 4.1 Material Price History
- [ ] Recent cost changes table
- [ ] Visual chart: 12-week price trends
- [ ] Filter by: Top SKUs, category, subcategory
- [ ] Top Movers (biggest price changes)
- [ ] Price alerts (notify when >X% change)
- [ ] Cost impact calculator

#### 4.2 Labor Price History
- [ ] Rate changes over time by labor code
- [ ] Compare rates across Business Units
- [ ] Track rate change requests

#### 4.3 Projects/Bundles Analytics
- [ ] Projects by status
- [ ] Stats by user/estimator
- [ ] Profitability analysis
- [ ] Avg cost/ft by fence type over time

#### 4.4 SKU Performance
- [ ] Most used SKUs
- [ ] SKU cost trends
- [ ] Margin contribution analysis
- [ ] Slow-moving SKUs identification

#### 4.5 Business Unit Comparison
- [ ] Material costs by BU
- [ ] Labor costs by BU
- [ ] Cost/ft benchmarking
- [ ] Avg project size by BU

#### 4.6 Trend Analysis
- [ ] Seasonal patterns
- [ ] Year-over-year comparisons
- [ ] Cost forecasting

#### 4.7 Export & Scheduling
- [ ] Export to Excel/PDF
- [ ] Scheduled automated reports
- [ ] Custom date ranges

---

## Phase 5: Price Book
**Status:** Planned

### Overview
Multiple pricing tiers for SKUs based on customer type, enabling margin visibility and consistent pricing.

### Features

#### 5.1 Price Book Tiers
- [ ] Retail (standard markup)
- [ ] Home Builder (volume discount)
- [ ] Commercial (negotiated rates)
- [ ] Custom (per-client pricing)

#### 5.2 Pricing Methods
- [ ] Markup on Cost (auto-updates with cost changes)
- [ ] Fixed Price (manual)
- [ ] Formula-based (cost × multiplier + fee)

#### 5.3 Price Book Management
- [ ] Clone price books
- [ ] Bulk price updates
- [ ] Effective date scheduling
- [ ] Price comparison across tiers

#### 5.4 Customer Assignment
- [ ] Assign customers to tiers
- [ ] Customer-specific overrides
- [ ] Discount tracking

#### 5.5 Calculator Integration
- [ ] Select price book when creating project
- [ ] Show cost and sell price in BOM
- [ ] Margin calculation per project

---

## Phase 6: ServiceTitan Export
**Status:** Planned

### Overview
Generate Excel files matching ServiceTitan import template for seamless data transfer.

### Features

#### 6.1 Template Management
- [ ] Store ST import template structure
- [ ] Field mapping configuration
- [ ] Handle ST-specific formatting

#### 6.2 Export Options
- [ ] Single project export
- [ ] Batch export
- [ ] BOM only, BOL only, or both

#### 6.3 Validation
- [ ] Pre-export validation
- [ ] Required fields check
- [ ] Issue warnings

#### 6.4 History & Tracking
- [ ] Export history log
- [ ] Prevent duplicate exports
- [ ] Track ST Job IDs

---

## Phase 7: QuickBooks Online Integration
**Status:** Planned

### Overview
Sync material prices from QBO to maintain accurate, up-to-date costs.

### Features

#### 7.1 Product Sync
- [ ] Map materials to QBO products
- [ ] Pull latest costs from QBO
- [ ] Scheduled sync (daily/weekly)

#### 7.2 Price Change Management
- [ ] Review pending changes
- [ ] Approve/reject workflow
- [ ] Price change history

#### 7.3 Reconciliation
- [ ] Identify unmapped items
- [ ] Suggest mappings
- [ ] Sync status dashboard

#### 7.4 Audit Trail
- [ ] Log all price changes
- [ ] Track approvals
- [ ] Rollback capability

---

## Implementation Priority

| Priority | Phase | Complexity | Business Value | Dependencies |
|----------|-------|------------|----------------|--------------|
| 1 | Phase 3: Yard Workflow | High | High | None |
| 2 | Phase 5: Price Book | Medium | High | None |
| 3 | Phase 6: ST Export | Low-Medium | High | None |
| 4 | Phase 4: Advanced Analytics | Medium | Medium | Price History (done) |
| 5 | Phase 7: QBO Integration | High | Medium | QBO API access |

---

## Notes & Decisions

### December 5, 2024
- Created roadmap document
- Phase 3 (Yard Workflow): Deferred Material Availability Check and Crew Assignment to future phases (require Inventory and Crew Management systems)
- Removed OCR for signature extraction (crew signs with scribble, name entered manually)
- Three yards confirmed: ATX, SA, HOU (mapped to existing Business Units)

---

## Change Log

| Date | Change | Author |
|------|--------|--------|
| Dec 5, 2024 | Created roadmap document | Claude |
| Dec 5, 2024 | Completed Phase 2 | Claude |
| Dec 4, 2024 | Completed Phase 0, 1 | Claude |
