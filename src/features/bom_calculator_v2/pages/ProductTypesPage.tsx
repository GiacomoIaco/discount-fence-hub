/**
 * Product Types Page - Admin view
 *
 * Displays all product types with their styles and components.
 * Allows admins to view the product definition framework.
 */

import { useState } from 'react';
import { ChevronDown, ChevronRight, Box, Layers, Settings2, Package } from 'lucide-react';
import { useProductTypesWithStyles, useProductTypeComponents } from '../hooks';
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
          View and manage product type definitions, styles, and component configurations.
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
  const [activeTab, setActiveTab] = useState<'styles' | 'components'>('styles');
  const { data: components, isLoading: componentsLoading } = useProductTypeComponents(productType.id);

  return (
    <div>
      {/* Tabs */}
      <div className="flex border-b border-gray-200">
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
      </div>

      {/* Tab Content */}
      <div className="p-6">
        {activeTab === 'styles' && (
          <StylesTab styles={productType.styles} />
        )}
        {activeTab === 'components' && (
          <ComponentsTab components={components || []} isLoading={componentsLoading} />
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
          {style.default_components && Object.keys(style.default_components).length > 0 && (
            <div className="mt-3 pt-3 border-t border-gray-100">
              <p className="text-xs text-gray-500 mb-1">Default Components:</p>
              <div className="flex flex-wrap gap-1">
                {Object.entries(style.default_components)
                  .filter(([, enabled]) => enabled)
                  .map(([comp]) => (
                    <span
                      key={comp}
                      className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded"
                    >
                      {comp}
                    </span>
                  ))}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// Components Tab
function ComponentsTab({
  components,
  isLoading,
}: {
  components: (ProductTypeComponent & { component: ComponentDefinition })[];
  isLoading: boolean;
}) {
  if (isLoading) {
    return (
      <div className="animate-pulse space-y-2">
        <div className="h-12 bg-gray-100 rounded"></div>
        <div className="h-12 bg-gray-100 rounded"></div>
        <div className="h-12 bg-gray-100 rounded"></div>
      </div>
    );
  }

  if (components.length === 0) {
    return (
      <p className="text-gray-500 text-sm">No components defined for this product type.</p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200">
            <th className="text-left py-2 px-3 font-medium text-gray-600">Component</th>
            <th className="text-left py-2 px-3 font-medium text-gray-600">Code</th>
            <th className="text-left py-2 px-3 font-medium text-gray-600">Category</th>
            <th className="text-center py-2 px-3 font-medium text-gray-600">Required</th>
            <th className="text-left py-2 px-3 font-medium text-gray-600">Calculation Type</th>
          </tr>
        </thead>
        <tbody>
          {components.map((item) => (
            <tr key={item.id} className="border-b border-gray-100 hover:bg-gray-50">
              <td className="py-2 px-3 font-medium text-gray-900">
                {item.component.name}
              </td>
              <td className="py-2 px-3 font-mono text-gray-600">
                {item.component.code}
              </td>
              <td className="py-2 px-3 text-gray-600 capitalize">
                {item.component.category || '-'}
              </td>
              <td className="py-2 px-3 text-center">
                {item.is_required ? (
                  <span className="text-green-600">Yes</span>
                ) : (
                  <span className="text-gray-400">No</span>
                )}
              </td>
              <td className="py-2 px-3">
                {item.component.calculation_type ? (
                  <span className={`px-2 py-0.5 text-xs rounded ${
                    item.component.calculation_type === 'formula'
                      ? 'bg-blue-100 text-blue-700'
                      : item.component.calculation_type === 'lookup'
                      ? 'bg-amber-100 text-amber-700'
                      : 'bg-gray-100 text-gray-600'
                  }`}>
                    {item.component.calculation_type}
                  </span>
                ) : (
                  <span className="text-gray-400">-</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
