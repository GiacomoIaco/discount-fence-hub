# BOM Calculator HUB - Roadmap (Phases 0-7)

**Created:** December 5, 2024
**Last Updated:** December 6, 2024
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
| Phase 3 | Yard Workflow (Core) | Completed | Dec 5, 2024 |
| Phase 3.1 | Yard Workflow Enhancements | In Progress | - |
| Phase 3.2 | Bug Fixes & Improvements | In Progress | - |
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

### Phase 3: Yard Workflow (Core)
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

## In Progress Phases

### Phase 3.1: Yard Workflow Enhancements
**Status:** In Progress

#### 3.1.1 Stocking Areas (Physical Warehouse Locations)
- [x] Create `yard_areas` table (physical sections of the warehouse)
  - area_code, area_name, color_hex, color_name
  - User-defined areas with custom names and colors
- [x] Create `yard_slots` table (bins/spots within areas)
  - Numbered slots (#1, #2, etc.) or custom names
- [x] Create `material_locations` table (SKU assignments)
  - Assign SKUs to specific area/slot combinations
  - v_material_locations view for easy lookup
- [x] Create YardAreasPage with 3-column layout (like Component Configurator)
  - Left: Areas list with add/edit/delete
  - Middle: Selected area details, slots, assigned materials
  - Right: Material browser to search and assign SKUs
- [x] Two pick list views: by Category | by Stocking Area
- [x] Color backgrounds on category headers based on area

#### 3.1.2 Mobile Yard Access
- [x] Add "yard" user role (Dec 6, 2024)
  - Yard users auto-redirect to BOM Calculator on login
  - BOM Hub auto-opens Mobile View for yard role
  - Yard role treated as 'operations' for permissions
- [x] For yard users: mobile app shows only Yard section (Dec 6, 2024)
- [x] QR code on printed pick list links directly to project (Dec 6, 2024)
  - Scan QR → App opens → Auto-fills project code → Claim modal appears
- [ ] Bypass desktop-only restriction for Yard pages
- [ ] High contrast mode for outdoor use
- [ ] Sound feedback for picked/error states

#### 3.1.3 Interactive Pick List in App
- [x] Pick list view in app (not just PDF)
  - PickListViewer component with modal display
  - Category view and Location view toggle
- [x] Tap to mark items as picked/staged
  - Click-to-toggle checkboxes on each item
  - Visual strike-through for picked items
- [x] Large checkboxes for touch interaction
- [x] Progress indicator (X of Y items picked)
  - Progress bar at bottom of viewer
- [x] 3-dot menu fixed with dropdown options
  - View, Print, Sign-off, Copy Project Code
- [x] Pick progress persistence (Dec 6, 2024)
  - pick_progress table tracks checked items
  - Progress saved to database automatically
  - Can continue where you left off
- [ ] Partial pickup support with notes

#### 3.1.4 Staging Prioritization (NEW - Dec 6, 2024)
- [x] Staging target date calculation (migration 094)
  - Auto-calculated as pickup date - 2 business days
  - Skips weekends (Sat/Sun)
  - Editable by operations if needed
- [x] Urgency badges in Mobile View
  - 🔴 OVERDUE - Past staging target date
  - 🟠 TODAY - Stage today
  - 🟡 TOMORROW - Stage tomorrow
  - 🟢 FUTURE - 2+ days out
- [x] Urgency filter buttons
  - All | Urgent | Stage Today | Tomorrow
- [x] Auto-sort by urgency (overdue first)
- [x] Color-coded cards (red/orange ring for urgent)
- [x] Job date shown on urgent item banners

#### 3.1.5 Claim Workflow Improvements (NEW - Dec 6, 2024)
- [x] Paper-first workflow support
  - Enter project code manually or scan QR
  - Claim confirmation modal with project details
- [x] Claim/Release functionality
  - claim_project() and release_project() RPC functions
  - "Picking" status when claimed
  - Reverts to "Sent to Yard" when released
- [x] Show claimed status on Desktop Pick Lists
  - Picker name and progress displayed
  - "Picking" status in Quick Stats
- [x] Assign Worker from Desktop Pick Lists (Dec 6, 2024)
  - Dropdown to assign yard workers to jobs
  - Available for sent_to_yard and picking status

#### 3.1.6 Additional Yard Features (Future)
- [ ] Sort by pick sequence (optimized for yard layout)
- [ ] Calendar view of scheduled pickups
- [ ] Damage/shortage reporting with photo capture
- [ ] Notifications (alert yard when project scheduled)
- [ ] Daily summary of upcoming pickups
- [ ] Stale projects banner on Pick Lists page (3+ days in yard)

### Phase 3.2: Bug Fixes & Improvements
**Status:** In Progress

#### 3.2.1 Custom SKUs
- [x] Add custom_products query to SKU Catalog
- [x] Custom filter option in category dropdown
- [x] Purple badge for Custom category
- [x] Fix Custom SKU labor cost/ft not loading in Catalog - VERIFIED WORKING
- [x] Add Custom SKUs to Calculator product selection - VERIFIED WORKING
  - Purple "CU" badge in SKU search dropdown
  - Calculation based on unit_basis (LF, SF, EA, PROJECT)
  - Materials and labor calculated correctly

#### 3.2.2 Projects Management
- [x] Status change (Ready → Sent to Yard) - VERIFIED WORKING
- [x] Test project save in Calculator - VERIFIED WORKING (no error found)
- [x] Add Archive projects feature
- [x] Add "Show Archived" toggle to view archived projects

#### 3.2.3 SKU Builder
- [x] New SKUs appearing in catalog - VERIFIED WORKING

---

## Planned Phases

### Phase 4: Advanced Analytics
**Status:** Planned
**Detailed Plan:** See [PHASE_4_ANALYTICS_PLAN.md](./PHASE_4_ANALYTICS_PLAN.md)

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

#### 4.8 Yard Operations Analytics (NEW)
- [ ] Worker leaderboard (orders staged by person)
- [ ] Daily/weekly staging volume charts
- [ ] Average time metrics (staged→loaded, loaded→complete)
- [ ] Stale projects alert (3+ business days in yard)
- [ ] Yard performance comparison by location

---

### Phase 5: Price Book
**Status:** Planned

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

### Phase 6: ServiceTitan Export
**Status:** Planned

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

### Phase 7: QuickBooks Online Integration
**Status:** Planned

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
| 1 | Phase 3.2: Bug Fixes | Low | High | None |
| 2 | Phase 3.1: Yard Enhancements | Medium | High | Phase 3 |
| 3 | Phase 5: Price Book | Medium | High | None |
| 4 | Phase 6: ST Export | Low-Medium | High | None |
| 5 | Phase 4: Advanced Analytics | Medium | Medium | Price History (done) |
| 6 | Phase 7: QBO Integration | High | Medium | QBO API access |

---

## Notes & Decisions

### December 5, 2024
- Created roadmap document
- Phase 3 (Yard Workflow): Deferred Material Availability Check and Crew Assignment to future phases (require Inventory and Crew Management systems)
- Removed OCR for signature extraction (crew signs with scribble, name entered manually)
- Three yards confirmed: ATX, SA, HOU (mapped to existing Business Units)
- Added Phase 3.1 for Yard Enhancements (stocking areas, mobile access, interactive pick list)
- Added Phase 3.2 for Bug Fixes (custom SKUs, project archive, save errors)

---

## Change Log

| Date | Change | Author |
|------|--------|--------|
| Dec 6, 2024 | Added 3.1.4 Staging Prioritization - urgency badges, filters, auto-sort | Claude |
| Dec 6, 2024 | Added 3.1.5 Claim Workflow Improvements - QR code, assign worker | Claude |
| Dec 6, 2024 | Completed 3.1.2 Mobile Yard Access - yard role, QR code | Claude |
| Dec 6, 2024 | Added pick progress persistence (3.1.3) | Claude |
| Dec 5, 2024 | Added Phase 3.1 (Yard Enhancements) and Phase 3.2 (Bug Fixes) | Claude |
| Dec 5, 2024 | Completed Phase 3 (Yard Workflow Core) | Claude |
| Dec 5, 2024 | Created roadmap document | Claude |
| Dec 5, 2024 | Completed Phase 2 | Claude |
| Dec 4, 2024 | Completed Phase 0, 1 | Claude |
