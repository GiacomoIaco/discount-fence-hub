/**
 * Communication Feature - Public API
 *
 * This feature provides all team communication functionality:
 * - Direct Messages (1-on-1 and group chat)
 * - Company Announcements (broadcasts to team)
 * - Message Composition
 *
 * IMPORTANT: Only export what should be accessible from outside this feature.
 */

// ============================================================================
// MAIN COMPONENTS (for other features to use)
// ============================================================================

export { default as TeamCommunication } from './TeamCommunication';
export { default as DirectMessages } from './components/DirectMessages';
export { default as AnnouncementsView } from './components/AnnouncementsView';
export { default as MessageComposer } from './components/MessageComposer';

// ============================================================================
// INTERNAL - DO NOT EXPORT
// ============================================================================

// ❌ DO NOT export: ChatView (internal to DirectMessages)
// ❌ DO NOT export: Internal message types
// ❌ DO NOT export: Message utilities
//
// These are implementation details and should remain private to this feature.
