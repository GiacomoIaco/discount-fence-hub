import type { Photo } from '../../../lib/photos';
import {
  addToClientSelection,
  removeFromClientSelection,
  isSelectedInSession,
} from '../../../lib/photos';
import { supabase } from '../../../lib/supabase';
import { showSuccess, showError } from '../../../lib/toast';

/**
 * Hook for photo CRUD actions
 * Handles favorite, like, client selection, and delete operations
 */
export function usePhotoActions(
  sessionId: string,
  userId: string | undefined,
  onPhotoUpdate: (updater: (prev: Photo[]) => Photo[]) => void
) {
  const toggleFavorite = async (photo: Photo) => {
    const updated = { ...photo, isFavorite: !photo.isFavorite };

    try {
      const { error } = await supabase
        .from('photos')
        .update({ is_favorite: updated.isFavorite })
        .eq('id', photo.id);

      if (error) throw error;

      onPhotoUpdate((prev) => prev.map((p) => (p.id === photo.id ? updated : p)));
    } catch (error) {
      console.error('Error updating favorite:', error);
      // Fallback to localStorage
      onPhotoUpdate((prev) => {
        const updatedPhotos = prev.map((p) => (p.id === photo.id ? updated : p));
        localStorage.setItem('photoGallery', JSON.stringify(updatedPhotos));
        return updatedPhotos;
      });
    }
  };

  const toggleLike = async (photo: Photo) => {
    const updated = { ...photo, likes: photo.likes > 0 ? 0 : 1 };

    try {
      const { error } = await supabase.from('photos').update({ likes: updated.likes }).eq('id', photo.id);

      if (error) throw error;

      onPhotoUpdate((prev) => prev.map((p) => (p.id === photo.id ? updated : p)));
    } catch (error) {
      console.error('Error updating likes:', error);
      onPhotoUpdate((prev) => {
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

      onPhotoUpdate((prev) => prev.map((p) => (p.id === photo.id ? updated : p)));
    } catch (error) {
      console.error('Error updating client selection:', error);
      onPhotoUpdate((prev) => {
        const updatedPhotos = prev.map((p) => (p.id === photo.id ? updated : p));
        localStorage.setItem('photoGallery', JSON.stringify(updatedPhotos));
        return updatedPhotos;
      });
    }
  };

  const deletePhoto = async (photo: Photo, e?: React.MouseEvent) => {
    if (e) e.stopPropagation(); // Prevent opening full-screen viewer

    if (!confirm('Delete this photo? This cannot be undone.')) {
      return;
    }

    try {
      // Delete from storage
      const fileName = `${userId}/full/${photo.id}.jpg`;
      const thumbFileName = `${userId}/thumb/${photo.id}.jpg`;

      const { error: fullDeleteError } = await supabase.storage.from('photos').remove([fileName]);

      if (fullDeleteError) {
        console.error('Error deleting full image:', fullDeleteError);
      }

      const { error: thumbDeleteError } = await supabase.storage.from('photos').remove([thumbFileName]);

      if (thumbDeleteError) {
        console.error('Error deleting thumbnail:', thumbDeleteError);
      }

      // Delete from database
      const { error } = await supabase.from('photos').delete().eq('id', photo.id);

      if (error) throw error;

      showSuccess('Photo deleted successfully');
      onPhotoUpdate((prev) => prev.filter((p) => p.id !== photo.id));
    } catch (error) {
      console.error('Error deleting photo:', error);
      showError('Failed to delete photo');
      // Fallback to localStorage
      onPhotoUpdate((prev) => {
        const updatedPhotos = prev.filter((p) => p.id !== photo.id);
        localStorage.setItem('photoGallery', JSON.stringify(updatedPhotos));
        return updatedPhotos;
      });
    }
  };

  return {
    toggleFavorite,
    toggleLike,
    toggleClientSelection,
    deletePhoto,
  };
}
