import { useState, useEffect } from 'react';
import { X, Calendar, Clock, User, Truck, Save, Trash2, Clipboard, Ban, Users } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import {
  useScheduleEntry,
  useCreateScheduleEntry,
  useUpdateScheduleEntry,
  useDeleteScheduleEntry,
} from '../hooks/useScheduleEntries';
import type {
  ScheduleEntryType,
  ScheduleEntryStatus,
  CreateScheduleEntryInput,
} from '../types/schedule.types';
import type { Crew, SalesRep } from '../../fsm/types';

// ============================================
// TYPES
// ============================================

interface ScheduleEntryModalProps {
  isOpen: boolean;
  mode: 'create' | 'edit';
  entryId?: string;
  prefillData?: Partial<CreateScheduleEntryInput>;
  onClose: () => void;
  crews: Crew[];
  salesReps: SalesRep[];
}

// ============================================
// MAIN COMPONENT
// ============================================

export function ScheduleEntryModal({
  isOpen,
  mode,
  entryId,
  prefillData,
  onClose,
  crews,
  salesReps,
}: ScheduleEntryModalProps) {
  // Form state
  const [entryType, setEntryType] = useState<ScheduleEntryType>('job_visit');
  const [scheduledDate, setScheduledDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [isAllDay, setIsAllDay] = useState(false);
  const [crewId, setCrewId] = useState<string>('');
  const [salesRepId, setSalesRepId] = useState<string>('');
  const [jobId, setJobId] = useState<string>('');
  const [requestId, setRequestId] = useState<string>('');
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState<ScheduleEntryStatus>('scheduled');
  const [estimatedFootage, setEstimatedFootage] = useState<number | ''>('');
  const [estimatedHours, setEstimatedHours] = useState<number | ''>('');

  // Fetch existing entry for edit mode
  const { data: existingEntry } = useScheduleEntry(mode === 'edit' ? entryId : undefined);

  // Fetch available jobs (won but not scheduled)
  const { data: availableJobs = [] } = useQuery({
    queryKey: ['jobs', 'available-for-schedule'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('jobs')
        .select('id, job_number, client:clients(name)')
        .in('status', ['won', 'scheduled', 'ready_for_yard'])
        .order('job_number', { ascending: false })
        .limit(100);
      if (error) throw error;
      return data || [];
    },
    enabled: isOpen && entryType === 'job_visit',
  });

  // Fetch service requests (pending assessment)
  const { data: availableRequests = [] } = useQuery({
    queryKey: ['requests', 'available-for-schedule'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('service_requests')
        .select('id, request_number, contact_name')
        .in('status', ['pending', 'assessment_scheduled'])
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return data || [];
    },
    enabled: isOpen && entryType === 'assessment',
  });

  // Mutations
  const createEntry = useCreateScheduleEntry();
  const updateEntry = useUpdateScheduleEntry();
  const deleteEntry = useDeleteScheduleEntry();

  // Initialize form when modal opens or entry loads
  useEffect(() => {
    if (mode === 'create' && prefillData) {
      setEntryType(prefillData.entry_type || 'job_visit');
      setScheduledDate(prefillData.scheduled_date || '');
      setStartTime(prefillData.start_time || '');
      setEndTime(prefillData.end_time || '');
      setCrewId(prefillData.crew_id || '');
      setSalesRepId(prefillData.sales_rep_id || '');
      setIsAllDay(!prefillData.start_time);
    } else if (mode === 'edit' && existingEntry) {
      setEntryType(existingEntry.entry_type);
      setScheduledDate(existingEntry.scheduled_date);
      setStartTime(existingEntry.start_time || '');
      setEndTime(existingEntry.end_time || '');
      setIsAllDay(existingEntry.is_all_day);
      setCrewId(existingEntry.crew_id || '');
      setSalesRepId(existingEntry.sales_rep_id || '');
      setJobId(existingEntry.job_id || '');
      setRequestId(existingEntry.service_request_id || '');
      setTitle(existingEntry.title || '');
      setNotes(existingEntry.notes || '');
      setStatus(existingEntry.status);
      setEstimatedFootage(existingEntry.estimated_footage || '');
      setEstimatedHours(existingEntry.estimated_hours || '');
    }
  }, [mode, prefillData, existingEntry]);

  // Reset form
  const resetForm = () => {
    setEntryType('job_visit');
    setScheduledDate('');
    setStartTime('');
    setEndTime('');
    setIsAllDay(false);
    setCrewId('');
    setSalesRepId('');
    setJobId('');
    setRequestId('');
    setTitle('');
    setNotes('');
    setStatus('scheduled');
    setEstimatedFootage('');
    setEstimatedHours('');
  };

  // Handle submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const data: CreateScheduleEntryInput = {
      entry_type: entryType,
      scheduled_date: scheduledDate,
      start_time: isAllDay ? null : startTime || null,
      end_time: isAllDay ? null : endTime || null,
      is_all_day: isAllDay,
      crew_id: crewId || null,
      sales_rep_id: salesRepId || null,
      job_id: entryType === 'job_visit' && jobId ? jobId : null,
      service_request_id: entryType === 'assessment' && requestId ? requestId : null,
      title: title || null,
      notes: notes || null,
      estimated_footage: estimatedFootage !== '' ? Number(estimatedFootage) : null,
      estimated_hours: estimatedHours !== '' ? Number(estimatedHours) : null,
    };

    try {
      if (mode === 'create') {
        await createEntry.mutateAsync(data);
      } else if (entryId) {
        await updateEntry.mutateAsync({
          id: entryId,
          ...data,
          status,
        });
      }
      resetForm();
      onClose();
    } catch (error) {
      console.error('Error saving entry:', error);
    }
  };

  // Handle delete
  const handleDelete = async () => {
    if (!entryId || !confirm('Are you sure you want to delete this entry?')) return;

    try {
      await deleteEntry.mutateAsync(entryId);
      resetForm();
      onClose();
    } catch (error) {
      console.error('Error deleting entry:', error);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold text-gray-900">
            {mode === 'create' ? 'New Schedule Entry' : 'Edit Schedule Entry'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Entry Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Type
            </label>
            <div className="grid grid-cols-4 gap-2">
              {[
                { value: 'job_visit', label: 'Job', icon: Truck },
                { value: 'assessment', label: 'Assessment', icon: Clipboard },
                { value: 'blocked', label: 'Blocked', icon: Ban },
                { value: 'meeting', label: 'Meeting', icon: Users },
              ].map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setEntryType(value as ScheduleEntryType)}
                  className={`flex flex-col items-center gap-1 p-2 rounded-lg border transition-colors ${
                    entryType === value
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span className="text-xs">{label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Job/Request Selection */}
          {entryType === 'job_visit' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Job
              </label>
              <select
                value={jobId}
                onChange={(e) => setJobId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Select a job...</option>
                {availableJobs.map((job: any) => (
                  <option key={job.id} value={job.id}>
                    {job.job_number} - {job.client?.name || 'Unknown Client'}
                  </option>
                ))}
              </select>
            </div>
          )}

          {entryType === 'assessment' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Service Request
              </label>
              <select
                value={requestId}
                onChange={(e) => setRequestId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Select a request...</option>
                {availableRequests.map((req: any) => (
                  <option key={req.id} value={req.id}>
                    {req.request_number} - {req.contact_name || 'Unknown'}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <Calendar className="w-4 h-4 inline mr-1" />
              Date
            </label>
            <input
              type="date"
              value={scheduledDate}
              onChange={(e) => setScheduledDate(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* All Day Toggle */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isAllDay"
              checked={isAllDay}
              onChange={(e) => setIsAllDay(e.target.checked)}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <label htmlFor="isAllDay" className="text-sm text-gray-700">
              All day
            </label>
          </div>

          {/* Time Range */}
          {!isAllDay && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <Clock className="w-4 h-4 inline mr-1" />
                  Start Time
                </label>
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  End Time
                </label>
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
          )}

          {/* Assignment */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <Truck className="w-4 h-4 inline mr-1" />
                Crew
              </label>
              <select
                value={crewId}
                onChange={(e) => setCrewId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">No crew</option>
                {crews.map((crew) => (
                  <option key={crew.id} value={crew.id}>
                    {crew.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <User className="w-4 h-4 inline mr-1" />
                Sales Rep
              </label>
              <select
                value={salesRepId}
                onChange={(e) => setSalesRepId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">No rep</option>
                {salesReps.map((rep) => (
                  <option key={rep.id} value={rep.id}>
                    {rep.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Estimates (for jobs) */}
          {entryType === 'job_visit' && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Est. Footage (LF)
                </label>
                <input
                  type="number"
                  value={estimatedFootage}
                  onChange={(e) =>
                    setEstimatedFootage(e.target.value ? Number(e.target.value) : '')
                  }
                  min="0"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Est. Hours
                </label>
                <input
                  type="number"
                  value={estimatedHours}
                  onChange={(e) =>
                    setEstimatedHours(e.target.value ? Number(e.target.value) : '')
                  }
                  min="0"
                  step="0.5"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
          )}

          {/* Title (for blocked/meeting) */}
          {(entryType === 'blocked' || entryType === 'meeting') && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Title
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={entryType === 'blocked' ? 'e.g., PTO, Vacation' : 'e.g., Team Meeting'}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Status (edit mode only) */}
          {mode === 'edit' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as ScheduleEntryStatus)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="scheduled">Scheduled</option>
                <option value="confirmed">Confirmed</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-between pt-4 border-t">
            {mode === 'edit' && (
              <button
                type="button"
                onClick={handleDelete}
                className="flex items-center gap-2 px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </button>
            )}
            <div className="flex items-center gap-2 ml-auto">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={createEntry.isPending || updateEntry.isPending}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                {createEntry.isPending || updateEntry.isPending ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
