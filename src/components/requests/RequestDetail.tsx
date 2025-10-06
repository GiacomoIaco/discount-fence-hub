import { ArrowLeft, DollarSign, Package, Wrench, Building2, AlertTriangle, Clock, User, Calendar, TrendingUp, MessageSquare, Users, Volume2, Edit2, CheckCircle, PlayCircle, Archive, Image } from 'lucide-react';
import type { Request } from '../../lib/requests';
import { useRequestAge, useUsers } from '../../hooks/useRequests';
import { useRequestNotes, useRequestActivity } from '../../hooks/useRequests';
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';

interface RequestDetailProps {
  request: Request;
  onClose: () => void;
}

export default function RequestDetail({ request, onClose }: RequestDetailProps) {
  const age = useRequestAge(request);
  const { notes, addNote, loading: notesLoading } = useRequestNotes(request.id);
  const { activity, loading: activityLoading } = useRequestActivity(request.id);
  const { users } = useUsers();
  const [newNote, setNewNote] = useState('');
  const [addingNote, setAddingNote] = useState(false);
  const [submitterName, setSubmitterName] = useState<string>('');
  const [assigneeName, setAssigneeName] = useState<string>('');
  const [userProfiles, setUserProfiles] = useState<Map<string, string>>(new Map());
  const [isChangingAssignee, setIsChangingAssignee] = useState(false);
  const [isEditingRequest, setIsEditingRequest] = useState(false);
  const [isChangingStage, setIsChangingStage] = useState(false);
  const [isChangingQuoteStatus, setIsChangingQuoteStatus] = useState(false);
  const [editedRequest, setEditedRequest] = useState<Partial<Request>>(request);

  // Fetch submitter profile
  useEffect(() => {
    const fetchSubmitter = async () => {
      if (request.submitter_id) {
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
  }, [request.submitter_id]);

  // Fetch assignee profile
  useEffect(() => {
    const fetchAssignee = async () => {
      if (request.assigned_to) {
        const { data } = await supabase
          .from('user_profiles')
          .select('full_name, email')
          .eq('id', request.assigned_to)
          .single();

        if (data) {
          setAssigneeName(data.full_name || data.email || 'Unknown User');
        }
      } else {
        setAssigneeName('');
      }
    };
    fetchAssignee();
  }, [request.assigned_to]);

  // Fetch user profiles for notes
  useEffect(() => {
    const fetchProfiles = async () => {
      const userIds = [...new Set(notes.map(n => n.user_id))];
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
  }, [notes]);

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
      await addNote(newNote, 'comment');
      setNewNote('');
    } catch (error) {
      console.error('Failed to add note:', error);
      alert('Failed to add note. Please try again.');
    } finally {
      setAddingNote(false);
    }
  };

  const handleChangeAssignee = async (newAssigneeId: string) => {
    try {
      const updates = newAssigneeId === 'unassigned'
        ? { assigned_to: null, assigned_at: null }
        : {
            assigned_to: newAssigneeId,
            assigned_at: new Date().toISOString(),
            stage: 'pending' as const
          };

      const { error } = await supabase
        .from('requests')
        .update(updates)
        .eq('id', request.id);

      if (error) {
        console.error('Supabase error:', error);
        throw error;
      }

      setIsChangingAssignee(false);
      window.location.reload();
    } catch (error: any) {
      console.error('Failed to change assignee:', error);
      alert(`Failed to change assignee: ${error.message || 'Please try again.'}`);
      setIsChangingAssignee(false);
    }
  };

  const handleChangeStage = async (newStage: string) => {
    try {
      const { error } = await supabase
        .from('requests')
        .update({ stage: newStage })
        .eq('id', request.id);

      if (error) throw error;

      setIsChangingStage(false);
      window.location.reload();
    } catch (error: any) {
      console.error('Failed to change stage:', error);
      alert(`Failed to change stage: ${error.message || 'Please try again.'}`);
      setIsChangingStage(false);
    }
  };

  const handleChangeQuoteStatus = async (newStatus: string) => {
    try {
      const { error } = await supabase
        .from('requests')
        .update({ quote_status: newStatus === 'none' ? null : newStatus })
        .eq('id', request.id);

      if (error) throw error;

      setIsChangingQuoteStatus(false);
      window.location.reload();
    } catch (error: any) {
      console.error('Failed to change quote status:', error);
      alert(`Failed to change quote status: ${error.message || 'Please try again.'}`);
      setIsChangingQuoteStatus(false);
    }
  };

  const handleSaveRequest = async () => {
    try {
      const { error } = await supabase
        .from('requests')
        .update(editedRequest)
        .eq('id', request.id);

      if (error) throw error;

      setIsEditingRequest(false);
      window.location.reload();
    } catch (error: any) {
      console.error('Failed to save request:', error);
      alert(`Failed to save request: ${error.message || 'Please try again.'}`);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10 lg:static">
        <div className="px-4 py-3 flex items-center gap-3">
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1 className="text-lg font-bold text-gray-900">{request.title}</h1>
            <p className="text-xs text-gray-600">{typeInfo.label} Request</p>
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
          {!isEditingRequest ? (
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
          ) : (
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
          )}
        </div>
      </div>

      {/* Desktop Layout: Two-column with sidebar */}
      <div className="lg:flex lg:gap-6 lg:p-6">
        {/* Main Content */}
        <div className="flex-1 p-4 lg:p-0 space-y-4">
        {/* Status Card */}
        <div className="bg-white rounded-xl shadow-sm p-4 space-y-3">
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

          {request.urgency && (
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
          )}

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

          {/* Assignee */}
          <div className="border-t border-gray-200 pt-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm">
                <Users className="w-4 h-4 text-gray-400" />
                <span className="text-gray-600">Assigned to:</span>
                {!isChangingAssignee && (
                  <span className="font-medium text-gray-900">
                    {assigneeName || 'Unassigned'}
                  </span>
                )}
              </div>
              {!isChangingAssignee && (
                <button
                  onClick={() => setIsChangingAssignee(true)}
                  className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                >
                  Change
                </button>
              )}
            </div>

            {isChangingAssignee && (
              <div className="mt-2 space-y-2">
                <select
                  defaultValue={request.assigned_to || 'unassigned'}
                  onChange={(e) => handleChangeAssignee(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="unassigned">Unassigned</option>
                  {users.map(user => (
                    <option key={user.id} value={user.id}>{user.name}</option>
                  ))}
                </select>
                <button
                  onClick={() => setIsChangingAssignee(false)}
                  className="text-xs text-gray-600 hover:text-gray-700"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Stage Management Workflow Buttons */}
        <div className="bg-white rounded-xl shadow-sm p-4">
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

        {/* Customer Info */}
        {(request.customer_name || isEditingRequest) && (
          <div className="bg-white rounded-xl shadow-sm p-4 space-y-2">
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
          <div className="bg-white rounded-xl shadow-sm p-4 space-y-2">
            <h3 className="font-semibold text-gray-900">Project Details</h3>
            <div className="space-y-1 text-sm">
              {request.fence_type && <p><span className="text-gray-600">Fence Type:</span> <span className="font-medium">{request.fence_type}</span></p>}
              {request.linear_feet && <p><span className="text-gray-600">Linear Feet:</span> <span className="font-medium">{request.linear_feet}</span></p>}
              {request.expected_value && <p><span className="text-gray-600">Expected Value:</span> <span className="font-medium">${request.expected_value.toLocaleString()}</span></p>}
            </div>
          </div>
        )}

        {/* Description */}
        {(request.description || isEditingRequest) && (
          <div className="bg-white rounded-xl shadow-sm p-4 space-y-2">
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
          <div className="bg-white rounded-xl shadow-sm p-4 space-y-2">
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
          <div className="bg-green-50 border border-green-200 rounded-xl p-4">
            <h3 className="font-semibold text-green-900 mb-1">Pricing Quote</h3>
            <p className="text-2xl font-bold text-green-700">${request.pricing_quote.toLocaleString()}</p>
            {request.quoted_at && (
              <p className="text-xs text-green-600 mt-1">
                Quoted on {new Date(request.quoted_at).toLocaleDateString()}
              </p>
            )}
          </div>
        )}

        {/* Voice Recording & Transcript */}
        {(request.voice_recording_url || request.transcript) && (
          <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 space-y-3">
            <h3 className="font-semibold text-purple-900 flex items-center gap-2">
              <Volume2 className="w-5 h-5" />
              Voice Recording
            </h3>

            {/* Audio Player */}
            {request.voice_recording_url && (
              <div className="bg-white rounded-lg p-3 shadow-sm">
                <audio
                  controls
                  className="w-full"
                  preload="metadata"
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

            {/* Transcript */}
            {request.transcript && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-purple-800">Transcript:</h4>
                <p className="text-sm text-gray-700 whitespace-pre-wrap bg-white rounded-lg p-3">
                  {request.transcript}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Notes/Chat Section */}
        <div className="bg-white rounded-xl shadow-sm p-4 space-y-3">
          <h3 className="font-semibold text-gray-900 flex items-center gap-2">
            <MessageSquare className="w-4 h-4" />
            Messages & Notes
          </h3>

          {/* Notes List */}
          <div className="max-h-96 overflow-y-auto space-y-2 mb-3">
            {notesLoading ? (
              <p className="text-sm text-gray-600">Loading messages...</p>
            ) : notes.length === 0 ? (
              <p className="text-sm text-gray-600 text-center py-4">No messages yet. Start the conversation!</p>
            ) : (
              notes.map((note) => (
                <div key={note.id} className="bg-blue-50 border border-blue-100 rounded-lg p-3">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <p className="text-xs font-medium text-blue-900">
                      {userProfiles.get(note.user_id) || 'Unknown User'}
                    </p>
                    <p className="text-xs text-blue-600">
                      {new Date(note.created_at).toLocaleDateString()} {new Date(note.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <p className="text-sm text-gray-800">{note.content}</p>
                </div>
              ))
            )}
          </div>

          {/* Add Note */}
          <div className="flex gap-2 border-t border-gray-200 pt-3">
            <input
              type="text"
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              placeholder="Type your message..."
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              onKeyPress={(e) => e.key === 'Enter' && handleAddNote()}
            />
            <button
              onClick={handleAddNote}
              disabled={addingNote || !newNote.trim()}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 text-sm"
            >
              {addingNote ? 'Sending...' : 'Send'}
            </button>
          </div>
        </div>

        {/* Activity Timeline */}
        <div className="bg-white rounded-xl shadow-sm p-4 space-y-3">
          <h3 className="font-semibold text-gray-900 flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            Activity Timeline
          </h3>

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
                        <p className="text-gray-900 font-medium capitalize mb-1">
                          {item.action.replace('_', ' ')}
                        </p>
                        {item.details && (
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
        </div>

        {/* Right Sidebar - Desktop Only */}
        <div className="hidden lg:block lg:w-96 space-y-4">
          {/* Photos Preview */}
          {request.photo_urls && request.photo_urls.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm p-4 space-y-3">
              <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                <Image className="w-4 h-4" />
                Photos ({request.photo_urls.length})
              </h3>
              <div className="grid grid-cols-2 gap-2">
                {request.photo_urls.map((url, index) => (
                  <a
                    key={index}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="aspect-square rounded-lg overflow-hidden border border-gray-200 hover:border-blue-400 transition-colors"
                  >
                    <img
                      src={url}
                      alt={`Photo ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Quick Actions */}
          <div className="bg-white rounded-xl shadow-sm p-4 space-y-3">
            <h3 className="font-semibold text-gray-900">Quick Actions</h3>
            <div className="space-y-2">
              <button
                onClick={() => window.print()}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors text-sm font-medium text-left"
              >
                Print Request
              </button>
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
              <div className="flex justify-between">
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
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
