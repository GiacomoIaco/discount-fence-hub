import { useState } from 'react';
import { ArrowLeft, Folder, Settings as SettingsIcon, Mail, Users, Shield } from 'lucide-react';
import FunctionSettings from './FunctionSettings';
import EmailSettings from './EmailSettings';
import AccessManagement from './AccessManagement';
import { useAuth } from '../../../../contexts/AuthContext';

type SettingsView = 'menu' | 'functions' | 'email' | 'access';

interface SettingsHubProps {
  onBack: () => void;
}

export default function SettingsHub({ onBack }: SettingsHubProps) {
  const [view, setView] = useState<SettingsView>('menu');
  const { profile } = useAuth();
  const isSuperAdmin = profile?.is_super_admin === true;

  // Settings Menu
  if (view === 'menu') {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="bg-white border-b border-gray-200">
          <div className="max-w-5xl mx-auto px-6 py-4">
            <div className="flex items-center gap-3">
              <button
                onClick={onBack}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className="flex-1">
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl font-bold text-gray-900">Leadership Settings</h1>
                  {isSuperAdmin && (
                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-semibold">
                      <Shield className="w-3 h-3" />
                      Super Admin
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-600">Manage functions, areas, and system configuration</p>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-5xl mx-auto px-6 py-8">
          <div className="grid grid-cols-2 gap-4">
            {/* Functions & Areas */}
            <button
              onClick={() => setView('functions')}
              className="bg-white p-6 rounded-xl shadow-sm border-2 border-gray-200 hover:shadow-md hover:border-blue-400 transition-all text-left group"
            >
              <div className="flex items-start gap-4">
                <div className="bg-blue-100 p-3 rounded-lg group-hover:bg-blue-200 transition-colors">
                  <Folder className="w-6 h-6 text-blue-600" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-gray-900 mb-1">Functions & Areas</h3>
                  <p className="text-sm text-gray-600">
                    Create and manage organizational functions and responsibility areas
                  </p>
                </div>
              </div>
            </button>

            {/* Email Settings */}
            <button
              onClick={() => setView('email')}
              className="bg-white p-6 rounded-xl shadow-sm border-2 border-gray-200 hover:shadow-md hover:border-green-400 transition-all text-left group"
            >
              <div className="flex items-start gap-4">
                <div className="bg-green-100 p-3 rounded-lg group-hover:bg-green-200 transition-colors">
                  <Mail className="w-6 h-6 text-green-600" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-gray-900 mb-1">Email Settings</h3>
                  <p className="text-sm text-gray-600">
                    Configure weekly summary email schedule and recipients
                  </p>
                </div>
              </div>
            </button>

            {/* Access Management */}
            <button
              onClick={() => setView('access')}
              className="bg-white p-6 rounded-xl shadow-sm border-2 border-gray-200 hover:shadow-md hover:border-purple-400 transition-all text-left group"
            >
              <div className="flex items-start gap-4">
                <div className="bg-purple-100 p-3 rounded-lg group-hover:bg-purple-200 transition-colors">
                  <Users className="w-6 h-6 text-purple-600" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-gray-900 mb-1">Access Management</h3>
                  <p className="text-sm text-gray-600">
                    Manage function owners and team members
                  </p>
                </div>
              </div>
            </button>

            {/* System Settings */}
            <button
              disabled
              className="bg-white p-6 rounded-xl shadow-sm border-2 border-gray-200 opacity-50 text-left"
            >
              <div className="flex items-start gap-4">
                <div className="bg-gray-100 p-3 rounded-lg">
                  <SettingsIcon className="w-6 h-6 text-gray-600" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-gray-900 mb-1">System Settings</h3>
                  <p className="text-sm text-gray-600">
                    Advanced configuration options
                  </p>
                  <div className="mt-2 inline-block px-2 py-1 bg-yellow-100 text-yellow-700 text-xs rounded">
                    Coming Soon
                  </div>
                </div>
              </div>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Functions & Areas View
  if (view === 'functions') {
    return <FunctionSettings onBack={() => setView('menu')} />;
  }

  // Email Settings View
  if (view === 'email') {
    return <EmailSettings onBack={() => setView('menu')} />;
  }

  // Access Management View
  if (view === 'access') {
    return <AccessManagement onBack={() => setView('menu')} />;
  }

  return null;
}
