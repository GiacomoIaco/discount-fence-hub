import { supabase } from './supabase';

/**
 * Image size presets for optimized delivery
 */
type ImageSize = 'thumb' | 'medium' | 'large' | 'original';

interface TransformOptions {
  width: number;
  height: number;
  quality: number;
}

/**
 * Get an optimized image URL from Supabase Storage with automatic WebP conversion
 *
 * @param bucket - The Supabase storage bucket name (e.g., 'photos')
 * @param path - The file path within the bucket
 * @param size - Preset size or 'original' for full resolution
 * @returns Optimized image URL with transform parameters
 *
 * @example
 * // Get thumbnail (200x200, ~20KB)
 * const thumbUrl = getOptimizedImageUrl('photos', 'user123/photo.jpg', 'thumb');
 *
 * // Get medium preview (800x600, ~150KB)
 * const previewUrl = getOptimizedImageUrl('photos', 'user123/photo.jpg', 'medium');
 *
 * // Get full resolution (no optimization)
 * const fullUrl = getOptimizedImageUrl('photos', 'user123/photo.jpg', 'original');
 */
export function getOptimizedImageUrl(
  bucket: string,
  path: string,
  size: ImageSize = 'medium'
): string {
  // Size presets optimized for different use cases
  const sizes: Record<ImageSize, TransformOptions | null> = {
    thumb: { width: 300, height: 300, quality: 80 },      // Gallery thumbnails, ~50-70KB
    medium: { width: 800, height: 600, quality: 80 },     // Preview/lightbox, ~150KB
    large: { width: 1920, height: 1080, quality: 85 },    // Full-screen viewing, ~500KB
    original: null                                          // No transformation, full resolution
  };

  const transform = sizes[size];

  // Return original URL if no transformation requested
  if (!transform) {
    return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
  }

  // Return optimized URL with transform parameters
  return supabase.storage.from(bucket).getPublicUrl(path, {
    transform: {
      ...transform,
      format: 'origin' as any,    // Keep original format (webp not supported by transformation API)
      resize: 'contain'            // Maintain aspect ratio
    }
  }).data.publicUrl;
}

/**
 * Get multiple sizes of the same image for responsive loading
 * Useful for <picture> elements with srcset
 *
 * @example
 * const urls = getResponsiveImageUrls('photos', 'user123/photo.jpg');
 * // Returns: { thumb: '...', medium: '...', large: '...', original: '...' }
 */
export function getResponsiveImageUrls(bucket: string, path: string) {
  return {
    thumb: getOptimizedImageUrl(bucket, path, 'thumb'),
    medium: getOptimizedImageUrl(bucket, path, 'medium'),
    large: getOptimizedImageUrl(bucket, path, 'large'),
    original: getOptimizedImageUrl(bucket, path, 'original')
  };
}
