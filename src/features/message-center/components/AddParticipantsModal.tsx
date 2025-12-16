import { useState, useEffect } from 'react';
import { X, Search, Users, Building2, Loader2, UserPlus, Check } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { supabase } from '../../../lib/supabase';
import * as messageService from '../services/messageService';
import type { Contact, ConversationParticipant } from '../types';

interface ContactOption {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company_name?: string;
  source: 'team' | 'client';
  contact?: Contact;
}

interface AddParticipantsModalProps {
  isOpen: boolean;
  onClose: () => void;
  conversationId: string;
  existingParticipants: ConversationParticipant[];
  onParticipantAdded: () => void;
}

export function AddParticipantsModal({
  isOpen,
  onClose,
  conversationId,
  existingParticipants,
  onParticipantAdded
}: AddParticipantsModalProps) {
  const [contacts, setContacts] = useState<ContactOption[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isAdding, setIsAdding] = useState(false);

  // Get IDs of existing participants to filter them out
  const existingContactIds = existingParticipants.map(p => p.contact_id);

  useEffect(() => {
    if (isOpen) {
      loadContacts();
      setSelectedIds([]);
      setSearch('');
    }
  }, [isOpen]);

  async function loadContacts() {
    setIsLoading(true);
    try {
      // Load all mc_contacts
      const { data, error } = await supabase
        .from('mc_contacts')
        .select('*')
        .order('display_name');

      if (error) throw error;

      const options: ContactOption[] = (data || []).map(c => ({
        id: c.id,
        name: c.display_name,
        email: c.email_primary,
        phone: c.phone_primary,
        company_name: c.company_name,
        source: c.contact_type === 'employee' ? 'team' : 'client',
        contact: c as Contact
      }));

      setContacts(options);
    } catch (error) {
      console.error('Error loading contacts:', error);
    } finally {
      setIsLoading(false);
    }
  }

  // Filter out existing participants and apply search
  const availableContacts = contacts.filter(c => {
    if (existingContactIds.includes(c.id)) return false;
    if (!search) return true;
    const searchLower = search.toLowerCase();
    return (
      c.name?.toLowerCase().includes(searchLower) ||
      c.phone?.includes(search) ||
      c.email?.toLowerCase().includes(searchLower) ||
      c.company_name?.toLowerCase().includes(searchLower)
    );
  });

  const toggleSelection = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id)
        ? prev.filter(x => x !== id)
        : [...prev, id]
    );
  };

  const handleAddParticipants = async () => {
    if (selectedIds.length === 0) return;

    setIsAdding(true);
    try {
      for (const contactId of selectedIds) {
        await messageService.addParticipantToConversation(conversationId, contactId);
      }
      onParticipantAdded();
      onClose();
    } catch (error) {
      console.error('Error adding participants:', error);
    } finally {
      setIsAdding(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div className="flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-blue-600" />
            <h2 className="font-semibold text-lg">Add People</h2>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg">
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

        {/* Selected Count */}
        {selectedIds.length > 0 && (
          <div className="px-4 py-2 bg-blue-50 text-blue-700 text-sm font-medium">
            {selectedIds.length} contact{selectedIds.length > 1 ? 's' : ''} selected
          </div>
        )}

        {/* Contacts List */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
            </div>
          ) : availableContacts.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Users className="w-10 h-10 mx-auto mb-2 text-gray-300" />
              <p>{search ? 'No contacts found' : 'No available contacts'}</p>
            </div>
          ) : (
            <div className="divide-y">
              {availableContacts.map((contact) => {
                const isSelected = selectedIds.includes(contact.id);
                return (
                  <button
                    key={contact.id}
                    onClick={() => toggleSelection(contact.id)}
                    className={cn(
                      'w-full px-4 py-3 flex items-center gap-3 text-left transition-colors',
                      isSelected ? 'bg-blue-50' : 'hover:bg-gray-50'
                    )}
                  >
                    <div className={cn(
                      'w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0',
                      contact.source === 'team' ? 'bg-green-100' : 'bg-blue-100'
                    )}>
                      <span className={cn(
                        'font-medium',
                        contact.source === 'team' ? 'text-green-600' : 'text-blue-600'
                      )}>
                        {contact.name?.charAt(0).toUpperCase() || '?'}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 truncate">
                        {contact.name}
                      </p>
                      <p className="text-sm text-gray-500 truncate">
                        {contact.phone || contact.email || 'No contact info'}
                      </p>
                      {contact.company_name && (
                        <p className="text-xs text-gray-400 truncate flex items-center gap-1">
                          <Building2 className="w-3 h-3" />
                          {contact.company_name}
                        </p>
                      )}
                    </div>
                    <div className={cn(
                      'w-6 h-6 rounded-full border-2 flex items-center justify-center',
                      isSelected
                        ? 'bg-blue-600 border-blue-600'
                        : 'border-gray-300'
                    )}>
                      {isSelected && <Check className="w-4 h-4 text-white" />}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleAddParticipants}
            disabled={selectedIds.length === 0 || isAdding}
            className={cn(
              'px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2',
              selectedIds.length > 0
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
            )}
          >
            {isAdding && <Loader2 className="w-4 h-4 animate-spin" />}
            Add {selectedIds.length > 0 ? `(${selectedIds.length})` : ''}
          </button>
        </div>
      </div>
    </div>
  );
}

export default AddParticipantsModal;
