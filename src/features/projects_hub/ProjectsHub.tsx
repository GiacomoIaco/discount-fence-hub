import { useState, useEffect, useCallback, useRef } from 'react';
import {
  LayoutDashboard,
  ClipboardList,
  FileText,
  Hammer,
  Receipt,
  CreditCard,
  ChevronRight,
  Briefcase,
  Pin,
  PinOff,
  FolderKanban,
} from 'lucide-react';
import type { ProjectsHubView } from './types';
import { ProjectsDashboard, ComingSoonPlaceholder, ProjectsListView } from './components';
import { RequestsHub, QuotesHub, JobsHub, InvoicesHub } from '../fsm/pages';
import { ProjectPage, ProjectCreateWizard, ProjectContextHeader, type ProjectWizardResult } from '../fsm/components/project';
import { QuoteCard } from '../fsm/components/QuoteCard';
import { useProjectFull } from '../fsm/hooks/useProjects';
import { useQuote } from '../fsm/hooks/useQuotes';
import { SidebarTooltip } from '../../components/sidebar';
import { useAppNavigation, type EntityContext } from '../../hooks/useRouteSync';
import type { EntityType } from '../../lib/routes';

const STORAGE_KEY = 'sidebar-collapsed-projects-hub';

// Hover timing constants (in ms)
const EXPAND_DELAY = 300;
const COLLAPSE_DELAY = 500;

const NAV_ITEMS: { key: ProjectsHubView; label: string; icon: typeof LayoutDashboard; comingSoon?: boolean }[] = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { key: 'projects', label: 'Projects', icon: FolderKanban },  // Project-First view
  { key: 'requests', label: 'Requests', icon: ClipboardList },
  { key: 'quotes', label: 'Quotes', icon: FileText },
  { key: 'jobs', label: 'Jobs', icon: Hammer },
  { key: 'invoices', label: 'Invoices', icon: Receipt },
  { key: 'payments', label: 'Payments', icon: CreditCard, comingSoon: true },
];

// Map entity types to views
const ENTITY_TO_VIEW: Record<string, ProjectsHubView> = {
  project: 'projects',
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

  // Load initial state from localStorage (hover-to-expand pattern)
  const getInitialSidebarState = () => {
    if (typeof window === 'undefined') return { pinned: false, collapsed: true };
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        return {
          pinned: parsed.pinned ?? false,
          collapsed: parsed.collapsed ?? true,
        };
      }
    } catch {
      // Legacy format (just boolean string) - migrate to new format
      const legacy = localStorage.getItem(STORAGE_KEY);
      if (legacy === 'true' || legacy === 'false') {
        return { pinned: false, collapsed: legacy === 'true' };
      }
    }
    return { pinned: false, collapsed: true };
  };

  const initialSidebar = getInitialSidebarState();
  const [pinned, setPinned] = useState(initialSidebar.pinned);
  const [collapsed, setCollapsed] = useState(initialSidebar.collapsed);
  const [isPeeking, setIsPeeking] = useState(false);

  // Refs for timeout management
  const expandTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const collapseTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isHoveringRef = useRef(false);

  // Sidebar is expanded if pinned open OR peeking
  const isExpanded = pinned || isPeeking || !collapsed;

  const clearTimeouts = useCallback(() => {
    if (expandTimeoutRef.current) {
      clearTimeout(expandTimeoutRef.current);
      expandTimeoutRef.current = null;
    }
    if (collapseTimeoutRef.current) {
      clearTimeout(collapseTimeoutRef.current);
      collapseTimeoutRef.current = null;
    }
  }, []);

  // Project-First architecture state
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(
    entityContext?.type === 'project' ? entityContext.params.id : null
  );
  const [showCreateWizard, setShowCreateWizard] = useState(false);
  const [creatingQuoteForProjectId, setCreatingQuoteForProjectId] = useState<string | null>(null);
  // Track quote being edited/viewed within project context
  const [editingQuoteId, setEditingQuoteId] = useState<string | null>(null);
  const [quoteViewMode, setQuoteViewMode] = useState<'create' | 'edit' | 'view'>('create');

  // Fetch project data for quote context
  const { data: projectForQuote } = useProjectFull(
    (creatingQuoteForProjectId || editingQuoteId) && selectedProjectId ? selectedProjectId : undefined
  );

  // Fetch quote data for display label when editing
  const { data: editingQuoteData } = useQuote(editingQuoteId || undefined);

  // Update view when entity context changes
  useEffect(() => {
    if (entityContext && ENTITY_TO_VIEW[entityContext.type]) {
      setActiveView(ENTITY_TO_VIEW[entityContext.type]);
      // Also set project ID if navigating to a project
      if (entityContext.type === 'project') {
        setSelectedProjectId(entityContext.params.id);
      } else {
        // Clear project ID when navigating to a different entity type
        setSelectedProjectId(null);
      }
    } else if (!entityContext) {
      // Clear project ID when entity context is removed (navigating to list)
      setSelectedProjectId(null);
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
      navigateTo(activeView === 'projects' ? 'projects-hub' :
                 activeView === 'requests' ? 'requests' :
                 activeView === 'quotes' ? 'quotes' :
                 activeView === 'jobs' ? 'jobs' :
                 activeView === 'invoices' ? 'invoices' : 'projects-hub');
    }
  }, [externalClearEntity, navigateTo, activeView]);

  // Persist sidebar state to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ pinned, collapsed }));
  }, [pinned, collapsed]);

  const handleSidebarMouseEnter = useCallback(() => {
    isHoveringRef.current = true;
    clearTimeouts();

    // Only peek if collapsed and not pinned
    if (collapsed && !pinned) {
      expandTimeoutRef.current = setTimeout(() => {
        if (isHoveringRef.current) {
          setIsPeeking(true);
        }
      }, EXPAND_DELAY);
    }
  }, [collapsed, pinned, clearTimeouts]);

  const handleSidebarMouseLeave = useCallback(() => {
    isHoveringRef.current = false;
    clearTimeouts();

    // Only collapse if peeking (not pinned open)
    if (isPeeking) {
      collapseTimeoutRef.current = setTimeout(() => {
        if (!isHoveringRef.current) {
          setIsPeeking(false);
        }
      }, COLLAPSE_DELAY);
    }
  }, [isPeeking, clearTimeouts]);

  const handleTogglePin = useCallback(() => {
    clearTimeouts();
    if (pinned) {
      // Unpin - go to collapsed state
      setPinned(false);
      setCollapsed(true);
      setIsPeeking(false);
    } else {
      // Pin open
      setPinned(true);
      setCollapsed(false);
      setIsPeeking(false);
    }
  }, [pinned, clearTimeouts]);

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

      case 'projects':
        // Show QuoteCard if creating/editing/viewing a quote within project context
        if ((creatingQuoteForProjectId || editingQuoteId) && projectForQuote) {
          // Get quote label for header
          const quoteLabel = editingQuoteId && editingQuoteData
            ? `Quote #${editingQuoteData.quote_number || editingQuoteId.slice(0, 8)}`
            : 'New Quote';

          return (
            <div className="h-full flex flex-col">
              {/* Persistent Project Context Header */}
              <ProjectContextHeader
                project={projectForQuote}
                onBack={() => {
                  setCreatingQuoteForProjectId(null);
                  setEditingQuoteId(null);
                  setQuoteViewMode('create');
                }}
                childEntityType="quote"
                childEntityLabel={quoteLabel}
              />
              {/* QuoteCard without its own back button / client section */}
              <div className="flex-1 overflow-auto">
                <QuoteCard
                  mode={quoteViewMode}
                  projectId={selectedProjectId || undefined}
                  clientId={projectForQuote.client_id || undefined}
                  communityId={projectForQuote.community_id || undefined}
                  propertyId={projectForQuote.property_id || undefined}
                  quoteId={editingQuoteId || undefined}
                  onBack={undefined} // Header handles back navigation
                  onSave={() => {
                    setCreatingQuoteForProjectId(null);
                    setEditingQuoteId(null);
                    setQuoteViewMode('create');
                    // Project queries auto-refresh via React Query
                  }}
                  onConvertToJob={(quoteId) => {
                    // Navigate to work tab after conversion
                    setCreatingQuoteForProjectId(null);
                    setEditingQuoteId(null);
                    setQuoteViewMode('create');
                    console.log('Quote converted to job:', quoteId);
                  }}
                />
              </div>
            </div>
          );
        }

        // Show create wizard if triggered
        if (showCreateWizard) {
          return (
            <ProjectCreateWizard
              isOpen={true}
              onComplete={(result: ProjectWizardResult) => {
                setShowCreateWizard(false);
                setSelectedProjectId(result.projectId);
                handleNavigateToEntity('project', { id: result.projectId });
              }}
              onClose={() => setShowCreateWizard(false)}
            />
          );
        }

        // Show project detail if selected AND URL contains the project ID (defensive check)
        // This ensures UI stays in sync with URL even during async state updates
        // We use window.location.pathname because React Router state may lag behind
        const urlHasProjectId = window.location.pathname.includes(`/projects/${selectedProjectId}`);
        if (selectedProjectId && urlHasProjectId) {
          return (
            <ProjectPage
              projectId={selectedProjectId}
              onBack={() => {
                // Force navigation using window.location to ensure state reset
                window.location.href = '/projects';
              }}
              onNavigateToQuote={(quoteId) => {
                // Open quote in QuoteCard within project context (edit mode)
                setEditingQuoteId(quoteId);
                setQuoteViewMode('edit');
              }}
              onNavigateToJob={(jobId) =>
                handleNavigateToEntity('job', { id: jobId })
              }
              onNavigateToInvoice={(invoiceId) =>
                handleNavigateToEntity('invoice', { id: invoiceId })
              }
              onCreateQuote={() => {
                setCreatingQuoteForProjectId(selectedProjectId);
              }}
              onCreateJob={() => {
                // TODO: Navigate to job creation with project context
              }}
            />
          );
        }

        // Show projects list
        return (
          <ProjectsListView
            onSelectProject={(projectId) => {
              setSelectedProjectId(projectId);
              handleNavigateToEntity('project', { id: projectId });
            }}
            onCreateProject={() => setShowCreateWizard(true)}
          />
        );

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
      <div
        className={`${isExpanded ? 'w-56' : 'w-14'} bg-gradient-to-b from-blue-800 to-indigo-900 text-white flex flex-col transition-all duration-300`}
        onMouseEnter={handleSidebarMouseEnter}
        onMouseLeave={handleSidebarMouseLeave}
      >
        {/* Header */}
        <div className="p-3 border-b border-blue-700">
          <div className={`flex items-center ${!isExpanded ? 'justify-center' : 'justify-between'}`}>
            {isExpanded && (
              <h1 className="text-lg font-bold flex items-center gap-2">
                <Briefcase className="w-5 h-5" />
                Projects Hub
              </h1>
            )}
            <button
              onClick={handleTogglePin}
              className={`p-1.5 rounded transition-colors ${pinned ? 'text-blue-300 hover:text-white' : 'text-blue-200 hover:text-white hover:bg-white/10'}`}
              title={pinned ? 'Unpin sidebar' : 'Pin sidebar open'}
            >
              {pinned ? <Pin className="w-4 h-4" /> : <PinOff className="w-4 h-4" />}
            </button>
          </div>
          {isExpanded && <p className="text-xs text-blue-200 mt-1">Manage the full job lifecycle</p>}
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-2 space-y-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeView === item.key;
            return (
              <SidebarTooltip key={item.key} label={item.label} showTooltip={!isExpanded}>
                <button
                  onClick={() => {
                    // Clear project selection when navigating via sidebar
                    setSelectedProjectId(null);
                    setCreatingQuoteForProjectId(null);
                    setEditingQuoteId(null);
                    setQuoteViewMode('create');
                    setShowCreateWizard(false);
                    // Navigate to the appropriate route (clears URL params)
                    const route = item.key === 'dashboard' ? 'projects-hub' :
                                  item.key === 'projects' ? 'projects-hub' :
                                  item.key === 'requests' ? 'requests' :
                                  item.key === 'quotes' ? 'quotes' :
                                  item.key === 'jobs' ? 'jobs' :
                                  item.key === 'invoices' ? 'invoices' : 'projects-hub';
                    navigateTo(route);
                    setActiveView(item.key);
                  }}
                  className={`w-full flex items-center ${!isExpanded ? 'justify-center' : 'gap-3'} px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-white/20 text-white shadow-lg'
                      : item.comingSoon
                      ? 'text-blue-300/60 hover:bg-white/5'
                      : 'text-blue-100 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  {isExpanded && (
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
