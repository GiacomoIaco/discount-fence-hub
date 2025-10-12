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
  Circle,
  Search,
  X,
  Share2
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
  target_roles?: string[];
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

interface TeamCommunicationProps {
  onBack?: () => void;
}

interface CommentWithUser {
  id: string;
  message_id: string;
  user_id: string;
  user_name: string;
  text_response: string;
  created_at: string;
}

export default function TeamCommunication({ onBack }: TeamCommunicationProps) {
  const { user, profile } = useAuth();
  const [viewMode, setViewMode] = useState<ViewMode>('inbox');
  const [filterMode, setFilterMode] = useState<FilterMode>('active');
  const [messages, setMessages] = useState<CompanyMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSurvey, setSelectedSurvey] = useState<CompanyMessage | null>(null);
  const [showSurveyResults, setShowSurveyResults] = useState(false);
  const [comments, setComments] = useState<Map<string, CommentWithUser[]>>(new Map());

  useEffect(() => {
    // Clear state when switching views to prevent stale data
    setComments(new Map());
    setExpandedCards(new Set());
    loadMessages();
  }, [user, profile, viewMode, filterMode]);

  const loadMessages = async () => {
    if (!user || !profile) {
      setLoading(false);
      setMessages([]);
      return;
    }

    try {
      setLoading(true);

      if (viewMode === 'inbox') {
        await loadInboxMessages();
      } else {
        await loadSentMessages();
      }
    } catch (error) {
      console.error('Error loading messages:', error);
      setMessages([]);
    } finally {
      setLoading(false);
    }
  };

  const loadInboxMessages = async () => {
    if (!user || !profile) return;

    // Get messages targeted to user
    const { data: messagesData, error } = await supabase
      .from('company_messages')
      .select('*')
      .or(`target_roles.cs.{${profile.role}},target_user_ids.cs.{${user.id}}`)
      .eq('is_draft', false)
      .order('priority', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      console.error('Error loading inbox messages:', error);
      throw error;
    }

    // Get engagement data for current user
    const messageIds = messagesData?.map(m => m.id) || [];
    const { data: engagementData } = messageIds.length > 0
      ? await supabase
          .from('message_engagement')
          .select('*')
          .in('message_id', messageIds)
          .eq('user_id', user.id)
      : { data: [] };

    const engagementMap = new Map(engagementData?.map(e => [e.message_id, e]) || []);

    // Get creator names
    const creatorIds = [...new Set(messagesData?.map(m => m.created_by) || [])];
    const { data: creators } = await supabase
      .from('user_profiles')
      .select('id, full_name')
      .in('id', creatorIds);

    const creatorMap = new Map(creators?.map(c => [c.id, c.full_name]));

    // Filter by engagement state
    const enrichedMessages = messagesData?.map(msg => {
      const engagement = engagementMap.get(msg.id);
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
      // Filter by mode
      const modeMatch = filterMode === 'active' ? msg.message_state !== 'archived' :
                       filterMode === 'archived' ? msg.message_state === 'archived' : true;

      // Filter by search query
      const searchMatch = !searchQuery ||
        msg.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        msg.content.toLowerCase().includes(searchQuery.toLowerCase());

      return modeMatch && searchMatch;
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

    if (error) {
      console.error('Error loading sent messages:', error);
      throw error;
    }

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
      // Filter by mode
      const modeMatch = filterMode === 'active' ? !msg.is_draft && msg.status === 'active' :
                       filterMode === 'drafts' ? msg.is_draft :
                       filterMode === 'archived' ? msg.status === 'archived' || msg.status === 'expired' : true;

      // Filter by search query
      const searchMatch = !searchQuery ||
        msg.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        msg.content.toLowerCase().includes(searchQuery.toLowerCase());

      return modeMatch && searchMatch;
    }) || [];

    setMessages(enrichedMessages);

    // Load comments for sent messages
    if (enrichedMessages.length > 0) {
      await loadComments(messageIds);
    }
  };

  const loadComments = async (messageIds: string[]) => {
    if (!user || messageIds.length === 0) return;

    try {
      // Get all comments for the messages
      const { data: responsesData, error } = await supabase
        .from('message_responses')
        .select('*')
        .in('message_id', messageIds)
        .eq('response_type', 'comment')
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Get user names for comments
      const userIds = [...new Set(responsesData?.map(r => r.user_id) || [])];
      const { data: users } = await supabase
        .from('user_profiles')
        .select('id, full_name')
        .in('id', userIds);

      const userMap = new Map(users?.map(u => [u.id, u.full_name]));

      // Group comments by message
      const commentsByMessage = new Map<string, CommentWithUser[]>();

      responsesData?.forEach(response => {
        if (!commentsByMessage.has(response.message_id)) {
          commentsByMessage.set(response.message_id, []);
        }
        commentsByMessage.get(response.message_id)!.push({
          id: response.id,
          message_id: response.message_id,
          user_id: response.user_id,
          user_name: userMap.get(response.user_id) || 'Unknown',
          text_response: response.text_response || '',
          created_at: response.created_at
        });
      });

      setComments(commentsByMessage);
    } catch (error) {
      console.error('Error loading comments:', error);
    }
  };

  const markAsOpened = async (messageId: string) => {
    if (!user) return;

    try {
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

  const getUnreadCount = () => {
    if (viewMode !== 'inbox') return 0;
    return messages.filter(m => m.message_state === 'unread' || m.message_state === 'read_needs_action').length;
  };

  const getDraftsCount = () => {
    if (viewMode !== 'sent') return 0;
    return messages.filter(m => m.is_draft).length;
  };

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
    <div className="min-h-screen bg-gray-50 pb-20 md:pb-6">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center space-x-4 py-4">
            {onBack && (
              <button onClick={onBack} className="p-2 -ml-2 hover:bg-gray-100 active:bg-gray-100 rounded-lg transition-colors">
                <ArrowLeft className="w-6 h-6" />
              </button>
            )}
            <div className="flex-1">
              <h1 className="text-xl md:text-2xl font-bold text-gray-900">Team Communication</h1>
              <p className="text-sm text-gray-600 hidden md:block">Company updates and announcements</p>
            </div>
            {viewMode === 'inbox' && getUnreadCount() > 0 && (
              <div className="flex items-center space-x-2 px-3 md:px-4 py-2 bg-blue-100 rounded-lg">
                <div className="w-2 h-2 bg-blue-600 rounded-full animate-pulse"></div>
                <span className="text-sm font-semibold text-blue-600">
                  {getUnreadCount()} unread
                </span>
              </div>
            )}
          </div>

          {/* View Mode Tabs */}
          <div className="flex border-b border-gray-200">
            <button
              onClick={() => {
                setViewMode('inbox');
                setFilterMode('active');
              }}
              className={`flex-1 md:flex-initial md:px-8 flex items-center justify-center space-x-2 py-3 border-b-2 transition-colors ${
                viewMode === 'inbox'
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
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
            <button
              onClick={() => {
                setViewMode('sent');
                setFilterMode('active');
              }}
              className={`flex-1 md:flex-initial md:px-8 flex items-center justify-center space-x-2 py-3 border-b-2 transition-colors ${
                viewMode === 'sent'
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <SendIcon className="w-5 h-5" />
              <span className="font-medium">Sent</span>
            </button>
          </div>

          {/* Filters and Search Row */}
          <div className="py-3 flex flex-col md:flex-row gap-3">
            {/* Search Bar */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search messages..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>

            {/* Filter Tabs */}
            <div className="flex space-x-2 overflow-x-auto">
              <button
                onClick={() => setFilterMode('active')}
                className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                  filterMode === 'active'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200 active:bg-gray-200'
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
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200 active:bg-gray-200'
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
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200 active:bg-gray-200'
                }`}
              >
                Archived
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Messages Feed */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 md:py-6">
        {messages.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm p-12 text-center">
            <div className="text-gray-300 mb-4">
              {viewMode === 'inbox' ? <Inbox className="w-16 h-16 mx-auto" /> : <SendIcon className="w-16 h-16 mx-auto" />}
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No messages found</h3>
            <p className="text-gray-600">
              {searchQuery
                ? 'Try adjusting your search'
                : filterMode === 'archived'
                ? 'No archived messages'
                : viewMode === 'inbox'
                ? 'No messages to show'
                : 'You haven\'t sent any messages yet'}
            </p>
          </div>
        ) : (
          <div className="space-y-3 md:space-y-4">
            {viewMode === 'inbox' ? (
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
                comments={comments}
                onViewDetails={(msg: CompanyMessage) => {
                  setSelectedSurvey(msg);
                  setShowSurveyResults(true);
                }}
              />
            )}
          </div>
        )}
      </div>

      {/* Survey Results Modal */}
      {showSurveyResults && selectedSurvey && (
        <SurveyResultsModal
          survey={selectedSurvey}
          onClose={() => {
            setShowSurveyResults(false);
            setSelectedSurvey(null);
          }}
          onPostResults={() => {
            setShowSurveyResults(false);
            setSelectedSurvey(null);
            loadMessages(); // Reload to show the newly posted results
          }}
        />
      )}
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
        className={`bg-white rounded-xl md:rounded-2xl shadow-sm overflow-hidden transition-all ${
          msg.message_state === 'unread' || msg.message_state === 'read_needs_action' ? 'ring-2 ring-indigo-500' : ''
        } ${msg.priority === 'urgent' ? 'border-l-4 border-red-500' : ''}`}
      >
        {/* Card Header */}
        <div onClick={() => onToggleExpand(msg.id)} className="p-4 md:p-6 cursor-pointer hover:bg-gray-50 active:bg-gray-50 transition-colors">
          <div className="flex items-start space-x-3 md:space-x-4">
            <div className={`${config.iconBg} p-2 md:p-3 rounded-lg flex-shrink-0`}>
              <Icon className={`w-5 h-5 md:w-6 md:h-6 ${config.iconColor}`} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-bold text-gray-900 text-base md:text-lg line-clamp-1">{msg.title}</h3>
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
          <div className="px-4 md:px-6 pb-4 md:pb-6 space-y-3 border-t border-gray-100 pt-3 md:pt-4">
            <p className="text-gray-700 whitespace-pre-wrap">{msg.content}</p>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
              {msg.message_state === 'read_needs_action' && (
                <button
                  onClick={() => onAcknowledge(msg.id)}
                  className="flex-1 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 active:bg-indigo-700 transition-colors"
                >
                  Acknowledge
                </button>
              )}
              {msg.message_state !== 'archived' && (
                <button
                  onClick={() => onArchive(msg.id)}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 active:bg-gray-50 transition-colors"
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
function SentMessagesList({ messages, expandedCards, onToggleExpand, getMessageConfig, comments, onViewDetails }: any) {
  return messages.map((msg: CompanyMessage) => {
    const config = getMessageConfig(msg.message_type);
    const Icon = config.icon;
    const isExpanded = expandedCards.has(msg.id);
    const stats = msg.engagement_stats;

    return (
      <div key={msg.id} className="bg-white rounded-xl md:rounded-2xl shadow-sm overflow-hidden">
        <div onClick={() => onToggleExpand(msg.id)} className="p-4 md:p-6 cursor-pointer hover:bg-gray-50 active:bg-gray-50 transition-colors">
          <div className="flex items-start space-x-3 md:space-x-4">
            <div className={`${config.iconBg} p-2 md:p-3 rounded-lg flex-shrink-0`}>
              <Icon className={`w-5 h-5 md:w-6 md:h-6 ${config.iconColor}`} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-bold text-gray-900 text-base md:text-lg line-clamp-1">{msg.title}</h3>
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
          <div className="px-4 md:px-6 pb-4 md:pb-6 border-t border-gray-100 pt-3 md:pt-4 space-y-3">
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="bg-blue-50 rounded-lg p-3">
                <div className="text-2xl font-bold text-blue-600">
                  {stats.total_recipients > 0 ? Math.round((stats.opened_count / stats.total_recipients) * 100) : 0}%
                </div>
                <div className="text-xs text-gray-600 mt-1">Opened</div>
              </div>
              {msg.requires_acknowledgment && (
                <div className="bg-green-50 rounded-lg p-3">
                  <div className="text-2xl font-bold text-green-600">
                    {stats.total_recipients > 0 ? Math.round((stats.acknowledged_count / stats.total_recipients) * 100) : 0}%
                  </div>
                  <div className="text-xs text-gray-600 mt-1">Acknowledged</div>
                </div>
              )}
              {msg.survey_questions && (
                <div className="bg-purple-50 rounded-lg p-3">
                  <div className="text-2xl font-bold text-purple-600">
                    {stats.total_recipients > 0 ? Math.round((stats.responded_count / stats.total_recipients) * 100) : 0}%
                  </div>
                  <div className="text-xs text-gray-600 mt-1">Responded</div>
                </div>
              )}
            </div>
            {msg.survey_questions && (
              <button
                onClick={() => onViewDetails(msg)}
                className="w-full py-2 border border-indigo-600 text-indigo-600 rounded-lg font-medium hover:bg-indigo-50 active:bg-indigo-50 transition-colors flex items-center justify-center space-x-2"
              >
                <BarChart3 className="w-4 h-4" />
                <span>View Details</span>
              </button>
            )}

            {/* Comments Section */}
            {comments && comments.get(msg.id) && comments.get(msg.id)!.length > 0 && (
              <div className="mt-4 border-t border-gray-200 pt-4">
                <h4 className="font-semibold text-gray-900 mb-3 flex items-center space-x-2">
                  <span>Comments ({comments.get(msg.id)!.length})</span>
                </h4>
                <div className="space-y-3">
                  {comments.get(msg.id)!.map((comment: CommentWithUser) => (
                    <div key={comment.id} className="bg-gray-50 rounded-lg p-3">
                      <div className="flex items-start justify-between mb-1">
                        <span className="font-medium text-gray-900 text-sm">
                          {comment.user_name}
                        </span>
                        <span className="text-xs text-gray-500">
                          {new Date(comment.created_at).toLocaleDateString()} at{' '}
                          {new Date(comment.created_at).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      </div>
                      <p className="text-gray-700 text-sm whitespace-pre-wrap">
                        {comment.text_response}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  });
}

// Survey Results Modal Component
interface SurveyResultsModalProps {
  survey: CompanyMessage;
  onClose: () => void;
  onPostResults: () => void;
}

function SurveyResultsModal({ survey, onClose, onPostResults }: SurveyResultsModalProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [results, setResults] = useState<Map<string, { responses: string[]; users: string[] }>>(new Map());
  const [posting, setPosting] = useState(false);

  useEffect(() => {
    loadSurveyResults();
  }, [survey.id]);

  const loadSurveyResults = async () => {
    if (!survey.survey_questions) return;

    try {
      setLoading(true);

      // Get all survey responses for this message
      const { data: responses, error: responsesError } = await supabase
        .from('message_responses')
        .select('user_id, selected_options')
        .eq('message_id', survey.id)
        .eq('response_type', 'survey_answer');

      if (responsesError) throw responsesError;

      // Get user names
      const userIds = [...new Set(responses?.map(r => r.user_id) || [])];
      const { data: users } = await supabase
        .from('user_profiles')
        .select('id, full_name')
        .in('id', userIds);

      const userMap = new Map(users?.map(u => [u.id, u.full_name]));

      // Aggregate responses by option
      const aggregated = new Map<string, { responses: string[]; users: string[] }>();

      survey.survey_questions.questions.forEach(question => {
        question.options?.forEach(option => {
          if (!aggregated.has(option)) {
            aggregated.set(option, { responses: [], users: [] });
          }
        });
      });

      responses?.forEach(response => {
        response.selected_options?.forEach((option: string) => {
          if (aggregated.has(option)) {
            aggregated.get(option)!.responses.push(option);
            aggregated.get(option)!.users.push(userMap.get(response.user_id) || 'Unknown');
          }
        });
      });

      setResults(aggregated);
    } catch (error) {
      console.error('Error loading survey results:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePostResults = async () => {
    if (!user || !survey.survey_questions) return;

    try {
      setPosting(true);

      // Calculate total responses
      const totalResponses = Array.from(results.values()).reduce((sum, data) => Math.max(sum, data.users.length), 0);

      // Generate results summary
      let resultsSummary = `📊 **Survey Results: ${survey.title}**\n\n`;
      resultsSummary += `Total Responses: ${totalResponses} out of ${survey.engagement_stats?.total_recipients || 0}\n`;
      resultsSummary += `Response Rate: ${survey.engagement_stats?.total_recipients ? Math.round((totalResponses / survey.engagement_stats.total_recipients) * 100) : 0}%\n\n`;

      resultsSummary += `**Results:**\n`;
      results.forEach((data, option) => {
        const percentage = totalResponses > 0 ? Math.round((data.users.length / totalResponses) * 100) : 0;
        resultsSummary += `• ${option}: ${data.users.length} (${percentage}%)\n`;
      });

      // Create new announcement with results
      const { error } = await supabase
        .from('company_messages')
        .insert({
          message_type: 'announcement',
          title: `Results: ${survey.title}`,
          content: resultsSummary,
          created_by: user.id,
          target_roles: survey.target_roles || ['sales', 'operations', 'sales-manager', 'admin'],
          priority: 'normal',
          is_draft: false,
          status: 'active'
        });

      if (error) throw error;

      onPostResults();
    } catch (error) {
      console.error('Error posting results:', error);
    } finally {
      setPosting(false);
    }
  };

  const totalResponses = Math.max(...Array.from(results.values()).map(d => d.users.length));

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex items-start justify-between">
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-gray-900">Survey Results</h2>
            <p className="text-gray-600 mt-1">{survey.title}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
              <p className="mt-4 text-gray-600">Loading results...</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Summary Stats */}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-blue-50 rounded-lg p-4 text-center">
                  <div className="text-3xl font-bold text-blue-600">{totalResponses}</div>
                  <div className="text-sm text-gray-600 mt-1">Total Responses</div>
                </div>
                <div className="bg-green-50 rounded-lg p-4 text-center">
                  <div className="text-3xl font-bold text-green-600">
                    {survey.engagement_stats?.total_recipients || 0}
                  </div>
                  <div className="text-sm text-gray-600 mt-1">Total Recipients</div>
                </div>
                <div className="bg-purple-50 rounded-lg p-4 text-center">
                  <div className="text-3xl font-bold text-purple-600">
                    {survey.engagement_stats?.total_recipients
                      ? Math.round((totalResponses / survey.engagement_stats.total_recipients) * 100)
                      : 0}%
                  </div>
                  <div className="text-sm text-gray-600 mt-1">Response Rate</div>
                </div>
              </div>

              {/* Results Visualization */}
              <div>
                <h3 className="font-bold text-gray-900 mb-4">Responses by Option</h3>
                <div className="space-y-4">
                  {Array.from(results.entries()).map(([option, data]) => {
                    const percentage = totalResponses > 0 ? (data.users.length / totalResponses) * 100 : 0;

                    return (
                      <div key={option} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-gray-900">{option}</span>
                          <span className="text-sm text-gray-600">
                            {data.users.length} ({Math.round(percentage)}%)
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
                          <div
                            className="bg-indigo-600 h-full transition-all duration-500 flex items-center justify-end pr-2"
                            style={{ width: `${percentage}%` }}
                          >
                            {percentage >= 10 && (
                              <span className="text-xs font-bold text-white">
                                {Math.round(percentage)}%
                              </span>
                            )}
                          </div>
                        </div>
                        {data.users.length > 0 && (
                          <div className="text-xs text-gray-500 ml-2">
                            {data.users.slice(0, 3).join(', ')}
                            {data.users.length > 3 && ` +${data.users.length - 3} more`}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 p-6 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-100 transition-colors"
          >
            Close
          </button>
          <button
            onClick={handlePostResults}
            disabled={posting || loading}
            className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
          >
            <Share2 className="w-4 h-4" />
            <span>{posting ? 'Posting...' : 'Post Results to Team'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
