import { supabase } from '../../../lib/supabase';
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
      title: reply.title,
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
  // Try the RPC function first
  const { error } = await supabase.rpc('increment_quick_reply_use_count', { reply_id: id });

  // Fallback to direct update if RPC doesn't exist
  if (error) {
    await supabase
      .from('mc_quick_replies')
      .update({ use_count: supabase.rpc('increment', { x: 1 }) as unknown as number })
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
  _conversation?: {
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
