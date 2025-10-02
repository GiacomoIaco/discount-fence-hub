// API integration for Sales Coach recordings

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
  };
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
  if (updateCallback) {
    updateCallback();
  }
}

// Upload and process a recording
export async function uploadRecording(
  audioBlob: Blob,
  userId: string,
  clientName: string,
  meetingDate: string,
  processType: string = 'standard'
): Promise<Recording> {
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
