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

import { useScheduleEntries, useQuickUpdateEntry } from '../hooks/useScheduleEntries';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import type {
  ScheduleEntry,
  CalendarResource,
  CalendarEvent,
  CreateScheduleEntryInput,
} from '../types/schedule.types';
import type { Crew, SalesRep } from '../../fsm/types';
import { EventCard } from './EventCard';
import { ScheduleEntryModal } from './ScheduleEntryModal';

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
  onNavigateToJob?: (jobId: string) => void;
  onNavigateToRequest?: (requestId: string) => void;
}

export function ScheduleCalendar({
  // These will be used in Phase 2 for event click navigation
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  onNavigateToJob: _onNavigateToJob,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  onNavigateToRequest: _onNavigateToRequest,
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

  // Mutation for drag-drop updates
  const quickUpdate = useQuickUpdateEntry();

  // ─────────────────────────────────────────────────────────────────────────
  // BUILD RESOURCES (Crews + Sales Reps as rows)
  // ─────────────────────────────────────────────────────────────────────────
  const resources: CalendarResource[] = useMemo(() => {
    const result: CalendarResource[] = [];

    // Crews group
    if (crews.length > 0) {
      result.push({
        id: 'crews-group',
        title: 'CREWS',
      });
      crews.forEach((crew) => {
        result.push({
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
    }

    // Sales Reps group
    if (salesReps.length > 0) {
      result.push({
        id: 'reps-group',
        title: 'SALES REPS',
      });
      salesReps.forEach((rep) => {
        result.push({
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
    }

    return result;
  }, [crews, salesReps]);

  // ─────────────────────────────────────────────────────────────────────────
  // BUILD EVENTS from schedule entries
  // ─────────────────────────────────────────────────────────────────────────
  const events: CalendarEvent[] = useMemo(() => {
    return entries.map((entry) => {
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
          entry,
        },
      };
    });
  }, [entries]);

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

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="h-full flex flex-col">
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
          initialView="resourceTimelineWeek"
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
          resourceAreaWidth="180px"
          resourceGroupField="parentId"
          // Events
          events={events}
          eventContent={renderEventContent}
          eventClick={handleEventClick}
          eventDrop={handleEventDrop}
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
