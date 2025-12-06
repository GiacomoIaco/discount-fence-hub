import { useState, useEffect } from 'react';
import type { Photo } from '../lib/photos';
import { generateSessionId } from '../lib/photos';
import { supabase } from '../../../lib/supabase';

type GalleryTab = 'gallery' | 'pending' | 'saved' | 'archived' | 'flagged';

/**
 * Main hook for PhotoGallery state management
 * Coordinates photos list, active tab, and data loading
 */
export function usePhotoGallery(
  userRole: 'sales' | 'operations' | 'sales-manager' | 'admin' | 'yard',
  viewMode: 'mobile' | 'desktop'
) {
  const [activeTab, setActiveTab] = useState<GalleryTab>('gallery');
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(-1);
  const [sessionId] = useState(() => generateSessionId());
  const [loading, setLoading] = useState(true);

  // Load photos from Supabase
  const loadPhotos = async () => {
    setLoading(true);
    try {
      let query = supabase.from('photos').select('*').order('uploaded_at', { ascending: false });

      // Filter by status based on active tab
      switch (activeTab) {
        case 'pending':
          query = query.eq('status', 'pending');
          break;
        case 'saved':
          query = query.eq('status', 'saved');
          break;
        case 'archived':
          query = query.eq('status', 'archived');
          break;
        case 'flagged':
          // Get photos that have flags
          const { data: flagData } = await supabase.from('photo_flags').select('photo_id');
          const flaggedPhotoIds = flagData?.map((f) => f.photo_id) || [];
          if (flaggedPhotoIds.length > 0) {
            query = query.in('id', flaggedPhotoIds);
          } else {
            setPhotos([]);
            setLoading(false);
            return;
          }
          break;
        default:
          // Gallery shows published photos
          query = query.eq('status', 'published');
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error loading photos from Supabase:', error);
        loadPhotosFromLocalStorage();
        return;
      }

      if (data && data.length > 0) {
        console.log(`Loaded ${data.length} photos from Supabase`);
        // Map snake_case to camelCase
        const mappedPhotos = data.map((dbPhoto: any) => ({
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
        }));
        setPhotos(mappedPhotos);
      } else {
        console.log('No photos found in Supabase for this tab');
        // Set empty array instead of falling back to localStorage
        // to respect the status filter
        setPhotos([]);
      }
    } catch (error) {
      console.error('Error loading photos:', error);
      loadPhotosFromLocalStorage();
    } finally {
      setLoading(false);
    }
  };

  const loadPhotosFromLocalStorage = () => {
    const saved = localStorage.getItem('photoGallery');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);

        // Filter by status to match the active tab
        let filteredPhotos = parsed;
        switch (activeTab) {
          case 'pending':
            filteredPhotos = parsed.filter((p: Photo) => p.status === 'pending');
            break;
          case 'saved':
            filteredPhotos = parsed.filter((p: Photo) => p.status === 'saved');
            break;
          case 'archived':
            filteredPhotos = parsed.filter((p: Photo) => p.status === 'archived');
            break;
          case 'gallery':
            filteredPhotos = parsed.filter((p: Photo) => p.status === 'published');
            break;
          case 'flagged':
            // Flagged logic requires database lookup, so skip localStorage fallback
            filteredPhotos = [];
            break;
        }

        setPhotos(filteredPhotos);
      } catch (e) {
        console.error('Error parsing saved photos:', e);
      }
    }
  };

  // Reload photos when tab or role changes
  useEffect(() => {
    loadPhotos();
  }, [userRole, activeTab, viewMode]);

  return {
    activeTab,
    setActiveTab,
    photos,
    setPhotos,
    currentIndex,
    setCurrentIndex,
    sessionId,
    loading,
    loadPhotos,
  };
}
