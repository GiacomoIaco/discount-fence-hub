import { useState } from 'react';
import { Monitor } from 'lucide-react';
import { useIsDesktop } from './hooks/useLeadershipPermissions';
import Dashboard from './components/Dashboard';
import SettingsHub from './components/Settings/SettingsHub';
import FunctionView from './components/FunctionView';
import MyInitiativesView from './components/MyInitiativesView';
import HighPriorityView from './components/HighPriorityView';
import WeeklyCheckinView from './components/WeeklyCheckinView';

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
      <FunctionView
        functionId={selectedFunctionId}
        onBack={() => {
          setSelectedFunctionId(null);
          setView('dashboard');
        }}
      />
    );
  }

  // My Initiatives View
  if (view === 'my-initiatives') {
    return <MyInitiativesView onBack={() => setView('dashboard')} />;
  }

  // High Priority View (Admin only)
  if (view === 'high-priority') {
    return <HighPriorityView onBack={() => setView('dashboard')} />;
  }

  // Weekly Check-in View
  if (view === 'weekly-checkin') {
    return <WeeklyCheckinView onBack={() => setView('dashboard')} />;
  }

  // Settings View (Admin only)
  if (view === 'settings') {
    return <SettingsHub onBack={() => setView('dashboard')} />;
  }

  return null;
}
