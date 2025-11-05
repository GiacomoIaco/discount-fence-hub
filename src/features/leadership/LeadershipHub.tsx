import { useState } from 'react';
import { Monitor } from 'lucide-react';
import { useIsDesktop } from './hooks/useLeadershipPermissions';
import Dashboard from './components/Dashboard';
import SettingsHub from './components/Settings/SettingsHub';

type View = 'dashboard' | 'function' | 'initiative' | 'my-initiatives' | 'high-priority' | 'weekly-checkin' | 'settings';

interface LeadershipHubProps {
  onBack?: () => void;
}

export default function LeadershipHub({ onBack }: LeadershipHubProps) {
  const [view, setView] = useState<View>('dashboard');
  const [selectedFunctionId, setSelectedFunctionId] = useState<string | null>(null);

  const isDesktop = useIsDesktop();

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

  // Dashboard View
  if (view === 'dashboard') {
    return (
      <Dashboard
        onViewFunction={(functionId) => {
          setSelectedFunctionId(functionId);
          setView('function');
        }}
        onViewMyInitiatives={() => setView('my-initiatives')}
        onViewHighPriority={() => setView('high-priority')}
        onViewWeeklyCheckin={() => setView('weekly-checkin')}
        onViewSettings={() => setView('settings')}
      />
    );
  }

  // Function View
  if (view === 'function' && selectedFunctionId) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="p-6">
          <button
            onClick={() => {
              setSelectedFunctionId(null);
              setView('dashboard');
            }}
            className="mb-4 text-blue-600 hover:text-blue-700"
          >
            ← Back to Dashboard
          </button>
          <h1 className="text-3xl font-bold">Function View</h1>
          <p className="text-gray-600">Function ID: {selectedFunctionId}</p>
          <p className="text-sm text-gray-500 mt-4">Component coming in Sprint 2</p>
        </div>
      </div>
    );
  }

  // My Initiatives View
  if (view === 'my-initiatives') {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="p-6">
          <button
            onClick={() => setView('dashboard')}
            className="mb-4 text-blue-600 hover:text-blue-700"
          >
            ← Back to Dashboard
          </button>
          <h1 className="text-3xl font-bold">My Initiatives</h1>
          <p className="text-sm text-gray-500 mt-4">Component coming in Sprint 2</p>
        </div>
      </div>
    );
  }

  // High Priority View (Admin only)
  if (view === 'high-priority') {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="p-6">
          <button
            onClick={() => setView('dashboard')}
            className="mb-4 text-blue-600 hover:text-blue-700"
          >
            ← Back to Dashboard
          </button>
          <h1 className="text-3xl font-bold">High Priority Initiatives</h1>
          <p className="text-sm text-gray-500 mt-4">Component coming in Sprint 3</p>
        </div>
      </div>
    );
  }

  // Weekly Check-in View
  if (view === 'weekly-checkin') {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="p-6">
          <button
            onClick={() => setView('dashboard')}
            className="mb-4 text-blue-600 hover:text-blue-700"
          >
            ← Back to Dashboard
          </button>
          <h1 className="text-3xl font-bold">Weekly Check-in</h1>
          <p className="text-sm text-gray-500 mt-4">Component coming in Sprint 2</p>
        </div>
      </div>
    );
  }

  // Settings View (Admin only)
  if (view === 'settings') {
    return <SettingsHub onBack={() => setView('dashboard')} />;
  }

  return null;
}
