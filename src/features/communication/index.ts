/**
 * Communication Feature - Public API
 *
 * This feature provides team communication functionality:
 * - Company Announcements (broadcasts to team)
 * - Message Composition (announcement creation)
 *
 * Note: Direct Messages / Team Chat moved to Unified Inbox (message-center feature).
 */

export { default as TeamCommunication } from './TeamCommunication';
export { default as AnnouncementsView } from './components/AnnouncementsView';
export { default as MessageComposer } from './components/MessageComposer';
