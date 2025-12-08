# Roadmap Items

*Generated: 2025-12-08T02:47:10.058Z*

**Total items:** 45

**By status:** idea(21), wont_do(2), done(18), approved(3), in_progress(1)

---

## Analytics (A)

### A-001: Seasonal Pattern Analysis

- **Status:** idea | **Complexity:** M | **Importance:** ★★★☆☆
- **Description:** Identify seasonal trends in fence installations, pricing, demand. Needs more historical data.

### A-004: Scheduled Automated Reports

- **Status:** idea | **Complexity:** L | **Importance:** ★★★☆☆
- **Description:** Auto-generate and email reports on schedule (daily/weekly/monthly)

### A-003: Export to Excel/PDF

- **Status:** idea | **Complexity:** M | **Importance:** ★★★☆☆
- **Description:** Export analytics charts and data to Excel or PDF format for reporting

### A-002: Year-over-Year Comparisons

- **Status:** idea | **Complexity:** M | **Importance:** ★★★☆☆
- **Description:** Compare metrics across years. Needs more historical data to be useful.

## chat

### C-001: Message Reactions

- **Status:** idea | **Complexity:** S | **Importance:** ★★☆☆☆
- **Description:** Allow users to react to messages with emojis

### C-002: Message Threading

- **Status:** idea | **Complexity:** M | **Importance:** ★★☆☆☆
- **Description:** Reply to specific messages in a thread format

### C-003: Read Receipts

- **Status:** wont_do | **Complexity:** S | **Importance:** ★★☆☆☆
- **Description:** Show who has read messages in group chats

## Future Vision (F)

### F-001: Customer Portal

- **Status:** wont_do | **Complexity:** XL | **Importance:** ★★★☆☆
- **Description:** Self-service portal for customers to view invoices, schedule appointments, track project status, and communicate with their sales rep

## General (G)

### G-002: Toast Notifications

- **Status:** done | **Complexity:** M | **Importance:** ★★★★★
- **Description:** Replaced 88 alert() calls with react-hot-toast, 4 toast types: Success, Error, Warning, Info

### G-001: Error Boundaries

- **Status:** done | **Complexity:** S | **Importance:** ★★★★★
- **Description:** ErrorBoundary component with professional error UI, try again and go home recovery, collapsible error details

### G-003: Loading Skeletons

- **Status:** done | **Complexity:** S | **Importance:** ★★★☆☆
- **Description:** 5 skeleton components: RequestList, PhotoGallery, UserProfile, AnalyticsChart, base Skeleton

### G-004: PWA Icons

- **Status:** done | **Complexity:** S | **Importance:** ★★★☆☆
- **Description:** favicon.ico, apple-touch-icon.png, manifest icons 192x192 and 512x512

### G-006: Roadmap UI Improvements - Status Management, View Persistence, and Mobile UX

- **Status:** idea | **Complexity:** L | **Importance:** ★★★★☆
- **Description:** The roadmap UI needs several improvements across desktop and mobile. On desktop: (1) The 'Done' status shouldn't be in the regular status dropdown since it's essentially archived - it should be a separate button/filter since users typically want to see what's NOT done. (2) The app should remember the last view state (hub selection, status filter) when returning to the page. (3) Card alignment is still broken - descriptions are attaching to the left side instead of spreading right properly like before. On mobile: filters and search should be collapsible/hideable, and the top UI needs better layout to show app name and status counts without overlapping.

Also, the modal of each card is too small, i need to expand manually the window just to read...I think it should be way wider and probably divide in 2 section (left raw description, right Claude analysis)!. It is not obvious where user can add additional thoughts once he/she goes back and review the original idea decription and the analysis from Claude...There should a way to almost chat addition in the bottom and submit that to Claude to incorporate in his analysis...maybe too mych!
- **AI Analysis:** This feedback identifies critical UX issues in the roadmap interface that impact daily workflow efficiency.

**Implementation Approach:**

1. **Done Status Separation (Desktop):**
   - Move 'Done' out of the standard status filter dropdown
   - Implement as a toggle button (e.g., 'Show Completed' checkbox or 'Include Done' toggle)
   - Default state should be OFF (hiding done items)
   - Consider a collapsed 'Done' section at bottom of list as alternative
   - Store preference in user settings or session storage

2. **View State Persistence:**
   - Implement state management to track: current hub, active filters, status selection, sort order
   - Options: URL query parameters (shareable, back-button friendly) or localStorage (cleaner URLs)
   - Recommendation: Hybrid approach - use URL params for main filters, localStorage for UI preferences
   - Ensure state rehydration on page load
   - Consider debouncing state saves to avoid performance issues

3. **Card Layout/Alignment Fix:**
   - Debug CSS flexbox/grid issues causing left-alignment
   - Ensure description text allows proper width expansion
   - Test with various content lengths and screen sizes
   - May need to review changes that moved description from right to left attachment point

4. **Mobile Filter Improvements:**
   - Implement collapsible filter panel (accordion or slide-out drawer)
   - Add header with app name and status count summary
   - Fix z-index and positioning issues causing overlap
   - Consider sticky header with collapse/expand icon
   - Ensure touch targets are adequate (44x44px minimum)

**Best Practices:**
- Use CSS transitions for smooth collapse/expand animations
- Implement proper ARIA labels for accessibility
- Test with real content across breakpoints
- Consider adding user onboarding tooltip for new 'Done' filter location

**Considerations:**
- Breaking change: Users accustomed to current Done status location may need communication
- State persistence: Define TTL for saved preferences
- Performance: Ensure view state doesn't cause re-render loops
- Edge cases: What happens when shared URL has 'done' filter with user preference to hide?

**Suggested Priority Order:**
1. Card alignment fix (affects readability now)
2. Done status separation (workflow improvement)
3. View state persistence (quality of life)
4. Mobile filter improvements (platform-specific)

### G-005: Role-Based Dashboards

- **Status:** idea | **Complexity:** L | **Importance:** ★★★☆☆
- **Description:** Different home screens for Sales, Operations, Sales Manager, Admin with role-specific widgets and quick actions

## ops-hub

### O-019: Price Book System

- **Status:** approved | **Complexity:** XL | **Importance:** ★★★★★
- **Description:** Multiple pricing tiers (Retail, Builder, Commercial), Markup methods, Price book management, Customer assignment

### O-022: Fix QR Code Deep Linking on Printable Pick Lists

- **Status:** approved | **Complexity:** M | **Importance:** ★★★★☆
- **Description:** The printable pick list in the Ops app includes a QR code, but when scanned with a phone camera, it only opens the app generically instead of deep linking to the specific pick list or project. This was identified as a problem before but wasn't fully resolved. The QR code should take users directly to the relevant pick list or project page, not just the app home screen.
- **AI Analysis:** This is a deep linking issue that significantly impacts the utility of the QR code feature. Currently, the QR code appears to contain a basic app URL rather than a properly formatted deep link with context parameters.

**Implementation Approach:**
- Update QR code generation to include deep link parameters (pick list ID, project ID)
- Implement proper URL scheme handling (e.g., `yourapp://picklist/{id}` or universal links)
- Add routing logic in the app to parse incoming URLs and navigate to the correct screen
- Test both iOS and Android camera app scanning and in-app QR scanning

**Technical Considerations:**
- Universal Links (iOS) and App Links (Android) are preferred over custom URL schemes for better security and fallback handling
- Deep link URLs should include authentication tokens or session validation
- Consider what happens if the user isn't logged in when scanning the QR code
- Handle edge cases: deleted pick lists, expired projects, permission issues

**Best Practices:**
- Log deep link events for analytics and debugging
- Implement graceful fallback if the specific resource isn't found (show error, redirect to project list)
- Add loading states while the app resolves the deep link
- Test with multiple QR code scanning methods (native camera, third-party apps)

**Testing Requirements:**
- Verify QR codes persist correct data after printing
- Test deep linking from locked/unlocked phone states
- Confirm behavior for users with different permission levels
- Validate that the original bug fix attempt is fully replaced/overwritten

### O-020: ServiceTitan Export

- **Status:** approved | **Complexity:** L | **Importance:** ★★★★☆
- **Description:** Export BOM/BOL to ServiceTitan format, Template management, Validation, Export history

### O-001: Foundation & Formula Corrections

- **Status:** done | **Complexity:** L | **Importance:** ★★★★★
- **Description:** Fix Picket Waste Factor, Math.ceil() for Cap/Trim, Nailer formula, Gate Post Logic, W05 Labor Code, Rot Board, Steel Post Hardware, Nail calculations

### O-003: Component System & Configurator

- **Status:** done | **Complexity:** L | **Importance:** ★★★★★
- **Description:** Component system tables, Component Configurator page, Fence-type-specific config, Attribute-based filtering, Material dropdowns use configured rules

### O-009: Claim Workflow Improvements

- **Status:** done | **Complexity:** M | **Importance:** ★★★★☆
- **Description:** Paper-first workflow, Enter project code or scan QR, Claim/Release functionality, Show claimed status on Desktop, Assign Worker from Desktop

### O-005: Stocking Areas (Yard Locations)

- **Status:** done | **Complexity:** L | **Importance:** ★★★★☆
- **Description:** yard_areas table, yard_slots table, material_locations, YardAreasPage with 3-column layout, Pick list views by Category or Location

### O-006: Mobile Yard Access

- **Status:** done | **Complexity:** M | **Importance:** ★★★★☆
- **Description:** Yard user role, auto-redirect to BOM Hub, QR code on pick list links to project, Mobile-first yard interface

### O-007: Interactive Pick List

- **Status:** done | **Complexity:** M | **Importance:** ★★★★☆
- **Description:** Pick list view in app, Tap to mark items picked, Large checkboxes, Progress indicator, 3-dot menu, Pick progress persistence

### O-008: Staging Prioritization

- **Status:** done | **Complexity:** M | **Importance:** ★★★★☆
- **Description:** Staging target date calculation (pickup - 2 business days), Urgency badges (OVERDUE/TODAY/TOMORROW/FUTURE), Urgency filter buttons, Auto-sort by urgency

### O-004: Yard Workflow Core

- **Status:** done | **Complexity:** XL | **Importance:** ★★★★☆
- **Description:** yard_spots table, project_code field, project_signoffs, status_history, YardSchedulePage, YardSpotsPage, PickListPDF, CrewSignoffModal, YardMobilePage

### O-002: Price History & Analytics Dashboard

- **Status:** done | **Complexity:** M | **Importance:** ★★★★☆
- **Description:** Price history tables, Analytics dashboard page, PriceHistoryModal, Track material and labor price changes over time

### O-010: Yard Operations Analytics

- **Status:** done | **Complexity:** M | **Importance:** ★★★☆☆
- **Description:** Worker leaderboard, Daily/weekly staging volume, Average time metrics, Stale projects alert, Yard performance comparison

### O-021: QuickBooks Online Integration

- **Status:** idea | **Complexity:** XL | **Importance:** ★★★★☆
- **Description:** Sync products with QBO, Pull costs from QBO, Price change management, Reconciliation

### O-016: Damage/Shortage Reporting

- **Status:** idea | **Complexity:** M | **Importance:** ★★★★☆
- **Description:** Report damaged or missing materials with photo capture

### O-014: Sort by Pick Sequence

- **Status:** idea | **Complexity:** M | **Importance:** ★★★☆☆
- **Description:** Optimize pick list order based on yard layout for faster picking

### O-017: Yard Notifications

- **Status:** idea | **Complexity:** M | **Importance:** ★★★☆☆
- **Description:** Alert yard when new project scheduled, daily summary of upcoming pickups

### O-015: Calendar View of Pickups

- **Status:** idea | **Complexity:** M | **Importance:** ★★★☆☆
- **Description:** Visual calendar showing scheduled pickups by date

### O-013: Partial Pickup Support

- **Status:** idea | **Complexity:** M | **Importance:** ★★★☆☆
- **Description:** Allow partial pickups with notes explaining what was taken

### O-018: Stale Projects Banner

- **Status:** idea | **Complexity:** S | **Importance:** ★★★☆☆
- **Description:** Banner on Pick Lists page for projects 3+ days in yard

### O-011: High Contrast Mode for Outdoor Use

- **Status:** idea | **Complexity:** S | **Importance:** ★★☆☆☆
- **Description:** Increase contrast for outdoor visibility on tablets/phones in bright sunlight

### O-012: Sound Feedback for Pick States

- **Status:** idea | **Complexity:** S | **Importance:** ★★☆☆☆
- **Description:** Audio feedback when items picked or errors occur

## Requests (R)

### R-004: Email Notifications

- **Status:** done | **Complexity:** L | **Importance:** ★★★★☆
- **Description:** Assignment notifications, Status change notifications, Comment/note notifications via Supabase edge functions

### R-001: Filter by Assignee

- **Status:** done | **Complexity:** S | **Importance:** ★★★★☆
- **Description:** Add dropdown filter to Operations Queue to filter requests by assigned person

### R-003: Assignment Rules UI

- **Status:** done | **Complexity:** M | **Importance:** ★★★★☆
- **Description:** Admin UI to configure auto-assignment rules. Backend exists, needs visual rule builder

### R-002: Filter by Requestor/Submitter

- **Status:** done | **Complexity:** S | **Importance:** ★★★☆☆
- **Description:** Add dropdown filter to find requests from specific submitters

### R-005: Bulk Operations

- **Status:** idea | **Complexity:** M | **Importance:** ★★★☆☆
- **Description:** Bulk assign, bulk stage change, bulk archive, checkbox selection UI

### R-006: Enhanced Request Detail View

- **Status:** idea | **Complexity:** M | **Importance:** ★★☆☆☆
- **Description:** Submitter name/photo in header, submitted_at timestamp, full assignment history, photo gallery, download all photos

## settings

### S-001: Permissions System with Power Levels

- **Status:** idea | **Complexity:** L | **Importance:** ★★★★☆
- **Description:** Separate visibility from authorization. Add power_level to roles so Head of Ops has same menu as Ops but higher permissions. Replace hardcoded admin checks with power level checks.

### S-002: Dynamic User Types

- **Status:** idea | **Complexity:** L | **Importance:** ★★★☆☆
- **Description:** Add User Type button to create new roles dynamically. Manage permissions from Menu Visibility. Currently roles are hardcoded in TypeScript.

### S-003: Roadmap Hub

- **Status:** in_progress | **Complexity:** M | **Importance:** ★★★★☆
- **Description:** In-app roadmap viewer with hub-prefixed codes (O-XXX, R-XXX), status workflow, Claude integration for expanding ideas

