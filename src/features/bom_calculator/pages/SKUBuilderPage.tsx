import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Loader2, Save, RotateCcw, AlertTriangle,
  Grid3X3, Layers, Package, ArrowLeft
} from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { showSuccess, showError } from '../../../lib/toast';
import type { SelectedSKU } from '../BOMCalculatorHub';
import {
  FenceCalculator,
  type CalculationInput,
  type CalculationResult,
  type HardwareMaterials,
} from '../services/FenceCalculator';
import type {
  Material,
  WoodVerticalProductWithMaterials,
  WoodHorizontalProductWithMaterials,
  IronProductWithMaterials,
  LaborRateWithDetails,
  PostType,
} from '../database.types';

// Style options per fence type
const WOOD_VERTICAL_STYLES = [
  { value: 'Standard', label: 'Standard', postSpacing: 8, picketMultiplier: 1.0 },
  { value: 'Good Neighbor', label: 'Good Neighbor', postSpacing: 7.71, picketMultiplier: 1.11 },
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

type ProductType = 'wood-vertical' | 'wood-horizontal' | 'iron';

// Preview test parameters
interface PreviewParams {
  netLength: number;
  lines: number;
  gates: number;
  businessUnitId: string;
}

// Extended BOM result with per-foot metrics
interface BOMResultExtended extends CalculationResult {
  costPerFoot: number;
  materialCostPerFoot: number;
  laborCostPerFoot: number;
}

interface SKUBuilderPageProps {
  selectedSKU?: SelectedSKU | null;
  onClearSelection?: () => void;
}

export default function SKUBuilderPage({ selectedSKU, onClearSelection }: SKUBuilderPageProps) {
  const queryClient = useQueryClient();
  const [productType, setProductType] = useState<ProductType>('wood-vertical');
  const [editingId, setEditingId] = useState<string | null>(null);

  // Configuration state
  const [skuCode, setSkuCode] = useState('');
  const [skuName, setSkuName] = useState('');
  const [height, setHeight] = useState(6);
  const [style, setStyle] = useState('Standard');
  const [railCount, setRailCount] = useState(2);
  const [postType, setPostType] = useState<PostType>('WOOD');

  // Material selections (IDs)
  const [postMaterialId, setPostMaterialId] = useState('');
  const [picketMaterialId, setPicketMaterialId] = useState('');
  const [railMaterialId, setRailMaterialId] = useState('');
  const [capMaterialId, setCapMaterialId] = useState('');
  const [trimMaterialId, setTrimMaterialId] = useState('');
  const [rotBoardMaterialId, setRotBoardMaterialId] = useState('');
  const [boardMaterialId, setBoardMaterialId] = useState('');
  const [nailerMaterialId, setNailerMaterialId] = useState('');
  const [verticalTrimMaterialId, setVerticalTrimMaterialId] = useState('');
  const [panelMaterialId, setPanelMaterialId] = useState('');
  const [bracketMaterialId, setBracketMaterialId] = useState('');

  // Preview parameters
  const [preview, setPreview] = useState<PreviewParams>({
    netLength: 100,
    lines: 4,
    gates: 0, // SKU Builder uses 0 gates for standard cost
    businessUnitId: '',
  });

  // Instantiate calculator (sku-builder mode)
  const calculator = useMemo(() => new FenceCalculator('sku-builder'), []);

  // Load selected SKU data
  useEffect(() => {
    if (!selectedSKU) {
      setEditingId(null);
      return;
    }

    const loadSKU = async () => {
      try {
        if (selectedSKU.type === 'wood-vertical') {
          const { data: wv, error } = await supabase
            .from('wood_vertical_products')
            .select('*')
            .eq('id', selectedSKU.id)
            .single();
          if (error) throw error;
          setProductType('wood-vertical');
          setSkuCode(wv.sku_code);
          setSkuName(wv.sku_name);
          setHeight(wv.height);
          setStyle(wv.style);
          setRailCount(wv.rail_count);
          setPostType(wv.post_type);
          setPostMaterialId(wv.post_material_id || '');
          setPicketMaterialId(wv.picket_material_id || '');
          setRailMaterialId(wv.rail_material_id || '');
          setCapMaterialId(wv.cap_material_id || '');
          setTrimMaterialId(wv.trim_material_id || '');
          setRotBoardMaterialId(wv.rot_board_material_id || '');
        } else if (selectedSKU.type === 'wood-horizontal') {
          const { data: wh, error } = await supabase
            .from('wood_horizontal_products')
            .select('*')
            .eq('id', selectedSKU.id)
            .single();
          if (error) throw error;
          setProductType('wood-horizontal');
          setSkuCode(wh.sku_code);
          setSkuName(wh.sku_name);
          setHeight(wh.height);
          setStyle(wh.style);
          setPostType(wh.post_type);
          setPostMaterialId(wh.post_material_id || '');
          setBoardMaterialId(wh.board_material_id || '');
          setNailerMaterialId(wh.nailer_material_id || '');
          setCapMaterialId(wh.cap_material_id || '');
          setVerticalTrimMaterialId(wh.vertical_trim_material_id || '');
        } else {
          const { data: ir, error } = await supabase
            .from('iron_products')
            .select('*')
            .eq('id', selectedSKU.id)
            .single();
          if (error) throw error;
          setProductType('iron');
          setSkuCode(ir.sku_code);
          setSkuName(ir.sku_name);
          setHeight(ir.height);
          setStyle(ir.style);
          setPostMaterialId(ir.post_material_id || '');
          setPanelMaterialId(ir.panel_material_id || '');
          setBracketMaterialId(ir.bracket_material_id || '');
        }
        setEditingId(selectedSKU.id);
      } catch (err) {
        console.error('Error loading SKU:', err);
        showError('Failed to load SKU');
      }
    };

    loadSKU();
  }, [selectedSKU]);

  // Fetch all materials
  const { data: materials = [], isLoading: loadingMaterials } = useQuery({
    queryKey: ['materials-for-sku-builder'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('materials')
        .select('*')
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
      if (data && data.length > 0 && !preview.businessUnitId) {
        setPreview(p => ({ ...p, businessUnitId: data[0].id }));
      }
      return data;
    },
  });

  // Fetch labor rates with details for selected BU
  const { data: laborRates = [] } = useQuery({
    queryKey: ['labor-rates-with-details', preview.businessUnitId],
    queryFn: async () => {
      if (!preview.businessUnitId) return [];
      const { data, error } = await supabase
        .from('labor_rates')
        .select(`
          *,
          labor_code:labor_codes(*),
          business_unit:business_units(*)
        `)
        .eq('business_unit_id', preview.businessUnitId);
      if (error) throw error;
      return data as LaborRateWithDetails[];
    },
    enabled: !!preview.businessUnitId,
  });

  // Get material by ID helper
  const getMaterial = (id: string): Material | undefined =>
    materials.find(m => m.id === id);

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

  // Filter materials based on fence type and configuration
  const filteredPostMaterials = useMemo(() => {
    const posts = materials.filter(m => m.category === '01-Post');
    if (productType === 'iron') {
      return posts.filter(m => m.sub_category === 'Iron' || m.material_name.toLowerCase().includes('iron'));
    }
    if (postType === 'STEEL') {
      return posts.filter(m =>
        m.sub_category === 'Steel' ||
        m.material_name.toLowerCase().includes('steel') ||
        m.material_name.toLowerCase().includes('tubing')
      );
    } else {
      const requiredLength = height <= 6 ? 8 : 10;
      return posts.filter(m =>
        (m.sub_category === 'Wood' || m.material_name.toLowerCase().includes('ptp')) &&
        (m.length_ft === null || m.length_ft >= requiredLength)
      );
    }
  }, [materials, postType, height, productType]);

  const filteredPicketMaterials = useMemo(() => {
    const pickets = materials.filter(m => m.category === '02-Pickets');
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
    return boards.filter(m => m.length_ft === null || m.length_ft === 6 || m.length_ft === 8);
  }, [materials]);

  const filteredIronPanelMaterials = useMemo(() => {
    const panels = materials.filter(m => m.category === '09-Iron' && m.sub_category === 'Panel');
    return panels.filter(m => m.length_ft === null || m.length_ft === 8);
  }, [materials]);

  // Get hardware materials for calculations
  const hardwareMaterials = useMemo((): HardwareMaterials => {
    return {
      picketNails: materials.find(m => m.material_sku === 'HW08'),
      frameNails: materials.find(m => m.material_sku === 'HW07'),
      steelGatePost: materials.find(m => m.sub_category === 'Steel' && m.category === '01-Post'),
      postCapDome: materials.find(m => m.material_sku === 'PC-DOME' || m.material_name.toLowerCase().includes('dome cap')),
      postCapPlug: materials.find(m => m.material_sku === 'PC-PLUG' || m.material_name.toLowerCase().includes('plug cap')),
      brackets: getMaterial(bracketMaterialId) || materials.find(m => m.material_sku === 'BRK01'),
      selfTappingScrews: materials.find(m => m.material_sku === 'HW-STS' || m.material_name.toLowerCase().includes('self-tap')),
    };
  }, [materials, bracketMaterialId]);

  // Note: Concrete materials are now handled internally by FenceCalculator with built-in defaults

  // Build product object with materials for FenceCalculator
  const buildWoodVerticalProduct = (): WoodVerticalProductWithMaterials | null => {
    const postMat = getMaterial(postMaterialId);
    const picketMat = getMaterial(picketMaterialId);
    const railMat = getMaterial(railMaterialId);

    if (!postMat || !picketMat || !railMat) return null;

    const styleConfig = getStyleConfig();

    return {
      id: editingId || 'preview',
      sku_code: skuCode,
      sku_name: skuName,
      height,
      rail_count: railCount,
      post_type: postType,
      style,
      post_spacing: styleConfig.postSpacing,
      post_material_id: postMaterialId,
      picket_material_id: picketMaterialId,
      rail_material_id: railMaterialId,
      cap_material_id: capMaterialId || null,
      trim_material_id: trimMaterialId || null,
      rot_board_material_id: rotBoardMaterialId || null,
      standard_material_cost: null,
      standard_labor_cost: null,
      standard_cost_per_foot: null,
      standard_cost_calculated_at: null,
      product_description: null,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      // SKU Import tracking
      sku_status: 'complete',
      imported_at: null,
      populated_at: null,
      populated_by: null,
      import_notes: null,
      // Material relations
      post_material: postMat,
      picket_material: picketMat,
      rail_material: railMat,
      cap_material: getMaterial(capMaterialId),
      trim_material: getMaterial(trimMaterialId),
      rot_board_material: getMaterial(rotBoardMaterialId),
    };
  };

  const buildWoodHorizontalProduct = (): WoodHorizontalProductWithMaterials | null => {
    const postMat = getMaterial(postMaterialId);
    const boardMat = getMaterial(boardMaterialId);

    if (!postMat || !boardMat) return null;

    const styleConfig = getStyleConfig();

    return {
      id: editingId || 'preview',
      sku_code: skuCode,
      sku_name: skuName,
      height,
      post_type: postType,
      style,
      post_spacing: styleConfig.postSpacing,
      board_width_actual: boardMat.actual_width || 5.5,
      post_material_id: postMaterialId,
      board_material_id: boardMaterialId,
      nailer_material_id: nailerMaterialId || null,
      cap_material_id: capMaterialId || null,
      vertical_trim_material_id: verticalTrimMaterialId || null,
      standard_material_cost: null,
      standard_labor_cost: null,
      standard_cost_per_foot: null,
      standard_cost_calculated_at: null,
      product_description: null,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      // SKU Import tracking
      sku_status: 'complete',
      imported_at: null,
      populated_at: null,
      populated_by: null,
      import_notes: null,
      // Material relations
      post_material: postMat,
      board_material: boardMat,
      nailer_material: getMaterial(nailerMaterialId),
      cap_material: getMaterial(capMaterialId),
      vertical_trim_material: getMaterial(verticalTrimMaterialId),
    };
  };

  const buildIronProduct = (): IronProductWithMaterials | null => {
    const postMat = getMaterial(postMaterialId);

    if (!postMat) return null;

    const styleConfig = IRON_STYLES.find(s => s.value === style) || IRON_STYLES[0];

    return {
      id: editingId || 'preview',
      sku_code: skuCode,
      sku_name: skuName,
      height,
      post_type: 'STEEL' as PostType,
      style,
      panel_width: 8,
      rails_per_panel: styleConfig.rails,
      post_material_id: postMaterialId,
      panel_material_id: panelMaterialId || null,
      bracket_material_id: bracketMaterialId || null,
      rail_material_id: null,
      picket_material_id: null,
      standard_material_cost: null,
      standard_labor_cost: null,
      standard_cost_per_foot: null,
      standard_cost_calculated_at: null,
      product_description: null,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      // SKU Import tracking
      sku_status: 'complete',
      imported_at: null,
      populated_at: null,
      populated_by: null,
      import_notes: null,
      // Material relations
      post_material: postMat,
      panel_material: getMaterial(panelMaterialId),
      bracket_material: getMaterial(bracketMaterialId),
      rail_material: undefined,
      picket_material: undefined,
    };
  };

  // Calculate BOM using FenceCalculator
  const bomResult = useMemo((): BOMResultExtended | null => {
    const { netLength, lines, gates } = preview;
    if (netLength <= 0 || laborRates.length === 0) return null;

    const input: CalculationInput = {
      netLength,
      numberOfLines: lines,
      numberOfGates: gates,
    };

    let result: CalculationResult | null = null;

    try {
      // FenceCalculator now includes nails and concrete automatically
      // All quantities are RAW (unrounded) - we apply Math.ceil() for SKU-level costing
      if (productType === 'wood-vertical') {
        const product = buildWoodVerticalProduct();
        if (!product) return null;
        result = calculator.calculateWoodVertical(product, input, laborRates, hardwareMaterials);

      } else if (productType === 'wood-horizontal') {
        const product = buildWoodHorizontalProduct();
        if (!product) return null;
        result = calculator.calculateWoodHorizontal(product, input, laborRates, hardwareMaterials);

      } else if (productType === 'iron') {
        const product = buildIronProduct();
        if (!product) return null;
        result = calculator.calculateIron(product, input, laborRates, hardwareMaterials);
      }

      if (!result) return null;

      // SKU-level: Apply Math.ceil() to each material quantity for costing
      const totalMaterialCost = result.materials.reduce(
        (sum, m) => sum + Math.ceil(m.quantity) * m.unit_cost,
        0
      );
      const totalLaborCost = result.labor.reduce((sum, l) => sum + l.quantity * l.rate, 0);
      const totalCost = totalMaterialCost + totalLaborCost;

      return {
        ...result,
        totalMaterialCost,
        totalLaborCost,
        totalCost,
        costPerFoot: netLength > 0 ? totalCost / netLength : 0,
        materialCostPerFoot: netLength > 0 ? totalMaterialCost / netLength : 0,
        laborCostPerFoot: netLength > 0 ? totalLaborCost / netLength : 0,
      };
    } catch (err) {
      console.error('Calculation error:', err);
      return null;
    }
  }, [
    productType, style, height, railCount, postType, preview,
    postMaterialId, picketMaterialId, railMaterialId, capMaterialId, trimMaterialId, rotBoardMaterialId,
    boardMaterialId, nailerMaterialId, verticalTrimMaterialId, panelMaterialId, bracketMaterialId,
    materials, laborRates, calculator, hardwareMaterials
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
    setEditingId(null);
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
    setRotBoardMaterialId('');
    setBoardMaterialId('');
    setNailerMaterialId('');
    setVerticalTrimMaterialId('');
    setPanelMaterialId('');
    setBracketMaterialId('');
    onClearSelection?.();
  };

  // Save SKU mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!skuCode) throw new Error('SKU code is required');

      const isEditing = !!editingId;

      if (productType === 'wood-vertical') {
        const payload = {
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
          rot_board_material_id: rotBoardMaterialId || null,
          standard_material_cost: bomResult?.totalMaterialCost || null,
          standard_labor_cost: bomResult?.totalLaborCost || null,
          standard_cost_per_foot: bomResult?.costPerFoot || null,
          standard_cost_calculated_at: new Date().toISOString(),
        };

        if (isEditing) {
          const { error } = await supabase
            .from('wood_vertical_products')
            .update(payload)
            .eq('id', editingId);
          if (error) throw error;
        } else {
          const { error } = await supabase
            .from('wood_vertical_products')
            .insert({ ...payload, is_active: true });
          if (error) throw error;
        }
      } else if (productType === 'wood-horizontal') {
        const boardMat = getMaterial(boardMaterialId);
        const payload = {
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
          vertical_trim_material_id: verticalTrimMaterialId || null,
          standard_material_cost: bomResult?.totalMaterialCost || null,
          standard_labor_cost: bomResult?.totalLaborCost || null,
          standard_cost_per_foot: bomResult?.costPerFoot || null,
          standard_cost_calculated_at: new Date().toISOString(),
        };

        if (isEditing) {
          const { error } = await supabase
            .from('wood_horizontal_products')
            .update(payload)
            .eq('id', editingId);
          if (error) throw error;
        } else {
          const { error } = await supabase
            .from('wood_horizontal_products')
            .insert({ ...payload, is_active: true });
          if (error) throw error;
        }
      } else {
        const ironStyle = IRON_STYLES.find(s => s.value === style);
        const payload = {
          sku_code: skuCode,
          sku_name: skuName || suggestedSkuName,
          height,
          post_type: 'STEEL' as const,
          style,
          panel_width: 8,
          rails_per_panel: ironStyle?.rails || 2,
          post_material_id: postMaterialId || null,
          panel_material_id: panelMaterialId || null,
          bracket_material_id: bracketMaterialId || null,
          standard_material_cost: bomResult?.totalMaterialCost || null,
          standard_labor_cost: bomResult?.totalLaborCost || null,
          standard_cost_per_foot: bomResult?.costPerFoot || null,
          standard_cost_calculated_at: new Date().toISOString(),
        };

        if (isEditing) {
          const { error } = await supabase
            .from('iron_products')
            .update(payload)
            .eq('id', editingId);
          if (error) throw error;
        } else {
          const { error } = await supabase
            .from('iron_products')
            .insert({ ...payload, is_active: true });
          if (error) throw error;
        }
      }
    },
    onSuccess: () => {
      showSuccess(editingId ? 'SKU updated successfully' : 'SKU saved successfully');
      queryClient.invalidateQueries({ queryKey: ['wood-vertical-products'] });
      queryClient.invalidateQueries({ queryKey: ['wood-horizontal-products'] });
      queryClient.invalidateQueries({ queryKey: ['iron-products'] });
      queryClient.invalidateQueries({ queryKey: ['wood-vertical-products-catalog'] });
      queryClient.invalidateQueries({ queryKey: ['wood-horizontal-products-catalog'] });
      queryClient.invalidateQueries({ queryKey: ['iron-products-catalog'] });
      if (editingId) {
        onClearSelection?.();
        setEditingId(null);
      }
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
      setPostType('WOOD');
    } else if (type === 'wood-horizontal') {
      setStyle('Standard');
      setPostType('WOOD');
    } else {
      setStyle('Standard 2 Rail');
      setPostType('STEEL');
    }
    // Clear material selections
    setPostMaterialId('');
    setPicketMaterialId('');
    setRailMaterialId('');
    setBoardMaterialId('');
    setNailerMaterialId('');
    setPanelMaterialId('');
    setBracketMaterialId('');
    setCapMaterialId('');
    setTrimMaterialId('');
    setRotBoardMaterialId('');
    setVerticalTrimMaterialId('');
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

  // Number formatting helpers
  const formatNumber = (num: number, decimals: number = 2): string => {
    return num.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  };
  const formatWholeNumber = (num: number): string => {
    return Math.round(num).toLocaleString('en-US');
  };

  const componentCount = bomResult?.materials.length || 0;
  const laborCount = bomResult?.labor.length || 0;

  return (
    <div className="flex-1 flex bg-gray-50 overflow-hidden h-full">
      {/* Left Panel - Configuration */}
      <div className="w-[520px] bg-white border-r border-gray-200 flex flex-col overflow-hidden">
        {/* Header with save actions */}
        <div className="px-4 py-2 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {editingId && (
              <button
                onClick={resetForm}
                className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors"
                title="New SKU"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <div>
              <h1 className="text-base font-bold text-gray-900">
                {editingId ? 'Edit SKU' : 'SKU Builder'}
              </h1>
              {editingId && (
                <p className="text-xs text-blue-600">{skuCode}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={resetForm}
              className="px-3 py-1.5 text-gray-600 hover:bg-gray-100 rounded text-xs font-medium flex items-center gap-1.5 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset
            </button>
            <button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending || !skuCode}
              className={`px-3 py-1.5 text-white rounded text-xs font-medium flex items-center gap-1.5 transition-colors disabled:bg-gray-400 ${
                editingId ? 'bg-blue-600 hover:bg-blue-700' : 'bg-green-600 hover:bg-green-700'
              }`}
            >
              {saveMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              {editingId ? 'Update SKU' : 'Save SKU'}
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          {/* SKU Code & Name */}
          <div className="flex gap-2 mb-3">
            <div className="w-24 flex-shrink-0">
              <label className="block text-[10px] font-medium text-gray-500 mb-0.5">SKU #</label>
              <input
                type="text"
                value={skuCode}
                onChange={(e) => setSkuCode(e.target.value.toUpperCase())}
                placeholder="A07"
                className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-green-500 focus:border-green-500"
              />
            </div>
            <div className="flex-1">
              <label className="block text-[10px] font-medium text-gray-500 mb-0.5">SKU Name</label>
              <input
                type="text"
                value={skuName || suggestedSkuName}
                onChange={(e) => setSkuName(e.target.value)}
                className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-green-500 focus:border-green-500"
              />
            </div>
          </div>

          {/* Product Type Tabs */}
          <div className="flex rounded border border-gray-200 overflow-hidden mb-3">
            <button
              onClick={() => handleProductTypeChange('wood-vertical')}
              className={`flex-1 px-2 py-1.5 text-xs font-medium flex items-center justify-center gap-1 transition-colors ${
                productType === 'wood-vertical' ? 'bg-green-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              <Grid3X3 className="w-3.5 h-3.5" />
              Vertical
            </button>
            <button
              onClick={() => handleProductTypeChange('wood-horizontal')}
              className={`flex-1 px-2 py-1.5 text-xs font-medium flex items-center justify-center gap-1 transition-colors border-l border-gray-200 ${
                productType === 'wood-horizontal' ? 'bg-green-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              Horizontal
            </button>
            <button
              onClick={() => handleProductTypeChange('iron')}
              className={`flex-1 px-2 py-1.5 text-xs font-medium flex items-center justify-center gap-1 transition-colors border-l border-gray-200 ${
                productType === 'iron' ? 'bg-green-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              <Package className="w-3.5 h-3.5" />
              Iron
            </button>
          </div>

          {/* Attributes row */}
          <div className="flex gap-2 mb-3">
            <div className="flex-1">
              <label className="block text-[10px] font-medium text-gray-500 mb-0.5">Style</label>
              <select
                value={style}
                onChange={(e) => setStyle(e.target.value)}
                className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:ring-1 focus:ring-green-500"
              >
                {(productType === 'wood-vertical' ? WOOD_VERTICAL_STYLES :
                  productType === 'wood-horizontal' ? WOOD_HORIZONTAL_STYLES :
                  IRON_STYLES).map(s => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
            <div className="w-16">
              <label className="block text-[10px] font-medium text-gray-500 mb-0.5">Height</label>
              <select
                value={height}
                onChange={(e) => { setHeight(Number(e.target.value)); setPicketMaterialId(''); }}
                className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:ring-1 focus:ring-green-500"
              >
                {(productType === 'iron' ? [4, 5, 6] : [4, 5, 6, 7, 8]).map(h => (
                  <option key={h} value={h}>{h} ft</option>
                ))}
              </select>
            </div>
            {productType === 'wood-vertical' && (
              <>
                <div className="w-16">
                  <label className="block text-[10px] font-medium text-gray-500 mb-0.5"># Rails</label>
                  <select
                    value={railCount}
                    onChange={(e) => setRailCount(Number(e.target.value))}
                    className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:ring-1 focus:ring-green-500"
                  >
                    <option value={2}>2</option>
                    <option value={3}>3</option>
                    <option value={4}>4</option>
                  </select>
                </div>
                <div className="w-20">
                  <label className="block text-[10px] font-medium text-gray-500 mb-0.5">Post Type</label>
                  <select
                    value={postType}
                    onChange={(e) => { setPostType(e.target.value as PostType); setPostMaterialId(''); }}
                    className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:ring-1 focus:ring-green-500"
                  >
                    <option value="WOOD">Wood</option>
                    <option value="STEEL">Steel</option>
                  </select>
                </div>
              </>
            )}
            {productType === 'wood-horizontal' && (
              <div className="w-20">
                <label className="block text-[10px] font-medium text-gray-500 mb-0.5">Post Type</label>
                <select
                  value={postType}
                  onChange={(e) => { setPostType(e.target.value as PostType); setPostMaterialId(''); }}
                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:ring-1 focus:ring-green-500"
                >
                  <option value="WOOD">Wood</option>
                  <option value="STEEL">Steel</option>
                </select>
              </div>
            )}
          </div>

          {/* Materials Section */}
          <div className="bg-gray-50 rounded-lg p-3 space-y-2">
            <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Materials</h3>

            {/* Post Material */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-600 w-14 flex-shrink-0">Post</span>
              <select
                value={postMaterialId}
                onChange={(e) => setPostMaterialId(e.target.value)}
                className="flex-1 px-2 py-1.5 border border-gray-300 rounded text-xs focus:ring-1 focus:ring-green-500 bg-white"
              >
                <option value="">Select post...</option>
                {filteredPostMaterials.map(m => (
                  <option key={m.id} value={m.id}>{m.material_sku} - {m.material_name} (${m.unit_cost.toFixed(2)})</option>
                ))}
              </select>
            </div>

            {/* Wood Vertical Materials */}
            {productType === 'wood-vertical' && (
              <>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-600 w-14 flex-shrink-0">Pickets</span>
                  <select
                    value={picketMaterialId}
                    onChange={(e) => setPicketMaterialId(e.target.value)}
                    className="flex-1 px-2 py-1.5 border border-gray-300 rounded text-xs focus:ring-1 focus:ring-green-500 bg-white"
                  >
                    <option value="">Select pickets...</option>
                    {filteredPicketMaterials.map(m => (
                      <option key={m.id} value={m.id}>{m.material_sku} - {m.material_name} (${m.unit_cost.toFixed(2)})</option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-600 w-14 flex-shrink-0">Rails</span>
                  <select
                    value={railMaterialId}
                    onChange={(e) => setRailMaterialId(e.target.value)}
                    className="flex-1 px-2 py-1.5 border border-gray-300 rounded text-xs focus:ring-1 focus:ring-green-500 bg-white"
                  >
                    <option value="">Select rails...</option>
                    {filteredRailMaterials.map(m => (
                      <option key={m.id} value={m.id}>{m.material_sku} - {m.material_name} (${m.unit_cost.toFixed(2)})</option>
                    ))}
                  </select>
                </div>
                <div className="flex gap-2">
                  <div className="flex items-center gap-2 flex-1">
                    <span className="text-xs text-gray-600 w-14 flex-shrink-0">Cap</span>
                    <select
                      value={capMaterialId}
                      onChange={(e) => setCapMaterialId(e.target.value)}
                      className="flex-1 px-2 py-1.5 border border-gray-300 rounded text-xs focus:ring-1 focus:ring-green-500 bg-white"
                    >
                      <option value="">None</option>
                      {filteredCapTrimMaterials.filter(m => m.sub_category === 'Cap').map(m => (
                        <option key={m.id} value={m.id}>{m.material_sku} - {m.material_name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-center gap-2 flex-1">
                    <span className="text-xs text-gray-600 w-10 flex-shrink-0">Trim</span>
                    <select
                      value={trimMaterialId}
                      onChange={(e) => setTrimMaterialId(e.target.value)}
                      className="flex-1 px-2 py-1.5 border border-gray-300 rounded text-xs focus:ring-1 focus:ring-green-500 bg-white"
                    >
                      <option value="">None</option>
                      {filteredCapTrimMaterials.filter(m => m.sub_category === 'Trim').map(m => (
                        <option key={m.id} value={m.id}>{m.material_sku} - {m.material_name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </>
            )}

            {/* Wood Horizontal Materials */}
            {productType === 'wood-horizontal' && (
              <>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-600 w-14 flex-shrink-0">Boards</span>
                  <select
                    value={boardMaterialId}
                    onChange={(e) => setBoardMaterialId(e.target.value)}
                    className="flex-1 px-2 py-1.5 border border-gray-300 rounded text-xs focus:ring-1 focus:ring-green-500 bg-white"
                  >
                    <option value="">Select boards...</option>
                    {filteredHorizontalBoardMaterials.map(m => (
                      <option key={m.id} value={m.id}>{m.material_sku} - {m.material_name} (${m.unit_cost.toFixed(2)})</option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-600 w-14 flex-shrink-0">Nailer</span>
                  <select
                    value={nailerMaterialId}
                    onChange={(e) => setNailerMaterialId(e.target.value)}
                    className="flex-1 px-2 py-1.5 border border-gray-300 rounded text-xs focus:ring-1 focus:ring-green-500 bg-white"
                  >
                    <option value="">Select nailer...</option>
                    {filteredRailMaterials.map(m => (
                      <option key={m.id} value={m.id}>{m.material_sku} - {m.material_name} (${m.unit_cost.toFixed(2)})</option>
                    ))}
                  </select>
                </div>
                <div className="flex gap-2">
                  <div className="flex items-center gap-2 flex-1">
                    <span className="text-xs text-gray-600 w-14 flex-shrink-0">Cap</span>
                    <select
                      value={capMaterialId}
                      onChange={(e) => setCapMaterialId(e.target.value)}
                      className="flex-1 px-2 py-1.5 border border-gray-300 rounded text-xs focus:ring-1 focus:ring-green-500 bg-white"
                    >
                      <option value="">None</option>
                      {filteredCapTrimMaterials.filter(m => m.sub_category === 'Cap').map(m => (
                        <option key={m.id} value={m.id}>{m.material_sku} - {m.material_name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-center gap-2 flex-1">
                    <span className="text-xs text-gray-600 w-10 flex-shrink-0">V-Trim</span>
                    <select
                      value={verticalTrimMaterialId}
                      onChange={(e) => setVerticalTrimMaterialId(e.target.value)}
                      className="flex-1 px-2 py-1.5 border border-gray-300 rounded text-xs focus:ring-1 focus:ring-green-500 bg-white"
                    >
                      <option value="">None</option>
                      {filteredCapTrimMaterials.filter(m => m.sub_category === 'Trim').map(m => (
                        <option key={m.id} value={m.id}>{m.material_sku} - {m.material_name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </>
            )}

            {/* Iron Materials */}
            {productType === 'iron' && (
              <>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-600 w-14 flex-shrink-0">Panel</span>
                  <select
                    value={panelMaterialId}
                    onChange={(e) => setPanelMaterialId(e.target.value)}
                    className="flex-1 px-2 py-1.5 border border-gray-300 rounded text-xs focus:ring-1 focus:ring-green-500 bg-white"
                  >
                    <option value="">Select panel...</option>
                    {filteredIronPanelMaterials.map(m => (
                      <option key={m.id} value={m.id}>{m.material_sku} - {m.material_name} (${m.unit_cost.toFixed(2)})</option>
                    ))}
                  </select>
                </div>
                {style === 'Ameristar' && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-600 w-14 flex-shrink-0">Brackets</span>
                    <select
                      value={bracketMaterialId}
                      onChange={(e) => setBracketMaterialId(e.target.value)}
                      className="flex-1 px-2 py-1.5 border border-gray-300 rounded text-xs focus:ring-1 focus:ring-green-500 bg-white"
                    >
                      <option value="">Select brackets...</option>
                      {materials.filter(m => m.category === '08-Hardware' || m.material_name.toLowerCase().includes('bracket')).map(m => (
                        <option key={m.id} value={m.id}>{m.material_sku} - {m.material_name} (${m.unit_cost.toFixed(2)})</option>
                      ))}
                    </select>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Right Panel - Preview & BOM */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Key Stats Bar */}
        <div className="bg-white border-b border-gray-200 px-3 py-2">
          <div className="grid grid-cols-4 gap-2">
            <div className="bg-purple-600 text-white rounded-lg px-3 py-2 text-center">
              <div className="text-[10px] uppercase tracking-wide opacity-80">Cost/Ft</div>
              <div className="text-lg font-bold">${formatNumber(bomResult?.costPerFoot || 0)}</div>
            </div>
            <div className="bg-green-600 text-white rounded-lg px-3 py-2 text-center">
              <div className="text-[10px] uppercase tracking-wide opacity-80">Total Cost</div>
              <div className="text-lg font-bold">${formatWholeNumber(bomResult?.totalCost || 0)}</div>
            </div>
            <div className="bg-amber-500 text-white rounded-lg px-3 py-2 text-center">
              <div className="text-[10px] uppercase tracking-wide opacity-80">Material/Ft</div>
              <div className="text-lg font-bold">${formatNumber(bomResult?.materialCostPerFoot || 0)}</div>
            </div>
            <div className="bg-blue-500 text-white rounded-lg px-3 py-2 text-center">
              <div className="text-[10px] uppercase tracking-wide opacity-80">Labor/Ft</div>
              <div className="text-lg font-bold">${formatNumber(bomResult?.laborCostPerFoot || 0)}</div>
            </div>
          </div>
        </div>

        {/* Test Parameters */}
        <div className="bg-gray-50 border-b border-gray-200 px-4 py-2">
          <div className="flex items-center gap-4">
            <span className="text-xs font-medium text-gray-600">Test:</span>
            <div className="flex items-center gap-1">
              <label className="text-[10px] text-gray-500">Length</label>
              <input
                type="number"
                value={preview.netLength}
                onChange={(e) => setPreview({ ...preview, netLength: Number(e.target.value) })}
                className="w-16 px-2 py-1 border border-gray-300 rounded text-xs"
              />
              <span className="text-[10px] text-gray-400">ft</span>
            </div>
            <div className="flex items-center gap-1">
              <label className="text-[10px] text-gray-500">Lines</label>
              <select
                value={preview.lines}
                onChange={(e) => setPreview({ ...preview, lines: Number(e.target.value) })}
                className="w-12 px-1 py-1 border border-gray-300 rounded text-xs"
              >
                {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-1">
              <label className="text-[10px] text-gray-500">BU</label>
              <select
                value={preview.businessUnitId}
                onChange={(e) => setPreview({ ...preview, businessUnitId: e.target.value })}
                className="w-28 px-1 py-1 border border-gray-300 rounded text-xs"
              >
                {businessUnits.map(bu => (
                  <option key={bu.id} value={bu.id}>{bu.code}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          {/* Warning if no materials selected */}
          {!postMaterialId && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2 mb-3">
              <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-medium text-amber-800">Select materials to see BOM preview</p>
              </div>
            </div>
          )}

          {/* BOM Preview */}
          {bomResult && postMaterialId && (
            <div className="space-y-3">
              {/* Materials Table */}
              <div className="bg-white rounded-lg border border-gray-200">
                <div className="px-3 py-2 border-b border-gray-100 flex items-center justify-between">
                  <h4 className="text-xs font-semibold text-gray-700">Materials (BOM) <span className="text-gray-400 font-normal">· {componentCount} items</span></h4>
                  <span className="text-xs font-semibold text-green-600">${formatNumber(bomResult.totalMaterialCost)}</span>
                </div>
                <table className="w-full text-xs">
                  <thead className="bg-gray-50">
                    <tr className="text-[10px] text-gray-500 uppercase">
                      <th className="text-left py-1.5 px-2">Material</th>
                      <th className="text-right py-1.5 px-2 w-14">Qty</th>
                      <th className="text-right py-1.5 px-2 w-16">Cost</th>
                      <th className="text-right py-1.5 px-2 w-20">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {bomResult.materials.map((item, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="py-1.5 px-2">
                          <div className="font-medium text-gray-900 truncate" title={item.material_name}>{item.material_name}</div>
                          <div className="text-[10px] text-gray-400">{item.material_sku} · {item.category}</div>
                        </td>
                        <td className="py-1.5 px-2 text-right text-gray-700">{Math.ceil(item.quantity).toLocaleString()}</td>
                        <td className="py-1.5 px-2 text-right text-gray-500">${formatNumber(item.unit_cost)}</td>
                        <td className="py-1.5 px-2 text-right font-medium text-green-600">${formatNumber(Math.ceil(item.quantity) * item.unit_cost)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Labor Table */}
              <div className="bg-white rounded-lg border border-gray-200">
                <div className="px-3 py-2 border-b border-gray-100 flex items-center justify-between">
                  <h4 className="text-xs font-semibold text-gray-700">Labor (BOL) <span className="text-gray-400 font-normal">· {laborCount} items</span></h4>
                  <span className="text-xs font-semibold text-blue-600">${formatNumber(bomResult.totalLaborCost)}</span>
                </div>
                <table className="w-full text-xs">
                  <thead className="bg-gray-50">
                    <tr className="text-[10px] text-gray-500 uppercase">
                      <th className="text-left py-1.5 px-2">Labor</th>
                      <th className="text-right py-1.5 px-2 w-16">Rate/Ft</th>
                      <th className="text-right py-1.5 px-2 w-14">Qty</th>
                      <th className="text-right py-1.5 px-2 w-20">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {bomResult.labor.map((item, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="py-1.5 px-2">
                          <div className="font-medium text-gray-900 truncate" title={item.description}>{item.description}</div>
                          <div className="text-[10px] text-gray-400">{item.labor_sku}</div>
                        </td>
                        <td className="py-1.5 px-2 text-right text-gray-500">${formatNumber(item.rate)}</td>
                        <td className="py-1.5 px-2 text-right text-gray-700">{item.quantity.toLocaleString()}</td>
                        <td className="py-1.5 px-2 text-right font-medium text-blue-600">${formatNumber(item.quantity * item.rate)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
