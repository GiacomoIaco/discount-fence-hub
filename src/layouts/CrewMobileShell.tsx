import InstallAppBanner from '../components/InstallAppBanner';
import PushNotificationBanner from '../components/PushNotificationBanner';
import CrewBottomNav from './CrewBottomNav';

interface CrewMobileShellProps {
  children: React.ReactNode;
  activeTab: 'chat' | 'profile';
  onTabChange: (tab: 'chat' | 'profile') => void;
  unreadCount: number;
  profileFullName: string;
  profileAvatarUrl?: string;
  signOut: () => Promise<void>;
}

export function CrewMobileShell({
  children,
  activeTab,
  onTabChange,
  unreadCount,
  profileFullName,
  profileAvatarUrl,
}: CrewMobileShellProps) {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Simple header */}
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center space-x-3 safe-area-top">
        <img src="/logo-transparent.png" alt="Logo" className="h-8 w-auto" />
        <div className="flex items-center space-x-2 ml-auto">
          {profileAvatarUrl ? (
            <img
              src={profileAvatarUrl}
              alt={profileFullName}
              className="w-8 h-8 rounded-full object-cover"
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-sm font-bold">
              {profileFullName.charAt(0).toUpperCase()}
            </div>
          )}
          <span className="text-sm font-medium text-gray-700 truncate max-w-[120px]">
            {profileFullName}
          </span>
        </div>
      </header>

      {/* Content with bottom padding for nav */}
      <div className="pb-20">
        {children}
      </div>

      {/* Bottom navigation */}
      <CrewBottomNav
        activeTab={activeTab}
        onTabChange={onTabChange}
        unreadCount={unreadCount}
      />

      {/* Banners */}
      <InstallAppBanner />
      <PushNotificationBanner />
    </div>
  );
}

export default CrewMobileShell;
