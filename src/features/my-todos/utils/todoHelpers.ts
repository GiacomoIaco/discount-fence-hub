import type { TodoItem } from '../types';

// Generate consistent color from user ID
export const getAvatarColor = (userId: string): string => {
  const colors = [
    'bg-blue-500',
    'bg-green-500',
    'bg-purple-500',
    'bg-orange-500',
    'bg-pink-500',
    'bg-teal-500',
    'bg-indigo-500',
    'bg-red-500',
  ];
  const hash = userId.split('').reduce((acc, char) => char.charCodeAt(0) + acc, 0);
  return colors[hash % colors.length];
};

// Header color options for sections/lists
export const headerColorOptions = [
  { value: 'blue-900', label: 'Blue', bg: 'bg-blue-900', hover: 'hover:bg-blue-800' },
  { value: 'green-800', label: 'Green', bg: 'bg-green-800', hover: 'hover:bg-green-700' },
  { value: 'purple-800', label: 'Purple', bg: 'bg-purple-800', hover: 'hover:bg-purple-700' },
  { value: 'orange-700', label: 'Orange', bg: 'bg-orange-700', hover: 'hover:bg-orange-600' },
  { value: 'red-800', label: 'Red', bg: 'bg-red-800', hover: 'hover:bg-red-700' },
  { value: 'teal-800', label: 'Teal', bg: 'bg-teal-800', hover: 'hover:bg-teal-700' },
  { value: 'indigo-800', label: 'Indigo', bg: 'bg-indigo-800', hover: 'hover:bg-indigo-700' },
  { value: 'gray-700', label: 'Gray', bg: 'bg-gray-700', hover: 'hover:bg-gray-600' },
];

// Default section color
export const DEFAULT_SECTION_COLOR = { bg: 'bg-blue-900', hover: 'hover:bg-blue-800', border: 'border-blue-700' };

// Get section color from color value
export function getSectionColor(colorValue: string): { bg: string; hover: string; border: string } {
  const colorOption = headerColorOptions.find(c => c.value === colorValue);
  if (colorOption) {
    return {
      bg: colorOption.bg,
      hover: colorOption.hover,
      border: `border-${colorValue.replace('900', '700').replace('800', '600').replace('700', '500')}`,
    };
  }
  return DEFAULT_SECTION_COLOR;
}

// Strip time from a Date, returning midnight local time
function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

// Difference in calendar days between two dates (positive = a is after b)
function diffDays(a: Date, b: Date): number {
  const msPerDay = 86_400_000;
  return Math.round((startOfDay(a).getTime() - startOfDay(b).getTime()) / msPerDay);
}

// Short month+day format, e.g. "Mar 15"
function shortDate(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// Abbreviated day name, e.g. "Mon"
function shortDayName(d: Date): string {
  return d.toLocaleDateString('en-US', { weekday: 'short' });
}

// Full day name, e.g. "Wednesday"
function fullDayName(d: Date): string {
  return d.toLocaleDateString('en-US', { weekday: 'long' });
}

// Format date for display with smart relative labels
// Pass status to distinguish completed tasks (optional)
export function formatDate(dateStr: string | null, status?: string): string {
  if (!dateStr) return '-';

  const date = new Date(dateStr);
  const today = new Date();
  const diff = diffDays(date, today); // positive = future, negative = past

  // Completed tasks: just show the plain date, no "Overdue" styling
  if (status === 'done') {
    return shortDate(date);
  }

  // Past due (not done)
  if (diff < 0) {
    const daysOverdue = Math.abs(diff);
    if (daysOverdue === 1) return 'Overdue';
    return `${daysOverdue}d overdue`;
  }

  // Today
  if (diff === 0) return 'Today';

  // Tomorrow
  if (diff === 1) return 'Tomorrow';

  // 2-6 days out: full day name
  if (diff >= 2 && diff <= 6) return fullDayName(date);

  // 7-13 days out: "Next Mon" style with date
  if (diff >= 7 && diff <= 13) {
    return `${shortDayName(date)}, ${shortDate(date)}`;
  }

  // Further out: just the date
  return shortDate(date);
}

// Check if task is overdue (due date strictly before today, ignoring time)
export function isOverdue(task: TodoItem): boolean {
  if (!task.due_date) return false;
  if (task.status === 'done') return false;
  const dueDay = startOfDay(new Date(task.due_date));
  const todayDay = startOfDay(new Date());
  return dueDay < todayDay;
}

// Check if task is due today
export function isDueToday(task: TodoItem): boolean {
  if (!task.due_date) return false;
  return diffDays(new Date(task.due_date), new Date()) === 0;
}

// Check if task is due within the next 7 days (including today)
export function isDueThisWeek(task: TodoItem): boolean {
  if (!task.due_date) return false;
  const diff = diffDays(new Date(task.due_date), new Date());
  return diff >= 0 && diff <= 6;
}

// Check if task was completed more than 7 days ago
export function isStaleCompleted(task: TodoItem): boolean {
  if (!task.completed_at) return false;
  const daysSinceCompleted = diffDays(new Date(), new Date(task.completed_at));
  return daysSinceCompleted > 7;
}

// Status options for tasks
export const statusOptions = [
  { value: 'todo', label: 'To Do', bg: 'bg-gray-100', text: 'text-gray-700' },
  { value: 'in_progress', label: 'In Progress', bg: 'bg-blue-100', text: 'text-blue-700' },
  { value: 'done', label: 'Done', bg: 'bg-green-100', text: 'text-green-700' },
  { value: 'blocked', label: 'Blocked', bg: 'bg-red-100', text: 'text-red-700' },
];

// Get status display info
export function getStatusInfo(status: string) {
  return statusOptions.find(s => s.value === status) || statusOptions[0];
}
