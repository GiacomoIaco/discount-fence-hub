/**
 * SKU Builder Page - V2
 *
 * Full-featured SKU builder with V1 UI, connected to V2 tables.
 * Uses sku_catalog_v2 with JSONB for variables and components.
 */

import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Loader2, Save, RotateCcw, ArrowLeft, Grid3X3, Layers, Package
} from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { showSuccess, showError } from '../../../lib/toast';
import {
  useProductTypesV2,
  useProductStylesV2,
  useProductVariablesV2,
  useSKUV2,
} from '../hooks';

// =============================================================================
// TYPES
// =============================================================================

type ProductType = 'wood-vertical' | 'wood-horizontal' | 'iron';

interface Material {
  id: string;
  material_sku: string;
  material_name: string;
  category: string;
  sub_category: string | null;
  unit_cost: number;
  length_ft: number | null;
  actual_width: number | null;
}

interface EligibleMaterial {
  fence_type: string;
  component_code: string;
  material_id: string;
  material_sku: string;
  material_name: string;
  category: string;
  sub_category: string | null;
  unit_cost: number;
  length_ft: number | null;
  attribute_filter: Record<string, string> | null;
}

// =============================================================================
// COMPONENT
// =============================================================================

interface SKUBuilderPageProps {
  editingSKUId?: string | null;
  onClearSelection?: () => void;
  isAdmin?: boolean;
}

export function SKUBuilderPage({ editingSKUId, onClearSelection, isAdmin: _isAdmin = true }: SKUBuilderPageProps) {
  const queryClient = useQueryClient();

  // UI state
  const [productType, setProductType] = useState<ProductType>('wood-vertical');
  const [editingId, setEditingId] = useState<string | null>(null);

  // Configuration state
  const [skuCode, setSkuCode] = useState('');
  const [skuName, setSkuName] = useState('');
  const [height, setHeight] = useState(6);
  const [styleCode, setStyleCode] = useState('standard');
  const [railCount, setRailCount] = useState(2);
  const [postType, setPostType] = useState<'WOOD' | 'STEEL'>('WOOD');

  // Material selections (component_code -> material_sku)
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

  // =============================================================================
  // DATA FETCHING
  // =============================================================================

  // V2 Product types
  const { data: productTypesV2 = [] } = useProductTypesV2();

  // Get the V2 product type ID based on UI selection
  const selectedProductTypeV2 = useMemo(() => {
    const typeCode = productType === 'wood-vertical' ? 'wood_vertical' :
                    productType === 'wood-horizontal' ? 'wood_horizontal' : 'iron';
    return productTypesV2.find(t => t.code === typeCode);
  }, [productTypesV2, productType]);

  // V2 Styles for selected type
  const { data: stylesV2 = [] } = useProductStylesV2(selectedProductTypeV2?.id || null);

  // V2 Variables for selected type
  const { data: variablesV2 = [] } = useProductVariablesV2(selectedProductTypeV2?.id || null);

  // Get selected style V2
  const selectedStyleV2 = useMemo(() => {
    return stylesV2.find(s => s.code === styleCode) || stylesV2[0];
  }, [stylesV2, styleCode]);

  // Fetch editing SKU (V2)
  const { data: editingSKU } = useSKUV2(editingSKUId || null);

  // Fetch all materials
  const { data: materials = [], isLoading: loadingMaterials } = useQuery({
    queryKey: ['materials-for-sku-builder-v2'],
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

  // Fetch eligible materials from V1 Component Configurator (shared table)
  const fenceTypeDb = productType === 'wood-vertical' ? 'wood_vertical' :
                     productType === 'wood-horizontal' ? 'wood_horizontal' : 'iron';

  const { data: eligibleMaterials = [] } = useQuery({
    queryKey: ['eligible-materials-sku-builder-v2', fenceTypeDb],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_component_eligible_materials')
        .select('*')
        .eq('fence_type', fenceTypeDb);
      if (error) throw error;
      return data as EligibleMaterial[];
    },
  });

  // =============================================================================
  // LOAD EDITING SKU
  // =============================================================================

  useEffect(() => {
    if (editingSKU) {
      // Determine product type from V2 data
      const typeCode = editingSKU.product_type?.code;
      if (typeCode === 'wood_vertical') setProductType('wood-vertical');
      else if (typeCode === 'wood_horizontal') setProductType('wood-horizontal');
      else if (typeCode === 'iron') setProductType('iron');

      setSkuCode(editingSKU.sku_code);
      setSkuName(editingSKU.sku_name);
      setHeight(editingSKU.height);
      setStyleCode(editingSKU.product_style?.code || 'standard');
      setPostType(editingSKU.post_type);

      // Load variables
      const vars = editingSKU.variables || {};
      if (vars.rail_count) setRailCount(Number(vars.rail_count));

      // Load component materials (stored as SKU codes in V2)
      const comps = editingSKU.components || {};
      const findMaterialId = (sku: string) => materials.find(m => m.material_sku === sku)?.id || '';

      setPostMaterialId(findMaterialId(comps.post || ''));
      setPicketMaterialId(findMaterialId(comps.picket || ''));
      setRailMaterialId(findMaterialId(comps.rail || ''));
      setCapMaterialId(findMaterialId(comps.cap || ''));
      setTrimMaterialId(findMaterialId(comps.trim || ''));
      setRotBoardMaterialId(findMaterialId(comps.rot_board || ''));
      setBoardMaterialId(findMaterialId(comps.board || ''));
      setNailerMaterialId(findMaterialId(comps.nailer || ''));
      setVerticalTrimMaterialId(findMaterialId(comps.vertical_trim || ''));
      setPanelMaterialId(findMaterialId(comps.panel || ''));
      setBracketMaterialId(findMaterialId(comps.bracket || ''));

      setEditingId(editingSKU.id);
    }
  }, [editingSKU, materials]);

  // =============================================================================
  // MATERIAL FILTERING
  // =============================================================================

  const getEligibleMaterialsForComponent = (
    componentCode: string,
    attributeFilter?: Record<string, string>
  ): Material[] => {
    let eligible = eligibleMaterials.filter(em => em.component_code === componentCode);

    if (attributeFilter) {
      eligible = eligible.filter(em => {
        if (!em.attribute_filter) return false;
        return Object.entries(attributeFilter).every(
          ([key, value]) => em.attribute_filter?.[key] === value
        );
      });
    }

    const materialIds = new Set(eligible.map(em => em.material_id));
    return materials.filter(m => materialIds.has(m.id));
  };

  // Filtered materials per component (with fallbacks)
  const filteredPostMaterials = useMemo(() => {
    if (productType !== 'iron') {
      const configured = getEligibleMaterialsForComponent('post', { post_type: postType });
      if (configured.length > 0) {
        if (postType === 'WOOD') {
          const requiredLength = height <= 6 ? 8 : 10;
          return configured.filter(m => m.length_ft === null || m.length_ft >= requiredLength);
        }
        return configured;
      }
    } else {
      const configured = getEligibleMaterialsForComponent('post');
      if (configured.length > 0) return configured;
    }
    // Fallback
    const posts = materials.filter(m => m.category === '01-Post');
    if (productType === 'iron') {
      return posts.filter(m => m.sub_category === 'Iron' || m.material_name.toLowerCase().includes('iron'));
    }
    if (postType === 'STEEL') {
      return posts.filter(m => m.sub_category === 'Steel' || m.material_name.toLowerCase().includes('steel'));
    }
    const requiredLength = height <= 6 ? 8 : 10;
    return posts.filter(m =>
      (m.sub_category === 'Wood' || m.material_name.toLowerCase().includes('ptp')) &&
      (m.length_ft === null || m.length_ft >= requiredLength)
    );
  }, [materials, eligibleMaterials, postType, height, productType]);

  const filteredPicketMaterials = useMemo(() => {
    const configured = getEligibleMaterialsForComponent('picket');
    if (configured.length > 0) {
      return configured.filter(m => m.length_ft === null || m.length_ft === height);
    }
    const pickets = materials.filter(m => m.category === '02-Pickets');
    return pickets.filter(m => m.length_ft === null || m.length_ft === height);
  }, [materials, eligibleMaterials, height]);

  const filteredRailMaterials = useMemo(() => {
    const configured = getEligibleMaterialsForComponent('rail');
    if (configured.length > 0) return configured;
    return materials.filter(m => m.category === '03-Rails');
  }, [materials, eligibleMaterials]);

  const filteredCapTrimMaterials = useMemo(() => {
    const configuredCap = getEligibleMaterialsForComponent('cap');
    const configuredTrim = getEligibleMaterialsForComponent('trim');
    if (configuredCap.length > 0 || configuredTrim.length > 0) {
      return [...configuredCap, ...configuredTrim];
    }
    return materials.filter(m => m.category === '04-Cap/Trim');
  }, [materials, eligibleMaterials]);

  const filteredHorizontalBoardMaterials = useMemo(() => {
    const configured = getEligibleMaterialsForComponent('board');
    if (configured.length > 0) {
      return configured.filter(m => m.length_ft === null || m.length_ft === 6 || m.length_ft === 8);
    }
    const boards = materials.filter(m => m.category === '07-Horizontal Boards');
    return boards.filter(m => m.length_ft === null || m.length_ft === 6 || m.length_ft === 8);
  }, [materials, eligibleMaterials]);

  const filteredIronPanelMaterials = useMemo(() => {
    const configured = getEligibleMaterialsForComponent('panel');
    if (configured.length > 0) return configured;
    const panels = materials.filter(m => m.category === '09-Iron' && m.sub_category === 'Panel');
    return panels.filter(m => m.length_ft === null || m.length_ft === 8);
  }, [materials, eligibleMaterials]);

  const filteredBracketMaterials = useMemo(() => {
    const configured = getEligibleMaterialsForComponent('bracket');
    if (configured.length > 0) return configured;
    return materials.filter(m => m.category === '08-Hardware' || m.material_name.toLowerCase().includes('bracket'));
  }, [materials, eligibleMaterials]);

  const filteredNailerMaterials = useMemo(() => {
    const configured = getEligibleMaterialsForComponent('nailer');
    if (configured.length > 0) return configured;
    return materials.filter(m => m.category === '03-Rails');
  }, [materials, eligibleMaterials]);

  const filteredRotBoardMaterials = useMemo(() => {
    const configured = getEligibleMaterialsForComponent('rot_board');
    if (configured.length > 0) return configured;
    return materials.filter(m =>
      m.material_name.toLowerCase().includes('rot') ||
      m.sub_category?.toLowerCase().includes('rot')
    );
  }, [materials, eligibleMaterials]);

  const filteredVerticalTrimMaterials = useMemo(() => {
    const configured = getEligibleMaterialsForComponent('vertical_trim');
    if (configured.length > 0) return configured;
    return materials.filter(m => m.category === '04-Cap/Trim' && m.sub_category === 'Trim');
  }, [materials, eligibleMaterials]);

  // =============================================================================
  // HELPERS
  // =============================================================================

  const getMaterial = (id: string): Material | undefined => materials.find(m => m.id === id);
  const getMaterialSku = (id: string): string => getMaterial(id)?.material_sku || '';

  // Generate suggested SKU name
  const suggestedSkuName = useMemo(() => {
    const h = `${height}'`;
    const styleShort = styleCode.includes('good_neighbor') ? 'GN' :
                       styleCode.includes('board_on_board') ? 'BOB' : 'STD';
    const pt = postType === 'STEEL' ? 'ST' : 'WD';
    const rails = productType === 'wood-vertical' ? `${railCount}R` : '';

    if (productType === 'wood-vertical') {
      return `${h} ${styleShort} ${rails} : ${pt}`;
    } else if (productType === 'wood-horizontal') {
      return `${h} HOR ${styleShort} : ${pt}`;
    } else {
      return `${h} Iron ${styleCode}`;
    }
  }, [height, styleCode, postType, railCount, productType]);

  // =============================================================================
  // RESET & PRODUCT TYPE CHANGE
  // =============================================================================

  const resetForm = () => {
    setEditingId(null);
    setSkuCode('');
    setSkuName('');
    setHeight(6);
    setStyleCode('standard');
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

  const handleProductTypeChange = (type: ProductType) => {
    setProductType(type);
    setStyleCode('standard');
    if (type === 'iron') {
      setPostType('STEEL');
    } else {
      setPostType('WOOD');
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

  // =============================================================================
  // SAVE MUTATION
  // =============================================================================

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!skuCode) throw new Error('SKU code is required');
      if (!selectedProductTypeV2) throw new Error('Product type not found');
      if (!selectedStyleV2) throw new Error('Style not found');

      // Build variables JSONB
      const variables: Record<string, number | string> = {};
      if (productType === 'wood-vertical') {
        variables.rail_count = railCount;
      }
      // Add any other variables from the V2 schema
      variablesV2.forEach(v => {
        if (v.variable_code === 'post_spacing') {
          variables.post_spacing = selectedStyleV2.formula_adjustments?.post_spacing ||
                                  selectedProductTypeV2.default_post_spacing || 8;
        }
      });

      // Build components JSONB (store material SKUs)
      const components: Record<string, string> = {};

      if (postMaterialId) components.post = getMaterialSku(postMaterialId);
      if (picketMaterialId) components.picket = getMaterialSku(picketMaterialId);
      if (railMaterialId) components.rail = getMaterialSku(railMaterialId);
      if (capMaterialId) components.cap = getMaterialSku(capMaterialId);
      if (trimMaterialId) components.trim = getMaterialSku(trimMaterialId);
      if (rotBoardMaterialId) components.rot_board = getMaterialSku(rotBoardMaterialId);
      if (boardMaterialId) components.board = getMaterialSku(boardMaterialId);
      if (nailerMaterialId) components.nailer = getMaterialSku(nailerMaterialId);
      if (verticalTrimMaterialId) components.vertical_trim = getMaterialSku(verticalTrimMaterialId);
      if (panelMaterialId) components.panel = getMaterialSku(panelMaterialId);
      if (bracketMaterialId) components.bracket = getMaterialSku(bracketMaterialId);

      const payload = {
        sku_code: skuCode,
        sku_name: skuName || suggestedSkuName,
        product_type_id: selectedProductTypeV2.id,
        product_style_id: selectedStyleV2.id,
        height,
        post_type: postType,
        variables,
        components,
        is_active: true,
        updated_at: new Date().toISOString(),
      };

      if (editingId) {
        const { error } = await supabase
          .from('sku_catalog_v2')
          .update(payload)
          .eq('id', editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('sku_catalog_v2')
          .insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      showSuccess(editingId ? 'SKU updated' : 'SKU created');
      queryClient.invalidateQueries({ queryKey: ['sku-catalog-v2'] });
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

  // =============================================================================
  // RENDER
  // =============================================================================

  if (loadingMaterials) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-purple-600 mx-auto mb-3" />
          <p className="text-gray-600">Loading materials...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex bg-gray-50 overflow-hidden h-full">
      {/* Configuration Panel */}
      <div className="w-[520px] bg-white border-r border-gray-200 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-4 py-2 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {editingId && (
              <button
                onClick={resetForm}
                className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded"
                title="New SKU"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <div>
              <h1 className="text-base font-bold text-gray-900">
                {editingId ? 'Edit SKU' : 'SKU Builder'}
              </h1>
              {editingId && <p className="text-xs text-purple-600">{skuCode}</p>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={resetForm}
              className="px-3 py-1.5 text-gray-600 hover:bg-gray-100 rounded text-xs font-medium flex items-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset
            </button>
            <button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending || !skuCode}
              className={`px-3 py-1.5 text-white rounded text-xs font-medium flex items-center gap-1.5 disabled:bg-gray-400 ${
                editingId ? 'bg-purple-600 hover:bg-purple-700' : 'bg-purple-600 hover:bg-purple-700'
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
                className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-purple-500"
              />
            </div>
            <div className="flex-1">
              <label className="block text-[10px] font-medium text-gray-500 mb-0.5">SKU Name</label>
              <input
                type="text"
                value={skuName || suggestedSkuName}
                onChange={(e) => setSkuName(e.target.value)}
                className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-purple-500"
              />
            </div>
          </div>

          {/* Product Type Tabs */}
          <div className="flex rounded border border-gray-200 overflow-hidden mb-3">
            <button
              onClick={() => handleProductTypeChange('wood-vertical')}
              className={`flex-1 px-2 py-1.5 text-xs font-medium flex items-center justify-center gap-1 ${
                productType === 'wood-vertical' ? 'bg-purple-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              <Grid3X3 className="w-3.5 h-3.5" />
              Vertical
            </button>
            <button
              onClick={() => handleProductTypeChange('wood-horizontal')}
              className={`flex-1 px-2 py-1.5 text-xs font-medium flex items-center justify-center gap-1 border-l border-gray-200 ${
                productType === 'wood-horizontal' ? 'bg-purple-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              Horizontal
            </button>
            <button
              onClick={() => handleProductTypeChange('iron')}
              className={`flex-1 px-2 py-1.5 text-xs font-medium flex items-center justify-center gap-1 border-l border-gray-200 ${
                productType === 'iron' ? 'bg-purple-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              <Package className="w-3.5 h-3.5" />
              Iron
            </button>
          </div>

          {/* Attributes */}
          <div className="flex gap-2 mb-3">
            <div className="flex-1">
              <label className="block text-[10px] font-medium text-gray-500 mb-0.5">Style</label>
              <select
                value={styleCode}
                onChange={(e) => setStyleCode(e.target.value)}
                className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:ring-1 focus:ring-purple-500"
              >
                {stylesV2.map(s => (
                  <option key={s.id} value={s.code}>{s.name}</option>
                ))}
              </select>
            </div>
            <div className="w-16">
              <label className="block text-[10px] font-medium text-gray-500 mb-0.5">Height</label>
              <select
                value={height}
                onChange={(e) => { setHeight(Number(e.target.value)); setPicketMaterialId(''); }}
                className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:ring-1 focus:ring-purple-500"
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
                    className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:ring-1 focus:ring-purple-500"
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
                    onChange={(e) => { setPostType(e.target.value as 'WOOD' | 'STEEL'); setPostMaterialId(''); }}
                    className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:ring-1 focus:ring-purple-500"
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
                  onChange={(e) => { setPostType(e.target.value as 'WOOD' | 'STEEL'); setPostMaterialId(''); }}
                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:ring-1 focus:ring-purple-500"
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
                className="flex-1 px-2 py-1.5 border border-gray-300 rounded text-xs focus:ring-1 focus:ring-purple-500 bg-white"
              >
                <option value="">Select post...</option>
                {filteredPostMaterials.map(m => (
                  <option key={m.id} value={m.id}>
                    {m.material_sku} - {m.material_name} (${m.unit_cost.toFixed(2)})
                  </option>
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
                    className="flex-1 px-2 py-1.5 border border-gray-300 rounded text-xs focus:ring-1 focus:ring-purple-500 bg-white"
                  >
                    <option value="">Select pickets...</option>
                    {filteredPicketMaterials.map(m => (
                      <option key={m.id} value={m.id}>
                        {m.material_sku} - {m.material_name} (${m.unit_cost.toFixed(2)})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-600 w-14 flex-shrink-0">Rails</span>
                  <select
                    value={railMaterialId}
                    onChange={(e) => setRailMaterialId(e.target.value)}
                    className="flex-1 px-2 py-1.5 border border-gray-300 rounded text-xs focus:ring-1 focus:ring-purple-500 bg-white"
                  >
                    <option value="">Select rails...</option>
                    {filteredRailMaterials.map(m => (
                      <option key={m.id} value={m.id}>
                        {m.material_sku} - {m.material_name} (${m.unit_cost.toFixed(2)})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex gap-2">
                  <div className="flex items-center gap-2 flex-1">
                    <span className="text-xs text-gray-600 w-14 flex-shrink-0">Cap</span>
                    <select
                      value={capMaterialId}
                      onChange={(e) => setCapMaterialId(e.target.value)}
                      className="flex-1 px-2 py-1.5 border border-gray-300 rounded text-xs focus:ring-1 focus:ring-purple-500 bg-white"
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
                      className="flex-1 px-2 py-1.5 border border-gray-300 rounded text-xs focus:ring-1 focus:ring-purple-500 bg-white"
                    >
                      <option value="">None</option>
                      {filteredCapTrimMaterials.filter(m => m.sub_category === 'Trim').map(m => (
                        <option key={m.id} value={m.id}>{m.material_sku} - {m.material_name}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-600 w-14 flex-shrink-0">Rot Brd</span>
                  <select
                    value={rotBoardMaterialId}
                    onChange={(e) => setRotBoardMaterialId(e.target.value)}
                    className="flex-1 px-2 py-1.5 border border-gray-300 rounded text-xs focus:ring-1 focus:ring-purple-500 bg-white"
                  >
                    <option value="">None</option>
                    {filteredRotBoardMaterials.map(m => (
                      <option key={m.id} value={m.id}>{m.material_sku} - {m.material_name}</option>
                    ))}
                  </select>
                </div>
              </>
            )}

            {/* Wood Horizontal Materials */}
            {productType === 'wood-horizontal' && (
              <>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-600 w-14 flex-shrink-0">Board</span>
                  <select
                    value={boardMaterialId}
                    onChange={(e) => setBoardMaterialId(e.target.value)}
                    className="flex-1 px-2 py-1.5 border border-gray-300 rounded text-xs focus:ring-1 focus:ring-purple-500 bg-white"
                  >
                    <option value="">Select board...</option>
                    {filteredHorizontalBoardMaterials.map(m => (
                      <option key={m.id} value={m.id}>
                        {m.material_sku} - {m.material_name} (${m.unit_cost.toFixed(2)})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-600 w-14 flex-shrink-0">Nailer</span>
                  <select
                    value={nailerMaterialId}
                    onChange={(e) => setNailerMaterialId(e.target.value)}
                    className="flex-1 px-2 py-1.5 border border-gray-300 rounded text-xs focus:ring-1 focus:ring-purple-500 bg-white"
                  >
                    <option value="">None</option>
                    {filteredNailerMaterials.map(m => (
                      <option key={m.id} value={m.id}>{m.material_sku} - {m.material_name}</option>
                    ))}
                  </select>
                </div>
                <div className="flex gap-2">
                  <div className="flex items-center gap-2 flex-1">
                    <span className="text-xs text-gray-600 w-14 flex-shrink-0">Cap</span>
                    <select
                      value={capMaterialId}
                      onChange={(e) => setCapMaterialId(e.target.value)}
                      className="flex-1 px-2 py-1.5 border border-gray-300 rounded text-xs focus:ring-1 focus:ring-purple-500 bg-white"
                    >
                      <option value="">None</option>
                      {filteredCapTrimMaterials.filter(m => m.sub_category === 'Cap').map(m => (
                        <option key={m.id} value={m.id}>{m.material_sku} - {m.material_name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-center gap-2 flex-1">
                    <span className="text-xs text-gray-600 w-10 flex-shrink-0">VTrim</span>
                    <select
                      value={verticalTrimMaterialId}
                      onChange={(e) => setVerticalTrimMaterialId(e.target.value)}
                      className="flex-1 px-2 py-1.5 border border-gray-300 rounded text-xs focus:ring-1 focus:ring-purple-500 bg-white"
                    >
                      <option value="">None</option>
                      {filteredVerticalTrimMaterials.map(m => (
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
                    className="flex-1 px-2 py-1.5 border border-gray-300 rounded text-xs focus:ring-1 focus:ring-purple-500 bg-white"
                  >
                    <option value="">Select panel...</option>
                    {filteredIronPanelMaterials.map(m => (
                      <option key={m.id} value={m.id}>
                        {m.material_sku} - {m.material_name} (${m.unit_cost.toFixed(2)})
                      </option>
                    ))}
                  </select>
                </div>
                {styleCode.includes('ameristar') && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-600 w-14 flex-shrink-0">Bracket</span>
                    <select
                      value={bracketMaterialId}
                      onChange={(e) => setBracketMaterialId(e.target.value)}
                      className="flex-1 px-2 py-1.5 border border-gray-300 rounded text-xs focus:ring-1 focus:ring-purple-500 bg-white"
                    >
                      <option value="">Select bracket...</option>
                      {filteredBracketMaterials.map(m => (
                        <option key={m.id} value={m.id}>
                          {m.material_sku} - {m.material_name} (${m.unit_cost.toFixed(2)})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Preview Panel */}
      <div className="flex-1 bg-gray-50 p-4 overflow-auto">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h2 className="text-sm font-semibold text-gray-900 mb-3">SKU Preview</h2>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-500">SKU Code:</span>
              <span className="ml-2 font-mono font-medium">{skuCode || '-'}</span>
            </div>
            <div>
              <span className="text-gray-500">SKU Name:</span>
              <span className="ml-2">{skuName || suggestedSkuName || '-'}</span>
            </div>
            <div>
              <span className="text-gray-500">Type:</span>
              <span className="ml-2">{selectedProductTypeV2?.name || '-'}</span>
            </div>
            <div>
              <span className="text-gray-500">Style:</span>
              <span className="ml-2">{selectedStyleV2?.name || '-'}</span>
            </div>
            <div>
              <span className="text-gray-500">Height:</span>
              <span className="ml-2">{height} ft</span>
            </div>
            <div>
              <span className="text-gray-500">Post Type:</span>
              <span className="ml-2">{postType}</span>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-gray-200">
            <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">Selected Materials</h3>
            <div className="space-y-1 text-xs">
              {postMaterialId && <MaterialPreview label="Post" material={getMaterial(postMaterialId)} />}
              {picketMaterialId && <MaterialPreview label="Picket" material={getMaterial(picketMaterialId)} />}
              {railMaterialId && <MaterialPreview label="Rail" material={getMaterial(railMaterialId)} />}
              {boardMaterialId && <MaterialPreview label="Board" material={getMaterial(boardMaterialId)} />}
              {nailerMaterialId && <MaterialPreview label="Nailer" material={getMaterial(nailerMaterialId)} />}
              {capMaterialId && <MaterialPreview label="Cap" material={getMaterial(capMaterialId)} />}
              {trimMaterialId && <MaterialPreview label="Trim" material={getMaterial(trimMaterialId)} />}
              {rotBoardMaterialId && <MaterialPreview label="Rot Board" material={getMaterial(rotBoardMaterialId)} />}
              {verticalTrimMaterialId && <MaterialPreview label="V. Trim" material={getMaterial(verticalTrimMaterialId)} />}
              {panelMaterialId && <MaterialPreview label="Panel" material={getMaterial(panelMaterialId)} />}
              {bracketMaterialId && <MaterialPreview label="Bracket" material={getMaterial(bracketMaterialId)} />}
            </div>
          </div>

          <div className="mt-4 p-3 bg-purple-50 rounded-lg text-xs text-purple-700">
            <p className="font-medium">V2 Architecture</p>
            <p className="mt-1 text-purple-600">
              This SKU will be saved to <code className="bg-purple-100 px-1 rounded">sku_catalog_v2</code> with
              JSONB variables and components for formula-based BOM calculation.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// Material preview helper
function MaterialPreview({ label, material }: { label: string; material?: Material }) {
  if (!material) return null;
  return (
    <div className="flex justify-between text-gray-600">
      <span>{label}:</span>
      <span className="font-mono">{material.material_sku} - ${material.unit_cost.toFixed(2)}</span>
    </div>
  );
}
