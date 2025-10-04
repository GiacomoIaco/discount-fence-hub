import { useState, useEffect } from 'react';
import { ArrowLeft, Sparkles, Check, Save, Trash2 } from 'lucide-react';
import type { Photo } from '../lib/photos';
import { TAG_CATEGORIES } from '../lib/photos';
import { supabase } from '../lib/supabase';

interface PhotoReviewQueueProps {
  onBack: () => void;
  userRole: 'sales-manager' | 'admin';
}

const PhotoReviewQueue = ({ onBack, userRole: _userRole }: PhotoReviewQueueProps) => {
  const [pendingPhotos, setPendingPhotos] = useState<Photo[]>([]);
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);
  const [editingTags, setEditingTags] = useState<string[]>([]);
  const [editingScore, setEditingScore] = useState<number>(5);
  const [reviewNotes, setReviewNotes] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadPendingPhotos();
  }, []);

  const loadPendingPhotos = async () => {
    try {
      const { data, error } = await supabase
        .from('photos')
        .select('*')
        .eq('status', 'pending')
        .order('uploaded_at', { ascending: false });

      if (error) {
        console.error('Error loading pending photos from Supabase:', error);
        console.log('Falling back to localStorage...');
        // Fallback to localStorage
        loadFromLocalStorage();
        return;
      }

      if (data && data.length > 0) {
        console.log(`Loaded ${data.length} pending photos from Supabase`);
        setPendingPhotos(data as Photo[]);
      } else {
        console.log('No pending photos in Supabase, checking localStorage...');
        // Also check localStorage if Supabase is empty
        loadFromLocalStorage();
      }
    } catch (error) {
      console.error('Error loading pending photos:', error);
      loadFromLocalStorage();
    }
  };

  const loadFromLocalStorage = () => {
    const savedPhotos = localStorage.getItem('photoGallery');
    if (savedPhotos) {
      try {
        const parsed = JSON.parse(savedPhotos);
        const pending = parsed.filter((p: Photo) => p.status === 'pending');
        console.log(`Loaded ${pending.length} pending photos from localStorage`);
        setPendingPhotos(pending);
      } catch (e) {
        console.error('Error parsing saved photos:', e);
      }
    } else {
      console.log('No photos found in localStorage');
    }
  };

  const handleSelectPhoto = (photo: Photo) => {
    setSelectedPhoto(photo);
    setEditingTags(photo.tags || photo.suggestedTags || []);
    setEditingScore(photo.qualityScore || 5);
    setReviewNotes(photo.reviewNotes || '');
  };

  const toggleTag = (tag: string) => {
    if (editingTags.includes(tag)) {
      setEditingTags(editingTags.filter((t) => t !== tag));
    } else {
      setEditingTags([...editingTags, tag]);
    }
  };

  const handlePublish = async () => {
    if (!selectedPhoto) return;

    setLoading(true);

    const userId = localStorage.getItem('userId') || 'user123';

    try {
      const updated: Partial<Photo> = {
        status: 'published',
        tags: editingTags,
        qualityScore: editingScore,
        reviewedBy: userId,
        reviewedAt: new Date().toISOString(),
        reviewNotes,
      };

      const { error } = await supabase
        .from('photos')
        .update(updated)
        .eq('id', selectedPhoto.id);

      if (error) throw error;

      // Remove from pending list
      setPendingPhotos((prev) => prev.filter((p) => p.id !== selectedPhoto.id));
      setSelectedPhoto(null);
      alert('Photo published successfully!');
    } catch (error) {
      console.error('Error publishing photo:', error);
      // Fallback to localStorage
      const savedPhotos = localStorage.getItem('photoGallery');
      if (savedPhotos) {
        const parsed = JSON.parse(savedPhotos);
        const updatedPhotos = parsed.map((p: Photo) =>
          p.id === selectedPhoto.id
            ? {
                ...p,
                status: 'published',
                tags: editingTags,
                qualityScore: editingScore,
                reviewedBy: userId,
                reviewedAt: new Date().toISOString(),
                reviewNotes,
              }
            : p
        );
        localStorage.setItem('photoGallery', JSON.stringify(updatedPhotos));
        setPendingPhotos((prev) => prev.filter((p) => p.id !== selectedPhoto.id));
        setSelectedPhoto(null);
        alert('Photo published successfully (saved locally)!');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSaveDraft = async () => {
    if (!selectedPhoto) return;

    setLoading(true);

    try {
      const userId = localStorage.getItem('userId') || 'user123';
      const updated: Partial<Photo> = {
        tags: editingTags,
        qualityScore: editingScore,
        reviewedBy: userId,
        reviewedAt: new Date().toISOString(),
        reviewNotes,
      };

      const { error } = await supabase
        .from('photos')
        .update(updated)
        .eq('id', selectedPhoto.id);

      if (error) throw error;

      // Update in pending list
      setPendingPhotos((prev) =>
        prev.map((p) => (p.id === selectedPhoto.id ? { ...p, ...updated } : p))
      );
      setSelectedPhoto(null);
      alert('Changes saved!');
    } catch (error) {
      console.error('Error saving draft:', error);
      alert('Failed to save changes. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDiscard = async () => {
    if (!selectedPhoto) return;

    if (!confirm('Are you sure you want to archive this photo?')) return;

    setLoading(true);

    const userId = localStorage.getItem('userId') || 'user123';

    try {
      const updated: Partial<Photo> = {
        status: 'archived',
        reviewedBy: userId,
        reviewedAt: new Date().toISOString(),
        reviewNotes: reviewNotes || 'Archived by reviewer',
      };

      const { error } = await supabase
        .from('photos')
        .update(updated)
        .eq('id', selectedPhoto.id);

      if (error) throw error;

      // Remove from pending list
      setPendingPhotos((prev) => prev.filter((p) => p.id !== selectedPhoto.id));
      setSelectedPhoto(null);
      alert('Photo archived.');
    } catch (error) {
      console.error('Error archiving photo:', error);
      // Fallback to localStorage
      const savedPhotos = localStorage.getItem('photoGallery');
      if (savedPhotos) {
        const parsed = JSON.parse(savedPhotos);
        const updatedPhotos = parsed.map((p: Photo) =>
          p.id === selectedPhoto.id
            ? {
                ...p,
                status: 'archived',
                reviewedBy: userId,
                reviewedAt: new Date().toISOString(),
                reviewNotes: reviewNotes || 'Archived by reviewer',
              }
            : p
        );
        localStorage.setItem('photoGallery', JSON.stringify(updatedPhotos));
        setPendingPhotos((prev) => prev.filter((p) => p.id !== selectedPhoto.id));
        setSelectedPhoto(null);
        alert('Photo archived (saved locally).');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 p-4">
        <button onClick={onBack} className="text-blue-600 font-medium flex items-center space-x-2 mb-3">
          <ArrowLeft className="w-5 h-5" />
          <span>Back</span>
        </button>

        <div>
          <h1 className="text-2xl font-bold text-gray-900">Photo Review Queue</h1>
          <p className="text-gray-600 mt-1">
            {pendingPhotos.length} {pendingPhotos.length === 1 ? 'photo' : 'photos'} pending review
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 p-6">
        {/* Pending Photos List */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">Pending Photos</h2>

          {pendingPhotos.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
              <Sparkles className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">No photos pending review</p>
              <p className="text-sm text-gray-400 mt-1">All caught up!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {pendingPhotos.map((photo) => (
                <div
                  key={photo.id}
                  onClick={() => handleSelectPhoto(photo)}
                  className={`bg-white rounded-lg border-2 p-4 cursor-pointer transition-colors ${
                    selectedPhoto?.id === photo.id
                      ? 'border-blue-600'
                      : 'border-gray-200 hover:border-blue-300'
                  }`}
                >
                  <div className="flex space-x-4">
                    <img
                      src={photo.thumbnailUrl || photo.url}
                      alt="Pending review"
                      className="w-24 h-24 object-cover rounded-lg flex-shrink-0"
                    />

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <p className="text-sm text-gray-600">
                            Uploaded {new Date(photo.uploadedAt).toLocaleDateString()}
                          </p>
                          <p className="text-xs text-gray-500">
                            by {photo.uploadedBy.substring(0, 8)}...
                          </p>
                        </div>

                        {photo.qualityScore && (
                          <div className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs font-semibold">
                            Score: {photo.qualityScore}/10
                          </div>
                        )}
                      </div>

                      {photo.suggestedTags && photo.suggestedTags.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {photo.suggestedTags.slice(0, 3).map((tag) => (
                            <span
                              key={tag}
                              className="px-2 py-1 bg-purple-100 text-purple-700 text-xs rounded"
                            >
                              {tag}
                            </span>
                          ))}
                          {photo.suggestedTags.length > 3 && (
                            <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded">
                              +{photo.suggestedTags.length - 3} more
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Review Panel */}
        <div className="lg:sticky lg:top-6 lg:h-fit">
          {selectedPhoto ? (
            <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-6">
              <h2 className="text-lg font-semibold text-gray-900">Review Photo</h2>

              {/* Photo Preview */}
              <div className="relative">
                <img
                  src={selectedPhoto.url}
                  alt="Review"
                  className="w-full rounded-lg"
                />
              </div>

              {/* AI Suggested Tags */}
              {selectedPhoto.suggestedTags && selectedPhoto.suggestedTags.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center space-x-2">
                    <Sparkles className="w-4 h-4 text-purple-600" />
                    <span>AI Suggested Tags</span>
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {selectedPhoto.suggestedTags.map((tag) => (
                      <span
                        key={tag}
                        className="px-3 py-1 bg-purple-100 text-purple-700 text-sm rounded-full"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Quality Score */}
              <div>
                <label className="text-sm font-semibold text-gray-700 mb-2 block">
                  Quality Score: {editingScore}/10
                </label>
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={editingScore}
                  onChange={(e) => setEditingScore(parseInt(e.target.value))}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>Poor</span>
                  <span>Excellent</span>
                </div>
              </div>

              {/* Tag Selection */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-2">Select Tags</h3>

                {/* Product Types */}
                <div className="mb-4">
                  <p className="text-xs text-gray-600 mb-2">PRODUCT TYPE</p>
                  <div className="flex flex-wrap gap-2">
                    {TAG_CATEGORIES.productType.map((tag) => {
                      const isSelected = editingTags.includes(tag);
                      return (
                        <button
                          key={tag}
                          onClick={() => toggleTag(tag)}
                          className={`px-3 py-1 rounded-full text-xs font-medium border-2 transition-colors ${
                            isSelected
                              ? 'bg-blue-600 text-white border-blue-600'
                              : 'bg-white text-blue-600 border-blue-300 hover:border-blue-600'
                          }`}
                        >
                          {tag}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Materials */}
                <div className="mb-4">
                  <p className="text-xs text-gray-600 mb-2">MATERIAL</p>
                  <div className="flex flex-wrap gap-2">
                    {TAG_CATEGORIES.material.map((tag) => {
                      const isSelected = editingTags.includes(tag);
                      return (
                        <button
                          key={tag}
                          onClick={() => toggleTag(tag)}
                          className={`px-3 py-1 rounded-full text-xs font-medium border-2 transition-colors ${
                            isSelected
                              ? 'bg-blue-600 text-white border-blue-600'
                              : 'bg-white text-blue-600 border-blue-300 hover:border-blue-600'
                          }`}
                        >
                          {tag}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Styles */}
                <div>
                  <p className="text-xs text-gray-600 mb-2">STYLE</p>
                  <div className="flex flex-wrap gap-2">
                    {TAG_CATEGORIES.style.map((tag) => {
                      const isSelected = editingTags.includes(tag);
                      return (
                        <button
                          key={tag}
                          onClick={() => toggleTag(tag)}
                          className={`px-3 py-1 rounded-full text-xs font-medium border-2 transition-colors ${
                            isSelected
                              ? 'bg-blue-600 text-white border-blue-600'
                              : 'bg-white text-blue-600 border-blue-300 hover:border-blue-600'
                          }`}
                        >
                          {tag}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Review Notes */}
              <div>
                <label className="text-sm font-semibold text-gray-700 mb-2 block">
                  Review Notes (Optional)
                </label>
                <textarea
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  placeholder="Add any notes about this photo..."
                  className="w-full border border-gray-300 rounded-lg p-3 text-sm h-24 resize-none"
                />
              </div>

              {/* Action Buttons */}
              <div className="space-y-2 pt-4 border-t border-gray-200">
                <button
                  onClick={handlePublish}
                  disabled={loading || editingTags.length === 0}
                  className="w-full bg-green-600 text-white p-3 rounded-lg font-semibold flex items-center justify-center space-x-2 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Check className="w-5 h-5" />
                  <span>Publish to Gallery</span>
                </button>

                <button
                  onClick={handleSaveDraft}
                  disabled={loading}
                  className="w-full bg-blue-600 text-white p-3 rounded-lg font-semibold flex items-center justify-center space-x-2 hover:bg-blue-700 disabled:opacity-50"
                >
                  <Save className="w-5 h-5" />
                  <span>Save as Draft</span>
                </button>

                <button
                  onClick={handleDiscard}
                  disabled={loading}
                  className="w-full bg-red-600 text-white p-3 rounded-lg font-semibold flex items-center justify-center space-x-2 hover:bg-red-700 disabled:opacity-50"
                >
                  <Trash2 className="w-5 h-5" />
                  <span>Archive Photo</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
              <Sparkles className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">Select a photo to review</p>
              <p className="text-sm text-gray-400 mt-1">
                Choose a photo from the list to start reviewing
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PhotoReviewQueue;
