// ============================================
// LEADERSHIP PROJECT MANAGEMENT - TYPE DEFINITIONS
// ============================================

// ============================================
// ENUMS
// ============================================

export const InitiativeStatus = {
  NOT_STARTED: 'not_started',
  ACTIVE: 'active',
  ON_HOLD: 'on_hold',
  AT_RISK: 'at_risk',
  CANCELLED: 'cancelled',
  COMPLETED: 'completed',
} as const;

export type InitiativeStatus = typeof InitiativeStatus[keyof typeof InitiativeStatus];

export const InitiativePriority = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
} as const;

export type InitiativePriority = typeof InitiativePriority[keyof typeof InitiativePriority];

export const ColorStatus = {
  GREEN: 'green',
  YELLOW: 'yellow',
  RED: 'red',
} as const;

export type ColorStatus = typeof ColorStatus[keyof typeof ColorStatus];

export const TargetType = {
  DATE: 'date',
  WEEK: 'week',
  QUARTER: 'quarter',
  ONGOING: 'ongoing',
} as const;

export type TargetType = typeof TargetType[keyof typeof TargetType];

export const FunctionAccessRole = {
  ADMIN: 'admin',
  LEAD: 'lead',
  MEMBER: 'member',
  VIEWER: 'viewer',
} as const;

export type FunctionAccessRole = typeof FunctionAccessRole[keyof typeof FunctionAccessRole];

// ============================================
// CORE INTERFACES
// ============================================

export interface ProjectSettings {
  id: string;
  setting_key: string;
  setting_value: Record<string, any>;
  description?: string;
  updated_by?: string;
  created_at: string;
  updated_at: string;
}

export interface ProjectFunction {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  color?: string;
  sort_order: number;
  is_active: boolean;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface ProjectFunctionAccess {
  id: string;
  function_id: string;
  user_id: string;
  role: FunctionAccessRole;
  granted_by?: string;
  created_at: string;
  updated_at: string;
}

export interface ProjectArea {
  id: string;
  function_id: string;
  name: string;
  description?: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProjectInitiative {
  id: string;
  area_id: string;

  // Core fields
  title: string;
  description?: string;
  success_criteria?: string;

  // Ownership and status
  assigned_to?: string;
  status: InitiativeStatus;
  priority: InitiativePriority;

  // Target date (flexible format)
  target_type?: TargetType;
  target_date?: string; // ISO date string
  target_week?: string; // "Week of YYYY-MM-DD"
  target_quarter?: string; // "Q1 2025"

  // Progress tracking
  progress_percent: number;
  color_status: ColorStatus;

  // Weekly updates (quick check-in fields)
  this_week?: string;
  next_week?: string;

  // Audit
  created_by?: string;
  archived_at?: string;
  sort_order: number;

  created_at: string;
  updated_at: string;

  // Joined data (optional, when fetched with relations)
  area?: ProjectArea;
}

export interface ProjectWeeklyUpdate {
  id: string;
  initiative_id: string;
  user_id: string;
  week_start_date: string; // ISO date string (Monday)

  // Update content
  plan?: string;
  accomplished?: string;
  notes?: string;

  // Status at time of update
  status_snapshot?: string;
  progress_snapshot?: number;

  created_at: string;
  updated_at: string;
}

export interface ProjectActivity {
  id: string;
  initiative_id: string;
  user_id?: string;
  action: string;
  changes?: Record<string, any>;
  created_at: string;
}

export interface ProjectComment {
  id: string;
  initiative_id: string;
  user_id: string;
  content: string;
  created_at: string;
  updated_at: string;
}

// ============================================
// EXTENDED INTERFACES (with joined data)
// ============================================

export interface InitiativeWithDetails extends ProjectInitiative {
  area?: ProjectArea;
  function?: ProjectFunction;
  assigned_user?: {
    id: string;
    full_name: string;
    avatar_url?: string;
  };
  recent_updates?: ProjectWeeklyUpdate[];
  comment_count?: number;
}

export interface FunctionWithAccess extends ProjectFunction {
  user_access?: ProjectFunctionAccess;
  area_count?: number;
  initiative_count?: number;
  high_priority_count?: number;
}

export interface AreaWithInitiatives extends ProjectArea {
  initiatives?: ProjectInitiative[];
  initiative_count?: number;
}

// ============================================
// FORM/CREATE TYPES
// ============================================

export interface CreateFunctionInput {
  name: string;
  description?: string;
  icon?: string;
  color?: string;
  sort_order?: number;
}

export interface UpdateFunctionInput extends Partial<CreateFunctionInput> {
  id: string;
  is_active?: boolean;
}

export interface CreateAreaInput {
  function_id: string;
  name: string;
  description?: string;
  sort_order?: number;
}

export interface UpdateAreaInput extends Partial<CreateAreaInput> {
  id: string;
  is_active?: boolean;
}

export interface CreateInitiativeInput {
  area_id: string;
  title: string;
  description?: string;
  success_criteria?: string;
  assigned_to?: string;
  status?: InitiativeStatus;
  priority?: InitiativePriority;
  target_type?: TargetType;
  target_date?: string;
  target_week?: string;
  target_quarter?: string;
  progress_percent?: number;
  this_week?: string;
  next_week?: string;
}

export interface UpdateInitiativeInput extends Partial<CreateInitiativeInput> {
  id: string;
  archived_at?: string;
}

export interface CreateWeeklyUpdateInput {
  initiative_id: string;
  week_start_date: string;
  plan?: string;
  accomplished?: string;
  notes?: string;
}

export interface UpdateWeeklyUpdateInput extends Partial<CreateWeeklyUpdateInput> {
  id: string;
}

export interface GrantFunctionAccessInput {
  function_id: string;
  user_id: string;
  role: FunctionAccessRole;
}

// ============================================
// FILTER/QUERY TYPES
// ============================================

export interface InitiativeFilters {
  area_id?: string;
  function_id?: string;
  assigned_to?: string;
  status?: InitiativeStatus | InitiativeStatus[];
  priority?: InitiativePriority | InitiativePriority[];
  color_status?: ColorStatus | ColorStatus[];
  include_archived?: boolean;
}

export interface WeeklyUpdateFilters {
  initiative_id?: string;
  user_id?: string;
  week_start_date?: string;
  week_range?: {
    start: string;
    end: string;
  };
}

// ============================================
// EMAIL SUMMARY TYPES
// ============================================

export interface EmailScheduleSettings {
  day: 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';
  time: string; // HH:MM format
  timezone: string;
}

export interface EmailRecipientsSettings {
  type: 'all_leadership' | 'per_function' | 'custom';
  custom?: string[]; // user IDs
}

export interface WeeklySummaryByOwner {
  user_id: string;
  user_name: string;
  user_email: string;
  initiatives: InitiativeWithDetails[];
  high_priority_count: number;
  at_risk_count: number;
  completed_this_week: number;
}

export interface WeeklySummaryByFunction {
  function: ProjectFunction;
  areas: {
    area: ProjectArea;
    initiatives: InitiativeWithDetails[];
  }[];
  total_initiatives: number;
  high_priority_count: number;
  at_risk_count: number;
  on_track_count: number;
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

export const getStatusLabel = (status: InitiativeStatus): string => {
  const labels: Record<InitiativeStatus, string> = {
    not_started: 'Not Started',
    active: 'Active',
    on_hold: 'On Hold',
    at_risk: 'At Risk',
    cancelled: 'Cancelled',
    completed: 'Completed',
  };
  return labels[status];
};

export const getPriorityLabel = (priority: InitiativePriority): string => {
  const labels: Record<InitiativePriority, string> = {
    low: 'Low',
    medium: 'Medium',
    high: 'High',
  };
  return labels[priority];
};

export const getTargetTypeLabel = (type: TargetType): string => {
  const labels: Record<TargetType, string> = {
    date: 'Specific Date',
    week: 'Target Week',
    quarter: 'Target Quarter',
    ongoing: 'Ongoing',
  };
  return labels[type];
};

export const getRoleLabel = (role: FunctionAccessRole): string => {
  const labels: Record<FunctionAccessRole, string> = {
    admin: 'Admin',
    lead: 'Lead',
    member: 'Member',
    viewer: 'Viewer',
  };
  return labels[role];
};

export const getColorStatusClass = (status: ColorStatus): string => {
  const classes: Record<ColorStatus, string> = {
    green: 'bg-green-100 text-green-800',
    yellow: 'bg-yellow-100 text-yellow-800',
    red: 'bg-red-100 text-red-800',
  };
  return classes[status];
};

export const getStatusColor = (status: InitiativeStatus): string => {
  const colors: Record<InitiativeStatus, string> = {
    not_started: 'gray',
    active: 'blue',
    on_hold: 'yellow',
    at_risk: 'red',
    cancelled: 'gray',
    completed: 'green',
  };
  return colors[status];
};

export const getPriorityColor = (priority: InitiativePriority): string => {
  const colors: Record<InitiativePriority, string> = {
    low: 'gray',
    medium: 'blue',
    high: 'orange',
  };
  return colors[priority];
};

/**
 * Get the Monday of the week for a given date
 */
export const getMondayOfWeek = (date: Date = new Date()): Date => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
  return new Date(d.setDate(diff));
};

/**
 * Format week string for display
 */
export const formatWeek = (weekStartDate: string): string => {
  const date = new Date(weekStartDate);
  return `Week of ${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
};

/**
 * Parse target display string
 */
export const getTargetDisplay = (initiative: ProjectInitiative): string => {
  if (!initiative.target_type) return 'No target set';

  switch (initiative.target_type) {
    case 'date':
      if (!initiative.target_date) return 'No target set';
      return new Date(initiative.target_date).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    case 'week':
      return initiative.target_week || 'No week set';
    case 'quarter':
      return initiative.target_quarter || 'No quarter set';
    case 'ongoing':
      return 'Ongoing';
    default:
      return 'No target set';
  }
};

/**
 * Check if user has permission for action
 */
export const canUserPerformAction = (
  role?: FunctionAccessRole,
  action?: 'view' | 'edit' | 'create' | 'delete' | 'manage_access'
): boolean => {
  if (!role || !action) return false;

  const permissions: Record<FunctionAccessRole, string[]> = {
    admin: ['view', 'edit', 'create', 'delete', 'manage_access'],
    lead: ['view', 'edit', 'create', 'delete', 'manage_access'],
    member: ['view', 'edit'],
    viewer: ['view'],
  };

  return permissions[role]?.includes(action) || false;
};
