import { useState } from 'react';
import { X, Plus, Trash2, DollarSign, Tag, GripVertical, Search, Package } from 'lucide-react';
import {
  useCommunityProductsWithDetails,
  useAddCommunityProduct,
  useUpdateCommunityProduct,
  useRemoveCommunityProduct,
  useSkuSearchForCommunity,
} from '../hooks/useCommunityProducts';

// Helper type for SKU search results with nested product info
// Note: Supabase returns foreign key joins as arrays
interface SkuSearchResult {
  id: string;
  sku_code: string;
  sku_name: string;
  height: number;
  post_type: string;
  standard_cost_per_foot: number | null;
  product_type: { name: string; code: string }[] | null;
  product_style: { name: string; code: string }[] | null;
}

interface Props {
  communityId: string;
  communityName: string;
  onClose: () => void;
}

/**
 * CommunityProductsEditor - Modal for managing products available at a specific community
 *
 * Features:
 * - Add/remove SKUs from community
 * - Set spec codes (community's name for the product, e.g., "Fence Type A")
 * - Set price overrides (takes precedence over rate sheet)
 * - Mark products as default (pre-selected in quotes)
 */
export default function CommunityProductsEditor({ communityId, communityName, onClose }: Props) {
  const { data: products, isLoading } = useCommunityProductsWithDetails(communityId);
  const addMutation = useAddCommunityProduct();
  const updateMutation = useUpdateCommunityProduct();
  const removeMutation = useRemoveCommunityProduct();

  // SKU search state
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const existingSkuIds = products?.map((p) => p.sku_id) || [];
  const { data: searchResults } = useSkuSearchForCommunity(searchQuery, existingSkuIds);

  // Editing state for inline edits
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{
    spec_code: string;
    price_override: string;
    price_override_reason: string;
  }>({ spec_code: '', price_override: '', price_override_reason: '' });

  const handleAddSku = async (skuId: string) => {
    try {
      await addMutation.mutateAsync({
        community_id: communityId,
        sku_id: skuId,
      });
      setSearchQuery('');
      setShowSearch(false);
    } catch {
      // Error handled by mutation
    }
  };

  const handleRemove = async (productId: string) => {
    if (!confirm('Remove this product from the community?')) return;
    try {
      await removeMutation.mutateAsync({ id: productId, community_id: communityId });
    } catch {
      // Error handled by mutation
    }
  };

  const handleStartEdit = (product: NonNullable<typeof products>[number]) => {
    setEditingId(product.id);
    setEditForm({
      spec_code: product.spec_code || '',
      price_override: product.price_override?.toString() || '',
      price_override_reason: product.price_override_reason || '',
    });
  };

  const handleSaveEdit = async (productId: string) => {
    try {
      await updateMutation.mutateAsync({
        id: productId,
        community_id: communityId,
        data: {
          spec_code: editForm.spec_code || null,
          price_override: editForm.price_override ? parseFloat(editForm.price_override) : null,
          price_override_reason: editForm.price_override_reason || null,
        },
      });
      setEditingId(null);
    } catch {
      // Error handled by mutation
    }
  };

  const handleToggleDefault = async (product: NonNullable<typeof products>[number]) => {
    try {
      await updateMutation.mutateAsync({
        id: product.id,
        community_id: communityId,
        data: { is_default: !product.is_default },
      });
    } catch {
      // Error handled by mutation
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Community Products</h2>
            <p className="text-sm text-gray-500">{communityName}</p>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Add Product Section */}
          <div className="mb-6">
            {!showSearch ? (
              <button
                onClick={() => setShowSearch(true)}
                className="flex items-center gap-2 px-4 py-2 text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50"
              >
                <Plus className="w-4 h-4" />
                Add Product
              </button>
            ) : (
              <div className="border border-blue-200 rounded-lg p-4 bg-blue-50/50">
                <div className="flex items-center gap-2 mb-3">
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
                {searchResults && searchResults.length > 0 ? (
                  <div className="max-h-48 overflow-y-auto space-y-1">
                    {(searchResults as SkuSearchResult[]).map((sku) => (
                      <button
                        key={sku.id}
                        onClick={() => handleAddSku(sku.id)}
                        disabled={addMutation.isPending}
                        className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-white rounded-lg transition-colors"
                      >
                        <Package className="w-4 h-4 text-gray-400" />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-gray-900 truncate">{sku.sku_name}</div>
                          <div className="text-xs text-gray-500">
                            {sku.sku_code} • {sku.product_type?.[0]?.name || 'Unknown'} • {sku.height}ft
                          </div>
                        </div>
                        <div className="text-sm text-gray-500">
                          ${(sku.standard_cost_per_foot || 0).toFixed(2)}/ft
                        </div>
                        <Plus className="w-4 h-4 text-blue-600" />
                      </button>
                    ))}
                  </div>
                ) : searchQuery.length >= 2 ? (
                  <p className="text-sm text-gray-500 text-center py-4">No SKUs found</p>
                ) : (
                  <p className="text-sm text-gray-500 text-center py-4">Type at least 2 characters to search</p>
                )}
              </div>
            )}
          </div>

          {/* Products List */}
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full" />
            </div>
          ) : products && products.length > 0 ? (
            <div className="space-y-2">
              <div className="grid grid-cols-12 gap-2 px-3 py-2 text-xs font-medium text-gray-500 uppercase">
                <div className="col-span-1"></div>
                <div className="col-span-4">Product</div>
                <div className="col-span-2">Spec Code</div>
                <div className="col-span-2">Price Override</div>
                <div className="col-span-2">Default</div>
                <div className="col-span-1"></div>
              </div>

              {products.map((product) => (
                <div
                  key={product.id}
                  className={`grid grid-cols-12 gap-2 px-3 py-3 items-center rounded-lg border ${
                    product.is_default ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'
                  }`}
                >
                  {/* Sort Handle */}
                  <div className="col-span-1">
                    <GripVertical className="w-4 h-4 text-gray-400 cursor-move" />
                  </div>

                  {/* Product Info */}
                  <div className="col-span-4">
                    <div className="font-medium text-gray-900 truncate" title={product.sku.sku_name}>
                      {product.sku.sku_name}
                    </div>
                    <div className="text-xs text-gray-500">
                      {product.sku.sku_code} • {product.sku.product_type?.name || ''} • {product.sku.height}ft
                    </div>
                  </div>

                  {/* Spec Code */}
                  <div className="col-span-2">
                    {editingId === product.id ? (
                      <input
                        type="text"
                        value={editForm.spec_code}
                        onChange={(e) => setEditForm({ ...editForm, spec_code: e.target.value })}
                        placeholder="e.g., Type A"
                        className="w-full px-2 py-1 text-sm border rounded focus:ring-2 focus:ring-blue-500"
                      />
                    ) : product.spec_code ? (
                      <span
                        className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs cursor-pointer hover:bg-blue-200"
                        onClick={() => handleStartEdit(product)}
                      >
                        <Tag className="w-3 h-3" />
                        {product.spec_code}
                      </span>
                    ) : (
                      <button
                        onClick={() => handleStartEdit(product)}
                        className="text-xs text-gray-400 hover:text-blue-600"
                      >
                        + Add spec code
                      </button>
                    )}
                  </div>

                  {/* Price Override */}
                  <div className="col-span-2">
                    {editingId === product.id ? (
                      <div className="flex items-center gap-1">
                        <span className="text-gray-400">$</span>
                        <input
                          type="number"
                          value={editForm.price_override}
                          onChange={(e) => setEditForm({ ...editForm, price_override: e.target.value })}
                          placeholder="0.00"
                          step="0.01"
                          className="w-full px-2 py-1 text-sm border rounded focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    ) : product.price_override !== null ? (
                      <span
                        className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded text-xs cursor-pointer hover:bg-green-200"
                        onClick={() => handleStartEdit(product)}
                        title={product.price_override_reason || 'Custom price'}
                      >
                        <DollarSign className="w-3 h-3" />
                        ${product.price_override.toFixed(2)}/ft
                      </span>
                    ) : (
                      <button
                        onClick={() => handleStartEdit(product)}
                        className="text-xs text-gray-400 hover:text-green-600"
                      >
                        + Set price
                      </button>
                    )}
                  </div>

                  {/* Default Toggle */}
                  <div className="col-span-2">
                    <button
                      onClick={() => handleToggleDefault(product)}
                      disabled={updateMutation.isPending}
                      className={`px-2 py-1 rounded text-xs font-medium ${
                        product.is_default
                          ? 'bg-green-600 text-white'
                          : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                      }`}
                    >
                      {product.is_default ? 'Default' : 'Set Default'}
                    </button>
                  </div>

                  {/* Actions */}
                  <div className="col-span-1 flex items-center justify-end gap-1">
                    {editingId === product.id ? (
                      <>
                        <button
                          onClick={() => handleSaveEdit(product.id)}
                          disabled={updateMutation.isPending}
                          className="p-1 text-green-600 hover:bg-green-50 rounded"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="p-1 text-gray-400 hover:bg-gray-100 rounded"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => handleRemove(product.id)}
                        disabled={removeMutation.isPending}
                        className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <Package className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <h3 className="text-lg font-medium text-gray-900 mb-1">No products configured</h3>
              <p className="text-gray-500 mb-4">
                Add products to restrict which SKUs can be used for quotes in this community.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 bg-gray-50">
          <div className="text-sm text-gray-500">
            {products?.length || 0} product{(products?.length || 0) !== 1 ? 's' : ''} configured
          </div>
          <button onClick={onClose} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
