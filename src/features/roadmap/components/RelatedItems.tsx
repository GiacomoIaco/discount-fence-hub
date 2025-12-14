import { useState, useEffect, useMemo } from 'react';
import { Link2, Plus, X, Search, Loader2 } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { HUB_CONFIG, type HubKey } from '../RoadmapHub';
import { STATUS_CONFIG, type StatusType } from '../types';

// Lighter type for related items (only fields we need)
interface RelatedItemSummary {
  id: string;
  code: string;
  title: string;
  hub: string;
  status: StatusType;
}

interface RelatedItemsProps {
  currentItemId: string;
  relatedItemIds: string[];
  onRelatedItemsChange: (ids: string[]) => void;
  onItemClick?: (item: RelatedItemSummary) => void;
  readOnly?: boolean;
}

export default function RelatedItems({
  currentItemId,
  relatedItemIds,
  onRelatedItemsChange,
  onItemClick,
  readOnly = false,
}: RelatedItemsProps) {
  const [relatedItems, setRelatedItems] = useState<RelatedItemSummary[]>([]);
  const [allItems, setAllItems] = useState<RelatedItemSummary[]>([]);
  const [showPicker, setShowPicker] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);

  // Fetch related items details
  useEffect(() => {
    const fetchRelatedItems = async () => {
      if (relatedItemIds.length === 0) {
        setRelatedItems([]);
        return;
      }

      const { data, error } = await supabase
        .from('roadmap_items')
        .select('id, code, title, hub, status')
        .in('id', relatedItemIds);

      if (error) {
        console.error('Error fetching related items:', error);
      } else {
        setRelatedItems(data || []);
      }
    };

    fetchRelatedItems();
  }, [relatedItemIds]);

  // Fetch all items when picker opens
  const fetchAllItems = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('roadmap_items')
      .select('id, code, title, hub, status')
      .neq('id', currentItemId)
      .order('updated_at', { ascending: false })
      .limit(100);

    if (error) {
      console.error('Error fetching items:', error);
    } else {
      setAllItems(data || []);
    }
    setLoading(false);
  };

  const openPicker = () => {
    setShowPicker(true);
    fetchAllItems();
  };

  // Filter items by search query
  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return allItems;
    const query = searchQuery.toLowerCase();
    return allItems.filter(
      item =>
        item.code.toLowerCase().includes(query) ||
        item.title.toLowerCase().includes(query)
    );
  }, [allItems, searchQuery]);

  // Items not already related
  const availableItems = useMemo(() => {
    return filteredItems.filter(item => !relatedItemIds.includes(item.id));
  }, [filteredItems, relatedItemIds]);

  const addRelatedItem = (itemId: string) => {
    if (!relatedItemIds.includes(itemId)) {
      onRelatedItemsChange([...relatedItemIds, itemId]);
    }
  };

  const removeRelatedItem = (itemId: string) => {
    onRelatedItemsChange(relatedItemIds.filter(id => id !== itemId));
  };

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
          <Link2 className="w-4 h-4 text-gray-500" />
          Related Items
          {relatedItems.length > 0 && (
            <span className="text-xs text-gray-400">({relatedItems.length})</span>
          )}
        </label>
        {!readOnly && (
          <button
            type="button"
            onClick={openPicker}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            Link Item
          </button>
        )}
      </div>

      {/* Related items list */}
      {relatedItems.length > 0 ? (
        <div className="space-y-1.5">
          {relatedItems.map(item => {
            const hubConfig = HUB_CONFIG[item.hub as HubKey];
            const statusConfig = STATUS_CONFIG[item.status];
            return (
              <div
                key={item.id}
                className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg border border-gray-200 hover:border-gray-300 transition-colors group"
              >
                <span className={`text-xs font-mono px-1.5 py-0.5 rounded ${hubConfig?.bgLight || 'bg-gray-100'} ${hubConfig?.textColor || 'text-gray-600'}`}>
                  {item.code}
                </span>
                <span
                  className={`flex-1 text-sm text-gray-800 truncate ${onItemClick ? 'cursor-pointer hover:text-blue-600' : ''}`}
                  onClick={() => onItemClick?.(item)}
                  title={item.title}
                >
                  {item.title}
                </span>
                <span className={`text-xs px-1.5 py-0.5 rounded ${statusConfig.bgColor} ${statusConfig.color}`}>
                  {statusConfig.label}
                </span>
                {!readOnly && (
                  <button
                    type="button"
                    onClick={() => removeRelatedItem(item.id)}
                    className="p-1 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                    title="Remove link"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-sm text-gray-400 py-2">
          {readOnly ? 'No related items' : 'No related items. Link ideas to group similar features or dependencies.'}
        </p>
      )}

      {/* Picker Modal */}
      {showPicker && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[70vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h3 className="font-semibold text-gray-900">Link Related Item</h3>
              <button
                onClick={() => setShowPicker(false)}
                className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Search */}
            <div className="p-3 border-b border-gray-100">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by code or title..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  autoFocus
                />
              </div>
            </div>

            {/* Items list */}
            <div className="flex-1 overflow-auto p-2">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
                </div>
              ) : availableItems.length > 0 ? (
                <div className="space-y-1">
                  {availableItems.map(item => {
                    const hubConfig = HUB_CONFIG[item.hub as HubKey];
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          addRelatedItem(item.id);
                          setShowPicker(false);
                          setSearchQuery('');
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-blue-50 rounded-lg transition-colors"
                      >
                        <span className={`text-xs font-mono px-1.5 py-0.5 rounded ${hubConfig?.bgLight || 'bg-gray-100'} ${hubConfig?.textColor || 'text-gray-600'}`}>
                          {item.code}
                        </span>
                        <span className="flex-1 text-sm text-gray-800 truncate">
                          {item.title}
                        </span>
                        <Plus className="w-4 h-4 text-blue-500" />
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="text-center text-gray-400 py-8 text-sm">
                  {searchQuery ? 'No matching items found' : 'No items available to link'}
                </p>
              )}
            </div>

            {/* Footer */}
            <div className="p-3 border-t border-gray-200 bg-gray-50">
              <button
                onClick={() => setShowPicker(false)}
                className="w-full px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
