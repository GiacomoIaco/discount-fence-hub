/**
 * Sales Tools Feature - Public API
 *
 * This feature provides sales productivity tools:
 * - Client Presentations (upload, manage, present)
 * - Stain Calculator (estimate materials and costs)
 * - Presentation viewer with notes
 *
 * IMPORTANT: Only export what should be accessible from outside this feature.
 */

// ============================================================================
// MAIN COMPONENTS (for other features to use)
// ============================================================================

export { default as ClientPresentation } from './components/ClientPresentation';
export { default as StainCalculator } from './components/StainCalculator';

// Internal components (not exported, only used within ClientPresentation)
// - PresentationUpload
// - PresentationViewer

// ============================================================================
// INTERNAL - DO NOT EXPORT
// ============================================================================

// ❌ DO NOT export: PresentationUpload (internal to ClientPresentation)
// ❌ DO NOT export: PresentationViewer (internal to ClientPresentation)
//
// These are implementation details and should remain private to this feature.
