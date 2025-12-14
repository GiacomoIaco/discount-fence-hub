// Utility function for conditionally joining classNames
// Replacement for clsx/classnames without the dependency

export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ');
}
