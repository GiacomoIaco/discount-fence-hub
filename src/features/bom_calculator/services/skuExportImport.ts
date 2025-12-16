import * as XLSX from 'xlsx';
import { supabase } from '../../../lib/supabase';

// ============================================
// SKU Export/Import Service
// ============================================
// Exports SKUs in horizontal format with material SKU codes
// Organizes by tabs per product type

// Column definitions per product type
export const WOOD_VERTICAL_COLUMNS = [
  'sku_code', 'sku_name', 'height', 'post_type', 'rail_count', 'style', 'post_spacing',
  'post', 'picket', 'rail', 'cap', 'trim', 'rot_board', 'steel_post_cap', 'bracket'
] as const;

export const WOOD_HORIZONTAL_COLUMNS = [
  'sku_code', 'sku_name', 'height', 'post_type', 'style', 'post_spacing', 'board_width',
  'post', 'board', 'nailer', 'cap', 'vertical_trim'
] as const;

export const IRON_COLUMNS = [
  'sku_code', 'sku_name', 'height', 'style', 'panel_width', 'rails_per_panel',
  'post', 'panel', 'bracket', 'rail', 'picket'
] as const;

export const CUSTOM_COLUMNS = [
  'sku_code', 'sku_name', 'category', 'unit_basis', 'base_material_cost', 'notes'
] as const;

// Type definitions for export rows
interface WoodVerticalExportRow {
  sku_code: string;
  sku_name: string;
  height: number;
  post_type: string;
  rail_count: number;
  style: string;
  post_spacing: number;
  post: string;
  picket: string;
  rail: string;
  cap: string;
  trim: string;
  rot_board: string;
  steel_post_cap: string;
  bracket: string;
}

interface WoodHorizontalExportRow {
  sku_code: string;
  sku_name: string;
  height: number;
  post_type: string;
  style: string;
  post_spacing: number;
  board_width: number;
  post: string;
  board: string;
  nailer: string;
  cap: string;
  vertical_trim: string;
}

interface IronExportRow {
  sku_code: string;
  sku_name: string;
  height: number;
  style: string;
  panel_width: number;
  rails_per_panel: number;
  post: string;
  panel: string;
  bracket: string;
  rail: string;
  picket: string;
}

interface CustomExportRow {
  sku_code: string;
  sku_name: string;
  category: string;
  unit_basis: string;
  base_material_cost: number;
  notes: string;
}

// Helper to get material SKU by ID
async function getMaterialMap(): Promise<Map<string, string>> {
  const { data: materials } = await supabase
    .from('materials')
    .select('id, material_sku');

  const map = new Map<string, string>();
  (materials || []).forEach(m => map.set(m.id, m.material_sku));
  return map;
}

// ============================================
// EXPORT FUNCTIONS
// ============================================

export async function exportSKUsToExcel(): Promise<Blob> {
  // Get material mapping (ID -> SKU code)
  const materialMap = await getMaterialMap();

  // Fetch all product types
  const [woodVertical, woodHorizontal, iron, custom] = await Promise.all([
    fetchWoodVerticalForExport(materialMap),
    fetchWoodHorizontalForExport(materialMap),
    fetchIronForExport(materialMap),
    fetchCustomForExport(),
  ]);

  // Create workbook with tabs
  const workbook = XLSX.utils.book_new();

  // Tab 1: Wood Vertical
  if (woodVertical.length > 0) {
    const wvSheet = XLSX.utils.json_to_sheet(woodVertical);
    wvSheet['!cols'] = [
      { wch: 10 }, // sku_code
      { wch: 40 }, // sku_name
      { wch: 8 },  // height
      { wch: 10 }, // post_type
      { wch: 10 }, // rail_count
      { wch: 18 }, // style
      { wch: 12 }, // post_spacing
      { wch: 8 },  // post
      { wch: 8 },  // picket
      { wch: 8 },  // rail
      { wch: 8 },  // cap
      { wch: 8 },  // trim
      { wch: 10 }, // rot_board
      { wch: 14 }, // steel_post_cap
      { wch: 10 }, // bracket
    ];
    XLSX.utils.book_append_sheet(workbook, wvSheet, 'Wood Vertical');
  }

  // Tab 2: Wood Horizontal
  if (woodHorizontal.length > 0) {
    const whSheet = XLSX.utils.json_to_sheet(woodHorizontal);
    whSheet['!cols'] = [
      { wch: 10 }, // sku_code
      { wch: 40 }, // sku_name
      { wch: 8 },  // height
      { wch: 10 }, // post_type
      { wch: 18 }, // style
      { wch: 12 }, // post_spacing
      { wch: 12 }, // board_width
      { wch: 8 },  // post
      { wch: 8 },  // board
      { wch: 8 },  // nailer
      { wch: 8 },  // cap
      { wch: 12 }, // vertical_trim
    ];
    XLSX.utils.book_append_sheet(workbook, whSheet, 'Wood Horizontal');
  }

  // Tab 3: Iron
  if (iron.length > 0) {
    const ironSheet = XLSX.utils.json_to_sheet(iron);
    ironSheet['!cols'] = [
      { wch: 10 }, // sku_code
      { wch: 40 }, // sku_name
      { wch: 8 },  // height
      { wch: 18 }, // style
      { wch: 12 }, // panel_width
      { wch: 14 }, // rails_per_panel
      { wch: 8 },  // post
      { wch: 8 },  // panel
      { wch: 10 }, // bracket
      { wch: 8 },  // rail
      { wch: 8 },  // picket
    ];
    XLSX.utils.book_append_sheet(workbook, ironSheet, 'Iron');
  }

  // Tab 4: Custom/Service
  if (custom.length > 0) {
    const customSheet = XLSX.utils.json_to_sheet(custom);
    customSheet['!cols'] = [
      { wch: 12 }, // sku_code
      { wch: 40 }, // sku_name
      { wch: 15 }, // category
      { wch: 10 }, // unit_basis
      { wch: 16 }, // base_material_cost
      { wch: 40 }, // notes
    ];
    XLSX.utils.book_append_sheet(workbook, customSheet, 'Custom');
  }

  // Write to buffer and return as Blob
  const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  return new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

async function fetchWoodVerticalForExport(materialMap: Map<string, string>): Promise<WoodVerticalExportRow[]> {
  const { data, error } = await supabase
    .from('wood_vertical_products')
    .select(`
      sku_code, sku_name, height, post_type, rail_count, style, post_spacing,
      post_material_id, picket_material_id, rail_material_id,
      cap_material_id, trim_material_id, rot_board_material_id
    `)
    .order('sku_code');

  if (error || !data) return [];

  return data.map(row => ({
    sku_code: row.sku_code,
    sku_name: row.sku_name,
    height: row.height,
    post_type: row.post_type,
    rail_count: row.rail_count,
    style: row.style,
    post_spacing: row.post_spacing || 8,
    post: materialMap.get(row.post_material_id) || '',
    picket: materialMap.get(row.picket_material_id) || '',
    rail: materialMap.get(row.rail_material_id) || '',
    cap: row.cap_material_id ? (materialMap.get(row.cap_material_id) || '') : '',
    trim: row.trim_material_id ? (materialMap.get(row.trim_material_id) || '') : '',
    rot_board: row.rot_board_material_id ? (materialMap.get(row.rot_board_material_id) || '') : '',
    steel_post_cap: '', // These are computed from post_type, not stored
    bracket: '',
  }));
}

async function fetchWoodHorizontalForExport(materialMap: Map<string, string>): Promise<WoodHorizontalExportRow[]> {
  const { data, error } = await supabase
    .from('wood_horizontal_products')
    .select(`
      sku_code, sku_name, height, post_type, style, post_spacing, board_width_actual,
      post_material_id, board_material_id, nailer_material_id, cap_material_id
    `)
    .order('sku_code');

  if (error || !data) return [];

  return data.map(row => ({
    sku_code: row.sku_code,
    sku_name: row.sku_name,
    height: row.height,
    post_type: row.post_type,
    style: row.style,
    post_spacing: row.post_spacing || 6,
    board_width: row.board_width_actual,
    post: materialMap.get(row.post_material_id) || '',
    board: row.board_material_id ? (materialMap.get(row.board_material_id) || '') : '',
    nailer: row.nailer_material_id ? (materialMap.get(row.nailer_material_id) || '') : '',
    cap: row.cap_material_id ? (materialMap.get(row.cap_material_id) || '') : '',
    vertical_trim: '',
  }));
}

async function fetchIronForExport(materialMap: Map<string, string>): Promise<IronExportRow[]> {
  const { data, error } = await supabase
    .from('iron_products')
    .select(`
      sku_code, sku_name, height, style, panel_width, rails_per_panel,
      post_material_id, panel_material_id, bracket_material_id, rail_material_id, picket_material_id
    `)
    .order('sku_code');

  if (error || !data) return [];

  return data.map(row => ({
    sku_code: row.sku_code,
    sku_name: row.sku_name,
    height: row.height,
    style: row.style,
    panel_width: row.panel_width || 8,
    rails_per_panel: row.rails_per_panel || 0,
    post: materialMap.get(row.post_material_id) || '',
    panel: row.panel_material_id ? (materialMap.get(row.panel_material_id) || '') : '',
    bracket: row.bracket_material_id ? (materialMap.get(row.bracket_material_id) || '') : '',
    rail: row.rail_material_id ? (materialMap.get(row.rail_material_id) || '') : '',
    picket: row.picket_material_id ? (materialMap.get(row.picket_material_id) || '') : '',
  }));
}

async function fetchCustomForExport(): Promise<CustomExportRow[]> {
  const { data, error } = await supabase
    .from('custom_products')
    .select('sku_code, sku_name, category, unit_basis, standard_material_cost, notes')
    .order('sku_code');

  if (error || !data) return [];

  return data.map(row => ({
    sku_code: row.sku_code,
    sku_name: row.sku_name,
    category: row.category || '',
    unit_basis: row.unit_basis,
    base_material_cost: row.standard_material_cost || 0,
    notes: row.notes || '',
  }));
}

// ============================================
// TEMPLATE EXPORT (Empty template with headers)
// ============================================

export function exportTemplateToExcel(): Blob {
  const workbook = XLSX.utils.book_new();

  // Tab 1: Wood Vertical template
  const wvData = [Object.fromEntries(WOOD_VERTICAL_COLUMNS.map(c => [c, '']))];
  const wvSheet = XLSX.utils.json_to_sheet(wvData);
  wvSheet['!cols'] = WOOD_VERTICAL_COLUMNS.map(() => ({ wch: 12 }));
  XLSX.utils.book_append_sheet(workbook, wvSheet, 'Wood Vertical');

  // Tab 2: Wood Horizontal template
  const whData = [Object.fromEntries(WOOD_HORIZONTAL_COLUMNS.map(c => [c, '']))];
  const whSheet = XLSX.utils.json_to_sheet(whData);
  whSheet['!cols'] = WOOD_HORIZONTAL_COLUMNS.map(() => ({ wch: 12 }));
  XLSX.utils.book_append_sheet(workbook, whSheet, 'Wood Horizontal');

  // Tab 3: Iron template
  const ironData = [Object.fromEntries(IRON_COLUMNS.map(c => [c, '']))];
  const ironSheet = XLSX.utils.json_to_sheet(ironData);
  ironSheet['!cols'] = IRON_COLUMNS.map(() => ({ wch: 12 }));
  XLSX.utils.book_append_sheet(workbook, ironSheet, 'Iron');

  // Tab 4: Custom template
  const customData = [Object.fromEntries(CUSTOM_COLUMNS.map(c => [c, '']))];
  const customSheet = XLSX.utils.json_to_sheet(customData);
  customSheet['!cols'] = CUSTOM_COLUMNS.map(() => ({ wch: 12 }));
  XLSX.utils.book_append_sheet(workbook, customSheet, 'Custom');

  const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  return new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

// ============================================
// IMPORT FUNCTIONS
// ============================================

export interface ImportResult {
  success: boolean;
  imported: number;
  skipped: number;
  errors: string[];
  details: {
    woodVertical: { imported: number; skipped: number };
    woodHorizontal: { imported: number; skipped: number };
    iron: { imported: number; skipped: number };
    custom: { imported: number; skipped: number };
  };
}

export async function importSKUsFromExcel(file: File): Promise<ImportResult> {
  const result: ImportResult = {
    success: true,
    imported: 0,
    skipped: 0,
    errors: [],
    details: {
      woodVertical: { imported: 0, skipped: 0 },
      woodHorizontal: { imported: 0, skipped: 0 },
      iron: { imported: 0, skipped: 0 },
      custom: { imported: 0, skipped: 0 },
    },
  };

  try {
    // Read file
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array' });

    // Get material SKU -> ID mapping
    const { data: materials } = await supabase.from('materials').select('id, material_sku');
    const materialIdMap = new Map<string, string>();
    (materials || []).forEach(m => materialIdMap.set(m.material_sku, m.id));

    // Process each sheet
    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(sheet) as Record<string, unknown>[];

      if (rows.length === 0) continue;

      const normalizedName = sheetName.toLowerCase().replace(/\s+/g, '-');

      if (normalizedName.includes('wood-vertical') || normalizedName === 'wood vertical') {
        const importResult = await importWoodVertical(rows, materialIdMap);
        result.details.woodVertical = importResult;
        result.imported += importResult.imported;
        result.skipped += importResult.skipped;
      } else if (normalizedName.includes('wood-horizontal') || normalizedName === 'wood horizontal') {
        const importResult = await importWoodHorizontal(rows, materialIdMap);
        result.details.woodHorizontal = importResult;
        result.imported += importResult.imported;
        result.skipped += importResult.skipped;
      } else if (normalizedName.includes('iron')) {
        const importResult = await importIron(rows, materialIdMap);
        result.details.iron = importResult;
        result.imported += importResult.imported;
        result.skipped += importResult.skipped;
      } else if (normalizedName.includes('custom') || normalizedName.includes('service')) {
        const importResult = await importCustom(rows);
        result.details.custom = importResult;
        result.imported += importResult.imported;
        result.skipped += importResult.skipped;
      }
    }
  } catch (error) {
    result.success = false;
    result.errors.push(error instanceof Error ? error.message : 'Unknown error during import');
  }

  return result;
}

async function importWoodVertical(
  rows: Record<string, unknown>[],
  materialIdMap: Map<string, string>
): Promise<{ imported: number; skipped: number }> {
  let imported = 0;
  let skipped = 0;

  for (const row of rows) {
    const skuCode = String(row.sku_code || '').trim();
    if (!skuCode) {
      skipped++;
      continue;
    }

    // Get material IDs from SKU codes
    const postMaterialId = materialIdMap.get(String(row.post || ''));
    const picketMaterialId = materialIdMap.get(String(row.picket || ''));
    const railMaterialId = materialIdMap.get(String(row.rail || ''));
    const capMaterialId = row.cap ? materialIdMap.get(String(row.cap)) : null;
    const trimMaterialId = row.trim ? materialIdMap.get(String(row.trim)) : null;
    const rotBoardMaterialId = row.rot_board ? materialIdMap.get(String(row.rot_board)) : null;

    // Required materials
    if (!postMaterialId || !picketMaterialId || !railMaterialId) {
      skipped++;
      continue;
    }

    const { error } = await supabase
      .from('wood_vertical_products')
      .upsert({
        sku_code: skuCode,
        sku_name: String(row.sku_name || skuCode),
        height: Number(row.height) || 6,
        post_type: String(row.post_type || 'WOOD').toUpperCase(),
        rail_count: Number(row.rail_count) || 2,
        style: String(row.style || 'standard'),
        post_spacing: Number(row.post_spacing) || 8,
        post_material_id: postMaterialId,
        picket_material_id: picketMaterialId,
        rail_material_id: railMaterialId,
        cap_material_id: capMaterialId || null,
        trim_material_id: trimMaterialId || null,
        rot_board_material_id: rotBoardMaterialId || null,
        is_active: true,
      }, { onConflict: 'sku_code' });

    if (error) {
      console.error('Import error for', skuCode, error);
      skipped++;
    } else {
      imported++;
    }
  }

  return { imported, skipped };
}

async function importWoodHorizontal(
  rows: Record<string, unknown>[],
  materialIdMap: Map<string, string>
): Promise<{ imported: number; skipped: number }> {
  let imported = 0;
  let skipped = 0;

  for (const row of rows) {
    const skuCode = String(row.sku_code || '').trim();
    if (!skuCode) {
      skipped++;
      continue;
    }

    const postMaterialId = materialIdMap.get(String(row.post || ''));
    const boardMaterialId = row.board ? materialIdMap.get(String(row.board)) : null;
    const nailerMaterialId = row.nailer ? materialIdMap.get(String(row.nailer)) : null;
    const capMaterialId = row.cap ? materialIdMap.get(String(row.cap)) : null;

    if (!postMaterialId) {
      skipped++;
      continue;
    }

    const { error } = await supabase
      .from('wood_horizontal_products')
      .upsert({
        sku_code: skuCode,
        sku_name: String(row.sku_name || skuCode),
        height: Number(row.height) || 6,
        post_type: String(row.post_type || 'WOOD').toUpperCase(),
        style: String(row.style || 'flat-fence'),
        post_spacing: Number(row.post_spacing) || 6,
        board_width_actual: Number(row.board_width) || 5.5,
        post_material_id: postMaterialId,
        board_material_id: boardMaterialId || null,
        nailer_material_id: nailerMaterialId || null,
        cap_material_id: capMaterialId || null,
        is_active: true,
      }, { onConflict: 'sku_code' });

    if (error) {
      skipped++;
    } else {
      imported++;
    }
  }

  return { imported, skipped };
}

async function importIron(
  rows: Record<string, unknown>[],
  materialIdMap: Map<string, string>
): Promise<{ imported: number; skipped: number }> {
  let imported = 0;
  let skipped = 0;

  for (const row of rows) {
    const skuCode = String(row.sku_code || '').trim();
    if (!skuCode) {
      skipped++;
      continue;
    }

    const postMaterialId = materialIdMap.get(String(row.post || ''));
    const panelMaterialId = row.panel ? materialIdMap.get(String(row.panel)) : null;
    const bracketMaterialId = row.bracket ? materialIdMap.get(String(row.bracket)) : null;
    const railMaterialId = row.rail ? materialIdMap.get(String(row.rail)) : null;
    const picketMaterialId = row.picket ? materialIdMap.get(String(row.picket)) : null;

    if (!postMaterialId) {
      skipped++;
      continue;
    }

    const { error } = await supabase
      .from('iron_products')
      .upsert({
        sku_code: skuCode,
        sku_name: String(row.sku_name || skuCode),
        height: Number(row.height) || 4,
        post_type: 'STEEL',
        style: String(row.style || 'standard'),
        panel_width: Number(row.panel_width) || 8,
        rails_per_panel: Number(row.rails_per_panel) || 0,
        post_material_id: postMaterialId,
        panel_material_id: panelMaterialId || null,
        bracket_material_id: bracketMaterialId || null,
        rail_material_id: railMaterialId || null,
        picket_material_id: picketMaterialId || null,
        is_active: true,
      }, { onConflict: 'sku_code' });

    if (error) {
      skipped++;
    } else {
      imported++;
    }
  }

  return { imported, skipped };
}

async function importCustom(
  rows: Record<string, unknown>[]
): Promise<{ imported: number; skipped: number }> {
  let imported = 0;
  let skipped = 0;

  for (const row of rows) {
    const skuCode = String(row.sku_code || '').trim();
    if (!skuCode) {
      skipped++;
      continue;
    }

    const { error } = await supabase
      .from('custom_products')
      .upsert({
        sku_code: skuCode,
        sku_name: String(row.sku_name || skuCode),
        category: row.category ? String(row.category) : null,
        unit_basis: String(row.unit_basis || 'EA'),
        standard_material_cost: row.base_material_cost ? Number(row.base_material_cost) : null,
        notes: row.notes ? String(row.notes) : null,
        is_active: true,
      }, { onConflict: 'sku_code' });

    if (error) {
      skipped++;
    } else {
      imported++;
    }
  }

  return { imported, skipped };
}

// Helper to trigger download
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
