// API integration for Sales Coach recordings
import { addToOfflineQueue, getOfflineQueue, removeFromOfflineQueue, updateQueuedRecording, type QueuedRecording } from './offlineQueue';

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
    const recordings = getRecordings(userId);
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
      const recordings = getRecordings(userId);
      const updated = recordings.map(r =>
        r.id === recording.recordingId
          ? { ...r, status: 'analyzing' as const, transcription }
          : r
      );
      localStorage.setItem(`recordings_${userId}`, JSON.stringify(updated));
      notifyUpdate();

      // Step 3: Start analysis (async)
      debugLog(`📊 Starting analysis with transcript length: ${transcription.text?.length || 0}`);
      analyzeRecording(recording.recordingId, transcription.text, processType).then(analysis => {
        debugLog('🎯 Analysis completed!');
        // Update recording with analysis
        const recordings = getRecordings(userId);
        const updated = recordings.map(r =>
          r.id === recording.recordingId
            ? { ...r, status: 'completed' as const, analysis, completedAt: new Date().toISOString() }
            : r
        );
        localStorage.setItem(`recordings_${userId}`, JSON.stringify(updated));
        notifyUpdate();
      }).catch(error => {
        debugLog(`❌ Analysis failed: ${error.message}`);
        console.error('Analysis failed:', error);
        const recordings = getRecordings(userId);
        const updated = recordings.map(r =>
          r.id === recording.recordingId
            ? { ...r, status: 'failed' as const, error: error.message }
            : r
        );
        localStorage.setItem(`recordings_${userId}`, JSON.stringify(updated));
        notifyUpdate();
      });
    }).catch(error => {
      debugLog(`❌ Transcription failed: ${error.message}`);
      const recordings = getRecordings(userId);
      const updated = recordings.map(r =>
        r.id === recording.recordingId
          ? { ...r, status: 'failed' as const, error: error.message }
          : r
      );
      localStorage.setItem(`recordings_${userId}`, JSON.stringify(updated));
      notifyUpdate();
    });

    // Save initial recording to localStorage
    const recordings = getRecordings(userId);
    const newRecording: Recording = {
      ...recording,
      id: recording.recordingId,
      status: 'transcribing' as const
    };
    recordings.unshift(newRecording);
    localStorage.setItem(`recordings_${userId}`, JSON.stringify(recordings));

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
  const process = processType !== 'standard' ? getSalesProcess(processType) : null;
  const knowledgeBase = getKnowledgeBase();

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
export function getRecordings(userId: string): Recording[] {
  const saved = localStorage.getItem(`recordings_${userId}`);
  return saved ? JSON.parse(saved) : [];
}

// Get a single recording
export function getRecording(userId: string, recordingId: string): Recording | undefined {
  const recordings = getRecordings(userId);
  return recordings.find(r => r.id === recordingId);
}

// Delete a recording
export function deleteRecording(userId: string, recordingId: string): void {
  const recordings = getRecordings(userId);
  const filtered = recordings.filter(r => r.id !== recordingId);
  localStorage.setItem(`recordings_${userId}`, JSON.stringify(filtered));
}

// Get user statistics
export function getUserStats(userId: string) {
  const recordings = getRecordings(userId).filter(r => r.status === 'completed');

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

// Sales Process Management
export function getSalesProcesses(): SalesProcess[] {
  const saved = localStorage.getItem('salesProcesses');
  return saved ? JSON.parse(saved) : [];
}

export function getSalesProcess(id: string): SalesProcess | undefined {
  const processes = getSalesProcesses();
  return processes.find(p => p.id === id);
}

export function saveSalesProcess(process: SalesProcess): void {
  const processes = getSalesProcesses();
  const existing = processes.findIndex(p => p.id === process.id);

  if (existing >= 0) {
    processes[existing] = process;
  } else {
    processes.push(process);
  }

  localStorage.setItem('salesProcesses', JSON.stringify(processes));
}

export function deleteSalesProcess(id: string): void {
  const processes = getSalesProcesses();
  const filtered = processes.filter(p => p.id !== id);
  localStorage.setItem('salesProcesses', JSON.stringify(filtered));
}

// Knowledge Base Management
export function getKnowledgeBase(): KnowledgeBase {
  const saved = localStorage.getItem('knowledgeBase');
  return saved ? JSON.parse(saved) : {
    companyInfo: '',
    products: [],
    commonObjections: [],
    bestPractices: [],
    industryContext: ''
  };
}

export function saveKnowledgeBase(kb: KnowledgeBase): void {
  kb.lastUpdated = new Date().toISOString();
  localStorage.setItem('knowledgeBase', JSON.stringify(kb));
}

// Manager Review Management
export function addManagerReview(
  userId: string,
  recordingId: string,
  review: Omit<ManagerReview, 'reviewedAt'>
): void {
  const recordings = getRecordings(userId);
  const updated = recordings.map(r =>
    r.id === recordingId
      ? { ...r, managerReview: { ...review, reviewedAt: new Date().toISOString() } }
      : r
  );
  localStorage.setItem(`recordings_${userId}`, JSON.stringify(updated));
  notifyUpdate();
}

export function removeManagerReview(userId: string, recordingId: string): void {
  const recordings = getRecordings(userId);
  const updated = recordings.map(r =>
    r.id === recordingId
      ? { ...r, managerReview: undefined }
      : r
  );
  localStorage.setItem(`recordings_${userId}`, JSON.stringify(updated));
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
      const recordings = getRecordings(queuedRecording.userId);
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
        const recordings = getRecordings(queuedRecording.userId);
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
export { getOfflineQueue } from './offlineQueue';

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
    const allRecordings = getRecordings(user.id).filter(r => r.status === 'completed');

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
