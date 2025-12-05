import { useQuery } from '@tanstack/react-query';
import { X, History, TrendingUp, TrendingDown, Minus, Clock, Calendar, Tag } from 'lucide-react';
import { supabase } from '../../../lib/supabase';

interface MaterialPriceHistory {
  id: string;
  material_id: string;
  old_price: number | null;
  new_price: number;
  price_change: number;
  price_change_percent: number | null;
  changed_at: string;
  changed_by: string | null;
  change_reason: string | null;
  change_source: string;
  material_code: string | null;
  material_name: string | null;
}

interface LaborRateHistory {
  id: string;
  labor_rate_id: string;
  labor_code_id: string | null;
  business_unit_id: string | null;
  old_rate: number | null;
  new_rate: number;
  rate_change: number;
  rate_change_percent: number | null;
  changed_at: string;
  changed_by: string | null;
  change_reason: string | null;
  change_source: string;
  labor_code: string | null;
  labor_description: string | null;
  business_unit_code: string | null;
}

type HistoryType = 'material' | 'labor';

interface PriceHistoryModalProps {
  type: HistoryType;
  itemId: string;
  itemName: string;
  itemCode: string;
  currentPrice: number;
  onClose: () => void;
}

export default function PriceHistoryModal({
  type,
  itemId,
  itemName,
  itemCode,
  currentPrice,
  onClose,
}: PriceHistoryModalProps) {
  const limit = 20;

  // Fetch history based on type
  const { data: history = [], isLoading } = useQuery({
    queryKey: ['price-history', type, itemId],
    queryFn: async () => {
      if (type === 'material') {
        const { data, error } = await supabase
          .from('material_price_history')
          .select('*')
          .eq('material_id', itemId)
          .order('changed_at', { ascending: false })
          .limit(limit);

        if (error) throw error;
        return data as MaterialPriceHistory[];
      } else {
        const { data, error } = await supabase
          .from('labor_rate_history')
          .select('*')
          .eq('labor_rate_id', itemId)
          .order('changed_at', { ascending: false })
          .limit(limit);

        if (error) throw error;
        return data as LaborRateHistory[];
      }
    },
  });

  // Format date
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Format relative time
  const formatRelativeTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
    return `${Math.floor(diffDays / 365)} years ago`;
  };

  // Get change icon
  const getChangeIcon = (change: number) => {
    if (change > 0) return <TrendingUp className="w-4 h-4 text-red-500" />;
    if (change < 0) return <TrendingDown className="w-4 h-4 text-green-500" />;
    return <Minus className="w-4 h-4 text-gray-400" />;
  };

  // Get change color class
  const getChangeColorClass = (change: number) => {
    if (change > 0) return 'text-red-600 bg-red-50';
    if (change < 0) return 'text-green-600 bg-green-50';
    return 'text-gray-500 bg-gray-50';
  };

  // Get source badge
  const getSourceBadge = (source: string) => {
    const colors: Record<string, string> = {
      manual: 'bg-blue-100 text-blue-700',
      import: 'bg-purple-100 text-purple-700',
      bulk_update: 'bg-orange-100 text-orange-700',
      system: 'bg-gray-100 text-gray-600',
    };
    return colors[source] || colors.system;
  };

  // Calculate stats
  const stats = {
    totalChanges: history.length,
    avgChange: history.length > 0
      ? history.reduce((sum, h) => {
          const change = type === 'material'
            ? (h as MaterialPriceHistory).price_change
            : (h as LaborRateHistory).rate_change;
          return sum + (change || 0);
        }, 0) / history.length
      : 0,
    lastChange: history.length > 0 ? history[0] : null,
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <History className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Price History</h2>
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <span className="font-mono">{itemCode}</span>
                <span>·</span>
                <span className="truncate max-w-[300px]">{itemName}</span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Current Price & Stats */}
        <div className="px-6 py-3 bg-gray-50 border-b border-gray-200 grid grid-cols-3 gap-4">
          <div>
            <div className="text-xs text-gray-500 uppercase tracking-wider">Current Price</div>
            <div className="text-2xl font-bold text-gray-900">${currentPrice.toFixed(2)}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500 uppercase tracking-wider">Total Changes</div>
            <div className="text-2xl font-bold text-blue-600">{stats.totalChanges}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500 uppercase tracking-wider">Avg Change</div>
            <div className={`text-2xl font-bold ${stats.avgChange > 0 ? 'text-red-600' : stats.avgChange < 0 ? 'text-green-600' : 'text-gray-600'}`}>
              {stats.avgChange > 0 ? '+' : ''}{stats.avgChange.toFixed(2)}
            </div>
          </div>
        </div>

        {/* Timeline */}
        <div className="flex-1 overflow-y-auto p-4">
          {isLoading ? (
            <div className="flex items-center justify-center h-48">
              <div className="text-center">
                <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                <p className="text-sm text-gray-600">Loading history...</p>
              </div>
            </div>
          ) : history.length === 0 ? (
            <div className="flex items-center justify-center h-48">
              <div className="text-center">
                <Clock className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-600 font-medium">No price changes recorded</p>
                <p className="text-sm text-gray-500 mt-1">
                  Changes will appear here when prices are updated
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-0">
              {/* Current price marker */}
              <div className="flex items-center gap-4 pb-4">
                <div className="flex flex-col items-center">
                  <div className="w-4 h-4 rounded-full bg-green-500 ring-4 ring-green-100"></div>
                  <div className="w-0.5 h-8 bg-gray-200"></div>
                </div>
                <div className="flex-1 bg-green-50 border border-green-200 rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-green-800">Current Price</span>
                    <span className="text-lg font-bold text-green-700">${currentPrice.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* History entries */}
              {history.map((entry, index) => {
                const isMaterial = type === 'material';
                const h = entry as (MaterialPriceHistory | LaborRateHistory);
                const oldPrice = isMaterial ? (h as MaterialPriceHistory).old_price : (h as LaborRateHistory).old_rate;
                const newPrice = isMaterial ? (h as MaterialPriceHistory).new_price : (h as LaborRateHistory).new_rate;
                const change = isMaterial ? (h as MaterialPriceHistory).price_change : (h as LaborRateHistory).rate_change;
                const changePercent = isMaterial ? (h as MaterialPriceHistory).price_change_percent : (h as LaborRateHistory).rate_change_percent;

                return (
                  <div key={h.id} className="flex items-start gap-4">
                    <div className="flex flex-col items-center">
                      <div className="w-3 h-3 rounded-full bg-gray-300"></div>
                      {index < history.length - 1 && (
                        <div className="w-0.5 flex-1 bg-gray-200 min-h-[60px]"></div>
                      )}
                    </div>
                    <div className="flex-1 pb-4">
                      <div className="bg-white border border-gray-200 rounded-lg p-3 hover:shadow-sm transition-shadow">
                        {/* Header row */}
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            {getChangeIcon(change)}
                            <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${getChangeColorClass(change)}`}>
                              {change > 0 ? '+' : ''}{change.toFixed(2)}
                              {changePercent !== null && ` (${changePercent > 0 ? '+' : ''}${changePercent.toFixed(1)}%)`}
                            </span>
                          </div>
                          <span className={`px-2 py-0.5 text-[10px] font-medium rounded-full ${getSourceBadge(h.change_source)}`}>
                            {h.change_source}
                          </span>
                        </div>

                        {/* Price change */}
                        <div className="flex items-center gap-3 text-sm">
                          <span className="text-gray-500">${oldPrice?.toFixed(2) ?? '—'}</span>
                          <span className="text-gray-400">→</span>
                          <span className="font-semibold text-gray-900">${newPrice.toFixed(2)}</span>
                        </div>

                        {/* Metadata */}
                        <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                          <div className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            <span title={formatDate(h.changed_at)}>{formatRelativeTime(h.changed_at)}</span>
                          </div>
                          {h.change_reason && (
                            <div className="flex items-center gap-1">
                              <Tag className="w-3 h-3" />
                              <span className="truncate max-w-[150px]">{h.change_reason}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-gray-200 bg-gray-50">
          <div className="text-xs text-gray-500">
            Showing {history.length} of {stats.totalChanges} changes
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// Simple History Button component for use in tables
export function HistoryButton({
  onClick,
  hasHistory = false,
}: {
  onClick: () => void;
  hasHistory?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`p-1.5 rounded transition-colors ${
        hasHistory
          ? 'text-blue-500 hover:text-blue-700 hover:bg-blue-50'
          : 'text-gray-300 hover:text-gray-500 hover:bg-gray-50'
      }`}
      title="View price history"
    >
      <History className="w-4 h-4" />
    </button>
  );
}
