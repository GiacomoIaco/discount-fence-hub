import { useState, useEffect } from 'react';
import { Mail, Phone, MapPin, Calendar, X, Edit2, Mic, CheckCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface UserProfileViewProps {
  userId?: string; // If provided, shows another user's profile. If not, shows current user's profile
  onClose: () => void;
  onEdit?: () => void; // Only shown if viewing own profile
}

interface UserProfile {
  id: string;
  full_name: string;
  email: string;
  role: string;
  phone?: string;
  avatar_url?: string;
  bio?: string;
  voice_sample_url?: string;
  territory?: string;
  start_date?: string;
}

interface ActivityStats {
  total_recordings: number;
  total_messages_sent: number;
  total_messages_received: number;
  total_surveys_completed: number;
  total_photos_uploaded: number;
  last_activity_at?: string;
}

export default function UserProfileView({ userId, onClose, onEdit }: UserProfileViewProps) {
  const { user: currentUser } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [stats, setStats] = useState<ActivityStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isOwnProfile = !userId || userId === currentUser?.id;

  useEffect(() => {
    loadProfile();
    loadStats();
  }, [userId, currentUser]);

  const loadProfile = async () => {
    try {
      setLoading(true);
      const targetUserId = userId || currentUser?.id;
      if (!targetUserId) return;

      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', targetUserId)
        .single();

      if (error) throw error;
      setProfile(data);
    } catch (err: any) {
      console.error('Error loading profile:', err);
      setError('Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const targetUserId = userId || currentUser?.id;
      if (!targetUserId) return;

      const { data } = await supabase
        .from('user_activity_stats')
        .select('*')
        .eq('user_id', targetUserId)
        .single();

      if (data) {
        setStats(data);
      }
    } catch (err) {
      // Stats might not exist yet, that's okay
      console.log('No stats found for user');
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Not set';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  };

  const formatLastActivity = (dateString?: string) => {
    if (!dateString) return 'No recent activity';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) return `${diffMins} minutes ago`;
    if (diffHours < 24) return `${diffHours} hours ago`;
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString();
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'admin':
        return 'bg-red-100 text-red-800';
      case 'sales-manager':
        return 'bg-purple-100 text-purple-800';
      case 'operations':
        return 'bg-blue-100 text-blue-800';
      case 'sales':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'sales-manager':
        return 'Sales Manager';
      case 'operations':
        return 'Operations';
      case 'sales':
        return 'Sales Rep';
      case 'admin':
        return 'Administrator';
      default:
        return role;
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-xl shadow-2xl p-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-xl shadow-2xl p-8">
          <p className="text-red-600">{error || 'Profile not found'}</p>
          <button onClick={onClose} className="mt-4 px-4 py-2 bg-gray-200 rounded-lg">
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-purple-600 text-white p-6 rounded-t-xl">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold">Profile</h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white hover:bg-opacity-20 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Profile Content */}
        <div className="p-6 space-y-6">
          {/* Avatar and Basic Info */}
          <div className="flex flex-col items-center space-y-4">
            {profile.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt={profile.full_name}
                className="w-32 h-32 rounded-full object-cover border-4 border-gray-200 shadow-lg"
              />
            ) : (
              <div className="w-32 h-32 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-4xl font-bold shadow-lg">
                {profile.full_name.split(' ').map(n => n[0]).join('').toUpperCase()}
              </div>
            )}

            <div className="text-center">
              <h3 className="text-2xl font-bold text-gray-900">{profile.full_name}</h3>
              <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium mt-2 ${getRoleBadgeColor(profile.role)}`}>
                {getRoleLabel(profile.role)}
              </span>
            </div>

            {/* Edit Button (Own Profile Only) */}
            {isOwnProfile && onEdit && (
              <button
                onClick={onEdit}
                className="flex items-center space-x-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Edit2 className="w-4 h-4" />
                <span>Edit Profile</span>
              </button>
            )}
          </div>

          {/* Bio */}
          {profile.bio && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <h4 className="font-semibold text-gray-900 mb-2">About</h4>
              <p className="text-gray-700 whitespace-pre-wrap">{profile.bio}</p>
            </div>
          )}

          {/* Contact Info */}
          <div className="space-y-3">
            <h4 className="font-semibold text-gray-900 text-lg">Contact Information</h4>

            <div className="flex items-center space-x-3 text-gray-700">
              <Mail className="w-5 h-5 text-gray-400" />
              <span>{profile.email}</span>
            </div>

            {profile.phone && (
              <div className="flex items-center space-x-3 text-gray-700">
                <Phone className="w-5 h-5 text-gray-400" />
                <span>{profile.phone}</span>
              </div>
            )}
          </div>

          {/* Work Info */}
          {(profile.territory || profile.start_date) && (
            <div className="space-y-3">
              <h4 className="font-semibold text-gray-900 text-lg">Work Information</h4>

              {profile.territory && (
                <div className="flex items-center space-x-3 text-gray-700">
                  <MapPin className="w-5 h-5 text-gray-400" />
                  <div>
                    <p className="text-sm text-gray-500">Territory</p>
                    <p className="font-medium">{profile.territory}</p>
                  </div>
                </div>
              )}

              {profile.start_date && (
                <div className="flex items-center space-x-3 text-gray-700">
                  <Calendar className="w-5 h-5 text-gray-400" />
                  <div>
                    <p className="text-sm text-gray-500">Start Date</p>
                    <p className="font-medium">{formatDate(profile.start_date)}</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Voice Sample Status */}
          {profile.voice_sample_url && (
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
              <div className="flex items-center space-x-3">
                <Mic className="w-5 h-5 text-purple-600" />
                <div>
                  <h4 className="font-semibold text-purple-900">Voice Sample Recorded</h4>
                  <p className="text-sm text-purple-700">
                    AI coaching enabled with personalized voice analysis
                  </p>
                </div>
                <CheckCircle className="w-5 h-5 text-purple-600 ml-auto" />
              </div>
            </div>
          )}

          {/* Activity Stats */}
          {stats && (
            <div className="space-y-3">
              <h4 className="font-semibold text-gray-900 text-lg">Activity</h4>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-2xl font-bold text-blue-900">{stats.total_recordings}</p>
                  <p className="text-sm text-blue-700">Recordings</p>
                </div>

                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <p className="text-2xl font-bold text-green-900">{stats.total_surveys_completed}</p>
                  <p className="text-sm text-green-700">Surveys Completed</p>
                </div>

                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                  <p className="text-2xl font-bold text-purple-900">{stats.total_messages_sent}</p>
                  <p className="text-sm text-purple-700">Messages Sent</p>
                </div>

                <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                  <p className="text-2xl font-bold text-orange-900">{stats.total_photos_uploaded}</p>
                  <p className="text-sm text-orange-700">Photos Uploaded</p>
                </div>
              </div>

              {stats.last_activity_at && (
                <p className="text-sm text-gray-500 text-center mt-2">
                  Last active: {formatLastActivity(stats.last_activity_at)}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-gray-50 border-t border-gray-200 p-4 rounded-b-xl">
          <button
            onClick={onClose}
            className="w-full px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
