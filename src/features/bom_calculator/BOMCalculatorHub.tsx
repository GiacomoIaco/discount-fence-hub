import { useState } from 'react';
import { Monitor } from 'lucide-react';
import { HubLayout, type BOMHubPage } from './components/layout';
import { BOMCalculator } from './BOMCalculator';
import MaterialsPage from './pages/MaterialsPage';
import LaborRatesPage from './pages/LaborRatesPage';

interface BOMCalculatorHubProps {
  onBack: () => void;
  userRole: 'operations' | 'admin';
  userId?: string;
  userName?: string;
}

// Check if screen is desktop size
const useIsDesktop = () => {
  return typeof window !== 'undefined' && window.innerWidth >= 1024;
};

export default function BOMCalculatorHub({ onBack, userRole, userId, userName }: BOMCalculatorHubProps) {
  const [activePage, setActivePage] = useState<BOMHubPage>('calculator');
  const isDesktop = useIsDesktop();
  const isAdmin = userRole === 'admin';

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
          />
        );

      case 'materials':
        if (!isAdmin) {
          return <AccessDenied onGoBack={() => setActivePage('calculator')} />;
        }
        return <MaterialsPage />;

      case 'labor-rates':
        if (!isAdmin) {
          return <AccessDenied onGoBack={() => setActivePage('calculator')} />;
        }
        return <LaborRatesPage />;

      case 'projects':
      case 'sku-builder':
      case 'sku-catalog':
        return <ComingSoon page={activePage} />;

      default:
        return null;
    }
  };

  return (
    <HubLayout
      activePage={activePage}
      onPageChange={setActivePage}
      onBack={onBack}
      isAdmin={isAdmin}
    >
      {renderContent()}
    </HubLayout>
  );
}

// Coming Soon placeholder component
function ComingSoon({ page }: { page: string }) {
  const labels: Record<string, { title: string; description: string }> = {
    projects: { title: 'Projects', description: 'View and manage saved BOM projects' },
    'sku-builder': { title: 'SKU Builder', description: 'Create new fence SKU configurations' },
    'sku-catalog': { title: 'SKU Catalog', description: 'Browse all available fence SKUs' },
  };

  const info = labels[page] || { title: page, description: '' };

  return (
    <div className="flex-1 flex items-center justify-center bg-gray-50">
      <div className="text-center p-12">
        <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <span className="text-4xl">🚧</span>
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-3">{info.title}</h2>
        <p className="text-gray-600 mb-2">{info.description}</p>
        <p className="text-sm text-gray-400">Coming Soon</p>
      </div>
    </div>
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
