const XLSX = require('xlsx');
const fs = require('fs');

const workbook = XLSX.readFile('2025.12.09 DFU App - DB structure for Ops Hub.xlsx');
const sheet = workbook.Sheets['sku_catalog'];
const data = XLSX.utils.sheet_to_json(sheet);

// Build style code mapping from Excel style names to database codes
const styleMapping = {
  'Standard': 'standard',
  'Good Neighbor Builder': 'good-neighbor-builder',
  'Good Neighbor Residential': 'good-neighbor-residential',
  'board-on-board': 'board-on-board'
};

let sql = `-- ============================================
-- PART 5: SKU CATALOG (${data.length} SKUs)
-- ============================================

`;

// Generate INSERT statements for each SKU
data.forEach((row, idx) => {
  const skuCode = row.sku_code;
  const skuName = row.sku_name;
  const productType = row.product_type; // wood-vertical
  const style = row.style; // Standard, Good Neighbor Builder
  const height = row.height || 6;
  const postType = row.post_type || 'WOOD';
  const railCount = row['Number of rails'] || 2;
  const postSpacing = row.post_spacing || 8;

  // Map style name to code
  const styleCode = styleMapping[style] || 'standard';

  // Build variables JSON
  const variables = {
    rail_count: railCount,
    post_spacing: postSpacing
  };

  // Build components JSON (only non-null values)
  const components = {};
  const componentCols = ['post', 'picket', 'rail', 'cap', 'trim', 'rot_board', 'steel_post_cap', 'bracket', 'lag_screws', 'nails_picket', 'nails_framing', 'self_tapping_screws', 'concrete'];

  componentCols.forEach(col => {
    const val = row[col];
    if (val && val !== '' && val !== 'System') {
      components[col] = val;
    } else if (val === 'System') {
      components[col] = 'SYSTEM';
    }
  });

  sql += `INSERT INTO sku_catalog_v2 (sku_code, sku_name, product_type_id, product_style_id, height, post_type, variables, components)
SELECT '${skuCode}', '${skuName.replace(/'/g, "''")}',
  pt.id, ps.id, ${height}, '${postType}',
  '${JSON.stringify(variables)}'::jsonb,
  '${JSON.stringify(components)}'::jsonb
FROM product_types_v2 pt
JOIN product_styles_v2 ps ON ps.product_type_id = pt.id AND ps.code = '${styleCode}'
WHERE pt.code = '${productType}';

`;
});

console.log(sql);
