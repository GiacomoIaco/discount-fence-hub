import { useState } from 'react';
import { Plus, Trash2, Edit2, Save, X, ArrowLeft } from 'lucide-react';
import type { RequestType } from '../../../lib/requests';
import { useAssignmentRules, useUsers } from '../../../hooks/useRequests';
import { showError, showWarning } from '../../../lib/toast';

interface AssignmentRulesProps {
  onBack: () => void;
}

export default function AssignmentRules({ onBack }: AssignmentRulesProps) {
  const { rules, loading, createRule, updateRule, deleteRule } = useAssignmentRules();
  const { users } = useUsers();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showNewRule, setShowNewRule] = useState(false);

  // New rule form
  const [newRequestType, setNewRequestType] = useState<RequestType>('pricing');
  const [newAssigneeId, setNewAssigneeId] = useState('');
  const [newPriority, setNewPriority] = useState(1);

  // Edit form
  const [editAssigneeId, setEditAssigneeId] = useState('');
  const [editPriority, setEditPriority] = useState(1);

  const handleCreateRule = async () => {
    if (!newAssigneeId) {
      showWarning('Please select an assignee');
      return;
    }

    try {
      await createRule(newRequestType, newAssigneeId, newPriority);
      setShowNewRule(false);
      setNewRequestType('pricing');
      setNewAssigneeId('');
      setNewPriority(1);
    } catch (error) {
      console.error('Failed to create rule:', error);
      showError('Failed to create rule');
    }
  };

  const handleStartEdit = (rule: any) => {
    setEditingId(rule.id);
    setEditAssigneeId(rule.assignee_id);
    setEditPriority(rule.priority);
  };

  const handleSaveEdit = async (ruleId: string) => {
    try {
      await updateRule(ruleId, {
        assignee_id: editAssigneeId,
        priority: editPriority
      });
      setEditingId(null);
    } catch (error) {
      console.error('Failed to update rule:', error);
      showError('Failed to update rule');
    }
  };

  const handleToggleActive = async (ruleId: string, currentStatus: boolean) => {
    try {
      await updateRule(ruleId, { is_active: !currentStatus });
    } catch (error) {
      console.error('Failed to toggle rule:', error);
      showError('Failed to toggle rule');
    }
  };

  const handleDeleteRule = async (ruleId: string) => {
    if (!confirm('Are you sure you want to delete this rule?')) return;

    try {
      await deleteRule(ruleId);
    } catch (error) {
      console.error('Failed to delete rule:', error);
      showError('Failed to delete rule');
    }
  };

  const getRequestTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      pricing: 'Pricing',
      material: 'Material',
      warranty: 'Warranty',
      new_builder: 'New Builder',
      support: 'Support'
    };
    return labels[type] || type;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading assignment rules...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="px-6 py-4">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-gray-900">Assignment Rules</h1>
              <p className="text-sm text-gray-600">Configure automatic request assignment</p>
            </div>
            <button
              onClick={() => setShowNewRule(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-5 h-5" />
              New Rule
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        {/* New Rule Form */}
        {showNewRule && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-4">
            <h3 className="font-semibold text-gray-900 mb-4">Create New Assignment Rule</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Request Type
                </label>
                <select
                  value={newRequestType}
                  onChange={(e) => setNewRequestType(e.target.value as RequestType)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="pricing">Pricing</option>
                  <option value="material">Material</option>
                  <option value="warranty">Warranty</option>
                  <option value="new_builder">New Builder</option>
                  <option value="support">Support</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Assign To
                </label>
                <select
                  value={newAssigneeId}
                  onChange={(e) => setNewAssigneeId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select user...</option>
                  {users.map(user => (
                    <option key={user.id} value={user.id}>{user.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Priority
                </label>
                <input
                  type="number"
                  value={newPriority}
                  onChange={(e) => setNewPriority(parseInt(e.target.value))}
                  min={1}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex items-end gap-2">
                <button
                  onClick={handleCreateRule}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  Create
                </button>
                <button
                  onClick={() => setShowNewRule(false)}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Rules List */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="p-4 border-b border-gray-200">
            <h3 className="font-semibold text-gray-900">Active Rules</h3>
            <p className="text-sm text-gray-600">Lower priority numbers are applied first</p>
          </div>

          {rules.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              No assignment rules configured. Create one to get started.
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {rules.map((rule) => (
                <div
                  key={rule.id}
                  className={`p-4 ${!rule.is_active ? 'bg-gray-50 opacity-60' : ''}`}
                >
                  {editingId === rule.id ? (
                    // Edit Mode
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
                      <div>
                        <div className="font-medium text-gray-900">
                          {getRequestTypeLabel(rule.request_type)}
                        </div>
                        <div className="text-xs text-gray-500">Request Type</div>
                      </div>
                      <div>
                        <select
                          value={editAssigneeId}
                          onChange={(e) => setEditAssigneeId(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                        >
                          {users.map(user => (
                            <option key={user.id} value={user.id}>{user.name}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <input
                          type="number"
                          value={editPriority}
                          onChange={(e) => setEditPriority(parseInt(e.target.value))}
                          min={1}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleSaveEdit(rule.id)}
                          className="p-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                        >
                          <Save className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="p-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    // View Mode
                    <div className="flex items-center justify-between">
                      <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <div className="font-medium text-gray-900">
                            {getRequestTypeLabel(rule.request_type)}
                          </div>
                          <div className="text-xs text-gray-500">Request Type</div>
                        </div>
                        <div>
                          <div className="text-gray-900">
                            {rule.assignee?.full_name || 'Unknown User'}
                          </div>
                          <div className="text-xs text-gray-500">Assigned To</div>
                        </div>
                        <div>
                          <div className="text-gray-900">Priority: {rule.priority}</div>
                          <div className="text-xs text-gray-500">
                            {rule.is_active ? 'Active' : 'Inactive'}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 ml-4">
                        <button
                          onClick={() => handleToggleActive(rule.id, rule.is_active)}
                          className={`px-3 py-1 text-sm rounded-lg transition-colors ${
                            rule.is_active
                              ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
                              : 'bg-green-100 text-green-700 hover:bg-green-200'
                          }`}
                        >
                          {rule.is_active ? 'Deactivate' : 'Activate'}
                        </button>
                        <button
                          onClick={() => handleStartEdit(rule)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteRule(rule.id)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Info Box */}
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="font-semibold text-blue-900 mb-2">How Assignment Rules Work</h4>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• When a new request is created, the system checks for matching assignment rules</li>
            <li>• Rules are applied in priority order (1 = highest priority)</li>
            <li>• The first active matching rule assigns the request to the specified user</li>
            <li>• If no rules match, the request remains unassigned</li>
            <li>• You can have multiple rules for the same request type with different priorities</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
