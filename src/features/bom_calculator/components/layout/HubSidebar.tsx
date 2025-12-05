import {
  Calculator,
  FolderOpen,
  Wrench,
  Sliders,
  Package,
  Boxes,
  DollarSign,
  ArrowLeft,
  ChevronRight,
  PanelLeftClose,
  FlaskConical
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export type BOMHubPage = 'calculator' | 'projects' | 'sku-builder' | 'custom-builder' | 'sku-catalog' | 'materials' | 'labor-rates';

interface NavItem {
  id: BOMHubPage;
  label: string;
  icon: LucideIcon;
  adminOnly?: boolean;
  comingSoon?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'calculator', label: 'Calculator', icon: Calculator },
  { id: 'projects', label: 'Projects', icon: FolderOpen },
  { id: 'sku-builder', label: 'SKU Builder', icon: Wrench },
  { id: 'custom-builder', label: 'Custom Builder', icon: Sliders },
  { id: 'sku-catalog', label: 'SKU Catalog', icon: Package },
];

const ADMIN_NAV_ITEMS: NavItem[] = [
  { id: 'materials', label: 'Materials', icon: Boxes, adminOnly: true },
  { id: 'labor-rates', label: 'Labor Rates', icon: DollarSign, adminOnly: true },
];

interface HubSidebarProps {
  activePage: BOMHubPage;
  onPageChange: (page: BOMHubPage) => void;
  onBack: () => void;
  isAdmin: boolean;
  onCollapse?: () => void;
  onOpenV2?: () => void;
}

export default function HubSidebar({ activePage, onPageChange, onBack, isAdmin, onCollapse, onOpenV2 }: HubSidebarProps) {
  const renderNavItem = (item: NavItem) => {
    const Icon = item.icon;
    const isActive = activePage === item.id;

    return (
      <button
        key={item.id}
        onClick={() => onPageChange(item.id)}
        className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg transition-colors text-left text-sm ${
          isActive
            ? 'bg-white text-blue-900 shadow-sm'
            : 'text-blue-100 hover:bg-blue-800/50'
        }`}
      >
        <Icon className={`w-4 h-4 ${isActive ? 'text-blue-600' : ''}`} />
        <span className="flex-1 font-medium truncate">{item.label}</span>
        {isActive && <ChevronRight className="w-3 h-3 text-blue-600 flex-shrink-0" />}
      </button>
    );
  };

  return (
    <div className="w-48 bg-[#1E3A8A] flex flex-col h-full">
      {/* Header */}
      <div className="px-3 py-3 border-b border-blue-800">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-white/10 rounded-lg flex items-center justify-center">
            <Calculator className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1">
            <h2 className="text-sm font-bold text-white">BOM Hub</h2>
          </div>
          {onCollapse && (
            <button
              onClick={onCollapse}
              className="p-1 text-blue-200 hover:text-white hover:bg-blue-800/50 rounded transition-colors"
              title="Collapse sidebar"
            >
              <PanelLeftClose className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Main Navigation */}
      <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
        {NAV_ITEMS.map(renderNavItem)}

        {/* Admin Section Divider */}
        {isAdmin && (
          <>
            <div className="my-2 border-t border-blue-700" />
            <div className="px-3 pb-1">
              <span className="text-[10px] font-semibold text-blue-300 uppercase tracking-wider">
                Admin
              </span>
            </div>
            {ADMIN_NAV_ITEMS.map(renderNavItem)}

            {/* v2 Beta Button */}
            {onOpenV2 && (
              <button
                onClick={onOpenV2}
                className="w-full flex items-center gap-2 px-3 py-2 mt-2 rounded-lg bg-purple-600/20 text-purple-200 hover:bg-purple-600/30 transition-colors text-left text-sm border border-purple-500/30"
              >
                <FlaskConical className="w-4 h-4" />
                <span className="flex-1 font-medium truncate">Try v2 Beta</span>
                <span className="px-1.5 py-0.5 text-[10px] bg-purple-500/40 text-purple-100 rounded">
                  NEW
                </span>
              </button>
            )}
          </>
        )}
      </div>

      {/* Back to Main App */}
      <div className="p-2 border-t border-blue-800">
        <button
          onClick={onBack}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-blue-200 hover:bg-blue-800/50 transition-colors text-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="font-medium">Back</span>
        </button>
      </div>
    </div>
  );
}
