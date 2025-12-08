import { useState } from 'react';
import { X, Trash2, Save } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { HUB_CONFIG, type HubKey } from '../RoadmapHub';
import { STATUS_CONFIG, COMPLEXITY_CONFIG, type RoadmapItem, type StatusType, type ComplexityType } from '../types';
import toast from 'react-hot-toast';

interface RoadmapItemModalProps {
  item: RoadmapItem;
  onClose: () => void;
  onUpdate: () => void;
}

export default function RoadmapItemModal({
  item,
  onClose,
  onUpdate,
}: RoadmapItemModalProps) {
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [formData, setFormData] = useState({
    title: item.title,
    raw_idea: item.raw_idea || '',
    claude_analysis: item.claude_analysis || '',
    status: item.status,
    importance: item.importance || 3,
    complexity: item.complexity || 'M',
  });

  const hubConfig = HUB_CONFIG[item.hub as HubKey];

  const handleSave = async () => {
    if (!formData.title.trim()) {
      toast.error('Title is required');
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('roadmap_items')
        .update({
          title: formData.title.trim(),
          raw_idea: formData.raw_idea.trim() || null,
          claude_analysis: formData.claude_analysis.trim() || null,
          status: formData.status,
          importance: formData.importance,
          complexity: formData.complexity,
        })
        .eq('id', item.id);

      if (error) throw error;

      toast.success('Item updated');
      onUpdate();
    } catch (error) {
      console.error('Error updating item:', error);
      toast.error('Failed to update item');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this item?')) return;

    setDeleting(true);
    try {
      const { error } = await supabase
        .from('roadmap_items')
        .delete()
        .eq('id', item.id);

      if (error) throw error;

      toast.success('Item deleted');
      onUpdate();
    } catch (error) {
      console.error('Error deleting item:', error);
      toast.error('Failed to delete item');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className={`flex items-center justify-between p-4 border-b ${hubConfig?.border || 'border-gray-200'} ${hubConfig?.bgLight || 'bg-gray-50'}`}>
          <div className="flex items-center gap-3">
            <span className={`text-sm font-mono px-2 py-1 rounded ${hubConfig?.bgLight || 'bg-gray-100'} ${hubConfig?.textColor || 'text-gray-600'} border ${hubConfig?.border || 'border-gray-200'}`}>
              {item.code}
            </span>
            <span className={`text-sm ${hubConfig?.textColor || 'text-gray-600'}`}>
              {hubConfig?.label || item.hub}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-white/50 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4 space-y-4">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Status */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(STATUS_CONFIG) as StatusType[]).map((status) => {
                const config = STATUS_CONFIG[status];
                const isSelected = formData.status === status;
                return (
                  <button
                    key={status}
                    type="button"
                    onClick={() => setFormData({ ...formData, status })}
                    className={`px-3 py-1.5 text-sm font-medium rounded-full transition-colors ${
                      isSelected
                        ? `${config.bgColor} ${config.color} ring-2 ring-offset-1 ring-current`
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {config.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Importance & Complexity */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Importance</label>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((level) => (
                  <button
                    key={level}
                    type="button"
                    onClick={() => setFormData({ ...formData, importance: level })}
                    className={`flex-1 py-2 text-xl transition-colors ${
                      formData.importance >= level ? 'text-yellow-500' : 'text-gray-300'
                    }`}
                  >
                    ★
                  </button>
                ))}
              </div>
            </div>

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

          {/* Raw Idea */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Raw Idea / Description</label>
            <textarea
              value={formData.raw_idea}
              onChange={(e) => setFormData({ ...formData, raw_idea: e.target.value })}
              placeholder="Quick brain dump - what's the idea about?"
              rows={3}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Claude Analysis */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Claude Analysis</label>
            <textarea
              value={formData.claude_analysis}
              onChange={(e) => setFormData({ ...formData, claude_analysis: e.target.value })}
              placeholder="Expanded thoughts, best practices, implementation notes from Claude sessions..."
              rows={4}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Metadata */}
          <div className="text-xs text-gray-500 space-y-1 pt-2 border-t border-gray-200">
            <p>Created: {new Date(item.created_at).toLocaleString()}</p>
            {item.updated_at !== item.created_at && (
              <p>Updated: {new Date(item.updated_at).toLocaleString()}</p>
            )}
            {item.completed_at && (
              <p>Completed: {new Date(item.completed_at).toLocaleString()}</p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-gray-200 bg-gray-50">
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="flex items-center gap-2 px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
          >
            <Trash2 className="w-4 h-4" />
            {deleting ? 'Deleting...' : 'Delete'}
          </button>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
