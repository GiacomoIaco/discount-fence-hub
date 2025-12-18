import { useState, useRef, useEffect } from 'react';
import { User, Settings, Monitor, LayoutGrid, LayoutList, X, Bell, BellOff } from 'lucide-react';
import { usePushNotifications } from '../hooks/usePushNotifications';
import { showSuccess, showError } from '../lib/toast';

interface MobileHeaderProps {
  profileAvatarUrl: string | undefined;
  profileFullName: string;
  setViewMode: (mode: 'mobile' | 'desktop') => void;
  setShowProfileView: (show: boolean) => void;
  mobileLayout: 'expanded' | 'compact';
  setMobileLayout: (layout: 'expanded' | 'compact') => void;
}

export default function MobileHeader({
  profileAvatarUrl,
  profileFullName,
  setViewMode,
  setShowProfileView,
  mobileLayout,
  setMobileLayout
}: MobileHeaderProps) {
  const [showSettings, setShowSettings] = useState(false);
  const settingsRef = useRef<HTMLDivElement>(null);

  // Push notifications
  const {
    isSupported: pushSupported,
    permissionState,
    isSubscribed: pushEnabled,
    isLoading: pushLoading,
    enable: enablePush,
    disable: disablePush,
  } = usePushNotifications();

  const handleTogglePush = async () => {
    if (pushEnabled) {
      const success = await disablePush();
      if (success) {
        showSuccess('Push notifications disabled');
      } else {
        showError('Failed to disable notifications');
      }
    } else {
      const success = await enablePush();
      if (success) {
        showSuccess('Push notifications enabled!');
      } else {
        if (permissionState === 'denied') {
          showError('Blocked. Enable in browser settings.');
        } else {
          showError('Failed to enable notifications');
        }
      }
    }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(event.target as Node)) {
        setShowSettings(false);
      }
    };

    if (showSettings) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showSettings]);

  // Detect if user is on tablet (larger screen)
  const isTablet = typeof window !== 'undefined' && window.innerWidth >= 640;

  return (
    <div className="bg-white border-b border-gray-200 sticky top-0 z-10 pwa-safe-area-top relative">
      <div className="px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3 flex-1">
          <img src="/Logo-DF-Transparent.png" alt="Discount Fence USA" className="h-12 w-auto" />
          <p className="text-xs text-gray-500">
            {(() => {
              try {
                const buildTime = typeof __BUILD_TIME__ !== 'undefined' ? __BUILD_TIME__ : new Date().toISOString();
                const dateStr = new Date(buildTime).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
                return import.meta.env.MODE === 'development'
                  ? `v1.0.dev • ${dateStr}`
                  : `v1.0 • ${dateStr}`;
              } catch {
                return import.meta.env.MODE === 'development' ? 'v1.0.dev' : 'v1.0';
              }
            })()}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Settings Dropdown */}
          <div className="relative" ref={settingsRef}>
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
              title="View Settings"
            >
              <Settings className="w-5 h-5" />
            </button>

            {showSettings && (
              <div className="fixed top-16 right-2 left-2 sm:left-auto sm:right-4 sm:w-56 bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden z-50">
                <div className="p-3 border-b border-gray-100">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">View Settings</span>
                    <button
                      onClick={() => setShowSettings(false)}
                      className="p-1 text-gray-400 hover:text-gray-600 rounded"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="p-3">
                  {/* Layout Toggle */}
                  <div>
                    <p className="text-xs text-gray-500 mb-2">Menu Layout</p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setMobileLayout('expanded');
                        }}
                        className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                          mobileLayout === 'expanded'
                            ? 'bg-blue-100 text-blue-700 font-medium'
                            : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                        }`}
                      >
                        <LayoutList className="w-4 h-4" />
                        <span>Expanded</span>
                      </button>
                      <button
                        onClick={() => {
                          setMobileLayout('compact');
                        }}
                        className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                          mobileLayout === 'compact'
                            ? 'bg-blue-100 text-blue-700 font-medium'
                            : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                        }`}
                      >
                        <LayoutGrid className="w-4 h-4" />
                        <span>Compact</span>
                      </button>
                    </div>
                  </div>

                  {/* Push Notifications Toggle */}
                  {pushSupported && permissionState !== 'denied' && (
                    <>
                      <div className="my-3 border-t border-gray-100" />
                      <div>
                        <p className="text-xs text-gray-500 mb-2">Push Notifications</p>
                        <button
                          onClick={handleTogglePush}
                          disabled={pushLoading}
                          className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm transition-colors ${
                            pushEnabled
                              ? 'bg-green-50 text-green-700'
                              : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            {pushEnabled ? (
                              <Bell className="w-4 h-4" />
                            ) : (
                              <BellOff className="w-4 h-4" />
                            )}
                            <span>{pushEnabled ? 'Enabled' : 'Disabled'}</span>
                          </div>
                          {pushLoading ? (
                            <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <span className="text-xs px-2 py-0.5 rounded bg-white border">
                              {pushEnabled ? 'Tap to disable' : 'Tap to enable'}
                            </span>
                          )}
                        </button>
                      </div>
                    </>
                  )}

                  {/* Desktop View - Only show on tablets */}
                  {isTablet && (
                    <>
                      <div className="my-3 border-t border-gray-100" />
                      <button
                        onClick={() => {
                          setViewMode('desktop');
                          setShowSettings(false);
                        }}
                        className="w-full flex items-center gap-3 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
                      >
                        <Monitor className="w-4 h-4" />
                        <span>Switch to Desktop View</span>
                      </button>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Profile Avatar */}
          <button
            onClick={() => setShowProfileView(true)}
            className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 hover:opacity-80 transition-opacity"
          >
            {profileAvatarUrl ? (
              <img
                src={profileAvatarUrl}
                alt={profileFullName}
                className="w-10 h-10 rounded-full object-cover border-2 border-blue-600"
              />
            ) : (
              <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center">
                <User className="w-6 h-6 text-white" />
              </div>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
