# Code Refactoring Opportunities Analysis
**Date:** October 27, 2025
**Status:** Comprehensive Analysis Complete

---

## 📊 Executive Summary

After completing the feature-based restructuring and documentation reorganization, several **high-impact refactoring opportunities** remain:

### **Priority Levels:**
- 🔴 **HIGH**: Move feature-specific code to features (better organization, clearer boundaries)
- 🟡 **MEDIUM**: Split large components (maintainability, readability)
- 🟢 **LOW**: Code cleanup (nice-to-have improvements)

### **Total Impact:**
- **~2,800 lines** of code could move to proper features
- **17 components** over 500 lines could be split
- **App.tsx** is 1,591 lines (could be reduced)

---

## 🔴 HIGH PRIORITY: Move Feature-Specific Code

### **1. Move lib Files to Features**

#### **lib/recordings.ts + recordings-db.ts → features/ai-coach/lib/**
- **Size:** 932 + 492 = 1,424 lines
- **Used by:** ONLY ai-coach feature (2 files)
  - `SalesCoach.tsx`
  - `SalesCoachAdmin.tsx`
- **Impact:** High - core business logic for AI Coach
- **Effort:** Low - only 2 imports to update
- **Benefits:**
  - ✅ AI Coach is fully self-contained
  - ✅ All recording logic co-located with feature
  - ✅ Easier to understand and maintain

#### **lib/requests.ts → features/requests/lib/**
- **Size:** 1,057 lines
- **Used by:** Mostly requests feature (6 files) + 1 cross-feature (AssignmentRules)
  - `MyRequestsView.tsx`
  - `RequestDetail.tsx`
  - `RequestForm.tsx`
  - `RequestList.tsx`
  - `RequestQueue.tsx`
  - `RequestHub.tsx`
  - ⚠️ **Cross-feature:** `settings/components/AssignmentRules.tsx`
- **Impact:** High - core business logic for requests
- **Effort:** Medium - 7 imports to update
- **Consideration:** AssignmentRules needs access - keep import from lib or export from feature
- **Recommendation:** Move to feature, export via index.ts for AssignmentRules to use

#### **lib/photos.ts → features/photos/lib/**
- **Size:** 240 lines
- **Used by:** ONLY photos feature (17 files)
- **Impact:** Medium - photo utilities
- **Effort:** Low - all within same feature
- **Benefits:**
  - ✅ Photos feature is fully self-contained
  - ✅ All photo logic in one place

#### **lib/fileHash.ts → features/photos/lib/**
- **Size:** 94 lines
- **Used by:** ONLY photos feature (2 files)
  - `BulkPhotoUpload.tsx`
  - `usePhotoUpload.ts`
- **Impact:** Low - duplicate detection utility
- **Effort:** Very Low - only 2 imports
- **Benefits:**
  - ✅ Hash logic stays with the feature that needs it

**Total Lines to Move:** 1,424 + 1,057 + 240 + 94 = **2,815 lines**

---

### **2. Move Hooks to Features**

#### **hooks/useAnalytics.ts → features/analytics/hooks/**
- **Size:** 336 lines (13K file size)
- **Used by:** ONLY analytics feature (4 files)
  - `Analytics.tsx`
  - `AnalyticsTabs.tsx`
  - `OverviewTab.tsx`
  - `RequestsTab.tsx`
- **Impact:** High - core analytics logic
- **Effort:** Low - all within same feature
- **Benefits:**
  - ✅ Analytics feature fully self-contained
  - ✅ Clear that it's not shared

#### **hooks/useRequests.ts → features/requests/hooks/**
- **Size:** 514 lines (14K file size)
- **Used by:** Mostly requests feature (5 files) + 1 cross-feature (AssignmentRules)
  - `MyRequestsView.tsx`
  - `RequestDetail.tsx`
  - `RequestForm.tsx`
  - `RequestList.tsx`
  - `RequestQueue.tsx`
  - ⚠️ **Cross-feature:** `settings/components/AssignmentRules.tsx`
- **Impact:** High - request utilities
- **Effort:** Medium - 6 imports to update
- **Recommendation:** Move to feature, export via index.ts

#### **hooks/queries/useRequestsQuery.ts → features/requests/hooks/**
- **Size:** 250 lines (8K file size)
- **Used by:** ONLY requests feature (5 files)
- **Impact:** Medium - React Query hooks for requests
- **Effort:** Low - all within same feature
- **Benefits:**
  - ✅ All request data fetching in one place

**Total:** ~1,100 lines of hooks to move

---

## 🟡 MEDIUM PRIORITY: Split Large Components

### **Components Over 1,000 Lines:**

| File | Lines | Feature | Potential Splits |
|------|-------|---------|------------------|
| `App.tsx` | 1,591 | Root | Extract routing, mobile/desktop layouts |
| `RequestDetail.tsx` | 1,299 | Requests | Extract sidebar, activity timeline, metadata section |
| `AnnouncementsView.tsx` | 1,260 | Communication | Extract announcement card, filters, form modal |
| `SalesCoach.tsx` | 1,146 | AI Coach | Extract recording controls, leaderboard, analysis display |
| `SalesResources.tsx` | 1,031 | Sales Resources | Extract folder grid, file list, upload modal |

### **Components 700-1000 Lines:**

| File | Lines | Feature | Potential Splits |
|------|-------|---------|------------------|
| `TeamCommunication.tsx` | 905 | Communication | Extract tabs logic |
| `StainCalculator.tsx` | 787 | Sales Tools | Extract results display, settings panel |
| `RequestForm.tsx` | 782 | Requests | Extract voice recording section, form fields |
| `RequestList.tsx` | 728 | Requests | Extract filters, list item component |

### **Components 500-700 Lines:**

| File | Lines | Feature | Potential Splits |
|------|-------|---------|------------------|
| `BOMCalculator.tsx` | 662 | BOM Calculator | Extract SKU selection, results panel |
| `SalesCoachAdmin.tsx` | 661 | AI Coach | Extract process editor, knowledge base editor |
| `PhotoGalleryRefactored.tsx` | 655 | Photos | Extract grid view, filters panel |
| `MessageComposer.tsx` | 651 | Communication | Extract file attachments, recipient selector |
| `DirectMessages.tsx` | 578 | Communication | Extract message list, conversation header |
| `PhotoReviewQueue.tsx` | 548 | Photos | Extract review card, batch actions |
| `TeamManagement.tsx` | 535 | Settings | Extract user row, invite modal |
| `PresentationUpload.tsx` | 528 | Sales Tools | Extract preview, slide extractor |
| `BulkPhotoUpload.tsx` | 519 | Photos | Extract file selector, upload progress |

**Total:** 17 components over 500 lines

---

## 🟢 LOW PRIORITY: Code Cleanup

### **1. Remove FEATURE_TEMPLATE from src/**
- **Location:** `src/features/FEATURE_TEMPLATE/`
- **Status:** Template directory in production code
- **Action:** Move to `docs/templates/feature-template/`
- **Effort:** 5 minutes
- **Impact:** Cleaner src/ directory

### **2. Consolidate Toast Usage**
- **Current:** 104 toast calls across features
- **Opportunity:** Some features might benefit from custom error handling wrappers
- **Effort:** Low - optional improvement
- **Impact:** Low - already working well

### **3. TODO Comments**
- **Count:** Let me check
- **Action:** Review and address or document

### **4. Unused Imports**
- **Tool:** Could run ESLint with unused imports rule
- **Action:** Auto-fix with linter
- **Effort:** 10 minutes
- **Impact:** Slightly smaller bundle

---

## 📋 Recommended Action Plan

### **Phase 1: Move Feature-Specific Code** (Highest ROI)

**Time Estimate:** 2-3 hours
**Files to Move:** 6 lib files + 3 hooks = 9 files
**Lines Relocated:** ~3,900 lines

```bash
# 1. AI Coach (1,424 lines)
lib/recordings.ts → features/ai-coach/lib/
lib/recordings-db.ts → features/ai-coach/lib/

# 2. Photos (334 lines)
lib/photos.ts → features/photos/lib/
lib/fileHash.ts → features/photos/lib/

# 3. Requests (1,057 lines + 514 lines)
lib/requests.ts → features/requests/lib/
hooks/useRequests.ts → features/requests/hooks/

# 4. Analytics (336 lines)
hooks/useAnalytics.ts → features/analytics/hooks/

# 5. Queries (250 lines)
hooks/queries/useRequestsQuery.ts → features/requests/hooks/
```

**Benefits:**
- ✅ Features are truly self-contained
- ✅ lib/ directory only has shared utilities
- ✅ Clear ownership of code
- ✅ Easier to find related code

**Risks:**
- ⚠️ Need to handle cross-feature dependencies (AssignmentRules uses requests)
- ⚠️ Import paths change (but TypeScript catches errors)

---

### **Phase 2: App.tsx Refactoring** (Medium ROI)

**Time Estimate:** 2-4 hours
**Current:** 1,591 lines in single file
**Target:** <500 lines in App.tsx

**Potential Splits:**

```typescript
// Extract routing logic
src/routing/
  ├── AppRoutes.tsx          // Route definitions
  ├── Navigation.tsx         // Navigation menu component
  └── MobileNavigation.tsx   // Mobile-specific nav

// Extract layout components
src/layouts/
  ├── DesktopLayout.tsx      // Desktop view wrapper
  ├── MobileLayout.tsx       // Mobile view wrapper
  └── Sidebar.tsx            // Reusable sidebar

// Simplified App.tsx
- Lazy loading imports (keep)
- Route provider setup (keep)
- Context providers (keep)
- Call AppRoutes component (new)
```

**Benefits:**
- ✅ Easier to understand App structure
- ✅ Reusable layout components
- ✅ Simpler testing of routing logic

---

### **Phase 3: Split Large Components** (Lower ROI, Higher Effort)

**Time Estimate:** 1-2 hours per component
**Priority Order:**
1. RequestDetail (1,299 lines) - Most used, complex
2. AnnouncementsView (1,260 lines) - Communication critical
3. SalesCoach (1,146 lines) - Core feature

**Approach:**
- Extract reusable sub-components
- Move sections into components/ subdirectory
- Keep main component as coordinator

---

### **Phase 4: Cleanup** (Quick Wins)

**Time Estimate:** 30 minutes
**Actions:**
1. Move FEATURE_TEMPLATE to docs/
2. Run ESLint --fix for unused imports
3. Review TODO comments

---

## 💡 Recommendation

**Start with Phase 1** (Move Feature-Specific Code):
- ✅ **Highest impact** - better organization
- ✅ **Lowest risk** - TypeScript catches all errors
- ✅ **Quick wins** - 2-3 hours for complete reorganization
- ✅ **Foundation** for future work

**Then consider Phase 2** (App.tsx refactoring):
- Depends on if App.tsx complexity is causing issues
- Nice-to-have but not critical

**Phase 3 and 4 are optional** based on development needs.

---

## 🚀 Implementation Notes

### **For Moving Files:**

```bash
# Use git mv to preserve history
git mv src/lib/recordings.ts src/features/ai-coach/lib/
git mv src/lib/recordings-db.ts src/features/ai-coach/lib/

# Update imports in affected files
# TypeScript will show errors for files that need updates

# Update feature index.ts if needed for exports
```

### **Testing Strategy:**
1. Move files using git mv
2. Run TypeScript compiler - fix all errors
3. Run build - ensure no runtime errors
4. Manual smoke test of affected features
5. Commit and push

---

**End of Analysis**
