# BOM/BOL Calculator - Business Logic & Formulas

**For Claude Code:** This document contains EVERY calculation formula and business rule. Reference this when implementing FenceCalculator.

---

## 🧮 Core Formula Variables

### Input Variables (From User)
```typescript
interface ProjectInput {
  totalFootage: number;      // Total linear feet including buffer
  errorBuffer: number;       // Safety margin (typically 5ft)
  netLength: number;         // Actual fence length (total - buffer)
  numberOfLines: number;     // Separate fence runs (1-5)
  numberOfGates: number;     // Gate count (0-3)
  businessUnit: string;      // 'ATX-RES', 'SA-HB', etc.
}

interface LineItemInput {
  skuId: string;            // Which product
  fenceType: string;        // 'Wood Vertical', 'Wood Horizontal', 'Iron'
  netLength: number;        // Length for this line item
  numberOfLines: number;    // Lines for this line item
  numberOfGates: number;    // Gates for this line item
}
```

---

## 🪵 WOOD VERTICAL CALCULATIONS

### Styles & Their Impact
```typescript
enum WoodVerticalStyle {
  STANDARD = "Standard",                    // Base calculations
  GOOD_NEIGHBOR_RES = "Good Neighbor - Residential",  // 7.71ft spacing, 10% more pickets
  GOOD_NEIGHBOR_HB = "Good Neighbor - Builder",       // 7.71ft spacing, 10% more pickets
  BOARD_ON_BOARD = "Board-on-Board"         // 8ft spacing, 14% more pickets
}
```

### 1. POSTS
```typescript
function calculateWoodVerticalPosts(
  netLength: number,
  style: WoodVerticalStyle,
  numberOfLines: number
): number {
  // Base post spacing
  const spacing = 
    style === WoodVerticalStyle.GOOD_NEIGHBOR_RES || 
    style === WoodVerticalStyle.GOOD_NEIGHBOR_HB
      ? 7.71 
      : 8.0;
  
  // Base posts (sections + 1)
  let posts = Math.ceil(netLength / spacing) + 1;
  
  // Add extra posts for multiple lines
  // Rule: Every 2 additional lines need 1 more post
  if (numberOfLines > 2) {
    const extraPosts = Math.ceil((numberOfLines - 2) / 2);
    posts += extraPosts;
  }
  
  return posts;
}

// Examples:
// 100ft Standard, 1 line: Math.ceil(100/8) + 1 = 14 posts
// 100ft Standard, 3 lines: 14 + Math.ceil((3-2)/2) = 14 + 1 = 15 posts
// 100ft Standard, 5 lines: 14 + Math.ceil((5-2)/2) = 14 + 2 = 16 posts
// 100ft Good Neighbor, 1 line: Math.ceil(100/7.71) + 1 = 14 posts
```

### 2. PICKETS
```typescript
function calculateWoodVerticalPickets(
  netLength: number,
  style: WoodVerticalStyle,
  picketWidthActual: number  // From material (e.g., 5.5" for 1x6)
): number {
  // Convert linear feet to inches
  const lengthInches = netLength * 12;
  
  // Base calculation with 2.5% waste factor
  let pickets = Math.ceil((lengthInches / picketWidthActual) * 1.025);
  
  // Style modifiers
  if (style === WoodVerticalStyle.GOOD_NEIGHBOR_RES || 
      style === WoodVerticalStyle.GOOD_NEIGHBOR_HB) {
    // Good Neighbor uses 10% more pickets (double-sided)
    pickets = Math.ceil(pickets * 1.1);
  } 
  else if (style === WoodVerticalStyle.BOARD_ON_BOARD) {
    // Board-on-Board formula is different
    // Formula: (length × 2) / (width × 2 - gap) × waste
    // Gap is typically 2.5 inches
    pickets = Math.ceil(
      (lengthInches * 2) / ((picketWidthActual * 2) - 2.5) * 1.025
    );
  }
  
  return pickets;
}

// Examples:
// 100ft Standard, 1x6 (5.5" actual):
// (100 × 12) / 5.5 × 1.025 = 1200 / 5.5 × 1.025 = 223.6 × 1.025 = 229 pickets

// 100ft Good Neighbor, 1x6:
// 229 × 1.1 = 251.9 → 252 pickets

// 100ft Board-on-Board, 1x6:
// (1200 × 2) / (5.5 × 2 - 2.5) × 1.025 = 2400 / 8.5 × 1.025 = 289 pickets
```

### 3. RAILS
```typescript
function calculateWoodVerticalRails(
  netLength: number,
  railsPerSection: number,  // From SKU: 2, 3, or 4
  railLength: number        // From material: typically 8ft
): number {
  // Calculate sections (same as posts - 1)
  const sections = Math.ceil(netLength / 8); // Posts are 8ft apart
  
  // Total rail length needed
  const totalRailLengthNeeded = sections * railsPerSection;
  
  // Divide by rail length to get count
  // No waste factor (cuts are precise)
  const rails = Math.ceil(totalRailLengthNeeded / railLength) * railLength / railLength;
  
  return Math.ceil(sections * railsPerSection * (netLength / (sections * 8)));
}

// SIMPLIFIED FORMULA (more accurate):
function calculateWoodVerticalRailsSimple(
  netLength: number,
  railsPerSection: number
): number {
  // Each section needs X rails
  const sections = Math.ceil(netLength / 8);
  
  // Total rails = sections × rails per section
  return sections * railsPerSection;
}

// Example:
// 100ft, 3 rails per section:
// Sections = Math.ceil(100/8) = 13
// Rails = 13 × 3 = 39 rails (8ft each)
```

### 4. CAP (Optional)
```typescript
function calculateWoodVerticalCap(
  netLength: number,
  hasCap: boolean,
  capLength: number = 8  // Typically 8ft
): number {
  if (!hasCap) return 0;
  
  // Cap runs the entire length
  return Math.ceil(netLength / capLength);
}

// Example:
// 100ft with cap: Math.ceil(100/8) = 13 caps
```

### 5. TRIM (Optional)
```typescript
function calculateWoodVerticalTrim(
  netLength: number,
  hasTrim: boolean,
  trimLength: number = 8  // Typically 8ft
): number {
  if (!hasTrim) return 0;
  
  // Trim runs the entire length
  return Math.ceil(netLength / trimLength);
}
```

### 6. ROT BOARD (Optional)
```typescript
function calculateWoodVerticalRotBoard(
  netLength: number,
  hasRotBoard: boolean,
  rotBoardLength: number = 8
): number {
  if (!hasRotBoard) return 0;
  
  // Rot board at ground level, entire length
  return Math.ceil(netLength / rotBoardLength);
}
```

### 7. NAILS - PICKETS (HW08)
```typescript
function calculatePicketNails(
  rails: number,
  pickets: number,
  hasTrim: boolean,
  trimBoards: number
): number {
  // Each picket is nailed to each rail: 2 nails per connection
  let totalNails = rails * pickets * 2;
  
  // If trim, add nails for trim (6 nails per trim board)
  if (hasTrim) {
    totalNails += trimBoards * 6;
  }
  
  // HW08 comes in boxes of 300
  return Math.ceil(totalNails / 300);
}

// Example:
// 39 rails, 229 pickets, no trim:
// 39 × 229 × 2 = 17,862 nails
// Math.ceil(17862 / 300) = 60 boxes
```

### 8. NAILS - FRAMING (HW07)
```typescript
function calculateFramingNails(
  posts: number,
  railsPerSection: number,
  hasCap: boolean,
  capBoards: number
): number {
  // Each rail attaches to post: 4 nails per rail-to-post connection
  let totalNails = posts * railsPerSection * 4;
  
  // If cap, add nails for cap (6 nails per cap board to post)
  if (hasCap) {
    totalNails += posts * 6;
  }
  
  // HW07 comes in boxes of 28
  return Math.ceil(totalNails / 28);
}

// Example:
// 14 posts, 3 rails per section, with cap, 13 cap boards:
// (14 × 3 × 4) + (14 × 6) = 168 + 84 = 252 nails
// Math.ceil(252 / 28) = 9 boxes
```

---

## 🪵 WOOD HORIZONTAL CALCULATIONS

### Key Differences from Vertical
- **Post spacing:** Usually 6ft (not 8ft)
- **No pickets:** Uses horizontal boards instead
- **Nailers:** Vertical 2x4s between posts for board attachment
- **Board count:** Depends on fence height and board width

### 1. POSTS
```typescript
function calculateWoodHorizontalPosts(
  netLength: number,
  postSpacing: number = 6,  // Usually 6ft for horizontal
  numberOfLines: number
): number {
  // Base posts
  let posts = Math.ceil(netLength / postSpacing) + 1;
  
  // Extra posts for multiple lines
  if (numberOfLines > 2) {
    posts += Math.ceil((numberOfLines - 2) / 2);
  }
  
  return posts;
}

// Example:
// 100ft, 6ft spacing: Math.ceil(100/6) + 1 = 17 + 1 = 18 posts
```

### 2. HORIZONTAL BOARDS
```typescript
function calculateHorizontalBoards(
  netLength: number,
  fenceHeight: number,
  boardWidthActual: number,  // Typically 5.5" for 1x6
  boardLength: number = 8,
  style: string
): number {
  // Calculate how many boards tall
  const boardsHigh = Math.ceil((fenceHeight * 12) / boardWidthActual);
  
  // Each row runs the full length
  const boardsPerRow = Math.ceil(netLength / boardLength);
  
  // Total boards
  let totalBoards = boardsHigh * boardsPerRow;
  
  // Good Neighbor needs double (both sides)
  if (style.includes("Good Neighbor")) {
    totalBoards *= 2;
  }
  
  return totalBoards;
}

// Example:
// 100ft, 6ft tall, 1x6 boards (5.5" actual):
// Boards high: Math.ceil((6 × 12) / 5.5) = Math.ceil(72 / 5.5) = 14 boards
// Boards per row: Math.ceil(100 / 8) = 13 boards
// Total: 14 × 13 = 182 boards
```

### 3. NAILERS (Vertical Support)
```typescript
function calculateNailers(
  netLength: number,
  postSpacing: number,
  nailerLength: number = 8
): number {
  // One nailer between each pair of posts
  const sections = Math.ceil(netLength / postSpacing);
  
  // Nailers run vertically (fence height)
  // Usually 1 nailer per section is sufficient
  return sections;
}

// Example:
// 100ft, 6ft spacing:
// Sections = Math.ceil(100/6) = 17 sections
// Nailers = 17
```

### 4. NAILS - BOARDS
```typescript
function calculateBoardNails(
  boards: number,
  boardsPerSection: number
): number {
  // Each board is nailed to nailer and posts
  // Approximately 4 nails per board
  const totalNails = boards * 4;
  
  // Board nails come in boxes of 300
  return Math.ceil(totalNails / 300);
}
```

### 5. NAILS - STRUCTURE
```typescript
function calculateStructureNails(
  posts: number,
  nailers: number
): number {
  // Nailer to post: 6 nails per connection
  const totalNails = nailers * 2 * 6; // 2 posts per nailer
  
  // Structure nails come in boxes of 28
  return Math.ceil(totalNails / 28);
}
```

---

## 🔩 IRON CALCULATIONS

### Styles
```typescript
enum IronStyle {
  STANDARD_2_RAIL = "Standard 2 Rail",    // Pre-welded panels, no brackets
  AMERISTAR_3_RAIL = "Ameristar/3 Rail",  // Panels with brackets
  IRON_RAIL = "Iron Rail"                 // Custom, built on-site
}
```

### 1. POSTS
```typescript
function calculateIronPosts(
  netLength: number,
  postSpacing: number = 8,
  numberOfLines: number
): number {
  // Same as wood vertical
  let posts = Math.ceil(netLength / postSpacing) + 1;
  
  if (numberOfLines > 2) {
    posts += Math.ceil((numberOfLines - 2) / 2);
  }
  
  return posts;
}
```

### 2. PANELS (Standard & Ameristar)
```typescript
function calculateIronPanels(
  netLength: number,
  panelWidth: number = 8,  // Standard 8ft panels
  style: IronStyle
): number {
  if (style === IronStyle.IRON_RAIL) {
    return 0; // Rail style doesn't use panels
  }
  
  // One panel per section
  return Math.ceil(netLength / panelWidth);
}

// Example:
// 100ft: Math.ceil(100/8) = 13 panels
```

### 3. BRACKETS (Ameristar/Centurion ONLY)
```typescript
function calculateIronBrackets(
  panels: number,
  railsPerPanel: number,
  style: IronStyle
): number {
  // Only Ameristar/Centurion styles use brackets
  if (style !== IronStyle.AMERISTAR_3_RAIL) {
    return 0;
  }
  
  // 2 brackets per rail per panel
  return panels * railsPerPanel * 2;
}

// Example:
// 13 panels, 3 rails per panel:
// 13 × 3 × 2 = 78 brackets
```

### 4. RAILS & PICKETS (Iron Rail Style)
```typescript
function calculateIronRail(
  netLength: number,
  fenceHeight: number
): { rails: number; pickets: number } {
  // Rails run horizontally (usually 2 or 3)
  const rails = fenceHeight <= 4 ? 2 : 3;
  const railsNeeded = Math.ceil(netLength / 8) * rails;
  
  // Pickets run vertically (usually 6" spacing)
  const picketsPerFoot = 2; // 6" spacing = 2 per foot
  const pickets = Math.ceil(netLength * picketsPerFoot);
  
  return { rails: railsNeeded, pickets };
}
```

### 5. POST CAPS
```typescript
function calculateIronPostCaps(
  posts: number
): number {
  // One cap per post
  return posts;
}
```

### 6. WELDING SUPPLIES (Iron Rail)
```typescript
function calculateWeldingSupplies(
  style: IronStyle,
  pickets: number
): number {
  if (style !== IronStyle.IRON_RAIL) {
    return 0;
  }
  
  // Welding rod estimate: ~1 per 50 pickets
  return Math.ceil(pickets / 50);
}
```

---

## 🏗️ CONCRETE CALCULATIONS (All Fence Types)

### PROJECT-LEVEL (Not Per Line Item)
**Critical:** Aggregate all posts first, THEN calculate concrete

```typescript
function calculateConcrete(
  totalProjectPosts: number,
  concreteType: ConcreteType
): ConcreteQuantities {
  
  switch (concreteType) {
    case ConcreteType.THREE_PART:
      return {
        CTS: Math.ceil(totalProjectPosts / 10),   // Sand & Gravel (50lb bags)
        CTP: Math.ceil(totalProjectPosts / 20),   // Portland Cement (94lb bags)
        CTQ: totalProjectPosts * 0.5              // QuickRock (50lb bags)
      };
    
    case ConcreteType.YELLOW_BAGS:
      return {
        CTY: Math.ceil(totalProjectPosts * 0.65)  // Yellow bags (80lb)
      };
    
    case ConcreteType.RED_BAGS:
      return {
        CTR: totalProjectPosts * 1                // Red fast-set (50lb)
      };
  }
}

// Example:
// 14 posts, 3-part system:
// CTS: Math.ceil(14/10) = 2 bags
// CTP: Math.ceil(14/20) = 1 bag
// CTQ: 14 × 0.5 = 7 bags

// 14 posts, yellow bags:
// CTY: Math.ceil(14 × 0.65) = 10 bags
```

**Target:** ~50 lbs of concrete per post

---

## ⚒️ LABOR CALCULATIONS

### Labor Code Selection (CRITICAL)

**Wood Vertical Post Type Logic:**
```typescript
function getWoodVerticalLaborCodes(
  sku: WoodVerticalProduct,
  measurements: LineItemInput
): string[] {
  const codes: string[] = [];
  
  // W02: Set posts (same for wood or steel)
  codes.push('W02');
  
  // Height-based nail up (depends on post type!)
  if (sku.height <= 6) {
    codes.push(sku.post_type === 'STEEL' ? 'M03' : 'W03');
  } else {
    codes.push(sku.post_type === 'STEEL' ? 'M04' : 'W04');
  }
  
  // Good Neighbor (depends on post type!)
  if (sku.style.includes('Good Neighbor')) {
    codes.push(sku.post_type === 'STEEL' ? 'M06' : 'W06');
  }
  
  // Cap and/or Trim (depends on post type!)
  const hasCap = sku.cap_material_id !== null;
  const hasTrim = sku.trim_material_id !== null;
  
  if (hasCap && hasTrim) {
    codes.push(sku.post_type === 'STEEL' ? 'M07' : 'W07');
  } else if (hasCap) {
    codes.push('W09'); // Just cap - same for both
  } else if (hasTrim) {
    codes.push('W08'); // Just trim - same for both
  }
  
  // Additional rails (if more than default)
  const defaultRails = sku.height <= 6 ? 3 : 4;
  if (sku.rail_count > defaultRails) {
    codes.push('W10'); // Additional rail labor
  }
  
  // Gates
  if (measurements.numberOfGates > 0) {
    codes.push(sku.height <= 6 ? 'W11' : 'W12');
  }
  
  return codes;
}
```

**Wood Horizontal Labor Codes:**
```typescript
function getWoodHorizontalLaborCodes(
  sku: WoodHorizontalProduct,
  measurements: LineItemInput
): string[] {
  const codes: string[] = ['W02', 'W12', 'W13'];
  
  // W02: Set posts
  // W12: Install nailers
  // W13: Install horizontal boards
  
  if (measurements.numberOfGates > 0) {
    codes.push('W11'); // Gate installation
  }
  
  return codes;
}
```

**Iron Labor Codes:**
```typescript
function getIronLaborCodes(
  sku: IronProduct,
  measurements: LineItemInput
): string[] {
  const codes: string[] = [];
  
  switch (sku.style) {
    case 'Standard 2 Rail':
      codes.push('IR01', 'IR02'); // Assembly + weld
      break;
    case 'Ameristar/3 Rail':
      codes.push('IR03', 'IR05'); // Ameristar assembly + set posts
      break;
    case 'Iron Rail':
      codes.push('IR04'); // Centurion assembly
      break;
  }
  
  if (measurements.numberOfGates > 0) {
    codes.push('IR06'); // Iron gate
  }
  
  return codes;
}
```

### Labor Cost Calculation
```typescript
function calculateLaborCost(
  laborCode: string,
  quantity: number,
  businessUnit: string,
  laborRates: LaborRate[]
): number {
  // Find the labor rate record
  const rateRecord = laborRates.find(r => r.labor_sku === laborCode);
  
  if (!rateRecord) {
    console.warn(`No labor rate found for code: ${laborCode}`);
    return 0;
  }
  
  // Get BU-specific rate from matrix
  // Rate columns: rate_atx_res, rate_atx_hb, rate_sa_res, etc.
  const rateField = `rate_${businessUnit.toLowerCase().replace('-', '_')}`;
  const rate = rateRecord[rateField] || 0;
  
  // Calculate cost
  return quantity * rate;
}

// Example:
// Labor Code: W03 (Nail up 6ft)
// Quantity: 100 LF (net length)
// Business Unit: ATX-RES
// Rate: $3.75/LF
// Cost: 100 × $3.75 = $375
```

---

## 🧮 AGGREGATION RULES

### Material Aggregation
```typescript
function aggregateMaterials(
  lineItems: CalculatedLineItem[]
): AggregatedMaterial[] {
  const materialMap = new Map<string, AggregatedMaterial>();
  
  lineItems.forEach(lineItem => {
    lineItem.materials.forEach(material => {
      const key = material.material_sku;
      
      if (materialMap.has(key)) {
        const existing = materialMap.get(key)!;
        existing.quantity += material.quantity;
      } else {
        materialMap.set(key, { ...material });
      }
    });
  });
  
  return Array.from(materialMap.values());
}
```

### Project-Level Rounding
```typescript
function roundProjectMaterials(
  materials: AggregatedMaterial[]
): AggregatedMaterial[] {
  return materials.map(material => {
    // Concrete and hardware get rounded UP at project level
    if (material.category === 'Concrete' || material.category === 'Hardware') {
      material.quantity = Math.ceil(material.quantity);
    }
    
    return material;
  });
}
```

---

## 💰 COST CALCULATIONS

### Material Costs
```typescript
function calculateMaterialCosts(
  materials: AggregatedMaterial[]
): { materials: MaterialWithCost[]; total: number } {
  let total = 0;
  
  const materialsWithCost = materials.map(material => {
    const cost = material.quantity * material.unit_cost;
    total += cost;
    
    return {
      ...material,
      extended_cost: cost
    };
  });
  
  return { materials: materialsWithCost, total };
}
```

### Labor Costs
```typescript
function calculateLaborCosts(
  laborItems: LaborItem[],
  businessUnit: string,
  laborRates: LaborRate[]
): { labor: LaborWithCost[]; total: number } {
  let total = 0;
  
  const laborWithCost = laborItems.map(item => {
    const cost = calculateLaborCost(
      item.labor_code,
      item.quantity,
      businessUnit,
      laborRates
    );
    total += cost;
    
    return {
      ...item,
      extended_cost: cost
    };
  });
  
  return { labor: laborWithCost, total };
}
```

### Total Project Cost
```typescript
function calculateProjectTotal(
  materialCost: number,
  laborCost: number,
  manualAdjustments: number = 0
): ProjectCost {
  return {
    material_cost: materialCost,
    labor_cost: laborCost,
    manual_adjustments: manualAdjustments,
    total_cost: materialCost + laborCost + manualAdjustments,
    cost_per_foot: (materialCost + laborCost + manualAdjustments) / netLength
  };
}
```

---

## ✅ VALIDATION RULES

### Input Validation
```typescript
function validateProjectInput(input: ProjectInput): ValidationResult {
  const errors: string[] = [];
  
  if (input.netLength <= 0) {
    errors.push("Net length must be greater than 0");
  }
  
  if (input.numberOfLines < 1 || input.numberOfLines > 5) {
    errors.push("Number of lines must be between 1 and 5");
  }
  
  if (input.numberOfGates < 0 || input.numberOfGates > 3) {
    errors.push("Number of gates must be between 0 and 3");
  }
  
  if (!VALID_BUSINESS_UNITS.includes(input.businessUnit)) {
    errors.push(`Invalid business unit: ${input.businessUnit}`);
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}
```

### SKU Validation
```typescript
function validateWoodVerticalSKU(sku: WoodVerticalProduct): ValidationResult {
  const errors: string[] = [];
  
  if (!sku.post_material_id) {
    errors.push("Post material is required");
  }
  
  if (!sku.post_type) {
    errors.push("Post type must be specified (WOOD or STEEL)");
  }
  
  if (!sku.picket_material_id) {
    errors.push("Picket material is required");
  }
  
  if (!sku.rail_material_id) {
    errors.push("Rail material is required");
  }
  
  if (sku.height < 3 || sku.height > 8) {
    errors.push("Height must be between 3 and 8 feet");
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}
```

---

## 🧪 TEST CASES

### Standard Test Case
```typescript
const TEST_CASE_STANDARD = {
  input: {
    netLength: 100,
    errorBuffer: 5,
    totalFootage: 105,
    numberOfLines: 1,
    numberOfGates: 1,
    businessUnit: 'ATX-RES'
  },
  sku: {
    fence_type: 'Wood Vertical',
    style: 'Standard',
    height: 6,
    post_type: 'WOOD',
    rail_count: 3
  },
  expected: {
    posts: 14,
    pickets: 229, // (100 × 12) / 5.5 × 1.025 for 1x6
    rails: 39,    // 13 sections × 3 rails
    material_cost: 2800, // Approximate
    labor_cost: 750,     // Approximate
    total_cost: 3550,    // $35.50/ft
    cost_per_foot: 35.50
  }
};
```

---

**This document provides every formula Claude Code needs. Reference this for implementation and testing.**
