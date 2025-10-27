import { useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { showSuccess, showError, showWarning } from '../../../lib/toast';
import type { Photo } from '../lib/photos';

type FlagReason = 'wrong_tags' | 'poor_quality' | 'needs_enhancement' | 'other';

interface PhotoFlag {
  id: string;
  photo_id: string;
  flag_reason: FlagReason;
  notes?: string;
  suggested_tags?: string[];
  flagged_by: string;
  flagged_by_name: string;
  created_at: string;
  status: 'pending' | 'resolved';
  resolved_by?: string;
  resolved_at?: string;
}

/**
 * Hook for photo flagging functionality
 * Allows users to flag photos for review and managers to view/resolve flags
 */
export function usePhotoFlags(userId?: string, userName?: string, loadPhotos?: () => void) {
  const [showFlagModal, setShowFlagModal] = useState(false);
  const [flaggingPhoto, setFlaggingPhoto] = useState<Photo | null>(null);
  const [flagReason, setFlagReason] = useState<FlagReason>('wrong_tags');
  const [flagNotes, setFlagNotes] = useState('');
  const [flagSuggestedTags, setFlagSuggestedTags] = useState<string[]>([]);

  const [viewingFlags, setViewingFlags] = useState<{ photo: Photo; flags: PhotoFlag[] } | null>(null);
  const [photoFlags, setPhotoFlags] = useState<Map<string, PhotoFlag[]>>(new Map());

  const openFlagModal = (photo: Photo) => {
    setFlaggingPhoto(photo);
    setFlagReason('wrong_tags');
    setFlagNotes('');
    setFlagSuggestedTags([]);
    setShowFlagModal(true);
  };

  const closeFlagModal = () => {
    setShowFlagModal(false);
    setFlaggingPhoto(null);
  };

  const submitFlag = async () => {
    if (!flaggingPhoto || !userId || !userName) return;

    try {
      const { error } = await supabase.from('photo_flags').insert({
        photo_id: flaggingPhoto.id,
        flag_reason: flagReason,
        notes: flagNotes || null,
        suggested_tags: flagSuggestedTags.length > 0 ? flagSuggestedTags : null,
        flagged_by: userId,
        flagged_by_name: userName,
        status: 'pending',
      });

      if (error) throw error;

      showSuccess('Photo flagged for review successfully!');
      closeFlagModal();
    } catch (e: any) {
      console.error('Error flagging photo:', e);
      if (e.code === '23505') {
        showWarning('You have already flagged this photo for review.');
      } else {
        showError('Failed to flag photo. Please try again.');
      }
    }
  };

  const loadPhotoFlags = async (photoIds: string[]) => {
    if (photoIds.length === 0) return;

    try {
      const { data: flags, error } = await supabase
        .from('photo_flags')
        .select('*')
        .in('photo_id', photoIds)
        .eq('status', 'pending');

      if (error) throw error;

      const flagsMap = new Map<string, PhotoFlag[]>();
      flags?.forEach((flag) => {
        const existing = flagsMap.get(flag.photo_id) || [];
        existing.push(flag);
        flagsMap.set(flag.photo_id, existing);
      });
      setPhotoFlags(flagsMap);
    } catch (error) {
      console.error('Error loading photo flags:', error);
    }
  };

  const openViewFlags = (photo: Photo) => {
    const flags = photoFlags.get(photo.id) || [];
    setViewingFlags({ photo, flags });
  };

  const closeViewFlags = () => {
    setViewingFlags(null);
  };

  const resolveFlag = async (flagId: string) => {
    if (!userId) return;

    try {
      const { error } = await supabase
        .from('photo_flags')
        .update({
          status: 'resolved',
          resolved_by: userId,
          resolved_at: new Date().toISOString(),
        })
        .eq('id', flagId);

      if (error) throw error;

      showSuccess('Flag marked as resolved. Photo remains published.');
      closeViewFlags();
      loadPhotos?.();
    } catch (error) {
      console.error('Error resolving flag:', error);
      showError('Failed to resolve flag. Please try again.');
    }
  };

  const dismissFlag = async (flagId: string) => {
    try {
      const { error } = await supabase.from('photo_flags').delete().eq('id', flagId);

      if (error) throw error;

      showSuccess('Flag dismissed successfully.');
      closeViewFlags();
      loadPhotos?.();
    } catch (error) {
      console.error('Error dismissing flag:', error);
      showError('Failed to dismiss flag. Please try again.');
    }
  };

  return {
    // Flag modal state
    showFlagModal,
    flaggingPhoto,
    flagReason,
    setFlagReason,
    flagNotes,
    setFlagNotes,
    flagSuggestedTags,
    setFlagSuggestedTags,
    openFlagModal,
    closeFlagModal,
    submitFlag,

    // View flags state
    viewingFlags,
    photoFlags,
    loadPhotoFlags,
    openViewFlags,
    closeViewFlags,
    resolveFlag,
    dismissFlag,
  };
}
