// Filter bar component for Jobber dashboard

import { useState, useRef, useEffect } from 'react';
import { Calendar, User, MapPin, X, ChevronDown } from 'lucide-react';
import { useJobberJobs } from '../../hooks/jobber';
import type { JobberFilters, JobberFilterOptions, TimePreset, JobSizeCategory, DateFieldType } from '../../types/jobber';
import { getTimePresetLabel, getDateRangeFromPreset, DEFAULT_JOBBER_FILTERS } from '../../types/jobber';

interface JobberFiltersBarProps {
  filters: JobberFilters;
  onChange: (filters: JobberFilters) => void;
}

const TIME_PRESETS: { label: string; value: TimePreset; divider?: boolean }[] = [
  { label: 'This Week', value: 'this_week' },
  { label: 'Last Week', value: 'last_week' },
  { label: 'This Month', value: 'this_month' },
  { label: 'Last Month', value: 'last_month' },
  { label: 'This Quarter', value: 'this_quarter' },
  { label: 'Last Quarter', value: 'last_quarter' },
  { label: 'This Year', value: 'this_year' },
  { label: 'Last Year', value: 'last_year' },
  { label: 'Last 30 Days', value: 'last_30_days', divider: true },
  { label: 'Last 90 Days', value: 'last_90_days' },
  { label: 'Year to Date', value: 'ytd' },
  { label: 'All Time', value: 'all_time' },
];

const JOB_SIZE_OPTIONS: { label: string; value: JobSizeCategory; description: string }[] = [
  { label: 'Standard', value: 'standard', description: '> $500' },
  { label: 'Small', value: 'small', description: '$1-500' },
  { label: 'Warranty', value: 'warranty', description: '$0' },
];

const DATE_FIELD_OPTIONS: { label: string; value: DateFieldType; description: string }[] = [
  { label: 'Created', value: 'created_date', description: 'When job was entered' },
  { label: 'Scheduled', value: 'scheduled_start_date', description: 'When work was planned' },
  { label: 'Closed', value: 'closed_date', description: 'When job was completed' },
];

export function JobberFiltersBar({ filters, onChange }: JobberFiltersBarProps) {
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showJobSizes, setShowJobSizes] = useState(false);
  const datePickerRef = useRef<HTMLDivElement>(null);
  const jobSizesRef = useRef<HTMLDivElement>(null);

  // Close dropdowns when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (datePickerRef.current && !datePickerRef.current.contains(event.target as Node)) {
        setShowDatePicker(false);
      }
      if (jobSizesRef.current && !jobSizesRef.current.contains(event.target as Node)) {
        setShowJobSizes(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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

  const handleTimePreset = (preset: TimePreset) => {
    const dateRange = getDateRangeFromPreset(preset);
    onChange({ ...filters, timePreset: preset, dateRange });
    setShowDatePicker(false);
  };

  const handleJobSizeToggle = (size: JobSizeCategory) => {
    const currentSizes = filters.jobSizes || DEFAULT_JOBBER_FILTERS.jobSizes;
    let newSizes: JobSizeCategory[];

    if (currentSizes.includes(size)) {
      // Remove if already selected (but keep at least one)
      newSizes = currentSizes.filter(s => s !== size);
      if (newSizes.length === 0) {
        newSizes = [size]; // Can't deselect all
      }
    } else {
      // Add if not selected
      newSizes = [...currentSizes, size];
    }

    onChange({ ...filters, jobSizes: newSizes });
  };

  const clearFilters = () => {
    onChange({ ...DEFAULT_JOBBER_FILTERS });
  };

  const hasActiveFilters =
    filters.timePreset !== DEFAULT_JOBBER_FILTERS.timePreset ||
    filters.dateField !== DEFAULT_JOBBER_FILTERS.dateField ||
    filters.salesperson ||
    filters.location ||
    JSON.stringify(filters.jobSizes) !== JSON.stringify(DEFAULT_JOBBER_FILTERS.jobSizes);

  const formatDateRange = () => {
    if (filters.timePreset !== 'custom') {
      return getTimePresetLabel(filters.timePreset);
    }
    if (!filters.dateRange.start && !filters.dateRange.end) return 'All Time';
    const start = filters.dateRange.start?.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' }) || '';
    const end = filters.dateRange.end?.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' }) || '';
    return `${start} - ${end}`;
  };

  const getJobSizesLabel = () => {
    const sizes = filters.jobSizes || DEFAULT_JOBBER_FILTERS.jobSizes;
    if (sizes.length === 3) return 'All Jobs';
    if (sizes.length === 2 && sizes.includes('standard') && sizes.includes('small')) return 'Standard + Small';
    return sizes.map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(', ');
  };

  return (
    <div className="flex flex-wrap items-center gap-3 p-4 bg-gray-50 rounded-lg border border-gray-200">
      {/* Time Range Filter */}
      <div className="relative" ref={datePickerRef}>
        <button
          onClick={() => setShowDatePicker(!showDatePicker)}
          className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 text-sm"
        >
          <Calendar className="w-4 h-4 text-gray-500" />
          <span>{formatDateRange()}</span>
          <ChevronDown className="w-4 h-4 text-gray-400" />
        </button>

        {showDatePicker && (
          <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 p-2 min-w-[180px]">
            {TIME_PRESETS.map((option, idx) => (
              <div key={option.value}>
                {option.divider && idx > 0 && (
                  <div className="border-t border-gray-100 my-1" />
                )}
                <button
                  onClick={() => handleTimePreset(option.value)}
                  className={`block w-full text-left px-3 py-2 text-sm rounded transition-colors ${
                    filters.timePreset === option.value
                      ? 'bg-blue-50 text-blue-700 font-medium'
                      : 'hover:bg-gray-100'
                  }`}
                >
                  {option.label}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Date Field Filter (by which date to filter) */}
      <div className="relative">
        <select
          value={filters.dateField || 'created_date'}
          onChange={(e) => onChange({ ...filters, dateField: e.target.value as DateFieldType })}
          className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 text-sm"
          title="Filter jobs by this date field"
        >
          {DATE_FIELD_OPTIONS.map(option => (
            <option key={option.value} value={option.value}>
              By {option.label}
            </option>
          ))}
        </select>
      </div>

      {/* Job Size Filter (Multi-select) */}
      <div className="relative" ref={jobSizesRef}>
        <button
          onClick={() => setShowJobSizes(!showJobSizes)}
          className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 text-sm"
        >
          <span>{getJobSizesLabel()}</span>
          <ChevronDown className="w-4 h-4 text-gray-400" />
        </button>

        {showJobSizes && (
          <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 p-2 min-w-[200px]">
            <div className="text-xs text-gray-500 px-3 py-1 font-medium">Job Size by Revenue</div>
            {JOB_SIZE_OPTIONS.map(option => {
              const isChecked = (filters.jobSizes || DEFAULT_JOBBER_FILTERS.jobSizes).includes(option.value);
              return (
                <label
                  key={option.value}
                  className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 rounded cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => handleJobSizeToggle(option.value)}
                    className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <div className="flex-1">
                    <div className="text-sm font-medium">{option.label}</div>
                    <div className="text-xs text-gray-500">{option.description}</div>
                  </div>
                </label>
              );
            })}
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
