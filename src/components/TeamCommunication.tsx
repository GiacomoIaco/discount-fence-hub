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
  Send as SendIcon,
  BarChart3,
  Search,
  X,
  Share2,
  Archive,
  Users,
  MessageCircle
} from 'lucide-react';

type MessageState = 'unread' | 'read' | 'read_needs_action' | 'read_needs_response' | 'answered' | 'acknowledged' | 'archived';
type FilterMode = 'active' | 'archived' | 'drafts';

interface MessageResponse {
  id: string;
  message_id: string;
  user_id: string;
  response_type: 'acknowledgment' | 'survey_answer' | 'comment' | 'reaction' | 'rsvp';
  text_response?: string;
  selected_options?: string[];
  created_at: string;
}

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
  survey_questions?: SurveyQuestion[];
  recognized_user_id?: string;
  creator_name?: string;
  recognized_user_name?: string;
  message_state?: MessageState;
  user_response?: MessageResponse;
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
  onUnreadCountChange?: (count: number) => void;
  refreshTrigger?: number;
}

interface CommentWithUser {
  id: string;
  message_id: string;
  user_id: string;
  user_name: string;
  text_response: string;
  created_at: string;
}

export default function TeamCommunication({ onBack, onUnreadCountChange, refreshTrigger }: TeamCommunicationProps) {
  const { user, profile } = useAuth();
  // Simplified: Always show sent messages (admin management view)
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
  }, [user, profile, filterMode]);

  // Reload when refreshTrigger changes (e.g., after creating a new message)
  useEffect(() => {
    if (refreshTrigger !== undefined && refreshTrigger > 0) {
      loadMessages();
    }
  }, [refreshTrigger]);

  // Note: Badge count is now managed by Chat > Company Announcements (AnnouncementsView)
  // This view (Announcements button) is for admin management of sent messages

  const loadMessages = async () => {
    if (!user || !profile) {
      setLoading(false);
      setMessages([]);
      return;
    }

    try {
      setLoading(true);
      await loadSentMessages();
    } catch (error) {
      console.error('Error loading messages:', error);
      setMessages([]);
    } finally {
      setLoading(false);
    }
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

    // Update unread count for badge (0 for sent view)
    onUnreadCountChange?.(0);

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

  const toggleExpand = (messageId: string) => {
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

  const handleArchive = async (messageId: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('company_messages')
        .update({ status: 'archived' })
        .eq('id', messageId);

      if (!error) {
        loadMessages(); // Reload to update the list
      }
    } catch (error) {
      console.error('Error archiving message:', error);
    }
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

  const getDraftsCount = () => {
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
          <div className="flex items-center space-x-4 py-4 border-b border-gray-200">
            {onBack && (
              <button onClick={onBack} className="p-2 -ml-2 hover:bg-gray-100 active:bg-gray-100 rounded-lg transition-colors">
                <ArrowLeft className="w-6 h-6" />
              </button>
            )}
            <div className="flex-1">
              <h1 className="text-xl md:text-2xl font-bold text-gray-900">Announcements Management</h1>
              <p className="text-sm text-gray-600 hidden md:block">Create, send, and track team announcements</p>
            </div>
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
              <SendIcon className="w-16 h-16 mx-auto" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No announcements found</h3>
            <p className="text-gray-600">
              {searchQuery
                ? 'Try adjusting your search'
                : filterMode === 'archived'
                ? 'No archived announcements'
                : filterMode === 'drafts'
                ? 'No drafts yet'
                : 'You haven\'t sent any announcements yet'}
            </p>
          </div>
        ) : (
          <div className="space-y-3 md:space-y-4">
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
              onArchive={handleArchive}
              filterMode={filterMode}
            />
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

// Sent Messages List Component
function SentMessagesList({ messages, expandedCards, onToggleExpand, getMessageConfig, comments, onViewDetails, onArchive, filterMode }: any) {
  return messages.map((msg: CompanyMessage) => {
    const config = getMessageConfig(msg.message_type);
    const Icon = config.icon;
    const isExpanded = expandedCards.has(msg.id);
    const stats = msg.engagement_stats;

    return (
      <div key={msg.id} className="bg-white rounded-xl md:rounded-2xl shadow-sm overflow-hidden">
        <div className="p-4 md:p-6">
          {/* Single Row Layout - Icon, Title, Stats, Actions */}
          <div className="flex items-center gap-3 md:gap-4">
            {/* Icon */}
            <div className={`${config.iconBg} p-2 md:p-3 rounded-lg flex-shrink-0`}>
              <Icon className={`w-5 h-5 md:w-6 md:h-6 ${config.iconColor}`} />
            </div>

            {/* Title and Date */}
            <div
              onClick={() => onToggleExpand(msg.id)}
              className="flex-shrink-0 cursor-pointer min-w-[200px] max-w-[300px]"
            >
              <div className="flex items-center space-x-2 mb-0.5">
                <h3 className="font-bold text-gray-900 text-sm md:text-base truncate">
                  {msg.title}
                </h3>
                {msg.is_draft && (
                  <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs font-semibold rounded-full flex-shrink-0">
                    DRAFT
                  </span>
                )}
              </div>
              <div className="text-xs text-gray-500">
                {new Date(msg.created_at).toLocaleDateString()}
              </div>
            </div>

            {/* Stats - Horizontal Spread */}
            {stats && (
              <div className="flex items-center gap-3 md:gap-4 flex-1">
                {/* Opened Rate */}
                <div className="flex items-center space-x-1.5 text-sm">
                  <Eye className="w-4 h-4 text-blue-600 flex-shrink-0" />
                  <div className="font-semibold text-blue-600">
                    {stats.total_recipients > 0 ? Math.round((stats.opened_count / stats.total_recipients) * 100) : 0}%
                  </div>
                  <span className="text-xs text-gray-500 hidden md:inline">Opened</span>
                </div>

                {/* Acknowledgment Rate */}
                {msg.requires_acknowledgment && (
                  <div className="flex items-center space-x-1.5 text-sm">
                    <Check className="w-4 h-4 text-green-600 flex-shrink-0" />
                    <div className="font-semibold text-green-600">
                      {stats.total_recipients > 0 ? Math.round((stats.acknowledged_count / stats.total_recipients) * 100) : 0}%
                    </div>
                    <span className="text-xs text-gray-500 hidden md:inline">Ack'd</span>
                  </div>
                )}

                {/* Survey Response Rate */}
                {msg.survey_questions && (
                  <div className="flex items-center space-x-1.5 text-sm">
                    <Users className="w-4 h-4 text-purple-600 flex-shrink-0" />
                    <div className="font-semibold text-purple-600">
                      {stats.total_recipients > 0 ? Math.round((stats.responded_count / stats.total_recipients) * 100) : 0}%
                    </div>
                    <span className="text-xs text-gray-500 hidden md:inline">Responded</span>
                  </div>
                )}

                {/* Comment Count */}
                {comments.get(msg.id) && comments.get(msg.id)!.length > 0 && (
                  <div className="flex items-center space-x-1.5 text-sm">
                    <MessageCircle className="w-4 h-4 text-gray-600 flex-shrink-0" />
                    <div className="font-semibold text-gray-900">
                      {comments.get(msg.id)!.length}
                    </div>
                    <span className="text-xs text-gray-500 hidden md:inline">Comment{comments.get(msg.id)!.length !== 1 ? 's' : ''}</span>
                  </div>
                )}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center space-x-2 flex-shrink-0">
              {msg.survey_questions && stats && stats.responded_count > 0 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onViewDetails(msg);
                  }}
                  className="px-2 md:px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-lg hover:bg-indigo-100 transition-colors text-xs font-medium hidden md:flex items-center space-x-1"
                  title="View survey results"
                >
                  <BarChart3 className="w-3.5 h-3.5" />
                  <span>Results</span>
                </button>
              )}
              {filterMode === 'active' && !msg.is_draft && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (window.confirm('Archive this announcement? It will be moved to the archived section.')) {
                      onArchive(msg.id);
                    }
                  }}
                  className="p-1.5 md:p-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors hidden md:block"
                  title="Archive"
                >
                  <Archive className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={() => onToggleExpand(msg.id)}
                className="p-1.5 md:p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                {isExpanded ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
              </button>
            </div>
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

      // Check if Survey.js format (has elements) or legacy format (array)
      const isSurveyJsFormat = typeof survey.survey_questions === 'object' && 'elements' in survey.survey_questions;

      if (isSurveyJsFormat) {
        // Survey.js format: extract all possible answers from elements
        const surveyElements = (survey.survey_questions as any).elements || [];
        surveyElements.forEach((element: any) => {
          if (element.choices) {
            // Multiple choice, dropdown, etc
            element.choices.forEach((choice: any) => {
              const value = typeof choice === 'string' ? choice : choice.value || choice.text;
              if (!aggregated.has(value)) {
                aggregated.set(value, { responses: [], users: [] });
              }
            });
          }
          // For rating questions, we'll aggregate the numeric values
          if (element.type === 'rating') {
            for (let i = element.rateMin || 1; i <= (element.rateMax || 5); i++) {
              const value = `${i} star${i !== 1 ? 's' : ''}`;
              if (!aggregated.has(value)) {
                aggregated.set(value, { responses: [], users: [] });
              }
            }
          }
        });
      } else if (Array.isArray(survey.survey_questions)) {
        // Legacy format: array of questions
        survey.survey_questions.forEach(question => {
          question.options?.forEach(option => {
            if (!aggregated.has(option)) {
              aggregated.set(option, { responses: [], users: [] });
            }
          });
        });
      }

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
