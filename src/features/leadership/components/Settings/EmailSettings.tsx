import { useState, useEffect } from 'react';
import { ArrowLeft, Mail, Save, Clock, Users } from 'lucide-react';
import { supabase } from '../../../../lib/supabase';
import { useAuth } from '../../../../contexts/AuthContext';

interface EmailSchedule {
  day: 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday';
  time: string;
  timezone: string;
}

interface EmailSettingsProps {
  onBack: () => void;
}

export default function EmailSettings({ onBack }: EmailSettingsProps) {
  const { profile } = useAuth();
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const [schedule, setSchedule] = useState<EmailSchedule>({
    day: 'friday',
    time: '12:00',
    timezone: 'America/New_York',
  });

  const [recipientType, setRecipientType] = useState<'all_leadership' | 'per_function' | 'custom'>('all_leadership');
  const [customEmails, setCustomEmails] = useState<string>('');
  const [isEnabled, setIsEnabled] = useState(true);

  // Check admin permission
  const isAdmin = profile?.role === 'admin';

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('project_settings')
        .select('*')
        .eq('setting_key', 'email_schedule')
        .single();

      if (error && error.code !== 'PGRST116') throw error; // Ignore "not found" error

      if (data?.setting_value) {
        const settings = data.setting_value;
        if (settings.schedule) {
          setSchedule(settings.schedule);
        }
        if (settings.recipientType) {
          setRecipientType(settings.recipientType);
        }
        if (settings.customEmails) {
          setCustomEmails(settings.customEmails);
        }
        if (typeof settings.isEnabled === 'boolean') {
          setIsEnabled(settings.isEnabled);
        }
      }
    } catch (error) {
      console.error('Failed to load email settings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      const settingValue = {
        schedule,
        recipientType,
        customEmails,
        isEnabled,
      };

      // Upsert settings
      const { error } = await supabase
        .from('project_settings')
        .upsert({
          setting_key: 'email_schedule',
          setting_value: settingValue,
          description: 'Weekly summary email configuration',
        }, {
          onConflict: 'setting_key',
        });

      if (error) throw error;

      alert('Email settings saved successfully!');
    } catch (error) {
      console.error('Failed to save email settings:', error);
      alert('Failed to save settings. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Mail className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Admin Access Required</h2>
          <p className="text-gray-600 mb-6">
            You need administrator privileges to configure email settings.
          </p>
          <button
            onClick={onBack}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading email settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Email Settings</h1>
              <p className="text-sm text-gray-600 mt-1">Configure weekly summary email schedule and recipients</p>
            </div>
          </div>
        </div>
      </div>

      {/* Form */}
      <div className="max-w-4xl mx-auto px-6 py-8">
        <form onSubmit={handleSave} className="space-y-8">
          {/* Enable/Disable */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-1">Email Notifications</h3>
                <p className="text-sm text-gray-600">
                  Enable or disable automated weekly summary emails
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={isEnabled}
                  onChange={(e) => setIsEnabled(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-14 h-7 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
          </div>

          {/* Schedule Configuration */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-2 mb-4">
              <Clock className="w-5 h-5 text-blue-600" />
              <h3 className="text-lg font-semibold text-gray-900">Email Schedule</h3>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Day of Week */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Day of Week
                </label>
                <select
                  value={schedule.day}
                  onChange={(e) => setSchedule({ ...schedule, day: e.target.value as any })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={!isEnabled}
                >
                  <option value="monday">Monday</option>
                  <option value="tuesday">Tuesday</option>
                  <option value="wednesday">Wednesday</option>
                  <option value="thursday">Thursday</option>
                  <option value="friday">Friday</option>
                </select>
              </div>

              {/* Time */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Time
                </label>
                <input
                  type="time"
                  value={schedule.time}
                  onChange={(e) => setSchedule({ ...schedule, time: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={!isEnabled}
                />
              </div>

              {/* Timezone */}
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Timezone
                </label>
                <select
                  value={schedule.timezone}
                  onChange={(e) => setSchedule({ ...schedule, timezone: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={!isEnabled}
                >
                  <option value="America/New_York">Eastern Time (ET)</option>
                  <option value="America/Chicago">Central Time (CT)</option>
                  <option value="America/Denver">Mountain Time (MT)</option>
                  <option value="America/Los_Angeles">Pacific Time (PT)</option>
                </select>
              </div>
            </div>

            <div className="mt-4 p-3 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-800">
                <strong>Preview:</strong> Emails will be sent every {schedule.day.charAt(0).toUpperCase() + schedule.day.slice(1)} at {schedule.time} ({schedule.timezone})
              </p>
            </div>
          </div>

          {/* Recipients Configuration */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-2 mb-4">
              <Users className="w-5 h-5 text-blue-600" />
              <h3 className="text-lg font-semibold text-gray-900">Email Recipients</h3>
            </div>

            <div className="space-y-4">
              {/* Recipient Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Who should receive the weekly summary?
                </label>
                <div className="space-y-2">
                  <label className="flex items-start gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
                    <input
                      type="radio"
                      value="all_leadership"
                      checked={recipientType === 'all_leadership'}
                      onChange={(e) => setRecipientType(e.target.value as any)}
                      className="mt-1"
                      disabled={!isEnabled}
                    />
                    <div>
                      <div className="font-medium text-gray-900">All Leadership Users</div>
                      <div className="text-sm text-gray-600">
                        Send to all users with access to any function
                      </div>
                    </div>
                  </label>

                  <label className="flex items-start gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
                    <input
                      type="radio"
                      value="per_function"
                      checked={recipientType === 'per_function'}
                      onChange={(e) => setRecipientType(e.target.value as any)}
                      className="mt-1"
                      disabled={!isEnabled}
                    />
                    <div>
                      <div className="font-medium text-gray-900">Per Function</div>
                      <div className="text-sm text-gray-600">
                        Send separate emails to each function's team with only their initiatives
                      </div>
                    </div>
                  </label>

                  <label className="flex items-start gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
                    <input
                      type="radio"
                      value="custom"
                      checked={recipientType === 'custom'}
                      onChange={(e) => setRecipientType(e.target.value as any)}
                      className="mt-1"
                      disabled={!isEnabled}
                    />
                    <div className="flex-1">
                      <div className="font-medium text-gray-900 mb-2">Custom Email List</div>
                      <div className="text-sm text-gray-600 mb-3">
                        Specify custom email addresses
                      </div>
                      {recipientType === 'custom' && (
                        <textarea
                          value={customEmails}
                          onChange={(e) => setCustomEmails(e.target.value)}
                          placeholder="Enter email addresses, one per line"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          rows={4}
                          disabled={!isEnabled}
                        />
                      )}
                    </div>
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* Save Button */}
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={isSaving}
              className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 font-medium"
            >
              <Save className="w-5 h-5" />
              {isSaving ? 'Saving...' : 'Save Settings'}
            </button>
            <button
              type="button"
              onClick={onBack}
              className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
