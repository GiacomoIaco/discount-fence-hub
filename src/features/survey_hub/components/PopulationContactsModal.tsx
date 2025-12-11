import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import { X, Search, UserPlus, Trash2, Mail, Phone, Building2 } from 'lucide-react';
import toast from 'react-hot-toast';
import type { SurveyPopulation, PopulationContact } from '../types';

interface PopulationContactsModalProps {
  population: SurveyPopulation;
  onClose: () => void;
}

export default function PopulationContactsModal({ population, onClose }: PopulationContactsModalProps) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [newContact, setNewContact] = useState({
    name: '',
    email: '',
    phone: '',
    company: '',
  });

  const { data: contacts, isLoading } = useQuery({
    queryKey: ['population-contacts', population.id, search],
    queryFn: async () => {
      let query = supabase
        .from('survey_population_contacts')
        .select('*')
        .eq('population_id', population.id)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (search) {
        query = query.or(
          `contact_name.ilike.%${search}%,contact_email.ilike.%${search}%,contact_company.ilike.%${search}%`
        );
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as PopulationContact[];
    },
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('survey_population_contacts').insert({
        population_id: population.id,
        contact_name: newContact.name || null,
        contact_email: newContact.email || null,
        contact_phone: newContact.phone || null,
        contact_company: newContact.company || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['population-contacts', population.id] });
      queryClient.invalidateQueries({ queryKey: ['survey-populations'] });
      setNewContact({ name: '', email: '', phone: '', company: '' });
      setShowAddForm(false);
      toast.success('Contact added');
    },
    onError: (err: any) => {
      if (err.message?.includes('duplicate')) {
        toast.error('Contact with this email already exists');
      } else {
        toast.error('Failed to add contact');
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('survey_population_contacts').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['population-contacts', population.id] });
      queryClient.invalidateQueries({ queryKey: ['survey-populations'] });
      toast.success('Contact removed');
    },
    onError: () => toast.error('Failed to remove contact'),
  });

  const canAdd = newContact.email || newContact.phone;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">{population.name}</h2>
            <p className="text-sm text-gray-500">{population.contact_count} contacts</p>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search & Add */}
        <div className="p-4 border-b border-gray-100 flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search contacts..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            />
          </div>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
          >
            <UserPlus className="w-4 h-4" />
            Add Contact
          </button>
        </div>

        {/* Add Form */}
        {showAddForm && (
          <div className="p-4 bg-emerald-50 border-b border-emerald-100">
            <div className="grid grid-cols-2 gap-3">
              <input
                type="text"
                placeholder="Name"
                value={newContact.name}
                onChange={(e) => setNewContact({ ...newContact, name: e.target.value })}
                className="px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500"
              />
              <input
                type="email"
                placeholder="Email *"
                value={newContact.email}
                onChange={(e) => setNewContact({ ...newContact, email: e.target.value })}
                className="px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500"
              />
              <input
                type="tel"
                placeholder="Phone"
                value={newContact.phone}
                onChange={(e) => setNewContact({ ...newContact, phone: e.target.value })}
                className="px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500"
              />
              <input
                type="text"
                placeholder="Company"
                value={newContact.company}
                onChange={(e) => setNewContact({ ...newContact, company: e.target.value })}
                className="px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div className="flex justify-end gap-2 mt-3">
              <button
                onClick={() => setShowAddForm(false)}
                className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={() => addMutation.mutate()}
                disabled={!canAdd || addMutation.isPending}
                className="px-3 py-1.5 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50"
              >
                {addMutation.isPending ? 'Adding...' : 'Add Contact'}
              </button>
            </div>
          </div>
        )}

        {/* Contacts List */}
        <div className="flex-1 overflow-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full" />
            </div>
          ) : contacts?.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <p>No contacts yet</p>
              <p className="text-sm">Add contacts manually or import from CSV</p>
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Contact</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Company</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {contacts?.map((contact) => (
                  <tr key={contact.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <span className="font-medium text-gray-900">
                        {contact.contact_name || '-'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="space-y-1">
                        {contact.contact_email && (
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            <Mail className="w-3 h-3" />
                            {contact.contact_email}
                          </div>
                        )}
                        {contact.contact_phone && (
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            <Phone className="w-3 h-3" />
                            {contact.contact_phone}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {contact.contact_company && (
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <Building2 className="w-3 h-3" />
                          {contact.contact_company}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => {
                          if (confirm('Remove this contact?')) {
                            deleteMutation.mutate(contact.id);
                          }
                        }}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 bg-gray-50 text-right">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
