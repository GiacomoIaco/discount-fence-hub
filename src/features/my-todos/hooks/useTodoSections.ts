import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import type { TodoSection } from '../types';

// ============================================
// QUERIES
// ============================================

/**
 * Fetch sections for a specific list
 */
export function useTodoSectionsQuery(listId: string | null) {
  return useQuery({
    queryKey: ['todo-sections', listId],
    queryFn: async (): Promise<TodoSection[]> => {
      if (!listId) return [];

      const { data, error } = await supabase
        .from('todo_sections')
        .select('*')
        .eq('list_id', listId)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data || [];
    },
    enabled: !!listId,
  });
}

// ============================================
// MUTATIONS
// ============================================

/**
 * Create a new section in a list
 */
export function useCreateTodoSection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      listId,
      title,
      color = 'blue-900',
    }: {
      listId: string;
      title: string;
      color?: string;
    }) => {
      // Get max sort_order for the list
      const { data: existing } = await supabase
        .from('todo_sections')
        .select('sort_order')
        .eq('list_id', listId)
        .order('sort_order', { ascending: false })
        .limit(1);

      const nextOrder = existing && existing.length > 0 ? existing[0].sort_order + 1 : 0;

      const { data, error } = await supabase
        .from('todo_sections')
        .insert({
          list_id: listId,
          title,
          color,
          sort_order: nextOrder,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['todo-sections', data.list_id] });
    },
  });
}

/**
 * Update a section
 */
export function useUpdateTodoSection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, listId, ...updates }: {
      id: string;
      listId: string;
      title?: string;
      color?: string;
      is_collapsed?: boolean;
    }) => {
      const { data, error } = await supabase
        .from('todo_sections')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return { ...data, listId };
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['todo-sections', vars.listId] });
    },
  });
}

/**
 * Delete a section (moves items? or cascades)
 */
export function useDeleteTodoSection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, listId }: { id: string; listId: string }) => {
      const { error } = await supabase
        .from('todo_sections')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return { id, listId };
    },
    onSuccess: (_, { listId }) => {
      queryClient.invalidateQueries({ queryKey: ['todo-sections', listId] });
      queryClient.invalidateQueries({ queryKey: ['todo-items', listId] });
    },
  });
}

/**
 * Reorder sections within a list
 */
export function useReorderTodoSections() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ listId, sections }: {
      listId: string;
      sections: { id: string; sort_order: number }[];
    }) => {
      const updates = sections.map(({ id, sort_order }) =>
        supabase.from('todo_sections').update({ sort_order }).eq('id', id)
      );
      const results = await Promise.all(updates);
      const errors = results.filter(r => r.error);
      if (errors.length > 0) throw new Error(`Failed to reorder ${errors.length} section(s)`);
      return { listId };
    },
    onSuccess: (_, { listId }) => {
      queryClient.invalidateQueries({ queryKey: ['todo-sections', listId] });
    },
  });
}
