import { ArrowLeft, DollarSign, Package, Wrench, Building2, AlertTriangle, Clock, User, Calendar, TrendingUp, MessageSquare, Users, Volume2, Edit2, CheckCircle, PlayCircle, Archive, Image, ChevronDown, ChevronUp, Send, Paperclip, Camera, FileText, UserPlus, X, Eye } from 'lucide-react';
import type { Request } from '../lib/requests';
import { useRequestAge, useUsers } from '../hooks/useRequests';
import { useRequestQuery, useRequestNotesQuery, useRequestActivityQuery, useAddRequestNoteMutation, useAssignRequestMutation } from '../hooks/useRequestsQuery';
import { markRequestAsViewed, addRequestAttachment, getRequestAttachments, getRequestWatchers, addRequestWatcher, removeRequestWatcher, type RequestAttachment, type RequestWatcher } from '../lib/requests';
import { useState, useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import { showError } from '../../../lib/toast';
import { useAuth } from '../../../contexts/AuthContext';

interface RequestDetailProps {
  requestId: string;
  onClose: () => void;
  onUpdate?: () => void;
}

const RequestAgeIndicator = ({ request }: { request: Request }) => {
  const age = useRequestAge(request);

  const colorClasses = {
    green: 'bg-green-100 text-green-700 border-green-200',
    yellow: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    red: 'bg-red-100 text-red-700 border-red-200'
  };

  const ageText = age.days > 0
    ? `${age.days}d ${age.hours % 24}h`
    : `${age.hours}h`;

  return (
    <div className={`inline-flex items-center gap-1 px-2 py-1 border rounded-full text-xs font-medium ${colorClasses[age.color as keyof typeof colorClasses]}`}>
      <Clock className="w-3 h-3" />
      {ageText}
    </div>
  );
};

export default function RequestDetail({ requestId, onClose, onUpdate }: RequestDetailProps) {
  const queryClient = useQueryClient();

  // Fetch request data directly using React Query
  const { data: request, isLoading: requestLoading } = useRequestQuery(requestId);

  const age = useRequestAge(request || null);
  const { data: notes = [], isLoading: notesLoading } = useRequestNotesQuery(requestId);
  const { data: activity = [], isLoading: activityLoading } = useRequestActivityQuery(requestId);
  const { mutateAsync: addNote } = useAddRequestNoteMutation();
  const { mutateAsync: assignRequest } = useAssignRequestMutation();
  const { users } = useUsers();
  const { profile } = useAuth();
  const [newNote, setNewNote] = useState('');
  const [addingNote, setAddingNote] = useState(false);
  const [submitterName, setSubmitterName] = useState<string>('');
  const [userProfiles, setUserProfiles] = useState<Map<string, string>>(new Map());
  const [isChangingAssignee, setIsChangingAssignee] = useState(false);
  const [isEditingRequest, setIsEditingRequest] = useState(false);
  const [isChangingStage, setIsChangingStage] = useState(false);
  const [isChangingQuoteStatus, setIsChangingQuoteStatus] = useState(false);
  const [editedRequest, setEditedRequest] = useState<Partial<Request>>({});
  const [projectDetailsExpanded, setProjectDetailsExpanded] = useState(false);
  const [transcriptExpanded, setTranscriptExpanded] = useState(false);
  const [activityExpanded, setActivityExpanded] = useState(false);
  const [internalNote, setInternalNote] = useState('');
  const [addingInternalNote, setAddingInternalNote] = useState(false);
  const [mobileTab, setMobileTab] = useState<'chat' | 'details' | 'files'>('chat');
  const [attachments, setAttachments] = useState<RequestAttachment[]>([]);
  const [loadingAttachments, setLoadingAttachments] = useState(true);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [watchers, setWatchers] = useState<RequestWatcher[]>([]);
  const [, setLoadingWatchers] = useState(true);
  const [isAddingWatcher, setIsAddingWatcher] = useState(false);
  const [selectedWatcherId, setSelectedWatcherId] = useState<string>('');
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [showFilePickerModal, setShowFilePickerModal] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const documentInputRef = useRef<HTMLInputElement>(null);

  // Check if user can edit (admin or operations)
  const canEdit = profile?.role === 'admin' || profile?.role === 'operations';

  // Mark request as viewed when component mounts
  useEffect(() => {
    if (requestId) {
      markRequestAsViewed(requestId);
    }
  }, [requestId]);

  // Update editedRequest when request data loads
  useEffect(() => {
    if (request) {
      setEditedRequest(request);
    }
  }, [request]);

  // Fetch submitter profile
  useEffect(() => {
    const fetchSubmitter = async () => {
      if (request?.submitter_id) {
        const { data } = await supabase
          .from('user_profiles')
          .select('full_name, email')
          .eq('id', request.submitter_id)
          .single();

        if (data) {
          setSubmitterName(data.full_name || data.email || 'Unknown User');
        }
      }
    };
    fetchSubmitter();
  }, [request?.submitter_id]);

  // Derive assignee name from users array (updates automatically when assignee changes)
  const assigneeName = request?.assigned_to
    ? users.find(u => u.id === request.assigned_to)?.name || 'Unknown User'
    : '';

  // Fetch user profiles for notes and activity
  useEffect(() => {
    const fetchProfiles = async () => {
      // Combine user IDs from notes and activity
      const noteUserIds = notes.map(n => n.user_id);
      const activityUserIds = activity.map(a => a.user_id).filter((id): id is string => !!id);
      const userIds = [...new Set([...noteUserIds, ...activityUserIds])];

      if (userIds.length > 0) {
        const { data } = await supabase
          .from('user_profiles')
          .select('id, full_name, email')
          .in('id', userIds);

        if (data) {
          const profileMap = new Map(data.map(p => [p.id, p.full_name || p.email || 'Unknown']));
          setUserProfiles(profileMap);
        }
      }
    };
    fetchProfiles();
  }, [notes, activity]);

  // Fetch attachments
  useEffect(() => {
    if (!requestId) return;
    const fetchAttachments = async () => {
      try {
        const data = await getRequestAttachments(requestId);
        setAttachments(data);
      } catch (error) {
        console.error('Failed to fetch attachments:', error);
      } finally {
        setLoadingAttachments(false);
      }
    };
    fetchAttachments();
  }, [requestId]);

  // Fetch watchers
  useEffect(() => {
    if (!requestId) return;
    const fetchWatchers = async () => {
      try {
        const data = await getRequestWatchers(requestId);
        setWatchers(data);
      } catch (error) {
        console.error('Failed to fetch watchers:', error);
      } finally {
        setLoadingWatchers(false);
      }
    };
    fetchWatchers();
  }, [requestId]);

  // Show loading state while request is being fetched
  if (requestLoading || !request) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading request...</p>
        </div>
      </div>
    );
  }

  const getRequestTypeInfo = () => {
    switch (request.request_type) {
      case 'pricing':
        return { label: 'Pricing', icon: <DollarSign className="w-5 h-5" />, color: 'orange' };
      case 'material':
        return { label: 'Material', icon: <Package className="w-5 h-5" />, color: 'yellow' };
      case 'warranty':
        return { label: 'Warranty', icon: <Wrench className="w-5 h-5" />, color: 'red' };
      case 'new_builder':
        return { label: 'New Builder', icon: <Building2 className="w-5 h-5" />, color: 'blue' };
      case 'support':
        return { label: 'Support', icon: <AlertTriangle className="w-5 h-5" />, color: 'purple' };
      default:
        return { label: 'Request', icon: <AlertTriangle className="w-5 h-5" />, color: 'gray' };
    }
  };

  const typeInfo = getRequestTypeInfo();

  const handleAddNote = async () => {
    if (!newNote.trim()) return;

    setAddingNote(true);
    try {
      await addNote({ requestId, content: newNote, noteType: 'comment' });
      setNewNote('');
    } catch (error) {
      console.error('Failed to add note:', error);
      showError('Failed to add note. Please try again.');
    } finally {
      setAddingNote(false);
    }
  };

  const handleChangeAssignee = async (newAssigneeId: string) => {
    try {
      if (newAssigneeId === 'unassigned') {
        // Handle unassigning - use direct Supabase call as there's no mutation for this
        const { error } = await supabase
          .from('requests')
          .update({ assigned_to: null, assigned_at: null })
          .eq('id', requestId);

        if (error) {
          console.error('Supabase error:', error);
          throw error;
        }

        // Manually invalidate queries since we're not using a mutation hook
        await queryClient.invalidateQueries({ queryKey: ['requests'] });
      } else {
        // Use the mutation hook for assigning (automatically invalidates queries)
        await assignRequest({ requestId, assigneeId: newAssigneeId });
      }

      setIsChangingAssignee(false);
      if (onUpdate) {
        onUpdate();
      }
    } catch (error: any) {
      console.error('Failed to change assignee:', error);
      showError(`Failed to change assignee: ${error.message || 'Please try again.'}`);
      setIsChangingAssignee(false);
    }
  };

  const handleChangeStage = async (newStage: string) => {
    try {
      const { error } = await supabase
        .from('requests')
        .update({ stage: newStage })
        .eq('id', requestId);

      if (error) throw error;

      // Invalidate queries to trigger refetch
      await queryClient.invalidateQueries({ queryKey: ['requests'] });

      setIsChangingStage(false);
      if (onUpdate) {
        onUpdate();
      }
    } catch (error: any) {
      console.error('Failed to change stage:', error);
      showError(`Failed to change stage: ${error.message || 'Please try again.'}`);
      setIsChangingStage(false);
    }
  };

  const handleChangeQuoteStatus = async (newStatus: string) => {
    try {
      const { error } = await supabase
        .from('requests')
        .update({ quote_status: newStatus === 'none' ? null : newStatus })
        .eq('id', requestId);

      if (error) throw error;

      // Invalidate queries to trigger refetch
      await queryClient.invalidateQueries({ queryKey: ['requests'] });

      setIsChangingQuoteStatus(false);
      if (onUpdate) {
        onUpdate();
      }
    } catch (error: any) {
      console.error('Failed to change quote status:', error);
      showError(`Failed to change quote status: ${error.message || 'Please try again.'}`);
      setIsChangingQuoteStatus(false);
    }
  };

  const handleSaveRequest = async () => {
    try {
      const { error } = await supabase
        .from('requests')
        .update(editedRequest)
        .eq('id', requestId);

      if (error) throw error;

      // Invalidate queries to trigger refetch
      await queryClient.invalidateQueries({ queryKey: ['requests'] });

      setIsEditingRequest(false);
      if (onUpdate) {
        onUpdate();
      }
    } catch (error: any) {
      console.error('Failed to save request:', error);
      showError(`Failed to save request: ${error.message || 'Please try again.'}`);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setUploadingFile(true);
    setShowFilePickerModal(false);
    try {
      for (const file of Array.from(files)) {
        // Upload to attachments
        const attachment = await addRequestAttachment(requestId, file);
        setAttachments(prev => [attachment, ...prev]);

        // Also add a note with the file so it shows inline in chat
        const isImage = file.type.startsWith('image/');
        const noteContent = isImage
          ? `📷 Shared an image: ${file.name}`
          : `📎 Shared a file: ${file.name}`;

        await addNote({
          requestId,
          content: noteContent,
          noteType: 'comment',
          fileUrl: attachment.file_url,
          fileName: attachment.file_name,
          fileType: attachment.file_type
        });
      }
    } catch (error) {
      console.error('Failed to upload file:', error);
      showError('Failed to upload file. Please try again.');
    } finally {
      setUploadingFile(false);
      // Reset file inputs
      event.target.value = '';
      if (photoInputRef.current) photoInputRef.current.value = '';
      if (documentInputRef.current) documentInputRef.current.value = '';
    }
  };

  const handleAddWatcher = async () => {
    if (!selectedWatcherId) return;

    try {
      await addRequestWatcher(requestId, selectedWatcherId);
      // Refresh watchers list
      const data = await getRequestWatchers(requestId);
      setWatchers(data);
      setSelectedWatcherId('');
      setIsAddingWatcher(false);
    } catch (error) {
      console.error('Failed to add watcher:', error);
      showError('Failed to add watcher. Please try again.');
    }
  };

  const handleRemoveWatcher = async (watcherId: string) => {
    try {
      await removeRequestWatcher(requestId, watcherId);
      setWatchers(prev => prev.filter(w => w.user_id !== watcherId));
    } catch (error) {
      console.error('Failed to remove watcher:', error);
      showError('Failed to remove watcher. Please try again.');
    }
  };

  // Get users that can be added as watchers (not already watching, not submitter, not assignee)
  const availableWatchers = users.filter(user =>
    user.id !== request?.submitter_id &&
    user.id !== request?.assigned_to &&
    !watchers.some(w => w.user_id === user.id)
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="px-4 py-3">
          <div className="flex items-center gap-3 mb-3 lg:mb-0">
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex-1">
              <h1 className="text-lg font-bold text-gray-900">{request.title}</h1>
              <p className="text-xs text-gray-600">{typeInfo.label} Request</p>
              <div className="lg:hidden">
                {submitterName && (
                  <p className="text-xs text-gray-600 mt-1">
                    Submitted by: <span className="font-medium">{submitterName}</span>
                  </p>
                )}
                {request.submitted_at && (
                  <p className="text-xs text-gray-500">
                    {new Date(request.submitted_at).toLocaleDateString()} at {new Date(request.submitted_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                )}
              </div>
            </div>
            {canEdit && !isEditingRequest ? (
              <button
                onClick={() => {
                  setIsEditingRequest(true);
                  setEditedRequest(request);
                }}
                className="p-2 hover:bg-blue-50 rounded-lg transition-colors text-blue-600"
                title="Edit Request"
              >
                <Edit2 className="w-5 h-5" />
              </button>
            ) : canEdit && isEditingRequest ? (
              <div className="flex gap-2">
                <button
                  onClick={handleSaveRequest}
                  className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700"
                >
                  Save
                </button>
                <button
                  onClick={() => {
                    setIsEditingRequest(false);
                    setEditedRequest(request);
                  }}
                  className="px-3 py-1.5 bg-gray-200 text-gray-700 rounded-lg text-xs font-medium hover:bg-gray-300"
                >
                  Cancel
                </button>
              </div>
            ) : null}
          </div>

          {/* Desktop: Consolidated header info */}
          <div className="hidden lg:flex lg:items-center lg:gap-4 lg:mt-3 lg:pt-3 lg:border-t lg:border-gray-200 flex-wrap">
            <div className="flex items-center gap-2 text-sm">
              <User className="w-4 h-4 text-gray-400" />
              <span className="text-gray-600">Submitted by:</span>
              <span className="font-medium">{submitterName || 'Unknown'}</span>
              <span className="text-gray-400">|</span>
              <span className="text-gray-500 text-xs">
                {request.submitted_at && new Date(request.submitted_at).toLocaleDateString()}
              </span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Users className="w-4 h-4 text-gray-400" />
              <span className="text-gray-600">Assigned to:</span>
              {!isChangingAssignee && canEdit ? (
                <>
                  <span className="font-medium">{assigneeName || 'Unassigned'}</span>
                  <button
                    onClick={() => setIsChangingAssignee(true)}
                    className="text-xs text-blue-600 hover:text-blue-700"
                  >
                    Change
                  </button>
                </>
              ) : !isChangingAssignee ? (
                <span className="font-medium">{assigneeName || 'Unassigned'}</span>
              ) : (
                <select
                  key={request.assigned_to || 'unassigned'}
                  defaultValue={request.assigned_to || 'unassigned'}
                  onChange={(e) => handleChangeAssignee(e.target.value)}
                  className="px-2 py-1 border border-gray-300 rounded text-xs"
                  autoFocus
                >
                  <option value="unassigned">Unassigned</option>
                  {users.map(user => (
                    <option key={user.id} value={user.id}>{user.name}</option>
                  ))}
                </select>
              )}
            </div>
            <div className="flex items-center gap-2 text-sm">
              <TrendingUp className="w-4 h-4 text-gray-400" />
              <span className="text-gray-600">Urgency:</span>
              <span className={`font-medium capitalize ${
                request.urgency === 'critical' ? 'text-red-600' :
                request.urgency === 'high' ? 'text-orange-600' :
                request.urgency === 'medium' ? 'text-yellow-600' :
                'text-green-600'
              }`}>
                {request.urgency}
              </span>
            </div>
            {/* Watchers */}
            <div className="flex items-center gap-2 text-sm">
              <Eye className="w-4 h-4 text-gray-400" />
              <span className="text-gray-600">Watchers:</span>
              <div className="flex items-center gap-1">
                {watchers.length > 0 ? (
                  watchers.slice(0, 3).map(watcher => (
                    <span key={watcher.user_id} className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 rounded text-xs">
                      {watcher.user?.full_name || watcher.user?.email || 'Unknown'}
                      {canEdit && (
                        <button
                          onClick={() => handleRemoveWatcher(watcher.user_id)}
                          className="text-gray-400 hover:text-red-500"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </span>
                  ))
                ) : (
                  <span className="text-gray-400 text-xs">None</span>
                )}
                {watchers.length > 3 && (
                  <span className="text-xs text-gray-500">+{watchers.length - 3} more</span>
                )}
                {canEdit && (
                  <button
                    onClick={() => setIsAddingWatcher(true)}
                    className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                    title="Add watcher"
                  >
                    <UserPlus className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Clock className="w-4 h-4 text-gray-400" />
              <RequestAgeIndicator request={request} />
            </div>
            {/* Stage buttons on desktop header */}
            {canEdit && (
              <div className="flex items-center gap-2 ml-auto">
                {request.stage !== 'new' && (
                  <button
                    onClick={() => handleChangeStage('new')}
                    className="px-2 py-1 bg-green-50 border border-green-200 text-green-700 rounded text-xs hover:bg-green-100"
                  >
                    Mark New
                  </button>
                )}
                {request.stage !== 'completed' && (
                  <button
                    onClick={() => handleChangeStage('completed')}
                    className="px-2 py-1 bg-blue-50 border border-blue-200 text-blue-700 rounded text-xs hover:bg-blue-100"
                  >
                    Complete
                  </button>
                )}
                {request.stage !== 'archived' && (
                  <button
                    onClick={() => handleChangeStage('archived')}
                    className="px-2 py-1 bg-gray-50 border border-gray-200 text-gray-700 rounded text-xs hover:bg-gray-100"
                  >
                    Archive
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Mobile Tab Navigation */}
        <div className="lg:hidden border-b border-gray-200 flex">
          <button
            onClick={() => setMobileTab('chat')}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              mobileTab === 'chat'
                ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
            }`}
          >
            Chat
          </button>
          <button
            onClick={() => setMobileTab('details')}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              mobileTab === 'details'
                ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
            }`}
          >
            Details
          </button>
          <button
            onClick={() => setMobileTab('files')}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              mobileTab === 'files'
                ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
            }`}
          >
            Files
          </button>
        </div>
      </div>

      {/* Desktop Layout: Two-column with sidebar */}
      <div className="lg:flex lg:gap-6 lg:p-6">
        {/* Main Content */}
        <div className="flex-1 p-4 lg:p-0 space-y-4 lg:pb-24">
        {/* Status Card */}
        <div className={`bg-white rounded-xl shadow-sm p-4 space-y-3 ${mobileTab !== 'details' ? 'hidden lg:block' : ''}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={`p-2 bg-${typeInfo.color}-100 rounded-lg text-${typeInfo.color}-600`}>
                {typeInfo.icon}
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">Status</p>
                <p className="text-lg font-bold text-gray-900 capitalize">{request.stage}</p>
              </div>
            </div>

            <div className={`inline-flex items-center gap-1 px-3 py-1.5 border rounded-full text-sm font-medium bg-${age.color === 'green' ? 'green' : age.color === 'yellow' ? 'yellow' : 'red'}-100 text-${age.color === 'green' ? 'green' : age.color === 'yellow' ? 'yellow' : 'red'}-700 border-${age.color === 'green' ? 'green' : age.color === 'yellow' ? 'yellow' : 'red'}-200`}>
              <Clock className="w-4 h-4" />
              {age.days > 0 ? `${age.days}d ${age.hours % 24}h` : `${age.hours}h`}
            </div>
          </div>

          {/* Quote Status */}
          <div className="border-t border-gray-200 pt-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm">
                <span className="text-gray-600">Quote Status:</span>
                {!isChangingQuoteStatus && (
                  <span className={`font-medium capitalize ${
                    request.quote_status === 'won' ? 'text-green-600' :
                    request.quote_status === 'lost' ? 'text-red-600' :
                    request.quote_status === 'awaiting' ? 'text-blue-600' :
                    'text-gray-500'
                  }`}>
                    {request.quote_status || 'Not Set'}
                  </span>
                )}
              </div>
              {!isChangingQuoteStatus && request.request_type === 'pricing' && (
                <button
                  onClick={() => setIsChangingQuoteStatus(true)}
                  className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                >
                  Change
                </button>
              )}
            </div>

            {isChangingQuoteStatus && (
              <div className="mt-2 space-y-2">
                <select
                  defaultValue={request.quote_status || 'none'}
                  onChange={(e) => handleChangeQuoteStatus(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="none">Not Set</option>
                  <option value="won">Won</option>
                  <option value="lost">Lost</option>
                  <option value="awaiting">Awaiting</option>
                </select>
                <button
                  onClick={() => setIsChangingQuoteStatus(false)}
                  className="text-xs text-gray-600 hover:text-gray-700"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Stage Management Workflow Buttons - Only for Admin/Operations */}
        {canEdit && (
          <div className={`bg-white rounded-xl shadow-sm p-4 lg:hidden ${mobileTab !== 'details' ? 'hidden' : ''}`}>
            <h3 className="font-semibold text-gray-900 mb-3 text-sm">Change Stage</h3>
            <div className="grid grid-cols-2 gap-2">
            {request.stage !== 'new' && (
              <button
                onClick={() => handleChangeStage('new')}
                className="flex items-center justify-center gap-2 px-3 py-2 bg-green-50 border border-green-200 text-green-700 rounded-lg hover:bg-green-100 transition-colors text-sm font-medium"
                disabled={isChangingStage}
              >
                <PlayCircle className="w-4 h-4" />
                New
              </button>
            )}
            {request.stage !== 'pending' && (
              <button
                onClick={() => handleChangeStage('pending')}
                className="flex items-center justify-center gap-2 px-3 py-2 bg-yellow-50 border border-yellow-200 text-yellow-700 rounded-lg hover:bg-yellow-100 transition-colors text-sm font-medium"
                disabled={isChangingStage}
              >
                <Clock className="w-4 h-4" />
                In Progress
              </button>
            )}
            {request.stage !== 'completed' && (
              <button
                onClick={() => handleChangeStage('completed')}
                className="flex items-center justify-center gap-2 px-3 py-2 bg-blue-50 border border-blue-200 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors text-sm font-medium"
                disabled={isChangingStage}
              >
                <CheckCircle className="w-4 h-4" />
                Complete
              </button>
            )}
            {request.stage !== 'archived' && (
              <button
                onClick={() => handleChangeStage('archived')}
                className="flex items-center justify-center gap-2 px-3 py-2 bg-gray-50 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors text-sm font-medium"
                disabled={isChangingStage}
              >
                <Archive className="w-4 h-4" />
                Archive
              </button>
            )}
            </div>
          </div>
        )}

        {/* Customer Info */}
        {(request.customer_name || isEditingRequest) && (
          <div className={`bg-white rounded-xl shadow-sm p-4 space-y-2 ${mobileTab !== 'details' ? 'hidden lg:block' : ''}`}>
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <User className="w-4 h-4" />
              Customer Information
            </h3>
            {isEditingRequest ? (
              <div className="space-y-2">
                <div>
                  <label className="text-xs text-gray-600">Name:</label>
                  <input
                    type="text"
                    value={editedRequest.customer_name || ''}
                    onChange={(e) => setEditedRequest({...editedRequest, customer_name: e.target.value})}
                    className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-600">Address:</label>
                  <input
                    type="text"
                    value={editedRequest.customer_address || ''}
                    onChange={(e) => setEditedRequest({...editedRequest, customer_address: e.target.value})}
                    className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-600">Phone:</label>
                  <input
                    type="tel"
                    value={editedRequest.customer_phone || ''}
                    onChange={(e) => setEditedRequest({...editedRequest, customer_phone: e.target.value})}
                    className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-600">Email:</label>
                  <input
                    type="email"
                    value={editedRequest.customer_email || ''}
                    onChange={(e) => setEditedRequest({...editedRequest, customer_email: e.target.value})}
                    className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-1 text-sm">
                <p><span className="text-gray-600">Name:</span> <span className="font-medium">{request.customer_name}</span></p>
                {request.customer_address && <p><span className="text-gray-600">Address:</span> <span className="font-medium">{request.customer_address}</span></p>}
                {request.customer_phone && <p><span className="text-gray-600">Phone:</span> <span className="font-medium">{request.customer_phone}</span></p>}
                {request.customer_email && <p><span className="text-gray-600">Email:</span> <span className="font-medium">{request.customer_email}</span></p>}
              </div>
            )}
          </div>
        )}

        {/* Project Details */}
        {(request.fence_type || request.linear_feet || request.expected_value) && (
          <div className={`bg-white rounded-xl shadow-sm overflow-hidden lg:p-4 ${mobileTab !== 'details' ? 'hidden lg:block' : ''}`}>
            <button
              onClick={() => setProjectDetailsExpanded(!projectDetailsExpanded)}
              className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors lg:hidden"
            >
              <h3 className="font-semibold text-gray-900">Project Details</h3>
              {projectDetailsExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            <h3 className="hidden lg:block font-semibold text-gray-900 mb-2">Project Details</h3>
            <div className={`space-y-1 text-sm ${projectDetailsExpanded || window.innerWidth >= 1024 ? 'block px-4 pb-4 lg:px-0 lg:pb-0' : 'hidden'}`}>
              {request.fence_type && <p><span className="text-gray-600">Fence Type:</span> <span className="font-medium">{request.fence_type}</span></p>}
              {request.linear_feet && <p><span className="text-gray-600">Linear Feet:</span> <span className="font-medium">{request.linear_feet}</span></p>}
              {request.expected_value && <p><span className="text-gray-600">Expected Value:</span> <span className="font-medium">${request.expected_value.toLocaleString()}</span></p>}
            </div>
          </div>
        )}

        {/* Description */}
        {(request.description || isEditingRequest) && (
          <div className={`bg-white rounded-xl shadow-sm p-4 space-y-2 ${mobileTab !== 'details' ? 'hidden lg:block' : ''}`}>
            <h3 className="font-semibold text-gray-900">Description</h3>
            {isEditingRequest ? (
              <textarea
                value={editedRequest.description || ''}
                onChange={(e) => setEditedRequest({...editedRequest, description: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm min-h-[100px]"
                placeholder="Enter description..."
              />
            ) : (
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{request.description}</p>
            )}
          </div>
        )}

        {/* Special Requirements */}
        {(request.special_requirements || isEditingRequest) && (
          <div className={`bg-white rounded-xl shadow-sm p-4 space-y-2 ${mobileTab !== 'details' ? 'hidden lg:block' : ''}`}>
            <h3 className="font-semibold text-gray-900">Special Requirements</h3>
            {isEditingRequest ? (
              <textarea
                value={editedRequest.special_requirements || ''}
                onChange={(e) => setEditedRequest({...editedRequest, special_requirements: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm min-h-[100px]"
                placeholder="Enter special requirements..."
              />
            ) : (
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{request.special_requirements}</p>
            )}
          </div>
        )}

        {/* Pricing Quote */}
        {request.pricing_quote && (
          <div className={`bg-green-50 border border-green-200 rounded-xl p-4 ${mobileTab !== 'details' ? 'hidden lg:block' : ''}`}>
            <h3 className="font-semibold text-green-900 mb-1">Pricing Quote</h3>
            <p className="text-2xl font-bold text-green-700">${request.pricing_quote.toLocaleString()}</p>
            {request.quoted_at && (
              <p className="text-xs text-green-600 mt-1">
                Quoted on {new Date(request.quoted_at).toLocaleDateString()}
              </p>
            )}
          </div>
        )}

        {/* Voice Recording & Transcript - Mobile Only */}
        {(request.voice_recording_url || request.transcript) && (
          <div className={`bg-purple-50 border border-purple-200 rounded-xl overflow-hidden lg:hidden ${mobileTab !== 'files' ? 'hidden' : ''}`}>
            <div className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-purple-900 flex items-center gap-2">
                  <Volume2 className="w-5 h-5" />
                  Voice Recording
                  {request.transcript && (
                    <span className="ml-2 text-xs text-purple-600 font-normal">
                      ({transcriptExpanded ? 'Transcript visible' : 'Has transcript'})
                    </span>
                  )}
                </h3>
                {request.transcript && (
                  <button
                    onClick={() => setTranscriptExpanded(!transcriptExpanded)}
                    className="text-sm text-purple-700 hover:text-purple-900 font-medium flex items-center gap-1"
                  >
                    {transcriptExpanded ? (
                      <>
                        Hide Transcript <ChevronUp className="w-4 h-4" />
                      </>
                    ) : (
                      <>
                        Show Transcript <ChevronDown className="w-4 h-4" />
                      </>
                    )}
                  </button>
                )}
              </div>

              {/* Audio Player */}
              {request.voice_recording_url && (
                <div className="bg-white rounded-lg p-3 shadow-sm">
                  <audio
                    controls
                    className="w-full"
                    preload="auto"
                    src={request.voice_recording_url}
                  >
                    Your browser does not support the audio element.
                  </audio>
                  {request.voice_duration && (
                    <p className="text-xs text-gray-500 mt-2">
                      Duration: {Math.floor(request.voice_duration / 60)}:{(request.voice_duration % 60).toString().padStart(2, '0')}
                    </p>
                  )}
                </div>
              )}

              {/* Transcript - Collapsed by default */}
              {request.transcript && transcriptExpanded && (
                <div className="space-y-2 mt-3">
                  <h4 className="text-sm font-medium text-purple-800">Transcript:</h4>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap bg-white rounded-lg p-3 max-h-96 overflow-y-auto">
                    {request.transcript}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Photos - Mobile Only */}
        {request.photo_urls && request.photo_urls.length > 0 && (
          <div className={`bg-white rounded-xl shadow-sm p-4 space-y-3 lg:hidden ${mobileTab !== 'files' ? 'hidden' : ''}`}>
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <Image className="w-4 h-4" />
              Photos ({request.photo_urls.length})
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {request.photo_urls.map((url, index) => (
                <button
                  key={index}
                  onClick={() => setLightboxImage(url)}
                  className="aspect-square rounded-lg overflow-hidden border border-gray-200 hover:border-blue-400 transition-colors cursor-pointer"
                >
                  <img
                    src={url}
                    alt={`Photo ${index + 1}`}
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Attachments - Mobile Only */}
        {(attachments.length > 0 || loadingAttachments) && (
          <div className={`bg-white rounded-xl shadow-sm p-4 space-y-3 lg:hidden ${mobileTab !== 'files' ? 'hidden' : ''}`}>
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Attachments ({attachments.length})
            </h3>
            {loadingAttachments ? (
              <p className="text-sm text-gray-600">Loading attachments...</p>
            ) : attachments.length === 0 ? (
              <p className="text-sm text-gray-600">No attachments yet</p>
            ) : (
              <div className="space-y-2">
                {/* Image attachments as grid */}
                {attachments.filter(a => a.file_type === 'image').length > 0 && (
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    {attachments.filter(a => a.file_type === 'image').map((attachment) => (
                      <button
                        key={attachment.id}
                        onClick={() => setLightboxImage(attachment.file_url)}
                        className="aspect-square rounded-lg overflow-hidden border border-gray-200 hover:border-blue-400 transition-colors cursor-pointer"
                      >
                        <img
                          src={attachment.file_url}
                          alt={attachment.file_name}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            // If image fails to load, show placeholder
                            e.currentTarget.style.display = 'none';
                            e.currentTarget.parentElement!.innerHTML = '<div class="w-full h-full flex items-center justify-center bg-gray-100"><span class="text-gray-400 text-xs">Image unavailable</span></div>';
                          }}
                        />
                      </button>
                    ))}
                  </div>
                )}
                {/* Non-image attachments as list */}
                {attachments.filter(a => a.file_type !== 'image').map((attachment) => (
                  <a
                    key={attachment.id}
                    href={attachment.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 p-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <div className="flex-shrink-0">
                      {attachment.file_type === 'document' && <FileText className="w-5 h-5 text-green-600" />}
                      {attachment.file_type === 'audio' && <Volume2 className="w-5 h-5 text-purple-600" />}
                      {attachment.file_type === 'video' && <PlayCircle className="w-5 h-5 text-red-600" />}
                      {attachment.file_type === 'other' && <Paperclip className="w-5 h-5 text-gray-600" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{attachment.file_name}</p>
                      <p className="text-xs text-gray-500">
                        {attachment.file_size ? `${(attachment.file_size / 1024).toFixed(1)} KB • ` : ''}
                        {new Date(attachment.uploaded_at).toLocaleDateString()}
                      </p>
                    </div>
                  </a>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Notes/Chat Section */}
        <div className={`bg-white rounded-xl shadow-sm p-4 space-y-3 pb-20 lg:pb-4 ${mobileTab !== 'chat' ? 'hidden lg:block' : ''}`}>
          <h3 className="font-semibold text-gray-900 flex items-center gap-2">
            <MessageSquare className="w-4 h-4" />
            Messages & Notes
          </h3>

          {/* Notes List */}
          <div className="space-y-2">
            {notesLoading ? (
              <p className="text-sm text-gray-600">Loading messages...</p>
            ) : notes.length === 0 ? (
              <p className="text-sm text-gray-600 text-center py-4">No messages yet. Start the conversation using the message bar below!</p>
            ) : (
              notes.filter(note => note.note_type !== 'internal').map((note) => (
                <div key={note.id} className="bg-blue-50 border border-blue-100 rounded-lg p-3">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <p className="text-xs font-medium text-blue-900">
                      {userProfiles.get(note.user_id) || 'Unknown User'}
                    </p>
                    <p className="text-xs text-blue-600">
                      {new Date(note.created_at).toLocaleDateString()} {new Date(note.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  {/* Show inline image if note has an image file */}
                  {note.file_url && note.file_type === 'image' && (
                    <button
                      onClick={() => setLightboxImage(note.file_url!)}
                      className="mb-2 rounded-lg overflow-hidden border border-blue-200 hover:border-blue-400 transition-colors cursor-pointer max-w-xs"
                    >
                      <img
                        src={note.file_url}
                        alt={note.file_name || 'Shared image'}
                        className="w-full h-auto max-h-48 object-cover"
                      />
                    </button>
                  )}
                  {/* Show file link for non-image files */}
                  {note.file_url && note.file_type !== 'image' && (
                    <a
                      href={note.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mb-2 flex items-center gap-2 p-2 bg-white rounded border border-blue-200 hover:bg-blue-50 transition-colors"
                    >
                      <Paperclip className="w-4 h-4 text-blue-600" />
                      <span className="text-sm text-blue-700 truncate">{note.file_name || 'Download file'}</span>
                    </a>
                  )}
                  <p className="text-sm text-gray-800">{note.content}</p>
                </div>
              ))
            )}
          </div>

          {/* Internal Notes - Admin/Operations only */}
          {canEdit && (
            <div className="border-t border-gray-200 pt-3 mt-3">
              <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                <span className="w-2 h-2 bg-orange-500 rounded-full"></span>
                Internal Notes (Not visible to sales)
              </h4>
              <div className="space-y-2 mb-2">
                {notes.filter(note => note.note_type === 'internal').map((note) => (
                  <div key={note.id} className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <p className="text-xs font-medium text-orange-900">
                        {userProfiles.get(note.user_id) || 'Unknown User'}
                      </p>
                      <p className="text-xs text-orange-600">
                        {new Date(note.created_at).toLocaleDateString()} {new Date(note.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    <p className="text-sm text-gray-800">{note.content}</p>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={internalNote}
                  onChange={(e) => setInternalNote(e.target.value)}
                  placeholder="Add internal note..."
                  className="flex-1 px-3 py-2 border border-orange-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent text-sm"
                  onKeyDown={async (e) => {
                    // Only trigger on Enter, not during IME composition
                    if (e.key === 'Enter' && !e.nativeEvent.isComposing && internalNote.trim()) {
                      e.preventDefault();
                      setAddingInternalNote(true);
                      try {
                        await addNote({ requestId, content: internalNote, noteType: 'internal' });
                        setInternalNote('');
                      } finally {
                        setAddingInternalNote(false);
                      }
                    }
                  }}
                />
                <button
                  onClick={async () => {
                    if (internalNote.trim()) {
                      setAddingInternalNote(true);
                      try {
                        await addNote({ requestId, content: internalNote, noteType: 'internal' });
                        setInternalNote('');
                      } finally {
                        setAddingInternalNote(false);
                      }
                    }
                  }}
                  disabled={addingInternalNote || !internalNote.trim()}
                  className="px-4 py-2 bg-orange-600 text-white rounded-lg font-medium hover:bg-orange-700 transition-colors disabled:opacity-50 text-sm"
                >
                  {addingInternalNote ? 'Adding...' : 'Add'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Activity Timeline - Collapsed by default */}
        <div className={`bg-white rounded-xl shadow-sm overflow-hidden ${mobileTab !== 'details' ? 'hidden lg:block' : ''}`}>
          <button
            onClick={() => setActivityExpanded(!activityExpanded)}
            className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
          >
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Activity Timeline
              {activity.length > 0 && (
                <span className="ml-2 px-2 py-0.5 bg-blue-100 text-blue-600 rounded-full text-xs font-bold">
                  {activity.length}
                </span>
              )}
            </h3>
            {activityExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {activityExpanded && (
            <div className="p-4 border-t border-gray-200">
              {activityLoading ? (
                <p className="text-sm text-gray-600">Loading activity...</p>
              ) : activity.length === 0 ? (
                <p className="text-sm text-gray-600">No activity yet</p>
              ) : (
                <div className="relative">
                  {/* Timeline Line */}
                  <div className="absolute left-2 top-0 bottom-0 w-0.5 bg-blue-200"></div>

                  <div className="space-y-4">
                    {activity.map((item, index) => (
                      <div key={item.id} className="flex gap-3 text-sm relative">
                        {/* Timeline Dot */}
                        <div className={`w-4 h-4 rounded-full flex-shrink-0 z-10 ${
                          index === 0 ? 'bg-blue-600' : 'bg-blue-400'
                        } border-2 border-white`}></div>

                        <div className="flex-1 pb-2">
                          <div className="bg-blue-50 border border-blue-100 rounded-lg p-3">
                            <div className="flex items-start justify-between gap-2 mb-1">
                              <p className="text-gray-900 font-medium capitalize">
                                {item.action.replace('_', ' ')}
                              </p>
                              {item.user_id && (
                                <p className="text-xs text-gray-500">
                                  by {userProfiles.get(item.user_id) || 'Unknown'}
                                </p>
                              )}
                            </div>
                            {item.details && typeof item.details === 'object' && (item.details as any).message && (
                              <p className="text-xs text-gray-600 mb-1">{(item.details as any).message}</p>
                            )}
                            {item.details && typeof item.details === 'string' && (
                              <p className="text-xs text-gray-600 mb-1">{item.details}</p>
                            )}
                            <p className="text-xs text-blue-600">
                              {new Date(item.created_at).toLocaleDateString()} at {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
        </div>

        {/* Right Sidebar - Desktop Only */}
        <div className="hidden lg:block lg:w-96 space-y-4">
          {/* Voice Recording & Transcript - Desktop Only */}
          {(request.voice_recording_url || request.transcript) && (
            <div className="bg-purple-50 border border-purple-200 rounded-xl overflow-hidden">
              <div className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-purple-900 flex items-center gap-2">
                    <Volume2 className="w-5 h-5" />
                    Recording
                    {request.transcript && (
                      <span className="ml-2 text-xs text-purple-600 font-normal">
                        ({transcriptExpanded ? 'Expanded' : 'Collapsed'})
                      </span>
                    )}
                  </h3>
                  {request.transcript && (
                    <button
                      onClick={() => setTranscriptExpanded(!transcriptExpanded)}
                      className="text-sm text-purple-700 hover:text-purple-900 font-medium"
                    >
                      {transcriptExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  )}
                </div>

                {/* Audio Player */}
                {request.voice_recording_url && (
                  <div className="bg-white rounded-lg p-3 shadow-sm">
                    <audio
                      controls
                      className="w-full"
                      preload="auto"
                      src={request.voice_recording_url}
                    >
                      Your browser does not support the audio element.
                    </audio>
                    {request.voice_duration && (
                      <p className="text-xs text-gray-500 mt-2">
                        {Math.floor(request.voice_duration / 60)}:{(request.voice_duration % 60).toString().padStart(2, '0')}
                      </p>
                    )}
                  </div>
                )}

                {/* Transcript - Collapsed by default */}
                {request.transcript && transcriptExpanded && (
                  <div className="mt-3">
                    <h4 className="text-xs font-medium text-purple-800 mb-2">Transcript:</h4>
                    <p className="text-xs text-gray-700 whitespace-pre-wrap bg-white rounded-lg p-3 max-h-96 overflow-y-auto">
                      {request.transcript}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Photos Preview */}
          {request.photo_urls && request.photo_urls.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm p-4 space-y-3">
              <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                <Image className="w-4 h-4" />
                Photos ({request.photo_urls.length})
              </h3>
              <div className="grid grid-cols-2 gap-2">
                {request.photo_urls.map((url, index) => (
                  <button
                    key={index}
                    onClick={() => setLightboxImage(url)}
                    className="aspect-square rounded-lg overflow-hidden border border-gray-200 hover:border-blue-400 transition-colors cursor-pointer"
                  >
                    <img
                      src={url}
                      alt={`Photo ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Attachments Preview */}
          {(attachments.length > 0 || loadingAttachments) && (
            <div className="bg-white rounded-xl shadow-sm p-4 space-y-3">
              <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Attachments ({attachments.length})
              </h3>
              {loadingAttachments ? (
                <p className="text-sm text-gray-600">Loading...</p>
              ) : attachments.length === 0 ? (
                <p className="text-sm text-gray-600">No attachments yet</p>
              ) : (
                <div className="space-y-2">
                  {/* Image attachments as grid */}
                  {attachments.filter(a => a.file_type === 'image').length > 0 && (
                    <div className="grid grid-cols-2 gap-2 mb-2">
                      {attachments.filter(a => a.file_type === 'image').map((attachment) => (
                        <button
                          key={attachment.id}
                          onClick={() => setLightboxImage(attachment.file_url)}
                          className="aspect-square rounded-lg overflow-hidden border border-gray-200 hover:border-blue-400 transition-colors cursor-pointer"
                        >
                          <img
                            src={attachment.file_url}
                            alt={attachment.file_name}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                              e.currentTarget.parentElement!.innerHTML = '<div class="w-full h-full flex items-center justify-center bg-gray-100"><span class="text-gray-400 text-xs">Image unavailable</span></div>';
                            }}
                          />
                        </button>
                      ))}
                    </div>
                  )}
                  {/* Non-image attachments as list */}
                  {attachments.filter(a => a.file_type !== 'image').map((attachment) => (
                    <a
                      key={attachment.id}
                      href={attachment.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 p-2 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      <div className="flex-shrink-0">
                        {attachment.file_type === 'document' && <FileText className="w-4 h-4 text-green-600" />}
                        {attachment.file_type === 'audio' && <Volume2 className="w-4 h-4 text-purple-600" />}
                        {attachment.file_type === 'video' && <PlayCircle className="w-4 h-4 text-red-600" />}
                        {attachment.file_type === 'other' && <Paperclip className="w-4 h-4 text-gray-600" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-gray-900 truncate">{attachment.file_name}</p>
                        <p className="text-xs text-gray-500">
                          {attachment.file_size ? `${(attachment.file_size / 1024).toFixed(1)} KB` : ''}
                        </p>
                      </div>
                    </a>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Quick Actions */}
          {(request.customer_email || request.customer_phone) && (
            <div className="bg-white rounded-xl shadow-sm p-4 space-y-3">
              <h3 className="font-semibold text-gray-900">Quick Actions</h3>
              <div className="space-y-2">
                {request.customer_email && (
                  <a
                    href={`mailto:${request.customer_email}`}
                    className="block w-full px-3 py-2 bg-gray-50 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors text-sm font-medium text-left"
                  >
                    Email Customer
                  </a>
                )}
                {request.customer_phone && (
                  <a
                    href={`tel:${request.customer_phone}`}
                    className="block w-full px-3 py-2 bg-gray-50 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors text-sm font-medium text-left"
                  >
                    Call Customer
                  </a>
                )}
              </div>
            </div>
          )}

          {/* Request Metadata */}
          <div className="bg-white rounded-xl shadow-sm p-4 space-y-3">
            <h3 className="font-semibold text-gray-900">Details</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Created:</span>
                <span className="font-medium">{new Date(request.submitted_at).toLocaleDateString()}</span>
              </div>
              {request.project_number && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Project #:</span>
                  <span className="font-medium">{request.project_number}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-gray-600">Type:</span>
                <span className="font-medium capitalize">{request.request_type.replace('_', ' ')}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Sticky Message Bar at Bottom - Mobile */}
      <div className={`fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-2 shadow-lg z-20 lg:hidden ${mobileTab !== 'chat' ? 'hidden' : ''}`}>
        <div className="flex gap-1.5 items-center">
          {/* Hidden file inputs for photo and document */}
          <input
            ref={photoInputRef}
            type="file"
            id="mobile-photo-input"
            className="hidden"
            onChange={handleFileUpload}
            accept="image/*,video/*"
          />
          <input
            ref={documentInputRef}
            type="file"
            id="mobile-document-input"
            className="hidden"
            onChange={handleFileUpload}
            accept=".pdf,.doc,.docx,.txt,.xls,.xlsx"
          />
          <button
            type="button"
            onClick={() => setShowFilePickerModal(true)}
            className="flex items-center justify-center p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer flex-shrink-0"
          >
            <Paperclip className="w-5 h-5" />
          </button>
          <input
            type="text"
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 min-w-0 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            onKeyDown={(e) => {
              // Only trigger on Enter, not during IME composition
              if (e.key === 'Enter' && !e.nativeEvent.isComposing && newNote.trim()) {
                e.preventDefault();
                handleAddNote();
              }
            }}
          />
          <button
            onClick={handleAddNote}
            disabled={addingNote || !newNote.trim()}
            className="flex-shrink-0 p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
        {uploadingFile && (
          <div className="mt-2 text-xs text-blue-600 flex items-center gap-2">
            <div className="w-3 h-3 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            Uploading file...
          </div>
        )}
      </div>

      {/* Sticky Message Bar at Bottom - Desktop (doesn't overlap sidebar) */}
      <div className="hidden lg:block fixed bottom-0 left-0 right-0 lg:left-64 bg-white border-t border-gray-200 p-3 shadow-lg z-20">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex gap-2">
            <div className="flex gap-1">
              <input
                type="file"
                id="desktop-file-input"
                className="hidden"
                onChange={handleFileUpload}
                multiple
                accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.txt"
              />
              <label
                htmlFor="desktop-file-input"
                className="flex items-center justify-center px-3 py-3 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                title="Attach file"
              >
                <Paperclip className="w-5 h-5" />
              </label>
              <input
                type="file"
                id="desktop-camera-input"
                className="hidden"
                onChange={handleFileUpload}
                accept="image/*"
                capture="environment"
              />
              <label
                htmlFor="desktop-camera-input"
                className="flex items-center justify-center px-3 py-3 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                title="Take photo"
              >
                <Camera className="w-5 h-5" />
              </label>
            </div>
            <input
              type="text"
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              placeholder="Type your message..."
              className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              onKeyDown={(e) => {
                // Only trigger on Enter, not during IME composition
                if (e.key === 'Enter' && !e.nativeEvent.isComposing && newNote.trim()) {
                  e.preventDefault();
                  handleAddNote();
                }
              }}
            />
            <button
              onClick={handleAddNote}
              disabled={addingNote || !newNote.trim()}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              <Send className="w-5 h-5" />
              {addingNote ? 'Sending...' : 'Send'}
            </button>
          </div>
          {uploadingFile && (
            <div className="mt-2 text-sm text-blue-600 flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
              Uploading file...
            </div>
          )}
        </div>
      </div>

      {/* File Picker Modal - Mobile */}
      {showFilePickerModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end justify-center z-50 lg:hidden">
          <div className="bg-white rounded-t-xl shadow-xl w-full max-w-lg p-4 pb-8 animate-slide-up">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Attach File</h3>
              <button
                onClick={() => setShowFilePickerModal(false)}
                className="p-1 hover:bg-gray-100 rounded-full"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => {
                  setShowFilePickerModal(false);
                  photoInputRef.current?.click();
                }}
                className="flex flex-col items-center gap-2 p-4 bg-blue-50 hover:bg-blue-100 rounded-xl transition-colors border-2 border-blue-200"
              >
                <Image className="w-8 h-8 text-blue-600" />
                <span className="text-sm font-medium text-blue-900">Photo / Video</span>
                <span className="text-xs text-blue-600">From Gallery</span>
              </button>
              <button
                onClick={() => {
                  setShowFilePickerModal(false);
                  documentInputRef.current?.click();
                }}
                className="flex flex-col items-center gap-2 p-4 bg-green-50 hover:bg-green-100 rounded-xl transition-colors border-2 border-green-200"
              >
                <FileText className="w-8 h-8 text-green-600" />
                <span className="text-sm font-medium text-green-900">Document</span>
                <span className="text-xs text-green-600">PDF, Word, etc.</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Watcher Modal */}
      {isAddingWatcher && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Add Watcher</h3>
              <button
                onClick={() => {
                  setIsAddingWatcher(false);
                  setSelectedWatcherId('');
                }}
                className="p-1 hover:bg-gray-100 rounded-full"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              Watchers can see this request and will be notified of updates.
            </p>
            {availableWatchers.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4">
                No more users available to add as watchers.
              </p>
            ) : (
              <>
                <select
                  value={selectedWatcherId}
                  onChange={(e) => setSelectedWatcherId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent mb-4"
                >
                  <option value="">Select a user...</option>
                  {availableWatchers.map(user => (
                    <option key={user.id} value={user.id}>{user.name}</option>
                  ))}
                </select>
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => {
                      setIsAddingWatcher(false);
                      setSelectedWatcherId('');
                    }}
                    className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAddWatcher}
                    disabled={!selectedWatcherId}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                  >
                    Add Watcher
                  </button>
                </div>
              </>
            )}

            {/* Current watchers list */}
            {watchers.length > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-200">
                <h4 className="text-sm font-medium text-gray-700 mb-2">Current Watchers</h4>
                <div className="space-y-2">
                  {watchers.map(watcher => (
                    <div key={watcher.user_id} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                      <span className="text-sm">{watcher.user?.full_name || watcher.user?.email || 'Unknown'}</span>
                      <button
                        onClick={() => handleRemoveWatcher(watcher.user_id)}
                        className="text-red-500 hover:text-red-700 text-xs"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Image Lightbox Modal */}
      {lightboxImage && (
        <div
          className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-[60] p-4"
          onClick={() => setLightboxImage(null)}
        >
          <button
            onClick={() => setLightboxImage(null)}
            className="absolute top-4 right-4 p-2 text-white hover:bg-white/20 rounded-full transition-colors"
          >
            <X className="w-8 h-8" />
          </button>
          <img
            src={lightboxImage}
            alt="Full size image"
            className="max-w-full max-h-full object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
