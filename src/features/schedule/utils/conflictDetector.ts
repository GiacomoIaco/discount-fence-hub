import type { ScheduleEntry, CrewDailyCapacity } from '../types/schedule.types';

// ============================================
// CONFLICT TYPES
// ============================================

export type ConflictSeverity = 'error' | 'warning' | 'info';

export type ConflictType =
  | 'double_booking'
  | 'over_capacity'
  | 'missing_skills'
  | 'builder_preference'
  | 'time_overlap';

export interface ScheduleConflict {
  type: ConflictType;
  severity: ConflictSeverity;
  message: string;
  details?: string;
  relatedEntryId?: string;
}

// ============================================
// CONFLICT DETECTION INPUT
// ============================================

export interface ConflictCheckInput {
  // The entry being scheduled (new or updated)
  entryId?: string; // Undefined for new entries
  crewId: string | null;
  salesRepId: string | null;
  scheduledDate: string;
  startTime: string | null;
  endTime: string | null;
  estimatedFootage: number | null;
  entryType: string;
  jobId?: string | null;
}

export interface ConflictCheckContext {
  // Existing entries on the same date
  existingEntries: ScheduleEntry[];
  // Capacity data for the crew on this date
  crewCapacity?: CrewDailyCapacity;
  // Crew's max daily footage
  crewMaxFootage?: number;
  // Builder preferences (from community/client)
  preferredCrewId?: string | null;
  avoidCrewIds?: string[];
}

// ============================================
// MAIN CONFLICT DETECTOR
// ============================================

export function detectConflicts(
  input: ConflictCheckInput,
  context: ConflictCheckContext
): ScheduleConflict[] {
  const conflicts: ScheduleConflict[] = [];

  // 1. Check for double-booking (same crew on same date)
  const doubleBookingConflicts = checkDoubleBooking(input, context);
  conflicts.push(...doubleBookingConflicts);

  // 2. Check for over-capacity
  const capacityConflicts = checkCapacity(input, context);
  conflicts.push(...capacityConflicts);

  // 3. Check for time overlaps (if times are specified)
  const timeOverlapConflicts = checkTimeOverlap(input, context);
  conflicts.push(...timeOverlapConflicts);

  // 4. Check builder preferences
  const preferenceConflicts = checkBuilderPreferences(input, context);
  conflicts.push(...preferenceConflicts);

  return conflicts;
}

// ============================================
// INDIVIDUAL CONFLICT CHECKS
// ============================================

/**
 * Check if crew/rep is already booked on this date
 */
function checkDoubleBooking(
  input: ConflictCheckInput,
  context: ConflictCheckContext
): ScheduleConflict[] {
  const conflicts: ScheduleConflict[] = [];

  // Filter out the current entry if editing
  const otherEntries = context.existingEntries.filter(
    (e) => e.id !== input.entryId
  );

  // Check crew double-booking
  if (input.crewId) {
    const crewEntries = otherEntries.filter((e) => e.crew_id === input.crewId);

    // For job_visit entries, multiple jobs on the same day is a warning (capacity-based)
    // For other entry types (blocked, meeting), it's potentially an error
    if (input.entryType !== 'job_visit') {
      const blockedOrMeeting = crewEntries.filter(
        (e) => e.entry_type === 'blocked' || e.entry_type === 'meeting'
      );

      if (blockedOrMeeting.length > 0) {
        conflicts.push({
          type: 'double_booking',
          severity: 'warning',
          message: `Crew has ${blockedOrMeeting.length} blocked time or meeting(s) on this date`,
          details: blockedOrMeeting.map((e) => e.title || e.entry_type).join(', '),
          relatedEntryId: blockedOrMeeting[0].id,
        });
      }
    }
  }

  // Check sales rep double-booking (more strict for appointments)
  if (input.salesRepId && input.entryType === 'assessment') {
    const repAssessments = otherEntries.filter(
      (e) => e.sales_rep_id === input.salesRepId && e.entry_type === 'assessment'
    );

    if (repAssessments.length > 0) {
      conflicts.push({
        type: 'double_booking',
        severity: 'info',
        message: `Sales rep has ${repAssessments.length} other assessment(s) on this date`,
        details: repAssessments
          .map((e) => e.start_time || 'All day')
          .join(', '),
      });
    }
  }

  return conflicts;
}

/**
 * Check if adding this entry would exceed crew capacity
 */
function checkCapacity(
  input: ConflictCheckInput,
  context: ConflictCheckContext
): ScheduleConflict[] {
  const conflicts: ScheduleConflict[] = [];

  // Only check capacity for job_visit with footage
  if (
    input.entryType !== 'job_visit' ||
    !input.crewId ||
    !input.estimatedFootage
  ) {
    return conflicts;
  }

  const maxFootage = context.crewMaxFootage || 200;

  // Calculate current scheduled footage (excluding this entry if editing)
  const otherEntries = context.existingEntries.filter(
    (e) =>
      e.id !== input.entryId &&
      e.crew_id === input.crewId &&
      e.entry_type === 'job_visit'
  );

  const currentFootage = otherEntries.reduce(
    (sum, e) => sum + (e.estimated_footage || 0),
    0
  );

  const newTotalFootage = currentFootage + input.estimatedFootage;
  const utilizationPercent = Math.round((newTotalFootage / maxFootage) * 100);

  if (utilizationPercent > 150) {
    conflicts.push({
      type: 'over_capacity',
      severity: 'error',
      message: `Crew would be at ${utilizationPercent}% capacity (${newTotalFootage}/${maxFootage} LF)`,
      details: 'This is significantly over capacity. Consider splitting across days.',
    });
  } else if (utilizationPercent > 100) {
    conflicts.push({
      type: 'over_capacity',
      severity: 'warning',
      message: `Crew would be at ${utilizationPercent}% capacity (${newTotalFootage}/${maxFootage} LF)`,
      details: 'This may require overtime or could extend to next day.',
    });
  } else if (utilizationPercent > 90) {
    conflicts.push({
      type: 'over_capacity',
      severity: 'info',
      message: `Crew would be at ${utilizationPercent}% capacity (${newTotalFootage}/${maxFootage} LF)`,
      details: 'Near maximum capacity for the day.',
    });
  }

  return conflicts;
}

/**
 * Check for time overlaps when specific times are set
 */
function checkTimeOverlap(
  input: ConflictCheckInput,
  context: ConflictCheckContext
): ScheduleConflict[] {
  const conflicts: ScheduleConflict[] = [];

  // Only check if times are specified
  if (!input.startTime || !input.endTime) {
    return conflicts;
  }

  // Filter to entries with times on the same date
  const otherEntries = context.existingEntries.filter(
    (e) =>
      e.id !== input.entryId &&
      e.start_time &&
      e.end_time &&
      ((input.crewId && e.crew_id === input.crewId) ||
        (input.salesRepId && e.sales_rep_id === input.salesRepId))
  );

  for (const entry of otherEntries) {
    if (timeRangesOverlap(
      input.startTime,
      input.endTime,
      entry.start_time!,
      entry.end_time!
    )) {
      const entityType = entry.crew_id === input.crewId ? 'Crew' : 'Sales rep';
      conflicts.push({
        type: 'time_overlap',
        severity: 'error',
        message: `${entityType} has overlapping time slot (${entry.start_time}-${entry.end_time})`,
        details: entry.title || entry.entry_type,
        relatedEntryId: entry.id,
      });
    }
  }

  return conflicts;
}

/**
 * Check builder/community preferences
 */
function checkBuilderPreferences(
  input: ConflictCheckInput,
  context: ConflictCheckContext
): ScheduleConflict[] {
  const conflicts: ScheduleConflict[] = [];

  if (!input.crewId) return conflicts;

  // Check if this crew should be avoided
  if (context.avoidCrewIds && context.avoidCrewIds.includes(input.crewId)) {
    conflicts.push({
      type: 'builder_preference',
      severity: 'warning',
      message: 'This crew is marked as "avoid" for this builder/community',
      details: 'Consider assigning a different crew if possible.',
    });
  }

  // Check if there's a preferred crew and we're not using it
  if (
    context.preferredCrewId &&
    context.preferredCrewId !== input.crewId
  ) {
    conflicts.push({
      type: 'builder_preference',
      severity: 'info',
      message: 'Builder has a preferred crew that is not selected',
      details: 'This is a preference, not a requirement.',
    });
  }

  return conflicts;
}

// ============================================
// HELPERS
// ============================================

/**
 * Check if two time ranges overlap
 */
function timeRangesOverlap(
  start1: string,
  end1: string,
  start2: string,
  end2: string
): boolean {
  // Convert HH:MM to minutes for comparison
  const toMinutes = (time: string) => {
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m;
  };

  const s1 = toMinutes(start1);
  const e1 = toMinutes(end1);
  const s2 = toMinutes(start2);
  const e2 = toMinutes(end2);

  // Overlap exists if one range starts before the other ends
  return s1 < e2 && s2 < e1;
}

// ============================================
// CONFLICT SUMMARY HELPERS
// ============================================

export function hasBlockingConflicts(conflicts: ScheduleConflict[]): boolean {
  return conflicts.some((c) => c.severity === 'error');
}

export function getConflictsSummary(conflicts: ScheduleConflict[]): string {
  if (conflicts.length === 0) return '';

  const errors = conflicts.filter((c) => c.severity === 'error').length;
  const warnings = conflicts.filter((c) => c.severity === 'warning').length;
  const infos = conflicts.filter((c) => c.severity === 'info').length;

  const parts: string[] = [];
  if (errors > 0) parts.push(`${errors} error${errors > 1 ? 's' : ''}`);
  if (warnings > 0) parts.push(`${warnings} warning${warnings > 1 ? 's' : ''}`);
  if (infos > 0) parts.push(`${infos} info`);

  return parts.join(', ');
}
