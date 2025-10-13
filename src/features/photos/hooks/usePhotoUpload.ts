import { useState } from 'react';
import type { Photo } from '../../../lib/photos';
import { resizeImage, imageToBase64 } from '../../../lib/photos';
import { supabase } from '../../../lib/supabase';
import { showError } from '../../../lib/toast';

/**
 * Hook for photo upload with AI analysis
 * Handles file selection, resizing, AI tagging, and upload to Supabase
 */
export function usePhotoUpload(
  userId: string | undefined,
  userName: string | undefined,
  onPhotoAdded: (photo: Photo) => void
) {
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploading, setUploading] = useState(false);

  const uploadPhotos = async (files: FileList | null) => {
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
              notes: analysis.analysisNotes,
            });
          } else {
            const errorText = await analysisResponse.text();
            console.error('❌ AI analysis HTTP error:', {
              status: analysisResponse.status,
              statusText: analysisResponse.statusText,
              error: errorText,
            });
            console.warn('AI tagging unavailable - photo uploaded without suggested tags');
          }
        } catch (error) {
          console.error('❌ AI analysis network error:', error);
          console.warn('AI tagging unavailable - photo uploaded without suggested tags');
        }

        // Generate a UUID v4 for the photo ID
        const generateUUID = () => {
          return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
            const r = (Math.random() * 16) | 0;
            const v = c === 'x' ? r : (r & 0x3) | 0x8;
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
              upsert: false,
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
              upsert: false,
            });

          if (thumbError) {
            console.error('Storage upload error (thumb):', thumbError);
            throw thumbError;
          }

          console.log('Thumbnail uploaded successfully');

          // Get public URLs
          const { data: fullUrlData } = supabase.storage.from('photos').getPublicUrl(fileName);

          const { data: thumbUrlData } = supabase.storage.from('photos').getPublicUrl(thumbFileName);

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
          const { data, error } = await supabase.from('photos').insert([dbPhoto]).select().single();

          if (error) {
            console.error('Database insert error:', error);
            showError(`DB Error: ${error.message || JSON.stringify(error)}`);
            throw error;
          }

          console.log('Photo saved to Supabase successfully!', data);

          if (data) {
            onPhotoAdded(data as Photo);
          }
        } catch (error) {
          console.error('Error saving to Supabase:', error);
          console.log('Falling back to localStorage...');
          // Fallback to localStorage with base64 data URLs
          onPhotoAdded(newPhoto);
        }
      }
    } catch (error) {
      console.error('Error uploading photos:', error);
      showError('Failed to upload photos. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  return {
    showUploadModal,
    setShowUploadModal,
    uploading,
    uploadPhotos,
  };
}
