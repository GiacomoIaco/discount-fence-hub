/**
 * AI Coach Feature - Public API
 *
 * This feature provides AI-powered sales call coaching:
 * - Record and analyze sales meetings
 * - Get AI feedback on sales performance
 * - Team leaderboard and rankings
 * - Manager reviews and ratings
 * - Offline mode support
 *
 * IMPORTANT: Only export what should be accessible from outside this feature.
 */

// ============================================================================
// MAIN COMPONENTS (for other features to use)
// ============================================================================

export { default as SalesCoach } from './SalesCoach';
export { default as SalesCoachAdmin } from './components/SalesCoachAdmin';

// ============================================================================
// INTERNAL - DO NOT EXPORT
// ============================================================================

// ❌ DO NOT export: Internal recording types
// ❌ DO NOT export: Internal state management
//
// These are implementation details and should remain private to this feature.
