import { useState, useEffect } from 'react';
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

const STORAGE_KEY = 'sidebar-collapsed-projects-hub';

const NAV_ITEMS: { key: ProjectsHubView; label: string; icon: typeof LayoutDashboard; comingSoon?: boolean }[] = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { key: 'requests', label: 'Requests', icon: ClipboardList },
  { key: 'quotes', label: 'Quotes', icon: FileText },
  { key: 'jobs', label: 'Jobs', icon: Hammer },
  { key: 'invoices', label: 'Invoices', icon: Receipt },
  { key: 'payments', label: 'Payments', icon: CreditCard, comingSoon: true },
];

interface ProjectsHubProps {
  onBack?: () => void;
  initialView?: ProjectsHubView;
}

export default function ProjectsHub({ onBack: _onBack, initialView = 'dashboard' }: ProjectsHubProps) {
  const [activeView, setActiveView] = useState<ProjectsHubView>(initialView);
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false;
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === 'true';
  });

  // Persist collapsed state
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, String(collapsed));
  }, [collapsed]);

  const renderContent = () => {
    switch (activeView) {
      case 'dashboard':
        return <ProjectsDashboard onNavigate={setActiveView} />;
      case 'requests':
        return <RequestsHub />;
      case 'quotes':
        return <QuotesHub />;
      case 'jobs':
        return <JobsHub />;
      case 'invoices':
        return <InvoicesHub />;
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
