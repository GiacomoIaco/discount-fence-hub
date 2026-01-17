// Salesperson Performance Tab - Leaderboard with grouped metrics
// Sections: Requests, Quotes (#), Quoted Value ($), Speed & Efficiency

import { useState, useEffect, useMemo } from 'react';
import { User, TrendingUp, TrendingDown, Minus, ChevronDown, ChevronRight, Filter, Settings2, X } from 'lucide-react';
import { useResidentialSalespersonMetrics, useResidentialSalespersonMonthly } from '../../../../hooks/jobber/residential';
import type { ResidentialFilters, SalespersonMetrics } from '../../../../types/residential';
import { formatResidentialCurrency, formatResidentialPercent } from '../../../../types/residential';

interface SalespersonPerformanceProps {
  filters: ResidentialFilters;
}

// Column definitions with grouping
type ColumnKey =
  | 'requests_assigned' | 'pct_quoted'
  | 'total_opps' | 'won_opps' | 'win_rate' | 'win_rate_diff'
  | 'total_value' | 'won_value' | 'value_win_rate' | 'value_win_rate_diff'
  | 'pct_same_day' | 'p75_days_to_quote' | 'avg_opp_value' | 'pct_multi_quote' | 'median_days_to_decision';

interface ColumnDef {
  key: ColumnKey;
  label: string;
  shortLabel: string;
  group: 'requests' | 'quotes_count' | 'quotes_value' | 'efficiency';
  tooltip?: string;
  format: (value: number | null, person?: SalespersonMetrics) => string;
  colorFn?: (value: number | null, person?: SalespersonMetrics) => string;
  sortable?: boolean;
}

const COLUMN_GROUPS = {
  requests: { label: 'Requests', color: 'bg-purple-50 border-purple-200' },
  quotes_count: { label: 'Quotes (#)', color: 'bg-blue-50 border-blue-200' },
  quotes_value: { label: 'Quoted Value ($)', color: 'bg-green-50 border-green-200' },
  efficiency: { label: 'Speed & Efficiency', color: 'bg-amber-50 border-amber-200' },
} as const;

const COLUMNS: ColumnDef[] = [
  // Requests group
  { key: 'requests_assigned', label: 'Requests', shortLabel: 'Req', group: 'requests', tooltip: 'Requests assigned', format: (v) => v?.toLocaleString() ?? '-', sortable: true },
  { key: 'pct_quoted', label: '% Quoted', shortLabel: '%Q', group: 'requests', tooltip: '% of requests that received at least 1 quote', format: (v) => formatResidentialPercent(v), colorFn: (v) => v && v >= 80 ? 'text-green-600' : 'text-gray-600', sortable: true },
  // Quotes count group
  { key: 'total_opps', label: 'Opps', shortLabel: 'Opp', group: 'quotes_count', format: (v) => v?.toLocaleString() ?? '-', sortable: true },
  { key: 'won_opps', label: 'Won', shortLabel: 'Won', group: 'quotes_count', format: (v) => v?.toLocaleString() ?? '-', colorFn: () => 'text-green-600', sortable: true },
  { key: 'win_rate', label: 'Win %', shortLabel: 'W%', group: 'quotes_count', format: (v) => formatResidentialPercent(v), colorFn: getWinRateColor, sortable: true },
  { key: 'win_rate_diff', label: '±Avg', shortLabel: '±', group: 'quotes_count', tooltip: 'Win rate vs team average', format: () => '', sortable: false }, // Special rendering
  // Quotes value group
  { key: 'total_value', label: 'Total $', shortLabel: 'Tot$', group: 'quotes_value', tooltip: 'Total quoted value', format: (v) => formatResidentialCurrency(v ?? 0), sortable: true },
  { key: 'won_value', label: 'Won $', shortLabel: 'Won$', group: 'quotes_value', format: (v) => formatResidentialCurrency(v ?? 0), colorFn: () => 'text-green-600 font-medium', sortable: true },
  { key: 'value_win_rate', label: 'V Win%', shortLabel: 'V%', group: 'quotes_value', tooltip: 'Value win rate', format: (v) => formatResidentialPercent(v), colorFn: getWinRateColor, sortable: true },
  { key: 'value_win_rate_diff', label: '±Avg$', shortLabel: '±$', group: 'quotes_value', tooltip: 'Value win rate vs team average', format: () => '', sortable: false }, // Special rendering
  // Efficiency group
  { key: 'pct_same_day', label: 'Same Day', shortLabel: 'SD%', group: 'efficiency', tooltip: '% quoted same day', format: (v) => formatResidentialPercent(v), colorFn: (v) => v && v >= 60 ? 'text-green-600 font-medium' : 'text-gray-600', sortable: true },
  { key: 'p75_days_to_quote', label: 'P75 Days', shortLabel: 'P75', group: 'efficiency', tooltip: '75th percentile days to quote', format: (v) => v?.toString() ?? '-', colorFn: (v) => v !== null && v <= 1 ? 'text-green-600' : 'text-gray-600', sortable: true },
  { key: 'avg_opp_value', label: 'Avg Opp', shortLabel: 'Avg$', group: 'efficiency', tooltip: 'Average opportunity value', format: (v) => formatResidentialCurrency(v ?? 0), sortable: true },
  { key: 'pct_multi_quote', label: 'Multi Q', shortLabel: 'MQ%', group: 'efficiency', tooltip: '% with 2+ quotes', format: (v) => formatResidentialPercent(v), sortable: true },
  { key: 'median_days_to_decision', label: 'Med Dec', shortLabel: 'Dec', group: 'efficiency', tooltip: 'Median days to decision (won)', format: (v) => v?.toString() ?? '-', sortable: true },
];

const STORAGE_KEY = 'salesperson-visible-columns';
const DEFAULT_VISIBLE: ColumnKey[] = [
  'requests_assigned', 'pct_quoted',
  'total_opps', 'won_opps', 'win_rate', 'win_rate_diff',
  'total_value', 'won_value', 'value_win_rate', 'value_win_rate_diff',
  'pct_same_day', 'p75_days_to_quote', 'avg_opp_value',
];

type SortField = ColumnKey | 'name';
type SortDirection = 'asc' | 'desc';

const MIN_OPPS_THRESHOLD = 10;

export function SalespersonPerformance({ filters }: SalespersonPerformanceProps) {
  const { data: salespersonMetrics, isLoading } = useResidentialSalespersonMetrics(filters);
  const [sortField, setSortField] = useState<SortField>('won_value');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [expandedPerson, setExpandedPerson] = useState<string | null>(null);
  const [showAllSalespeople, setShowAllSalespeople] = useState(false);
  const [showColumnSettings, setShowColumnSettings] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<ColumnKey[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : DEFAULT_VISIBLE;
    } catch {
      return DEFAULT_VISIBLE;
    }
  });

  // Save to localStorage when columns change
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(visibleColumns));
  }, [visibleColumns]);

  const filteredData = showAllSalespeople
    ? (salespersonMetrics || [])
    : (salespersonMetrics || []).filter((s) => s.total_opps >= MIN_OPPS_THRESHOLD);

  // Calculate team averages for comparison
  const teamAvgWinRate = useMemo(() => {
    if (!filteredData.length) return 0;
    const total = filteredData.reduce((sum, s) => sum + (s.win_rate || 0), 0);
    return total / filteredData.length;
  }, [filteredData]);

  const teamAvgValueWinRate = useMemo(() => {
    if (!filteredData.length) return 0;
    const total = filteredData.reduce((sum, s) => sum + (s.value_win_rate || 0), 0);
    return total / filteredData.length;
  }, [filteredData]);

  const sortedData = useMemo(() => {
    return [...filteredData].sort((a, b) => {
      let aVal: string | number;
      let bVal: string | number;

      if (sortField === 'name') {
        aVal = a.salesperson;
        bVal = b.salesperson;
      } else if (sortField === 'win_rate_diff') {
        aVal = (a.win_rate || 0) - teamAvgWinRate;
        bVal = (b.win_rate || 0) - teamAvgWinRate;
      } else if (sortField === 'value_win_rate_diff') {
        aVal = (a.value_win_rate || 0) - teamAvgValueWinRate;
        bVal = (b.value_win_rate || 0) - teamAvgValueWinRate;
      } else {
        aVal = a[sortField as keyof SalespersonMetrics] as number ?? 0;
        bVal = b[sortField as keyof SalespersonMetrics] as number ?? 0;
      }

      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDirection === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }

      return sortDirection === 'asc'
        ? (aVal as number) - (bVal as number)
        : (bVal as number) - (aVal as number);
    });
  }, [filteredData, sortField, sortDirection, teamAvgWinRate, teamAvgValueWinRate]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const toggleColumn = (key: ColumnKey) => {
    setVisibleColumns((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const visibleColumnDefs = COLUMNS.filter((c) => visibleColumns.includes(c.key));

  // Count columns per group for colspan
  const groupColspans = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const col of visibleColumnDefs) {
      counts[col.group] = (counts[col.group] || 0) + 1;
    }
    return counts;
  }, [visibleColumnDefs]);

  // Get ordered groups that have visible columns
  const orderedGroups = (['requests', 'quotes_count', 'quotes_value', 'efficiency'] as const).filter(
    (g) => groupColspans[g] > 0
  );

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

  const totalColumns = visibleColumnDefs.length + 2; // +2 for expand icon and name

  return (
    <div className="space-y-4">
      {/* Controls Row */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-600">
            {filteredData.length} of {salespersonMetrics?.length || 0} salespeople
          </span>
          <button
            onClick={() => setShowAllSalespeople(!showAllSalespeople)}
            className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-lg transition-colors ${
              showAllSalespeople
                ? 'bg-amber-100 text-amber-800 border border-amber-300'
                : 'bg-purple-600 text-white'
            }`}
          >
            <Filter className="w-3.5 h-3.5" />
            {showAllSalespeople ? 'All' : `≥${MIN_OPPS_THRESHOLD} opps`}
          </button>
        </div>

        <div className="relative">
          <button
            onClick={() => setShowColumnSettings(!showColumnSettings)}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700"
          >
            <Settings2 className="w-3.5 h-3.5" />
            Columns
          </button>

          {showColumnSettings && (
            <div className="absolute right-0 top-full mt-1 z-50 bg-white rounded-lg shadow-lg border border-gray-200 p-3 w-64">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">Show Columns</span>
                <button onClick={() => setShowColumnSettings(false)} className="text-gray-400 hover:text-gray-600">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {Object.entries(COLUMN_GROUPS).map(([groupKey, groupInfo]) => (
                  <div key={groupKey}>
                    <div className="text-xs font-semibold text-gray-500 uppercase mb-1">{groupInfo.label}</div>
                    <div className="space-y-1">
                      {COLUMNS.filter((c) => c.group === groupKey).map((col) => (
                        <label key={col.key} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-gray-50 px-1 py-0.5 rounded">
                          <input
                            type="checkbox"
                            checked={visibleColumns.includes(col.key)}
                            onChange={() => toggleColumn(col.key)}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="text-gray-700">{col.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-3 pt-2 border-t border-gray-200 flex gap-2">
                <button
                  onClick={() => setVisibleColumns(DEFAULT_VISIBLE)}
                  className="text-xs text-blue-600 hover:text-blue-800"
                >
                  Reset to default
                </button>
                <button
                  onClick={() => setVisibleColumns(COLUMNS.map((c) => c.key))}
                  className="text-xs text-gray-500 hover:text-gray-700"
                >
                  Show all
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-3">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3">
          <div className="text-xs text-gray-500">Team Avg Win %</div>
          <div className="text-xl font-bold text-blue-600">{formatResidentialPercent(teamAvgWinRate)}</div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3">
          <div className="text-xs text-gray-500">Team Avg Value %</div>
          <div className="text-xl font-bold text-green-600">{formatResidentialPercent(teamAvgValueWinRate)}</div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3">
          <div className="text-xs text-gray-500">Top by Win %</div>
          <div className="text-sm font-bold text-gray-900 truncate">{sortedData[0]?.salesperson || '-'}</div>
          <div className="text-xs text-gray-500">{formatResidentialPercent(sortedData[0]?.win_rate || null)}</div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3">
          <div className="text-xs text-gray-500">Top by Won $</div>
          <div className="text-sm font-bold text-gray-900 truncate">
            {[...filteredData].sort((a, b) => b.won_value - a.won_value)[0]?.salesperson || '-'}
          </div>
          <div className="text-xs text-gray-500">
            {formatResidentialCurrency([...filteredData].sort((a, b) => b.won_value - a.won_value)[0]?.won_value || 0)}
          </div>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="flex items-center gap-2 p-3 border-b border-gray-200">
          <User className="w-4 h-4 text-blue-600" />
          <h3 className="text-sm font-semibold text-gray-900">Salesperson Leaderboard</h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            {/* Group Header Row */}
            <thead>
              <tr className="border-b border-gray-300">
                <th className="sticky left-0 bg-white z-10 w-8" rowSpan={2}></th>
                <th
                  className="sticky left-8 bg-white z-10 text-left py-2 px-2 font-semibold text-gray-700 cursor-pointer hover:text-blue-600 min-w-[140px]"
                  rowSpan={2}
                  onClick={() => handleSort('name')}
                >
                  Name {sortField === 'name' && <SortIndicator dir={sortDirection} />}
                </th>
                {orderedGroups.map((groupKey) => (
                  <th
                    key={groupKey}
                    colSpan={groupColspans[groupKey]}
                    className={`text-center py-1.5 px-1 text-xs font-semibold border-l ${COLUMN_GROUPS[groupKey].color}`}
                  >
                    {COLUMN_GROUPS[groupKey].label}
                  </th>
                ))}
              </tr>
              {/* Column Header Row */}
              <tr className="border-b border-gray-200 bg-gray-50">
                {visibleColumnDefs.map((col, idx) => {
                  const isFirstInGroup = idx === 0 || visibleColumnDefs[idx - 1].group !== col.group;
                  return (
                    <th
                      key={col.key}
                      className={`text-right py-2 px-1.5 font-medium text-gray-600 whitespace-nowrap ${
                        col.sortable !== false ? 'cursor-pointer hover:text-blue-600' : ''
                      } ${isFirstInGroup ? 'border-l border-gray-200' : ''}`}
                      onClick={() => col.sortable !== false && handleSort(col.key)}
                      title={col.tooltip || col.label}
                    >
                      {col.shortLabel}
                      {sortField === col.key && <SortIndicator dir={sortDirection} />}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sortedData.map((person, index) => (
                <SalespersonRow
                  key={person.salesperson}
                  person={person}
                  rank={index + 1}
                  columns={visibleColumnDefs}
                  teamAvgWinRate={teamAvgWinRate}
                  teamAvgValueWinRate={teamAvgValueWinRate}
                  isExpanded={expandedPerson === person.salesperson}
                  onToggle={() =>
                    setExpandedPerson(expandedPerson === person.salesperson ? null : person.salesperson)
                  }
                  filters={filters}
                  totalColumns={totalColumns}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Legend */}
      <div className="text-xs text-gray-500 flex flex-wrap gap-4">
        <span>Click row to expand monthly detail</span>
        <span>•</span>
        <span className="text-green-600">Green = above average</span>
        <span>•</span>
        <span className="text-red-600">Red = below average</span>
      </div>
    </div>
  );
}

function SortIndicator({ dir }: { dir: SortDirection }) {
  return dir === 'asc' ? (
    <TrendingUp className="w-3 h-3 inline ml-0.5" />
  ) : (
    <TrendingDown className="w-3 h-3 inline ml-0.5" />
  );
}

function SalespersonRow({
  person,
  rank,
  columns,
  teamAvgWinRate,
  teamAvgValueWinRate,
  isExpanded,
  onToggle,
  filters,
  totalColumns,
}: {
  person: SalespersonMetrics;
  rank: number;
  columns: ColumnDef[];
  teamAvgWinRate: number;
  teamAvgValueWinRate: number;
  isExpanded: boolean;
  onToggle: () => void;
  filters: ResidentialFilters;
  totalColumns: number;
}) {
  const winRateDiff = (person.win_rate || 0) - teamAvgWinRate;
  const valueWinRateDiff = (person.value_win_rate || 0) - teamAvgValueWinRate;

  const renderCell = (col: ColumnDef, idx: number) => {
    const isFirstInGroup = idx === 0 || columns[idx - 1].group !== col.group;
    const baseClass = `py-2 px-1.5 text-right whitespace-nowrap ${isFirstInGroup ? 'border-l border-gray-100' : ''}`;

    // Special handling for diff columns
    if (col.key === 'win_rate_diff') {
      return (
        <td key={col.key} className={baseClass}>
          <DiffBadge diff={winRateDiff} />
        </td>
      );
    }
    if (col.key === 'value_win_rate_diff') {
      return (
        <td key={col.key} className={baseClass}>
          <DiffBadge diff={valueWinRateDiff} />
        </td>
      );
    }

    const value = person[col.key as keyof SalespersonMetrics] as number | null;
    const formatted = col.format(value, person);
    const colorClass = col.colorFn ? col.colorFn(value, person) : 'text-gray-600';

    return (
      <td key={col.key} className={`${baseClass} ${colorClass}`}>
        {formatted}
      </td>
    );
  };

  return (
    <>
      <tr
        className={`hover:bg-gray-50 cursor-pointer ${isExpanded ? 'bg-blue-50' : ''}`}
        onClick={onToggle}
      >
        <td className="sticky left-0 bg-inherit py-2 px-1.5 z-10">
          {isExpanded ? (
            <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
          )}
        </td>
        <td className="sticky left-8 bg-inherit py-2 px-2 z-10 min-w-[140px]">
          <div className="flex items-center gap-1.5">
            <span
              className={`w-5 h-5 flex-shrink-0 flex items-center justify-center text-[10px] font-bold rounded-full ${
                rank <= 3 ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-500'
              }`}
            >
              {rank}
            </span>
            <span className="font-medium text-gray-900">
              {person.salesperson}
            </span>
          </div>
        </td>
        {columns.map((col, idx) => renderCell(col, idx))}
      </tr>

      {isExpanded && (
        <tr>
          <td colSpan={totalColumns} className="p-0">
            <SalespersonDetail salesperson={person.salesperson} filters={filters} />
          </td>
        </tr>
      )}
    </>
  );
}

function DiffBadge({ diff }: { diff: number }) {
  const color = diff > 5 ? 'text-green-600' : diff > 0 ? 'text-green-500' : diff < -5 ? 'text-red-600' : diff < 0 ? 'text-amber-600' : 'text-gray-400';
  const icon = diff > 0 ? <TrendingUp className="w-3 h-3" /> : diff < 0 ? <TrendingDown className="w-3 h-3" /> : <Minus className="w-3 h-3" />;

  return (
    <span className={`flex items-center justify-end gap-0.5 ${color}`}>
      {icon}
      <span className="text-[10px] font-medium">
        {diff > 0 ? '+' : ''}{diff.toFixed(0)}
      </span>
    </span>
  );
}

function SalespersonDetail({ salesperson, filters }: { salesperson: string; filters: ResidentialFilters }) {
  const { data: monthlyData, isLoading } = useResidentialSalespersonMonthly(salesperson, 6, filters);

  if (isLoading) {
    return (
      <div className="px-10 py-3 bg-gray-50">
        <div className="animate-pulse h-24 bg-gray-200 rounded" />
      </div>
    );
  }

  return (
    <div className="px-10 py-3 bg-gray-50 border-t border-gray-200">
      <h4 className="text-xs font-semibold text-gray-700 mb-2">Monthly Trend (Last 6 Months)</h4>
      <div className="overflow-x-auto">
        <table className="min-w-full text-xs">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left py-1.5 px-2 font-medium text-gray-500">Month</th>
              <th className="text-right py-1.5 px-2 font-medium text-gray-500">Opps</th>
              <th className="text-right py-1.5 px-2 font-medium text-gray-500">Won</th>
              <th className="text-right py-1.5 px-2 font-medium text-gray-500">Win %</th>
              <th className="text-right py-1.5 px-2 font-medium text-gray-500">Total $</th>
              <th className="text-right py-1.5 px-2 font-medium text-gray-500">Won $</th>
              <th className="text-right py-1.5 px-2 font-medium text-gray-500">Value %</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {monthlyData?.map((month) => (
              <tr key={month.month}>
                <td className="py-1.5 px-2 text-gray-900">{month.month_label}</td>
                <td className="py-1.5 px-2 text-right text-gray-600">{month.total_opps}</td>
                <td className="py-1.5 px-2 text-right text-green-600">{month.won_opps}</td>
                <td className="py-1.5 px-2 text-right">
                  <span className={getWinRateColor(month.win_rate)}>{formatResidentialPercent(month.win_rate)}</span>
                </td>
                <td className="py-1.5 px-2 text-right text-gray-600">{formatResidentialCurrency(month.total_value)}</td>
                <td className="py-1.5 px-2 text-right text-green-600">{formatResidentialCurrency(month.won_value)}</td>
                <td className="py-1.5 px-2 text-right">
                  <span className={getWinRateColor(month.value_win_rate)}>{formatResidentialPercent(month.value_win_rate)}</span>
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
