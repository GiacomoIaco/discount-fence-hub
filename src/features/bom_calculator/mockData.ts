/**
 * Mock data for BOM Calculator UI development
 * Replace with Supabase queries in production
 */

import type {
  WoodVerticalProduct,
  WoodHorizontalProduct,
  IronProduct,
  Material,
  LaborCode,
} from './types';

// ============================================================================
// WOOD VERTICAL PRODUCTS
// ============================================================================

export const mockWoodVerticalProducts: WoodVerticalProduct[] = [
  {
    id: 'wv-std-6',
    name: 'Standard 6ft Wood Vertical',
    height: 72,
    postSpacing: 96,
    picketWidth: 5.5,
    postType: 'wood',
    railsPerSection: 3,
    postMaterialCode: '6X6X8-PT',
    picketMaterialCode: 'P-1X6X6-WRC',
    railMaterialCode: '2X4X8-PT',
    isActive: true,
  },
  {
    id: 'wv-std-4',
    name: 'Standard 4ft Wood Vertical',
    height: 48,
    postSpacing: 96,
    picketWidth: 5.5,
    postType: 'wood',
    railsPerSection: 2,
    postMaterialCode: '4X4X6-PT',
    picketMaterialCode: 'P-1X6X4-WRC',
    railMaterialCode: '2X4X8-PT',
    isActive: true,
  },
  {
    id: 'wv-std-8',
    name: 'Standard 8ft Wood Vertical',
    height: 96,
    postSpacing: 96,
    picketWidth: 5.5,
    postType: 'wood',
    railsPerSection: 4,
    postMaterialCode: '6X6X10-PT',
    picketMaterialCode: 'P-1X6X8-WRC',
    railMaterialCode: '2X4X8-PT',
    isActive: true,
  },
];

// ============================================================================
// WOOD HORIZONTAL PRODUCTS
// ============================================================================

export const mockWoodHorizontalProducts: WoodHorizontalProduct[] = [
  {
    id: 'wh-std-6',
    name: 'Standard 6ft Wood Horizontal',
    height: 72,
    postSpacing: 96,
    boardWidth: 5.5,
    postType: 'wood',
    postMaterialCode: '6X6X8-PT',
    boardMaterialCode: '1X6X8-WRC',
    spacerMaterialCode: '2X4-SPACER',
    isActive: true,
  },
  {
    id: 'wh-std-4',
    name: 'Standard 4ft Wood Horizontal',
    height: 48,
    postSpacing: 96,
    boardWidth: 5.5,
    postType: 'wood',
    postMaterialCode: '4X4X6-PT',
    boardMaterialCode: '1X6X6-WRC',
    isActive: true,
  },
];

// ============================================================================
// IRON PRODUCTS
// ============================================================================

export const mockIronProducts: IronProduct[] = [
  {
    id: 'iron-std-6',
    name: 'Standard 6ft Iron Fence',
    height: 6,
    panelWidth: 8,
    postType: 'steel',
    postMaterialCode: 'IRON-POST-6FT',
    panelMaterialCode: 'IRON-PANEL-6X8',
    isActive: true,
  },
  {
    id: 'iron-std-4',
    name: 'Standard 4ft Iron Fence',
    height: 4,
    panelWidth: 8,
    postType: 'steel',
    postMaterialCode: 'IRON-POST-4FT',
    panelMaterialCode: 'IRON-PANEL-4X8',
    isActive: true,
  },
  {
    id: 'iron-std-5',
    name: 'Standard 5ft Iron Fence',
    height: 5,
    panelWidth: 8,
    postType: 'steel',
    postMaterialCode: 'IRON-POST-5FT',
    panelMaterialCode: 'IRON-PANEL-5X8',
    isActive: true,
  },
];

// ============================================================================
// MATERIALS (Reference)
// ============================================================================

export const mockMaterials: Material[] = [
  // Posts
  {
    id: 'mat-1',
    materialCode: '6X6X8-PT',
    description: '6x6x8 Pressure Treated Post',
    unit: 'EA',
    unitCost: 45.0,
    category: 'post',
    qboItemName: 'Post 6x6x8 PT',
  },
  {
    id: 'mat-2',
    materialCode: '4X4X6-PT',
    description: '4x4x6 Pressure Treated Post',
    unit: 'EA',
    unitCost: 22.0,
    category: 'post',
    qboItemName: 'Post 4x4x6 PT',
  },
  {
    id: 'mat-3',
    materialCode: '6X6X10-PT',
    description: '6x6x10 Pressure Treated Post',
    unit: 'EA',
    unitCost: 65.0,
    category: 'post',
    qboItemName: 'Post 6x6x10 PT',
  },

  // Pickets
  {
    id: 'mat-4',
    materialCode: 'P-1X6X6-WRC',
    description: '1x6x6 Western Red Cedar Picket',
    unit: 'EA',
    unitCost: 8.5,
    category: 'picket',
    qboItemName: 'Picket 1x6x6 WRC',
  },
  {
    id: 'mat-5',
    materialCode: 'P-1X6X4-WRC',
    description: '1x6x4 Western Red Cedar Picket',
    unit: 'EA',
    unitCost: 5.75,
    category: 'picket',
    qboItemName: 'Picket 1x6x4 WRC',
  },
  {
    id: 'mat-6',
    materialCode: 'P-1X6X8-WRC',
    description: '1x6x8 Western Red Cedar Picket',
    unit: 'EA',
    unitCost: 12.0,
    category: 'picket',
    qboItemName: 'Picket 1x6x8 WRC',
  },

  // Rails
  {
    id: 'mat-7',
    materialCode: '2X4X8-PT',
    description: '2x4x8 Pressure Treated Rail',
    unit: 'EA',
    unitCost: 6.5,
    category: 'rail',
    qboItemName: 'Rail 2x4x8 PT',
  },

  // Boards (Horizontal)
  {
    id: 'mat-8',
    materialCode: '1X6X8-WRC',
    description: '1x6x8 Western Red Cedar Board',
    unit: 'BF',
    unitCost: 4.25,
    category: 'board',
    qboItemName: 'Board 1x6x8 WRC',
  },
  {
    id: 'mat-9',
    materialCode: '1X6X6-WRC',
    description: '1x6x6 Western Red Cedar Board',
    unit: 'BF',
    unitCost: 3.5,
    category: 'board',
    qboItemName: 'Board 1x6x6 WRC',
  },

  // Iron
  {
    id: 'mat-10',
    materialCode: 'IRON-POST-6FT',
    description: '6ft Iron Post',
    unit: 'EA',
    unitCost: 85.0,
    category: 'post',
    qboItemName: 'Iron Post 6ft',
  },
  {
    id: 'mat-11',
    materialCode: 'IRON-PANEL-6X8',
    description: '6ft x 8ft Iron Panel',
    unit: 'EA',
    unitCost: 320.0,
    category: 'panel',
    qboItemName: 'Iron Panel 6x8',
  },

  // Concrete & Hardware (project-level)
  {
    id: 'mat-12',
    materialCode: 'CONC-80LB-BAG',
    description: '80lb Concrete Bag',
    unit: 'EA',
    unitCost: 5.5,
    category: 'concrete',
    qboItemName: 'Concrete 80lb Bag',
  },
  {
    id: 'mat-13',
    materialCode: 'SCREW-3IN-LB',
    description: '3" Deck Screws (per lb)',
    unit: 'LB',
    unitCost: 12.0,
    category: 'hardware',
    qboItemName: 'Screws 3in',
  },
];

// ============================================================================
// LABOR CODES (Reference)
// ============================================================================

export const mockLaborCodes: LaborCode[] = [
  // Wood Vertical Installation
  {
    id: 'lab-1',
    code: 'W-INST-WV-6',
    description: 'Wood Vertical 6ft Installation',
    fenceType: 'wood_vertical',
    heightCategory: '6ft',
    unit: 'LF',
    baseRate: 12.0,
    businessUnit: 'austin',
  },
  {
    id: 'lab-2',
    code: 'W-INST-WV-4',
    description: 'Wood Vertical 4ft Installation',
    fenceType: 'wood_vertical',
    heightCategory: '4ft',
    unit: 'LF',
    baseRate: 9.0,
    businessUnit: 'austin',
  },
  {
    id: 'lab-3',
    code: 'W-INST-WV-8',
    description: 'Wood Vertical 8ft Installation',
    fenceType: 'wood_vertical',
    heightCategory: '8ft',
    unit: 'LF',
    baseRate: 15.0,
    businessUnit: 'austin',
  },

  // Wood Horizontal Installation
  {
    id: 'lab-4',
    code: 'W-INST-WH-6',
    description: 'Wood Horizontal 6ft Installation',
    fenceType: 'wood_horizontal',
    heightCategory: '6ft',
    unit: 'LF',
    baseRate: 13.5,
    businessUnit: 'austin',
  },
  {
    id: 'lab-5',
    code: 'W-INST-WH-4',
    description: 'Wood Horizontal 4ft Installation',
    fenceType: 'wood_horizontal',
    heightCategory: '4ft',
    unit: 'LF',
    baseRate: 10.0,
    businessUnit: 'austin',
  },

  // Iron Installation (uses M-codes because postType='steel')
  {
    id: 'lab-6',
    code: 'M-INST-IRON-6',
    description: 'Iron 6ft Installation',
    fenceType: 'iron',
    heightCategory: '6ft',
    unit: 'LF',
    baseRate: 18.0,
    businessUnit: 'austin',
  },
  {
    id: 'lab-7',
    code: 'M-INST-IRON-4',
    description: 'Iron 4ft Installation',
    fenceType: 'iron',
    heightCategory: '4ft',
    unit: 'LF',
    baseRate: 14.0,
    businessUnit: 'austin',
  },
  {
    id: 'lab-8',
    code: 'M-INST-IRON-5',
    description: 'Iron 5ft Installation',
    fenceType: 'iron',
    heightCategory: '5ft',
    unit: 'LF',
    baseRate: 16.0,
    businessUnit: 'austin',
  },
];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

export function getProductsByType(fenceType: 'wood_vertical' | 'wood_horizontal' | 'iron') {
  switch (fenceType) {
    case 'wood_vertical':
      return mockWoodVerticalProducts;
    case 'wood_horizontal':
      return mockWoodHorizontalProducts;
    case 'iron':
      return mockIronProducts;
  }
}

export function getMaterialByCode(materialCode: string): Material | undefined {
  return mockMaterials.find((m) => m.materialCode === materialCode);
}

export function getLaborCode(fenceType: string, heightCategory: string): LaborCode | undefined {
  return mockLaborCodes.find(
    (l) => l.fenceType === fenceType && l.heightCategory === heightCategory
  );
}
