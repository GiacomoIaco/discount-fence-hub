import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../contexts/AuthContext';
import type { TodoItem, TodoItemFollower, TodoItemComment } from '../types';

// ============================================
// SELECT CONSTANTS
// ============================================

const ITEM_SELECT = `
  *,
  assigned_user:user_profiles!todo_items_assigned_to_fkey(id, full_name, avatar_url)
`;

// ============================================
// QUERIES
// ============================================

/**
 * Fetch all items for a specific list with assigned user data
 */
export function useTodoItemsQuery(listId: string | null) {
  return useQuery({
    queryKey: ['todo-items', listId],
    queryFn: async (): Promise<TodoItem[]> => {
      if (!listId) return [];

      const { data: items, error } = await supabase
        .from('todo_items')
        .select(ITEM_SELECT)
        .eq('list_id', listId)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Fetch followers for all items
      const itemIds = (items || []).map(i => i.id);
      let followersMap: Record<string, TodoItemFollower[]> = {};

      if (itemIds.length > 0) {
        const { data: followers } = await supabase
          .from('todo_item_followers')
          .select(`
            *,
            user:user_profiles!todo_item_followers_user_id_fkey(id, full_name, avatar_url)
          `)
          .in('item_id', itemIds);

        if (followers) {
          followers.forEach(f => {
            if (!followersMap[f.item_id]) followersMap[f.item_id] = [];
            followersMap[f.item_id].push(f);
          });
        }
      }

      return (items || []).map(item => ({
        ...item,
        followers: followersMap[item.id] || [],
      }));
    },
    enabled: !!listId,
  });
}

/**
 * Fetch all items assigned to or followed by current user across ALL lists
 */
export function useMyWorkQuery() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['todo-my-work'],
    queryFn: async (): Promise<TodoItem[]> => {
      if (!user) return [];

      // Items assigned to me
      const { data: assigned, error: assignedError } = await supabase
        .from('todo_items')
        .select(`
          ${ITEM_SELECT},
          section:todo_sections!todo_items_section_id_fkey(id, title, color, list_id),
          list:todo_lists!todo_items_list_id_fkey(id, title, color)
        `)
        .eq('assigned_to', user.id)
        .order('updated_at', { ascending: false });

      if (assignedError) throw assignedError;

      // Items I follow
      const { data: followedLinks } = await supabase
        .from('todo_item_followers')
        .select('item_id')
        .eq('user_id', user.id);

      let followedItems: TodoItem[] = [];
      if (followedLinks && followedLinks.length > 0) {
        const followedIds = followedLinks.map(f => f.item_id);
        const assignedIds = new Set((assigned || []).map(i => i.id));
        const uniqueFollowedIds = followedIds.filter(id => !assignedIds.has(id));

        if (uniqueFollowedIds.length > 0) {
          const { data: followed } = await supabase
            .from('todo_items')
            .select(`
              ${ITEM_SELECT},
              section:todo_sections!todo_items_section_id_fkey(id, title, color, list_id),
              list:todo_lists!todo_items_list_id_fkey(id, title, color)
            `)
            .in('id', uniqueFollowedIds)
            .order('updated_at', { ascending: false });

          followedItems = followed || [];
        }
      }

      // Items I created
      const { data: created } = await supabase
        .from('todo_items')
        .select(`
          ${ITEM_SELECT},
          section:todo_sections!todo_items_section_id_fkey(id, title, color, list_id),
          list:todo_lists!todo_items_list_id_fkey(id, title, color)
        `)
        .eq('created_by', user.id)
        .order('updated_at', { ascending: false });

      // Deduplicate
      const seen = new Set<string>();
      const all: TodoItem[] = [];
      for (const item of [...(assigned || []), ...followedItems, ...(created || [])]) {
        if (!seen.has(item.id)) {
          seen.add(item.id);
          all.push(item);
        }
      }

      // Fetch followers for all items
      if (all.length > 0) {
        const itemIds = all.map(i => i.id);
        const { data: followers } = await supabase
          .from('todo_item_followers')
          .select(`
            *,
            user:user_profiles!todo_item_followers_user_id_fkey(id, full_name, avatar_url)
          `)
          .in('item_id', itemIds);

        if (followers) {
          const followersMap: Record<string, TodoItemFollower[]> = {};
          followers.forEach(f => {
            if (!followersMap[f.item_id]) followersMap[f.item_id] = [];
            followersMap[f.item_id].push(f);
          });
          all.forEach(item => {
            item.followers = followersMap[item.id] || [];
          });
        }
      }

      return all.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
    },
    enabled: !!user,
  });
}

// ============================================
// MUTATIONS
// ============================================

/**
 * Create a new todo item
 */
export function useCreateTodoItem() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      sectionId,
      listId,
      title,
      description,
      due_date,
      assigned_to,
    }: {
      sectionId: string;
      listId: string;
      title: string;
      description?: string;
      due_date?: string;
      assigned_to?: string;
    }) => {
      if (!user) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('todo_items')
        .insert({
          section_id: sectionId,
          list_id: listId,
          title,
          description,
          due_date,
          assigned_to: assigned_to || user.id,
          created_by: user.id,
          status: 'todo',
          sort_order: 0,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['todo-items', data.list_id] });
      queryClient.invalidateQueries({ queryKey: ['todo-my-work'] });
      queryClient.invalidateQueries({ queryKey: ['todo-lists'] });
    },
  });
}

/**
 * Update a todo item's status
 */
export function useUpdateTodoItemStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, status, listId }: { id: string; status: string; listId: string }) => {
      const { data, error } = await supabase
        .from('todo_items')
        .update({ status })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return { ...data, listId };
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['todo-items', vars.listId] });
      queryClient.invalidateQueries({ queryKey: ['todo-my-work'] });
      queryClient.invalidateQueries({ queryKey: ['todo-lists'] });
    },
  });
}

/**
 * Update any field on a todo item (for inline editing)
 */
export function useUpdateTodoItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, listId, ...updates }: {
      id: string;
      listId: string;
      title?: string;
      description?: string | null;
      notes?: string | null;
      due_date?: string | null;
      assigned_to?: string | null;
      is_high_priority?: boolean;
      status?: string;
    }) => {
      const { data, error } = await supabase
        .from('todo_items')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return { ...data, listId };
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['todo-items', vars.listId] });
      queryClient.invalidateQueries({ queryKey: ['todo-my-work'] });
    },
  });
}

/**
 * Delete a todo item
 */
export function useDeleteTodoItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, listId }: { id: string; listId: string }) => {
      const { error } = await supabase
        .from('todo_items')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return { id, listId };
    },
    onSuccess: (_, { listId }) => {
      queryClient.invalidateQueries({ queryKey: ['todo-items', listId] });
      queryClient.invalidateQueries({ queryKey: ['todo-my-work'] });
      queryClient.invalidateQueries({ queryKey: ['todo-lists'] });
    },
  });
}

/**
 * Reorder items within a section (optimistic update for drag-drop)
 */
export function useReorderTodoItems() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ listId, items }: {
      listId: string;
      items: { id: string; sort_order: number; section_id?: string }[];
    }) => {
      const updates = items.map(({ id, sort_order, section_id }) => {
        const updateData: Record<string, unknown> = { sort_order };
        if (section_id) updateData.section_id = section_id;
        return supabase.from('todo_items').update(updateData).eq('id', id);
      });

      const results = await Promise.all(updates);
      const errors = results.filter(r => r.error);
      if (errors.length > 0) throw new Error(`Failed to reorder ${errors.length} item(s)`);
      return { listId };
    },
    onMutate: async ({ listId, items: updates }) => {
      await queryClient.cancelQueries({ queryKey: ['todo-items', listId] });
      const previousData = queryClient.getQueryData(['todo-items', listId]);

      queryClient.setQueryData(['todo-items', listId], (old: TodoItem[] | undefined) => {
        if (!old) return old;
        const updateMap = new Map(updates.map(u => [u.id, u]));
        return old.map(item => {
          const update = updateMap.get(item.id);
          if (!update) return item;
          return {
            ...item,
            sort_order: update.sort_order,
            ...(update.section_id ? { section_id: update.section_id } : {}),
          };
        });
      });

      return { previousData };
    },
    onError: (_err, { listId }, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(['todo-items', listId], context.previousData);
      }
    },
    onSettled: (_, __, { listId }) => {
      queryClient.invalidateQueries({ queryKey: ['todo-items', listId] });
    },
  });
}

/**
 * Move a todo item to a different section
 */
export function useMoveTodoItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, sectionId, listId }: {
      id: string;
      sectionId: string;
      listId: string;
    }) => {
      const { data, error } = await supabase
        .from('todo_items')
        .update({ section_id: sectionId })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return { ...data, listId };
    },
    onSuccess: (_, { listId }) => {
      queryClient.invalidateQueries({ queryKey: ['todo-items', listId] });
    },
  });
}

// ============================================
// FOLLOWERS
// ============================================

/**
 * Add a follower to a todo item
 */
export function useAddTodoItemFollower() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ itemId, userId, listId }: {
      itemId: string;
      userId: string;
      listId: string;
    }) => {
      const { data, error } = await supabase
        .from('todo_item_followers')
        .insert({ item_id: itemId, user_id: userId })
        .select()
        .single();

      if (error) throw error;
      return { ...data, listId };
    },
    onSuccess: (_, { listId }) => {
      queryClient.invalidateQueries({ queryKey: ['todo-items', listId] });
      queryClient.invalidateQueries({ queryKey: ['todo-my-work'] });
    },
  });
}

/**
 * Remove a follower from a todo item
 */
export function useRemoveTodoItemFollower() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ itemId, userId, listId }: {
      itemId: string;
      userId: string;
      listId: string;
    }) => {
      const { error } = await supabase
        .from('todo_item_followers')
        .delete()
        .eq('item_id', itemId)
        .eq('user_id', userId);

      if (error) throw error;
      return { itemId, userId, listId };
    },
    onSuccess: (_, { listId }) => {
      queryClient.invalidateQueries({ queryKey: ['todo-items', listId] });
      queryClient.invalidateQueries({ queryKey: ['todo-my-work'] });
    },
  });
}

// ============================================
// COMMENTS
// ============================================

/**
 * Fetch comments for a specific todo item
 */
export function useTodoItemCommentsQuery(itemId: string | null) {
  return useQuery({
    queryKey: ['todo-item-comments', itemId],
    queryFn: async (): Promise<TodoItemComment[]> => {
      if (!itemId) return [];

      const { data, error } = await supabase
        .from('todo_item_comments')
        .select(`
          *,
          user:user_profiles!todo_item_comments_user_id_fkey(id, full_name, avatar_url)
        `)
        .eq('item_id', itemId)
        .order('created_at', { ascending: true });

      if (error) {
        console.warn('todo_item_comments query failed:', error);
        return [];
      }

      return data || [];
    },
    enabled: !!itemId,
  });
}

/**
 * Add a comment to a todo item
 */
export function useAddTodoItemComment() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ itemId, content }: { itemId: string; content: string }) => {
      if (!user) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('todo_item_comments')
        .insert({
          item_id: itemId,
          user_id: user.id,
          content,
        })
        .select(`
          *,
          user:user_profiles!todo_item_comments_user_id_fkey(id, full_name, avatar_url)
        `)
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, { itemId }) => {
      queryClient.invalidateQueries({ queryKey: ['todo-item-comments', itemId] });
      queryClient.invalidateQueries({ queryKey: ['todo-last-comments'] });
    },
  });
}

/**
 * Delete a comment
 */
export function useDeleteTodoItemComment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ commentId, itemId }: { commentId: string; itemId: string }) => {
      const { error } = await supabase
        .from('todo_item_comments')
        .delete()
        .eq('id', commentId);

      if (error) throw error;
      return { commentId, itemId };
    },
    onSuccess: (_, { itemId }) => {
      queryClient.invalidateQueries({ queryKey: ['todo-item-comments', itemId] });
      queryClient.invalidateQueries({ queryKey: ['todo-last-comments'] });
    },
  });
}

/**
 * Fetch last comment per item (batch)
 */
export function useTodoLastCommentsQuery(itemIds: string[]) {
  return useQuery({
    queryKey: ['todo-last-comments', itemIds.sort().join(',')],
    queryFn: async (): Promise<Record<string, { id: string; content: string; created_at: string; user: { id: string; full_name: string } | null } | null>> => {
      if (itemIds.length === 0) return {};

      const { data, error } = await supabase
        .from('todo_item_comments')
        .select(`
          id, item_id, content, created_at,
          user:user_profiles!todo_item_comments_user_id_fkey(id, full_name)
        `)
        .in('item_id', itemIds)
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('todo-last-comments query failed:', error);
        return {};
      }

      const lastComments: Record<string, { id: string; content: string; created_at: string; user: { id: string; full_name: string } | null }> = {};
      (data || []).forEach(comment => {
        if (!lastComments[comment.item_id]) {
          const user = Array.isArray(comment.user) ? comment.user[0] : comment.user;
          lastComments[comment.item_id] = {
            id: comment.id,
            content: comment.content,
            created_at: comment.created_at,
            user: user || null,
          };
        }
      });

      return lastComments;
    },
    enabled: itemIds.length > 0,
    staleTime: 30000,
  });
}
