import { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import SettingsSidebar from './components/SettingsSidebar';
import type { SettingsPage } from './components/SettingsSidebar';
import TeamManagement from './components/TeamManagement';
import RequestSettings from './components/RequestSettings';
import MenuVisibilitySettings from './components/MenuVisibilitySettings';
import NotificationSettings from './components/NotificationSettings';
import QboClassesSettings from './components/QboClassesSettings';
import FSMSettings from './components/FSMSettings';
import CustomFieldsSettings from './components/CustomFieldsSettings';
import QuoteApprovalSettings from './components/QuoteApprovalSettings';
import { TerritoriesPage } from './territories';
import { SalespersonMappingSettings } from '../analytics';

// Declare build time from vite config
declare const __BUILD_TIME__: string;

interface SettingsProps {
  onBack: () => void;
}

export default function Settings({ onBack }: SettingsProps) {
  const [activePage, setActivePage] = useState<SettingsPage>('app');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const renderContent = () => {
    switch (activePage) {
      case 'app':
        return (
          <div className="p-6">
            <h1 className="text-2xl font-bold text-gray-900 mb-6">App Settings</h1>
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
                    className="flex items-center gap-2 px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-50"
                  >
                    <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                    {isRefreshing ? 'Refreshing...' : 'Refresh App & Clear Cache'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        );

      case 'notifications':
        return (
          <div className="p-6">
            <h1 className="text-2xl font-bold text-gray-900 mb-6">Notification Settings</h1>
            <NotificationSettings />
          </div>
        );

      case 'team':
        return (
          <div className="p-6">
            <h1 className="text-2xl font-bold text-gray-900 mb-6">Team Management</h1>
            <TeamManagement />
          </div>
        );

      case 'salesperson-mapping':
        return (
          <div className="p-6">
            <h1 className="text-2xl font-bold text-gray-900 mb-6">Salesperson Mapping</h1>
            <p className="text-gray-600 mb-6">Link app users to their Jobber salesperson data for mobile analytics.</p>
            <SalespersonMappingSettings />
          </div>
        );

      case 'request-settings':
        return (
          <div className="p-6">
            <h1 className="text-2xl font-bold text-gray-900 mb-6">Request Settings</h1>
            <RequestSettings />
          </div>
        );

      case 'menu-visibility':
        return (
          <div className="p-6">
            <h1 className="text-2xl font-bold text-gray-900 mb-6">Menu Visibility</h1>
            <MenuVisibilitySettings />
          </div>
        );

      case 'qbo-classes':
        return (
          <div className="p-6">
            <h1 className="text-2xl font-bold text-gray-900 mb-6">QBO Classes</h1>
            <QboClassesSettings />
          </div>
        );

      case 'fsm':
        return (
          <div className="p-6">
            <h1 className="text-2xl font-bold text-gray-900 mb-6">FSM Settings</h1>
            <FSMSettings />
          </div>
        );

      case 'custom-fields':
        return (
          <div className="p-6">
            <h1 className="text-2xl font-bold text-gray-900 mb-6">Custom Fields</h1>
            <CustomFieldsSettings />
          </div>
        );

      case 'quote-approval':
        return (
          <div className="p-6">
            <h1 className="text-2xl font-bold text-gray-900 mb-6">Quote Approval Settings</h1>
            <QuoteApprovalSettings />
          </div>
        );

      case 'territories':
        return <TerritoriesPage />;

      default:
        return null;
    }
  };

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Sidebar */}
      <SettingsSidebar
        activePage={activePage}
        onPageChange={setActivePage}
        onBack={onBack}
      />

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto">
        {renderContent()}
      </div>
    </div>
  );
}
