import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import {
  Plus,
  Search,
  Users,
  MoreVertical,
  Edit2,
  Trash2,
  Upload,
  Eye,
} from 'lucide-react';
import toast from 'react-hot-toast';
import type { SurveyPopulation } from '../types';
import PopulationEditorModal from './PopulationEditorModal';
import PopulationContactsModal from './PopulationContactsModal';
import CSVImportModal from './CSVImportModal';

export default function PopulationsList() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [showEditor, setShowEditor] = useState(false);
  const [showContacts, setShowContacts] = useState<SurveyPopulation | null>(null);
  const [showCSVImport, setShowCSVImport] = useState<SurveyPopulation | null>(null);
  const [editingPopulation, setEditingPopulation] = useState<SurveyPopulation | null>(null);
  const [menuOpen, setMenuOpen] = useState<string | null>(null);

  const { data: populations, isLoading } = useQuery({
    queryKey: ['survey-populations', search],
    queryFn: async () => {
      let query = supabase
        .from('survey_populations')
        .select('*')
        .order('created_at', { ascending: false });

      if (search) {
        query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as SurveyPopulation[];
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('survey_populations').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['survey-populations'] });
      toast.success('Population deleted');
    },
    onError: () => toast.error('Failed to delete population'),
  });

  const handleEdit = (population: SurveyPopulation) => {
    setEditingPopulation(population);
    setShowEditor(true);
    setMenuOpen(null);
  };

  const handleDelete = (id: string) => {
    if (confirm('Are you sure? This will delete all contacts in this population.')) {
      deleteMutation.mutate(id);
    }
    setMenuOpen(null);
  };

  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      app_users: 'App Users',
      db_clients: 'Database Clients',
      imported: 'Imported',
      mixed: 'Mixed',
    };
    return labels[type] || type;
  };

  const getTypeBadge = (type: string) => {
    const styles: Record<string, string> = {
      app_users: 'bg-blue-100 text-blue-700',
      db_clients: 'bg-purple-100 text-purple-700',
      imported: 'bg-green-100 text-green-700',
      mixed: 'bg-orange-100 text-orange-700',
    };
    return styles[type] || 'bg-gray-100 text-gray-700';
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Populations</h1>
          <p className="text-gray-500 mt-1">Manage survey recipient groups</p>
        </div>
        <button
          onClick={() => {
            setEditingPopulation(null);
            setShowEditor(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Population
        </button>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="Search populations..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
        />
      </div>

      {/* Populations Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full" />
        </div>
      ) : populations?.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-100">
          <Users className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900">No populations yet</h3>
          <p className="text-gray-500 mt-1">Create a population to organize survey recipients</p>
          <button
            onClick={() => setShowEditor(true)}
            className="mt-4 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
          >
            Create Population
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {populations?.map((population) => (
            <div
              key={population.id}
              className="bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`px-2 py-0.5 text-xs rounded-full ${getTypeBadge(population.population_type)}`}>
                        {getTypeLabel(population.population_type)}
                      </span>
                    </div>
                    <h3 className="font-semibold text-gray-900 truncate">{population.name}</h3>
                    {population.description && (
                      <p className="text-sm text-gray-500 mt-1 line-clamp-2">{population.description}</p>
                    )}
                  </div>
                  <div className="relative">
                    <button
                      onClick={() => setMenuOpen(menuOpen === population.id ? null : population.id)}
                      className="p-1 text-gray-400 hover:text-gray-600 rounded"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>
                    {menuOpen === population.id && (
                      <div className="absolute right-0 top-8 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-10 min-w-[160px]">
                        <button
                          onClick={() => {
                            setShowContacts(population);
                            setMenuOpen(null);
                          }}
                          className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                        >
                          <Eye className="w-4 h-4" />
                          View Contacts
                        </button>
                        <button
                          onClick={() => {
                            setShowCSVImport(population);
                            setMenuOpen(null);
                          }}
                          className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                        >
                          <Upload className="w-4 h-4" />
                          Import CSV
                        </button>
                        <button
                          onClick={() => handleEdit(population)}
                          className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                        >
                          <Edit2 className="w-4 h-4" />
                          Edit
                        </button>
                        <hr className="my-1" />
                        <button
                          onClick={() => handleDelete(population.id)}
                          className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-gray-50"
                        >
                          <Trash2 className="w-4 h-4" />
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Stats */}
                <div className="flex items-center gap-4 mt-4 pt-3 border-t border-gray-100">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-gray-400" />
                    <span className="text-sm font-medium text-gray-900">
                      {population.contact_count.toLocaleString()}
                    </span>
                    <span className="text-sm text-gray-500">contacts</span>
                  </div>
                </div>

                {/* Quick Actions */}
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={() => setShowContacts(population)}
                    className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                  >
                    <Eye className="w-3 h-3" />
                    View
                  </button>
                  <button
                    onClick={() => setShowCSVImport(population)}
                    className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 text-sm text-emerald-600 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors"
                  >
                    <Upload className="w-3 h-3" />
                    Import
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Editor Modal */}
      {showEditor && (
        <PopulationEditorModal
          population={editingPopulation}
          onClose={() => {
            setShowEditor(false);
            setEditingPopulation(null);
          }}
          onSave={() => {
            queryClient.invalidateQueries({ queryKey: ['survey-populations'] });
            setShowEditor(false);
            setEditingPopulation(null);
          }}
        />
      )}

      {/* Contacts Modal */}
      {showContacts && (
        <PopulationContactsModal
          population={showContacts}
          onClose={() => setShowContacts(null)}
        />
      )}

      {/* CSV Import Modal */}
      {showCSVImport && (
        <CSVImportModal
          population={showCSVImport}
          onClose={() => setShowCSVImport(null)}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['survey-populations'] });
            setShowCSVImport(null);
          }}
        />
      )}
    </div>
  );
}
