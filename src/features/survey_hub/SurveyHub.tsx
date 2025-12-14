import { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  FileText,
  Users,
  Calendar,
  BarChart3,
  Plus,
  ChevronRight,
  PanelLeftClose,
  PanelLeft,
} from 'lucide-react';
import type { SurveyHubView } from './types';
import SurveysDashboard from './components/SurveysDashboard';
import SurveysList from './components/SurveysList';
import PopulationsList from './components/PopulationsList';
import CampaignsList from './components/CampaignsList';
import AnalyticsDashboard from './components/AnalyticsDashboard';
import { SidebarTooltip } from '../../components/sidebar';

const STORAGE_KEY = 'sidebar-collapsed-survey-hub';

const NAV_ITEMS: { key: SurveyHubView; label: string; icon: typeof LayoutDashboard }[] = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { key: 'surveys', label: 'Surveys', icon: FileText },
  { key: 'populations', label: 'Populations', icon: Users },
  { key: 'campaigns', label: 'Campaigns', icon: Calendar },
  { key: 'analytics', label: 'Analytics', icon: BarChart3 },
];

interface SurveyHubProps {
  onBack?: () => void;
}

export default function SurveyHub({ onBack: _onBack }: SurveyHubProps) {
  const [activeView, setActiveView] = useState<SurveyHubView>('dashboard');
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
        return <SurveysDashboard onNavigate={setActiveView} />;
      case 'surveys':
        return <SurveysList />;
      case 'populations':
        return <PopulationsList />;
      case 'campaigns':
        return <CampaignsList />;
      case 'analytics':
        return <AnalyticsDashboard />;
      default:
        return <SurveysDashboard onNavigate={setActiveView} />;
    }
  };

  return (
    <div className="flex h-full">
      {/* Sidebar */}
      <div className={`${collapsed ? 'w-14' : 'w-56'} bg-gradient-to-b from-emerald-800 to-teal-900 text-white flex flex-col transition-all duration-300`}>
        {/* Header */}
        <div className="p-3 border-b border-emerald-700">
          <div className={`flex items-center ${collapsed ? 'justify-center' : 'justify-between'}`}>
            {!collapsed && (
              <h1 className="text-lg font-bold flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Survey Hub
              </h1>
            )}
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="p-1.5 text-emerald-200 hover:text-white hover:bg-white/10 rounded transition-colors"
              title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {collapsed ? <PanelLeft className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
            </button>
          </div>
          {!collapsed && <p className="text-xs text-emerald-200 mt-1">Customer Feedback System</p>}
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
                      : 'text-emerald-100 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  {!collapsed && (
                    <>
                      {item.label}
                      {isActive && <ChevronRight className="w-4 h-4 ml-auto" />}
                    </>
                  )}
                </button>
              </SidebarTooltip>
            );
          })}
        </nav>

        {/* Quick Actions */}
        <div className="p-2 border-t border-emerald-700 space-y-2">
          <SidebarTooltip label="New Survey" showTooltip={collapsed}>
            <button
              onClick={() => setActiveView('surveys')}
              className={`w-full flex items-center ${collapsed ? 'justify-center' : 'justify-center gap-2'} px-3 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-sm font-medium transition-colors`}
            >
              <Plus className="w-4 h-4 flex-shrink-0" />
              {!collapsed && 'New Survey'}
            </button>
          </SidebarTooltip>
          <SidebarTooltip label="New Campaign" showTooltip={collapsed}>
            <button
              onClick={() => setActiveView('campaigns')}
              className={`w-full flex items-center ${collapsed ? 'justify-center' : 'justify-center gap-2'} px-3 py-2 bg-teal-600 hover:bg-teal-500 rounded-lg text-sm font-medium transition-colors`}
            >
              <Calendar className="w-4 h-4 flex-shrink-0" />
              {!collapsed && 'New Campaign'}
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
