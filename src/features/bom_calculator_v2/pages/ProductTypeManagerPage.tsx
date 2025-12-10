/**
 * ProductTypeManagerPage - Complete configuration UI for V2 product types
 *
 * Allows admins to:
 * - Create/edit product types (wood-vertical, iron, chain-link, etc.)
 * - Define styles for each product type
 * - Configure variables (inputs) per product type
 * - Assign components to product types
 * - Create formulas per component per style
 *
 * O-026: The "game changer" - database-driven product configuration
 */

import { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  Plus, Save, Trash2, X, ChevronRight, Edit2, Copy,
  AlertCircle, CheckCircle, Layers, Settings, Variable,
  Box, Calculator, Search, ArrowUp, ArrowDown
} from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import {
  useProductTypesV2,
  useProductStylesV2,
  useProductVariablesV2,
  useComponentTypesV2,
  useProductTypeComponentsFull,
  useVariableValueOptions,
  type ProductTypeV2,
  type ProductStyleV2,
  type ProductVariableV2,
  type ComponentTypeV2,
  type ProductTypeComponentFull,
  type VariableValueOption,
} from '../hooks/useProductTypesV2';

// Formula template type
interface FormulaTemplateV2 {
  id: string;
  product_type_id: string;
  product_style_id: string | null;
  component_type_id: string;
  formula: string;
  rounding_level: 'sku' | 'project' | 'none';
  plain_english: string | null;
  notes: string | null;
  priority: number;
  is_active: boolean;
}

// Tab types
type ManagerTab = 'types' | 'styles' | 'variables' | 'components' | 'formulas';

export default function ProductTypeManagerPage() {
  const queryClient = useQueryClient();

  // Selected product type (context for other tabs)
  const [selectedTypeId, setSelectedTypeId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ManagerTab>('types');

  // Data queries
  const { data: productTypes = [], isLoading: loadingTypes } = useProductTypesV2();
  const { data: styles = [], isLoading: loadingStyles } = useProductStylesV2(selectedTypeId);
  const { data: variables = [], isLoading: loadingVariables } = useProductVariablesV2(selectedTypeId);
  const { data: componentTypes = [], isLoading: loadingComponents } = useComponentTypesV2();

  // Formulas for selected product type
  const [formulas, setFormulas] = useState<FormulaTemplateV2[]>([]);
  const [loadingFormulas, setLoadingFormulas] = useState(false);

  // Auto-select first product type on load
  useEffect(() => {
    if (productTypes.length > 0 && !selectedTypeId) {
      // Select "Iron" first if available for testing
      const iron = productTypes.find(pt => pt.code === 'iron');
      setSelectedTypeId(iron?.id || productTypes[0].id);
    }
  }, [productTypes, selectedTypeId]);

  // Load formulas when product type changes
  useEffect(() => {
    if (selectedTypeId) {
      loadFormulas(selectedTypeId);
    }
  }, [selectedTypeId]);

  const loadFormulas = async (typeId: string) => {
    setLoadingFormulas(true);
    const { data, error } = await supabase
      .from('formula_templates_v2')
      .select('*')
      .eq('product_type_id', typeId)
      .order('priority', { ascending: false });

    if (!error && data) {
      setFormulas(data);
    }
    setLoadingFormulas(false);
  };

  const selectedType = productTypes.find(pt => pt.id === selectedTypeId);

  // Stats for display
  const stats = {
    styles: styles.length,
    variables: variables.length,
    formulas: formulas.length,
  };

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Product Type Manager</h1>
            <p className="text-sm text-gray-500 mt-1">
              Configure product types, styles, variables, components, and formulas
            </p>
          </div>
          {selectedType && (
            <div className="flex items-center gap-4 text-sm">
              <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full">
                {stats.styles} styles
              </span>
              <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full">
                {stats.variables} variables
              </span>
              <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full">
                {stats.formulas} formulas
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar - Product Type List */}
        <ProductTypeSidebar
          productTypes={productTypes}
          selectedTypeId={selectedTypeId}
          onSelectType={setSelectedTypeId}
          isLoading={loadingTypes}
          onRefresh={() => queryClient.invalidateQueries({ queryKey: ['product-types-v2'] })}
        />

        {/* Main Content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {selectedType ? (
            <>
              {/* Tab Navigation */}
              <div className="bg-white border-b border-gray-200 px-6">
                <nav className="flex gap-1">
                  <TabButton
                    label="Styles"
                    icon={<Layers className="w-4 h-4" />}
                    isActive={activeTab === 'styles'}
                    onClick={() => setActiveTab('styles')}
                    count={stats.styles}
                  />
                  <TabButton
                    label="Variables"
                    icon={<Variable className="w-4 h-4" />}
                    isActive={activeTab === 'variables'}
                    onClick={() => setActiveTab('variables')}
                    count={stats.variables}
                  />
                  <TabButton
                    label="Components"
                    icon={<Box className="w-4 h-4" />}
                    isActive={activeTab === 'components'}
                    onClick={() => setActiveTab('components')}
                  />
                  <TabButton
                    label="Formulas"
                    icon={<Calculator className="w-4 h-4" />}
                    isActive={activeTab === 'formulas'}
                    onClick={() => setActiveTab('formulas')}
                    count={stats.formulas}
                  />
                </nav>
              </div>

              {/* Tab Content */}
              <div className="flex-1 overflow-auto p-6">
                {activeTab === 'styles' && (
                  <StylesTab
                    productType={selectedType}
                    styles={styles}
                    isLoading={loadingStyles}
                    onRefresh={() => queryClient.invalidateQueries({ queryKey: ['product-styles-v2', selectedTypeId] })}
                  />
                )}
                {activeTab === 'variables' && (
                  <VariablesTab
                    productType={selectedType}
                    variables={variables}
                    isLoading={loadingVariables}
                    onRefresh={() => queryClient.invalidateQueries({ queryKey: ['product-variables-v2', selectedTypeId] })}
                  />
                )}
                {activeTab === 'components' && (
                  <ComponentsTab
                    productType={selectedType}
                    componentTypes={componentTypes}
                    formulas={formulas}
                    isLoading={loadingComponents}
                  />
                )}
                {activeTab === 'formulas' && (
                  <FormulasTab
                    productType={selectedType}
                    styles={styles}
                    componentTypes={componentTypes}
                    formulas={formulas}
                    variables={variables}
                    isLoading={loadingFormulas}
                    onRefresh={() => loadFormulas(selectedTypeId!)}
                  />
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-500">
              <div className="text-center">
                <Settings className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Select a product type to configure</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// SIDEBAR COMPONENT
// =============================================================================

function ProductTypeSidebar({
  productTypes,
  selectedTypeId,
  onSelectType,
  isLoading,
  onRefresh,
}: {
  productTypes: ProductTypeV2[];
  selectedTypeId: string | null;
  onSelectType: (id: string) => void;
  isLoading: boolean;
  onRefresh: () => void;
}) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingType, setEditingType] = useState<ProductTypeV2 | null>(null);

  return (
    <div className="w-64 bg-white border-r border-gray-200 flex flex-col">
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-semibold text-gray-900">Product Types</h2>
          <button
            onClick={() => setShowAddModal(true)}
            className="p-1.5 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
            title="Add Product Type"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
        <p className="text-xs text-gray-500">{productTypes.length} types configured</p>
      </div>

      <div className="flex-1 overflow-auto p-2">
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <div className="w-6 h-6 border-2 border-purple-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : productTypes.length === 0 ? (
          <div className="text-center py-8 text-gray-500 text-sm">
            No product types yet.<br />Click + to add one.
          </div>
        ) : (
          <div className="space-y-1">
            {productTypes.map((type) => (
              <button
                key={type.id}
                onClick={() => onSelectType(type.id)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-left transition-colors ${
                  selectedTypeId === type.id
                    ? 'bg-purple-100 text-purple-700'
                    : 'hover:bg-gray-100 text-gray-700'
                }`}
              >
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{type.name}</div>
                  <div className="text-xs text-gray-500 truncate">{type.code}</div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingType(type);
                    }}
                    className="p-1 hover:bg-gray-200 rounded opacity-0 group-hover:opacity-100"
                  >
                    <Edit2 className="w-3 h-3" />
                  </button>
                  <ChevronRight className="w-4 h-4 opacity-50" />
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {(showAddModal || editingType) && (
        <ProductTypeModal
          productType={editingType}
          onClose={() => {
            setShowAddModal(false);
            setEditingType(null);
          }}
          onSaved={() => {
            setShowAddModal(false);
            setEditingType(null);
            onRefresh();
          }}
        />
      )}
    </div>
  );
}

// =============================================================================
// TAB BUTTON COMPONENT
// =============================================================================

function TabButton({
  label,
  icon,
  isActive,
  onClick,
  count,
}: {
  label: string;
  icon: React.ReactNode;
  isActive: boolean;
  onClick: () => void;
  count?: number;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
        isActive
          ? 'border-purple-600 text-purple-600'
          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
      }`}
    >
      {icon}
      {label}
      {count !== undefined && (
        <span className={`px-1.5 py-0.5 text-xs rounded-full ${
          isActive ? 'bg-purple-100' : 'bg-gray-100'
        }`}>
          {count}
        </span>
      )}
    </button>
  );
}

// =============================================================================
// PRODUCT TYPE MODAL
// =============================================================================

function ProductTypeModal({
  productType,
  onClose,
  onSaved,
}: {
  productType: ProductTypeV2 | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [formData, setFormData] = useState({
    code: productType?.code || '',
    name: productType?.name || '',
    description: productType?.description || '',
    default_post_spacing: productType?.default_post_spacing?.toString() || '8',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEditing = !!productType;

  const handleSave = async () => {
    if (!formData.code.trim() || !formData.name.trim()) {
      setError('Code and Name are required');
      return;
    }

    setSaving(true);
    setError(null);

    const data = {
      code: formData.code.toLowerCase().replace(/\s+/g, '-'),
      name: formData.name,
      description: formData.description || null,
      default_post_spacing: formData.default_post_spacing ? parseFloat(formData.default_post_spacing) : null,
    };

    let result;
    if (isEditing) {
      result = await supabase
        .from('product_types_v2')
        .update(data)
        .eq('id', productType.id);
    } else {
      result = await supabase
        .from('product_types_v2')
        .insert(data);
    }

    if (result.error) {
      setError(result.error.message);
      setSaving(false);
    } else {
      onSaved();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">
            {isEditing ? 'Edit Product Type' : 'Add Product Type'}
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 rounded-lg text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Code *</label>
            <input
              type="text"
              value={formData.code}
              onChange={(e) => setFormData({ ...formData, code: e.target.value })}
              placeholder="e.g., chain-link"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              disabled={isEditing}
            />
            <p className="text-xs text-gray-500 mt-1">Unique identifier, lowercase with dashes</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Chain Link"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Optional description..."
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Default Post Spacing (ft)</label>
            <input
              type="number"
              value={formData.default_post_spacing}
              onChange={(e) => setFormData({ ...formData, default_post_spacing: e.target.value })}
              step="0.01"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-xl">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50"
          >
            {saving ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            {isEditing ? 'Update' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// STYLES TAB
// =============================================================================

function StylesTab({
  productType,
  styles,
  isLoading,
  onRefresh,
}: {
  productType: ProductTypeV2;
  styles: ProductStyleV2[];
  isLoading: boolean;
  onRefresh: () => void;
}) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingStyle, setEditingStyle] = useState<ProductStyleV2 | null>(null);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Styles for {productType.name}</h2>
          <p className="text-sm text-gray-500">Define style variations with formula adjustments</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Style
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-8 h-8 border-2 border-purple-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : styles.length === 0 ? (
        <EmptyState
          icon={<Layers className="w-12 h-12" />}
          title="No styles configured"
          description="Add styles to define variations like 'Standard', 'Good Neighbor', etc."
          action={
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
            >
              <Plus className="w-4 h-4" />
              Add First Style
            </button>
          }
        />
      ) : (
        <div className="grid gap-4">
          {styles.map((style) => (
            <div
              key={style.id}
              className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-gray-900">{style.name}</h3>
                    <span className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded">
                      {style.code}
                    </span>
                  </div>
                  {style.description && (
                    <p className="text-sm text-gray-500 mt-1">{style.description}</p>
                  )}
                  {Object.keys(style.formula_adjustments || {}).length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {Object.entries(style.formula_adjustments).map(([key, value]) => (
                        <span key={key} className="px-2 py-1 text-xs bg-purple-50 text-purple-700 rounded">
                          {key}: {value}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setEditingStyle(style)}
                    className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-gray-700"
                    title="Edit"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Style Modal */}
      {(showAddModal || editingStyle) && (
        <StyleModal
          productTypeId={productType.id}
          style={editingStyle}
          onClose={() => {
            setShowAddModal(false);
            setEditingStyle(null);
          }}
          onSaved={() => {
            setShowAddModal(false);
            setEditingStyle(null);
            onRefresh();
          }}
        />
      )}
    </div>
  );
}

// Style Modal
function StyleModal({
  productTypeId,
  style,
  onClose,
  onSaved,
}: {
  productTypeId: string;
  style: ProductStyleV2 | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [formData, setFormData] = useState({
    code: style?.code || '',
    name: style?.name || '',
    description: style?.description || '',
    formula_adjustments: JSON.stringify(style?.formula_adjustments || {}, null, 2),
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEditing = !!style;

  const handleSave = async () => {
    if (!formData.code.trim() || !formData.name.trim()) {
      setError('Code and Name are required');
      return;
    }

    let adjustments = {};
    try {
      adjustments = JSON.parse(formData.formula_adjustments || '{}');
    } catch (e) {
      setError('Invalid JSON in formula adjustments');
      return;
    }

    setSaving(true);
    setError(null);

    const data = {
      product_type_id: productTypeId,
      code: formData.code.toLowerCase().replace(/\s+/g, '-'),
      name: formData.name,
      description: formData.description || null,
      formula_adjustments: adjustments,
    };

    let result;
    if (isEditing) {
      result = await supabase
        .from('product_styles_v2')
        .update(data)
        .eq('id', style.id);
    } else {
      result = await supabase
        .from('product_styles_v2')
        .insert(data);
    }

    if (result.error) {
      setError(result.error.message);
      setSaving(false);
    } else {
      onSaved();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">
            {isEditing ? 'Edit Style' : 'Add Style'}
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 rounded-lg text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Code *</label>
            <input
              type="text"
              value={formData.code}
              onChange={(e) => setFormData({ ...formData, code: e.target.value })}
              placeholder="e.g., standard-2-rail"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Standard 2 Rail"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Formula Adjustments (JSON)
            </label>
            <textarea
              value={formData.formula_adjustments}
              onChange={(e) => setFormData({ ...formData, formula_adjustments: e.target.value })}
              rows={4}
              placeholder='{"picket_multiplier": 1.11}'
              className="w-full px-3 py-2 border border-gray-300 rounded-lg font-mono text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              Key-value pairs for style-specific multipliers
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-xl">
          <button onClick={onClose} className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
          >
            {saving ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            {isEditing ? 'Update' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// VARIABLES TAB
// =============================================================================

function VariablesTab({
  productType,
  variables,
  isLoading,
  onRefresh,
}: {
  productType: ProductTypeV2;
  variables: ProductVariableV2[];
  isLoading: boolean;
  onRefresh: () => void;
}) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingVariable, setEditingVariable] = useState<ProductVariableV2 | null>(null);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Variables for {productType.name}</h2>
          <p className="text-sm text-gray-500">Define input variables like height, post_spacing, gauge, etc.</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Variable
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-8 h-8 border-2 border-purple-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : variables.length === 0 ? (
        <EmptyState
          icon={<Variable className="w-12 h-12" />}
          title="No variables configured"
          description="Add variables that users will input when selecting this product type."
          action={
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
            >
              <Plus className="w-4 h-4" />
              Add First Variable
            </button>
          }
        />
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Variable</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Type</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Default</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Allowed Values</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Required</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {variables.map((variable) => (
                <tr key={variable.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{variable.variable_name}</div>
                    <div className="text-xs text-gray-500 font-mono">[{variable.variable_code}]</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded">
                      {variable.variable_type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">
                    {variable.default_value || '—'}
                    {variable.unit && <span className="text-gray-400 ml-1">{variable.unit}</span>}
                  </td>
                  <td className="px-4 py-3">
                    {variable.allowed_values?.length ? (
                      <div className="flex flex-wrap gap-1">
                        {variable.allowed_values.slice(0, 3).map((v) => (
                          <span key={v} className="px-1.5 py-0.5 text-xs bg-blue-50 text-blue-700 rounded">
                            {v}
                          </span>
                        ))}
                        {variable.allowed_values.length > 3 && (
                          <span className="text-xs text-gray-500">
                            +{variable.allowed_values.length - 3} more
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-gray-400 text-sm">Any</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {variable.is_required ? (
                      <CheckCircle className="w-4 h-4 text-green-600" />
                    ) : (
                      <span className="text-gray-400 text-sm">No</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => setEditingVariable(variable)}
                      className="p-1.5 hover:bg-gray-100 rounded text-gray-500 hover:text-gray-700"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add/Edit Variable Modal */}
      {(showAddModal || editingVariable) && (
        <VariableModal
          productTypeId={productType.id}
          variable={editingVariable}
          onClose={() => {
            setShowAddModal(false);
            setEditingVariable(null);
          }}
          onSaved={() => {
            setShowAddModal(false);
            setEditingVariable(null);
            onRefresh();
          }}
        />
      )}
    </div>
  );
}

// Variable Modal - Enhanced with Global Value Pool
function VariableModal({
  productTypeId,
  variable,
  onClose,
  onSaved,
}: {
  productTypeId: string;
  variable: ProductVariableV2 | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    variable_code: variable?.variable_code || '',
    variable_name: variable?.variable_name || '',
    variable_type: variable?.variable_type || 'select',
    default_value: variable?.default_value || '',
    unit: variable?.unit || '',
    is_required: variable?.is_required ?? true,
  });
  const [selectedValues, setSelectedValues] = useState<string[]>(variable?.allowed_values || []);
  const [newValueInput, setNewValueInput] = useState('');
  const [newValueLabel, setNewValueLabel] = useState('');
  const [addingValue, setAddingValue] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEditing = !!variable;
  const normalizedCode = formData.variable_code.toLowerCase().replace(/\s+/g, '_');

  // Fetch global value options for this variable code
  const { data: globalOptions = [], refetch: refetchOptions } = useVariableValueOptions(normalizedCode);

  // Update selected values when global options load (for new variables)
  const toggleValueSelection = (value: string) => {
    setSelectedValues(prev =>
      prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value]
    );
  };

  // Add a new global value option
  const handleAddGlobalValue = async () => {
    if (!newValueInput.trim()) return;

    setAddingValue(true);
    const { error: insertError } = await supabase
      .from('variable_value_options')
      .insert({
        variable_code: normalizedCode,
        value: newValueInput.trim(),
        display_label: newValueLabel.trim() || null,
        display_order: globalOptions.length + 1,
      });

    if (insertError) {
      setError(insertError.message);
    } else {
      // Add to selected and refresh
      setSelectedValues(prev => [...prev, newValueInput.trim()]);
      setNewValueInput('');
      setNewValueLabel('');
      refetchOptions();
      queryClient.invalidateQueries({ queryKey: ['variable-value-options'] });
    }
    setAddingValue(false);
  };

  const handleSave = async () => {
    if (!formData.variable_code.trim() || !formData.variable_name.trim()) {
      setError('Code and Name are required');
      return;
    }

    setSaving(true);
    setError(null);

    const data = {
      product_type_id: productTypeId,
      variable_code: normalizedCode,
      variable_name: formData.variable_name,
      variable_type: formData.variable_type,
      default_value: formData.default_value || null,
      allowed_values: formData.variable_type === 'select' && selectedValues.length > 0
        ? selectedValues
        : null,
      unit: formData.unit || null,
      is_required: formData.is_required,
    };

    let result;
    if (isEditing && variable) {
      result = await supabase
        .from('product_variables_v2')
        .update(data)
        .eq('id', variable.id);
    } else {
      result = await supabase
        .from('product_variables_v2')
        .insert(data);
    }

    if (result.error) {
      setError(result.error.message);
      setSaving(false);
    } else {
      onSaved();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">
            {isEditing ? 'Edit Variable' : 'Add Variable'}
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4 overflow-y-auto flex-1">
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 rounded-lg text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Code *</label>
              <input
                type="text"
                value={formData.variable_code}
                onChange={(e) => setFormData({ ...formData, variable_code: e.target.value })}
                placeholder="e.g., height"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
              <input
                type="text"
                value={formData.variable_name}
                onChange={(e) => setFormData({ ...formData, variable_name: e.target.value })}
                placeholder="e.g., Height"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
              <select
                value={formData.variable_type}
                onChange={(e) => setFormData({ ...formData, variable_type: e.target.value as 'integer' | 'decimal' | 'select' })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
              >
                <option value="select">Select (dropdown)</option>
                <option value="integer">Integer</option>
                <option value="decimal">Decimal</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Unit</label>
              <input
                type="text"
                value={formData.unit}
                onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                placeholder="e.g., ft, in"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Default Value</label>
            <input
              type="text"
              value={formData.default_value}
              onChange={(e) => setFormData({ ...formData, default_value: e.target.value })}
              placeholder="e.g., 6"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
            />
          </div>

          {/* Global Value Pool Section - Only for select type */}
          {formData.variable_type === 'select' && normalizedCode && (
            <div className="border border-gray-200 rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-gray-700">
                  Allowed Values (Global Pool)
                </label>
                <span className="text-xs text-gray-500">
                  {selectedValues.length} selected
                </span>
              </div>

              {/* Existing global options as checkboxes */}
              {globalOptions.length > 0 ? (
                <div className="grid grid-cols-2 gap-2 max-h-36 overflow-y-auto">
                  {globalOptions.map((opt: VariableValueOption) => (
                    <label
                      key={opt.id}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-colors ${
                        selectedValues.includes(opt.value)
                          ? 'bg-purple-50 border-purple-300'
                          : 'bg-white border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedValues.includes(opt.value)}
                        onChange={() => toggleValueSelection(opt.value)}
                        className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                      />
                      <span className="text-sm">
                        {opt.display_label || opt.value}
                        {opt.display_label && (
                          <span className="text-gray-400 ml-1">({opt.value})</span>
                        )}
                      </span>
                    </label>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500 italic">
                  No global values defined for "{normalizedCode}" yet. Add some below.
                </p>
              )}

              {/* Add new global value */}
              <div className="pt-3 border-t border-gray-200">
                <p className="text-xs text-gray-500 mb-2">Add new value to global pool:</p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newValueInput}
                    onChange={(e) => setNewValueInput(e.target.value)}
                    placeholder="Value (e.g., 7)"
                    className="flex-1 px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  />
                  <input
                    type="text"
                    value={newValueLabel}
                    onChange={(e) => setNewValueLabel(e.target.value)}
                    placeholder="Label (e.g., 7 ft)"
                    className="flex-1 px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  />
                  <button
                    onClick={handleAddGlobalValue}
                    disabled={!newValueInput.trim() || addingValue}
                    className="px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50"
                  >
                    {addingValue ? '...' : 'Add'}
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="is_required"
              checked={formData.is_required}
              onChange={(e) => setFormData({ ...formData, is_required: e.target.checked })}
              className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
            />
            <label htmlFor="is_required" className="text-sm text-gray-700">Required field</label>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-xl">
          <button onClick={onClose} className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
          >
            {saving ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            {isEditing ? 'Update' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// COMPONENTS TAB - Two-panel design
// =============================================================================

function ComponentsTab({
  productType,
  componentTypes: _componentTypes,
  formulas,
  isLoading,
}: {
  productType: ProductTypeV2;
  componentTypes: ComponentTypeV2[];
  formulas: FormulaTemplateV2[];
  isLoading: boolean;
}) {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [saving, setSaving] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);

  // Get full component data with assignment status from the view
  const { data: componentsFull = [], isLoading: loadingFull, refetch: refetchComponents } = useProductTypeComponentsFull(productType.id);

  // Determine which components have formulas for this product type
  const componentsWithFormulas = new Set(formulas.map((f) => f.component_type_id));

  // Split into selected and unselected
  const selectedComponents = componentsFull
    .filter(c => c.is_assigned)
    .sort((a, b) => (a.display_order || 999) - (b.display_order || 999));

  const availableComponents = componentsFull
    .filter(c => !c.is_assigned)
    .filter(c =>
      c.component_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.component_code.toLowerCase().includes(searchTerm.toLowerCase())
    );

  // Toggle component selection
  const toggleComponent = async (component: ProductTypeComponentFull) => {
    setSaving(true);

    if (component.is_assigned && component.assignment_id) {
      // Unassign: Delete from junction table
      const { error } = await supabase
        .from('product_type_components_v2')
        .delete()
        .eq('id', component.assignment_id);

      if (error) {
        console.error('Error unassigning component:', error);
      }
    } else {
      // Assign: Insert into junction table
      const maxOrder = Math.max(...selectedComponents.map(c => c.display_order || 0), 0);
      const { error } = await supabase
        .from('product_type_components_v2')
        .insert({
          product_type_id: productType.id,
          component_type_id: component.component_type_id,
          display_order: maxOrder + 1,
        });

      if (error) {
        console.error('Error assigning component:', error);
      }
    }

    await refetchComponents();
    setSaving(false);
  };

  // Move component up/down in order
  const moveComponent = async (component: ProductTypeComponentFull, direction: 'up' | 'down') => {
    const currentIndex = selectedComponents.findIndex(c => c.component_type_id === component.component_type_id);
    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;

    if (targetIndex < 0 || targetIndex >= selectedComponents.length) return;

    setSaving(true);

    const currentComponent = selectedComponents[currentIndex];
    const targetComponent = selectedComponents[targetIndex];

    // Swap display_order values
    await Promise.all([
      supabase
        .from('product_type_components_v2')
        .update({ display_order: targetComponent.display_order })
        .eq('id', currentComponent.assignment_id),
      supabase
        .from('product_type_components_v2')
        .update({ display_order: currentComponent.display_order })
        .eq('id', targetComponent.assignment_id),
    ]);

    await refetchComponents();
    setSaving(false);
  };

  const loading = isLoading || loadingFull;

  return (
    <div className="h-full">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Components for {productType.name}</h2>
          <p className="text-sm text-gray-500">
            Select components used by this product type. Order determines formula execution sequence.
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-3 py-1.5 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700"
        >
          <Plus className="w-4 h-4" />
          New Component
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-2 border-purple-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-6 h-[calc(100vh-300px)]">
          {/* Left Panel - Available Components */}
          <div className="bg-white rounded-lg border border-gray-200 flex flex-col">
            <div className="p-4 border-b border-gray-200">
              <h3 className="font-semibold text-gray-900 mb-3">Available Components</h3>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search components..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                />
              </div>
            </div>

            <div className="flex-1 overflow-auto p-2">
              {availableComponents.length === 0 ? (
                <div className="text-center py-8 text-gray-500 text-sm">
                  {searchTerm ? 'No matching components' : 'All components are selected'}
                </div>
              ) : (
                <div className="space-y-1">
                  {availableComponents.map((component) => (
                    <button
                      key={component.component_type_id}
                      onClick={() => toggleComponent(component)}
                      disabled={saving}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-50 text-left transition-colors disabled:opacity-50"
                    >
                      <div className="w-5 h-5 border-2 border-gray-300 rounded flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-gray-900 truncate">{component.component_name}</div>
                        <div className="flex items-center gap-2 text-xs">
                          <span className="text-gray-500 font-mono">{component.component_code}</span>
                          {component.is_labor && (
                            <span className="px-1.5 py-0.5 bg-orange-100 text-orange-700 rounded">Labor</span>
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right Panel - Selected Components */}
          <div className="bg-white rounded-lg border border-gray-200 flex flex-col">
            <div className="p-4 border-b border-gray-200">
              <h3 className="font-semibold text-gray-900">
                Selected Components ({selectedComponents.length})
              </h3>
              <p className="text-xs text-gray-500 mt-1">
                Formula execution order (top to bottom)
              </p>
            </div>

            <div className="flex-1 overflow-auto p-2">
              {selectedComponents.length === 0 ? (
                <div className="text-center py-8 text-gray-500 text-sm">
                  No components selected.<br />
                  Click a component on the left to add it.
                </div>
              ) : (
                <div className="space-y-1">
                  {selectedComponents.map((component, index) => {
                    const hasFormula = componentsWithFormulas.has(component.component_type_id);
                    return (
                      <div
                        key={component.component_type_id}
                        className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-gray-50 group"
                      >
                        <div className="flex flex-col gap-0.5">
                          <button
                            onClick={() => moveComponent(component, 'up')}
                            disabled={index === 0 || saving}
                            className="p-0.5 hover:bg-gray-200 rounded disabled:opacity-30 disabled:hover:bg-transparent"
                          >
                            <ArrowUp className="w-3 h-3 text-gray-500" />
                          </button>
                          <button
                            onClick={() => moveComponent(component, 'down')}
                            disabled={index === selectedComponents.length - 1 || saving}
                            className="p-0.5 hover:bg-gray-200 rounded disabled:opacity-30 disabled:hover:bg-transparent"
                          >
                            <ArrowDown className="w-3 h-3 text-gray-500" />
                          </button>
                        </div>

                        <span className="w-6 text-center text-xs text-gray-400 font-mono">
                          {index + 1}
                        </span>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-gray-900 truncate">{component.component_name}</span>
                            {hasFormula && (
                              <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-xs">
                            <span className="text-gray-500 font-mono">{component.component_code}</span>
                            {component.is_labor && (
                              <span className="px-1.5 py-0.5 bg-orange-100 text-orange-700 rounded">Labor</span>
                            )}
                            {hasFormula ? (
                              <span className="px-1.5 py-0.5 bg-green-100 text-green-700 rounded">Has formula</span>
                            ) : (
                              <span className="px-1.5 py-0.5 bg-yellow-100 text-yellow-700 rounded">Needs formula</span>
                            )}
                          </div>
                        </div>

                        <button
                          onClick={() => toggleComponent(component)}
                          disabled={saving}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-50"
                          title="Remove from product type"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Add Component Modal */}
      {showAddModal && (
        <AddComponentModal
          onClose={() => setShowAddModal(false)}
          onSaved={() => {
            setShowAddModal(false);
            queryClient.invalidateQueries({ queryKey: ['component-types-v2'] });
            refetchComponents();
          }}
        />
      )}
    </div>
  );
}

// Add Component Modal - inline creation
function AddComponentModal({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: () => void;
}) {
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    unit_type: 'each',
    is_labor: false,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    if (!formData.code.trim() || !formData.name.trim()) {
      setError('Code and Name are required');
      return;
    }

    setSaving(true);
    setError(null);

    const { error: insertError } = await supabase
      .from('component_types_v2')
      .insert({
        code: formData.code.toLowerCase().replace(/\s+/g, '_'),
        name: formData.name,
        unit_type: formData.unit_type,
        is_labor: formData.is_labor,
      });

    if (insertError) {
      setError(insertError.message);
      setSaving(false);
    } else {
      onSaved();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Add Component Type</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 rounded-lg text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Code *</label>
              <input
                type="text"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                placeholder="e.g., post"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Posts"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Unit Type</label>
            <select
              value={formData.unit_type}
              onChange={(e) => setFormData({ ...formData, unit_type: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
            >
              <option value="each">Each</option>
              <option value="linear_foot">Linear Foot</option>
              <option value="square_foot">Square Foot</option>
              <option value="pound">Pound</option>
              <option value="bag">Bag</option>
              <option value="box">Box</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="is_labor"
              checked={formData.is_labor}
              onChange={(e) => setFormData({ ...formData, is_labor: e.target.checked })}
              className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
            />
            <label htmlFor="is_labor" className="text-sm text-gray-700">
              This is a labor component (no material formula needed)
            </label>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-xl">
          <button onClick={onClose} className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
          >
            {saving ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            Create Component
          </button>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// FORMULAS TAB
// =============================================================================

function FormulasTab({
  productType,
  styles,
  componentTypes,
  formulas,
  variables,
  isLoading,
  onRefresh,
}: {
  productType: ProductTypeV2;
  styles: ProductStyleV2[];
  componentTypes: ComponentTypeV2[];
  formulas: FormulaTemplateV2[];
  variables: ProductVariableV2[];
  isLoading: boolean;
  onRefresh: () => void;
}) {
  const [editingFormula, setEditingFormula] = useState<{
    componentId: string;
    styleId: string | null;
    existing: FormulaTemplateV2 | null;
  } | null>(null);

  // Get assigned components for this product type
  const { data: assignedComponents = [], isLoading: loadingAssigned } = useProductTypeComponentsFull(productType.id);

  // Filter to only assigned components, sorted by display_order
  const selectedComponents = assignedComponents
    .filter(c => c.is_assigned)
    .sort((a, b) => (a.display_order || 999) - (b.display_order || 999));

  // Build a lookup map for formulas: componentId -> styleId -> formula
  const formulaMap = new Map<string, Map<string | null, FormulaTemplateV2>>();
  formulas.forEach((f) => {
    if (!formulaMap.has(f.component_type_id)) {
      formulaMap.set(f.component_type_id, new Map());
    }
    formulaMap.get(f.component_type_id)!.set(f.product_style_id, f);
  });

  // Get formula for a component/style combination
  const getFormula = (componentId: string, styleId: string | null): FormulaTemplateV2 | null => {
    const componentFormulas = formulaMap.get(componentId);
    if (!componentFormulas) return null;

    // Check for style-specific formula first
    if (styleId && componentFormulas.has(styleId)) {
      return componentFormulas.get(styleId)!;
    }
    // Fall back to base formula (null style)
    return componentFormulas.get(null) || null;
  };

  const loading = isLoading || loadingAssigned;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Formulas for {productType.name}</h2>
          <p className="text-sm text-gray-500">
            Click any cell to add or edit a formula. Base formulas apply to all styles unless overridden.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-8 h-8 border-2 border-purple-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : selectedComponents.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <Box className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No components selected</h3>
          <p className="text-sm text-gray-500 mb-4">
            Select components in the Components tab first, then add formulas here.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase sticky left-0 bg-gray-50 z-10">
                  Component
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase min-w-[150px]">
                  Base Formula
                </th>
                {styles.map((style) => (
                  <th
                    key={style.id}
                    className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase min-w-[150px]"
                  >
                    {style.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {selectedComponents.map((component) => {
                const baseFormula = getFormula(component.component_type_id, null);
                const hasAnyFormula = formulaMap.has(component.component_type_id);

                return (
                  <tr key={component.component_type_id} className={hasAnyFormula ? 'bg-white' : 'bg-gray-50/50'}>
                    <td className="px-4 py-3 sticky left-0 bg-inherit z-10">
                      <div className="flex items-center gap-2">
                        <span className="w-5 text-center text-xs text-gray-400 font-mono">
                          {component.display_order}
                        </span>
                        <div>
                          <div className="font-medium text-gray-900">{component.component_name}</div>
                          <div className="flex items-center gap-2 text-xs">
                            <span className="text-gray-500 font-mono">{component.component_code}</span>
                            {component.is_labor && (
                              <span className="px-1.5 py-0.5 bg-orange-100 text-orange-700 rounded">Labor</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Base Formula Cell */}
                    <td className="px-4 py-3">
                      <FormulaCell
                        formula={baseFormula}
                        isInherited={false}
                        onClick={() => setEditingFormula({
                          componentId: component.component_type_id,
                          styleId: null,
                          existing: baseFormula,
                        })}
                      />
                    </td>

                    {/* Style-specific Formula Cells */}
                    {styles.map((style) => {
                      const styleFormula = formulaMap.get(component.component_type_id)?.get(style.id) || null;
                      const isInherited = !styleFormula && !!baseFormula;

                      return (
                        <td key={style.id} className="px-4 py-3">
                          <FormulaCell
                            formula={styleFormula || baseFormula}
                            isInherited={isInherited}
                            onClick={() => setEditingFormula({
                              componentId: component.component_type_id,
                              styleId: style.id,
                              existing: styleFormula,
                            })}
                          />
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Formula Editor Modal */}
      {editingFormula && (
        <FormulaEditorModal
          productTypeId={productType.id}
          componentId={editingFormula.componentId}
          styleId={editingFormula.styleId}
          existingFormula={editingFormula.existing}
          componentTypes={componentTypes}
          styles={styles}
          variables={variables}
          onClose={() => setEditingFormula(null)}
          onSaved={() => {
            setEditingFormula(null);
            onRefresh();
          }}
        />
      )}
    </div>
  );
}

// Formula Cell Component
function FormulaCell({
  formula,
  isInherited,
  onClick,
}: {
  formula: FormulaTemplateV2 | null;
  isInherited: boolean;
  onClick: () => void;
}) {
  if (!formula) {
    return (
      <button
        onClick={onClick}
        className="w-full py-2 px-3 text-center text-gray-400 hover:bg-gray-100 rounded border border-dashed border-gray-300 text-sm"
      >
        + Add formula
      </button>
    );
  }

  return (
    <button
      onClick={onClick}
      className={`w-full py-2 px-3 text-left rounded border text-sm transition-colors ${
        isInherited
          ? 'bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100'
          : 'bg-green-50 border-green-200 text-green-800 hover:bg-green-100'
      }`}
    >
      <div className="font-mono text-xs truncate">
        {formula.formula.length > 30 ? formula.formula.substring(0, 30) + '...' : formula.formula}
      </div>
      {isInherited && (
        <div className="text-xs text-gray-400 mt-1 flex items-center gap-1">
          <span>↑</span> inherited
        </div>
      )}
      {formula.plain_english && !isInherited && (
        <div className="text-xs text-green-600 mt-1 truncate">{formula.plain_english}</div>
      )}
    </button>
  );
}

// =============================================================================
// FORMULA EDITOR MODAL
// =============================================================================

function FormulaEditorModal({
  productTypeId,
  componentId,
  styleId,
  existingFormula,
  componentTypes,
  styles,
  variables,
  onClose,
  onSaved,
}: {
  productTypeId: string;
  componentId: string;
  styleId: string | null;
  existingFormula: FormulaTemplateV2 | null;
  componentTypes: ComponentTypeV2[];
  styles: ProductStyleV2[];
  variables: ProductVariableV2[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const component = componentTypes.find((c) => c.id === componentId);
  const style = styleId ? styles.find((s) => s.id === styleId) : null;

  const [formData, setFormData] = useState({
    formula: existingFormula?.formula || '',
    plain_english: existingFormula?.plain_english || '',
    rounding_level: existingFormula?.rounding_level || 'sku',
    notes: existingFormula?.notes || '',
  });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Test formula state
  const [testInputs, setTestInputs] = useState<Record<string, number>>({
    Quantity: 100,
    Lines: 1,
    Gates: 0,
  });
  const [testResult, setTestResult] = useState<number | null>(null);

  const isEditing = !!existingFormula;

  // Available variables for the formula
  const availableVariables = [
    { code: 'Quantity', name: 'Net Length (ft)', type: 'project' },
    { code: 'Lines', name: 'Number of Lines', type: 'project' },
    { code: 'Gates', name: 'Number of Gates', type: 'project' },
    { code: 'height', name: 'Height', type: 'project' },
    ...variables.map((v) => ({ code: v.variable_code, name: v.variable_name, type: 'variable' })),
  ];

  // Calculated variables from other formulas
  const calculatedVariables = [
    { code: 'post_count', name: 'Post Count' },
    { code: 'picket_count', name: 'Picket Count' },
    { code: 'panel_count', name: 'Panel Count' },
    { code: 'board_count', name: 'Board Count' },
    { code: 'rail_count', name: 'Rail Count' },
  ];

  const insertVariable = (code: string) => {
    setFormData((prev) => ({
      ...prev,
      formula: prev.formula + `[${code}]`,
    }));
  };

  const insertFunction = (func: string) => {
    setFormData((prev) => ({
      ...prev,
      formula: prev.formula + `${func}()`,
    }));
  };

  const testFormula = () => {
    try {
      let expr = formData.formula;

      // Replace variables with test values
      expr = expr.replace(/\[([^\]]+)\]/g, (_match, varName) => {
        return String(testInputs[varName] || 0);
      });

      // Replace functions
      expr = expr.replace(/ROUNDUP/gi, 'Math.ceil');
      expr = expr.replace(/ROUNDDOWN/gi, 'Math.floor');
      expr = expr.replace(/ROUND(?!UP|DOWN)/gi, 'Math.round');
      expr = expr.replace(/MAX/gi, 'Math.max');
      expr = expr.replace(/MIN/gi, 'Math.min');

      const fn = new Function(`return ${expr}`);
      const result = fn();
      setTestResult(typeof result === 'number' ? result : null);
      setError(null);
    } catch (e: any) {
      setError(`Formula error: ${e.message}`);
      setTestResult(null);
    }
  };

  const handleSave = async () => {
    if (!formData.formula.trim()) {
      setError('Formula is required');
      return;
    }

    setSaving(true);
    setError(null);

    const data = {
      product_type_id: productTypeId,
      product_style_id: styleId,
      component_type_id: componentId,
      formula: formData.formula,
      plain_english: formData.plain_english || null,
      rounding_level: formData.rounding_level,
      notes: formData.notes || null,
      priority: styleId ? 10 : 0, // Style-specific formulas have higher priority
    };

    let result;
    if (isEditing) {
      result = await supabase
        .from('formula_templates_v2')
        .update(data)
        .eq('id', existingFormula.id);
    } else {
      result = await supabase
        .from('formula_templates_v2')
        .insert(data);
    }

    if (result.error) {
      setError(result.error.message);
      setSaving(false);
    } else {
      onSaved();
    }
  };

  const handleDelete = async () => {
    if (!existingFormula || !confirm('Are you sure you want to delete this formula?')) return;

    setDeleting(true);
    const { error } = await supabase
      .from('formula_templates_v2')
      .delete()
      .eq('id', existingFormula.id);

    if (error) {
      setError(error.message);
      setDeleting(false);
    } else {
      onSaved();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              {isEditing ? 'Edit Formula' : 'Add Formula'}
            </h3>
            <p className="text-sm text-gray-500">
              {component?.name} {style ? `→ ${style.name}` : '→ Base (all styles)'}
            </p>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-auto p-6">
          <div className="grid grid-cols-3 gap-6">
            {/* Left: Variable Picker */}
            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-2">Project Inputs</h4>
                <div className="space-y-1">
                  {availableVariables.filter((v) => v.type === 'project').map((v) => (
                    <button
                      key={v.code}
                      onClick={() => insertVariable(v.code)}
                      className="w-full flex items-center justify-between px-2 py-1.5 text-sm hover:bg-gray-100 rounded"
                    >
                      <span className="font-mono text-purple-600">[{v.code}]</span>
                      <Copy className="w-3 h-3 text-gray-400" />
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-2">SKU Variables</h4>
                <div className="space-y-1">
                  {availableVariables.filter((v) => v.type === 'variable').map((v) => (
                    <button
                      key={v.code}
                      onClick={() => insertVariable(v.code)}
                      className="w-full flex items-center justify-between px-2 py-1.5 text-sm hover:bg-gray-100 rounded"
                    >
                      <span className="font-mono text-blue-600">[{v.code}]</span>
                      <Copy className="w-3 h-3 text-gray-400" />
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-2">Calculated Values</h4>
                <div className="space-y-1">
                  {calculatedVariables.map((v) => (
                    <button
                      key={v.code}
                      onClick={() => insertVariable(v.code)}
                      className="w-full flex items-center justify-between px-2 py-1.5 text-sm hover:bg-gray-100 rounded"
                    >
                      <span className="font-mono text-green-600">[{v.code}]</span>
                      <Copy className="w-3 h-3 text-gray-400" />
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-2">Functions</h4>
                <div className="flex flex-wrap gap-1">
                  {['ROUNDUP', 'ROUND', 'ROUNDDOWN', 'MAX', 'MIN', 'IF'].map((func) => (
                    <button
                      key={func}
                      onClick={() => insertFunction(func)}
                      className="px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded font-mono"
                    >
                      {func}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Right: Formula Editor */}
            <div className="col-span-2 space-y-4">
              {error && (
                <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 rounded-lg text-sm">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {error}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Formula *</label>
                <textarea
                  value={formData.formula}
                  onChange={(e) => setFormData({ ...formData, formula: e.target.value })}
                  rows={3}
                  placeholder="e.g., ROUNDUP([Quantity]/[panel_width])+1"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg font-mono text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Plain English Description</label>
                <input
                  type="text"
                  value={formData.plain_english}
                  onChange={(e) => setFormData({ ...formData, plain_english: e.target.value })}
                  placeholder="e.g., Posts = panels + 1"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Rounding Level</label>
                  <select
                    value={formData.rounding_level}
                    onChange={(e) => setFormData({ ...formData, rounding_level: e.target.value as any })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="sku">SKU (round immediately)</option>
                    <option value="project">Project (aggregate then round)</option>
                    <option value="none">None (no rounding)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                  <input
                    type="text"
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="Internal notes..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              </div>

              {/* Test Section */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-gray-700 mb-3">Test Formula</h4>
                <div className="grid grid-cols-4 gap-2 mb-3">
                  <div>
                    <label className="text-xs text-gray-500">Quantity (ft)</label>
                    <input
                      type="number"
                      value={testInputs.Quantity}
                      onChange={(e) => setTestInputs({ ...testInputs, Quantity: parseFloat(e.target.value) || 0 })}
                      className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">Lines</label>
                    <input
                      type="number"
                      value={testInputs.Lines}
                      onChange={(e) => setTestInputs({ ...testInputs, Lines: parseFloat(e.target.value) || 0 })}
                      className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">Gates</label>
                    <input
                      type="number"
                      value={testInputs.Gates}
                      onChange={(e) => setTestInputs({ ...testInputs, Gates: parseFloat(e.target.value) || 0 })}
                      className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">panel_width</label>
                    <input
                      type="number"
                      value={testInputs.panel_width || 6}
                      onChange={(e) => setTestInputs({ ...testInputs, panel_width: parseFloat(e.target.value) || 6 })}
                      className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <button
                    onClick={testFormula}
                    className="px-3 py-1.5 bg-purple-600 text-white text-sm rounded hover:bg-purple-700"
                  >
                    Test Formula
                  </button>
                  {testResult !== null && (
                    <div className="text-sm">
                      Result: <span className="font-mono font-bold text-green-600">{testResult.toFixed(2)}</span>
                      {formData.rounding_level === 'sku' && (
                        <span className="text-gray-500"> → Rounded: <span className="font-bold">{Math.ceil(testResult)}</span></span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-gray-50">
          <div>
            {isEditing && (
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex items-center gap-2 px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg text-sm"
              >
                {deleting ? (
                  <div className="w-4 h-4 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
                Delete Formula
              </button>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg">
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
            >
              {saving ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              Save Formula
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// EMPTY STATE COMPONENT
// =============================================================================

function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="text-gray-400 mb-4">{icon}</div>
      <h3 className="text-lg font-medium text-gray-900 mb-2">{title}</h3>
      <p className="text-sm text-gray-500 mb-6 max-w-sm">{description}</p>
      {action}
    </div>
  );
}
