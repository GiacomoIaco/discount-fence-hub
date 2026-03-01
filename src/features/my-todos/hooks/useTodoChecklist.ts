import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../contexts/AuthContext';
import type { TodoChecklistItem } from '../types';

// ============================================
// QUERIES
// ============================================

/**
 * Fetch all checklist items for a parent task
 */
export function useChecklistItemsQuery(parentItemId: string | null) {
  return useQuery({
    queryKey: ['checklist-items', parentItemId],
    queryFn: async (): Promise<TodoChecklistItem[]> => {
      if (!parentItemId) return [];

      const { data, error } = await supabase
        .from('todo_checklist_items')
        .select('*')
        .eq('parent_item_id', parentItemId)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true });

      if (error) throw error;
      if (!data || data.length === 0) return [];

      // Fetch assigned user profiles
      const userIds = data.map(i => i.assigned_to).filter((id): id is string => !!id);
      if (userIds.length > 0) {
        const unique = [...new Set(userIds)];
        const { data: profiles } = await supabase
          .from('user_profiles')
          .select('id, full_name, avatar_url')
          .in('id', unique);

        const userMap: Record<string, { id: string; full_name: string; avatar_url: string | null }> = {};
        (profiles || []).forEach(u => { userMap[u.id] = u; });

        return data.map(item => ({
          ...item,
          assigned_user: item.assigned_to ? userMap[item.assigned_to] || null : null,
        }));
      }

      return data.map(item => ({ ...item, assigned_user: null }));
    },
    enabled: !!parentItemId,
  });
}

/**
 * Batch fetch checklist progress for multiple parent items
 * Returns { [parentItemId]: { total, completed } }
 */
export function useChecklistProgressQuery(itemIds: string[]) {
  return useQuery({
    queryKey: ['checklist-progress', itemIds.sort().join(',')],
    queryFn: async (): Promise<Record<string, { total: number; completed: number }>> => {
      if (itemIds.length === 0) return {};

      const { data, error } = await supabase
        .from('todo_checklist_items')
        .select('parent_item_id, is_completed')
        .in('parent_item_id', itemIds);

      if (error) {
        console.warn('checklist-progress query failed:', error);
        return {};
      }

      const result: Record<string, { total: number; completed: number }> = {};
      (data || []).forEach(item => {
        if (!result[item.parent_item_id]) {
          result[item.parent_item_id] = { total: 0, completed: 0 };
        }
        result[item.parent_item_id].total++;
        if (item.is_completed) {
          result[item.parent_item_id].completed++;
        }
      });

      return result;
    },
    enabled: itemIds.length > 0,
    staleTime: 30000,
  });
}

// ============================================
// MUTATIONS
// ============================================

/**
 * Create a new checklist item
 */
export function useCreateChecklistItem() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ parentItemId, title, assignedTo }: {
      parentItemId: string;
      title: string;
      assignedTo?: string;
    }) => {
      if (!user) throw new Error('User not authenticated');

      // Get max sort_order for this parent
      const { data: existing } = await supabase
        .from('todo_checklist_items')
        .select('sort_order')
        .eq('parent_item_id', parentItemId)
        .order('sort_order', { ascending: false })
        .limit(1);

      const nextOrder = existing && existing.length > 0 ? existing[0].sort_order + 1 : 0;

      const { data, error } = await supabase
        .from('todo_checklist_items')
        .insert({
          parent_item_id: parentItemId,
          title,
          assigned_to: assignedTo || null,
          created_by: user.id,
          sort_order: nextOrder,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['checklist-items', data.parent_item_id] });
      queryClient.invalidateQueries({ queryKey: ['checklist-progress'] });
    },
  });
}

/**
 * Toggle a checklist item's completed status (with optimistic update)
 */
export function useToggleChecklistItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, parentItemId, isCompleted }: {
      id: string;
      parentItemId: string;
      isCompleted: boolean;
    }) => {
      const { data, error } = await supabase
        .from('todo_checklist_items')
        .update({ is_completed: isCompleted })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return { ...data, parentItemId };
    },
    onMutate: async ({ id, parentItemId, isCompleted }) => {
      await queryClient.cancelQueries({ queryKey: ['checklist-items', parentItemId] });
      const previousData = queryClient.getQueryData(['checklist-items', parentItemId]);

      queryClient.setQueryData(['checklist-items', parentItemId], (old: TodoChecklistItem[] | undefined) => {
        if (!old) return old;
        return old.map(item =>
          item.id === id ? { ...item, is_completed: isCompleted } : item
        );
      });

      return { previousData };
    },
    onError: (_err, { parentItemId }, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(['checklist-items', parentItemId], context.previousData);
      }
    },
    onSettled: (_, __, { parentItemId }) => {
      queryClient.invalidateQueries({ queryKey: ['checklist-items', parentItemId] });
      queryClient.invalidateQueries({ queryKey: ['checklist-progress'] });
    },
  });
}

/**
 * Update a checklist item (title or assignee)
 */
export function useUpdateChecklistItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, parentItemId, ...updates }: {
      id: string;
      parentItemId: string;
      title?: string;
      assigned_to?: string | null;
    }) => {
      const { data, error } = await supabase
        .from('todo_checklist_items')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return { ...data, parentItemId };
    },
    onSuccess: (_, { parentItemId }) => {
      queryClient.invalidateQueries({ queryKey: ['checklist-items', parentItemId] });
    },
  });
}

/**
 * Delete a checklist item
 */
export function useDeleteChecklistItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, parentItemId }: {
      id: string;
      parentItemId: string;
    }) => {
      const { error } = await supabase
        .from('todo_checklist_items')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return { id, parentItemId };
    },
    onSuccess: (_, { parentItemId }) => {
      queryClient.invalidateQueries({ queryKey: ['checklist-items', parentItemId] });
      queryClient.invalidateQueries({ queryKey: ['checklist-progress'] });
    },
  });
}

/**
 * Reorder checklist items (optimistic update for drag-drop)
 */
export function useReorderChecklistItems() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ parentItemId, items }: {
      parentItemId: string;
      items: { id: string; sort_order: number }[];
    }) => {
      const updates = items.map(({ id, sort_order }) =>
        supabase.from('todo_checklist_items').update({ sort_order }).eq('id', id)
      );

      const results = await Promise.all(updates);
      const errors = results.filter(r => r.error);
      if (errors.length > 0) throw new Error(`Failed to reorder ${errors.length} item(s)`);
      return { parentItemId };
    },
    onMutate: async ({ parentItemId, items: updates }) => {
      await queryClient.cancelQueries({ queryKey: ['checklist-items', parentItemId] });
      const previousData = queryClient.getQueryData(['checklist-items', parentItemId]);

      queryClient.setQueryData(['checklist-items', parentItemId], (old: TodoChecklistItem[] | undefined) => {
        if (!old) return old;
        const updateMap = new Map(updates.map(u => [u.id, u.sort_order]));
        return old.map(item => {
          const newOrder = updateMap.get(item.id);
          if (newOrder === undefined) return item;
          return { ...item, sort_order: newOrder };
        }).sort((a, b) => a.sort_order - b.sort_order);
      });

      return { previousData };
    },
    onError: (_err, { parentItemId }, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(['checklist-items', parentItemId], context.previousData);
      }
    },
    onSettled: (_, __, { parentItemId }) => {
      queryClient.invalidateQueries({ queryKey: ['checklist-items', parentItemId] });
    },
  });
}
