import type { LucideIcon } from 'lucide-react';

export interface SidebarItemConfig {
  id: string;
  label: string;
  icon: LucideIcon | React.ComponentType<{ className?: string }>;
  onClick?: () => void;
  badge?: number;
  disabled?: boolean;
  disabledLabel?: string; // e.g., "Soon"
  active?: boolean;
  highlight?: boolean; // Special styling (like v2 Beta button)
  highlightColor?: 'purple' | 'amber' | 'green';
  highlightBadge?: string; // e.g., "NEW"
}

export interface SidebarSectionConfig {
  id: string;
  title?: string; // Optional section header (e.g., "Yard", "Admin")
  titleIcon?: LucideIcon; // Optional icon for section header
  titleIconColor?: string; // e.g., "text-amber-400"
  items: SidebarItemConfig[];
  adminOnly?: boolean;
}

export type SidebarColorScheme = 'dark' | 'light' | 'blue';

export interface CollapsibleSidebarProps {
  storageKey: string; // localStorage key for persistence
  sections: SidebarSectionConfig[];
  header?: React.ReactNode; // Optional custom header
  footer?: React.ReactNode; // Optional custom footer
  colorScheme?: SidebarColorScheme;
  defaultCollapsed?: boolean;
  expandedWidth?: string; // Default: 'w-64'
  collapsedWidth?: string; // Default: 'w-14'
  onCollapsedChange?: (collapsed: boolean) => void;
  className?: string;
  // For controlled mode (optional)
  collapsed?: boolean;
  onToggle?: () => void;
}

export const colorSchemes = {
  dark: {
    bg: 'bg-gray-900',
    text: 'text-gray-300',
    textMuted: 'text-gray-400',
    active: 'bg-blue-600 text-white',
    hover: 'hover:bg-gray-800 hover:text-white',
    disabled: 'text-gray-600 cursor-not-allowed',
    border: 'border-gray-700',
    headerBorder: 'border-gray-800',
    sectionTitle: 'text-gray-500',
  },
  light: {
    bg: 'bg-white',
    text: 'text-gray-700',
    textMuted: 'text-gray-500',
    active: 'bg-blue-50 text-blue-700 border border-blue-200',
    hover: 'hover:bg-gray-50',
    disabled: 'text-gray-400 cursor-not-allowed',
    border: 'border-gray-200',
    headerBorder: 'border-gray-200',
    sectionTitle: 'text-gray-400',
  },
  blue: {
    bg: 'bg-[#1E3A8A]',
    text: 'text-blue-100',
    textMuted: 'text-blue-300',
    active: 'bg-white text-blue-900 shadow-sm',
    hover: 'hover:bg-blue-800/50',
    disabled: 'text-blue-400/50 cursor-not-allowed',
    border: 'border-blue-700',
    headerBorder: 'border-blue-800',
    sectionTitle: 'text-blue-300',
  },
} as const;
