import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Activity,
  Package,
  AlertCircle
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';
import { supabase } from '../../../../lib/supabase';

type TimeFrame = '7d' | '30d' | '90d';

interface TopMover {
  material_id: string;
  material_code: string;
  material_name: string;
  category: string;
  current_price: number;
  change_count: number;
  total_change: number;
  avg_change_percent: number;
  last_change: string;
}

interface CategorySummary {
  category: string;
  material_count: number;
  avg_cost: number;
  changed_last_30d: number;
  total_change_30d: number;
}

interface PriceTrend {
  material_id: string;
  material_code: string;
  material_name: string;
  category: string;
  current_price: number;
  old_price: number;
  new_price: number;
  price_change: number;
  price_change_percent: number;
  changed_at: string;
}

export default function MaterialPriceTab() {
  const [timeFrame, setTimeFrame] = useState<TimeFrame>('30d');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Fetch top movers
  const { data: topMovers = [] } = useQuery({
    queryKey: ['material-top-movers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_material_top_movers')
        .select('*')
        .limit(10);

      if (error) {
        console.error('Error fetching top movers:', error);
        return [];
      }
      return data as TopMover[];
    },
  });

  // Fetch category summary
  const { data: categorySummary = [] } = useQuery({
    queryKey: ['material-category-summary'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_material_category_summary')
        .select('*');

      if (error) {
        console.error('Error fetching category summary:', error);
        return [];
      }
      return data as CategorySummary[];
    },
  });

  // Fetch price trends (recent changes)
  const { data: priceTrends = [] } = useQuery({
    queryKey: ['material-price-trends', timeFrame],
    queryFn: async () => {
      const days = timeFrame === '7d' ? 7 : timeFrame === '30d' ? 30 : 90;
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const { data, error } = await supabase
        .from('v_material_price_trends')
        .select('*')
        .gte('changed_at', startDate.toISOString())
        .order('changed_at', { ascending: true });

      if (error) {
        console.error('Error fetching price trends:', error);
        return [];
      }
      return (data || []).filter((d: PriceTrend) => d.changed_at) as PriceTrend[];
    },
  });

  // Calculate totals
  const totalChanges = priceTrends.length;
  const priceIncreases = priceTrends.filter(t => t.price_change > 0).length;
  const priceDecreases = priceTrends.filter(t => t.price_change < 0).length;
  const avgChangePercent = priceTrends.length > 0
    ? priceTrends.reduce((sum, t) => sum + (t.price_change_percent || 0), 0) / priceTrends.length
    : 0;

  // Prepare chart data (aggregate by day)
  const chartData = priceTrends.reduce((acc: any[], trend) => {
    const date = new Date(trend.changed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const existing = acc.find(d => d.date === date);
    if (existing) {
      existing.changes++;
      existing.totalChange += trend.price_change || 0;
    } else {
      acc.push({
        date,
        changes: 1,
        totalChange: trend.price_change || 0,
      });
    }
    return acc;
  }, []);

  // Filter categories for display
  const categories = ['all', ...categorySummary.map(c => c.category)];
  const filteredMovers = selectedCategory === 'all'
    ? topMovers
    : topMovers.filter(m => m.category === selectedCategory);

  return (
    <div className="space-y-4">
      {/* Header with time selector */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <DollarSign className="w-5 h-5 text-green-600" />
          <h2 className="text-lg font-semibold text-gray-900">Material Price Analytics</h2>
        </div>
        <div className="flex bg-gray-100 rounded-lg p-1">
          {(['7d', '30d', '90d'] as TimeFrame[]).map((tf) => (
            <button
              key={tf}
              onClick={() => setTimeFrame(tf)}
              className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${
                timeFrame === tf
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {tf === '7d' ? '7 Days' : tf === '30d' ? '30 Days' : '90 Days'}
            </button>
          ))}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-gray-500 uppercase">Price Changes</span>
            <Activity className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-2xl font-bold text-gray-900">{totalChanges}</div>
          <div className="text-xs text-gray-500 mt-1">Last {timeFrame}</div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-gray-500 uppercase">Increases</span>
            <TrendingUp className="w-4 h-4 text-red-500" />
          </div>
          <div className="text-2xl font-bold text-red-600">{priceIncreases}</div>
          <div className="text-xs text-gray-500 mt-1">Materials went up</div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-gray-500 uppercase">Decreases</span>
            <TrendingDown className="w-4 h-4 text-green-500" />
          </div>
          <div className="text-2xl font-bold text-green-600">{priceDecreases}</div>
          <div className="text-xs text-gray-500 mt-1">Materials went down</div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-gray-500 uppercase">Avg Change</span>
            <Activity className="w-4 h-4 text-purple-500" />
          </div>
          <div className={`text-2xl font-bold ${avgChangePercent > 0 ? 'text-red-600' : avgChangePercent < 0 ? 'text-green-600' : 'text-gray-900'}`}>
            {avgChangePercent > 0 ? '+' : ''}{avgChangePercent.toFixed(1)}%
          </div>
          <div className="text-xs text-gray-500 mt-1">Average change</div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-3 gap-4">
        {/* Price Changes Over Time */}
        <div className="col-span-2 bg-white rounded-xl border border-gray-200 p-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Activity className="w-4 h-4 text-blue-500" />
            Price Changes Over Time
          </h3>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="changes"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={{ fill: '#3b82f6', r: 4 }}
                  name="Changes"
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[250px] flex items-center justify-center text-gray-500">
              <div className="text-center">
                <AlertCircle className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                <p className="text-sm">No price changes in this period</p>
              </div>
            </div>
          )}
        </div>

        {/* Category Summary */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Package className="w-4 h-4 text-purple-500" />
            By Category
          </h3>
          <div className="space-y-2 max-h-[250px] overflow-y-auto">
            {categorySummary.slice(0, 8).map(cat => (
              <div key={cat.category} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                <div>
                  <div className="text-sm font-medium text-gray-900 truncate max-w-[120px]">{cat.category}</div>
                  <div className="text-xs text-gray-500">{cat.material_count} items</div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold text-gray-900">${cat.avg_cost.toFixed(2)}</div>
                  {cat.changed_last_30d > 0 && (
                    <div className={`text-xs ${cat.total_change_30d > 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {cat.changed_last_30d} changed
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Top Movers */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-orange-500" />
            Top Movers (Last 30 Days)
          </h3>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-2 py-1"
          >
            {categories.map(cat => (
              <option key={cat} value={cat}>
                {cat === 'all' ? 'All Categories' : cat}
              </option>
            ))}
          </select>
        </div>

        {filteredMovers.length > 0 ? (
          <div className="grid grid-cols-2 gap-3">
            {filteredMovers.slice(0, 10).map((mover, index) => (
              <div
                key={mover.material_id}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold ${
                    mover.total_change > 0 ? 'bg-red-500' : 'bg-green-500'
                  }`}>
                    {index + 1}
                  </div>
                  <div className="min-w-0">
                    <div className="font-medium text-gray-900 truncate">{mover.material_code}</div>
                    <div className="text-xs text-gray-500 truncate">{mover.material_name}</div>
                  </div>
                </div>
                <div className="text-right flex-shrink-0 ml-2">
                  <div className={`text-lg font-bold ${mover.avg_change_percent > 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {mover.avg_change_percent > 0 ? '+' : ''}{mover.avg_change_percent.toFixed(1)}%
                  </div>
                  <div className="text-xs text-gray-500">{mover.change_count} changes</div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <Package className="w-12 h-12 text-gray-300 mx-auto mb-2" />
            <p className="text-sm">No price changes in the last 30 days</p>
          </div>
        )}
      </div>

      {/* Recent Changes Table */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Activity className="w-4 h-4 text-blue-500" />
          Recent Price Changes
        </h3>
        {priceTrends.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 px-3 font-medium text-gray-500">Material</th>
                  <th className="text-left py-2 px-3 font-medium text-gray-500">Category</th>
                  <th className="text-right py-2 px-3 font-medium text-gray-500">Old Price</th>
                  <th className="text-right py-2 px-3 font-medium text-gray-500">New Price</th>
                  <th className="text-right py-2 px-3 font-medium text-gray-500">Change</th>
                  <th className="text-right py-2 px-3 font-medium text-gray-500">Date</th>
                </tr>
              </thead>
              <tbody>
                {priceTrends.slice(-20).reverse().map((trend, idx) => (
                  <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-2 px-3">
                      <div className="font-medium text-gray-900">{trend.material_code}</div>
                      <div className="text-xs text-gray-500 truncate max-w-[200px]">{trend.material_name}</div>
                    </td>
                    <td className="py-2 px-3 text-gray-600">{trend.category}</td>
                    <td className="py-2 px-3 text-right text-gray-600">${trend.old_price?.toFixed(2)}</td>
                    <td className="py-2 px-3 text-right font-medium text-gray-900">${trend.new_price?.toFixed(2)}</td>
                    <td className={`py-2 px-3 text-right font-medium ${
                      trend.price_change > 0 ? 'text-red-600' : 'text-green-600'
                    }`}>
                      {trend.price_change > 0 ? '+' : ''}${trend.price_change?.toFixed(2)}
                      <span className="text-xs ml-1">
                        ({trend.price_change_percent > 0 ? '+' : ''}{trend.price_change_percent?.toFixed(1)}%)
                      </span>
                    </td>
                    <td className="py-2 px-3 text-right text-gray-500">
                      {new Date(trend.changed_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <Activity className="w-12 h-12 text-gray-300 mx-auto mb-2" />
            <p className="text-sm">No price changes recorded yet</p>
          </div>
        )}
      </div>
    </div>
  );
}
