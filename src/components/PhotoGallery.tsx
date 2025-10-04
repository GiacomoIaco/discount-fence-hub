import { useState, useRef, useEffect } from 'react';
import {
  ArrowLeft,
  Camera,
  Image as ImageIcon,
  Filter,
  X,
  Star,
  Heart,
  ChevronLeft,
  ChevronRight,
  Flag,
  Sparkles,
  Trash2,
  Check,
  Save,
} from 'lucide-react';
import type { Photo, FilterState } from '../lib/photos';
import {
  TAG_CATEGORIES,
  filterPhotos,
  getActiveFilterCount,
  getTagCount,
  resizeImage,
  imageToBase64,
  generateSessionId,
  addToClientSelection,
  removeFromClientSelection,
  isSelectedInSession,
} from '../lib/photos';
import { supabase } from '../lib/supabase';

interface PhotoGalleryProps {
  onBack: () => void;
  userRole?: 'sales' | 'operations' | 'sales-manager' | 'admin';
  viewMode?: 'mobile' | 'desktop';
}

type GalleryTab = 'gallery' | 'pending' | 'saved' | 'archived';

const PhotoGallery = ({ onBack, userRole = 'sales', viewMode = 'mobile' }: PhotoGalleryProps) => {
  const [activeTab, setActiveTab] = useState<GalleryTab>('gallery');
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [filteredPhotos, setFilteredPhotos] = useState<Photo[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(-1);
  const [showFilters, setShowFilters] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [filters, setFilters] = useState<FilterState>({
    productTypes: [],
    materials: [],
    styles: [],
    showFavorites: false,
    showLiked: false,
  });
  const [sessionId] = useState(() => generateSessionId());
  const [uploading, setUploading] = useState(false);

  // Review modal state (for Pending Review tab)
  const [reviewingPhoto, setReviewingPhoto] = useState<Photo | null>(null);
  const [editingTags, setEditingTags] = useState<string[]>([]);
  const [editingScore, setEditingScore] = useState<number>(5);
  const [reviewNotes, setReviewNotes] = useState('');
  const [reviewLoading, setReviewLoading] = useState(false);
  const [uploaderName, setUploaderName] = useState<string>('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Load photos from Supabase
  useEffect(() => {
    loadPhotos();
  }, [userRole, activeTab, viewMode]);

  // Apply filters whenever photos or filters change
  useEffect(() => {
    const filtered = filterPhotos(photos, filters);
    setFilteredPhotos(filtered);
  }, [photos, filters]);

  const mapSupabaseToPhoto = (dbPhoto: any): Photo => {
    return {
      id: dbPhoto.id,
      url: dbPhoto.url,
      thumbnailUrl: dbPhoto.thumbnail_url,
      uploadedBy: dbPhoto.uploaded_by,
      uploadedAt: dbPhoto.uploaded_at,
      tags: dbPhoto.tags || [],
      isFavorite: dbPhoto.is_favorite || false,
      likes: dbPhoto.likes || 0,
      status: dbPhoto.status || 'pending',
      suggestedTags: dbPhoto.suggested_tags,
      qualityScore: dbPhoto.quality_score,
      reviewedBy: dbPhoto.reviewed_by,
      reviewedAt: dbPhoto.reviewed_at,
      reviewNotes: dbPhoto.review_notes,
      clientSelections: dbPhoto.client_selections || [],
    };
  };

  const loadPhotos = async () => {
    try {
      const userId = localStorage.getItem('userId') || '00000000-0000-0000-0000-000000000001';

      let query = supabase
        .from('photos')
        .select('*')
        .order('uploaded_at', { ascending: false });

      // Filter based on active tab
      switch (activeTab) {
        case 'gallery':
          // Gallery tab: Published photos + user's own pending photos
          query = query.or(`status.eq.published,uploaded_by.eq.${userId}`);
          break;
        case 'pending':
          // Pending Review tab: ALL pending photos (for managers/admins to review)
          query = query.eq('status', 'pending');
          break;
        case 'saved':
          // Saved tab: Pending with review notes (draft reviews)
          query = query.eq('status', 'pending').not('review_notes', 'is', null);
          break;
        case 'archived':
          // Archived tab: All archived photos
          query = query.eq('status', 'archived');
          break;
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error loading photos:', error);
        // Fallback to localStorage for demo
        loadPhotosFromLocalStorage();
        return;
      }

      if (data) {
        const mappedPhotos = data.map(mapSupabaseToPhoto);
        setPhotos(mappedPhotos);
      }
    } catch (error) {
      console.error('Error loading photos:', error);
      loadPhotosFromLocalStorage();
    }
  };

  const loadPhotosFromLocalStorage = () => {
    const savedPhotos = localStorage.getItem('photoGallery');
    if (savedPhotos) {
      try {
        const parsed = JSON.parse(savedPhotos);
        setPhotos(parsed);
      } catch (e) {
        console.error('Error parsing saved photos:', e);
      }
    }
  };

  const handleUploadClick = () => {
    setShowUploadModal(true);
  };

  const handleTakePhoto = () => {
    setShowUploadModal(false);
    cameraInputRef.current?.click();
  };

  const handleChooseFromLibrary = () => {
    setShowUploadModal(false);
    fileInputRef.current?.click();
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>, _isCamera: boolean) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);

    try {
      const userId = localStorage.getItem('userId') || '00000000-0000-0000-0000-000000000001';

      for (const file of Array.from(files)) {
        // Resize for full image (max 1920px)
        const full = await resizeImage(file, 1920, 0.85);

        // Create thumbnail (max 300px)
        const thumb = await resizeImage(file, 300, 0.80);

        // Get base64 for AI analysis
        const base64 = await imageToBase64(file);

        // Call AI analysis function
        let suggestedTags: string[] = [];
        let qualityScore: number | undefined;

        try {
          console.log('Calling AI photo analysis...');
          const analysisResponse = await fetch('/.netlify/functions/analyze-photo', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ imageBase64: base64 }),
          });

          if (analysisResponse.ok) {
            const analysis = await analysisResponse.json();
            suggestedTags = analysis.suggestedTags || [];
            qualityScore = analysis.qualityScore;
            console.log('AI analysis complete:', { suggestedTags, qualityScore, notes: analysis.analysisNotes });
          } else {
            const errorText = await analysisResponse.text();
            console.error('AI analysis HTTP error:', analysisResponse.status, errorText);
          }
        } catch (error) {
          console.error('AI analysis failed:', error);
        }

        // Generate a UUID v4 for the photo ID
        const generateUUID = () => {
          return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
          });
        };

        // Create photo object
        const newPhoto: Photo = {
          id: generateUUID(),
          url: full.dataUrl,
          thumbnailUrl: thumb.dataUrl,
          uploadedBy: userId,
          uploadedAt: new Date().toISOString(),
          tags: suggestedTags,
          isFavorite: false,
          likes: 0,
          status: 'pending',
          suggestedTags,
          qualityScore,
        };

        // Upload to Supabase Storage (photos bucket)
        const fileName = `${userId}/full/${newPhoto.id}.jpg`;
        const thumbFileName = `${userId}/thumb/${newPhoto.id}.jpg`;

        try {
          console.log('Uploading to Supabase storage:', fileName);

          // Upload full-size image
          const { error: uploadError } = await supabase.storage
            .from('photos')
            .upload(fileName, full.blob, {
              contentType: 'image/jpeg',
              upsert: false
            });

          if (uploadError) {
            console.error('Storage upload error (full):', uploadError);
            throw uploadError;
          }

          console.log('Full image uploaded successfully');

          // Upload thumbnail
          const { error: thumbError } = await supabase.storage
            .from('photos')
            .upload(thumbFileName, thumb.blob, {
              contentType: 'image/jpeg',
              upsert: false
            });

          if (thumbError) {
            console.error('Storage upload error (thumb):', thumbError);
            throw thumbError;
          }

          console.log('Thumbnail uploaded successfully');

          // Get public URLs
          const { data: fullUrlData } = supabase.storage
            .from('photos')
            .getPublicUrl(fileName);

          const { data: thumbUrlData } = supabase.storage
            .from('photos')
            .getPublicUrl(thumbFileName);

          // Update photo object with storage URLs
          newPhoto.url = fullUrlData.publicUrl;
          newPhoto.thumbnailUrl = thumbUrlData.publicUrl;

          // Save metadata to database
          console.log('Saving photo metadata to database...');
          // Convert camelCase to snake_case for Supabase
          const dbPhoto = {
            id: newPhoto.id,
            url: newPhoto.url,
            thumbnail_url: newPhoto.thumbnailUrl,
            uploaded_by: newPhoto.uploadedBy,
            uploaded_at: newPhoto.uploadedAt,
            tags: newPhoto.tags,
            is_favorite: newPhoto.isFavorite,
            likes: newPhoto.likes,
            status: newPhoto.status,
            suggested_tags: newPhoto.suggestedTags,
            quality_score: newPhoto.qualityScore,
          };
          const { data, error } = await supabase
            .from('photos')
            .insert([dbPhoto])
            .select()
            .single();

          if (error) {
            console.error('Database insert error:', error);
            alert(`DB Error: ${error.message || JSON.stringify(error)}`);
            throw error;
          }

          console.log('Photo saved to Supabase successfully!', data);

          if (data) {
            setPhotos((prev) => [data as Photo, ...prev]);
          }
        } catch (error) {
          console.error('Error saving to Supabase:', error);
          console.log('Falling back to localStorage...');
          // Fallback to localStorage with base64 data URLs
          setPhotos((prev) => {
            const updated = [newPhoto, ...prev];
            localStorage.setItem('photoGallery', JSON.stringify(updated));
            console.log('Photo saved to localStorage as fallback');
            return updated;
          });
        }
      }
    } catch (error) {
      console.error('Error uploading photos:', error);
      alert('Failed to upload photos. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const toggleFavorite = async (photo: Photo) => {
    const updated = { ...photo, isFavorite: !photo.isFavorite };

    try {
      const { error } = await supabase
        .from('photos')
        .update({ is_favorite: updated.isFavorite })
        .eq('id', photo.id);

      if (error) throw error;

      setPhotos((prev) =>
        prev.map((p) => (p.id === photo.id ? updated : p))
      );
    } catch (error) {
      console.error('Error updating favorite:', error);
      // Fallback to localStorage
      setPhotos((prev) => {
        const updatedPhotos = prev.map((p) => (p.id === photo.id ? updated : p));
        localStorage.setItem('photoGallery', JSON.stringify(updatedPhotos));
        return updatedPhotos;
      });
    }
  };

  const toggleLike = async (photo: Photo) => {
    const updated = { ...photo, likes: photo.likes > 0 ? 0 : 1 };

    try {
      const { error } = await supabase
        .from('photos')
        .update({ likes: updated.likes })
        .eq('id', photo.id);

      if (error) throw error;

      setPhotos((prev) =>
        prev.map((p) => (p.id === photo.id ? updated : p))
      );
    } catch (error) {
      console.error('Error updating likes:', error);
      setPhotos((prev) => {
        const updatedPhotos = prev.map((p) => (p.id === photo.id ? updated : p));
        localStorage.setItem('photoGallery', JSON.stringify(updatedPhotos));
        return updatedPhotos;
      });
    }
  };

  const toggleClientSelection = async (photo: Photo) => {
    const isSelected = isSelectedInSession(photo, sessionId);
    const updated = isSelected
      ? removeFromClientSelection(photo, sessionId)
      : addToClientSelection(photo, sessionId);

    try {
      const { error } = await supabase
        .from('photos')
        .update({ client_selections: updated.clientSelections })
        .eq('id', photo.id);

      if (error) throw error;

      setPhotos((prev) =>
        prev.map((p) => (p.id === photo.id ? updated : p))
      );
    } catch (error) {
      console.error('Error updating client selection:', error);
      setPhotos((prev) => {
        const updatedPhotos = prev.map((p) => (p.id === photo.id ? updated : p));
        localStorage.setItem('photoGallery', JSON.stringify(updatedPhotos));
        return updatedPhotos;
      });
    }
  };

  const deletePhoto = async (photo: Photo, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent opening full-screen viewer

    if (!confirm('Delete this photo? This cannot be undone.')) {
      return;
    }

    try {
      const userId = localStorage.getItem('userId') || '00000000-0000-0000-0000-000000000001';

      // Delete from storage
      const fileName = `${userId}/full/${photo.id}.jpg`;
      const thumbFileName = `${userId}/thumb/${photo.id}.jpg`;

      const { error: fullDeleteError } = await supabase.storage
        .from('photos')
        .remove([fileName]);

      if (fullDeleteError) {
        console.error('Error deleting full image:', fullDeleteError);
      }

      const { error: thumbDeleteError } = await supabase.storage
        .from('photos')
        .remove([thumbFileName]);

      if (thumbDeleteError) {
        console.error('Error deleting thumbnail:', thumbDeleteError);
      }

      // Delete from database
      const { error: dbError } = await supabase
        .from('photos')
        .delete()
        .eq('id', photo.id);

      if (dbError) throw dbError;

      // Remove from state
      setPhotos((prev) => prev.filter((p) => p.id !== photo.id));
    } catch (error) {
      console.error('Error deleting photo:', error);
      // Fallback to localStorage
      setPhotos((prev) => {
        const updatedPhotos = prev.filter((p) => p.id !== photo.id);
        localStorage.setItem('photoGallery', JSON.stringify(updatedPhotos));
        return updatedPhotos;
      });
    }
  };

  const openFullScreen = async (index: number) => {
    // On Pending Review tab, open review modal instead of full-screen viewer
    if (activeTab === 'pending' && viewMode === 'desktop') {
      const photo = filteredPhotos[index];
      setReviewingPhoto(photo);
      setEditingTags(photo.tags || photo.suggestedTags || []);
      setEditingScore(photo.qualityScore || 5);
      setReviewNotes(photo.reviewNotes || '');

      // Fetch uploader name
      try {
        const { data, error } = await supabase
          .from('sales_reps')
          .select('name')
          .eq('id', photo.uploadedBy)
          .single();

        if (!error && data) {
          setUploaderName(data.name);
        } else {
          setUploaderName('Unknown User');
        }
      } catch (error) {
        console.error('Error fetching uploader name:', error);
        setUploaderName('Unknown User');
      }
    } else {
      setCurrentIndex(index);
    }
  };

  const closeFullScreen = () => {
    setCurrentIndex(-1);
  };

  // Review actions
  const toggleReviewTag = (tag: string) => {
    if (editingTags.includes(tag)) {
      setEditingTags(editingTags.filter((t) => t !== tag));
    } else {
      setEditingTags([...editingTags, tag]);
    }
  };

  const handlePublishPhoto = async () => {
    if (!reviewingPhoto) return;
    setReviewLoading(true);

    try {
      const userId = localStorage.getItem('userId') || '00000000-0000-0000-0000-000000000001';
      const dbUpdate = {
        status: 'published',
        tags: editingTags,
        quality_score: editingScore,
        reviewed_by: userId,
        reviewed_at: new Date().toISOString(),
        review_notes: reviewNotes,
      };

      const { error } = await supabase
        .from('photos')
        .update(dbUpdate)
        .eq('id', reviewingPhoto.id);

      if (error) throw error;

      // Remove from photos list and close modal
      setPhotos((prev) => prev.filter((p) => p.id !== reviewingPhoto.id));
      setReviewingPhoto(null);
      alert('Photo published successfully!');
    } catch (error) {
      console.error('Error publishing photo:', error);
      alert('Failed to publish photo. Please try again.');
    } finally {
      setReviewLoading(false);
    }
  };

  const handleSaveDraft = async () => {
    if (!reviewingPhoto) return;
    setReviewLoading(true);

    try {
      const userId = localStorage.getItem('userId') || '00000000-0000-0000-0000-000000000001';
      const dbUpdate = {
        tags: editingTags,
        quality_score: editingScore,
        reviewed_by: userId,
        reviewed_at: new Date().toISOString(),
        review_notes: reviewNotes,
      };

      const { error } = await supabase
        .from('photos')
        .update(dbUpdate)
        .eq('id', reviewingPhoto.id);

      if (error) throw error;

      // Update in photos list
      setPhotos((prev) =>
        prev.map((p) =>
          p.id === reviewingPhoto.id
            ? { ...p, tags: editingTags, qualityScore: editingScore, reviewNotes }
            : p
        )
      );
      setReviewingPhoto(null);
      alert('Draft saved successfully!');
    } catch (error) {
      console.error('Error saving draft:', error);
      alert('Failed to save draft. Please try again.');
    } finally {
      setReviewLoading(false);
    }
  };

  const handleArchivePhoto = async () => {
    if (!reviewingPhoto) return;
    if (!confirm('Archive this photo? It will no longer be visible in the gallery.')) return;

    setReviewLoading(true);

    try {
      const userId = localStorage.getItem('userId') || '00000000-0000-0000-0000-000000000001';
      const dbUpdate = {
        status: 'archived',
        reviewed_by: userId,
        reviewed_at: new Date().toISOString(),
        review_notes: reviewNotes || 'Archived by reviewer',
      };

      const { error } = await supabase
        .from('photos')
        .update(dbUpdate)
        .eq('id', reviewingPhoto.id);

      if (error) throw error;

      // Remove from photos list and close modal
      setPhotos((prev) => prev.filter((p) => p.id !== reviewingPhoto.id));
      setReviewingPhoto(null);
      alert('Photo archived.');
    } catch (error) {
      console.error('Error archiving photo:', error);
      alert('Failed to archive photo. Please try again.');
    } finally {
      setReviewLoading(false);
    }
  };

  const navigatePhoto = (direction: 'prev' | 'next') => {
    if (direction === 'prev') {
      setCurrentIndex((prev) => (prev > 0 ? prev - 1 : filteredPhotos.length - 1));
    } else {
      setCurrentIndex((prev) => (prev < filteredPhotos.length - 1 ? prev + 1 : 0));
    }
  };

  const toggleFilter = (category: keyof FilterState, value: string | boolean) => {
    setFilters((prev) => {
      if (category === 'showFavorites' || category === 'showLiked') {
        return { ...prev, [category]: !prev[category] };
      }

      const currentValues = prev[category] as string[];
      const newValues = currentValues.includes(value as string)
        ? currentValues.filter((v) => v !== value)
        : [...currentValues, value as string];

      return { ...prev, [category]: newValues };
    });
  };

  const clearFilters = () => {
    setFilters({
      productTypes: [],
      materials: [],
      styles: [],
      showFavorites: false,
      showLiked: false,
    });
  };

  const activeFilterCount = getActiveFilterCount(filters);
  const currentPhoto = currentIndex >= 0 ? filteredPhotos[currentIndex] : null;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-20">
        <div className="p-4 flex items-center justify-between">
          <button
            onClick={onBack}
            className="text-blue-600 font-medium flex items-center space-x-2"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Back</span>
          </button>

          <div className="text-center flex-1">
            <h1 className="text-xl font-bold text-gray-900">Photo Gallery</h1>
            <p className="text-xs text-gray-600">
              {filteredPhotos.length} {filteredPhotos.length === 1 ? 'photo' : 'photos'}
            </p>
          </div>

          <div className="w-20"></div>
        </div>

        {/* Tabs (Desktop Only) */}
        {viewMode === 'desktop' && (
          <div className="border-t border-gray-200">
            <div className="flex space-x-1 p-2">
              <button
                onClick={() => setActiveTab('gallery')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  activeTab === 'gallery'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Gallery
              </button>
              {(userRole === 'sales-manager' || userRole === 'admin') && (
                <>
                  <button
                    onClick={() => setActiveTab('pending')}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                      activeTab === 'pending'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    Pending Review
                  </button>
                  <button
                    onClick={() => setActiveTab('saved')}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                      activeTab === 'saved'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    Saved
                  </button>
                  <button
                    onClick={() => setActiveTab('archived')}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                      activeTab === 'archived'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    Archived
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Gallery Grid */}
      <div className="p-4 pb-24">
        {filteredPhotos.length === 0 ? (
          <div className="text-center py-16">
            <ImageIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 font-medium">No photos yet</p>
            <p className="text-sm text-gray-400 mt-1">
              {activeFilterCount > 0 ? 'Try adjusting your filters' : 'Tap + to add photos'}
            </p>
          </div>
        ) : (
          <div className={`grid gap-3 ${viewMode === 'mobile' ? 'grid-cols-2' : 'grid-cols-3 md:grid-cols-4'}`}>
            {filteredPhotos.map((photo, index) => (
              <div
                key={photo.id}
                className="relative aspect-square rounded-lg overflow-hidden cursor-pointer"
                onClick={() => openFullScreen(index)}
              >
                <img
                  src={photo.thumbnailUrl || photo.url}
                  alt="Gallery"
                  className="w-full h-full object-cover"
                />
                {photo.isFavorite && (
                  <div className="absolute top-2 left-2">
                    <Star className="w-5 h-5 fill-yellow-400 text-yellow-400" />
                  </div>
                )}
                {photo.likes > 0 && (
                  <div className="absolute top-2 right-2 bg-white/90 rounded-full px-2 py-1 text-xs font-semibold text-red-600 flex items-center space-x-1">
                    <Heart className="w-3 h-3 fill-red-600" />
                    <span>{photo.likes}</span>
                  </div>
                )}
                {photo.status === 'pending' && (
                  <>
                    <div className="absolute bottom-2 left-2 bg-orange-500 text-white text-xs px-2 py-1 rounded">
                      Pending Review
                    </div>
                    <button
                      onClick={(e) => deletePhoto(photo, e)}
                      className="absolute bottom-2 right-2 bg-red-600 text-white p-2 rounded-full shadow-lg active:scale-95 transition-transform"
                      title="Delete photo"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Floating Action Buttons - Only show on Gallery tab or mobile */}
      {(activeTab === 'gallery' || viewMode === 'mobile') && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-white to-transparent pointer-events-none">
          <div className="flex justify-between items-center pointer-events-auto">
            <button
              onClick={() => setShowFilters(true)}
              className="relative bg-white border-2 border-blue-600 text-blue-600 p-4 rounded-full shadow-lg active:scale-95 transition-transform"
            >
              <Filter className="w-6 h-6" />
              {activeFilterCount > 0 && (
                <div className="absolute -top-1 -right-1 bg-red-600 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center font-bold">
                  {activeFilterCount}
                </div>
              )}
            </button>

            <button
              onClick={handleUploadClick}
              disabled={uploading}
              className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-5 rounded-full shadow-lg active:scale-95 transition-transform disabled:opacity-50"
            >
              {uploading ? (
                <Sparkles className="w-7 h-7 animate-spin" />
              ) : (
                <Camera className="w-7 h-7" />
              )}
            </button>
          </div>
        </div>
      )}

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black/50 z-30 flex items-end">
          <div className="bg-white rounded-t-3xl w-full p-6 space-y-3">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-900">Add Photos</h2>
              <button onClick={() => setShowUploadModal(false)}>
                <X className="w-6 h-6 text-gray-600" />
              </button>
            </div>

            <button
              onClick={handleTakePhoto}
              className="w-full bg-gradient-to-r from-blue-600 to-blue-700 text-white p-4 rounded-xl shadow-lg active:scale-98 transition-transform flex items-center justify-center space-x-3"
            >
              <Camera className="w-6 h-6" />
              <span className="font-semibold">Take Photo</span>
            </button>

            <button
              onClick={handleChooseFromLibrary}
              className="w-full bg-white border-2 border-blue-600 text-blue-600 p-4 rounded-xl shadow-sm active:scale-98 transition-transform flex items-center justify-center space-x-3"
            >
              <ImageIcon className="w-6 h-6" />
              <span className="font-semibold">Choose from Library</span>
            </button>
          </div>
        </div>
      )}

      {/* Filter Overlay */}
      {showFilters && (
        <div className="fixed inset-0 bg-white z-30 overflow-y-auto">
          <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex justify-between items-center">
            <h2 className="text-xl font-bold text-gray-900">Filters</h2>
            <div className="flex items-center space-x-4">
              <p className="text-sm text-gray-600 font-medium">
                {filteredPhotos.length} photos match
              </p>
              <button
                onClick={() => setShowFilters(false)}
                className="text-blue-600 font-semibold"
              >
                Apply
              </button>
            </div>
          </div>

          <div className="p-4 space-y-6">
            {/* Product Type */}
            <div>
              <h3 className="font-semibold text-gray-900 mb-3">PRODUCT TYPE</h3>
              <div className="flex flex-wrap gap-2">
                {TAG_CATEGORIES.productType.map((tag) => {
                  const count = getTagCount(photos, tag);
                  const isSelected = filters.productTypes.includes(tag);
                  return (
                    <button
                      key={tag}
                      onClick={() => toggleFilter('productTypes', tag)}
                      className={`px-4 py-2 rounded-full text-sm font-medium border-2 transition-colors ${
                        isSelected
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-white text-blue-600 border-blue-600'
                      }`}
                    >
                      {tag} <span className="opacity-70">({count})</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Material */}
            <div>
              <h3 className="font-semibold text-gray-900 mb-3">MATERIAL</h3>
              <div className="flex flex-wrap gap-2">
                {TAG_CATEGORIES.material.map((tag) => {
                  const count = getTagCount(photos, tag);
                  const isSelected = filters.materials.includes(tag);
                  return (
                    <button
                      key={tag}
                      onClick={() => toggleFilter('materials', tag)}
                      className={`px-4 py-2 rounded-full text-sm font-medium border-2 transition-colors ${
                        isSelected
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-white text-blue-600 border-blue-600'
                      }`}
                    >
                      {tag} <span className="opacity-70">({count})</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Style */}
            <div>
              <h3 className="font-semibold text-gray-900 mb-3">STYLE</h3>
              <div className="flex flex-wrap gap-2">
                {TAG_CATEGORIES.style.map((tag) => {
                  const count = getTagCount(photos, tag);
                  const isSelected = filters.styles.includes(tag);
                  return (
                    <button
                      key={tag}
                      onClick={() => toggleFilter('styles', tag)}
                      className={`px-4 py-2 rounded-full text-sm font-medium border-2 transition-colors ${
                        isSelected
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-white text-blue-600 border-blue-600'
                      }`}
                    >
                      {tag} <span className="opacity-70">({count})</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Special Filters */}
            <div>
              <h3 className="font-semibold text-gray-900 mb-3">SPECIAL</h3>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => toggleFilter('showFavorites', true)}
                  className={`px-4 py-2 rounded-full text-sm font-medium border-2 transition-colors flex items-center space-x-2 ${
                    filters.showFavorites
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-blue-600 border-blue-600'
                  }`}
                >
                  <Star className="w-4 h-4" />
                  <span>Favorites</span>
                </button>

                <button
                  onClick={() => toggleFilter('showLiked', true)}
                  className={`px-4 py-2 rounded-full text-sm font-medium border-2 transition-colors flex items-center space-x-2 ${
                    filters.showLiked
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-blue-600 border-blue-600'
                  }`}
                >
                  <Heart className="w-4 h-4" />
                  <span>Liked</span>
                </button>
              </div>
            </div>

            {/* Clear All */}
            {activeFilterCount > 0 && (
              <button
                onClick={clearFilters}
                className="w-full bg-gray-100 text-gray-700 p-3 rounded-xl font-medium"
              >
                Clear All Filters
              </button>
            )}
          </div>
        </div>
      )}

      {/* Full-Screen Photo Viewer */}
      {currentPhoto && (
        <div className="fixed inset-0 bg-black z-40">
          {/* Top Controls */}
          <div className="absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-black/60 to-transparent z-10 flex justify-between items-start">
            <button
              onClick={() => toggleFavorite(currentPhoto)}
              className="p-2 rounded-full bg-white/20 backdrop-blur-sm"
            >
              <Star
                className={`w-6 h-6 ${
                  currentPhoto.isFavorite ? 'fill-yellow-400 text-yellow-400' : 'text-white'
                }`}
              />
            </button>

            <div className="flex space-x-3">
              <button
                onClick={() => toggleLike(currentPhoto)}
                className="p-2 rounded-full bg-white/20 backdrop-blur-sm flex items-center space-x-2"
              >
                <Heart
                  className={`w-6 h-6 ${
                    currentPhoto.likes > 0 ? 'fill-red-600 text-red-600' : 'text-white'
                  }`}
                />
                {currentPhoto.likes > 0 && (
                  <span className="text-white font-semibold">{currentPhoto.likes}</span>
                )}
              </button>

              <button
                onClick={() => toggleClientSelection(currentPhoto)}
                className="p-2 rounded-full bg-white/20 backdrop-blur-sm"
              >
                <Flag
                  className={`w-6 h-6 ${
                    isSelectedInSession(currentPhoto, sessionId)
                      ? 'fill-blue-400 text-blue-400'
                      : 'text-white'
                  }`}
                />
              </button>

              <button onClick={closeFullScreen} className="p-2 rounded-full bg-white/20 backdrop-blur-sm">
                <X className="w-6 h-6 text-white" />
              </button>
            </div>
          </div>

          {/* Photo */}
          <div className="absolute inset-0 flex items-center justify-center">
            <img
              src={currentPhoto.url}
              alt="Full screen"
              className="max-w-full max-h-full object-contain"
            />
          </div>

          {/* Navigation Arrows */}
          <button
            onClick={() => navigatePhoto('prev')}
            className="absolute left-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-white/20 backdrop-blur-sm"
          >
            <ChevronLeft className="w-6 h-6 text-white" />
          </button>

          <button
            onClick={() => navigatePhoto('next')}
            className="absolute right-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-white/20 backdrop-blur-sm"
          >
            <ChevronRight className="w-6 h-6 text-white" />
          </button>

          {/* Bottom Info */}
          <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/60 to-transparent">
            {currentPhoto.tags.length > 0 && (
              <div className="flex flex-wrap gap-2 justify-center">
                {currentPhoto.tags.map((tag) => (
                  <span
                    key={tag}
                    className="px-3 py-1 bg-white/20 backdrop-blur-sm rounded-full text-white text-sm"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Hidden File Inputs */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={(e) => handleFileSelect(e, false)}
        className="hidden"
      />

      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        onChange={(e) => handleFileSelect(e, true)}
        className="hidden"
      />

      {/* Review Modal (Pending Review tab only) */}
      {reviewingPhoto && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              {/* Header */}
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">Review Photo</h2>
                  <p className="text-sm text-gray-500 mt-1">
                    Uploaded {new Date(reviewingPhoto.uploadedAt).toLocaleDateString()} at{' '}
                    {new Date(reviewingPhoto.uploadedAt).toLocaleTimeString()}
                  </p>
                  <p className="text-sm text-gray-600 font-medium">
                    Submitted by: {uploaderName || 'Loading...'}
                  </p>
                </div>
                <button
                  onClick={() => setReviewingPhoto(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* Photo Preview */}
              <div className="mb-6">
                <img
                  src={reviewingPhoto.url}
                  alt="Review"
                  className="w-full h-96 object-contain bg-gray-100 rounded-lg"
                />
              </div>

              {/* AI Suggestions */}
              {reviewingPhoto.suggestedTags && reviewingPhoto.suggestedTags.length > 0 && (
                <div className="mb-6 p-4 bg-blue-50 rounded-lg">
                  <div className="flex items-center space-x-2 mb-2">
                    <Sparkles className="w-5 h-5 text-blue-600" />
                    <h3 className="font-semibold text-blue-900">AI Suggestions</h3>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {reviewingPhoto.suggestedTags.map((tag) => (
                      <span
                        key={tag}
                        className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                  {reviewingPhoto.qualityScore && (
                    <p className="text-sm text-blue-700 mt-2">
                      Quality Score: {reviewingPhoto.qualityScore}/10
                    </p>
                  )}
                </div>
              )}

              {/* Tag Selection */}
              <div className="mb-6">
                <h3 className="font-semibold text-gray-900 mb-3">Tags</h3>
                {Object.entries(TAG_CATEGORIES).map(([category, tags]) => (
                  <div key={category} className="mb-4">
                    <h4 className="text-sm font-medium text-gray-700 mb-2 capitalize">
                      {category.replace(/([A-Z])/g, ' $1').trim()}
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {tags.map((tag) => (
                        <button
                          key={tag}
                          onClick={() => toggleReviewTag(tag)}
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
                  onChange={(e) => setEditingScore(parseInt(e.target.value))}
                  className="w-full"
                />
              </div>

              {/* Review Notes */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Review Notes
                </label>
                <textarea
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  placeholder="Add notes about this photo..."
                  className="w-full border border-gray-300 rounded-lg p-3 min-h-[100px]"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex space-x-3">
                <button
                  onClick={handlePublishPhoto}
                  disabled={reviewLoading}
                  className="flex-1 bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700 disabled:opacity-50 flex items-center justify-center space-x-2"
                >
                  <Check className="w-5 h-5" />
                  <span>Publish to Gallery</span>
                </button>
                <button
                  onClick={handleSaveDraft}
                  disabled={reviewLoading}
                  className="flex-1 bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center space-x-2"
                >
                  <Save className="w-5 h-5" />
                  <span>Save Draft</span>
                </button>
                <button
                  onClick={handleArchivePhoto}
                  disabled={reviewLoading}
                  className="flex-1 bg-red-600 text-white py-3 rounded-lg font-semibold hover:bg-red-700 disabled:opacity-50 flex items-center justify-center space-x-2"
                >
                  <Trash2 className="w-5 h-5" />
                  <span>Archive</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PhotoGallery;
