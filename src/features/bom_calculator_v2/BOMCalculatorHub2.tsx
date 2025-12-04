/**
 * BOM Calculator Hub v2
 *
 * Entry point for the new Smart Hybrid BOM Calculator.
 * Provides navigation between different sections:
 * - Product Types (admin)
 * - SKU Builder
 * - SKU Catalog
 * - Calculator
 * - Projects
 */

import { useState } from 'react';
import { Monitor, ArrowLeft, FlaskConical } from 'lucide-react';
import { ProductTypesPage, SKUCatalogPage, SKUBuilderPage, CalculatorPage, ProjectsPage } from './pages';

// Page types for navigation
type Hub2Page = 'product-types' | 'sku-builder' | 'sku-catalog' | 'calculator' | 'projects';

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
  const [activePage, setActivePage] = useState<Hub2Page>('product-types');
  const [editingSKUId, setEditingSKUId] = useState<string | null>(null);
  const isDesktop = useIsDesktop();
  const isAdmin = userRole === 'admin';

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
      case 'product-types':
        return <ProductTypesPage />;

      case 'sku-builder':
        return (
          <SKUBuilderPage
            editingSKUId={editingSKUId}
            onClearSelection={() => setEditingSKUId(null)}
            isAdmin={isAdmin}
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

      case 'calculator':
        return (
          <CalculatorPage
            userId={userId}
            onProjectSaved={(projectId) => {
              console.log('Project saved:', projectId);
            }}
          />
        );

      case 'projects':
        return (
          <ProjectsPage
            onEditProject={(projectId) => {
              // TODO: Load project into calculator
              console.log('Edit project:', projectId);
              setActivePage('calculator');
            }}
            onDuplicateProject={(projectId) => {
              // TODO: Duplicate project
              console.log('Duplicate project:', projectId);
            }}
          />
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex">
      {/* Sidebar */}
      <div className="w-64 bg-white border-r border-gray-200 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center gap-2 mb-2">
            <FlaskConical className="w-6 h-6 text-purple-600" />
            <h1 className="text-lg font-bold text-gray-900">BOM Calculator</h1>
            <span className="px-2 py-0.5 text-xs font-medium bg-purple-100 text-purple-700 rounded-full">
              v2 Beta
            </span>
          </div>
          <p className="text-xs text-gray-500">Smart Hybrid Architecture</p>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1">
          <NavItem
            label="Product Types"
            isActive={activePage === 'product-types'}
            onClick={() => setActivePage('product-types')}
            badge={isAdmin ? undefined : 'Admin'}
          />
          <NavItem
            label="SKU Builder"
            isActive={activePage === 'sku-builder'}
            onClick={() => setActivePage('sku-builder')}
            badge={isAdmin ? undefined : 'Admin'}
          />
          <NavItem
            label="SKU Catalog"
            isActive={activePage === 'sku-catalog'}
            onClick={() => setActivePage('sku-catalog')}
          />

          <div className="pt-4 border-t border-gray-200 mt-4">
            <NavItem
              label="Calculator"
              isActive={activePage === 'calculator'}
              onClick={() => setActivePage('calculator')}
            />
            <NavItem
              label="Projects"
              isActive={activePage === 'projects'}
              onClick={() => setActivePage('projects')}
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

      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        {renderContent()}
      </div>
    </div>
  );
}

// Navigation item component
function NavItem({
  label,
  isActive,
  onClick,
  badge,
}: {
  label: string;
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
      <span>{label}</span>
      {badge && (
        <span className="px-2 py-0.5 text-xs bg-gray-200 text-gray-600 rounded">
          {badge}
        </span>
      )}
    </button>
  );
}

