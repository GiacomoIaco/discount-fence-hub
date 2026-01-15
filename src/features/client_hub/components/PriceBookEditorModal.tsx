import { useState, useEffect } from 'react';
import {
  X,
  BookOpen,
  Search,
  Trash2,
  Save,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Star,
  Plus,
} from 'lucide-react';
import {
  usePriceBook,
  useCreatePriceBook,
  useUpdatePriceBook,
  useAddPriceBookItem,
  useRemovePriceBookItem,
  useUpdatePriceBookItem,
  useSkuCatalogForPriceBook,
  useBulkAddPriceBookItems,
} from '../hooks/usePriceBooks';
import type { PriceBook, PriceBookItem } from '../types';
import BulkAddSkusModal from './BulkAddSkusModal';

interface Props {
  priceBook: PriceBook | null;
  onClose: () => void;
}

export default function PriceBookEditorModal({ priceBook: initialPriceBook, onClose }: Props) {
  // Track the price book ID - starts with initial, but updates after create
  const [priceBookId, setPriceBookId] = useState<string | null>(initialPriceBook?.id || null);
  const isEditing = !!priceBookId;

  // Form state
  const [name, setName] = useState(initialPriceBook?.name || '');
  const [code, setCode] = useState(initialPriceBook?.code || '');
  const [description, setDescription] = useState(initialPriceBook?.description || '');
  const [tags, setTags] = useState<string[]>(initialPriceBook?.tags || []);
  const [tagInput, setTagInput] = useState('');
  const [isActive, setIsActive] = useState(initialPriceBook?.is_active ?? true);

  // Validation
  const [validationError, setValidationError] = useState('');

  // UI state
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [activeTab, setActiveTab] = useState<'info' | 'items'>('info');
  const [showBulkAdd, setShowBulkAdd] = useState(false);

  // SKU search
  const [skuSearch, setSkuSearch] = useState('');
  const [showSkuDropdown, setShowSkuDropdown] = useState(false);

  // Queries
  const { data: fullPriceBook, isLoading: loadingBook } = usePriceBook(priceBookId);
  const { data: skuCatalog } = useSkuCatalogForPriceBook({
    search: skuSearch,
    excludeSkuIds: fullPriceBook?.items?.map(i => i.sku_id) || [],
  });

  // Mutations
  const createMutation = useCreatePriceBook();
  const updateMutation = useUpdatePriceBook();
  const addItemMutation = useAddPriceBookItem();
  const removeItemMutation = useRemovePriceBookItem();
  const updateItemMutation = useUpdatePriceBookItem();
  const bulkAddMutation = useBulkAddPriceBookItems();

  // Load existing data
  useEffect(() => {
    if (fullPriceBook) {
      setName(fullPriceBook.name);
      setCode(fullPriceBook.code || '');
      setDescription(fullPriceBook.description || '');
      setTags(fullPriceBook.tags || []);
      setIsActive(fullPriceBook.is_active);
    }
  }, [fullPriceBook]);

  const handleAddTag = () => {
    if (tagInput.trim() && !tags.includes(tagInput.trim().toLowerCase())) {
      setTags([...tags, tagInput.trim().toLowerCase()]);
      setTagInput('');
    }
  };

  const handleRemoveTag = (tag: string) => {
    setTags(tags.filter(t => t !== tag));
  };

  const handleAddSku = async (sku: { id: string; sku: string; description: string }) => {
    if (!priceBookId) return;

    await addItemMutation.mutateAsync({
      price_book_id: priceBookId,
      sku_id: sku.id,
      is_featured: false,
    });

    setSkuSearch('');
    setShowSkuDropdown(false);
  };

  const handleToggleFeatured = async (item: PriceBookItem) => {
    if (!priceBookId) return;

    await updateItemMutation.mutateAsync({
      id: item.id,
      price_book_id: priceBookId,
      is_featured: !item.is_featured,
    });
  };

  const handleRemoveItem = async (item: PriceBookItem) => {
    if (!priceBookId) return;

    await removeItemMutation.mutateAsync({
      id: item.id,
      price_book_id: priceBookId,
    });
  };

  const handleBulkAdd = async (skuIds: string[]) => {
    if (!priceBookId) return;

    await bulkAddMutation.mutateAsync({
      price_book_id: priceBookId,
      sku_ids: skuIds,
    });

    setShowBulkAdd(false);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      setValidationError('Name is required');
      return;
    }
    setValidationError('');

    try {
      const data = {
        name: name.trim(),
        code: code.trim() || null,
        description: description.trim() || null,
        tags,
        is_active: isActive,
      };

      if (priceBookId) {
        // Update existing
        await updateMutation.mutateAsync({ id: priceBookId, ...data });
        onClose();
      } else {
        // Create new - stay in modal to add SKUs
        const result = await createMutation.mutateAsync(data);
        setPriceBookId(result.id);
        setActiveTab('items'); // Auto-switch to SKUs tab
      }
    } catch (error) {
      console.error('Error saving price book:', error);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  if (loadingBook) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-xl p-8">
          <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <BookOpen className="w-5 h-5 text-green-600" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900">
              {isEditing ? 'Edit Price Book' : 'New Price Book'}
            </h2>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 px-6">
          <button
            onClick={() => setActiveTab('info')}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'info'
                ? 'border-green-500 text-green-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Book Info
          </button>
          <button
            onClick={() => setActiveTab('items')}
            disabled={!isEditing}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'items'
                ? 'border-green-500 text-green-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            } ${!isEditing ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            SKUs ({fullPriceBook?.items?.length || 0})
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'info' ? (
            <div className="space-y-6">
              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      if (validationError) setValidationError('');
                    }}
                    placeholder="e.g., Builder Fence Products"
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 ${
                      validationError ? 'border-red-300 bg-red-50' : 'border-gray-200'
                    }`}
                  />
                  {validationError && (
                    <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
                      <AlertCircle className="w-4 h-4" />
                      {validationError}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Code</label>
                  <input
                    type="text"
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    placeholder="e.g., BLD-FENCE"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  placeholder="Optional description..."
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500"
                />
              </div>

              {/* Tags */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Tags</label>
                <div className="flex items-center gap-2 flex-wrap mb-2">
                  {tags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded-full text-sm"
                    >
                      {tag}
                      <button
                        onClick={() => handleRemoveTag(tag)}
                        className="p-0.5 hover:bg-green-200 rounded-full"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
                    placeholder="Add a tag..."
                    className="flex-1 px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500"
                  />
                  <button
                    onClick={handleAddTag}
                    disabled={!tagInput.trim()}
                    className="px-4 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 disabled:opacity-50"
                  >
                    Add
                  </button>
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  Use tags like: builders, fence, deck, residential, austin
                </p>
              </div>

              {/* Advanced Options */}
              <div>
                <button
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-800"
                >
                  {showAdvanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  Advanced Options
                </button>
                {showAdvanced && (
                  <div className="mt-3 space-y-3 pl-6">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isActive}
                        onChange={(e) => setIsActive(e.target.checked)}
                        className="w-4 h-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
                      />
                      <span className="text-sm text-gray-700">Active (can be assigned to clients)</span>
                    </label>
                  </div>
                )}
              </div>

              {/* Save info notice */}
              {!priceBookId && (
                <div className="bg-blue-50 text-blue-700 px-4 py-3 rounded-lg text-sm">
                  <strong>Note:</strong> Click "Create Price Book" to save, then you'll be able to add SKUs.
                </div>
              )}
              {priceBookId && !initialPriceBook && (
                <div className="bg-green-50 text-green-700 px-4 py-3 rounded-lg text-sm">
                  <strong>Success!</strong> Price Book created. You can now add SKUs in the "SKUs" tab above.
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {/* SKU Search + Bulk Add */}
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={skuSearch}
                    onChange={(e) => {
                      setSkuSearch(e.target.value);
                      setShowSkuDropdown(true);
                    }}
                    onFocus={() => setShowSkuDropdown(true)}
                    placeholder="Search SKUs to add..."
                    className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500"
                  />
                </div>
                <button
                  onClick={() => setShowBulkAdd(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200"
                >
                  <Plus className="w-4 h-4" />
                  Bulk Add
                </button>
              </div>

              {/* SKU Dropdown */}
              {showSkuDropdown && skuCatalog && skuCatalog.length > 0 && (
                <div className="relative">
                  <div className="absolute top-0 left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg z-10 max-h-60 overflow-y-auto">
                    {skuCatalog.map((sku) => (
                      <button
                        key={sku.id}
                        onClick={() => handleAddSku(sku)}
                        disabled={addItemMutation.isPending}
                        className="w-full flex items-center justify-between px-4 py-2 text-left hover:bg-gray-50"
                      >
                        <div>
                          <div className="font-medium text-gray-900">{sku.sku}</div>
                          <div className="text-sm text-gray-500">{sku.description}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-medium text-gray-900">
                            ${sku.sell_price?.toFixed(2) || '0.00'}
                          </div>
                          <div className="text-xs text-gray-500">{sku.unit}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Click outside to close dropdown */}
              {showSkuDropdown && (
                <div
                  className="fixed inset-0 z-0"
                  onClick={() => setShowSkuDropdown(false)}
                />
              )}

              {/* Items Table */}
              {!fullPriceBook?.items || fullPriceBook.items.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 rounded-lg">
                  <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900">No SKUs added yet</h3>
                  <p className="text-gray-500 mt-1">Search or bulk add SKUs to this price book</p>
                </div>
              ) : (
                <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">SKU</th>
                        <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Description</th>
                        <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Price</th>
                        <th className="text-center px-4 py-3 text-sm font-medium text-gray-600">Featured</th>
                        <th className="w-12"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {fullPriceBook.items.map((item) => (
                        <tr key={item.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-medium text-gray-900">
                            {item.sku?.sku || item.sku_id}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600 max-w-[300px] truncate">
                            {item.sku?.description || '-'}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            ${item.sku?.sell_price?.toFixed(2) || '0.00'}/{item.sku?.unit || 'EA'}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <button
                              onClick={() => handleToggleFeatured(item)}
                              disabled={updateItemMutation.isPending}
                              className={`p-1 rounded transition-colors ${
                                item.is_featured
                                  ? 'text-yellow-500 hover:text-yellow-600'
                                  : 'text-gray-300 hover:text-yellow-500'
                              }`}
                            >
                              <Star className="w-5 h-5" fill={item.is_featured ? 'currentColor' : 'none'} />
                            </button>
                          </td>
                          <td className="px-4 py-3">
                            <button
                              onClick={() => handleRemoveItem(item)}
                              disabled={removeItemMutation.isPending}
                              className="p-1 text-gray-400 hover:text-red-500"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 hover:text-gray-800"
          >
            {priceBookId ? 'Close' : 'Cancel'}
          </button>
          {!priceBookId ? (
            <button
              onClick={handleSave}
              disabled={isPending || !name.trim()}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {isPending ? 'Creating...' : 'Create Price Book'}
            </button>
          ) : (
            <button
              onClick={handleSave}
              disabled={isPending || !name.trim()}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {isPending ? 'Saving...' : 'Save & Close'}
            </button>
          )}
        </div>
      </div>

      {/* Bulk Add Modal */}
      {showBulkAdd && priceBookId && (
        <BulkAddSkusModal
          priceBookId={priceBookId}
          priceBookName={name}
          existingSkuIds={fullPriceBook?.items?.map(i => i.sku_id) || []}
          onAdd={handleBulkAdd}
          onClose={() => setShowBulkAdd(false)}
        />
      )}
    </div>
  );
}
