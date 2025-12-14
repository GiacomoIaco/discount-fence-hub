/**
 * BOM Calculator Hub v2
 *
 * O-026: Formula-based BOM Calculator
 * Uses database-stored formulas instead of hardcoded FenceCalculator.ts
 *
 * Pages:
 * - SKU Catalog (V2) - reads from sku_catalog_v2
 * - SKU Builder (V2) - saves to sku_catalog_v2
 * - Calculator (V2) - uses FormulaInterpreter
 * - Materials (shared from V1)
 * - Labor Rates (shared from V1)
 * - Components (shared from V1)
 */

import { useState, useEffect } from 'react';
import { Monitor, ArrowLeft, FlaskConical, Package, DollarSign, Wrench, Settings, PanelLeft, PanelLeftClose } from 'lucide-react';
import { SKUCatalogPage, SKUBuilderPage, CalculatorPage, ComponentTypesPage, ProductTypeManagerPage } from './pages';
// Shared pages from V1
import MaterialsPage from '../bom_calculator/pages/MaterialsPage';
import LaborRatesPage from '../bom_calculator/pages/LaborRatesPage';
import { SidebarTooltip } from '../../components/sidebar';

// Page types for navigation
type Hub2Page = 'sku-catalog' | 'sku-builder' | 'calculator' | 'materials' | 'labor-rates' | 'components' | 'product-manager';

const STORAGE_KEY = 'sidebar-collapsed-bom-hub-v2';

interface BOMCalculatorHub2Props {
  onBack: () => void;
  userRole: 'operations' | 'admin';
  userId?: string;      // Will be used for project ownership
  userName?: string;    // Will be used for display/audit
}

// Check if screen is desktop size
const useIsDesktop = () => {
  return typeof window !== 'undefined' && window.innerWidth >= 1024;
};

export default function BOMCalculatorHub2({ onBack, userRole, userId, userName: _userName }: BOMCalculatorHub2Props) {
  const [activePage, setActivePage] = useState<Hub2Page>('calculator');
  const [editingSKUId, setEditingSKUId] = useState<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false;
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === 'true';
  });
  const isDesktop = useIsDesktop();
  const isAdmin = userRole === 'admin';

  // Persist collapsed state
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, String(sidebarCollapsed));
  }, [sidebarCollapsed]);

  // Auto-collapse sidebar when entering Product Types page (needs full width)
  useEffect(() => {
    if (activePage === 'product-manager') {
      setSidebarCollapsed(true);
    }
  }, [activePage]);

  // Desktop-only check
  if (!isDesktop) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 text-center">
          <div className="w-20 h-20 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <Monitor className="w-10 h-10 text-purple-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-3">Desktop Required</h1>
          <p className="text-gray-600 mb-6">
            The BOM Calculator v2 is optimized for desktop use and requires a larger screen.
          </p>
          <button
            onClick={onBack}
            className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  // Render page content
  const renderContent = () => {
    switch (activePage) {
      case 'calculator':
        return (
          <CalculatorPage
            userId={userId}
            onProjectSaved={(projectId) => {
              console.log('Project saved:', projectId);
            }}
          />
        );

      case 'sku-catalog':
        return (
          <SKUCatalogPage
            isAdmin={isAdmin}
            onEditSKU={(skuId) => {
              setEditingSKUId(skuId);
              setActivePage('sku-builder');
            }}
          />
        );

      case 'sku-builder':
        return (
          <SKUBuilderPage
            editingSKUId={editingSKUId}
            onClearSelection={() => setEditingSKUId(null)}
            isAdmin={isAdmin}
          />
        );

      case 'materials':
        return <MaterialsPage />;

      case 'labor-rates':
        return <LaborRatesPage />;

      case 'components':
        return <ComponentTypesPage />;

      case 'product-manager':
        return <ProductTypeManagerPage />;

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex">
      {/* Sidebar - Always visible, collapses to icon-only */}
      <div className={`${sidebarCollapsed ? 'w-14' : 'w-64'} bg-white border-r border-gray-200 flex flex-col transition-all duration-300`}>
        {/* Header */}
        <div className="p-3 border-b border-gray-200">
          <div className={`flex items-center ${sidebarCollapsed ? 'justify-center' : 'justify-between'}`}>
            {!sidebarCollapsed && (
              <div className="flex items-center gap-2">
                <FlaskConical className="w-6 h-6 text-purple-600" />
                <h1 className="text-lg font-bold text-gray-900">BOM Calculator</h1>
                <span className="px-2 py-0.5 text-xs font-medium bg-purple-100 text-purple-700 rounded-full">
                  v2
                </span>
              </div>
            )}
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
              title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {sidebarCollapsed ? <PanelLeft className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
            </button>
          </div>
          {!sidebarCollapsed && <p className="text-xs text-gray-500 mt-1">Smart Hybrid Architecture</p>}
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
          <NavItemWithTooltip
            label="Calculator"
            icon={<FlaskConical className="w-4 h-4" />}
            isActive={activePage === 'calculator'}
            onClick={() => setActivePage('calculator')}
            collapsed={sidebarCollapsed}
          />

          <div className={`pt-3 border-t border-gray-200 mt-3 ${sidebarCollapsed ? '' : ''}`}>
            {!sidebarCollapsed && (
              <p className="px-3 py-1 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                SKU Management
              </p>
            )}
            {sidebarCollapsed && (
              <SidebarTooltip label="SKU Management" showTooltip={true}>
                <div className="flex justify-center py-1">
                  <Package className="w-3 h-3 text-gray-400" />
                </div>
              </SidebarTooltip>
            )}
            <NavItemWithTooltip
              label="SKU Catalog"
              icon={<Package className="w-4 h-4" />}
              isActive={activePage === 'sku-catalog'}
              onClick={() => setActivePage('sku-catalog')}
              collapsed={sidebarCollapsed}
            />
            <NavItemWithTooltip
              label="SKU Builder"
              icon={<Wrench className="w-4 h-4" />}
              isActive={activePage === 'sku-builder'}
              onClick={() => setActivePage('sku-builder')}
              badge={isAdmin ? undefined : 'Admin'}
              collapsed={sidebarCollapsed}
            />
          </div>

          <div className="pt-3 border-t border-gray-200 mt-3">
            {!sidebarCollapsed && (
              <p className="px-3 py-1 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                Configuration
              </p>
            )}
            {sidebarCollapsed && (
              <SidebarTooltip label="Configuration" showTooltip={true}>
                <div className="flex justify-center py-1">
                  <Settings className="w-3 h-3 text-gray-400" />
                </div>
              </SidebarTooltip>
            )}
            <NavItemWithTooltip
              label="Product Types"
              icon={<Settings className="w-4 h-4" />}
              isActive={activePage === 'product-manager'}
              onClick={() => setActivePage('product-manager')}
              badge={isAdmin ? undefined : 'Admin'}
              collapsed={sidebarCollapsed}
            />
          </div>

          <div className="pt-3 border-t border-gray-200 mt-3">
            {!sidebarCollapsed && (
              <p className="px-3 py-1 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                Shared Data
              </p>
            )}
            {sidebarCollapsed && (
              <SidebarTooltip label="Shared Data" showTooltip={true}>
                <div className="flex justify-center py-1">
                  <Package className="w-3 h-3 text-gray-400" />
                </div>
              </SidebarTooltip>
            )}
            <NavItemWithTooltip
              label="Materials"
              icon={<Package className="w-4 h-4" />}
              isActive={activePage === 'materials'}
              onClick={() => setActivePage('materials')}
              collapsed={sidebarCollapsed}
            />
            <NavItemWithTooltip
              label="Labor Rates"
              icon={<DollarSign className="w-4 h-4" />}
              isActive={activePage === 'labor-rates'}
              onClick={() => setActivePage('labor-rates')}
              collapsed={sidebarCollapsed}
            />
          </div>
        </nav>

        {/* Footer */}
        <div className="p-2 border-t border-gray-200">
          <SidebarTooltip label="Back to Hub v1" showTooltip={sidebarCollapsed}>
            <button
              onClick={onBack}
              className={`flex items-center ${sidebarCollapsed ? 'justify-center' : 'gap-2'} w-full px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors`}
            >
              <ArrowLeft className="w-4 h-4 flex-shrink-0" />
              {!sidebarCollapsed && 'Back to Hub v1'}
            </button>
          </SidebarTooltip>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        {renderContent()}
      </div>
    </div>
  );
}

// Navigation item with tooltip support
function NavItemWithTooltip({
  label,
  icon,
  isActive,
  onClick,
  badge,
  collapsed,
}: {
  label: string;
  icon?: React.ReactNode;
  isActive: boolean;
  onClick: () => void;
  badge?: string;
  collapsed: boolean;
}) {
  return (
    <SidebarTooltip label={label} showTooltip={collapsed}>
      <button
        onClick={onClick}
        className={`w-full flex items-center ${collapsed ? 'justify-center' : 'justify-between'} px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
          isActive
            ? 'bg-purple-100 text-purple-700'
            : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
        }`}
      >
        <span className={`flex items-center ${collapsed ? '' : 'gap-2'}`}>
          {icon}
          {!collapsed && label}
        </span>
        {!collapsed && badge && (
          <span className="px-2 py-0.5 text-xs bg-gray-200 text-gray-600 rounded">
            {badge}
          </span>
        )}
      </button>
    </SidebarTooltip>
  );
}

