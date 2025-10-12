/**
 * Supabase Database Operations for AI Sales Coach
 *
 * This module handles all Supabase operations for recordings, sales processes,
 * and knowledge bases. Used in dual-write mode alongside localStorage.
 */

import { supabase } from './supabase';
import type { Recording, SalesProcess, KnowledgeBase, ManagerReview } from './recordings';
import {
  RecordingSchema,
  ManagerReviewSchema,
  validateData
} from './validation';

// =====================================================
// RECORDINGS
// =====================================================

/**
 * Save a recording to Supabase
 * Validates recording data before saving
 */
export async function saveRecordingToSupabase(recording: Recording, userId: string): Promise<boolean> {
  try {
    // ✅ VALIDATE RECORDING DATA
    const validationResult = validateData(RecordingSchema, {
      id: recording.id,
      clientName: recording.clientName,
      meetingDate: recording.meetingDate,
      duration: recording.duration,
      status: recording.status,
      processType: recording.processType,
      uploadedAt: recording.uploadedAt,
      completedAt: recording.completedAt,
      transcription: recording.transcription,
      analysis: recording.analysis,
      error: recording.error,
    });

    if (!validationResult.success) {
      console.error('Recording validation failed:', validationResult.errors);
      return false;
    }

    const validatedRecording = validationResult.data;

    const { error } = await supabase
      .from('recordings')
      .upsert({
        id: validatedRecording.id,
        user_id: userId,
        client_name: validatedRecording.clientName,
        meeting_date: validatedRecording.meetingDate,
        duration: validatedRecording.duration,
        status: validatedRecording.status,
        process_type: validatedRecording.processType,
        uploaded_at: validatedRecording.uploadedAt,
        completed_at: validatedRecording.completedAt,
        transcription: validatedRecording.transcription || null,
        analysis: validatedRecording.analysis || null,
        error_message: validatedRecording.error || null,
      }, {
        onConflict: 'id'
      });

    if (error) {
      console.error('Error saving recording to Supabase:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Exception saving recording to Supabase:', error);
    return false;
  }
}

/**
 * Get all recordings for a user from Supabase
 */
export async function getRecordingsFromSupabase(userId: string): Promise<Recording[]> {
  try {
    const { data, error } = await supabase
      .from('recordings')
      .select('*')
      .eq('user_id', userId)
      .order('uploaded_at', { ascending: false });

    if (error) {
      console.error('Error fetching recordings from Supabase:', error);
      return [];
    }

    if (!data) return [];

    // Map Supabase data to Recording format
    return data.map(row => ({
      id: row.id,
      userId: row.user_id,
      clientName: row.client_name,
      meetingDate: row.meeting_date,
      duration: row.duration,
      status: row.status,
      uploadedAt: row.uploaded_at,
      completedAt: row.completed_at,
      processType: row.process_type,
      transcription: row.transcription,
      analysis: row.analysis,
      error: row.error_message,
    }));
  } catch (error) {
    console.error('Exception fetching recordings from Supabase:', error);
    return [];
  }
}

/**
 * Get a single recording from Supabase
 */
export async function getRecordingFromSupabase(userId: string, recordingId: string): Promise<Recording | null> {
  try {
    const { data, error } = await supabase
      .from('recordings')
      .select('*')
      .eq('user_id', userId)
      .eq('id', recordingId)
      .single();

    if (error || !data) {
      return null;
    }

    return {
      id: data.id,
      userId: data.user_id,
      clientName: data.client_name,
      meetingDate: data.meeting_date,
      duration: data.duration,
      status: data.status,
      uploadedAt: data.uploaded_at,
      completedAt: data.completed_at,
      processType: data.process_type,
      transcription: data.transcription,
      analysis: data.analysis,
      error: data.error_message,
    };
  } catch (error) {
    console.error('Exception fetching recording from Supabase:', error);
    return null;
  }
}

/**
 * Delete a recording from Supabase
 */
export async function deleteRecordingFromSupabase(userId: string, recordingId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('recordings')
      .delete()
      .eq('user_id', userId)
      .eq('id', recordingId);

    if (error) {
      console.error('Error deleting recording from Supabase:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Exception deleting recording from Supabase:', error);
    return false;
  }
}

// =====================================================
// SALES PROCESSES
// =====================================================

/**
 * Get all sales processes from Supabase
 */
export async function getSalesProcessesFromSupabase(): Promise<SalesProcess[]> {
  try {
    const { data, error } = await supabase
      .from('sales_processes')
      .select('*')
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching sales processes from Supabase:', error);
      return [];
    }

    if (!data) return [];

    return data.map(row => ({
      id: row.id,
      name: row.name,
      steps: row.steps,
      createdBy: row.created_by,
      createdAt: row.created_at,
    }));
  } catch (error) {
    console.error('Exception fetching sales processes from Supabase:', error);
    return [];
  }
}

/**
 * Get a single sales process from Supabase
 */
export async function getSalesProcessFromSupabase(id: string): Promise<SalesProcess | null> {
  try {
    const { data, error } = await supabase
      .from('sales_processes')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) {
      return null;
    }

    return {
      id: data.id,
      name: data.name,
      steps: data.steps,
      createdBy: data.created_by,
      createdAt: data.created_at,
    };
  } catch (error) {
    console.error('Exception fetching sales process from Supabase:', error);
    return null;
  }
}

/**
 * Save a sales process to Supabase
 */
export async function saveSalesProcessToSupabase(process: SalesProcess, userId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('sales_processes')
      .upsert({
        id: process.id,
        name: process.name,
        steps: process.steps,
        created_by: userId,
        is_default: false,
      }, {
        onConflict: 'id'
      });

    if (error) {
      console.error('Error saving sales process to Supabase:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Exception saving sales process to Supabase:', error);
    return false;
  }
}

/**
 * Delete a sales process from Supabase
 */
export async function deleteSalesProcessFromSupabase(id: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('sales_processes')
      .delete()
      .eq('id', id)
      .eq('is_default', false); // Can't delete default process

    if (error) {
      console.error('Error deleting sales process from Supabase:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Exception deleting sales process from Supabase:', error);
    return false;
  }
}

// =====================================================
// KNOWLEDGE BASE
// =====================================================

/**
 * Get active knowledge base from Supabase
 */
export async function getKnowledgeBaseFromSupabase(): Promise<KnowledgeBase | null> {
  try {
    const { data, error } = await supabase
      .from('knowledge_bases')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !data) {
      return null;
    }

    return {
      companyInfo: data.company_info || '',
      products: data.products || [],
      commonObjections: data.common_objections || [],
      bestPractices: data.best_practices || [],
      industryContext: data.industry_context || '',
      lastUpdated: data.updated_at,
      updatedBy: data.last_updated_by,
    };
  } catch (error) {
    console.error('Exception fetching knowledge base from Supabase:', error);
    return null;
  }
}

/**
 * Save knowledge base to Supabase
 */
export async function saveKnowledgeBaseToSupabase(kb: KnowledgeBase, userId: string): Promise<boolean> {
  try {
    // Deactivate all existing knowledge bases first
    await supabase
      .from('knowledge_bases')
      .update({ is_active: false })
      .eq('is_active', true);

    // Insert new active knowledge base
    const { error } = await supabase
      .from('knowledge_bases')
      .insert({
        company_info: kb.companyInfo,
        products: kb.products,
        common_objections: kb.commonObjections,
        best_practices: kb.bestPractices,
        industry_context: kb.industryContext,
        created_by: userId,
        last_updated_by: userId,
        is_active: true,
      });

    if (error) {
      console.error('Error saving knowledge base to Supabase:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Exception saving knowledge base to Supabase:', error);
    return false;
  }
}

// =====================================================
// MANAGER REVIEWS
// =====================================================

/**
 * Add a manager review to Supabase
 * Validates review data before saving
 */
export async function addManagerReviewToSupabase(
  recordingId: string,
  review: Omit<ManagerReview, 'reviewedAt'>
): Promise<boolean> {
  try {
    // ✅ VALIDATE MANAGER REVIEW DATA
    const validationResult = validateData(ManagerReviewSchema, {
      reviewerId: review.reviewerId,
      reviewerName: review.reviewerName,
      rating: review.rating,
      comments: review.comments,
      keyTakeaways: review.keyTakeaways,
      actionItems: review.actionItems,
    });

    if (!validationResult.success) {
      console.error('Manager review validation failed:', validationResult.errors);
      return false;
    }

    const validatedReview = validationResult.data;

    const { error } = await supabase
      .from('manager_reviews')
      .upsert({
        recording_id: recordingId,
        reviewer_id: validatedReview.reviewerId,
        reviewer_name: validatedReview.reviewerName,
        rating: validatedReview.rating,
        comments: validatedReview.comments,
        key_takeaways: validatedReview.keyTakeaways || [],
        action_items: validatedReview.actionItems || [],
      }, {
        onConflict: 'recording_id'
      });

    if (error) {
      console.error('Error saving manager review to Supabase:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Exception saving manager review to Supabase:', error);
    return false;
  }
}

/**
 * Remove a manager review from Supabase
 */
export async function removeManagerReviewFromSupabase(recordingId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('manager_reviews')
      .delete()
      .eq('recording_id', recordingId);

    if (error) {
      console.error('Error deleting manager review from Supabase:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Exception deleting manager review from Supabase:', error);
    return false;
  }
}

// =====================================================
// MIGRATION HELPERS
// =====================================================

/**
 * Check if user has any data in Supabase
 */
export async function hasSupabaseData(userId: string): Promise<boolean> {
  try {
    const { count } = await supabase
      .from('recordings')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId);

    return (count || 0) > 0;
  } catch (error) {
    return false;
  }
}

/**
 * Migrate all localStorage recordings to Supabase
 * Returns: { success: number, failed: number, total: number }
 */
export async function migrateLocalStorageToSupabase(
  userId: string,
  recordings: Recording[],
  onProgress?: (current: number, total: number) => void
): Promise<{ success: number; failed: number; total: number }> {
  let success = 0;
  let failed = 0;
  const total = recordings.length;

  for (let i = 0; i < recordings.length; i++) {
    const recording = recordings[i];
    const saved = await saveRecordingToSupabase(recording, userId);

    if (saved) {
      success++;
    } else {
      failed++;
    }

    if (onProgress) {
      onProgress(i + 1, total);
    }
  }

  return { success, failed, total };
}
