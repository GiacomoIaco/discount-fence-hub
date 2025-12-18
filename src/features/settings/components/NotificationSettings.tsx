import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { showSuccess, showError } from '../../../lib/toast';
import { Mail, Smartphone, Lock, Bell, BellOff, AlertCircle } from 'lucide-react';
import { usePushNotifications } from '../../../hooks/usePushNotifications';

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

  // Push notification state
  const {
    isSupported: pushSupported,
    permissionState,
    isSubscribed: pushEnabled,
    isLoading: pushLoading,
    enable: enablePush,
    disable: disablePush,
  } = usePushNotifications();

  useEffect(() => {
    loadPreferences();
  }, []);

  const handleTogglePush = async () => {
    if (pushEnabled) {
      const success = await disablePush();
      if (success) {
        showSuccess('Push notifications disabled');
      } else {
        showError('Failed to disable push notifications');
      }
    } else {
      const success = await enablePush();
      if (success) {
        showSuccess('Push notifications enabled!');
      } else {
        if (permissionState === 'denied') {
          showError('Notifications blocked. Please enable in browser settings.');
        } else {
          showError('Failed to enable push notifications');
        }
      }
    }
  };

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
      {/* Push Notifications Section */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="mb-4">
          <h2 className="text-xl font-bold text-gray-900">Push Notifications</h2>
          <p className="text-sm text-gray-600 mt-1">
            Get alerts on your phone even when the app is closed.
          </p>
        </div>

        {!pushSupported ? (
          <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg border border-gray-200">
            <AlertCircle className="w-5 h-5 text-gray-400" />
            <div>
              <p className="text-sm text-gray-600">
                Push notifications are not supported in this browser.
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Try using Chrome, Edge, or Safari on a supported device.
              </p>
            </div>
          </div>
        ) : permissionState === 'denied' ? (
          <div className="flex items-center gap-3 p-4 bg-amber-50 rounded-lg border border-amber-200">
            <BellOff className="w-5 h-5 text-amber-500" />
            <div>
              <p className="text-sm text-amber-800 font-medium">
                Notifications are blocked
              </p>
              <p className="text-xs text-amber-700 mt-1">
                To enable, click the lock icon in your browser's address bar and allow notifications.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
            <div className="flex items-center gap-3">
              {pushEnabled ? (
                <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                  <Bell className="w-5 h-5 text-green-600" />
                </div>
              ) : (
                <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                  <BellOff className="w-5 h-5 text-gray-500" />
                </div>
              )}
              <div>
                <p className="font-medium text-gray-900">
                  {pushEnabled ? 'Push notifications enabled' : 'Push notifications disabled'}
                </p>
                <p className="text-sm text-gray-500">
                  {pushEnabled
                    ? 'You\'ll receive alerts for new messages'
                    : 'Enable to get alerts on your device'}
                </p>
              </div>
            </div>

            <button
              onClick={handleTogglePush}
              disabled={pushLoading}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                pushEnabled
                  ? 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {pushLoading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  {pushEnabled ? 'Disabling...' : 'Enabling...'}
                </span>
              ) : pushEnabled ? (
                'Disable'
              ) : (
                'Enable'
              )}
            </button>
          </div>
        )}
      </div>

      {/* Email & SMS Preferences Section */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="mb-6">
          <h2 className="text-xl font-bold text-gray-900">Email & SMS Preferences</h2>
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
