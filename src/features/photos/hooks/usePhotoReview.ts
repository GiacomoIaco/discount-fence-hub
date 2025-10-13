import { useState } from 'react';
import type { Photo } from '../../../lib/photos';
import { supabase } from '../../../lib/supabase';
import { showError, showSuccess } from '../../../lib/toast';

/**
 * Hook for photo review workflow
 * Handles reviewing pending photos with tagging, scoring, and status changes
 */
export function usePhotoReview(
  userId: string | undefined,
  onPhotosUpdate: () => void,
  enhancedUrl: string | null,
  showingEnhanced: boolean
) {
  const [reviewingPhoto, setReviewingPhoto] = useState<Photo | null>(null);
  const [editingTags, setEditingTags] = useState<string[]>([]);
  const [editingScore, setEditingScore] = useState<number>(5);
  const [reviewNotes, setReviewNotes] = useState('');
  const [reviewLoading, setReviewLoading] = useState(false);
  const [uploaderName, setUploaderName] = useState<string>('');

  const openReviewModal = (photo: Photo) => {
    setReviewingPhoto(photo);
    setEditingTags(photo.tags || photo.suggestedTags || []);
    setEditingScore(photo.qualityScore || 5);
    setReviewNotes(photo.reviewNotes || '');
    setUploaderName(photo.uploaderName || 'Unknown');
  };

  const closeReviewModal = () => {
    setReviewingPhoto(null);
    setEditingTags([]);
    setEditingScore(5);
    setReviewNotes('');
    setUploaderName('');
  };

  const toggleReviewTag = (tag: string) => {
    if (editingTags.includes(tag)) {
      setEditingTags(editingTags.filter((t) => t !== tag));
    } else {
      setEditingTags([...editingTags, tag]);
    }
  };

  const handlePublishPhoto = async () => {
    if (!reviewingPhoto) return;
    if (editingTags.length === 0) return;

    setReviewLoading(true);

    try {
      // If using enhanced version, upload it to replace the original
      if (showingEnhanced && enhancedUrl) {
        const response = await fetch(enhancedUrl);
        const blob = await response.blob();

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

      const { error } = await supabase.from('photos').update(dbUpdate).eq('id', reviewingPhoto.id);

      if (error) {
        console.error('Supabase update error:', error);
        throw error;
      }

      showSuccess('Photo published successfully!');
      onPhotosUpdate();
      closeReviewModal();
    } catch (error) {
      console.error('Error publishing photo:', error);
      const errorMsg = error instanceof Error ? error.message : JSON.stringify(error);
      showError(`Failed to publish photo: ${errorMsg}`);
    } finally {
      setReviewLoading(false);
    }
  };

  const handleSaveDraft = async () => {
    if (!reviewingPhoto) return;
    setReviewLoading(true);

    try {
      const dbUpdate = {
        tags: editingTags,
        quality_score: editingScore,
        reviewed_by: userId,
        reviewed_at: new Date().toISOString(),
        review_notes: reviewNotes || 'Draft - review in progress',
      };

      const { error } = await supabase.from('photos').update(dbUpdate).eq('id', reviewingPhoto.id);

      if (error) throw error;

      showSuccess('Draft saved!');
      onPhotosUpdate();
      closeReviewModal();
    } catch (error) {
      console.error('Error saving draft:', error);
      showError('Failed to save draft. Please try again.');
    } finally {
      setReviewLoading(false);
    }
  };

  const handleSaveNotPublished = async () => {
    if (!reviewingPhoto) return;
    setReviewLoading(true);

    try {
      const dbUpdate = {
        status: 'saved',
        tags: editingTags,
        quality_score: editingScore,
        reviewed_by: userId,
        reviewed_at: new Date().toISOString(),
        review_notes: reviewNotes || 'Reviewed - saved for later',
      };

      const { error } = await supabase.from('photos').update(dbUpdate).eq('id', reviewingPhoto.id);

      if (error) throw error;

      showSuccess('Photo saved for later!');
      onPhotosUpdate();
      closeReviewModal();
    } catch (error) {
      console.error('Error saving photo:', error);
      showError('Failed to save photo. Please try again.');
    } finally {
      setReviewLoading(false);
    }
  };

  const handleUpdateSaved = async () => {
    if (!reviewingPhoto) return;
    setReviewLoading(true);

    try {
      const dbUpdate = {
        tags: editingTags,
        quality_score: editingScore,
        reviewed_by: userId,
        reviewed_at: new Date().toISOString(),
        review_notes: reviewNotes,
      };

      const { error } = await supabase.from('photos').update(dbUpdate).eq('id', reviewingPhoto.id);

      if (error) throw error;

      showSuccess('Photo updated!');
      onPhotosUpdate();
      closeReviewModal();
    } catch (error) {
      console.error('Error updating photo:', error);
      showError('Failed to update photo. Please try again.');
    } finally {
      setReviewLoading(false);
    }
  };

  const handleArchivePhoto = async () => {
    if (!reviewingPhoto) return;

    setReviewLoading(true);

    try {
      const dbUpdate = {
        status: 'archived',
        reviewed_by: userId,
        reviewed_at: new Date().toISOString(),
        review_notes: reviewNotes || 'Archived by reviewer',
      };

      const { error } = await supabase.from('photos').update(dbUpdate).eq('id', reviewingPhoto.id);

      if (error) throw error;

      showSuccess('Photo archived.');
      onPhotosUpdate();
      closeReviewModal();
    } catch (error) {
      console.error('Error archiving photo:', error);
      showError('Failed to archive photo. Please try again.');
    } finally {
      setReviewLoading(false);
    }
  };

  const handlePermanentDelete = async () => {
    if (!reviewingPhoto) return;
    if (
      !confirm(
        'PERMANENTLY DELETE this photo? This cannot be undone and will remove the photo from storage.'
      )
    )
      return;

    setReviewLoading(true);

    try {
      // Delete from storage
      const fileName = `${reviewingPhoto.uploadedBy}/full/${reviewingPhoto.id}.jpg`;
      const thumbFileName = `${reviewingPhoto.uploadedBy}/thumb/${reviewingPhoto.id}.jpg`;

      await supabase.storage.from('photos').remove([fileName, thumbFileName]);

      // Delete from database
      const { error } = await supabase.from('photos').delete().eq('id', reviewingPhoto.id);

      if (error) throw error;

      showSuccess('Photo permanently deleted.');
      onPhotosUpdate();
      closeReviewModal();
    } catch (error) {
      console.error('Error deleting photo:', error);
      showError('Failed to delete photo. Please try again.');
    } finally {
      setReviewLoading(false);
    }
  };

  return {
    reviewingPhoto,
    editingTags,
    setEditingTags,
    editingScore,
    setEditingScore,
    reviewNotes,
    setReviewNotes,
    reviewLoading,
    uploaderName,
    openReviewModal,
    closeReviewModal,
    toggleReviewTag,
    handlePublishPhoto,
    handleSaveDraft,
    handleSaveNotPublished,
    handleUpdateSaved,
    handleArchivePhoto,
    handlePermanentDelete,
  };
}
