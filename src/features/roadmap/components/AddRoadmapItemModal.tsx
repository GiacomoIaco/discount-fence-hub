import { useState } from 'react';
import { X } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { HUB_CONFIG, type HubKey } from '../RoadmapHub';
import { COMPLEXITY_CONFIG, type ComplexityType } from '../types';
import toast from 'react-hot-toast';

interface AddRoadmapItemModalProps {
  onClose: () => void;
  onSuccess: () => void;
  selectedHubs: Set<HubKey>;
}

export default function AddRoadmapItemModal({
  onClose,
  onSuccess,
  selectedHubs,
}: AddRoadmapItemModalProps) {
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    hub: selectedHubs.size === 1 ? Array.from(selectedHubs)[0] : 'general' as HubKey,
    title: '',
    raw_idea: '',
    importance: 3,
    complexity: 'M' as ComplexityType,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      toast.error('Title is required');
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.from('roadmap_items').insert({
        hub: formData.hub,
        title: formData.title.trim(),
        raw_idea: formData.raw_idea.trim() || null,
        importance: formData.importance,
        complexity: formData.complexity,
        status: 'idea',
      });

      if (error) throw error;

      toast.success('Idea added to roadmap!');
      onSuccess();
    } catch (error) {
      console.error('Error adding item:', error);
      toast.error('Failed to add idea');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Add New Idea</h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Hub Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Hub</label>
            <select
              value={formData.hub}
              onChange={(e) => setFormData({ ...formData, hub: e.target.value as HubKey })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {(Object.keys(HUB_CONFIG) as HubKey[]).map((hub) => (
                <option key={hub} value={hub}>
                  {HUB_CONFIG[hub].prefix} - {HUB_CONFIG[hub].label}
                </option>
              ))}
            </select>
          </div>

          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="Brief title for the idea"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              autoFocus
            />
          </div>

          {/* Raw Idea */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={formData.raw_idea}
              onChange={(e) => setFormData({ ...formData, raw_idea: e.target.value })}
              placeholder="Quick brain dump - what's the idea about?"
              rows={4}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Importance & Complexity row */}
          <div className="grid grid-cols-2 gap-4">
            {/* Importance */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Importance (1-5)
              </label>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((level) => (
                  <button
                    key={level}
                    type="button"
                    onClick={() => setFormData({ ...formData, importance: level })}
                    className={`flex-1 py-2 text-lg transition-colors rounded ${
                      formData.importance >= level
                        ? 'text-yellow-500'
                        : 'text-gray-300'
                    }`}
                  >
                    ★
                  </button>
                ))}
              </div>
            </div>

            {/* Complexity */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Complexity</label>
              <div className="flex gap-1">
                {(Object.keys(COMPLEXITY_CONFIG) as ComplexityType[]).map((size) => (
                  <button
                    key={size}
                    type="button"
                    onClick={() => setFormData({ ...formData, complexity: size })}
                    className={`flex-1 py-2 text-sm font-medium rounded border transition-colors ${
                      formData.complexity === size
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {saving ? 'Adding...' : 'Add Idea'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
