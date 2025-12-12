/**
 * Shared components used across Product Type Manager tabs
 */

import React from 'react';

// =============================================================================
// TAB BUTTON
// =============================================================================

interface TabButtonProps {
  label: string;
  icon: React.ReactNode;
  isActive: boolean;
  onClick: () => void;
  count?: number;
}

export function TabButton({
  label,
  icon,
  isActive,
  onClick,
  count,
}: TabButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
        isActive
          ? 'border-purple-600 text-purple-600'
          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
      }`}
    >
      {icon}
      {label}
      {count !== undefined && (
        <span className={`px-1.5 py-0.5 text-xs rounded-full ${
          isActive ? 'bg-purple-100' : 'bg-gray-100'
        }`}>
          {count}
        </span>
      )}
    </button>
  );
}

// =============================================================================
// EMPTY STATE
// =============================================================================

interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="text-gray-400 mb-4">{icon}</div>
      <h3 className="text-lg font-medium text-gray-900 mb-2">{title}</h3>
      <p className="text-sm text-gray-500 mb-6 max-w-sm">{description}</p>
      {action}
    </div>
  );
}
