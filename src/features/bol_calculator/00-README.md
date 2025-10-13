# BOM/BOL Calculator - Project Overview

**Last Updated:** October 2025  
**Status:** Production (Ready for Migration to Larger App)  
**Current Version:** Airtable + React CDN  
**Target Version:** Supabase + TypeScript + Integrated Architecture

---

## 🎯 Quick Start for Claude Code

**If you're Claude Code, start by reading these files IN ORDER:**

1. **This file (00-README.md)** - Overview and quick reference
2. **01-PROJECT_CONTEXT.md** - Business context and architecture
3. **02-BUSINESS_LOGIC.md** - Calculation rules and formulas
4. **03-DATABASE_SCHEMA.md** - Ideal database structure for Supabase
5. **04-INTEGRATION_PLAN.md** - How to integrate into larger app
6. **05-MIGRATION_CHECKLIST.md** - Step-by-step implementation tasks

**Archive folder** contains detailed session notes if you need deeper context.

---

## 📊 What This System Does

**Discount Fence USA** needs to calculate:
- **BOM (Bill of Materials):** What materials are needed for a fence project
- **BOL (Bill of Labor):** What labor tasks and costs are required

**Example:**
- Input: 100ft Wood Vertical fence, 6ft tall, 1 gate, Austin Residential
- Output: 
  - 14 posts (4x4x8), 
  - 268 pickets (1x6x8), 
  - 42 rails (2x4x8),
  - Hardware, concrete, etc.
  - Labor: Set posts ($2.50/ft), Nail up 6ft ($3.75/ft), etc.
  - Total: ~$35/ft ($3,500 for 100ft)

---

## 🏗️ Current Architecture

### Live Production App
- **URL:** https://bombol.netlify.app/
- **Stack:** React (via CDN), Airtable API, Netlify hosting
- **Authentication:** Netlify Identity (invite-only)
- **Status:** ✅ Fully working for all 3 fence types

### Core Files (in `legacy/` folder)
```
index.html          - Main app with authentication
config.js           - Central configuration
services.js         - AirtableService, FenceCalculator
components/
  ├── calculator.js      - Main calculator component
  ├── project-list.js    - Saved projects view
  └── sku-builder.js     - SKU configuration builder
```

### Database (Currently Airtable)
```
Materials Master        - 200+ materials catalog
SKU Master             - 50+ product configurations
SKU Default Materials  - Material assignments to SKUs
SKU Default Labor      - Labor assignments to SKUs
Business Units         - 6 BUs (ATX-RES, ATX-HB, SA-RES, SA-HB, HOU-RES, HOU-HB)
Labor Rates            - 27 labor codes with BU-specific rates
```

---

## 🎯 Migration Goals

### From:
- ❌ React via CDN (no build process)
- ❌ Airtable (expensive, limited)
- ❌ Abstract SKU Master (hard to maintain)
- ❌ Duplicate calculators (SKU Builder vs Main)
- ❌ JavaScript (no type safety)

### To:
- ✅ Modern React/TypeScript (type-safe)
- ✅ Supabase PostgreSQL (better, cheaper)
- ✅ Fence-type specific product tables (explicit, clear)
- ✅ Single unified calculator (DRY principle)
- ✅ Integrated into larger app architecture

---

## 🔑 Key Business Rules

### Fence Types Supported
1. **Wood Vertical** (4 styles: Standard, Good Neighbor-RES, Good Neighbor-HB, Board-on-Board)
2. **Wood Horizontal** (3 styles: Standard, Good Neighbor, Exposed)
3. **Iron** (3 styles: Standard 2-Rail, Ameristar/3-Rail, Iron Rail)

### Critical Calculation Rules
- **Post spacing varies by type:**
  - Wood Vertical Standard/BOB: 8ft
  - Wood Vertical Good Neighbor: 7.71ft
  - Wood Horizontal: 6ft (default)
  - Iron: 8ft
  
- **Labor codes depend on post type:**
  - Wood posts → W03, W04, W06, W07
  - Steel posts → M03, M04, M06, M07
  - *Must check SKU's Post_Type field!*

- **Concrete calculation:**
  - 3-part system: CTS (÷10), CTP (÷20), CTQ (×0.5)
  - Yellow bags: CTY (×0.65)
  - Red bags: CTR (×1)

### Business Units (BUs)
- **ATX-RES:** Austin Residential (complete labor rates ✅)
- **ATX-HB:** Austin Home Builder (complete labor rates ✅)
- **SA-RES:** San Antonio Residential (complete labor rates ✅)
- **SA-HB:** San Antonio Home Builder (complete labor rates ✅)
- **HOU-RES:** Houston Residential (complete labor rates ✅)
- **HOU-HB:** Houston Home Builder (complete labor rates ✅)

---

## ✅ What's Working Well

1. **All fence calculations accurate** - Tested extensively
2. **SKU Builder functional** - Can create new products
3. **Project save/load** - Local storage persistence
4. **Cost calculations** - Material + labor with BU-specific rates
5. **Authentication** - Netlify Identity working

---

## ⚠️ Known Issues & Technical Debt

### Critical
- **Duplicate calculators** - SKU Builder has own calculation logic (should use main FenceCalculator)
- **Abstract SKU Master** - Hard to query, requires complex lookups

### High Priority
- **No concrete selector** - Hardcoded to 3-part system (need dropdown)
- **Materials Master needs optimization** - 200+ records without proper filtering fields

### Medium Priority
- **No TypeScript** - Runtime errors possible
- **No unit tests** - Only manual testing
- **Limited error handling** - API failures show generic errors

### Low Priority
- **Service Titan integration** - Awaiting API docs
- **Excel export** - Not implemented
- **Print-friendly BOM** - Not implemented

---

## 🚀 Recommended Migration Approach

### Phase 1: Parallel Setup (Week 1)
1. Create Supabase project
2. Set up database schema (see 03-DATABASE_SCHEMA.md)
3. Import reference data (materials, labor codes, business units)
4. Keep Airtable running (don't break production)

### Phase 2: Refactor Components (Week 2)
1. Convert to TypeScript
2. Consolidate calculators into single service
3. Use fence-type specific product tables
4. Add unit tests for calculations

### Phase 3: Integration (Week 2-3)
1. Connect to larger app's auth system
2. Share common UI components
3. Use shared database connection
4. Integrate navigation/routing

### Phase 4: Migration (Week 3-4)
1. Parallel run both systems
2. Validate calculations match
3. Switch to Supabase
4. Archive Airtable

---

## 📞 Getting Help

### For Claude Code:
- All detailed context is in the numbered docs (01-05)
- Archive folder has session-by-session history
- Database schema is fully defined in SQL
- Business logic formulas are documented

### For Humans:
- Original developer: Giacomo@discountfenceusa.com
- Philosophy: "Easier is better" - simple solutions preferred
- Testing: Always test with ATX-RES (has complete data)

---

## 🎓 Key Learnings from Development

1. **Fence-type specific tables > Abstract SKU Master**
   - Explicit is better than abstract
   - Easy to query: "Show all 6ft steel post fences"
   - Calculations are straightforward

2. **Post Type determines labor codes**
   - Wood posts use W-codes
   - Steel posts use M-codes
   - This was missed initially, caused bugs

3. **One calculator, not two**
   - SKU Builder had duplicate logic
   - Led to sync issues and bugs
   - Should use single FenceCalculator class

4. **Concrete is project-level**
   - Not per-line-item
   - Three types: 3-part, Yellow bags, Red bags
   - Aggregate total posts, then calculate

5. **Business units need complete rates**
   - All 6 BUs now have rates (27 labor codes each)
   - Critical for accurate estimates

---

## 💡 Success Criteria

The migration is successful when:
- ✅ All calculations match Airtable version exactly
- ✅ Can create, save, and load projects
- ✅ SKU Builder creates products correctly
- ✅ TypeScript catches type errors at compile time
- ✅ Unit tests validate all calculations
- ✅ Integrated smoothly with larger app
- ✅ Supabase costs < Airtable costs
- ✅ Performance is equal or better

---

## 🔧 Quick Commands Reference

### Test Scenario (Standard)
```javascript
{
  netLength: 100,
  errorBuffer: 5,
  totalFootage: 105,
  numberOfLines: 1,
  numberOfGates: 1,
  businessUnit: 'ATX-RES',
  fenceType: 'Wood Vertical',
  style: 'Standard',
  height: 6,
  postType: 'WOOD'
}
// Expected: ~$35/ft total cost
```

### Database Connection
```javascript
// Airtable (current)
const airtable = new AirtableService({
  baseId: 'apptxkwnnNo8oCTRY',
  apiKey: '[from env]'
});

// Supabase (target)
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);
```

---

**This document provides Claude Code with immediate context. Read the numbered docs for deep understanding.**
