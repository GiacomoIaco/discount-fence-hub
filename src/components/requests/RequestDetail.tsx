import { ArrowLeft, DollarSign, Package, Wrench, Building2, AlertTriangle, Clock, User, Calendar, TrendingUp, MessageSquare } from 'lucide-react';
import type { Request } from '../../lib/requests';
import { useRequestAge } from '../../hooks/useRequests';
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
  const [newNote, setNewNote] = useState('');
  const [addingNote, setAddingNote] = useState(false);
  const [submitterName, setSubmitterName] = useState<string>('');
  const [userProfiles, setUserProfiles] = useState<Map<string, string>>(new Map());

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

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
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
        </div>
      </div>

      <div className="p-4 space-y-4">
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

          {request.quote_status && (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-gray-600">Quote Status:</span>
              <span className={`font-medium capitalize ${
                request.quote_status === 'won' ? 'text-green-600' :
                request.quote_status === 'lost' ? 'text-red-600' :
                'text-blue-600'
              }`}>
                {request.quote_status}
              </span>
            </div>
          )}
        </div>

        {/* Customer Info */}
        {request.customer_name && (
          <div className="bg-white rounded-xl shadow-sm p-4 space-y-2">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <User className="w-4 h-4" />
              Customer Information
            </h3>
            <div className="space-y-1 text-sm">
              <p><span className="text-gray-600">Name:</span> <span className="font-medium">{request.customer_name}</span></p>
              {request.customer_address && <p><span className="text-gray-600">Address:</span> <span className="font-medium">{request.customer_address}</span></p>}
              {request.customer_phone && <p><span className="text-gray-600">Phone:</span> <span className="font-medium">{request.customer_phone}</span></p>}
              {request.customer_email && <p><span className="text-gray-600">Email:</span> <span className="font-medium">{request.customer_email}</span></p>}
            </div>
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
        {request.description && (
          <div className="bg-white rounded-xl shadow-sm p-4 space-y-2">
            <h3 className="font-semibold text-gray-900">Description</h3>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{request.description}</p>
          </div>
        )}

        {/* Special Requirements */}
        {request.special_requirements && (
          <div className="bg-white rounded-xl shadow-sm p-4 space-y-2">
            <h3 className="font-semibold text-gray-900">Special Requirements</h3>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{request.special_requirements}</p>
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

        {/* Transcript */}
        {request.transcript && (
          <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 space-y-2">
            <h3 className="font-semibold text-purple-900 flex items-center gap-2">
              🎤 Voice Transcript
            </h3>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{request.transcript}</p>
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

        {/* Activity Log */}
        <div className="bg-white rounded-xl shadow-sm p-4 space-y-3">
          <h3 className="font-semibold text-gray-900 flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            Activity Log
          </h3>

          {activityLoading ? (
            <p className="text-sm text-gray-600">Loading activity...</p>
          ) : activity.length === 0 ? (
            <p className="text-sm text-gray-600">No activity yet</p>
          ) : (
            <div className="space-y-2">
              {activity.map((item) => (
                <div key={item.id} className="flex gap-3 text-sm">
                  <div className="w-2 h-2 bg-blue-600 rounded-full mt-1.5 flex-shrink-0"></div>
                  <div className="flex-1">
                    <p className="text-gray-900 font-medium capitalize">{item.action.replace('_', ' ')}</p>
                    <p className="text-xs text-gray-500">
                      {new Date(item.created_at).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
