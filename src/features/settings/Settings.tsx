import { useState } from 'react';
import { ArrowLeft, Users, Menu, RefreshCw, Smartphone, Bell, FileText, BookOpen, Truck, SlidersHorizontal } from 'lucide-react';
import TeamManagement from './components/TeamManagement';
import RequestSettings from './components/RequestSettings';
import MenuVisibilitySettings from './components/MenuVisibilitySettings';
import NotificationSettings from './components/NotificationSettings';
import QboClassesSettings from './components/QboClassesSettings';
import FSMSettings from './components/FSMSettings';
import CustomFieldsSettings from './components/CustomFieldsSettings';
import type { UserRole } from '../../types';

// Declare build time from vite config
declare const __BUILD_TIME__: string;

interface SettingsProps {
  onBack: () => void;
  userRole: UserRole;
}

export default function Settings({ onBack, userRole }: SettingsProps) {
  const [activeTab, setActiveTab] = useState<'team' | 'request-settings' | 'menu-visibility' | 'notifications' | 'app' | 'qbo-classes' | 'fsm' | 'custom-fields'>('team');
  const [isRefreshing, setIsRefreshing] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button
          onClick={onBack}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <div className="flex gap-8">
          <button
            onClick={() => setActiveTab('app')}
            className={`flex items-center gap-2 pb-4 px-1 border-b-2 transition-colors ${
              activeTab === 'app'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            <Smartphone className="w-5 h-5" />
            <span className="font-medium">App</span>
          </button>

          <button
            onClick={() => setActiveTab('notifications')}
            className={`flex items-center gap-2 pb-4 px-1 border-b-2 transition-colors ${
              activeTab === 'notifications'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            <Bell className="w-5 h-5" />
            <span className="font-medium">Notifications</span>
          </button>

          <button
            onClick={() => setActiveTab('team')}
            className={`flex items-center gap-2 pb-4 px-1 border-b-2 transition-colors ${
              activeTab === 'team'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            <Users className="w-5 h-5" />
            <span className="font-medium">Team Management</span>
          </button>

          {userRole === 'admin' && (
            <>
              <button
                onClick={() => setActiveTab('request-settings')}
                className={`flex items-center gap-2 pb-4 px-1 border-b-2 transition-colors ${
                  activeTab === 'request-settings'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                <FileText className="w-5 h-5" />
                <span className="font-medium">Request Settings</span>
              </button>

              <button
                onClick={() => setActiveTab('menu-visibility')}
                className={`flex items-center gap-2 pb-4 px-1 border-b-2 transition-colors ${
                  activeTab === 'menu-visibility'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                <Menu className="w-5 h-5" />
                <span className="font-medium">Menu Visibility</span>
              </button>

              <button
                onClick={() => setActiveTab('qbo-classes')}
                className={`flex items-center gap-2 pb-4 px-1 border-b-2 transition-colors ${
                  activeTab === 'qbo-classes'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                <BookOpen className="w-5 h-5" />
                <span className="font-medium">QBO Classes</span>
              </button>

              <button
                onClick={() => setActiveTab('fsm')}
                className={`flex items-center gap-2 pb-4 px-1 border-b-2 transition-colors ${
                  activeTab === 'fsm'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                <Truck className="w-5 h-5" />
                <span className="font-medium">FSM</span>
              </button>

              <button
                onClick={() => setActiveTab('custom-fields')}
                className={`flex items-center gap-2 pb-4 px-1 border-b-2 transition-colors ${
                  activeTab === 'custom-fields'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                <SlidersHorizontal className="w-5 h-5" />
                <span className="font-medium">Custom Fields</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Content */}
      <div>
        {activeTab === 'app' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">App Version</h2>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Last Updated</p>
                    <p className="text-gray-900">
                      {typeof __BUILD_TIME__ !== 'undefined'
                        ? new Date(__BUILD_TIME__).toLocaleString()
                        : 'Unknown'}
                    </p>
                  </div>
                </div>

                <div className="border-t border-gray-200 pt-4">
                  <h3 className="text-sm font-medium text-gray-900 mb-2">Check for Updates</h3>
                  <p className="text-sm text-gray-600 mb-4">
                    If you're experiencing issues or want to ensure you have the latest version,
                    use the button below to refresh the app and clear the cache.
                  </p>
                  <button
                    onClick={async () => {
                      setIsRefreshing(true);
                      // Clear all caches
                      if ('caches' in window) {
                        const names = await caches.keys();
                        await Promise.all(names.map(name => caches.delete(name)));
                      }
                      // Unregister service worker
                      if ('serviceWorker' in navigator) {
                        const registrations = await navigator.serviceWorker.getRegistrations();
                        await Promise.all(registrations.map(r => r.unregister()));
                      }
                      // Hard reload
                      window.location.reload();
                    }}
                    disabled={isRefreshing}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                  >
                    <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                    {isRefreshing ? 'Refreshing...' : 'Refresh App & Clear Cache'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
        {activeTab === 'notifications' && <NotificationSettings />}
        {activeTab === 'team' && <TeamManagement userRole={userRole} />}
        {activeTab === 'request-settings' && userRole === 'admin' && (
          <RequestSettings />
        )}
        {activeTab === 'menu-visibility' && userRole === 'admin' && (
          <MenuVisibilitySettings />
        )}
        {activeTab === 'qbo-classes' && userRole === 'admin' && (
          <QboClassesSettings />
        )}
        {activeTab === 'fsm' && userRole === 'admin' && (
          <FSMSettings />
        )}
        {activeTab === 'custom-fields' && userRole === 'admin' && (
          <CustomFieldsSettings />
        )}
      </div>
    </div>
  );
}
