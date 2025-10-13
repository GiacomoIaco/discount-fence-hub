# BOM/BOL Calculator - Migration Checklist

**For Claude Code:** Use this as your implementation task list. Check off items as you complete them.

---

## 📋 PRE-MIGRATION PREP

### 1. Review Documentation
- [ ] Read 00-README.md (orientation)
- [ ] Read 01-PROJECT_CONTEXT.md (business context)
- [ ] Read 02-BUSINESS_LOGIC.md (formulas)
- [ ] Read 03-DATABASE_SCHEMA.sql (database structure)
- [ ] Read 04-INTEGRATION_PLAN.md (how to integrate)
- [ ] Review legacy code in `legacy/` folder

### 2. Understand Current System
- [ ] Test live app: https://bombol.netlify.app/
- [ ] Create test estimate (100ft, 1 gate, ATX-RES)
- [ ] Note expected costs: ~$35/ft total
- [ ] Review Airtable structure
- [ ] Document any missing features

### 3. Environment Setup
- [ ] Confirm parent app uses TypeScript
- [ ] Confirm parent app uses Supabase
- [ ] Confirm parent app has auth system
- [ ] Note parent app's UI component library
- [ ] Review parent app's folder structure

---

## 🗄️ PHASE 1: DATABASE SETUP (Week 1)

### Create Supabase Project
- [ ] Create new Supabase project (or use existing)
- [ ] Note project URL and keys
- [ ] Add to environment variables
- [ ] Test connection from parent app

### Run Schema Migration
- [ ] Copy `03-DATABASE_SCHEMA.sql` to migrations folder
- [ ] Run migration: `supabase db push` or equivalent
- [ ] Verify all tables created
- [ ] Verify all indexes created
- [ ] Verify all functions created
- [ ] Test helper functions work

### Seed Reference Data
- [ ] Create seed data files:
  - [ ] `seed/business_units.sql` (6 records)
  - [ ] `seed/labor_codes.sql` (27 records with all BU rates)
  - [ ] `seed/materials.sql` (export from Airtable)
- [ ] Run seed scripts
- [ ] Verify data loaded correctly
- [ ] Test queries:
  ```sql
  SELECT COUNT(*) FROM materials WHERE active = true;
  SELECT * FROM business_units;
  SELECT * FROM labor_codes WHERE 'ATX-RES' = ANY(available_in_bus);
  ```

### Test Database Access
- [ ] Create test script to query materials
- [ ] Create test script to query labor codes
- [ ] Verify RLS policies work
- [ ] Test helper functions (get_labor_rate, generate_qbo_code)

---

## 📁 PHASE 2: PROJECT STRUCTURE (Week 1)

### Create Module Folder
```bash
mkdir -p src/modules/bom-calculator
cd src/modules/bom-calculator
```

- [ ] Create folder: `_docs/`
- [ ] Copy all documentation files to `_docs/`
- [ ] Create folder: `components/`
- [ ] Create folder: `services/`
- [ ] Create folder: `hooks/`
- [ ] Create folder: `types/`
- [ ] Create folder: `utils/`
- [ ] Create folder: `database/`
- [ ] Create folder: `legacy/`
- [ ] Copy current working files to `legacy/`

### Create Entry Point
- [ ] Create `index.ts` with module exports
- [ ] Export main components
- [ ] Export hooks
- [ ] Export types
- [ ] Test imports from parent app

---

## 🎯 PHASE 3: TYPE DEFINITIONS (Week 2)

### Database Models
File: `types/models.ts`

- [ ] Define `Material` interface
- [ ] Define `BusinessUnit` interface
- [ ] Define `LaborCode` interface
- [ ] Define `WoodVerticalProduct` interface
- [ ] Define `WoodHorizontalProduct` interface
- [ ] Define `IronProduct` interface
- [ ] Define `Project` interface
- [ ] Define `ProjectLineItem` interface
- [ ] Define `ProjectBOM` interface
- [ ] Define `ProjectBOL` interface

### Calculator Types
File: `types/calculator.ts`

- [ ] Define `ProjectInput` interface
- [ ] Define `LineItemInput` interface
- [ ] Define `CalculatedBOM` interface
- [ ] Define `CalculatedBOL` interface
- [ ] Define `CalculationResult` interface
- [ ] Define `WoodVerticalStyle` enum
- [ ] Define `ConcreteType` enum
- [ ] Define `FenceType` enum

### Export All Types
File: `types/index.ts`

- [ ] Export all types from models
- [ ] Export all types from calculator
- [ ] Add JSDoc comments

---

## 🔧 PHASE 4: CORE SERVICES (Week 2)

### DatabaseService
File: `services/DatabaseService.ts`

- [ ] Create class structure
- [ ] Add getMaterials() method
- [ ] Add getLaborCodes() method
- [ ] Add getBusinessUnits() method
- [ ] Add getWoodVerticalProducts() method
- [ ] Add getWoodHorizontalProducts() method
- [ ] Add getIronProducts() method
- [ ] Add createProject() method
- [ ] Add updateProject() method
- [ ] Add deleteProject() method
- [ ] Add error handling
- [ ] Add TypeScript types
- [ ] Write unit tests

### FenceCalculator Service
File: `services/FenceCalculator.ts`

**Wood Vertical Methods:**
- [ ] Implement calculateWoodVerticalPosts()
- [ ] Implement calculateWoodVerticalPickets()
- [ ] Implement calculateWoodVerticalRails()
- [ ] Implement calculateWoodVerticalCap()
- [ ] Implement calculateWoodVerticalTrim()
- [ ] Implement calculatePicketNails()
- [ ] Implement calculateFramingNails()
- [ ] Implement getWoodVerticalLaborCodes()
- [ ] Test with legacy system results

**Wood Horizontal Methods:**
- [ ] Implement calculateWoodHorizontalPosts()
- [ ] Implement calculateHorizontalBoards()
- [ ] Implement calculateNailers()
- [ ] Implement calculateBoardNails()
- [ ] Implement calculateStructureNails()
- [ ] Implement getWoodHorizontalLaborCodes()
- [ ] Test calculations

**Iron Methods:**
- [ ] Implement calculateIronPosts()
- [ ] Implement calculateIronPanels()
- [ ] Implement calculateIronBrackets()
- [ ] Implement calculateIronRail()
- [ ] Implement calculateIronPostCaps()
- [ ] Implement getIronLaborCodes()
- [ ] Test calculations

**Universal Methods:**
- [ ] Implement calculateConcrete()
- [ ] Implement calculateLaborCost()
- [ ] Implement aggregateMaterials()
- [ ] Implement roundProjectMaterials()
- [ ] Implement calculateMaterialCosts()
- [ ] Implement calculateLaborCosts()
- [ ] Implement calculateProjectTotal()

**Main Calculator Method:**
- [ ] Implement calculate() router method
- [ ] Add validation
- [ ] Add error handling
- [ ] Write comprehensive unit tests
- [ ] Test edge cases
- [ ] Document formulas in comments

### ValidationService
File: `services/ValidationService.ts`

- [ ] Implement validateProjectInput()
- [ ] Implement validateWoodVerticalSKU()
- [ ] Implement validateWoodHorizontalSKU()
- [ ] Implement validateIronSKU()
- [ ] Add helpful error messages
- [ ] Write tests

---

## 🪝 PHASE 5: REACT HOOKS (Week 2)

### useCalculatorData Hook
File: `hooks/useCalculatorData.ts`

- [ ] Load materials on mount
- [ ] Load labor codes on mount
- [ ] Load business units on mount
- [ ] Handle loading states
- [ ] Handle errors
- [ ] Add caching
- [ ] Write tests

### useCalculator Hook
File: `hooks/useCalculator.ts`

- [ ] Use useCalculatorData for data
- [ ] Create FenceCalculator instance
- [ ] Implement calculateEstimate()
- [ ] Handle loading states
- [ ] Handle errors
- [ ] Return calculated results
- [ ] Write tests

### useProjects Hook
File: `hooks/useProjects.ts`

- [ ] Implement fetchProjects()
- [ ] Implement createProject()
- [ ] Implement updateProject()
- [ ] Implement deleteProject()
- [ ] Add pagination
- [ ] Add filtering
- [ ] Handle loading/errors
- [ ] Write tests

### useSKUs Hook
File: `hooks/useSKUs.ts`

- [ ] Implement fetchSKUs(fenceType)
- [ ] Implement createSKU()
- [ ] Implement updateSKU()
- [ ] Handle loading/errors
- [ ] Add caching
- [ ] Write tests

---

## 🎨 PHASE 6: UI COMPONENTS (Week 3)

### Shared Components
File: `components/shared/`

- [ ] ConcreteSelector.tsx
  - [ ] Dropdown with 3 options
  - [ ] Update project when changed
  - [ ] Show cost difference

- [ ] BusinessUnitSelector.tsx
  - [ ] Load from useCalculatorData
  - [ ] Group by location
  - [ ] Show customer type

- [ ] FenceStyleSelector.tsx
  - [ ] Filter by fence type
  - [ ] Show descriptions
  - [ ] Highlight popular choices

- [ ] MaterialSelector.tsx
  - [ ] Filter by fence categories
  - [ ] Filter by component types
  - [ ] Search functionality
  - [ ] Show material details

### Calculator Component
File: `components/Calculator/Calculator.tsx`

- [ ] Create main layout
- [ ] Add project input form
- [ ] Add SKU selector
- [ ] Add line items section
- [ ] Wire up useCalculator hook
- [ ] Handle calculate button
- [ ] Display loading state
- [ ] Show BOM results
- [ ] Show BOL results
- [ ] Show cost summary
- [ ] Add manual adjustments
- [ ] Add save project button
- [ ] Style with parent app components
- [ ] Make mobile responsive
- [ ] Write component tests

**Sub-components:**
- [ ] BOMDisplay.tsx
  - [ ] Group materials by category
  - [ ] Show quantity and cost
  - [ ] Allow manual adjustments
  - [ ] Highlight warnings
  
- [ ] BOLDisplay.tsx
  - [ ] List labor codes
  - [ ] Show rates by BU
  - [ ] Show quantity and cost
  - [ ] Allow adjustments
  
- [ ] ManualAdjustments.tsx
  - [ ] Material quantity overrides
  - [ ] Labor cost overrides
  - [ ] Notes field
  - [ ] Reset button

### ProjectList Component
File: `components/ProjectList/ProjectList.tsx`

- [ ] Create table layout
- [ ] Load projects with useProjects
- [ ] Display project cards/rows
- [ ] Add search/filter
- [ ] Add sorting
- [ ] Add pagination
- [ ] Handle delete
- [ ] Handle duplicate
- [ ] Link to project detail
- [ ] Show status badges
- [ ] Mobile responsive
- [ ] Write tests

**Sub-components:**
- [ ] ProjectCard.tsx
- [ ] ProjectFilters.tsx
- [ ] ProjectStats.tsx

### SKU Builder Component
File: `components/SKUBuilder/SKUBuilder.tsx`

- [ ] Create tabbed interface
- [ ] Add Wood Vertical tab
- [ ] Add Wood Horizontal tab
- [ ] Add Iron tab
- [ ] Wire up useSKUs hook
- [ ] Preview calculations
- [ ] Show BOM/BOL preview
- [ ] Handle save
- [ ] Duplicate detection
- [ ] Style consistently
- [ ] Mobile responsive
- [ ] Write tests

**Form Components:**
- [ ] WoodVerticalForm.tsx
  - [ ] Style selector
  - [ ] Height selector
  - [ ] Post material selector
  - [ ] Post type selector (CRITICAL!)
  - [ ] Picket material selector
  - [ ] Rail material selector
  - [ ] Optional components
  - [ ] Hardware selectors
  
- [ ] WoodHorizontalForm.tsx
  - [ ] Style selector
  - [ ] Height selector
  - [ ] Post spacing input
  - [ ] Material selectors
  - [ ] Hardware selectors
  
- [ ] IronForm.tsx
  - [ ] Style selector
  - [ ] Height selector
  - [ ] Material selectors
  - [ ] Bracket selector (Ameristar only)

- [ ] PreviewPanel.tsx
  - [ ] Show calculated BOM
  - [ ] Show calculated BOL
  - [ ] Show estimated costs
  - [ ] Highlight issues

---

## 🔗 PHASE 7: ROUTING & NAVIGATION (Week 3)

### Create Routes
- [ ] Create `/bom` route
- [ ] Create `/bom/calculator` route
- [ ] Create `/bom/projects` route
- [ ] Create `/bom/projects/[id]` route
- [ ] Create `/bom/sku-builder` route
- [ ] Test all routes work
- [ ] Add to main navigation
- [ ] Add breadcrumbs

### Page Components
- [ ] `app/bom/page.tsx` - Dashboard/landing
- [ ] `app/bom/calculator/page.tsx` - Calculator
- [ ] `app/bom/projects/page.tsx` - Project list
- [ ] `app/bom/projects/[id]/page.tsx` - Project detail
- [ ] `app/bom/sku-builder/page.tsx` - SKU Builder
- [ ] Add loading states
- [ ] Add error boundaries
- [ ] Add metadata/SEO

---

## 🧪 PHASE 8: TESTING (Week 4)

### Unit Tests
- [ ] FenceCalculator.test.ts (all methods)
- [ ] DatabaseService.test.ts
- [ ] ValidationService.test.ts
- [ ] All hooks (*.test.ts)
- [ ] Utility functions
- [ ] Achieve >80% coverage

### Integration Tests
- [ ] Calculator flow (user input → results)
- [ ] Project CRUD operations
- [ ] SKU Builder flow
- [ ] Database queries
- [ ] Material loading
- [ ] Labor rate lookups

### E2E Tests
- [ ] Create estimate flow
- [ ] Save project flow
- [ ] Load project flow
- [ ] Create SKU flow
- [ ] Edit SKU flow
- [ ] Multi-line project
- [ ] Manual adjustments
- [ ] Export functionality

### Manual Testing
- [ ] Test on Chrome
- [ ] Test on Firefox
- [ ] Test on Safari
- [ ] Test on mobile (iOS)
- [ ] Test on mobile (Android)
- [ ] Test with screen reader
- [ ] Test keyboard navigation

---

## 📊 PHASE 9: DATA MIGRATION (Week 4)

### Export from Airtable
- [ ] Export Materials Master (CSV)
- [ ] Export SKU Master (split by fence type)
- [ ] Export Labor Codes (CSV)
- [ ] Export Projects (if any exist)
- [ ] Clean data (remove test records)

### Transform Data
- [ ] Convert Airtable IDs to UUIDs
- [ ] Add fence_categories to materials
- [ ] Add component_types to materials
- [ ] Add sub_components to materials
- [ ] Split SKUs into fence-specific tables
- [ ] Map linked records to foreign keys

### Import to Supabase
- [ ] Import materials
- [ ] Import labor codes
- [ ] Import wood_vertical_products
- [ ] Import wood_horizontal_products
- [ ] Import iron_products
- [ ] Import projects (if any)
- [ ] Verify counts match
- [ ] Spot check data accuracy

### Validation
- [ ] Run test calculations on imported data
- [ ] Compare results with Airtable version
- [ ] Fix any discrepancies
- [ ] Document any data issues

---

## 🚀 PHASE 10: DEPLOYMENT (Week 5)

### Pre-Deployment Checklist
- [ ] All tests passing
- [ ] No TypeScript errors
- [ ] No console errors
- [ ] Performance acceptable
- [ ] Mobile responsive
- [ ] Accessibility compliant
- [ ] Security review complete
- [ ] Database RLS policies active

### Deploy to Staging
- [ ] Deploy code to staging environment
- [ ] Run database migrations
- [ ] Import data
- [ ] Smoke test all features
- [ ] Performance testing
- [ ] Load testing (if applicable)

### User Acceptance Testing
- [ ] Train users on new system
- [ ] Have users test in staging
- [ ] Gather feedback
- [ ] Fix any issues
- [ ] Get sign-off from stakeholders

### Production Deployment
- [ ] Schedule deployment window
- [ ] Communicate to users
- [ ] Deploy to production
- [ ] Run migrations
- [ ] Import final data
- [ ] Verify all features work
- [ ] Monitor for errors
- [ ] Have rollback plan ready

### Post-Deployment
- [ ] Monitor error logs
- [ ] Monitor performance
- [ ] Monitor user feedback
- [ ] Fix any issues quickly
- [ ] Document lessons learned

---

## 📝 OPTIONAL ENHANCEMENTS

### Phase 11: Additional Features
- [ ] Excel export functionality
- [ ] Print-friendly BOM view
- [ ] Email estimates to customers
- [ ] Project templates
- [ ] Bulk operations
- [ ] Advanced reporting
- [ ] Historical cost tracking
- [ ] Material usage analytics
- [ ] Profit margin calculator
- [ ] Integration with Service Titan
- [ ] Integration with QuickBooks Online
- [ ] Mobile app (React Native)

---

## ✅ SUCCESS CRITERIA

The migration is complete when:
- [ ] All calculations match legacy system (100%)
- [ ] All tests passing (>80% coverage)
- [ ] Can create projects for all 3 fence types
- [ ] Can save and load projects
- [ ] SKU Builder works for all fence types
- [ ] Performance < 2s page load
- [ ] No console errors
- [ ] Mobile responsive
- [ ] Accessible (WCAG 2.1 AA)
- [ ] Users trained and comfortable
- [ ] Airtable can be archived
- [ ] Documentation complete
- [ ] No critical bugs

---

## 🎓 DEVELOPER NOTES

### Common Pitfalls to Avoid
1. **Post Type Matters!** Always check post_type field for labor codes
2. **Concrete is Project-Level** - Aggregate posts first, then calculate
3. **Don't Break Existing Features** - Test thoroughly before deploying
4. **TypeScript is Your Friend** - Use types everywhere
5. **Test Edge Cases** - Multiple lines, no gates, large footage, etc.

### Performance Tips
1. **Cache Reference Data** - Materials, labor codes rarely change
2. **Debounce Calculations** - Don't recalculate on every keystroke
3. **Use Indexes** - Database queries should be fast
4. **Lazy Load Components** - Code split for better initial load
5. **Optimize Images** - If using any images/icons

### Debugging Tips
1. **Use React DevTools** - Inspect component state
2. **Use Supabase Dashboard** - Check database directly
3. **Console.log Calculations** - Verify formulas step-by-step
4. **Compare with Legacy** - Side-by-side testing
5. **Test with Real Data** - Use actual projects

---

## 📞 GETTING HELP

### Resources
- **Documentation:** All in `_docs/` folder
- **Legacy Code:** In `legacy/` folder for reference
- **Business Logic:** `02-BUSINESS_LOGIC.md` has all formulas
- **Database Schema:** `03-DATABASE_SCHEMA.sql` has complete structure

### If Stuck
1. Re-read relevant documentation
2. Check legacy code for reference
3. Test calculation step-by-step
4. Compare with Airtable version
5. Ask for help with specific error messages

---

## 🎉 YOU'RE READY!

This checklist provides everything Claude Code needs to successfully migrate the BOM Calculator into your larger application. Work through it systematically, testing as you go, and you'll have a production-ready system in 4-5 weeks.

**Good luck!** 🚀
