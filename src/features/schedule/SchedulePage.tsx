import { useState, useCallback, useMemo } from 'react';
import { Calendar } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { startOfMonth, endOfMonth, addMonths, subMonths } from 'date-fns';
import { supabase } from '../../lib/supabase';
import { ScheduleCalendar } from './components/ScheduleCalendar';
import { CrewCapacityView } from './components/views/CrewCapacityView';
import { ViewTabManager } from './components/views/ViewTabManager';
import FilterBar from './components/FilterBar';
import { ScheduleEntryModal } from './components/ScheduleEntryModal';
import { useScheduleFilters } from './hooks/useScheduleFilters';
import { useCalendarViews } from './hooks/useCalendarViews';
import { useScheduleEntries } from './hooks/useScheduleEntries';
import { useCrewCapacity } from './hooks/useCrewCapacity';
import { useScheduleRealtime } from './hooks/useScheduleRealtime';
import type { Crew, SalesRep } from '../fsm/types';
import type { CreateScheduleEntryInput } from './types/schedule.types';

// ============================================
// SCHEDULE PAGE
// Main entry point for the scheduling feature
// ============================================

interface SchedulePageProps {
  onBack?: () => void;
  onNavigateToRequest?: (requestId: string) => void;
  onNavigateToJob?: (jobId: string) => void;
}

export default function SchedulePage({
  onNavigateToRequest,
  onNavigateToJob,
}: SchedulePageProps) {
  // Filter state
  const {
    filters,
    setFilters,
    resetFilters,
    setPreset,
    activeFilterCount,
  } = useScheduleFilters();

  // View tab state
  const {
    tabs,
    activeTab,
    activeTabId,
    setActiveTab,
    updateTab,
    addTab,
    removeTab,
    isCrewCapacityView,
  } = useCalendarViews();

  // Real-time updates subscription
  useScheduleRealtime();

  // Modal state for CrewCapacityView
  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    mode: 'create' | 'edit';
    entryId?: string;
    prefillData?: Partial<CreateScheduleEntryInput>;
  }>({
    isOpen: false,
    mode: 'create',
  });

  // Date range for data fetching
  const [dateRange] = useState({
    start: subMonths(startOfMonth(new Date()), 1),
    end: addMonths(endOfMonth(new Date()), 2),
  });

  // Fetch crews
  const { data: crews = [] } = useQuery({
    queryKey: ['crews', 'active'],
    queryFn: async (): Promise<Crew[]> => {
      const { data, error } = await supabase
        .from('crews')
        .select('*')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch sales reps
  const { data: salesReps = [] } = useQuery({
    queryKey: ['sales_reps', 'active'],
    queryFn: async (): Promise<SalesRep[]> => {
      const { data, error } = await supabase
        .from('sales_reps')
        .select('*')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch schedule entries (shared by both views)
  const { data: entries = [] } = useScheduleEntries({
    startDate: dateRange.start,
    endDate: dateRange.end,
  });

  // Fetch crew capacity
  const { data: capacityData = [] } = useCrewCapacity(dateRange.start, dateRange.end);

  // Build capacity lookup map
  const capacityMap = useMemo(() => {
    const map = new Map<string, Map<string, { scheduled: number; max: number; jobs: number }>>();
    capacityData.forEach((cap) => {
      if (!map.has(cap.crew_id)) {
        map.set(cap.crew_id, new Map());
      }
      map.get(cap.crew_id)!.set(cap.capacity_date, {
        scheduled: cap.scheduled_footage,
        max: cap.max_footage,
        jobs: cap.job_count,
      });
    });
    return map;
  }, [capacityData]);

  // Handlers for CrewCapacityView
  const handleEntryClick = useCallback((entryId: string) => {
    setModalState({
      isOpen: true,
      mode: 'edit',
      entryId,
    });
  }, []);

  const handleCreateEntry = useCallback((prefill: Partial<CreateScheduleEntryInput>) => {
    setModalState({
      isOpen: true,
      mode: 'create',
      prefillData: prefill,
    });
  }, []);

  const handleCloseModal = useCallback(() => {
    setModalState({ isOpen: false, mode: 'create' });
  }, []);

  // Apply tab-specific filter overrides
  const effectiveFilters = useMemo(() => {
    // If tab specifies showCrews=false, filter out all crews
    // If tab specifies showReps=false, filter out all reps
    // This is additive to user filters
    return filters;
  }, [filters]);

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Calendar className="w-7 h-7 text-blue-600" />
              Schedule
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Manage crew schedules, assessments, and appointments
            </p>
          </div>

          {/* View Tabs */}
          <ViewTabManager
            tabs={tabs}
            activeTabId={activeTabId}
            onSelectTab={setActiveTab}
            onUpdateTab={updateTab}
            onAddTab={addTab}
            onRemoveTab={removeTab}
          />
        </div>
      </div>

      {/* Filter Bar */}
      <FilterBar
        filters={filters}
        onFilterChange={setFilters}
        onPresetChange={setPreset}
        onReset={resetFilters}
        activeFilterCount={activeFilterCount}
      />

      {/* Calendar View (conditionally rendered based on active tab) */}
      <div className="flex-1 p-4 overflow-hidden">
        {isCrewCapacityView ? (
          <CrewCapacityView
            crews={crews}
            entries={entries}
            capacityMap={capacityMap}
            filters={effectiveFilters}
            daysToShow={activeTab.daysToShow || 5}
            onEntryClick={handleEntryClick}
            onCreateEntry={handleCreateEntry}
          />
        ) : (
          <ScheduleCalendar
            filters={effectiveFilters}
            onNavigateToJob={onNavigateToJob}
            onNavigateToRequest={onNavigateToRequest}
            viewType={activeTab.viewType}
            showCrews={activeTab.showCrews}
            showReps={activeTab.showReps}
          />
        )}
      </div>

      {/* Modal for CrewCapacityView (ScheduleCalendar has its own) */}
      {isCrewCapacityView && (
        <ScheduleEntryModal
          isOpen={modalState.isOpen}
          mode={modalState.mode}
          entryId={modalState.entryId}
          prefillData={modalState.prefillData}
          onClose={handleCloseModal}
          crews={crews}
          salesReps={salesReps}
        />
      )}
    </div>
  );
}
