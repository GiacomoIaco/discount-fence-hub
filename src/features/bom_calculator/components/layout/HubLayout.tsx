import type { ReactNode } from 'react';
import HubSidebar, { type BOMHubPage } from './HubSidebar';

interface HubLayoutProps {
  children: ReactNode;
  activePage: BOMHubPage;
  onPageChange: (page: BOMHubPage) => void;
  onBack: () => void;
  isAdmin: boolean;
}

/**
 * Layout wrapper for the BOM Calculator Hub
 * - Left sidebar with navigation
 * - Main content area (full width)
 */
export default function HubLayout({
  children,
  activePage,
  onPageChange,
  onBack,
  isAdmin
}: HubLayoutProps) {
  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Left Sidebar */}
      <HubSidebar
        activePage={activePage}
        onPageChange={onPageChange}
        onBack={onBack}
        isAdmin={isAdmin}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {children}
      </div>
    </div>
  );
}
