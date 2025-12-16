import * as XLSX from 'xlsx';
import { supabase } from '../../../lib/supabase';

// ============================================
// SKU Export/Import Service for V2
// ============================================
// Exports SKUs from sku_catalog_v2 in horizontal format with material SKU codes
// Organizes by tabs per product type

// V2 uses JSONB columns for variables and components
// Export format: sku_code, sku_name, product_type, style, variables..., components...

// Column definitions per product type (V2 format)
export const WOOD_VERTICAL_COLUMNS = [
  'sku_code', 'sku_name', 'style', 'height', 'post_type', 'rail_count', 'post_spacing',
  'post', 'picket', 'rail', 'cap', 'trim', 'rot_board', 'steel_post_cap', 'bracket'
] as const;

export const WOOD_HORIZONTAL_COLUMNS = [
  'sku_code', 'sku_name', 'style', 'height', 'post_type', 'post_spacing', 'board_width',
  'post', 'board', 'nailer', 'cap', 'vertical_trim'
] as const;

export const IRON_COLUMNS = [
  'sku_code', 'sku_name', 'style', 'height', 'panel_width', 'rails_per_panel',
  'post', 'panel', 'bracket', 'rail', 'picket'
] as const;

export const CHAIN_LINK_COLUMNS = [
  'sku_code', 'sku_name', 'style', 'height', 'gauge', 'mesh_size', 'post_spacing', 'coating',
  'mesh', 'line_post', 'terminal_post', 'top_rail', 'tension_wire', 'tie_wire',
  'dome_cap', 'loop_cap', 'eye_top', 'rail_end', 'tension_bar', 'tension_band',
  'brace_band', 'rail_clamp', 'hog_ring'
] as const;

// Type definitions for export rows
interface WoodVerticalExportRow {
  sku_code: string;
  sku_name: string;
  style: string;
  height: number;
  post_type: string;
  rail_count: number;
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
  style: string;
  height: number;
  post_type: string;
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
  style: string;
  height: number;
  panel_width: number;
  rails_per_panel: number;
  post: string;
  panel: string;
  bracket: string;
  rail: string;
  picket: string;
}

interface ChainLinkExportRow {
  sku_code: string;
  sku_name: string;
  style: string;
  height: number;
  gauge: string;
  mesh_size: number;
  post_spacing: number;
  coating: string;
  mesh: string;
  line_post: string;
  terminal_post: string;
  top_rail: string;
  tension_wire: string;
  tie_wire: string;
  dome_cap: string;
  loop_cap: string;
  eye_top: string;
  rail_end: string;
  tension_bar: string;
  tension_band: string;
  brace_band: string;
  rail_clamp: string;
  hog_ring: string;
}

// ============================================
// EXPORT FUNCTIONS
// ============================================

export async function exportSKUsToExcelV2(): Promise<Blob> {
  // Fetch all SKUs from sku_catalog_v2 with relations
  const { data: skus, error } = await supabase
    .from('sku_catalog_v2')
    .select(`
      id,
      sku_code,
      sku_name,
      height,
      post_type,
      variables,
      components,
      is_active,
      product_type:product_types_v2(id, code, name),
      product_style:product_styles_v2(id, code, name)
    `)
    .eq('is_active', true)
    .order('sku_code');

  if (error) {
    console.error('Failed to fetch SKUs:', error);
    throw new Error('Failed to fetch SKUs');
  }

  // Group SKUs by product type
  const woodVertical: WoodVerticalExportRow[] = [];
  const woodHorizontal: WoodHorizontalExportRow[] = [];
  const iron: IronExportRow[] = [];
  const chainLink: ChainLinkExportRow[] = [];

  for (const sku of skus || []) {
    const productType = (sku.product_type as unknown as { code: string } | null)?.code || '';
    const styleName = (sku.product_style as unknown as { name: string } | null)?.name || '';
    const variables = (sku.variables || {}) as Record<string, unknown>;
    const components = (sku.components || {}) as Record<string, string>;

    if (productType === 'wood-vertical') {
      woodVertical.push({
        sku_code: sku.sku_code,
        sku_name: sku.sku_name,
        style: styleName,
        height: sku.height,
        post_type: sku.post_type,
        rail_count: (variables.rail_count as number) || 2,
        post_spacing: (variables.post_spacing as number) || 8,
        post: components.post || '',
        picket: components.picket || '',
        rail: components.rail || '',
        cap: components.cap || '',
        trim: components.trim || '',
        rot_board: components.rot_board || '',
        steel_post_cap: components.steel_post_cap || '',
        bracket: components.bracket || '',
      });
    } else if (productType === 'wood-horizontal') {
      woodHorizontal.push({
        sku_code: sku.sku_code,
        sku_name: sku.sku_name,
        style: styleName,
        height: sku.height,
        post_type: sku.post_type,
        post_spacing: (variables.post_spacing as number) || 6,
        board_width: (variables.board_width as number) || 6,
        post: components.post || '',
        board: components.board || '',
        nailer: components.nailer || '',
        cap: components.cap || '',
        vertical_trim: components.vertical_trim || '',
      });
    } else if (productType === 'iron') {
      iron.push({
        sku_code: sku.sku_code,
        sku_name: sku.sku_name,
        style: styleName,
        height: sku.height,
        panel_width: (variables.panel_width as number) || 72,
        rails_per_panel: (variables.rails_per_panel as number) || 2,
        post: components.post || '',
        panel: components.panel || '',
        bracket: components.bracket || '',
        rail: components.rail || '',
        picket: components.picket || '',
      });
    } else if (productType === 'chain-link') {
      chainLink.push({
        sku_code: sku.sku_code,
        sku_name: sku.sku_name,
        style: styleName,
        height: sku.height,
        gauge: String(variables.gauge || '11'),
        mesh_size: (variables.mesh_size as number) || 2,
        post_spacing: (variables.post_spacing as number) || 10,
        coating: (variables.coating as string) || 'galvanized',
        mesh: components.mesh || '',
        line_post: components.line_post || '',
        terminal_post: components.terminal_post || '',
        top_rail: components.top_rail || '',
        tension_wire: components.tension_wire || '',
        tie_wire: components.tie_wire || '',
        dome_cap: components.dome_cap || '',
        loop_cap: components.loop_cap || '',
        eye_top: components.eye_top || '',
        rail_end: components.rail_end || '',
        tension_bar: components.tension_bar || '',
        tension_band: components.tension_band || '',
        brace_band: components.brace_band || '',
        rail_clamp: components.rail_clamp || '',
        hog_ring: components.hog_ring || '',
      });
    }
  }

  // Create workbook with tabs
  const workbook = XLSX.utils.book_new();

  // Tab 1: Wood Vertical
  if (woodVertical.length > 0) {
    const wvSheet = XLSX.utils.json_to_sheet(woodVertical);
    wvSheet['!cols'] = WOOD_VERTICAL_COLUMNS.map(() => ({ wch: 12 }));
    XLSX.utils.book_append_sheet(workbook, wvSheet, 'Wood Vertical');
  }

  // Tab 2: Wood Horizontal
  if (woodHorizontal.length > 0) {
    const whSheet = XLSX.utils.json_to_sheet(woodHorizontal);
    whSheet['!cols'] = WOOD_HORIZONTAL_COLUMNS.map(() => ({ wch: 12 }));
    XLSX.utils.book_append_sheet(workbook, whSheet, 'Wood Horizontal');
  }

  // Tab 3: Iron
  if (iron.length > 0) {
    const ironSheet = XLSX.utils.json_to_sheet(iron);
    ironSheet['!cols'] = IRON_COLUMNS.map(() => ({ wch: 12 }));
    XLSX.utils.book_append_sheet(workbook, ironSheet, 'Iron');
  }

  // Tab 4: Chain Link
  if (chainLink.length > 0) {
    const clSheet = XLSX.utils.json_to_sheet(chainLink);
    clSheet['!cols'] = CHAIN_LINK_COLUMNS.map(() => ({ wch: 12 }));
    XLSX.utils.book_append_sheet(workbook, clSheet, 'Chain Link');
  }

  // If no data, add empty sheets with headers
  if (woodVertical.length === 0) {
    const emptyWv = XLSX.utils.json_to_sheet([Object.fromEntries(WOOD_VERTICAL_COLUMNS.map(c => [c, '']))]);
    XLSX.utils.book_append_sheet(workbook, emptyWv, 'Wood Vertical');
  }
  if (woodHorizontal.length === 0 && !workbook.SheetNames.includes('Wood Horizontal')) {
    const emptyWh = XLSX.utils.json_to_sheet([Object.fromEntries(WOOD_HORIZONTAL_COLUMNS.map(c => [c, '']))]);
    XLSX.utils.book_append_sheet(workbook, emptyWh, 'Wood Horizontal');
  }
  if (iron.length === 0 && !workbook.SheetNames.includes('Iron')) {
    const emptyIron = XLSX.utils.json_to_sheet([Object.fromEntries(IRON_COLUMNS.map(c => [c, '']))]);
    XLSX.utils.book_append_sheet(workbook, emptyIron, 'Iron');
  }
  if (chainLink.length === 0 && !workbook.SheetNames.includes('Chain Link')) {
    const emptyCl = XLSX.utils.json_to_sheet([Object.fromEntries(CHAIN_LINK_COLUMNS.map(c => [c, '']))]);
    XLSX.utils.book_append_sheet(workbook, emptyCl, 'Chain Link');
  }

  // Write to buffer and return as Blob
  const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  return new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

// ============================================
// TEMPLATE EXPORT (Empty template with headers)
// ============================================

export function exportTemplateToExcelV2(): Blob {
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

  // Tab 4: Chain Link template
  const clData = [Object.fromEntries(CHAIN_LINK_COLUMNS.map(c => [c, '']))];
  const clSheet = XLSX.utils.json_to_sheet(clData);
  clSheet['!cols'] = CHAIN_LINK_COLUMNS.map(() => ({ wch: 12 }));
  XLSX.utils.book_append_sheet(workbook, clSheet, 'Chain Link');

  const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  return new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

// ============================================
// IMPORT FUNCTIONS
// ============================================

export interface ImportResultV2 {
  success: boolean;
  imported: number;
  skipped: number;
  errors: string[];
  details: {
    woodVertical: { imported: number; skipped: number };
    woodHorizontal: { imported: number; skipped: number };
    iron: { imported: number; skipped: number };
    chainLink: { imported: number; skipped: number };
  };
}

// Cache for product types and styles
interface ProductTypeCache {
  id: string;
  code: string;
}

interface ProductStyleCache {
  id: string;
  code: string;
  name: string;
  product_type_id: string;
}

export async function importSKUsFromExcelV2(file: File): Promise<ImportResultV2> {
  const result: ImportResultV2 = {
    success: true,
    imported: 0,
    skipped: 0,
    errors: [],
    details: {
      woodVertical: { imported: 0, skipped: 0 },
      woodHorizontal: { imported: 0, skipped: 0 },
      iron: { imported: 0, skipped: 0 },
      chainLink: { imported: 0, skipped: 0 },
    },
  };

  try {
    // Read file
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array' });

    // Fetch product types
    const { data: productTypes } = await supabase
      .from('product_types_v2')
      .select('id, code');
    const productTypeMap = new Map<string, ProductTypeCache>();
    (productTypes || []).forEach(pt => productTypeMap.set(pt.code, pt));

    // Fetch product styles
    const { data: productStyles } = await supabase
      .from('product_styles_v2')
      .select('id, code, name, product_type_id');
    const productStylesByType = new Map<string, ProductStyleCache[]>();
    (productStyles || []).forEach(ps => {
      const list = productStylesByType.get(ps.product_type_id) || [];
      list.push(ps);
      productStylesByType.set(ps.product_type_id, list);
    });

    // Process each sheet
    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(sheet) as Record<string, unknown>[];

      if (rows.length === 0) continue;

      const normalizedName = sheetName.toLowerCase().replace(/\s+/g, '-');

      if (normalizedName.includes('wood-vertical') || normalizedName === 'wood-vertical') {
        const productType = productTypeMap.get('wood-vertical');
        if (productType) {
          const styles = productStylesByType.get(productType.id) || [];
          const importResult = await importWoodVerticalV2(rows, productType.id, styles);
          result.details.woodVertical = importResult;
          result.imported += importResult.imported;
          result.skipped += importResult.skipped;
        }
      } else if (normalizedName.includes('wood-horizontal') || normalizedName === 'wood-horizontal') {
        const productType = productTypeMap.get('wood-horizontal');
        if (productType) {
          const styles = productStylesByType.get(productType.id) || [];
          const importResult = await importWoodHorizontalV2(rows, productType.id, styles);
          result.details.woodHorizontal = importResult;
          result.imported += importResult.imported;
          result.skipped += importResult.skipped;
        }
      } else if (normalizedName.includes('iron')) {
        const productType = productTypeMap.get('iron');
        if (productType) {
          const styles = productStylesByType.get(productType.id) || [];
          const importResult = await importIronV2(rows, productType.id, styles);
          result.details.iron = importResult;
          result.imported += importResult.imported;
          result.skipped += importResult.skipped;
        }
      } else if (normalizedName.includes('chain-link') || normalizedName === 'chain-link') {
        const productType = productTypeMap.get('chain-link');
        if (productType) {
          const styles = productStylesByType.get(productType.id) || [];
          const importResult = await importChainLinkV2(rows, productType.id, styles);
          result.details.chainLink = importResult;
          result.imported += importResult.imported;
          result.skipped += importResult.skipped;
        }
      }
    }
  } catch (error) {
    result.success = false;
    result.errors.push(error instanceof Error ? error.message : 'Unknown error during import');
  }

  return result;
}

// Helper to find style by name (case-insensitive partial match)
function findStyle(styleName: string, styles: ProductStyleCache[]): ProductStyleCache | undefined {
  if (!styleName) return styles.find(s => s.code === 'standard') || styles[0];
  const lower = styleName.toLowerCase();
  return styles.find(s =>
    s.name.toLowerCase() === lower ||
    s.code.toLowerCase() === lower ||
    s.name.toLowerCase().includes(lower)
  ) || styles[0];
}

async function importWoodVerticalV2(
  rows: Record<string, unknown>[],
  productTypeId: string,
  styles: ProductStyleCache[]
): Promise<{ imported: number; skipped: number }> {
  let imported = 0;
  let skipped = 0;

  for (const row of rows) {
    const skuCode = String(row.sku_code || '').trim();
    if (!skuCode) {
      skipped++;
      continue;
    }

    const style = findStyle(String(row.style || ''), styles);

    const variables = {
      rail_count: Number(row.rail_count) || 2,
      post_spacing: Number(row.post_spacing) || 8,
    };

    const components: Record<string, string> = {};
    if (row.post) components.post = String(row.post);
    if (row.picket) components.picket = String(row.picket);
    if (row.rail) components.rail = String(row.rail);
    if (row.cap) components.cap = String(row.cap);
    if (row.trim) components.trim = String(row.trim);
    if (row.rot_board) components.rot_board = String(row.rot_board);
    if (row.steel_post_cap) components.steel_post_cap = String(row.steel_post_cap);
    if (row.bracket) components.bracket = String(row.bracket);

    const { error } = await supabase
      .from('sku_catalog_v2')
      .upsert({
        sku_code: skuCode,
        sku_name: String(row.sku_name || skuCode),
        product_type_id: productTypeId,
        product_style_id: style?.id || null,
        height: Number(row.height) || 6,
        post_type: String(row.post_type || 'WOOD').toUpperCase(),
        variables,
        components,
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

async function importWoodHorizontalV2(
  rows: Record<string, unknown>[],
  productTypeId: string,
  styles: ProductStyleCache[]
): Promise<{ imported: number; skipped: number }> {
  let imported = 0;
  let skipped = 0;

  for (const row of rows) {
    const skuCode = String(row.sku_code || '').trim();
    if (!skuCode) {
      skipped++;
      continue;
    }

    const style = findStyle(String(row.style || ''), styles);

    const variables = {
      post_spacing: Number(row.post_spacing) || 6,
      board_width: Number(row.board_width) || 6,
    };

    const components: Record<string, string> = {};
    if (row.post) components.post = String(row.post);
    if (row.board) components.board = String(row.board);
    if (row.nailer) components.nailer = String(row.nailer);
    if (row.cap) components.cap = String(row.cap);
    if (row.vertical_trim) components.vertical_trim = String(row.vertical_trim);

    const { error } = await supabase
      .from('sku_catalog_v2')
      .upsert({
        sku_code: skuCode,
        sku_name: String(row.sku_name || skuCode),
        product_type_id: productTypeId,
        product_style_id: style?.id || null,
        height: Number(row.height) || 6,
        post_type: String(row.post_type || 'WOOD').toUpperCase(),
        variables,
        components,
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

async function importIronV2(
  rows: Record<string, unknown>[],
  productTypeId: string,
  styles: ProductStyleCache[]
): Promise<{ imported: number; skipped: number }> {
  let imported = 0;
  let skipped = 0;

  for (const row of rows) {
    const skuCode = String(row.sku_code || '').trim();
    if (!skuCode) {
      skipped++;
      continue;
    }

    const style = findStyle(String(row.style || ''), styles);

    const variables = {
      panel_width: Number(row.panel_width) || 72,
      rails_per_panel: Number(row.rails_per_panel) || 2,
    };

    const components: Record<string, string> = {};
    if (row.post) components.post = String(row.post);
    if (row.panel) components.panel = String(row.panel);
    if (row.bracket) components.bracket = String(row.bracket);
    if (row.rail) components.rail = String(row.rail);
    if (row.picket) components.picket = String(row.picket);

    const { error } = await supabase
      .from('sku_catalog_v2')
      .upsert({
        sku_code: skuCode,
        sku_name: String(row.sku_name || skuCode),
        product_type_id: productTypeId,
        product_style_id: style?.id || null,
        height: Number(row.height) || 4,
        post_type: 'STEEL',
        variables,
        components,
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

async function importChainLinkV2(
  rows: Record<string, unknown>[],
  productTypeId: string,
  styles: ProductStyleCache[]
): Promise<{ imported: number; skipped: number }> {
  let imported = 0;
  let skipped = 0;

  for (const row of rows) {
    const skuCode = String(row.sku_code || '').trim();
    if (!skuCode) {
      skipped++;
      continue;
    }

    const style = findStyle(String(row.style || ''), styles);

    const variables = {
      gauge: String(row.gauge || '11'),
      mesh_size: Number(row.mesh_size) || 2,
      post_spacing: Number(row.post_spacing) || 10,
      coating: String(row.coating || 'galvanized'),
    };

    const components: Record<string, string> = {};
    const componentKeys = [
      'mesh', 'line_post', 'terminal_post', 'top_rail', 'tension_wire', 'tie_wire',
      'dome_cap', 'loop_cap', 'eye_top', 'rail_end', 'tension_bar', 'tension_band',
      'brace_band', 'rail_clamp', 'hog_ring'
    ];
    for (const key of componentKeys) {
      if (row[key]) components[key] = String(row[key]);
    }

    const { error } = await supabase
      .from('sku_catalog_v2')
      .upsert({
        sku_code: skuCode,
        sku_name: String(row.sku_name || skuCode),
        product_type_id: productTypeId,
        product_style_id: style?.id || null,
        height: Number(row.height) || 4,
        post_type: 'STEEL',
        variables,
        components,
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
