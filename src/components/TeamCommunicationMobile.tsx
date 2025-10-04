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
  CheckSquare,
  Calendar,
  Check,
  Eye,
  ArrowLeft,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

interface CompanyMessage {
  id: string;
  message_type: 'announcement' | 'urgent_alert' | 'recognition' | 'survey' | 'policy' | 'training' | 'discussion' | 'task' | 'event';
  title: string;
  content: string;
  created_by: string;
  created_at: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  requires_acknowledgment: boolean;
  survey_options?: {
    options: string[];
    allow_multiple: boolean;
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
  selected_options?: string[];
  created_at: string;
}

interface TeamCommunicationMobileProps {
  onBack: () => void;
}

export default function TeamCommunicationMobile({ onBack }: TeamCommunicationMobileProps) {
  const { user, profile } = useAuth();
  const [messages, setMessages] = useState<CompanyMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());

  const filters = [
    { id: 'all', label: 'All' },
    { id: 'urgent', label: 'Urgent' },
    { id: 'new', label: 'New' },
    { id: 'survey', label: 'Surveys' },
  ];

  useEffect(() => {
    loadMessages();
  }, [user, profile]);

  const loadMessages = async () => {
    if (!user || !profile) return;

    try {
      setLoading(true);

      const { data: messagesData, error } = await supabase
        .from('company_messages')
        .select(`
          *,
          message_receipts!left(id, read_at, user_id)
        `)
        .or(`target_roles.cs.{${profile.role}},target_user_ids.cs.{${user.id}}`)
        .eq('is_archived', false)
        .order('priority', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      // Get creator names
      const creatorIds = [...new Set(messagesData?.map(m => m.created_by) || [])];
      const { data: creators } = await supabase
        .from('user_profiles')
        .select('id, full_name')
        .in('id', creatorIds);

      // Get recognized user names
      const recognizedIds = messagesData?.filter(m => m.recognized_user_id).map(m => m.recognized_user_id) || [];
      const { data: recognizedUsers } = recognizedIds.length > 0
        ? await supabase.from('user_profiles').select('id, full_name').in('id', recognizedIds)
        : { data: [] };

      // Get user responses
      const messageIds = messagesData?.map(m => m.id) || [];
      const { data: responses } = messageIds.length > 0
        ? await supabase.from('message_responses').select('*').in('message_id', messageIds).eq('user_id', user.id)
        : { data: [] };

      const creatorMap = new Map(creators?.map(c => [c.id, c.full_name]));
      const recognizedMap = new Map(recognizedUsers?.map(u => [u.id, u.full_name]));
      const responseMap = new Map(responses?.map(r => [r.message_id, r]));

      const enrichedMessages = messagesData?.map(msg => ({
        ...msg,
        creator_name: creatorMap.get(msg.created_by) || 'Unknown',
        recognized_user_name: msg.recognized_user_id ? recognizedMap.get(msg.recognized_user_id) : undefined,
        is_read: msg.message_receipts?.some((r: any) => r.user_id === user.id),
        user_response: responseMap.get(msg.id)
      })) || [];

      setMessages(enrichedMessages);

      // Auto-expand urgent unread messages
      const urgentUnread = enrichedMessages
        .filter(m => m.priority === 'urgent' && !m.is_read)
        .map(m => m.id);
      setExpandedCards(new Set(urgentUnread));
    } catch (error) {
      console.error('Error loading messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (messageId: string) => {
    if (!user) return;

    try {
      await supabase
        .from('message_receipts')
        .upsert({
          message_id: messageId,
          user_id: user.id,
          read_at: new Date().toISOString()
        }, { onConflict: 'message_id,user_id' });

      setMessages(prev => prev.map(m =>
        m.id === messageId ? { ...m, is_read: true } : m
      ));
    } catch (error) {
      console.error('Error marking as read:', error);
    }
  };

  const handleAcknowledge = async (messageId: string) => {
    if (!user) return;

    try {
      await supabase
        .from('message_responses')
        .upsert({
          message_id: messageId,
          user_id: user.id,
          response_type: 'acknowledgment'
        }, { onConflict: 'message_id,user_id' });

      loadMessages();
    } catch (error) {
      console.error('Error acknowledging:', error);
    }
  };

  const handleSurveyResponse = async (messageId: string, selectedOptions: string[]) => {
    if (!user) return;

    try {
      await supabase
        .from('message_responses')
        .upsert({
          message_id: messageId,
          user_id: user.id,
          response_type: 'survey_answer',
          selected_options: selectedOptions
        }, { onConflict: 'message_id,user_id' });

      loadMessages();
    } catch (error) {
      console.error('Error submitting survey:', error);
    }
  };

  const toggleExpand = (messageId: string) => {
    const message = messages.find(m => m.id === messageId);
    if (message && !message.is_read) {
      markAsRead(messageId);
    }

    setExpandedCards(prev => {
      const newSet = new Set(prev);
      if (newSet.has(messageId)) {
        newSet.delete(messageId);
      } else {
        newSet.add(messageId);
      }
      return newSet;
    });
  };

  const getMessageConfig = (type: string) => {
    const configs: Record<string, any> = {
      announcement: { icon: Megaphone, color: 'from-blue-500 to-blue-600', iconBg: 'bg-blue-100', iconColor: 'text-blue-600' },
      urgent_alert: { icon: AlertTriangle, color: 'from-red-500 to-red-600', iconBg: 'bg-red-100', iconColor: 'text-red-600' },
      recognition: { icon: Award, color: 'from-yellow-500 to-yellow-600', iconBg: 'bg-yellow-100', iconColor: 'text-yellow-600' },
      survey: { icon: ClipboardList, color: 'from-purple-500 to-purple-600', iconBg: 'bg-purple-100', iconColor: 'text-purple-600' },
      policy: { icon: FileText, color: 'from-indigo-500 to-indigo-600', iconBg: 'bg-indigo-100', iconColor: 'text-indigo-600' },
      training: { icon: GraduationCap, color: 'from-green-500 to-green-600', iconBg: 'bg-green-100', iconColor: 'text-green-600' },
      task: { icon: CheckSquare, color: 'from-orange-500 to-orange-600', iconBg: 'bg-orange-100', iconColor: 'text-orange-600' },
      event: { icon: Calendar, color: 'from-pink-500 to-pink-600', iconBg: 'bg-pink-100', iconColor: 'text-pink-600' },
    };
    return configs[type] || configs.announcement;
  };

  const filteredMessages = messages.filter(msg => {
    if (filter === 'urgent') return msg.priority === 'urgent';
    if (filter === 'new') return !msg.is_read;
    if (filter === 'survey') return msg.message_type === 'survey' && !msg.user_response;
    return true;
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading messages...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-20">
        <div className="flex items-center space-x-4 p-4">
          <button onClick={onBack} className="p-2 -ml-2 active:bg-gray-100 rounded-lg">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-gray-900">Messages</h1>
            <p className="text-sm text-gray-600">Team updates</p>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex space-x-2 px-4 pb-3 overflow-x-auto">
          {filters.map(f => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                filter === f.id
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 text-gray-700 active:bg-gray-200'
              }`}
            >
              {f.label}
              {f.id === 'new' && messages.filter(m => !m.is_read).length > 0 && (
                <span className="ml-1">({messages.filter(m => !m.is_read).length})</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Feed */}
      <div className="p-4 space-y-3">
        {filteredMessages.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500">No messages to show</p>
          </div>
        ) : (
          filteredMessages.map(msg => {
            const config = getMessageConfig(msg.message_type);
            const Icon = config.icon;
            const isExpanded = expandedCards.has(msg.id);
            const needsAction = msg.requires_acknowledgment && !msg.user_response;
            const isSurvey = msg.message_type === 'survey' && !msg.user_response;

            return (
              <div
                key={msg.id}
                className={`bg-white rounded-2xl shadow-sm overflow-hidden transition-all ${
                  !msg.is_read ? 'ring-2 ring-indigo-500' : ''
                } ${msg.priority === 'urgent' ? 'border-l-4 border-red-500' : ''}`}
              >
                {/* Card Header */}
                <div
                  onClick={() => toggleExpand(msg.id)}
                  className="p-4 active:bg-gray-50"
                >
                  <div className="flex items-start space-x-3">
                    <div className={`${config.iconBg} p-2 rounded-lg flex-shrink-0`}>
                      <Icon className={`w-5 h-5 ${config.iconColor}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between">
                        <h3 className="font-bold text-gray-900 text-base line-clamp-1">{msg.title}</h3>
                        {!msg.is_read && (
                          <span className="ml-2 px-2 py-0.5 bg-indigo-100 text-indigo-700 text-xs font-semibold rounded-full flex-shrink-0">
                            NEW
                          </span>
                        )}
                      </div>
                      {!isExpanded && (
                        <p className="text-sm text-gray-600 mt-1 line-clamp-2">{msg.content}</p>
                      )}
                      <div className="flex items-center space-x-3 mt-2 text-xs text-gray-500">
                        <span>{msg.creator_name}</span>
                        <span>•</span>
                        <span>{new Date(msg.created_at).toLocaleDateString()}</span>
                        {msg.view_count > 0 && (
                          <>
                            <span>•</span>
                            <span className="flex items-center space-x-1">
                              <Eye className="w-3 h-3" />
                              <span>{msg.view_count}</span>
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                    <button className="p-1 -mr-1 flex-shrink-0">
                      {isExpanded ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
                    </button>
                  </div>
                </div>

                {/* Expanded Content */}
                {isExpanded && (
                  <div className="px-4 pb-4 space-y-3">
                    <p className="text-gray-700 whitespace-pre-wrap">{msg.content}</p>

                    {/* Recognition */}
                    {msg.message_type === 'recognition' && msg.recognized_user_name && (
                      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                        <div className="flex items-center space-x-2">
                          <Award className="w-4 h-4 text-yellow-600" />
                          <span className="text-sm font-semibold text-yellow-900">Recognizing: {msg.recognized_user_name}</span>
                        </div>
                      </div>
                    )}

                    {/* Survey */}
                    {isSurvey && msg.survey_options && (
                      <SurveyWidget
                        options={msg.survey_options.options}
                        allowMultiple={msg.survey_options.allow_multiple}
                        onSubmit={(selected) => handleSurveyResponse(msg.id, selected)}
                      />
                    )}

                    {/* Survey Response (Already answered) */}
                    {msg.message_type === 'survey' && msg.user_response && msg.survey_options && (
                      <div className="space-y-2">
                        {msg.survey_options.options.map((option, idx) => (
                          <div
                            key={idx}
                            className={`p-2 rounded-lg ${
                              msg.user_response?.selected_options?.includes(option)
                                ? 'bg-purple-50 border border-purple-300'
                                : 'bg-gray-50'
                            }`}
                          >
                            <div className="flex items-center space-x-2">
                              {msg.user_response?.selected_options?.includes(option) && (
                                <Check className="w-4 h-4 text-purple-600" />
                              )}
                              <span className="text-sm">{option}</span>
                            </div>
                          </div>
                        ))}
                        <p className="text-xs text-gray-500 mt-2">
                          ✓ Answered on {new Date(msg.user_response.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    )}

                    {/* Acknowledgment */}
                    {needsAction && (
                      <button
                        onClick={() => handleAcknowledge(msg.id)}
                        className="w-full py-3 bg-indigo-600 text-white rounded-lg font-medium active:bg-indigo-700"
                      >
                        Acknowledge
                      </button>
                    )}

                    {msg.user_response?.response_type === 'acknowledgment' && (
                      <div className="flex items-center space-x-2 text-green-600 text-sm">
                        <Check className="w-4 h-4" />
                        <span>Acknowledged on {new Date(msg.user_response.created_at).toLocaleDateString()}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Action Required Badge */}
                {!isExpanded && (needsAction || isSurvey) && (
                  <div className="px-4 pb-3">
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2">
                      <p className="text-xs font-semibold text-yellow-800">
                        {needsAction ? '⚠️ Action Required' : '📊 Survey - Tap to answer'}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// Survey Widget Component
function SurveyWidget({
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
        prev.includes(option) ? prev.filter(o => o !== option) : [...prev, option]
      );
    } else {
      setSelected([option]);
    }
  };

  return (
    <div className="space-y-2">
      {options.map((option, idx) => (
        <button
          key={idx}
          onClick={() => handleToggle(option)}
          className={`w-full p-3 rounded-lg border-2 text-left transition-colors ${
            selected.includes(option)
              ? 'border-purple-500 bg-purple-50 text-purple-900'
              : 'border-gray-200 bg-white active:border-purple-300'
          }`}
        >
          <div className="flex items-center space-x-3">
            <div
              className={`w-5 h-5 ${allowMultiple ? 'rounded-md' : 'rounded-full'} border-2 flex items-center justify-center ${
                selected.includes(option) ? 'bg-purple-600 border-purple-600' : 'border-gray-300'
              }`}
            >
              {selected.includes(option) && <Check className="w-3 h-3 text-white" />}
            </div>
            <span className="text-sm">{option}</span>
          </div>
        </button>
      ))}
      <button
        onClick={() => onSubmit(selected)}
        disabled={selected.length === 0}
        className="w-full py-3 bg-purple-600 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed active:bg-purple-700"
      >
        Submit Response
      </button>
    </div>
  );
}
