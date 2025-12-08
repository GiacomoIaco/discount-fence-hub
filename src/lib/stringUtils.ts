/**
 * Shared string utility functions
 */

/**
 * Get initials from a full name (e.g., "John Doe" -> "JD")
 * Returns '?' if name is null/undefined/empty
 */
export const getInitials = (fullName: string | null | undefined): string => {
  if (!fullName) return '?';
  return fullName
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
};
