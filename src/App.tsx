import { useState, useEffect, lazy, Suspense } from 'react';
import { Home, DollarSign, Ticket, Image, BookOpen, Send, MessageSquare, MessageCircle, Settings as SettingsIcon, Calculator, Target } from 'lucide-react';
import { ToastProvider } from './contexts/ToastContext';
import InstallAppBanner from './components/InstallAppBanner';
import PWAUpdatePrompt from './components/PWAUpdatePrompt';
import { ErrorBoundary } from './components/ErrorBoundary';
import { useAuth } from './contexts/AuthContext';
import { useEscalationEngine } from './hooks/useEscalationEngine';
import { useMenuVisibility } from './hooks/useMenuVisibility';
import { useRequestNotifications } from './hooks/useRequestNotifications';
import { useAnnouncementEngagement } from './hooks/useAnnouncementEngagement';
import type { Request } from './features/requests/lib/requests';

// Layout components
import Sidebar from './layouts/Sidebar';
import MobileHeader from './layouts/MobileHeader';

// View components
import Dashboard from './components/views/Dashboard';
import SalesRepView from './components/views/SalesRepView';

// ============================================
// CODE SPLITTING: Lazy-load large components
// ============================================
// This reduces initial bundle size by ~70% and improves load time

const StainCalculator = lazy(() => import('./features/sales-tools').then(module => ({ default: module.StainCalculator })));
const ClientPresentation = lazy(() => import('./features/sales-tools').then(module => ({ default: module.ClientPresentation })));
const SalesCoach = lazy(() => import('./features/ai-coach').then(module => ({ default: module.SalesCoach })));
const SalesCoachAdmin = lazy(() => import('./features/ai-coach').then(module => ({ default: module.SalesCoachAdmin })));
const PhotoGalleryRefactored = lazy(() => import('./features/photos').then(module => ({ default: module.PhotoGalleryRefactored })));
const SalesResources = lazy(() => import('./features/sales-resources').then(module => ({ default: module.SalesResources })));
const Analytics = lazy(() => import('./features/analytics').then(module => ({ default: module.Analytics })));
const Settings = lazy(() => import('./features/settings').then(module => ({ default: module.Settings })));
const MessageComposer = lazy(() => import('./features/communication').then(module => ({ default: module.MessageComposer })));
const TeamCommunication = lazy(() => import('./features/communication').then(module => ({ default: module.TeamCommunication })));
const DirectMessages = lazy(() => import('./features/communication').then(module => ({ default: module.DirectMessages })));
const UserProfileEditor = lazy(() => import('./features/user-profile').then(module => ({ default: module.UserProfileEditor })));
const UserProfileView = lazy(() => import('./features/user-profile').then(module => ({ default: module.UserProfileView })));
const RequestHub = lazy(() => import('./features/requests').then(module => ({ default: module.RequestHub })));
const MyRequestsView = lazy(() => import('./features/requests').then(module => ({ default: module.MyRequestsView })));
const OperationsQueue = lazy(() => import('./features/requests').then(module => ({ default: module.RequestQueue })));
const RequestDetail = lazy(() => import('./features/requests').then(module => ({ default: module.RequestDetail })));
const Login = lazy(() => import('./components/auth/Login'));
const BOMCalculator = lazy(() => import('./features/bom_calculator/BOMCalculator').then(m => ({ default: m.BOMCalculator })));
const LeadershipHub = lazy(() => import('./features/leadership/LeadershipHub'));

// Loading fallback component
const LoadingFallback = () => (
  <div className="flex items-center justify-center min-h-[400px]">
    <div className="text-center">
      <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
      <div className="text-gray-600">Loading...</div>
    </div>
  </div>
);

type UserRole = 'sales' | 'operations' | 'sales-manager' | 'admin';
type Section = 'home' | 'custom-pricing' | 'requests' | 'my-requests' | 'presentation' | 'stain-calculator' | 'sales-coach' | 'sales-coach-admin' | 'photo-gallery' | 'sales-resources' | 'dashboard' | 'request-queue' | 'analytics' | 'team' | 'manager-dashboard' | 'team-communication' | 'direct-messages' | 'assignment-rules' | 'bom-calculator' | 'leadership';

function App() {
  const { user, profile, loading, signOut } = useAuth();

  // Get role and name from authenticated profile, with fallback for role switching
  const [userRole, setUserRole] = useState<UserRole>(profile?.role || 'sales');

  // Update userRole from profile when it changes
  useEffect(() => {
    if (profile?.role) {
      setUserRole(profile.role);
    }
  }, [profile]);

  const userName = profile?.full_name || 'User';
  const [activeSection, setActiveSection] = useState<Section>('home');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [viewMode, setViewMode] = useState<'mobile' | 'desktop'>(() => {
    const saved = localStorage.getItem('viewMode');
    return (saved as 'mobile' | 'desktop') || 'mobile';
  });
  const [showMessageComposer, setShowMessageComposer] = useState(false);
  const [editingDraft, setEditingDraft] = useState<any>(null);
  const [showProfileEditor, setShowProfileEditor] = useState(false);
  const [showProfileView, setShowProfileView] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<Request | null>(null);

  // Enable escalation engine for operations/admin roles
  const isOperationsRole = ['operations', 'sales-manager', 'admin'].includes(userRole);
  useEscalationEngine(isOperationsRole);

  // Menu visibility control
  const { canSeeMenuItem } = useMenuVisibility();

  // Request notifications
  const { unreadCount: requestUnreadCount, markRequestAsRead } = useRequestNotifications();

  // Admin announcement engagement notifications
  const { unreadCount: announcementEngagementCount } = useAnnouncementEngagement();

  // Track unread announcements for all users (Chat badge)
  const [unreadAnnouncementsCount, setUnreadAnnouncementsCount] = useState(0);

  // Track unread team communication messages (Announcements badge)
  const [teamCommunicationUnreadCount, setTeamCommunicationUnreadCount] = useState(0);

  // Refresh trigger for team communication (incremented when a new message is sent)
  const [teamCommunicationRefresh, setTeamCommunicationRefresh] = useState(0);

  // Save viewMode to localStorage when it changes
  useEffect(() => {
    localStorage.setItem('viewMode', viewMode);
  }, [viewMode]);

  // Auto-collapse sidebar in Leadership mode for maximum screen space
  useEffect(() => {
    if (activeSection === 'leadership') {
      setSidebarOpen(false);
    }
  }, [activeSection]);

  // Handle browser back button to prevent app close
  useEffect(() => {
    // Push initial state
    window.history.pushState(null, '', window.location.href);

    const handlePopState = (e: PopStateEvent) => {
      e.preventDefault();
      // Push state again to keep user in app
      window.history.pushState(null, '', window.location.href);

      // Navigate back within app if not on home
      if (activeSection !== 'home') {
        setActiveSection('home');
      }
    };

    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [activeSection]);

  // Universal navigation items - same for all roles (permissions controlled inside each component)
  const getNavigationItems = () => {
    const items = [
      { id: 'dashboard' as Section, name: 'Dashboard', icon: Home },
      { id: 'team-communication' as Section, name: 'Announcements', icon: MessageSquare, badge: teamCommunicationUnreadCount },
      { id: 'direct-messages' as Section, name: 'Chat', icon: MessageCircle, badge: unreadAnnouncementsCount },
      { id: 'presentation' as Section, name: 'Client Presentation', icon: BookOpen },
      { id: 'sales-coach' as Section, name: 'AI Sales Coach', icon: BookOpen },
      { id: 'photo-gallery' as Section, name: 'Photo Gallery', icon: Image },
      { id: 'stain-calculator' as Section, name: 'Pre-Stain Calculator', icon: DollarSign },
      { id: 'bom-calculator' as Section, name: 'BOM Calculator', icon: Calculator },
      { id: 'my-requests' as Section, name: 'My Requests', icon: Ticket, badge: requestUnreadCount },
      { id: 'analytics' as Section, name: 'Analytics', icon: DollarSign },
      { id: 'sales-resources' as Section, name: 'Sales Resources', icon: BookOpen },
      { id: 'leadership' as Section, name: 'Leadership', icon: Target },
      { id: 'team' as Section, name: 'Settings', icon: SettingsIcon, separator: true },
    ];

    return items;
  };

  const navigationItems = getNavigationItems();

  // Filter navigation items based on menu visibility settings
  const visibleNavigationItems = navigationItems.filter(item => canSeeMenuItem(item.id, userRole));

  const renderContent = () => {
    // Wrap all lazy-loaded components with Suspense
    // Handle common sections for all roles
    if (activeSection === 'requests') {
      return (
        <ErrorBoundary>
          <Suspense fallback={<LoadingFallback />}>
            <RequestHub onBack={() => setActiveSection('home')} />
          </Suspense>
        </ErrorBoundary>
      );
    }
    if (activeSection === 'request-queue') {
      if (selectedRequest) {
        return (
          <ErrorBoundary>
            <Suspense fallback={<LoadingFallback />}>
              <RequestDetail requestId={selectedRequest.id} onClose={() => setSelectedRequest(null)} />
            </Suspense>
          </ErrorBoundary>
        );
      }
      return (
        <ErrorBoundary>
          <Suspense fallback={<LoadingFallback />}>
            <OperationsQueue onBack={() => setActiveSection('home')} onRequestClick={setSelectedRequest} />
          </Suspense>
        </ErrorBoundary>
      );
    }
    if (activeSection === 'presentation') {
      return (
        <ErrorBoundary>
          <Suspense fallback={<LoadingFallback />}>
            <ClientPresentation onBack={() => setActiveSection('home')} isMobile={viewMode === 'mobile'} />
          </Suspense>
        </ErrorBoundary>
      );
    }
    if (activeSection === 'sales-coach') {
      return (
        <ErrorBoundary>
          <Suspense fallback={<LoadingFallback />}>
            <SalesCoach userId="user123" onOpenAdmin={() => setActiveSection('sales-coach-admin')} />
          </Suspense>
        </ErrorBoundary>
      );
    }
    if (activeSection === 'photo-gallery') {
      return (
        <ErrorBoundary>
          <Suspense fallback={<LoadingFallback />}>
            <PhotoGalleryRefactored onBack={() => setActiveSection('home')} userRole={userRole} viewMode={viewMode} userId={user?.id} userName={profile?.full_name} />
          </Suspense>
        </ErrorBoundary>
      );
    }
    if (activeSection === 'stain-calculator') {
      return (
        <ErrorBoundary>
          <Suspense fallback={<LoadingFallback />}>
            <StainCalculator onBack={() => setActiveSection('home')} />
          </Suspense>
        </ErrorBoundary>
      );
    }
    if (activeSection === 'my-requests') {
      return (
        <ErrorBoundary>
          <Suspense fallback={<LoadingFallback />}>
            <MyRequestsView onBack={() => setActiveSection('home')} onMarkAsRead={markRequestAsRead} />
          </Suspense>
        </ErrorBoundary>
      );
    }
    if (activeSection === 'sales-coach-admin') {
      return (
        <ErrorBoundary>
          <Suspense fallback={<LoadingFallback />}>
            <SalesCoachAdmin onBack={() => setActiveSection('home')} userRole={userRole} />
          </Suspense>
        </ErrorBoundary>
      );
    }
    if (activeSection === 'dashboard') {
      return (
        <ErrorBoundary>
          <Dashboard userRole={userRole} />
        </ErrorBoundary>
      );
    }
    if (activeSection === 'analytics') {
      return (
        <ErrorBoundary>
          <Suspense fallback={<LoadingFallback />}>
            <Analytics userRole={userRole} />
          </Suspense>
        </ErrorBoundary>
      );
    }
    if (activeSection === 'team') {
      return (
        <ErrorBoundary>
          <Suspense fallback={<LoadingFallback />}>
            <Settings onBack={() => setActiveSection('home')} userRole={userRole} />
          </Suspense>
        </ErrorBoundary>
      );
    }
    if (activeSection === 'sales-resources') {
      return (
        <ErrorBoundary>
          <Suspense fallback={<LoadingFallback />}>
            <SalesResources onBack={() => setActiveSection('home')} userRole={userRole} viewMode={viewMode} />
          </Suspense>
        </ErrorBoundary>
      );
    }
    if (activeSection === 'team-communication') {
      return (
        <ErrorBoundary>
          <Suspense fallback={<LoadingFallback />}>
            <TeamCommunication
              onUnreadCountChange={setTeamCommunicationUnreadCount}
              refreshTrigger={teamCommunicationRefresh}
              onEditDraft={(draft) => {
                setEditingDraft(draft);
                setShowMessageComposer(true);
              }}
            />
          </Suspense>
        </ErrorBoundary>
      );
    }
    if (activeSection === 'direct-messages') {
      return (
        <ErrorBoundary>
          <Suspense fallback={<LoadingFallback />}>
            <DirectMessages onUnreadCountChange={setUnreadAnnouncementsCount} />
          </Suspense>
        </ErrorBoundary>
      );
    }
    if (activeSection === 'bom-calculator') {
      // Only show to operations and admin roles
      if (userRole === 'operations' || userRole === 'admin') {
        return (
          <ErrorBoundary>
            <Suspense fallback={<LoadingFallback />}>
              <BOMCalculator
                onBack={() => setActiveSection('home')}
                userRole={userRole}
                userId={user?.id}
                userName={profile?.full_name}
              />
            </Suspense>
          </ErrorBoundary>
        );
      }
      // Redirect non-authorized users
      setActiveSection('home');
      return null;
    }
    if (activeSection === 'leadership') {
      return (
        <ErrorBoundary>
          <Suspense fallback={<LoadingFallback />}>
            <LeadershipHub onBack={() => setActiveSection('home')} />
          </Suspense>
        </ErrorBoundary>
      );
    }

    // Default home view
    return (
      <ErrorBoundary>
        <Dashboard userRole={userRole} />
      </ErrorBoundary>
    );
  };

  // Show loading screen while checking authentication
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <img src="/Logo-1.jpg" alt="Logo" className="h-24 w-auto mx-auto mb-4" />
          <div className="text-gray-600">Loading...</div>
        </div>
      </div>
    );
  }

  // Show login screen if not authenticated
  // TEMPORARY: Allow bypass for development - remove this once auth is fully implemented
  const bypassAuth = localStorage.getItem('bypassAuth') === 'true';
  if (!user && !bypassAuth) {
    return (
      <Suspense fallback={<LoadingFallback />}>
        <Login />
      </Suspense>
    );
  }

  // Mobile view - same for all roles
  if (viewMode === 'mobile') {
    return (
      <ToastProvider>
        <div className="min-h-screen bg-gray-50">
          <MobileHeader
            profileAvatarUrl={profile?.avatar_url}
            profileFullName={userName}
            setViewMode={setViewMode}
            setShowProfileView={setShowProfileView}
          />
          <div className="pb-20">
            <ErrorBoundary>
              <SalesRepView
                activeSection={activeSection}
                setActiveSection={setActiveSection}
                viewMode={viewMode}
                unreadAnnouncementsCount={unreadAnnouncementsCount}
                announcementEngagementCount={announcementEngagementCount}
                userId={user?.id}
                userName={profile?.full_name}
                onMarkAsRead={markRequestAsRead}
                onUnreadCountChange={setUnreadAnnouncementsCount}
                onTeamCommunicationUnreadCountChange={setTeamCommunicationUnreadCount}
                teamCommunicationRefresh={teamCommunicationRefresh}
              />
            </ErrorBoundary>
          </div>

          {/* Install App Banner */}
          <InstallAppBanner />

          {/* PWA Update Prompt */}
          <PWAUpdatePrompt />

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
                  window.location.reload(); // Reload to refresh profile data
                }}
              />
            </Suspense>
          )}
        </div>
      </ToastProvider>
    );
  }

  return (
    <ToastProvider>
      <div className="flex h-screen bg-gray-50 overflow-hidden">
        <Sidebar
          sidebarOpen={sidebarOpen}
          setSidebarOpen={setSidebarOpen}
          navigationItems={visibleNavigationItems}
          activeSection={activeSection}
          setActiveSection={setActiveSection}
          userRole={userRole}
          setUserRole={setUserRole}
          profileRole={profile?.role}
          profileFullName={profile?.full_name}
          profileAvatarUrl={profile?.avatar_url}
          userName={userName}
          user={user}
          signOut={signOut}
          setViewMode={setViewMode}
          setShowProfileView={setShowProfileView}
        />

        <div className="flex-1 overflow-auto">
          <div className={activeSection === 'leadership' ? '' : 'p-8 max-w-7xl mx-auto'}>
            {renderContent()}
          </div>
        </div>

        {/* Install App Banner */}
        <InstallAppBanner />

        {/* PWA Update Prompt */}
        <PWAUpdatePrompt />

        {/* Floating Action Button for Composing Messages (Admin/Manager only) */}
        {(userRole === 'admin' || userRole === 'sales-manager') && activeSection === 'team-communication' && (
          <button
            onClick={() => setShowMessageComposer(true)}
            className="fixed bottom-8 right-8 w-16 h-16 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg flex items-center justify-center transition-all hover:scale-110 z-40"
            title="New Message"
          >
            <Send className="w-6 h-6" />
          </button>
        )}

        {/* Message Composer Modal */}
        {showMessageComposer && (
          <Suspense fallback={<LoadingFallback />}>
            <MessageComposer
              editingDraft={editingDraft}
              onClose={() => {
                setShowMessageComposer(false);
                setEditingDraft(null);
              }}
              onMessageSent={() => {
                setShowMessageComposer(false);
                setEditingDraft(null);
                // Trigger refresh of TeamCommunication component
                setTeamCommunicationRefresh(prev => prev + 1);
              }}
            />
          </Suspense>
        )}

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
                window.location.reload(); // Reload to refresh profile data
              }}
            />
          </Suspense>
        )}
      </div>
    </ToastProvider>
  );
}

export default App;
