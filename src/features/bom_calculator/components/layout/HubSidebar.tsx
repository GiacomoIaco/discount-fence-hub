import {
  Calculator,
  FolderOpen,
  Wrench,
  Package,
  Boxes,
  DollarSign,
  ArrowLeft,
  ChevronRight
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export type BOMHubPage = 'calculator' | 'projects' | 'sku-builder' | 'sku-catalog' | 'materials' | 'labor-rates';

interface NavItem {
  id: BOMHubPage;
  label: string;
  icon: LucideIcon;
  adminOnly?: boolean;
  comingSoon?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'calculator', label: 'Calculator', icon: Calculator },
  { id: 'projects', label: 'Projects', icon: FolderOpen, comingSoon: true },
  { id: 'sku-builder', label: 'SKU Builder', icon: Wrench, comingSoon: true },
  { id: 'sku-catalog', label: 'SKU Catalog', icon: Package, comingSoon: true },
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
}

export default function HubSidebar({ activePage, onPageChange, onBack, isAdmin }: HubSidebarProps) {
  const renderNavItem = (item: NavItem) => {
    const Icon = item.icon;
    const isActive = activePage === item.id;

    return (
      <button
        key={item.id}
        onClick={() => onPageChange(item.id)}
        className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors text-left ${
          isActive
            ? 'bg-white text-blue-900 shadow-sm'
            : 'text-blue-100 hover:bg-blue-800/50'
        }`}
      >
        <Icon className={`w-5 h-5 ${isActive ? 'text-blue-600' : ''}`} />
        <span className="flex-1 font-medium">{item.label}</span>
        {item.comingSoon && !isActive && (
          <span className="text-xs bg-blue-800/50 px-2 py-0.5 rounded-full text-blue-200">
            Soon
          </span>
        )}
        {isActive && <ChevronRight className="w-4 h-4 text-blue-600" />}
      </button>
    );
  };

  return (
    <div className="w-64 bg-[#1E3A8A] flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-blue-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center">
            <Calculator className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="font-bold text-white">BOM Calculator</h2>
            <p className="text-xs text-blue-200">Bill of Materials</p>
          </div>
        </div>
      </div>

      {/* Main Navigation */}
      <div className="flex-1 overflow-y-auto p-3 space-y-1">
        {NAV_ITEMS.map(renderNavItem)}

        {/* Admin Section Divider */}
        {isAdmin && (
          <>
            <div className="my-4 border-t border-blue-700" />
            <div className="px-4 pb-2">
              <span className="text-xs font-semibold text-blue-300 uppercase tracking-wider">
                Admin
              </span>
            </div>
            {ADMIN_NAV_ITEMS.map(renderNavItem)}
          </>
        )}
      </div>

      {/* Back to Main App */}
      <div className="p-3 border-t border-blue-800">
        <button
          onClick={onBack}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-blue-200 hover:bg-blue-800/50 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          <span className="font-medium">Back to Main App</span>
        </button>
      </div>
    </div>
  );
}
