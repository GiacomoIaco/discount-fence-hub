// Schedule Feature Types
import type { Crew, SalesRep, Job, ServiceRequest } from '../../fsm/types';

// ============================================
// SCHEDULE ENTRY TYPES
// ============================================

export type ScheduleEntryType = 'job_visit' | 'assessment' | 'blocked' | 'meeting';

export type ScheduleEntryStatus = 'scheduled' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled';

export interface ScheduleEntry {
  id: string;
  entry_type: ScheduleEntryType;

  // Source entity references
  job_id: string | null;
  service_request_id: string | null;

  // Assignment
  crew_id: string | null;
  sales_rep_id: string | null;

  // Timing
  scheduled_date: string; // YYYY-MM-DD
  start_time: string | null; // HH:MM
  end_time: string | null; // HH:MM
  is_all_day: boolean;

  // Multi-day support
  is_multi_day: boolean;
  multi_day_sequence: number | null;
  parent_entry_id: string | null;
  total_days: number;

  // Capacity tracking
  estimated_footage: number | null;
  estimated_hours: number | null;

  // Status
  status: ScheduleEntryStatus;

  // Display
  title: string | null;
  notes: string | null;
  color: string | null;

  // Location (denormalized)
  location_address: string | null;
  location_city: string | null;
  location_zip: string | null;

  // Metadata
  created_by: string | null;
  created_at: string;
  updated_at: string;

  // Joined relations (populated by select queries)
  job?: Partial<Job> & {
    job_number?: string;
    client_name?: string;
    material_status?: string;
    name?: string;
    project_id?: string;
    project_number?: string;
    project_job_count?: number;
    invoice_group_id?: string;
  };
  service_request?: Partial<ServiceRequest> & { client_name?: string; request_number?: string };
  crew?: Pick<Crew, 'id' | 'name' | 'code'>;
  sales_rep?: Pick<SalesRep, 'id' | 'name'>;
}

// ============================================
// CREATE/UPDATE INPUTS
// ============================================

export interface CreateScheduleEntryInput {
  entry_type: ScheduleEntryType;
  job_id?: string | null;
  service_request_id?: string | null;
  crew_id?: string | null;
  sales_rep_id?: string | null;
  scheduled_date: string;
  start_time?: string | null;
  end_time?: string | null;
  is_all_day?: boolean;
  estimated_footage?: number | null;
  estimated_hours?: number | null;
  title?: string | null;
  notes?: string | null;
  color?: string | null;
  location_address?: string | null;
  location_city?: string | null;
  location_zip?: string | null;
}

export interface UpdateScheduleEntryInput {
  id: string;
  crew_id?: string | null;
  sales_rep_id?: string | null;
  scheduled_date?: string;
  start_time?: string | null;
  end_time?: string | null;
  is_all_day?: boolean;
  estimated_footage?: number | null;
  estimated_hours?: number | null;
  status?: ScheduleEntryStatus;
  title?: string | null;
  notes?: string | null;
  color?: string | null;
}

// ============================================
// CREW CAPACITY
// ============================================

export interface CrewDailyCapacity {
  id: string;
  crew_id: string;
  capacity_date: string; // YYYY-MM-DD
  max_footage: number;
  scheduled_footage: number;
  available_footage: number;
  max_hours: number;
  scheduled_hours: number;
  available_hours: number;
  utilization_percent: number;
  is_available: boolean;
  is_over_capacity: boolean;
  job_count: number;
  updated_at: string;
  // Joined
  crew?: Pick<Crew, 'id' | 'name' | 'code'>;
}

// ============================================
// FULLCALENDAR EVENT TYPES
// ============================================

export interface CalendarResource {
  id: string;
  title: string;
  parentId?: string;
  extendedProps?: {
    type: 'crew' | 'rep';
    entityId: string;
    maxFootage?: number;
    color?: string;
  };
}

export interface CalendarEvent {
  id: string;
  resourceId: string;
  title: string;
  start: string;
  end?: string;
  allDay?: boolean;
  backgroundColor?: string;
  borderColor?: string;
  textColor?: string;
  extendedProps: {
    entryType: ScheduleEntryType;
    status: ScheduleEntryStatus;
    jobId?: string | null;
    serviceRequestId?: string | null;
    footage?: number | null;
    hours?: number | null;
    materialStatus?: string;
    // Project context for multi-job projects
    projectId?: string | null;
    projectNumber?: string | null;
    jobName?: string | null;
    isMultiJobProject?: boolean;
    invoiceGroupId?: string | null;
    entry: ScheduleEntry;
  };
}

// ============================================
// FILTER/QUERY TYPES
// ============================================

export interface ScheduleEntriesFilter {
  startDate: Date;
  endDate: Date;
  crewIds?: string[];
  repIds?: string[];
  entryTypes?: ScheduleEntryType[];
  statuses?: ScheduleEntryStatus[];
}

// ============================================
// UI STATE TYPES
// ============================================

export type CalendarView = 'resourceTimelineDay' | 'resourceTimelineWeek' | 'dayGridMonth' | 'listWeek';

export interface ScheduleModalState {
  isOpen: boolean;
  mode: 'create' | 'edit';
  entryId?: string;
  prefillData?: Partial<CreateScheduleEntryInput>;
}
