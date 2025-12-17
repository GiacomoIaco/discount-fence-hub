import { useMemo, useState, useCallback } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import {
  format,
  addDays,
  startOfWeek,
  isToday,
  isWeekend,
  isSameDay,
} from 'date-fns';
import type { ScheduleEntry, ScheduleFilters, CreateScheduleEntryInput } from '../../types/schedule.types';
import type { Crew } from '../../../fsm/types';
import { CapacityCell, entryToCellJob } from '../cells/CapacityCell';
import type { CapacityCellData, CapacityCellJob } from '../cells/CapacityCell';
import { filterEntries } from '../../hooks/useScheduleFilters';

// ============================================
// CREW CAPACITY VIEW
// ============================================

interface CrewCapacityViewProps {
  crews: Crew[];
  entries: ScheduleEntry[];
  capacityMap: Map<string, Map<string, { scheduled: number; max: number; jobs: number }>>;
  filters?: ScheduleFilters;
  daysToShow?: number;
  onEntryClick?: (entryId: string) => void;
  onCellClick?: (crewId: string, date: string) => void;
  onCreateEntry?: (prefill: Partial<CreateScheduleEntryInput>) => void;
}

export function CrewCapacityView({
  crews,
  entries,
  capacityMap,
  filters,
  daysToShow = 5,
  onEntryClick,
  onCreateEntry,
}: CrewCapacityViewProps) {
  // Current week start date
  const [weekStart, setWeekStart] = useState(() =>
    startOfWeek(new Date(), { weekStartsOn: 1 }) // Monday
  );

  // Generate dates array for the view
  const dates = useMemo(() => {
    const result: Date[] = [];
    for (let i = 0; i < daysToShow; i++) {
      result.push(addDays(weekStart, i));
    }
    return result;
  }, [weekStart, daysToShow]);

  // Filter crews based on filters
  const filteredCrews = useMemo(() => {
    if (!filters || filters.crewIds.length === 0) {
      return crews.filter(c => c.is_active);
    }
    return crews.filter(c => c.is_active && filters.crewIds.includes(c.id));
  }, [crews, filters]);

  // Filter entries
  const filteredEntries = useMemo(() => {
    const filtered = filters ? filterEntries(entries, filters) : entries;
    // Only include job_visit entries (crews don't do assessments)
    return filtered.filter(e => e.entry_type === 'job_visit' && e.crew_id);
  }, [entries, filters]);

  // Group entries by crew and date
  const entriesByCrewDate = useMemo(() => {
    const map = new Map<string, Map<string, ScheduleEntry[]>>();

    filteredEntries.forEach(entry => {
      if (!entry.crew_id) return;

      if (!map.has(entry.crew_id)) {
        map.set(entry.crew_id, new Map());
      }

      const crewMap = map.get(entry.crew_id)!;
      const dateKey = entry.scheduled_date;

      if (!crewMap.has(dateKey)) {
        crewMap.set(dateKey, []);
      }
      crewMap.get(dateKey)!.push(entry);
    });

    return map;
  }, [filteredEntries]);

  // Build cell data for each crew + date combination
  const getCellData = useCallback(
    (crew: Crew, date: Date): CapacityCellData => {
      const dateKey = format(date, 'yyyy-MM-dd');
      const crewEntries = entriesByCrewDate.get(crew.id)?.get(dateKey) || [];
      const maxFootage = crew.max_daily_lf || 200;

      // Get capacity info if available
      const capacityInfo = capacityMap.get(crew.id)?.get(dateKey);

      // Convert entries to cell jobs
      const jobs: CapacityCellJob[] = crewEntries.map(entry =>
        entryToCellJob(entry, maxFootage)
      );

      // Calculate totals
      const totalFootage = capacityInfo?.scheduled ?? jobs.reduce((sum, job) => sum + job.footage, 0);
      const totalPercent = maxFootage > 0
        ? Math.round((totalFootage / maxFootage) * 100)
        : 0;

      return {
        crewId: crew.id,
        date: dateKey,
        jobs,
        totalFootage,
        maxFootage,
        totalPercent,
        isOverCapacity: totalPercent > 100,
        isWeekend: isWeekend(date),
        isToday: isToday(date),
      };
    },
    [entriesByCrewDate, capacityMap]
  );

  // Navigation
  const goToPreviousWeek = () => setWeekStart(prev => addDays(prev, -7));
  const goToNextWeek = () => setWeekStart(prev => addDays(prev, 7));
  const goToToday = () => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }));

  // Check if today is visible
  const todayVisible = dates.some(d => isSameDay(d, new Date()));

  // Handle cell click - open create modal
  const handleCellClick = useCallback(
    (crewId: string, date: string) => {
      onCreateEntry?.({
        entry_type: 'job_visit',
        crew_id: crewId,
        scheduled_date: date,
      });
    },
    [onCreateEntry]
  );

  return (
    <div className="h-full flex flex-col bg-white rounded-lg border overflow-hidden">
      {/* Header with navigation */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-gray-50">
        <div className="flex items-center gap-2">
          <button
            onClick={goToPreviousWeek}
            className="p-1.5 hover:bg-gray-200 rounded transition-colors"
            title="Previous week"
          >
            <ChevronLeft className="w-5 h-5 text-gray-600" />
          </button>
          <button
            onClick={goToNextWeek}
            className="p-1.5 hover:bg-gray-200 rounded transition-colors"
            title="Next week"
          >
            <ChevronRight className="w-5 h-5 text-gray-600" />
          </button>
          {!todayVisible && (
            <button
              onClick={goToToday}
              className="px-3 py-1 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded transition-colors"
            >
              Today
            </button>
          )}
        </div>

        <h2 className="text-lg font-semibold text-gray-900">
          {format(dates[0], 'MMM d')} - {format(dates[dates.length - 1], 'MMM d, yyyy')}
        </h2>

        <div className="text-sm text-gray-500">
          {filteredCrews.length} crew{filteredCrews.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-auto">
        <table className="w-full border-collapse">
          {/* Date headers */}
          <thead className="sticky top-0 z-10 bg-white">
            <tr>
              <th className="w-40 min-w-[160px] px-3 py-2 text-left text-sm font-semibold text-gray-700 border-b border-r bg-gray-50">
                Crew
              </th>
              {dates.map((date) => (
                <th
                  key={date.toISOString()}
                  className={`
                    min-w-[140px] px-2 py-2 text-center text-sm font-semibold border-b
                    ${isToday(date) ? 'bg-blue-50 text-blue-700' : 'bg-gray-50 text-gray-700'}
                    ${isWeekend(date) ? 'text-gray-500' : ''}
                  `}
                >
                  <div>{format(date, 'EEE')}</div>
                  <div className="text-xs font-normal opacity-75">
                    {format(date, 'MMM d')}
                  </div>
                </th>
              ))}
            </tr>
          </thead>

          {/* Crew rows */}
          <tbody>
            {filteredCrews.length === 0 ? (
              <tr>
                <td
                  colSpan={dates.length + 1}
                  className="px-4 py-8 text-center text-gray-500"
                >
                  No crews to display. Adjust your filters or add crews.
                </td>
              </tr>
            ) : (
              filteredCrews.map((crew) => (
                <tr key={crew.id} className="group">
                  {/* Crew name cell */}
                  <td className="px-3 py-2 border-r border-b bg-gray-50 align-top">
                    <div className="font-medium text-sm text-gray-900">
                      {crew.name}
                    </div>
                    <div className="text-xs text-gray-500">
                      {crew.code} • {crew.max_daily_lf || 200} LF/day
                    </div>
                  </td>

                  {/* Date cells */}
                  {dates.map((date) => {
                    const cellData = getCellData(crew, date);
                    return (
                      <td
                        key={date.toISOString()}
                        className="p-0 align-top"
                      >
                        <CapacityCell
                          data={cellData}
                          onJobClick={onEntryClick}
                          onCellClick={handleCellClick}
                        />
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-6 px-4 py-2 border-t bg-gray-50 text-xs">
        <div className="flex items-center gap-4">
          <span className="text-gray-600 font-medium">Material Status:</span>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-gray-200 border border-gray-300" />
            <span className="text-gray-600">Pending</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-yellow-200 border border-yellow-300" />
            <span className="text-gray-600">Staged</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-blue-200 border border-blue-300" />
            <span className="text-gray-600">Loaded</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-green-200 border border-green-300" />
            <span className="text-gray-600">Complete</span>
          </div>
        </div>
        <div className="flex items-center gap-4 ml-auto">
          <span className="text-gray-600 font-medium">Capacity:</span>
          <div className="flex items-center gap-1">
            <div className="w-8 h-2 rounded-full bg-green-500" />
            <span className="text-gray-600">≤80%</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-8 h-2 rounded-full bg-yellow-500" />
            <span className="text-gray-600">80-100%</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-8 h-2 rounded-full bg-red-500" />
            <span className="text-gray-600">&gt;100%</span>
          </div>
        </div>
      </div>
    </div>
  );
}
