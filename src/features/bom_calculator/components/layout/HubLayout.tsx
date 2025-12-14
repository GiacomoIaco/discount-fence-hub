import type { ReactNode } from 'react';
import HubSidebar, { type BOMHubPage } from './HubSidebar';

interface HubLayoutProps {
  children: ReactNode;
  activePage: BOMHubPage;
  onPageChange: (page: BOMHubPage) => void;
  onBack: () => void;
  isAdmin: boolean;
  onOpenV2?: () => void;
}

/**
 * Layout wrapper for the BOM Calculator Hub
 * - Collapsible left sidebar with navigation (icon-only when collapsed)
 * - Main content area (full width)
 */
export default function HubLayout({
  children,
  activePage,
  onPageChange,
  onBack,
  isAdmin,
  onOpenV2
}: HubLayoutProps) {
  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Left Sidebar - Always visible, collapses to icon-only */}
      <HubSidebar
        activePage={activePage}
        onPageChange={onPageChange}
        onBack={onBack}
        isAdmin={isAdmin}
        onOpenV2={onOpenV2}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {children}
      </div>
    </div>
  );
}
