import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { showSuccess, showError } from '../../../lib/toast';
import { Mail, Smartphone, Lock } from 'lucide-react';

interface NotificationPreference {
  id?: string;
  user_id: string;
  category: string;
  notification_type: string;
  email_enabled: boolean;
  sms_enabled: boolean;
  is_admin_forced: boolean;
}

interface NotificationTypeConfig {
  type: string;
  label: string;
  description: string;
}

interface CategoryConfig {
  category: string;
  label: string;
  types: NotificationTypeConfig[];
}

// Define all available notification types
const NOTIFICATION_CATEGORIES: CategoryConfig[] = [
  {
    category: 'requests',
    label: 'Request Hub',
    types: [
      { type: 'assignment', label: 'Assigned to Request', description: 'When you are assigned to a request' },
      { type: 'watcher_added', label: 'Added as Watcher', description: 'When you are added as a watcher on a request' },
      { type: 'comment', label: 'New Comment', description: 'When someone comments on a request you\'re involved with' },
      { type: 'status_change', label: 'Status Change', description: 'When a request status changes' },
      { type: 'attachment', label: 'New Attachment', description: 'When someone adds an attachment' },
    ],
  },
  {
    category: 'tasks',
    label: 'Tasks & Initiatives',
    types: [
      { type: 'assignment', label: 'Task Assigned', description: 'When you are assigned to a task or initiative' },
      { type: 'comment', label: 'Task Comment', description: 'When someone comments on your task' },
      { type: 'status_change', label: 'Task Status Change', description: 'When a task status is updated' },
      { type: 'due_date_reminder', label: 'Due Date Reminder', description: 'Reminders for upcoming task deadlines' },
    ],
  },
  {
    category: 'chat',
    label: 'Chat & Messaging',
    types: [
      { type: 'direct_message', label: 'Direct Message', description: 'When someone sends you a direct message' },
      { type: 'group_message', label: 'Group Message', description: 'When someone messages in a group you\'re in' },
    ],
  },
  {
    category: 'announcements',
    label: 'Announcements',
    types: [
      { type: 'new_announcement', label: 'New Announcement', description: 'When a new company announcement is posted' },
    ],
  },
];

export default function NotificationSettings() {
  const [preferences, setPreferences] = useState<NotificationPreference[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    loadPreferences();
  }, []);

  const loadPreferences = async () => {
    try {
      setLoading(true);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      setUserId(user.id);

      const { data, error } = await supabase
        .from('user_notification_preferences')
        .select('*')
        .eq('user_id', user.id);

      if (error) throw error;
      setPreferences(data || []);
    } catch (error) {
      console.error('Error loading preferences:', error);
      showError('Failed to load notification preferences');
    } finally {
      setLoading(false);
    }
  };

  const getPreference = (category: string, type: string): NotificationPreference => {
    const existing = preferences.find(
      p => p.category === category && p.notification_type === type
    );

    if (existing) return existing;

    // Return default (all enabled)
    return {
      user_id: userId || '',
      category,
      notification_type: type,
      email_enabled: true,
      sms_enabled: true,
      is_admin_forced: false,
    };
  };

  const updatePreference = async (
    category: string,
    type: string,
    field: 'email_enabled' | 'sms_enabled',
    value: boolean
  ) => {
    if (!userId) return;

    const key = `${category}-${type}-${field}`;
    setSaving(key);

    try {
      const currentPref = getPreference(category, type);

      // Check if admin forced
      if (currentPref.is_admin_forced) {
        showError('This notification is required by your administrator');
        return;
      }

      const newPref = {
        user_id: userId,
        category,
        notification_type: type,
        email_enabled: field === 'email_enabled' ? value : currentPref.email_enabled,
        sms_enabled: field === 'sms_enabled' ? value : currentPref.sms_enabled,
      };

      const { data, error } = await supabase
        .from('user_notification_preferences')
        .upsert(newPref, {
          onConflict: 'user_id,category,notification_type',
        })
        .select()
        .single();

      if (error) throw error;

      // Update local state
      setPreferences(prev => {
        const idx = prev.findIndex(
          p => p.category === category && p.notification_type === type
        );
        if (idx >= 0) {
          const updated = [...prev];
          updated[idx] = data;
          return updated;
        }
        return [...prev, data];
      });

      showSuccess('Preference saved');
    } catch (error) {
      console.error('Error saving preference:', error);
      showError('Failed to save preference');
    } finally {
      setSaving(null);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="text-center py-8">
          <div className="text-gray-600">Loading notification settings...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="mb-6">
          <h2 className="text-xl font-bold text-gray-900">Notification Preferences</h2>
          <p className="text-sm text-gray-600 mt-1">
            Choose how you want to be notified for different events. By default, all notifications are enabled.
          </p>
        </div>

        {NOTIFICATION_CATEGORIES.map(category => (
          <div key={category.category} className="mb-8 last:mb-0">
            <h3 className="text-lg font-semibold text-gray-800 mb-4 pb-2 border-b border-gray-200">
              {category.label}
            </h3>

            <div className="space-y-3">
              {category.types.map(notifType => {
                const pref = getPreference(category.category, notifType.type);
                const isForced = pref.is_admin_forced;

                return (
                  <div
                    key={notifType.type}
                    className={`flex items-center justify-between p-4 rounded-lg border ${
                      isForced ? 'bg-gray-50 border-gray-300' : 'bg-white border-gray-200'
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900">{notifType.label}</span>
                        {isForced && (
                          <span className="inline-flex items-center gap-1 text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                            <Lock className="w-3 h-3" />
                            Required
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-500 mt-0.5">{notifType.description}</p>
                    </div>

                    <div className="flex items-center gap-4 ml-4">
                      {/* Email Toggle */}
                      <button
                        onClick={() => updatePreference(
                          category.category,
                          notifType.type,
                          'email_enabled',
                          !pref.email_enabled
                        )}
                        disabled={isForced || saving === `${category.category}-${notifType.type}-email_enabled`}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                          pref.email_enabled
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-gray-100 text-gray-400'
                        } ${isForced ? 'cursor-not-allowed opacity-60' : 'hover:opacity-80'}`}
                        title={isForced ? 'Required by administrator' : 'Toggle email notifications'}
                      >
                        <Mail className="w-4 h-4" />
                        <span>Email</span>
                      </button>

                      {/* SMS Toggle */}
                      <button
                        onClick={() => updatePreference(
                          category.category,
                          notifType.type,
                          'sms_enabled',
                          !pref.sms_enabled
                        )}
                        disabled={isForced || saving === `${category.category}-${notifType.type}-sms_enabled`}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                          pref.sms_enabled
                            ? 'bg-green-100 text-green-700'
                            : 'bg-gray-100 text-gray-400'
                        } ${isForced ? 'cursor-not-allowed opacity-60' : 'hover:opacity-80'}`}
                        title={isForced ? 'Required by administrator' : 'Toggle SMS notifications'}
                      >
                        <Smartphone className="w-4 h-4" />
                        <span>SMS</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-800">
            <strong>Note:</strong> SMS notifications require a valid phone number in your profile.
            Some notifications may be required by your administrator and cannot be disabled.
          </p>
        </div>
      </div>
    </div>
  );
}
