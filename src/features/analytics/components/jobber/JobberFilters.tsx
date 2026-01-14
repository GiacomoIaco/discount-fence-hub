// Filter bar component for Jobber dashboard

import { useState } from 'react';
import { Calendar, User, MapPin, X } from 'lucide-react';
import { useJobberJobs } from '../../hooks/jobber';
import type { JobberFilters, JobberFilterOptions } from '../../types/jobber';

interface JobberFiltersBarProps {
  filters: JobberFilters;
  onChange: (filters: JobberFilters) => void;
}

export function JobberFiltersBar({ filters, onChange }: JobberFiltersBarProps) {
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Fetch unique values for filter dropdowns
  const { data: jobs } = useJobberJobs({ enabled: true });

  const filterOptions: JobberFilterOptions = {
    salespersons: [...new Set((jobs || [])
      .map(j => j.effective_salesperson)
      .filter((s): s is string => !!s && s !== '(Unassigned)')
    )].sort(),
    locations: [...new Set((jobs || [])
      .map(j => j.franchise_location)
      .filter((l): l is string => !!l)
    )].sort(),
  };

  const handleDatePreset = (preset: string) => {
    const today = new Date();
    let start: Date;
    let end = today;

    switch (preset) {
      case 'last30':
        start = new Date(today);
        start.setDate(start.getDate() - 30);
        break;
      case 'last90':
        start = new Date(today);
        start.setDate(start.getDate() - 90);
        break;
      case 'ytd':
        start = new Date(today.getFullYear(), 0, 1);
        break;
      case 'lastYear':
        start = new Date(today.getFullYear() - 1, 0, 1);
        end = new Date(today.getFullYear() - 1, 11, 31);
        break;
      case 'all':
        onChange({ ...filters, dateRange: { start: null, end: null } });
        setShowDatePicker(false);
        return;
      default:
        return;
    }

    onChange({ ...filters, dateRange: { start, end } });
    setShowDatePicker(false);
  };

  const clearFilters = () => {
    onChange({
      dateRange: { start: null, end: null },
      salesperson: null,
      location: null,
      includeWarranties: false,
    });
  };

  const hasActiveFilters = filters.dateRange.start || filters.salesperson || filters.location || filters.includeWarranties;

  const formatDateRange = () => {
    if (!filters.dateRange.start && !filters.dateRange.end) return 'All Time';
    const start = filters.dateRange.start?.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' }) || '';
    const end = filters.dateRange.end?.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' }) || '';
    return `${start} - ${end}`;
  };

  return (
    <div className="flex flex-wrap items-center gap-3 p-4 bg-gray-50 rounded-lg border border-gray-200">
      {/* Date Range Filter */}
      <div className="relative">
        <button
          onClick={() => setShowDatePicker(!showDatePicker)}
          className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 text-sm"
        >
          <Calendar className="w-4 h-4 text-gray-500" />
          <span>{formatDateRange()}</span>
        </button>

        {showDatePicker && (
          <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10 p-2 min-w-[160px]">
            {[
              { label: 'Last 30 Days', value: 'last30' },
              { label: 'Last 90 Days', value: 'last90' },
              { label: 'Year to Date', value: 'ytd' },
              { label: 'Last Year', value: 'lastYear' },
              { label: 'All Time', value: 'all' },
            ].map(option => (
              <button
                key={option.value}
                onClick={() => handleDatePreset(option.value)}
                className="block w-full text-left px-3 py-2 text-sm hover:bg-gray-100 rounded"
              >
                {option.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Salesperson Filter */}
      <div className="relative">
        <select
          value={filters.salesperson || ''}
          onChange={(e) => onChange({ ...filters, salesperson: e.target.value || null })}
          className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 text-sm appearance-none pr-8"
        >
          <option value="">All Salespeople</option>
          {filterOptions.salespersons.map(sp => (
            <option key={sp} value={sp}>{sp}</option>
          ))}
        </select>
        <User className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
      </div>

      {/* Location Filter */}
      <div className="relative">
        <select
          value={filters.location || ''}
          onChange={(e) => onChange({ ...filters, location: e.target.value || null })}
          className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 text-sm appearance-none pr-8"
        >
          <option value="">All Locations</option>
          {filterOptions.locations.map(loc => (
            <option key={loc} value={loc}>{loc}</option>
          ))}
        </select>
        <MapPin className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
      </div>

      {/* Include Warranties Toggle */}
      <label className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50">
        <input
          type="checkbox"
          checked={filters.includeWarranties}
          onChange={(e) => onChange({ ...filters, includeWarranties: e.target.checked })}
          className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
        />
        <span className="text-sm">Include Warranties</span>
      </label>

      {/* Clear Filters */}
      {hasActiveFilters && (
        <button
          onClick={clearFilters}
          className="flex items-center gap-1 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg"
        >
          <X className="w-4 h-4" />
          Clear Filters
        </button>
      )}
    </div>
  );
}

