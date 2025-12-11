import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import { X, Save, Calendar, Clock, Mail, MessageSquare } from 'lucide-react';
import toast from 'react-hot-toast';
import type { SurveyCampaign, Survey, SurveyPopulation } from '../types';
import { useAuth } from '../../../contexts/AuthContext';

interface CampaignEditorModalProps {
  campaign: SurveyCampaign | null;
  onClose: () => void;
  onSave: () => void;
}

export default function CampaignEditorModal({ campaign, onClose, onSave }: CampaignEditorModalProps) {
  const { user } = useAuth();
  const [name, setName] = useState(campaign?.name || '');
  const [surveyId, setSurveyId] = useState(campaign?.survey_id || '');
  const [populationId, setPopulationId] = useState(campaign?.population_id || '');
  const [scheduleType, setScheduleType] = useState<'one_time' | 'recurring'>(
    campaign?.schedule_type || 'one_time'
  );
  const [sendAt, setSendAt] = useState(
    campaign?.send_at ? new Date(campaign.send_at).toISOString().slice(0, 16) : ''
  );
  const [recurrenceInterval, setRecurrenceInterval] = useState(campaign?.recurrence_interval || 6);
  const [recurrenceUnit, setRecurrenceUnit] = useState<'days' | 'weeks' | 'months'>(
    campaign?.recurrence_unit || 'weeks'
  );
  const [deliveryMethods, setDeliveryMethods] = useState<string[]>(
    campaign?.delivery_methods || ['email']
  );
  const [sendReminders, setSendReminders] = useState(campaign?.send_reminders ?? true);
  const [reminderDays, setReminderDays] = useState(campaign?.reminder_days || [3, 7]);
  const [responseDeadlineDays, setResponseDeadlineDays] = useState(campaign?.response_deadline_days || 14);

  // Fetch surveys
  const { data: surveys } = useQuery({
    queryKey: ['surveys-active'],
    queryFn: async () => {
      const { data } = await supabase
        .from('surveys')
        .select('id, code, title')
        .eq('status', 'active')
        .order('title');
      return data as Pick<Survey, 'id' | 'code' | 'title'>[];
    },
  });

  // Fetch populations
  const { data: populations } = useQuery({
    queryKey: ['populations-list'],
    queryFn: async () => {
      const { data } = await supabase
        .from('survey_populations')
        .select('id, name, contact_count')
        .order('name');
      return data as Pick<SurveyPopulation, 'id' | 'name' | 'contact_count'>[];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const data: any = {
        name,
        survey_id: surveyId,
        population_id: populationId,
        schedule_type: scheduleType,
        delivery_methods: deliveryMethods,
        send_reminders: sendReminders,
        reminder_days: reminderDays,
        response_deadline_days: responseDeadlineDays,
        created_by: user?.id,
      };

      if (scheduleType === 'one_time' && sendAt) {
        data.send_at = new Date(sendAt).toISOString();
      } else if (scheduleType === 'recurring') {
        data.recurrence_interval = recurrenceInterval;
        data.recurrence_unit = recurrenceUnit;
        // Calculate next send date
        const now = new Date();
        data.next_send_at = now.toISOString();
      }

      if (campaign?.id) {
        const { error } = await supabase.from('survey_campaigns').update(data).eq('id', campaign.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('survey_campaigns').insert(data);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(campaign ? 'Campaign updated' : 'Campaign created');
      onSave();
    },
    onError: (err: any) => toast.error(err.message || 'Failed to save campaign'),
  });

  const toggleDeliveryMethod = (method: string) => {
    if (deliveryMethods.includes(method)) {
      if (deliveryMethods.length > 1) {
        setDeliveryMethods(deliveryMethods.filter(m => m !== method));
      }
    } else {
      setDeliveryMethods([...deliveryMethods, method]);
    }
  };

  const canSave = name && surveyId && populationId;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            {campaign ? 'Edit Campaign' : 'New Campaign'}
          </h2>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6 space-y-6">
          {/* Basic Info */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Campaign Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Q4 Builder Satisfaction Survey"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Survey *</label>
              <select
                value={surveyId}
                onChange={(e) => setSurveyId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
              >
                <option value="">Select a survey...</option>
                {surveys?.map(s => (
                  <option key={s.id} value={s.id}>[{s.code}] {s.title}</option>
                ))}
              </select>
              {surveys?.length === 0 && (
                <p className="text-xs text-orange-600 mt-1">No active surveys. Create and activate a survey first.</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Population *</label>
              <select
                value={populationId}
                onChange={(e) => setPopulationId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
              >
                <option value="">Select a population...</option>
                {populations?.map(p => (
                  <option key={p.id} value={p.id}>{p.name} ({p.contact_count} contacts)</option>
                ))}
              </select>
            </div>
          </div>

          {/* Schedule Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Schedule Type</label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  checked={scheduleType === 'one_time'}
                  onChange={() => setScheduleType('one_time')}
                  className="text-emerald-600 focus:ring-emerald-500"
                />
                <span>One-time send</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  checked={scheduleType === 'recurring'}
                  onChange={() => setScheduleType('recurring')}
                  className="text-emerald-600 focus:ring-emerald-500"
                />
                <span>Recurring</span>
              </label>
            </div>
          </div>

          {/* Schedule Details */}
          {scheduleType === 'one_time' ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <Calendar className="w-4 h-4 inline mr-1" />
                Send Date & Time (optional - leave blank to send manually)
              </label>
              <input
                type="datetime-local"
                value={sendAt}
                onChange={(e) => setSendAt(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          ) : (
            <div className="p-4 bg-purple-50 rounded-lg space-y-4">
              <div className="flex items-center gap-2 text-purple-700">
                <Clock className="w-4 h-4" />
                <span className="font-medium">Recurring Schedule</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-gray-700">Send every</span>
                <input
                  type="number"
                  min={1}
                  max={52}
                  value={recurrenceInterval}
                  onChange={(e) => setRecurrenceInterval(parseInt(e.target.value) || 1)}
                  className="w-20 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                />
                <select
                  value={recurrenceUnit}
                  onChange={(e) => setRecurrenceUnit(e.target.value as any)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="days">days</option>
                  <option value="weeks">weeks</option>
                  <option value="months">months</option>
                </select>
              </div>
              <p className="text-sm text-purple-600">
                First send will happen when you activate the campaign
              </p>
            </div>
          )}

          {/* Delivery Methods */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Delivery Methods</label>
            <div className="flex gap-4">
              <button
                type="button"
                onClick={() => toggleDeliveryMethod('email')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg border-2 transition-colors ${
                  deliveryMethods.includes('email')
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                    : 'border-gray-200 text-gray-600 hover:border-gray-300'
                }`}
              >
                <Mail className="w-4 h-4" />
                Email
              </button>
              <button
                type="button"
                onClick={() => toggleDeliveryMethod('sms')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg border-2 transition-colors ${
                  deliveryMethods.includes('sms')
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                    : 'border-gray-200 text-gray-600 hover:border-gray-300'
                }`}
              >
                <MessageSquare className="w-4 h-4" />
                SMS
              </button>
            </div>
          </div>

          {/* Reminders */}
          <div className="p-4 bg-gray-50 rounded-lg space-y-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={sendReminders}
                onChange={(e) => setSendReminders(e.target.checked)}
                className="rounded text-emerald-600 focus:ring-emerald-500"
              />
              <span className="font-medium text-gray-900">Send reminders to non-responders</span>
            </label>
            {sendReminders && (
              <div className="flex items-center gap-2 pl-6">
                <span className="text-sm text-gray-600">Send reminders after</span>
                <input
                  type="number"
                  min={1}
                  value={reminderDays[0] || 3}
                  onChange={(e) => setReminderDays([parseInt(e.target.value) || 3, reminderDays[1] || 7])}
                  className="w-16 px-2 py-1 text-sm border border-gray-300 rounded"
                />
                <span className="text-sm text-gray-600">and</span>
                <input
                  type="number"
                  min={1}
                  value={reminderDays[1] || 7}
                  onChange={(e) => setReminderDays([reminderDays[0] || 3, parseInt(e.target.value) || 7])}
                  className="w-16 px-2 py-1 text-sm border border-gray-300 rounded"
                />
                <span className="text-sm text-gray-600">days</span>
              </div>
            )}
          </div>

          {/* Response Deadline */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Response Deadline (days)
            </label>
            <input
              type="number"
              min={1}
              max={90}
              value={responseDeadlineDays}
              onChange={(e) => setResponseDeadlineDays(parseInt(e.target.value) || 14)}
              className="w-24 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              Responses will be accepted for {responseDeadlineDays} days after each send
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-4 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => saveMutation.mutate()}
            disabled={!canSave || saveMutation.isPending}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {saveMutation.isPending ? 'Saving...' : 'Save Campaign'}
          </button>
        </div>
      </div>
    </div>
  );
}
