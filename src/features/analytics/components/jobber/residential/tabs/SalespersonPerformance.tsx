// Salesperson Performance Tab - Leaderboard and drill-down
// Shows: Win rate by salesperson, Opportunities handled, $ Won, Trend

import { useState } from 'react';
import { User, TrendingUp, TrendingDown, Minus, ChevronDown, ChevronRight, Filter } from 'lucide-react';
import { useResidentialSalespersonMetrics, useResidentialSalespersonMonthly } from '../../../../hooks/jobber/residential';
import type { ResidentialFilters, SalespersonMetrics } from '../../../../types/residential';
import { formatResidentialCurrency, formatResidentialPercent } from '../../../../types/residential';

interface SalespersonPerformanceProps {
  filters: ResidentialFilters;
}

type SortField = 'name' | 'total_opps' | 'won_opps' | 'win_rate' | 'total_value' | 'won_value' | 'value_win_rate';
type SortDirection = 'asc' | 'desc';

const MIN_OPPS_THRESHOLD = 10; // Minimum opportunities to be shown as individual salesperson

export function SalespersonPerformance({ filters }: SalespersonPerformanceProps) {
  const { data: salespersonMetrics, isLoading } = useResidentialSalespersonMetrics(filters);
  const [sortField, setSortField] = useState<SortField>('win_rate');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [expandedPerson, setExpandedPerson] = useState<string | null>(null);
  const [showAllSalespeople, setShowAllSalespeople] = useState(false);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/3 mb-4" />
          <div className="h-64 bg-gray-100 rounded" />
        </div>
      </div>
    );
  }

  // Filter data by minimum opportunities threshold
  const filteredData = showAllSalespeople
    ? (salespersonMetrics || [])
    : (salespersonMetrics || []).filter((s) => s.total_opps >= MIN_OPPS_THRESHOLD);

  // Sort data
  const sortedData = [...filteredData].sort((a, b) => {
    let aVal: string | number;
    let bVal: string | number;

    if (sortField === 'name') {
      aVal = a.salesperson;
      bVal = b.salesperson;
    } else {
      aVal = a[sortField] ?? 0;
      bVal = b[sortField] ?? 0;
    }

    if (typeof aVal === 'string' && typeof bVal === 'string') {
      return sortDirection === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    }

    return sortDirection === 'asc'
      ? (aVal as number) - (bVal as number)
      : (bVal as number) - (aVal as number);
  });

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return sortDirection === 'asc' ? (
      <TrendingUp className="w-3 h-3 inline ml-1" />
    ) : (
      <TrendingDown className="w-3 h-3 inline ml-1" />
    );
  };

  // Calculate averages (using filtered data)
  const avgWinRate = filteredData.length > 0
    ? filteredData.reduce((sum, s) => sum + (s.win_rate || 0), 0) / filteredData.length
    : 0;

  return (
    <div className="space-y-6">
      {/* Filter Toggle + Summary Cards */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-600">
            Showing {filteredData.length} of {salespersonMetrics?.length || 0} salespeople
          </span>
          <button
            onClick={() => setShowAllSalespeople(!showAllSalespeople)}
            className={`flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
              showAllSalespeople
                ? 'bg-amber-100 text-amber-800 border border-amber-300'
                : 'bg-purple-600 text-white'
            }`}
            title={showAllSalespeople ? 'Click to show only top performers' : `Showing salespeople with ≥${MIN_OPPS_THRESHOLD} opportunities`}
          >
            <Filter className="w-4 h-4" />
            {showAllSalespeople ? 'Show All' : `Top Performers (≥${MIN_OPPS_THRESHOLD} opps)`}
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="text-sm text-gray-600">Salespeople Shown</div>
          <div className="text-2xl font-bold text-gray-900">{filteredData.length}</div>
          {!showAllSalespeople && (
            <div className="text-xs text-gray-500">{(salespersonMetrics?.length || 0) - filteredData.length} filtered out</div>
          )}
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="text-sm text-gray-600">Avg Win Rate</div>
          <div className="text-2xl font-bold text-blue-600">{formatResidentialPercent(avgWinRate)}</div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="text-sm text-gray-600">Top Performer</div>
          <div className="text-lg font-bold text-green-600 truncate">
            {sortedData[0]?.salesperson || '-'}
          </div>
          <div className="text-xs text-gray-500">
            {formatResidentialPercent(sortedData[0]?.win_rate || null)} win rate
          </div>
        </div>
      </div>

      {/* Leaderboard Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <User className="w-5 h-5 text-blue-600" />
          <h3 className="text-lg font-semibold text-gray-900">Salesperson Leaderboard</h3>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4 w-8"></th>
                <th
                  className="text-left py-3 px-4 font-medium text-gray-700 cursor-pointer hover:text-blue-600"
                  onClick={() => handleSort('name')}
                >
                  Salesperson <SortIcon field="name" />
                </th>
                <th
                  className="text-right py-3 px-4 font-medium text-gray-700 cursor-pointer hover:text-blue-600"
                  onClick={() => handleSort('total_opps')}
                >
                  Opportunities <SortIcon field="total_opps" />
                </th>
                <th
                  className="text-right py-3 px-4 font-medium text-gray-700 cursor-pointer hover:text-blue-600"
                  onClick={() => handleSort('won_opps')}
                >
                  Won <SortIcon field="won_opps" />
                </th>
                <th
                  className="text-right py-3 px-4 font-medium text-gray-700 cursor-pointer hover:text-blue-600"
                  onClick={() => handleSort('win_rate')}
                >
                  Win Rate <SortIcon field="win_rate" />
                </th>
                <th
                  className="text-right py-3 px-4 font-medium text-gray-700 cursor-pointer hover:text-blue-600"
                  onClick={() => handleSort('total_value')}
                >
                  Opp Value <SortIcon field="total_value" />
                </th>
                <th
                  className="text-right py-3 px-4 font-medium text-gray-700 cursor-pointer hover:text-blue-600"
                  onClick={() => handleSort('won_value')}
                >
                  Won Value <SortIcon field="won_value" />
                </th>
                <th
                  className="text-right py-3 px-4 font-medium text-gray-700 cursor-pointer hover:text-blue-600"
                  onClick={() => handleSort('value_win_rate')}
                >
                  Value Win % <SortIcon field="value_win_rate" />
                </th>
                <th className="text-right py-3 px-4 font-medium text-gray-700">vs Avg</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sortedData.map((person, index) => (
                <SalespersonRow
                  key={person.salesperson}
                  person={person}
                  rank={index + 1}
                  avgWinRate={avgWinRate}
                  isExpanded={expandedPerson === person.salesperson}
                  onToggle={() =>
                    setExpandedPerson(
                      expandedPerson === person.salesperson ? null : person.salesperson
                    )
                  }
                  filters={filters}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Performance Insights */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="font-semibold text-blue-800 mb-2">Performance Insights</h4>
        <ul className="text-sm text-blue-700 space-y-1 list-disc list-inside">
          <li>Click on a salesperson row to see monthly breakdown</li>
          <li>Win rate varies significantly by salesperson - coaching opportunities exist</li>
          <li>High volume + high win rate = top performers to learn from</li>
          <li>Low volume + low win rate = may need territory or support adjustment</li>
        </ul>
      </div>
    </div>
  );
}

// Salesperson Row with expandable detail
function SalespersonRow({
  person,
  rank,
  avgWinRate,
  isExpanded,
  onToggle,
  filters,
}: {
  person: SalespersonMetrics;
  rank: number;
  avgWinRate: number;
  isExpanded: boolean;
  onToggle: () => void;
  filters: ResidentialFilters;
}) {
  const diff = (person.win_rate || 0) - avgWinRate;

  return (
    <>
      <tr
        className={`hover:bg-gray-50 cursor-pointer ${isExpanded ? 'bg-blue-50' : ''}`}
        onClick={onToggle}
      >
        <td className="py-3 px-4">
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 text-gray-400" />
          ) : (
            <ChevronRight className="w-4 h-4 text-gray-400" />
          )}
        </td>
        <td className="py-3 px-4">
          <div className="flex items-center gap-2">
            <span
              className={`w-6 h-6 flex items-center justify-center text-xs font-bold rounded-full ${
                rank <= 3 ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'
              }`}
            >
              {rank}
            </span>
            <span className="font-medium text-gray-900">{person.salesperson}</span>
          </div>
        </td>
        <td className="py-3 px-4 text-right text-gray-600">
          {person.total_opps.toLocaleString()}
        </td>
        <td className="py-3 px-4 text-right text-green-600">
          {person.won_opps.toLocaleString()}
        </td>
        <td className="py-3 px-4 text-right">
          <span className={`font-semibold ${getWinRateColor(person.win_rate)}`}>
            {formatResidentialPercent(person.win_rate)}
          </span>
        </td>
        <td className="py-3 px-4 text-right text-gray-600">
          {formatResidentialCurrency(person.total_value)}
        </td>
        <td className="py-3 px-4 text-right font-medium text-green-600">
          {formatResidentialCurrency(person.won_value)}
        </td>
        <td className="py-3 px-4 text-right">
          <span className={`font-semibold ${getWinRateColor(person.value_win_rate)}`}>
            {formatResidentialPercent(person.value_win_rate)}
          </span>
        </td>
        <td className="py-3 px-4 text-right">
          <span className={`flex items-center justify-end gap-1 ${getDiffColor(diff)}`}>
            {diff > 0 ? (
              <TrendingUp className="w-4 h-4" />
            ) : diff < 0 ? (
              <TrendingDown className="w-4 h-4" />
            ) : (
              <Minus className="w-4 h-4" />
            )}
            <span className="font-medium">
              {diff > 0 ? '+' : ''}
              {diff.toFixed(1)}%
            </span>
          </span>
        </td>
      </tr>

      {isExpanded && (
        <tr>
          <td colSpan={10} className="p-0">
            <SalespersonDetail salesperson={person.salesperson} filters={filters} />
          </td>
        </tr>
      )}
    </>
  );
}

// Expanded monthly detail
function SalespersonDetail({
  salesperson,
  filters,
}: {
  salesperson: string;
  filters: ResidentialFilters;
}) {
  const { data: monthlyData, isLoading } = useResidentialSalespersonMonthly(
    salesperson,
    6,
    filters
  );

  if (isLoading) {
    return (
      <div className="px-12 py-4 bg-gray-50">
        <div className="animate-pulse h-32 bg-gray-200 rounded" />
      </div>
    );
  }

  return (
    <div className="px-12 py-4 bg-gray-50 border-t border-gray-200">
      <h4 className="text-sm font-semibold text-gray-700 mb-3">Monthly Performance</h4>
      <div className="overflow-x-auto">
        <table className="min-w-full text-xs">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left py-2 px-3 font-medium text-gray-600">Month</th>
              <th className="text-right py-2 px-3 font-medium text-gray-600">Opps</th>
              <th className="text-right py-2 px-3 font-medium text-gray-600">Won</th>
              <th className="text-right py-2 px-3 font-medium text-gray-600">Win Rate</th>
              <th className="text-right py-2 px-3 font-medium text-gray-600">Opp Value</th>
              <th className="text-right py-2 px-3 font-medium text-gray-600">Won Value</th>
              <th className="text-right py-2 px-3 font-medium text-gray-600">Value Win %</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {monthlyData?.map((month) => (
              <tr key={month.month}>
                <td className="py-2 px-3 text-gray-900">{month.month_label}</td>
                <td className="py-2 px-3 text-right text-gray-600">{month.total_opps}</td>
                <td className="py-2 px-3 text-right text-green-600">{month.won_opps}</td>
                <td className="py-2 px-3 text-right">
                  <span className={`font-medium ${getWinRateColor(month.win_rate)}`}>
                    {formatResidentialPercent(month.win_rate)}
                  </span>
                </td>
                <td className="py-2 px-3 text-right text-gray-600">
                  {formatResidentialCurrency(month.total_value)}
                </td>
                <td className="py-2 px-3 text-right text-green-600">
                  {formatResidentialCurrency(month.won_value)}
                </td>
                <td className="py-2 px-3 text-right">
                  <span className={`font-medium ${getWinRateColor(month.value_win_rate)}`}>
                    {formatResidentialPercent(month.value_win_rate)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function getWinRateColor(rate: number | null): string {
  if (rate === null) return 'text-gray-500';
  if (rate >= 40) return 'text-green-600';
  if (rate >= 30) return 'text-blue-600';
  if (rate >= 20) return 'text-amber-600';
  return 'text-red-600';
}

function getDiffColor(diff: number): string {
  if (diff > 5) return 'text-green-600';
  if (diff > 0) return 'text-green-500';
  if (diff < -5) return 'text-red-600';
  if (diff < 0) return 'text-amber-600';
  return 'text-gray-500';
}
