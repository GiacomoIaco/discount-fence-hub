import { lazy, Suspense, useMemo } from 'react';
import CustomPricingRequest from './CustomPricingRequest';
import type { MenuCategory, MobileStyle } from '../../hooks/useMenuVisibility';
import type { Section } from '../../lib/routes';

interface NavigationItem {
  id: Section;
  menuId: string;
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
  separator?: boolean;
  category?: MenuCategory;
  sortOrder?: number;
  mobileStyle?: MobileStyle | null;
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
const Settings = lazy(() => import('../../features/settings').then(module => ({ default: module.Settings })));
const MyTodos = lazy(() => import('../../features/my-todos').then(m => ({ default: m.MyTodos })));
const BOMCalculatorHub = lazy(() => import('../../features/bom_calculator/BOMCalculatorHub'));
const RoadmapHub = lazy(() => import('../../features/roadmap/RoadmapHub'));
const SurveyHub = lazy(() => import('../../features/survey_hub/SurveyHub'));
const ClientHub = lazy(() => import('../../features/client_hub/ClientHub'));
const ProjectsHub = lazy(() => import('../../features/projects_hub/ProjectsHub'));
const SalesHub = lazy(() => import('../../features/sales_hub/SalesHub'));
const SchedulePage = lazy(() => import('../../features/schedule/SchedulePage'));

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
  onNavigate: (section: Section) => void;
  viewMode: 'mobile' | 'desktop';
  mobileLayout?: 'expanded' | 'compact';
  inboxUnreadCount: number;
  announcementEngagementCount: number;
  userId?: string;
  userName?: string;
  onMarkAsRead?: (requestId: string) => void;
  onUnreadCountChange?: (count: number) => void;
  onTeamCommunicationUnreadCountChange?: (count: number) => void;
  teamCommunicationRefresh?: number;
  navigationItems?: NavigationItem[];
}

export default function SalesRepView({
  activeSection,
  onNavigate,
  viewMode,
  mobileLayout = 'expanded',
  inboxUnreadCount,
  announcementEngagementCount,
  userId,
  userName,
  onMarkAsRead,
  onUnreadCountChange,
  onTeamCommunicationUnreadCountChange,
  teamCommunicationRefresh,
  navigationItems = [],
}: SalesRepViewProps) {
  // Internal ticketing (formerly "requests")
  if (activeSection === 'tickets') {
    return (
      <Suspense fallback={<LoadingFallback />}>
        <RequestHub onBack={() => onNavigate('home')} />
      </Suspense>
    );
  }

  if (activeSection === 'custom-pricing') {
    return <CustomPricingRequest onBack={() => onNavigate('home')} viewMode={viewMode} />;
  }

  if (activeSection === 'my-tickets') {
    return (
      <Suspense fallback={<LoadingFallback />}>
        <MyRequestsView onBack={() => onNavigate('home')} onMarkAsRead={onMarkAsRead} />
      </Suspense>
    );
  }

  if (activeSection === 'stain-calculator') {
    return (
      <Suspense fallback={<LoadingFallback />}>
        <StainCalculator onBack={() => onNavigate('home')} />
      </Suspense>
    );
  }

  if (activeSection === 'presentation') {
    return (
      <Suspense fallback={<LoadingFallback />}>
        <ClientPresentation onBack={() => onNavigate('home')} isMobile={true} />
      </Suspense>
    );
  }

  if (activeSection === 'sales-coach') {
    return (
      <Suspense fallback={<LoadingFallback />}>
        <SalesCoach userId={userId || 'unknown'} onOpenAdmin={() => onNavigate('sales-coach-admin')} />
      </Suspense>
    );
  }

  if (activeSection === 'sales-coach-admin') {
    return (
      <Suspense fallback={<LoadingFallback />}>
        <SalesCoachAdmin onBack={() => onNavigate('sales-coach')} />
      </Suspense>
    );
  }

  if (activeSection === 'photo-gallery') {
    return (
      <Suspense fallback={<LoadingFallback />}>
        <PhotoGalleryRefactored onBack={() => onNavigate('home')} viewMode="mobile" userId={userId} userName={userName} />
      </Suspense>
    );
  }

  if (activeSection === 'sales-resources') {
    return (
      <Suspense fallback={<LoadingFallback />}>
        <SalesResources onBack={() => onNavigate('home')} viewMode={viewMode} />
      </Suspense>
    );
  }

  if (activeSection === 'team-communication') {
    return (
      <Suspense fallback={<LoadingFallback />}>
        <TeamCommunication onBack={() => onNavigate('home')} onUnreadCountChange={onTeamCommunicationUnreadCountChange} refreshTrigger={teamCommunicationRefresh} />
      </Suspense>
    );
  }

  if (activeSection === 'team') {
    return (
      <Suspense fallback={<LoadingFallback />}>
        <Settings onBack={() => onNavigate('home')} />
      </Suspense>
    );
  }

  if (activeSection === 'my-todos') {
    return (
      <Suspense fallback={<LoadingFallback />}>
        <MyTodos onBack={() => onNavigate('home')} />
      </Suspense>
    );
  }

  if (activeSection === 'yard') {
    return (
      <Suspense fallback={<LoadingFallback />}>
        <BOMCalculatorHub
          onBack={() => onNavigate('home')}
          userId={userId}
          userName={userName}
          startOnMobile={true}
        />
      </Suspense>
    );
  }

  if (activeSection === 'roadmap') {
    return (
      <Suspense fallback={<LoadingFallback />}>
        <RoadmapHub onBack={() => onNavigate('home')} />
      </Suspense>
    );
  }

  if (activeSection === 'survey-hub') {
    return (
      <Suspense fallback={<LoadingFallback />}>
        <SurveyHub />
      </Suspense>
    );
  }

  if (activeSection === 'client-hub') {
    return (
      <Suspense fallback={<LoadingFallback />}>
        <ClientHub />
      </Suspense>
    );
  }

  if (activeSection === 'projects-hub') {
    return (
      <Suspense fallback={<LoadingFallback />}>
        <ProjectsHub />
      </Suspense>
    );
  }

  if (activeSection === 'sales-hub') {
    return (
      <Suspense fallback={<LoadingFallback />}>
        <SalesHub />
      </Suspense>
    );
  }

  if (activeSection === 'schedule') {
    return (
      <Suspense fallback={<LoadingFallback />}>
        <SchedulePage />
      </Suspense>
    );
  }

  // Default style when no mobile_style in database
  const defaultStyle: MobileStyle = {
    bgColor: 'bg-white border border-gray-200',
    iconBg: 'bg-gray-100',
    iconColor: 'text-gray-600',
    description: '',
    textColor: 'text-gray-900',
    subtextColor: 'text-gray-600'
  };

  // Get style from item's mobileStyle or use default
  const getItemStyle = (item: NavigationItem): MobileStyle & { textColor?: string; subtextColor?: string } => {
    const style = item.mobileStyle || defaultStyle;
    // For gradient items, text is white; for solid bg items, use specified colors
    const isGradient = !!style.gradient;
    return {
      ...style,
      textColor: style.textColor || (isGradient ? 'text-white' : 'text-gray-900'),
      subtextColor: style.subtextColor || (isGradient ? 'text-white/80' : 'text-gray-600'),
    };
  };

  // Get badge count for specific items
  const getBadgeCount = (menuId: string): number => {
    if (menuId === 'inbox') return inboxUnreadCount;
    if (menuId === 'team-communication') return announcementEngagementCount;
    return 0;
  };

  // Render a single navigation button (expanded view)
  const renderNavButton = (item: NavigationItem) => {
    const style = getItemStyle(item);
    const Icon = item.icon;
    const isGradient = !!style.gradient;
    const badgeCount = item.badge || getBadgeCount(item.menuId);

    return (
      <button
        key={item.id}
        onClick={() => onNavigate(item.id)}
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

  // Render a compact navigation button (3 per row grid view)
  const renderCompactNavButton = (item: NavigationItem) => {
    const style = getItemStyle(item);
    const Icon = item.icon;
    const isGradient = !!style.gradient;
    const badgeCount = item.badge || getBadgeCount(item.menuId);

    return (
      <button
        key={item.id}
        onClick={() => onNavigate(item.id)}
        className={`flex flex-col items-center justify-center p-3 rounded-xl shadow-sm active:scale-95 transition-transform relative ${
          isGradient ? `bg-gradient-to-br ${style.gradient} text-white` : style.bgColor
        }`}
      >
        <div className={`${style.iconBg} p-2.5 rounded-lg mb-2`}>
          <Icon className={`w-6 h-6 ${style.iconColor || ''}`} />
        </div>
        <span className={`text-xs font-medium text-center leading-tight line-clamp-2 ${style.textColor || ''}`}>
          {item.name}
        </span>
        {badgeCount > 0 && (
          <div className="absolute top-1 right-1 bg-red-500 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">
            {badgeCount > 9 ? '9+' : badgeCount}
          </div>
        )}
      </button>
    );
  };

  // Group navigation items dynamically by category from database
  // Items are sorted by sortOrder within each category
  const categorizedItems = useMemo(() => {
    const sorted = [...navigationItems].sort((a, b) => (a.sortOrder || 100) - (b.sortOrder || 100));
    return {
      main: sorted.filter(item => item.category === 'main'),
      communication: sorted.filter(item => item.category === 'communication'),
      requests: sorted.filter(item => item.category === 'requests'),
      operations: sorted.filter(item => item.category === 'operations'),
      admin: sorted.filter(item => item.category === 'admin'),
      tools: sorted.filter(item => item.category === 'tools'),
      system: sorted.filter(item => item.category === 'system'),
    };
  }, [navigationItems]);

  // Category display configuration
  const categoryConfig: Record<MenuCategory, { label: string; showLabel: boolean }> = {
    main: { label: '', showLabel: false }, // Main tools shown without header
    communication: { label: 'Communication', showLabel: true },
    requests: { label: 'Requests', showLabel: true },
    operations: { label: 'Operations', showLabel: true },
    admin: { label: 'Leadership', showLabel: true },
    tools: { label: 'Other Tools', showLabel: true },
    system: { label: '', showLabel: false }, // Settings shown without header
  };

  // Order categories for display
  const categoryOrder: MenuCategory[] = ['main', 'communication', 'requests', 'operations', 'admin', 'tools', 'system'];

  // Compact view: Flatten all items into a single grid (ignore categories)
  if (mobileLayout === 'compact') {
    const allItems = categoryOrder.flatMap(category => categorizedItems[category]);

    return (
      <div className="p-4">
        <div className="grid grid-cols-3 gap-3">
          {allItems.map(renderCompactNavButton)}
        </div>
      </div>
    );
  }

  // Expanded view (default): Show items grouped by category
  return (
    <div className="space-y-4 p-4">
      {categoryOrder.map(category => {
        const items = categorizedItems[category];
        if (items.length === 0) return null;

        const config = categoryConfig[category];
        const isLast = category === 'system' || category === 'tools';

        return (
          <div key={category} className={`space-y-3 ${category !== 'main' ? 'pt-4' : ''} ${isLast ? 'pb-8' : ''}`}>
            {config.showLabel && (
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
                {config.label}
              </h2>
            )}
            {items.map(renderNavButton)}
          </div>
        );
      })}
    </div>
  );
}
