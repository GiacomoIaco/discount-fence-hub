import { useState, type ReactNode } from 'react';
import { PanelLeft } from 'lucide-react';
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
 * - Collapsible left sidebar with navigation
 * - Main content area (full width)
 */
export default function HubLayout({
  children,
  activePage,
  onPageChange,
  onBack,
  isAdmin
}: HubLayoutProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Left Sidebar - Collapsible */}
      {!sidebarCollapsed && (
        <HubSidebar
          activePage={activePage}
          onPageChange={onPageChange}
          onBack={onBack}
          isAdmin={isAdmin}
          onCollapse={() => setSidebarCollapsed(true)}
        />
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Expand sidebar button when collapsed */}
        {sidebarCollapsed && (
          <button
            onClick={() => setSidebarCollapsed(false)}
            className="absolute top-2 left-2 z-10 p-2 bg-[#1E3A8A] text-white rounded-lg hover:bg-blue-800 shadow-lg transition-colors"
            title="Expand sidebar"
          >
            <PanelLeft className="w-4 h-4" />
          </button>
        )}
        {children}
      </div>
    </div>
  );
}
