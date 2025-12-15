import { useState, useEffect, useCallback } from 'react';
import {
  LayoutDashboard,
  ClipboardList,
  FileText,
  Hammer,
  Receipt,
  CreditCard,
  ChevronRight,
  Briefcase,
  PanelLeftClose,
  PanelLeft,
} from 'lucide-react';
import type { ProjectsHubView } from './types';
import { ProjectsDashboard, ComingSoonPlaceholder } from './components';
import { RequestsHub, QuotesHub, JobsHub, InvoicesHub } from '../fsm/pages';
import { SidebarTooltip } from '../../components/sidebar';
import { useAppNavigation, type EntityContext } from '../../hooks/useRouteSync';
import type { EntityType } from '../../lib/routes';

const STORAGE_KEY = 'sidebar-collapsed-projects-hub';

const NAV_ITEMS: { key: ProjectsHubView; label: string; icon: typeof LayoutDashboard; comingSoon?: boolean }[] = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { key: 'requests', label: 'Requests', icon: ClipboardList },
  { key: 'quotes', label: 'Quotes', icon: FileText },
  { key: 'jobs', label: 'Jobs', icon: Hammer },
  { key: 'invoices', label: 'Invoices', icon: Receipt },
  { key: 'payments', label: 'Payments', icon: CreditCard, comingSoon: true },
];

// Map entity types to views
const ENTITY_TO_VIEW: Record<string, ProjectsHubView> = {
  request: 'requests',
  quote: 'quotes',
  job: 'jobs',
  invoice: 'invoices',
};

interface ProjectsHubProps {
  onBack?: () => void;
  initialView?: ProjectsHubView;
  /** Entity context from URL (passed from App.tsx) */
  entityContext?: EntityContext | null;
  /** Navigate to entity URL */
  onNavigateToEntity?: (entityType: EntityType, params: Record<string, string>) => void;
  /** Clear entity from URL */
  onClearEntity?: () => void;
}

export default function ProjectsHub({
  onBack: _onBack,
  initialView = 'dashboard',
  entityContext: externalEntityContext,
  onNavigateToEntity: externalNavigateToEntity,
  onClearEntity: externalClearEntity,
}: ProjectsHubProps) {
  const { navigateToEntity: localNavigateToEntity, getEntityContext, navigateTo } = useAppNavigation();

  // Use external context if provided, otherwise get from URL
  const entityContext = externalEntityContext ?? getEntityContext();

  // Determine initial view from entity context or prop
  const getInitialView = (): ProjectsHubView => {
    if (entityContext && ENTITY_TO_VIEW[entityContext.type]) {
      return ENTITY_TO_VIEW[entityContext.type];
    }
    return initialView;
  };

  const [activeView, setActiveView] = useState<ProjectsHubView>(getInitialView);
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false;
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === 'true';
  });

  // Update view when entity context changes
  useEffect(() => {
    if (entityContext && ENTITY_TO_VIEW[entityContext.type]) {
      setActiveView(ENTITY_TO_VIEW[entityContext.type]);
    }
  }, [entityContext]);

  // Navigation helpers that use URL routing
  const handleNavigateToEntity = useCallback((entityType: EntityType, params: Record<string, string>) => {
    if (externalNavigateToEntity) {
      externalNavigateToEntity(entityType, params);
    } else {
      localNavigateToEntity(entityType, params);
    }
  }, [externalNavigateToEntity, localNavigateToEntity]);

  const handleClearEntity = useCallback(() => {
    if (externalClearEntity) {
      externalClearEntity();
    } else {
      // Navigate back to the section list
      navigateTo(activeView === 'requests' ? 'requests' :
                 activeView === 'quotes' ? 'quotes' :
                 activeView === 'jobs' ? 'jobs' :
                 activeView === 'invoices' ? 'invoices' : 'projects-hub');
    }
  }, [externalClearEntity, navigateTo, activeView]);

  // Persist collapsed state
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, String(collapsed));
  }, [collapsed]);

  // Get entity context for the current view's entity type
  const getViewEntityContext = (viewType: 'request' | 'quote' | 'job' | 'invoice'): EntityContext | null => {
    if (entityContext && entityContext.type === viewType) {
      return entityContext;
    }
    return null;
  };

  const renderContent = () => {
    switch (activeView) {
      case 'dashboard':
        return <ProjectsDashboard onNavigate={setActiveView} />;
      case 'requests':
        return (
          <RequestsHub
            entityContext={getViewEntityContext('request')}
            onNavigateToEntity={handleNavigateToEntity}
            onClearEntity={handleClearEntity}
          />
        );
      case 'quotes':
        return (
          <QuotesHub
            entityContext={getViewEntityContext('quote')}
            onNavigateToEntity={handleNavigateToEntity}
            onClearEntity={handleClearEntity}
          />
        );
      case 'jobs':
        return (
          <JobsHub
            entityContext={getViewEntityContext('job')}
            onNavigateToEntity={handleNavigateToEntity}
            onClearEntity={handleClearEntity}
          />
        );
      case 'invoices':
        return (
          <InvoicesHub
            entityContext={getViewEntityContext('invoice')}
            onNavigateToEntity={handleNavigateToEntity}
            onClearEntity={handleClearEntity}
          />
        );
      case 'payments':
        return (
          <ComingSoonPlaceholder
            title="Payments"
            description="Track customer payments, manage payment plans, and view accounts receivable."
            icon={CreditCard}
          />
        );
      default:
        return <ProjectsDashboard onNavigate={setActiveView} />;
    }
  };

  return (
    <div className="flex h-full">
      {/* Sidebar */}
      <div className={`${collapsed ? 'w-14' : 'w-56'} bg-gradient-to-b from-blue-800 to-indigo-900 text-white flex flex-col transition-all duration-300`}>
        {/* Header */}
        <div className="p-3 border-b border-blue-700">
          <div className={`flex items-center ${collapsed ? 'justify-center' : 'justify-between'}`}>
            {!collapsed && (
              <h1 className="text-lg font-bold flex items-center gap-2">
                <Briefcase className="w-5 h-5" />
                Projects Hub
              </h1>
            )}
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="p-1.5 text-blue-200 hover:text-white hover:bg-white/10 rounded transition-colors"
              title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {collapsed ? <PanelLeft className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
            </button>
          </div>
          {!collapsed && <p className="text-xs text-blue-200 mt-1">Manage the full job lifecycle</p>}
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-2 space-y-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeView === item.key;
            return (
              <SidebarTooltip key={item.key} label={item.label} showTooltip={collapsed}>
                <button
                  onClick={() => setActiveView(item.key)}
                  className={`w-full flex items-center ${collapsed ? 'justify-center' : 'gap-3'} px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-white/20 text-white shadow-lg'
                      : item.comingSoon
                      ? 'text-blue-300/60 hover:bg-white/5'
                      : 'text-blue-100 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  {!collapsed && (
                    <>
                      <span className="flex-1 text-left">{item.label}</span>
                      {item.comingSoon && (
                        <span className="text-[10px] bg-blue-600/50 px-1.5 py-0.5 rounded">Soon</span>
                      )}
                      {isActive && !item.comingSoon && <ChevronRight className="w-4 h-4" />}
                    </>
                  )}
                </button>
              </SidebarTooltip>
            );
          })}
        </nav>

      </div>

      {/* Main Content */}
      <div className="flex-1 bg-gray-50 overflow-auto">
        {renderContent()}
      </div>
    </div>
  );
}
