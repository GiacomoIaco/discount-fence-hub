import { useState, useEffect } from 'react';
import { X, Phone, Mail, MapPin, User, ExternalLink, Clock, Briefcase, UserPlus } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { formatDistanceToNow, format } from 'date-fns';
import type { Contact, Message } from '../types';

interface ContactInfoPanelProps {
  contact: Contact | null;
  conversationId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onInviteSalesRep?: (salesRepId: string, salesRepName: string) => void;
}

interface LinkedClient {
  id: string;
  name: string;
  business_unit: string;
  client_type: string;
  city: string | null;
  state: string;
}

interface LinkedCommunity {
  id: string;
  name: string;
  client_name: string;
}

interface LinkedProject {
  id: string;
  name: string;
  status: string;
  created_at: string;
  assigned_rep: {
    id: string;
    name: string;
    email?: string;
    phone?: string;
    user_id?: string;
  } | null;
}

export function ContactInfoPanel({ contact, conversationId, isOpen, onClose, onInviteSalesRep }: ContactInfoPanelProps) {
  const [linkedClient, setLinkedClient] = useState<LinkedClient | null>(null);
  const [linkedCommunity, setLinkedCommunity] = useState<LinkedCommunity | null>(null);
  const [linkedProjects, setLinkedProjects] = useState<LinkedProject[]>([]);
  const [recentMessages, setRecentMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen && contact) {
      loadContactDetails();
    }
  }, [isOpen, contact?.id]);

  async function loadContactDetails() {
    if (!contact) return;
    setIsLoading(true);

    try {
      // Load linked client if exists
      if (contact.client_id) {
        const { data: client } = await supabase
          .from('clients')
          .select('id, name, business_unit, client_type, city, state')
          .eq('id', contact.client_id)
          .single();
        setLinkedClient(client);

        // Load projects for this client
        if (client) {
          const { data: projects } = await supabase
            .from('projects')
            .select(`id, name, status, created_at, assigned_rep_user_id`)
            .eq('client_id', client.id)
            .order('created_at', { ascending: false })
            .limit(5);

          // Fetch user profiles for assigned reps
          const userIds = new Set<string>();
          (projects || []).forEach((p: any) => {
            if (p.assigned_rep_user_id) userIds.add(p.assigned_rep_user_id);
          });

          let userMap = new Map<string, { id: string; full_name: string | null; email: string | null; phone: string | null }>();
          if (userIds.size > 0) {
            const { data: userProfiles } = await supabase
              .from('user_profiles')
              .select('id, full_name, email, phone')
              .in('id', Array.from(userIds));
            (userProfiles || []).forEach((u: any) => userMap.set(u.id, u));
          }

          // Map to LinkedProject structure
          const mappedProjects: LinkedProject[] = (projects || []).map((p: any) => {
            const user = p.assigned_rep_user_id ? userMap.get(p.assigned_rep_user_id) : null;
            return {
              id: p.id,
              name: p.name,
              status: p.status,
              created_at: p.created_at,
              assigned_rep: user ? {
                id: user.id,
                name: user.full_name || user.email || 'Unknown',
                email: user.email || undefined,
                phone: user.phone || undefined,
                user_id: user.id,
              } : null
            };
          });
          setLinkedProjects(mappedProjects);
        }
      } else {
        setLinkedClient(null);
        setLinkedProjects([]);
      }

      // Try to find linked community via context_label or company
      if (contact.context_label) {
        const { data: community } = await supabase
          .from('communities')
          .select('id, name, clients(name)')
          .ilike('name', `%${contact.context_label}%`)
          .limit(1)
          .single();
        if (community) {
          setLinkedCommunity({
            id: community.id,
            name: community.name,
            client_name: (community.clients as any)?.name || ''
          });
        } else {
          setLinkedCommunity(null);
        }
      } else {
        setLinkedCommunity(null);
      }

      // Load recent messages for this conversation
      if (conversationId) {
        const { data: messages } = await supabase
          .from('mc_messages')
          .select('*')
          .eq('conversation_id', conversationId)
          .order('created_at', { ascending: false })
          .limit(5);
        setRecentMessages(messages || []);
      }
    } catch (error) {
      console.error('Error loading contact details:', error);
    } finally {
      setIsLoading(false);
    }
  }

  if (!isOpen || !contact) return null;

  return (
    <div className="w-80 border-l bg-white flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b flex items-center justify-between">
        <h3 className="font-semibold text-gray-900">Contact Info</h3>
        <button
          onClick={onClose}
          className="p-1 hover:bg-gray-100 rounded-lg text-gray-500"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
          </div>
        ) : (
          <div className="p-4 space-y-6">
            {/* Profile Section */}
            <div className="text-center">
              {contact.avatar_url ? (
                <img
                  src={contact.avatar_url}
                  alt=""
                  className="w-20 h-20 rounded-full mx-auto object-cover"
                />
              ) : (
                <div className="w-20 h-20 rounded-full bg-blue-100 flex items-center justify-center mx-auto">
                  <User className="w-10 h-10 text-blue-600" />
                </div>
              )}
              <h2 className="mt-3 font-semibold text-lg text-gray-900">
                {contact.display_name}
              </h2>
              {contact.company_name && (
                <p className="text-sm text-gray-500">{contact.company_name}</p>
              )}
              {contact.context_label && (
                <p className="text-xs text-gray-400">{contact.context_label}</p>
              )}
              <span className={`mt-2 inline-block text-xs px-2 py-0.5 rounded-full ${
                contact.contact_type === 'employee'
                  ? 'bg-green-100 text-green-700'
                  : contact.contact_type === 'vendor'
                  ? 'bg-orange-100 text-orange-700'
                  : 'bg-blue-100 text-blue-700'
              }`}>
                {contact.contact_type === 'employee' ? 'Team Member' :
                 contact.contact_type === 'vendor' ? 'Vendor' : 'Client'}
              </span>
            </div>

            {/* Contact Actions */}
            <div className="flex justify-center gap-3">
              {contact.phone_primary && (
                <a
                  href={`tel:${contact.phone_primary}`}
                  className="flex flex-col items-center p-3 hover:bg-gray-50 rounded-lg transition-colors"
                >
                  <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                    <Phone className="w-5 h-5 text-green-600" />
                  </div>
                  <span className="text-xs text-gray-500 mt-1">Call</span>
                </a>
              )}
              {contact.email_primary && (
                <a
                  href={`mailto:${contact.email_primary}`}
                  className="flex flex-col items-center p-3 hover:bg-gray-50 rounded-lg transition-colors"
                >
                  <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                    <Mail className="w-5 h-5 text-blue-600" />
                  </div>
                  <span className="text-xs text-gray-500 mt-1">Email</span>
                </a>
              )}
            </div>

            {/* Contact Details */}
            <div className="space-y-3">
              <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                Contact Details
              </h4>

              {contact.phone_primary && (
                <div className="flex items-center gap-3 text-sm">
                  <Phone className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-700">{contact.phone_primary}</span>
                </div>
              )}

              {contact.phone_secondary && (
                <div className="flex items-center gap-3 text-sm">
                  <Phone className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-700">{contact.phone_secondary}</span>
                  <span className="text-xs text-gray-400">(secondary)</span>
                </div>
              )}

              {contact.email_primary && (
                <div className="flex items-center gap-3 text-sm">
                  <Mail className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-700 truncate">{contact.email_primary}</span>
                </div>
              )}

              {contact.sms_opted_out && (
                <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">
                  <span>SMS Opted Out</span>
                </div>
              )}
            </div>

            {/* Linked Client */}
            {linkedClient && (
              <div className="space-y-3">
                <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  Linked Client
                </h4>
                <a
                  href={`/clients/${linkedClient.id}`}
                  className="block p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium text-gray-900">{linkedClient.name}</p>
                      <p className="text-xs text-gray-500 capitalize">
                        {linkedClient.business_unit} · {linkedClient.client_type?.replace('_', ' ')}
                      </p>
                      {linkedClient.city && (
                        <p className="text-xs text-gray-400 flex items-center gap-1 mt-1">
                          <MapPin className="w-3 h-3" />
                          {linkedClient.city}, {linkedClient.state}
                        </p>
                      )}
                    </div>
                    <ExternalLink className="w-4 h-4 text-gray-400" />
                  </div>
                </a>
              </div>
            )}

            {/* Linked Community */}
            {linkedCommunity && (
              <div className="space-y-3">
                <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  Linked Community
                </h4>
                <a
                  href={`/communities/${linkedCommunity.id}`}
                  className="block p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium text-gray-900">{linkedCommunity.name}</p>
                      <p className="text-xs text-gray-500">{linkedCommunity.client_name}</p>
                    </div>
                    <ExternalLink className="w-4 h-4 text-gray-400" />
                  </div>
                </a>
              </div>
            )}

            {/* Active Projects */}
            {linkedProjects.length > 0 && (
              <div className="space-y-3">
                <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  Active Projects
                </h4>
                <div className="space-y-2">
                  {linkedProjects.map((project) => (
                    <div
                      key={project.id}
                      className="p-3 bg-gray-50 rounded-lg"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <a
                            href={`/projects/${project.id}`}
                            className="font-medium text-gray-900 hover:text-blue-600 flex items-center gap-1"
                          >
                            <Briefcase className="w-3 h-3" />
                            <span className="truncate">{project.name}</span>
                          </a>
                          <div className="flex items-center gap-2 mt-1">
                            <span className={`text-xs px-1.5 py-0.5 rounded ${
                              project.status === 'active' ? 'bg-green-100 text-green-700' :
                              project.status === 'quote_sent' ? 'bg-yellow-100 text-yellow-700' :
                              project.status === 'scheduled' ? 'bg-blue-100 text-blue-700' :
                              project.status === 'completed' ? 'bg-gray-100 text-gray-600' :
                              'bg-gray-100 text-gray-600'
                            }`}>
                              {project.status?.replace('_', ' ')}
                            </span>
                            <span className="text-xs text-gray-400">
                              {format(new Date(project.created_at), 'MMM d')}
                            </span>
                          </div>
                          {project.assigned_rep_user && (
                            <div className="flex items-center justify-between mt-2">
                              <p className="text-xs text-gray-500">
                                Sales: {project.assigned_rep_user.name}
                              </p>
                              {onInviteSalesRep && (
                                <button
                                  onClick={() => onInviteSalesRep(project.assigned_rep_user!.id, project.assigned_rep_user!.name)}
                                  className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"
                                  title={`Invite ${project.assigned_rep_user.name} to conversation`}
                                >
                                  <UserPlus className="w-3 h-3" />
                                  Invite
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recent Messages */}
            {recentMessages.length > 0 && (
              <div className="space-y-3">
                <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  Recent Messages
                </h4>
                <div className="space-y-2">
                  {recentMessages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`p-2 rounded-lg text-sm ${
                        msg.direction === 'outbound'
                          ? 'bg-blue-50 text-blue-900'
                          : 'bg-gray-50 text-gray-900'
                      }`}
                    >
                      <p className="line-clamp-2">{msg.body}</p>
                      <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatDistanceToNow(new Date(msg.created_at), { addSuffix: true })}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Created Date */}
            <div className="pt-4 border-t text-xs text-gray-400 text-center">
              Contact created {formatDistanceToNow(new Date(contact.created_at), { addSuffix: true })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default ContactInfoPanel;
