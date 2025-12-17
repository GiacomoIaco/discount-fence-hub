import { useRef, useState, useCallback, useMemo } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import listPlugin from '@fullcalendar/list';
import resourceTimelinePlugin from '@fullcalendar/resource-timeline';
import type {
  DateSelectArg,
  EventClickArg,
  EventDropArg,
  EventContentArg,
  DatesSetArg,
} from '@fullcalendar/core';
import { format, startOfMonth, endOfMonth, addMonths, subMonths } from 'date-fns';
import { ChevronLeft } from 'lucide-react';

import { useScheduleEntries, useQuickUpdateEntry, useCreateScheduleEntry } from '../hooks/useScheduleEntries';
import { useCrewCapacity } from '../hooks/useCrewCapacity';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import type {
  ScheduleEntry,
  CalendarResource,
  CalendarEvent,
  CreateScheduleEntryInput,
  ScheduleFilters,
} from '../types/schedule.types';
import type { CalendarViewType } from '../hooks/useCalendarViews';
import { filterResources, filterEntries } from '../hooks/useScheduleFilters';
import type { Crew, SalesRep } from '../../fsm/types';
import { EventCard } from './EventCard';
import { ScheduleEntryModal } from './ScheduleEntryModal';
import { UnscheduledJobsSidebar } from './UnscheduledJobsSidebar';
import { InlineCapacity } from './CapacityBar';

// ============================================
// HELPERS
// ============================================

function getEventColor(entry: ScheduleEntry): string {
  if (entry.entry_type === 'job_visit') {
    const materialStatus = entry.job?.material_status;
    switch (materialStatus) {
      case 'staged':
        return '#F59E0B'; // Yellow - ready
      case 'loaded':
        return '#3B82F6'; // Blue - on truck
      case 'completed':
        return '#10B981'; // Green - done
      default:
        return '#6B7280'; // Gray - pending
    }
  }
  if (entry.entry_type === 'assessment') return '#8B5CF6'; // Purple
  if (entry.entry_type === 'blocked') return '#9CA3AF'; // Gray
  if (entry.entry_type === 'meeting') return '#EC4899'; // Pink
  return '#6B7280';
}

function formatEntryTitle(entry: ScheduleEntry): string {
  if (entry.title) return entry.title;

  if (entry.entry_type === 'job_visit') {
    const footage = entry.estimated_footage ? ` (${entry.estimated_footage} LF)` : '';
    const jobNumber = entry.job?.job_number || 'Job';
    const clientName = entry.job?.client_name;
    const jobName = entry.job?.name;

    // For multi-job projects, show job name if available
    if (jobName && entry.job?.project_job_count && entry.job.project_job_count > 1) {
      return clientName ? `${jobName}: ${clientName}${footage}` : `${jobName}${footage}`;
    }

    return clientName ? `${jobNumber}: ${clientName}${footage}` : `${jobNumber}${footage}`;
  }
  if (entry.entry_type === 'assessment') {
    const clientName = entry.service_request?.client_name || 'Client';
    return `Assessment: ${clientName}`;
  }
  if (entry.entry_type === 'blocked') {
    return 'Blocked';
  }
  if (entry.entry_type === 'meeting') {
    return 'Meeting';
  }
  return entry.entry_type;
}

// ============================================
// MAIN COMPONENT
// ============================================

interface ScheduleCalendarProps {
  filters?: ScheduleFilters;
  onNavigateToJob?: (jobId: string) => void;
  onNavigateToRequest?: (requestId: string) => void;
  viewType?: CalendarViewType;
  showCrews?: boolean;
  showReps?: boolean;
}

export function ScheduleCalendar({
  filters,
  // These will be used in Phase 2 for event click navigation
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  onNavigateToJob: _onNavigateToJob,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  onNavigateToRequest: _onNavigateToRequest,
  viewType = 'timeline_week',
  showCrews = true,
  showReps = true,
}: ScheduleCalendarProps) {
  const calendarRef = useRef<FullCalendar>(null);

  // State
  const [dateRange, setDateRange] = useState({
    start: subMonths(startOfMonth(new Date()), 1),
    end: addMonths(endOfMonth(new Date()), 1),
  });
  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    mode: 'create' | 'edit';
    entryId?: string;
    prefillData?: Partial<CreateScheduleEntryInput>;
  }>({
    isOpen: false,
    mode: 'create',
  });
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

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

  // Fetch schedule entries
  const { data: entries = [] } = useScheduleEntries({
    startDate: dateRange.start,
    endDate: dateRange.end,
  });

  // Fetch crew capacity for visible date range
  const { data: capacityData = [] } = useCrewCapacity(dateRange.start, dateRange.end);

  // Build capacity lookup map: crewId -> date -> capacity
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

  // Mutation for drag-drop updates
  const quickUpdate = useQuickUpdateEntry();

  // Mutation for creating new entries (from sidebar drag)
  const createEntry = useCreateScheduleEntry();

  // ─────────────────────────────────────────────────────────────────────────
  // BUILD RESOURCES (Crews + Sales Reps as rows)
  // ─────────────────────────────────────────────────────────────────────────
  const resources: CalendarResource[] = useMemo(() => {
    let result: CalendarResource[] = [];

    // Crews group (respect showCrews prop)
    if (showCrews && crews.length > 0) {
      const crewResources: CalendarResource[] = [];
      crews.forEach((crew) => {
        crewResources.push({
          id: `crew-${crew.id}`,
          parentId: 'crews-group',
          title: crew.name,
          extendedProps: {
            type: 'crew',
            entityId: crew.id,
            maxFootage: crew.max_daily_lf,
            color: '#10B981',
          },
        });
      });

      // Apply filters to crew resources
      const filteredCrewResources = filters
        ? filterResources(crewResources, filters)
        : crewResources;

      if (filteredCrewResources.length > 0) {
        result.push({
          id: 'crews-group',
          title: 'CREWS',
        });
        result = result.concat(filteredCrewResources);
      }
    }

    // Sales Reps group (respect showReps prop)
    if (showReps && salesReps.length > 0) {
      const repResources: CalendarResource[] = [];
      salesReps.forEach((rep) => {
        repResources.push({
          id: `rep-${rep.id}`,
          parentId: 'reps-group',
          title: rep.name,
          extendedProps: {
            type: 'rep',
            entityId: rep.id,
            color: '#3B82F6',
          },
        });
      });

      // Apply filters to rep resources
      const filteredRepResources = filters
        ? filterResources(repResources, filters)
        : repResources;

      if (filteredRepResources.length > 0) {
        result.push({
          id: 'reps-group',
          title: 'SALES REPS',
        });
        result = result.concat(filteredRepResources);
      }
    }

    return result;
  }, [crews, salesReps, filters, showCrews, showReps]);

  // ─────────────────────────────────────────────────────────────────────────
  // BUILD EVENTS from schedule entries
  // ─────────────────────────────────────────────────────────────────────────
  const events: CalendarEvent[] = useMemo(() => {
    // Apply filters to entries
    const filteredEntries = filters ? filterEntries(entries, filters) : entries;

    return filteredEntries.map((entry) => {
      const resourceId = entry.crew_id
        ? `crew-${entry.crew_id}`
        : entry.sales_rep_id
        ? `rep-${entry.sales_rep_id}`
        : 'crews-group'; // Fallback to group if no assignment

      const color = getEventColor(entry);

      return {
        id: entry.id,
        resourceId,
        title: formatEntryTitle(entry),
        start: entry.start_time
          ? `${entry.scheduled_date}T${entry.start_time}`
          : entry.scheduled_date,
        end: entry.end_time
          ? `${entry.scheduled_date}T${entry.end_time}`
          : undefined,
        allDay: entry.is_all_day || !entry.start_time,
        backgroundColor: color,
        borderColor: color,
        textColor: '#ffffff',
        extendedProps: {
          entryType: entry.entry_type,
          status: entry.status,
          jobId: entry.job_id,
          serviceRequestId: entry.service_request_id,
          footage: entry.estimated_footage,
          hours: entry.estimated_hours,
          materialStatus: entry.job?.material_status,
          // Project context for multi-job projects
          projectId: entry.job?.project_id || null,
          projectNumber: entry.job?.project_number || null,
          jobName: entry.job?.name || null,
          isMultiJobProject: (entry.job?.project_job_count || 0) > 1,
          invoiceGroupId: entry.job?.invoice_group_id || null,
          entry,
        },
      };
    });
  }, [entries, filters]);

  // ─────────────────────────────────────────────────────────────────────────
  // EVENT HANDLERS
  // ─────────────────────────────────────────────────────────────────────────

  const handleEventClick = useCallback(
    (info: EventClickArg) => {
      const entry = info.event.extendedProps.entry as ScheduleEntry;

      // Open modal for editing
      setModalState({
        isOpen: true,
        mode: 'edit',
        entryId: entry.id,
      });
    },
    []
  );

  const handleEventDrop = useCallback(
    async (info: EventDropArg) => {
      const { event, newResource } = info;
      const entryId = event.id;

      // Parse new assignment from resource
      let crewId: string | null = null;
      let salesRepId: string | null = null;

      if (newResource) {
        const resourceId = newResource.id;
        if (resourceId.startsWith('crew-')) {
          crewId = resourceId.replace('crew-', '');
        } else if (resourceId.startsWith('rep-')) {
          salesRepId = resourceId.replace('rep-', '');
        }
      } else {
        // Keep existing assignment if just moving date
        const entry = event.extendedProps.entry as ScheduleEntry;
        crewId = entry.crew_id;
        salesRepId = entry.sales_rep_id;
      }

      try {
        await quickUpdate.mutateAsync({
          id: entryId,
          scheduled_date: format(event.start!, 'yyyy-MM-dd'),
          start_time: event.allDay ? null : format(event.start!, 'HH:mm'),
          end_time: event.end && !event.allDay ? format(event.end, 'HH:mm') : null,
          crew_id: crewId,
          sales_rep_id: salesRepId,
        });
      } catch (error) {
        // Revert on error
        info.revert();
      }
    },
    [quickUpdate]
  );

  const handleDateSelect = useCallback((info: DateSelectArg) => {
    const resourceId = info.resource?.id;
    let crewId: string | null = null;
    let salesRepId: string | null = null;

    if (resourceId?.startsWith('crew-')) {
      crewId = resourceId.replace('crew-', '');
    } else if (resourceId?.startsWith('rep-')) {
      salesRepId = resourceId.replace('rep-', '');
    }

    // Open create modal with prefilled data
    setModalState({
      isOpen: true,
      mode: 'create',
      prefillData: {
        scheduled_date: format(info.start, 'yyyy-MM-dd'),
        start_time: info.allDay ? null : format(info.start, 'HH:mm'),
        end_time: info.end && !info.allDay ? format(info.end, 'HH:mm') : null,
        crew_id: crewId,
        sales_rep_id: salesRepId,
        entry_type: crewId ? 'job_visit' : salesRepId ? 'assessment' : 'blocked',
      },
    });
  }, []);

  const handleDatesSet = useCallback((dateInfo: DatesSetArg) => {
    // Expand range slightly for smoother navigation
    setDateRange({
      start: subMonths(dateInfo.start, 1),
      end: addMonths(dateInfo.end, 1),
    });
  }, []);

  // Custom event rendering
  const renderEventContent = useCallback((eventContent: EventContentArg) => {
    return <EventCard event={eventContent.event} timeText={eventContent.timeText} />;
  }, []);

  const handleCloseModal = useCallback(() => {
    setModalState({ isOpen: false, mode: 'create' });
  }, []);

  // Handle external events dropped from sidebar
  const handleEventReceive = useCallback(
    async (info: { event: { extendedProps: Record<string, unknown>; start: Date | null; end: Date | null; allDay: boolean; getResources: () => { id: string }[]; remove: () => void } }) => {
      const { event } = info;
      const jobId = event.extendedProps.jobId as string;
      const footage = event.extendedProps.footage as number | null;

      // Get crew assignment from resource
      let crewId: string | null = null;
      const resourceId = event.getResources()[0]?.id;
      if (resourceId?.startsWith('crew-')) {
        crewId = resourceId.replace('crew-', '');
      }

      // Remove the temporary event (we'll create a real one)
      event.remove();

      // Create a new schedule entry
      try {
        await createEntry.mutateAsync({
          entry_type: 'job_visit',
          job_id: jobId,
          crew_id: crewId,
          scheduled_date: format(event.start!, 'yyyy-MM-dd'),
          start_time: event.allDay ? null : format(event.start!, 'HH:mm'),
          end_time: event.end && !event.allDay ? format(event.end, 'HH:mm') : null,
          estimated_footage: footage,
        });
      } catch (error) {
        console.error('Failed to create schedule entry:', error);
      }
    },
    [createEntry]
  );

  // Map viewType prop to FullCalendar view names
  const fullCalendarView = useMemo(() => {
    switch (viewType) {
      case 'timeline_day':
        return 'resourceTimelineDay';
      case 'timeline_week':
        return 'resourceTimelineWeek';
      case 'month':
        return 'dayGridMonth';
      case 'list':
        return 'listWeek';
      default:
        return 'resourceTimelineWeek';
    }
  }, [viewType]);

  // Custom resource label rendering with capacity
  const renderResourceLabel = useCallback(
    (arg: { resource: { id: string; title: string; extendedProps?: Record<string, unknown> } }) => {
      const { resource } = arg;
      const props = resource.extendedProps || {};
      const isGroup = resource.id === 'crews-group' || resource.id === 'reps-group';

      if (isGroup) {
        return (
          <div className="font-semibold text-xs text-gray-500 uppercase tracking-wide py-1">
            {resource.title}
          </div>
        );
      }

      const isCrew = props.type === 'crew';
      const maxFootage = (props.maxFootage as number) || 200;

      // Get today's capacity for this crew
      const today = format(new Date(), 'yyyy-MM-dd');
      const todayCapacity = isCrew && props.entityId
        ? capacityMap.get(props.entityId as string)?.get(today)
        : null;

      return (
        <div className="py-1">
          <div className="font-medium text-sm text-gray-900">{resource.title}</div>
          {isCrew && (
            <InlineCapacity
              scheduledFootage={todayCapacity?.scheduled ?? 0}
              maxFootage={maxFootage}
              jobCount={todayCapacity?.jobs}
            />
          )}
        </div>
      );
    },
    [capacityMap]
  );

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="h-full flex">
      {/* Main Calendar Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Calendar */}
        <div className="flex-1 overflow-hidden bg-white rounded-lg border">
          <FullCalendar
            ref={calendarRef}
            plugins={[
              dayGridPlugin,
              timeGridPlugin,
              interactionPlugin,
              listPlugin,
              resourceTimelinePlugin,
            ]}
            initialView={fullCalendarView}
            // Header toolbar
            headerToolbar={{
              left: 'prev,next today',
              center: 'title',
              right: 'resourceTimelineDay,resourceTimelineWeek,dayGridMonth,listWeek',
            }}
            // Button text
            buttonText={{
              today: 'Today',
              day: 'Day',
              week: 'Week',
              month: 'Month',
              list: 'List',
            }}
            // Resources (crews + reps as rows)
            resources={resources}
            resourceAreaHeaderContent="Crews & Reps"
            resourceAreaWidth="200px"
            resourceGroupField="parentId"
            resourceLabelContent={renderResourceLabel}
            // Events
            events={events}
            eventContent={renderEventContent}
            eventClick={handleEventClick}
            eventDrop={handleEventDrop}
            eventReceive={handleEventReceive}
            eventResize={(info) => {
              // Handle resize similar to drop
              const { event } = info;
              const entry = event.extendedProps.entry as ScheduleEntry;
              quickUpdate.mutate({
                id: event.id,
                scheduled_date: format(event.start!, 'yyyy-MM-dd'),
                start_time: event.allDay ? null : format(event.start!, 'HH:mm'),
                end_time: event.end && !event.allDay ? format(event.end, 'HH:mm') : null,
                crew_id: entry.crew_id,
                sales_rep_id: entry.sales_rep_id,
              });
            }}
            // Interaction
            editable={true}
            selectable={true}
            selectMirror={true}
            select={handleDateSelect}
            droppable={true}
            // Time settings
            slotMinTime="06:00:00"
            slotMaxTime="20:00:00"
            slotDuration="00:30:00"
            scrollTime="07:00:00"
            // Display
            nowIndicator={true}
            dayMaxEvents={true}
            weekends={true}
            height="100%"
            // Loading - can add spinner later
            loading={() => {}}
            // Date change handler
            datesSet={handleDatesSet}
            // Business hours (visual highlighting)
            businessHours={{
              daysOfWeek: [1, 2, 3, 4, 5, 6], // Mon-Sat
              startTime: '07:00',
              endTime: '18:00',
            }}
            // Slot label format
            slotLabelFormat={{
              hour: 'numeric',
              minute: '2-digit',
              meridiem: 'short',
            }}
          />
        </div>
      </div>

      {/* Sidebar Toggle Button (when collapsed) */}
      {sidebarCollapsed && (
        <button
          onClick={() => setSidebarCollapsed(false)}
          className="absolute right-0 top-1/2 -translate-y-1/2 bg-white border border-r-0 rounded-l-lg p-2 shadow-sm hover:bg-gray-50 z-10"
          title="Show unscheduled jobs"
        >
          <ChevronLeft className="w-4 h-4 text-gray-600" />
        </button>
      )}

      {/* Unscheduled Jobs Sidebar */}
      <UnscheduledJobsSidebar
        isCollapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
      />

      {/* Modal */}
      <ScheduleEntryModal
        isOpen={modalState.isOpen}
        mode={modalState.mode}
        entryId={modalState.entryId}
        prefillData={modalState.prefillData}
        onClose={handleCloseModal}
        crews={crews}
        salesReps={salesReps}
      />
    </div>
  );
}
