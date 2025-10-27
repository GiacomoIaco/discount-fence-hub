# App Restructuring Plan
## Current State Analysis & Refactoring Roadmap

**Date:** 2025-10-27
**Goal:** Migrate from monolithic `src/components/` to feature-based `src/features/` architecture

---

## 🎯 Why Restructure?

**Benefits:**
- ✅ Better code organization
- ✅ Easier to find related code
- ✅ Clearer boundaries between features
- ✅ Easier to test in isolation
- ✅ Simpler imports and dependencies
- ✅ Scalable for team growth

---

## 📊 Current Structure Assessment

### ✅ **Already Refactored (Good!)**

```
src/features/
  ├── photos/              ✅ DONE - Well structured
  │   ├── PhotoGalleryRefactored.tsx
  │   ├── hooks/
  │   ├── components/
  │   ├── types/
  │   └── index.ts
  │
  └── bom_calculator/      ✅ DONE - Well structured
      ├── BOMCalculator.tsx
      ├── hooks/
      ├── components/
      └── database/
```

### ❌ **Dead Code to DELETE**

```
src/components/
  ├── PhotoGallery.tsx              ❌ DELETE (2,696 lines! Old version)
  └── PhotoGalleryWithBulkUpload.tsx ❌ DELETE (Unused wrapper)
```

### 🔄 **Needs Restructuring (54 total components)**

#### **Photo Components** → Move to `features/photos/`
```
src/components/
  ├── BulkPhotoUpload.tsx           → features/photos/components/
  ├── PhotoAnalytics.tsx            → features/photos/components/
  └── PhotoReviewQueue.tsx          → features/photos/components/
```

#### **Survey Feature** → Create `features/surveys/`
```
src/components/
  ├── SimpleSurveyBuilder.tsx       → features/surveys/
  ├── SurveyRenderer.tsx            → features/surveys/components/
  ├── SurveyResponse.tsx            → features/surveys/components/
  └── SurveyResults.tsx             → features/surveys/components/
```

#### **Team/Communication Feature** → Create `features/team/`
```
src/components/
  ├── TeamCommunication.tsx         → features/team/
  ├── TeamManagement.tsx            → features/team/
  ├── DirectMessages.tsx            → features/team/components/
  ├── MessageComposer.tsx           → features/team/components/
  └── AnnouncementsView.tsx         → features/team/components/
```

#### **Analytics Feature** → Create `features/analytics/`
```
src/components/
  └── Analytics.tsx                 → features/analytics/
```

#### **User Profile Feature** → Create `features/user-profile/`
```
src/components/
  ├── UserProfileEditor.tsx         → features/user-profile/
  ├── UserProfileView.tsx           → features/user-profile/
  └── ProfilePictureUpload.tsx      → features/user-profile/components/
```

#### **Sales Resources Feature** → Create `features/sales-resources/`
```
src/components/
  └── SalesResources.tsx            → features/sales-resources/
```

#### **Settings Feature** → Create `features/settings/`
```
src/components/
  ├── Settings.tsx                  → features/settings/
  └── MenuVisibilitySettings.tsx    → features/settings/components/
```

#### **Keep in components/ (Truly Shared)**
```
src/components/
  ├── shared/                       ✅ Keep - Reusable UI components
  ├── skeletons/                    ✅ Keep - Loading states
  ├── ErrorBoundary.tsx             ✅ Keep - Global error handling
  ├── CustomToast.tsx               ✅ Keep - Global notifications
  ├── InstallAppBanner.tsx          ✅ Keep - PWA feature
  └── PWAUpdatePrompt.tsx           ✅ Keep - PWA feature
```

---

## 🗂️ Target Structure

```
src/
├── features/
│   ├── photos/                    ✅ Already done
│   │   ├── PhotoGalleryRefactored.tsx
│   │   ├── components/
│   │   │   ├── BulkPhotoUpload.tsx
│   │   │   ├── PhotoAnalytics.tsx
│   │   │   ├── PhotoReviewQueue.tsx
│   │   │   └── ... (other photo components)
│   │   ├── hooks/
│   │   ├── types/
│   │   └── index.ts
│   │
│   ├── bom_calculator/            ✅ Already done
│   │
│   ├── surveys/                   🆕 Create
│   │   ├── SurveyBuilder.tsx
│   │   ├── components/
│   │   ├── hooks/
│   │   └── index.ts
│   │
│   ├── team/                      🆕 Create
│   │   ├── TeamDashboard.tsx
│   │   ├── components/
│   │   │   ├── DirectMessages.tsx
│   │   │   ├── TeamManagement.tsx
│   │   │   └── AnnouncementsView.tsx
│   │   ├── hooks/
│   │   └── index.ts
│   │
│   ├── analytics/                 🆕 Create
│   │   ├── Analytics.tsx
│   │   ├── components/
│   │   └── index.ts
│   │
│   ├── user-profile/              🆕 Create
│   │   ├── UserProfile.tsx
│   │   ├── components/
│   │   ├── hooks/
│   │   └── index.ts
│   │
│   ├── sales-resources/           🆕 Create
│   │   ├── SalesResources.tsx
│   │   ├── components/
│   │   └── index.ts
│   │
│   ├── settings/                  🆕 Create
│   │   ├── Settings.tsx
│   │   ├── components/
│   │   └── index.ts
│   │
│   └── requests/                  🔄 Organize existing
│       ├── RequestHub.tsx
│       ├── components/
│       ├── hooks/
│       └── index.ts
│
├── components/                    ✅ Only truly shared components
│   ├── shared/
│   ├── skeletons/
│   ├── ErrorBoundary.tsx
│   ├── CustomToast.tsx
│   ├── InstallAppBanner.tsx
│   └── PWAUpdatePrompt.tsx
│
├── hooks/                         ✅ Global hooks only
├── contexts/                      ✅ Global contexts only
├── lib/                           ✅ Utilities
└── types/                         ✅ Global types
```

---

## 📋 Implementation Plan

### **Phase 1: Clean Up Dead Code** ⚡ (Quick wins)
**Estimated Time:** 10 minutes

1. Delete `src/components/PhotoGallery.tsx` (old 2,696 line version)
2. Delete `src/components/PhotoGalleryWithBulkUpload.tsx` (wrapper)
3. Update any imports (should be none)
4. Test app still works

**Files to delete:**
- ❌ `src/components/PhotoGallery.tsx`
- ❌ `src/components/PhotoGalleryWithBulkUpload.tsx`

---

### **Phase 2: Complete Photos Feature** 🖼️
**Estimated Time:** 30 minutes

Move remaining photo components to `features/photos/`:

**Files to move:**
```bash
src/components/BulkPhotoUpload.tsx           → src/features/photos/components/BulkPhotoUpload.tsx
src/components/PhotoAnalytics.tsx            → src/features/photos/components/PhotoAnalytics.tsx
src/components/PhotoReviewQueue.tsx          → src/features/photos/components/PhotoReviewQueue.tsx
```

**Steps:**
1. Move files
2. Update imports in moved files
3. Update `src/features/photos/index.ts` exports
4. Update `App.tsx` imports
5. Test photo feature

---

### **Phase 3: Create Surveys Feature** 📋
**Estimated Time:** 45 minutes

1. Create `src/features/surveys/` directory structure
2. Move survey components
3. Create hooks if needed
4. Create index.ts for exports
5. Update imports in App.tsx

**Files to move:**
```bash
src/components/SimpleSurveyBuilder.tsx       → src/features/surveys/SurveyBuilder.tsx
src/components/SurveyRenderer.tsx            → src/features/surveys/components/SurveyRenderer.tsx
src/components/SurveyResponse.tsx            → src/features/surveys/components/SurveyResponse.tsx
src/components/SurveyResults.tsx             → src/features/surveys/components/SurveyResults.tsx
```

---

### **Phase 4: Create Team/Communication Feature** 👥
**Estimated Time:** 1 hour

1. Create `src/features/team/` directory structure
2. Move team & messaging components
3. Extract messaging hooks
4. Create index.ts
5. Update imports

**Files to move:**
```bash
src/components/TeamCommunication.tsx         → src/features/team/TeamCommunication.tsx
src/components/TeamManagement.tsx            → src/features/team/TeamManagement.tsx
src/components/DirectMessages.tsx            → src/features/team/components/DirectMessages.tsx
src/components/MessageComposer.tsx           → src/features/team/components/MessageComposer.tsx
src/components/AnnouncementsView.tsx         → src/features/team/components/AnnouncementsView.tsx
```

---

### **Phase 5: Create Remaining Features** 🚀
**Estimated Time:** 2 hours

Create features for:
- Analytics
- User Profile
- Sales Resources
- Settings

Each feature follows same pattern as above.

---

### **Phase 6: Organize Requests Feature** 📝
**Estimated Time:** 1 hour

The requests components are already in `src/components/requests/` - just need to:
1. Move to `src/features/requests/`
2. Extract hooks
3. Create proper index.ts
4. Update imports

---

## 🎯 Priority Order

**Recommended Implementation Order:**

1. **Phase 1** - Delete dead code (ASAP - reduces confusion)
2. **Phase 2** - Complete photos feature (build on what's done)
3. **Phase 6** - Organize requests (second biggest feature)
4. **Phase 4** - Team/communication (lots of interconnected components)
5. **Phase 3** - Surveys
6. **Phase 5** - Remaining smaller features

---

## 📏 Feature Structure Template

Each feature should follow this structure:

```
src/features/[feature-name]/
├── [FeatureName].tsx          # Main component/entry point
├── components/                 # Feature-specific components
│   ├── ComponentA.tsx
│   └── ComponentB.tsx
├── hooks/                      # Feature-specific hooks
│   ├── use[Feature].ts
│   └── index.ts
├── types/                      # Feature-specific types
│   ├── [feature].types.ts
│   └── index.ts
├── utils/                      # Feature-specific utilities (optional)
│   └── helpers.ts
└── index.ts                    # Public API - what gets exported

```

**index.ts should export:**
```typescript
// ✅ DO export: Main components
export { FeatureName } from './FeatureName';

// ✅ DO export: Types that other features need
export type { FeatureType } from './types';

// ❌ DO NOT export: Hooks (keep internal)
// ❌ DO NOT export: Utilities (keep internal)
// ❌ DO NOT export: Sub-components (keep internal)
```

---

## 🧪 Testing After Each Phase

After completing each phase:

1. ✅ App compiles without errors
2. ✅ Feature works as before
3. ✅ No console errors
4. ✅ No broken imports
5. ✅ Test in both mobile and desktop views

---

## 📊 Success Metrics

**When restructuring is complete:**
- ✅ All 54 components organized into features
- ✅ Zero dead code
- ✅ Clear feature boundaries
- ✅ Easy to find related code
- ✅ Consistent structure across features
- ✅ Clean import paths

---

## 🚀 Next Steps

**What to do now:**

1. Review this plan
2. Decide which phases to tackle
3. Start with Phase 1 (quick win - delete dead code)
4. Continue with Phase 2 (complete photos)
5. Proceed through remaining phases

**Want to start?** Let me know which phase you'd like to begin with!
