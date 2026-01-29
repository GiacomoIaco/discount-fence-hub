import { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Home, DollarSign, Ticket, Image, BookOpen, Send, MessageSquare, Settings as SettingsIcon, Calculator, Target, ListTodo, Warehouse, Map, ClipboardList, Users, FlaskConical, Calendar, Briefcase, TrendingUp, Package, Phone, Inbox } from 'lucide-react';
import { ToastProvider } from './contexts/ToastContext';
import InstallAppBanner from './components/InstallAppBanner';
import PWAUpdatePrompt from './components/PWAUpdatePrompt';
import PushNotificationBanner from './components/PushNotificationBanner';
import { ErrorBoundary } from './components/ErrorBoundary';
import { useAuth } from './contexts/AuthContext';
import { useEscalationEngine } from './hooks/useEscalationEngine';
import { useMenuVisibility } from './hooks/useMenuVisibility';
import { useRequestNotifications } from './hooks/useRequestNotifications';
import { useAnnouncementEngagement } from './hooks/useAnnouncementEngagement';
import { useRouteSync } from './hooks/useRouteSync';
import { RightPaneProvider } from './features/message-center/context/RightPaneContext';
import { RightPaneMessaging, FloatingMessageButton } from './features/message-center/components';
import { useMessageCenterUnread } from './features/message-center/hooks';
import type { Section } from './lib/routes';
import type { Request } from './features/requests/lib/requests';

// Layout components
import Sidebar from './layouts/Sidebar';
import MobileAppContent from './layouts/MobileAppContent';

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
const MobileAnalyticsView = lazy(() => import('./features/analytics').then(module => ({ default: module.MobileAnalyticsView })));
const MobileUnifiedInbox = lazy(() => import('./features/message-center/components/MobileUnifiedInbox'));
const Settings = lazy(() => import('./features/settings').then(module => ({ default: module.Settings })));
const MessageComposer = lazy(() => import('./features/communication').then(module => ({ default: module.MessageComposer })));
const TeamCommunication = lazy(() => import('./features/communication').then(module => ({ default: module.TeamCommunication })));
const FullPageInbox = lazy(() => import('./features/message-center/components/FullPageInbox').then(module => ({ default: module.FullPageInbox })));
const UserProfileEditor = lazy(() => import('./features/user-profile').then(module => ({ default: module.UserProfileEditor })));
const UserProfileView = lazy(() => import('./features/user-profile').then(module => ({ default: module.UserProfileView })));
const RequestHub = lazy(() => import('./features/requests').then(module => ({ default: module.RequestHub })));
const MyRequestsView = lazy(() => import('./features/requests').then(module => ({ default: module.MyRequestsView })));
const OperationsQueue = lazy(() => import('./features/requests').then(module => ({ default: module.RequestQueue })));
const RequestDetail = lazy(() => import('./features/requests').then(module => ({ default: module.RequestDetail })));
const Login = lazy(() => import('./components/auth/Login'));
const OnboardingWizard = lazy(() => import('./components/auth/OnboardingWizard'));
const BOMCalculatorHub = lazy(() => import('./features/bom_calculator/BOMCalculatorHub'));
const BOMCalculatorHub2 = lazy(() => import('./features/bom_calculator_v2/BOMCalculatorHub2'));
const LeadershipHub = lazy(() => import('./features/leadership/LeadershipHub'));
const MyTodos = lazy(() => import('./features/my-todos').then(m => ({ default: m.MyTodos })));
const RoadmapHub = lazy(() => import('./features/roadmap/RoadmapHub'));
const SurveyHub = lazy(() => import('./features/survey_hub/SurveyHub'));
const ClientHub = lazy(() => import('./features/client_hub/ClientHub'));
const ProjectsHub = lazy(() => import('./features/projects_hub/ProjectsHub'));
const SalesHub = lazy(() => import('./features/sales_hub/SalesHub'));
const SchedulePage = lazy(() => import('./features/schedule/SchedulePage'));
// Note: RequestsHub, QuotesHub, JobsHub, InvoicesHub are now routed through ProjectsHub
const MessageCenterHub = lazy(() => import('./features/message-center/MessageCenterHub'));

// Loading fallback component
const LoadingFallback = () => (
  <div className="flex items-center justify-center min-h-[400px]">
    <div className="text-center">
      <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
      <div className="text-gray-600">Loading...</div>
    </div>
  </div>
);

type UserRole = 'sales' | 'operations' | 'sales-manager' | 'admin' | 'yard';
// Section type is now imported from './lib/routes'

function App() {
  const { user, profile, loading, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

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

  // Sync activeSection with URL - enables bookmarks, back/forward, and shareable links
  // Also handles entity routes like /clients/abc123, /requests/req-456
  const { navigateTo, navigateToEntity, entityContext, clearEntity } = useRouteSync({
    activeSection,
    setActiveSection,
  });

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [viewMode, setViewMode] = useState<'mobile' | 'desktop'>(() => {
    const saved = localStorage.getItem('viewMode');
    return (saved as 'mobile' | 'desktop') || 'mobile';
  });
  const [mobileLayout, setMobileLayout] = useState<'expanded' | 'compact'>(() => {
    const saved = localStorage.getItem('mobileLayout');
    return (saved as 'expanded' | 'compact') || 'expanded';
  });
  const [showMessageComposer, setShowMessageComposer] = useState(false);
  const [editingDraft, setEditingDraft] = useState<any>(null);
  const [showProfileEditor, setShowProfileEditor] = useState(false);
  const [showProfileView, setShowProfileView] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<Request | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);

  // Check if user needs onboarding (first login, never completed onboarding)
  useEffect(() => {
    if (profile && !profile.onboarding_completed_at && profile.approval_status !== 'pending') {
      setShowOnboarding(true);
    } else {
      setShowOnboarding(false);
    }
  }, [profile]);

  // Auto-collapse sidebar when entering hub sections (BOM Calculator, Yard, Leadership, Roadmap, Settings, Analytics, etc.)
  const isHubSection = activeSection === 'bom-calculator' || activeSection === 'bom-calculator-v2' || activeSection === 'yard' || activeSection === 'leadership' || activeSection === 'roadmap' || activeSection === 'survey-hub' || activeSection === 'client-hub' || activeSection === 'projects-hub' || activeSection === 'projects-list' || activeSection === 'sales-hub' || activeSection === 'schedule' || activeSection === 'requests' || activeSection === 'quotes' || activeSection === 'jobs' || activeSection === 'invoices' || activeSection === 'team' || activeSection === 'message-center' || activeSection === 'analytics';
  useEffect(() => {
    if (isHubSection) {
      setSidebarOpen(false);
    }
  }, [isHubSection]);

  // Handle QR code deep link claim from multiple sources
  const checkForClaimCode = useCallback(() => {
    if (!profile?.role) return;

    // Check sessionStorage first (set by /p/:projectCode deep link route)
    const storedClaim = sessionStorage.getItem('qr-claim-code');
    if (storedClaim) {
      setActiveSection('bom-calculator');
      return;
    }

    // Check current URL for /p/:projectCode pattern (handles PWA resume scenario)
    // When PWA resumes from external link, React Router may not have processed the route
    const pathMatch = location.pathname.match(/^\/p\/([^/]+)/);
    if (pathMatch) {
      const claimCode = pathMatch[1].toUpperCase();
      sessionStorage.setItem('qr-claim-code', claimCode);
      navigate('/', { replace: true });
      setActiveSection('bom-calculator');
      return;
    }

    // Check for query param claim: ?claim=PROJECT123 (backwards compatibility)
    const params = new URLSearchParams(window.location.search);
    if (params.has('claim')) {
      const claimCode = params.get('claim')!;
      sessionStorage.setItem('qr-claim-code', claimCode);
      window.history.replaceState({}, '', '/');
      setActiveSection('bom-calculator');
    }
  }, [profile?.role, location.pathname, navigate]);

  // Check on mount, when profile loads, or when location changes
  useEffect(() => {
    checkForClaimCode();
  }, [checkForClaimCode]);

  // Also check when PWA becomes visible (handles mobile PWA resume from background)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkForClaimCode();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [checkForClaimCode]);

  // Auto-redirect yard role users to Yard section (Mobile View)
  useEffect(() => {
    if (userRole === 'yard' && activeSection !== 'yard' && activeSection !== 'bom-calculator') {
      setActiveSection('yard');
    }
  }, [userRole, activeSection]);

  // Enable escalation engine for operations/admin roles
  const isOperationsRole = ['operations', 'sales-manager', 'admin'].includes(userRole);
  useEscalationEngine(isOperationsRole);

  // Menu visibility control
  const { canSeeMenuItem, menuVisibility } = useMenuVisibility();

  // Request notifications
  const { unreadCount: requestUnreadCount, markRequestAsRead } = useRequestNotifications();

  // Admin announcement engagement notifications
  const { unreadCount: announcementEngagementCount } = useAnnouncementEngagement();

  // Track unread announcements for all users (Chat badge)
  const [unreadAnnouncementsCount, setUnreadAnnouncementsCount] = useState(0);

  // Track unread team communication messages (Announcements badge)
  const [teamCommunicationUnreadCount, setTeamCommunicationUnreadCount] = useState(0);

  // Message Center unread count (sidebar badge)
  const messageCenterUnreadCount = useMessageCenterUnread(
    user ? { userId: user.id, userRole: userRole } : undefined
  );

  // Refresh trigger for team communication (incremented when a new message is sent)
  const [teamCommunicationRefresh, setTeamCommunicationRefresh] = useState(0);

  // Save viewMode to localStorage when it changes
  useEffect(() => {
    localStorage.setItem('viewMode', viewMode);
  }, [viewMode]);

  // Save mobileLayout to localStorage when it changes
  useEffect(() => {
    localStorage.setItem('mobileLayout', mobileLayout);
  }, [mobileLayout]);

  // Auto-collapse sidebar in Leadership and MyTodos modes for maximum screen space
  useEffect(() => {
    if (activeSection === 'leadership' || activeSection === 'my-todos') {
      setSidebarOpen(false);
    }
  }, [activeSection]);

  // Browser back/forward is now handled by useRouteSync via React Router

  // Universal navigation items - same for all roles (permissions controlled inside each component)
  // menuId allows mapping navigation section to different menu_visibility entries
  // Category and mobile_style are pulled from database for dynamic mobile navigation
  const getNavigationItems = () => {
    // Create a lookup object for menu visibility items
    const visibilityLookup: Record<string, typeof menuVisibility[number]> = {};
    menuVisibility.forEach(item => { visibilityLookup[item.menu_id] = item; });

    const items = [
      // Core FSM Navigation
      { id: 'dashboard' as Section, menuId: 'dashboard', name: 'Dashboard', icon: Home },
      { id: 'schedule' as Section, menuId: 'schedule', name: 'Schedule', icon: Calendar },
      { id: 'client-hub' as Section, menuId: 'client-hub', name: 'Clients', icon: Users },
      { id: 'projects-hub' as Section, menuId: 'projects-hub', name: 'Projects', icon: Briefcase },
      // Requests, Quotes, Jobs, Invoices moved to Projects Hub secondary sidebar

      // Operations Section
      { id: 'bom-calculator' as Section, menuId: 'bom-calculator', name: 'Ops Hub', icon: Calculator, separator: true },
      { id: 'bom-calculator-v2' as Section, menuId: 'bom-calculator-v2', name: 'Ops Hub V2', icon: FlaskConical },
      { id: 'inventory' as Section, menuId: 'inventory', name: 'Inventory', icon: Package, disabled: true },
      { id: 'yard' as Section, menuId: 'bom-yard', name: 'Yard', icon: Warehouse },
      { id: 'tickets' as Section, menuId: 'tickets', name: 'Tickets', icon: Ticket, badge: requestUnreadCount },

      // Personal/Sales Section
      { id: 'my-todos' as Section, menuId: 'my-todos', name: 'My To-Dos', icon: ListTodo, separator: true },
      { id: 'sales-hub' as Section, menuId: 'sales-hub', name: 'Sales', icon: TrendingUp },
      // Contact Center - Company SMS management (admin tool)
      { id: 'message-center' as Section, menuId: 'message-center', name: 'Contact Center', icon: Phone, badge: messageCenterUnreadCount },
      // Inbox - Unified personal inbox (team chats, SMS, announcements, tickets, notifications)
      { id: 'direct-messages' as Section, menuId: 'direct-messages', name: 'Inbox', icon: Inbox, badge: unreadAnnouncementsCount },

      // Admin/Management Section
      { id: 'leadership' as Section, menuId: 'leadership', name: 'Leadership', icon: Target, separator: true },
      // Announcements - Team announcements
      { id: 'team-communication' as Section, menuId: 'team-communication', name: 'Announcements', icon: MessageSquare, badge: teamCommunicationUnreadCount },
      { id: 'survey-hub' as Section, menuId: 'survey-hub', name: 'Surveys', icon: ClipboardList },
      { id: 'analytics' as Section, menuId: 'analytics', name: 'Analytics', icon: DollarSign },
      { id: 'roadmap' as Section, menuId: 'roadmap', name: 'Roadmap', icon: Map },

      // Legacy items (kept for backwards compatibility, hidden from new UI)
      { id: 'presentation' as Section, menuId: 'presentation', name: 'Client Presentation', icon: BookOpen },
      { id: 'sales-coach' as Section, menuId: 'sales-coach', name: 'AI Sales Coach', icon: BookOpen },
      { id: 'photo-gallery' as Section, menuId: 'photo-gallery', name: 'Photo Gallery', icon: Image },
      { id: 'stain-calculator' as Section, menuId: 'stain-calculator', name: 'Pre-Stain Calculator', icon: DollarSign },
      { id: 'sales-resources' as Section, menuId: 'sales-resources', name: 'Sales Resources', icon: BookOpen },

      // Settings
      { id: 'team' as Section, menuId: 'team', name: 'Settings', icon: SettingsIcon, separator: true },
    ];

    // Enhance items with category, sort_order, and mobile_style from database
    return items.map(item => {
      const visibility = visibilityLookup[item.menuId];
      return {
        ...item,
        category: visibility?.category || 'tools',
        sortOrder: visibility?.sort_order || 100,
        mobileStyle: visibility?.mobile_style || null,
      };
    });
  };

  const navigationItems = getNavigationItems();

  // Detect current platform based on actual screen size
  // mobile: < 640px, tablet: 640-1024px, desktop: >= 1024px
  const [currentPlatform, setCurrentPlatform] = useState<'desktop' | 'tablet' | 'mobile'>(() => {
    if (typeof window === 'undefined') return 'desktop';
    const width = window.innerWidth;
    if (width < 640) return 'mobile';
    if (width < 1024) return 'tablet';
    return 'desktop';
  });

  // Update platform on resize
  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      if (width < 640) setCurrentPlatform('mobile');
      else if (width < 1024) setCurrentPlatform('tablet');
      else setCurrentPlatform('desktop');
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Filter navigation items based on menu visibility settings
  // This checks both role visibility AND platform availability
  const visibleNavigationItems = navigationItems.filter(item => {
    // Hide Yard from desktop sidebar - it's accessed through Ops Hub
    if (item.menuId === 'bom-yard' && currentPlatform === 'desktop') {
      return false;
    }
    // Check both role visibility AND platform availability
    return canSeeMenuItem(item.menuId, { overrideRole: userRole, platform: currentPlatform });
  });

  const renderContent = () => {
    // Wrap all lazy-loaded components with Suspense
    // Handle common sections for all roles
    // Internal ticketing system (formerly "requests")
    if (activeSection === 'tickets') {
      // Desktop shows MyRequestsView (manage submitted tickets)
      // Mobile/Tablet shows RequestHub (create new tickets)
      if (currentPlatform === 'desktop') {
        return (
          <ErrorBoundary>
            <Suspense fallback={<LoadingFallback />}>
              <MyRequestsView
                onBack={() => navigateTo('home')}
                onMarkAsRead={markRequestAsRead}
              />
            </Suspense>
          </ErrorBoundary>
        );
      }
      return (
        <ErrorBoundary>
          <Suspense fallback={<LoadingFallback />}>
            <RequestHub onBack={() => navigateTo('home')} />
          </Suspense>
        </ErrorBoundary>
      );
    }
    if (activeSection === 'ticket-queue') {
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
            <SalesCoach userId={user?.id || 'unknown'} onOpenAdmin={() => setActiveSection('sales-coach-admin')} />
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
    if (activeSection === 'my-tickets') {
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
            <FullPageInbox />
          </Suspense>
        </ErrorBoundary>
      );
    }
    if (activeSection === 'message-center') {
      return (
        <ErrorBoundary>
          <Suspense fallback={<LoadingFallback />}>
            <MessageCenterHub />
          </Suspense>
        </ErrorBoundary>
      );
    }
    if (activeSection === 'bom-calculator') {
      // Show to operations, admin, and yard roles
      if (userRole === 'operations' || userRole === 'admin' || userRole === 'yard') {
        return (
          <ErrorBoundary>
            <Suspense fallback={<LoadingFallback />}>
              <BOMCalculatorHub
                onBack={() => setActiveSection('home')}
                userRole={userRole === 'yard' ? 'operations' : userRole}
                userId={user?.id}
                userName={profile?.full_name}
                startOnMobile={userRole === 'yard'}
              />
            </Suspense>
          </ErrorBoundary>
        );
      }
      // Redirect non-authorized users
      setActiveSection('home');
      return null;
    }
    if (activeSection === 'bom-calculator-v2') {
      // V2 Calculator - operations and admin only (desktop-only)
      if (userRole === 'operations' || userRole === 'admin') {
        return (
          <ErrorBoundary>
            <Suspense fallback={<LoadingFallback />}>
              <BOMCalculatorHub2
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
    if (activeSection === 'yard') {
      // Direct entry to Yard Mobile View - for mobile users with bom-yard access
      if (userRole === 'operations' || userRole === 'admin' || userRole === 'yard') {
        return (
          <ErrorBoundary>
            <Suspense fallback={<LoadingFallback />}>
              <BOMCalculatorHub
                onBack={() => setActiveSection('home')}
                userRole={userRole === 'yard' ? 'operations' : userRole}
                userId={user?.id}
                userName={profile?.full_name}
                startOnMobile={true}
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
    if (activeSection === 'my-todos') {
      return (
        <ErrorBoundary>
          <Suspense fallback={<LoadingFallback />}>
            <MyTodos onBack={() => setActiveSection('home')} />
          </Suspense>
        </ErrorBoundary>
      );
    }
    if (activeSection === 'roadmap') {
      return (
        <ErrorBoundary>
          <Suspense fallback={<LoadingFallback />}>
            <RoadmapHub onBack={() => setActiveSection('home')} />
          </Suspense>
        </ErrorBoundary>
      );
    }
    if (activeSection === 'survey-hub') {
      return (
        <ErrorBoundary>
          <Suspense fallback={<LoadingFallback />}>
            <SurveyHub />
          </Suspense>
        </ErrorBoundary>
      );
    }
    if (activeSection === 'client-hub') {
      return (
        <ErrorBoundary>
          <Suspense fallback={<LoadingFallback />}>
            <ClientHub
              entityContext={entityContext}
              onNavigateToEntity={navigateToEntity}
              onClearEntity={clearEntity}
            />
          </Suspense>
        </ErrorBoundary>
      );
    }
    if (activeSection === 'projects-hub' || activeSection === 'projects-list') {
      return (
        <ErrorBoundary>
          <Suspense fallback={<LoadingFallback />}>
            <ProjectsHub initialView={activeSection === 'projects-list' ? 'projects' : 'dashboard'} />
          </Suspense>
        </ErrorBoundary>
      );
    }
    if (activeSection === 'sales-hub') {
      return (
        <ErrorBoundary>
          <Suspense fallback={<LoadingFallback />}>
            <SalesHub />
          </Suspense>
        </ErrorBoundary>
      );
    }
    if (activeSection === 'schedule') {
      return (
        <ErrorBoundary>
          <Suspense fallback={<LoadingFallback />}>
            <SchedulePage />
          </Suspense>
        </ErrorBoundary>
      );
    }

    // FSM Pipeline - All sections route through ProjectsHub to preserve sidebar
    // This ensures consistent navigation and project context across all FSM entities
    if (activeSection === 'requests') {
      return (
        <ErrorBoundary>
          <Suspense fallback={<LoadingFallback />}>
            <ProjectsHub
              initialView="requests"
              entityContext={entityContext}
              onNavigateToEntity={navigateToEntity}
              onClearEntity={clearEntity}
            />
          </Suspense>
        </ErrorBoundary>
      );
    }

    if (activeSection === 'quotes') {
      return (
        <ErrorBoundary>
          <Suspense fallback={<LoadingFallback />}>
            <ProjectsHub
              initialView="quotes"
              entityContext={entityContext}
              onNavigateToEntity={navigateToEntity}
              onClearEntity={clearEntity}
            />
          </Suspense>
        </ErrorBoundary>
      );
    }

    if (activeSection === 'jobs') {
      return (
        <ErrorBoundary>
          <Suspense fallback={<LoadingFallback />}>
            <ProjectsHub
              initialView="jobs"
              entityContext={entityContext}
              onNavigateToEntity={navigateToEntity}
              onClearEntity={clearEntity}
            />
          </Suspense>
        </ErrorBoundary>
      );
    }

    if (activeSection === 'invoices') {
      return (
        <ErrorBoundary>
          <Suspense fallback={<LoadingFallback />}>
            <ProjectsHub
              initialView="invoices"
              entityContext={entityContext}
              onNavigateToEntity={navigateToEntity}
              onClearEntity={clearEntity}
            />
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
  if (!user) {
    return (
      <Suspense fallback={<LoadingFallback />}>
        <Login />
      </Suspense>
    );
  }

  // Block users who are pending approval
  if (profile?.approval_status === 'pending') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Account Pending Approval</h2>
          <p className="text-gray-600 mb-6">
            Your account is waiting for administrator approval. You'll receive an email and/or SMS notification once approved.
          </p>
          <button
            onClick={signOut}
            className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200"
          >
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  // Block users who were rejected
  if (profile?.approval_status === 'rejected') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Access Denied</h2>
          <p className="text-gray-600 mb-6">
            Your account request was not approved. Please contact an administrator if you believe this is an error.
          </p>
          <button
            onClick={signOut}
            className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200"
          >
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  // Show onboarding wizard for new users who haven't completed onboarding
  if (showOnboarding) {
    return (
      <Suspense fallback={<LoadingFallback />}>
        <OnboardingWizard
          onComplete={() => {
            setShowOnboarding(false);
            // Refresh the page to reload profile with updated onboarding_completed_at
            window.location.reload();
          }}
        />
      </Suspense>
    );
  }

  // Mobile view - same for all roles
  if (viewMode === 'mobile') {
    return (
      <ToastProvider>
        <RightPaneProvider>
          <MobileAppContent
            activeSection={activeSection}
            onNavigate={navigateTo}
            userId={user?.id}
            profileAvatarUrl={profile?.avatar_url}
            profileFullName={userName}
            userRole={userRole}
            setViewMode={setViewMode}
            mobileLayout={mobileLayout}
            setMobileLayout={setMobileLayout}
            showProfileView={showProfileView}
            setShowProfileView={setShowProfileView}
            showProfileEditor={showProfileEditor}
            setShowProfileEditor={setShowProfileEditor}
            signOut={signOut}
          >
            <ErrorBoundary>
              {activeSection === 'analytics' ? (
                <Suspense fallback={<LoadingFallback />}>
                  <MobileAnalyticsView onBack={() => navigateTo('home')} />
                </Suspense>
              ) : activeSection === 'mobile-inbox' ? (
                <Suspense fallback={<LoadingFallback />}>
                  <MobileUnifiedInbox
                    onBack={() => navigateTo('home')}
                    onNavigate={navigateTo}
                    onOpenConversation={(_conv) => {
                      // When opening a conversation from inbox, navigate to message-center
                      // The RightPaneMessaging will handle displaying the conversation
                      // For now, we use the existing right pane mechanism
                      navigateTo('home');
                      // TODO: Open conversation in dedicated view
                    }}
                  />
                </Suspense>
              ) : (
                <SalesRepView
                  activeSection={activeSection}
                  onNavigate={navigateTo}
                  viewMode={viewMode}
                  mobileLayout={mobileLayout}
                  unreadAnnouncementsCount={unreadAnnouncementsCount}
                  announcementEngagementCount={announcementEngagementCount}
                  userId={user?.id}
                  userName={profile?.full_name}
                  onMarkAsRead={markRequestAsRead}
                  onUnreadCountChange={setUnreadAnnouncementsCount}
                  onTeamCommunicationUnreadCountChange={setTeamCommunicationUnreadCount}
                  teamCommunicationRefresh={teamCommunicationRefresh}
                  navigationItems={visibleNavigationItems}
                  userRole={userRole}
                />
              )}
            </ErrorBoundary>
          </MobileAppContent>
        </RightPaneProvider>
      </ToastProvider>
    );
  }

  return (
    <ToastProvider>
      <RightPaneProvider>
      <div className="flex h-screen bg-gray-50 overflow-hidden">
        <Sidebar
          sidebarOpen={sidebarOpen}
          setSidebarOpen={setSidebarOpen}
          navigationItems={visibleNavigationItems}
          activeSection={activeSection}
          onNavigate={navigateTo}
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
          onCreateRequest={() => navigateToEntity('request', { id: 'new' })}
          onCreateQuote={() => navigateToEntity('quote', { id: 'new' })}
        />

        <div className="flex-1 overflow-auto">
          {isHubSection ? (
            // Hub sections take full screen with no wrapper padding
            renderContent()
          ) : (
            <div className={activeSection === 'my-todos' ? 'p-6' : 'p-8 max-w-7xl mx-auto'}>
              {renderContent()}
            </div>
          )}
        </div>

        {/* Install App Banner */}
        <InstallAppBanner />

        {/* PWA Update Prompt */}
        <PWAUpdatePrompt />

        {/* Push Notification Banner */}
        <PushNotificationBanner />

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

        {/* Right-Pane Messaging - accessible from anywhere in the app */}
        {activeSection !== 'message-center' && <FloatingMessageButton />}
        <RightPaneMessaging />
      </div>
      </RightPaneProvider>
    </ToastProvider>
  );
}

export default App;
