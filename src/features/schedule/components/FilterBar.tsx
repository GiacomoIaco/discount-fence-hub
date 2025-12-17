import { useState, useEffect } from 'react';
import {
  Filter,
  X,
  Users,
  User,
  MapPin,
  Wrench,
  ChevronDown,
  Search,
  RotateCcw,
} from 'lucide-react';
import { useCrews, useTerritories, useProjectTypes, useSalesReps } from '../../fsm/hooks';
import { useBusinessUnits } from '../../settings/hooks/useBusinessUnits';
import type {
  ScheduleFilters,
  FilterPreset,
  ScheduleEntryType,
  ScheduleEntryStatus,
} from '../types/schedule.types';
import { FILTER_PRESET_LABELS } from '../types/schedule.types';

// ============================================
// FILTER BAR COMPONENT
// ============================================

interface FilterBarProps {
  filters: ScheduleFilters;
  onFilterChange: (filters: Partial<ScheduleFilters>) => void;
  onPresetChange: (preset: FilterPreset) => void;
  onReset: () => void;
  activeFilterCount: number;
}

export default function FilterBar({
  filters,
  onFilterChange,
  onPresetChange,
  onReset,
  activeFilterCount,
}: FilterBarProps) {
  const { data: crews } = useCrews();
  const { data: territories } = useTerritories();
  const { data: projectTypes } = useProjectTypes();
  const { data: salesReps } = useSalesReps();
  const { data: businessUnits } = useBusinessUnits();

  const [showAdvanced, setShowAdvanced] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (openDropdown && !(e.target as Element).closest('.filter-dropdown')) {
        setOpenDropdown(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [openDropdown]);

  const toggleDropdown = (name: string) => {
    setOpenDropdown(openDropdown === name ? null : name);
  };

  const toggleValue = (key: keyof ScheduleFilters, value: string) => {
    const arr = filters[key] as string[];
    const newArr = arr.includes(value)
      ? arr.filter(v => v !== value)
      : [...arr, value];
    onFilterChange({ [key]: newArr });
  };

  const activeCrews = crews?.filter(c => c.is_active) || [];
  const activeTerritories = territories?.filter(t => t.is_active) || [];
  const activeProjectTypes = projectTypes?.filter(pt => pt.is_active) || [];
  const activeReps = salesReps?.filter(r => r.is_active) || [];

  return (
    <div className="bg-white border-b px-4 py-2">
      {/* Main Filter Row */}
      <div className="flex items-center gap-3">
        {/* Preset Buttons */}
        <div className="flex items-center gap-1 border-r pr-3">
          {(['all', 'my_schedule', 'needs_attention'] as FilterPreset[]).map(preset => (
            <button
              key={preset}
              onClick={() => onPresetChange(preset)}
              className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                filters.preset === preset
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {FILTER_PRESET_LABELS[preset]}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search jobs, clients..."
            value={filters.searchQuery}
            onChange={(e) => onFilterChange({ searchQuery: e.target.value })}
            className="pl-9 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg w-48 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          {filters.searchQuery && (
            <button
              onClick={() => onFilterChange({ searchQuery: '' })}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-gray-400 hover:text-gray-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Quick Filters */}
        <div className="flex items-center gap-2">
          {/* Crews Dropdown */}
          <FilterDropdown
            label="Crews"
            icon={<Users className="w-4 h-4" />}
            selectedCount={filters.crewIds.length}
            isOpen={openDropdown === 'crews'}
            onToggle={() => toggleDropdown('crews')}
          >
            <div className="p-2 max-h-60 overflow-y-auto">
              {activeCrews.length === 0 ? (
                <p className="text-sm text-gray-500 p-2">No crews available</p>
              ) : (
                activeCrews.map(crew => (
                  <label
                    key={crew.id}
                    className="flex items-center gap-2 px-2 py-1.5 hover:bg-gray-50 rounded cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={filters.crewIds.includes(crew.id)}
                      onChange={() => toggleValue('crewIds', crew.id)}
                      className="w-4 h-4 text-blue-600 rounded"
                    />
                    <span className="text-sm text-gray-700">{crew.name}</span>
                    <span className="text-xs text-gray-400">({crew.code})</span>
                  </label>
                ))
              )}
            </div>
          </FilterDropdown>

          {/* Reps Dropdown */}
          <FilterDropdown
            label="Reps"
            icon={<User className="w-4 h-4" />}
            selectedCount={filters.repIds.length}
            isOpen={openDropdown === 'reps'}
            onToggle={() => toggleDropdown('reps')}
          >
            <div className="p-2 max-h-60 overflow-y-auto">
              {activeReps.length === 0 ? (
                <p className="text-sm text-gray-500 p-2">No reps available</p>
              ) : (
                activeReps.map(rep => (
                  <label
                    key={rep.id}
                    className="flex items-center gap-2 px-2 py-1.5 hover:bg-gray-50 rounded cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={filters.repIds.includes(rep.id)}
                      onChange={() => toggleValue('repIds', rep.id)}
                      className="w-4 h-4 text-blue-600 rounded"
                    />
                    <span className="text-sm text-gray-700">{rep.name}</span>
                  </label>
                ))
              )}
            </div>
          </FilterDropdown>

          {/* Territory Dropdown */}
          <FilterDropdown
            label="Territory"
            icon={<MapPin className="w-4 h-4" />}
            selectedCount={filters.territoryIds.length}
            isOpen={openDropdown === 'territories'}
            onToggle={() => toggleDropdown('territories')}
          >
            <div className="p-2 max-h-60 overflow-y-auto">
              {activeTerritories.length === 0 ? (
                <p className="text-sm text-gray-500 p-2">No territories available</p>
              ) : (
                activeTerritories.map(territory => (
                  <label
                    key={territory.id}
                    className="flex items-center gap-2 px-2 py-1.5 hover:bg-gray-50 rounded cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={filters.territoryIds.includes(territory.id)}
                      onChange={() => toggleValue('territoryIds', territory.id)}
                      className="w-4 h-4 text-blue-600 rounded"
                    />
                    <span className="text-sm text-gray-700">{territory.name}</span>
                    <span className="text-xs text-gray-400">({territory.code})</span>
                  </label>
                ))
              )}
            </div>
          </FilterDropdown>

          {/* Project Types (Skills) Dropdown */}
          <FilterDropdown
            label="Skill"
            icon={<Wrench className="w-4 h-4" />}
            selectedCount={filters.projectTypeIds.length}
            isOpen={openDropdown === 'projectTypes'}
            onToggle={() => toggleDropdown('projectTypes')}
          >
            <div className="p-2 max-h-60 overflow-y-auto">
              {activeProjectTypes.length === 0 ? (
                <p className="text-sm text-gray-500 p-2">No project types available</p>
              ) : (
                activeProjectTypes.map(pt => (
                  <label
                    key={pt.id}
                    className="flex items-center gap-2 px-2 py-1.5 hover:bg-gray-50 rounded cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={filters.projectTypeIds.includes(pt.id)}
                      onChange={() => toggleValue('projectTypeIds', pt.id)}
                      className="w-4 h-4 text-blue-600 rounded"
                    />
                    <span className="text-sm text-gray-700">{pt.name}</span>
                    <span className="text-xs text-gray-400">({pt.code})</span>
                  </label>
                ))
              )}
            </div>
          </FilterDropdown>
        </div>

        {/* Advanced Toggle */}
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg transition-colors ${
            showAdvanced ? 'bg-gray-100 text-gray-700' : 'text-gray-500 hover:bg-gray-100'
          }`}
        >
          <Filter className="w-4 h-4" />
          Advanced
          <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
        </button>

        {/* Active Filter Count & Reset */}
        {activeFilterCount > 0 && (
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-sm text-gray-500">
              {activeFilterCount} filter{activeFilterCount !== 1 ? 's' : ''} active
            </span>
            <button
              onClick={onReset}
              className="flex items-center gap-1 px-2 py-1 text-sm text-red-600 hover:bg-red-50 rounded"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Clear all
            </button>
          </div>
        )}
      </div>

      {/* Advanced Filters Row */}
      {showAdvanced && (
        <div className="flex items-center gap-4 mt-3 pt-3 border-t">
          {/* Entry Type */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-gray-500">Type:</span>
            {(['job_visit', 'assessment', 'meeting', 'blocked'] as ScheduleEntryType[]).map(type => (
              <button
                key={type}
                onClick={() => toggleValue('entryTypes', type)}
                className={`px-2 py-1 text-xs rounded-lg ${
                  filters.entryTypes.includes(type)
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {type === 'job_visit' ? 'Jobs' :
                 type === 'assessment' ? 'Assessments' :
                 type === 'meeting' ? 'Meetings' : 'Blocked'}
              </button>
            ))}
          </div>

          {/* Status */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-gray-500">Status:</span>
            {(['scheduled', 'confirmed', 'in_progress', 'completed'] as ScheduleEntryStatus[]).map(status => (
              <button
                key={status}
                onClick={() => toggleValue('statuses', status)}
                className={`px-2 py-1 text-xs rounded-lg ${
                  filters.statuses.includes(status)
                    ? 'bg-green-100 text-green-700'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' ')}
              </button>
            ))}
          </div>

          {/* Business Unit */}
          {businessUnits && businessUnits.length > 1 && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-gray-500">BU:</span>
              {businessUnits.map(bu => (
                <button
                  key={bu.id}
                  onClick={() => toggleValue('businessUnitIds', bu.id)}
                  className={`px-2 py-1 text-xs rounded-lg ${
                    filters.businessUnitIds.includes(bu.id)
                      ? 'bg-purple-100 text-purple-700'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {bu.name}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================
// FILTER DROPDOWN COMPONENT
// ============================================

interface FilterDropdownProps {
  label: string;
  icon: React.ReactNode;
  selectedCount: number;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

function FilterDropdown({
  label,
  icon,
  selectedCount,
  isOpen,
  onToggle,
  children,
}: FilterDropdownProps) {
  return (
    <div className="relative filter-dropdown">
      <button
        onClick={onToggle}
        className={`flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg border transition-colors ${
          selectedCount > 0
            ? 'bg-blue-50 border-blue-200 text-blue-700'
            : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
        }`}
      >
        {icon}
        <span>{label}</span>
        {selectedCount > 0 && (
          <span className="px-1.5 py-0.5 text-xs bg-blue-600 text-white rounded-full">
            {selectedCount}
          </span>
        )}
        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 min-w-[200px]">
          {children}
        </div>
      )}
    </div>
  );
}
