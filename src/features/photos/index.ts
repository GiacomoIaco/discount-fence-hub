/**
 * Photo Gallery Feature - Public API
 *
 * IMPORTANT: Only export what should be accessible from outside this feature.
 * Keep all implementation details (components, hooks, utilities) private.
 *
 * When working on Photo Gallery from other features, only import from this file.
 * Example: import { PhotoGalleryRefactored } from '@/features/photos'
 */

// ============================================================================
// MAIN COMPONENT (for routing)
// ============================================================================

export { PhotoGalleryRefactored } from './PhotoGalleryRefactored';

// ============================================================================
// PUBLIC TYPES (if other features need them)
// ============================================================================

// Note: Photo types are currently in src/lib/photos.ts
// If this feature is fully isolated, consider moving types here and re-exporting

// ============================================================================
// INTERNAL - DO NOT EXPORT
// ============================================================================

// ❌ DO NOT export: Individual components (PhotoGrid, PhotoDetailModal, etc.)
// ❌ DO NOT export: Hooks (usePhotoGallery, usePhotoUpload, etc.)
// ❌ DO NOT export: Component/hook barrel exports from subdirectories
//
// These are implementation details and should remain private to this feature.
// If you need to share functionality, create a shared package or refactor.
