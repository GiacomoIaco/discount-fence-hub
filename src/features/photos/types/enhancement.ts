/**
 * Types for photo enhancement progress tracking
 */

export interface EnhancementProgress {
  photoId: string;
  photoUrl: string;
  fileName: string;
  status: 'pending' | 'enhancing' | 'complete' | 'error';
  enhancedUrl?: string;
  error?: string;
  startedAt?: string;
  completedAt?: string;
}

export interface EnhancementQueueState {
  items: EnhancementProgress[];
  currentIndex: number;
  isProcessing: boolean;
  totalCount: number;
  completedCount: number;
  errorCount: number;
}

export type EnhancementCallback = (photoId: string, enhancedUrl: string | null) => void;
