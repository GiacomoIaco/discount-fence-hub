import { useState, useMemo } from 'react';
import { X, TrendingUp, DollarSign, Star, Plus, Edit2, Trash2, Calendar } from 'lucide-react';
import {
  useWeeklyMetricsQuery,
  useUpsertWeeklyMetrics,
  useDeleteWeeklyMetrics,
  getCurrentWeekEnding,
  getISOWeekNumber,
  formatWeekEnding,
  useYTDTotalQuery,
} from '../hooks/useWeeklyMetricsQuery';
import type { WeeklyInitiativeMetrics, CreateWeeklyMetricsInput } from '../lib/leadership';
import { formatMetricValue } from '../lib/leadership';

interface WeeklyMetricsProps {
  initiativeId: string;
  initiativeTitle: string;
  onClose: () => void;
}

export default function WeeklyMetrics({ initiativeId, initiativeTitle, onClose }: WeeklyMetricsProps) {
  const currentYear = new Date().getFullYear();
  const currentWeekEnding = getCurrentWeekEnding();

  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedWeekEnding, setSelectedWeekEnding] = useState(currentWeekEnding);

  const { data: metrics } = useWeeklyMetricsQuery(initiativeId);
  const upsertMetrics = useUpsertWeeklyMetrics();
  const deleteMetrics = useDeleteWeeklyMetrics();

  // YTD totals
  const { data: ytdRevenue } = useYTDTotalQuery(initiativeId, 'revenue_booked', currentYear);
  const { data: ytdCosts } = useYTDTotalQuery(initiativeId, 'costs_impact', currentYear);

  const [formData, setFormData] = useState<Partial<CreateWeeklyMetricsInput>>({
    initiative_id: initiativeId,
    week_ending: selectedWeekEnding,
    year: new Date(selectedWeekEnding).getFullYear(),
    week_number: getISOWeekNumber(new Date(selectedWeekEnding)),
    revenue_booked: undefined,
    costs_impact: undefined,
    customer_satisfaction: undefined,
    accomplishments: '',
    blockers: '',
  });

  // Get metrics for selected week
  const selectedWeekMetrics = useMemo(() => {
    return metrics?.find(m => m.week_ending === selectedWeekEnding);
  }, [metrics, selectedWeekEnding]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      // Clean form data - convert empty strings to undefined
      const cleanedData: CreateWeeklyMetricsInput = {
        initiative_id: initiativeId,
        week_ending: selectedWeekEnding,
        year: new Date(selectedWeekEnding).getFullYear(),
        week_number: getISOWeekNumber(new Date(selectedWeekEnding)),
        revenue_booked: formData.revenue_booked,
        costs_impact: formData.costs_impact,
        customer_satisfaction: formData.customer_satisfaction,
        accomplishments: formData.accomplishments?.trim() || undefined,
        blockers: formData.blockers?.trim() || undefined,
      };

      await upsertMetrics.mutateAsync(cleanedData);

      setIsAdding(false);
      setEditingId(null);
      resetForm();
    } catch (error) {
      console.error('Failed to save weekly metrics:', error);
    }
  };

  const handleEdit = (metric: WeeklyInitiativeMetrics) => {
    setSelectedWeekEnding(metric.week_ending);
    setFormData({
      initiative_id: metric.initiative_id,
      week_ending: metric.week_ending,
      year: metric.year,
      week_number: metric.week_number,
      revenue_booked: metric.revenue_booked || undefined,
      costs_impact: metric.costs_impact || undefined,
      customer_satisfaction: metric.customer_satisfaction || undefined,
      accomplishments: metric.accomplishments || '',
      blockers: metric.blockers || '',
    });
    setEditingId(metric.id);
    setIsAdding(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this week\'s metrics?')) return;

    try {
      await deleteMetrics.mutateAsync(id);
    } catch (error) {
      console.error('Failed to delete metrics:', error);
    }
  };

  const resetForm = () => {
    setFormData({
      initiative_id: initiativeId,
      week_ending: selectedWeekEnding,
      year: new Date(selectedWeekEnding).getFullYear(),
      week_number: getISOWeekNumber(new Date(selectedWeekEnding)),
      revenue_booked: undefined,
      costs_impact: undefined,
      customer_satisfaction: undefined,
      accomplishments: '',
      blockers: '',
    });
  };

  const handleCancel = () => {
    setIsAdding(false);
    setEditingId(null);
    resetForm();
  };

  // Generate last 12 weeks for selection
  const weekOptions = useMemo(() => {
    const weeks = [];
    for (let i = 0; i < 12; i++) {
      const date = new Date();
      const dayOfWeek = date.getDay();
      const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      const monday = new Date(date);
      monday.setDate(date.getDate() + diff - (i * 7));
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);

      const weekEnding = sunday.toISOString().split('T')[0];
      weeks.push({
        value: weekEnding,
        label: formatWeekEnding(weekEnding),
      });
    }
    return weeks;
  }, []);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Weekly Metrics</h2>
            <p className="text-sm text-gray-600 mt-1">{initiativeTitle}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* YTD Summary */}
          <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-6 mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              {currentYear} Year-to-Date Totals
            </h3>
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-white rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <DollarSign className="w-5 h-5 text-green-600" />
                  <span className="text-sm text-gray-600">Revenue Booked</span>
                </div>
                <div className="text-2xl font-bold text-green-600">
                  {formatMetricValue(ytdRevenue, '$')}
                </div>
              </div>
              <div className="bg-white rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="w-5 h-5 text-blue-600" />
                  <span className="text-sm text-gray-600">Cost Impact</span>
                </div>
                <div className="text-2xl font-bold text-blue-600">
                  {formatMetricValue(ytdCosts, '$')}
                </div>
              </div>
              <div className="bg-white rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Calendar className="w-5 h-5 text-purple-600" />
                  <span className="text-sm text-gray-600">Weeks Tracked</span>
                </div>
                <div className="text-2xl font-bold text-purple-600">
                  {metrics?.length || 0}
                </div>
              </div>
            </div>
          </div>

          {/* Week Selector & Add Button */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <label className="text-sm font-medium text-gray-700">Select Week:</label>
              <select
                value={selectedWeekEnding}
                onChange={(e) => {
                  setSelectedWeekEnding(e.target.value);
                  setFormData({
                    ...formData,
                    week_ending: e.target.value,
                    year: new Date(e.target.value).getFullYear(),
                    week_number: getISOWeekNumber(new Date(e.target.value)),
                  });
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {weekOptions.map(week => (
                  <option key={week.value} value={week.value}>
                    {week.label}
                  </option>
                ))}
              </select>
            </div>

            {!isAdding && !selectedWeekMetrics && (
              <button
                onClick={() => setIsAdding(true)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add Metrics for This Week
              </button>
            )}

            {!isAdding && selectedWeekMetrics && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleEdit(selectedWeekMetrics)}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors"
                >
                  <Edit2 className="w-4 h-4" />
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(selectedWeekMetrics.id)}
                  className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-700 rounded-lg hover:bg-red-100 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete
                </button>
              </div>
            )}
          </div>

          {/* Metrics Display or Form */}
          {isAdding ? (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h4 className="text-lg font-semibold text-gray-900 mb-4">
                  {editingId ? 'Edit' : 'Add'} Metrics for {formatWeekEnding(selectedWeekEnding)}
                </h4>

                <div className="grid grid-cols-3 gap-4 mb-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Revenue Booked
                    </label>
                    <input
                      type="number"
                      value={formData.revenue_booked || ''}
                      onChange={(e) => setFormData({
                        ...formData,
                        revenue_booked: e.target.value ? Number(e.target.value) : undefined
                      })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="$550,000"
                      step="0.01"
                    />
                    <p className="text-xs text-gray-500 mt-1">e.g., 550000</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Cost Impact
                    </label>
                    <input
                      type="number"
                      value={formData.costs_impact || ''}
                      onChange={(e) => setFormData({
                        ...formData,
                        costs_impact: e.target.value ? Number(e.target.value) : undefined
                      })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="-$50,000"
                      step="0.01"
                    />
                    <p className="text-xs text-gray-500 mt-1">Negative = savings</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Customer Satisfaction
                    </label>
                    <input
                      type="number"
                      value={formData.customer_satisfaction || ''}
                      onChange={(e) => setFormData({
                        ...formData,
                        customer_satisfaction: e.target.value ? Number(e.target.value) : undefined
                      })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="4.8"
                      step="0.1"
                      min="0"
                      max="5"
                    />
                    <p className="text-xs text-gray-500 mt-1">0 - 5 rating</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Accomplishments
                    </label>
                    <textarea
                      value={formData.accomplishments}
                      onChange={(e) => setFormData({ ...formData, accomplishments: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      rows={3}
                      placeholder="e.g., Signed Toll Brothers for 3 communities (Austin & Houston)"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Blockers
                    </label>
                    <textarea
                      value={formData.blockers}
                      onChange={(e) => setFormData({ ...formData, blockers: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      rows={2}
                      placeholder="Any blockers or issues encountered this week..."
                    />
                  </div>
                </div>

                <div className="flex items-center gap-3 mt-6">
                  <button
                    type="submit"
                    disabled={upsertMetrics.isPending}
                    className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50"
                  >
                    {upsertMetrics.isPending ? 'Saving...' : editingId ? 'Update Metrics' : 'Save Metrics'}
                  </button>
                  <button
                    type="button"
                    onClick={handleCancel}
                    className="flex-1 bg-gray-100 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-200 transition-colors font-medium"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </form>
          ) : selectedWeekMetrics ? (
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h4 className="text-lg font-semibold text-gray-900 mb-4">
                {formatWeekEnding(selectedWeekEnding)}
              </h4>

              <div className="grid grid-cols-3 gap-4 mb-6">
                {selectedWeekMetrics.revenue_booked !== null && selectedWeekMetrics.revenue_booked !== undefined && (
                  <div className="bg-green-50 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <DollarSign className="w-4 h-4 text-green-600" />
                      <span className="text-sm text-gray-600">Revenue Booked</span>
                    </div>
                    <div className="text-xl font-bold text-green-600">
                      {formatMetricValue(selectedWeekMetrics.revenue_booked, '$')}
                    </div>
                  </div>
                )}

                {selectedWeekMetrics.costs_impact !== null && selectedWeekMetrics.costs_impact !== undefined && (
                  <div className="bg-blue-50 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <TrendingUp className="w-4 h-4 text-blue-600" />
                      <span className="text-sm text-gray-600">Cost Impact</span>
                    </div>
                    <div className="text-xl font-bold text-blue-600">
                      {formatMetricValue(selectedWeekMetrics.costs_impact, '$')}
                    </div>
                  </div>
                )}

                {selectedWeekMetrics.customer_satisfaction !== null && selectedWeekMetrics.customer_satisfaction !== undefined && (
                  <div className="bg-purple-50 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Star className="w-4 h-4 text-purple-600" />
                      <span className="text-sm text-gray-600">Satisfaction</span>
                    </div>
                    <div className="text-xl font-bold text-purple-600">
                      {selectedWeekMetrics.customer_satisfaction.toFixed(1)} / 5.0
                    </div>
                  </div>
                )}
              </div>

              {selectedWeekMetrics.accomplishments && (
                <div className="mb-4">
                  <h5 className="text-sm font-semibold text-gray-700 mb-2">Accomplishments</h5>
                  <p className="text-gray-600 whitespace-pre-wrap">{selectedWeekMetrics.accomplishments}</p>
                </div>
              )}

              {selectedWeekMetrics.blockers && (
                <div>
                  <h5 className="text-sm font-semibold text-gray-700 mb-2">Blockers</h5>
                  <p className="text-red-600 whitespace-pre-wrap">{selectedWeekMetrics.blockers}</p>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-gray-50 rounded-lg border-2 border-dashed border-gray-300 p-12 text-center">
              <Calendar className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No metrics for this week</h3>
              <p className="text-gray-600 mb-4">
                Click "Add Metrics for This Week" to track your progress
              </p>
            </div>
          )}

          {/* Historical Metrics List */}
          {!isAdding && metrics && metrics.length > 0 && (
            <div className="mt-6">
              <h4 className="text-lg font-semibold text-gray-900 mb-4">Historical Metrics</h4>
              <div className="space-y-2">
                {metrics.slice(0, 5).map((metric) => (
                  <div
                    key={metric.id}
                    className={`flex items-center justify-between p-4 rounded-lg border cursor-pointer transition-colors ${
                      metric.week_ending === selectedWeekEnding
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                    onClick={() => setSelectedWeekEnding(metric.week_ending)}
                  >
                    <div className="flex-1">
                      <div className="font-medium text-gray-900">
                        {formatWeekEnding(metric.week_ending)}
                      </div>
                      <div className="flex items-center gap-4 mt-1 text-sm text-gray-600">
                        {metric.revenue_booked && (
                          <span>Revenue: {formatMetricValue(metric.revenue_booked, '$')}</span>
                        )}
                        {metric.costs_impact && (
                          <span>Costs: {formatMetricValue(metric.costs_impact, '$')}</span>
                        )}
                        {metric.customer_satisfaction && (
                          <span>Satisfaction: {metric.customer_satisfaction.toFixed(1)}</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            className="w-full bg-gray-200 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-300 transition-colors font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
