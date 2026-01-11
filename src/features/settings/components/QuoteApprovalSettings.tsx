import { useState, useEffect } from 'react';
import {
  Save,
  Edit2,
  X,
  Plus,
  Trash2,
  ShieldCheck,
  AlertTriangle,
  DollarSign,
  Percent,
  Users,
  Bell,
  Settings2,
} from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { showSuccess, showError, showWarning } from '../../../lib/toast';

interface ApprovalSettings {
  id: string;
  qbo_class_id: string | null;
  enabled: boolean;
  margin_below_percent: number;
  discount_above_percent: number;
  total_above_amount: number;
  approver_type: 'role' | 'specific_users' | 'bu_manager';
  approver_roles: string[];
  approver_user_ids: string[] | null;
  notify_email: boolean;
  notify_in_app: boolean;
  notify_sms: boolean;
  created_at: string;
  updated_at: string;
}

interface QboClass {
  id: string;
  name: string;
  labor_code: string;
}

interface UserProfile {
  id: string;
  full_name: string;
  email: string;
  role: string;
}

const DEFAULT_APPROVER_ROLES = ['admin', 'sales_manager'];

export default function QuoteApprovalSettings() {
  const [settings, setSettings] = useState<ApprovalSettings[]>([]);
  const [qboClasses, setQboClasses] = useState<QboClass[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showNewForm, setShowNewForm] = useState(false);

  // Form state
  const [formData, setFormData] = useState<Partial<ApprovalSettings>>({
    enabled: true,
    margin_below_percent: 15,
    discount_above_percent: 10,
    total_above_amount: 25000,
    approver_type: 'role',
    approver_roles: DEFAULT_APPROVER_ROLES,
    approver_user_ids: null,
    notify_email: true,
    notify_in_app: true,
    notify_sms: false,
  });
  const [selectedQboClassId, setSelectedQboClassId] = useState<string>('');

  // Load data
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);

      // Load approval settings
      const { data: settingsData, error: settingsError } = await supabase
        .from('quote_approval_settings')
        .select('*')
        .order('qbo_class_id', { ascending: true, nullsFirst: true });

      if (settingsError) throw settingsError;
      setSettings(settingsData || []);

      // Load QBO classes
      const { data: qboData, error: qboError } = await supabase
        .from('qbo_classes')
        .select('id, name, labor_code')
        .order('name');

      if (qboError) throw qboError;
      setQboClasses(qboData || []);

      // Load users for approver selection
      const { data: userData, error: userError } = await supabase
        .from('user_profiles')
        .select('id, full_name, email, role')
        .eq('is_active', true)
        .order('full_name');

      if (userError) throw userError;
      setUsers(userData || []);
    } catch (error) {
      console.error('Error loading data:', error);
      showError('Failed to load approval settings');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (setting: ApprovalSettings) => {
    setEditingId(setting.id);
    setFormData({
      enabled: setting.enabled,
      margin_below_percent: setting.margin_below_percent,
      discount_above_percent: setting.discount_above_percent,
      total_above_amount: setting.total_above_amount,
      approver_type: setting.approver_type,
      approver_roles: setting.approver_roles || DEFAULT_APPROVER_ROLES,
      approver_user_ids: setting.approver_user_ids,
      notify_email: setting.notify_email,
      notify_in_app: setting.notify_in_app,
      notify_sms: setting.notify_sms,
    });
    setSelectedQboClassId(setting.qbo_class_id || '');
  };

  const handleSave = async (settingId: string) => {
    try {
      const updateData = {
        enabled: formData.enabled,
        margin_below_percent: formData.margin_below_percent,
        discount_above_percent: formData.discount_above_percent,
        total_above_amount: formData.total_above_amount,
        approver_type: formData.approver_type,
        approver_roles: formData.approver_type === 'role' ? formData.approver_roles : null,
        approver_user_ids: formData.approver_type === 'specific_users' ? formData.approver_user_ids : null,
        notify_email: formData.notify_email,
        notify_in_app: formData.notify_in_app,
        notify_sms: formData.notify_sms,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('quote_approval_settings')
        .update(updateData)
        .eq('id', settingId);

      if (error) throw error;

      showSuccess('Approval settings updated');
      setEditingId(null);
      loadData();
    } catch (error) {
      console.error('Error saving settings:', error);
      showError('Failed to save settings');
    }
  };

  const handleCreate = async () => {
    if (!selectedQboClassId) {
      showWarning('Please select a Business Unit');
      return;
    }

    // Check if settings already exist for this BU
    const existing = settings.find(s => s.qbo_class_id === selectedQboClassId);
    if (existing) {
      showWarning('Settings already exist for this Business Unit');
      return;
    }

    try {
      const insertData = {
        qbo_class_id: selectedQboClassId,
        enabled: formData.enabled,
        margin_below_percent: formData.margin_below_percent,
        discount_above_percent: formData.discount_above_percent,
        total_above_amount: formData.total_above_amount,
        approver_type: formData.approver_type,
        approver_roles: formData.approver_type === 'role' ? formData.approver_roles : null,
        approver_user_ids: formData.approver_type === 'specific_users' ? formData.approver_user_ids : null,
        notify_email: formData.notify_email,
        notify_in_app: formData.notify_in_app,
        notify_sms: formData.notify_sms,
      };

      const { error } = await supabase
        .from('quote_approval_settings')
        .insert(insertData);

      if (error) throw error;

      showSuccess('Approval settings created for Business Unit');
      setShowNewForm(false);
      resetForm();
      loadData();
    } catch (error) {
      console.error('Error creating settings:', error);
      showError('Failed to create settings');
    }
  };

  const handleDelete = async (settingId: string, isGlobal: boolean) => {
    if (isGlobal) {
      showWarning('Cannot delete global default settings');
      return;
    }

    if (!confirm('Are you sure you want to delete these Business Unit settings? Quotes will fall back to global defaults.')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('quote_approval_settings')
        .delete()
        .eq('id', settingId);

      if (error) throw error;

      showSuccess('Settings deleted');
      loadData();
    } catch (error) {
      console.error('Error deleting settings:', error);
      showError('Failed to delete settings');
    }
  };

  const resetForm = () => {
    setFormData({
      enabled: true,
      margin_below_percent: 15,
      discount_above_percent: 10,
      total_above_amount: 25000,
      approver_type: 'role',
      approver_roles: DEFAULT_APPROVER_ROLES,
      approver_user_ids: null,
      notify_email: true,
      notify_in_app: true,
      notify_sms: false,
    });
    setSelectedQboClassId('');
  };

  const toggleApproverRole = (role: string) => {
    const currentRoles = formData.approver_roles || [];
    if (currentRoles.includes(role)) {
      setFormData({
        ...formData,
        approver_roles: currentRoles.filter(r => r !== role),
      });
    } else {
      setFormData({
        ...formData,
        approver_roles: [...currentRoles, role],
      });
    }
  };

  const toggleApproverUser = (userId: string) => {
    const currentUsers = formData.approver_user_ids || [];
    if (currentUsers.includes(userId)) {
      setFormData({
        ...formData,
        approver_user_ids: currentUsers.filter(u => u !== userId),
      });
    } else {
      setFormData({
        ...formData,
        approver_user_ids: [...currentUsers, userId],
      });
    }
  };

  const getQboClassName = (qboClassId: string | null) => {
    if (!qboClassId) return 'Global Default';
    const qbo = qboClasses.find(q => q.id === qboClassId);
    return qbo ? `${qbo.name} (${qbo.labor_code})` : qboClassId;
  };

  const getAvailableQboClasses = () => {
    const usedIds = settings.map(s => s.qbo_class_id).filter(Boolean);
    return qboClasses.filter(q => !usedIds.includes(q.id));
  };

  const renderSettingForm = (setting: ApprovalSettings | null, isNew: boolean = false) => {
    const isEditing = isNew || editingId === setting?.id;

    return (
      <div className={`bg-white rounded-lg border ${isNew ? 'border-blue-300 bg-blue-50/50' : 'border-gray-200'} overflow-hidden`}>
        {/* Header */}
        <div className={`px-4 py-3 border-b ${isNew ? 'border-blue-200 bg-blue-100/50' : 'border-gray-200 bg-gray-50'} flex items-center justify-between`}>
          <div className="flex items-center gap-2">
            <ShieldCheck className={`w-5 h-5 ${setting?.qbo_class_id ? 'text-blue-600' : 'text-green-600'}`} />
            <h3 className="font-semibold text-gray-900">
              {isNew ? 'New Business Unit Settings' : getQboClassName(setting?.qbo_class_id || null)}
            </h3>
            {!isNew && !setting?.qbo_class_id && (
              <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full">
                Default
              </span>
            )}
            {!isNew && setting?.enabled === false && (
              <span className="px-2 py-0.5 bg-gray-100 text-gray-500 text-xs rounded-full">
                Disabled
              </span>
            )}
          </div>
          {!isNew && !isEditing && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleEdit(setting!)}
                className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"
              >
                <Edit2 className="w-4 h-4" />
              </button>
              {setting?.qbo_class_id && (
                <button
                  onClick={() => handleDelete(setting.id, !setting.qbo_class_id)}
                  className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* BU Selection (only for new) */}
          {isNew && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Business Unit</label>
              <select
                value={selectedQboClassId}
                onChange={(e) => setSelectedQboClassId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              >
                <option value="">Select Business Unit...</option>
                {getAvailableQboClasses().map(qbo => (
                  <option key={qbo.id} value={qbo.id}>
                    {qbo.name} ({qbo.labor_code})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Enable/Disable */}
          {isEditing && (
            <div className="flex items-center gap-3">
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.enabled}
                  onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
              <span className="text-sm font-medium text-gray-700">
                Require manager approval when thresholds are violated
              </span>
            </div>
          )}

          {/* Thresholds */}
          <div>
            <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              Approval Required When Any Threshold Violated
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Margin */}
              <div>
                <label className="block text-sm text-gray-600 mb-1">
                  <Percent className="w-3 h-3 inline mr-1" />
                  Margin Below
                </label>
                {isEditing ? (
                  <div className="relative">
                    <input
                      type="number"
                      value={formData.margin_below_percent}
                      onChange={(e) => setFormData({ ...formData, margin_below_percent: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg pr-8"
                      min={0}
                      max={100}
                      step={1}
                    />
                    <span className="absolute right-3 top-2.5 text-gray-500">%</span>
                  </div>
                ) : (
                  <div className="px-3 py-2 bg-amber-50 text-amber-700 rounded-lg font-medium">
                    &lt; {setting?.margin_below_percent}%
                  </div>
                )}
              </div>

              {/* Discount */}
              <div>
                <label className="block text-sm text-gray-600 mb-1">
                  <Percent className="w-3 h-3 inline mr-1" />
                  Discount Above
                </label>
                {isEditing ? (
                  <div className="relative">
                    <input
                      type="number"
                      value={formData.discount_above_percent}
                      onChange={(e) => setFormData({ ...formData, discount_above_percent: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg pr-8"
                      min={0}
                      max={100}
                      step={1}
                    />
                    <span className="absolute right-3 top-2.5 text-gray-500">%</span>
                  </div>
                ) : (
                  <div className="px-3 py-2 bg-amber-50 text-amber-700 rounded-lg font-medium">
                    &gt; {setting?.discount_above_percent}%
                  </div>
                )}
              </div>

              {/* Total */}
              <div>
                <label className="block text-sm text-gray-600 mb-1">
                  <DollarSign className="w-3 h-3 inline mr-1" />
                  Total Above
                </label>
                {isEditing ? (
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-gray-500">$</span>
                    <input
                      type="number"
                      value={formData.total_above_amount}
                      onChange={(e) => setFormData({ ...formData, total_above_amount: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg pl-8"
                      min={0}
                      step={1000}
                    />
                  </div>
                ) : (
                  <div className="px-3 py-2 bg-amber-50 text-amber-700 rounded-lg font-medium">
                    &gt; ${setting?.total_above_amount?.toLocaleString()}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Approvers */}
          <div>
            <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-500" />
              Who Can Approve
            </h4>
            {isEditing ? (
              <div className="space-y-3">
                <div className="flex gap-4">
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name={`approver-type-${isNew ? 'new' : setting?.id}`}
                      checked={formData.approver_type === 'role'}
                      onChange={() => setFormData({ ...formData, approver_type: 'role' })}
                      className="text-blue-600"
                    />
                    <span className="text-sm">By Role</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name={`approver-type-${isNew ? 'new' : setting?.id}`}
                      checked={formData.approver_type === 'specific_users'}
                      onChange={() => setFormData({ ...formData, approver_type: 'specific_users' })}
                      className="text-blue-600"
                    />
                    <span className="text-sm">Specific Users</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name={`approver-type-${isNew ? 'new' : setting?.id}`}
                      checked={formData.approver_type === 'bu_manager'}
                      onChange={() => setFormData({ ...formData, approver_type: 'bu_manager' })}
                      className="text-blue-600"
                    />
                    <span className="text-sm">BU Manager</span>
                  </label>
                </div>

                {formData.approver_type === 'role' && (
                  <div className="flex flex-wrap gap-2">
                    {['admin', 'sales_manager', 'manager', 'owner'].map(role => (
                      <button
                        key={role}
                        type="button"
                        onClick={() => toggleApproverRole(role)}
                        className={`px-3 py-1.5 text-sm rounded-full border transition-colors ${
                          formData.approver_roles?.includes(role)
                            ? 'bg-blue-100 border-blue-300 text-blue-700'
                            : 'bg-gray-50 border-gray-200 text-gray-600 hover:border-gray-300'
                        }`}
                      >
                        {role.replace('_', ' ')}
                      </button>
                    ))}
                  </div>
                )}

                {formData.approver_type === 'specific_users' && (
                  <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                    {users.filter(u => ['admin', 'sales_manager', 'manager', 'owner'].includes(u.role)).map(user => (
                      <button
                        key={user.id}
                        type="button"
                        onClick={() => toggleApproverUser(user.id)}
                        className={`px-3 py-1.5 text-sm rounded-full border transition-colors ${
                          formData.approver_user_ids?.includes(user.id)
                            ? 'bg-blue-100 border-blue-300 text-blue-700'
                            : 'bg-gray-50 border-gray-200 text-gray-600 hover:border-gray-300'
                        }`}
                      >
                        {user.full_name || user.email}
                      </button>
                    ))}
                  </div>
                )}

                {formData.approver_type === 'bu_manager' && (
                  <p className="text-sm text-gray-500">
                    Approvals will be routed to team members with "Sales Manager" role assigned to this Business Unit.
                  </p>
                )}
              </div>
            ) : (
              <div className="text-sm text-gray-600">
                {setting?.approver_type === 'role' && (
                  <span>Users with roles: <strong>{setting.approver_roles?.join(', ') || 'admin, sales_manager'}</strong></span>
                )}
                {setting?.approver_type === 'specific_users' && (
                  <span>
                    Specific users: <strong>
                      {setting.approver_user_ids?.map(id => {
                        const user = users.find(u => u.id === id);
                        return user?.full_name || user?.email || id;
                      }).join(', ') || 'None selected'}
                    </strong>
                  </span>
                )}
                {setting?.approver_type === 'bu_manager' && (
                  <span>BU Sales Managers</span>
                )}
              </div>
            )}
          </div>

          {/* Notifications */}
          <div>
            <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
              <Bell className="w-4 h-4 text-purple-500" />
              Notification Channels
            </h4>
            {isEditing ? (
              <div className="flex gap-4">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.notify_in_app}
                    onChange={(e) => setFormData({ ...formData, notify_in_app: e.target.checked })}
                    className="rounded text-blue-600"
                  />
                  <span className="text-sm">In-App</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.notify_email}
                    onChange={(e) => setFormData({ ...formData, notify_email: e.target.checked })}
                    className="rounded text-blue-600"
                  />
                  <span className="text-sm">Email</span>
                </label>
                <label className="flex items-center gap-2 opacity-50">
                  <input
                    type="checkbox"
                    checked={formData.notify_sms}
                    onChange={(e) => setFormData({ ...formData, notify_sms: e.target.checked })}
                    className="rounded text-blue-600"
                    disabled
                  />
                  <span className="text-sm">SMS (Coming Soon)</span>
                </label>
              </div>
            ) : (
              <div className="flex gap-3">
                {setting?.notify_in_app && (
                  <span className="px-2 py-1 bg-purple-50 text-purple-700 text-xs rounded">In-App</span>
                )}
                {setting?.notify_email && (
                  <span className="px-2 py-1 bg-purple-50 text-purple-700 text-xs rounded">Email</span>
                )}
                {setting?.notify_sms && (
                  <span className="px-2 py-1 bg-purple-50 text-purple-700 text-xs rounded">SMS</span>
                )}
              </div>
            )}
          </div>

          {/* Action Buttons */}
          {isEditing && (
            <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
              <button
                onClick={() => {
                  if (isNew) {
                    setShowNewForm(false);
                    resetForm();
                  } else {
                    setEditingId(null);
                  }
                }}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                <X className="w-4 h-4 inline mr-1" />
                Cancel
              </button>
              <button
                onClick={() => isNew ? handleCreate() : handleSave(setting!.id)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Save className="w-4 h-4 inline mr-1" />
                {isNew ? 'Create' : 'Save'}
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const globalSettings = settings.find(s => !s.qbo_class_id);
  const buSettings = settings.filter(s => s.qbo_class_id);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-amber-100 rounded-lg">
            <Settings2 className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Manager Approval Workflow</h2>
            <p className="text-sm text-gray-600">
              Configure when quotes require manager approval before sending to clients
            </p>
          </div>
        </div>
        {!showNewForm && getAvailableQboClasses().length > 0 && (
          <button
            onClick={() => {
              setShowNewForm(true);
              resetForm();
            }}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add BU Override
          </button>
        )}
      </div>

      {/* New Form */}
      {showNewForm && renderSettingForm(null, true)}

      {/* Global Default */}
      {globalSettings && renderSettingForm(globalSettings)}

      {/* BU Overrides */}
      {buSettings.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
            Business Unit Overrides
          </h3>
          {buSettings.map(setting => (
            <div key={setting.id}>
              {renderSettingForm(setting)}
            </div>
          ))}
        </div>
      )}

      {/* Info Box */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="font-semibold text-blue-900 mb-2">How Manager Approval Works</h4>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>1. Rep creates a quote and saves it</li>
          <li>2. If any threshold is violated, "Send" button becomes "Send for Approval"</li>
          <li>3. Quote goes to manager queue (status: pending_manager_approval)</li>
          <li>4. Manager reviews and approves or rejects with notes</li>
          <li>5. If approved, rep can now send the quote to the client</li>
          <li>6. If rejected, quote returns to draft with manager feedback</li>
        </ul>
        <p className="mt-3 text-sm text-blue-700">
          <strong>Note:</strong> Business Unit settings override the global default.
          If no BU-specific setting exists, the global default is used.
        </p>
      </div>
    </div>
  );
}
