import { useState, useEffect } from 'react';
import { Monitor } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useIsDesktop } from './hooks/useLeadershipPermissions';
import { useFunctionsQuery } from './hooks/useLeadershipQuery';
import LeadershipLayout from './LeadershipLayout';
import FunctionWorkspace from './components/FunctionWorkspace';
import ProgressDashboard from './components/ProgressDashboard';
import NewFunctionModal from './components/NewFunctionModal';
import SettingsHub from './components/Settings/SettingsHub';
import { buildTabUrl, getTabFromPath } from '../../lib/routes';

type LeadershipView = 'functions' | 'reports' | 'settings';

interface LeadershipHubProps {
  onBack?: () => void;
}

export default function LeadershipHub({ onBack }: LeadershipHubProps) {
  const [selectedFunctionId, setSelectedFunctionId] = useState<string | null>(null);
  const [showingReports, setShowingReports] = useState(false);
  const [showingSettings, setShowingSettings] = useState(false);
  const [showNewFunctionModal, setShowNewFunctionModal] = useState(false);

  const isDesktop = useIsDesktop();
  const { data: functions } = useFunctionsQuery();
  const location = useLocation();
  const navigate = useNavigate();

  // Derive current view from state
  const getCurrentView = (): LeadershipView => {
    if (showingSettings) return 'settings';
    if (showingReports) return 'reports';
    return 'functions';
  };

  // Sync URL with view state
  useEffect(() => {
    const currentView = getCurrentView();
    const targetPath = buildTabUrl('leadership', currentView);
    if (location.pathname !== targetPath) {
      navigate(targetPath, { replace: true });
    }
  }, [showingReports, showingSettings, location.pathname, navigate]);

  // Sync view state with URL on mount/navigation
  useEffect(() => {
    const tabFromUrl = getTabFromPath('leadership', location.pathname) as LeadershipView;
    if (tabFromUrl === 'reports' && !showingReports) {
      setShowingReports(true);
      setShowingSettings(false);
      setSelectedFunctionId(null);
    } else if (tabFromUrl === 'settings' && !showingSettings) {
      setShowingSettings(true);
      setShowingReports(false);
      setSelectedFunctionId(null);
    } else if (tabFromUrl === 'functions' && (showingReports || showingSettings)) {
      setShowingReports(false);
      setShowingSettings(false);
    }
  }, [location.pathname]);

  // Navigation handlers that update URL
  const handleReportsClick = () => {
    setShowingReports(true);
    setShowingSettings(false);
    setSelectedFunctionId(null);
    navigate(buildTabUrl('leadership', 'reports'));
  };

  const handleSettingsClick = () => {
    setShowingSettings(true);
    setShowingReports(false);
    setSelectedFunctionId(null);
    navigate(buildTabUrl('leadership', 'settings'));
  };

  const handleSelectFunction = (functionId: string) => {
    setSelectedFunctionId(functionId);
    setShowingReports(false);
    setShowingSettings(false);
    navigate(buildTabUrl('leadership', 'functions'));
  };

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

  // Auto-select first function if none selected and not showing reports or settings
  if (!showingReports && !showingSettings && !selectedFunctionId && functions && functions.length > 0) {
    setSelectedFunctionId(functions[0].id);
  }

  return (
    <LeadershipLayout
      selectedFunctionId={selectedFunctionId}
      onSelectFunction={handleSelectFunction}
      onReportsClick={handleReportsClick}
      onSettingsClick={handleSettingsClick}
      onNewFunctionClick={() => setShowNewFunctionModal(true)}
      showingReports={showingReports}
      showingSettings={showingSettings}
      onBack={onBack}
    >
      {showingSettings ? (
        <SettingsHub onBack={() => setShowingSettings(false)} />
      ) : showingReports ? (
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

      {/* New Function Modal */}
      {showNewFunctionModal && (
        <NewFunctionModal
          onClose={() => setShowNewFunctionModal(false)}
          onSuccess={() => {
            // Refresh will happen automatically via React Query
          }}
        />
      )}
    </LeadershipLayout>
  );
}
