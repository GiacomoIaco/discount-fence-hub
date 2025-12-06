import { useQuery } from '@tanstack/react-query';
import {
  Building2,
  TrendingUp,
  DollarSign,
  FolderOpen,
  AlertCircle,
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
  Legend,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar
} from 'recharts';
import { supabase } from '../../../../lib/supabase';

interface BUComparison {
  business_unit_id: string;
  bu_code: string;
  bu_name: string;
  total_projects: number;
  completed_projects: number;
  projects_this_month: number;
  total_footage: number;
  avg_footage_per_line: number;
  total_material_cost: number;
  total_labor_cost: number;
  avg_material_per_ft: number;
  avg_labor_per_ft: number;
  avg_total_per_ft: number;
  avg_labor_rate: number;
  labor_rate_count: number;
}

export default function BusinessUnitTab() {
  // Fetch BU comparison data
  const { data: buComparison = [] } = useQuery({
    queryKey: ['business-unit-comparison'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_business_unit_comparison')
        .select('*');

      if (error) {
        console.error('Error fetching BU comparison:', error);
        return [];
      }
      return data as BUComparison[];
    },
  });

  // Colors for business units
  const buColors: Record<string, string> = {
    'ATX-HB': '#3b82f6',
    'ATX-RES': '#60a5fa',
    'SA-HB': '#22c55e',
    'SA-RES': '#86efac',
    'HOU-HB': '#f59e0b',
    'HOU-RES': '#fcd34d',
  };

  // Calculate totals
  const totals = buComparison.reduce(
    (acc, bu) => ({
      projects: acc.projects + (bu.total_projects || 0),
      footage: acc.footage + (bu.total_footage || 0),
      materialCost: acc.materialCost + (bu.total_material_cost || 0),
      laborCost: acc.laborCost + (bu.total_labor_cost || 0),
    }),
    { projects: 0, footage: 0, materialCost: 0, laborCost: 0 }
  );

  // Prepare cost per foot comparison
  const costChartData = buComparison.map(bu => ({
    name: bu.bu_code,
    material: bu.avg_material_per_ft || 0,
    labor: bu.avg_labor_per_ft || 0,
    total: bu.avg_total_per_ft || 0,
  }));

  // Prepare radar chart data for normalized comparison
  const maxValues = {
    projects: Math.max(...buComparison.map(bu => bu.total_projects || 0), 1),
    footage: Math.max(...buComparison.map(bu => bu.total_footage || 0), 1),
    materialPerFt: Math.max(...buComparison.map(bu => bu.avg_material_per_ft || 0), 1),
    laborPerFt: Math.max(...buComparison.map(bu => bu.avg_labor_per_ft || 0), 1),
    laborRate: Math.max(...buComparison.map(bu => bu.avg_labor_rate || 0), 1),
  };

  const radarData = [
    { metric: 'Projects', fullMark: 100, ...buComparison.reduce((acc, bu) => ({ ...acc, [bu.bu_code]: Math.round((bu.total_projects / maxValues.projects) * 100) }), {}) },
    { metric: 'Footage', fullMark: 100, ...buComparison.reduce((acc, bu) => ({ ...acc, [bu.bu_code]: Math.round((bu.total_footage / maxValues.footage) * 100) }), {}) },
    { metric: 'Mat Cost/ft', fullMark: 100, ...buComparison.reduce((acc, bu) => ({ ...acc, [bu.bu_code]: Math.round(((bu.avg_material_per_ft || 0) / maxValues.materialPerFt) * 100) }), {}) },
    { metric: 'Labor/ft', fullMark: 100, ...buComparison.reduce((acc, bu) => ({ ...acc, [bu.bu_code]: Math.round(((bu.avg_labor_per_ft || 0) / maxValues.laborPerFt) * 100) }), {}) },
    { metric: 'Labor Rate', fullMark: 100, ...buComparison.reduce((acc, bu) => ({ ...acc, [bu.bu_code]: Math.round(((bu.avg_labor_rate || 0) / maxValues.laborRate) * 100) }), {}) },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Building2 className="w-5 h-5 text-blue-600" />
        <h2 className="text-lg font-semibold text-gray-900">Business Unit Comparison</h2>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-gray-500 uppercase">Total BUs</span>
            <Building2 className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-2xl font-bold text-gray-900">{buComparison.length}</div>
          <div className="text-xs text-gray-500 mt-1">Active business units</div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-gray-500 uppercase">Total Projects</span>
            <FolderOpen className="w-4 h-4 text-green-500" />
          </div>
          <div className="text-2xl font-bold text-gray-900">{totals.projects}</div>
          <div className="text-xs text-gray-500 mt-1">Across all BUs</div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-gray-500 uppercase">Total Footage</span>
            <TrendingUp className="w-4 h-4 text-purple-500" />
          </div>
          <div className="text-2xl font-bold text-gray-900">{totals.footage.toLocaleString()}</div>
          <div className="text-xs text-gray-500 mt-1">Linear feet</div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-gray-500 uppercase">Total Value</span>
            <DollarSign className="w-4 h-4 text-green-500" />
          </div>
          <div className="text-2xl font-bold text-gray-900">
            ${((totals.materialCost + totals.laborCost) / 1000).toFixed(1)}k
          </div>
          <div className="text-xs text-gray-500 mt-1">Material + Labor</div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-2 gap-4">
        {/* Cost Per Foot Comparison */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-green-500" />
            Cost Per Foot by BU
          </h3>
          {costChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={costChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${v}`} />
                <Tooltip formatter={(value: number) => `$${value.toFixed(2)}`} />
                <Legend />
                <Bar dataKey="material" fill="#3b82f6" name="Material/ft" />
                <Bar dataKey="labor" fill="#8b5cf6" name="Labor/ft" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[280px] flex items-center justify-center text-gray-500">
              <div className="text-center">
                <AlertCircle className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                <p className="text-sm">No comparison data available</p>
              </div>
            </div>
          )}
        </div>

        {/* Radar Chart */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-purple-500" />
            Performance Comparison
          </h3>
          {radarData.length > 0 && buComparison.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <RadarChart data={radarData}>
                <PolarGrid />
                <PolarAngleAxis dataKey="metric" tick={{ fontSize: 10 }} />
                <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 9 }} />
                {buComparison.slice(0, 4).map((bu, index) => (
                  <Radar
                    key={bu.bu_code}
                    name={bu.bu_code}
                    dataKey={bu.bu_code}
                    stroke={buColors[bu.bu_code] || `hsl(${index * 60}, 70%, 50%)`}
                    fill={buColors[bu.bu_code] || `hsl(${index * 60}, 70%, 50%)`}
                    fillOpacity={0.2}
                  />
                ))}
                <Tooltip />
                <Legend />
              </RadarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[280px] flex items-center justify-center text-gray-500">
              <p className="text-sm">No data available</p>
            </div>
          )}
        </div>
      </div>

      {/* BU Cards */}
      <div className="grid grid-cols-3 gap-4">
        {buComparison.map(bu => {
          const totalCost = bu.avg_total_per_ft || 0;
          const avgTotalCost = buComparison.reduce((sum, b) => sum + (b.avg_total_per_ft || 0), 0) / buComparison.length;
          const costDiff = totalCost - avgTotalCost;
          const isAboveAvg = costDiff > 0;

          return (
            <div
              key={bu.bu_code}
              className="bg-white rounded-xl border border-gray-200 p-4"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div
                    className="w-4 h-4 rounded-full"
                    style={{ backgroundColor: buColors[bu.bu_code] || '#94a3b8' }}
                  />
                  <div>
                    <div className="font-bold text-gray-900">{bu.bu_code}</div>
                    <div className="text-xs text-gray-500">{bu.bu_name}</div>
                  </div>
                </div>
                <div className={`px-2 py-1 text-xs font-medium rounded-full ${
                  isAboveAvg ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                }`}>
                  {isAboveAvg ? '+' : ''}{costDiff.toFixed(2)}/ft
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-xs text-gray-500">Projects</div>
                  <div className="text-lg font-bold text-gray-900">{bu.total_projects}</div>
                  <div className="text-xs text-blue-600">{bu.projects_this_month} this month</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Footage</div>
                  <div className="text-lg font-bold text-gray-900">{bu.total_footage?.toLocaleString()}</div>
                  <div className="text-xs text-gray-500">linear feet</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Material/ft</div>
                  <div className="text-lg font-bold text-blue-600">${bu.avg_material_per_ft?.toFixed(2) || '0.00'}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Labor/ft</div>
                  <div className="text-lg font-bold text-purple-600">${bu.avg_labor_per_ft?.toFixed(2) || '0.00'}</div>
                </div>
              </div>

              <div className="mt-3 pt-3 border-t border-gray-100">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Total Cost/ft</span>
                  <span className="text-lg font-bold text-green-600">${bu.avg_total_per_ft?.toFixed(2) || '0.00'}</span>
                </div>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-xs text-gray-500">Avg Labor Rate</span>
                  <span className="text-sm font-medium text-gray-700">${bu.avg_labor_rate?.toFixed(2) || '0.00'}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Comparison Table */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Building2 className="w-4 h-4 text-blue-500" />
          Detailed Comparison
        </h3>
        {buComparison.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 px-3 font-medium text-gray-500">Business Unit</th>
                  <th className="text-right py-2 px-3 font-medium text-gray-500">Projects</th>
                  <th className="text-right py-2 px-3 font-medium text-gray-500">Completed</th>
                  <th className="text-right py-2 px-3 font-medium text-gray-500">Footage</th>
                  <th className="text-right py-2 px-3 font-medium text-gray-500">Avg Footage</th>
                  <th className="text-right py-2 px-3 font-medium text-gray-500">Material/ft</th>
                  <th className="text-right py-2 px-3 font-medium text-gray-500">Labor/ft</th>
                  <th className="text-right py-2 px-3 font-medium text-gray-500">Total/ft</th>
                  <th className="text-right py-2 px-3 font-medium text-gray-500">Avg Rate</th>
                </tr>
              </thead>
              <tbody>
                {buComparison.map(bu => (
                  <tr key={bu.bu_code} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-2 px-3">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: buColors[bu.bu_code] || '#94a3b8' }}
                        />
                        <div>
                          <div className="font-medium text-gray-900">{bu.bu_code}</div>
                          <div className="text-xs text-gray-500">{bu.bu_name}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-2 px-3 text-right font-medium text-gray-900">{bu.total_projects}</td>
                    <td className="py-2 px-3 text-right text-green-600">{bu.completed_projects}</td>
                    <td className="py-2 px-3 text-right font-medium text-blue-600">{bu.total_footage?.toLocaleString()}</td>
                    <td className="py-2 px-3 text-right text-gray-600">{bu.avg_footage_per_line?.toFixed(0)}</td>
                    <td className="py-2 px-3 text-right text-gray-900">${bu.avg_material_per_ft?.toFixed(2)}</td>
                    <td className="py-2 px-3 text-right text-gray-900">${bu.avg_labor_per_ft?.toFixed(2)}</td>
                    <td className="py-2 px-3 text-right font-bold text-green-600">${bu.avg_total_per_ft?.toFixed(2)}</td>
                    <td className="py-2 px-3 text-right text-purple-600">${bu.avg_labor_rate?.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <Building2 className="w-12 h-12 text-gray-300 mx-auto mb-2" />
            <p className="text-sm">No business unit data available</p>
          </div>
        )}
      </div>
    </div>
  );
}
