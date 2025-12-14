import { useState, lazy, Suspense } from 'react';
import {
  LayoutDashboard,
  Bot,
  BookOpen,
  Image,
  Calculator,
  FileText,
  ChevronRight,
  TrendingUp,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import type { SalesHubView } from './types';
import { SalesDashboard } from './components';

// Lazy load the actual sales tools to avoid circular dependencies
const SalesCoach = lazy(() => import('../ai-coach').then(m => ({ default: m.SalesCoach })));
const ClientPresentation = lazy(() => import('../sales-tools').then(m => ({ default: m.ClientPresentation })));
const PhotoGallery = lazy(() => import('../photos').then(m => ({ default: m.PhotoGalleryRefactored })));
const StainCalculator = lazy(() => import('../sales-tools').then(m => ({ default: m.StainCalculator })));
const SalesResources = lazy(() => import('../sales-resources').then(m => ({ default: m.SalesResources })));

type UserRole = 'sales' | 'operations' | 'sales-manager' | 'admin' | 'yard';

const LoadingFallback = () => (
  <div className="flex items-center justify-center min-h-[400px]">
    <div className="text-center">
      <div className="w-10 h-10 border-4 border-amber-600 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
      <div className="text-gray-500">Loading...</div>
    </div>
  </div>
);

const NAV_ITEMS: { key: SalesHubView; label: string; icon: typeof LayoutDashboard }[] = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { key: 'sales-coach', label: 'AI Sales Coach', icon: Bot },
  { key: 'presentation', label: 'Presentation', icon: BookOpen },
  { key: 'photo-gallery', label: 'Photo Gallery', icon: Image },
  { key: 'stain-calculator', label: 'Stain Calculator', icon: Calculator },
  { key: 'sales-resources', label: 'Resources', icon: FileText },
];

interface SalesHubProps {
  onBack?: () => void;
  initialView?: SalesHubView;
}

export default function SalesHub({ onBack: _onBack, initialView = 'dashboard' }: SalesHubProps) {
  const [activeView, setActiveView] = useState<SalesHubView>(initialView);
  const { user, profile } = useAuth();
  const userRole = (profile?.role || 'sales') as UserRole;

  const renderContent = () => {
    switch (activeView) {
      case 'dashboard':
        return <SalesDashboard onNavigate={setActiveView} />;
      case 'sales-coach':
        return (
          <Suspense fallback={<LoadingFallback />}>
            <SalesCoach userId={user?.id || 'unknown'} />
          </Suspense>
        );
      case 'presentation':
        return (
          <Suspense fallback={<LoadingFallback />}>
            <ClientPresentation onBack={() => setActiveView('dashboard')} isMobile={false} />
          </Suspense>
        );
      case 'photo-gallery':
        return (
          <Suspense fallback={<LoadingFallback />}>
            <PhotoGallery onBack={() => setActiveView('dashboard')} userRole={userRole} viewMode="desktop" />
          </Suspense>
        );
      case 'stain-calculator':
        return (
          <Suspense fallback={<LoadingFallback />}>
            <StainCalculator onBack={() => setActiveView('dashboard')} />
          </Suspense>
        );
      case 'sales-resources':
        return (
          <Suspense fallback={<LoadingFallback />}>
            <SalesResources onBack={() => setActiveView('dashboard')} userRole={userRole} />
          </Suspense>
        );
      default:
        return <SalesDashboard onNavigate={setActiveView} />;
    }
  };

  return (
    <div className="flex h-full">
      {/* Sidebar */}
      <div className="w-56 bg-gradient-to-b from-amber-700 to-orange-800 text-white flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-amber-600">
          <h1 className="text-lg font-bold flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Sales Hub
          </h1>
          <p className="text-xs text-amber-200 mt-1">Tools to close more deals</p>
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
                    : 'text-amber-100 hover:bg-white/10 hover:text-white'
                }`}
              >
                <Icon className="w-4 h-4" />
                {item.label}
                {isActive && <ChevronRight className="w-4 h-4 ml-auto" />}
              </button>
            );
          })}
        </nav>

        {/* Tips Section */}
        <div className="p-3 border-t border-amber-600">
          <div className="bg-amber-600/50 rounded-lg p-3">
            <p className="text-xs text-amber-100 font-medium mb-1">Pro Tip</p>
            <p className="text-xs text-amber-200">
              Use the AI Sales Coach before customer meetings to prepare objection responses.
            </p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 bg-gray-50 overflow-auto">
        {renderContent()}
      </div>
    </div>
  );
}
