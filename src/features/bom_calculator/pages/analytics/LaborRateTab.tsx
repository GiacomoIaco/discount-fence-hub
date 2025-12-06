import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Clock,
  TrendingUp,
  TrendingDown,
  Building2,
  Activity,
  AlertCircle
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts';
import { supabase } from '../../../../lib/supabase';

interface LaborRateComparison {
  labor_code_id: string;
  labor_code: string;
  labor_description: string;
  business_unit_id: string;
  bu_code: string;
  bu_name: string;
  current_rate: number;
  changes_90d: number;
  last_change_amount: number;
  last_change_date: string;
}

interface LaborRateHistory {
  labor_code: string;
  business_unit_code: string;
  old_rate: number;
  new_rate: number;
  rate_change: number;
  rate_change_percent: number;
  changed_at: string;
}

export default function LaborRateTab() {
  const [selectedBU, setSelectedBU] = useState<string>('all');

  // Fetch labor rate comparison
  const { data: rateComparison = [] } = useQuery({
    queryKey: ['labor-rate-comparison'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_labor_rate_comparison')
        .select('*')
        .not('current_rate', 'is', null)
        .order('labor_code');

      if (error) {
        console.error('Error fetching labor rate comparison:', error);
        return [];
      }
      return data as LaborRateComparison[];
    },
  });

  // Fetch labor rate history
  const { data: rateHistory = [] } = useQuery({
    queryKey: ['labor-rate-history'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('labor_rate_history')
        .select('*')
        .order('changed_at', { ascending: false })
        .limit(50);

      if (error) {
        console.error('Error fetching labor rate history:', error);
        return [];
      }
      return data as LaborRateHistory[];
    },
  });

  // Get unique business units
  const businessUnits = [...new Set(rateComparison.map(r => r.bu_code))].sort();

  // Get unique labor codes
  const laborCodes = [...new Set(rateComparison.map(r => r.labor_code))].sort();

  // Prepare comparison chart data
  const chartData = laborCodes.slice(0, 15).map(code => {
    const row: any = { code };
    businessUnits.forEach(bu => {
      const rate = rateComparison.find(r => r.labor_code === code && r.bu_code === bu);
      row[bu] = rate?.current_rate || 0;
    });
    return row;
  });

  // Calculate stats
  const totalRates = rateComparison.length;
  const avgRate = totalRates > 0
    ? rateComparison.reduce((sum, r) => sum + (r.current_rate || 0), 0) / totalRates
    : 0;
  const recentChanges = rateHistory.filter(h =>
    new Date(h.changed_at) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  ).length;
  const rateIncreases = rateHistory.filter(h => h.rate_change > 0).length;
  const rateDecreases = rateHistory.filter(h => h.rate_change < 0).length;

  // Colors for business units
  const buColors: Record<string, string> = {
    'ATX-HB': '#3b82f6',
    'ATX-RES': '#60a5fa',
    'SA-HB': '#22c55e',
    'SA-RES': '#86efac',
    'HOU-HB': '#f59e0b',
    'HOU-RES': '#fcd34d',
  };

  // Filter history by BU
  const filteredHistory = selectedBU === 'all'
    ? rateHistory
    : rateHistory.filter(h => h.business_unit_code === selectedBU);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Clock className="w-5 h-5 text-purple-600" />
        <h2 className="text-lg font-semibold text-gray-900">Labor Rate Analytics</h2>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-gray-500 uppercase">Total Rates</span>
            <Clock className="w-4 h-4 text-purple-500" />
          </div>
          <div className="text-2xl font-bold text-gray-900">{totalRates}</div>
          <div className="text-xs text-gray-500 mt-1">Across all BUs</div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-gray-500 uppercase">Avg Rate</span>
            <Building2 className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-2xl font-bold text-gray-900">${avgRate.toFixed(2)}</div>
          <div className="text-xs text-gray-500 mt-1">Per labor code</div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-gray-500 uppercase">Changes (30d)</span>
            <Activity className="w-4 h-4 text-orange-500" />
          </div>
          <div className="text-2xl font-bold text-gray-900">{recentChanges}</div>
          <div className="text-xs text-gray-500 mt-1">Rate adjustments</div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-gray-500 uppercase">Trend</span>
            {rateIncreases > rateDecreases ? (
              <TrendingUp className="w-4 h-4 text-red-500" />
            ) : (
              <TrendingDown className="w-4 h-4 text-green-500" />
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold text-red-600">{rateIncreases}</span>
            <span className="text-gray-400">/</span>
            <span className="text-lg font-bold text-green-600">{rateDecreases}</span>
          </div>
          <div className="text-xs text-gray-500 mt-1">Up / Down</div>
        </div>
      </div>

      {/* Comparison Chart */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Building2 className="w-4 h-4 text-blue-500" />
          Labor Rates by Business Unit
        </h3>
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => `$${v}`} />
              <YAxis
                dataKey="code"
                type="category"
                tick={{ fontSize: 10 }}
                width={60}
              />
              <Tooltip formatter={(value: number) => `$${value.toFixed(2)}`} />
              <Legend />
              {businessUnits.map(bu => (
                <Bar
                  key={bu}
                  dataKey={bu}
                  fill={buColors[bu] || '#94a3b8'}
                  name={bu}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-[300px] flex items-center justify-center text-gray-500">
            <div className="text-center">
              <AlertCircle className="w-12 h-12 text-gray-300 mx-auto mb-2" />
              <p className="text-sm">No labor rate data available</p>
            </div>
          </div>
        )}
      </div>

      {/* Rate Comparison Table */}
      <div className="grid grid-cols-2 gap-4">
        {/* Rates by BU */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Building2 className="w-4 h-4 text-purple-500" />
            Rates by Business Unit
          </h3>
          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {businessUnits.map(bu => {
              const buRates = rateComparison.filter(r => r.bu_code === bu);
              const buAvg = buRates.length > 0
                ? buRates.reduce((sum, r) => sum + (r.current_rate || 0), 0) / buRates.length
                : 0;
              const buChanges = buRates.reduce((sum, r) => sum + (r.changes_90d || 0), 0);

              return (
                <div key={bu} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: buColors[bu] || '#94a3b8' }}
                    />
                    <div>
                      <div className="font-medium text-gray-900">{bu}</div>
                      <div className="text-xs text-gray-500">{buRates.length} rates</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-purple-600">${buAvg.toFixed(2)}</div>
                    {buChanges > 0 && (
                      <div className="text-xs text-orange-600">{buChanges} changes (90d)</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Recent Rate Changes */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
              <Activity className="w-4 h-4 text-orange-500" />
              Recent Rate Changes
            </h3>
            <select
              value={selectedBU}
              onChange={(e) => setSelectedBU(e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-2 py-1"
            >
              <option value="all">All BUs</option>
              {businessUnits.map(bu => (
                <option key={bu} value={bu}>{bu}</option>
              ))}
            </select>
          </div>
          {filteredHistory.length > 0 ? (
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {filteredHistory.slice(0, 15).map((change, idx) => (
                <div key={idx} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                  <div>
                    <div className="font-medium text-gray-900">{change.labor_code}</div>
                    <div className="text-xs text-gray-500">{change.business_unit_code}</div>
                  </div>
                  <div className="text-right">
                    <div className={`font-bold ${change.rate_change > 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {change.rate_change > 0 ? '+' : ''}${change.rate_change.toFixed(2)}
                    </div>
                    <div className="text-xs text-gray-500">
                      {new Date(change.changed_at).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <Activity className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-sm">No rate changes recorded</p>
            </div>
          )}
        </div>
      </div>

      {/* Full Rate Table */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Clock className="w-4 h-4 text-purple-500" />
          All Labor Rates
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-2 px-3 font-medium text-gray-500">Code</th>
                <th className="text-left py-2 px-3 font-medium text-gray-500">Description</th>
                {businessUnits.map(bu => (
                  <th key={bu} className="text-right py-2 px-3 font-medium text-gray-500">{bu}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {laborCodes.slice(0, 20).map(code => {
                const codeRates = rateComparison.filter(r => r.labor_code === code);
                const description = codeRates[0]?.labor_description || '';

                return (
                  <tr key={code} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-2 px-3 font-medium text-gray-900">{code}</td>
                    <td className="py-2 px-3 text-gray-600 truncate max-w-[200px]">{description}</td>
                    {businessUnits.map(bu => {
                      const rate = codeRates.find(r => r.bu_code === bu);
                      return (
                        <td key={bu} className="py-2 px-3 text-right">
                          {rate?.current_rate ? (
                            <span className="font-medium text-gray-900">${rate.current_rate.toFixed(2)}</span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
