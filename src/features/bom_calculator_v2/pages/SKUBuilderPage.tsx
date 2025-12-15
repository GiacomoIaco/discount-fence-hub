/**
 * SKU Builder Page - V2
 *
 * Full-featured SKU builder with V1 UI, connected to V2 tables.
 * Uses sku_catalog_v2 with JSONB for variables and components.
 *
 * REFACTORED: Now dynamically renders components from assignedComponentsV2
 * instead of hardcoded component lists.
 */

import { useState, useMemo, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Loader2, Save, RotateCcw, ArrowLeft, Grid3X3, Layers, Package, AlertCircle, Play
} from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { showSuccess, showError } from '../../../lib/toast';
import {
  useProductTypesV2,
  useProductStylesV2,
  useProductVariablesV2,
  useSKUV2,
  useMaterialEligibilityV2,
  useProductTypeComponentsFull,
  useProductTypeLaborGroupsV2,
  useLaborGroupEligibilityV2,
} from '../hooks';
import type { ProductTypeComponentFull, ProductVariableV2, LaborGroupEligibilityV2 } from '../hooks';
import {
  FormulaInterpreter,
  buildMaterialAttributes,
  createFormulaContext,
  applyProjectRounding,
} from '../services/FormulaInterpreter';
import type { FormulaResult } from '../services/FormulaInterpreter';

// =============================================================================
// TYPES
// =============================================================================

type ProductType = 'wood-vertical' | 'wood-horizontal' | 'iron';

// Extended FormulaResult with cost fields
interface EnrichedFormulaResult extends FormulaResult {
  component_name: string;
  unit_cost: number;
  total_cost: number;
  is_labor: boolean;
  labor_sku: string;
}

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

interface LaborCode {
  id: string;
  labor_sku: string;
  description: string;
  fence_category_standard: string | null;
  unit_type: string;
  is_active: boolean;
}

interface LaborRate {
  id: string;
  labor_code_id: string;
  business_unit_id: string;
  rate: number;
  labor_code?: LaborCode;
}

interface BusinessUnit {
  id: string;
  code: string;
  name: string;
  city_code: string;
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
  const [styleCode, setStyleCode] = useState('standard');

  // Dynamic variable values (variable_code -> value)
  const [variableValues, setVariableValues] = useState<Record<string, string | number>>({});

  // Dynamic component selections (component_code -> material_id)
  const [componentSelections, setComponentSelections] = useState<Record<string, string>>({});

  // Test panel state
  const [testLength, setTestLength] = useState(100);
  const [testLines, setTestLines] = useState(4);
  const [testGates, setTestGates] = useState(0);
  const [testResults, setTestResults] = useState<EnrichedFormulaResult[]>([]);
  const [isCalculating, setIsCalculating] = useState(false);
  const [concreteType, setConcreteType] = useState<'3-part' | 'yellow-bags' | 'red-bags'>('3-part');
  const [businessUnitId, setBusinessUnitId] = useState<string>('');

  // Computed costs from test results
  const [totalMaterialCost, setTotalMaterialCost] = useState(0);
  const [totalLaborCost, setTotalLaborCost] = useState(0);

  // =============================================================================
  // DATA FETCHING
  // =============================================================================

  // V2 Product types
  const { data: productTypesV2 = [] } = useProductTypesV2();

  // Get the V2 product type ID based on UI selection
  const selectedProductTypeV2 = useMemo(() => {
    // Database uses dashes: wood-vertical, wood-horizontal, iron
    return productTypesV2.find(t => t.code === productType);
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

  // V2: Fetch material eligibility rules for this product type
  const { data: materialEligibilityRulesV2 = [] } = useMaterialEligibilityV2(selectedProductTypeV2?.id || null);

  // V2: Fetch assigned components for this product type
  const { data: assignedComponentsV2 = [] } = useProductTypeComponentsFull(selectedProductTypeV2?.id || null);

  // V2: Fetch labor groups for this product type
  const { data: laborGroupsV2 = [] } = useProductTypeLaborGroupsV2(selectedProductTypeV2?.id || null);

  // V2: Fetch labor group eligibility rules (which labor codes apply to which groups with conditions)
  const { data: laborGroupEligibilityV2 = [] } = useLaborGroupEligibilityV2(selectedProductTypeV2?.id || null);

  // Fetch business units (shared V1 table)
  const { data: businessUnits = [] } = useQuery({
    queryKey: ['business-units-for-sku-builder-v2'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('business_units')
        .select('*')
        .eq('is_active', true)
        .order('code');
      if (error) throw error;
      return data as BusinessUnit[];
    },
  });

  // Fetch labor rates for selected business unit (shared V1 table)
  const { data: laborRates = [] } = useQuery({
    queryKey: ['labor-rates-for-sku-builder-v2', businessUnitId],
    queryFn: async () => {
      if (!businessUnitId) return [];
      const { data, error } = await supabase
        .from('labor_rates')
        .select(`
          *,
          labor_code:labor_codes(*)
        `)
        .eq('business_unit_id', businessUnitId);
      if (error) throw error;
      return data as LaborRate[];
    },
    enabled: !!businessUnitId,
  });

  // Set default business unit
  useEffect(() => {
    if (businessUnits.length > 0 && !businessUnitId) {
      setBusinessUnitId(businessUnits[0].id);
    }
  }, [businessUnits, businessUnitId]);

  // =============================================================================
  // DERIVED VALUES
  // =============================================================================

  // Get specific variable values with defaults
  const height = useMemo(() => {
    const val = variableValues.height;
    return typeof val === 'number' ? val : (typeof val === 'string' ? parseInt(val) : 6);
  }, [variableValues.height]);

  const postType = useMemo(() => {
    return (variableValues.post_type as 'WOOD' | 'STEEL') || 'WOOD';
  }, [variableValues.post_type]);

  const railCount = useMemo(() => {
    const val = variableValues.rail_count;
    return typeof val === 'number' ? val : (typeof val === 'string' ? parseInt(val) : 2);
  }, [variableValues.rail_count]);

  // Initialize default variable values when variables change
  useEffect(() => {
    if (variablesV2.length > 0 && Object.keys(variableValues).length === 0) {
      const defaults: Record<string, string | number> = {};
      variablesV2.forEach(v => {
        if (v.default_value !== null) {
          defaults[v.variable_code] = v.variable_type === 'integer' || v.variable_type === 'decimal'
            ? parseFloat(v.default_value)
            : v.default_value;
        }
      });
      // Add standard defaults if not present
      if (!defaults.height) defaults.height = 6;
      if (!defaults.post_type) defaults.post_type = productType === 'iron' ? 'STEEL' : 'WOOD';
      if (!defaults.rail_count && productType === 'wood-vertical') defaults.rail_count = 2;
      setVariableValues(defaults);
    }
  }, [variablesV2, productType]);

  // =============================================================================
  // LOAD EDITING SKU
  // =============================================================================

  useEffect(() => {
    if (editingSKU && materials.length > 0) {
      // Determine product type from V2 data (database uses dashes)
      const typeCode = editingSKU.product_type?.code as ProductType;
      if (typeCode) setProductType(typeCode);

      setSkuCode(editingSKU.sku_code);
      setSkuName(editingSKU.sku_name);
      setStyleCode(editingSKU.product_style?.code || 'standard');

      // Load variables
      const vars = editingSKU.variables || {};
      const loadedVars: Record<string, string | number> = {
        height: editingSKU.height,
        post_type: editingSKU.post_type,
      };
      Object.entries(vars).forEach(([key, value]) => {
        loadedVars[key] = value;
      });
      setVariableValues(loadedVars);

      // Load component materials (stored as SKU codes in V2)
      const comps = editingSKU.components || {};
      const findMaterialId = (sku: string) => materials.find(m => m.material_sku === sku)?.id || '';

      const selections: Record<string, string> = {};
      Object.entries(comps).forEach(([componentCode, materialSku]) => {
        if (typeof materialSku === 'string') {
          const materialId = findMaterialId(materialSku);
          if (materialId) {
            selections[componentCode] = materialId;
          }
        }
      });
      setComponentSelections(selections);

      setEditingId(editingSKU.id);
    }
  }, [editingSKU, materials]);

  // =============================================================================
  // V2 MATERIAL FILTERING
  // =============================================================================

  // Get eligible materials for a component by expanding rules
  const getEligibleMaterialsForComponent = useCallback((
    componentCode: string,
    componentTypeId: string,
    attributeFilter?: Record<string, string>
  ): Material[] => {
    // Get rules for this component
    let rules = materialEligibilityRulesV2.filter(r => r.component_type_id === componentTypeId);

    // Apply attribute filter if provided
    if (attributeFilter) {
      rules = rules.filter(rule => {
        if (!rule.attribute_filter) return true;
        return Object.entries(attributeFilter).every(
          ([key, value]) => rule.attribute_filter?.[key] === value
        );
      });
    }

    // Expand rules to get material IDs
    const eligibleMaterialIds = new Set<string>();
    for (const rule of rules) {
      if (rule.selection_mode === 'specific' && rule.material_id) {
        eligibleMaterialIds.add(rule.material_id);
      } else if (rule.selection_mode === 'category' && rule.material_category) {
        materials
          .filter(m => m.category === rule.material_category)
          .forEach(m => eligibleMaterialIds.add(m.id));
      } else if (rule.selection_mode === 'subcategory' && rule.material_category && rule.material_subcategory) {
        materials
          .filter(m => m.category === rule.material_category && m.sub_category === rule.material_subcategory)
          .forEach(m => eligibleMaterialIds.add(m.id));
      }
    }

    let eligible = materials.filter(m => eligibleMaterialIds.has(m.id));

    // Apply height filter for pickets and similar
    if (componentCode === 'picket') {
      eligible = eligible.filter(m => m.length_ft === null || m.length_ft === height);
    }

    // Apply post length filter
    if (componentCode === 'post' && postType === 'WOOD') {
      const requiredLength = height <= 6 ? 8 : 10;
      eligible = eligible.filter(m => m.length_ft === null || m.length_ft >= requiredLength);
    }

    return eligible;
  }, [materialEligibilityRulesV2, materials, height, postType]);

  // Check if component should be visible based on visibility_conditions
  const isComponentVisible = useCallback((component: ProductTypeComponentFull): boolean => {
    if (!component.visibility_conditions) return true;

    // Check each condition (case-insensitive comparison)
    return Object.entries(component.visibility_conditions).every(([varCode, allowedValues]) => {
      const currentValue = String(variableValues[varCode] || '').toUpperCase();
      // Convert allowed values to uppercase for comparison
      const uppercaseAllowed = (allowedValues as string[]).map(v => v.toUpperCase());
      return uppercaseAllowed.includes(currentValue);
    });
  }, [variableValues]);

  // Get visible material components (non-labor, assigned, visible)
  const visibleMaterialComponents = useMemo(() => {
    return assignedComponentsV2
      .filter(c => c.is_assigned && !c.is_labor)
      .filter(c => isComponentVisible(c))
      .sort((a, b) => (a.display_order || 999) - (b.display_order || 999));
  }, [assignedComponentsV2, isComponentVisible]);

  // Check if all required fields are filled (for auto-calculation)
  const allRequiredFieldsFilled = useMemo(() => {
    // Need at least style selected
    if (!selectedStyleV2) return false;

    // Check all required (non-optional) visible components have materials selected
    const requiredComponents = visibleMaterialComponents.filter(c => !c.is_optional);
    const allHaveMaterials = requiredComponents.every(c => {
      const selectedId = componentSelections[c.component_code];
      return selectedId && selectedId !== '';
    });

    return allHaveMaterials && requiredComponents.length > 0;
  }, [selectedStyleV2, visibleMaterialComponents, componentSelections]);

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
    setStyleCode('standard');
    setVariableValues({});
    setComponentSelections({});
    onClearSelection?.();
  };

  const handleProductTypeChange = (type: ProductType) => {
    setProductType(type);
    setStyleCode('standard');
    setVariableValues({
      height: 6,
      post_type: type === 'iron' ? 'STEEL' : 'WOOD',
      rail_count: 2,
    });
    setComponentSelections({});
  };

  // Update a variable value
  const setVariableValue = (code: string, value: string | number) => {
    setVariableValues(prev => ({ ...prev, [code]: value }));
    // Clear dependent component selections when post_type changes
    if (code === 'post_type') {
      setComponentSelections(prev => {
        const next = { ...prev };
        delete next.post;
        return next;
      });
    }
    if (code === 'height') {
      setComponentSelections(prev => {
        const next = { ...prev };
        delete next.picket;
        delete next.post;
        return next;
      });
    }
  };

  // Update a component selection
  const setComponentSelection = (componentCode: string, materialId: string) => {
    setComponentSelections(prev => ({
      ...prev,
      [componentCode]: materialId
    }));
  };

  // Auto-select steel_post_cap based on post_type and cap selection
  // PC01 = no cap, PC02 = with cap
  const capSelection = componentSelections['cap'];
  const steelPostCapSelection = componentSelections['steel_post_cap'];
  useEffect(() => {
    if (postType === 'STEEL') {
      const hasCapSelected = !!capSelection;
      const targetSku = hasCapSelected ? 'PC02' : 'PC01';
      const targetMaterial = materials.find(m => m.material_sku === targetSku);

      if (targetMaterial) {
        const currentMaterial = steelPostCapSelection ? materials.find(m => m.id === steelPostCapSelection) : null;

        // Only update if selection is different
        if (!currentMaterial || currentMaterial.material_sku !== targetSku) {
          setComponentSelections(prev => ({
            ...prev,
            steel_post_cap: targetMaterial.id
          }));
        }
      }
    } else {
      // Clear steel_post_cap when not using steel posts
      if (steelPostCapSelection) {
        setComponentSelections(prev => {
          const next = { ...prev };
          delete next.steel_post_cap;
          return next;
        });
      }
    }
  }, [postType, capSelection, steelPostCapSelection, materials]);

  // =============================================================================
  // BOM TEST CALCULATION
  // =============================================================================

  const runBOMTest = useCallback(async () => {
    if (!selectedProductTypeV2 || !selectedStyleV2) {
      showError('Select a product type and style first');
      return;
    }

    setIsCalculating(true);
    try {
      const interpreter = new FormulaInterpreter(supabase);

      // Build components JSONB (material SKUs for attributes)
      const components: Record<string, string> = {};
      Object.entries(componentSelections).forEach(([componentCode, materialId]) => {
        if (materialId) {
          components[componentCode] = getMaterialSku(materialId);
        }
      });

      // Build material attributes
      const materialAttrs = await buildMaterialAttributes(supabase, components);

      // Build variables including concrete_type
      const vars: Record<string, number | string> = {
        ...variableValues,
        height,
        rail_count: railCount,
        post_spacing: selectedStyleV2.formula_adjustments?.post_spacing ||
                     selectedProductTypeV2.default_post_spacing || 8,
        concrete_type: concreteType,
        style: styleCode, // Add style for formula conditions
      };

      // Create context
      const context = createFormulaContext(
        testLength,
        testLines,
        testGates,
        height,
        vars,
        selectedStyleV2.formula_adjustments || {},
        materialAttrs
      );

      // Only calculate formulas for visible material components
      // This excludes components like steel_post_cap when post_type is WOOD
      const visibleComponentCodes = visibleMaterialComponents.map(c => c.component_code);

      // Execute formulas only for visible components
      const results = await interpreter.executeAllFormulas(
        selectedProductTypeV2.id,
        selectedStyleV2.id,
        context,
        visibleComponentCodes  // Pass filter to only calculate visible components
      );

      // Apply project-level rounding
      const roundedResults = applyProjectRounding(results);

      // Enrich with component names and material costs
      let matCost = 0;
      let labCost = 0;

      // Enrich material results with costs
      // Only include components that have a material selected
      const enrichedResults = await Promise.all(roundedResults.map(async (r) => {
        const comp = assignedComponentsV2.find(c => c.component_code === r.component_code);
        const materialSku = components[r.component_code];

        // Skip labor components from old system - we calculate labor separately now
        if (comp?.is_labor) {
          return null; // Filter out old labor components
        }

        // Skip components that have no material selected (optional items not chosen)
        if (!materialSku) {
          return null;
        }

        // Look up the actual material to get name and cost
        const mat = materials.find(m => m.material_sku === materialSku);
        if (!mat) {
          return null; // Material not found, skip
        }

        const unitCost = mat.unit_cost;
        matCost += r.rounded_value * unitCost;

        return {
          ...r,
          // Show the actual MATERIAL name, not the component type name
          component_name: mat.material_name || mat.material_sku,
          unit_cost: unitCost,
          total_cost: r.rounded_value * unitCost,
          is_labor: false,
          labor_sku: '',
        };
      }));

      // Filter out nulls (labor components, unselected optionals, missing materials)
      const materialResults = enrichedResults.filter((r): r is EnrichedFormulaResult => r !== null);

      // =============================================================================
      // CONCRETE: Calculate based on concreteType and post quantity (like V1)
      // =============================================================================
      const concreteResults: EnrichedFormulaResult[] = [];

      // Get post quantity from calculated values
      const postQty = context.calculatedValues.post_qty || 0;

      if (postQty > 0) {
        // Concrete formulas (matching V1 exactly):
        // 3-part: CTS = posts/10, CTP = posts/20, CTQ = posts*0.5
        // yellow-bags: CTY = posts*0.65
        // red-bags: CTR = posts*1

        if (concreteType === '3-part') {
          const cts = materials.find(m => m.material_sku === 'CTS');
          const ctp = materials.find(m => m.material_sku === 'CTP');
          const ctq = materials.find(m => m.material_sku === 'CTQ');

          if (cts) {
            const qty = Math.ceil(postQty / 10);
            matCost += qty * (cts.unit_cost || 0);
            concreteResults.push({
              component_code: 'concrete_sand',
              component_name: cts.material_name || 'Concrete Sand',
              raw_value: postQty / 10,
              rounded_value: qty,
              rounding_level: 'project',
              formula_used: '[post_qty]/10',
              unit_cost: cts.unit_cost || 0,
              total_cost: qty * (cts.unit_cost || 0),
              is_labor: false,
              labor_sku: '',
            });
          }
          if (ctp) {
            const qty = Math.ceil(postQty / 20);
            matCost += qty * (ctp.unit_cost || 0);
            concreteResults.push({
              component_code: 'concrete_portland',
              component_name: ctp.material_name || 'Concrete Portland',
              raw_value: postQty / 20,
              rounded_value: qty,
              rounding_level: 'project',
              formula_used: '[post_qty]/20',
              unit_cost: ctp.unit_cost || 0,
              total_cost: qty * (ctp.unit_cost || 0),
              is_labor: false,
              labor_sku: '',
            });
          }
          if (ctq) {
            const qty = Math.ceil(postQty * 0.5);
            matCost += qty * (ctq.unit_cost || 0);
            concreteResults.push({
              component_code: 'concrete_quickrock',
              component_name: ctq.material_name || 'Concrete Quickite',
              raw_value: postQty * 0.5,
              rounded_value: qty,
              rounding_level: 'project',
              formula_used: '[post_qty]*0.5',
              unit_cost: ctq.unit_cost || 0,
              total_cost: qty * (ctq.unit_cost || 0),
              is_labor: false,
              labor_sku: '',
            });
          }
        } else if (concreteType === 'yellow-bags') {
          const cty = materials.find(m => m.material_sku === 'CTY');
          if (cty) {
            const qty = Math.ceil(postQty * 0.65);
            matCost += qty * (cty.unit_cost || 0);
            concreteResults.push({
              component_code: 'concrete_yellow',
              component_name: cty.material_name || 'Concrete Yellow Bags',
              raw_value: postQty * 0.65,
              rounded_value: qty,
              rounding_level: 'project',
              formula_used: '[post_qty]*0.65',
              unit_cost: cty.unit_cost || 0,
              total_cost: qty * (cty.unit_cost || 0),
              is_labor: false,
              labor_sku: '',
            });
          }
        } else if (concreteType === 'red-bags') {
          const ctr = materials.find(m => m.material_sku === 'CTR');
          if (ctr) {
            const qty = Math.ceil(postQty * 1);
            matCost += qty * (ctr.unit_cost || 0);
            concreteResults.push({
              component_code: 'concrete_red',
              component_name: ctr.material_name || 'Concrete Red Bags',
              raw_value: postQty * 1,
              rounded_value: qty,
              rounding_level: 'project',
              formula_used: '[post_qty]*1',
              unit_cost: ctr.unit_cost || 0,
              total_cost: qty * (ctr.unit_cost || 0),
              is_labor: false,
              labor_sku: '',
            });
          }
        }
      }

      // =============================================================================
      // NEW: Calculate labor using Labor Groups V2
      // =============================================================================
      const laborResults: EnrichedFormulaResult[] = [];

      // Helper to evaluate a condition formula
      const evaluateCondition = (formula: string | null): boolean => {
        if (!formula || formula.trim() === '') return true; // Always eligible if no condition

        // Simple condition parser - handles basic comparisons
        // Examples: "post_spacing == 8", "height > 6", "rails == 3"
        // Supports: AND/OR keywords, [variable] bracket syntax
        try {
          let evalFormula = formula;

          // Convert AND/OR to JavaScript operators (case insensitive)
          evalFormula = evalFormula.replace(/\bAND\b/gi, '&&');
          evalFormula = evalFormula.replace(/\bOR\b/gi, '||');

          // Remove brackets around variable names: [height] -> height
          evalFormula = evalFormula.replace(/\[(\w+)\]/g, '$1');

          // Replace standard variables (use lowercase for case-insensitive comparison)
          evalFormula = evalFormula.replace(/\bpost_spacing\b/g, String(vars.post_spacing || 8));
          evalFormula = evalFormula.replace(/\bheight\b/g, String(height));
          evalFormula = evalFormula.replace(/\brails?\b/g, String(railCount));
          evalFormula = evalFormula.replace(/\brail_count\b/g, String(railCount));
          evalFormula = evalFormula.replace(/\bpost_type\b/gi, `"${postType.toLowerCase()}"`);

          // Replace style variable with current style code (lowercase for comparison)
          evalFormula = evalFormula.replace(/\bstyle\b/gi, `"${styleCode.toLowerCase()}"`);

          // Replace cap_qty and trim_qty with actual values
          // These check if the component is included (has a selected material)
          const capQty = componentSelections['cap'] ? 1 : 0;
          const trimQty = componentSelections['trim'] ? 1 : 0;
          evalFormula = evalFormula.replace(/\bcap_qty\b/gi, String(capQty));
          evalFormula = evalFormula.replace(/\btrim_qty\b/gi, String(trimQty));

          // Replace product variables
          variablesV2.forEach(v => {
            const val = variableValues[v.variable_code];
            if (val !== undefined) {
              // For string values, wrap in quotes (lowercase for comparison)
              const replacement = typeof val === 'string' ? `"${val.toLowerCase()}"` : String(val);
              evalFormula = evalFormula.replace(
                new RegExp(`\\b${v.variable_code}\\b`, 'g'),
                replacement
              );
            }
          });

          // Also convert any remaining string literals in the formula to lowercase for comparison
          evalFormula = evalFormula.replace(/"([^"]*)"/g, (_, str) => `"${str.toLowerCase()}"`);

          // Evaluate the condition
          // eslint-disable-next-line no-eval
          return Boolean(eval(evalFormula));
        } catch (err) {
          console.warn('Failed to evaluate condition:', formula, err);
          return false;
        }
      };

      // Process each labor group
      for (const ptlg of laborGroupsV2) {
        const group = ptlg.labor_group;
        if (!group) continue;

        // Get eligibility rules for this group
        const groupRules = laborGroupEligibilityV2.filter(
          (r: LaborGroupEligibilityV2) => r.labor_group_id === group.id
        );

        // Find matching labor codes based on conditions
        const matchingRules: LaborGroupEligibilityV2[] = [];

        for (const rule of groupRules) {
          if (evaluateCondition(rule.condition_formula)) {
            matchingRules.push(rule);
          }
        }

        // For single-select groups, prefer default or first match
        if (!group.allow_multiple && matchingRules.length > 0) {
          const defaultRule = matchingRules.find((r: LaborGroupEligibilityV2) => r.is_default);
          const selectedRule = defaultRule || matchingRules[0];

          // Get rate for this labor code
          const laborRate = laborRates.find(
            lr => lr.labor_code_id === selectedRule.labor_code_id
          );
          const rate = laborRate?.rate || 0;
          const laborSku = laborRate?.labor_code?.labor_sku || selectedRule.labor_code?.labor_sku || '';
          const description = laborRate?.labor_code?.description || selectedRule.labor_code?.description || group.name;

          // Labor is calculated per linear foot (testLength)
          const laborCost = testLength * rate;
          labCost += laborCost;

          laborResults.push({
            component_code: group.code,
            component_name: description,
            raw_value: testLength,
            rounded_value: testLength,
            unit_cost: rate,
            total_cost: laborCost,
            is_labor: true,
            labor_sku: laborSku,
            rounding_level: 'none',
            formula_used: `${laborSku} @ $${rate}/ft`,
          });
        } else if (group.allow_multiple) {
          // For multiple-select groups, include all matching rules
          for (const rule of matchingRules) {
            const laborRate = laborRates.find(
              lr => lr.labor_code_id === rule.labor_code_id
            );
            const rate = laborRate?.rate || 0;
            const laborSku = laborRate?.labor_code?.labor_sku || rule.labor_code?.labor_sku || '';
            const description = laborRate?.labor_code?.description || rule.labor_code?.description || group.name;

            const laborCost = testLength * rate;
            labCost += laborCost;

            laborResults.push({
              component_code: `${group.code}_${laborSku}`,
              component_name: description,
              raw_value: testLength,
              rounded_value: testLength,
              unit_cost: rate,
              total_cost: laborCost,
              is_labor: true,
              labor_sku: laborSku,
              rounding_level: 'none',
              formula_used: `${laborSku} @ $${rate}/ft`,
            });
          }
        }
      }

      // Combine material, concrete, and labor results
      const allResults = [...materialResults, ...concreteResults, ...laborResults];

      setTestResults(allResults);
      setTotalMaterialCost(matCost);
      setTotalLaborCost(labCost);
    } catch (err) {
      console.error('BOM Test error:', err);
      showError('Failed to calculate BOM');
    } finally {
      setIsCalculating(false);
    }
  }, [
    selectedProductTypeV2, selectedStyleV2, componentSelections, variableValues,
    height, railCount, testLength, testLines, testGates, assignedComponentsV2, getMaterialSku,
    concreteType, materials, laborGroupsV2, laborGroupEligibilityV2, laborRates, variablesV2,
    visibleMaterialComponents
  ]);

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
      variablesV2.forEach(v => {
        const value = variableValues[v.variable_code];
        if (value !== undefined && value !== null) {
          variables[v.variable_code] = value;
        }
      });
      // Include standard variables
      if (variableValues.rail_count) variables.rail_count = variableValues.rail_count;
      if (selectedStyleV2.formula_adjustments?.post_spacing || selectedProductTypeV2.default_post_spacing) {
        variables.post_spacing = selectedStyleV2.formula_adjustments?.post_spacing ||
                                selectedProductTypeV2.default_post_spacing || 8;
      }

      // Build components JSONB (store material SKUs)
      const components: Record<string, string> = {};
      Object.entries(componentSelections).forEach(([componentCode, materialId]) => {
        if (materialId) {
          components[componentCode] = getMaterialSku(materialId);
        }
      });

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
  // AUTO-CALCULATION
  // =============================================================================

  // Auto-calculate when all required fields are filled
  const lastAutoCalcKey = useMemo(() => {
    return JSON.stringify({
      productType,
      styleCode,
      variableValues,
      componentSelections,
      testLength,
      testLines,
      testGates,
      concreteType,
    });
  }, [productType, styleCode, variableValues, componentSelections, testLength, testLines, testGates, concreteType]);

  const [lastCalcKey, setLastCalcKey] = useState<string>('');

  useEffect(() => {
    // Auto-calculate when:
    // 1. All required fields are filled
    // 2. Not currently calculating
    // 3. Configuration changed since last calculation
    if (allRequiredFieldsFilled && !isCalculating && lastAutoCalcKey !== lastCalcKey) {
      // Small delay to avoid too rapid recalculation
      const timer = setTimeout(() => {
        runBOMTest();
        setLastCalcKey(lastAutoCalcKey);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [allRequiredFieldsFilled, isCalculating, lastAutoCalcKey, lastCalcKey, runBOMTest]);

  // =============================================================================
  // RENDER HELPERS
  // =============================================================================

  // Render a single variable input
  const renderVariableInput = (variable: ProductVariableV2) => {
    const value = variableValues[variable.variable_code] ?? variable.default_value ?? '';

    // For select type with allowed_values
    if (variable.variable_type === 'select' && variable.allowed_values && variable.allowed_values.length > 0) {
      return (
        <select
          value={String(value)}
          onChange={(e) => setVariableValue(variable.variable_code, e.target.value)}
          className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:ring-1 focus:ring-purple-500"
        >
          {variable.allowed_values.map(v => (
            <option key={v} value={v}>{v}</option>
          ))}
        </select>
      );
    }

    // For integer/decimal
    if (variable.variable_type === 'integer' || variable.variable_type === 'decimal') {
      return (
        <input
          type="number"
          value={value}
          onChange={(e) => setVariableValue(
            variable.variable_code,
            variable.variable_type === 'integer' ? parseInt(e.target.value) : parseFloat(e.target.value)
          )}
          className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:ring-1 focus:ring-purple-500"
        />
      );
    }

    return (
      <input
        type="text"
        value={String(value)}
        onChange={(e) => setVariableValue(variable.variable_code, e.target.value)}
        className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:ring-1 focus:ring-purple-500"
      />
    );
  };

  // Render a single component material selector
  const renderComponentSelector = (component: ProductTypeComponentFull) => {
    // Build attribute filter for post_type if applicable
    const attributeFilter: Record<string, string> = {};
    if (component.component_code === 'post' && postType) {
      attributeFilter.post_type = postType;
    }

    const eligibleMaterials = getEligibleMaterialsForComponent(
      component.component_code,
      component.component_type_id,
      Object.keys(attributeFilter).length > 0 ? attributeFilter : undefined
    );

    const selectedMaterialId = componentSelections[component.component_code] || '';
    const isOptional = component.is_optional;
    const hasNoOptions = eligibleMaterials.length === 0;

    // Label styling - optional components have distinct styling
    const labelStyle = isOptional
      ? "text-xs text-purple-600 w-24 flex-shrink-0 truncate italic"
      : "text-xs text-gray-700 w-24 flex-shrink-0 truncate font-medium";

    // If no eligible materials, show "Not configured"
    if (hasNoOptions) {
      return (
        <div key={component.component_type_id} className="flex items-center gap-2">
          <span className={labelStyle} title={component.component_name}>
            {component.component_name}
            {isOptional && <span className="text-[9px] ml-1">(opt)</span>}
          </span>
          <div className="flex-1 px-2 py-1.5 bg-gray-100 border border-gray-200 rounded text-xs text-gray-500 flex items-center gap-1">
            <AlertCircle className="w-3 h-3" />
            Not configured
          </div>
        </div>
      );
    }

    // If only 1 option and NOT optional, auto-select and show as disabled
    if (eligibleMaterials.length === 1 && !isOptional) {
      const onlyMaterial = eligibleMaterials[0];
      // Auto-select if not already selected
      if (selectedMaterialId !== onlyMaterial.id) {
        setTimeout(() => setComponentSelection(component.component_code, onlyMaterial.id), 0);
      }
      return (
        <div key={component.component_type_id} className="flex items-center gap-2">
          <span className={labelStyle} title={component.component_name}>
            {component.component_name}
          </span>
          <div className="flex-1 px-2 py-1.5 bg-gray-50 border border-gray-200 rounded text-xs text-gray-700">
            {onlyMaterial.material_sku} - {onlyMaterial.material_name}
          </div>
        </div>
      );
    }

    // Normal selector - optional components have dashed border
    const selectStyle = isOptional
      ? "flex-1 px-2 py-1.5 border-2 border-dashed border-purple-300 rounded text-xs focus:ring-1 focus:ring-purple-500 bg-purple-50"
      : "flex-1 px-2 py-1.5 border border-gray-300 rounded text-xs focus:ring-1 focus:ring-purple-500 bg-white";

    return (
      <div key={component.component_type_id} className="flex items-center gap-2">
        <span className={labelStyle} title={component.component_name}>
          {component.component_name}
          {isOptional && <span className="text-[9px] ml-1">(opt)</span>}
        </span>
        <select
          value={selectedMaterialId}
          onChange={(e) => setComponentSelection(component.component_code, e.target.value)}
          className={selectStyle}
        >
          <option value="">{isOptional ? 'None (optional)' : `Select ${component.component_name.toLowerCase()}...`}</option>
          {eligibleMaterials.map(m => (
            <option key={m.id} value={m.id}>
              {m.material_sku} - {m.material_name} (${m.unit_cost.toFixed(2)})
            </option>
          ))}
        </select>
      </div>
    );
  };

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

          {/* Dynamic Variables */}
          <div className="flex gap-2 mb-3 flex-wrap">
            {/* Style is always shown */}
            <div className="flex-1 min-w-[120px]">
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

            {/* Height variable - special handling */}
            <div className="w-16">
              <label className="block text-[10px] font-medium text-gray-500 mb-0.5">Height</label>
              <select
                value={height}
                onChange={(e) => setVariableValue('height', Number(e.target.value))}
                className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:ring-1 focus:ring-purple-500"
              >
                {(productType === 'iron' ? [4, 5, 6] : [4, 5, 6, 7, 8]).map(h => (
                  <option key={h} value={h}>{h} ft</option>
                ))}
              </select>
            </div>

            {/* Dynamic variables from V2 (excluding height which is handled above) */}
            {variablesV2
              .filter(v => v.variable_code !== 'height' && v.variable_code !== 'post_spacing')
              .map(variable => (
                <div key={variable.id} className="w-20">
                  <label className="block text-[10px] font-medium text-gray-500 mb-0.5 truncate" title={variable.variable_name}>
                    {variable.variable_name}
                  </label>
                  {renderVariableInput(variable)}
                </div>
              ))
            }
          </div>

          {/* Materials Section - Dynamic Components */}
          <div className="bg-gray-50 rounded-lg p-3 space-y-2">
            <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Materials</h3>

            {visibleMaterialComponents.length === 0 ? (
              <div className="text-xs text-gray-500 py-2">
                No material components configured for this product type.
              </div>
            ) : (
              visibleMaterialComponents.map(component => renderComponentSelector(component))
            )}
          </div>
        </div>
      </div>

      {/* Right Panel - Preview & BOM (V1 Style) */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Key Stats Bar */}
        <div className="bg-white border-b border-gray-200 px-3 py-2">
          <div className="grid grid-cols-4 gap-2">
            <div className="bg-purple-600 text-white rounded-lg px-3 py-2 text-center">
              <div className="text-[10px] uppercase tracking-wide opacity-80">Cost/Ft</div>
              <div className="text-lg font-bold">
                ${testLength > 0 && isFinite((totalMaterialCost + totalLaborCost) / testLength)
                  ? ((totalMaterialCost + totalLaborCost) / testLength).toFixed(2)
                  : '0.00'}
              </div>
            </div>
            <div className="bg-green-600 text-white rounded-lg px-3 py-2 text-center">
              <div className="text-[10px] uppercase tracking-wide opacity-80">Total Cost</div>
              <div className="text-lg font-bold">
                ${isFinite(totalMaterialCost + totalLaborCost)
                  ? Math.round(totalMaterialCost + totalLaborCost).toLocaleString()
                  : '0'}
              </div>
            </div>
            <div className="bg-amber-500 text-white rounded-lg px-3 py-2 text-center">
              <div className="text-[10px] uppercase tracking-wide opacity-80">Material/Ft</div>
              <div className="text-lg font-bold">
                ${testLength > 0 && isFinite(totalMaterialCost / testLength)
                  ? (totalMaterialCost / testLength).toFixed(2)
                  : '0.00'}
              </div>
            </div>
            <div className="bg-blue-500 text-white rounded-lg px-3 py-2 text-center">
              <div className="text-[10px] uppercase tracking-wide opacity-80">Labor/Ft</div>
              <div className="text-lg font-bold">
                ${testLength > 0 && isFinite(totalLaborCost / testLength)
                  ? (totalLaborCost / testLength).toFixed(2)
                  : '0.00'}
              </div>
            </div>
          </div>
        </div>

        {/* Test Parameters Bar */}
        <div className="bg-gray-50 border-b border-gray-200 px-4 py-2">
          <div className="flex items-center gap-4 flex-wrap">
            <span className="text-xs font-medium text-gray-600">Test:</span>
            <div className="flex items-center gap-1">
              <label className="text-[10px] text-gray-500">Length</label>
              <input
                type="number"
                value={testLength}
                onChange={(e) => setTestLength(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-16 px-2 py-1 border border-gray-300 rounded text-xs"
              />
              <span className="text-[10px] text-gray-400">ft</span>
            </div>
            <div className="flex items-center gap-1">
              <label className="text-[10px] text-gray-500">Lines</label>
              <select
                value={testLines}
                onChange={(e) => setTestLines(parseInt(e.target.value))}
                className="w-12 px-1 py-1 border border-gray-300 rounded text-xs"
              >
                {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-1">
              <label className="text-[10px] text-gray-500">Gates</label>
              <select
                value={testGates}
                onChange={(e) => setTestGates(parseInt(e.target.value))}
                className="w-12 px-1 py-1 border border-gray-300 rounded text-xs"
              >
                {[0, 1, 2, 3].map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-1">
              <label className="text-[10px] text-gray-500">Concrete</label>
              <select
                value={concreteType}
                onChange={(e) => setConcreteType(e.target.value as '3-part' | 'yellow-bags' | 'red-bags')}
                className="w-24 px-1 py-1 border border-gray-300 rounded text-xs"
              >
                <option value="3-part">3-Part Mix</option>
                <option value="yellow-bags">Yellow Bags</option>
                <option value="red-bags">Red Bags</option>
              </select>
            </div>
            <div className="flex items-center gap-1">
              <label className="text-[10px] text-gray-500">BU</label>
              <select
                value={businessUnitId}
                onChange={(e) => setBusinessUnitId(e.target.value)}
                className="w-20 px-1 py-1 border border-gray-300 rounded text-xs"
              >
                {businessUnits.map(bu => (
                  <option key={bu.id} value={bu.id}>{bu.code}</option>
                ))}
              </select>
            </div>
            <button
              onClick={runBOMTest}
              disabled={isCalculating}
              className="px-3 py-1 bg-green-600 text-white rounded text-xs font-medium flex items-center gap-1.5 hover:bg-green-700 disabled:bg-gray-400"
            >
              {isCalculating ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Play className="w-3.5 h-3.5" />
              )}
              Calculate
            </button>
          </div>
        </div>

        {/* BOM Preview */}
        <div className="flex-1 overflow-y-auto p-3">
          {/* Warning if no materials selected */}
          {Object.keys(componentSelections).filter(k => componentSelections[k]).length === 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2 mb-3">
              <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-medium text-amber-800">Select materials to see BOM preview</p>
              </div>
            </div>
          )}

          {/* Test Results - Separate Material and Labor Panels */}
          {testResults.length > 0 && (
            <div className="space-y-4">
              {/* Materials Panel (BOM) */}
              {(() => {
                // Filter out items with 0 quantity
                const materialItems = testResults.filter(r => !r.is_labor && r.rounded_value > 0);
                if (materialItems.length === 0) return null;
                return (
                  <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                    <div className="px-3 py-2 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-blue-100 flex items-center justify-between">
                      <h3 className="text-xs font-semibold text-blue-800">
                        Materials (BOM) • {materialItems.length} items
                      </h3>
                      <span className="text-xs font-medium text-blue-700">
                        ${totalMaterialCost.toFixed(2)}
                      </span>
                    </div>
                    <div className="divide-y divide-gray-100">
                      {/* Header */}
                      <div className="grid grid-cols-12 gap-2 px-3 py-2 bg-gray-50 text-[10px] font-semibold text-gray-500 uppercase">
                        <div className="col-span-5">Material</div>
                        <div className="col-span-2 text-right">Qty</div>
                        <div className="col-span-2 text-right">Cost</div>
                        <div className="col-span-3 text-right">Total</div>
                      </div>
                      {/* Items */}
                      {materialItems.map((result) => {
                        const material = getMaterial(componentSelections[result.component_code]);
                        return (
                          <div key={result.component_code} className="grid grid-cols-12 gap-2 px-3 py-2 hover:bg-gray-50">
                            <div className="col-span-5">
                              <div className="font-semibold text-sm text-gray-900">{result.component_name}</div>
                              <div className="text-[10px] text-gray-500">
                                {material?.material_sku || result.component_code} • {material?.category || 'Material'}
                              </div>
                            </div>
                            <div className="col-span-2 text-right font-mono text-sm font-medium text-gray-900">
                              {isFinite(result.rounded_value) ? result.rounded_value : 0}
                            </div>
                            <div className="col-span-2 text-right font-mono text-xs text-gray-500">
                              {result.unit_cost && isFinite(result.unit_cost) ? `$${result.unit_cost.toFixed(2)}` : '-'}
                            </div>
                            <div className="col-span-3 text-right font-mono text-sm font-semibold text-gray-900">
                              {result.total_cost && isFinite(result.total_cost) ? `$${result.total_cost.toFixed(2)}` : '-'}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    {/* Subtotal */}
                    <div className="px-3 py-2 bg-blue-50 border-t border-blue-200 flex justify-between items-center">
                      <span className="font-semibold text-sm text-blue-800">Materials Subtotal</span>
                      <span className="font-mono font-bold text-sm text-blue-900">
                        ${totalMaterialCost.toFixed(2)}
                      </span>
                    </div>
                  </div>
                );
              })()}

              {/* Labor Panel (BOL) */}
              {(() => {
                const laborItems = testResults.filter(r => r.is_labor);
                if (laborItems.length === 0) return null;
                return (
                  <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                    <div className="px-3 py-2 border-b border-gray-200 bg-gradient-to-r from-orange-50 to-orange-100 flex items-center justify-between">
                      <h3 className="text-xs font-semibold text-orange-800">
                        Labor (BOL) • {laborItems.length} items
                      </h3>
                      <span className="text-xs font-medium text-orange-700">
                        ${totalLaborCost.toFixed(2)}
                      </span>
                    </div>
                    <div className="divide-y divide-gray-100">
                      {/* Header */}
                      <div className="grid grid-cols-12 gap-2 px-3 py-2 bg-gray-50 text-[10px] font-semibold text-gray-500 uppercase">
                        <div className="col-span-6">Labor</div>
                        <div className="col-span-2 text-right">Rate/ft</div>
                        <div className="col-span-2 text-right">Qty</div>
                        <div className="col-span-2 text-right">Total</div>
                      </div>
                      {/* Items */}
                      {laborItems.map((result) => (
                        <div key={result.component_code} className="grid grid-cols-12 gap-2 px-3 py-2 hover:bg-orange-50/30">
                          <div className="col-span-6">
                            <div className="font-semibold text-sm text-gray-900">{result.component_name}</div>
                            <div className="text-[10px] text-gray-500">
                              {result.labor_sku || '-'}
                            </div>
                          </div>
                          <div className="col-span-2 text-right font-mono text-xs text-gray-500">
                            ${(result.unit_cost || 0).toFixed(2)}
                          </div>
                          <div className="col-span-2 text-right font-mono text-sm font-medium text-gray-900">
                            {isFinite(result.rounded_value) ? result.rounded_value : 0}
                          </div>
                          <div className="col-span-2 text-right font-mono text-sm font-semibold text-gray-900">
                            {result.total_cost && isFinite(result.total_cost) ? `$${result.total_cost.toFixed(2)}` : '-'}
                          </div>
                        </div>
                      ))}
                    </div>
                    {/* Subtotal */}
                    <div className="px-3 py-2 bg-orange-50 border-t border-orange-200 flex justify-between items-center">
                      <span className="font-semibold text-sm text-orange-800">Labor Subtotal</span>
                      <span className="font-mono font-bold text-sm text-orange-900">
                        ${totalLaborCost.toFixed(2)}
                      </span>
                    </div>
                  </div>
                );
              })()}

              {/* Combined Total */}
              <div className="bg-gradient-to-r from-purple-50 to-purple-100 rounded-lg border border-purple-200 px-4 py-3 flex items-center justify-between">
                <div>
                  <span className="text-sm font-medium text-purple-800">Total Cost</span>
                  <span className="text-xs text-purple-600 ml-2">
                    ({testLength}ft × {testLines} lines)
                  </span>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-purple-900 font-mono">
                    ${(totalMaterialCost + totalLaborCost).toFixed(2)}
                  </div>
                  <div className="text-xs text-purple-600">
                    ${((totalMaterialCost + totalLaborCost) / testLength).toFixed(2)}/ft
                  </div>
                </div>
              </div>
            </div>
          )}

          {testResults.length === 0 && Object.keys(componentSelections).filter(k => componentSelections[k]).length > 0 && (
            <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
              <Play className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-xs text-gray-500">
                Click "Calculate" to preview BOM quantities
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
