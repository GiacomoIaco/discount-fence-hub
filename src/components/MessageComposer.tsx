import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import {
  X,
  Send,
  Megaphone,
  AlertTriangle,
  Award,
  ClipboardList,
  FileText,
  GraduationCap,
  CheckSquare,
  Calendar,
  Save
} from 'lucide-react';
import SurveyBuilder, { type SurveyQuestion } from './SurveyBuilder';

interface MessageComposerProps {
  onClose: () => void;
  onMessageSent: () => void;
}

interface UserProfile {
  id: string;
  full_name: string;
  email: string;
  role: string;
}

export default function MessageComposer({ onClose, onMessageSent }: MessageComposerProps) {
  const { user } = useAuth();
  const [messageType, setMessageType] = useState<string>('announcement');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [priority, setPriority] = useState<'low' | 'normal' | 'high' | 'urgent'>('normal');
  const [requiresAcknowledgment, setRequiresAcknowledgment] = useState(false);
  const [targetRoles, setTargetRoles] = useState<string[]>(['sales', 'operations', 'sales-manager', 'admin']);
  const [expiresAt, setExpiresAt] = useState('');
  const [sending, setSending] = useState(false);

  // Survey specific (V2 - multi-question)
  const [surveyQuestions, setSurveyQuestions] = useState<SurveyQuestion[]>([]);
  const [showResultsAfterSubmit, setShowResultsAfterSubmit] = useState(false);
  const [allowEditResponses, setAllowEditResponses] = useState(false);
  const [anonymousResponses, setAnonymousResponses] = useState(false);

  // Recognition specific
  const [recognizedUserId, setRecognizedUserId] = useState('');
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);

  // Event specific
  const [eventDate, setEventDate] = useState('');
  const [eventTime, setEventTime] = useState('');
  const [eventLocation, setEventLocation] = useState('');
  const [rsvpRequired, setRsvpRequired] = useState(false);

  // Task specific
  const [taskDueDate, setTaskDueDate] = useState('');

  const messageTypes = [
    { value: 'announcement', label: 'Announcement', icon: Megaphone, color: 'blue' },
    { value: 'urgent_alert', label: 'Urgent Alert', icon: AlertTriangle, color: 'red' },
    { value: 'recognition', label: 'Recognition', icon: Award, color: 'yellow' },
    { value: 'survey', label: 'Survey', icon: ClipboardList, color: 'purple' },
    { value: 'policy', label: 'Policy', icon: FileText, color: 'indigo' },
    { value: 'training', label: 'Training', icon: GraduationCap, color: 'green' },
    { value: 'task', label: 'Task', icon: CheckSquare, color: 'orange' },
    { value: 'event', label: 'Event', icon: Calendar, color: 'pink' },
  ];

  const roles = [
    { value: 'sales', label: 'Sales' },
    { value: 'operations', label: 'Operations' },
    { value: 'sales-manager', label: 'Sales Manager' },
    { value: 'admin', label: 'Admin' },
  ];

  useEffect(() => {
    loadUsers();
  }, []);

  useEffect(() => {
    // Auto-set priority for urgent alerts
    if (messageType === 'urgent_alert') {
      setPriority('urgent');
      setRequiresAcknowledgment(true);
    }
    // Auto-require acknowledgment for policies
    if (messageType === 'policy') {
      setRequiresAcknowledgment(true);
    }
  }, [messageType]);

  const loadUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('id, full_name, email, role')
        .eq('is_active', true)
        .order('full_name');

      if (!error && data) {
        setAllUsers(data);
      }
    } catch (error) {
      console.error('Error loading users:', error);
    }
  };

  const handleToggleRole = (role: string) => {
    setTargetRoles(prev =>
      prev.includes(role)
        ? prev.filter(r => r !== role)
        : [...prev, role]
    );
  };

  // Removed - user-specific targeting will be added in future update

  const handleSaveDraft = async () => {
    if (!user || !title.trim()) {
      alert('Please enter a title for the draft');
      return;
    }

    try {
      setSending(true);

      const messageData: any = {
        message_type: messageType,
        title: title.trim(),
        content: content.trim(),
        created_by: user.id,
        priority,
        requires_acknowledgment: requiresAcknowledgment,
        target_roles: targetRoles.length > 0 ? targetRoles : null,
        target_user_ids: null,
        expires_at: expiresAt || null,
        is_draft: true,
        status: 'draft'
      };

      // Add survey data if applicable
      if (messageType === 'survey' && surveyQuestions.length > 0) {
        messageData.survey_questions = surveyQuestions;
        messageData.show_results_after_submit = showResultsAfterSubmit;
        messageData.allow_edit_responses = allowEditResponses;
        messageData.anonymous_responses = anonymousResponses;
      }

      // Add other type-specific data
      if (messageType === 'recognition') {
        messageData.recognized_user_id = recognizedUserId;
      }

      if (messageType === 'event') {
        messageData.event_details = {
          date: eventDate,
          time: eventTime,
          location: eventLocation,
          rsvp_required: rsvpRequired
        };
      }

      if (messageType === 'task') {
        messageData.task_details = {
          due_date: taskDueDate,
          assignees: [],
          status: 'pending'
        };
      }

      const { error } = await supabase
        .from('company_messages')
        .insert([messageData]);

      if (error) throw error;

      alert('Draft saved successfully!');
      onMessageSent();
      onClose();
    } catch (error) {
      console.error('Error saving draft:', error);
      alert('Failed to save draft');
    } finally {
      setSending(false);
    }
  };

  const handleSend = async () => {
    if (!user || !title.trim() || !content.trim()) {
      alert('Please fill in title and content');
      return;
    }

    if (targetRoles.length === 0) {
      alert('Please select at least one role');
      return;
    }

    if (messageType === 'survey' && surveyQuestions.length > 0) {
      const invalidQuestions = surveyQuestions.filter(q => !q.text.trim());
      if (invalidQuestions.length > 0) {
        alert('Please fill in all question texts');
        return;
      }
    } else if (messageType === 'survey' && surveyQuestions.length === 0) {
      alert('Please add at least one survey question');
      return;
    }

    if (messageType === 'recognition' && !recognizedUserId) {
      alert('Please select a user to recognize');
      return;
    }

    try {
      setSending(true);

      const messageData: any = {
        message_type: messageType,
        title: title.trim(),
        content: content.trim(),
        created_by: user.id,
        priority,
        requires_acknowledgment: requiresAcknowledgment,
        target_roles: targetRoles.length > 0 ? targetRoles : null,
        target_user_ids: null, // User-specific targeting will be added in future update
        expires_at: expiresAt || null,
        is_draft: false,
        status: 'active'
      };

      // Add type-specific data
      if (messageType === 'survey' && surveyQuestions.length > 0) {
        messageData.survey_questions = surveyQuestions;
        messageData.show_results_after_submit = showResultsAfterSubmit;
        messageData.allow_edit_responses = allowEditResponses;
        messageData.anonymous_responses = anonymousResponses;
      }

      if (messageType === 'recognition') {
        messageData.recognized_user_id = recognizedUserId;
      }

      if (messageType === 'event') {
        messageData.event_details = {
          date: eventDate,
          time: eventTime,
          location: eventLocation,
          rsvp_required: rsvpRequired
        };
      }

      if (messageType === 'task') {
        messageData.task_details = {
          due_date: taskDueDate,
          assignees: [],
          status: 'pending'
        };
      }

      const { error } = await supabase
        .from('company_messages')
        .insert([messageData]);

      if (error) throw error;

      alert('Message sent successfully!');
      onMessageSent();
      onClose();
    } catch (error) {
      console.error('Error sending message:', error);
      alert('Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const selectedType = messageTypes.find(t => t.value === messageType);
  const Icon = selectedType?.icon || Megaphone;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className={`p-2 rounded-lg bg-${selectedType?.color}-100`}>
              <Icon className={`w-6 h-6 text-${selectedType?.color}-600`} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">New Message</h2>
              <p className="text-sm text-gray-600">Send a message to your team</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Message Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Message Type
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {messageTypes.map(type => {
                const TypeIcon = type.icon;
                return (
                  <button
                    key={type.value}
                    onClick={() => setMessageType(type.value)}
                    className={`p-3 rounded-lg border-2 transition-all ${
                      messageType === type.value
                        ? `border-${type.color}-500 bg-${type.color}-50`
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <TypeIcon className={`w-5 h-5 mx-auto mb-1 ${
                      messageType === type.value ? `text-${type.color}-600` : 'text-gray-600'
                    }`} />
                    <span className="text-xs font-medium">{type.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Title *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter message title..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              maxLength={100}
            />
          </div>

          {/* Content */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Message Content *
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Enter your message..."
              rows={6}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
            />
          </div>

          {/* Recognition User Selection */}
          {messageType === 'recognition' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Recognize User *
              </label>
              <select
                value={recognizedUserId}
                onChange={(e) => setRecognizedUserId(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Select user to recognize...</option>
                {allUsers.map(user => (
                  <option key={user.id} value={user.id}>
                    {user.full_name} ({user.role})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Survey Builder */}
          {messageType === 'survey' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="block text-sm font-medium text-gray-700">
                  Survey Questions
                </label>
                <span className="text-xs text-gray-500">
                  {surveyQuestions.length} question{surveyQuestions.length !== 1 ? 's' : ''}
                </span>
              </div>

              <SurveyBuilder
                questions={surveyQuestions}
                onChange={setSurveyQuestions}
              />

              {/* Survey Settings */}
              <div className="space-y-2 pt-4 border-t border-gray-200">
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={showResultsAfterSubmit}
                    onChange={(e) => setShowResultsAfterSubmit(e.target.checked)}
                    className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                  />
                  <span className="text-sm text-gray-700">Show results after user submits</span>
                </label>

                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={allowEditResponses}
                    onChange={(e) => setAllowEditResponses(e.target.checked)}
                    className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                  />
                  <span className="text-sm text-gray-700">Allow users to edit their responses</span>
                </label>

                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={anonymousResponses}
                    onChange={(e) => setAnonymousResponses(e.target.checked)}
                    className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                  />
                  <span className="text-sm text-gray-700">Anonymous responses (hide names in results)</span>
                </label>
              </div>
            </div>
          )}

          {/* Event Details */}
          {messageType === 'event' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Event Date
                  </label>
                  <input
                    type="date"
                    value={eventDate}
                    onChange={(e) => setEventDate(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Event Time
                  </label>
                  <input
                    type="time"
                    value={eventTime}
                    onChange={(e) => setEventTime(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Location
                </label>
                <input
                  type="text"
                  value={eventLocation}
                  onChange={(e) => setEventLocation(e.target.value)}
                  placeholder="Event location or meeting link..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={rsvpRequired}
                  onChange={(e) => setRsvpRequired(e.target.checked)}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">Require RSVP</span>
              </label>
            </div>
          )}

          {/* Task Details */}
          {messageType === 'task' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Due Date
              </label>
              <input
                type="date"
                value={taskDueDate}
                onChange={(e) => setTaskDueDate(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          )}

          {/* Priority */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Priority
            </label>
            <div className="grid grid-cols-4 gap-2">
              {['low', 'normal', 'high', 'urgent'].map(p => (
                <button
                  key={p}
                  onClick={() => setPriority(p as any)}
                  disabled={messageType === 'urgent_alert'}
                  className={`px-4 py-2 rounded-lg border-2 transition-all capitalize ${
                    priority === p
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-200 hover:border-gray-300'
                  } ${messageType === 'urgent_alert' ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* Target Roles */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Send to Roles *
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {roles.map(role => (
                <button
                  key={role.value}
                  onClick={() => handleToggleRole(role.value)}
                  className={`px-4 py-2 rounded-lg border-2 transition-all ${
                    targetRoles.includes(role.value)
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  {role.label}
                </button>
              ))}
            </div>
          </div>

          {/* Options */}
          <div className="space-y-3">
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={requiresAcknowledgment}
                onChange={(e) => setRequiresAcknowledgment(e.target.checked)}
                disabled={messageType === 'urgent_alert' || messageType === 'policy'}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">Require acknowledgment</span>
            </label>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Expires On (Optional)
              </label>
              <input
                type="datetime-local"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-4 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
          >
            Cancel
          </button>
          <div className="flex items-center space-x-3">
            <button
              onClick={handleSaveDraft}
              disabled={sending || !title.trim()}
              className="flex items-center space-x-2 px-6 py-2 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save className="w-4 h-4" />
              <span>Save Draft</span>
            </button>
            <button
              onClick={handleSend}
              disabled={sending || !title.trim() || !content.trim()}
              className="flex items-center space-x-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send className="w-4 h-4" />
              <span>{sending ? 'Sending...' : 'Send Message'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
