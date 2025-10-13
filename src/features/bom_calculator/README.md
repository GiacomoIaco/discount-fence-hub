# BOM Calculator Feature

## Overview
Bill of Materials calculator for fence installation projects. Calculates material quantities, labor costs, and project totals based on fence specifications.

## Architecture

### External Dependencies
This feature depends on:
- **Authentication**: `src/lib/auth.ts` - User authentication and role checks
- **Database**: `src/lib/supabase.ts` - Supabase client for data access
- **UI Framework**: Tailwind CSS, Lucide React icons

### Database Schema
- **Migration**: `migrations/017_bom_calculator_system.sql`
- **Tables**: 11 tables (business_units, materials, labor_codes, etc.)
- See `database/MIGRATION_SUMMARY.md` for details

### Entry Point
- **Main Component**: `BOMCalculator.tsx`
- **Route**: `/bom-calculator` (configured in main App.tsx)
- **Access**: Admin and Operations roles only

## File Structure

```
bom_calculator/
├── BOMCalculator.tsx         # Main component
├── types.ts                  # Application types
├── database.types.ts         # Database schema types
├── components/               # UI components
│   └── ProjectDetailsForm.tsx
├── hooks/                    # Data fetching
│   └── useBOMData.ts
├── services/                 # Business logic
│   └── FenceCalculator.ts   # Core calculation engine
└── database/                 # Schema & migrations
    └── 01_schema.sql
```

## Key Concepts

### Calculation Flow
1. User selects Business Unit → Labor rates loaded
2. User adds SKU line items (products)
3. User enters footage, buffer, lines, gates
4. Calculate button runs FenceCalculator
5. Materials and labor aggregated and displayed

### Post Type Determines Labor Codes
- **WOOD posts** → W03/W04 labor codes
- **STEEL posts** → M03/M04 labor codes
This is CRITICAL business logic in the calculator.

## Development

### Adding a New Fence Type
1. Add table to migration (e.g., `vinyl_products`)
2. Create type in `database.types.ts`
3. Add hook in `hooks/useBOMData.ts`
4. Implement calculation in `services/FenceCalculator.ts`
5. Update UI to show new fence type

### Testing
Currently no automated tests. Manual testing checklist:
- [ ] Business unit selection loads labor rates
- [ ] SKU search shows products
- [ ] Calculate button runs calculations
- [ ] Materials show decimal → rounded quantities
- [ ] Labor codes match post type
- [ ] Totals calculate correctly

## Future Enhancements
- [ ] Save projects to database
- [ ] Load existing projects
- [ ] Export to PDF/CSV
- [ ] Manual material/labor additions
- [ ] Concrete calculations (project-level)
- [ ] SKU Builder (create new products)
- [ ] SKU Catalog (view all products)

## Notes
- This feature is relatively isolated from the rest of the app
- Only shared dependencies are auth and Supabase client
- Could be extracted to separate package/repo if needed
