import { useEffect } from 'react';
import { X, Sparkles, Check, Save, Trash2 } from 'lucide-react';
import type { Photo } from '../../../lib/photos';

interface PhotoReviewModalProps {
  photo: Photo | null;
  activeTab: 'gallery' | 'pending' | 'saved' | 'archived' | 'flagged';
  userRole: 'sales' | 'operations' | 'sales-manager' | 'admin';
  uploaderName: string;
  editingTags: string[];
  editingScore: number;
  reviewNotes: string;
  reviewLoading: boolean;
  enhancedUrl: string | null;
  showingEnhanced: boolean;
  isEnhancing: boolean;
  allTags: {
    productType: string[];
    material: string[];
    style: string[];
  };
  onClose: () => void;
  onToggleTag: (tag: string) => void;
  onSetScore: (score: number) => void;
  onSetNotes: (notes: string) => void;
  onPublish: () => void;
  onSaveDraft: () => void;
  onSaveNotPublished: () => void;
  onUpdateSaved: () => void;
  onArchive: () => void;
  onPermanentDelete: () => void;
  onAutoEnhance: () => void;
  onToggleEnhancedView: (show: boolean) => void;
  onResetEnhancement?: () => void;
}

export function PhotoReviewModal({
  photo,
  activeTab,
  userRole,
  uploaderName,
  editingTags,
  editingScore,
  reviewNotes,
  reviewLoading,
  enhancedUrl,
  showingEnhanced,
  isEnhancing,
  allTags,
  onClose,
  onToggleTag,
  onSetScore,
  onSetNotes,
  onPublish,
  onSaveDraft,
  onSaveNotPublished,
  onUpdateSaved,
  onArchive,
  onPermanentDelete,
  onAutoEnhance,
  onToggleEnhancedView,
  onResetEnhancement,
}: PhotoReviewModalProps) {
  // Reset enhancement state when photo changes
  useEffect(() => {
    if (photo && onResetEnhancement) {
      onResetEnhancement();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photo?.id]); // Only depend on photo ID, not the function

  if (!photo) return null;

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-7xl w-full max-h-[95vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 flex justify-between items-start">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Review Photo</h2>
            <p className="text-sm text-gray-500 mt-1">
              {photo.uploadedAt && !isNaN(new Date(photo.uploadedAt).getTime()) ? (
                <>
                  Uploaded {new Date(photo.uploadedAt).toLocaleDateString()} at{' '}
                  {new Date(photo.uploadedAt).toLocaleTimeString()}
                </>
              ) : (
                'Upload date unknown'
              )}
            </p>
            <p className="text-sm text-gray-600 font-medium">Submitted by: {uploaderName || 'Unknown User'}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Side-by-side layout */}
        <div className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-2 gap-6 p-6">
            {/* Left: Photo Preview */}
            <div className="space-y-3">
              {/* Auto-Enhance Controls */}
              <div className="flex items-center justify-between">
                <button
                  onClick={onAutoEnhance}
                  disabled={isEnhancing || reviewLoading}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 disabled:opacity-50 flex items-center space-x-2"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>{isEnhancing ? 'Enhancing...' : 'Auto-Enhance'}</span>
                </button>

                {/* Original vs Enhanced Toggle */}
                {enhancedUrl && (
                  <div className="flex items-center space-x-2 bg-gray-200 rounded-lg p-1">
                    <button
                      onClick={() => onToggleEnhancedView(false)}
                      className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                        !showingEnhanced
                          ? 'bg-white text-gray-900 shadow-sm'
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      Original
                    </button>
                    <button
                      onClick={() => onToggleEnhancedView(true)}
                      className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                        showingEnhanced
                          ? 'bg-white text-gray-900 shadow-sm'
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      Enhanced
                    </button>
                  </div>
                )}
              </div>

              {/* Photo Display */}
              <div className="flex items-center justify-center bg-gray-100 rounded-lg">
                <img
                  src={showingEnhanced && enhancedUrl ? enhancedUrl : photo.url}
                  alt="Review"
                  className="max-w-full max-h-[calc(95vh-250px)] object-contain"
                />
              </div>
            </div>

            {/* Right: Review Controls */}
            <div className="overflow-y-auto pr-2">
              {/* AI Suggestions */}
              {photo.suggestedTags && photo.suggestedTags.length > 0 && (
                <div className="mb-6 p-4 bg-blue-50 rounded-lg">
                  <div className="flex items-center space-x-2 mb-2">
                    <Sparkles className="w-5 h-5 text-blue-600" />
                    <h3 className="font-semibold text-blue-900">AI Suggestions</h3>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {photo.suggestedTags.map((tag) => (
                      <span key={tag} className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm">
                        {tag}
                      </span>
                    ))}
                  </div>
                  {photo.qualityScore && (
                    <p className="text-sm text-blue-700 mt-2">Quality Score: {photo.qualityScore}/10</p>
                  )}
                </div>
              )}

              {/* Tag Selection */}
              <div className="mb-6">
                <h3 className="font-semibold text-gray-900 mb-3">Tags</h3>
                {Object.entries(allTags).map(([category, tags]) => (
                  <div key={category} className="mb-4">
                    <h4 className="text-sm font-medium text-gray-700 mb-2 capitalize">
                      {category.replace(/([A-Z])/g, ' $1').trim()}
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {tags.map((tag) => (
                        <button
                          key={tag}
                          onClick={() => onToggleTag(tag)}
                          className={`px-3 py-1 rounded-full text-sm transition-colors ${
                            editingTags.includes(tag)
                              ? 'bg-blue-600 text-white'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          {tag}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* Quality Score */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Quality Score: {editingScore}/10
                </label>
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={editingScore}
                  onChange={(e) => onSetScore(parseInt(e.target.value))}
                  className="w-full"
                />
              </div>

              {/* Review Notes */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">Review Notes</label>
                <textarea
                  value={reviewNotes}
                  onChange={(e) => onSetNotes(e.target.value)}
                  placeholder="Add notes about this photo..."
                  className="w-full border border-gray-300 rounded-lg p-3 min-h-[100px]"
                />
              </div>

              {/* Action Buttons - Different per tab */}
              <div className="space-y-3">
                {activeTab === 'pending' && (
                  <>
                    {/* Row 1: Publish and Save (not published) */}
                    <div className="flex space-x-3">
                      <button
                        onClick={onPublish}
                        disabled={reviewLoading || editingTags.length === 0}
                        className="flex-1 bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                        title={editingTags.length === 0 ? 'Add at least one tag to publish' : 'Publish photo'}
                      >
                        <Check className="w-5 h-5" />
                        <span>Publish</span>
                      </button>
                      <button
                        onClick={onSaveNotPublished}
                        disabled={reviewLoading}
                        className="flex-1 bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center space-x-2"
                      >
                        <Save className="w-5 h-5" />
                        <span>Save</span>
                      </button>
                    </div>
                    {/* Row 2: Save Draft and Archive */}
                    <div className="flex space-x-3">
                      <button
                        onClick={onSaveDraft}
                        disabled={reviewLoading}
                        className="flex-1 bg-gray-500 text-white py-3 rounded-lg font-semibold hover:bg-gray-600 disabled:opacity-50 flex items-center justify-center space-x-2"
                      >
                        <Save className="w-5 h-5" />
                        <span>Save Draft</span>
                      </button>
                      <button
                        onClick={onArchive}
                        disabled={reviewLoading}
                        className="flex-1 bg-red-600 text-white py-3 rounded-lg font-semibold hover:bg-red-700 disabled:opacity-50 flex items-center justify-center space-x-2"
                      >
                        <Trash2 className="w-5 h-5" />
                        <span>Archive</span>
                      </button>
                    </div>
                  </>
                )}

                {activeTab === 'saved' && (
                  <div className="flex space-x-3">
                    <button
                      onClick={onPublish}
                      disabled={reviewLoading || editingTags.length === 0}
                      className="flex-1 bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                      title={editingTags.length === 0 ? 'Add at least one tag to publish' : 'Publish photo'}
                    >
                      <Check className="w-5 h-5" />
                      <span>Publish</span>
                    </button>
                    <button
                      onClick={onUpdateSaved}
                      disabled={reviewLoading}
                      className="flex-1 bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center space-x-2"
                    >
                      <Save className="w-5 h-5" />
                      <span>Update</span>
                    </button>
                    <button
                      onClick={onArchive}
                      disabled={reviewLoading}
                      className="flex-1 bg-red-600 text-white py-3 rounded-lg font-semibold hover:bg-red-700 disabled:opacity-50 flex items-center justify-center space-x-2"
                    >
                      <Trash2 className="w-5 h-5" />
                      <span>Archive</span>
                    </button>
                  </div>
                )}

                {activeTab === 'archived' && userRole === 'admin' && (
                  <button
                    onClick={onPermanentDelete}
                    disabled={reviewLoading}
                    className="w-full bg-red-700 text-white py-3 rounded-lg font-semibold hover:bg-red-800 disabled:opacity-50 flex items-center justify-center space-x-2"
                  >
                    <Trash2 className="w-5 h-5" />
                    <span>Permanently Delete</span>
                  </button>
                )}

                {activeTab === 'archived' && userRole === 'sales-manager' && (
                  <p className="text-gray-500 text-center py-3">Only admins can delete archived photos</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
