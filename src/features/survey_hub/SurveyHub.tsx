import { useState } from 'react';
import {
  LayoutDashboard,
  FileText,
  Users,
  Calendar,
  BarChart3,
  Plus,
  ChevronRight,
} from 'lucide-react';
import type { SurveyHubView } from './types';
import SurveysDashboard from './components/SurveysDashboard';
import SurveysList from './components/SurveysList';
import PopulationsList from './components/PopulationsList';
import CampaignsList from './components/CampaignsList';
import AnalyticsDashboard from './components/AnalyticsDashboard';

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
      <div className="w-56 bg-gradient-to-b from-emerald-800 to-teal-900 text-white flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-emerald-700">
          <h1 className="text-lg font-bold flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Survey Hub
          </h1>
          <p className="text-xs text-emerald-200 mt-1">Customer Feedback System</p>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-2 space-y-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeView === item.key;
            return (
              <button
                key={item.key}
                onClick={() => setActiveView(item.key)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-white/20 text-white shadow-lg'
                    : 'text-emerald-100 hover:bg-white/10 hover:text-white'
                }`}
              >
                <Icon className="w-4 h-4" />
                {item.label}
                {isActive && <ChevronRight className="w-4 h-4 ml-auto" />}
              </button>
            );
          })}
        </nav>

        {/* Quick Actions */}
        <div className="p-3 border-t border-emerald-700 space-y-2">
          <button
            onClick={() => setActiveView('surveys')}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Survey
          </button>
          <button
            onClick={() => setActiveView('campaigns')}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-teal-600 hover:bg-teal-500 rounded-lg text-sm font-medium transition-colors"
          >
            <Calendar className="w-4 h-4" />
            New Campaign
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 bg-gray-50 overflow-auto">
        {renderContent()}
      </div>
    </div>
  );
}
