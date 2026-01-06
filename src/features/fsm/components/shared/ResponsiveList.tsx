/**
 * ResponsiveList - Shared components for responsive table/card list switching
 *
 * Following Part 0.1 of FSM Standards:
 * - Desktop (≥768px): Tabular grid, maximize data density
 * - Mobile (<768px): Card-based, scannable
 *
 * Usage:
 * ```tsx
 * <ResponsiveList
 *   variant="auto" // 'table' | 'cards' | 'auto'
 *   data={items}
 *   columns={[
 *     { key: 'name', header: 'Name', render: (item) => item.name },
 *     { key: 'status', header: 'Status', render: (item) => <StatusBadge status={item.status} /> },
 *   ]}
 *   renderCard={(item) => <MyCard item={item} />}
 *   onRowClick={(item) => selectItem(item)}
 * />
 * ```
 */

import { useState, useEffect, ReactNode, useMemo } from 'react';

// =============================================================================
// Types
// =============================================================================

export type ListVariant = 'table' | 'cards' | 'auto';

export interface ListColumn<T> {
  /** Unique key for this column */
  key: string;
  /** Column header text */
  header: string;
  /** Render cell content */
  render: (item: T) => ReactNode;
  /** Column width class (e.g., 'w-32', 'flex-1', 'w-24') */
  width?: string;
  /** Alignment: 'left' (default), 'center', 'right' */
  align?: 'left' | 'center' | 'right';
  /** Hide on smaller screens (applies even in table mode) */
  hideOnMobile?: boolean;
}

export interface ResponsiveListProps<T> {
  /** Data items to display */
  data: T[];
  /** Unique key extractor */
  keyExtractor: (item: T) => string;
  /** Display variant: 'table', 'cards', or 'auto' (switches at md breakpoint) */
  variant?: ListVariant;
  /** Column definitions for table view */
  columns: ListColumn<T>[];
  /** Render function for card view */
  renderCard: (item: T, index: number) => ReactNode;
  /** Click handler for row/card */
  onItemClick?: (item: T) => void;
  /** Empty state content */
  emptyState?: ReactNode;
  /** Loading state */
  isLoading?: boolean;
  /** Custom loading content */
  loadingContent?: ReactNode;
  /** Additional class names for the container */
  className?: string;
}

// =============================================================================
// Hook: useListVariant
// =============================================================================

const BREAKPOINT_MD = 768;

/**
 * Hook to determine the effective list variant based on screen size
 */
export function useListVariant(variant: ListVariant): 'table' | 'cards' {
  const [effectiveVariant, setEffectiveVariant] = useState<'table' | 'cards'>(() => {
    if (variant !== 'auto') return variant;
    if (typeof window === 'undefined') return 'cards';
    return window.innerWidth >= BREAKPOINT_MD ? 'table' : 'cards';
  });

  useEffect(() => {
    if (variant !== 'auto') {
      setEffectiveVariant(variant);
      return;
    }

    const handleResize = () => {
      setEffectiveVariant(window.innerWidth >= BREAKPOINT_MD ? 'table' : 'cards');
    };

    // Initial check
    handleResize();

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [variant]);

  return effectiveVariant;
}

// =============================================================================
// Component: ResponsiveList
// =============================================================================

export function ResponsiveList<T>({
  data,
  keyExtractor,
  variant = 'auto',
  columns,
  renderCard,
  onItemClick,
  emptyState,
  isLoading,
  loadingContent,
  className = '',
}: ResponsiveListProps<T>) {
  const effectiveVariant = useListVariant(variant);

  // Default loading content
  const defaultLoadingContent = (
    <div className="flex items-center justify-center py-12">
      <div className="animate-pulse text-gray-500">Loading...</div>
    </div>
  );

  // Default empty state
  const defaultEmptyState = (
    <div className="bg-white rounded-lg border p-12 text-center">
      <p className="text-gray-500">No items found</p>
    </div>
  );

  if (isLoading) {
    return loadingContent || defaultLoadingContent;
  }

  if (data.length === 0) {
    return <>{emptyState || defaultEmptyState}</>;
  }

  // Render table view
  if (effectiveVariant === 'table') {
    return (
      <div className={`overflow-x-auto ${className}`}>
        <div className="min-w-full">
          {/* Header */}
          <div className="grid gap-4 px-4 py-3 bg-gray-50 rounded-t-lg border-b font-medium text-sm text-gray-600"
               style={{ gridTemplateColumns: columns.map(c => c.width || '1fr').join(' ') }}>
            {columns.map((column) => (
              <div
                key={column.key}
                className={`
                  ${column.hideOnMobile ? 'hidden md:block' : ''}
                  ${column.align === 'center' ? 'text-center' : ''}
                  ${column.align === 'right' ? 'text-right' : ''}
                `}
              >
                {column.header}
              </div>
            ))}
          </div>

          {/* Rows */}
          <div className="divide-y divide-gray-100">
            {data.map((item, index) => (
              <div
                key={keyExtractor(item)}
                onClick={() => onItemClick?.(item)}
                className={`
                  grid gap-4 px-4 py-3 bg-white text-sm
                  ${onItemClick ? 'cursor-pointer hover:bg-gray-50 transition-colors' : ''}
                  ${index === data.length - 1 ? 'rounded-b-lg' : ''}
                `}
                style={{ gridTemplateColumns: columns.map(c => c.width || '1fr').join(' ') }}
              >
                {columns.map((column) => (
                  <div
                    key={column.key}
                    className={`
                      min-w-0
                      ${column.hideOnMobile ? 'hidden md:block' : ''}
                      ${column.align === 'center' ? 'text-center' : ''}
                      ${column.align === 'right' ? 'text-right' : ''}
                    `}
                  >
                    {column.render(item)}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Render card view
  return (
    <div className={`space-y-3 ${className}`}>
      {data.map((item, index) => (
        <div
          key={keyExtractor(item)}
          onClick={() => onItemClick?.(item)}
          className={onItemClick ? 'cursor-pointer' : ''}
        >
          {renderCard(item, index)}
        </div>
      ))}
    </div>
  );
}

// =============================================================================
// Component: ListTableHeader (for custom table implementations)
// =============================================================================

interface ListTableHeaderProps {
  columns: Array<{
    key: string;
    header: string;
    width?: string;
    align?: 'left' | 'center' | 'right';
    hideOnMobile?: boolean;
  }>;
}

export function ListTableHeader({ columns }: ListTableHeaderProps) {
  return (
    <div
      className="grid gap-4 px-4 py-3 bg-gray-50 rounded-t-lg border-b font-medium text-sm text-gray-600"
      style={{ gridTemplateColumns: columns.map((c) => c.width || '1fr').join(' ') }}
    >
      {columns.map((column) => (
        <div
          key={column.key}
          className={`
            ${column.hideOnMobile ? 'hidden md:block' : ''}
            ${column.align === 'center' ? 'text-center' : ''}
            ${column.align === 'right' ? 'text-right' : ''}
          `}
        >
          {column.header}
        </div>
      ))}
    </div>
  );
}

// =============================================================================
// Component: ListTableRow (for custom table implementations)
// =============================================================================

interface ListTableRowProps {
  columns: Array<{
    key: string;
    content: ReactNode;
    width?: string;
    align?: 'left' | 'center' | 'right';
    hideOnMobile?: boolean;
  }>;
  onClick?: () => void;
  isLast?: boolean;
}

export function ListTableRow({ columns, onClick, isLast = false }: ListTableRowProps) {
  return (
    <div
      onClick={onClick}
      className={`
        grid gap-4 px-4 py-3 bg-white text-sm
        ${onClick ? 'cursor-pointer hover:bg-gray-50 transition-colors' : ''}
        ${isLast ? 'rounded-b-lg' : ''}
      `}
      style={{ gridTemplateColumns: columns.map((c) => c.width || '1fr').join(' ') }}
    >
      {columns.map((column) => (
        <div
          key={column.key}
          className={`
            min-w-0
            ${column.hideOnMobile ? 'hidden md:block' : ''}
            ${column.align === 'center' ? 'text-center' : ''}
            ${column.align === 'right' ? 'text-right' : ''}
          `}
        >
          {column.content}
        </div>
      ))}
    </div>
  );
}

// =============================================================================
// Component: VariantToggle - Let users manually switch between variants
// =============================================================================

interface VariantToggleProps {
  variant: 'table' | 'cards';
  onChange: (variant: 'table' | 'cards') => void;
  className?: string;
}

export function VariantToggle({ variant, onChange, className = '' }: VariantToggleProps) {
  return (
    <div className={`inline-flex rounded-lg border bg-white p-0.5 ${className}`}>
      <button
        type="button"
        onClick={() => onChange('table')}
        className={`
          px-3 py-1.5 text-sm font-medium rounded-md transition-colors
          ${variant === 'table'
            ? 'bg-gray-100 text-gray-900'
            : 'text-gray-500 hover:text-gray-700'
          }
        `}
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
        </svg>
      </button>
      <button
        type="button"
        onClick={() => onChange('cards')}
        className={`
          px-3 py-1.5 text-sm font-medium rounded-md transition-colors
          ${variant === 'cards'
            ? 'bg-gray-100 text-gray-900'
            : 'text-gray-500 hover:text-gray-700'
          }
        `}
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
        </svg>
      </button>
    </div>
  );
}

export default ResponsiveList;
