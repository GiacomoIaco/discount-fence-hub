// Photo Gallery Types and Utilities

export interface Photo {
  id: string;
  url: string;
  thumbnailUrl?: string;
  uploadedBy: string;
  uploadedAt: string;
  tags: string[];
  isFavorite: boolean;
  likes: number;
  status: 'pending' | 'saved' | 'published' | 'archived';
  suggestedTags?: string[];
  qualityScore?: number;
  confidenceScore?: number;
  reviewedBy?: string;
  reviewedAt?: string;
  reviewNotes?: string;
  clientSelections?: Array<{
    sessionId: string;
    selectedAt: string;
  }>;
}

export const TAG_CATEGORIES = {
  productType: [
    'Wood Vertical Fence',
    'Wood Horizontal Fence',
    'Iron Fence',
    'Farm/Ranch Style Fence',
    'Vinyl Fence',
    'Aluminum & Composite Fence',
    'Chain Link',
    'Railing',
    'Automatic Gates',
    'Retaining Wall',
    'Decks',
    'Pergola'
  ],
  material: [
    'Wood',
    'Iron',
    'Aluminum',
    'Composite',
    'Vinyl',
    'Glass',
    'Cable'
  ],
  style: [
    'Shadow Box',
    'Board on Board',
    'Exposed Post',
    'Cap & Trim',
    'Good Neighbor',
    'Stained'
  ]
} as const;

export interface FilterState {
  productTypes: string[];
  materials: string[];
  styles: string[];
  showFavorites: boolean;
  showLiked: boolean;
}

/**
 * Resize image to max width while maintaining aspect ratio
 */
export async function resizeImage(
  file: File,
  maxWidth: number,
  quality: number = 0.85
): Promise<{ blob: Blob; dataUrl: string }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();

    reader.onload = (e) => {
      img.src = e.target?.result as string;
    };

    reader.onerror = reject;

    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;

      if (width > maxWidth) {
        height = (height * maxWidth) / width;
        width = maxWidth;
      }

      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Failed to get canvas context'));
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('Failed to create blob'));
            return;
          }
          const dataUrl = canvas.toDataURL('image/jpeg', quality);
          resolve({ blob, dataUrl });
        },
        'image/jpeg',
        quality
      );
    };

    img.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Convert image file to base64 for AI analysis
 */
export async function imageToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Filter photos based on filter state
 */
export function filterPhotos(photos: Photo[], filters: FilterState): Photo[] {
  return photos.filter((photo) => {
    // Favorites filter
    if (filters.showFavorites && !photo.isFavorite) {
      return false;
    }

    // Liked filter
    if (filters.showLiked && photo.likes === 0) {
      return false;
    }

    // Tag filters (AND logic across categories, OR within categories)
    const hasProductType =
      filters.productTypes.length === 0 ||
      filters.productTypes.some((tag) => photo.tags.includes(tag));

    const hasMaterial =
      filters.materials.length === 0 ||
      filters.materials.some((tag) => photo.tags.includes(tag));

    const hasStyle =
      filters.styles.length === 0 ||
      filters.styles.some((tag) => photo.tags.includes(tag));

    return hasProductType && hasMaterial && hasStyle;
  });
}

/**
 * Get active filter count
 */
export function getActiveFilterCount(filters: FilterState): number {
  return (
    filters.productTypes.length +
    filters.materials.length +
    filters.styles.length +
    (filters.showFavorites ? 1 : 0) +
    (filters.showLiked ? 1 : 0)
  );
}

/**
 * Get tag count for a specific tag across photos
 */
export function getTagCount(photos: Photo[], tag: string): number {
  return photos.filter((photo) => photo.tags.includes(tag)).length;
}

/**
 * Generate a random session ID for client selections
 */
export function generateSessionId(): string {
  return `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Add photo to client selections
 */
export function addToClientSelection(photo: Photo, sessionId: string): Photo {
  const selections = photo.clientSelections || [];

  // Check if already selected in this session
  if (selections.some((s) => s.sessionId === sessionId)) {
    return photo;
  }

  return {
    ...photo,
    clientSelections: [
      ...selections,
      {
        sessionId,
        selectedAt: new Date().toISOString(),
      },
    ],
  };
}

/**
 * Remove photo from client selections
 */
export function removeFromClientSelection(photo: Photo, sessionId: string): Photo {
  return {
    ...photo,
    clientSelections: (photo.clientSelections || []).filter(
      (s) => s.sessionId !== sessionId
    ),
  };
}

/**
 * Check if photo is selected in current session
 */
export function isSelectedInSession(photo: Photo, sessionId: string): boolean {
  return (photo.clientSelections || []).some((s) => s.sessionId === sessionId);
}
