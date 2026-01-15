# Message Center - Phase 5 Implementation
## Right-Pane Messaging

**Estimated Time:** 1.5-2 hours  
**Prerequisites:** Phase 1-4 complete  
**Outcome:** Message anyone from any page without navigating away

---

## Overview

Right-Pane Messaging lets users send messages from anywhere in the app:

- **Floating Button** - Always visible in bottom-right corner
- **Slide-Out Panel** - 400px panel slides in from right
- **Context-Aware** - Pre-selects recipient based on current page
- **Keyboard Shortcut** - `Ctrl/Cmd + M` to open
- **Minimizable** - Collapse to floating button

```
┌─────────────────────────────────────────┬──────────────────────┐
│                                         │                      │
│         ANY PAGE IN THE APP             │   RIGHT-PANE         │
│                                         │   MESSAGING          │
│  ┌─────────────────────────────────┐    │                      │
│  │  Client: John Smith             │    │  To: John Smith ▼    │
│  │  Quote #1234                    │    │                      │
│  │  $4,500                         │    │  ┌────────────────┐  │
│  │                                 │    │  │ Recent msgs... │  │
│  │  [View] [Edit] [💬 Message]─────┼────┼─▶│                │  │
│  │                                 │    │  │                │  │
│  └─────────────────────────────────┘    │  └────────────────┘  │
│                                         │                      │
│                                         │  [Type message...]   │
│                                         │  [Send]              │
│                                    [💬] │                      │
│                                         └──────────────────────┘
└─────────────────────────────────────────────────────────────────┘
```

---

## Step 1: Create Right-Pane Context

Create file: `src/features/message-center/context/RightPaneContext.tsx`

```typescript
import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import type { Contact, Conversation } from '../types';

interface RightPaneState {
  isOpen: boolean;
  isMinimized: boolean;
  selectedContact: Contact | null;
  selectedConversation: Conversation | null;
  prefilledMessage: string;
}

interface RightPaneContextValue extends RightPaneState {
  // Actions
  open: (options?: OpenOptions) => void;
  close: () => void;
  minimize: () => void;
  toggle: () => void;
  setContact: (contact: Contact | null) => void;
  setConversation: (conversation: Conversation | null) => void;
  setPrefilledMessage: (message: string) => void;
  reset: () => void;
}

interface OpenOptions {
  contact?: Contact;
  conversation?: Conversation;
  prefilledMessage?: string;
}

const RightPaneContext = createContext<RightPaneContextValue | null>(null);

const initialState: RightPaneState = {
  isOpen: false,
  isMinimized: false,
  selectedContact: null,
  selectedConversation: null,
  prefilledMessage: '',
};

export function RightPaneProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<RightPaneState>(initialState);

  // Keyboard shortcut: Ctrl/Cmd + M
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'm') {
        e.preventDefault();
        setState(prev => ({ ...prev, isOpen: !prev.isOpen, isMinimized: false }));
      }
      // Escape to close
      if (e.key === 'Escape' && state.isOpen) {
        setState(prev => ({ ...prev, isOpen: false }));
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [state.isOpen]);

  const open = useCallback((options?: OpenOptions) => {
    setState(prev => ({
      ...prev,
      isOpen: true,
      isMinimized: false,
      selectedContact: options?.contact ?? prev.selectedContact,
      selectedConversation: options?.conversation ?? prev.selectedConversation,
      prefilledMessage: options?.prefilledMessage ?? '',
    }));
  }, []);

  const close = useCallback(() => {
    setState(prev => ({ ...prev, isOpen: false }));
  }, []);

  const minimize = useCallback(() => {
    setState(prev => ({ ...prev, isMinimized: true }));
  }, []);

  const toggle = useCallback(() => {
    setState(prev => ({
      ...prev,
      isOpen: !prev.isOpen,
      isMinimized: false,
    }));
  }, []);

  const setContact = useCallback((contact: Contact | null) => {
    setState(prev => ({ ...prev, selectedContact: contact }));
  }, []);

  const setConversation = useCallback((conversation: Conversation | null) => {
    setState(prev => ({ ...prev, selectedConversation: conversation }));
  }, []);

  const setPrefilledMessage = useCallback((message: string) => {
    setState(prev => ({ ...prev, prefilledMessage: message }));
  }, []);

  const reset = useCallback(() => {
    setState(initialState);
  }, []);

  return (
    <RightPaneContext.Provider
      value={{
        ...state,
        open,
        close,
        minimize,
        toggle,
        setContact,
        setConversation,
        setPrefilledMessage,
        reset,
      }}
    >
      {children}
    </RightPaneContext.Provider>
  );
}

export function useRightPane() {
  const context = useContext(RightPaneContext);
  if (!context) {
    throw new Error('useRightPane must be used within a RightPaneProvider');
  }
  return context;
}
```

---

## Step 2: Right-Pane Messaging Component

Create file: `src/features/message-center/components/RightPaneMessaging.tsx`

```typescript
import React, { useState, useEffect, useMemo } from 'react';
import { X, Minus, MessageSquare, ChevronDown, Search, User, Building2, Phone } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useRightPane } from '../context/RightPaneContext';
import { MessageThread } from './MessageThread';
import { MessageComposer } from './MessageComposer';
import { useConversations } from '../hooks/useConversations';
import { useMessages, useSendMessage } from '../hooks/useMessages';
import { buildShortcodeContext } from '../services/quickReplyService';
import * as messageService from '../services/messageService';
import type { Contact, ConversationWithContact, ShortcodeContext } from '../types';

export function RightPaneMessaging() {
  const {
    isOpen,
    isMinimized,
    selectedContact,
    selectedConversation,
    prefilledMessage,
    close,
    minimize,
    setContact,
    setConversation,
    setPrefilledMessage,
  } = useRightPane();

  const [showRecipientPicker, setShowRecipientPicker] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const { data: conversations = [] } = useConversations();
  const { data: messages = [], isLoading: messagesLoading } = useMessages(
    selectedConversation?.id || null
  );
  const sendMessage = useSendMessage();

  // Find conversation for selected contact
  useEffect(() => {
    if (selectedContact && !selectedConversation) {
      const existingConversation = conversations.find(
        c => c.contact_id === selectedContact.id
      );
      if (existingConversation) {
        setConversation(existingConversation);
      }
    }
  }, [selectedContact, selectedConversation, conversations, setConversation]);

  // Filter conversations for search
  const filteredConversations = useMemo(() => {
    if (!searchQuery) return conversations.slice(0, 10);
    const query = searchQuery.toLowerCase();
    return conversations.filter(c =>
      c.contact?.display_name?.toLowerCase().includes(query) ||
      c.contact?.company_name?.toLowerCase().includes(query) ||
      c.contact?.phone_primary?.includes(query)
    ).slice(0, 10);
  }, [conversations, searchQuery]);

  // Build shortcode context
  const shortcodeContext: ShortcodeContext = useMemo(() => {
    if (!selectedContact) return {};
    return buildShortcodeContext(selectedContact, selectedConversation || undefined);
  }, [selectedContact, selectedConversation]);

  const handleSelectConversation = (conv: ConversationWithContact) => {
    setConversation(conv);
    setContact(conv.contact || null);
    setShowRecipientPicker(false);
    setSearchQuery('');
  };

  const handleSendMessage = async (body: string) => {
    if (!selectedContact?.phone_primary) return;

    let conversationId = selectedConversation?.id;

    // Create conversation if needed
    if (!conversationId && selectedContact) {
      const newConversation = await messageService.createConversation(selectedContact.id);
      conversationId = newConversation.id;
      setConversation(newConversation);
    }

    if (!conversationId) return;

    sendMessage.mutate({
      conversation_id: conversationId,
      channel: 'sms',
      direction: 'outbound',
      body,
      to_phone: selectedContact.phone_primary,
    });

    setPrefilledMessage('');
  };

  // Don't render if closed
  if (!isOpen) return null;

  // Minimized state - just show small indicator
  if (isMinimized) {
    return null; // Handled by FloatingButton
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/20 z-40 md:hidden"
        onClick={close}
      />

      {/* Panel */}
      <div className={cn(
        'fixed right-0 top-0 h-full w-full md:w-[400px] bg-white shadow-2xl z-50',
        'flex flex-col',
        'animate-in slide-in-from-right duration-200'
      )}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b bg-gray-50">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-blue-600" />
            <span className="font-semibold text-gray-900">Quick Message</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={minimize}
              className="p-1.5 hover:bg-gray-200 rounded-lg transition-colors"
              title="Minimize"
            >
              <Minus className="w-4 h-4 text-gray-500" />
            </button>
            <button
              onClick={close}
              className="p-1.5 hover:bg-gray-200 rounded-lg transition-colors"
              title="Close (Esc)"
            >
              <X className="w-4 h-4 text-gray-500" />
            </button>
          </div>
        </div>

        {/* Recipient Selector */}
        <div className="px-4 py-3 border-b">
          <button
            onClick={() => setShowRecipientPicker(!showRecipientPicker)}
            className="w-full flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
          >
            {selectedContact ? (
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                  <User className="w-5 h-5 text-blue-600" />
                </div>
                <div className="text-left">
                  <p className="font-medium text-gray-900">
                    {selectedContact.display_name}
                  </p>
                  {selectedContact.company_name && (
                    <p className="text-xs text-gray-500 flex items-center gap-1">
                      <Building2 className="w-3 h-3" />
                      {selectedContact.company_name}
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <span className="text-gray-500">Select recipient...</span>
            )}
            <ChevronDown className={cn(
              'w-5 h-5 text-gray-400 transition-transform',
              showRecipientPicker && 'rotate-180'
            )} />
          </button>

          {/* Recipient Picker Dropdown */}
          {showRecipientPicker && (
            <div className="mt-2 border rounded-lg bg-white shadow-lg max-h-64 overflow-hidden">
              {/* Search */}
              <div className="p-2 border-b">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search contacts..."
                    className="w-full pl-9 pr-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    autoFocus
                  />
                </div>
              </div>

              {/* Recent Conversations */}
              <div className="overflow-y-auto max-h-48">
                {filteredConversations.length === 0 ? (
                  <div className="p-4 text-center text-gray-500 text-sm">
                    No contacts found
                  </div>
                ) : (
                  filteredConversations.map((conv) => (
                    <button
                      key={conv.id}
                      onClick={() => handleSelectConversation(conv)}
                      className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 transition-colors text-left"
                    >
                      <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                        <User className="w-4 h-4 text-gray-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 text-sm truncate">
                          {conv.contact?.display_name || 'Unknown'}
                        </p>
                        <p className="text-xs text-gray-500 truncate">
                          {conv.contact?.company_name || conv.contact?.phone_primary}
                        </p>
                      </div>
                      {conv.unread_count > 0 && (
                        <span className="w-5 h-5 bg-blue-600 text-white text-xs rounded-full flex items-center justify-center">
                          {conv.unread_count}
                        </span>
                      )}
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Message Thread */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {selectedContact ? (
            <>
              {/* Messages */}
              <div className="flex-1 overflow-y-auto">
                {selectedConversation ? (
                  <MessageThread
                    messages={messages}
                    isLoading={messagesLoading}
                  />
                ) : (
                  <div className="flex items-center justify-center h-full text-gray-500">
                    <div className="text-center">
                      <MessageSquare className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                      <p className="text-sm">Start a new conversation</p>
                      <p className="text-xs text-gray-400 mt-1">
                        with {selectedContact.display_name}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Composer */}
              <MessageComposer
                onSend={handleSendMessage}
                disabled={sendMessage.isPending || !selectedContact.phone_primary}
                placeholder={`Message ${selectedContact.display_name}...`}
                isOptedOut={selectedContact.sms_opted_out}
                shortcodeContext={shortcodeContext}
              />

              {/* No phone warning */}
              {!selectedContact.phone_primary && (
                <div className="px-4 py-2 bg-yellow-50 border-t border-yellow-200">
                  <p className="text-xs text-yellow-800 flex items-center gap-1">
                    <Phone className="w-3 h-3" />
                    No phone number on file for this contact
                  </p>
                </div>
              )}
            </>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500">
              <div className="text-center">
                <User className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                <p className="text-sm">Select a recipient</p>
                <p className="text-xs text-gray-400 mt-1">
                  to start messaging
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer hint */}
        <div className="px-4 py-2 border-t bg-gray-50 text-xs text-gray-400">
          <kbd className="bg-gray-200 px-1 rounded">Ctrl</kbd> + <kbd className="bg-gray-200 px-1 rounded">M</kbd> to toggle • <kbd className="bg-gray-200 px-1 rounded">Esc</kbd> to close
        </div>
      </div>
    </>
  );
}
```

---

## Step 3: Floating Message Button

Create file: `src/features/message-center/components/FloatingMessageButton.tsx`

```typescript
import React from 'react';
import { MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useRightPane } from '../context/RightPaneContext';
import { useUnreadNotificationCount } from '../hooks/useNotifications';

interface FloatingMessageButtonProps {
  className?: string;
}

export function FloatingMessageButton({ className }: FloatingMessageButtonProps) {
  const { isOpen, isMinimized, toggle, selectedContact } = useRightPane();
  const { data: unreadCount = 0 } = useUnreadNotificationCount();

  // Don't show if panel is fully open
  if (isOpen && !isMinimized) return null;

  return (
    <button
      onClick={toggle}
      className={cn(
        'fixed bottom-6 right-6 z-30',
        'w-14 h-14 rounded-full shadow-lg',
        'bg-blue-600 hover:bg-blue-700 text-white',
        'flex items-center justify-center',
        'transition-all duration-200',
        'hover:scale-105 active:scale-95',
        isMinimized && 'animate-pulse',
        className
      )}
      title="Open messages (Ctrl+M)"
    >
      <MessageSquare className="w-6 h-6" />

      {/* Badge */}
      {(unreadCount > 0 || isMinimized) && (
        <span className={cn(
          'absolute -top-1 -right-1 flex items-center justify-center min-w-[20px] h-5 text-xs font-bold rounded-full px-1',
          isMinimized && selectedContact
            ? 'bg-green-500 text-white'
            : 'bg-red-500 text-white'
        )}>
          {isMinimized && selectedContact ? '1' : unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}

      {/* Minimized preview */}
      {isMinimized && selectedContact && (
        <div className="absolute bottom-full right-0 mb-2 px-3 py-2 bg-white rounded-lg shadow-lg border whitespace-nowrap">
          <p className="text-xs text-gray-500">Chatting with</p>
          <p className="text-sm font-medium text-gray-900">{selectedContact.display_name}</p>
        </div>
      )}
    </button>
  );
}
```

---

## Step 4: Message Button (Inline)

Create file: `src/features/message-center/components/MessageButton.tsx`

```typescript
import React from 'react';
import { MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useRightPane } from '../context/RightPaneContext';
import type { Contact } from '../types';

interface MessageButtonProps {
  contact: Contact;
  prefilledMessage?: string;
  variant?: 'icon' | 'button' | 'link';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  children?: React.ReactNode;
}

/**
 * Inline message button that opens the right-pane messaging
 * Use this anywhere in your app to enable quick messaging
 * 
 * @example
 * // Icon only
 * <MessageButton contact={client} />
 * 
 * // With label
 * <MessageButton contact={client} variant="button">
 *   Send Message
 * </MessageButton>
 * 
 * // With prefilled message
 * <MessageButton 
 *   contact={client} 
 *   prefilledMessage="Hi! Following up on your quote..."
 * />
 */
export function MessageButton({
  contact,
  prefilledMessage,
  variant = 'icon',
  size = 'md',
  className,
  children,
}: MessageButtonProps) {
  const { open } = useRightPane();

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    open({ contact, prefilledMessage });
  };

  const sizeClasses = {
    sm: 'p-1',
    md: 'p-2',
    lg: 'p-3',
  };

  const iconSizes = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6',
  };

  if (variant === 'link') {
    return (
      <button
        onClick={handleClick}
        className={cn(
          'text-blue-600 hover:text-blue-700 hover:underline inline-flex items-center gap-1',
          className
        )}
      >
        <MessageSquare className={iconSizes[size]} />
        {children || 'Message'}
      </button>
    );
  }

  if (variant === 'button') {
    return (
      <button
        onClick={handleClick}
        className={cn(
          'inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors',
          className
        )}
      >
        <MessageSquare className={iconSizes[size]} />
        {children || 'Message'}
      </button>
    );
  }

  // Icon variant (default)
  return (
    <button
      onClick={handleClick}
      className={cn(
        'text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors',
        sizeClasses[size],
        className
      )}
      title={`Message ${contact.display_name}`}
    >
      <MessageSquare className={iconSizes[size]} />
    </button>
  );
}
```

---

## Step 5: Export Components

Create/update file: `src/features/message-center/index.ts`

```typescript
// Context
export { RightPaneProvider, useRightPane } from './context/RightPaneContext';

// Components
export { RightPaneMessaging } from './components/RightPaneMessaging';
export { FloatingMessageButton } from './components/FloatingMessageButton';
export { MessageButton } from './components/MessageButton';
export { NotificationBell } from './components/NotificationBell';
export { ConversationList } from './components/ConversationList';
export { MessageThread } from './components/MessageThread';
export { MessageComposer } from './components/MessageComposer';
export { QuickReplyPicker } from './components/QuickReplyPicker';
export { NotificationList } from './components/NotificationList';

// Pages
export { MessageCenterPage } from './pages/MessageCenterPage';

// Hooks
export { useConversations, useConversation } from './hooks/useConversations';
export { useMessages, useSendMessage } from './hooks/useMessages';
export { useQuickReplies } from './hooks/useQuickReplies';
export { useNotifications, useUnreadNotificationCount } from './hooks/useNotifications';

// Types
export type * from './types';
```

---

## Step 6: Wrap App with Provider

Update your main `App.tsx` or layout:

```typescript
import { RightPaneProvider, RightPaneMessaging, FloatingMessageButton } from '@/features/message-center';

function App() {
  return (
    <RightPaneProvider>
      {/* Your existing app content */}
      <YourRouter />
      
      {/* Global components - render once at app level */}
      <RightPaneMessaging />
      <FloatingMessageButton />
    </RightPaneProvider>
  );
}
```

---

## Step 7: Usage Examples

### Example 1: Client Detail Page

```typescript
import { MessageButton } from '@/features/message-center';

function ClientDetailPage({ client }) {
  // Convert your client to Contact format
  const contact = {
    id: client.mc_contact_id, // Link to mc_contacts
    display_name: `${client.first_name} ${client.last_name}`,
    company_name: client.company_name,
    phone_primary: client.phone,
    email_primary: client.email,
    contact_type: 'client' as const,
    sms_opted_out: false,
    created_at: client.created_at,
    updated_at: client.updated_at,
  };

  return (
    <div>
      <h1>{client.name}</h1>
      
      {/* Icon button */}
      <MessageButton contact={contact} />
      
      {/* Or full button */}
      <MessageButton contact={contact} variant="button">
        Send Message
      </MessageButton>
    </div>
  );
}
```

### Example 2: Quote Page with Prefilled Message

```typescript
import { MessageButton } from '@/features/message-center';

function QuotePage({ quote, client }) {
  const contact = {
    id: client.mc_contact_id,
    display_name: client.name,
    phone_primary: client.phone,
    // ... other fields
  };

  return (
    <div>
      <h1>Quote #{quote.number}</h1>
      
      <MessageButton 
        contact={contact}
        variant="button"
        prefilledMessage={`Hi ${client.first_name}, following up on quote #${quote.number} for ${quote.property_address}. Do you have any questions?`}
      >
        Follow Up
      </MessageButton>
    </div>
  );
}
```

### Example 3: Job Schedule Page

```typescript
import { MessageButton } from '@/features/message-center';

function SchedulePage({ jobs }) {
  return (
    <table>
      <tbody>
        {jobs.map(job => (
          <tr key={job.id}>
            <td>{job.client_name}</td>
            <td>{job.address}</td>
            <td>{job.scheduled_time}</td>
            <td>
              <MessageButton 
                contact={job.contact}
                prefilledMessage={`Hi ${job.client_name}, I'm on my way to ${job.address}. I should arrive in approximately 15 minutes.`}
                size="sm"
              />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

### Example 4: Programmatic Open

```typescript
import { useRightPane } from '@/features/message-center';

function SomeComponent() {
  const { open } = useRightPane();

  const handleSendOMW = (job) => {
    open({
      contact: job.contact,
      prefilledMessage: `Hi ${job.contact.display_name}, I'm on my way!`,
    });
  };

  return (
    <button onClick={() => handleSendOMW(job)}>
      Send "On My Way"
    </button>
  );
}
```

---

## Step 8: Add to Existing Pages

Here are common places to add the MessageButton:

### Client Hub / Client List

```typescript
// In your client list table
<td className="flex items-center gap-2">
  <MessageButton contact={clientContact} size="sm" />
  <a href={`/clients/${client.id}`}>View</a>
</td>
```

### Quote List

```typescript
// In quote actions
<div className="flex gap-2">
  <MessageButton 
    contact={quote.contact} 
    size="sm"
    prefilledMessage={`Following up on quote #${quote.number}...`}
  />
  <button>Edit</button>
  <button>Send</button>
</div>
```

### Job Detail Page

```typescript
// In job header
<div className="flex items-center gap-4">
  <h1>Job #{job.number}</h1>
  <MessageButton contact={job.contact} variant="button" size="sm">
    Message Client
  </MessageButton>
</div>
```

### Invoice List

```typescript
// For overdue invoices
{invoice.status === 'overdue' && (
  <MessageButton
    contact={invoice.contact}
    variant="link"
    prefilledMessage={`Hi ${invoice.contact.display_name}, this is a friendly reminder about invoice #${invoice.number}...`}
  >
    Send Reminder
  </MessageButton>
)}
```

---

## Verification Checklist

- [ ] Floating button appears in bottom-right corner
- [ ] Clicking floating button opens right pane
- [ ] `Ctrl/Cmd + M` toggles the pane
- [ ] `Esc` closes the pane
- [ ] Can search and select recipients
- [ ] Recent conversations show in picker
- [ ] Selecting recipient shows conversation history
- [ ] Can send message from right pane
- [ ] Minimize button collapses to floating button
- [ ] MessageButton works inline on pages
- [ ] Prefilled messages populate composer
- [ ] Mobile: Full-screen with backdrop
- [ ] Quick replies work in right pane

---

## Mobile Considerations

The right pane automatically:
- Goes full-width on mobile (`w-full md:w-[400px]`)
- Shows backdrop overlay on mobile
- Backdrop click closes the pane

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl/Cmd + M` | Toggle right pane |
| `Esc` | Close right pane |
| `Tab` | Apply quick reply shortcut |
| `Enter` | Send message |
| `Shift + Enter` | New line |

---

**End of Phase 5 Implementation Spec**
