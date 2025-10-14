import { useState } from 'react';
import { showError } from '../../../lib/toast';

/**
 * Hook for AI photo enhancement using Gemini 2.5 Flash Image
 * Handles enhancement state and API calls
 */
export function usePhotoEnhance() {
  const [enhancedUrl, setEnhancedUrl] = useState<string | null>(null);
  const [showingEnhanced, setShowingEnhanced] = useState(false);
  const [isEnhancing, setIsEnhancing] = useState(false);

  const enhancePhoto = async (photoUrl: string) => {
    setIsEnhancing(true);

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
      setEnhancedUrl(enhancedDataUrl);
      setShowingEnhanced(true);

      console.log('✅ Photo enhanced with Gemini 2.5 Flash Image');
    } catch (error) {
      console.error('❌ Auto-enhance failed:', error);
      showError(`Failed to enhance photo: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsEnhancing(false);
    }
  };

  const resetEnhancement = () => {
    setEnhancedUrl(null);
    setShowingEnhanced(false);
  };

  const toggleEnhancedView = (show: boolean) => {
    setShowingEnhanced(show);
  };

  return {
    enhancedUrl,
    showingEnhanced,
    isEnhancing,
    enhancePhoto,
    resetEnhancement,
    toggleEnhancedView,
  };
}
