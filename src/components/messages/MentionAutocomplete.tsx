import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { AtSign } from 'lucide-react';

interface UserProfile {
  id: string;
  full_name: string;
  email: string;
  role: string;
}

interface MentionAutocompleteProps {
  search: string;
  onSelect: (username: string) => void;
  onClose: () => void;
}

export function MentionAutocomplete({ search, onSelect, onClose }: MentionAutocompleteProps) {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    searchUsers();
  }, [search]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % users.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + users.length) % users.length);
      } else if (e.key === 'Enter' && users.length > 0) {
        e.preventDefault();
        handleSelect(users[selectedIndex]);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [users, selectedIndex]);

  const searchUsers = async () => {
    try {
      setLoading(true);

      let query = supabase
        .from('user_profiles')
        .select('id, full_name, email, role')
        .limit(5);

      if (search) {
        query = query.or(`full_name.ilike.%${search}%,email.ilike.%${search}%`);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Failed to search users:', error);
        return;
      }

      setUsers(data || []);
      setSelectedIndex(0);
    } catch (error) {
      console.error('Failed to search users:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (user: UserProfile) => {
    // Use email prefix as username (before @)
    const username = user.email.split('@')[0];
    onSelect(username);
  };

  const getUsernameFromEmail = (email: string) => {
    return email.split('@')[0];
  };

  if (loading) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 mx-4">
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  if (users.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 mx-4">
        <p className="text-sm text-gray-500 text-center">No users found</p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg py-1 mx-4 max-h-60 overflow-y-auto">
      {users.map((user, index) => (
        <button
          key={user.id}
          onClick={() => handleSelect(user)}
          className={`w-full px-3 py-2 text-left hover:bg-blue-50 transition-colors flex items-center gap-3 ${
            index === selectedIndex ? 'bg-blue-50' : ''
          }`}
        >
          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
            <AtSign className="w-4 h-4 text-blue-700" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">
              {user.full_name || user.email}
            </p>
            <p className="text-xs text-gray-500 truncate">
              @{getUsernameFromEmail(user.email)}
            </p>
          </div>
          <span className="text-xs text-gray-400 px-2 py-0.5 bg-gray-100 rounded">
            {user.role}
          </span>
        </button>
      ))}
    </div>
  );
}
