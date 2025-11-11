import { useState } from 'react';
import { Monitor } from 'lucide-react';
import { useIsDesktop } from './hooks/useLeadershipPermissions';
import { useFunctionsQuery } from './hooks/useLeadershipQuery';
import LeadershipLayout from './LeadershipLayout';
import FunctionWorkspace from './components/FunctionWorkspace';
import ProgressDashboard from './components/ProgressDashboard';

interface LeadershipHubProps {
  onBack?: () => void;
}

export default function LeadershipHub({ onBack }: LeadershipHubProps) {
  const [selectedFunctionId, setSelectedFunctionId] = useState<string | null>(null);
  const [showingReports, setShowingReports] = useState(false);
  const [showNewFunctionModal, setShowNewFunctionModal] = useState(false);

  const isDesktop = useIsDesktop();
  const { data: functions } = useFunctionsQuery();

  // Desktop-only check
  if (!isDesktop) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 text-center">
          <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <Monitor className="w-10 h-10 text-blue-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-3">Desktop Required</h1>
          <p className="text-gray-600 mb-6">
            The Leadership Project Management feature is optimized for desktop use and requires a larger screen to function properly.
          </p>
          <p className="text-sm text-gray-500">
            Please access this feature from a desktop or laptop computer.
          </p>
          {onBack && (
            <button
              onClick={onBack}
              className="mt-6 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Go Back
            </button>
          )}
        </div>
      </div>
    );
  }

  // Auto-select first function if none selected and not showing reports
  if (!showingReports && !selectedFunctionId && functions && functions.length > 0) {
    setSelectedFunctionId(functions[0].id);
  }

  return (
    <LeadershipLayout
      selectedFunctionId={selectedFunctionId}
      onSelectFunction={(functionId) => {
        setSelectedFunctionId(functionId);
        setShowingReports(false); // Switch from reports to function view
      }}
      onReportsClick={() => {
        setShowingReports(true);
        setSelectedFunctionId(null); // Deselect function when viewing reports
      }}
      onNewFunctionClick={() => setShowNewFunctionModal(true)}
      showingReports={showingReports}
      onBack={onBack}
    >
      {showingReports ? (
        <div className="p-6">
          <ProgressDashboard onBack={() => setShowingReports(false)} />
        </div>
      ) : selectedFunctionId ? (
        <FunctionWorkspace functionId={selectedFunctionId} />
      ) : (
        <div className="flex items-center justify-center h-full">
          <div className="text-center p-12">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Welcome to Leadership
            </h2>
            <p className="text-gray-600 mb-6">
              Select a function from the sidebar to get started
            </p>
            <p className="text-sm text-gray-500">
              Or create your first function to begin tracking initiatives and goals
            </p>
          </div>
        </div>
      )}

      {/* TODO: Add New Function Modal */}
      {showNewFunctionModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold mb-4">Create New Function</h3>
            <p className="text-gray-600 mb-4">Modal coming soon...</p>
            <button
              onClick={() => setShowNewFunctionModal(false)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </LeadershipLayout>
  );
}
