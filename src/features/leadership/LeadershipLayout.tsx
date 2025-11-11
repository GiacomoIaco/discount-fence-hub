import type { ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';
import FunctionSidebar from './components/FunctionSidebar';

interface LeadershipLayoutProps {
  children: ReactNode;
  selectedFunctionId?: string | null;
  onSelectFunction?: (functionId: string) => void;
  onBack?: () => void;
}

/**
 * Monday.com-style layout for Leadership system
 * - Left sidebar with function list
 * - Main content area (full width)
 * - Top bar with breadcrumbs and actions
 */
export default function LeadershipLayout({
  children,
  selectedFunctionId,
  onSelectFunction,
  onBack
}: LeadershipLayoutProps) {
  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Left Sidebar - Function List */}
      <FunctionSidebar
        selectedFunctionId={selectedFunctionId}
        onSelectFunction={onSelectFunction}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            {onBack && (
              <button
                onClick={onBack}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                title="Back to Main App"
              >
                <ArrowLeft className="w-5 h-5 text-gray-600" />
              </button>
            )}
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Leadership</h1>
              <p className="text-sm text-gray-500">Project Management & Goal Tracking</p>
            </div>
          </div>

          {/* Top Bar Actions - Reserved for future use */}
          <div className="flex items-center gap-2">
            {/* Settings, Export, Team buttons can go here */}
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-auto">
          {children}
        </div>
      </div>
    </div>
  );
}
