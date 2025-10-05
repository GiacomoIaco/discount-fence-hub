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
  CheckSquare,
  Save,
  Settings,
  Plus,
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
  userId?: string;
  userName?: string;
}

type GalleryTab = 'gallery' | 'pending' | 'saved' | 'archived';

const PhotoGallery = ({ onBack, userRole = 'sales', viewMode = 'mobile', userId, userName }: PhotoGalleryProps) => {
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

  // Bulk edit mode
  const [editMode, setEditMode] = useState(false);
  const [selectedPhotoIds, setSelectedPhotoIds] = useState<Set<string>>(new Set());

  // Auto-enhance state
  const [enhancedUrl, setEnhancedUrl] = useState<string | null>(null);
  const [showingEnhanced, setShowingEnhanced] = useState(false);
  const [isEnhancing, setIsEnhancing] = useState(false);

  // Tag management state (Admin only)
  const [showTagManagement, setShowTagManagement] = useState(false);
  const [customTags, setCustomTags] = useState<{
    productType: string[];
    material: string[];
    style: string[];
  }>({ productType: [], material: [], style: [] });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Load custom tags from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('customPhotoTags');
    if (saved) {
      try {
        setCustomTags(JSON.parse(saved));
      } catch (e) {
        console.error('Error loading custom tags:', e);
      }
    }
  }, []);

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
      uploaderName: dbPhoto.uploader_name,
      uploadedAt: dbPhoto.uploaded_at,
      tags: dbPhoto.tags || [],
      isFavorite: dbPhoto.is_favorite || false,
      likes: dbPhoto.likes || 0,
      status: dbPhoto.status || 'pending',
      suggestedTags: dbPhoto.suggested_tags,
      qualityScore: dbPhoto.quality_score,
      confidenceScore: dbPhoto.confidence_score,
      reviewedBy: dbPhoto.reviewed_by,
      reviewedAt: dbPhoto.reviewed_at,
      reviewNotes: dbPhoto.review_notes,
      clientSelections: dbPhoto.client_selections || [],
    };
  };

  const loadPhotos = async () => {
    try {
      const currentUserId = userId || '00000000-0000-0000-0000-000000000001';

      let query = supabase
        .from('photos')
        .select('*')
        .order('uploaded_at', { ascending: false });

      // Filter based on active tab
      switch (activeTab) {
        case 'gallery':
          // Gallery tab: Published photos + user's own pending photos
          query = query.or(`status.eq.published,and(status.eq.pending,uploaded_by.eq.${userId})`);
          break;
        case 'pending':
          // Pending Review tab: ALL pending photos (awaiting first review)
          query = query.eq('status', 'pending');
          break;
        case 'saved':
          // Saved tab: Photos reviewed but not ready to publish
          query = query.eq('status', 'saved');
          break;
        case 'archived':
          // Archived tab: Photos marked for deletion
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
      const uploadUserId = userId || '00000000-0000-0000-0000-000000000001';
      const uploadUserName = userName || 'Unknown User';

      console.log('📸 Photo upload - User info:', { uploadUserId, uploadUserName });

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
        let confidenceScore: number | undefined;

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
            confidenceScore = analysis.confidenceScore;
            console.log('✅ AI analysis complete:', {
              suggestedTags,
              qualityScore,
              confidenceScore,
              notes: analysis.analysisNotes
            });
          } else {
            const errorText = await analysisResponse.text();
            console.error('❌ AI analysis HTTP error:', {
              status: analysisResponse.status,
              statusText: analysisResponse.statusText,
              error: errorText
            });
            // Show user-friendly message
            console.warn('AI tagging unavailable - photo uploaded without suggested tags');
          }
        } catch (error) {
          console.error('❌ AI analysis network error:', error);
          console.warn('AI tagging unavailable - photo uploaded without suggested tags');
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
          uploadedBy: uploadUserId,
          uploaderName: uploadUserName,
          uploadedAt: new Date().toISOString(),
          tags: suggestedTags,
          isFavorite: false,
          likes: 0,
          status: 'pending',
          suggestedTags,
          qualityScore,
          confidenceScore,
        };

        // Upload to Supabase Storage (photos bucket)
        const fileName = `${uploadUserId}/full/${newPhoto.id}.jpg`;
        const thumbFileName = `${uploadUserId}/thumb/${newPhoto.id}.jpg`;

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
            uploader_name: newPhoto.uploaderName,
            uploaded_at: newPhoto.uploadedAt,
            tags: newPhoto.tags,
            is_favorite: newPhoto.isFavorite,
            likes: newPhoto.likes,
            status: newPhoto.status,
            suggested_tags: newPhoto.suggestedTags,
            quality_score: newPhoto.qualityScore,
            confidence_score: newPhoto.confidenceScore,
          };
          console.log('📝 Database insert data:', dbPhoto);
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
      const userId = userId || '00000000-0000-0000-0000-000000000001';

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
    const photo = filteredPhotos[index];

    // On desktop, managers/admins can edit photos from any tab
    const canEdit = viewMode === 'desktop' && (userRole === 'sales-manager' || userRole === 'admin');

    if (canEdit && activeTab !== 'gallery') {
      // Open review modal for Pending/Saved/Archived tabs
      setReviewingPhoto(photo);
      setEditingTags(photo.tags || photo.suggestedTags || []);
      setEditingScore(photo.qualityScore || 5);
      setReviewNotes(photo.reviewNotes || '');

      // Set uploader name from photo object, or fall back to current user if missing
      if (photo.uploaderName) {
        setUploaderName(photo.uploaderName);
      } else if (photo.uploadedBy === userId) {
        // If photo was uploaded by current user but name wasn't stored, use current user's name
        setUploaderName(userName || 'Unknown User');
      } else {
        // Photo uploaded by different user and name not stored
        setUploaderName('Unknown User');
      }
    } else {
      // Gallery tab or non-managers: open full-screen viewer
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
    // Button is disabled if no tags, so this shouldn't happen
    if (editingTags.length === 0) return;

    setReviewLoading(true);

    try {
      const userId = userId || '00000000-0000-0000-0000-000000000001';

      // If using enhanced version, upload it to replace the original
      if (showingEnhanced && enhancedUrl) {
        // Convert data URL to blob
        const response = await fetch(enhancedUrl);
        const blob = await response.blob();

        // Upload to storage (replace existing file) - use photo's original uploader ID
        const fileName = `${reviewingPhoto.uploadedBy}/full/${reviewingPhoto.id}.jpg`;
        const { error: uploadError } = await supabase.storage
          .from('photos')
          .update(fileName, blob, {
            contentType: 'image/jpeg',
            upsert: true,
          });

        if (uploadError) {
          console.error('Error uploading enhanced photo:', uploadError);
          throw new Error(`Failed to save enhanced version: ${uploadError.message}`);
        }
      }

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

      if (error) {
        console.error('Supabase update error:', error);
        throw error;
      }

      // Reload photos and close modal
      await loadPhotos();
      closeReviewModal();
    } catch (error) {
      console.error('Error publishing photo:', error);
      const errorMsg = error instanceof Error ? error.message : JSON.stringify(error);
      alert(`Failed to publish photo: ${errorMsg}`);
    } finally {
      setReviewLoading(false);
    }
  };

  const handleSaveDraft = async () => {
    if (!reviewingPhoto) return;
    setReviewLoading(true);

    try {
      const userId = userId || '00000000-0000-0000-0000-000000000001';
      const dbUpdate = {
        // Keep status as pending - this is an incomplete draft review
        tags: editingTags,
        quality_score: editingScore,
        reviewed_by: userId,
        reviewed_at: new Date().toISOString(),
        review_notes: reviewNotes || 'Draft - review in progress',
      };

      const { error } = await supabase
        .from('photos')
        .update(dbUpdate)
        .eq('id', reviewingPhoto.id);

      if (error) throw error;

      // Update in photos list and close modal
      await loadPhotos();
      closeReviewModal();
    } catch (error) {
      console.error('Error saving draft:', error);
      alert('Failed to save draft. Please try again.');
    } finally {
      setReviewLoading(false);
    }
  };

  const handleSaveNotPublished = async () => {
    if (!reviewingPhoto) return;
    setReviewLoading(true);

    try {
      const userId = userId || '00000000-0000-0000-0000-000000000001';
      const dbUpdate = {
        status: 'saved',
        tags: editingTags,
        quality_score: editingScore,
        reviewed_by: userId,
        reviewed_at: new Date().toISOString(),
        review_notes: reviewNotes || 'Reviewed - saved for later',
      };

      const { error } = await supabase
        .from('photos')
        .update(dbUpdate)
        .eq('id', reviewingPhoto.id);

      if (error) throw error;

      // Update in photos list and close modal
      await loadPhotos();
      closeReviewModal();
    } catch (error) {
      console.error('Error saving photo:', error);
      alert('Failed to save photo. Please try again.');
    } finally {
      setReviewLoading(false);
    }
  };

  const handleUpdateSaved = async () => {
    if (!reviewingPhoto) return;
    setReviewLoading(true);

    try {
      const userId = userId || '00000000-0000-0000-0000-000000000001';
      const dbUpdate = {
        // Keep status as 'saved', just update the metadata
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

      // Update in photos list and close modal
      await loadPhotos();
      closeReviewModal();
    } catch (error) {
      console.error('Error updating photo:', error);
      alert('Failed to update photo. Please try again.');
    } finally {
      setReviewLoading(false);
    }
  };

  const handleArchivePhoto = async () => {
    if (!reviewingPhoto) return;

    setReviewLoading(true);

    try {
      const userId = userId || '00000000-0000-0000-0000-000000000001';
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

      // Reload photos and close modal
      await loadPhotos();
      closeReviewModal();
    } catch (error) {
      console.error('Error archiving photo:', error);
      alert('Failed to archive photo. Please try again.');
    } finally {
      setReviewLoading(false);
    }
  };

  const closeReviewModal = () => {
    setReviewingPhoto(null);
    setEnhancedUrl(null);
    setShowingEnhanced(false);
  };

  const handleAutoEnhance = async () => {
    if (!reviewingPhoto) return;

    setIsEnhancing(true);

    try {
      // Convert image URL to base64
      const response = await fetch(reviewingPhoto.url);
      const blob = await response.blob();
      const base64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64String = (reader.result as string).split(',')[1];
          resolve(base64String);
        };
        reader.readAsDataURL(blob);
      });

      // Call Gemini 2.5 Flash Image API for enhancement
      const apiResponse = await fetch('/.netlify/functions/enhance-photo', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          imageBase64: base64,
        }),
      });

      if (!apiResponse.ok) {
        const error = await apiResponse.json();
        throw new Error(error.details || 'Enhancement failed');
      }

      const { enhancedImageBase64 } = await apiResponse.json();

      // Convert base64 back to data URL
      const enhancedDataUrl = `data:image/jpeg;base64,${enhancedImageBase64}`;
      setEnhancedUrl(enhancedDataUrl);
      setShowingEnhanced(true);

      console.log('✅ Photo enhanced with Gemini 2.5 Flash Image');
    } catch (error) {
      console.error('❌ Auto-enhance failed:', error);
      alert(`Failed to enhance photo: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsEnhancing(false);
    }
  };

  const handlePermanentDelete = async () => {
    if (!reviewingPhoto) return;
    if (!confirm('PERMANENTLY DELETE this photo? This cannot be undone and will remove the photo from storage.')) return;

    setReviewLoading(true);

    try {
      const userId = userId || '00000000-0000-0000-0000-000000000001';

      // Delete from storage
      const fileName = `${userId}/full/${reviewingPhoto.id}.jpg`;
      const thumbFileName = `${userId}/thumb/${reviewingPhoto.id}.jpg`;

      await supabase.storage.from('photos').remove([fileName, thumbFileName]);

      // Delete from database
      const { error } = await supabase
        .from('photos')
        .delete()
        .eq('id', reviewingPhoto.id);

      if (error) throw error;

      // Remove from photos list and close modal
      setPhotos((prev) => prev.filter((p) => p.id !== reviewingPhoto.id));
      setReviewingPhoto(null);
      alert('Photo permanently deleted.');
    } catch (error) {
      console.error('Error deleting photo:', error);
      alert('Failed to delete photo. Please try again.');
    } finally {
      setReviewLoading(false);
    }
  };

  // Bulk edit functions
  const togglePhotoSelection = (photoId: string) => {
    const newSelected = new Set(selectedPhotoIds);
    if (newSelected.has(photoId)) {
      newSelected.delete(photoId);
    } else {
      newSelected.add(photoId);
    }
    setSelectedPhotoIds(newSelected);
  };

  const selectAll = () => {
    const allIds = new Set(filteredPhotos.map((p) => p.id));
    setSelectedPhotoIds(allIds);
  };

  const deselectAll = () => {
    setSelectedPhotoIds(new Set());
  };

  const selectAIRecommended = () => {
    // Select photos with 80%+ confidence score
    const aiRecommended = filteredPhotos
      .filter((p) => p.confidenceScore && p.confidenceScore >= 80)
      .map((p) => p.id);
    setSelectedPhotoIds(new Set(aiRecommended));
  };

  // Get all available tags (built-in + custom)
  const getAllTags = () => {
    return {
      productType: [...TAG_CATEGORIES.productType, ...customTags.productType],
      material: [...TAG_CATEGORIES.material, ...customTags.material],
      style: [...TAG_CATEGORIES.style, ...customTags.style],
    };
  };

  const addCustomTag = (category: 'productType' | 'material' | 'style', tag: string) => {
    const trimmed = tag.trim();
    if (!trimmed) return;

    const allTags = getAllTags();
    // Check if tag already exists (case-insensitive)
    if (allTags[category].some(t => t.toLowerCase() === trimmed.toLowerCase())) {
      alert('This tag already exists!');
      return;
    }

    const updated = {
      ...customTags,
      [category]: [...customTags[category], trimmed],
    };
    setCustomTags(updated);
    localStorage.setItem('customPhotoTags', JSON.stringify(updated));
  };

  const deleteCustomTag = (category: 'productType' | 'material' | 'style', tag: string) => {
    const updated = {
      ...customTags,
      [category]: customTags[category].filter(t => t !== tag),
    };
    setCustomTags(updated);
    localStorage.setItem('customPhotoTags', JSON.stringify(updated));
  };

  const handleBulkStatusChange = async (newStatus: 'published' | 'archived' | 'saved') => {
    if (selectedPhotoIds.size === 0) {
      alert('No photos selected');
      return;
    }

    const statusLabel = newStatus === 'saved' ? 'Saved' : newStatus === 'published' ? 'Published' : 'Archived';
    if (!confirm(`Move ${selectedPhotoIds.size} photo(s) to ${statusLabel}?`)) return;

    try {
      const userId = userId || '00000000-0000-0000-0000-000000000001';

      for (const photoId of selectedPhotoIds) {
        const updateData: any = {
          status: newStatus,
          reviewed_by: userId,
          reviewed_at: new Date().toISOString(),
        };

        // For "Saved", add review_notes placeholder
        if (newStatus === 'saved') {
          updateData.review_notes = 'Bulk moved to saved';
        }

        await supabase
          .from('photos')
          .update(updateData)
          .eq('id', photoId);
      }

      // Reload photos
      await loadPhotos();
      setSelectedPhotoIds(new Set());
      setEditMode(false);
      alert(`Successfully moved ${selectedPhotoIds.size} photo(s) to ${statusLabel}`);
    } catch (error) {
      console.error('Error updating photos:', error);
      alert('Failed to update photos. Please try again.');
    }
  };

  const handleBulkDelete = async () => {
    if (selectedPhotoIds.size === 0) {
      alert('No photos selected');
      return;
    }

    if (!confirm(`PERMANENTLY DELETE ${selectedPhotoIds.size} photo(s)? This cannot be undone.`)) return;

    try {
      for (const photoId of selectedPhotoIds) {
        const photo = photos.find((p) => p.id === photoId);
        if (!photo) continue;

        const userId = userId || '00000000-0000-0000-0000-000000000001';
        const fileName = `${userId}/full/${photoId}.jpg`;
        const thumbFileName = `${userId}/thumb/${photoId}.jpg`;

        await supabase.storage.from('photos').remove([fileName, thumbFileName]);
        await supabase.from('photos').delete().eq('id', photoId);
      }

      // Reload photos
      await loadPhotos();
      setSelectedPhotoIds(new Set());
      setEditMode(false);
      alert(`Successfully deleted ${selectedPhotoIds.size} photo(s)`);
    } catch (error) {
      console.error('Error deleting photos:', error);
      alert('Failed to delete photos. Please try again.');
    }
  };

  const handleBulkEnhance = async () => {
    if (selectedPhotoIds.size === 0) {
      alert('No photos selected');
      return;
    }

    if (!confirm(`Enhance ${selectedPhotoIds.size} photo(s) using Gemini 2.5 Flash Image? This will replace the original photos with enhanced versions.`)) return;

    setIsEnhancing(true);
    const totalPhotos = selectedPhotoIds.size;
    let completed = 0;
    let failed = 0;

    try {
      for (const photoId of selectedPhotoIds) {
        const photo = photos.find((p) => p.id === photoId);
        if (!photo) continue;

        try {
          // Convert image URL to base64
          const response = await fetch(photo.url);
          const blob = await response.blob();
          const base64 = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => {
              const base64String = (reader.result as string).split(',')[1];
              resolve(base64String);
            };
            reader.readAsDataURL(blob);
          });

          // Call Gemini 2.5 Flash Image API for enhancement
          const apiResponse = await fetch('/.netlify/functions/enhance-photo', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              imageBase64: base64,
            }),
          });

          if (!apiResponse.ok) {
            const error = await apiResponse.json();
            throw new Error(error.details || 'Enhancement failed');
          }

          const { enhancedImageBase64 } = await apiResponse.json();

          // Convert base64 to blob
          const enhancedResponse = await fetch(`data:image/jpeg;base64,${enhancedImageBase64}`);
          const enhancedBlob = await enhancedResponse.blob();

          // Upload enhanced photo to replace original - use photo's original uploader ID
          const fileName = `${photo.uploadedBy}/full/${photoId}.jpg`;

          const { error: uploadError } = await supabase.storage
            .from('photos')
            .update(fileName, enhancedBlob, {
              contentType: 'image/jpeg',
              upsert: true,
            });

          if (uploadError) {
            throw new Error(`Failed to save enhanced version: ${uploadError.message}`);
          }

          completed++;
          console.log(`✅ Enhanced photo ${completed}/${totalPhotos}`);
        } catch (error) {
          console.error(`❌ Failed to enhance photo ${photoId}:`, error);
          failed++;
        }
      }

      // Reload photos to show enhanced versions
      await loadPhotos();
      setSelectedPhotoIds(new Set());
      setEditMode(false);

      if (failed === 0) {
        alert(`✅ Successfully enhanced all ${completed} photo(s)!`);
      } else {
        alert(`Enhanced ${completed} photo(s). ${failed} photo(s) failed.`);
      }
    } catch (error) {
      console.error('Bulk enhance error:', error);
      alert('Failed to enhance photos. Please try again.');
    } finally {
      setIsEnhancing(false);
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
            <div className="flex justify-between items-center p-2">
              <div className="flex space-x-1">
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

              {/* Edit/Select Mode Button (for Gallery/Saved/Archived, Managers/Admins only) */}
              {(userRole === 'sales-manager' || userRole === 'admin') && activeTab !== 'pending' && (
                <button
                  onClick={() => {
                    setEditMode(!editMode);
                    if (editMode) {
                      setSelectedPhotoIds(new Set());
                    }
                  }}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center space-x-2 ${
                    editMode
                      ? 'bg-red-600 text-white hover:bg-red-700'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {editMode ? (
                    <>
                      <X className="w-4 h-4" />
                      <span>Cancel</span>
                    </>
                  ) : (
                    <>
                      <CheckSquare className="w-4 h-4" />
                      <span>Select</span>
                    </>
                  )}
                </button>
              )}

              {/* Manage Tags Button (Admin only) */}
              {userRole === 'admin' && (
                <button
                  onClick={() => setShowTagManagement(true)}
                  className="px-4 py-2 rounded-lg font-medium transition-colors flex items-center space-x-2 bg-gray-100 text-gray-700 hover:bg-gray-200"
                >
                  <Settings className="w-4 h-4" />
                  <span>Manage Tags</span>
                </button>
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
                onClick={() => {
                  if (editMode) {
                    togglePhotoSelection(photo.id);
                  } else {
                    openFullScreen(index);
                  }
                }}
              >
                <img
                  src={photo.thumbnailUrl || photo.url}
                  alt="Gallery"
                  className={`w-full h-full object-cover transition-opacity ${
                    editMode && selectedPhotoIds.has(photo.id) ? 'opacity-60' : ''
                  }`}
                />

                {/* Checkbox for edit mode */}
                {editMode && (
                  <div className="absolute top-2 left-2">
                    <div
                      className={`w-6 h-6 rounded border-2 flex items-center justify-center transition-colors ${
                        selectedPhotoIds.has(photo.id)
                          ? 'bg-blue-600 border-blue-600'
                          : 'bg-white border-gray-400'
                      }`}
                    >
                      {selectedPhotoIds.has(photo.id) && (
                        <Check className="w-4 h-4 text-white" />
                      )}
                    </div>
                  </div>
                )}

                {/* Favorite star (only show when not in edit mode) */}
                {!editMode && photo.isFavorite && (
                  <div className="absolute top-2 left-2">
                    <Star className="w-5 h-5 fill-yellow-400 text-yellow-400" />
                  </div>
                )}

                {/* Like count */}
                {photo.likes > 0 && (
                  <div className="absolute top-2 right-2 bg-white/90 rounded-full px-2 py-1 text-xs font-semibold text-red-600 flex items-center space-x-1">
                    <Heart className="w-3 h-3 fill-red-600" />
                    <span>{photo.likes}</span>
                  </div>
                )}

                {/* Confidence Score Badge (only in pending tab with confidence score) */}
                {!editMode && activeTab === 'pending' && photo.confidenceScore !== undefined && (
                  <div className="absolute top-2 left-2">
                    <div
                      className={`text-white text-xs px-2 py-1 rounded font-bold flex items-center space-x-1 ${
                        photo.confidenceScore >= 80
                          ? 'bg-green-600'
                          : photo.confidenceScore >= 60
                          ? 'bg-yellow-600'
                          : 'bg-red-600'
                      }`}
                    >
                      <Sparkles className="w-3 h-3" />
                      <span>{photo.confidenceScore}%</span>
                    </div>
                  </div>
                )}

                {/* Pending badge and delete button (only show when not in edit mode) */}
                {!editMode && photo.status === 'pending' && (
                  <>
                    <div className="absolute bottom-2 left-2 flex flex-col gap-1">
                      {photo.reviewNotes && (
                        <div className="bg-blue-600 text-white text-xs px-2 py-1 rounded font-semibold">
                          DRAFT
                        </div>
                      )}
                      <div className="bg-orange-500 text-white text-xs px-2 py-1 rounded">
                        Pending Review
                      </div>
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

      {/* Bulk Action Bar - Show when in edit mode */}
      {editMode && (
        <div className={`fixed bottom-0 right-0 p-4 bg-white border-t-2 border-gray-300 shadow-lg z-40 ${
          viewMode === 'desktop' ? 'left-64' : 'left-0'
        }`}>
          <div className="max-w-7xl mx-auto">
            {/* Selection count and select all/deselect all */}
            <div className="flex items-center justify-between mb-3">
              <span className="font-semibold text-gray-700">
                {selectedPhotoIds.size} photo{selectedPhotoIds.size !== 1 ? 's' : ''} selected
              </span>
              <div className="flex space-x-2">
                <button
                  onClick={selectAll}
                  className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                >
                  Select All
                </button>
                <span className="text-gray-400">|</span>
                {activeTab === 'pending' && (
                  <>
                    <button
                      onClick={selectAIRecommended}
                      className="text-sm text-green-600 hover:text-green-700 font-medium flex items-center space-x-1"
                    >
                      <Sparkles className="w-3 h-3" />
                      <span>AI Recommended</span>
                    </button>
                    <span className="text-gray-400">|</span>
                  </>
                )}
                <button
                  onClick={deselectAll}
                  className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                >
                  Deselect All
                </button>
              </div>
            </div>

            {/* Bulk action buttons */}
            <div className="flex flex-wrap gap-2">
              {/* Move to Published (not shown when already in Gallery tab) */}
              {activeTab !== 'gallery' && (
                <button
                  onClick={() => handleBulkStatusChange('published')}
                  disabled={selectedPhotoIds.size === 0}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex-1"
                >
                  Move to Published
                </button>
              )}

              {/* Move to Saved (not shown when already in Saved tab) */}
              {activeTab !== 'saved' && (
                <button
                  onClick={() => handleBulkStatusChange('saved')}
                  disabled={selectedPhotoIds.size === 0}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex-1"
                >
                  Move to Saved
                </button>
              )}

              {/* Move to Archived (not shown when already in Archived tab) */}
              {activeTab !== 'archived' && (
                <button
                  onClick={() => handleBulkStatusChange('archived')}
                  disabled={selectedPhotoIds.size === 0}
                  className="px-4 py-2 bg-gray-600 text-white rounded-lg font-medium hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed flex-1"
                >
                  Move to Archived
                </button>
              )}

              {/* Enhance Selected (Admin only) */}
              {userRole === 'admin' && (
                <button
                  onClick={handleBulkEnhance}
                  disabled={selectedPhotoIds.size === 0 || isEnhancing}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex-1 flex items-center justify-center space-x-2"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>{isEnhancing ? 'Enhancing...' : 'Enhance Selected'}</span>
                </button>
              )}

              {/* Delete (Admin only, not shown on Gallery tab) */}
              {userRole === 'admin' && activeTab !== 'gallery' && (
                <button
                  onClick={handleBulkDelete}
                  disabled={selectedPhotoIds.size === 0}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex-1"
                >
                  Delete Permanently
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Floating Action Buttons - Only show on Gallery tab or mobile, and when NOT in edit mode */}
      {!editMode && (activeTab === 'gallery' || viewMode === 'mobile') && (
        <div className={`fixed bottom-0 right-0 p-4 bg-gradient-to-t from-white to-transparent pointer-events-none ${
          viewMode === 'desktop' ? 'left-64' : 'left-0'
        }`}>
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
                {getAllTags().productType.map((tag) => {
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
                {getAllTags().material.map((tag) => {
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
                {getAllTags().style.map((tag) => {
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
          <div className="bg-white rounded-2xl max-w-7xl w-full max-h-[95vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="p-6 border-b border-gray-200 flex justify-between items-start">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Review Photo</h2>
                <p className="text-sm text-gray-500 mt-1">
                  {reviewingPhoto.uploadedAt && !isNaN(new Date(reviewingPhoto.uploadedAt).getTime()) ? (
                    <>
                      Uploaded {new Date(reviewingPhoto.uploadedAt).toLocaleDateString()} at{' '}
                      {new Date(reviewingPhoto.uploadedAt).toLocaleTimeString()}
                    </>
                  ) : (
                    'Upload date unknown'
                  )}
                </p>
                <p className="text-sm text-gray-600 font-medium">
                  Submitted by: {uploaderName || 'Unknown User'}
                </p>
              </div>
              <button
                onClick={closeReviewModal}
                className="text-gray-400 hover:text-gray-600"
              >
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
                      onClick={handleAutoEnhance}
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
                          onClick={() => setShowingEnhanced(false)}
                          className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                            !showingEnhanced
                              ? 'bg-white text-gray-900 shadow-sm'
                              : 'text-gray-600 hover:text-gray-900'
                          }`}
                        >
                          Original
                        </button>
                        <button
                          onClick={() => setShowingEnhanced(true)}
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
                      src={showingEnhanced && enhancedUrl ? enhancedUrl : reviewingPhoto.url}
                      alt="Review"
                      className="max-w-full max-h-[calc(95vh-250px)] object-contain"
                    />
                  </div>
                </div>

                {/* Right: Review Controls */}
                <div className="overflow-y-auto pr-2">

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
                {Object.entries(getAllTags()).map(([category, tags]) => (
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

              {/* Action Buttons - Different per tab */}
              <div className="space-y-3">
                {activeTab === 'pending' && (
                  <>
                    {/* Row 1: Publish and Save (not published) */}
                    <div className="flex space-x-3">
                      <button
                        onClick={handlePublishPhoto}
                        disabled={reviewLoading || editingTags.length === 0}
                        className="flex-1 bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                        title={editingTags.length === 0 ? 'Add at least one tag to publish' : 'Publish photo'}
                      >
                        <Check className="w-5 h-5" />
                        <span>Publish</span>
                      </button>
                      <button
                        onClick={handleSaveNotPublished}
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
                        onClick={handleSaveDraft}
                        disabled={reviewLoading}
                        className="flex-1 bg-gray-500 text-white py-3 rounded-lg font-semibold hover:bg-gray-600 disabled:opacity-50 flex items-center justify-center space-x-2"
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
                  </>
                )}

                {activeTab === 'saved' && (
                  <div className="flex space-x-3">
                    <button
                      onClick={handlePublishPhoto}
                      disabled={reviewLoading || editingTags.length === 0}
                      className="flex-1 bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                      title={editingTags.length === 0 ? 'Add at least one tag to publish' : 'Publish photo'}
                    >
                      <Check className="w-5 h-5" />
                      <span>Publish</span>
                    </button>
                    <button
                      onClick={handleUpdateSaved}
                      disabled={reviewLoading}
                      className="flex-1 bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center space-x-2"
                    >
                      <Save className="w-5 h-5" />
                      <span>Update</span>
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
                )}

                {activeTab === 'archived' && userRole === 'admin' && (
                  <button
                    onClick={handlePermanentDelete}
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
      )}

      {/* Tag Management Modal (Admin only) */}
      {showTagManagement && userRole === 'admin' && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold">Manage Tags</h2>
                <button
                  onClick={() => setShowTagManagement(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <p className="text-gray-600 mb-6">
                Add new tags to each category. Built-in tags cannot be deleted, but custom tags can be removed.
              </p>

              {/* Product Types */}
              <div className="mb-6">
                <h3 className="text-lg font-semibold mb-3 flex items-center space-x-2">
                  <span>Product Types</span>
                  <span className="text-sm text-gray-500 font-normal">
                    ({getAllTags().productType.length} total)
                  </span>
                </h3>

                <AddTagInput
                  onAdd={(tag) => addCustomTag('productType', tag)}
                  placeholder="Add new product type..."
                />

                <div className="mt-3 space-y-2">
                  {TAG_CATEGORIES.productType.map((tag) => (
                    <div key={tag} className="flex items-center justify-between bg-gray-100 px-3 py-2 rounded">
                      <span>{tag}</span>
                      <span className="text-xs text-gray-500">Built-in</span>
                    </div>
                  ))}
                  {customTags.productType.map((tag) => (
                    <div key={tag} className="flex items-center justify-between bg-blue-50 px-3 py-2 rounded">
                      <span className="font-medium">{tag}</span>
                      <button
                        onClick={() => {
                          if (confirm(`Delete custom tag "${tag}"?`)) {
                            deleteCustomTag('productType', tag);
                          }
                        }}
                        className="text-red-600 hover:text-red-700 text-sm"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Materials */}
              <div className="mb-6">
                <h3 className="text-lg font-semibold mb-3 flex items-center space-x-2">
                  <span>Materials</span>
                  <span className="text-sm text-gray-500 font-normal">
                    ({getAllTags().material.length} total)
                  </span>
                </h3>

                <AddTagInput
                  onAdd={(tag) => addCustomTag('material', tag)}
                  placeholder="Add new material..."
                />

                <div className="mt-3 space-y-2">
                  {TAG_CATEGORIES.material.map((tag) => (
                    <div key={tag} className="flex items-center justify-between bg-gray-100 px-3 py-2 rounded">
                      <span>{tag}</span>
                      <span className="text-xs text-gray-500">Built-in</span>
                    </div>
                  ))}
                  {customTags.material.map((tag) => (
                    <div key={tag} className="flex items-center justify-between bg-blue-50 px-3 py-2 rounded">
                      <span className="font-medium">{tag}</span>
                      <button
                        onClick={() => {
                          if (confirm(`Delete custom tag "${tag}"?`)) {
                            deleteCustomTag('material', tag);
                          }
                        }}
                        className="text-red-600 hover:text-red-700 text-sm"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Styles */}
              <div className="mb-6">
                <h3 className="text-lg font-semibold mb-3 flex items-center space-x-2">
                  <span>Styles</span>
                  <span className="text-sm text-gray-500 font-normal">
                    ({getAllTags().style.length} total)
                  </span>
                </h3>

                <AddTagInput
                  onAdd={(tag) => addCustomTag('style', tag)}
                  placeholder="Add new style..."
                />

                <div className="mt-3 space-y-2">
                  {TAG_CATEGORIES.style.map((tag) => (
                    <div key={tag} className="flex items-center justify-between bg-gray-100 px-3 py-2 rounded">
                      <span>{tag}</span>
                      <span className="text-xs text-gray-500">Built-in</span>
                    </div>
                  ))}
                  {customTags.style.map((tag) => (
                    <div key={tag} className="flex items-center justify-between bg-blue-50 px-3 py-2 rounded">
                      <span className="font-medium">{tag}</span>
                      <button
                        onClick={() => {
                          if (confirm(`Delete custom tag "${tag}"?`)) {
                            deleteCustomTag('style', tag);
                          }
                        }}
                        className="text-red-600 hover:text-red-700 text-sm"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  onClick={() => setShowTagManagement(false)}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Helper component for adding tags
const AddTagInput = ({ onAdd, placeholder }: { onAdd: (tag: string) => void; placeholder: string }) => {
  const [value, setValue] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (value.trim()) {
      onAdd(value);
      setValue('');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex space-x-2">
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      <button
        type="submit"
        className="px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 flex items-center space-x-1"
      >
        <Plus className="w-4 h-4" />
        <span>Add</span>
      </button>
    </form>
  );
};

export default PhotoGallery;
