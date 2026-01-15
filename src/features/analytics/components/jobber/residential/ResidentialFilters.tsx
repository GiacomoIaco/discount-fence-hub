// Residential Analytics Filters
// Time range, salesperson, project size, speed to quote, quote count

import { Filter, Calendar, User, DollarSign, Clock, FileText, X } from 'lucide-react';
import { useResidentialSalespersons } from '../../../hooks/jobber/residential';
import type {
  ResidentialFilters as ResidentialFiltersType,
  ResidentialTimePreset,
  RevenueBucket,
  SpeedToQuoteBucket,
  QuoteCountBucket,
} from '../../../types/residential';
import {
  DEFAULT_RESIDENTIAL_FILTERS,
  REVENUE_BUCKET_ORDER,
  SPEED_BUCKET_ORDER,
  QUOTE_COUNT_BUCKET_ORDER,
} from '../../../types/residential';

interface ResidentialFiltersProps {
  filters: ResidentialFiltersType;
  onChange: (filters: ResidentialFiltersType) => void;
}

const TIME_PRESETS: { value: ResidentialTimePreset; label: string }[] = [
  { value: 'last_30_days', label: 'Last 30 Days' },
  { value: 'last_60_days', label: 'Last 60 Days' },
  { value: 'last_90_days', label: 'Last 90 Days' },
  { value: 'last_180_days', label: 'Last 180 Days' },
  { value: 'last_365_days', label: 'Last Year' },
  { value: 'ytd', label: 'Year to Date' },
  { value: 'all_time', label: 'All Time' },
];

export function ResidentialFilters({ filters, onChange }: ResidentialFiltersProps) {
  const { data: salespersons } = useResidentialSalespersons();

  const hasActiveFilters =
    filters.salesperson !== null ||
    filters.revenueBucket !== null ||
    filters.speedBucket !== null ||
    filters.quoteCountBucket !== null ||
    filters.timePreset !== 'all_time';

  const clearFilters = () => {
    onChange(DEFAULT_RESIDENTIAL_FILTERS);
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
      <div className="flex items-center gap-2 mb-4">
        <Filter className="w-4 h-4 text-gray-500" />
        <span className="font-medium text-gray-900">Filters</span>
        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="ml-auto flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
          >
            <X className="w-3 h-3" />
            Clear all
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {/* Time Range */}
        <div>
          <label className="flex items-center gap-1 text-xs font-medium text-gray-500 mb-1">
            <Calendar className="w-3 h-3" />
            Time Range
          </label>
          <select
            value={filters.timePreset}
            onChange={(e) =>
              onChange({
                ...filters,
                timePreset: e.target.value as ResidentialTimePreset,
              })
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            {TIME_PRESETS.map((preset) => (
              <option key={preset.value} value={preset.value}>
                {preset.label}
              </option>
            ))}
          </select>
        </div>

        {/* Salesperson */}
        <div>
          <label className="flex items-center gap-1 text-xs font-medium text-gray-500 mb-1">
            <User className="w-3 h-3" />
            Salesperson
          </label>
          <select
            value={filters.salesperson || ''}
            onChange={(e) =>
              onChange({
                ...filters,
                salesperson: e.target.value || null,
              })
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">All Salespeople</option>
            {salespersons?.map((sp) => (
              <option key={sp} value={sp}>
                {sp}
              </option>
            ))}
          </select>
        </div>

        {/* Project Size */}
        <div>
          <label className="flex items-center gap-1 text-xs font-medium text-gray-500 mb-1">
            <DollarSign className="w-3 h-3" />
            Project Size
          </label>
          <select
            value={filters.revenueBucket || ''}
            onChange={(e) =>
              onChange({
                ...filters,
                revenueBucket: (e.target.value as RevenueBucket) || null,
              })
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">All Sizes</option>
            {REVENUE_BUCKET_ORDER.map((bucket) => (
              <option key={bucket} value={bucket}>
                {bucket}
              </option>
            ))}
          </select>
        </div>

        {/* Speed to Quote */}
        <div>
          <label className="flex items-center gap-1 text-xs font-medium text-gray-500 mb-1">
            <Clock className="w-3 h-3" />
            Speed to Quote
          </label>
          <select
            value={filters.speedBucket || ''}
            onChange={(e) =>
              onChange({
                ...filters,
                speedBucket: (e.target.value as SpeedToQuoteBucket) || null,
              })
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">All Speeds</option>
            {SPEED_BUCKET_ORDER.map((bucket) => (
              <option key={bucket} value={bucket}>
                {bucket}
              </option>
            ))}
          </select>
        </div>

        {/* Quote Count */}
        <div>
          <label className="flex items-center gap-1 text-xs font-medium text-gray-500 mb-1">
            <FileText className="w-3 h-3" />
            Quote Options
          </label>
          <select
            value={filters.quoteCountBucket || ''}
            onChange={(e) =>
              onChange({
                ...filters,
                quoteCountBucket: (e.target.value as QuoteCountBucket) || null,
              })
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">All Counts</option>
            {QUOTE_COUNT_BUCKET_ORDER.map((bucket) => (
              <option key={bucket} value={bucket}>
                {bucket}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
