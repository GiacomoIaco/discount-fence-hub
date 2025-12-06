import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Package,
  TrendingUp,
  DollarSign,
  AlertCircle,
  Award,
  BarChart3
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { supabase } from '../../../../lib/supabase';

interface SKUUsage {
  sku_code: string;
  sku_name: string;
  fence_type: string;
  project_count: number;
  total_footage: number;
  total_material_cost: number;
  total_labor_cost: number;
  avg_material_per_ft: number;
  avg_labor_per_ft: number;
  avg_total_per_ft: number;
  last_used: string;
}

type SortBy = 'footage' | 'projects' | 'cost';

export default function SKUPerformanceTab() {
  const [sortBy, setSortBy] = useState<SortBy>('footage');
  const [selectedFenceType, setSelectedFenceType] = useState<string>('all');

  // Fetch SKU usage analytics
  const { data: skuUsage = [] } = useQuery({
    queryKey: ['sku-usage-analytics'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_sku_usage_analytics')
        .select('*');

      if (error) {
        console.error('Error fetching SKU usage:', error);
        return [];
      }
      return data as SKUUsage[];
    },
  });

  // Get unique fence types
  const fenceTypes = ['all', ...new Set(skuUsage.map(s => s.fence_type).filter(Boolean))];

  // Filter and sort SKUs
  const filteredSKUs = skuUsage
    .filter(s => selectedFenceType === 'all' || s.fence_type === selectedFenceType)
    .sort((a, b) => {
      switch (sortBy) {
        case 'projects': return b.project_count - a.project_count;
        case 'cost': return b.avg_total_per_ft - a.avg_total_per_ft;
        default: return b.total_footage - a.total_footage;
      }
    });

  // Calculate totals
  const totalSKUsUsed = skuUsage.length;
  const totalFootage = skuUsage.reduce((sum, s) => sum + (s.total_footage || 0), 0);
  const totalMaterialCost = skuUsage.reduce((sum, s) => sum + (s.total_material_cost || 0), 0);
  const totalLaborCost = skuUsage.reduce((sum, s) => sum + (s.total_labor_cost || 0), 0);
  const avgCostPerFt = totalFootage > 0 ? (totalMaterialCost + totalLaborCost) / totalFootage : 0;

  // Top 10 SKUs by footage for chart
  const topSKUsData = filteredSKUs.slice(0, 10).map(s => ({
    name: s.sku_code,
    footage: s.total_footage,
    projects: s.project_count,
  }));

  // Fence type distribution for pie chart
  const fenceTypeDistribution = fenceTypes
    .filter(ft => ft !== 'all')
    .map(ft => {
      const ftSKUs = skuUsage.filter(s => s.fence_type === ft);
      return {
        name: ft,
        value: ftSKUs.reduce((sum, s) => sum + (s.total_footage || 0), 0),
      };
    })
    .filter(d => d.value > 0)
    .sort((a, b) => b.value - a.value);

  // Colors for fence types
  const fenceTypeColors: Record<string, string> = {
    'Wood 6ft': '#22c55e',
    'Wood 8ft': '#16a34a',
    'Good Neighbor 6ft': '#3b82f6',
    'Good Neighbor 8ft': '#2563eb',
    'Horizontal': '#8b5cf6',
    'Iron': '#64748b',
    'Custom': '#a855f7',
  };

  const COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#8b5cf6', '#ef4444', '#14b8a6', '#f97316'];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Package className="w-5 h-5 text-blue-600" />
          <h2 className="text-lg font-semibold text-gray-900">SKU Performance</h2>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={selectedFenceType}
            onChange={(e) => setSelectedFenceType(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-1.5"
          >
            {fenceTypes.map(ft => (
              <option key={ft} value={ft}>
                {ft === 'all' ? 'All Fence Types' : ft}
              </option>
            ))}
          </select>
          <div className="flex bg-gray-100 rounded-lg p-1">
            {(['footage', 'projects', 'cost'] as SortBy[]).map((s) => (
              <button
                key={s}
                onClick={() => setSortBy(s)}
                className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${
                  sortBy === s
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {s === 'footage' ? 'By Footage' : s === 'projects' ? 'By Projects' : 'By Cost'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-gray-500 uppercase">SKUs Used</span>
            <Package className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-2xl font-bold text-gray-900">{totalSKUsUsed}</div>
          <div className="text-xs text-gray-500 mt-1">Unique configurations</div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-gray-500 uppercase">Total Footage</span>
            <TrendingUp className="w-4 h-4 text-green-500" />
          </div>
          <div className="text-2xl font-bold text-gray-900">{totalFootage.toLocaleString()}</div>
          <div className="text-xs text-gray-500 mt-1">Linear feet</div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-gray-500 uppercase">Total Revenue</span>
            <DollarSign className="w-4 h-4 text-green-500" />
          </div>
          <div className="text-2xl font-bold text-gray-900">
            ${((totalMaterialCost + totalLaborCost) / 1000).toFixed(1)}k
          </div>
          <div className="text-xs text-gray-500 mt-1">Material + Labor</div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-gray-500 uppercase">Avg Cost/Ft</span>
            <BarChart3 className="w-4 h-4 text-purple-500" />
          </div>
          <div className="text-2xl font-bold text-gray-900">${avgCostPerFt.toFixed(2)}</div>
          <div className="text-xs text-gray-500 mt-1">All SKUs</div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-3 gap-4">
        {/* Top SKUs Chart */}
        <div className="col-span-2 bg-white rounded-xl border border-gray-200 p-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Award className="w-4 h-4 text-yellow-500" />
            Top 10 SKUs by Footage
          </h3>
          {topSKUsData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={topSKUsData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis
                  dataKey="name"
                  type="category"
                  tick={{ fontSize: 10 }}
                  width={100}
                />
                <Tooltip
                  formatter={(value: number, name: string) => [
                    name === 'footage' ? `${value.toLocaleString()} ft` : value,
                    name === 'footage' ? 'Footage' : 'Projects'
                  ]}
                />
                <Bar dataKey="footage" fill="#3b82f6" name="Footage" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-gray-500">
              <div className="text-center">
                <AlertCircle className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                <p className="text-sm">No SKU usage data available</p>
              </div>
            </div>
          )}
        </div>

        {/* Fence Type Distribution */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Package className="w-4 h-4 text-purple-500" />
            Footage by Fence Type
          </h3>
          {fenceTypeDistribution.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={fenceTypeDistribution}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={2}
                  dataKey="value"
                  label={({ percent }) => `${((percent || 0) * 100).toFixed(0)}%`}
                  labelLine={false}
                >
                  {fenceTypeDistribution.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={fenceTypeColors[entry.name] || COLORS[index % COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => `${value.toLocaleString()} ft`} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[250px] flex items-center justify-center text-gray-500">
              <p className="text-sm">No data available</p>
            </div>
          )}
          {/* Legend */}
          <div className="flex flex-wrap gap-2 mt-2">
            {fenceTypeDistribution.slice(0, 4).map((ft, idx) => (
              <div key={ft.name} className="flex items-center gap-1 text-xs">
                <div
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: fenceTypeColors[ft.name] || COLORS[idx % COLORS.length] }}
                />
                <span className="text-gray-600 truncate max-w-[80px]">{ft.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* SKU Table */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Package className="w-4 h-4 text-blue-500" />
          All SKUs ({filteredSKUs.length})
        </h3>
        {filteredSKUs.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 px-3 font-medium text-gray-500">#</th>
                  <th className="text-left py-2 px-3 font-medium text-gray-500">SKU</th>
                  <th className="text-left py-2 px-3 font-medium text-gray-500">Fence Type</th>
                  <th className="text-right py-2 px-3 font-medium text-gray-500">Projects</th>
                  <th className="text-right py-2 px-3 font-medium text-gray-500">Footage</th>
                  <th className="text-right py-2 px-3 font-medium text-gray-500">Mat/ft</th>
                  <th className="text-right py-2 px-3 font-medium text-gray-500">Lab/ft</th>
                  <th className="text-right py-2 px-3 font-medium text-gray-500">Total/ft</th>
                  <th className="text-right py-2 px-3 font-medium text-gray-500">Last Used</th>
                </tr>
              </thead>
              <tbody>
                {filteredSKUs.slice(0, 25).map((sku, idx) => (
                  <tr key={sku.sku_code} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-2 px-3 text-gray-500">{idx + 1}</td>
                    <td className="py-2 px-3">
                      <div className="font-medium text-gray-900">{sku.sku_code}</div>
                      <div className="text-xs text-gray-500 truncate max-w-[200px]">{sku.sku_name}</div>
                    </td>
                    <td className="py-2 px-3">
                      <span
                        className="px-2 py-0.5 text-xs font-medium rounded-full"
                        style={{
                          backgroundColor: (fenceTypeColors[sku.fence_type] || '#94a3b8') + '20',
                          color: fenceTypeColors[sku.fence_type] || '#64748b'
                        }}
                      >
                        {sku.fence_type}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-right font-medium text-gray-900">{sku.project_count}</td>
                    <td className="py-2 px-3 text-right font-medium text-blue-600">
                      {sku.total_footage?.toLocaleString()}
                    </td>
                    <td className="py-2 px-3 text-right text-gray-600">${sku.avg_material_per_ft?.toFixed(2)}</td>
                    <td className="py-2 px-3 text-right text-gray-600">${sku.avg_labor_per_ft?.toFixed(2)}</td>
                    <td className="py-2 px-3 text-right font-medium text-green-600">
                      ${sku.avg_total_per_ft?.toFixed(2)}
                    </td>
                    <td className="py-2 px-3 text-right text-gray-500">
                      {sku.last_used ? new Date(sku.last_used).toLocaleDateString() : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <Package className="w-12 h-12 text-gray-300 mx-auto mb-2" />
            <p className="text-sm">No SKU usage data available</p>
          </div>
        )}
      </div>
    </div>
  );
}
