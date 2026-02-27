import type { ReactNode } from 'react';
import { Menu } from 'lucide-react';
import TodoSidebar from './TodoSidebar';

interface TodoLayoutProps {
  children: ReactNode;
  selectedListId: string | null;
  showMyWork: boolean;
  onSelectList: (listId: string) => void;
  onMyWorkClick: () => void;
  onNewListClick: () => void;
  isMobileSidebarOpen: boolean;
  onToggleMobileSidebar: () => void;
}

export default function TodoLayout({
  children,
  selectedListId,
  showMyWork,
  onSelectList,
  onMyWorkClick,
  onNewListClick,
  isMobileSidebarOpen,
  onToggleMobileSidebar,
}: TodoLayoutProps) {
  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Sidebar */}
      <TodoSidebar
        selectedListId={selectedListId}
        showMyWork={showMyWork}
        onSelectList={onSelectList}
        onMyWorkClick={onMyWorkClick}
        onNewListClick={onNewListClick}
        isMobileOpen={isMobileSidebarOpen}
        onMobileClose={onToggleMobileSidebar}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar (mobile only - hamburger for sidebar) */}
        <div className="bg-white border-b border-gray-200 px-4 py-2 flex items-center gap-3 lg:hidden">
          <button
            onClick={onToggleMobileSidebar}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            title="Toggle sidebar"
          >
            <Menu className="w-5 h-5 text-gray-600" />
          </button>

          <span className="text-sm font-medium text-gray-600">My To-Dos</span>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-auto">
          {children}
        </div>
      </div>
    </div>
  );
}
