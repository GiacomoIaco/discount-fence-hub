import { useState, useEffect } from 'react';
import { X, Search, Users, Building2, Loader2 } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { supabase } from '../../../lib/supabase';
import type { Contact } from '../types';

type ContactSource = 'team' | 'clients';

interface TeamMember {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  avatar_url: string | null;
}

interface ClientContactItem {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: string | null;
  client_name?: string;
  community_name?: string;
  source: 'client' | 'community' | 'property';
}

interface NewConversationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectContact: (contact: Contact) => void;
}

export function NewConversationModal({ isOpen, onClose, onSelectContact }: NewConversationModalProps) {
  const [activeTab, setActiveTab] = useState<ContactSource>('clients');
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [clientContacts, setClientContacts] = useState<ClientContactItem[]>([]);
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
      // Load team members
      const { data: teamData, error: teamError } = await supabase
        .from('user_profiles')
        .select('id, email, full_name, role, avatar_url')
        .order('full_name');

      if (teamError) {
        console.error('Error loading team members:', teamError);
      } else {
        console.log('Loaded team members:', teamData?.length || 0);
      }
      setTeamMembers(teamData || []);

      // Load client contacts from multiple tables
      const [clientContactsRes, communityContactsRes, propertyContactsRes] = await Promise.all([
        supabase
          .from('client_contacts')
          .select('id, name, email, phone, role, client:clients(name)')
          .order('name'),
        supabase
          .from('community_contacts')
          .select('id, name, email, phone, role, community:communities(name)')
          .order('name'),
        supabase
          .from('property_contacts')
          .select('id, name, email, phone, role, property:properties(address_line1)')
          .order('name'),
      ]);

      // Log results and any errors for debugging
      console.log('=== NewConversationModal Contact Load ===');
      console.log('client_contacts:', {
        error: clientContactsRes.error,
        count: clientContactsRes.data?.length || 0,
        data: clientContactsRes.data,
      });
      console.log('community_contacts:', {
        error: communityContactsRes.error,
        count: communityContactsRes.data?.length || 0,
        data: communityContactsRes.data,
      });
      console.log('property_contacts:', {
        error: propertyContactsRes.error,
        count: propertyContactsRes.data?.length || 0,
        data: propertyContactsRes.data,
      });

      const allClientContacts: ClientContactItem[] = [
        ...(clientContactsRes.data || []).map((c: any) => ({
          id: c.id,
          name: c.name,
          email: c.email,
          phone: c.phone,
          role: c.role,
          client_name: c.client?.name,
          source: 'client' as const,
        })),
        ...(communityContactsRes.data || []).map((c: any) => ({
          id: c.id,
          name: c.name,
          email: c.email,
          phone: c.phone,
          role: c.role,
          community_name: c.community?.name,
          source: 'community' as const,
        })),
        ...(propertyContactsRes.data || []).map((c: any) => ({
          id: c.id,
          name: c.name,
          email: c.email,
          phone: c.phone,
          role: c.role,
          client_name: c.property?.address_line1,
          source: 'property' as const,
        })),
      ];

      setClientContacts(allClientContacts);
    } catch (error) {
      console.error('Error loading contacts:', error);
    } finally {
      setIsLoading(false);
    }
  }

  const filteredTeam = teamMembers.filter(member => {
    if (!search) return true;
    const searchLower = search.toLowerCase();
    return (
      member.full_name?.toLowerCase().includes(searchLower) ||
      member.email?.toLowerCase().includes(searchLower) ||
      member.role?.toLowerCase().includes(searchLower)
    );
  });

  const filteredClients = clientContacts.filter(contact => {
    if (!search) return true;
    const searchLower = search.toLowerCase();
    return (
      contact.name?.toLowerCase().includes(searchLower) ||
      contact.phone?.includes(search) ||
      contact.email?.toLowerCase().includes(searchLower) ||
      contact.client_name?.toLowerCase().includes(searchLower) ||
      contact.community_name?.toLowerCase().includes(searchLower)
    );
  });

  const handleSelectTeamMember = async (member: TeamMember) => {
    // Create or get mc_contact for this team member
    const contact = await getOrCreateMcContact({
      contact_type: 'employee',
      display_name: member.full_name || member.email,
      email_primary: member.email,
      employee_id: member.id,
      avatar_url: member.avatar_url || undefined,
    });
    if (contact) {
      onSelectContact(contact);
      onClose();
    }
  };

  const handleSelectClientContact = async (clientContact: ClientContactItem) => {
    // Create or get mc_contact for this client contact
    const contact = await getOrCreateMcContact({
      contact_type: 'client',
      display_name: clientContact.name,
      email_primary: clientContact.email || undefined,
      phone_primary: clientContact.phone || undefined,
    });
    if (contact) {
      onSelectContact(contact);
      onClose();
    }
  };

  async function getOrCreateMcContact(data: Partial<Contact>): Promise<Contact | null> {
    try {
      // First try to find existing contact
      let query = supabase.from('mc_contacts').select('*');

      if (data.employee_id) {
        query = query.eq('employee_id', data.employee_id);
      } else if (data.phone_primary) {
        query = query.eq('phone_primary', data.phone_primary);
      } else if (data.email_primary) {
        query = query.eq('email_primary', data.email_primary);
      }

      const { data: existing } = await query.limit(1).single();

      if (existing) {
        return existing as Contact;
      }

      // Create new contact
      const { data: newContact, error } = await supabase
        .from('mc_contacts')
        .insert({
          contact_type: data.contact_type || 'client',
          display_name: data.display_name || 'Unknown',
          email_primary: data.email_primary,
          phone_primary: data.phone_primary,
          employee_id: data.employee_id,
          avatar_url: data.avatar_url,
          sms_opted_out: false,
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating contact:', error);
        return null;
      }

      return newContact as Contact;
    } catch (error) {
      console.error('Error in getOrCreateMcContact:', error);
      return null;
    }
  }

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

        {/* Tabs */}
        <div className="flex border-b">
          <button
            onClick={() => setActiveTab('clients')}
            className={cn(
              'flex-1 px-4 py-3 text-sm font-medium flex items-center justify-center gap-2 border-b-2 transition-colors',
              activeTab === 'clients'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            )}
          >
            <Building2 className="w-4 h-4" />
            Clients
          </button>
          <button
            onClick={() => setActiveTab('team')}
            className={cn(
              'flex-1 px-4 py-3 text-sm font-medium flex items-center justify-center gap-2 border-b-2 transition-colors',
              activeTab === 'team'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            )}
          >
            <Users className="w-4 h-4" />
            Team
          </button>
        </div>

        {/* Search */}
        <div className="px-4 py-3 border-b">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder={activeTab === 'team' ? 'Search team members...' : 'Search clients...'}
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
          ) : activeTab === 'team' ? (
            // Team Members
            filteredTeam.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Users className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                <p>{search ? 'No team members found' : 'No team members yet'}</p>
              </div>
            ) : (
              <div className="divide-y">
                {filteredTeam.map((member) => (
                  <button
                    key={member.id}
                    onClick={() => handleSelectTeamMember(member)}
                    className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 text-left transition-colors"
                  >
                    {member.avatar_url ? (
                      <img
                        src={member.avatar_url}
                        className="w-10 h-10 rounded-full object-cover"
                        alt=""
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                        <span className="text-green-600 font-medium">
                          {(member.full_name || member.email)?.charAt(0).toUpperCase()}
                        </span>
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 truncate">
                        {member.full_name || member.email}
                      </p>
                      <p className="text-sm text-gray-500 truncate">
                        {member.role}
                      </p>
                    </div>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                      Team
                    </span>
                  </button>
                ))}
              </div>
            )
          ) : (
            // Client Contacts
            filteredClients.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Building2 className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                <p>{search ? 'No contacts found' : 'No client contacts yet'}</p>
                <p className="text-sm text-gray-400 mt-1">
                  Add contacts in the Client Hub
                </p>
              </div>
            ) : (
              <div className="divide-y">
                {filteredClients.map((contact) => (
                  <button
                    key={`${contact.source}-${contact.id}`}
                    onClick={() => handleSelectClientContact(contact)}
                    className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 text-left transition-colors"
                  >
                    <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                      <span className="text-blue-600 font-medium">
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
                      {(contact.client_name || contact.community_name) && (
                        <p className="text-xs text-gray-400 truncate">
                          {contact.client_name || contact.community_name}
                        </p>
                      )}
                    </div>
                    <span className={cn(
                      'text-xs px-2 py-0.5 rounded-full',
                      contact.source === 'client' && 'bg-blue-100 text-blue-700',
                      contact.source === 'community' && 'bg-purple-100 text-purple-700',
                      contact.source === 'property' && 'bg-orange-100 text-orange-700'
                    )}>
                      {contact.source === 'property' ? 'Homeowner' : contact.source}
                    </span>
                  </button>
                ))}
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}

export default NewConversationModal;
