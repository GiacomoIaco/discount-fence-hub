/**
 * Surveys Feature - Public API
 *
 * This feature provides survey creation, rendering, and results functionality.
 * Used by:
 * - Team Communication (Announcements)
 * - Customer Surveys (future)
 *
 * IMPORTANT: Only export what should be accessible from outside this feature.
 */

// ============================================================================
// MAIN COMPONENTS (for other features to use)
// ============================================================================

export { default as SurveyBuilder } from './SurveyBuilder';
export { default as SurveyRenderer } from './components/SurveyRenderer';
export { default as SurveyResponse } from './components/SurveyResponse';
export { default as SurveyResults } from './components/SurveyResults';

// ============================================================================
// TYPES (other features may need these)
// ============================================================================

// Re-export types from SurveyBuilder if needed
export type { SurveyQuestion } from './SurveyBuilder';

// ============================================================================
// INTERNAL - DO NOT EXPORT
// ============================================================================

// ❌ DO NOT export: Internal helpers or utilities
// ❌ DO NOT export: Survey builder internals
//
// These are implementation details and should remain private to this feature.
