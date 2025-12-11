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

// Page types for navigation
type Hub2Page = 'sku-catalog' | 'sku-builder' | 'calculator' | 'materials' | 'labor-rates' | 'components' | 'product-manager';

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
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const isDesktop = useIsDesktop();
  const isAdmin = userRole === 'admin';

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
      {/* Sidebar - Collapsible */}
      {!sidebarCollapsed && (
        <div className="w-64 bg-white border-r border-gray-200 flex flex-col">
          {/* Header */}
          <div className="p-4 border-b border-gray-200">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <FlaskConical className="w-6 h-6 text-purple-600" />
                <h1 className="text-lg font-bold text-gray-900">BOM Calculator</h1>
                <span className="px-2 py-0.5 text-xs font-medium bg-purple-100 text-purple-700 rounded-full">
                  v2 Beta
                </span>
              </div>
              <button
                onClick={() => setSidebarCollapsed(true)}
                className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
                title="Collapse sidebar"
              >
                <PanelLeftClose className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-gray-500">Smart Hybrid Architecture</p>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-1">
            <NavItem
              label="Calculator"
              icon={<FlaskConical className="w-4 h-4" />}
              isActive={activePage === 'calculator'}
              onClick={() => setActivePage('calculator')}
            />

            <div className="pt-4 border-t border-gray-200 mt-4">
              <p className="px-3 py-1 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                SKU Management
              </p>
              <NavItem
                label="SKU Catalog"
                icon={<Package className="w-4 h-4" />}
                isActive={activePage === 'sku-catalog'}
                onClick={() => setActivePage('sku-catalog')}
              />
              <NavItem
                label="SKU Builder"
                icon={<Wrench className="w-4 h-4" />}
                isActive={activePage === 'sku-builder'}
                onClick={() => setActivePage('sku-builder')}
                badge={isAdmin ? undefined : 'Admin'}
              />
            </div>

            <div className="pt-4 border-t border-gray-200 mt-4">
              <p className="px-3 py-1 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                Configuration
              </p>
              <NavItem
                label="Product Types"
                icon={<Settings className="w-4 h-4" />}
                isActive={activePage === 'product-manager'}
                onClick={() => setActivePage('product-manager')}
                badge={isAdmin ? undefined : 'Admin'}
              />
            </div>

            <div className="pt-4 border-t border-gray-200 mt-4">
              <p className="px-3 py-1 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                Shared Data (V1)
              </p>
              <NavItem
                label="Materials"
                icon={<Package className="w-4 h-4" />}
                isActive={activePage === 'materials'}
                onClick={() => setActivePage('materials')}
              />
              <NavItem
                label="Labor Rates"
                icon={<DollarSign className="w-4 h-4" />}
                isActive={activePage === 'labor-rates'}
                onClick={() => setActivePage('labor-rates')}
              />
              <NavItem
                label="Components"
                icon={<Wrench className="w-4 h-4" />}
                isActive={activePage === 'components'}
                onClick={() => setActivePage('components')}
              />
            </div>
          </nav>

          {/* Footer */}
          <div className="p-4 border-t border-gray-200">
            <button
              onClick={onBack}
              className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Hub v1
            </button>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 overflow-auto relative">
        {/* Expand sidebar button when collapsed */}
        {sidebarCollapsed && (
          <button
            onClick={() => setSidebarCollapsed(false)}
            className="absolute top-2 left-2 z-10 p-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 shadow-lg transition-colors"
            title="Expand sidebar"
          >
            <PanelLeft className="w-4 h-4" />
          </button>
        )}
        {renderContent()}
      </div>
    </div>
  );
}

// Navigation item component
function NavItem({
  label,
  icon,
  isActive,
  onClick,
  badge,
}: {
  label: string;
  icon?: React.ReactNode;
  isActive: boolean;
  onClick: () => void;
  badge?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
        isActive
          ? 'bg-purple-100 text-purple-700'
          : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
      }`}
    >
      <span className="flex items-center gap-2">
        {icon}
        {label}
      </span>
      {badge && (
        <span className="px-2 py-0.5 text-xs bg-gray-200 text-gray-600 rounded">
          {badge}
        </span>
      )}
    </button>
  );
}

