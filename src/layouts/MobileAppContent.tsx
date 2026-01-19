/**
 * Mobile App Content wrapper that can access RightPaneContext
 * Used to connect MobileBottomNav to the messaging pane
 */

import { Suspense, useState, lazy } from 'react';
import MobileHeader from './MobileHeader';
import MobileBottomNav from './MobileBottomNav';
import VoiceRecordingModal from '../components/VoiceRecordingModal';
import InstallAppBanner from '../components/InstallAppBanner';
import PushNotificationBanner from '../components/PushNotificationBanner';
import { RightPaneMessaging } from '../features/message-center/components';
import { useUnifiedUnreadCount } from '../features/message-center/hooks';
import type { Section } from '../lib/routes';

// Lazy load modals
const UserProfileView = lazy(() => import('../features/user-profile').then(m => ({ default: m.UserProfileView })));
const UserProfileEditor = lazy(() => import('../features/user-profile').then(m => ({ default: m.UserProfileEditor })));

const LoadingFallback = () => (
  <div className="flex items-center justify-center min-h-[200px]">
    <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
  </div>
);

interface MobileAppContentProps {
  children: React.ReactNode;
  activeSection: Section;
  onNavigate: (section: Section) => void;
  userId?: string;
  profileAvatarUrl?: string;
  profileFullName?: string;
  userRole?: string;
  setViewMode: (mode: 'mobile' | 'desktop') => void;
  mobileLayout: 'expanded' | 'compact';
  setMobileLayout: (layout: 'expanded' | 'compact') => void;
  showProfileView: boolean;
  setShowProfileView: (show: boolean) => void;
  showProfileEditor: boolean;
  setShowProfileEditor: (show: boolean) => void;
}

export function MobileAppContent({
  children,
  activeSection,
  onNavigate,
  userId,
  profileAvatarUrl,
  profileFullName,
  userRole,
  setViewMode,
  mobileLayout,
  setMobileLayout,
  showProfileView,
  setShowProfileView,
  showProfileEditor,
  setShowProfileEditor,
}: MobileAppContentProps) {
  const { total: unreadMessageCount } = useUnifiedUnreadCount({ userId, userRole });
  const [showVoiceRecording, setShowVoiceRecording] = useState(false);

  // Handle refresh - clear caches and reload
  const handleRefresh = async () => {
    if ('caches' in window) {
      const names = await caches.keys();
      await Promise.all(names.map(name => caches.delete(name)));
    }
    window.location.reload();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <MobileHeader
        profileAvatarUrl={profileAvatarUrl}
        profileFullName={profileFullName || 'User'}
        setViewMode={setViewMode}
        setShowProfileView={setShowProfileView}
        mobileLayout={mobileLayout}
        setMobileLayout={setMobileLayout}
      />

      {/* Main content with bottom padding for nav */}
      <div className="pb-20">
        {children}
      </div>

      {/* Mobile Bottom Navigation */}
      <MobileBottomNav
        activeSection={activeSection}
        onNavigate={onNavigate}
        onVoiceRecord={() => setShowVoiceRecording(true)}
        onRefresh={handleRefresh}
        unreadMessageCount={unreadMessageCount}
      />

      {/* Voice Recording Modal */}
      {showVoiceRecording && (
        <VoiceRecordingModal
          onClose={() => setShowVoiceRecording(false)}
          onNavigate={onNavigate}
          userId={userId}
        />
      )}

      {/* Install App Banner */}
      <InstallAppBanner />

      {/* Push Notification Banner */}
      <PushNotificationBanner />

      {/* Profile Modals */}
      {showProfileView && (
        <Suspense fallback={<LoadingFallback />}>
          <UserProfileView
            onClose={() => setShowProfileView(false)}
            onEdit={() => {
              setShowProfileView(false);
              setShowProfileEditor(true);
            }}
          />
        </Suspense>
      )}

      {showProfileEditor && (
        <Suspense fallback={<LoadingFallback />}>
          <UserProfileEditor
            onClose={() => setShowProfileEditor(false)}
            onSave={() => {
              setShowProfileEditor(false);
              window.location.reload();
            }}
          />
        </Suspense>
      )}

      {/* Right-Pane Messaging */}
      <RightPaneMessaging />
    </div>
  );
}

export default MobileAppContent;
