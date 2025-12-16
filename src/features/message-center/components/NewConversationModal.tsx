import { useState, useEffect } from 'react';
import { X, Search, User, Loader2 } from 'lucide-react';
import { cn } from '../../../lib/utils';
import * as messageService from '../services/messageService';
import type { Contact } from '../types';

interface NewConversationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectContact: (contact: Contact) => void;
}

export function NewConversationModal({ isOpen, onClose, onSelectContact }: NewConversationModalProps) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (isOpen) {
      loadContacts();
    }
  }, [isOpen]);

  async function loadContacts() {
    setIsLoading(true);
    try {
      const data = await messageService.getContacts();
      setContacts(data);
    } catch (error) {
      console.error('Error loading contacts:', error);
    } finally {
      setIsLoading(false);
    }
  }

  const filteredContacts = contacts.filter(contact => {
    if (!search) return true;
    const searchLower = search.toLowerCase();
    return (
      contact.display_name?.toLowerCase().includes(searchLower) ||
      contact.phone_primary?.includes(search) ||
      contact.email_primary?.toLowerCase().includes(searchLower) ||
      contact.company_name?.toLowerCase().includes(searchLower)
    );
  });

  const handleSelect = async (contact: Contact) => {
    onSelectContact(contact);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h2 className="font-semibold text-lg">New Conversation</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search */}
        <div className="px-4 py-3 border-b">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search contacts..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
          </div>
        </div>

        {/* Contacts List */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
            </div>
          ) : filteredContacts.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <User className="w-10 h-10 mx-auto mb-2 text-gray-300" />
              <p>{search ? 'No contacts found' : 'No contacts yet'}</p>
              <p className="text-sm text-gray-400 mt-1">
                {search ? 'Try a different search' : 'Contacts are created when you receive messages'}
              </p>
            </div>
          ) : (
            <div className="divide-y">
              {filteredContacts.map((contact) => (
                <button
                  key={contact.id}
                  onClick={() => handleSelect(contact)}
                  className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 text-left transition-colors"
                >
                  {/* Avatar */}
                  {contact.avatar_url ? (
                    <img
                      src={contact.avatar_url}
                      className="w-10 h-10 rounded-full object-cover"
                      alt=""
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                      <span className="text-blue-600 font-medium">
                        {contact.display_name?.charAt(0).toUpperCase() || '?'}
                      </span>
                    </div>
                  )}

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate">
                      {contact.display_name}
                    </p>
                    <p className="text-sm text-gray-500 truncate">
                      {contact.phone_primary || contact.email_primary || 'No contact info'}
                    </p>
                  </div>

                  {/* Contact type badge */}
                  <span className={cn(
                    'text-xs px-2 py-0.5 rounded-full',
                    contact.contact_type === 'client' && 'bg-blue-100 text-blue-700',
                    contact.contact_type === 'employee' && 'bg-green-100 text-green-700',
                    contact.contact_type === 'vendor' && 'bg-orange-100 text-orange-700'
                  )}>
                    {contact.contact_type}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default NewConversationModal;
