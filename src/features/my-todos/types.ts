// ============================================
// Standalone To-Dos Types
// ============================================

export type TodoVisibility = 'open' | 'private' | 'personal';
export type TodoItemStatus = 'todo' | 'in_progress' | 'done' | 'blocked';
export type TodoListMemberRole = 'owner' | 'member';

export interface TodoList {
  id: string;
  title: string;
  description: string | null;
  visibility: TodoVisibility;
  color: string;
  created_by: string;
  archived_at: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
  // Computed in queries
  item_count?: number;
  member_count?: number;
}

export interface TodoListMember {
  id: string;
  list_id: string;
  user_id: string;
  role: TodoListMemberRole;
  created_at: string;
  user?: {
    id: string;
    full_name: string;
    avatar_url: string | null;
  };
}

export interface TodoSection {
  id: string;
  list_id: string;
  title: string;
  color: string;
  is_collapsed: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface TodoItem {
  id: string;
  section_id: string;
  list_id: string;
  title: string;
  description: string | null;
  notes: string | null;
  status: TodoItemStatus;
  assigned_to: string | null;
  created_by: string;
  due_date: string | null;
  is_high_priority: boolean;
  sort_order: number;
  completed_at: string | null;
  completed_by: string | null;
  // Recurrence
  recurrence_rule: string | null;       // 'daily' | 'weekly' | 'monthly' | 'custom' | null
  recurrence_interval: number | null;   // e.g., 2 (every 2 weeks)
  recurrence_days: string[] | null;     // e.g., ['mon','wed','fri'] for custom
  recurrence_end_date: string | null;   // optional end date
  recurrence_parent_id: string | null;  // links instances to original
  created_at: string;
  updated_at: string;
  archived_at: string | null;
  // Joined data
  assigned_user?: {
    id: string;
    full_name: string;
    avatar_url: string | null;
  } | null;
  section?: TodoSection;
  list?: TodoList;
  followers?: TodoItemFollower[];
}

export interface TodoItemFollower {
  id: string;
  item_id: string;
  user_id: string;
  created_at: string;
  user?: {
    id: string;
    full_name: string;
    avatar_url: string | null;
  };
}

export interface TodoItemComment {
  id: string;
  item_id: string;
  user_id: string;
  content: string;
  file_url: string | null;
  file_name: string | null;
  file_type: string | null;
  created_at: string;
  updated_at: string;
  user?: {
    id: string;
    full_name: string;
    avatar_url: string | null;
  };
}

export interface TodoItemAttachment {
  id: string;
  item_id: string;
  uploaded_by: string;
  file_name: string;
  file_url: string;
  file_type: string;
  file_size: number | null;
  mime_type: string | null;
  description: string | null;
  uploaded_at: string;
}
