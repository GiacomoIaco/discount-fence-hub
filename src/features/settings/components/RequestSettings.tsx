import { useState, useEffect } from 'react';
import { Plus, Trash2, Edit2, Save, X, Clock, Users as UsersIcon } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import type { RequestType } from '../../requests/lib/requests';
import { useAssignmentRules, useUsers } from '../../requests/hooks/useRequests';
import { showError, showWarning, showSuccess } from '../../../lib/toast';

interface SLADefaults {
  request_type: string;
  target_hours: number;
  urgent_target_hours: number | null;
  critical_target_hours: number | null;
}

export default function RequestSettings() {
  const { rules, loading: rulesLoading, createRule, updateRule, deleteRule } = useAssignmentRules();
  const { users } = useUsers();
  const [activeSection, setActiveSection] = useState<'sla' | 'assignment'>('sla');

  // SLA state
  const [slaDefaults, setSlaDefaults] = useState<SLADefaults[]>([]);
  const [slaLoading, setSlaLoading] = useState(true);
  const [editingSla, setEditingSla] = useState<string | null>(null);
  const [slaForm, setSlaForm] = useState({ target_hours: 24, urgent_target_hours: 8, critical_target_hours: 4 });

  // Assignment rule state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showNewRule, setShowNewRule] = useState(false);
  const [newRequestType, setNewRequestType] = useState<RequestType>('pricing');
  const [newAssigneeId, setNewAssigneeId] = useState('');
  const [newPriority, setNewPriority] = useState(1);
  const [editAssigneeId, setEditAssigneeId] = useState('');
  const [editPriority, setEditPriority] = useState(1);

  // Load SLA defaults
  useEffect(() => {
    loadSlaDefaults();
  }, []);

  const loadSlaDefaults = async () => {
    try {
      setSlaLoading(true);
      const { data, error } = await supabase
        .from('request_sla_defaults')
        .select('*')
        .order('request_type');

      if (error) throw error;
      setSlaDefaults(data || []);
    } catch (error) {
      console.error('Error loading SLA defaults:', error);
      showError('Failed to load SLA settings');
    } finally {
      setSlaLoading(false);
    }
  };

  const handleEditSla = (sla: SLADefaults) => {
    setEditingSla(sla.request_type);
    setSlaForm({
      target_hours: sla.target_hours,
      urgent_target_hours: sla.urgent_target_hours || 0,
      critical_target_hours: sla.critical_target_hours || 0
    });
  };

  const handleSaveSla = async (requestType: string) => {
    try {
      const { error } = await supabase
        .from('request_sla_defaults')
        .update({
          target_hours: slaForm.target_hours,
          urgent_target_hours: slaForm.urgent_target_hours || null,
          critical_target_hours: slaForm.critical_target_hours || null,
          updated_at: new Date().toISOString()
        })
        .eq('request_type', requestType);

      if (error) throw error;

      showSuccess('SLA settings updated');
      setEditingSla(null);
      loadSlaDefaults();
    } catch (error) {
      console.error('Error updating SLA:', error);
      showError('Failed to update SLA settings');
    }
  };

  // Assignment rule handlers
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
      support: 'Support',
      other: 'Other'
    };
    return labels[type] || type;
  };

  const loading = slaLoading || rulesLoading;

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Section Tabs */}
      <div className="flex gap-4 border-b border-gray-200">
        <button
          onClick={() => setActiveSection('sla')}
          className={`flex items-center gap-2 pb-3 px-1 border-b-2 transition-colors ${
            activeSection === 'sla'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-600 hover:text-gray-900'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span className="font-medium">SLA Targets</span>
        </button>
        <button
          onClick={() => setActiveSection('assignment')}
          className={`flex items-center gap-2 pb-3 px-1 border-b-2 transition-colors ${
            activeSection === 'assignment'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-600 hover:text-gray-900'
          }`}
        >
          <UsersIcon className="w-4 h-4" />
          <span className="font-medium">Auto-Assignment Rules</span>
        </button>
      </div>

      {/* SLA Settings Section */}
      {activeSection === 'sla' && (
        <div className="space-y-4">
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
              <h3 className="font-semibold text-gray-900">SLA Targets by Request Type</h3>
              <p className="text-sm text-gray-600">Set response time targets for each request type and urgency level</p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-gray-700">Request Type</th>
                    <th className="text-center px-4 py-3 font-medium text-gray-700">
                      <div>Standard</div>
                      <div className="text-xs font-normal text-gray-500">Low/Medium</div>
                    </th>
                    <th className="text-center px-4 py-3 font-medium text-gray-700">
                      <div>High</div>
                      <div className="text-xs font-normal text-gray-500">Urgent</div>
                    </th>
                    <th className="text-center px-4 py-3 font-medium text-gray-700">
                      <div>Critical</div>
                      <div className="text-xs font-normal text-gray-500">Emergency</div>
                    </th>
                    <th className="text-center px-4 py-3 font-medium text-gray-700 w-20">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {slaDefaults.map((sla) => (
                    <tr key={sla.request_type} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">
                        {getRequestTypeLabel(sla.request_type)}
                      </td>
                      {editingSla === sla.request_type ? (
                        <>
                          <td className="px-4 py-3 text-center">
                            <input
                              type="number"
                              value={slaForm.target_hours}
                              onChange={(e) => setSlaForm({ ...slaForm, target_hours: parseInt(e.target.value) || 0 })}
                              className="w-20 px-2 py-1 border border-gray-300 rounded text-center"
                              min={1}
                            />
                            <span className="text-gray-500 ml-1">hrs</span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <input
                              type="number"
                              value={slaForm.urgent_target_hours}
                              onChange={(e) => setSlaForm({ ...slaForm, urgent_target_hours: parseInt(e.target.value) || 0 })}
                              className="w-20 px-2 py-1 border border-gray-300 rounded text-center"
                              min={1}
                            />
                            <span className="text-gray-500 ml-1">hrs</span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <input
                              type="number"
                              value={slaForm.critical_target_hours}
                              onChange={(e) => setSlaForm({ ...slaForm, critical_target_hours: parseInt(e.target.value) || 0 })}
                              className="w-20 px-2 py-1 border border-gray-300 rounded text-center"
                              min={1}
                            />
                            <span className="text-gray-500 ml-1">hrs</span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => handleSaveSla(sla.request_type)}
                                className="p-1.5 bg-green-600 text-white rounded hover:bg-green-700"
                              >
                                <Save className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => setEditingSla(null)}
                                className="p-1.5 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="px-4 py-3 text-center">
                            <span className="inline-flex items-center px-2 py-1 bg-blue-50 text-blue-700 rounded">
                              {sla.target_hours}h
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className="inline-flex items-center px-2 py-1 bg-orange-50 text-orange-700 rounded">
                              {sla.urgent_target_hours || sla.target_hours}h
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className="inline-flex items-center px-2 py-1 bg-red-50 text-red-700 rounded">
                              {sla.critical_target_hours || sla.target_hours}h
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <button
                              onClick={() => handleEditSla(sla)}
                              className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* SLA Info Box */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-semibold text-blue-900 mb-2">How SLA Targets Work</h4>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• SLA targets define the expected response time for each request type</li>
              <li>• Different urgency levels can have shorter target times</li>
              <li>• Requests are marked "At Risk" when 75% of the target time has passed</li>
              <li>• Requests are marked "Breached" when the target time is exceeded</li>
              <li>• Analytics track the percentage of requests resolved within SLA</li>
            </ul>
          </div>
        </div>
      )}

      {/* Assignment Rules Section */}
      {activeSection === 'assignment' && (
        <div className="space-y-4">
          {/* New Rule Button */}
          <div className="flex justify-end">
            <button
              onClick={() => setShowNewRule(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Plus className="w-4 h-4" />
              New Rule
            </button>
          </div>

          {/* New Rule Form */}
          {showNewRule && (
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <h3 className="font-semibold text-gray-900 mb-4">Create New Assignment Rule</h3>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Request Type</label>
                  <select
                    value={newRequestType}
                    onChange={(e) => setNewRequestType(e.target.value as RequestType)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="pricing">Pricing</option>
                    <option value="material">Material</option>
                    <option value="warranty">Warranty</option>
                    <option value="new_builder">New Builder</option>
                    <option value="support">Support</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Assign To</label>
                  <select
                    value={newAssigneeId}
                    onChange={(e) => setNewAssigneeId(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="">Select user...</option>
                    {users.map(user => (
                      <option key={user.id} value={user.id}>{user.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                  <input
                    type="number"
                    value={newPriority}
                    onChange={(e) => setNewPriority(parseInt(e.target.value))}
                    min={1}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div className="flex items-end gap-2">
                  <button
                    onClick={handleCreateRule}
                    className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                  >
                    Create
                  </button>
                  <button
                    onClick={() => setShowNewRule(false)}
                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Rules List */}
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
              <h3 className="font-semibold text-gray-900">Assignment Rules</h3>
              <p className="text-sm text-gray-600">Lower priority numbers are applied first</p>
            </div>

            {rules.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                No assignment rules configured. Create one to get started.
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {rules.map((rule) => (
                  <div
                    key={rule.id}
                    className={`p-4 ${!rule.is_active ? 'bg-gray-50 opacity-60' : ''}`}
                  >
                    {editingId === rule.id ? (
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
                        <div>
                          <div className="font-medium text-gray-900">{getRequestTypeLabel(rule.request_type)}</div>
                          <div className="text-xs text-gray-500">Request Type</div>
                        </div>
                        <div>
                          <select
                            value={editAssigneeId}
                            onChange={(e) => setEditAssigneeId(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
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
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleSaveEdit(rule.id)}
                            className="p-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                          >
                            <Save className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            className="p-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between">
                        <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div>
                            <div className="font-medium text-gray-900">{getRequestTypeLabel(rule.request_type)}</div>
                            <div className="text-xs text-gray-500">Request Type</div>
                          </div>
                          <div>
                            <div className="text-gray-900">{rule.assignee?.full_name || 'Unknown User'}</div>
                            <div className="text-xs text-gray-500">Assigned To</div>
                          </div>
                          <div>
                            <div className="text-gray-900">Priority: {rule.priority}</div>
                            <div className="text-xs text-gray-500">{rule.is_active ? 'Active' : 'Inactive'}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 ml-4">
                          <button
                            onClick={() => handleToggleActive(rule.id, rule.is_active)}
                            className={`px-3 py-1 text-sm rounded-lg ${
                              rule.is_active
                                ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
                                : 'bg-green-100 text-green-700 hover:bg-green-200'
                            }`}
                          >
                            {rule.is_active ? 'Deactivate' : 'Activate'}
                          </button>
                          <button
                            onClick={() => handleStartEdit(rule)}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteRule(rule.id)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
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

          {/* Assignment Info Box */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-semibold text-blue-900 mb-2">How Assignment Rules Work</h4>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• When a new request is created, the system checks for matching assignment rules</li>
              <li>• Rules are applied in priority order (1 = highest priority)</li>
              <li>• The first active matching rule assigns the request to the specified user</li>
              <li>• If no rules match, the request remains unassigned</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
