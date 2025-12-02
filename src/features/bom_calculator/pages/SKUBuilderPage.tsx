import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Loader2, Save, RotateCcw, AlertTriangle,
  Grid3X3, Layers, Package
} from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { showSuccess, showError } from '../../../lib/toast';

// Extended Material interface with dimensions for filtering
interface Material {
  id: string;
  material_sku: string;
  material_name: string;
  category: string;
  sub_category: string | null;
  unit_cost: number;
  length_ft: number | null;
  width_nominal: number | null;
  actual_width: number | null;
  thickness: string | null;
}

interface BusinessUnit {
  id: string;
  code: string;
  name: string;
}

interface LaborCode {
  id: string;
  labor_sku: string;
  description: string;
  unit_type: string;
}

interface LaborRate {
  labor_code_id: string;
  rate: number;
}

type ProductType = 'wood-vertical' | 'wood-horizontal' | 'iron';

// Style options per fence type
const WOOD_VERTICAL_STYLES = [
  { value: 'Standard', label: 'Standard', postSpacing: 8, picketMultiplier: 1.0 },
  { value: 'Good Neighbor', label: 'Good Neighbor', postSpacing: 7.71, picketMultiplier: 1.1 },
  { value: 'Board-on-Board', label: 'Board-on-Board', postSpacing: 8, picketMultiplier: 1.14 },
];

const WOOD_HORIZONTAL_STYLES = [
  { value: 'Standard', label: 'Standard Horizontal', postSpacing: 6 },
  { value: 'Good Neighbor', label: 'Good Neighbor Horizontal', postSpacing: 6 },
  { value: 'Exposed', label: 'Exposed Horizontal', postSpacing: 6 },
];

const IRON_STYLES = [
  { value: 'Standard 2 Rail', label: 'Standard 2 Rail', rails: 2, postSpacing: 8 },
  { value: 'Standard 3 Rail', label: 'Standard 3 Rail', rails: 3, postSpacing: 8 },
  { value: 'Ameristar', label: 'Ameristar/3 Rail Brackets', rails: 3, postSpacing: 8 },
];

// Preview test parameters
interface PreviewParams {
  netLength: number;
  lines: number;
  gates: number;
  businessUnitId: string;
}

// BOM calculation result
interface BOMResult {
  materials: Array<{
    name: string;
    sku: string;
    type: string;
    qty: number;
    cost: number;
    total: number;
  }>;
  labor: Array<{
    code: string;
    description: string;
    ratePerFt: number;
    qty: number;
    total: number;
  }>;
  materialTotal: number;
  laborTotal: number;
  projectTotal: number;
  costPerFoot: number;
}

export default function SKUBuilderPage() {
  const queryClient = useQueryClient();
  const [productType, setProductType] = useState<ProductType>('wood-vertical');

  // Configuration state
  const [skuCode, setSkuCode] = useState('');
  const [skuName, setSkuName] = useState('');
  const [height, setHeight] = useState(6);
  const [style, setStyle] = useState('Standard');
  const [railCount, setRailCount] = useState(2);
  const [postType, setPostType] = useState<'WOOD' | 'STEEL'>('WOOD');

  // Material selections
  const [postMaterialId, setPostMaterialId] = useState('');
  const [picketMaterialId, setPicketMaterialId] = useState('');
  const [railMaterialId, setRailMaterialId] = useState('');
  const [capMaterialId, setCapMaterialId] = useState('');
  const [trimMaterialId, setTrimMaterialId] = useState('');
  const [boardMaterialId, setBoardMaterialId] = useState('');
  const [nailerMaterialId, setNailerMaterialId] = useState('');
  const [panelMaterialId, setPanelMaterialId] = useState('');

  // Preview parameters
  const [preview, setPreview] = useState<PreviewParams>({
    netLength: 100,
    lines: 1,
    gates: 0,
    businessUnitId: '',
  });

  // Fetch materials with all fields needed for filtering
  const { data: materials = [], isLoading: loadingMaterials } = useQuery({
    queryKey: ['materials-for-sku-builder'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('materials')
        .select('id, material_sku, material_name, category, sub_category, unit_cost, length_ft, width_nominal, actual_width, thickness')
        .eq('status', 'Active')
        .order('category')
        .order('material_name');
      if (error) throw error;
      return data as Material[];
    },
  });

  // Fetch business units
  const { data: businessUnits = [] } = useQuery({
    queryKey: ['business-units-sku'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('business_units')
        .select('id, code, name')
        .eq('is_active', true)
        .order('code');
      if (error) throw error;
      // Set default BU if not set
      if (data && data.length > 0 && !preview.businessUnitId) {
        setPreview(p => ({ ...p, businessUnitId: data[0].id }));
      }
      return data as BusinessUnit[];
    },
  });

  // Fetch labor codes
  const { data: laborCodes = [] } = useQuery({
    queryKey: ['labor-codes-sku'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('labor_codes')
        .select('id, labor_sku, description, unit_type')
        .eq('is_active', true);
      if (error) throw error;
      return data as LaborCode[];
    },
  });

  // Fetch labor rates for selected BU
  const { data: laborRates = [] } = useQuery({
    queryKey: ['labor-rates-sku', preview.businessUnitId],
    queryFn: async () => {
      if (!preview.businessUnitId) return [];
      const { data, error } = await supabase
        .from('labor_rates')
        .select('labor_code_id, rate')
        .eq('business_unit_id', preview.businessUnitId);
      if (error) throw error;
      return data as LaborRate[];
    },
    enabled: !!preview.businessUnitId,
  });

  // Get style config
  const getStyleConfig = () => {
    if (productType === 'wood-vertical') {
      return WOOD_VERTICAL_STYLES.find(s => s.value === style) || WOOD_VERTICAL_STYLES[0];
    } else if (productType === 'wood-horizontal') {
      return WOOD_HORIZONTAL_STYLES.find(s => s.value === style) || WOOD_HORIZONTAL_STYLES[0];
    } else {
      return IRON_STYLES.find(s => s.value === style) || IRON_STYLES[0];
    }
  };

  // Filter materials based on fence type and height
  const filteredPostMaterials = useMemo(() => {
    const posts = materials.filter(m => m.category === '01-Post');

    if (productType === 'iron') {
      // Iron fences use iron posts
      return posts.filter(m => m.sub_category === 'Iron' || m.material_name.toLowerCase().includes('iron'));
    }

    // Wood fences - filter by post type and height
    if (postType === 'STEEL') {
      return posts.filter(m =>
        m.sub_category === 'Steel' ||
        m.material_name.toLowerCase().includes('steel') ||
        m.material_name.toLowerCase().includes('tubing')
      );
    } else {
      // Wood posts - 8ft posts for 6ft fence, 10ft for 8ft fence
      const requiredLength = height <= 6 ? 8 : 10;
      return posts.filter(m =>
        (m.sub_category === 'Wood' || m.material_name.toLowerCase().includes('ptp')) &&
        (m.length_ft === null || m.length_ft >= requiredLength)
      );
    }
  }, [materials, postType, height, productType]);

  const filteredPicketMaterials = useMemo(() => {
    const pickets = materials.filter(m => m.category === '02-Pickets');
    // Filter by height - 6ft fence uses 6ft pickets, 8ft uses 8ft pickets
    return pickets.filter(m => m.length_ft === null || m.length_ft === height);
  }, [materials, height]);

  const filteredRailMaterials = useMemo(() => {
    return materials.filter(m => m.category === '03-Rails');
  }, [materials]);

  const filteredCapTrimMaterials = useMemo(() => {
    return materials.filter(m => m.category === '04-Cap/Trim');
  }, [materials]);

  const filteredHorizontalBoardMaterials = useMemo(() => {
    const boards = materials.filter(m => m.category === '07-Horizontal Boards');
    // Filter by post spacing for horizontal
    const spacing = getStyleConfig().postSpacing || 6;
    return boards.filter(m => m.length_ft === null || m.length_ft === spacing || m.length_ft === 8);
  }, [materials, style, productType]);

  const filteredIronPanelMaterials = useMemo(() => {
    const panels = materials.filter(m => m.category === '09-Iron' && m.sub_category === 'Panel');
    // Filter by height
    return panels.filter(m => m.length_ft === null || m.length_ft === 8);
  }, [materials, height]);

  // Get material by ID
  const getMaterial = (id: string) => materials.find(m => m.id === id);

  // Get labor rate
  const getLaborRate = (laborSku: string): number => {
    const code = laborCodes.find(c => c.labor_sku === laborSku);
    if (!code) return 0;
    const rate = laborRates.find(r => r.labor_code_id === code.id);
    return rate?.rate || 0;
  };

  // Calculate BOM preview
  const bomResult = useMemo((): BOMResult | null => {
    const { netLength, lines, gates } = preview;
    if (netLength <= 0) return null;

    const styleConfig = getStyleConfig();
    const bomMaterials: BOMResult['materials'] = [];
    const bomLabor: BOMResult['labor'] = [];

    if (productType === 'wood-vertical') {
      const postSpacing = (styleConfig as typeof WOOD_VERTICAL_STYLES[0]).postSpacing;
      const picketMultiplier = (styleConfig as typeof WOOD_VERTICAL_STYLES[0]).picketMultiplier;

      // Calculate posts
      let posts = Math.ceil(netLength / postSpacing) + 1;
      if (lines > 2) posts += Math.ceil((lines - 2) / 2);

      // Add gate posts
      if (gates > 0) {
        if (postType === 'STEEL') {
          posts += gates;
        } else {
          posts += gates * 2; // 2 steel posts per gate for wood fence
        }
      }

      const postMat = getMaterial(postMaterialId);
      if (postMat) {
        bomMaterials.push({
          name: postMat.material_name,
          sku: postMat.material_sku,
          type: 'Post',
          qty: posts,
          cost: postMat.unit_cost,
          total: posts * postMat.unit_cost,
        });
      }

      // Calculate pickets
      const picketMat = getMaterial(picketMaterialId);
      if (picketMat) {
        const picketWidth = picketMat.actual_width || 5.5;
        const pickets = Math.ceil((netLength * 12) / picketWidth * 1.025 * picketMultiplier);
        bomMaterials.push({
          name: picketMat.material_name,
          sku: picketMat.material_sku,
          type: 'Picket',
          qty: pickets,
          cost: picketMat.unit_cost,
          total: pickets * picketMat.unit_cost,
        });
      }

      // Calculate rails
      const railMat = getMaterial(railMaterialId);
      if (railMat) {
        const rails = (posts - 1) * railCount;
        bomMaterials.push({
          name: railMat.material_name,
          sku: railMat.material_sku,
          type: 'Rail',
          qty: rails,
          cost: railMat.unit_cost,
          total: rails * railMat.unit_cost,
        });
      }

      // Brackets (steel posts only)
      if (postType === 'STEEL') {
        const brackets = posts * railCount;
        bomMaterials.push({
          name: 'Rail Brackets',
          sku: 'BRK01',
          type: 'Hardware',
          qty: brackets,
          cost: 0.75,
          total: brackets * 0.75,
        });
      }

      // Concrete (3-part system)
      const sandGravel = Math.ceil(posts / 10);
      const portland = Math.ceil(posts / 20);
      const quickrock = Math.ceil(posts * 0.5);

      bomMaterials.push(
        { name: 'Sand & Gravel Mix', sku: 'CTS', type: 'Concrete', qty: sandGravel, cost: 4.25, total: sandGravel * 4.25 },
        { name: 'Portland Cement', sku: 'CTP', type: 'Concrete', qty: portland, cost: 12.75, total: portland * 12.75 },
        { name: 'QuickRock', sku: 'CTQ', type: 'Concrete', qty: quickrock, cost: 5.50, total: quickrock * 5.50 }
      );

      // Cap (optional)
      const capMat = getMaterial(capMaterialId);
      if (capMat) {
        const caps = Math.ceil(netLength / (capMat.length_ft || 8));
        bomMaterials.push({
          name: capMat.material_name,
          sku: capMat.material_sku,
          type: 'Cap',
          qty: caps,
          cost: capMat.unit_cost,
          total: caps * capMat.unit_cost,
        });
      }

      // Trim (optional)
      const trimMat = getMaterial(trimMaterialId);
      if (trimMat) {
        const trims = Math.ceil((netLength * 2) / (trimMat.length_ft || 8));
        bomMaterials.push({
          name: trimMat.material_name,
          sku: trimMat.material_sku,
          type: 'Trim',
          qty: trims,
          cost: trimMat.unit_cost,
          total: trims * trimMat.unit_cost,
        });
      }

      // Labor
      const setPostCode = postType === 'STEEL' ? (height <= 6 ? 'M03' : 'M04') : 'W02';
      const nailUpCode = height <= 6 ? 'W03' : 'W04';

      bomLabor.push({
        code: setPostCode,
        description: laborCodes.find(c => c.labor_sku === setPostCode)?.description || 'Set Post',
        ratePerFt: getLaborRate(setPostCode),
        qty: netLength,
        total: netLength * getLaborRate(setPostCode),
      });

      bomLabor.push({
        code: nailUpCode,
        description: laborCodes.find(c => c.labor_sku === nailUpCode)?.description || 'Nail Up',
        ratePerFt: getLaborRate(nailUpCode),
        qty: netLength,
        total: netLength * getLaborRate(nailUpCode),
      });

      // Good neighbor style labor
      if (style === 'Good Neighbor') {
        bomLabor.push({
          code: 'W06',
          description: 'Good Neighbor Style',
          ratePerFt: getLaborRate('W06'),
          qty: netLength,
          total: netLength * getLaborRate('W06'),
        });
      }

      // Cap labor
      if (capMaterialId && trimMaterialId) {
        bomLabor.push({
          code: 'W09',
          description: 'Cap & Trim Installation',
          ratePerFt: getLaborRate('W09'),
          qty: netLength,
          total: netLength * getLaborRate('W09'),
        });
      } else if (capMaterialId) {
        bomLabor.push({
          code: 'W07',
          description: 'Cap Installation',
          ratePerFt: getLaborRate('W07'),
          qty: netLength,
          total: netLength * getLaborRate('W07'),
        });
      } else if (trimMaterialId) {
        bomLabor.push({
          code: 'W08',
          description: 'Trim Installation',
          ratePerFt: getLaborRate('W08'),
          qty: netLength,
          total: netLength * getLaborRate('W08'),
        });
      }

      // Gate labor
      if (gates > 0) {
        const gateCode = height <= 6 ? 'W10' : 'W11';
        bomLabor.push({
          code: gateCode,
          description: laborCodes.find(c => c.labor_sku === gateCode)?.description || 'Wood Gate',
          ratePerFt: getLaborRate(gateCode),
          qty: gates,
          total: gates * getLaborRate(gateCode),
        });
      }

    } else if (productType === 'wood-horizontal') {
      const postSpacing = (styleConfig as typeof WOOD_HORIZONTAL_STYLES[0]).postSpacing;

      // Posts
      let posts = Math.ceil(netLength / postSpacing) + 1;
      if (lines > 2) posts += Math.ceil((lines - 2) / 2);

      const postMat = getMaterial(postMaterialId);
      if (postMat) {
        bomMaterials.push({
          name: postMat.material_name,
          sku: postMat.material_sku,
          type: 'Post',
          qty: posts,
          cost: postMat.unit_cost,
          total: posts * postMat.unit_cost,
        });
      }

      // Horizontal boards
      const boardMat = getMaterial(boardMaterialId);
      if (boardMat) {
        const boardWidth = boardMat.actual_width || 5.5;
        const rows = Math.ceil((height * 12) / boardWidth);
        const sections = Math.ceil(netLength / postSpacing);
        const boards = rows * sections;
        bomMaterials.push({
          name: boardMat.material_name,
          sku: boardMat.material_sku,
          type: 'Board',
          qty: boards,
          cost: boardMat.unit_cost,
          total: boards * boardMat.unit_cost,
        });
      }

      // Nailers
      const nailerMat = getMaterial(nailerMaterialId);
      if (nailerMat) {
        const sections = Math.ceil(netLength / postSpacing);
        const nailers = style === 'Exposed' ? posts * 2 : sections;
        bomMaterials.push({
          name: nailerMat.material_name,
          sku: nailerMat.material_sku,
          type: 'Nailer',
          qty: nailers,
          cost: nailerMat.unit_cost,
          total: nailers * nailerMat.unit_cost,
        });
      }

      // Concrete
      const sandGravel = Math.ceil(posts / 10);
      const portland = Math.ceil(posts / 20);
      const quickrock = Math.ceil(posts * 0.5);

      bomMaterials.push(
        { name: 'Sand & Gravel Mix', sku: 'CTS', type: 'Concrete', qty: sandGravel, cost: 4.25, total: sandGravel * 4.25 },
        { name: 'Portland Cement', sku: 'CTP', type: 'Concrete', qty: portland, cost: 12.75, total: portland * 12.75 },
        { name: 'QuickRock', sku: 'CTQ', type: 'Concrete', qty: quickrock, cost: 5.50, total: quickrock * 5.50 }
      );

      // Labor
      const setPostCode = style === 'Exposed' ? 'W16' : 'W12';
      bomLabor.push({
        code: setPostCode,
        description: laborCodes.find(c => c.labor_sku === setPostCode)?.description || 'Set Post',
        ratePerFt: getLaborRate(setPostCode),
        qty: netLength,
        total: netLength * getLaborRate(setPostCode),
      });

      const nailUpCode = style === 'Exposed' ? 'W17' : (height <= 6 ? 'W13' : 'W18');
      bomLabor.push({
        code: nailUpCode,
        description: laborCodes.find(c => c.labor_sku === nailUpCode)?.description || 'Horizontal Assembly',
        ratePerFt: getLaborRate(nailUpCode),
        qty: netLength,
        total: netLength * getLaborRate(nailUpCode),
      });

      // Gate labor
      if (gates > 0) {
        bomLabor.push({
          code: 'W15',
          description: 'Horizontal Wood Gate',
          ratePerFt: getLaborRate('W15'),
          qty: gates,
          total: gates * getLaborRate('W15'),
        });
      }

    } else if (productType === 'iron') {
      const ironStyle = styleConfig as typeof IRON_STYLES[0];

      // Panels
      const panels = Math.ceil(netLength / 8);
      const panelMat = getMaterial(panelMaterialId);
      if (panelMat) {
        bomMaterials.push({
          name: panelMat.material_name,
          sku: panelMat.material_sku,
          type: 'Panel',
          qty: panels,
          cost: panelMat.unit_cost,
          total: panels * panelMat.unit_cost,
        });
      }

      // Posts
      let posts = Math.ceil(netLength / 8) + 1;
      if (lines > 2) posts += Math.ceil((lines - 2) / 2);

      const postMat = getMaterial(postMaterialId);
      if (postMat) {
        bomMaterials.push({
          name: postMat.material_name,
          sku: postMat.material_sku,
          type: 'Post',
          qty: posts,
          cost: postMat.unit_cost,
          total: posts * postMat.unit_cost,
        });
      }

      // Brackets (Ameristar only)
      if (style === 'Ameristar') {
        const brackets = panels * ironStyle.rails * 2;
        bomMaterials.push({
          name: 'Ameristar Rail Bracket',
          sku: 'IB01',
          type: 'Bracket',
          qty: brackets,
          cost: 2.75,
          total: brackets * 2.75,
        });
      }

      // Post caps
      bomMaterials.push({
        name: 'Iron Post Cap 2x2',
        sku: 'IPC01',
        type: 'Post Cap',
        qty: posts,
        cost: 8.50,
        total: posts * 8.50,
      });

      // Concrete
      const sandGravel = Math.ceil(posts / 10);
      const portland = Math.ceil(posts / 20);
      const quickrock = Math.ceil(posts * 0.5);

      bomMaterials.push(
        { name: 'Sand & Gravel Mix', sku: 'CTS', type: 'Concrete', qty: sandGravel, cost: 4.25, total: sandGravel * 4.25 },
        { name: 'Portland Cement', sku: 'CTP', type: 'Concrete', qty: portland, cost: 12.75, total: portland * 12.75 },
        { name: 'QuickRock', sku: 'CTQ', type: 'Concrete', qty: quickrock, cost: 5.50, total: quickrock * 5.50 }
      );

      // Labor
      const setPostCode = style === 'Ameristar' ? 'IR05' : 'IR01';
      bomLabor.push({
        code: setPostCode,
        description: laborCodes.find(c => c.labor_sku === setPostCode)?.description || 'Set Post',
        ratePerFt: getLaborRate(setPostCode),
        qty: netLength,
        total: netLength * getLaborRate(setPostCode),
      });

      const weldCode = style === 'Ameristar' ? 'IR06' : 'IR02';
      bomLabor.push({
        code: weldCode,
        description: laborCodes.find(c => c.labor_sku === weldCode)?.description || 'Weld/Assembly',
        ratePerFt: getLaborRate(weldCode),
        qty: netLength,
        total: netLength * getLaborRate(weldCode),
      });

      // Gate labor
      if (gates > 0) {
        bomLabor.push({
          code: 'IR07',
          description: 'Iron Gate - Single',
          ratePerFt: getLaborRate('IR07'),
          qty: gates,
          total: gates * getLaborRate('IR07'),
        });
      }
    }

    const materialTotal = bomMaterials.reduce((sum, m) => sum + m.total, 0);
    const laborTotal = bomLabor.reduce((sum, l) => sum + l.total, 0);
    const projectTotal = materialTotal + laborTotal;
    const costPerFoot = netLength > 0 ? projectTotal / netLength : 0;

    return { materials: bomMaterials, labor: bomLabor, materialTotal, laborTotal, projectTotal, costPerFoot };
  }, [
    productType, style, height, railCount, postType, preview,
    postMaterialId, picketMaterialId, railMaterialId, capMaterialId, trimMaterialId,
    boardMaterialId, nailerMaterialId, panelMaterialId, materials, laborCodes, laborRates
  ]);

  // Generate suggested SKU name
  const suggestedSkuName = useMemo(() => {
    const h = `${height}'`;
    const styleShort = style === 'Good Neighbor' ? 'GN' : style === 'Board-on-Board' ? 'BOB' : 'STD';
    const pt = postType === 'STEEL' ? 'ST' : 'WD';
    const rails = productType === 'wood-vertical' ? `${railCount}R` : '';

    if (productType === 'wood-vertical') {
      return `${h} ${styleShort} ${rails} : ${pt}`;
    } else if (productType === 'wood-horizontal') {
      return `${h} HOR ${styleShort} : ${pt}`;
    } else {
      return `${h} Iron ${style}`;
    }
  }, [height, style, postType, railCount, productType]);

  // Reset form
  const resetForm = () => {
    setSkuCode('');
    setSkuName('');
    setHeight(6);
    setStyle('Standard');
    setRailCount(2);
    setPostType('WOOD');
    setPostMaterialId('');
    setPicketMaterialId('');
    setRailMaterialId('');
    setCapMaterialId('');
    setTrimMaterialId('');
    setBoardMaterialId('');
    setNailerMaterialId('');
    setPanelMaterialId('');
  };

  // Save SKU mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!skuCode) throw new Error('SKU code is required');

      if (productType === 'wood-vertical') {
        const { error } = await supabase.from('wood_vertical_products').insert({
          sku_code: skuCode,
          sku_name: skuName || suggestedSkuName,
          height,
          rail_count: railCount,
          post_type: postType,
          style,
          post_spacing: getStyleConfig().postSpacing,
          post_material_id: postMaterialId || null,
          picket_material_id: picketMaterialId || null,
          rail_material_id: railMaterialId || null,
          cap_material_id: capMaterialId || null,
          trim_material_id: trimMaterialId || null,
          standard_material_cost: bomResult?.materialTotal || null,
          standard_labor_cost: bomResult?.laborTotal || null,
          standard_cost_per_foot: bomResult?.costPerFoot || null,
          is_active: true,
        });
        if (error) throw error;
      } else if (productType === 'wood-horizontal') {
        const boardMat = getMaterial(boardMaterialId);
        const { error } = await supabase.from('wood_horizontal_products').insert({
          sku_code: skuCode,
          sku_name: skuName || suggestedSkuName,
          height,
          post_type: postType,
          style,
          post_spacing: getStyleConfig().postSpacing,
          board_width_actual: boardMat?.actual_width || 5.5,
          post_material_id: postMaterialId || null,
          board_material_id: boardMaterialId || null,
          nailer_material_id: nailerMaterialId || null,
          cap_material_id: capMaterialId || null,
          standard_material_cost: bomResult?.materialTotal || null,
          standard_labor_cost: bomResult?.laborTotal || null,
          standard_cost_per_foot: bomResult?.costPerFoot || null,
          is_active: true,
        });
        if (error) throw error;
      } else {
        const ironStyle = IRON_STYLES.find(s => s.value === style);
        const { error } = await supabase.from('iron_products').insert({
          sku_code: skuCode,
          sku_name: skuName || suggestedSkuName,
          height,
          post_type: 'STEEL',
          style,
          panel_width: 8,
          rails_per_panel: ironStyle?.rails || 2,
          post_material_id: postMaterialId || null,
          panel_material_id: panelMaterialId || null,
          standard_material_cost: bomResult?.materialTotal || null,
          standard_labor_cost: bomResult?.laborTotal || null,
          standard_cost_per_foot: bomResult?.costPerFoot || null,
          is_active: true,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      showSuccess('SKU saved successfully');
      queryClient.invalidateQueries({ queryKey: ['wood-vertical-products'] });
      queryClient.invalidateQueries({ queryKey: ['wood-horizontal-products'] });
      queryClient.invalidateQueries({ queryKey: ['iron-products'] });
      resetForm();
    },
    onError: (err: Error) => {
      showError(err.message || 'Failed to save SKU');
    },
  });

  // Update style when product type changes
  const handleProductTypeChange = (type: ProductType) => {
    setProductType(type);
    if (type === 'wood-vertical') {
      setStyle('Standard');
    } else if (type === 'wood-horizontal') {
      setStyle('Standard');
    } else {
      setStyle('Standard 2 Rail');
    }
    // Clear material selections
    setPostMaterialId('');
    setPicketMaterialId('');
    setRailMaterialId('');
    setBoardMaterialId('');
    setNailerMaterialId('');
    setPanelMaterialId('');
  };

  if (loadingMaterials) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-green-600 mx-auto mb-3" />
          <p className="text-gray-600">Loading materials...</p>
        </div>
      </div>
    );
  }

  const componentCount = bomResult?.materials.filter(m => !['Concrete', 'Hardware'].includes(m.type)).length || 0;
  const laborCount = bomResult?.labor.length || 0;

  return (
    <div className="flex-1 flex bg-gray-50 overflow-hidden">
      {/* Left Panel - Configuration */}
      <div className="w-[420px] bg-white border-r border-gray-200 flex flex-col overflow-hidden">
        <div className="p-4 border-b border-gray-200">
          <h1 className="text-xl font-bold text-gray-900">SKU Builder</h1>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          {/* SKU Configuration Card */}
          <div className="bg-gray-50 rounded-lg p-4 space-y-4">
            <h2 className="font-semibold text-gray-900">SKU Configuration</h2>

            {/* SKU Code & Name */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">SKU Number *</label>
                <input
                  type="text"
                  value={skuCode}
                  onChange={(e) => setSkuCode(e.target.value.toUpperCase())}
                  placeholder="e.g., A07"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">SKU Name (Suggested)</label>
                <input
                  type="text"
                  value={skuName || suggestedSkuName}
                  onChange={(e) => setSkuName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500 bg-white"
                />
              </div>
            </div>

            {/* Product Type Tabs */}
            <div className="flex rounded-lg border border-gray-200 overflow-hidden">
              <button
                onClick={() => handleProductTypeChange('wood-vertical')}
                className={`flex-1 px-3 py-2 text-sm font-medium flex items-center justify-center gap-1.5 transition-colors ${
                  productType === 'wood-vertical'
                    ? 'bg-green-600 text-white'
                    : 'bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                <Grid3X3 className="w-4 h-4" />
                Wood Vertical
              </button>
              <button
                onClick={() => handleProductTypeChange('wood-horizontal')}
                className={`flex-1 px-3 py-2 text-sm font-medium flex items-center justify-center gap-1.5 transition-colors border-l border-gray-200 ${
                  productType === 'wood-horizontal'
                    ? 'bg-green-600 text-white'
                    : 'bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                <Layers className="w-4 h-4" />
                Wood Horizontal
              </button>
              <button
                onClick={() => handleProductTypeChange('iron')}
                className={`flex-1 px-3 py-2 text-sm font-medium flex items-center justify-center gap-1.5 transition-colors border-l border-gray-200 ${
                  productType === 'iron'
                    ? 'bg-green-600 text-white'
                    : 'bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                <Package className="w-4 h-4" />
                Iron
              </button>
            </div>

            {/* Style & Height */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Style *</label>
                <select
                  value={style}
                  onChange={(e) => setStyle(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500"
                >
                  {(productType === 'wood-vertical' ? WOOD_VERTICAL_STYLES :
                    productType === 'wood-horizontal' ? WOOD_HORIZONTAL_STYLES :
                    IRON_STYLES).map(s => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Height *</label>
                <select
                  value={height}
                  onChange={(e) => {
                    setHeight(Number(e.target.value));
                    // Clear picket selection when height changes
                    setPicketMaterialId('');
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500"
                >
                  {productType === 'iron' ? (
                    <>
                      <option value={4}>4 ft</option>
                      <option value={5}>5 ft</option>
                      <option value={6}>6 ft</option>
                    </>
                  ) : (
                    <>
                      <option value={4}>4 ft</option>
                      <option value={5}>5 ft</option>
                      <option value={6}>6 ft</option>
                      <option value={7}>7 ft</option>
                      <option value={8}>8 ft</option>
                    </>
                  )}
                </select>
              </div>
            </div>

            {/* Wood Vertical specific */}
            {productType === 'wood-vertical' && (
              <>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1"># Rails *</label>
                  <select
                    value={railCount}
                    onChange={(e) => setRailCount(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500"
                  >
                    <option value={2}>2 Rails</option>
                    <option value={3}>3 Rails</option>
                    <option value={4}>4 Rails</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Post Type *</label>
                  <select
                    value={postType}
                    onChange={(e) => {
                      setPostType(e.target.value as 'WOOD' | 'STEEL');
                      setPostMaterialId(''); // Clear post selection
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500"
                  >
                    <option value="WOOD">Wood Posts</option>
                    <option value="STEEL">Steel Posts</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Select Post *</label>
                  <select
                    value={postMaterialId}
                    onChange={(e) => setPostMaterialId(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500"
                  >
                    <option value="">Select a post...</option>
                    {filteredPostMaterials.map(m => (
                      <option key={m.id} value={m.id}>
                        {m.material_sku} - {m.material_name} (${m.unit_cost.toFixed(2)})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Pickets *</label>
                  <select
                    value={picketMaterialId}
                    onChange={(e) => setPicketMaterialId(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500"
                  >
                    <option value="">Select pickets...</option>
                    {filteredPicketMaterials.map(m => (
                      <option key={m.id} value={m.id}>
                        {m.material_sku} - {m.material_name} (${m.unit_cost.toFixed(2)})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Rails *</label>
                  <select
                    value={railMaterialId}
                    onChange={(e) => setRailMaterialId(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500"
                  >
                    <option value="">Select rails...</option>
                    {filteredRailMaterials.map(m => (
                      <option key={m.id} value={m.id}>
                        {m.material_sku} - {m.material_name} (${m.unit_cost.toFixed(2)})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Cap (Optional)</label>
                    <select
                      value={capMaterialId}
                      onChange={(e) => setCapMaterialId(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500"
                    >
                      <option value="">No Cap</option>
                      {filteredCapTrimMaterials.filter(m => m.sub_category === 'Cap').map(m => (
                        <option key={m.id} value={m.id}>
                          {m.material_sku} - {m.material_name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Trim (Optional)</label>
                    <select
                      value={trimMaterialId}
                      onChange={(e) => setTrimMaterialId(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500"
                    >
                      <option value="">No Trim</option>
                      {filteredCapTrimMaterials.filter(m => m.sub_category === 'Trim').map(m => (
                        <option key={m.id} value={m.id}>
                          {m.material_sku} - {m.material_name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </>
            )}

            {/* Wood Horizontal specific */}
            {productType === 'wood-horizontal' && (
              <>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Post Type *</label>
                  <select
                    value={postType}
                    onChange={(e) => {
                      setPostType(e.target.value as 'WOOD' | 'STEEL');
                      setPostMaterialId('');
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500"
                  >
                    <option value="WOOD">Wood Posts</option>
                    <option value="STEEL">Steel Posts</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Select Post *</label>
                  <select
                    value={postMaterialId}
                    onChange={(e) => setPostMaterialId(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500"
                  >
                    <option value="">Select a post...</option>
                    {filteredPostMaterials.map(m => (
                      <option key={m.id} value={m.id}>
                        {m.material_sku} - {m.material_name} (${m.unit_cost.toFixed(2)})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Horizontal Boards *</label>
                  <select
                    value={boardMaterialId}
                    onChange={(e) => setBoardMaterialId(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500"
                  >
                    <option value="">Select boards...</option>
                    {filteredHorizontalBoardMaterials.map(m => (
                      <option key={m.id} value={m.id}>
                        {m.material_sku} - {m.material_name} (${m.unit_cost.toFixed(2)})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Nailer Material</label>
                  <select
                    value={nailerMaterialId}
                    onChange={(e) => setNailerMaterialId(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500"
                  >
                    <option value="">Select nailer...</option>
                    {filteredRailMaterials.map(m => (
                      <option key={m.id} value={m.id}>
                        {m.material_sku} - {m.material_name} (${m.unit_cost.toFixed(2)})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Cap (Optional)</label>
                  <select
                    value={capMaterialId}
                    onChange={(e) => setCapMaterialId(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500"
                  >
                    <option value="">No Cap</option>
                    {filteredCapTrimMaterials.filter(m => m.sub_category === 'Cap').map(m => (
                      <option key={m.id} value={m.id}>
                        {m.material_sku} - {m.material_name}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            )}

            {/* Iron specific */}
            {productType === 'iron' && (
              <>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Select Post *</label>
                  <select
                    value={postMaterialId}
                    onChange={(e) => setPostMaterialId(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500"
                  >
                    <option value="">Select a post...</option>
                    {filteredPostMaterials.map(m => (
                      <option key={m.id} value={m.id}>
                        {m.material_sku} - {m.material_name} (${m.unit_cost.toFixed(2)})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Panel Material *</label>
                  <select
                    value={panelMaterialId}
                    onChange={(e) => setPanelMaterialId(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500"
                  >
                    <option value="">Select panel...</option>
                    {filteredIronPanelMaterials.map(m => (
                      <option key={m.id} value={m.id}>
                        {m.material_sku} - {m.material_name} (${m.unit_cost.toFixed(2)})
                      </option>
                    ))}
                  </select>
                </div>
              </>
            )}
          </div>

          {/* Component Summary */}
          <div className="flex items-center gap-6 py-3 border-t border-gray-200">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{componentCount}</div>
              <div className="text-xs text-gray-500">Components</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{laborCount}</div>
              <div className="text-xs text-gray-500">Labor Items</div>
            </div>
          </div>

          {/* Fence Type Badge */}
          <div className="flex justify-center">
            <span className={`px-4 py-1.5 rounded-full text-sm font-medium ${
              productType === 'wood-vertical' ? 'bg-amber-100 text-amber-800' :
              productType === 'wood-horizontal' ? 'bg-blue-100 text-blue-800' :
              'bg-gray-200 text-gray-800'
            }`}>
              {productType === 'wood-vertical' ? 'Wood Vertical' :
               productType === 'wood-horizontal' ? 'Wood Horizontal' : 'Iron'} {height}'
            </span>
          </div>
        </div>
      </div>

      {/* Right Panel - Preview & BOM */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Preview Header */}
        <div className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Preview and Test</h2>
            <div className="flex items-center gap-3">
              <button
                onClick={resetForm}
                className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
                Reset Form
              </button>
              <button
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending || !skuCode}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium flex items-center gap-2 transition-colors disabled:bg-gray-400"
              >
                {saveMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                Save SKU
              </button>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Test Parameters */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="grid grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Net Length</label>
                <input
                  type="number"
                  value={preview.netLength}
                  onChange={(e) => setPreview({ ...preview, netLength: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Lines</label>
                <select
                  value={preview.lines}
                  onChange={(e) => setPreview({ ...preview, lines: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                >
                  {[1, 2, 3, 4, 5].map(n => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Gates</label>
                <select
                  value={preview.gates}
                  onChange={(e) => setPreview({ ...preview, gates: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                >
                  {[0, 1, 2, 3].map(n => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Business Unit *</label>
                <select
                  value={preview.businessUnitId}
                  onChange={(e) => setPreview({ ...preview, businessUnitId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                >
                  {businessUnits.map(bu => (
                    <option key={bu.id} value={bu.id}>{bu.code} - {bu.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-4 text-center">
              <p className="text-xs text-gray-500">Generated SKU Name:</p>
              <p className="text-lg font-semibold text-gray-900">{skuName || suggestedSkuName}</p>
            </div>
          </div>

          {/* Warning if no materials selected */}
          {!postMaterialId && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-amber-800">Select materials to see BOM preview</p>
                <p className="text-xs text-amber-600 mt-1">Choose at least a post material to calculate the bill of materials.</p>
              </div>
            </div>
          )}

          {/* BOM Preview */}
          {bomResult && postMaterialId && (
            <div className="bg-white rounded-lg border border-gray-200">
              <div className="px-4 py-3 border-b border-gray-200">
                <h3 className="font-semibold text-gray-900">Bill of Materials & Labor</h3>
              </div>

              {/* Materials Table */}
              <div className="p-4">
                <h4 className="text-sm font-medium text-gray-700 mb-2">Materials (BOM)</h4>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-gray-500 uppercase border-b">
                      <th className="text-left py-2">Material</th>
                      <th className="text-left py-2">Type</th>
                      <th className="text-right py-2">Qty</th>
                      <th className="text-right py-2">Cost</th>
                      <th className="text-right py-2">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {bomResult.materials.map((item, i) => (
                      <tr key={i}>
                        <td className="py-2">
                          <div className="font-medium text-gray-900">{item.name}</div>
                          <div className="text-xs text-gray-500">{item.sku}</div>
                        </td>
                        <td className="py-2 text-gray-600">{item.type}</td>
                        <td className="py-2 text-right text-gray-900">{item.qty}</td>
                        <td className="py-2 text-right text-gray-600">${item.cost.toFixed(2)}</td>
                        <td className="py-2 text-right font-medium text-green-600">${item.total.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-gray-200">
                      <td colSpan={4} className="py-2 text-right font-medium text-gray-900">Material Total:</td>
                      <td className="py-2 text-right font-bold text-green-600">${bomResult.materialTotal.toFixed(2)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Labor Table */}
              <div className="p-4 border-t border-gray-200">
                <h4 className="text-sm font-medium text-gray-700 mb-2">Labor (BOL)</h4>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-gray-500 uppercase border-b">
                      <th className="text-left py-2">Labor</th>
                      <th className="text-right py-2">Rate/Ft</th>
                      <th className="text-right py-2">Qty (Ft)</th>
                      <th className="text-right py-2">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {bomResult.labor.map((item, i) => (
                      <tr key={i}>
                        <td className="py-2">
                          <div className="font-medium text-gray-900">{item.code}</div>
                          <div className="text-xs text-gray-500">{item.description}</div>
                        </td>
                        <td className="py-2 text-right text-gray-600">${item.ratePerFt.toFixed(2)}</td>
                        <td className="py-2 text-right text-gray-900">{item.qty}</td>
                        <td className="py-2 text-right font-medium text-green-600">${item.total.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-gray-200">
                      <td colSpan={3} className="py-2 text-right font-medium text-gray-900">Labor Total:</td>
                      <td className="py-2 text-right font-bold text-green-600">${bomResult.laborTotal.toFixed(2)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Totals */}
              <div className="p-4 bg-gray-50 border-t border-gray-200 grid grid-cols-2 gap-4">
                <div className="bg-green-600 text-white rounded-lg p-4 text-center">
                  <div className="text-sm opacity-90">Total Project Cost</div>
                  <div className="text-3xl font-bold">${bomResult.projectTotal.toFixed(2)}</div>
                </div>
                <div className="bg-purple-600 text-white rounded-lg p-4 text-center">
                  <div className="text-sm opacity-90">Cost Per Foot</div>
                  <div className="text-3xl font-bold">${bomResult.costPerFoot.toFixed(2)}</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
