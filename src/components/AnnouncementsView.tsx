import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import SurveyRenderer from './SurveyRenderer';
import {
  Megaphone,
  AlertTriangle,
  Award,
  ClipboardList,
  FileText,
  GraduationCap,
  CheckSquare,
  Calendar,
  ChevronDown,
  ChevronUp,
  Check,
  Eye,
  Search,
  ArrowLeft,
  ExternalLink,
  X,
  MessageCircle,
  Send,
  Archive,
  BarChart3,
  Users,
  Trash2
} from 'lucide-react';

interface SurveyQuestion {
  id: string;
  text: string;
  type: 'multiple_choice' | 'yes_no' | 'rating' | 'short_text' | 'long_text';
  options?: string[];
  allow_multiple?: boolean;
  required?: boolean;
}

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
  survey_questions?: SurveyQuestion[];
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
  acknowledgment_count?: number;
  survey_response_count?: number;
  creator_name?: string;
  recognized_user_name?: string;
  is_read?: boolean;
  user_response?: MessageResponse;
  has_acknowledgment?: boolean;
}

interface MessageResponse {
  id: string;
  message_id?: string;
  user_id?: string;
  response_type: 'acknowledgment' | 'survey_answer' | 'comment' | 'reaction' | 'rsvp';
  text_response?: string;
  selected_options?: string[];
  reaction_emoji?: string;
  rsvp_status?: 'yes' | 'no' | 'maybe';
  created_at: string;
}

interface CommentWithUser extends MessageResponse {
  user_name: string;
  user_id: string;
  message_id: string;
}

interface ReactionSummary {
  emoji: string;
  count: number;
  users: string[];
  hasReacted: boolean;
}

interface AnnouncementsViewProps {
  onBack: () => void;
  onUnreadCountChange?: (count: number) => void;
}

export default function AnnouncementsView({ onBack, onUnreadCountChange }: AnnouncementsViewProps) {
  const { user, profile } = useAuth();
  const [messages, setMessages] = useState<CompanyMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedType, setSelectedType] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedMessage, setExpandedMessage] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [comments, setComments] = useState<Map<string, CommentWithUser[]>>(new Map());
  const [reactions, setReactions] = useState<Map<string, ReactionSummary[]>>(new Map());
  const [newComment, setNewComment] = useState<Map<string, string>>(new Map());

  // Helper function to safely parse JSON
  const safeJsonParse = (value: string | null | undefined): any => {
    if (!value) return {};

    try {
      // Try to parse as JSON
      return JSON.parse(value);
    } catch (error) {
      // If it's not valid JSON, return as-is (for legacy simple string responses)
      console.warn('Failed to parse JSON, returning empty object:', value);
      return {};
    }
  };

  const messageTypes = [
    { value: 'all', label: 'All', icon: Megaphone },
    { value: 'announcement', label: 'Announcements', icon: Megaphone },
    { value: 'urgent_alert', label: 'Alerts', icon: AlertTriangle },
    { value: 'recognition', label: 'Recognition', icon: Award },
    { value: 'survey', label: 'Surveys', icon: ClipboardList },
    { value: 'policy', label: 'Policies', icon: FileText },
    { value: 'training', label: 'Training', icon: GraduationCap },
    { value: 'task', label: 'Tasks', icon: CheckSquare },
    { value: 'event', label: 'Events', icon: Calendar },
  ];

  useEffect(() => {
    loadMessages();

    // Poll every 30 seconds to keep messages and badge up to date
    const pollingInterval = setInterval(() => {
      loadMessages();
    }, 30000);

    return () => {
      clearInterval(pollingInterval);
    };
  }, [user, profile]);

  // Real-time subscription for comments and reactions
  useEffect(() => {
    if (!user || messages.length === 0) return;

    const messageIds = messages.map(m => m.id);

    const subscription = supabase
      .channel('message_responses_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'message_responses',
          filter: `response_type=in.(comment,reaction)`
        },
        (payload) => {
          // Reload comments and reactions for affected message
          if (payload.new && 'message_id' in payload.new) {
            const msgId = payload.new.message_id as string;
            if (messageIds.includes(msgId)) {
              loadCommentsAndReactions([msgId]);
            }
          } else if (payload.old && 'message_id' in payload.old) {
            const msgId = payload.old.message_id as string;
            if (messageIds.includes(msgId)) {
              loadCommentsAndReactions([msgId]);
            }
          }
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [user, messages]);

  const loadMessages = async () => {
    if (!user || !profile) return;

    try {
      setLoading(true);

      // Get messages that target user's role or specific user
      const { data: messagesData, error: messagesError } = await supabase
        .from('company_messages')
        .select(`
          *,
          message_receipts!left(id, read_at, user_id)
        `)
        .or(`target_roles.cs.{${profile.role}},target_user_ids.cs.{${user.id}}`)
        .eq('is_archived', false)
        .order('priority', { ascending: false })
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

      // Create maps for different response types
      // For survey answers and acknowledgments, check specifically for each type
      const surveyResponseMap = new Map(
        responses?.filter(r => r.response_type === 'survey_answer').map(r => [r.message_id, r])
      );
      const acknowledgmentMap = new Map(
        responses?.filter(r => r.response_type === 'acknowledgment').map(r => [r.message_id, r])
      );

      // Get engagement stats for all messages (acknowledgments and survey responses)
      const { data: engagementStats } = messageIds.length > 0
        ? await supabase
            .from('message_responses')
            .select('message_id, response_type')
            .in('message_id', messageIds)
            .in('response_type', ['acknowledgment', 'survey_answer'])
        : { data: [] };

      // Count acknowledgments and survey responses per message
      const statsMap = new Map<string, { acknowledgments: number; surveyResponses: number }>();
      engagementStats?.forEach(stat => {
        if (!statsMap.has(stat.message_id)) {
          statsMap.set(stat.message_id, { acknowledgments: 0, surveyResponses: 0 });
        }
        const counts = statsMap.get(stat.message_id)!;
        if (stat.response_type === 'acknowledgment') {
          counts.acknowledgments++;
        } else if (stat.response_type === 'survey_answer') {
          counts.surveyResponses++;
        }
      });

      const enrichedMessages = messagesData?.map(msg => {
        // Prioritize survey_answer if it exists, otherwise use acknowledgment
        const userResponse = surveyResponseMap.get(msg.id) || acknowledgmentMap.get(msg.id);
        // Store acknowledgment separately so we can check for it
        const hasAcknowledgment = acknowledgmentMap.has(msg.id);
        // Get engagement stats
        const stats = statsMap.get(msg.id) || { acknowledgments: 0, surveyResponses: 0 };

        return {
          ...msg,
          creator_name: creatorMap.get(msg.created_by) || 'Unknown',
          recognized_user_name: msg.recognized_user_id
            ? recognizedMap.get(msg.recognized_user_id) || 'Unknown'
            : undefined,
          is_read: msg.message_receipts?.some((r: any) => r.user_id === user.id),
          user_response: userResponse,
          has_acknowledgment: hasAcknowledgment,
          acknowledgment_count: stats.acknowledgments,
          survey_response_count: stats.surveyResponses
        };
      }) || [];

      setMessages(enrichedMessages);

      // Load comments and reactions
      await loadCommentsAndReactions(messageIds);

      // Update unread count
      const unreadCount = enrichedMessages.filter(m => !m.is_read).length;
      onUnreadCountChange?.(unreadCount);
    } catch (error) {
      console.error('Error loading messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadCommentsAndReactions = async (messageIds: string[]) => {
    if (!user || messageIds.length === 0) return;

    try {
      // Get all comments and reactions for the messages
      const { data: responsesData, error } = await supabase
        .from('message_responses')
        .select('*')
        .in('message_id', messageIds)
        .in('response_type', ['comment', 'reaction']);

      if (error) throw error;

      // Get user names for responses
      const userIds = [...new Set(responsesData?.map(r => r.user_id) || [])];
      const { data: users } = await supabase
        .from('user_profiles')
        .select('id, full_name')
        .in('id', userIds);

      const userMap = new Map(users?.map(u => [u.id, u.full_name]));

      // Group comments by message
      const commentsByMessage = new Map<string, CommentWithUser[]>();
      const reactionsByMessage = new Map<string, Map<string, ReactionSummary>>();

      responsesData?.forEach(response => {
        if (response.response_type === 'comment') {
          if (!commentsByMessage.has(response.message_id)) {
            commentsByMessage.set(response.message_id, []);
          }
          commentsByMessage.get(response.message_id)!.push({
            ...response,
            user_name: userMap.get(response.user_id) || 'Unknown',
            user_id: response.user_id
          });
        } else if (response.response_type === 'reaction' && response.reaction_emoji) {
          if (!reactionsByMessage.has(response.message_id)) {
            reactionsByMessage.set(response.message_id, new Map());
          }
          const msgReactions = reactionsByMessage.get(response.message_id)!;
          const emoji = response.reaction_emoji;

          if (!msgReactions.has(emoji)) {
            msgReactions.set(emoji, {
              emoji,
              count: 0,
              users: [],
              hasReacted: false
            });
          }

          const reactionSummary = msgReactions.get(emoji)!;
          reactionSummary.count++;
          reactionSummary.users.push(userMap.get(response.user_id) || 'Unknown');
          if (response.user_id === user.id) {
            reactionSummary.hasReacted = true;
          }
        }
      });

      // Convert reaction maps to arrays
      const reactionsArrayMap = new Map<string, ReactionSummary[]>();
      reactionsByMessage.forEach((reactions, messageId) => {
        reactionsArrayMap.set(messageId, Array.from(reactions.values()));
      });

      setComments(commentsByMessage);
      setReactions(reactionsArrayMap);
    } catch (error) {
      console.error('Error loading comments and reactions:', error);
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

        // Update unread count
        const unreadCount = messages.filter(m => m.id !== messageId && !m.is_read).length;
        onUnreadCountChange?.(unreadCount);
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
        }, { onConflict: 'message_id,user_id,response_type' });

      if (!error) {
        loadMessages();
      }
    } catch (error) {
      console.error('Error acknowledging message:', error);
    }
  };

  const handleSurveyResponse = async (messageId: string, responseData: any, isSurveyJs = false) => {
    if (!user) {
      console.error('Cannot submit survey response: no user');
      return;
    }

    try {
      const payload: any = {
        message_id: messageId,
        user_id: user.id,
        response_type: 'survey_answer'
      };

      // For Survey.js format, store full object as JSON in text_response
      if (isSurveyJs) {
        payload.text_response = JSON.stringify(responseData);
      } else {
        // For legacy format, use selected_options array
        payload.selected_options = responseData;
      }

      console.log('Submitting survey response:', payload);

      const { data, error } = await supabase
        .from('message_responses')
        .upsert(payload, { onConflict: 'message_id,user_id,response_type' });

      if (error) {
        console.error('Supabase error submitting survey response:', error);
      } else {
        console.log('Survey response submitted successfully:', data);
        loadMessages();
      }
    } catch (error) {
      console.error('Exception submitting survey response:', error);
    }
  };

  const handleAddComment = async (messageId: string) => {
    if (!user || !profile) return;

    const commentText = newComment.get(messageId)?.trim();
    if (!commentText) return;

    try {
      const { error } = await supabase
        .from('message_responses')
        .insert({
          message_id: messageId,
          user_id: user.id,
          response_type: 'comment',
          text_response: commentText
        });

      if (!error) {
        // Add comment to local state optimistically
        const newCommentObj: CommentWithUser = {
          id: `temp-${Date.now()}`,
          message_id: messageId,
          user_id: user.id,
          response_type: 'comment',
          text_response: commentText,
          created_at: new Date().toISOString(),
          user_name: profile.full_name
        };

        setComments(prev => {
          const updated = new Map(prev);
          const messageComments = updated.get(messageId) || [];
          updated.set(messageId, [...messageComments, newCommentObj]);
          return updated;
        });

        // Clear the comment input
        setNewComment(prev => {
          const updated = new Map(prev);
          updated.set(messageId, '');
          return updated;
        });

        // Reload to get correct IDs and update counts
        await loadCommentsAndReactions([messageId]);
      }
    } catch (error) {
      console.error('Error adding comment:', error);
    }
  };

  const handleAddReaction = async (messageId: string, emoji: string) => {
    if (!user || !profile) return;

    try {
      // Check if user already reacted with this emoji
      const messageReactions = reactions.get(messageId) || [];
      const existingReaction = messageReactions.find(r => r.emoji === emoji && r.hasReacted);

      if (existingReaction) {
        // Remove reaction
        const { error } = await supabase
          .from('message_responses')
          .delete()
          .eq('message_id', messageId)
          .eq('user_id', user.id)
          .eq('response_type', 'reaction')
          .eq('reaction_emoji', emoji);

        if (!error) {
          await loadCommentsAndReactions([messageId]);
        }
      } else {
        // Add reaction
        const { error } = await supabase
          .from('message_responses')
          .insert({
            message_id: messageId,
            user_id: user.id,
            response_type: 'reaction',
            reaction_emoji: emoji
          });

        if (!error) {
          await loadCommentsAndReactions([messageId]);
        }
      }
    } catch (error) {
      console.error('Error adding reaction:', error);
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
      discussion: Megaphone,
      task: CheckSquare,
      event: Calendar
    };
    return iconMap[type] || Megaphone;
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

  const filteredMessages = messages
    .filter(msg => {
      const matchesType = selectedType === 'all' || msg.message_type === selectedType;
      const matchesSearch = msg.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           msg.content.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesType && matchesSearch;
    })
    .sort((a, b) => {
      // Check if messages are within 24 hours and urgent
      const now = new Date().getTime();
      const twentyFourHours = 24 * 60 * 60 * 1000;

      const aCreatedTime = new Date(a.created_at).getTime();
      const bCreatedTime = new Date(b.created_at).getTime();

      const aIsUrgentAndRecent = a.priority === 'urgent' && (now - aCreatedTime) < twentyFourHours;
      const bIsUrgentAndRecent = b.priority === 'urgent' && (now - bCreatedTime) < twentyFourHours;

      // Sticky urgent messages at top (within 24 hours)
      if (aIsUrgentAndRecent && !bIsUrgentAndRecent) return -1;
      if (!aIsUrgentAndRecent && bIsUrgentAndRecent) return 1;

      // If both are sticky urgent or neither is, sort by priority then date
      if (aIsUrgentAndRecent === bIsUrgentAndRecent) {
        // Define priority order
        const priorityOrder = { urgent: 4, high: 3, normal: 2, low: 1 };
        const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
        if (priorityDiff !== 0) return priorityDiff;

        // If same priority, sort by date (newest first)
        return bCreatedTime - aCreatedTime;
      }

      return 0;
    });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading announcements...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 flex-shrink-0">
        <div className="px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-4">
              <button
                onClick={onBack}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors md:hidden"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Megaphone className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-gray-900">Company Announcements</h1>
                  <p className="text-sm text-gray-600">Official updates and communications</p>
                </div>
              </div>
            </div>

            {/* View Mode Toggle and Filters Button */}
            <div className="flex items-center space-x-2">
              <div className="flex items-center space-x-2 bg-gray-100 p-1 rounded-lg">
                <button
                  onClick={() => setViewMode('active')}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    viewMode === 'active'
                      ? 'bg-white text-blue-600 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Active
                </button>
                <button
                  onClick={() => setViewMode('archived')}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    viewMode === 'archived'
                      ? 'bg-white text-blue-600 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Archived
                </button>
              </div>
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium md:hidden"
              >
                Filters
              </button>
            </div>
          </div>

          {/* Search and Filters */}
          <div className={`flex flex-col md:flex-row gap-3 ${showFilters || 'hidden md:flex'}`}>
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search announcements..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
            >
              {messageTypes.map(type => (
                <option key={type.value} value={type.value}>{type.label}</option>
              ))}
            </select>
            {showFilters && (
              <button
                onClick={() => setShowFilters(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 md:hidden"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Messages List */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-6">
        {filteredMessages.length === 0 ? (
          <div className="bg-gray-50 rounded-xl p-12 text-center">
            <Megaphone className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No announcements found</h3>
            <p className="text-gray-600">
              {searchQuery || selectedType !== 'all'
                ? 'Try adjusting your search or filters'
                : 'No announcements have been posted yet'}
            </p>
          </div>
        ) : (
          <div className="space-y-4 max-w-4xl mx-auto">
            {filteredMessages.map(message => {
              const Icon = getMessageIcon(message.message_type);
              const isExpanded = expandedMessage === message.id;

              // Check if urgent message is sticky (within 24 hours)
              const now = new Date().getTime();
              const twentyFourHours = 24 * 60 * 60 * 1000;
              const createdTime = new Date(message.created_at).getTime();
              const isUrgentAndSticky = message.priority === 'urgent' && (now - createdTime) < twentyFourHours;

              return (
                <div
                  key={message.id}
                  className={`bg-white rounded-xl shadow-sm overflow-hidden transition-all border ${
                    !message.is_read ? 'ring-2 ring-blue-500 border-blue-300' : 'border-gray-200'
                  } ${isUrgentAndSticky ? 'border-l-4 border-l-red-500 shadow-lg' : message.priority === 'urgent' ? 'border-l-4 border-l-red-500' : ''}`}
                >
                  {/* Message Header */}
                  <div className="p-4 sm:p-6">
                    <div className="flex items-start justify-between gap-4">
                      {/* Left side: Icon, Title, Content Preview */}
                      <div
                        onClick={() => handleToggleExpand(message.id)}
                        className="flex items-start space-x-3 sm:space-x-4 flex-1 min-w-0 cursor-pointer"
                      >
                        <div className={`p-2 sm:p-3 rounded-lg ${getPriorityColor(message.priority)} flex-shrink-0`}>
                          <Icon className="w-5 h-5 sm:w-6 sm:h-6" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-2 mb-1 flex-wrap gap-y-1">
                            <h3 className="text-base sm:text-lg font-semibold text-gray-900">
                              {message.title}
                            </h3>
                            {isUrgentAndSticky && (
                              <span className="px-2 py-1 bg-red-100 text-red-700 text-xs font-semibold rounded flex-shrink-0">
                                PINNED URGENT
                              </span>
                            )}
                            {!message.is_read && (
                              <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-semibold rounded flex-shrink-0">
                                NEW
                              </span>
                            )}
                            {message.requires_acknowledgment && !message.has_acknowledgment && (
                              <span className="px-2 py-1 bg-yellow-100 text-yellow-700 text-xs font-semibold rounded flex-shrink-0">
                                ACTION REQUIRED
                              </span>
                            )}
                          </div>
                          {!isExpanded && (
                            <p className="text-sm text-gray-600 line-clamp-2 mb-2">
                              {message.content}
                            </p>
                          )}
                          <div className="flex items-center space-x-3 text-xs text-gray-500 flex-wrap gap-y-1">
                            <span>From: {message.creator_name}</span>
                            <span>•</span>
                            <span>{new Date(message.created_at).toLocaleDateString()}</span>
                          </div>
                        </div>
                      </div>

                      {/* Right side: Stats and Actions */}
                      <div className="flex flex-col items-end space-y-2 flex-shrink-0">
                        {/* Stats */}
                        <div className="flex items-center space-x-4 text-xs text-gray-600">
                          <div className="flex items-center space-x-1" title="Views">
                            <Eye className="w-4 h-4" />
                            <span>{message.view_count || 0}</span>
                          </div>
                          {message.requires_acknowledgment && (
                            <div className="flex items-center space-x-1" title="Acknowledgments">
                              <Check className="w-4 h-4" />
                              <span>{message.acknowledgment_count || 0}</span>
                            </div>
                          )}
                          {message.message_type === 'survey' && (
                            <div className="flex items-center space-x-1" title="Survey Responses">
                              <Users className="w-4 h-4" />
                              <span>{message.survey_response_count || 0}</span>
                            </div>
                          )}
                        </div>

                        {/* Action Buttons */}
                        <div className="flex items-center space-x-2">
                          {message.message_type === 'survey' && message.survey_response_count && message.survey_response_count > 0 && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleToggleExpand(message.id);
                              }}
                              className="px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-lg hover:bg-indigo-100 transition-colors text-xs font-medium flex items-center space-x-1"
                              title="View survey results"
                            >
                              <BarChart3 className="w-3.5 h-3.5" />
                              <span>Results</span>
                            </button>
                          )}
                          {viewMode === 'active' ? (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (window.confirm('Archive this announcement? It will be removed from your inbox.')) {
                                  handleArchive(message.id);
                                }
                              }}
                              className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-xs font-medium flex items-center space-x-1"
                              title="Archive"
                            >
                              <Archive className="w-3.5 h-3.5" />
                              <span>Archive</span>
                            </button>
                          ) : (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (window.confirm('Permanently delete this announcement? This action cannot be undone.')) {
                                  handleDelete(message.id);
                                }
                              }}
                              className="px-3 py-1.5 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors text-xs font-medium flex items-center space-x-1"
                              title="Delete permanently"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Delete</span>
                            </button>
                          )}
                          <button
                            onClick={() => handleToggleExpand(message.id)}
                            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                          >
                            {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Expanded Content */}
                  {isExpanded && (
                    <div className="px-4 sm:px-6 pb-4 sm:pb-6 border-t border-gray-100">
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

                      {/* Event Details */}
                      {message.message_type === 'event' && message.event_details && (
                        <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg space-y-2">
                          <div className="flex items-center space-x-2 text-blue-900">
                            <Calendar className="w-5 h-5 text-blue-600" />
                            <span className="font-semibold">Event Details</span>
                          </div>
                          <div className="space-y-1 text-sm text-blue-800">
                            <p><strong>Date:</strong> {message.event_details.date}</p>
                            <p><strong>Time:</strong> {message.event_details.time}</p>
                            <p><strong>Location:</strong> {message.event_details.location}</p>
                            {message.event_details.rsvp_required && (
                              <p className="text-yellow-700 font-semibold">RSVP Required</p>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Task Details */}
                      {message.message_type === 'task' && message.task_details && (
                        <div className="mt-4 p-4 bg-purple-50 border border-purple-200 rounded-lg space-y-2">
                          <div className="flex items-center space-x-2 text-purple-900">
                            <CheckSquare className="w-5 h-5 text-purple-600" />
                            <span className="font-semibold">Task Details</span>
                          </div>
                          <div className="space-y-1 text-sm text-purple-800">
                            <p><strong>Due Date:</strong> {new Date(message.task_details.due_date).toLocaleDateString()}</p>
                            <p><strong>Status:</strong> <span className="capitalize">{message.task_details.status}</span></p>
                            {message.task_details.assignees && message.task_details.assignees.length > 0 && (
                              <p><strong>Assignees:</strong> {message.task_details.assignees.length}</p>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Survey - Survey.js Format (New) */}
                      {message.message_type === 'survey' && message.survey_questions &&
                       typeof message.survey_questions === 'object' && 'elements' in message.survey_questions && (
                        <div className="mt-4">
                          {message.user_response ? (
                            <div className="space-y-4">
                              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                                <div className="flex items-center space-x-2 text-green-700">
                                  <Check className="w-5 h-5" />
                                  <span className="font-medium">
                                    Survey completed on{' '}
                                    {new Date(message.user_response.created_at).toLocaleDateString()}
                                  </span>
                                </div>
                              </div>
                              <SurveyRenderer
                                surveyJson={message.survey_questions}
                                onComplete={() => {}}
                                disabled={true}
                                initialData={safeJsonParse(message.user_response.text_response)}
                              />
                            </div>
                          ) : (
                            <SurveyRenderer
                              surveyJson={message.survey_questions}
                              onComplete={(results) => {
                                // Store full Survey.js results object
                                handleSurveyResponse(message.id, results, true);
                              }}
                            />
                          )}
                        </div>
                      )}

                      {/* Survey - Legacy Format (Old) */}
                      {message.message_type === 'survey' && message.survey_questions && Array.isArray(message.survey_questions) && (
                        <div className="mt-4 space-y-6">
                          {message.survey_questions.map((question, qIdx) => (
                            <div key={question.id || qIdx}>
                              <h4 className="font-semibold text-gray-900 mb-3">
                                {question.text}
                                {question.required && <span className="text-red-500 ml-1">*</span>}
                              </h4>
                              {message.user_response ? (
                                <div className="space-y-2">
                                  {question.options?.map((option, idx) => (
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
                                  {qIdx === message.survey_questions!.length - 1 && (
                                    <p className="text-sm text-gray-600 mt-2">
                                      ✓ You submitted your response on{' '}
                                      {new Date(message.user_response.created_at).toLocaleDateString()}
                                    </p>
                                  )}
                                </div>
                              ) : question.options ? (
                                <SurveyResponse
                                  options={question.options}
                                  allowMultiple={question.allow_multiple || false}
                                  onSubmit={(selected) => handleSurveyResponse(message.id, selected)}
                                />
                              ) : null}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Survey - Old Format (Backward Compatibility) */}
                      {message.message_type === 'survey' && message.survey_options && !message.survey_questions && (
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
                          {message.has_acknowledgment ? (
                            <div className="flex items-center space-x-2 text-green-600">
                              <Check className="w-5 h-5" />
                              <span className="font-medium">
                                ✓ Acknowledged
                              </span>
                            </div>
                          ) : (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleAcknowledge(message.id);
                              }}
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
                            onClick={(e) => e.stopPropagation()}
                          >
                            <ExternalLink className="w-4 h-4" />
                            <span>View linked document</span>
                          </a>
                        </div>
                      )}

                      {/* Reactions */}
                      <div className="mt-6 pt-4 border-t border-gray-200">
                        <div className="flex flex-wrap items-center gap-2 mb-3">
                          {['👍', '❤️', '😊', '🎉', '👏'].map((emoji) => {
                            const messageReactions = reactions.get(message.id) || [];
                            const reactionData = messageReactions.find(r => r.emoji === emoji);
                            const isActive = reactionData?.hasReacted || false;

                            return (
                              <button
                                key={emoji}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleAddReaction(message.id, emoji);
                                }}
                                className={`px-3 py-1.5 rounded-full border-2 transition-all flex items-center space-x-1.5 ${
                                  isActive
                                    ? 'bg-blue-50 border-blue-400 text-blue-700'
                                    : 'bg-white border-gray-300 hover:border-blue-300 hover:bg-blue-50'
                                }`}
                                title={reactionData ? reactionData.users.join(', ') : 'React'}
                              >
                                <span className="text-lg">{emoji}</span>
                                {reactionData && reactionData.count > 0 && (
                                  <span className="text-sm font-medium">{reactionData.count}</span>
                                )}
                              </button>
                            );
                          })}
                        </div>

                        {/* Comments Section */}
                        <div className="mt-4">
                          <div className="flex items-center space-x-2 mb-3">
                            <MessageCircle className="w-5 h-5 text-gray-600" />
                            <h4 className="font-semibold text-gray-900">
                              Comments ({comments.get(message.id)?.length || 0})
                            </h4>
                          </div>

                          {/* Existing Comments */}
                          <div className="space-y-3 mb-4">
                            {comments.get(message.id)?.map((comment) => (
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

                          {/* Add Comment Input */}
                          <div className="flex items-start space-x-2">
                            <textarea
                              value={newComment.get(message.id) || ''}
                              onChange={(e) => {
                                setNewComment(prev => {
                                  const updated = new Map(prev);
                                  updated.set(message.id, e.target.value);
                                  return updated;
                                });
                              }}
                              placeholder="Add a comment..."
                              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                              rows={2}
                              onClick={(e) => e.stopPropagation()}
                            />
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleAddComment(message.id);
                              }}
                              disabled={!newComment.get(message.id)?.trim()}
                              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                            >
                              <Send className="w-4 h-4" />
                              <span>Send</span>
                            </button>
                          </div>
                        </div>
                      </div>
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
          onClick={(e) => {
            e.stopPropagation();
            handleToggle(option);
          }}
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
        onClick={(e) => {
          e.stopPropagation();
          onSubmit(selected);
        }}
        disabled={selected.length === 0}
        className="w-full px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Submit Response
      </button>
    </div>
  );
}
