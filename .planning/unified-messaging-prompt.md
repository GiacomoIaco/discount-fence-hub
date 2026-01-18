# Project: Unified Mobile Messaging Interface

> **Use this prompt to start a fresh Claude Code session for implementing unified messaging**

## Context

I have a React + TypeScript + Supabase PWA for a fence company (discount-fence-hub). The mobile app has a bottom navigation bar with 5 tabs: Home, Messages, Voice, Refresh, Analytics.

The **Messages** tab currently just toggles a right-side pane, but there's no true unified messaging experience. I need to build a proper unified inbox that combines multiple communication channels.

## Current Architecture

### Existing Message-Related Components
Located in `src/features/message-center/`:
- `MessageCenterHub.tsx` - Main container
- `MessageCenterSidebar.tsx` - Filter sidebar with categories
- `components/ConversationList.tsx` - Lists SMS conversations
- `components/ConversationView.tsx` - Individual SMS thread view

### Existing Database Tables

1. **mc_conversations** - Client SMS conversations
   - Fields: id, client_id, phone_number, last_message_at, unread_count, status

2. **mc_messages** - Individual SMS messages
   - Fields: id, conversation_id, direction (inbound/outbound), body, created_at, read_at

3. **company_messages** - Team announcements
   - Fields: id, title, content, author_id, created_at, is_pinned, category

4. **company_message_reads** - Tracks who read announcements
   - Fields: id, message_id, user_id, read_at

### Existing Hooks
- `useConversations()` - Fetches SMS conversations
- `useMessages(conversationId)` - Fetches messages for a conversation
- `useUnreadCount()` - Gets unread SMS count

### Mobile Bottom Nav
Located at `src/layouts/MobileBottomNav.tsx`:
- Messages tab calls `onMessagesToggle()` which opens the right pane
- Has `unreadMessageCount` prop for badge display

## What Needs to Be Built

### 1. Unified Unread Count Hook
Create `src/features/message-center/hooks/useUnifiedUnreadCount.ts`:
- Aggregate unread counts from: SMS (mc_conversations), Announcements (company_messages), and future notification types
- Real-time subscriptions for instant updates
- Return total + breakdown by type

### 2. Mobile Unified Inbox Component
Create `src/features/message-center/components/MobileUnifiedInbox.tsx`:
- Tab/filter bar: All | SMS | Team | Announcements
- Unified list showing all message types sorted by recency
- Visual distinction between message types (icons, colors)
- Pull-to-refresh support
- Empty states per category

### 3. Message Type Renderers
Each message type needs a list item renderer:
- **SMS**: Shows client name, last message preview, unread badge
- **Announcement**: Shows title, author, pinned indicator
- **Team Chat**: (future) Shows channel name, last message
- **Notification**: (future) Shows icon, title, action button

### 4. Update MobileBottomNav Integration
- Replace right-pane toggle with navigation to unified inbox
- Badge shows total unified unread count
- Tapping Messages goes to MobileUnifiedInbox (not toggle)

### 5. Deep Linking Support
- Tapping an SMS item → opens ConversationView
- Tapping an announcement → opens announcement detail/modal
- Tapping a notification → navigates to relevant screen

## System Notifications (Future)
Consider adding these notification types:
- Quote approval requests/status changes
- Task assignments ("You've been assigned to Job #1234")
- Reminders (follow-up on quotes, overdue items)
- Sync status alerts ("Jobber sync completed")
- App announcements from admins

## Design Requirements
- Mobile-first, touch-friendly
- iOS safe area support (already in index.css)
- Consistent with existing UI patterns (Tailwind, rounded corners, shadows)
- Loading skeletons for async content
- Real-time updates without full refresh

## Files to Reference
- `src/layouts/MobileBottomNav.tsx` - Current nav implementation
- `src/layouts/MobileAppContent.tsx` - Wrapper with RightPaneContext
- `src/features/message-center/` - All existing message center code
- `src/contexts/RightPaneContext.tsx` - Current pane toggle logic
- `src/App.tsx` - Main app routing (lines 794-850 for mobile section)

## Out of Scope (for now)
- Composing new SMS (existing feature works)
- Team chat channels (future feature)
- Push notifications (separate infrastructure)
- Ticket system integration (explicitly excluded per user request)

## Success Criteria
1. Single unified view showing all message types
2. Accurate real-time unread badge on Messages tab
3. Smooth navigation to individual conversations/announcements
4. Filter between message types
5. Mobile-optimized, performant on slower devices

---

## How to Use This Prompt

1. Start a fresh Claude Code session
2. Copy this entire file content
3. Paste as your first message
4. Claude will have full context to implement the unified messaging feature

*Last updated: January 2026*
