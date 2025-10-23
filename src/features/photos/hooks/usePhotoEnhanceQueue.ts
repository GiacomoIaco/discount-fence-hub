import { useState, useRef } from 'react';
import type { EnhancementProgress, EnhancementQueueState, EnhancementCallback } from '../types/enhancement';

/**
 * Hook for managing bulk photo enhancement with queue tracking
 * Handles sequential processing with progress updates
 */
export function usePhotoEnhanceQueue() {
  const [queueState, setQueueState] = useState<EnhancementQueueState>({
    items: [],
    currentIndex: -1,
    isProcessing: false,
    totalCount: 0,
    completedCount: 0,
    errorCount: 0,
  });

  const [showProgressModal, setShowProgressModal] = useState(false);
  const cancelledRef = useRef(false);
  const onCompleteCallbackRef = useRef<EnhancementCallback | null>(null);

  /**
   * Enhance a single photo and return the enhanced URL
   */
  const enhanceSinglePhoto = async (photoUrl: string): Promise<string | null> => {
    try {
      // Convert image URL to base64
      const response = await fetch(photoUrl);
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
      return enhancedDataUrl;
    } catch (error) {
      console.error('❌ Enhancement failed:', error);
      throw error;
    }
  };

  /**
   * Start enhancing a queue of photos
   */
  const startEnhancementQueue = async (
    photos: Array<{ id: string; url: string; fileName?: string }>,
    onComplete?: EnhancementCallback
  ) => {
    cancelledRef.current = false;
    onCompleteCallbackRef.current = onComplete || null;

    // Initialize queue
    const items: EnhancementProgress[] = photos.map((photo) => ({
      photoId: photo.id,
      photoUrl: photo.url,
      fileName: photo.fileName || `Photo ${photo.id.slice(0, 8)}`,
      status: 'pending',
    }));

    setQueueState({
      items,
      currentIndex: -1,
      isProcessing: true,
      totalCount: items.length,
      completedCount: 0,
      errorCount: 0,
    });

    setShowProgressModal(true);

    // Process queue sequentially
    for (let i = 0; i < items.length; i++) {
      if (cancelledRef.current) {
        break;
      }

      const item = items[i];

      // Update current index
      setQueueState((prev) => ({ ...prev, currentIndex: i }));

      // Update item status to enhancing
      setQueueState((prev) => ({
        ...prev,
        items: prev.items.map((it, idx) => (idx === i ? { ...it, status: 'enhancing', startedAt: new Date().toISOString() } : it)),
      }));

      try {
        const enhancedUrl = await enhanceSinglePhoto(item.photoUrl);

        // Update item status to complete
        setQueueState((prev) => ({
          ...prev,
          items: prev.items.map((it, idx) =>
            idx === i
              ? { ...it, status: 'complete', enhancedUrl: enhancedUrl ?? undefined, completedAt: new Date().toISOString() }
              : it
          ),
          completedCount: prev.completedCount + 1,
        }));

        // Call completion callback
        if (onCompleteCallbackRef.current) {
          onCompleteCallbackRef.current(item.photoId, enhancedUrl);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Enhancement failed';

        // Update item status to error
        setQueueState((prev) => ({
          ...prev,
          items: prev.items.map((it, idx) =>
            idx === i
              ? { ...it, status: 'error', error: errorMessage, completedAt: new Date().toISOString() }
              : it
          ),
          errorCount: prev.errorCount + 1,
          completedCount: prev.completedCount + 1, // Count errors as "completed" for progress
        }));

        // Call completion callback with null
        if (onCompleteCallbackRef.current) {
          onCompleteCallbackRef.current(item.photoId, null);
        }
      }

      // Wait 3 seconds between requests to avoid Gemini rate limiting
      // (except after the last photo or if cancelled)
      if (i < items.length - 1 && !cancelledRef.current) {
        await new Promise((resolve) => setTimeout(resolve, 3000));
      }
    }

    // Mark processing as complete
    setQueueState((prev) => ({ ...prev, isProcessing: false, currentIndex: -1 }));
  };

  /**
   * Cancel remaining enhancements
   */
  const cancelQueue = () => {
    cancelledRef.current = true;
    setQueueState((prev) => ({ ...prev, isProcessing: false, currentIndex: -1 }));
  };

  /**
   * Close progress modal
   */
  const closeProgressModal = () => {
    setShowProgressModal(false);
  };

  /**
   * Reset queue state
   */
  const resetQueue = () => {
    setQueueState({
      items: [],
      currentIndex: -1,
      isProcessing: false,
      totalCount: 0,
      completedCount: 0,
      errorCount: 0,
    });
    setShowProgressModal(false);
    cancelledRef.current = false;
  };

  return {
    queueState,
    showProgressModal,
    startEnhancementQueue,
    cancelQueue,
    closeProgressModal,
    resetQueue,
  };
}
