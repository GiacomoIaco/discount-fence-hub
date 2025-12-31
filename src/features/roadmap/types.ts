export interface RoadmapItem {
  id: string;
  code: string;
  hub: string;
  title: string;
  raw_idea: string | null;
  claude_analysis: string | null;
  user_notes: string | null;
  status: 'idea' | 'researched' | 'approved' | 'in_progress' | 'done' | 'wont_do' | 'parked';
  importance: number | null;
  complexity: 'XS' | 'S' | 'M' | 'L' | 'XL' | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  session_notes: string | null;
  commit_refs: string[] | null;
  related_items: string[] | null;
  // Voice recording fields
  audio_url: string | null;
  voice_transcript: string | null;
  // Joined from user_profiles
  creator_name?: string;
  // Joined attachments
  attachments?: RoadmapAttachment[];
}

export type FileCategory = 'image' | 'video' | 'document' | 'audio' | 'other';

export interface RoadmapAttachment {
  id: string;
  roadmap_item_id: string;
  uploaded_by: string;
  file_name: string;
  file_url: string;
  file_type: FileCategory;
  file_size: number | null;
  mime_type: string | null;
  description: string | null;
  uploaded_at: string;
  // Joined from user_profiles
  uploader_name?: string;
}

export type StatusType = RoadmapItem['status'];
export type ComplexityType = NonNullable<RoadmapItem['complexity']>;

export const STATUS_CONFIG: Record<StatusType, { label: string; color: string; bgColor: string }> = {
  idea: { label: 'Idea', color: 'text-gray-600', bgColor: 'bg-gray-100' },
  researched: { label: 'Researched', color: 'text-blue-600', bgColor: 'bg-blue-100' },
  approved: { label: 'Approved', color: 'text-purple-600', bgColor: 'bg-purple-100' },
  in_progress: { label: 'In Progress', color: 'text-yellow-600', bgColor: 'bg-yellow-100' },
  done: { label: 'Done', color: 'text-green-600', bgColor: 'bg-green-100' },
  wont_do: { label: "Won't Do", color: 'text-red-600', bgColor: 'bg-red-100' },
  parked: { label: 'Parked', color: 'text-orange-600', bgColor: 'bg-orange-100' },
};

export const COMPLEXITY_CONFIG: Record<ComplexityType, { label: string; color: string }> = {
  XS: { label: 'Tiny (<1hr)', color: 'text-blue-600' },
  S: { label: 'Small (hours)', color: 'text-green-600' },
  M: { label: 'Medium (day)', color: 'text-yellow-600' },
  L: { label: 'Large (days)', color: 'text-orange-600' },
  XL: { label: 'Extra Large (week+)', color: 'text-red-600' },
};

// Helper to determine file category from mime type
export function getFileCategory(mimeType: string): FileCategory {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('audio/')) return 'audio';
  if (
    mimeType === 'application/pdf' ||
    mimeType.includes('document') ||
    mimeType.includes('sheet') ||
    mimeType.includes('text/')
  ) return 'document';
  return 'other';
}

// Format file size for display
export function formatFileSize(bytes: number | null): string {
  if (!bytes) return 'Unknown size';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}
