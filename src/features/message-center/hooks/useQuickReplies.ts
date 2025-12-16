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
