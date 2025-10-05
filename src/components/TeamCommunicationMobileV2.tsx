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
  ChevronUp,
  Inbox,
  Send as SendIcon,
  Archive as ArchiveIcon,
  BarChart3,
  CheckCircle2,
  Circle
} from 'lucide-react';

type MessageState = 'unread' | 'read' | 'read_needs_action' | 'read_needs_response' | 'answered' | 'acknowledged' | 'archived';
type ViewMode = 'inbox' | 'sent';
type FilterMode = 'active' | 'archived' | 'drafts';

interface CompanyMessage {
  id: string;
  message_type: string;
  title: string;
  content: string;
  created_by: string;
  created_at: string;
  priority: string;
  requires_acknowledgment: boolean;
  status: 'draft' | 'active' | 'expired' | 'archived';
  is_draft: boolean;
  survey_questions?: {
    questions: SurveyQuestion[];
  };
  recognized_user_id?: string;
  creator_name?: string;
  recognized_user_name?: string;
  message_state?: MessageState;
  engagement_stats?: {
    total_recipients: number;
    opened_count: number;
    acknowledged_count: number;
    responded_count: number;
  };
}

interface SurveyQuestion {
  id: string;
  text: string;
  type: 'multiple_choice' | 'yes_no' | 'rating' | 'short_text' | 'long_text';
  options?: string[];
  allow_multiple?: boolean;
  required?: boolean;
}

interface TeamCommunicationMobileV2Props {
  onBack: () => void;
}

export default function TeamCommunicationMobileV2({ onBack }: TeamCommunicationMobileV2Props) {
  const { user, profile } = useAuth();
  const [viewMode, setViewMode] = useState<ViewMode>('inbox');
  const [filterMode, setFilterMode] = useState<FilterMode>('active');
  const [messages, setMessages] = useState<CompanyMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());

  const canSendMessages = profile?.role === 'admin' || profile?.role === 'sales-manager';

  useEffect(() => {
    loadMessages();
  }, [user, profile, viewMode, filterMode]);

  const loadMessages = async () => {
    if (!user || !profile) return;

    try {
      setLoading(true);

      if (viewMode === 'inbox') {
        await loadInboxMessages();
      } else {
        await loadSentMessages();
      }
    } catch (error) {
      console.error('Error loading messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadInboxMessages = async () => {
    if (!user || !profile) return;

    // Get messages targeted to user
    const { data: messagesData, error } = await supabase
      .from('company_messages')
      .select(`
        *,
        message_engagement!left(opened_at, acknowledged_at, responded_at, is_archived, is_pinned)
      `)
      .or(`target_roles.cs.{${profile.role}},target_user_ids.cs.{${user.id}}`)
      .eq('is_draft', false)
      .order('priority', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) throw error;

    // Get creator names
    const creatorIds = [...new Set(messagesData?.map(m => m.created_by) || [])];
    const { data: creators } = await supabase
      .from('user_profiles')
      .select('id, full_name')
      .in('id', creatorIds);

    const creatorMap = new Map(creators?.map(c => [c.id, c.full_name]));

    // Filter by engagement state
    const enrichedMessages = messagesData?.map(msg => {
      const engagement = msg.message_engagement?.find((e: any) => e);
      const isArchived = engagement?.is_archived || false;

      // Determine message state
      let messageState: MessageState = 'unread';
      if (isArchived) {
        messageState = 'archived';
      } else if (engagement?.responded_at) {
        messageState = 'answered';
      } else if (engagement?.acknowledged_at) {
        messageState = 'acknowledged';
      } else if (engagement?.opened_at) {
        if (msg.requires_acknowledgment) {
          messageState = 'read_needs_action';
        } else if (msg.survey_questions) {
          messageState = 'read_needs_response';
        } else {
          messageState = 'read';
        }
      }

      return {
        ...msg,
        creator_name: creatorMap.get(msg.created_by) || 'Unknown',
        message_state: messageState
      };
    }).filter(msg => {
      if (filterMode === 'active') return msg.message_state !== 'archived';
      if (filterMode === 'archived') return msg.message_state === 'archived';
      return true;
    }) || [];

    setMessages(enrichedMessages);

    // Auto-expand urgent unread
    const urgentUnread = enrichedMessages
      .filter(m => m.priority === 'urgent' && m.message_state === 'unread')
      .map(m => m.id);
    setExpandedCards(new Set(urgentUnread));
  };

  const loadSentMessages = async () => {
    if (!user) return;

    const { data: messagesData, error } = await supabase
      .from('company_messages')
      .select('*')
      .eq('created_by', user.id)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) throw error;

    // Get engagement stats for each message
    const messageIds = messagesData?.map(m => m.id) || [];
    const { data: engagementData } = messageIds.length > 0
      ? await supabase
          .from('message_engagement')
          .select('message_id, opened_at, acknowledged_at, responded_at')
          .in('message_id', messageIds)
      : { data: [] };

    // Calculate stats
    const statsMap = new Map();
    engagementData?.forEach(e => {
      if (!statsMap.has(e.message_id)) {
        statsMap.set(e.message_id, {
          total_recipients: 0,
          opened_count: 0,
          acknowledged_count: 0,
          responded_count: 0
        });
      }
      const stats = statsMap.get(e.message_id);
      stats.total_recipients++;
      if (e.opened_at) stats.opened_count++;
      if (e.acknowledged_at) stats.acknowledged_count++;
      if (e.responded_at) stats.responded_count++;
    });

    const enrichedMessages = messagesData?.map(msg => ({
      ...msg,
      engagement_stats: statsMap.get(msg.id) || {
        total_recipients: 0,
        opened_count: 0,
        acknowledged_count: 0,
        responded_count: 0
      }
    })).filter(msg => {
      if (filterMode === 'active') return !msg.is_draft && msg.status === 'active';
      if (filterMode === 'drafts') return msg.is_draft;
      if (filterMode === 'archived') return msg.status === 'archived' || msg.status === 'expired';
      return true;
    }) || [];

    setMessages(enrichedMessages);
  };

  const markAsOpened = async (messageId: string) => {
    if (!user) return;

    try {
      // Mark as read in receipts
      await supabase
        .from('message_receipts')
        .upsert({
          message_id: messageId,
          user_id: user.id,
          read_at: new Date().toISOString()
        }, { onConflict: 'message_id,user_id' });

      loadMessages();
    } catch (error) {
      console.error('Error marking as opened:', error);
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

  const handleArchive = async (messageId: string) => {
    if (!user) return;

    try {
      await supabase
        .from('message_engagement')
        .update({
          is_archived: true,
          archived_at: new Date().toISOString()
        })
        .eq('message_id', messageId)
        .eq('user_id', user.id);

      loadMessages();
    } catch (error) {
      console.error('Error archiving:', error);
    }
  };

  const toggleExpand = (messageId: string) => {
    const message = messages.find(m => m.id === messageId);
    if (message && message.message_state === 'unread') {
      markAsOpened(messageId);
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

  const getStateLabel = (state: MessageState) => {
    const labels: Record<MessageState, {label: string, color: string, icon: any}> = {
      unread: { label: 'NEW', color: 'bg-indigo-100 text-indigo-700', icon: Circle },
      read: { label: 'READ', color: 'bg-gray-100 text-gray-600', icon: Eye },
      read_needs_action: { label: 'ACTION REQUIRED', color: 'bg-yellow-100 text-yellow-700', icon: AlertTriangle },
      read_needs_response: { label: 'ANSWER SURVEY', color: 'bg-purple-100 text-purple-700', icon: ClipboardList },
      answered: { label: 'COMPLETED', color: 'bg-green-100 text-green-700', icon: CheckCircle2 },
      acknowledged: { label: 'ACKNOWLEDGED', color: 'bg-green-100 text-green-700', icon: CheckCircle2 },
      archived: { label: 'ARCHIVED', color: 'bg-gray-100 text-gray-500', icon: ArchiveIcon }
    };
    return labels[state];
  };

  const getUnreadCount = () => messages.filter(m => m.message_state === 'unread' || m.message_state === 'read_needs_action').length;
  const getDraftsCount = () => messages.filter(m => m.is_draft).length;

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
          </div>
        </div>

        {/* View Mode Tabs */}
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => {
              setViewMode('inbox');
              setFilterMode('active');
            }}
            className={`flex-1 flex items-center justify-center space-x-2 py-3 border-b-2 transition-colors ${
              viewMode === 'inbox'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-gray-500'
            }`}
          >
            <Inbox className="w-5 h-5" />
            <span className="font-medium">Inbox</span>
            {viewMode === 'inbox' && getUnreadCount() > 0 && (
              <span className="bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                {getUnreadCount()}
              </span>
            )}
          </button>
          {canSendMessages && (
            <button
              onClick={() => {
                setViewMode('sent');
                setFilterMode('active');
              }}
              className={`flex-1 flex items-center justify-center space-x-2 py-3 border-b-2 transition-colors ${
                viewMode === 'sent'
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-gray-500'
              }`}
            >
              <SendIcon className="w-5 h-5" />
              <span className="font-medium">Sent</span>
            </button>
          )}
        </div>

        {/* Filter Tabs */}
        <div className="flex space-x-2 px-4 py-3 overflow-x-auto">
          <button
            onClick={() => setFilterMode('active')}
            className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
              filterMode === 'active'
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-100 text-gray-700 active:bg-gray-200'
            }`}
          >
            Active
          </button>
          {viewMode === 'sent' && (
            <button
              onClick={() => setFilterMode('drafts')}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                filterMode === 'drafts'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 text-gray-700 active:bg-gray-200'
              }`}
            >
              Drafts {getDraftsCount() > 0 && `(${getDraftsCount()})`}
            </button>
          )}
          <button
            onClick={() => setFilterMode('archived')}
            className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
              filterMode === 'archived'
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-100 text-gray-700 active:bg-gray-200'
            }`}
          >
            Archived
          </button>
        </div>
      </div>

      {/* Messages Feed */}
      <div className="p-4 space-y-3">
        {messages.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500">
              {filterMode === 'archived' ? 'No archived messages' : 'No messages to show'}
            </p>
          </div>
        ) : viewMode === 'inbox' ? (
          <InboxMessagesList
            messages={messages}
            expandedCards={expandedCards}
            onToggleExpand={toggleExpand}
            onAcknowledge={handleAcknowledge}
            onArchive={handleArchive}
            getMessageConfig={getMessageConfig}
            getStateLabel={getStateLabel}
          />
        ) : (
          <SentMessagesList
            messages={messages}
            expandedCards={expandedCards}
            onToggleExpand={toggleExpand}
            getMessageConfig={getMessageConfig}
          />
        )}
      </div>
    </div>
  );
}

// Inbox Messages List Component
function InboxMessagesList({ messages, expandedCards, onToggleExpand, onAcknowledge, onArchive, getMessageConfig, getStateLabel }: any) {
  return messages.map((msg: CompanyMessage) => {
    const config = getMessageConfig(msg.message_type);
    const Icon = config.icon;
    const isExpanded = expandedCards.has(msg.id);
    const stateInfo = getStateLabel(msg.message_state!);
    const StateIcon = stateInfo.icon;

    return (
      <div
        key={msg.id}
        className={`bg-white rounded-2xl shadow-sm overflow-hidden transition-all ${
          msg.message_state === 'unread' || msg.message_state === 'read_needs_action' ? 'ring-2 ring-indigo-500' : ''
        } ${msg.priority === 'urgent' ? 'border-l-4 border-red-500' : ''}`}
      >
        {/* Card Header */}
        <div onClick={() => onToggleExpand(msg.id)} className="p-4 active:bg-gray-50">
          <div className="flex items-start space-x-3">
            <div className={`${config.iconBg} p-2 rounded-lg flex-shrink-0`}>
              <Icon className={`w-5 h-5 ${config.iconColor}`} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-bold text-gray-900 text-base line-clamp-1">{msg.title}</h3>
                <span className={`px-2 py-0.5 ${stateInfo.color} text-xs font-semibold rounded-full flex items-center space-x-1 flex-shrink-0`}>
                  <StateIcon className="w-3 h-3" />
                  <span>{stateInfo.label}</span>
                </span>
              </div>
              {!isExpanded && (
                <p className="text-sm text-gray-600 mt-1 line-clamp-2">{msg.content}</p>
              )}
              <div className="flex items-center space-x-3 mt-2 text-xs text-gray-500">
                <span>{msg.creator_name}</span>
                <span>•</span>
                <span>{new Date(msg.created_at).toLocaleDateString()}</span>
              </div>
            </div>
            <button className="p-1 -mr-1 flex-shrink-0">
              {isExpanded ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
            </button>
          </div>
        </div>

        {/* Expanded Content */}
        {isExpanded && (
          <div className="px-4 pb-4 space-y-3 border-t border-gray-100 pt-3">
            <p className="text-gray-700 whitespace-pre-wrap">{msg.content}</p>

            {/* Actions */}
            <div className="flex space-x-2">
              {msg.message_state === 'read_needs_action' && (
                <button
                  onClick={() => onAcknowledge(msg.id)}
                  className="flex-1 py-2 bg-indigo-600 text-white rounded-lg font-medium active:bg-indigo-700"
                >
                  Acknowledge
                </button>
              )}
              {msg.message_state !== 'archived' && (
                <button
                  onClick={() => onArchive(msg.id)}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg font-medium active:bg-gray-50"
                >
                  Archive
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    );
  });
}

// Sent Messages List Component
function SentMessagesList({ messages, expandedCards, onToggleExpand, getMessageConfig }: any) {
  return messages.map((msg: CompanyMessage) => {
    const config = getMessageConfig(msg.message_type);
    const Icon = config.icon;
    const isExpanded = expandedCards.has(msg.id);
    const stats = msg.engagement_stats;

    return (
      <div key={msg.id} className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <div onClick={() => onToggleExpand(msg.id)} className="p-4 active:bg-gray-50">
          <div className="flex items-start space-x-3">
            <div className={`${config.iconBg} p-2 rounded-lg flex-shrink-0`}>
              <Icon className={`w-5 h-5 ${config.iconColor}`} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-bold text-gray-900 text-base line-clamp-1">{msg.title}</h3>
                {msg.is_draft && (
                  <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs font-semibold rounded-full flex-shrink-0">
                    DRAFT
                  </span>
                )}
              </div>
              {stats && (
                <div className="flex items-center space-x-3 mt-2 text-xs text-gray-600">
                  <span className="flex items-center space-x-1">
                    <Eye className="w-3 h-3" />
                    <span>{stats.opened_count}/{stats.total_recipients}</span>
                  </span>
                  {msg.requires_acknowledgment && (
                    <>
                      <span>•</span>
                      <span className="flex items-center space-x-1">
                        <Check className="w-3 h-3" />
                        <span>{stats.acknowledged_count}/{stats.total_recipients}</span>
                      </span>
                    </>
                  )}
                  {msg.survey_questions && (
                    <>
                      <span>•</span>
                      <span className="flex items-center space-x-1">
                        <ClipboardList className="w-3 h-3" />
                        <span>{stats.responded_count}/{stats.total_recipients}</span>
                      </span>
                    </>
                  )}
                </div>
              )}
              <div className="text-xs text-gray-500 mt-1">
                {new Date(msg.created_at).toLocaleDateString()}
              </div>
            </div>
            <button className="p-1 -mr-1 flex-shrink-0">
              {isExpanded ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
            </button>
          </div>
        </div>

        {isExpanded && stats && (
          <div className="px-4 pb-4 border-t border-gray-100 pt-3 space-y-3">
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="bg-blue-50 rounded-lg p-3">
                <div className="text-2xl font-bold text-blue-600">{Math.round((stats.opened_count / stats.total_recipients) * 100)}%</div>
                <div className="text-xs text-gray-600 mt-1">Opened</div>
              </div>
              {msg.requires_acknowledgment && (
                <div className="bg-green-50 rounded-lg p-3">
                  <div className="text-2xl font-bold text-green-600">{Math.round((stats.acknowledged_count / stats.total_recipients) * 100)}%</div>
                  <div className="text-xs text-gray-600 mt-1">Acknowledged</div>
                </div>
              )}
              {msg.survey_questions && (
                <div className="bg-purple-50 rounded-lg p-3">
                  <div className="text-2xl font-bold text-purple-600">{Math.round((stats.responded_count / stats.total_recipients) * 100)}%</div>
                  <div className="text-xs text-gray-600 mt-1">Responded</div>
                </div>
              )}
            </div>
            <button className="w-full py-2 border border-indigo-600 text-indigo-600 rounded-lg font-medium active:bg-indigo-50 flex items-center justify-center space-x-2">
              <BarChart3 className="w-4 h-4" />
              <span>View Details</span>
            </button>
          </div>
        )}
      </div>
    );
  });
}
