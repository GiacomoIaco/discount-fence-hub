import { useState } from 'react';
import {
  Building2,
  MapPin,
  Users,
  Home,
  FileSpreadsheet,
} from 'lucide-react';
import ClientsList from './components/ClientsList';
import CommunitiesList from './components/CommunitiesList';
import GeographiesList from './components/GeographiesList';
import RateSheetsList from './components/RateSheetsList';

type Tab = 'clients' | 'communities' | 'geographies' | 'rate-sheets';

interface ClientHubProps {
  onBack?: () => void;
}

export default function ClientHub({ onBack: _onBack }: ClientHubProps) {
  const [activeTab, setActiveTab] = useState<Tab>('clients');

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'clients', label: 'Clients', icon: <Building2 className="w-4 h-4" /> },
    { id: 'communities', label: 'Communities', icon: <Home className="w-4 h-4" /> },
    { id: 'rate-sheets', label: 'Rate Sheets', icon: <FileSpreadsheet className="w-4 h-4" /> },
    { id: 'geographies', label: 'Geographies', icon: <MapPin className="w-4 h-4" /> },
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
        {activeTab === 'clients' && <ClientsList />}
        {activeTab === 'communities' && <CommunitiesList />}
        {activeTab === 'rate-sheets' && <RateSheetsList />}
        {activeTab === 'geographies' && <GeographiesList />}
      </div>
    </div>
  );
}
