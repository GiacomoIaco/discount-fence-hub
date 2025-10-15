import { useState, useRef, useEffect, lazy, Suspense } from 'react';
import { Home, DollarSign, Ticket, Image, BookOpen, Menu, X, User, Mic, StopCircle, Play, CheckCircle, AlertCircle, Send, FileText, Camera, FolderOpen, LogOut, MessageSquare, MessageCircle, Settings as SettingsIcon, Calculator } from 'lucide-react';
import { ToastProvider } from './contexts/ToastContext';
import { showError, showWarning } from './lib/toast';
import InstallAppBanner from './components/InstallAppBanner';
import PWAUpdatePrompt from './components/PWAUpdatePrompt';
import { ErrorBoundary } from './components/ErrorBoundary';
import { useAuth } from './contexts/AuthContext';
import { transcribeAudio } from './lib/openai';
import { parseVoiceTranscript } from './lib/claude';
import { useEscalationEngine } from './hooks/useEscalationEngine';
import { useMenuVisibility } from './hooks/useMenuVisibility';
import { useRequestNotifications } from './hooks/useRequestNotifications';
import { useAnnouncementEngagement } from './hooks/useAnnouncementEngagement';
import type { Request } from './lib/requests';

// ============================================
// CODE SPLITTING: Lazy-load large components
// ============================================
// This reduces initial bundle size by ~70% and improves load time

const StainCalculator = lazy(() => import('./components/sales/StainCalculator'));
const ClientPresentation = lazy(() => import('./components/sales/ClientPresentation'));
const SalesCoach = lazy(() => import('./components/sales/SalesCoach'));
const SalesCoachAdmin = lazy(() => import('./components/sales/SalesCoachAdmin'));
const PhotoGalleryRefactored = lazy(() => import('./features/photos').then(module => ({ default: module.PhotoGalleryRefactored })));
const SalesResources = lazy(() => import('./components/SalesResources'));
const Analytics = lazy(() => import('./components/Analytics'));
const Settings = lazy(() => import('./components/Settings'));
const MessageComposer = lazy(() => import('./components/MessageComposer'));
const TeamCommunication = lazy(() => import('./components/TeamCommunication'));
const DirectMessages = lazy(() => import('./components/DirectMessages'));
const UserProfileEditor = lazy(() => import('./components/UserProfileEditor'));
const UserProfileView = lazy(() => import('./components/UserProfileView'));
const RequestHub = lazy(() => import('./components/requests/RequestHub'));
const MyRequestsView = lazy(() => import('./components/requests/MyRequestsView'));
const OperationsQueue = lazy(() => import('./components/operations/RequestQueue'));
const RequestDetail = lazy(() => import('./components/requests/RequestDetail'));
const Login = lazy(() => import('./components/auth/Login'));
const BOMCalculator = lazy(() => import('./features/bom_calculator/BOMCalculator').then(m => ({ default: m.BOMCalculator })));

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
type Section = 'home' | 'custom-pricing' | 'requests' | 'my-requests' | 'presentation' | 'stain-calculator' | 'sales-coach' | 'sales-coach-admin' | 'photo-gallery' | 'sales-resources' | 'dashboard' | 'request-queue' | 'analytics' | 'team' | 'manager-dashboard' | 'team-communication' | 'direct-messages' | 'assignment-rules' | 'bom-calculator';
type RequestStep = 'choice' | 'recording' | 'processing' | 'review' | 'success';

interface ParsedData {
  customerName: string;
  address: string;
  fenceType: string;
  linearFeet: string;
  specialRequirements: string;
  deadline: string;
  urgency: string;
  confidence: {
    [key: string]: number;
  };
}

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

  // Load unread message count - DISABLED: TeamCommunication uses its own system
  // useEffect(() => {
  //   if (!user) return;

  //   const loadUnreadCount = async () => {
  //     try {
  //       // Use the new direct messages unread count
  //       const { getUnreadMessagesCount } = await import('./lib/messages');
  //       const count = await getUnreadMessagesCount();
  //       setUnreadCount(count);
  //     } catch (error) {
  //       // Silently ignore errors - feature may not be fully set up yet
  //       console.log('Direct messages not available:', error);
  //     }
  //   };

  //   loadUnreadCount();

  //   // Refresh every 30 seconds
  //   const interval = setInterval(loadUnreadCount, 30000);
  //   return () => clearInterval(interval);
  // }, [user]);

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
      { id: 'presentation' as Section, name: 'Client Presentation', icon: FileText },
      { id: 'sales-coach' as Section, name: 'AI Sales Coach', icon: Mic },
      { id: 'photo-gallery' as Section, name: 'Photo Gallery', icon: Image },
      { id: 'stain-calculator' as Section, name: 'Pre-Stain Calculator', icon: DollarSign },
      { id: 'bom-calculator' as Section, name: 'BOM Calculator', icon: Calculator },
      { id: 'my-requests' as Section, name: 'My Requests', icon: Ticket, badge: requestUnreadCount },
      { id: 'analytics' as Section, name: 'Analytics', icon: DollarSign },
      { id: 'sales-resources' as Section, name: 'Sales Resources', icon: FolderOpen },
      { id: 'team' as Section, name: 'Settings', icon: SettingsIcon, separator: true },
    ];

    // Photo Review is now accessed via tabs in Photo Gallery (desktop only)
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
              <RequestDetail request={selectedRequest} onClose={() => setSelectedRequest(null)} />
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
          <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
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
                {/* View Mode Switcher */}
                <button
                  onClick={() => setViewMode('desktop')}
                  className="px-2 py-1 text-xs bg-gray-100 border border-gray-300 rounded text-gray-700 hover:bg-gray-200"
                >
                  Desktop
                </button>
                {/* Profile Avatar */}
                <button
                  onClick={() => setShowProfileView(true)}
                  className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 hover:opacity-80 transition-opacity"
                >
                  {profile?.avatar_url ? (
                    <img
                      src={profile.avatar_url}
                      alt={userName}
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
        <div className={`${sidebarOpen ? 'w-64' : 'w-20'} h-full bg-gray-900 text-white transition-all duration-300 flex flex-col`}>
        <div className="p-3 border-b border-gray-800">
          {sidebarOpen ? (
            <div className="flex items-center justify-between">
              <img src="/logo-transparent.png" alt="Discount Fence USA" className="h-10 w-auto" />
              <div className="flex items-center gap-3">
                <p className="text-gray-500 text-xs">
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
                <button onClick={() => setSidebarOpen(false)} className="text-gray-400 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <img src="/logo-transparent.png" alt="Logo" className="h-10 w-auto" />
              <button onClick={() => setSidebarOpen(true)} className="text-gray-400 hover:text-white">
                <Menu className="w-6 h-6" />
              </button>
            </div>
          )}
        </div>

        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          {visibleNavigationItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeSection === item.id;
            return (
              <div key={item.id}>
                {item.separator && <div className="my-2 border-t border-gray-700"></div>}
                <button
                  onClick={() => setActiveSection(item.id)}
                  className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors ${
                    isActive ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                  }`}
                >
                  <Icon className="w-5 h-5 flex-shrink-0" />
                  {sidebarOpen && (
                    <span className="font-medium text-sm flex-1 text-left">{item.name}</span>
                  )}
                  {item.badge && item.badge > 0 && (
                    <span className="ml-auto bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                      {item.badge > 99 ? '99+' : item.badge}
                    </span>
                  )}
                </button>
              </div>
            );
          })}
        </nav>

        <div className="p-4 border-t border-gray-800">
          {/* View Mode Switcher */}
          {sidebarOpen && (
            <div className="mb-3">
              <button
                onClick={() => setViewMode('mobile')}
                className="w-full px-3 py-2 text-sm bg-blue-600 hover:bg-blue-700 rounded text-white font-medium"
              >
                Switch to Mobile View
              </button>
            </div>
          )}

          {/* Role Switcher for Admin Only - show based on authenticated profile, not current view */}
          {sidebarOpen && profile?.role === 'admin' && (
            <div className="mb-3">
              <p className="text-xs text-gray-400 mb-2">Switch View (Admin):</p>
              <select
                value={userRole}
                onChange={(e) => {
                  setUserRole(e.target.value as UserRole);
                  setActiveSection('home');
                }}
                className="w-full px-2 py-1 text-sm bg-gray-800 border border-gray-700 rounded text-white"
              >
                <option value="sales">Sales View</option>
                <option value="operations">Operations View</option>
                <option value="sales-manager">Sales Manager View</option>
                <option value="admin">Admin View</option>
              </select>
            </div>
          )}

          {/* User Profile and Sign Out */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowProfileView(true)}
              className="flex items-center space-x-2 flex-1 hover:bg-gray-800 rounded-lg p-2 transition-colors"
            >
              {profile?.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt={userName}
                  className="w-8 h-8 rounded-full object-cover border-2 border-blue-600 flex-shrink-0"
                />
              ) : (
                <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
                  <User className="w-5 h-5 text-white" />
                </div>
              )}
              {sidebarOpen && (
                <div className="flex-1 min-w-0 text-left">
                  <p className="font-medium text-xs text-white truncate">
                    {profile?.full_name || userName}
                  </p>
                  <p className="text-xs text-gray-400 capitalize">{profile?.role || userRole}</p>
                </div>
              )}
            </button>

            {/* Logout Button */}
            {user && sidebarOpen && (
              <button
                onClick={() => signOut()}
                className="p-2 text-gray-300 hover:bg-gray-800 hover:text-red-400 rounded-lg transition-colors"
                title="Sign Out"
              >
                <LogOut className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <div className="p-8 max-w-7xl mx-auto">
          {renderContent()}
        </div>
      </div>

      {/* Install App Banner */}
      <InstallAppBanner />

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
            onClose={() => setShowMessageComposer(false)}
            onMessageSent={() => {
              setShowMessageComposer(false);
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

interface SalesRepViewProps {
  activeSection: Section;
  setActiveSection: (section: Section) => void;
  viewMode: 'mobile' | 'desktop';
  unreadAnnouncementsCount: number;
  announcementEngagementCount: number;
  userId?: string;
  userName?: string;
  onMarkAsRead?: (requestId: string) => void;
  onUnreadCountChange?: (count: number) => void;
  onTeamCommunicationUnreadCountChange?: (count: number) => void;
  teamCommunicationRefresh?: number;
}

const SalesRepView = ({ activeSection, setActiveSection, viewMode, unreadAnnouncementsCount, announcementEngagementCount, userId, userName, onMarkAsRead, onUnreadCountChange, onTeamCommunicationUnreadCountChange, teamCommunicationRefresh }: SalesRepViewProps) => {
  if (activeSection === 'requests') {
    return (
      <Suspense fallback={<LoadingFallback />}>
        <RequestHub onBack={() => setActiveSection('home')} />
      </Suspense>
    );
  }

  if (activeSection === 'custom-pricing') {
    return <CustomPricingRequest onBack={() => setActiveSection('home')} viewMode={viewMode} />;
  }

  if (activeSection === 'my-requests') {
    return (
      <Suspense fallback={<LoadingFallback />}>
        <MyRequestsView onBack={() => setActiveSection('home')} onMarkAsRead={onMarkAsRead} />
      </Suspense>
    );
  }

  if (activeSection === 'stain-calculator') {
    return (
      <Suspense fallback={<LoadingFallback />}>
        <StainCalculator onBack={() => setActiveSection('home')} />
      </Suspense>
    );
  }

  if (activeSection === 'presentation') {
    return (
      <Suspense fallback={<LoadingFallback />}>
        <ClientPresentation onBack={() => setActiveSection('home')} isMobile={true} />
      </Suspense>
    );
  }

  if (activeSection === 'sales-coach') {
    return (
      <Suspense fallback={<LoadingFallback />}>
        <SalesCoach userId="user123" onOpenAdmin={() => setActiveSection('sales-coach-admin')} />
      </Suspense>
    );
  }

  if (activeSection === 'sales-coach-admin') {
    return (
      <Suspense fallback={<LoadingFallback />}>
        <SalesCoachAdmin onBack={() => setActiveSection('sales-coach')} />
      </Suspense>
    );
  }

  if (activeSection === 'photo-gallery') {
    return (
      <Suspense fallback={<LoadingFallback />}>
        <PhotoGalleryRefactored onBack={() => setActiveSection('home')} userRole="sales" viewMode="mobile" userId={userId} userName={userName} />
      </Suspense>
    );
  }

  if (activeSection === 'sales-resources') {
    return (
      <Suspense fallback={<LoadingFallback />}>
        <SalesResources onBack={() => setActiveSection('home')} userRole="sales" viewMode={viewMode} />
      </Suspense>
    );
  }

  if (activeSection === 'team-communication') {
    return (
      <Suspense fallback={<LoadingFallback />}>
        <TeamCommunication onBack={() => setActiveSection('home')} onUnreadCountChange={onTeamCommunicationUnreadCountChange} refreshTrigger={teamCommunicationRefresh} />
      </Suspense>
    );
  }

  if (activeSection === 'direct-messages') {
    return (
      <Suspense fallback={<LoadingFallback />}>
        <DirectMessages onUnreadCountChange={onUnreadCountChange} />
      </Suspense>
    );
  }

  return (
    <div className="space-y-4 p-4">
      {/* Sales Tools Section - No Title */}
      <div className="space-y-3">
        <button
          onClick={() => setActiveSection('presentation')}
          onTouchStart={(e) => e.currentTarget.classList.add('scale-95')}
          onTouchEnd={(e) => e.currentTarget.classList.remove('scale-95')}
          className="w-full bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6 rounded-xl shadow-lg transition-transform touch-manipulation"
          style={{ WebkitTapHighlightColor: 'transparent' }}
        >
          <div className="flex items-center space-x-4">
            <div className="bg-white/20 p-3 rounded-lg">
              <FileText className="w-8 h-8" />
            </div>
            <div className="flex-1 text-left">
              <div className="font-bold text-lg">Client Presentation</div>
              <div className="text-sm text-blue-100">Show customers why we're #1</div>
            </div>
          </div>
        </button>

        <button
          onClick={() => setActiveSection('sales-coach')}
          className="w-full bg-gradient-to-r from-purple-600 to-purple-700 text-white p-6 rounded-xl shadow-lg active:scale-98 transition-transform"
        >
          <div className="flex items-center space-x-4">
            <div className="bg-white/20 p-3 rounded-lg">
              <Mic className="w-8 h-8" />
            </div>
            <div className="flex-1 text-left">
              <div className="font-bold text-lg">AI Sales Coach</div>
              <div className="text-sm text-purple-100">Record & analyze meetings</div>
            </div>
          </div>
        </button>

        <button
          onClick={() => setActiveSection('photo-gallery')}
          className="w-full bg-white border-2 border-gray-200 p-5 rounded-xl shadow-sm active:scale-98 transition-transform"
        >
          <div className="flex items-center space-x-4">
            <div className="bg-green-100 p-3 rounded-lg">
              <Image className="w-7 h-7 text-green-600" />
            </div>
            <div className="flex-1 text-left">
              <div className="font-bold text-gray-900">Photo Gallery</div>
              <div className="text-sm text-gray-600">Browse & capture job photos</div>
            </div>
          </div>
        </button>

        <button
          onClick={() => setActiveSection('stain-calculator')}
          className="w-full bg-white border-2 border-gray-200 p-5 rounded-xl shadow-sm active:scale-98 transition-transform"
        >
          <div className="flex items-center space-x-4">
            <div className="bg-orange-100 p-3 rounded-lg">
              <DollarSign className="w-7 h-7 text-orange-600" />
            </div>
            <div className="flex-1 text-left">
              <div className="font-bold text-gray-900">Pre-Stain Calculator</div>
              <div className="text-sm text-gray-600">Show ROI vs DIY staining</div>
            </div>
          </div>
        </button>

        <button
          onClick={() => setActiveSection('direct-messages')}
          className="w-full bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6 rounded-xl shadow-lg active:scale-98 transition-transform relative"
        >
          <div className="flex items-center space-x-4">
            <div className="bg-white/20 p-3 rounded-lg">
              <MessageCircle className="w-8 h-8" />
            </div>
            <div className="flex-1 text-left">
              <div className="font-bold text-lg">Chat</div>
              <div className="text-sm text-blue-100">Direct messages with team</div>
            </div>
            {unreadAnnouncementsCount > 0 && (
              <div className="absolute top-3 right-3 bg-red-500 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center">
                {unreadAnnouncementsCount > 99 ? '99+' : unreadAnnouncementsCount}
              </div>
            )}
          </div>
        </button>

        <button
          onClick={() => setActiveSection('team-communication')}
          className="w-full bg-gradient-to-r from-indigo-600 to-indigo-700 text-white p-6 rounded-xl shadow-lg active:scale-98 transition-transform relative"
        >
          <div className="flex items-center space-x-4">
            <div className="bg-white/20 p-3 rounded-lg">
              <MessageSquare className="w-8 h-8" />
            </div>
            <div className="flex-1 text-left">
              <div className="font-bold text-lg">Announcements</div>
              <div className="text-sm text-indigo-100">Team updates & announcements</div>
            </div>
            {announcementEngagementCount > 0 && (
              <div className="absolute top-3 right-3 bg-red-500 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center">
                {announcementEngagementCount > 99 ? '99+' : announcementEngagementCount}
              </div>
            )}
          </div>
        </button>
      </div>

      {/* Requests Section */}
      <div className="space-y-3 pt-4">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Requests</h2>

        <button
          onClick={() => setActiveSection('requests')}
          className="w-full bg-gradient-to-r from-green-600 to-green-700 text-white p-6 rounded-xl shadow-lg active:scale-98 transition-transform"
        >
          <div className="flex items-center space-x-4">
            <div className="bg-white/20 p-3 rounded-lg">
              <Ticket className="w-8 h-8" />
            </div>
            <div className="flex-1 text-left">
              <div className="font-bold text-lg">Requests</div>
              <div className="text-sm text-green-100">Submit & track all requests</div>
            </div>
            <div className="text-xs bg-white/20 px-3 py-1.5 rounded-full font-medium">
              🎤 Voice
            </div>
          </div>
        </button>
      </div>

      {/* Other Tools Section */}
      <div className="space-y-3 pt-4 pb-8">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Other Tools</h2>

        <button
          onClick={() => setActiveSection('sales-resources')}
          className="w-full bg-white border border-gray-200 p-4 rounded-xl shadow-sm active:bg-gray-50"
        >
          <div className="flex items-center space-x-3">
            <div className="bg-indigo-100 p-2 rounded-lg">
              <BookOpen className="w-6 h-6 text-indigo-600" />
            </div>
            <div className="flex-1 text-left">
              <div className="font-semibold text-gray-900">Sales Resources</div>
              <div className="text-xs text-gray-600">Guides, catalogs & training</div>
            </div>
          </div>
        </button>
      </div>
    </div>
  );
};

interface CustomPricingRequestProps {
  onBack: () => void;
  viewMode: 'mobile' | 'desktop';
}

const CustomPricingRequest = ({ onBack, viewMode: _viewMode }: CustomPricingRequestProps) => {
  const [step, setStep] = useState<RequestStep>('choice');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [parsedData, setParsedData] = useState<ParsedData | null>(null);
  const [photos, setPhotos] = useState<File[]>([]);
  const [audioURL, setAudioURL] = useState<string>('');
  const [formData, setFormData] = useState({
    projectNumber: '',
    customerName: '',
    address: '',
    fenceType: '',
    linearFeet: '',
    specialRequirements: '',
    deadline: '',
    urgency: ''
  });


  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setPhotos(prev => [...prev, ...Array.from(e.target.files!)]);
    }
  };

  const handleCameraCapture = () => {
    cameraInputRef.current?.click();
  };

  const handleFileSelect = () => {
    fileInputRef.current?.click();
  };

  const removePhoto = (index: number) => {
    setPhotos(prev => prev.filter((_, i) => i !== index));
  };

  const updateFormData = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);

      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } catch (err) {
      showError('Microphone access denied. Please enable microphone permissions.');
    }
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
      setRecordingTime(0);
      audioChunksRef.current = [];
    }
  };

  const stopRecording = async () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
      setStep('processing');

      // Wait for the audio blob to be available
      setTimeout(async () => {
        try {
          // Create audio blob from collected chunks
          const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          setAudioURL(URL.createObjectURL(blob));

          // Transcribe with Whisper
          const transcript = await transcribeAudio(blob);

          // Parse with Claude
          const parsed = await parseVoiceTranscript(transcript);
          setParsedData(parsed);

          // Auto-fill form with parsed data
          setFormData({
            projectNumber: formData.projectNumber, // Keep existing project number
            customerName: parsed.customerName,
            address: parsed.address,
            fenceType: parsed.fenceType,
            linearFeet: parsed.linearFeet,
            specialRequirements: parsed.specialRequirements,
            deadline: parsed.deadline,
            urgency: parsed.urgency
          });

          // Return to form view
          setStep('choice');
        } catch (error) {
          console.error('Error processing audio:', error);
          showWarning('Failed to process audio. Using demo mode. Error: ' + (error as Error).message);

          // Fallback to demo data if API fails
          const demoData = {
            customerName: 'The Johnsons',
            address: '123 Oak Street',
            fenceType: '6-foot cedar privacy fence',
            linearFeet: '200',
            specialRequirements: 'Dark walnut stain, sloped terrain (15°)',
            deadline: 'Before June 15th',
            urgency: 'high',
            confidence: {
              customerName: 85,
              address: 95,
              fenceType: 90,
              linearFeet: 88,
              specialRequirements: 92,
              deadline: 85,
              urgency: 90
            }
          };
          setParsedData(demoData);

          // Auto-fill form with demo data
          setFormData({
            projectNumber: formData.projectNumber,
            customerName: demoData.customerName,
            address: demoData.address,
            fenceType: demoData.fenceType,
            linearFeet: demoData.linearFeet,
            specialRequirements: demoData.specialRequirements,
            deadline: demoData.deadline,
            urgency: demoData.urgency
          });

          // Return to form view
          setStep('choice');
        }
      }, 100); // Small delay to ensure chunks are collected
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const submitRequest = async () => {
    // Convert photos to base64 for storage
    const photoPromises = photos.map(photo => {
      return new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(photo);
      });
    });

    const photoBase64 = await Promise.all(photoPromises);

    // Save to localStorage
    const newRequest = {
      id: Date.now(),
      requestType: 'custom-pricing',
      projectNumber: formData.projectNumber || `REQ-${Date.now()}`,
      customerName: formData.customerName,
      address: formData.address,
      fenceType: formData.fenceType,
      linearFeet: formData.linearFeet,
      status: 'pending',
      priority: formData.urgency === 'high' ? 'high' : formData.urgency === 'medium' ? 'medium' : 'low',
      submittedDate: new Date().toISOString(),
      timestamp: new Date().toISOString(),
      responseTime: 'pending',
      specialRequirements: formData.specialRequirements,
      deadline: formData.deadline,
      photos: photoBase64,
      messages: [],
      notes: [],
      salesperson: localStorage.getItem('userName') || 'Unknown Sales Rep'
    };

    const requests = JSON.parse(localStorage.getItem('myRequests') || '[]');
    requests.unshift(newRequest); // Add to beginning
    localStorage.setItem('myRequests', JSON.stringify(requests));

    setStep('success');
    setTimeout(() => {
      onBack();
    }, 2000);
  };

  if (step === 'choice') {
    return (
      <div className="min-h-screen bg-gray-50 p-4 pb-24">
        <button onClick={onBack} className="text-blue-600 font-medium mb-4">← Back</button>

        <div className="mb-4">
          <h1 className="text-2xl font-bold text-gray-900">Custom Pricing Request</h1>
          <p className="text-gray-600 mt-1">Fill in the details below or use voice to auto-fill</p>
        </div>

        {/* Recording Banner (sticky at top while recording) */}
        {isRecording && (
          <div className="sticky top-0 z-50 bg-gradient-to-r from-purple-600 to-purple-700 text-white rounded-xl p-5 mb-4 shadow-lg">
            <div className="text-center mb-4">
              <div className="bg-white/20 p-4 rounded-full inline-block animate-pulse mb-3">
                <Mic className="w-8 h-8" />
              </div>
              <div className="font-bold text-2xl">{formatTime(recordingTime)}</div>
              <div className="text-sm text-purple-100 mt-2">Recording in progress...</div>
            </div>

            <div className="bg-white/10 rounded-lg p-3 mb-4 text-xs text-purple-100">
              <strong>What to mention:</strong> Customer name, address, fence type, linear feet, special requirements, and deadline
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={cancelRecording}
                className="bg-white/20 text-white py-3 rounded-lg font-semibold hover:bg-white/30 transition"
              >
                Cancel
              </button>
              <button
                onClick={stopRecording}
                className="bg-white text-purple-600 py-3 rounded-lg font-semibold hover:bg-gray-100 transition flex items-center justify-center space-x-2"
              >
                <StopCircle className="w-5 h-5" />
                <span>Stop Recording</span>
              </button>
            </div>
          </div>
        )}

        {/* Audio Playback (if recording exists) */}
        {audioURL && !isRecording && (
          <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 mb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="bg-purple-100 p-2 rounded-lg">
                  <Mic className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <div className="font-semibold text-gray-900">Voice Recording</div>
                  <div className="text-sm text-gray-600">{formatTime(recordingTime)}</div>
                </div>
              </div>
              <button
                onClick={() => audioRef.current?.play()}
                className="bg-purple-600 text-white p-2 rounded-lg hover:bg-purple-700 transition"
              >
                <Play className="w-5 h-5" />
              </button>
            </div>
            <audio ref={audioRef} src={audioURL} className="hidden" />
          </div>
        )}

        {/* Compact Voice Recording Button */}
        {!isRecording && (
          <div className="mb-4">
            <button
              onClick={startRecording}
              className="w-full bg-purple-600 text-white py-3 px-4 rounded-xl shadow-md active:scale-98 transition-transform flex items-center justify-center space-x-2"
            >
              <Mic className="w-5 h-5" />
              <span className="font-semibold">{audioURL ? 'Re-record' : 'Record to Auto-Fill Form'}</span>
            </button>
            <p className="text-xs text-gray-500 text-center mt-1">Speak naturally - AI will fill the fields below</p>
          </div>
        )}

        {/* Manual Form - Always Visible */}
        <div className="space-y-3">
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <label className="text-sm font-semibold text-gray-700 block mb-2">Project Number/Reference</label>
            <input
              type="text"
              placeholder="Enter Jobber or Service Titan project #"
              value={formData.projectNumber}
              onChange={(e) => updateFormData('projectNumber', e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900"
            />
            <p className="text-xs text-gray-500 mt-1">For linking to Jobber/Service Titan</p>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <label className="text-sm font-semibold text-gray-700 block mb-2">Customer Name</label>
            <input
              type="text"
              placeholder="Enter customer name"
              value={formData.customerName}
              onChange={(e) => updateFormData('customerName', e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900"
            />
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <label className="text-sm font-semibold text-gray-700 block mb-2">Address/Location</label>
            <input
              type="text"
              placeholder="Enter site address"
              value={formData.address}
              onChange={(e) => updateFormData('address', e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900"
            />
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <label className="text-sm font-semibold text-gray-700 block mb-2">Fence Type</label>
            <input
              type="text"
              placeholder="e.g., 6-foot cedar privacy fence"
              value={formData.fenceType}
              onChange={(e) => updateFormData('fenceType', e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900"
            />
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <label className="text-sm font-semibold text-gray-700 block mb-2">Linear Feet</label>
            <input
              type="text"
              placeholder="Enter linear feet"
              value={formData.linearFeet}
              onChange={(e) => updateFormData('linearFeet', e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900"
            />
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <label className="text-sm font-semibold text-gray-700 block mb-2">Special Requirements</label>
            <textarea
              placeholder="Staining, slope, gates, custom features..."
              value={formData.specialRequirements}
              onChange={(e) => updateFormData('specialRequirements', e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900 h-24"
            />
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <label className="text-sm font-semibold text-gray-700 block mb-2">Deadline/Timeline</label>
            <input
              type="text"
              placeholder="When does the customer need this?"
              value={formData.deadline}
              onChange={(e) => updateFormData('deadline', e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900"
            />
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <label className="text-sm font-semibold text-gray-700 block mb-2">Urgency Level</label>
            <select
              value={formData.urgency}
              onChange={(e) => updateFormData('urgency', e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900"
            >
              <option value="">Select urgency</option>
              <option value="low">Low - Standard timing</option>
              <option value="medium">Medium - Within a week</option>
              <option value="high">High - ASAP/Rush</option>
            </select>
          </div>

          {/* Photo Upload Section */}
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <label className="text-sm font-semibold text-gray-700 block mb-3">Photos</label>

            {/* Hidden file inputs */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handlePhotoUpload}
              className="hidden"
            />
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handlePhotoUpload}
              className="hidden"
            />

            {/* Action buttons */}
            <div className="grid grid-cols-2 gap-2 mb-3">
              <button
                type="button"
                onClick={handleCameraCapture}
                className="bg-purple-600 text-white py-2 px-4 rounded-lg flex items-center justify-center space-x-2 hover:bg-purple-700 transition"
              >
                <Camera className="w-5 h-5" />
                <span className="text-sm font-medium">Take Photo</span>
              </button>
              <button
                type="button"
                onClick={handleFileSelect}
                className="bg-blue-600 text-white py-2 px-4 rounded-lg flex items-center justify-center space-x-2 hover:bg-blue-700 transition"
              >
                <Image className="w-5 h-5" />
                <span className="text-sm font-medium">Choose Photo</span>
              </button>
            </div>

            {photos.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {photos.map((photo, index) => (
                  <div key={index} className="relative">
                    <img
                      src={URL.createObjectURL(photo)}
                      alt={`Upload ${index + 1}`}
                      className="w-full h-24 object-cover rounded-lg"
                    />
                    <button
                      onClick={() => removePhoto(index)}
                      className="absolute top-1 right-1 bg-red-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Submit Button */}
        <div className="p-4 mt-4">
          {isRecording && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 mb-3 text-center">
              <p className="text-sm text-yellow-800 font-semibold">
                ⚠️ Stop recording before submitting
              </p>
            </div>
          )}
          <button
            onClick={submitRequest}
            disabled={isRecording}
            className={`w-full py-4 rounded-xl font-bold text-lg shadow-lg transition-all flex items-center justify-center space-x-2 ${
              isRecording
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-blue-600 text-white active:scale-98'
            }`}
          >
            <Send className="w-6 h-6" />
            <span>{isRecording ? 'Recording...' : 'Submit Request'}</span>
          </button>
        </div>
      </div>
    );
  }

  if (step === 'processing') {
    return (
      <div className="min-h-screen bg-gray-50 p-4 flex items-center justify-center">
        <div className="text-center space-y-6">
          <div className="w-20 h-20 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <div>
            <div className="text-xl font-bold text-gray-900">Processing your request...</div>
            <div className="text-gray-600 mt-2">AI is transcribing and parsing the information</div>
          </div>
        </div>
      </div>
    );
  }

  if (step === 'review' && parsedData) {
    return (
      <div className="min-h-screen bg-gray-50 p-4 pb-24">
        <button onClick={() => setStep('choice')} className="text-blue-600 font-medium mb-4">← Re-record</button>

        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Review Parsed Data</h1>
          <p className="text-gray-600 mt-1">Check if everything looks correct</p>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="bg-purple-100 p-2 rounded-lg">
                <Mic className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <div className="font-semibold text-gray-900">Original Recording</div>
                <div className="text-sm text-gray-600">{formatTime(recordingTime)}</div>
              </div>
            </div>
            <button className="bg-purple-600 text-white p-2 rounded-lg">
              <Play className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="space-y-3">
          {Object.entries(parsedData).filter(([key]) => key !== 'confidence').map(([key, value]) => {
            const confidence = parsedData.confidence[key];
            const label = key.split(/(?=[A-Z])/).join(' ').replace(/^\w/, c => c.toUpperCase());

            return (
              <div key={key} className="bg-white border border-gray-200 rounded-xl p-4">
                <div className="flex items-start justify-between mb-2">
                  <label className="text-sm font-semibold text-gray-700">{label}</label>
                  {confidence >= 90 ? (
                    <CheckCircle className="w-5 h-5 text-green-600" />
                  ) : confidence >= 70 ? (
                    <AlertCircle className="w-5 h-5 text-yellow-600" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-red-600" />
                  )}
                </div>
                <input
                  type="text"
                  defaultValue={value as string}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900"
                />
                <div className="text-xs text-gray-500 mt-1">Confidence: {confidence}%</div>
              </div>
            );
          })}
        </div>

        <div className="p-4 mt-4">
          <button
            onClick={submitRequest}
            className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold text-lg shadow-lg active:scale-98 transition-transform flex items-center justify-center space-x-2"
          >
            <Send className="w-6 h-6" />
            <span>Submit Request</span>
          </button>
        </div>
      </div>
    );
  }

  if (step === 'success') {
    return (
      <div className="min-h-screen bg-gray-50 p-4 flex items-center justify-center">
        <div className="text-center space-y-6">
          <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle className="w-16 h-16 text-green-600" />
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-900">Request Submitted!</div>
            <div className="text-gray-600 mt-2">Operations team will review and respond soon</div>
          </div>
        </div>
      </div>
    );
  }

  return null;
};



// Placeholder Dashboard Component
interface DashboardProps {
  userRole: UserRole;
}

const Dashboard = ({ userRole }: DashboardProps) => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Dashboard</h1>
        <p className="text-gray-600">Welcome back! Here's your overview.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border-2 border-gray-200 p-6 rounded-xl">
          <div className="flex items-center space-x-3 mb-2">
            <div className="bg-blue-100 p-2 rounded-lg">
              <Ticket className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Active Requests</p>
              <p className="text-2xl font-bold text-gray-900">12</p>
            </div>
          </div>
        </div>

        <div className="bg-white border-2 border-gray-200 p-6 rounded-xl">
          <div className="flex items-center space-x-3 mb-2">
            <div className="bg-green-100 p-2 rounded-lg">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Completed</p>
              <p className="text-2xl font-bold text-gray-900">45</p>
            </div>
          </div>
        </div>

        <div className="bg-white border-2 border-gray-200 p-6 rounded-xl">
          <div className="flex items-center space-x-3 mb-2">
            <div className="bg-orange-100 p-2 rounded-lg">
              <DollarSign className="w-6 h-6 text-orange-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Value</p>
              <p className="text-2xl font-bold text-gray-900">$127K</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-gray-100 border-2 border-gray-300 p-8 rounded-xl text-center">
        <p className="text-gray-600">Dashboard metrics will be displayed here based on role: <span className="font-semibold capitalize">{userRole}</span></p>
      </div>
    </div>
  );
};

// Placeholder Analytics Component
export default App;
