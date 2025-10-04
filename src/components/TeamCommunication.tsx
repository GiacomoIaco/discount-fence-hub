import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import {
  Megaphone,
  AlertTriangle,
  Award,
  ClipboardList,
  FileText,
  GraduationCap,
  MessageCircle,
  CheckSquare,
  Calendar,
  ChevronDown,
  ChevronUp,
  Check,
  X,
  Eye,
  Users,
  Search,
  Filter,
  ArrowLeft,
  ExternalLink,
  Heart,
  ThumbsUp,
  Smile
} from 'lucide-react';

interface CompanyMessage {
  id: string;
  message_type: 'announcement' | 'urgent_alert' | 'recognition' | 'survey' | 'policy' | 'training' | 'discussion' | 'task' | 'event';
  title: string;
  content: string;
  created_by: string;
  created_at: string;
  target_roles: string[];
  target_user_ids?: string[];
  priority: 'low' | 'normal' | 'high' | 'urgent';
  requires_acknowledgment: boolean;
  expires_at?: string;
  is_archived: boolean;
  linked_resource_id?: string;
  survey_options?: {
    options: string[];
    allow_multiple: boolean;
  };
  event_details?: {
    date: string;
    time: string;
    location: string;
    rsvp_required: boolean;
  };
  task_details?: {
    due_date: string;
    assignees: string[];
    status: string;
  };
  recognized_user_id?: string;
  view_count: number;
  response_count: number;
  creator_name?: string;
  recognized_user_name?: string;
  is_read?: boolean;
  user_response?: MessageResponse;
}

interface MessageResponse {
  id: string;
  response_type: 'acknowledgment' | 'survey_answer' | 'comment' | 'reaction' | 'rsvp';
  text_response?: string;
  selected_options?: string[];
  reaction_emoji?: string;
  rsvp_status?: 'yes' | 'no' | 'maybe';
  created_at: string;
}

interface TeamCommunicationProps {
  onBack?: () => void;
}

export default function TeamCommunication({ onBack }: TeamCommunicationProps) {
  const { user, userProfile } = useAuth();
  const [messages, setMessages] = useState<CompanyMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedType, setSelectedType] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedMessage, setExpandedMessage] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);

  const messageTypes = [
    { value: 'all', label: 'All Messages', icon: MessageCircle },
    { value: 'announcement', label: 'Announcements', icon: Megaphone },
    { value: 'urgent_alert', label: 'Urgent Alerts', icon: AlertTriangle },
    { value: 'recognition', label: 'Recognition', icon: Award },
    { value: 'survey', label: 'Surveys', icon: ClipboardList },
    { value: 'policy', label: 'Policies', icon: FileText },
    { value: 'training', label: 'Training', icon: GraduationCap },
    { value: 'task', label: 'Tasks', icon: CheckSquare },
    { value: 'event', label: 'Events', icon: Calendar },
  ];

  useEffect(() => {
    loadMessages();
    loadUnreadCount();
  }, [user, userProfile]);

  const loadMessages = async () => {
    if (!user || !userProfile) return;

    try {
      setLoading(true);

      // Get messages that target user's role or specific user
      const { data: messagesData, error: messagesError } = await supabase
        .from('company_messages')
        .select(`
          *,
          message_receipts!left(id, read_at, user_id)
        `)
        .or(`target_roles.cs.{${userProfile.role}},target_user_ids.cs.{${user.id}}`)
        .eq('is_archived', false)
        .order('created_at', { ascending: false });

      if (messagesError) throw messagesError;

      // Get creator names
      const creatorIds = [...new Set(messagesData?.map(m => m.created_by) || [])];
      const { data: creators } = await supabase
        .from('user_profiles')
        .select('id, full_name')
        .in('id', creatorIds);

      // Get recognized user names
      const recognizedIds = messagesData
        ?.filter(m => m.recognized_user_id)
        .map(m => m.recognized_user_id) || [];

      const { data: recognizedUsers } = recognizedIds.length > 0
        ? await supabase
            .from('user_profiles')
            .select('id, full_name')
            .in('id', recognizedIds)
        : { data: [] };

      // Get user responses
      const messageIds = messagesData?.map(m => m.id) || [];
      const { data: responses } = messageIds.length > 0
        ? await supabase
            .from('message_responses')
            .select('*')
            .in('message_id', messageIds)
            .eq('user_id', user.id)
        : { data: [] };

      const creatorMap = new Map(creators?.map(c => [c.id, c.full_name]));
      const recognizedMap = new Map(recognizedUsers?.map(u => [u.id, u.full_name]));
      const responseMap = new Map(responses?.map(r => [r.message_id, r]));

      const enrichedMessages = messagesData?.map(msg => ({
        ...msg,
        creator_name: creatorMap.get(msg.created_by) || 'Unknown',
        recognized_user_name: msg.recognized_user_id
          ? recognizedMap.get(msg.recognized_user_id) || 'Unknown'
          : undefined,
        is_read: msg.message_receipts?.some((r: any) => r.user_id === user.id),
        user_response: responseMap.get(msg.id)
      })) || [];

      setMessages(enrichedMessages);
    } catch (error) {
      console.error('Error loading messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadUnreadCount = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('user_unread_messages')
        .select('unread_count')
        .eq('user_id', user.id)
        .single();

      if (!error && data) {
        setUnreadCount(data.unread_count || 0);
      }
    } catch (error) {
      console.error('Error loading unread count:', error);
    }
  };

  const markAsRead = async (messageId: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('message_receipts')
        .upsert({
          message_id: messageId,
          user_id: user.id,
          read_at: new Date().toISOString()
        }, { onConflict: 'message_id,user_id' });

      if (!error) {
        setMessages(prev => prev.map(m =>
          m.id === messageId ? { ...m, is_read: true } : m
        ));
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error('Error marking as read:', error);
    }
  };

  const handleAcknowledge = async (messageId: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('message_responses')
        .upsert({
          message_id: messageId,
          user_id: user.id,
          response_type: 'acknowledgment'
        }, { onConflict: 'message_id,user_id' });

      if (!error) {
        loadMessages();
      }
    } catch (error) {
      console.error('Error acknowledging message:', error);
    }
  };

  const handleSurveyResponse = async (messageId: string, selectedOptions: string[]) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('message_responses')
        .upsert({
          message_id: messageId,
          user_id: user.id,
          response_type: 'survey_answer',
          selected_options: selectedOptions
        }, { onConflict: 'message_id,user_id' });

      if (!error) {
        loadMessages();
      }
    } catch (error) {
      console.error('Error submitting survey response:', error);
    }
  };

  const handleToggleExpand = (messageId: string) => {
    if (expandedMessage === messageId) {
      setExpandedMessage(null);
    } else {
      setExpandedMessage(messageId);
      const message = messages.find(m => m.id === messageId);
      if (message && !message.is_read) {
        markAsRead(messageId);
      }
    }
  };

  const getMessageIcon = (type: string) => {
    const iconMap: Record<string, any> = {
      announcement: Megaphone,
      urgent_alert: AlertTriangle,
      recognition: Award,
      survey: ClipboardList,
      policy: FileText,
      training: GraduationCap,
      discussion: MessageCircle,
      task: CheckSquare,
      event: Calendar
    };
    return iconMap[type] || MessageCircle;
  };

  const getPriorityColor = (priority: string) => {
    const colorMap: Record<string, string> = {
      low: 'text-gray-500 bg-gray-100',
      normal: 'text-blue-500 bg-blue-100',
      high: 'text-orange-500 bg-orange-100',
      urgent: 'text-red-500 bg-red-100'
    };
    return colorMap[priority] || 'text-gray-500 bg-gray-100';
  };

  const filteredMessages = messages.filter(msg => {
    const matchesType = selectedType === 'all' || msg.message_type === selectedType;
    const matchesSearch = msg.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         msg.content.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesType && matchesSearch;
  });

  const canCreateMessages = userProfile?.role === 'admin' || userProfile?.role === 'sales-manager';

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading messages...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-4">
              {onBack && (
                <button
                  onClick={onBack}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
              )}
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Team Communication</h1>
                <p className="text-sm text-gray-600">Company updates and announcements</p>
              </div>
            </div>
            {unreadCount > 0 && (
              <div className="flex items-center space-x-2 px-4 py-2 bg-blue-100 rounded-lg">
                <div className="w-2 h-2 bg-blue-600 rounded-full animate-pulse"></div>
                <span className="text-sm font-semibold text-blue-600">
                  {unreadCount} unread
                </span>
              </div>
            )}
          </div>

          {/* Search and Filter */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search messages..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {messageTypes.map(type => (
                <option key={type.value} value={type.value}>{type.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Messages List */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {filteredMessages.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm p-12 text-center">
            <MessageCircle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No messages found</h3>
            <p className="text-gray-600">
              {searchQuery || selectedType !== 'all'
                ? 'Try adjusting your search or filters'
                : 'No messages have been posted yet'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredMessages.map(message => {
              const Icon = getMessageIcon(message.message_type);
              const isExpanded = expandedMessage === message.id;

              return (
                <div
                  key={message.id}
                  className={`bg-white rounded-xl shadow-sm overflow-hidden transition-all ${
                    !message.is_read ? 'ring-2 ring-blue-500' : ''
                  } ${message.priority === 'urgent' ? 'border-l-4 border-red-500' : ''}`}
                >
                  {/* Message Header */}
                  <div
                    onClick={() => handleToggleExpand(message.id)}
                    className="p-6 cursor-pointer hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start space-x-4 flex-1">
                        <div className={`p-3 rounded-lg ${getPriorityColor(message.priority)}`}>
                          <Icon className="w-6 h-6" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-2 mb-1">
                            <h3 className="text-lg font-semibold text-gray-900 truncate">
                              {message.title}
                            </h3>
                            {!message.is_read && (
                              <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-semibold rounded">
                                NEW
                              </span>
                            )}
                            {message.requires_acknowledgment && !message.user_response && (
                              <span className="px-2 py-1 bg-yellow-100 text-yellow-700 text-xs font-semibold rounded">
                                ACTION REQUIRED
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-gray-600 line-clamp-2">
                            {message.content}
                          </p>
                          <div className="flex items-center space-x-4 mt-2 text-xs text-gray-500">
                            <span>From: {message.creator_name}</span>
                            <span>•</span>
                            <span>{new Date(message.created_at).toLocaleDateString()}</span>
                            {message.view_count > 0 && (
                              <>
                                <span>•</span>
                                <span className="flex items-center space-x-1">
                                  <Eye className="w-3 h-3" />
                                  <span>{message.view_count} views</span>
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                      <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                        {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>

                  {/* Expanded Content */}
                  {isExpanded && (
                    <div className="px-6 pb-6 border-t border-gray-100">
                      <div className="mt-4 prose max-w-none">
                        <p className="text-gray-700 whitespace-pre-wrap">{message.content}</p>
                      </div>

                      {/* Recognition Details */}
                      {message.message_type === 'recognition' && message.recognized_user_name && (
                        <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                          <div className="flex items-center space-x-2">
                            <Award className="w-5 h-5 text-yellow-600" />
                            <span className="font-semibold text-yellow-900">
                              Recognizing: {message.recognized_user_name}
                            </span>
                          </div>
                        </div>
                      )}

                      {/* Survey */}
                      {message.message_type === 'survey' && message.survey_options && (
                        <div className="mt-4">
                          <h4 className="font-semibold text-gray-900 mb-3">Survey Options:</h4>
                          {message.user_response ? (
                            <div className="space-y-2">
                              {message.survey_options.options.map((option, idx) => (
                                <div
                                  key={idx}
                                  className={`p-3 rounded-lg border ${
                                    message.user_response?.selected_options?.includes(option)
                                      ? 'bg-blue-50 border-blue-300'
                                      : 'bg-gray-50 border-gray-200'
                                  }`}
                                >
                                  <div className="flex items-center space-x-2">
                                    {message.user_response?.selected_options?.includes(option) && (
                                      <Check className="w-5 h-5 text-blue-600" />
                                    )}
                                    <span>{option}</span>
                                  </div>
                                </div>
                              ))}
                              <p className="text-sm text-gray-600 mt-2">
                                ✓ You submitted your response on{' '}
                                {new Date(message.user_response.created_at).toLocaleDateString()}
                              </p>
                            </div>
                          ) : (
                            <SurveyResponse
                              options={message.survey_options.options}
                              allowMultiple={message.survey_options.allow_multiple}
                              onSubmit={(selected) => handleSurveyResponse(message.id, selected)}
                            />
                          )}
                        </div>
                      )}

                      {/* Acknowledgment */}
                      {message.requires_acknowledgment && (
                        <div className="mt-4">
                          {message.user_response?.response_type === 'acknowledgment' ? (
                            <div className="flex items-center space-x-2 text-green-600">
                              <Check className="w-5 h-5" />
                              <span className="font-medium">
                                Acknowledged on{' '}
                                {new Date(message.user_response.created_at).toLocaleDateString()}
                              </span>
                            </div>
                          ) : (
                            <button
                              onClick={() => handleAcknowledge(message.id)}
                              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                            >
                              Acknowledge
                            </button>
                          )}
                        </div>
                      )}

                      {/* Linked Resource */}
                      {message.linked_resource_id && (
                        <div className="mt-4">
                          <a
                            href="#"
                            className="flex items-center space-x-2 text-blue-600 hover:text-blue-700"
                          >
                            <ExternalLink className="w-4 h-4" />
                            <span>View linked document</span>
                          </a>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// Survey Response Component
function SurveyResponse({
  options,
  allowMultiple,
  onSubmit
}: {
  options: string[];
  allowMultiple: boolean;
  onSubmit: (selected: string[]) => void;
}) {
  const [selected, setSelected] = useState<string[]>([]);

  const handleToggle = (option: string) => {
    if (allowMultiple) {
      setSelected(prev =>
        prev.includes(option)
          ? prev.filter(o => o !== option)
          : [...prev, option]
      );
    } else {
      setSelected([option]);
    }
  };

  return (
    <div className="space-y-3">
      {options.map((option, idx) => (
        <button
          key={idx}
          onClick={() => handleToggle(option)}
          className={`w-full p-3 rounded-lg border text-left transition-colors ${
            selected.includes(option)
              ? 'bg-blue-50 border-blue-300 text-blue-900'
              : 'bg-white border-gray-300 hover:border-blue-300'
          }`}
        >
          <div className="flex items-center space-x-3">
            <div
              className={`w-5 h-5 rounded ${
                allowMultiple ? 'rounded-md' : 'rounded-full'
              } border-2 flex items-center justify-center ${
                selected.includes(option)
                  ? 'bg-blue-600 border-blue-600'
                  : 'border-gray-300'
              }`}
            >
              {selected.includes(option) && (
                <Check className="w-3 h-3 text-white" />
              )}
            </div>
            <span>{option}</span>
          </div>
        </button>
      ))}
      <button
        onClick={() => onSubmit(selected)}
        disabled={selected.length === 0}
        className="w-full px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Submit Response
      </button>
    </div>
  );
}
