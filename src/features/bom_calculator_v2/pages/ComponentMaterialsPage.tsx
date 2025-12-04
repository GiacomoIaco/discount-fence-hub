/**
 * Component Materials Page
 *
 * Admin view for managing which materials are eligible for each component.
 * Shows mappings by category/subcategory for efficient configuration.
 */

import { useState } from 'react';
import { Plus, Trash2, Check, X, ChevronDown, ChevronRight, Package, Layers } from 'lucide-react';
import {
  useProductTypes,
  useProductTypeComponents,
  useComponentMaterialRules,
  useMaterialCategories,
  useCreateMaterialRule,
  useDeleteMaterialRule,
  type ComponentMaterialRuleWithDetails,
} from '../hooks';

export function ComponentMaterialsPage() {
  const { data: productTypes, isLoading: typesLoading } = useProductTypes();
  const [selectedTypeId, setSelectedTypeId] = useState<string | null>(null);

  // Find selected type
  const selectedType = productTypes?.find(t => t.id === selectedTypeId);

  if (typesLoading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Component Materials</h1>
        <p className="text-gray-600">
          Define which materials are eligible for each component by category or subcategory.
        </p>
      </div>

      {/* Product Type Selector */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Select Product Type
        </label>
        <div className="flex gap-2 flex-wrap">
          {productTypes?.map((type) => (
            <button
              key={type.id}
              onClick={() => setSelectedTypeId(type.id)}
              className={`px-4 py-2 rounded-lg border transition-colors ${
                selectedTypeId === type.id
                  ? 'border-purple-600 bg-purple-50 text-purple-700'
                  : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              {type.name}
            </button>
          ))}
        </div>
      </div>

      {/* Rules for selected type */}
      {selectedTypeId && selectedType && (
        <ComponentRulesPanel productTypeId={selectedTypeId} productTypeName={selectedType.name} />
      )}

      {!selectedTypeId && (
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
          <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">Select a product type to view and manage material rules.</p>
        </div>
      )}
    </div>
  );
}

// Panel showing rules for a product type
function ComponentRulesPanel({ productTypeId, productTypeName }: { productTypeId: string; productTypeName: string }) {
  const { data: components, isLoading: componentsLoading } = useProductTypeComponents(productTypeId);
  const { data: rules, isLoading: rulesLoading } = useComponentMaterialRules(productTypeId);
  const [expandedComponent, setExpandedComponent] = useState<string | null>(null);

  if (componentsLoading || rulesLoading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-16 bg-gray-200 rounded"></div>
        <div className="h-16 bg-gray-200 rounded"></div>
        <div className="h-16 bg-gray-200 rounded"></div>
      </div>
    );
  }

  // Group rules by component
  const rulesByComponent = new Map<string, ComponentMaterialRuleWithDetails[]>();
  for (const rule of rules || []) {
    const existing = rulesByComponent.get(rule.component_id) || [];
    existing.push(rule);
    rulesByComponent.set(rule.component_id, existing);
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900">{productTypeName} - Component Materials</h2>
        <p className="text-sm text-gray-600 mt-1">
          {components?.length || 0} components configured
        </p>
      </div>

      <div className="divide-y divide-gray-200">
        {components?.map((comp) => {
          const componentRules = rulesByComponent.get(comp.component_id) || [];
          const isExpanded = expandedComponent === comp.component_id;

          return (
            <div key={comp.id} className="bg-white">
              {/* Component Header */}
              <button
                onClick={() => setExpandedComponent(isExpanded ? null : comp.component_id)}
                className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    comp.is_required ? 'bg-purple-100' : 'bg-gray-100'
                  }`}>
                    <Layers className={`w-5 h-5 ${comp.is_required ? 'text-purple-600' : 'text-gray-500'}`} />
                  </div>
                  <div className="text-left">
                    <h3 className="font-medium text-gray-900">{comp.component.name}</h3>
                    <p className="text-sm text-gray-500">
                      <span className="font-mono">{comp.component.code}</span>
                      {comp.is_required && (
                        <span className="ml-2 px-1.5 py-0.5 text-xs bg-purple-100 text-purple-700 rounded">
                          Required
                        </span>
                      )}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-gray-500">
                    {componentRules.length} material rule{componentRules.length !== 1 ? 's' : ''}
                  </span>
                  {isExpanded ? (
                    <ChevronDown className="w-5 h-5 text-gray-400" />
                  ) : (
                    <ChevronRight className="w-5 h-5 text-gray-400" />
                  )}
                </div>
              </button>

              {/* Expanded Rules */}
              {isExpanded && (
                <div className="px-6 pb-4 bg-gray-50">
                  <ComponentRulesEditor
                    productTypeId={productTypeId}
                    componentId={comp.component_id}
                    componentName={comp.component.name}
                    rules={componentRules}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Editor for a single component's rules
function ComponentRulesEditor({
  productTypeId,
  componentId,
  componentName,
  rules,
}: {
  productTypeId: string;
  componentId: string;
  componentName: string;
  rules: ComponentMaterialRuleWithDetails[];
}) {
  const { data: categories } = useMaterialCategories();
  const createRule = useCreateMaterialRule();
  const deleteRule = useDeleteMaterialRule();
  const [showAddForm, setShowAddForm] = useState(false);
  const [newRuleCategory, setNewRuleCategory] = useState('');
  const [newRuleSubcategory, setNewRuleSubcategory] = useState('');
  const [newRuleIsDefault, setNewRuleIsDefault] = useState(false);

  // Get subcategories for selected category
  const subcategories = categories?.find(c => c.category === newRuleCategory)?.subcategories || [];

  const handleAddRule = async () => {
    if (!newRuleSubcategory && !newRuleCategory) return;

    await createRule.mutateAsync({
      product_type_id: productTypeId,
      product_style_id: null,
      component_id: componentId,
      material_category: newRuleSubcategory ? null : newRuleCategory,
      material_subcategory: newRuleSubcategory || null,
      material_id: null,
      is_default: newRuleIsDefault,
      display_order: rules.length,
      notes: null,
    });

    setShowAddForm(false);
    setNewRuleCategory('');
    setNewRuleSubcategory('');
    setNewRuleIsDefault(false);
  };

  const handleDeleteRule = async (ruleId: string) => {
    if (confirm('Delete this material rule?')) {
      await deleteRule.mutateAsync(ruleId);
    }
  };

  return (
    <div className="space-y-3">
      {/* Existing Rules */}
      {rules.length === 0 ? (
        <p className="text-sm text-gray-500 py-2">No material rules defined for {componentName}.</p>
      ) : (
        <div className="space-y-2">
          {rules.map((rule) => (
            <div
              key={rule.id}
              className="flex items-center justify-between bg-white rounded-lg border border-gray-200 px-4 py-3"
            >
              <div className="flex items-center gap-3">
                {rule.is_default && (
                  <span className="px-2 py-0.5 text-xs bg-green-100 text-green-700 rounded font-medium">
                    Default
                  </span>
                )}
                <div>
                  <p className="font-medium text-gray-900">
                    {rule.material_subcategory || rule.material_category || rule.material?.material_name}
                  </p>
                  {rule.material_subcategory && (
                    <p className="text-xs text-gray-500">
                      in {categories?.find(c => c.subcategories.includes(rule.material_subcategory!))?.category}
                    </p>
                  )}
                  {rule.notes && (
                    <p className="text-xs text-gray-500 mt-1">{rule.notes}</p>
                  )}
                </div>
              </div>
              <button
                onClick={() => handleDeleteRule(rule.id)}
                className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                title="Delete rule"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add Rule Form */}
      {showAddForm ? (
        <div className="bg-white rounded-lg border border-purple-200 p-4 space-y-3">
          <h4 className="font-medium text-gray-900">Add Material Rule</h4>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
              <select
                value={newRuleCategory}
                onChange={(e) => {
                  setNewRuleCategory(e.target.value);
                  setNewRuleSubcategory('');
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              >
                <option value="">Select category...</option>
                {categories?.map((cat) => (
                  <option key={cat.category} value={cat.category}>
                    {cat.category}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Subcategory</label>
              <select
                value={newRuleSubcategory}
                onChange={(e) => setNewRuleSubcategory(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                disabled={!newRuleCategory}
              >
                <option value="">All in category</option>
                {subcategories.map((sub) => (
                  <option key={sub} value={sub}>
                    {sub}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={newRuleIsDefault}
              onChange={(e) => setNewRuleIsDefault(e.target.checked)}
              className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
            />
            <span className="text-sm text-gray-700">Set as default selection</span>
          </label>

          <div className="flex gap-2 pt-2">
            <button
              onClick={handleAddRule}
              disabled={!newRuleCategory || createRule.isPending}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
            >
              <Check className="w-4 h-4" />
              Add Rule
            </button>
            <button
              onClick={() => setShowAddForm(false)}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm"
            >
              <X className="w-4 h-4" />
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowAddForm(true)}
          className="flex items-center gap-2 px-4 py-2 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors text-sm"
        >
          <Plus className="w-4 h-4" />
          Add Material Rule
        </button>
      )}
    </div>
  );
}
