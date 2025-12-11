import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import { X, Save } from 'lucide-react';
import toast from 'react-hot-toast';
import type { SurveyPopulation } from '../types';
import { useAuth } from '../../../contexts/AuthContext';

interface PopulationEditorModalProps {
  population: SurveyPopulation | null;
  onClose: () => void;
  onSave: () => void;
}

export default function PopulationEditorModal({ population, onClose, onSave }: PopulationEditorModalProps) {
  const { user } = useAuth();
  const [name, setName] = useState(population?.name || '');
  const [description, setDescription] = useState(population?.description || '');
  const [populationType, setPopulationType] = useState<SurveyPopulation['population_type']>(
    population?.population_type || 'imported'
  );

  const saveMutation = useMutation({
    mutationFn: async () => {
      const data = {
        name,
        description: description || null,
        population_type: populationType,
        created_by: user?.id,
      };

      if (population?.id) {
        const { error } = await supabase.from('survey_populations').update(data).eq('id', population.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('survey_populations').insert(data);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(population ? 'Population updated' : 'Population created');
      onSave();
    },
    onError: (err: any) => toast.error(err.message || 'Failed to save population'),
  });

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            {population ? 'Edit Population' : 'New Population'}
          </h2>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Builder Clients Q4 2024"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of this population..."
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
            <select
              value={populationType}
              onChange={(e) => setPopulationType(e.target.value as SurveyPopulation['population_type'])}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            >
              <option value="imported">Imported (CSV/Manual)</option>
              <option value="app_users">App Users</option>
              <option value="db_clients">Database Clients</option>
              <option value="mixed">Mixed Sources</option>
            </select>
            <p className="text-xs text-gray-500 mt-1">
              {populationType === 'imported' && 'Contacts will be added via CSV import or manual entry'}
              {populationType === 'app_users' && 'Filter app users by role or other criteria'}
              {populationType === 'db_clients' && 'Pull contacts from your client database (coming soon)'}
              {populationType === 'mixed' && 'Combine contacts from multiple sources'}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-4 border-t border-gray-200 bg-gray-50 rounded-b-xl">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => saveMutation.mutate()}
            disabled={!name || saveMutation.isPending}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {saveMutation.isPending ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
