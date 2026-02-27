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

// Format date for display
export function formatDate(dateStr: string | null): string {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// Check if task is overdue
export function isOverdue(task: TodoItem): boolean {
  if (!task.due_date) return false;
  if (task.status === 'done') return false;
  return new Date(task.due_date) < new Date();
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
