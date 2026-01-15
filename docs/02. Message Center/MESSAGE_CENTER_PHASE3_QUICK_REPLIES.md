# Message Center - Phase 3 Implementation
## Quick Replies & Templates

**Estimated Time:** 1.5-2 hours  
**Prerequisites:** Phase 1 & 2A complete  
**Outcome:** Template messages with shortcodes, keyboard shortcuts

---

## Overview

Quick Replies let your team send common messages with one click. Templates use shortcodes like `{{client_name}}` that auto-fill with real data.

**Example:**
```
Template: "Hi {{client_name}}, I'm on my way to {{property_address}}. ETA {{eta_minutes}} minutes."

Becomes: "Hi John, I'm on my way to 2847 Lakewood Dr. ETA 15 minutes."
```

---

## Step 1: Database Migration

Run in Supabase SQL Editor:

```sql
-- ============================================================================
-- MESSAGE CENTER PHASE 3 - QUICK REPLIES
-- ============================================================================

-- Quick Replies Table
CREATE TABLE IF NOT EXISTS mc_quick_replies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Content
  name TEXT NOT NULL,
  shortcut TEXT UNIQUE,  -- e.g., "/omw", "/quote", "/late"
  body TEXT NOT NULL,
  category TEXT DEFAULT 'general',
  
  -- Ownership
  is_global BOOLEAN DEFAULT TRUE,  -- Available to all users
  created_by UUID REFERENCES auth.users(id),
  
  -- Metadata
  use_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mc_quick_replies_shortcut ON mc_quick_replies(shortcut);
CREATE INDEX IF NOT EXISTS idx_mc_quick_replies_category ON mc_quick_replies(category);

-- RLS
ALTER TABLE mc_quick_replies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view all quick replies" ON mc_quick_replies FOR SELECT USING (true);
CREATE POLICY "Users can insert quick replies" ON mc_quick_replies FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can update quick replies" ON mc_quick_replies FOR UPDATE USING (true);
CREATE POLICY "Users can delete quick replies" ON mc_quick_replies FOR DELETE USING (true);

-- ============================================================================
-- DEFAULT TEMPLATES
-- ============================================================================

INSERT INTO mc_quick_replies (name, shortcut, body, category, is_global) VALUES

-- Greetings
('Greeting', '/hi', 
'Hi {{client_name}}, this is {{user_name}} from Discount Fence USA. How can I help you today?', 
'greeting', true),

-- On My Way / Running Late
('On My Way', '/omw', 
'Hi {{client_name}}, I''m on my way to {{property_address}}. I should arrive in approximately {{eta_minutes}} minutes.', 
'field', true),

('Running Late', '/late', 
'Hi {{client_name}}, I wanted to let you know I''m running about {{delay_minutes}} minutes behind schedule. I apologize for the inconvenience and will be there as soon as possible.', 
'field', true),

('Arrived', '/here', 
'Hi {{client_name}}, I''ve arrived at {{property_address}}. I''m ready to get started!', 
'field', true),

-- Quotes
('Quote Follow-Up', '/quote', 
'Hi {{client_name}}, I wanted to follow up on the fence quote I sent for {{property_address}}. Do you have any questions or would you like to move forward?', 
'sales', true),

('Quote Ready', '/quoteready', 
'Hi {{client_name}}, your fence quote for {{property_address}} is ready! You can view it here: {{quote_link}}. Let me know if you have any questions.', 
'sales', true),

-- Scheduling
('Booking Confirmation', '/booked', 
'Great news {{client_name}}! Your fence installation at {{property_address}} is scheduled for {{scheduled_date}}. We''ll see you then!', 
'scheduling', true),

('Reschedule Request', '/reschedule', 
'Hi {{client_name}}, we need to reschedule your appointment at {{property_address}}. What dates work best for you this week?', 
'scheduling', true),

-- Job Complete
('Job Complete', '/done', 
'Hi {{client_name}}, we''ve completed the fence installation at {{property_address}}. Please take a look and let us know if you have any questions!', 
'completion', true),

-- Payment
('Payment Reminder', '/pay', 
'Hi {{client_name}}, this is a friendly reminder that your invoice for {{property_address}} is ready. You can pay online here: {{invoice_link}}. Thank you!', 
'payment', true),

('Payment Received', '/thanks', 
'Hi {{client_name}}, we''ve received your payment. Thank you for choosing Discount Fence USA! We appreciate your business.', 
'payment', true)

ON CONFLICT (shortcut) DO NOTHING;
```

---

## Step 2: TypeScript Types

Add to `src/features/message-center/types/index.ts`:

```typescript
// Add these types to your existing types file

export interface QuickReply {
  id: string;
  name: string;
  shortcut: string | null;
  body: string;
  category: string;
  is_global: boolean;
  created_by: string | null;
  use_count: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ShortcodeContext {
  // Contact info
  client_name?: string;
  client_first_name?: string;
  client_phone?: string;
  client_email?: string;
  company_name?: string;
  
  // Property/Project info
  property_address?: string;
  community_name?: string;
  
  // User info
  user_name?: string;
  user_phone?: string;
  
  // Quote/Invoice
  quote_amount?: string;
  quote_link?: string;
  invoice_link?: string;
  
  // Scheduling
  scheduled_date?: string;
  scheduled_time?: string;
  eta_minutes?: string;
  delay_minutes?: string;
  
  // Company
  company_phone?: string;
  booking_link?: string;
}

export type QuickReplyCategory = 
  | 'greeting' 
  | 'field' 
  | 'sales' 
  | 'scheduling' 
  | 'completion' 
  | 'payment' 
  | 'general';
```

---

## Step 3: Quick Reply Service

Create file: `src/features/message-center/services/quickReplyService.ts`

```typescript
import { supabase } from '@/lib/supabase';
import type { QuickReply, ShortcodeContext } from '../types';

// ============================================================================
// CRUD OPERATIONS
// ============================================================================

export async function getQuickReplies(): Promise<QuickReply[]> {
  const { data, error } = await supabase
    .from('mc_quick_replies')
    .select('*')
    .eq('is_active', true)
    .order('use_count', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function getQuickReplyByShortcut(shortcut: string): Promise<QuickReply | null> {
  const { data, error } = await supabase
    .from('mc_quick_replies')
    .select('*')
    .eq('shortcut', shortcut.toLowerCase())
    .eq('is_active', true)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

export async function createQuickReply(reply: Partial<QuickReply>): Promise<QuickReply> {
  const { data, error } = await supabase
    .from('mc_quick_replies')
    .insert({
      name: reply.name,
      shortcut: reply.shortcut?.toLowerCase(),
      body: reply.body,
      category: reply.category || 'general',
      is_global: reply.is_global ?? true,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateQuickReply(id: string, updates: Partial<QuickReply>): Promise<QuickReply> {
  const { data, error } = await supabase
    .from('mc_quick_replies')
    .update({
      ...updates,
      shortcut: updates.shortcut?.toLowerCase(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteQuickReply(id: string): Promise<void> {
  const { error } = await supabase
    .from('mc_quick_replies')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

export async function incrementUseCount(id: string): Promise<void> {
  const { error } = await supabase.rpc('increment_quick_reply_use_count', { reply_id: id });
  
  // Fallback if RPC doesn't exist
  if (error) {
    await supabase
      .from('mc_quick_replies')
      .update({ use_count: supabase.rpc('increment', { x: 1 }) })
      .eq('id', id);
  }
}

// ============================================================================
// SHORTCODE REPLACEMENT
// ============================================================================

const SHORTCODE_REGEX = /\{\{(\w+)\}\}/g;

export function replaceShortcodes(template: string, context: ShortcodeContext): string {
  return template.replace(SHORTCODE_REGEX, (match, key) => {
    const value = context[key as keyof ShortcodeContext];
    return value !== undefined ? String(value) : match; // Keep original if not found
  });
}

export function extractShortcodes(template: string): string[] {
  const matches = template.match(SHORTCODE_REGEX);
  if (!matches) return [];
  return [...new Set(matches.map(m => m.replace(/[{}]/g, '')))];
}

export function getMissingShortcodes(template: string, context: ShortcodeContext): string[] {
  const shortcodes = extractShortcodes(template);
  return shortcodes.filter(code => !context[code as keyof ShortcodeContext]);
}

// ============================================================================
// CONTEXT BUILDER
// ============================================================================

export function buildShortcodeContext(
  contact?: {
    display_name?: string;
    first_name?: string;
    phone_primary?: string;
    email_primary?: string;
    company_name?: string;
  },
  conversation?: {
    linked_project_id?: string;
  },
  user?: {
    full_name?: string;
    phone?: string;
  },
  extras?: Partial<ShortcodeContext>
): ShortcodeContext {
  return {
    // Contact
    client_name: contact?.display_name || contact?.first_name || 'there',
    client_first_name: contact?.first_name,
    client_phone: contact?.phone_primary,
    client_email: contact?.email_primary,
    company_name: contact?.company_name,
    
    // User
    user_name: user?.full_name || 'Your rep',
    user_phone: user?.phone,
    
    // Company defaults
    company_phone: '(512) 555-0100', // TODO: Get from settings
    booking_link: 'https://discountfenceusa.com/book',
    
    // Extras (property_address, quote_link, etc.)
    ...extras,
  };
}

// ============================================================================
// SHORTCUT DETECTION
// ============================================================================

export function detectShortcut(text: string): { shortcut: string; remainder: string } | null {
  const match = text.match(/^(\/\w+)(?:\s+(.*))?$/);
  if (!match) return null;
  
  return {
    shortcut: match[1].toLowerCase(),
    remainder: match[2] || '',
  };
}
```

---

## Step 4: Quick Reply Hook

Create file: `src/features/message-center/hooks/useQuickReplies.ts`

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as quickReplyService from '../services/quickReplyService';
import type { QuickReply, ShortcodeContext } from '../types';

export function useQuickReplies() {
  return useQuery({
    queryKey: ['mc_quick_replies'],
    queryFn: quickReplyService.getQuickReplies,
  });
}

export function useQuickReplyByShortcut(shortcut: string | null) {
  return useQuery({
    queryKey: ['mc_quick_reply', shortcut],
    queryFn: () => shortcut ? quickReplyService.getQuickReplyByShortcut(shortcut) : null,
    enabled: !!shortcut,
  });
}

export function useCreateQuickReply() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: quickReplyService.createQuickReply,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mc_quick_replies'] });
    },
  });
}

export function useUpdateQuickReply() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<QuickReply> }) =>
      quickReplyService.updateQuickReply(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mc_quick_replies'] });
    },
  });
}

export function useDeleteQuickReply() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: quickReplyService.deleteQuickReply,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mc_quick_replies'] });
    },
  });
}

// Hook to process a template with context
export function useProcessTemplate() {
  return {
    process: (template: string, context: ShortcodeContext) => 
      quickReplyService.replaceShortcodes(template, context),
    getMissing: (template: string, context: ShortcodeContext) =>
      quickReplyService.getMissingShortcodes(template, context),
  };
}
```

---

## Step 5: Quick Reply Picker Component

Create file: `src/features/message-center/components/QuickReplyPicker.tsx`

```typescript
import React, { useState, useMemo } from 'react';
import { Search, Zap, MessageSquare, Truck, DollarSign, Calendar, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { QuickReply, QuickReplyCategory } from '../types';

interface QuickReplyPickerProps {
  replies: QuickReply[];
  onSelect: (reply: QuickReply) => void;
  onClose: () => void;
}

const CATEGORY_CONFIG: Record<QuickReplyCategory, { label: string; icon: React.ReactNode; color: string }> = {
  greeting: { label: 'Greetings', icon: <MessageSquare className="w-4 h-4" />, color: 'blue' },
  field: { label: 'Field', icon: <Truck className="w-4 h-4" />, color: 'green' },
  sales: { label: 'Sales', icon: <DollarSign className="w-4 h-4" />, color: 'purple' },
  scheduling: { label: 'Scheduling', icon: <Calendar className="w-4 h-4" />, color: 'orange' },
  completion: { label: 'Completion', icon: <CheckCircle className="w-4 h-4" />, color: 'teal' },
  payment: { label: 'Payment', icon: <DollarSign className="w-4 h-4" />, color: 'emerald' },
  general: { label: 'General', icon: <Zap className="w-4 h-4" />, color: 'gray' },
};

export function QuickReplyPicker({ replies, onSelect, onClose }: QuickReplyPickerProps) {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<QuickReplyCategory | 'all'>('all');

  // Filter replies
  const filteredReplies = useMemo(() => {
    return replies.filter(reply => {
      const matchesSearch = !search || 
        reply.name.toLowerCase().includes(search.toLowerCase()) ||
        reply.shortcut?.toLowerCase().includes(search.toLowerCase()) ||
        reply.body.toLowerCase().includes(search.toLowerCase());
      
      const matchesCategory = selectedCategory === 'all' || reply.category === selectedCategory;
      
      return matchesSearch && matchesCategory;
    });
  }, [replies, search, selectedCategory]);

  // Group by category
  const groupedReplies = useMemo(() => {
    const groups: Record<string, QuickReply[]> = {};
    filteredReplies.forEach(reply => {
      const cat = reply.category || 'general';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(reply);
    });
    return groups;
  }, [filteredReplies]);

  // Get unique categories
  const categories = useMemo(() => {
    const cats = new Set(replies.map(r => r.category || 'general'));
    return ['all', ...Array.from(cats)] as (QuickReplyCategory | 'all')[];
  }, [replies]);

  return (
    <div className="absolute bottom-full left-0 right-0 mb-2 bg-white rounded-lg shadow-xl border max-h-96 overflow-hidden flex flex-col">
      {/* Header */}
      <div className="p-3 border-b">
        <div className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
          <Zap className="w-4 h-4 text-yellow-500" />
          Quick Replies
        </div>
        
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search templates..."
            className="w-full pl-9 pr-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            autoFocus
          />
        </div>

        {/* Category Filters */}
        <div className="flex gap-1 mt-2 overflow-x-auto pb-1">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={cn(
                'px-2 py-1 text-xs rounded-full whitespace-nowrap transition-colors',
                selectedCategory === cat
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              )}
            >
              {cat === 'all' ? 'All' : CATEGORY_CONFIG[cat]?.label || cat}
            </button>
          ))}
        </div>
      </div>

      {/* Replies List */}
      <div className="flex-1 overflow-y-auto p-2">
        {Object.entries(groupedReplies).length === 0 ? (
          <div className="text-center text-gray-500 py-8 text-sm">
            No templates found
          </div>
        ) : (
          Object.entries(groupedReplies).map(([category, categoryReplies]) => (
            <div key={category} className="mb-3">
              {selectedCategory === 'all' && (
                <div className="flex items-center gap-1 text-xs font-medium text-gray-500 mb-1 px-2">
                  {CATEGORY_CONFIG[category as QuickReplyCategory]?.icon}
                  {CATEGORY_CONFIG[category as QuickReplyCategory]?.label || category}
                </div>
              )}
              {categoryReplies.map(reply => (
                <button
                  key={reply.id}
                  onClick={() => {
                    onSelect(reply);
                    onClose();
                  }}
                  className="w-full text-left p-2 rounded-lg hover:bg-gray-50 transition-colors group"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-gray-900 text-sm">{reply.name}</span>
                    {reply.shortcut && (
                      <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded text-gray-600">
                        {reply.shortcut}
                      </code>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">
                    {reply.body}
                  </p>
                </button>
              ))}
            </div>
          ))
        )}
      </div>

      {/* Footer hint */}
      <div className="px-3 py-2 border-t bg-gray-50 text-xs text-gray-500">
        Type <code className="bg-gray-200 px-1 rounded">/shortcut</code> in the composer to use directly
      </div>
    </div>
  );
}
```

---

## Step 6: Update Message Composer

Replace `src/features/message-center/components/MessageComposer.tsx`:

```typescript
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Paperclip, Image, AlertTriangle, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { QuickReplyPicker } from './QuickReplyPicker';
import { useQuickReplies } from '../hooks/useQuickReplies';
import * as quickReplyService from '../services/quickReplyService';
import type { ShortcodeContext, QuickReply } from '../types';

interface MessageComposerProps {
  onSend: (message: string) => void;
  disabled?: boolean;
  placeholder?: string;
  isOptedOut?: boolean;
  shortcodeContext?: ShortcodeContext;
}

export function MessageComposer({ 
  onSend, 
  disabled = false,
  placeholder = 'Type a message...',
  isOptedOut = false,
  shortcodeContext = {}
}: MessageComposerProps) {
  const [message, setMessage] = useState('');
  const [showQuickReplies, setShowQuickReplies] = useState(false);
  const [shortcutMatch, setShortcutMatch] = useState<QuickReply | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  const { data: quickReplies = [] } = useQuickReplies();

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 150)}px`;
    }
  }, [message]);

  // Detect shortcut as user types
  useEffect(() => {
    const detected = quickReplyService.detectShortcut(message);
    if (detected) {
      const match = quickReplies.find(r => r.shortcut === detected.shortcut);
      setShortcutMatch(match || null);
    } else {
      setShortcutMatch(null);
    }
  }, [message, quickReplies]);

  const handleSelectQuickReply = useCallback((reply: QuickReply) => {
    const processed = quickReplyService.replaceShortcodes(reply.body, shortcodeContext);
    setMessage(processed);
    setShowQuickReplies(false);
    textareaRef.current?.focus();
    
    // Increment use count
    quickReplyService.incrementUseCount(reply.id).catch(console.error);
  }, [shortcodeContext]);

  const handleApplyShortcut = useCallback(() => {
    if (shortcutMatch) {
      handleSelectQuickReply(shortcutMatch);
    }
  }, [shortcutMatch, handleSelectQuickReply]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || disabled || isOptedOut) return;
    
    onSend(message.trim());
    setMessage('');
    setShortcutMatch(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Tab to apply shortcut
    if (e.key === 'Tab' && shortcutMatch) {
      e.preventDefault();
      handleApplyShortcut();
      return;
    }
    
    // Enter to send (unless shift is held)
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  // Show opt-out warning
  if (isOptedOut) {
    return (
      <div className="border-t bg-yellow-50 p-4">
        <div className="flex items-center gap-2 text-yellow-800">
          <AlertTriangle className="w-5 h-5" />
          <div>
            <p className="font-medium">This contact has opted out of SMS</p>
            <p className="text-sm">They texted STOP and cannot receive messages until they reply START.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="border-t bg-white p-4 relative">
      {/* Quick Reply Picker */}
      {showQuickReplies && (
        <QuickReplyPicker
          replies={quickReplies}
          onSelect={handleSelectQuickReply}
          onClose={() => setShowQuickReplies(false)}
        />
      )}

      {/* Shortcut Match Preview */}
      {shortcutMatch && (
        <div className="absolute bottom-full left-4 right-4 mb-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <code className="text-xs bg-blue-100 px-1.5 py-0.5 rounded text-blue-700">
                  {shortcutMatch.shortcut}
                </code>
                <span className="font-medium text-blue-900 text-sm">{shortcutMatch.name}</span>
              </div>
              <p className="text-xs text-blue-700 mt-1 line-clamp-2">
                {quickReplyService.replaceShortcodes(shortcutMatch.body, shortcodeContext)}
              </p>
            </div>
            <div className="text-xs text-blue-600">
              Press <kbd className="bg-blue-100 px-1 rounded">Tab</kbd> to apply
            </div>
          </div>
        </div>
      )}

      <div className="flex items-end gap-2">
        {/* Quick Reply Button */}
        <button
          type="button"
          onClick={() => setShowQuickReplies(!showQuickReplies)}
          className={cn(
            'p-2 rounded-lg transition-colors',
            showQuickReplies 
              ? 'bg-yellow-100 text-yellow-600' 
              : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
          )}
          title="Quick replies"
        >
          <Zap className="w-5 h-5" />
        </button>

        {/* Attachment Buttons */}
        <div className="flex gap-1">
          <button
            type="button"
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            title="Attach file"
          >
            <Paperclip className="w-5 h-5" />
          </button>
          <button
            type="button"
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            title="Attach image"
          >
            <Image className="w-5 h-5" />
          </button>
        </div>

        {/* Text Input */}
        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={disabled}
            rows={1}
            className="w-full px-4 py-2 border border-gray-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-400"
          />
          {/* Character count for SMS */}
          {message.length > 0 && !shortcutMatch && (
            <span className={cn(
              'absolute bottom-2 right-2 text-xs',
              message.length > 160 ? 'text-orange-500' : 'text-gray-400'
            )}>
              {message.length}/160
            </span>
          )}
        </div>

        {/* Send Button */}
        <Button
          type="submit"
          disabled={!message.trim() || disabled}
          className="px-4 py-2"
        >
          <Send className="w-4 h-4" />
        </Button>
      </div>

      {/* Hint */}
      <p className="mt-1 text-xs text-gray-400">
        Press Enter to send • Type <code className="bg-gray-100 px-1 rounded">/</code> for shortcuts
      </p>
    </form>
  );
}
```

---

## Step 7: Update MessageCenterPage

Update the MessageComposer usage in `MessageCenterPage.tsx`:

```typescript
import { buildShortcodeContext } from '../services/quickReplyService';

// Inside the component, after selecting a conversation:
const shortcodeContext = useMemo(() => {
  if (!selectedConversation?.contact) return {};
  
  return buildShortcodeContext(
    selectedConversation.contact,
    selectedConversation,
    undefined, // TODO: Get current user
    {
      // Add any extras you have available
      property_address: 'TBD', // TODO: Get from linked project
      eta_minutes: '15',
      delay_minutes: '10',
    }
  );
}, [selectedConversation]);

// Then in the JSX:
<MessageComposer
  onSend={handleSendMessage}
  disabled={sendMessage.isPending}
  placeholder={`Message ${selectedConversation.contact?.display_name || 'contact'}...`}
  isOptedOut={selectedConversation.contact?.sms_opted_out || false}
  shortcodeContext={shortcodeContext}
/>
```

---

## Step 8: Quick Replies Management Page (Optional)

Create file: `src/features/message-center/pages/QuickRepliesPage.tsx`

```typescript
import React, { useState } from 'react';
import { Plus, Edit2, Trash2, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useQuickReplies, useCreateQuickReply, useUpdateQuickReply, useDeleteQuickReply } from '../hooks/useQuickReplies';
import type { QuickReply } from '../types';

export function QuickRepliesPage() {
  const { data: quickReplies = [], isLoading } = useQuickReplies();
  const createReply = useCreateQuickReply();
  const updateReply = useUpdateQuickReply();
  const deleteReply = useDeleteQuickReply();
  
  const [editingReply, setEditingReply] = useState<QuickReply | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const handleSave = async (reply: Partial<QuickReply>) => {
    if (editingReply) {
      await updateReply.mutateAsync({ id: editingReply.id, updates: reply });
    } else {
      await createReply.mutateAsync(reply);
    }
    setEditingReply(null);
    setIsCreating(false);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Delete this quick reply?')) {
      await deleteReply.mutateAsync(id);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Zap className="w-6 h-6 text-yellow-500" />
          <h1 className="text-2xl font-bold">Quick Replies</h1>
        </div>
        <Button onClick={() => setIsCreating(true)}>
          <Plus className="w-4 h-4 mr-2" />
          New Template
        </Button>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-gray-500">Loading...</div>
      ) : (
        <div className="space-y-3">
          {quickReplies.map(reply => (
            <div key={reply.id} className="bg-white border rounded-lg p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium">{reply.name}</span>
                    {reply.shortcut && (
                      <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">
                        {reply.shortcut}
                      </code>
                    )}
                    <span className="text-xs text-gray-400 bg-gray-50 px-2 py-0.5 rounded">
                      {reply.category}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600">{reply.body}</p>
                  <p className="text-xs text-gray-400 mt-2">
                    Used {reply.use_count} times
                  </p>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => setEditingReply(reply)}
                    className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(reply.id)}
                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* TODO: Add edit/create modal */}
    </div>
  );
}
```

---

## Available Shortcodes Reference

| Shortcode | Description | Example |
|-----------|-------------|---------|
| `{{client_name}}` | Contact display name | "John Smith" |
| `{{client_first_name}}` | Contact first name | "John" |
| `{{client_phone}}` | Contact phone | "+15125551234" |
| `{{client_email}}` | Contact email | "john@example.com" |
| `{{company_name}}` | Contact's company | "DR Horton" |
| `{{property_address}}` | Job address | "2847 Lakewood Dr" |
| `{{community_name}}` | Community name | "Lakewood Estates" |
| `{{user_name}}` | Rep's name | "Marcus" |
| `{{user_phone}}` | Rep's phone | "+15125550100" |
| `{{quote_amount}}` | Quote total | "$4,500" |
| `{{quote_link}}` | Quote portal link | "https://..." |
| `{{invoice_link}}` | Invoice portal link | "https://..." |
| `{{scheduled_date}}` | Appointment date | "Tuesday, Dec 17" |
| `{{scheduled_time}}` | Appointment time | "9:00 AM" |
| `{{eta_minutes}}` | ETA in minutes | "15" |
| `{{delay_minutes}}` | Delay in minutes | "10" |
| `{{booking_link}}` | Booking page | "https://..." |

---

## Verification Checklist

- [ ] Database table created with default templates
- [ ] Quick reply picker opens with ⚡ button
- [ ] Typing `/omw` shows preview above composer
- [ ] Pressing Tab applies the shortcut
- [ ] Shortcodes replaced with real values
- [ ] Category filters work in picker
- [ ] Search filters templates
- [ ] Use count increments on use

---

## Default Shortcuts

| Shortcut | Name | Use Case |
|----------|------|----------|
| `/hi` | Greeting | First contact |
| `/omw` | On My Way | En route to job |
| `/late` | Running Late | Delay notification |
| `/here` | Arrived | At job site |
| `/quote` | Quote Follow-Up | Check on sent quote |
| `/quoteready` | Quote Ready | Quote available |
| `/booked` | Booking Confirmation | Confirm appointment |
| `/reschedule` | Reschedule Request | Need new time |
| `/done` | Job Complete | Work finished |
| `/pay` | Payment Reminder | Invoice follow-up |
| `/thanks` | Payment Received | Thank you |

---

**End of Phase 3 Implementation Spec**
