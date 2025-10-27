/**
 * Settings Feature - Public API
 *
 * This feature provides all app configuration and admin functionality:
 * - Team Management (users, invites, roles)
 * - Assignment Rules (admin)
 * - Menu Visibility Settings (admin)
 *
 * IMPORTANT: Only export what should be accessible from outside this feature.
 */

// ============================================================================
// MAIN COMPONENT (for routing)
// ============================================================================

export { default as Settings } from './Settings';

// ============================================================================
// INTERNAL - DO NOT EXPORT
// ============================================================================

// ❌ DO NOT export: TeamManagement (internal tab)
// ❌ DO NOT export: AssignmentRules (internal tab)
// ❌ DO NOT export: MenuVisibilitySettings (internal tab)
//
// These are implementation details and should remain private to this feature.
// Settings.tsx is the only public interface.
