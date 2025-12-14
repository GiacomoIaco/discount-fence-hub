import { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  ClipboardList,
  FileText,
  Hammer,
  Receipt,
  CreditCard,
  Plus,
  ChevronRight,
  Briefcase,
  PanelLeftClose,
  PanelLeft,
} from 'lucide-react';
import type { ProjectsHubView } from './types';
import { ProjectsDashboard, ComingSoonPlaceholder } from './components';
import { RequestsList } from '../fsm/components';
import { SidebarTooltip } from '../../components/sidebar';

const STORAGE_KEY = 'sidebar-collapsed-projects-hub';

const NAV_ITEMS: { key: ProjectsHubView; label: string; icon: typeof LayoutDashboard; comingSoon?: boolean }[] = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { key: 'requests', label: 'Requests', icon: ClipboardList },
  { key: 'quotes', label: 'Quotes', icon: FileText, comingSoon: true },
  { key: 'jobs', label: 'Jobs', icon: Hammer, comingSoon: true },
  { key: 'invoices', label: 'Invoices', icon: Receipt, comingSoon: true },
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
        return (
          <div className="p-6">
            <RequestsList />
          </div>
        );
      case 'quotes':
        return (
          <ComingSoonPlaceholder
            title="Quotes"
            description="Create and manage quotes for your customers. Convert approved quotes to jobs with one click."
            icon={FileText}
          />
        );
      case 'jobs':
        return (
          <ComingSoonPlaceholder
            title="Jobs"
            description="Schedule and track work orders. Assign crews, manage materials, and monitor job progress."
            icon={Hammer}
          />
        );
      case 'invoices':
        return (
          <ComingSoonPlaceholder
            title="Invoices"
            description="Generate invoices from completed jobs. Sync with QuickBooks and track payment status."
            icon={Receipt}
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

        {/* Quick Actions */}
        <div className="p-2 border-t border-blue-700">
          <SidebarTooltip label="New Request" showTooltip={collapsed}>
            <button
              onClick={() => setActiveView('requests')}
              className={`w-full flex items-center ${collapsed ? 'justify-center' : 'justify-center gap-2'} px-3 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium transition-colors`}
            >
              <Plus className="w-4 h-4 flex-shrink-0" />
              {!collapsed && 'New Request'}
            </button>
          </SidebarTooltip>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 bg-gray-50 overflow-auto">
        {renderContent()}
      </div>
    </div>
  );
}
