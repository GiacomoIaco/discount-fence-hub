// API integration for Sales Coach recordings
import { addToOfflineQueue, getOfflineQueue, removeFromOfflineQueue, updateQueuedRecording, type QueuedRecording } from '../../../lib/offlineQueue';
import {
  saveRecordingToSupabase,
  getRecordingsFromSupabase,
  getRecordingFromSupabase,
  deleteRecordingFromSupabase,
  getSalesProcessesFromSupabase,
  getSalesProcessFromSupabase,
  saveSalesProcessToSupabase,
  deleteSalesProcessFromSupabase,
  getKnowledgeBaseFromSupabase,
  saveKnowledgeBaseToSupabase,
  addManagerReviewToSupabase,
  removeManagerReviewFromSupabase,
} from './recordings-db';
import { supabase } from '../../../lib/supabase';

export interface ManagerReview {
  reviewerId: string;
  reviewerName: string;
  rating: number;
  comments: string;
  keyTakeaways?: string[];
  actionItems?: string[];
  reviewedAt: string;
}

export interface Recording {
  id: string;
  userId: string;
  clientName: string;
  meetingDate: string;
  duration: string;
  status: 'uploaded' | 'transcribing' | 'analyzing' | 'completed' | 'failed';
  uploadedAt: string;
  completedAt?: string;
  processType: string;
  transcription?: {
    text: string;
    duration: string;
    confidence: number;
    speakers: Array<{
      id: string;
      label: string;
      segments: number;
    }>;
  };
  analysis?: {
    overallScore: number;
    processSteps: Array<{
      name: string;
      completed: boolean;
      quality: number;
      feedback: string;
      examples?: string[];
      missedOpportunities?: string[];
    }>;
    metrics: {
      talkListenRatio: string;
      questionsAsked: number;
      objections: number;
      callToActions: number;
      rapportMoments?: number;
      valueStatements?: number;
    };
    strengths: string[];
    improvements: string[];
    keyMoments: Array<{
      timestamp: string;
      description: string;
      type: 'positive' | 'negative' | 'neutral' | 'turning_point';
      impact: string;
      quote?: string;
    }>;
    coachingPriorities: string[];
    predictedOutcome?: {
      likelihood: 'high' | 'medium' | 'low';
      reasoning: string;
      nextSteps: string;
    };
    sentiment?: {
      overall: 'positive' | 'neutral' | 'negative';
      overallScore: number;
      clientSentiment: 'positive' | 'neutral' | 'negative';
      repSentiment: 'positive' | 'neutral' | 'negative';
      sentimentShift: string;
      emotionalHighs: Array<{
        timestamp: string;
        description: string;
        quote: string;
      }>;
      emotionalLows: Array<{
        timestamp: string;
        description: string;
        quote: string;
      }>;
      empathyMoments: Array<{
        timestamp: string;
        description: string;
        quote: string;
        impact: string;
      }>;
    };
  };
  managerReview?: ManagerReview;
  error?: string;
}

export interface SalesProcess {
  id: string;
  name: string;
  steps: Array<{
    name: string;
    description: string;
    keyBehaviors: string[];
  }>;
  createdBy?: string;
  createdAt?: string;
}

export interface KnowledgeBase {
  companyInfo: string;
  products: string[];
  commonObjections: string[];
  bestPractices: string[];
  industryContext: string;
  lastUpdated?: string;
  updatedBy?: string;
}

// Debug logger
let debugCallback: ((msg: string) => void) | null = null;
let updateCallback: (() => void) | null = null;

export function setDebugCallback(callback: (msg: string) => void) {
  debugCallback = callback;
}

export function setUpdateCallback(callback: () => void) {
  updateCallback = callback;
}

function debugLog(message: string) {
  console.log(message);
  if (debugCallback) {
    debugCallback(message);
  }
}

function notifyUpdate() {
  // Dispatch custom event
  window.dispatchEvent(new Event('recordings-updated'));

  if (updateCallback) {
    updateCallback();
  }
}

// Check if online
function isOnline(): boolean {
  return navigator.onLine;
}

// Upload and process a recording
export async function uploadRecording(
  audioBlob: Blob,
  userId: string,
  clientName: string,
  meetingDate: string,
  processType: string = 'standard'
): Promise<Recording> {
  // If offline, queue for later
  if (!isOnline()) {
    debugLog('📵 Offline - adding to queue');
    await addToOfflineQueue({
      audioBlob,
      userId,
      clientName,
      meetingDate,
      processType,
    });

    // Return a placeholder recording
    const placeholderRecording: Recording = {
      id: `queued_${Date.now()}`,
      userId,
      clientName,
      meetingDate,
      duration: '0:00',
      status: 'uploaded',
      uploadedAt: new Date().toISOString(),
      processType,
      error: 'Queued for upload when online',
    };

    // Save to localStorage
    const recordings = getRecordingsSync(userId);
    recordings.unshift(placeholderRecording);
    localStorage.setItem(`recordings_${userId}`, JSON.stringify(recordings));
    notifyUpdate();

    return placeholderRecording;
  }

  try {
    debugLog('🎙️ Starting upload...');
    // Convert blob to base64
    const arrayBuffer = await audioBlob.arrayBuffer();
    const base64Audio = btoa(
      new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
    );

    // Step 1: Upload recording
    const uploadResponse = await fetch('/.netlify/functions/upload-recording', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        audioData: base64Audio,
        userId,
        clientName,
        meetingDate,
        processType
      }),
    });

    if (!uploadResponse.ok) {
      const error = await uploadResponse.json();
      throw new Error(error.error || 'Upload failed');
    }

    const recording = await uploadResponse.json();

    // Step 2: Start transcription (async)
    debugLog(`📝 Starting transcription for ${recording.recordingId}`);
    transcribeRecording(recording.recordingId, base64Audio).then(transcription => {
      debugLog('✅ Transcription completed!');
      debugLog(`📄 Transcription object keys: ${Object.keys(transcription).join(', ')}`);
      debugLog(`📝 Has text field: ${!!transcription.text}, Length: ${transcription.text?.length || 0}`);
      // Update recording in localStorage with transcription
      const recordings = getRecordingsSync(userId);
      const updated = recordings.map(r =>
        r.id === recording.recordingId
          ? { ...r, status: 'analyzing' as const, transcription }
          : r
      );
      localStorage.setItem(`recordings_${userId}`, JSON.stringify(updated));

      // Also save to Supabase (dual-write)
      const updatedRecording = updated.find(r => r.id === recording.recordingId);
      if (updatedRecording) {
        saveRecordingToSupabase(updatedRecording, userId).catch(err =>
          console.error('Failed to save transcription to Supabase:', err)
        );
      }

      notifyUpdate();

      // Step 3: Start analysis (async)
      debugLog(`📊 Starting analysis with transcript length: ${transcription.text?.length || 0}`);
      analyzeRecording(recording.recordingId, transcription.text, processType).then(analysis => {
        debugLog('🎯 Analysis completed!');
        // Update recording with analysis
        const recordings = getRecordingsSync(userId);
        const updated = recordings.map(r =>
          r.id === recording.recordingId
            ? { ...r, status: 'completed' as const, analysis, completedAt: new Date().toISOString() }
            : r
        );
        localStorage.setItem(`recordings_${userId}`, JSON.stringify(updated));

        // Also save to Supabase (dual-write)
        const updatedRecording = updated.find(r => r.id === recording.recordingId);
        if (updatedRecording) {
          saveRecordingToSupabase(updatedRecording, userId).catch(err =>
            console.error('Failed to save analysis to Supabase:', err)
          );
        }

        notifyUpdate();
      }).catch(error => {
        debugLog(`❌ Analysis failed: ${error.message}`);
        console.error('Analysis failed:', error);
        const recordings = getRecordingsSync(userId);
        const updated = recordings.map(r =>
          r.id === recording.recordingId
            ? { ...r, status: 'failed' as const, error: error.message }
            : r
        );
        localStorage.setItem(`recordings_${userId}`, JSON.stringify(updated));

        // Also save to Supabase (dual-write)
        const updatedRecording = updated.find(r => r.id === recording.recordingId);
        if (updatedRecording) {
          saveRecordingToSupabase(updatedRecording, userId).catch(err =>
            console.error('Failed to save error to Supabase:', err)
          );
        }

        notifyUpdate();
      });
    }).catch(error => {
      debugLog(`❌ Transcription failed: ${error.message}`);
      const recordings = getRecordingsSync(userId);
      const updated = recordings.map(r =>
        r.id === recording.recordingId
          ? { ...r, status: 'failed' as const, error: error.message }
          : r
      );
      localStorage.setItem(`recordings_${userId}`, JSON.stringify(updated));

      // Also save to Supabase (dual-write)
      const updatedRecording = updated.find(r => r.id === recording.recordingId);
      if (updatedRecording) {
        saveRecordingToSupabase(updatedRecording, userId).catch(err =>
          console.error('Failed to save error to Supabase:', err)
        );
      }

      notifyUpdate();
    });

    // Save initial recording to localStorage
    const recordings = getRecordingsSync(userId);
    const newRecording: Recording = {
      ...recording,
      id: recording.recordingId,
      status: 'transcribing' as const
    };
    recordings.unshift(newRecording);
    localStorage.setItem(`recordings_${userId}`, JSON.stringify(recordings));

    // Also save to Supabase (dual-write)
    saveRecordingToSupabase(newRecording, userId).catch(err =>
      console.error('Failed to save initial recording to Supabase:', err)
    );

    return newRecording;
  } catch (error) {
    console.error('Upload error:', error);
    throw error;
  }
}

// Transcribe audio (start + poll)
async function transcribeRecording(_recordingId: string, base64Audio: string) {
  // Step 1: Start transcription
  const startResponse = await fetch('/.netlify/functions/start-transcription', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ audioData: base64Audio }),
  });

  if (!startResponse.ok) {
    const error = await startResponse.json();
    throw new Error(error.error || 'Failed to start transcription');
  }

  const { transcriptId } = await startResponse.json();
  debugLog(`🔄 Transcript ID: ${transcriptId}`);

  // Step 2: Poll for completion
  let attempts = 0;
  const maxAttempts = 120; // 6 minutes max (3 seconds per attempt)

  while (attempts < maxAttempts) {
    await new Promise(resolve => setTimeout(resolve, 3000)); // Wait 3 seconds

    const checkResponse = await fetch(`/.netlify/functions/check-transcription?id=${transcriptId}`);

    if (!checkResponse.ok) {
      const error = await checkResponse.json();
      debugLog(`❌ Check failed: ${error.error}`);
      throw new Error(error.error || 'Failed to check transcription');
    }

    const result = await checkResponse.json();
    debugLog(`⏳ Status check ${attempts + 1}: ${result.status}`);

    if (result.status === 'completed') {
      return result;
    }

    attempts++;
  }

  throw new Error('Transcription timeout - took longer than 6 minutes');
}

// Analyze transcript
async function analyzeRecording(_recordingId: string, transcript: string, processType: string) {
  // Get custom process if not standard
  const process = processType !== 'standard' ? await getSalesProcess(processType) : null;
  const knowledgeBase = await getKnowledgeBase();

  const response = await fetch('/.netlify/functions/analyze-recording', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      transcript,
      processType: process,
      knowledgeBase
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Analysis failed');
  }

  return await response.json();
}

// Get all recordings for a user
export async function getRecordings(userId: string): Promise<Recording[]> {
  // Try Supabase first
  try {
    const recordings = await getRecordingsFromSupabase(userId);
    if (recordings.length > 0) {
      return recordings;
    }
  } catch (error) {
    console.error('Failed to fetch recordings from Supabase, falling back to localStorage:', error);
  }

  // Fallback to localStorage
  const saved = localStorage.getItem(`recordings_${userId}`);
  return saved ? JSON.parse(saved) : [];
}

// Synchronous version for backward compatibility (uses localStorage only)
export function getRecordingsSync(userId: string): Recording[] {
  const saved = localStorage.getItem(`recordings_${userId}`);
  return saved ? JSON.parse(saved) : [];
}

// Get a single recording
export async function getRecording(userId: string, recordingId: string): Promise<Recording | undefined> {
  // Try Supabase first
  try {
    const recording = await getRecordingFromSupabase(userId, recordingId);
    if (recording) {
      return recording;
    }
  } catch (error) {
    console.error('Failed to fetch recording from Supabase, falling back to localStorage:', error);
  }

  // Fallback to localStorage
  const recordings = getRecordingsSync(userId);
  return recordings.find(r => r.id === recordingId);
}

// Delete a recording
export async function deleteRecording(userId: string, recordingId: string): Promise<void> {
  // Delete from localStorage
  const recordings = getRecordingsSync(userId);
  const filtered = recordings.filter(r => r.id !== recordingId);
  localStorage.setItem(`recordings_${userId}`, JSON.stringify(filtered));

  // Also delete from Supabase (dual-write)
  try {
    await deleteRecordingFromSupabase(userId, recordingId);
  } catch (error) {
    console.error('Failed to delete recording from Supabase:', error);
  }
}

// Get user statistics
export function getUserStats(userId: string) {
  const recordings = getRecordingsSync(userId).filter(r => r.status === 'completed');

  if (recordings.length === 0) {
    return {
      totalRecordings: 0,
      averageScore: 0,
      completionRate: 0,
      improvement: 0
    };
  }

  const scores = recordings.map(r => r.analysis?.overallScore || 0);
  const averageScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);

  // Calculate improvement (last 5 vs previous 5)
  const recent = scores.slice(0, 5);
  const previous = scores.slice(5, 10);
  const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
  const previousAvg = previous.length > 0 ? previous.reduce((a, b) => a + b, 0) / previous.length : recentAvg;
  const improvement = Math.round(recentAvg - previousAvg);

  // Calculate completion rate (completed all 5 steps)
  const completedAll = recordings.filter(r =>
    r.analysis?.processSteps.every(step => step.completed)
  ).length;
  const completionRate = Math.round((completedAll / recordings.length) * 100);

  return {
    totalRecordings: recordings.length,
    averageScore,
    completionRate,
    improvement
  };
}

// Default Sales Process
const DEFAULT_SALES_PROCESS: SalesProcess = {
  id: 'standard',
  name: 'Standard 5-Step Sales Process',
  steps: [
    {
      name: 'Greeting & Rapport Building',
      description: 'Establish connection and build trust',
      keyBehaviors: [
        'Warm and professional greeting',
        'Small talk to establish rapport',
        'Set agenda for the meeting',
        'Build initial trust'
      ]
    },
    {
      name: 'Needs Discovery',
      description: 'Understand client pain points and goals through questions',
      keyBehaviors: [
        'Ask open-ended questions',
        'Active listening',
        'Probe for pain points',
        'Understand budget and timeline',
        'Identify decision makers'
      ]
    },
    {
      name: 'Product Presentation',
      description: 'Present solution matching their specific needs',
      keyBehaviors: [
        'Tailor presentation to discovered needs',
        'Focus on benefits not features',
        'Use stories and examples',
        'Address specific pain points',
        'Demonstrate value clearly'
      ]
    },
    {
      name: 'Objection Handling',
      description: 'Address concerns and hesitations professionally',
      keyBehaviors: [
        'Listen to objections fully',
        'Validate concerns',
        'Provide evidence-based responses',
        'Reframe objections as opportunities',
        'Confirm resolution'
      ]
    },
    {
      name: 'Closing',
      description: 'Ask for commitment and establish next steps',
      keyBehaviors: [
        'Trial close throughout',
        'Ask for the sale directly',
        'Create urgency when appropriate',
        'Outline clear next steps',
        'Confirm commitment'
      ]
    }
  ],
  createdBy: 'system',
  createdAt: new Date().toISOString()
};

// Sales Process Management
export async function getSalesProcesses(): Promise<SalesProcess[]> {
  // Try Supabase first
  try {
    const processes = await getSalesProcessesFromSupabase();
    if (processes.length > 0) {
      return processes;
    }
  } catch (error) {
    console.error('Failed to fetch sales processes from Supabase, falling back to localStorage:', error);
  }

  // Fallback to localStorage
  const saved = localStorage.getItem('salesProcesses');
  const processes = saved ? JSON.parse(saved) : [];

  // Always include default process if not already present
  const hasDefault = processes.some((p: SalesProcess) => p.id === 'standard');
  if (!hasDefault) {
    processes.unshift(DEFAULT_SALES_PROCESS);
  }

  return processes;
}

// Synchronous version for backward compatibility
export function getSalesProcessesSync(): SalesProcess[] {
  const saved = localStorage.getItem('salesProcesses');
  const processes = saved ? JSON.parse(saved) : [];

  // Always include default process if not already present
  const hasDefault = processes.some((p: SalesProcess) => p.id === 'standard');
  if (!hasDefault) {
    processes.unshift(DEFAULT_SALES_PROCESS);
  }

  return processes;
}

export async function getSalesProcess(id: string): Promise<SalesProcess | undefined> {
  // Try Supabase first
  try {
    const process = await getSalesProcessFromSupabase(id);
    if (process) {
      return process;
    }
  } catch (error) {
    console.error('Failed to fetch sales process from Supabase, falling back to localStorage:', error);
  }

  // Fallback to localStorage
  const processes = getSalesProcessesSync();
  return processes.find(p => p.id === id);
}

export async function saveSalesProcess(process: SalesProcess): Promise<void> {
  // Save to localStorage
  const processes = getSalesProcessesSync();
  const existing = processes.findIndex(p => p.id === process.id);

  if (existing >= 0) {
    processes[existing] = process;
  } else {
    processes.push(process);
  }

  localStorage.setItem('salesProcesses', JSON.stringify(processes));

  // Also save to Supabase (dual-write)
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await saveSalesProcessToSupabase(process, user.id);
    }
  } catch (error) {
    console.error('Failed to save sales process to Supabase:', error);
  }
}

export async function deleteSalesProcess(id: string): Promise<void> {
  // Delete from localStorage
  const processes = getSalesProcessesSync();
  const filtered = processes.filter(p => p.id !== id);
  localStorage.setItem('salesProcesses', JSON.stringify(filtered));

  // Also delete from Supabase (dual-write)
  try {
    await deleteSalesProcessFromSupabase(id);
  } catch (error) {
    console.error('Failed to delete sales process from Supabase:', error);
  }
}

// Knowledge Base Management
export async function getKnowledgeBase(): Promise<KnowledgeBase> {
  // Try Supabase first
  try {
    const kb = await getKnowledgeBaseFromSupabase();
    if (kb) {
      return kb;
    }
  } catch (error) {
    console.error('Failed to fetch knowledge base from Supabase, falling back to localStorage:', error);
  }

  // Fallback to localStorage
  const saved = localStorage.getItem('knowledgeBase');
  return saved ? JSON.parse(saved) : {
    companyInfo: '',
    products: [],
    commonObjections: [],
    bestPractices: [],
    industryContext: ''
  };
}

// Synchronous version for backward compatibility
export function getKnowledgeBaseSync(): KnowledgeBase {
  const saved = localStorage.getItem('knowledgeBase');
  return saved ? JSON.parse(saved) : {
    companyInfo: '',
    products: [],
    commonObjections: [],
    bestPractices: [],
    industryContext: ''
  };
}

export async function saveKnowledgeBase(kb: KnowledgeBase): Promise<void> {
  // Save to localStorage
  kb.lastUpdated = new Date().toISOString();
  localStorage.setItem('knowledgeBase', JSON.stringify(kb));

  // Also save to Supabase (dual-write)
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await saveKnowledgeBaseToSupabase(kb, user.id);
    }
  } catch (error) {
    console.error('Failed to save knowledge base to Supabase:', error);
  }
}

// Manager Review Management
export async function addManagerReview(
  userId: string,
  recordingId: string,
  review: Omit<ManagerReview, 'reviewedAt'>
): Promise<void> {
  // Update in localStorage
  const recordings = getRecordingsSync(userId);
  const updated = recordings.map(r =>
    r.id === recordingId
      ? { ...r, managerReview: { ...review, reviewedAt: new Date().toISOString() } }
      : r
  );
  localStorage.setItem(`recordings_${userId}`, JSON.stringify(updated));

  // Also save to Supabase (dual-write)
  try {
    await addManagerReviewToSupabase(recordingId, review);
  } catch (error) {
    console.error('Failed to save manager review to Supabase:', error);
  }

  notifyUpdate();
}

export async function removeManagerReview(userId: string, recordingId: string): Promise<void> {
  // Remove from localStorage
  const recordings = getRecordingsSync(userId);
  const updated = recordings.map(r =>
    r.id === recordingId
      ? { ...r, managerReview: undefined }
      : r
  );
  localStorage.setItem(`recordings_${userId}`, JSON.stringify(updated));

  // Also remove from Supabase (dual-write)
  try {
    await removeManagerReviewFromSupabase(recordingId);
  } catch (error) {
    console.error('Failed to remove manager review from Supabase:', error);
  }

  notifyUpdate();
}

// Process offline queue - upload all queued recordings
export async function processOfflineQueue(): Promise<void> {
  if (!isOnline()) {
    debugLog('📵 Still offline - skipping queue processing');
    return;
  }

  const queue = await getOfflineQueue();
  if (queue.length === 0) {
    return;
  }

  debugLog(`📤 Processing ${queue.length} queued recordings`);

  for (const queuedRecording of queue) {
    try {
      debugLog(`⬆️ Uploading queued recording: ${queuedRecording.clientName}`);

      // Remove placeholder from localStorage
      const recordings = getRecordingsSync(queuedRecording.userId);
      const filtered = recordings.filter(r => !r.id.startsWith('queued_'));
      localStorage.setItem(`recordings_${queuedRecording.userId}`, JSON.stringify(filtered));

      // Upload the recording
      await uploadRecording(
        queuedRecording.audioBlob,
        queuedRecording.userId,
        queuedRecording.clientName,
        queuedRecording.meetingDate,
        queuedRecording.processType
      );

      // Remove from queue
      await removeFromOfflineQueue(queuedRecording.id);
      debugLog(`✅ Successfully uploaded: ${queuedRecording.clientName}`);
    } catch (error: any) {
      debugLog(`❌ Failed to upload: ${queuedRecording.clientName} - ${error.message}`);

      // Update retry count
      const updatedRecording: QueuedRecording = {
        ...queuedRecording,
        attempts: queuedRecording.attempts + 1,
        lastError: error.message,
      };

      // Remove from queue if too many attempts (max 3)
      if (updatedRecording.attempts >= 3) {
        debugLog(`🗑️ Removing from queue after 3 failed attempts: ${queuedRecording.clientName}`);
        await removeFromOfflineQueue(queuedRecording.id);

        // Update placeholder with error
        const recordings = getRecordingsSync(queuedRecording.userId);
        const updated = recordings.map(r =>
          r.clientName === queuedRecording.clientName && r.id.startsWith('queued_')
            ? { ...r, status: 'failed' as const, error: `Upload failed after 3 attempts: ${error.message}` }
            : r
        );
        localStorage.setItem(`recordings_${queuedRecording.userId}`, JSON.stringify(updated));
        notifyUpdate();
      } else {
        await updateQueuedRecording(updatedRecording);
      }
    }
  }
}

// Get offline queue size
export { getOfflineQueue } from '../../../lib/offlineQueue';

// Team Leaderboard
export interface LeaderboardEntry {
  userId: string;
  userName: string;
  totalRecordings: number;
  averageScore: number;
  completionRate: number;
  improvement: number;
  totalCallTime: number; // in minutes
  rank: number;
}

export function getTeamLeaderboard(timeframe: 'week' | 'month' | 'all' = 'all'): LeaderboardEntry[] {
  // Get all users from localStorage (in a real app, this would come from a database)
  const users = [
    { id: 'user123', name: 'Sales Rep 1' },
    { id: 'user456', name: 'Sales Rep 2' },
    { id: 'user789', name: 'Sales Rep 3' },
    // In production, fetch actual user list from Supabase
  ];

  const now = new Date();
  const cutoffDate = new Date();
  if (timeframe === 'week') {
    cutoffDate.setDate(now.getDate() - 7);
  } else if (timeframe === 'month') {
    cutoffDate.setMonth(now.getMonth() - 1);
  }

  const leaderboard: LeaderboardEntry[] = users.map(user => {
    const allRecordings = getRecordingsSync(user.id).filter(r => r.status === 'completed');

    // Filter by timeframe
    const recordings = timeframe === 'all'
      ? allRecordings
      : allRecordings.filter(r => new Date(r.uploadedAt) >= cutoffDate);

    if (recordings.length === 0) {
      return {
        userId: user.id,
        userName: user.name,
        totalRecordings: 0,
        averageScore: 0,
        completionRate: 0,
        improvement: 0,
        totalCallTime: 0,
        rank: 0,
      };
    }

    const scores = recordings.map(r => r.analysis?.overallScore || 0);
    const averageScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);

    // Calculate improvement (recent vs previous)
    const recent = scores.slice(0, Math.ceil(scores.length / 2));
    const previous = scores.slice(Math.ceil(scores.length / 2));
    const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
    const previousAvg = previous.length > 0 ? previous.reduce((a, b) => a + b, 0) / previous.length : recentAvg;
    const improvement = Math.round(recentAvg - previousAvg);

    // Calculate completion rate
    const completedAll = recordings.filter(r =>
      r.analysis?.processSteps.every(step => step.completed)
    ).length;
    const completionRate = Math.round((completedAll / recordings.length) * 100);

    // Calculate total call time
    const totalCallTime = recordings.reduce((total, r) => {
      const [mins, secs] = r.duration.split(':').map(Number);
      return total + mins + (secs / 60);
    }, 0);

    return {
      userId: user.id,
      userName: user.name,
      totalRecordings: recordings.length,
      averageScore,
      completionRate,
      improvement,
      totalCallTime: Math.round(totalCallTime),
      rank: 0, // Will be set after sorting
    };
  });

  // Sort by average score, then by total recordings
  leaderboard.sort((a, b) => {
    if (b.averageScore !== a.averageScore) {
      return b.averageScore - a.averageScore;
    }
    return b.totalRecordings - a.totalRecordings;
  });

  // Assign ranks
  leaderboard.forEach((entry, index) => {
    entry.rank = index + 1;
  });

  return leaderboard;
}

export function getUserRank(userId: string, timeframe: 'week' | 'month' | 'all' = 'all'): number {
  const leaderboard = getTeamLeaderboard(timeframe);
  const entry = leaderboard.find(e => e.userId === userId);
  return entry?.rank || 0;
}
