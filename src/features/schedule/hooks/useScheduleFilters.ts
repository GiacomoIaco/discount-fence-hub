import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { useFsmTeamProfile } from '../../fsm/hooks/useFsmTeamProfiles';
import type {
  ScheduleFilters,
  FilterPreset,
  CalendarResource,
  ScheduleEntry,
} from '../types/schedule.types';
import { DEFAULT_SCHEDULE_FILTERS } from '../types/schedule.types';

const STORAGE_KEY = 'schedule_filters';

// ============================================
// SCHEDULE FILTERS HOOK
// ============================================

export function useScheduleFilters() {
  const { user } = useAuth();
  const { data: myProfile } = useFsmTeamProfile(user?.id);

  // Initialize from localStorage or defaults
  const [filters, setFiltersInternal] = useState<ScheduleFilters>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return { ...DEFAULT_SCHEDULE_FILTERS, ...JSON.parse(stored) };
      }
    } catch {
      // Ignore parse errors
    }
    return DEFAULT_SCHEDULE_FILTERS;
  });

  // Persist to localStorage on change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(filters));
    } catch {
      // Ignore storage errors
    }
  }, [filters]);

  // Update filters
  const setFilters = useCallback((newFilters: Partial<ScheduleFilters>) => {
    setFiltersInternal(prev => ({ ...prev, ...newFilters }));
  }, []);

  // Reset all filters
  const resetFilters = useCallback(() => {
    setFiltersInternal(DEFAULT_SCHEDULE_FILTERS);
  }, []);

  // Toggle a value in an array filter
  const toggleArrayFilter = useCallback(<K extends keyof ScheduleFilters>(
    key: K,
    value: string
  ) => {
    setFiltersInternal(prev => {
      const arr = prev[key] as string[];
      const newArr = arr.includes(value)
        ? arr.filter(v => v !== value)
        : [...arr, value];
      return { ...prev, [key]: newArr };
    });
  }, []);

  // Set array filter (replace all values)
  const setArrayFilter = useCallback(<K extends keyof ScheduleFilters>(
    key: K,
    values: string[]
  ) => {
    setFiltersInternal(prev => ({ ...prev, [key]: values }));
  }, []);

  // Set preset
  const setPreset = useCallback((preset: FilterPreset) => {
    // When setting a preset, clear manual filters
    if (preset === 'all') {
      setFiltersInternal({ ...DEFAULT_SCHEDULE_FILTERS, preset: 'all' });
    } else if (preset === 'my_schedule' && myProfile?.profile) {
      // Filter to current user's assignments
      const crewIds = myProfile.profile.crew_id ? [myProfile.profile.crew_id] : [];
      setFiltersInternal({
        ...DEFAULT_SCHEDULE_FILTERS,
        preset: 'my_schedule',
        crewIds,
        repIds: [user?.id || ''],
      });
    } else if (preset === 'needs_attention') {
      // Show items needing attention (not scheduled, missing crew, etc.)
      setFiltersInternal({
        ...DEFAULT_SCHEDULE_FILTERS,
        preset: 'needs_attention',
        statuses: ['scheduled'], // Only scheduled (not confirmed yet)
      });
    } else if (preset === 'over_capacity') {
      setFiltersInternal({
        ...DEFAULT_SCHEDULE_FILTERS,
        preset: 'over_capacity',
      });
    } else if (preset === 'unassigned') {
      setFiltersInternal({
        ...DEFAULT_SCHEDULE_FILTERS,
        preset: 'unassigned',
      });
    } else {
      setFiltersInternal(prev => ({ ...prev, preset }));
    }
  }, [myProfile, user]);

  // Check if any filters are active
  const hasActiveFilters = useMemo(() => {
    return (
      filters.crewIds.length > 0 ||
      filters.repIds.length > 0 ||
      filters.territoryIds.length > 0 ||
      filters.projectTypeIds.length > 0 ||
      filters.entryTypes.length > 0 ||
      filters.statuses.length > 0 ||
      filters.businessUnitIds.length > 0 ||
      filters.preset !== 'all' ||
      filters.searchQuery.length > 0
    );
  }, [filters]);

  // Count active filters
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.crewIds.length > 0) count++;
    if (filters.repIds.length > 0) count++;
    if (filters.territoryIds.length > 0) count++;
    if (filters.projectTypeIds.length > 0) count++;
    if (filters.entryTypes.length > 0) count++;
    if (filters.statuses.length > 0) count++;
    if (filters.businessUnitIds.length > 0) count++;
    if (filters.searchQuery.length > 0) count++;
    return count;
  }, [filters]);

  return {
    filters,
    setFilters,
    resetFilters,
    toggleArrayFilter,
    setArrayFilter,
    setPreset,
    hasActiveFilters,
    activeFilterCount,
  };
}

// ============================================
// FILTER APPLICATION HELPERS
// ============================================

/**
 * Filter resources (crews/reps) based on current filters
 */
export function filterResources(
  resources: CalendarResource[],
  filters: ScheduleFilters
): CalendarResource[] {
  // If no filters active, return all
  if (
    filters.crewIds.length === 0 &&
    filters.repIds.length === 0 &&
    filters.businessUnitIds.length === 0
  ) {
    return resources;
  }

  return resources.filter(resource => {
    const type = resource.extendedProps?.type;
    const entityId = resource.extendedProps?.entityId;

    if (!entityId) return false;

    // Filter by specific IDs
    if (type === 'crew' && filters.crewIds.length > 0) {
      if (!filters.crewIds.includes(entityId)) return false;
    }
    if (type === 'rep' && filters.repIds.length > 0) {
      if (!filters.repIds.includes(entityId)) return false;
    }

    return true;
  });
}

/**
 * Filter schedule entries based on current filters
 */
export function filterEntries(
  entries: ScheduleEntry[],
  filters: ScheduleFilters
): ScheduleEntry[] {
  return entries.filter(entry => {
    // Entry type filter
    if (filters.entryTypes.length > 0) {
      if (!filters.entryTypes.includes(entry.entry_type)) return false;
    }

    // Status filter
    if (filters.statuses.length > 0) {
      if (!filters.statuses.includes(entry.status)) return false;
    }

    // Crew filter
    if (filters.crewIds.length > 0) {
      if (!entry.crew_id || !filters.crewIds.includes(entry.crew_id)) return false;
    }

    // Rep filter
    if (filters.repIds.length > 0) {
      if (!entry.sales_rep_id || !filters.repIds.includes(entry.sales_rep_id)) return false;
    }

    // Search query (searches title and client name)
    if (filters.searchQuery) {
      const query = filters.searchQuery.toLowerCase();
      const title = entry.title?.toLowerCase() || '';
      const clientName = entry.job?.client_name?.toLowerCase() || '';
      const jobNumber = entry.job?.job_number?.toLowerCase() || '';
      if (!title.includes(query) && !clientName.includes(query) && !jobNumber.includes(query)) {
        return false;
      }
    }

    // Preset: unassigned
    if (filters.preset === 'unassigned') {
      if (entry.crew_id || entry.sales_rep_id) return false;
    }

    return true;
  });
}
