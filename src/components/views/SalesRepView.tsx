import { lazy, Suspense } from 'react';
import CustomPricingRequest from './CustomPricingRequest';

type Section = 'home' | 'custom-pricing' | 'requests' | 'my-requests' | 'presentation' | 'stain-calculator' | 'sales-coach' | 'sales-coach-admin' | 'photo-gallery' | 'sales-resources' | 'dashboard' | 'request-queue' | 'analytics' | 'team' | 'manager-dashboard' | 'team-communication' | 'direct-messages' | 'assignment-rules' | 'bom-calculator' | 'leadership' | 'my-todos' | 'yard';

interface NavigationItem {
  id: Section;
  menuId: string;
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
  separator?: boolean;
}

// Lazy load components
const StainCalculator = lazy(() => import('../../features/sales-tools').then(module => ({ default: module.StainCalculator })));
const ClientPresentation = lazy(() => import('../../features/sales-tools').then(module => ({ default: module.ClientPresentation })));
const SalesCoach = lazy(() => import('../../features/ai-coach').then(module => ({ default: module.SalesCoach })));
const SalesCoachAdmin = lazy(() => import('../../features/ai-coach').then(module => ({ default: module.SalesCoachAdmin })));
const PhotoGalleryRefactored = lazy(() => import('../../features/photos').then(module => ({ default: module.PhotoGalleryRefactored })));
const SalesResources = lazy(() => import('../../features/sales-resources').then(module => ({ default: module.SalesResources })));
const RequestHub = lazy(() => import('../../features/requests').then(module => ({ default: module.RequestHub })));
const MyRequestsView = lazy(() => import('../../features/requests').then(module => ({ default: module.MyRequestsView })));
const TeamCommunication = lazy(() => import('../../features/communication').then(module => ({ default: module.TeamCommunication })));
const DirectMessages = lazy(() => import('../../features/communication').then(module => ({ default: module.DirectMessages })));

// Loading fallback component
const LoadingFallback = () => (
  <div className="flex items-center justify-center min-h-[400px]">
    <div className="text-center">
      <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
      <div className="text-gray-600">Loading...</div>
    </div>
  </div>
);

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
  navigationItems?: NavigationItem[];
  userRole?: string;
}

export default function SalesRepView({
  activeSection,
  setActiveSection,
  viewMode,
  unreadAnnouncementsCount,
  announcementEngagementCount,
  userId,
  userName,
  onMarkAsRead,
  onUnreadCountChange,
  onTeamCommunicationUnreadCountChange,
  teamCommunicationRefresh,
  navigationItems = [],
  userRole: _userRole
}: SalesRepViewProps) {
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
        <SalesCoach userId={userId || 'unknown'} onOpenAdmin={() => setActiveSection('sales-coach-admin')} />
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

  // Define styling and descriptions for each menu item
  const getItemStyle = (menuId: string): {
    gradient?: string;
    bgColor?: string;
    iconBg: string;
    iconColor?: string;
    description: string;
    textColor?: string;
    subtextColor?: string;
    extra?: React.ReactNode;
  } => {
    const styles: Record<string, ReturnType<typeof getItemStyle>> = {
      'presentation': {
        gradient: 'from-blue-600 to-blue-700',
        iconBg: 'bg-white/20',
        description: "Show customers why we're #1",
        subtextColor: 'text-blue-100'
      },
      'sales-coach': {
        gradient: 'from-purple-600 to-purple-700',
        iconBg: 'bg-white/20',
        description: 'Record & analyze meetings',
        subtextColor: 'text-purple-100'
      },
      'photo-gallery': {
        bgColor: 'bg-white border-2 border-gray-200',
        iconBg: 'bg-green-100',
        iconColor: 'text-green-600',
        description: 'Browse & capture job photos',
        textColor: 'text-gray-900',
        subtextColor: 'text-gray-600'
      },
      'stain-calculator': {
        bgColor: 'bg-white border-2 border-gray-200',
        iconBg: 'bg-orange-100',
        iconColor: 'text-orange-600',
        description: 'Show ROI vs DIY staining',
        textColor: 'text-gray-900',
        subtextColor: 'text-gray-600'
      },
      'direct-messages': {
        gradient: 'from-blue-600 to-blue-700',
        iconBg: 'bg-white/20',
        description: 'Direct messages with team',
        subtextColor: 'text-blue-100'
      },
      'team-communication': {
        gradient: 'from-indigo-600 to-indigo-700',
        iconBg: 'bg-white/20',
        description: 'Team updates & announcements',
        subtextColor: 'text-indigo-100'
      },
      'requests': {
        gradient: 'from-green-600 to-green-700',
        iconBg: 'bg-white/20',
        description: 'Submit & track all requests',
        subtextColor: 'text-green-100'
      },
      'my-requests': {
        bgColor: 'bg-white border-2 border-gray-200',
        iconBg: 'bg-blue-100',
        iconColor: 'text-blue-600',
        description: 'Track your submitted requests',
        textColor: 'text-gray-900',
        subtextColor: 'text-gray-600'
      },
      'bom-yard': {
        gradient: 'from-amber-600 to-amber-700',
        iconBg: 'bg-white/20',
        description: 'Manage pick lists & staging',
        subtextColor: 'text-amber-100'
      },
      'sales-resources': {
        bgColor: 'bg-white border border-gray-200',
        iconBg: 'bg-indigo-100',
        iconColor: 'text-indigo-600',
        description: 'Guides, catalogs & training',
        textColor: 'text-gray-900',
        subtextColor: 'text-gray-600'
      },
      'my-todos': {
        bgColor: 'bg-white border-2 border-gray-200',
        iconBg: 'bg-purple-100',
        iconColor: 'text-purple-600',
        description: 'Your tasks and to-do items',
        textColor: 'text-gray-900',
        subtextColor: 'text-gray-600'
      },
      'team': {
        bgColor: 'bg-white border border-gray-200',
        iconBg: 'bg-gray-100',
        iconColor: 'text-gray-600',
        description: 'App settings & preferences',
        textColor: 'text-gray-900',
        subtextColor: 'text-gray-600'
      },
      'analytics': {
        bgColor: 'bg-white border-2 border-gray-200',
        iconBg: 'bg-teal-100',
        iconColor: 'text-teal-600',
        description: 'View reports & metrics',
        textColor: 'text-gray-900',
        subtextColor: 'text-gray-600'
      },
      'leadership': {
        gradient: 'from-slate-700 to-slate-800',
        iconBg: 'bg-white/20',
        description: 'Goals, targets & team overview',
        subtextColor: 'text-slate-200'
      },
      'bom-calculator': {
        bgColor: 'bg-white border-2 border-gray-200',
        iconBg: 'bg-cyan-100',
        iconColor: 'text-cyan-600',
        description: 'Bill of materials calculator',
        textColor: 'text-gray-900',
        subtextColor: 'text-gray-600'
      },
      'dashboard': {
        gradient: 'from-gray-700 to-gray-800',
        iconBg: 'bg-white/20',
        description: 'Overview & quick stats',
        subtextColor: 'text-gray-200'
      },
    };
    return styles[menuId] || {
      bgColor: 'bg-white border border-gray-200',
      iconBg: 'bg-gray-100',
      iconColor: 'text-gray-600',
      description: '',
      textColor: 'text-gray-900',
      subtextColor: 'text-gray-600'
    };
  };

  // Get badge count for specific items
  const getBadgeCount = (menuId: string): number => {
    if (menuId === 'direct-messages') return unreadAnnouncementsCount;
    if (menuId === 'team-communication') return announcementEngagementCount;
    return 0;
  };

  // Render a single navigation button
  const renderNavButton = (item: NavigationItem) => {
    const style = getItemStyle(item.menuId);
    const Icon = item.icon;
    const isGradient = !!style.gradient;
    const badgeCount = item.badge || getBadgeCount(item.menuId);

    return (
      <button
        key={item.id}
        onClick={() => setActiveSection(item.id)}
        className={`w-full ${isGradient ? `bg-gradient-to-r ${style.gradient} text-white` : style.bgColor} p-5 rounded-xl shadow-sm active:scale-98 transition-transform relative`}
      >
        <div className="flex items-center space-x-4">
          <div className={`${style.iconBg} p-3 rounded-lg`}>
            <Icon className={`w-7 h-7 ${style.iconColor || ''}`} />
          </div>
          <div className="flex-1 text-left">
            <div className={`font-bold ${isGradient ? 'text-lg' : 'text-base'} ${style.textColor || ''}`}>{item.name}</div>
            <div className={`text-sm ${style.subtextColor}`}>{style.description}</div>
          </div>
          {item.menuId === 'requests' && (
            <div className="text-xs bg-white/20 px-3 py-1.5 rounded-full font-medium">
              Voice
            </div>
          )}
        </div>
        {badgeCount > 0 && (
          <div className="absolute top-3 right-3 bg-red-500 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center">
            {badgeCount > 99 ? '99+' : badgeCount}
          </div>
        )}
      </button>
    );
  };

  // Group navigation items by category
  const mainItems = navigationItems.filter(item =>
    ['presentation', 'sales-coach', 'photo-gallery', 'stain-calculator', 'direct-messages', 'team-communication', 'dashboard'].includes(item.menuId)
  );
  const requestItems = navigationItems.filter(item =>
    ['requests', 'my-requests'].includes(item.menuId)
  );
  const yardItems = navigationItems.filter(item =>
    ['bom-yard', 'bom-calculator'].includes(item.menuId)
  );
  const toolItems = navigationItems.filter(item =>
    ['sales-resources', 'analytics', 'leadership', 'my-todos', 'team'].includes(item.menuId)
  );

  return (
    <div className="space-y-4 p-4">
      {/* Main Tools Section */}
      {mainItems.length > 0 && (
        <div className="space-y-3">
          {mainItems.map(renderNavButton)}
        </div>
      )}

      {/* Requests Section */}
      {requestItems.length > 0 && (
        <div className="space-y-3 pt-4">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Requests</h2>
          {requestItems.map(renderNavButton)}
        </div>
      )}

      {/* Yard Section */}
      {yardItems.length > 0 && (
        <div className="space-y-3 pt-4">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Yard</h2>
          {yardItems.map(renderNavButton)}
        </div>
      )}

      {/* Other Tools Section */}
      {toolItems.length > 0 && (
        <div className="space-y-3 pt-4 pb-8">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Other Tools</h2>
          {toolItems.map(renderNavButton)}
        </div>
      )}
    </div>
  );
}
