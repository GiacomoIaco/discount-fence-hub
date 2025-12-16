-- Add documentation for code-handled behaviors in SKU Builder
-- These are automatic behaviors that happen in the React code, not the database

-- Update Wood Vertical knowledge with code-handled behaviors
UPDATE product_type_knowledge
SET installation_notes = COALESCE(installation_notes || E'\n\n', '') ||
'## Code-Handled Behaviors (SKU Builder)

The following behaviors are handled automatically by the SKU Builder code, NOT by database formulas:

### 1. Steel Post Cap Auto-Selection
- **Location**: `SKUBuilderPage.tsx:473-504`
- **Logic**:
  - When `post_type = STEEL` and **no cap** is selected → auto-selects `PC01` (post cap without wood cap)
  - When `post_type = STEEL` and **cap IS** selected → auto-selects `PC02` (post cap with wood cap)
  - When `post_type = WOOD` → steel_post_cap is cleared (not applicable)

### 2. Concrete Type Selector
- **Location**: `SKUBuilderPage.tsx:611-714`
- **Logic**: Concrete is NOT a selectable component. Instead, the user selects a concrete TYPE (3-Part Mix, Yellow Bags, Red Bags) and the formulas are calculated:
  - 3-Part: CTS (sand) = posts/10, CTP (portland) = posts/20, CTQ (quickrock) = posts*0.5
  - Yellow Bags: CTY = posts*0.65
  - Red Bags: CTR = posts*1

### 3. Post Length Filtering
- **Location**: `SKUBuilderPage.tsx:351-354`
- **Logic**: When selecting wood posts, filters available materials by required length:
  - Height ≤ 6ft → requires 8ft posts minimum
  - Height > 6ft → requires 10ft posts minimum

### 4. Picket Height Filtering
- **Location**: `SKUBuilderPage.tsx:346-348`
- **Logic**: Filters picket materials to match the selected fence height (e.g., 6ft fence → 6ft pickets)

---
*Last updated: December 2024*
'
WHERE product_type_id = (SELECT id FROM product_types_v2 WHERE code = 'wood-vertical');

-- Also add to Wood Horizontal (shares some behaviors)
UPDATE product_type_knowledge
SET installation_notes = COALESCE(installation_notes || E'\n\n', '') ||
'## Code-Handled Behaviors (SKU Builder)

### 1. Concrete Type Selector
- Concrete is calculated based on post count, not as a selectable component
- 3-Part, Yellow Bags, or Red Bags options in the test panel

### 2. Post Length Filtering
- Filters available posts by required length based on fence height

---
*Last updated: December 2024*
'
WHERE product_type_id = (SELECT id FROM product_types_v2 WHERE code = 'wood-horizontal')
AND installation_notes IS NULL OR installation_notes NOT LIKE '%Code-Handled%';

-- Add to Iron (fewer code behaviors)
UPDATE product_type_knowledge
SET installation_notes = COALESCE(installation_notes || E'\n\n', '') ||
'## Code-Handled Behaviors (SKU Builder)

### 1. Concrete Type Selector
- Concrete is calculated based on post count (post_type is always STEEL for iron)
- Uses same concrete formulas as wood products

---
*Last updated: December 2024*
'
WHERE product_type_id = (SELECT id FROM product_types_v2 WHERE code = 'iron')
AND installation_notes IS NULL OR installation_notes NOT LIKE '%Code-Handled%';
