import { useState, useMemo } from 'react';
import {
  X,
  Search,
  CheckSquare,
  Square,
  MinusSquare,
  Plus,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';

interface Props {
  priceBookId: string;
  priceBookName: string;
  existingSkuIds: string[];
  onAdd: (skuIds: string[]) => Promise<void>;
  onClose: () => void;
}

interface SkuCatalogItem {
  id: string;
  sku: string;
  description: string;
  unit: string;
  sell_price: number;
  category: string | null;
  product_type_id: string | null;
  product_style_id: string | null;
  height: number | null;
}

export default function BulkAddSkusModal({
  priceBookId: _priceBookId,
  priceBookName,
  existingSkuIds,
  onAdd,
  onClose,
}: Props) {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedProductType, setSelectedProductType] = useState('');
  const [selectedHeight, setSelectedHeight] = useState('');
  const [selectedSkuIds, setSelectedSkuIds] = useState<Set<string>>(new Set());
  const [isAdding, setIsAdding] = useState(false);

  // Fetch all SKUs with filters
  const { data: allSkus, isLoading } = useQuery({
    queryKey: ['bulk-add-skus'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sku_catalog')
        .select('id, sku, description, unit, sell_price, category, product_type_id, product_style_id, height')
        .eq('is_active', true)
        .order('sku');

      if (error) throw error;
      return data as SkuCatalogItem[];
    },
  });

  // Fetch product types for filter
  const { data: productTypes } = useQuery({
    queryKey: ['product-types-for-filter'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('product_types')
        .select('id, name')
        .order('name');

      if (error) throw error;
      return data;
    },
  });

  // Get unique categories from SKUs
  const categories = useMemo(() => {
    if (!allSkus) return [];
    const cats = [...new Set(allSkus.map(s => s.category).filter(Boolean))];
    return cats.sort();
  }, [allSkus]);

  // Get unique heights from SKUs
  const heights = useMemo(() => {
    if (!allSkus) return [];
    const h = [...new Set(allSkus.map(s => s.height).filter(Boolean))];
    return h.sort((a, b) => (a || 0) - (b || 0));
  }, [allSkus]);

  // Filter SKUs
  const filteredSkus = useMemo(() => {
    if (!allSkus) return [];

    return allSkus.filter((sku) => {
      // Exclude already added SKUs
      if (existingSkuIds.includes(sku.id)) return false;

      // Search filter
      if (search) {
        const searchLower = search.toLowerCase();
        if (
          !sku.sku.toLowerCase().includes(searchLower) &&
          !sku.description?.toLowerCase().includes(searchLower)
        ) {
          return false;
        }
      }

      // Category filter
      if (selectedCategory && sku.category !== selectedCategory) return false;

      // Product type filter
      if (selectedProductType && sku.product_type_id !== selectedProductType) return false;

      // Height filter
      if (selectedHeight && sku.height !== parseInt(selectedHeight)) return false;

      return true;
    });
  }, [allSkus, existingSkuIds, search, selectedCategory, selectedProductType, selectedHeight]);

  const handleToggle = (skuId: string) => {
    const newSelected = new Set(selectedSkuIds);
    if (newSelected.has(skuId)) {
      newSelected.delete(skuId);
    } else {
      newSelected.add(skuId);
    }
    setSelectedSkuIds(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedSkuIds.size === filteredSkus.length) {
      // Deselect all
      setSelectedSkuIds(new Set());
    } else {
      // Select all visible
      setSelectedSkuIds(new Set(filteredSkus.map(s => s.id)));
    }
  };

  const handleAdd = async () => {
    if (selectedSkuIds.size === 0) return;
    setIsAdding(true);
    try {
      await onAdd([...selectedSkuIds]);
    } finally {
      setIsAdding(false);
    }
  };

  const allSelected = filteredSkus.length > 0 && selectedSkuIds.size === filteredSkus.length;
  const someSelected = selectedSkuIds.size > 0 && selectedSkuIds.size < filteredSkus.length;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              Add SKUs to "{priceBookName}"
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              Select SKUs to add to this price book
            </p>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filters */}
        <div className="px-6 py-4 border-b border-gray-100 space-y-3">
          <div className="flex items-center gap-3">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search SKUs..."
                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500"
              />
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {/* Category */}
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
            >
              <option value="">All Categories</option>
              {categories.map((cat) => (
                <option key={cat} value={cat || ''}>{cat}</option>
              ))}
            </select>

            {/* Product Type */}
            <select
              value={selectedProductType}
              onChange={(e) => setSelectedProductType(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
            >
              <option value="">All Product Types</option>
              {productTypes?.map((pt) => (
                <option key={pt.id} value={pt.id}>{pt.name}</option>
              ))}
            </select>

            {/* Height */}
            <select
              value={selectedHeight}
              onChange={(e) => setSelectedHeight(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
            >
              <option value="">All Heights</option>
              {heights.map((h) => (
                <option key={h} value={h || ''}>{h}' Height</option>
              ))}
            </select>

            {(selectedCategory || selectedProductType || selectedHeight) && (
              <button
                onClick={() => {
                  setSelectedCategory('');
                  setSelectedProductType('');
                  setSelectedHeight('');
                }}
                className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700"
              >
                Clear filters
              </button>
            )}
          </div>

          {/* Select All */}
          <div className="flex items-center justify-between">
            <button
              onClick={handleSelectAll}
              className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-800"
            >
              {allSelected ? (
                <CheckSquare className="w-4 h-4 text-green-600" />
              ) : someSelected ? (
                <MinusSquare className="w-4 h-4 text-green-600" />
              ) : (
                <Square className="w-4 h-4" />
              )}
              Select All ({filteredSkus.length} products)
            </button>
            <span className="text-sm text-gray-500">
              {selectedSkuIds.size} selected
            </span>
          </div>
        </div>

        {/* SKU List */}
        <div className="flex-1 overflow-y-auto p-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full" />
            </div>
          ) : filteredSkus.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              No SKUs match your filters
            </div>
          ) : (
            <div className="space-y-1">
              {filteredSkus.map((sku) => {
                const isSelected = selectedSkuIds.has(sku.id);
                return (
                  <button
                    key={sku.id}
                    onClick={() => handleToggle(sku.id)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors ${
                      isSelected ? 'bg-green-50 border border-green-200' : 'hover:bg-gray-50 border border-transparent'
                    }`}
                  >
                    {isSelected ? (
                      <CheckSquare className="w-5 h-5 text-green-600 flex-shrink-0" />
                    ) : (
                      <Square className="w-5 h-5 text-gray-300 flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-900">{sku.sku}</div>
                      <div className="text-sm text-gray-500 truncate">{sku.description}</div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="text-sm font-medium text-gray-900">
                        ${sku.sell_price?.toFixed(2) || '0.00'}
                      </div>
                      <div className="text-xs text-gray-500">{sku.unit}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 hover:text-gray-800"
          >
            Cancel
          </button>
          <button
            onClick={handleAdd}
            disabled={selectedSkuIds.size === 0 || isAdding}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
          >
            <Plus className="w-4 h-4" />
            {isAdding ? 'Adding...' : `Add ${selectedSkuIds.size} Products`}
          </button>
        </div>
      </div>
    </div>
  );
}
