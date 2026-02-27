// ============================================
// useMyTodos — Barrel re-export from standalone todo hooks
// ============================================

// Re-export everything from the new standalone hooks
export {
  useTodoListsQuery,
  useTodoListMembersQuery,
  useCreateTodoList,
  useUpdateTodoList,
  useArchiveTodoList,
  useReorderTodoLists,
  useAddTodoListMember,
  useRemoveTodoListMember,
  useEnsureDefaultList,
} from './useTodoLists';

export {
  useTodoSectionsQuery,
  useCreateTodoSection,
  useUpdateTodoSection,
  useDeleteTodoSection,
  useReorderTodoSections,
} from './useTodoSections';

export {
  useTodoItemsQuery,
  useMyWorkQuery,
  useCreateTodoItem,
  useUpdateTodoItemStatus,
  useUpdateTodoItem,
  useDeleteTodoItem,
  useReorderTodoItems,
  useMoveTodoItem,
  useAddTodoItemFollower,
  useRemoveTodoItemFollower,
  useTodoItemCommentsQuery,
  useAddTodoItemComment,
  useDeleteTodoItemComment,
  useTodoLastCommentsQuery,
} from './useTodoItems';

// Re-export types
export type {
  TodoList,
  TodoListMember,
  TodoSection,
  TodoItem,
  TodoItemFollower,
  TodoItemComment,
  TodoVisibility,
  TodoItemStatus,
} from '../types';

// ============================================
// Task view helpers (localStorage, kept here)
// ============================================

const TASK_VIEWS_KEY = 'taskLastViewed';

export function getTaskLastViewed(): Record<string, string> {
  try {
    const stored = localStorage.getItem(TASK_VIEWS_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

export function setTaskViewed(taskId: string) {
  const views = getTaskLastViewed();
  views[taskId] = new Date().toISOString();
  localStorage.setItem(TASK_VIEWS_KEY, JSON.stringify(views));
}

export function isCommentUnread(taskId: string, commentCreatedAt: string): boolean {
  const views = getTaskLastViewed();
  const lastViewed = views[taskId];
  if (!lastViewed) return true;
  return new Date(commentCreatedAt) > new Date(lastViewed);
}
