/**
 * Product Types Page - Admin view
 *
 * Displays all product types with their styles and components.
 * Components show their material mappings inline (subcategories in blue, specific materials in green).
 */

import { useState } from 'react';
import { ChevronDown, ChevronRight, Box, Layers, Settings2, Package, Plus, X, Search } from 'lucide-react';
import {
  useProductTypesWithStyles,
  useProductTypeComponents,
  useComponentMaterialRules,
  useMaterialCategories,
  useCreateMaterialRule,
  useDeleteMaterialRule,
  type ComponentMaterialRuleWithDetails,
} from '../hooks';
import type { ProductTypeWithStyles, ComponentDefinition, ProductTypeComponent } from '../types';

export function ProductTypesPage() {
  const { data: productTypes, isLoading, error } = useProductTypesWithStyles();
  const [expandedType, setExpandedType] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="h-32 bg-gray-200 rounded"></div>
          <div className="h-32 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          Error loading product types: {(error as Error).message}
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Product Types</h1>
        <p className="text-gray-600">
          View product types, styles, components, and their material mappings.
        </p>
      </div>

      {/* Product Type Cards */}
      <div className="space-y-4">
        {productTypes?.map((type) => (
          <ProductTypeCard
            key={type.id}
            productType={type}
            isExpanded={expandedType === type.id}
            onToggle={() => setExpandedType(expandedType === type.id ? null : type.id)}
          />
        ))}

        {productTypes?.length === 0 && (
          <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
            <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Product Types</h3>
            <p className="text-gray-600">
              Product types will appear here once migration 072 is applied.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// Product Type Card Component
function ProductTypeCard({
  productType,
  isExpanded,
  onToggle,
}: {
  productType: ProductTypeWithStyles;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
      {/* Card Header */}
      <button
        onClick={onToggle}
        className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
            <Box className="w-5 h-5 text-purple-600" />
          </div>
          <div className="text-left">
            <h3 className="text-lg font-semibold text-gray-900">{productType.name}</h3>
            <p className="text-sm text-gray-500">
              Code: <span className="font-mono">{productType.code}</span>
              {productType.styles.length > 0 && (
                <span className="ml-3">
                  {productType.styles.length} style{productType.styles.length !== 1 ? 's' : ''}
                </span>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {productType.calculator_class && (
            <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-700 rounded">
              Calculator Ready
            </span>
          )}
          {isExpanded ? (
            <ChevronDown className="w-5 h-5 text-gray-400" />
          ) : (
            <ChevronRight className="w-5 h-5 text-gray-400" />
          )}
        </div>
      </button>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="border-t border-gray-200">
          {/* Description */}
          {productType.description && (
            <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
              <p className="text-sm text-gray-600">{productType.description}</p>
            </div>
          )}

          {/* Tabs for Styles and Components */}
          <ProductTypeDetails productType={productType} />
        </div>
      )}
    </div>
  );
}

// Product Type Details (Styles & Components)
function ProductTypeDetails({ productType }: { productType: ProductTypeWithStyles }) {
  const [activeTab, setActiveTab] = useState<'styles' | 'components'>('components');
  const { data: components, isLoading: componentsLoading } = useProductTypeComponents(productType.id);

  return (
    <div>
      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        <button
          onClick={() => setActiveTab('components')}
          className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'components'
              ? 'border-purple-600 text-purple-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <div className="flex items-center gap-2">
            <Settings2 className="w-4 h-4" />
            Components ({components?.length || 0})
          </div>
        </button>
        <button
          onClick={() => setActiveTab('styles')}
          className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'styles'
              ? 'border-purple-600 text-purple-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4" />
            Styles ({productType.styles.length})
          </div>
        </button>
      </div>

      {/* Tab Content */}
      <div className="p-6">
        {activeTab === 'styles' && (
          <StylesTab styles={productType.styles} />
        )}
        {activeTab === 'components' && (
          <ComponentsTab
            productTypeId={productType.id}
            components={components || []}
            isLoading={componentsLoading}
          />
        )}
      </div>
    </div>
  );
}

// Styles Tab
function StylesTab({ styles }: { styles: ProductTypeWithStyles['styles'] }) {
  if (styles.length === 0) {
    return (
      <p className="text-gray-500 text-sm">No styles defined for this product type.</p>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {styles.map((style) => (
        <div
          key={style.id}
          className="border border-gray-200 rounded-lg p-4 hover:border-purple-300 transition-colors"
        >
          <h4 className="font-medium text-gray-900 mb-1">{style.name}</h4>
          <p className="text-sm text-gray-500 font-mono mb-2">{style.code}</p>
          {style.description && (
            <p className="text-sm text-gray-600">{style.description}</p>
          )}
        </div>
      ))}
    </div>
  );
}

// Components Tab - Now with expandable rows showing material mappings
function ComponentsTab({
  productTypeId,
  components,
  isLoading,
}: {
  productTypeId: string;
  components: (ProductTypeComponent & { component: ComponentDefinition })[];
  isLoading: boolean;
}) {
  const [expandedComponent, setExpandedComponent] = useState<string | null>(null);
  const { data: allRules } = useComponentMaterialRules(productTypeId);

  // Group rules by component
  const rulesByComponent = new Map<string, ComponentMaterialRuleWithDetails[]>();
  for (const rule of allRules || []) {
    const existing = rulesByComponent.get(rule.component_id) || [];
    existing.push(rule);
    rulesByComponent.set(rule.component_id, existing);
  }

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-2">
        <div className="h-16 bg-gray-100 rounded"></div>
        <div className="h-16 bg-gray-100 rounded"></div>
        <div className="h-16 bg-gray-100 rounded"></div>
      </div>
    );
  }

  if (components.length === 0) {
    return (
      <p className="text-gray-500 text-sm">No components defined for this product type.</p>
    );
  }

  return (
    <div className="space-y-2">
      {components.map((item) => {
        const componentRules = rulesByComponent.get(item.component_id) || [];
        const isExpanded = expandedComponent === item.component_id;

        return (
          <div key={item.id} className="border border-gray-200 rounded-lg overflow-hidden">
            {/* Component Row */}
            <button
              onClick={() => setExpandedComponent(isExpanded ? null : item.component_id)}
              className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-4">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                  item.is_required ? 'bg-purple-100' : 'bg-gray-100'
                }`}>
                  <Settings2 className={`w-4 h-4 ${item.is_required ? 'text-purple-600' : 'text-gray-500'}`} />
                </div>
                <div className="text-left">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900">{item.component.name}</span>
                    <span className="text-xs font-mono text-gray-500">({item.component.code})</span>
                    {item.is_required && (
                      <span className="px-1.5 py-0.5 text-xs bg-purple-100 text-purple-700 rounded">
                        Required
                      </span>
                    )}
                  </div>
                  {/* Material chips preview */}
                  <div className="flex flex-wrap gap-1 mt-1">
                    {componentRules.slice(0, 4).map((rule) => (
                      <span
                        key={rule.id}
                        className={`px-2 py-0.5 text-xs rounded ${
                          rule.material_id
                            ? 'bg-green-100 text-green-700'  // Specific material = green
                            : 'bg-blue-100 text-blue-700'    // Subcategory = blue
                        }`}
                      >
                        {rule.material_subcategory || rule.material_category || rule.material?.material_name}
                        {rule.is_default && ' ★'}
                      </span>
                    ))}
                    {componentRules.length > 4 && (
                      <span className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded">
                        +{componentRules.length - 4} more
                      </span>
                    )}
                    {componentRules.length === 0 && (
                      <span className="text-xs text-gray-400 italic">No materials mapped</span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500">
                  {componentRules.length} mapping{componentRules.length !== 1 ? 's' : ''}
                </span>
                {isExpanded ? (
                  <ChevronDown className="w-4 h-4 text-gray-400" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                )}
              </div>
            </button>

            {/* Expanded Material Mappings */}
            {isExpanded && (
              <div className="border-t border-gray-200 bg-gray-50 px-4 py-4">
                <ComponentMaterialEditor
                  productTypeId={productTypeId}
                  componentId={item.component_id}
                  componentName={item.component.name}
                  rules={componentRules}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// Inline editor for component materials
function ComponentMaterialEditor({
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
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedSubcategory, setSelectedSubcategory] = useState('');
  const [isDefault, setIsDefault] = useState(false);

  // Get subcategories for selected category
  const subcategories = categories?.find(c => c.category === selectedCategory)?.subcategories || [];

  // Filter categories/subcategories by search
  const filteredCategories = categories?.filter(cat => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return cat.category.toLowerCase().includes(q) ||
           cat.subcategories.some(sub => sub.toLowerCase().includes(q));
  }) || [];

  const handleAddRule = async () => {
    if (!selectedSubcategory && !selectedCategory) return;

    await createRule.mutateAsync({
      product_type_id: productTypeId,
      product_style_id: null,
      component_id: componentId,
      material_category: selectedSubcategory ? null : selectedCategory,
      material_subcategory: selectedSubcategory || null,
      material_id: null,
      is_default: isDefault,
      display_order: rules.length,
      notes: null,
    });

    setShowAddForm(false);
    setSearchQuery('');
    setSelectedCategory('');
    setSelectedSubcategory('');
    setIsDefault(false);
  };

  const handleDeleteRule = async (ruleId: string) => {
    await deleteRule.mutateAsync(ruleId);
  };

  return (
    <div className="space-y-3">
      {/* Existing mappings */}
      <div className="flex flex-wrap gap-2">
        {rules.map((rule) => (
          <div
            key={rule.id}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm ${
              rule.material_id
                ? 'bg-green-100 text-green-800 border border-green-200'  // Specific material
                : 'bg-blue-100 text-blue-800 border border-blue-200'     // Subcategory
            }`}
          >
            {rule.is_default && <span className="text-amber-500">★</span>}
            <span>{rule.material_subcategory || rule.material_category || rule.material?.material_name}</span>
            <button
              onClick={() => handleDeleteRule(rule.id)}
              className="ml-1 p-0.5 hover:bg-white/50 rounded transition-colors"
              title="Remove mapping"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}

        {/* Add button */}
        {!showAddForm && (
          <button
            onClick={() => setShowAddForm(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm border-2 border-dashed border-gray-300 text-gray-500 hover:border-purple-400 hover:text-purple-600 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add
          </button>
        )}
      </div>

      {/* Add form */}
      {showAddForm && (
        <div className="bg-white rounded-lg border border-purple-200 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-gray-900">Add material mapping to {componentName}</h4>
            <button
              onClick={() => setShowAddForm(false)}
              className="p-1 text-gray-400 hover:text-gray-600"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search categories or subcategories..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
            />
          </div>

          {/* Category/Subcategory selection */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Category</label>
              <select
                value={selectedCategory}
                onChange={(e) => {
                  setSelectedCategory(e.target.value);
                  setSelectedSubcategory('');
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500"
              >
                <option value="">Select category...</option>
                {filteredCategories.map((cat) => (
                  <option key={cat.category} value={cat.category}>
                    {cat.category}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Subcategory</label>
              <select
                value={selectedSubcategory}
                onChange={(e) => setSelectedSubcategory(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500"
                disabled={!selectedCategory}
              >
                <option value="">All in category</option>
                {subcategories
                  .filter(sub => !searchQuery || sub.toLowerCase().includes(searchQuery.toLowerCase()))
                  .map((sub) => (
                    <option key={sub} value={sub}>
                      {sub}
                    </option>
                  ))}
              </select>
            </div>
          </div>

          {/* Default checkbox */}
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={isDefault}
              onChange={(e) => setIsDefault(e.target.checked)}
              className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
            />
            <span className="text-sm text-gray-700">Set as default selection (★)</span>
          </label>

          {/* Legend */}
          <div className="flex items-center gap-4 text-xs text-gray-500 pt-2 border-t border-gray-100">
            <div className="flex items-center gap-1">
              <span className="w-3 h-3 rounded bg-blue-100 border border-blue-200"></span>
              <span>Subcategory</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-3 h-3 rounded bg-green-100 border border-green-200"></span>
              <span>Specific material</span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <button
              onClick={handleAddRule}
              disabled={!selectedCategory || createRule.isPending}
              className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium transition-colors"
            >
              {createRule.isPending ? 'Adding...' : 'Add Mapping'}
            </button>
            <button
              onClick={() => setShowAddForm(false)}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm font-medium transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
