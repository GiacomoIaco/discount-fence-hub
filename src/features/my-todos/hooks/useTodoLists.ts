import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../contexts/AuthContext';
import type { TodoList, TodoListMember } from '../types';

// ============================================
// QUERIES
// ============================================

/**
 * Fetch all accessible todo lists with item/member counts
 */
export function useTodoListsQuery() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['todo-lists'],
    queryFn: async (): Promise<TodoList[]> => {
      if (!user) return [];

      const { data, error } = await supabase
        .from('todo_lists')
        .select('*')
        .is('archived_at', null)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Fetch item counts per list
      const listIds = (data || []).map(l => l.id);
      let itemCounts: Record<string, number> = {};
      let memberCounts: Record<string, number> = {};

      if (listIds.length > 0) {
        const { data: items } = await supabase
          .from('todo_items')
          .select('list_id')
          .in('list_id', listIds)
          .neq('status', 'done');

        if (items) {
          items.forEach(item => {
            itemCounts[item.list_id] = (itemCounts[item.list_id] || 0) + 1;
          });
        }

        const { data: members } = await supabase
          .from('todo_list_members')
          .select('list_id')
          .in('list_id', listIds);

        if (members) {
          members.forEach(m => {
            memberCounts[m.list_id] = (memberCounts[m.list_id] || 0) + 1;
          });
        }
      }

      return (data || []).map(list => ({
        ...list,
        item_count: itemCounts[list.id] || 0,
        member_count: memberCounts[list.id] || 0,
      }));
    },
    enabled: !!user,
  });
}

/**
 * Fetch members of a specific list
 */
export function useTodoListMembersQuery(listId: string | null) {
  return useQuery({
    queryKey: ['todo-list-members', listId],
    queryFn: async (): Promise<TodoListMember[]> => {
      if (!listId) return [];

      const { data, error } = await supabase
        .from('todo_list_members')
        .select(`
          *,
          user:user_profiles!todo_list_members_user_id_fkey(id, full_name, avatar_url)
        `)
        .eq('list_id', listId);

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
 * Create a new todo list with a default section
 */
export function useCreateTodoList() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      title,
      visibility = 'personal',
      color = 'blue-900',
      description,
    }: {
      title: string;
      visibility?: string;
      color?: string;
      description?: string;
    }) => {
      if (!user) throw new Error('User not authenticated');

      const { data: list, error: listError } = await supabase
        .from('todo_lists')
        .insert({
          title,
          visibility,
          color,
          description,
          created_by: user.id,
          sort_order: 0,
        })
        .select()
        .single();

      if (listError) throw listError;

      // Create default section
      const { error: sectionError } = await supabase
        .from('todo_sections')
        .insert({
          list_id: list.id,
          title: 'To Do',
          color,
          sort_order: 0,
        });

      if (sectionError) {
        console.warn('Failed to create default section:', sectionError);
      }

      return list;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['todo-lists'] });
    },
  });
}

/**
 * Update a todo list
 */
export function useUpdateTodoList() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: {
      id: string;
      title?: string;
      description?: string;
      visibility?: string;
      color?: string;
    }) => {
      const { data, error } = await supabase
        .from('todo_lists')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['todo-lists'] });
    },
  });
}

/**
 * Archive a todo list (soft delete)
 */
export function useArchiveTodoList() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (listId: string) => {
      const { data, error } = await supabase
        .from('todo_lists')
        .update({ archived_at: new Date().toISOString() })
        .eq('id', listId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['todo-lists'] });
      queryClient.invalidateQueries({ queryKey: ['todo-items'] });
      queryClient.invalidateQueries({ queryKey: ['todo-my-work'] });
    },
  });
}

/**
 * Reorder todo lists
 */
export function useReorderTodoLists() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (lists: { id: string; sort_order: number }[]) => {
      const updates = lists.map(({ id, sort_order }) =>
        supabase.from('todo_lists').update({ sort_order }).eq('id', id)
      );
      const results = await Promise.all(updates);
      const errors = results.filter(r => r.error);
      if (errors.length > 0) throw new Error(`Failed to reorder ${errors.length} list(s)`);
      return results;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['todo-lists'] });
    },
  });
}

/**
 * Add a member to a list
 */
export function useAddTodoListMember() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ listId, userId }: { listId: string; userId: string }) => {
      const { data, error } = await supabase
        .from('todo_list_members')
        .insert({ list_id: listId, user_id: userId, role: 'member' })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, { listId }) => {
      queryClient.invalidateQueries({ queryKey: ['todo-list-members', listId] });
      queryClient.invalidateQueries({ queryKey: ['todo-lists'] });
    },
  });
}

/**
 * Remove a member from a list
 */
export function useRemoveTodoListMember() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ listId, userId }: { listId: string; userId: string }) => {
      const { error } = await supabase
        .from('todo_list_members')
        .delete()
        .eq('list_id', listId)
        .eq('user_id', userId);

      if (error) throw error;
      return { listId, userId };
    },
    onSuccess: (_, { listId }) => {
      queryClient.invalidateQueries({ queryKey: ['todo-list-members', listId] });
      queryClient.invalidateQueries({ queryKey: ['todo-lists'] });
    },
  });
}

/**
 * Call the ensure_default_todo_list RPC on first load
 */
export function useEnsureDefaultList() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('ensure_default_todo_list');
      if (error) throw error;
      return data as { list_id: string; section_id?: string; created: boolean };
    },
    onSuccess: (data) => {
      if (data?.created) {
        queryClient.invalidateQueries({ queryKey: ['todo-lists'] });
      }
    },
  });
}
