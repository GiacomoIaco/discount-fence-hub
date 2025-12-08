export interface RoadmapItem {
  id: string;
  code: string;
  hub: string;
  title: string;
  raw_idea: string | null;
  claude_analysis: string | null;
  status: 'idea' | 'researched' | 'approved' | 'in_progress' | 'done' | 'wont_do';
  importance: number | null;
  complexity: 'S' | 'M' | 'L' | 'XL' | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  session_notes: string | null;
  commit_refs: string[] | null;
  related_items: string[] | null;
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
};

export const COMPLEXITY_CONFIG: Record<ComplexityType, { label: string; color: string }> = {
  S: { label: 'Small (hours)', color: 'text-green-600' },
  M: { label: 'Medium (day)', color: 'text-yellow-600' },
  L: { label: 'Large (days)', color: 'text-orange-600' },
  XL: { label: 'Extra Large (week+)', color: 'text-red-600' },
};
