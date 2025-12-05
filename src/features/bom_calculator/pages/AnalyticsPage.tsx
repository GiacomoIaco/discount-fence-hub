import { useQuery } from '@tanstack/react-query';
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Package,
  DollarSign,
  Clock,
  CheckCircle,
  AlertTriangle,
  Calendar,
  Activity
} from 'lucide-react';
import { supabase } from '../../../lib/supabase';

interface SKUStats {
  total: number;
  draft: number;
  complete: number;
  byType: {
    wood_vertical: { draft: number; complete: number };
    wood_horizontal: { draft: number; complete: number };
    iron: { draft: number; complete: number };
    custom: { draft: number; complete: number };
  };
}

interface MaterialStats {
  total: number;
  active: number;
  avgCost: number;
  byCategory: Record<string, number>;
}

export default function AnalyticsPage() {
  // Fetch price change summary
  const { data: priceChanges = [] } = useQuery({
    queryKey: ['analytics-price-changes'],
    queryFn: async () => {
      // Get material price changes by month
      const { data: materialChanges } = await supabase
        .from('material_price_history')
        .select('id, price_change_percent, changed_at')
        .order('changed_at', { ascending: false });

      // Get labor rate changes by month
      const { data: laborChanges } = await supabase
        .from('labor_rate_history')
        .select('id, rate_change_percent, changed_at')
        .order('changed_at', { ascending: false });

      return {
        material: materialChanges || [],
        labor: laborChanges || [],
      };
    },
  });

  // Fetch SKU stats
  const { data: skuStats } = useQuery({
    queryKey: ['analytics-sku-stats'],
    queryFn: async () => {
      const [wv, wh, ir, custom] = await Promise.all([
        supabase.from('wood_vertical_products').select('id, sku_status'),
        supabase.from('wood_horizontal_products').select('id, sku_status'),
        supabase.from('iron_products').select('id, sku_status'),
        supabase.from('custom_products').select('id, sku_status'),
      ]);

      const allSKUs = [
        ...(wv.data?.map(p => ({ ...p, type: 'wood_vertical' })) || []),
        ...(wh.data?.map(p => ({ ...p, type: 'wood_horizontal' })) || []),
        ...(ir.data?.map(p => ({ ...p, type: 'iron' })) || []),
        ...(custom.data?.map(p => ({ ...p, type: 'custom' })) || []),
      ];

      const stats: SKUStats = {
        total: allSKUs.length,
        draft: allSKUs.filter(s => s.sku_status === 'draft').length,
        complete: allSKUs.filter(s => s.sku_status === 'complete').length,
        byType: {
          wood_vertical: {
            draft: allSKUs.filter(s => s.type === 'wood_vertical' && s.sku_status === 'draft').length,
            complete: allSKUs.filter(s => s.type === 'wood_vertical' && s.sku_status === 'complete').length,
          },
          wood_horizontal: {
            draft: allSKUs.filter(s => s.type === 'wood_horizontal' && s.sku_status === 'draft').length,
            complete: allSKUs.filter(s => s.type === 'wood_horizontal' && s.sku_status === 'complete').length,
          },
          iron: {
            draft: allSKUs.filter(s => s.type === 'iron' && s.sku_status === 'draft').length,
            complete: allSKUs.filter(s => s.type === 'iron' && s.sku_status === 'complete').length,
          },
          custom: {
            draft: allSKUs.filter(s => s.type === 'custom' && s.sku_status === 'draft').length,
            complete: allSKUs.filter(s => s.type === 'custom' && s.sku_status === 'complete').length,
          },
        },
      };

      return stats;
    },
  });

  // Fetch material stats
  const { data: materialStats } = useQuery({
    queryKey: ['analytics-material-stats'],
    queryFn: async () => {
      const { data } = await supabase
        .from('materials')
        .select('id, status, unit_cost, category');

      if (!data) return null;

      const byCategory: Record<string, number> = {};
      data.forEach(m => {
        byCategory[m.category] = (byCategory[m.category] || 0) + 1;
      });

      return {
        total: data.length,
        active: data.filter(m => m.status === 'Active').length,
        avgCost: data.reduce((sum, m) => sum + m.unit_cost, 0) / data.length,
        byCategory,
      } as MaterialStats;
    },
  });

  // Fetch labor stats
  const { data: laborStats } = useQuery({
    queryKey: ['analytics-labor-stats'],
    queryFn: async () => {
      const { data: codes } = await supabase.from('labor_codes').select('id');
      const { data: rates } = await supabase.from('labor_rates').select('id, rate');
      const { data: bus } = await supabase.from('business_units').select('id');

      return {
        totalCodes: codes?.length || 0,
        totalRates: rates?.length || 0,
        avgRate: rates && rates.length > 0
          ? rates.reduce((sum, r) => sum + r.rate, 0) / rates.length
          : 0,
        businessUnits: bus?.length || 0,
      };
    },
  });

  // Fetch recent activity
  const { data: recentActivity = [] } = useQuery({
    queryKey: ['analytics-recent-activity'],
    queryFn: async () => {
      const activities: Array<{
        type: 'material' | 'labor';
        description: string;
        date: string;
        change: number;
      }> = [];

      // Get recent material changes
      const { data: materialChanges } = await supabase
        .from('material_price_history')
        .select('material_code, material_name, price_change, changed_at')
        .order('changed_at', { ascending: false })
        .limit(5);

      materialChanges?.forEach(c => {
        activities.push({
          type: 'material',
          description: `${c.material_code || 'Material'} price changed`,
          date: c.changed_at,
          change: c.price_change,
        });
      });

      // Get recent labor changes
      const { data: laborChanges } = await supabase
        .from('labor_rate_history')
        .select('labor_code, business_unit_code, rate_change, changed_at')
        .order('changed_at', { ascending: false })
        .limit(5);

      laborChanges?.forEach(c => {
        activities.push({
          type: 'labor',
          description: `${c.labor_code || 'Labor'} (${c.business_unit_code}) rate changed`,
          date: c.changed_at,
          change: c.rate_change,
        });
      });

      // Sort by date
      return activities.sort((a, b) =>
        new Date(b.date).getTime() - new Date(a.date).getTime()
      ).slice(0, 10);
    },
  });

  // Calculate SKU completion percentage
  const skuCompletionPercent = skuStats
    ? Math.round((skuStats.complete / skuStats.total) * 100) || 0
    : 0;

  return (
    <div className="flex-1 flex flex-col bg-gray-50 overflow-hidden h-full">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3">
        <div className="flex items-center gap-3">
          <BarChart3 className="w-5 h-5 text-indigo-600" />
          <div>
            <h1 className="text-lg font-bold text-gray-900">Analytics</h1>
            <p className="text-xs text-gray-500">BOM Hub overview and statistics</p>
          </div>
        </div>
      </div>

      {/* Dashboard Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Top Stats Cards */}
        <div className="grid grid-cols-4 gap-4">
          {/* SKU Completion */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-gray-500 uppercase">SKU Progress</span>
              <Package className="w-4 h-4 text-blue-500" />
            </div>
            <div className="text-2xl font-bold text-gray-900">{skuCompletionPercent}%</div>
            <div className="mt-2 h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 transition-all duration-500"
                style={{ width: `${skuCompletionPercent}%` }}
              />
            </div>
            <div className="mt-1 text-xs text-gray-500">
              {skuStats?.complete || 0} / {skuStats?.total || 0} complete
            </div>
          </div>

          {/* Materials */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-gray-500 uppercase">Materials</span>
              <DollarSign className="w-4 h-4 text-green-500" />
            </div>
            <div className="text-2xl font-bold text-gray-900">{materialStats?.total || 0}</div>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs text-green-600">{materialStats?.active || 0} active</span>
              <span className="text-xs text-gray-300">|</span>
              <span className="text-xs text-gray-500">
                avg ${materialStats?.avgCost.toFixed(2) || '0.00'}
              </span>
            </div>
          </div>

          {/* Labor Codes */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-gray-500 uppercase">Labor Codes</span>
              <Clock className="w-4 h-4 text-purple-500" />
            </div>
            <div className="text-2xl font-bold text-gray-900">{laborStats?.totalCodes || 0}</div>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs text-purple-600">{laborStats?.totalRates || 0} rates</span>
              <span className="text-xs text-gray-300">|</span>
              <span className="text-xs text-gray-500">
                avg ${laborStats?.avgRate.toFixed(2) || '0.00'}
              </span>
            </div>
          </div>

          {/* Price Changes */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-gray-500 uppercase">Price Changes</span>
              <Activity className="w-4 h-4 text-orange-500" />
            </div>
            <div className="text-2xl font-bold text-gray-900">
              {(priceChanges as any)?.material?.length + (priceChanges as any)?.labor?.length || 0}
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs text-blue-600">{(priceChanges as any)?.material?.length || 0} materials</span>
              <span className="text-xs text-gray-300">|</span>
              <span className="text-xs text-purple-600">{(priceChanges as any)?.labor?.length || 0} labor</span>
            </div>
          </div>
        </div>

        {/* Middle Row */}
        <div className="grid grid-cols-3 gap-4">
          {/* SKU Breakdown by Type */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <Package className="w-4 h-4 text-blue-500" />
              SKU Status by Type
            </h3>
            <div className="space-y-3">
              {[
                { key: 'wood_vertical', label: 'Wood Vertical', color: 'bg-green-500' },
                { key: 'wood_horizontal', label: 'Wood Horizontal', color: 'bg-blue-500' },
                { key: 'iron', label: 'Iron', color: 'bg-gray-500' },
                { key: 'custom', label: 'Custom', color: 'bg-purple-500' },
              ].map(type => {
                const data = skuStats?.byType[type.key as keyof typeof skuStats.byType];
                const total = (data?.draft || 0) + (data?.complete || 0);
                const percent = total > 0 ? Math.round((data?.complete || 0) / total * 100) : 100;
                return (
                  <div key={type.key}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-gray-600">{type.label}</span>
                      <span className="text-gray-500">{data?.complete || 0}/{total}</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${type.color} transition-all duration-500`}
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Materials by Category */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-green-500" />
              Materials by Category
            </h3>
            <div className="space-y-2">
              {materialStats?.byCategory && Object.entries(materialStats.byCategory)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 6)
                .map(([category, count]) => (
                  <div key={category} className="flex items-center justify-between text-xs">
                    <span className="text-gray-600 truncate max-w-[150px]">{category}</span>
                    <span className="font-medium text-gray-900">{count}</span>
                  </div>
                ))}
            </div>
          </div>

          {/* Recent Activity */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <Activity className="w-4 h-4 text-orange-500" />
              Recent Price Changes
            </h3>
            {recentActivity.length === 0 ? (
              <div className="text-center py-6">
                <Clock className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                <p className="text-xs text-gray-500">No recent changes</p>
              </div>
            ) : (
              <div className="space-y-2">
                {recentActivity.slice(0, 5).map((activity, idx) => (
                  <div key={idx} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      {activity.change > 0 ? (
                        <TrendingUp className="w-3 h-3 text-red-500" />
                      ) : activity.change < 0 ? (
                        <TrendingDown className="w-3 h-3 text-green-500" />
                      ) : (
                        <Activity className="w-3 h-3 text-gray-400" />
                      )}
                      <span className="text-gray-600 truncate max-w-[120px]">{activity.description}</span>
                    </div>
                    <span className={`font-medium ${
                      activity.change > 0 ? 'text-red-600' : activity.change < 0 ? 'text-green-600' : 'text-gray-500'
                    }`}>
                      {activity.change > 0 ? '+' : ''}{activity.change.toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Bottom Stats */}
        <div className="grid grid-cols-2 gap-4">
          {/* Draft SKUs Alert */}
          {skuStats && skuStats.draft > 0 && (
            <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-orange-500 mt-0.5" />
                <div>
                  <h4 className="text-sm font-semibold text-orange-800">SKUs Pending Configuration</h4>
                  <p className="text-xs text-orange-600 mt-1">
                    {skuStats.draft} SKU{skuStats.draft !== 1 ? 's' : ''} imported but not yet configured.
                    Visit the SKU Queue to complete setup.
                  </p>
                  <div className="flex items-center gap-4 mt-3 text-xs">
                    {Object.entries(skuStats.byType).map(([type, data]) =>
                      data.draft > 0 && (
                        <span key={type} className="text-orange-700">
                          {type.replace('_', ' ')}: {data.draft}
                        </span>
                      )
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Complete Status */}
          {skuStats && skuStats.draft === 0 && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-green-500 mt-0.5" />
                <div>
                  <h4 className="text-sm font-semibold text-green-800">All SKUs Configured</h4>
                  <p className="text-xs text-green-600 mt-1">
                    All {skuStats.total} SKU{skuStats.total !== 1 ? 's' : ''} have been fully configured.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Quick Stats */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-blue-500" />
              Business Units
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-2xl font-bold text-gray-900">{laborStats?.businessUnits || 0}</div>
                <div className="text-xs text-gray-500">Active BUs</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-900">
                  {laborStats ? Math.round(laborStats.totalRates / laborStats.businessUnits) || 0 : 0}
                </div>
                <div className="text-xs text-gray-500">Avg rates per BU</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
