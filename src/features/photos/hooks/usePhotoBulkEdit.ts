import { useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { showSuccess, showError } from '../../../lib/toast';

/**
 * Hook for managing bulk photo editing
 * Handles selection state and bulk operations (status change, delete, enhance)
 */
export function usePhotoBulkEdit(photos: any[], onPhotosUpdate: () => void) {
  const [editMode, setEditMode] = useState(false);
  const [selectedPhotoIds, setSelectedPhotoIds] = useState<Set<string>>(new Set());

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
    setSelectedPhotoIds(new Set(photos.map((p) => p.id)));
  };

  const deselectAll = () => {
    setSelectedPhotoIds(new Set());
  };

  const handleBulkStatusChange = async (newStatus: 'published' | 'archived' | 'saved') => {
    if (selectedPhotoIds.size === 0) return;

    try {
      const photoIds = Array.from(selectedPhotoIds);

      const updateData: any = {
        status: newStatus,
        reviewed_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('photos')
        .update(updateData)
        .in('id', photoIds);

      if (error) throw error;

      showSuccess(`${selectedPhotoIds.size} photo(s) moved to ${newStatus}`);
      setSelectedPhotoIds(new Set());
      setEditMode(false);
      onPhotosUpdate();
    } catch (error) {
      console.error('Bulk status change error:', error);
      showError('Failed to update photos. Please try again.');
    }
  };

  const handleBulkDelete = async () => {
    if (selectedPhotoIds.size === 0) return;
    if (!confirm(`Are you sure you want to delete ${selectedPhotoIds.size} photo(s)?`)) return;

    try {
      const photoIds = Array.from(selectedPhotoIds);

      const { error } = await supabase.from('photos').delete().in('id', photoIds);

      if (error) throw error;

      showSuccess(`${selectedPhotoIds.size} photo(s) deleted successfully`);
      setSelectedPhotoIds(new Set());
      setEditMode(false);
      onPhotosUpdate();
    } catch (error) {
      console.error('Bulk delete error:', error);
      showError('Failed to delete photos. Please try again.');
    }
  };

  const cancelBulkEdit = () => {
    setEditMode(false);
    setSelectedPhotoIds(new Set());
  };

  return {
    editMode,
    setEditMode,
    selectedPhotoIds,
    togglePhotoSelection,
    selectAll,
    deselectAll,
    handleBulkStatusChange,
    handleBulkDelete,
    cancelBulkEdit,
  };
}
