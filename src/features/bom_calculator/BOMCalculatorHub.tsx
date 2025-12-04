import { useState, lazy, Suspense } from 'react';
import { Monitor } from 'lucide-react';
import { HubLayout, type BOMHubPage } from './components/layout';
import { BOMCalculator } from './BOMCalculator';
import MaterialsPage from './pages/MaterialsPage';
import LaborRatesPage from './pages/LaborRatesPage';
import ProjectsPage from './pages/ProjectsPage';
import SKUBuilderPage from './pages/SKUBuilderPage';
import SKUCatalogPage from './pages/SKUCatalogPage';

// Lazy load Hub v2 for code splitting
const BOMCalculatorHub2 = lazy(() => import('../bom_calculator_v2').then(m => ({ default: m.BOMCalculatorHub2 })));

interface BOMCalculatorHubProps {
  onBack: () => void;
  userRole: 'operations' | 'admin';
  userId?: string;
  userName?: string;
}

// SKU selection for navigation between Catalog and Builder
export interface SelectedSKU {
  id: string;
  type: 'wood-vertical' | 'wood-horizontal' | 'iron';
  skuCode: string;
}

// Check if screen is desktop size
const useIsDesktop = () => {
  return typeof window !== 'undefined' && window.innerWidth >= 1024;
};

// Project to open in calculator
export interface ProjectToOpen {
  id: string;
  mode: 'edit' | 'duplicate';
}

export default function BOMCalculatorHub({ onBack, userRole, userId, userName }: BOMCalculatorHubProps) {
  const [activePage, setActivePage] = useState<BOMHubPage>('calculator');
  const [selectedSKU, setSelectedSKU] = useState<SelectedSKU | null>(null);
  const [projectToOpen, setProjectToOpen] = useState<ProjectToOpen | null>(null);
  const [showV2, setShowV2] = useState(false);
  const isDesktop = useIsDesktop();
  const isAdmin = userRole === 'admin';

  // Navigate to SKU Builder with a selected SKU
  const handleEditSKU = (sku: SelectedSKU) => {
    setSelectedSKU(sku);
    setActivePage('sku-builder');
  };

  // Navigate to calculator with a project to edit/duplicate
  const handleOpenProject = (projectId: string, mode: 'edit' | 'duplicate') => {
    setProjectToOpen({ id: projectId, mode });
    setActivePage('calculator');
  };

  // Clear selected SKU when leaving SKU Builder
  const handlePageChange = (page: BOMHubPage) => {
    if (page !== 'sku-builder') {
      setSelectedSKU(null);
    }
    // Clear project when navigating away from calculator
    if (page !== 'calculator') {
      setProjectToOpen(null);
    }
    setActivePage(page);
  };

  // Desktop-only check
  if (!isDesktop) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 text-center">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <Monitor className="w-10 h-10 text-green-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-3">Desktop Required</h1>
          <p className="text-gray-600 mb-6">
            The BOM Calculator is optimized for desktop use and requires a larger screen to function properly.
          </p>
          <p className="text-sm text-gray-500">
            Please access this feature from a desktop or laptop computer.
          </p>
          <button
            onClick={onBack}
            className="mt-6 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  // Show Hub v2 Beta (admin only)
  if (showV2 && isAdmin) {
    return (
      <Suspense fallback={
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <div className="text-gray-600">Loading Hub v2...</div>
          </div>
        </div>
      }>
        <BOMCalculatorHub2
          onBack={() => setShowV2(false)}
          userRole={userRole}
          userId={userId}
          userName={userName}
        />
      </Suspense>
    );
  }

  // Render page content based on activePage
  const renderContent = () => {
    switch (activePage) {
      case 'calculator':
        return (
          <BOMCalculator
            onBack={onBack}
            userRole={userRole}
            userId={userId}
            userName={userName}
            hideHeader={true}
            initialProjectId={projectToOpen?.id}
            duplicateMode={projectToOpen?.mode === 'duplicate'}
          />
        );

      case 'materials':
        if (!isAdmin) {
          return <AccessDenied onGoBack={() => handlePageChange('calculator')} />;
        }
        return <MaterialsPage />;

      case 'labor-rates':
        if (!isAdmin) {
          return <AccessDenied onGoBack={() => handlePageChange('calculator')} />;
        }
        return <LaborRatesPage />;

      case 'projects':
        return (
          <ProjectsPage
            onEditProject={(projectId) => handleOpenProject(projectId, 'edit')}
            onDuplicateProject={(projectId) => handleOpenProject(projectId, 'duplicate')}
          />
        );

      case 'sku-builder':
        if (!isAdmin) {
          return <AccessDenied onGoBack={() => handlePageChange('calculator')} />;
        }
        return (
          <SKUBuilderPage
            selectedSKU={selectedSKU}
            onClearSelection={() => setSelectedSKU(null)}
          />
        );

      case 'sku-catalog':
        return (
          <SKUCatalogPage
            onEditSKU={handleEditSKU}
            isAdmin={isAdmin}
          />
        );

      default:
        return null;
    }
  };

  return (
    <HubLayout
      activePage={activePage}
      onPageChange={handlePageChange}
      onBack={onBack}
      isAdmin={isAdmin}
      onOpenV2={() => setShowV2(true)}
    >
      {renderContent()}
    </HubLayout>
  );
}

// Access Denied component
function AccessDenied({ onGoBack }: { onGoBack: () => void }) {
  return (
    <div className="flex-1 flex items-center justify-center bg-gray-50">
      <div className="text-center p-12">
        <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <span className="text-4xl">🔒</span>
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-3">Access Denied</h2>
        <p className="text-gray-600 mb-6">
          Admin privileges are required to access this page.
        </p>
        <button
          onClick={onGoBack}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Go to Calculator
        </button>
      </div>
    </div>
  );
}
