import { useState, useEffect } from 'react';
import { X, Trash2, Save, User, Lock, MessageSquarePlus, Sparkles } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { HUB_CONFIG, type HubKey } from '../RoadmapHub';
import { STATUS_CONFIG, COMPLEXITY_CONFIG, type RoadmapItem, type StatusType, type ComplexityType, type RoadmapAttachment } from '../types';
import { useAuth } from '../../../contexts/AuthContext';
import RoadmapAttachments from './RoadmapAttachments';
import RelatedItems from './RelatedItems';
import toast from 'react-hot-toast';

// Fire-and-forget notification when idea is marked as done
function sendRoadmapCompletedNotification(
  roadmapItemId: string,
  roadmapItemCode: string,
  roadmapItemTitle: string,
  createdById: string,
  triggeredByName: string
): void {
  fetch('/.netlify/functions/send-roadmap-notification', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      roadmapItemId,
      roadmapItemCode,
      roadmapItemTitle,
      createdById,
      triggeredByName,
    }),
  })
    .then(response => {
      if (!response.ok) {
        console.warn('Roadmap notification request failed:', response.status);
      }
    })
    .catch(error => {
      console.error('Failed to send roadmap notification:', error);
    });
}

interface RoadmapItemModalProps {
  item: RoadmapItem;
  onClose: () => void;
  onUpdate: () => void;
  isAdmin: boolean;
}

export default function RoadmapItemModal({
  item,
  onClose,
  onUpdate,
  isAdmin,
}: RoadmapItemModalProps) {
  const { profile } = useAuth();
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [reanalyzing, setReanalyzing] = useState(false);
  const [attachments, setAttachments] = useState<RoadmapAttachment[]>([]);
  const [relatedItemIds, setRelatedItemIds] = useState<string[]>(item.related_items || []);
  const [formData, setFormData] = useState({
    title: item.title,
    raw_idea: item.raw_idea || '',
    claude_analysis: item.claude_analysis || '',
    user_notes: item.user_notes || '',
    status: item.status,
    importance: item.importance || 3,
    complexity: item.complexity || 'M',
  });

  const hubConfig = HUB_CONFIG[item.hub as HubKey];

  // Fetch attachments when modal opens
  const fetchAttachments = async () => {
    const { data, error } = await supabase
      .from('roadmap_attachments')
      .select('*')
      .eq('roadmap_item_id', item.id)
      .order('uploaded_at', { ascending: false });

    if (error) {
      console.error('Error fetching attachments:', error);
    } else {
      setAttachments(data || []);
    }
  };

  useEffect(() => {
    fetchAttachments();
  }, [item.id]);

  const handleSave = async () => {
    if (!formData.title.trim()) {
      toast.error('Title is required');
      return;
    }

    // Non-admins can only update title, descriptions, user_notes, and related_items
    const updateData = isAdmin
      ? {
          title: formData.title.trim(),
          raw_idea: formData.raw_idea.trim() || null,
          claude_analysis: formData.claude_analysis.trim() || null,
          user_notes: formData.user_notes.trim() || null,
          status: formData.status,
          importance: formData.importance,
          complexity: formData.complexity,
          related_items: relatedItemIds.length > 0 ? relatedItemIds : null,
        }
      : {
          title: formData.title.trim(),
          raw_idea: formData.raw_idea.trim() || null,
          user_notes: formData.user_notes.trim() || null,
          related_items: relatedItemIds.length > 0 ? relatedItemIds : null,
        };

    setSaving(true);
    try {
      const { error } = await supabase
        .from('roadmap_items')
        .update(updateData)
        .eq('id', item.id);

      if (error) throw error;

      // Send notification if status changed to 'done'
      if (item.status !== 'done' && formData.status === 'done' && item.created_by) {
        const triggeredByName = profile?.full_name || profile?.email || 'Admin';
        sendRoadmapCompletedNotification(
          item.id,
          item.code,
          item.title,
          item.created_by,
          triggeredByName
        );
      }

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
    if (!isAdmin) {
      toast.error('Only admins can delete items');
      return;
    }
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

  const handleReanalyze = async () => {
    if (!formData.user_notes.trim()) {
      toast.error('Add some notes first before re-analyzing');
      return;
    }

    setReanalyzing(true);
    try {
      // Combine original idea with user notes for re-analysis
      const combinedIdea = `${formData.raw_idea}\n\n--- Additional thoughts ---\n${formData.user_notes}`;

      const response = await fetch('/.netlify/functions/expand-roadmap-idea', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawIdea: combinedIdea }),
      });

      if (!response.ok) {
        throw new Error('Failed to re-analyze idea');
      }

      const result = await response.json();

      // Update the claude_analysis with new analysis
      setFormData(prev => ({
        ...prev,
        claude_analysis: result.claude_analysis || prev.claude_analysis,
        // Keep user_notes so user can see what was submitted
      }));

      toast.success('Re-analysis complete! Review and save.');
    } catch (error) {
      console.error('Error re-analyzing:', error);
      toast.error('Failed to re-analyze idea');
    } finally {
      setReanalyzing(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className={`flex items-center justify-between p-4 border-b ${hubConfig?.border || 'border-gray-200'} ${hubConfig?.bgLight || 'bg-gray-50'}`}>
          <div className="flex items-center gap-3 flex-wrap">
            <span className={`text-sm font-mono px-2 py-1 rounded ${hubConfig?.bgLight || 'bg-gray-100'} ${hubConfig?.textColor || 'text-gray-600'} border ${hubConfig?.border || 'border-gray-200'}`}>
              {item.code}
            </span>
            <span className={`text-sm ${hubConfig?.textColor || 'text-gray-600'}`}>
              {hubConfig?.label || item.hub}
            </span>
            {item.creator_name && (
              <span className="text-xs text-gray-400 flex items-center gap-1">
                <User className="w-3 h-3" />
                {item.creator_name}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-white/50 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4 lg:p-6 space-y-4">
          {/* Title row */}
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* Status - Admin only */}
            <div className="lg:w-auto">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1">
                Status
                {!isAdmin && <Lock className="w-3 h-3 text-gray-400" />}
              </label>
              {isAdmin ? (
                <div className="flex flex-wrap gap-1.5">
                  {(Object.keys(STATUS_CONFIG) as StatusType[]).map((status) => {
                    const config = STATUS_CONFIG[status];
                    const isSelected = formData.status === status;
                    return (
                      <button
                        key={status}
                        type="button"
                        onClick={() => setFormData({ ...formData, status })}
                        className={`px-2.5 py-1 text-xs font-medium rounded-full transition-colors ${
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
              ) : (
                <div className="flex items-center gap-2">
                  <span className={`px-3 py-1.5 text-sm font-medium rounded-full ${STATUS_CONFIG[item.status].bgColor} ${STATUS_CONFIG[item.status].color}`}>
                    {STATUS_CONFIG[item.status].label}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Importance & Complexity row - more compact */}
          <div className="flex flex-wrap items-center gap-4 pb-2 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700">Importance:</label>
              <div className="flex">
                {[1, 2, 3, 4, 5].map((level) => (
                  <button
                    key={level}
                    type="button"
                    onClick={() => isAdmin && setFormData({ ...formData, importance: level })}
                    disabled={!isAdmin}
                    className={`px-1 text-lg transition-colors ${
                      formData.importance >= level ? 'text-yellow-500' : 'text-gray-300'
                    } ${!isAdmin ? 'cursor-not-allowed' : 'hover:scale-110'}`}
                  >
                    ★
                  </button>
                ))}
              </div>
              {!isAdmin && <Lock className="w-3 h-3 text-gray-400" />}
            </div>

            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700">Size:</label>
              <div className="flex gap-1">
                {(Object.keys(COMPLEXITY_CONFIG) as ComplexityType[]).map((size) => (
                  <button
                    key={size}
                    type="button"
                    onClick={() => isAdmin && setFormData({ ...formData, complexity: size })}
                    disabled={!isAdmin}
                    className={`px-2 py-0.5 text-xs font-medium rounded transition-colors ${
                      formData.complexity === size
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    } ${!isAdmin ? 'cursor-not-allowed opacity-60' : ''}`}
                  >
                    {size}
                  </button>
                ))}
              </div>
              {!isAdmin && <Lock className="w-3 h-3 text-gray-400" />}
            </div>

            {/* Metadata inline */}
            <div className="text-xs text-gray-400 ml-auto">
              Created: {new Date(item.created_at).toLocaleDateString()}
              {item.completed_at && ` • Completed: ${new Date(item.completed_at).toLocaleDateString()}`}
            </div>
          </div>

          {/* Two-column layout for Raw Idea and Claude Analysis */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 flex-1">
            {/* Left column - Raw Idea */}
            <div className="flex flex-col">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Original Idea / Description
              </label>
              <textarea
                value={formData.raw_idea}
                onChange={(e) => setFormData({ ...formData, raw_idea: e.target.value })}
                placeholder="Quick brain dump - what's the idea about?"
                rows={14}
                className="flex-1 min-h-[280px] border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-y"
              />
            </div>

            {/* Right column - Claude Analysis */}
            <div className="flex flex-col">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1">
                <Sparkles className="w-4 h-4 text-blue-500" />
                Claude Analysis
                {!isAdmin && <Lock className="w-3 h-3 text-gray-400" />}
              </label>
              <textarea
                value={formData.claude_analysis}
                onChange={(e) => isAdmin && setFormData({ ...formData, claude_analysis: e.target.value })}
                placeholder="AI-expanded thoughts, best practices, implementation notes..."
                rows={14}
                disabled={!isAdmin}
                className={`flex-1 min-h-[280px] border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-y ${!isAdmin ? 'bg-gray-50 cursor-not-allowed' : ''}`}
              />
            </div>
          </div>

          {/* Attachments section */}
          <div className="border-t border-gray-200 pt-4">
            <RoadmapAttachments
              roadmapItemId={item.id}
              attachments={attachments}
              onAttachmentsChange={fetchAttachments}
            />
          </div>

          {/* Related Items section */}
          <div className="border-t border-gray-200 pt-4">
            <RelatedItems
              currentItemId={item.id}
              relatedItemIds={relatedItemIds}
              onRelatedItemsChange={setRelatedItemIds}
            />
          </div>

          {/* User Notes section - for additional thoughts */}
          <div className="border-t border-gray-200 pt-4">
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1">
              <MessageSquarePlus className="w-4 h-4 text-green-600" />
              Additional Thoughts
              <span className="text-xs text-gray-400 font-normal">
                (Add notes here, then click "Re-analyze" to update Claude's analysis)
              </span>
            </label>
            <div className="flex flex-col lg:flex-row gap-3">
              <textarea
                value={formData.user_notes}
                onChange={(e) => setFormData({ ...formData, user_notes: e.target.value })}
                placeholder="After reviewing the idea and analysis, add any additional thoughts, requirements, or questions here..."
                rows={3}
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500 focus:border-green-500 resize-none"
              />
              <button
                onClick={handleReanalyze}
                disabled={reanalyzing || !formData.user_notes.trim()}
                className="lg:self-end flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg hover:from-blue-600 hover:to-purple-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
              >
                <Sparkles className="w-4 h-4" />
                {reanalyzing ? 'Analyzing...' : 'Re-analyze'}
              </button>
            </div>
            {item.user_notes && item.user_notes !== formData.user_notes && (
              <p className="text-xs text-gray-400 mt-1">
                Previous notes: {item.user_notes.substring(0, 100)}...
              </p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-gray-200 bg-gray-50">
          {isAdmin ? (
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="flex items-center gap-2 px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
            >
              <Trash2 className="w-4 h-4" />
              {deleting ? 'Deleting...' : 'Delete'}
            </button>
          ) : (
            <div />
          )}

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
