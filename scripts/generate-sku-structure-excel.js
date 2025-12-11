import XLSX from 'xlsx';

// ============================================
// TAB 1: SKU CATALOG - Wide/Horizontal Format
// One row per SKU, material codes as columns
// ============================================
const skuCatalog = [
  // A series - 6' 1x6, WOOD post
  { sku_code: 'A01', sku_name: "6' Ver 1x6 : 2R : WOOD Post", product_type: 'wood-vertical', height: 6, post_type: 'WOOD', rail_count: 2, style: 'standard', post_spacing: 8, post: 'PS13', picket: 'P601', rail: 'RA01', cap: '', trim: '', rot_board: '', steel_post_cap: '', bracket: '' },
  { sku_code: 'A02', sku_name: "6' Ver 1x6 : 2R : WOOD Post : GN", product_type: 'wood-vertical', height: 6, post_type: 'WOOD', rail_count: 2, style: 'good-neighbor', post_spacing: 8, post: 'PS13', picket: 'P601', rail: 'RA01', cap: '', trim: '', rot_board: '', steel_post_cap: '', bracket: '' },
  { sku_code: 'A03', sku_name: "6' Ver 1x6 : 2R : WOOD Post : C&T", product_type: 'wood-vertical', height: 6, post_type: 'WOOD', rail_count: 2, style: 'cap-and-trim', post_spacing: 8, post: 'PS13', picket: 'P601', rail: 'RA01', cap: 'CTN09', trim: 'CTN07', rot_board: '', steel_post_cap: '', bracket: '' },
  { sku_code: 'A04', sku_name: "6' Ver 1x6 : 3R : WOOD Post", product_type: 'wood-vertical', height: 6, post_type: 'WOOD', rail_count: 3, style: 'standard', post_spacing: 8, post: 'PS13', picket: 'P601', rail: 'RA01', cap: '', trim: '', rot_board: '', steel_post_cap: '', bracket: '' },
  { sku_code: 'A05', sku_name: "6' Ver 1x6 : 3R : WOOD Post : GN", product_type: 'wood-vertical', height: 6, post_type: 'WOOD', rail_count: 3, style: 'good-neighbor', post_spacing: 8, post: 'PS13', picket: 'P601', rail: 'RA01', cap: '', trim: '', rot_board: '', steel_post_cap: '', bracket: '' },
  { sku_code: 'A06', sku_name: "6' Ver 1x6 : 3R : WOOD Post : C&T2", product_type: 'wood-vertical', height: 6, post_type: 'WOOD', rail_count: 3, style: 'cap-and-trim-2', post_spacing: 8, post: 'PS13', picket: 'P601', rail: 'RA01', cap: 'CTN09', trim: 'CTN05', rot_board: '', steel_post_cap: '', bracket: '' },
  { sku_code: 'A07', sku_name: "6' Ver 1x6 : 3R : WOOD Post : C&T4", product_type: 'wood-vertical', height: 6, post_type: 'WOOD', rail_count: 3, style: 'cap-and-trim-4', post_spacing: 8, post: 'PS13', picket: 'P601', rail: 'RA01', cap: 'CTN09', trim: 'CTN07', rot_board: '', steel_post_cap: '', bracket: '' },

  // B series - 6' 1x4, WOOD post
  { sku_code: 'B01', sku_name: "6' Ver 1x4 : 2R : WOOD Post", product_type: 'wood-vertical', height: 6, post_type: 'WOOD', rail_count: 2, style: 'standard', post_spacing: 8, post: 'PS13', picket: 'P401', rail: 'RA01', cap: '', trim: '', rot_board: '', steel_post_cap: '', bracket: '' },
  { sku_code: 'B02', sku_name: "6' Ver 1x4 : 2R : WOOD Post : GN", product_type: 'wood-vertical', height: 6, post_type: 'WOOD', rail_count: 2, style: 'good-neighbor', post_spacing: 8, post: 'PS13', picket: 'P401', rail: 'RA01', cap: '', trim: '', rot_board: '', steel_post_cap: '', bracket: '' },
  { sku_code: 'B03', sku_name: "6' Ver 1x4 : 2R : WOOD Post : C&T", product_type: 'wood-vertical', height: 6, post_type: 'WOOD', rail_count: 2, style: 'cap-and-trim', post_spacing: 8, post: 'PS13', picket: 'P401', rail: 'RA01', cap: 'CTN09', trim: 'CTN07', rot_board: '', steel_post_cap: '', bracket: '' },
  { sku_code: 'B04', sku_name: "6' Ver 1x4 : 3R : WOOD Post", product_type: 'wood-vertical', height: 6, post_type: 'WOOD', rail_count: 3, style: 'standard', post_spacing: 8, post: 'PS13', picket: 'P401', rail: 'RA01', cap: '', trim: '', rot_board: '', steel_post_cap: '', bracket: '' },
  { sku_code: 'B05', sku_name: "6' Ver 1x4 : 3R : WOOD Post : GN", product_type: 'wood-vertical', height: 6, post_type: 'WOOD', rail_count: 3, style: 'good-neighbor', post_spacing: 8, post: 'PS13', picket: 'P401', rail: 'RA01', cap: '', trim: '', rot_board: '', steel_post_cap: '', bracket: '' },
  { sku_code: 'B06', sku_name: "6' Ver 1x4 : 3R : WOOD Post : C&T2", product_type: 'wood-vertical', height: 6, post_type: 'WOOD', rail_count: 3, style: 'cap-and-trim-2', post_spacing: 8, post: 'PS13', picket: 'P401', rail: 'RA01', cap: 'CTN09', trim: 'CTN05', rot_board: '', steel_post_cap: '', bracket: '' },
  { sku_code: 'B07', sku_name: "6' Ver 1x4 : 3R : WOOD Post : C&T4", product_type: 'wood-vertical', height: 6, post_type: 'WOOD', rail_count: 3, style: 'cap-and-trim-4', post_spacing: 8, post: 'PS13', picket: 'P401', rail: 'RA01', cap: 'CTN09', trim: 'CTN07', rot_board: '', steel_post_cap: '', bracket: '' },

  // C series - 6' 1x6, STEEL post
  { sku_code: 'C01', sku_name: "6' Ver 1x6 : 2R : STEEL Post", product_type: 'wood-vertical', height: 6, post_type: 'STEEL', rail_count: 2, style: 'standard', post_spacing: 8, post: 'PS04', picket: 'P601', rail: 'RA01', cap: '', trim: '', rot_board: '', steel_post_cap: 'PC01', bracket: 'HW06' },
  { sku_code: 'C02', sku_name: "6' Ver 1x6 : 2R : STEEL Post : GN", product_type: 'wood-vertical', height: 6, post_type: 'STEEL', rail_count: 2, style: 'good-neighbor', post_spacing: 8, post: 'PS04', picket: 'P601', rail: 'RA01', cap: '', trim: '', rot_board: '', steel_post_cap: 'PC01', bracket: '' },
  { sku_code: 'C03', sku_name: "6' Ver 1x6 : 2R : STEEL Post : C&T", product_type: 'wood-vertical', height: 6, post_type: 'STEEL', rail_count: 2, style: 'cap-and-trim', post_spacing: 8, post: 'PS04', picket: 'P601', rail: 'RA01', cap: 'CTN09', trim: 'CTN07', rot_board: '', steel_post_cap: 'PC02', bracket: 'HW06' },
  { sku_code: 'C04', sku_name: "6' Ver 1x6 : 3R : STEEL Post", product_type: 'wood-vertical', height: 6, post_type: 'STEEL', rail_count: 3, style: 'standard', post_spacing: 8, post: 'PS04', picket: 'P601', rail: 'RA01', cap: '', trim: '', rot_board: '', steel_post_cap: 'PC01', bracket: 'HW06' },
  { sku_code: 'C05', sku_name: "6' Ver 1x6 : 3R : STEEL Post : GN", product_type: 'wood-vertical', height: 6, post_type: 'STEEL', rail_count: 3, style: 'good-neighbor', post_spacing: 8, post: 'PS04', picket: 'P601', rail: 'RA01', cap: '', trim: '', rot_board: '', steel_post_cap: 'PC01', bracket: '' },
  { sku_code: 'C06', sku_name: "6' Ver 1x6 : 3R : STEEL Post : C&T2", product_type: 'wood-vertical', height: 6, post_type: 'STEEL', rail_count: 3, style: 'cap-and-trim-2', post_spacing: 8, post: 'PS04', picket: 'P601', rail: 'RA01', cap: 'CTN09', trim: 'CTN05', rot_board: '', steel_post_cap: 'PC02', bracket: 'HW06' },
  { sku_code: 'C07', sku_name: "6' Ver 1x6 : 3R : STEEL Post : C&T4", product_type: 'wood-vertical', height: 6, post_type: 'STEEL', rail_count: 3, style: 'cap-and-trim-4', post_spacing: 8, post: 'PS04', picket: 'P601', rail: 'RA01', cap: 'CTN09', trim: 'CTN07', rot_board: '', steel_post_cap: 'PC02', bracket: 'HW06' },

  // D series - 6' 1x4, STEEL post
  { sku_code: 'D01', sku_name: "6' Ver 1x4 : 2R : STEEL Post", product_type: 'wood-vertical', height: 6, post_type: 'STEEL', rail_count: 2, style: 'standard', post_spacing: 8, post: 'PS04', picket: 'P401', rail: 'RA01', cap: '', trim: '', rot_board: '', steel_post_cap: 'PC01', bracket: 'HW06' },
  { sku_code: 'D02', sku_name: "6' Ver 1x4 : 2R : STEEL Post : GN", product_type: 'wood-vertical', height: 6, post_type: 'STEEL', rail_count: 2, style: 'good-neighbor', post_spacing: 8, post: 'PS04', picket: 'P401', rail: 'RA01', cap: '', trim: '', rot_board: '', steel_post_cap: 'PC01', bracket: '' },
  { sku_code: 'D03', sku_name: "6' Ver 1x4 : 2R : STEEL Post : C&T", product_type: 'wood-vertical', height: 6, post_type: 'STEEL', rail_count: 2, style: 'cap-and-trim', post_spacing: 8, post: 'PS04', picket: 'P401', rail: 'RA01', cap: 'CTN09', trim: 'CTN07', rot_board: '', steel_post_cap: 'PC02', bracket: 'HW06' },
  { sku_code: 'D04', sku_name: "6' Ver 1x4 : 3R : STEEL Post", product_type: 'wood-vertical', height: 6, post_type: 'STEEL', rail_count: 3, style: 'standard', post_spacing: 8, post: 'PS04', picket: 'P401', rail: 'RA01', cap: '', trim: '', rot_board: '', steel_post_cap: 'PC01', bracket: 'HW06' },
  { sku_code: 'D05', sku_name: "6' Ver 1x4 : 3R : STEEL Post : GN", product_type: 'wood-vertical', height: 6, post_type: 'STEEL', rail_count: 3, style: 'good-neighbor', post_spacing: 8, post: 'PS04', picket: 'P401', rail: 'RA01', cap: '', trim: '', rot_board: '', steel_post_cap: 'PC01', bracket: '' },
  { sku_code: 'D06', sku_name: "6' Ver 1x4 : 3R : STEEL Post : C&T2", product_type: 'wood-vertical', height: 6, post_type: 'STEEL', rail_count: 3, style: 'cap-and-trim-2', post_spacing: 8, post: 'PS04', picket: 'P401', rail: 'RA01', cap: 'CTN09', trim: 'CTN05', rot_board: '', steel_post_cap: 'PC02', bracket: 'HW06' },
  { sku_code: 'D07', sku_name: "6' Ver 1x4 : 3R : STEEL Post : C&T4", product_type: 'wood-vertical', height: 6, post_type: 'STEEL', rail_count: 3, style: 'cap-and-trim-4', post_spacing: 8, post: 'PS04', picket: 'P401', rail: 'RA01', cap: 'CTN09', trim: 'CTN07', rot_board: '', steel_post_cap: 'PC02', bracket: 'HW06' },

  // Horizontal fence examples
  { sku_code: '6FF01', sku_name: "6' Flat Fence : Standard", product_type: 'wood-horizontal', height: 6, post_type: 'WOOD', rail_count: 0, style: 'flat-fence', post_spacing: 8, post: 'PS14', picket: '', rail: '', cap: 'CTN09', trim: 'VT01', rot_board: '', steel_post_cap: '', bracket: '', board: 'HB601', nailer: 'NA01' },
  { sku_code: '6FF02', sku_name: "6' Flat Fence : Good Neighbor", product_type: 'wood-horizontal', height: 6, post_type: 'WOOD', rail_count: 0, style: 'flat-fence-gn', post_spacing: 8, post: 'PS14', picket: '', rail: '', cap: 'CTN09', trim: 'VT01', rot_board: '', steel_post_cap: '', bracket: '', board: 'HB601', nailer: 'NA01' },

  // Iron examples
  { sku_code: 'IR01', sku_name: "4' Iron Panel Fence", product_type: 'iron', height: 4, post_type: 'STEEL', rail_count: 0, style: 'standard', post_spacing: 6, post: 'IPS01', picket: '', rail: '', cap: '', trim: '', rot_board: '', steel_post_cap: '', bracket: 'IBR01', panel: 'IPL01' },
  { sku_code: 'IR02', sku_name: "5' Iron Panel Fence", product_type: 'iron', height: 5, post_type: 'STEEL', rail_count: 0, style: 'standard', post_spacing: 6, post: 'IPS02', picket: '', rail: '', cap: '', trim: '', rot_board: '', steel_post_cap: '', bracket: 'IBR01', panel: 'IPL02' },

  // Service examples
  { sku_code: 'TOFO', sku_name: "Tear Out & Haul Off", product_type: 'service', height: '', post_type: '', rail_count: '', style: 'labor-only', post_spacing: '', post: '', picket: '', rail: '', cap: '', trim: '', rot_board: '', steel_post_cap: '', bracket: '' },
  { sku_code: 'ROC', sku_name: "Rock Fee", product_type: 'service', height: '', post_type: '', rail_count: '', style: 'labor-only', post_spacing: '', post: '', picket: '', rail: '', cap: '', trim: '', rot_board: '', steel_post_cap: '', bracket: '' },
];

// ============================================
// TAB 2: PRODUCT STYLES - Styles per product type
// ============================================
const productStyles = [
  // Wood Vertical styles
  { product_type: 'wood-vertical', style: 'standard', style_name: 'Standard Privacy', description: 'Basic privacy fence with pickets on one side', has_cap: false, has_trim: false, double_rails: false },
  { product_type: 'wood-vertical', style: 'good-neighbor', style_name: 'Good Neighbor', description: 'Alternating pickets visible from both sides', has_cap: false, has_trim: false, double_rails: true },
  { product_type: 'wood-vertical', style: 'cap-and-trim', style_name: 'Cap & Trim (4")', description: 'Standard with cap rail and 4" trim boards', has_cap: true, has_trim: true, double_rails: false },
  { product_type: 'wood-vertical', style: 'cap-and-trim-2', style_name: 'Cap & Trim (2")', description: 'Standard with cap rail and 2" trim boards', has_cap: true, has_trim: true, double_rails: false },
  { product_type: 'wood-vertical', style: 'cap-and-trim-4', style_name: 'Cap & Trim (4")', description: 'Standard with cap rail and 4" trim boards', has_cap: true, has_trim: true, double_rails: false },

  // Wood Horizontal styles
  { product_type: 'wood-horizontal', style: 'flat-fence', style_name: 'Flat Fence', description: 'Horizontal boards with vertical trim at posts', has_cap: true, has_trim: true, double_rails: false },
  { product_type: 'wood-horizontal', style: 'flat-fence-gn', style_name: 'Flat Fence Good Neighbor', description: 'Horizontal boards visible from both sides', has_cap: true, has_trim: true, double_rails: false },
  { product_type: 'wood-horizontal', style: 'shadow-box', style_name: 'Shadow Box Horizontal', description: 'Alternating horizontal boards', has_cap: true, has_trim: true, double_rails: false },

  // Iron styles
  { product_type: 'iron', style: 'standard', style_name: 'Standard Iron', description: 'Basic iron panel fence', has_cap: false, has_trim: false, double_rails: false },
  { product_type: 'iron', style: 'decorative', style_name: 'Decorative Iron', description: 'Iron panels with decorative elements', has_cap: false, has_trim: false, double_rails: false },

  // Service styles
  { product_type: 'service', style: 'labor-only', style_name: 'Labor Only', description: 'Service with labor charge only', has_cap: false, has_trim: false, double_rails: false },
  { product_type: 'service', style: 'material-labor', style_name: 'Material + Labor', description: 'Service with both material and labor', has_cap: false, has_trim: false, double_rails: false },
];

// ============================================
// TAB 3: FORMULA TEMPLATES - By product_type + style
// Uses SKU attributes AND component attributes!
// ============================================
const formulaTemplates = [
  // ========== WOOD VERTICAL - STANDARD ==========
  { product_type: 'wood-vertical', style: 'standard', component: 'post', formula: 'ROUNDUP([Quantity]/[post_spacing])+1+ROUNDUP(([Lines]-1)/2)', notes: 'Posts per fence line' },
  { product_type: 'wood-vertical', style: 'standard', component: 'rail', formula: '[rail_count]*ROUNDUP([Quantity]/[post_spacing])*[Lines]', notes: 'Rails = count × sections × lines' },
  { product_type: 'wood-vertical', style: 'standard', component: 'picket', formula: '[Quantity]*12/[picket.width]', notes: 'Uses picket width attribute!' },
  { product_type: 'wood-vertical', style: 'standard', component: 'concrete', formula: 'IF([post_type]="WOOD", (ROUNDUP([Quantity]/[post_spacing])+1)*2, 0)', notes: '2 bags per wood post' },
  { product_type: 'wood-vertical', style: 'standard', component: 'steel_post_cap', formula: 'IF([post_type]="STEEL", ROUNDUP([Quantity]/[post_spacing])+1, 0)', notes: 'Caps for steel posts' },
  { product_type: 'wood-vertical', style: 'standard', component: 'bracket', formula: 'IF([post_type]="STEEL", [rail_count]*2*(ROUNDUP([Quantity]/[post_spacing])+1), 0)', notes: 'Brackets for steel posts' },
  { product_type: 'wood-vertical', style: 'standard', component: 'nails', formula: 'ROUNDUP([Quantity]/150)', notes: '1 box per 150 LF' },

  // ========== WOOD VERTICAL - GOOD NEIGHBOR ==========
  { product_type: 'wood-vertical', style: 'good-neighbor', component: 'post', formula: 'ROUNDUP([Quantity]/[post_spacing])+1+ROUNDUP(([Lines]-1)/2)', notes: 'Same as standard' },
  { product_type: 'wood-vertical', style: 'good-neighbor', component: 'rail', formula: '[rail_count]*ROUNDUP([Quantity]/[post_spacing])*[Lines]*2', notes: 'DOUBLE rails for GN!' },
  { product_type: 'wood-vertical', style: 'good-neighbor', component: 'picket', formula: '[Quantity]*12/[picket.width]', notes: 'Same formula, width determines qty' },
  { product_type: 'wood-vertical', style: 'good-neighbor', component: 'concrete', formula: 'IF([post_type]="WOOD", (ROUNDUP([Quantity]/[post_spacing])+1)*2, 0)', notes: '2 bags per wood post' },
  { product_type: 'wood-vertical', style: 'good-neighbor', component: 'steel_post_cap', formula: 'IF([post_type]="STEEL", ROUNDUP([Quantity]/[post_spacing])+1, 0)', notes: 'Caps for steel posts' },
  { product_type: 'wood-vertical', style: 'good-neighbor', component: 'bracket', formula: 'IF([post_type]="STEEL", [rail_count]*2*(ROUNDUP([Quantity]/[post_spacing])+1)*2, 0)', notes: 'Double brackets for GN!' },
  { product_type: 'wood-vertical', style: 'good-neighbor', component: 'nails', formula: 'ROUNDUP([Quantity]/100)', notes: 'More nails for GN' },

  // ========== WOOD VERTICAL - CAP & TRIM ==========
  { product_type: 'wood-vertical', style: 'cap-and-trim', component: 'post', formula: 'ROUNDUP([Quantity]/[post_spacing])+1+ROUNDUP(([Lines]-1)/2)', notes: 'Same as standard' },
  { product_type: 'wood-vertical', style: 'cap-and-trim', component: 'rail', formula: '[rail_count]*ROUNDUP([Quantity]/[post_spacing])*[Lines]', notes: 'Same as standard' },
  { product_type: 'wood-vertical', style: 'cap-and-trim', component: 'picket', formula: '[Quantity]*12/[picket.width]', notes: 'Uses picket width' },
  { product_type: 'wood-vertical', style: 'cap-and-trim', component: 'cap', formula: 'ROUNDUP([Quantity]/[cap.length])*[Lines]', notes: 'Uses cap board length!' },
  { product_type: 'wood-vertical', style: 'cap-and-trim', component: 'trim', formula: '[Quantity]*12/[trim.width]', notes: 'Uses trim width attribute!' },
  { product_type: 'wood-vertical', style: 'cap-and-trim', component: 'concrete', formula: 'IF([post_type]="WOOD", (ROUNDUP([Quantity]/[post_spacing])+1)*2, 0)', notes: '2 bags per wood post' },
  { product_type: 'wood-vertical', style: 'cap-and-trim', component: 'steel_post_cap', formula: 'IF([post_type]="STEEL", ROUNDUP([Quantity]/[post_spacing])+1, 0)', notes: 'Caps for steel posts' },
  { product_type: 'wood-vertical', style: 'cap-and-trim', component: 'nails', formula: 'ROUNDUP([Quantity]/100)', notes: 'More nails for C&T' },

  // (cap-and-trim-2 and cap-and-trim-4 inherit from cap-and-trim, just different trim materials)
  { product_type: 'wood-vertical', style: 'cap-and-trim-2', component: 'trim', formula: '[Quantity]*12/[trim.width]', notes: '2" trim - width=2' },
  { product_type: 'wood-vertical', style: 'cap-and-trim-4', component: 'trim', formula: '[Quantity]*12/[trim.width]', notes: '4" trim - width=4' },

  // ========== WOOD HORIZONTAL ==========
  { product_type: 'wood-horizontal', style: 'flat-fence', component: 'post', formula: 'ROUNDUP([Quantity]/[post_spacing])+1+ROUNDUP(([Lines]-1)/2)', notes: 'Wider posts for horizontal' },
  { product_type: 'wood-horizontal', style: 'flat-fence', component: 'nailer', formula: '2*ROUNDUP([Quantity]/[post_spacing])*[Lines]', notes: '2 nailers per section' },
  { product_type: 'wood-horizontal', style: 'flat-fence', component: 'board', formula: '[Quantity]*[height]*12/([board.width]*[board.length])', notes: 'Uses board dimensions!' },
  { product_type: 'wood-horizontal', style: 'flat-fence', component: 'trim', formula: '(ROUNDUP([Quantity]/[post_spacing])+1)*2', notes: 'Vertical trim at posts' },
  { product_type: 'wood-horizontal', style: 'flat-fence', component: 'cap', formula: 'ROUNDUP([Quantity]/[cap.length])*[Lines]', notes: 'Top cap rail' },
  { product_type: 'wood-horizontal', style: 'flat-fence', component: 'concrete', formula: '(ROUNDUP([Quantity]/[post_spacing])+1)*3', notes: '3 bags - bigger posts' },

  // ========== IRON ==========
  { product_type: 'iron', style: 'standard', component: 'post', formula: 'ROUNDUP([Quantity]/[post_spacing])+1+ROUNDUP(([Lines]-1)/2)', notes: 'Steel posts' },
  { product_type: 'iron', style: 'standard', component: 'panel', formula: 'ROUNDUP([Quantity]/[panel.width])*[Lines]', notes: 'Uses panel width!' },
  { product_type: 'iron', style: 'standard', component: 'bracket', formula: '4*(ROUNDUP([Quantity]/[post_spacing])+1)', notes: '4 brackets per post' },
  { product_type: 'iron', style: 'standard', component: 'concrete', formula: '(ROUNDUP([Quantity]/[post_spacing])+1)*2', notes: '2 bags per post' },

  // ========== SERVICE ==========
  { product_type: 'service', style: 'labor-only', component: 'labor', formula: '[Quantity]', notes: 'Direct quantity' },
];

// ============================================
// TAB 4: PRODUCT VARIABLES - Variables per product type
// ============================================
const productVariables = [
  // Wood Vertical variables
  { product_type: 'wood-vertical', variable: 'height', data_type: 'number', required: true, default_value: '6', valid_values: '4,5,6,7,8', description: 'Fence height in feet' },
  { product_type: 'wood-vertical', variable: 'post_type', data_type: 'enum', required: true, default_value: 'WOOD', valid_values: 'WOOD,STEEL', description: 'Post material type' },
  { product_type: 'wood-vertical', variable: 'rail_count', data_type: 'number', required: true, default_value: '2', valid_values: '2,3', description: 'Number of horizontal rails' },
  { product_type: 'wood-vertical', variable: 'post_spacing', data_type: 'number', required: true, default_value: '8', valid_values: '6,8,10', description: 'Distance between posts (feet)' },

  // Wood Horizontal variables
  { product_type: 'wood-horizontal', variable: 'height', data_type: 'number', required: true, default_value: '6', valid_values: '5,6,7,8', description: 'Fence height in feet' },
  { product_type: 'wood-horizontal', variable: 'post_type', data_type: 'enum', required: true, default_value: 'WOOD', valid_values: 'WOOD', description: 'Post material type' },
  { product_type: 'wood-horizontal', variable: 'post_spacing', data_type: 'number', required: true, default_value: '8', valid_values: '6,8', description: 'Distance between posts (feet)' },
  { product_type: 'wood-horizontal', variable: 'board_width', data_type: 'number', required: false, default_value: '6', valid_values: '4,6,8', description: 'Horizontal board width (inches)' },

  // Iron variables
  { product_type: 'iron', variable: 'height', data_type: 'number', required: true, default_value: '4', valid_values: '3,4,5,6', description: 'Fence height in feet' },
  { product_type: 'iron', variable: 'post_spacing', data_type: 'number', required: true, default_value: '6', valid_values: '6,8', description: 'Distance between posts (feet)' },
  { product_type: 'iron', variable: 'panel_width', data_type: 'number', required: true, default_value: '72', valid_values: '72,96', description: 'Panel width in inches' },

  // Chain Link variables
  { product_type: 'chain-link', variable: 'height', data_type: 'number', required: true, default_value: '4', valid_values: '4,5,6,8,10,12', description: 'Fence height in feet' },
  { product_type: 'chain-link', variable: 'gauge', data_type: 'enum', required: true, default_value: '11', valid_values: '9,11,11.5', description: 'Wire gauge' },
  { product_type: 'chain-link', variable: 'mesh_size', data_type: 'number', required: true, default_value: '2', valid_values: '2,2.25', description: 'Mesh opening size (inches)' },
  { product_type: 'chain-link', variable: 'post_spacing', data_type: 'number', required: true, default_value: '10', valid_values: '8,10', description: 'Distance between posts (feet)' },

  // Service - minimal variables
  { product_type: 'service', variable: 'unit_basis', data_type: 'enum', required: true, default_value: 'LF', valid_values: 'LF,EA,HR', description: 'Unit of measure' },
];

// ============================================
// TAB 5: MATERIALS - With dimension attributes
// ============================================
const materials = [
  // Posts - with length attribute
  { sku: 'PS13', name: '4x4x10 Cedar Post', category: 'Post', unit: 'EA', width: 4, length: 120, thickness: 4, unit_cost: 18.50 },
  { sku: 'PS13C', name: '4x4x10 Cedartone Post', category: 'Post', unit: 'EA', width: 4, length: 120, thickness: 4, unit_cost: 22.00 },
  { sku: 'PS13O', name: '4x4x10 Oxford Post', category: 'Post', unit: 'EA', width: 4, length: 120, thickness: 4, unit_cost: 24.00 },
  { sku: 'PS04', name: '2-3/8" x 10\' Steel Post', category: 'Post', unit: 'EA', width: 2.375, length: 120, thickness: 2.375, unit_cost: 28.00 },
  { sku: 'PS14', name: '6x6x10 Cedar Post', category: 'Post', unit: 'EA', width: 6, length: 120, thickness: 6, unit_cost: 45.00 },

  // Pickets - WIDTH is key for formula!
  { sku: 'P601', name: '1x6x6 Cedar Picket', category: 'Picket', unit: 'EA', width: 6, length: 72, thickness: 0.75, unit_cost: 2.50 },
  { sku: 'P401', name: '1x4x6 Cedar Picket', category: 'Picket', unit: 'EA', width: 4, length: 72, thickness: 0.75, unit_cost: 1.80 },
  { sku: 'P604', name: '1x6x6 Cedartone Picket', category: 'Picket', unit: 'EA', width: 6, length: 72, thickness: 0.75, unit_cost: 3.20 },
  { sku: 'P404', name: '1x4x6 Cedartone Picket', category: 'Picket', unit: 'EA', width: 4, length: 72, thickness: 0.75, unit_cost: 2.40 },
  { sku: 'P605', name: '1x6x6 Oxford Picket', category: 'Picket', unit: 'EA', width: 6, length: 72, thickness: 0.75, unit_cost: 3.50 },
  { sku: 'P405', name: '1x4x6 Oxford Picket', category: 'Picket', unit: 'EA', width: 4, length: 72, thickness: 0.75, unit_cost: 2.60 },
  { sku: 'P608', name: '1x6x8 Cedar Picket', category: 'Picket', unit: 'EA', width: 6, length: 96, thickness: 0.75, unit_cost: 3.20 },
  { sku: 'P408', name: '1x4x8 Cedar Picket', category: 'Picket', unit: 'EA', width: 4, length: 96, thickness: 0.75, unit_cost: 2.40 },

  // Rails - LENGTH is key for some formulas
  { sku: 'RA01', name: '2x4x8 Cedar Rail', category: 'Rail', unit: 'EA', width: 4, length: 96, thickness: 1.5, unit_cost: 6.50 },
  { sku: 'RA02', name: '2x4x8 Treated Rail', category: 'Rail', unit: 'EA', width: 4, length: 96, thickness: 1.5, unit_cost: 5.80 },
  { sku: 'RA01C', name: '2x4x8 Cedartone Rail', category: 'Rail', unit: 'EA', width: 4, length: 96, thickness: 1.5, unit_cost: 7.50 },
  { sku: 'RA01O', name: '2x4x8 Oxford Rail', category: 'Rail', unit: 'EA', width: 4, length: 96, thickness: 1.5, unit_cost: 8.00 },

  // Cap boards - LENGTH used in formula
  { sku: 'CTN09', name: '2x6x8 Cedar Cap', category: 'Cap', unit: 'EA', width: 6, length: 96, thickness: 1.5, unit_cost: 8.00 },
  { sku: 'CTN09C', name: '2x6x8 Cedartone Cap', category: 'Cap', unit: 'EA', width: 6, length: 96, thickness: 1.5, unit_cost: 9.50 },
  { sku: 'CTN09O', name: '2x6x8 Oxford Cap', category: 'Cap', unit: 'EA', width: 6, length: 96, thickness: 1.5, unit_cost: 10.00 },

  // Trim boards - WIDTH used in formula (2" vs 4")
  { sku: 'CTN05', name: '1x2x6 Cedar Trim', category: 'Trim', unit: 'EA', width: 2, length: 72, thickness: 0.75, unit_cost: 1.50 },
  { sku: 'CTN07', name: '1x4x6 Cedar Trim', category: 'Trim', unit: 'EA', width: 4, length: 72, thickness: 0.75, unit_cost: 2.00 },
  { sku: 'CTN05C', name: '1x2x6 Cedartone Trim', category: 'Trim', unit: 'EA', width: 2, length: 72, thickness: 0.75, unit_cost: 2.00 },
  { sku: 'CTN07C', name: '1x4x6 Cedartone Trim', category: 'Trim', unit: 'EA', width: 4, length: 72, thickness: 0.75, unit_cost: 2.50 },
  { sku: 'CTN05O', name: '1x2x6 Oxford Trim', category: 'Trim', unit: 'EA', width: 2, length: 72, thickness: 0.75, unit_cost: 2.20 },
  { sku: 'CTN07O', name: '1x4x6 Oxford Trim', category: 'Trim', unit: 'EA', width: 4, length: 72, thickness: 0.75, unit_cost: 2.80 },

  // Steel Post Hardware
  { sku: 'PC01', name: 'Steel Post Cap - Standard', category: 'Hardware', unit: 'EA', width: '', length: '', thickness: '', unit_cost: 3.50 },
  { sku: 'PC02', name: 'Steel Post Cap - C&T', category: 'Hardware', unit: 'EA', width: '', length: '', thickness: '', unit_cost: 4.50 },
  { sku: 'HW06', name: 'Rail Bracket Set (2pc)', category: 'Hardware', unit: 'SET', width: '', length: '', thickness: '', unit_cost: 2.80 },

  // Horizontal boards - WIDTH and LENGTH for formula
  { sku: 'HB601', name: '1x6x8 Cedar Board', category: 'Board', unit: 'EA', width: 6, length: 96, thickness: 0.75, unit_cost: 4.50 },
  { sku: 'NA01', name: '2x4x8 Cedar Nailer', category: 'Nailer', unit: 'EA', width: 4, length: 96, thickness: 1.5, unit_cost: 6.50 },
  { sku: 'VT01', name: '1x6x6 Vertical Trim', category: 'Trim', unit: 'EA', width: 6, length: 72, thickness: 0.75, unit_cost: 2.50 },

  // Iron materials - panel WIDTH is key!
  { sku: 'IPS01', name: '4ft Iron Post', category: 'Post', unit: 'EA', width: 2, length: 72, thickness: 2, unit_cost: 45.00 },
  { sku: 'IPS02', name: '5ft Iron Post', category: 'Post', unit: 'EA', width: 2, length: 84, thickness: 2, unit_cost: 52.00 },
  { sku: 'IPL01', name: '4ft x 6ft Iron Panel', category: 'Panel', unit: 'EA', width: 72, length: 48, thickness: 0.5, unit_cost: 85.00 },
  { sku: 'IPL02', name: '5ft x 6ft Iron Panel', category: 'Panel', unit: 'EA', width: 72, length: 60, thickness: 0.5, unit_cost: 95.00 },
  { sku: 'IBR01', name: 'Iron Panel Bracket', category: 'Hardware', unit: 'EA', width: '', length: '', thickness: '', unit_cost: 4.00 },

  // Consumables
  { sku: 'CONC-80', name: '80lb Concrete Bag', category: 'Consumable', unit: 'BAG', width: '', length: '', thickness: '', unit_cost: 6.50 },
  { sku: 'NAIL-8D', name: '8d Galv Nails (5lb)', category: 'Consumable', unit: 'BOX', width: '', length: '', thickness: '', unit_cost: 12.00 },
];

async function generateExcel() {
  const workbook = XLSX.utils.book_new();

  // Tab 1: sku_catalog (wide format)
  const catalogSheet = XLSX.utils.json_to_sheet(skuCatalog);
  catalogSheet['!cols'] = [
    { wch: 8 },   // sku_code
    { wch: 38 },  // sku_name
    { wch: 14 },  // product_type
    { wch: 7 },   // height
    { wch: 10 },  // post_type
    { wch: 10 },  // rail_count
    { wch: 16 },  // style
    { wch: 12 },  // post_spacing
    { wch: 6 },   // post
    { wch: 6 },   // picket
    { wch: 6 },   // rail
    { wch: 7 },   // cap
    { wch: 7 },   // trim
    { wch: 10 },  // rot_board
    { wch: 14 },  // steel_post_cap
    { wch: 8 },   // bracket
  ];
  XLSX.utils.book_append_sheet(workbook, catalogSheet, 'sku_catalog');

  // Tab 2: product_styles
  const stylesSheet = XLSX.utils.json_to_sheet(productStyles);
  stylesSheet['!cols'] = [
    { wch: 16 },  // product_type
    { wch: 16 },  // style
    { wch: 25 },  // style_name
    { wch: 45 },  // description
    { wch: 8 },   // has_cap
    { wch: 8 },   // has_trim
    { wch: 12 },  // double_rails
  ];
  XLSX.utils.book_append_sheet(workbook, stylesSheet, 'product_styles');

  // Tab 3: formula_templates (by product_type + style)
  const formulaSheet = XLSX.utils.json_to_sheet(formulaTemplates);
  formulaSheet['!cols'] = [
    { wch: 16 },  // product_type
    { wch: 16 },  // style
    { wch: 15 },  // component
    { wch: 65 },  // formula
    { wch: 30 },  // notes
  ];
  XLSX.utils.book_append_sheet(workbook, formulaSheet, 'formula_templates');

  // Tab 4: product_variables
  const variablesSheet = XLSX.utils.json_to_sheet(productVariables);
  variablesSheet['!cols'] = [
    { wch: 16 },  // product_type
    { wch: 14 },  // variable
    { wch: 10 },  // data_type
    { wch: 8 },   // required
    { wch: 12 },  // default_value
    { wch: 20 },  // valid_values
    { wch: 35 },  // description
  ];
  XLSX.utils.book_append_sheet(workbook, variablesSheet, 'product_variables');

  // Tab 5: materials (with dimension attributes)
  const materialsSheet = XLSX.utils.json_to_sheet(materials);
  materialsSheet['!cols'] = [
    { wch: 10 },  // sku
    { wch: 28 },  // name
    { wch: 12 },  // category
    { wch: 5 },   // unit
    { wch: 6 },   // width
    { wch: 6 },   // length
    { wch: 9 },   // thickness
    { wch: 10 },  // unit_cost
  ];
  XLSX.utils.book_append_sheet(workbook, materialsSheet, 'materials');

  // Write file
  const outputPath = './sku_catalog_structure_v3.xlsx';
  XLSX.writeFile(workbook, outputPath);

  console.log(`Excel file created: ${outputPath}`);
  console.log(`\nTabs:`);
  console.log(`1. sku_catalog: ${skuCatalog.length} SKUs (wide format)`);
  console.log(`2. product_styles: ${productStyles.length} styles per product type`);
  console.log(`3. formula_templates: ${formulaTemplates.length} formulas (by type+style)`);
  console.log(`4. product_variables: ${productVariables.length} variables per product type`);
  console.log(`5. materials: ${materials.length} materials with dimensions`);
  console.log(`\nKey features:`);
  console.log(`- Formulas use component attributes: [picket.width], [cap.length], [panel.width]`);
  console.log(`- Same formula works for 1x4 AND 1x6 pickets (width determines quantity)`);
  console.log(`- Styles define formula variations (standard vs good-neighbor vs cap-and-trim)`);
}

generateExcel();
