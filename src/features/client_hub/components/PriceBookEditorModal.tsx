import { useState } from 'react';
import { X, Plus, Minus, Trash2, Search, Package, Star } from 'lucide-react';
import {
  usePriceBook,
  useUpdatePriceBook,
  useAddPriceBookOverride,
  useRemovePriceBookOverride,
  useSkuSearchForPriceBook,
} from '../hooks/usePriceBooks';
import { BU_TYPE_LABELS } from '../types';

// Helper type for SKU with nested product info
// Note: Supabase returns foreign key joins as arrays
interface SkuWithProductInfo {
  id: string;
  sku_code: string;
  sku_name: string;
  height: number;
  post_type: string;
  bu_types_allowed?: string[] | null;
  product_type: { name: string; code: string }[] | null;
  product_style: { name: string; code: string }[] | null;
}

// Helper type for override with SKU details
interface OverrideWithSku {
  id: string;
  price_book_id: string;
  sku_id: string;
  action: 'include' | 'exclude';
  sort_order: number;
  is_featured: boolean;
  category_override: string | null;
  notes: string | null;
  sku: {
    id: string;
    sku_code: string;
    sku_name: string;
    height: number;
    post_type: string;
    product_type: { name: string; code: string } | null;
    product_style: { name: string; code: string } | null;
  };
}

interface Props {
  priceBookId: string;
  onClose: () => void;
}

/**
 * PriceBookEditorModal - Edit overrides for a BU Price Book
 *
 * Features:
 * - View current include/exclude overrides
 * - Add new overrides by searching SKUs
 * - Toggle featured flag for included SKUs
 * - Remove overrides
 */
export default function PriceBookEditorModal({ priceBookId, onClose }: Props) {
  const { data: priceBook, isLoading } = usePriceBook(priceBookId);
  const updateMutation = useUpdatePriceBook();
  const addOverrideMutation = useAddPriceBookOverride();
  const removeOverrideMutation = useRemovePriceBookOverride();

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [searchAction, setSearchAction] = useState<'include' | 'exclude'>('include');
  const existingSkuIds = priceBook?.overrides?.map((o: OverrideWithSku) => o.sku_id) || [];
  const { data: searchResults } = useSkuSearchForPriceBook(searchQuery, existingSkuIds);

  // Filter results to exclude already-overridden SKUs
  const filteredResults = (searchResults as SkuWithProductInfo[] | undefined)?.filter((sku) => !existingSkuIds.includes(sku.id)) || [];

  const handleAddOverride = async (skuId: string) => {
    try {
      await addOverrideMutation.mutateAsync({
        price_book_id: priceBookId,
        sku_id: skuId,
        action: searchAction,
      });
      setSearchQuery('');
    } catch {
      // Error handled by mutation
    }
  };

  const handleRemoveOverride = async (overrideId: string) => {
    try {
      await removeOverrideMutation.mutateAsync({
        id: overrideId,
        price_book_id: priceBookId,
      });
    } catch {
      // Error handled by mutation
    }
  };

  const handleToggleIncludeAll = async () => {
    if (!priceBook) return;
    try {
      await updateMutation.mutateAsync({
        id: priceBookId,
        data: { include_all_for_bu_type: !priceBook.include_all_for_bu_type },
      });
    } catch {
      // Error handled by mutation
    }
  };

  if (isLoading || !priceBook) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-xl shadow-xl p-8">
          <div className="animate-spin w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full" />
        </div>
      </div>
    );
  }

  const includeOverrides = (priceBook.overrides as OverrideWithSku[] | undefined)?.filter((o) => o.action === 'include') || [];
  const excludeOverrides = (priceBook.overrides as OverrideWithSku[] | undefined)?.filter((o) => o.action === 'exclude') || [];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              {priceBook.qbo_class?.name || priceBook.name} Price Book
            </h2>
            <p className="text-sm text-gray-500">
              {priceBook.qbo_class?.bu_type &&
                BU_TYPE_LABELS[priceBook.qbo_class.bu_type as keyof typeof BU_TYPE_LABELS]}{' '}
              • {priceBook.qbo_class?.labor_code}
            </p>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Settings */}
          <div className="bg-gray-50 rounded-lg p-4">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={priceBook.include_all_for_bu_type}
                onChange={handleToggleIncludeAll}
                disabled={updateMutation.isPending}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <div>
                <span className="text-sm font-medium text-gray-700">
                  Auto-include SKUs matching BU type
                </span>
                <p className="text-xs text-gray-500">
                  When enabled, SKUs with{' '}
                  <code className="bg-gray-200 px-1 rounded">bu_types_allowed</code> matching "
                  {priceBook.qbo_class?.bu_type}" are automatically included
                </p>
              </div>
            </label>
          </div>

          {/* Add Override Section */}
          <div>
            {!showSearch ? (
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setSearchAction('include');
                    setShowSearch(true);
                  }}
                  className="flex items-center gap-2 px-4 py-2 text-green-600 border border-green-200 rounded-lg hover:bg-green-50"
                >
                  <Plus className="w-4 h-4" />
                  Include SKU
                </button>
                <button
                  onClick={() => {
                    setSearchAction('exclude');
                    setShowSearch(true);
                  }}
                  className="flex items-center gap-2 px-4 py-2 text-red-600 border border-red-200 rounded-lg hover:bg-red-50"
                >
                  <Minus className="w-4 h-4" />
                  Exclude SKU
                </button>
              </div>
            ) : (
              <div
                className={`border rounded-lg p-4 ${
                  searchAction === 'include'
                    ? 'border-green-200 bg-green-50/50'
                    : 'border-red-200 bg-red-50/50'
                }`}
              >
                <div className="flex items-center gap-2 mb-3">
                  <div
                    className={`px-2 py-1 rounded text-xs font-medium ${
                      searchAction === 'include'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-red-100 text-red-700'
                    }`}
                  >
                    {searchAction === 'include' ? 'Include' : 'Exclude'}
                  </div>
                  <Search className="w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search SKUs by code or name..."
                    className="flex-1 px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                    autoFocus
                  />
                  <button
                    onClick={() => {
                      setShowSearch(false);
                      setSearchQuery('');
                    }}
                    className="p-2 text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Search Results */}
                {filteredResults.length > 0 ? (
                  <div className="max-h-48 overflow-y-auto space-y-1">
                    {filteredResults.map((sku) => {
                      const isAlreadyAvailable =
                        !sku.bu_types_allowed ||
                        sku.bu_types_allowed.length === 0 ||
                        sku.bu_types_allowed.includes(priceBook.qbo_class?.bu_type || '');

                      return (
                        <button
                          key={sku.id}
                          onClick={() => handleAddOverride(sku.id)}
                          disabled={addOverrideMutation.isPending}
                          className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-white rounded-lg transition-colors"
                        >
                          <Package className="w-4 h-4 text-gray-400" />
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-gray-900 truncate">{sku.sku_name}</div>
                            <div className="text-xs text-gray-500">
                              {sku.sku_code} • {sku.product_type?.[0]?.name || 'Unknown'} • {sku.height}ft
                              {sku.bu_types_allowed && sku.bu_types_allowed.length > 0 && (
                                <span className="ml-2 text-gray-400">
                                  ({sku.bu_types_allowed.join(', ')})
                                </span>
                              )}
                            </div>
                          </div>
                          {isAlreadyAvailable && searchAction === 'include' && (
                            <span className="text-xs text-gray-400">Already available</span>
                          )}
                          {!isAlreadyAvailable && searchAction === 'exclude' && (
                            <span className="text-xs text-gray-400">Not available</span>
                          )}
                          {searchAction === 'include' ? (
                            <Plus className="w-4 h-4 text-green-600" />
                          ) : (
                            <Minus className="w-4 h-4 text-red-600" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                ) : searchQuery.length >= 2 ? (
                  <p className="text-sm text-gray-500 text-center py-4">No SKUs found</p>
                ) : (
                  <p className="text-sm text-gray-500 text-center py-4">
                    Type at least 2 characters to search
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Include Overrides */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 uppercase tracking-wide mb-3 flex items-center gap-2">
              <Plus className="w-4 h-4 text-green-600" />
              Included SKUs ({includeOverrides.length})
            </h3>
            {includeOverrides.length > 0 ? (
              <div className="space-y-2">
                {includeOverrides.map((override) => (
                  <div
                    key={override.id}
                    className="flex items-center gap-3 px-4 py-3 bg-green-50 border border-green-200 rounded-lg"
                  >
                    <Package className="w-4 h-4 text-green-600" />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-900 truncate">{override.sku.sku_name}</div>
                      <div className="text-xs text-gray-500">
                        {override.sku.sku_code} • {override.sku.product_type?.name || ''} •{' '}
                        {override.sku.height}ft
                      </div>
                    </div>
                    {override.is_featured && (
                      <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                    )}
                    <button
                      onClick={() => handleRemoveOverride(override.id)}
                      disabled={removeOverrideMutation.isPending}
                      className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500 py-4 text-center border border-dashed rounded-lg">
                No explicit inclusions. SKUs are included based on their{' '}
                <code className="bg-gray-100 px-1 rounded">bu_types_allowed</code> setting.
              </p>
            )}
          </div>

          {/* Exclude Overrides */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 uppercase tracking-wide mb-3 flex items-center gap-2">
              <Minus className="w-4 h-4 text-red-600" />
              Excluded SKUs ({excludeOverrides.length})
            </h3>
            {excludeOverrides.length > 0 ? (
              <div className="space-y-2">
                {excludeOverrides.map((override) => (
                  <div
                    key={override.id}
                    className="flex items-center gap-3 px-4 py-3 bg-red-50 border border-red-200 rounded-lg"
                  >
                    <Package className="w-4 h-4 text-red-600" />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-900 truncate">{override.sku.sku_name}</div>
                      <div className="text-xs text-gray-500">
                        {override.sku.sku_code} • {override.sku.product_type?.name || ''} •{' '}
                        {override.sku.height}ft
                      </div>
                    </div>
                    {override.notes && (
                      <span className="text-xs text-gray-500 max-w-[150px] truncate" title={override.notes}>
                        {override.notes}
                      </span>
                    )}
                    <button
                      onClick={() => handleRemoveOverride(override.id)}
                      disabled={removeOverrideMutation.isPending}
                      className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500 py-4 text-center border border-dashed rounded-lg">
                No exclusions. All SKUs matching the BU type are available.
              </p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end px-6 py-4 border-t border-gray-100 bg-gray-50">
          <button onClick={onClose} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
