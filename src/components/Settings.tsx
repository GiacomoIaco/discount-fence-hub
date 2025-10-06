import { useState } from 'react';
import { ArrowLeft, Users, Settings as SettingsIcon } from 'lucide-react';
import TeamManagement from './TeamManagement';
import AssignmentRules from './admin/AssignmentRules';
import type { UserRole } from '../types';

interface SettingsProps {
  onBack: () => void;
  userRole: UserRole;
}

export default function Settings({ onBack, userRole }: SettingsProps) {
  const [activeTab, setActiveTab] = useState<'team' | 'assignment-rules'>('team');

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button
          onClick={onBack}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <div className="flex gap-8">
          <button
            onClick={() => setActiveTab('team')}
            className={`flex items-center gap-2 pb-4 px-1 border-b-2 transition-colors ${
              activeTab === 'team'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            <Users className="w-5 h-5" />
            <span className="font-medium">Team Management</span>
          </button>

          {userRole === 'admin' && (
            <button
              onClick={() => setActiveTab('assignment-rules')}
              className={`flex items-center gap-2 pb-4 px-1 border-b-2 transition-colors ${
                activeTab === 'assignment-rules'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              <SettingsIcon className="w-5 h-5" />
              <span className="font-medium">Assignment Rules</span>
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div>
        {activeTab === 'team' && <TeamManagement userRole={userRole} />}
        {activeTab === 'assignment-rules' && userRole === 'admin' && (
          <AssignmentRules onBack={onBack} />
        )}
      </div>
    </div>
  );
}
