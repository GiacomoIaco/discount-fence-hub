import { useState, useEffect } from 'react';
import {
  Building2,
  Users,
  Home,
  FileSpreadsheet,
  BookOpen,
} from 'lucide-react';
import ClientsList from './components/ClientsList';
import CommunitiesList from './components/CommunitiesList';
import RateSheetsList from './components/RateSheetsList';
import PriceBooksList from './components/PriceBooksList';
import ClientDetailPage from './pages/ClientDetailPage';
import PropertyDetailPage from './pages/PropertyDetailPage';
import CommunityDetailPage from './pages/CommunityDetailPage';
import type { EntityContext } from '../../hooks/useRouteSync';
import type { EntityType } from '../../lib/routes';

type Tab = 'clients' | 'communities' | 'price-books' | 'rate-sheets';

interface ClientHubProps {
  onBack?: () => void;
  /** Entity context from URL for deep linking (e.g., /clients/abc123) */
  entityContext?: EntityContext | null;
  /** Navigate to a specific entity */
  onNavigateToEntity?: (entityType: EntityType, params: Record<string, string>) => void;
  /** Clear entity selection (go back to list) */
  onClearEntity?: () => void;
}

export default function ClientHub({
  onBack: _onBack,
  entityContext,
  onNavigateToEntity,
  onClearEntity,
}: ClientHubProps) {
  const [activeTab, setActiveTab] = useState<Tab>('clients');

  // Handle entity context from URL - switch to appropriate tab when viewing an entity
  useEffect(() => {
    if (entityContext) {
      if (entityContext.type === 'client') {
        setActiveTab('clients');
      } else if (entityContext.type === 'community') {
        setActiveTab('communities');
      } else if (entityContext.type === 'property') {
        // Properties are accessed via clients tab (Client → Community → Property)
        setActiveTab('clients');
      }
    }
  }, [entityContext]);

  // Handle client selection - update URL
  const handleClientSelect = (clientId: string) => {
    if (onNavigateToEntity) {
      onNavigateToEntity('client', { id: clientId });
    }
  };

  // Handle closing client detail - clear URL
  const handleClientClose = () => {
    if (onClearEntity) {
      onClearEntity();
    }
  };

  // If viewing a specific property, render the property detail page
  if (entityContext?.type === 'property') {
    return (
      <PropertyDetailPage
        propertyId={entityContext.id}
        onBack={handleClientClose}
        onNavigateToEntity={onNavigateToEntity}
      />
    );
  }

  // If viewing a specific community, render the community detail page
  if (entityContext?.type === 'community') {
    return (
      <CommunityDetailPage
        communityId={entityContext.id}
        clientId={entityContext.params?.clientId || ''}
        onBack={handleClientClose}
        onNavigateToEntity={onNavigateToEntity}
      />
    );
  }

  // If viewing a specific client, render the detail page
  if (entityContext?.type === 'client') {
    return (
      <ClientDetailPage
        clientId={entityContext.id}
        onBack={handleClientClose}
        onNavigateToEntity={onNavigateToEntity}
      />
    );
  }

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'clients', label: 'Clients', icon: <Building2 className="w-4 h-4" /> },
    { id: 'communities', label: 'Communities', icon: <Home className="w-4 h-4" /> },
    { id: 'price-books', label: 'Price Books', icon: <BookOpen className="w-4 h-4" /> },
    { id: 'rate-sheets', label: 'Rate Sheets', icon: <FileSpreadsheet className="w-4 h-4" /> },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Users className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Client Hub</h1>
              <p className="text-sm text-gray-500">Manage clients, communities, and pricing</p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="px-6">
          <nav className="flex gap-6 -mb-px">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-1 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        {activeTab === 'clients' && (
          <ClientsList
            onSelectClient={handleClientSelect}
          />
        )}
        {activeTab === 'communities' && (
          <CommunitiesList onNavigateToEntity={onNavigateToEntity} />
        )}
        {activeTab === 'price-books' && <PriceBooksList />}
        {activeTab === 'rate-sheets' && <RateSheetsList />}
      </div>
    </div>
  );
}
