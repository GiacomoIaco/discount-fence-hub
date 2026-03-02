import { useState, useRef, useEffect } from 'react';
import { Mic, Square, Loader2, X, CheckCircle, AlertCircle, RotateCcw, ListTodo, Map, Ticket, MessageSquare, HelpCircle } from 'lucide-react';
import { transcribeAudio } from '../lib/openai';
import { expandRoadmapIdea } from '../lib/claude';
import { supabase } from '../lib/supabase';
import { toastManager } from '../lib/toast';
import type { Section } from '../lib/routes';

type VoiceIntent = 'todo' | 'roadmap' | 'request' | 'meeting' | 'unknown';

interface ClassificationResult {
  intent: VoiceIntent;
  confidence: number;
  summary: string;
  todoTitle?: string;
  todoDueDate?: string;
  requestType?: 'pricing' | 'support' | 'material' | 'other';
}

interface VoiceRecordingModalProps {
  onClose: () => void;
  onNavigate: (section: Section) => void;
  userId?: string;
}

type RecordingState = 'idle' | 'recording' | 'processing' | 'classifying' | 'confirming' | 'creating' | 'success' | 'error' | 'manual';

const INTENT_CONFIG: Record<VoiceIntent, { icon: typeof Mic; label: string; color: string }> = {
  todo: { icon: ListTodo, label: 'My Todo', color: 'text-blue-600' },
  roadmap: { icon: Map, label: 'Roadmap Idea', color: 'text-purple-600' },
  request: { icon: Ticket, label: 'Request', color: 'text-orange-600' },
  meeting: { icon: MessageSquare, label: 'Sales Meeting', color: 'text-green-600' },
  unknown: { icon: HelpCircle, label: 'Unknown', color: 'text-gray-600' },
};

export default function VoiceRecordingModal({ onClose, onNavigate, userId }: VoiceRecordingModalProps) {
  const [state, setState] = useState<RecordingState>('idle');
  const [recordingTime, setRecordingTime] = useState(0);
  const [transcript, setTranscript] = useState('');
  const [detectedLanguage, setDetectedLanguage] = useState<string | undefined>();
  const [classification, setClassification] = useState<ClassificationResult | null>(null);
  const [createdItem, setCreatedItem] = useState<{ type: string; title: string } | null>(null);
  const [errorMessage, setErrorMessage] = useState('');

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const lastAudioBlobRef = useRef<Blob | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const mimeType = mediaRecorder.mimeType || 'audio/webm';
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        stream.getTracks().forEach(track => track.stop());
        await processRecording(audioBlob);
      };

      mediaRecorder.start(100);
      setState('recording');
      setRecordingTime(0);
      navigator.vibrate?.(50);

      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } catch (error) {
      console.error('Error starting recording:', error);
      toastManager.showError('Could not access microphone');
    }
  };

  const stopRecording = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    navigator.vibrate?.([50, 30, 50]);
  };

  const processRecording = async (audioBlob: Blob) => {
    setState('processing');
    lastAudioBlobRef.current = audioBlob;

    try {
      // Step 1: Transcribe
      const transcriptionResult = await transcribeAudio(audioBlob);
      const transcribedText = transcriptionResult.text;
      setTranscript(transcribedText);
      setDetectedLanguage(transcriptionResult.detectedLanguage);

      // Step 2: Classify intent
      setState('classifying');
      const classifyResponse = await fetch('/.netlify/functions/classify-voice-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript: transcribedText }),
      });

      if (!classifyResponse.ok) {
        throw new Error('classification');
      }

      const result: ClassificationResult = await classifyResponse.json();
      setClassification(result);

      // If confidence is high enough, show confirmation instead of auto-creating
      if (result.confidence >= 0.7 && result.intent !== 'unknown') {
        setState('confirming');
      } else {
        // Low confidence - let user choose
        setState('manual');
      }
    } catch (error) {
      console.error('Error processing recording:', error);
      const msg = error instanceof Error && error.message === 'classification'
        ? "Couldn't analyze intent. Tap retry."
        : "Couldn't transcribe audio. Check connection and try again.";
      setErrorMessage(msg);
      setState('error');
      navigator.vibrate?.(200);
    }
  };

  const autoCreate = async (result: ClassificationResult, transcribedText: string) => {
    setState('creating');

    try {
      switch (result.intent) {
        case 'todo':
          await createTodo(result.todoTitle || result.summary, result.todoDueDate);
          setCreatedItem({ type: 'Todo', title: result.todoTitle || result.summary });
          break;

        case 'roadmap':
          await createRoadmapItem(transcribedText);
          setCreatedItem({ type: 'Roadmap Idea', title: result.summary });
          break;

        case 'request':
          sessionStorage.setItem('quick-recording-transcript', transcribedText);
          sessionStorage.setItem('quick-recording-type', result.requestType || 'pricing');
          onNavigate('requests');
          toastManager.showSuccess('Opening request form with your recording...');
          onClose();
          return;

        case 'meeting':
          onNavigate('sales-coach');
          toastManager.showSuccess('Opening Sales Coach...');
          onClose();
          return;

        default:
          setState('manual');
          return;
      }

      setState('success');
      navigator.vibrate?.([100, 50, 100]);
      setTimeout(() => {
        onClose();
      }, 2000);
    } catch (error) {
      console.error('Error creating item:', error);
      const typeName = INTENT_CONFIG[result.intent]?.label || 'item';
      setErrorMessage(`Couldn't create ${typeName}. Tap retry.`);
      setState('error');
      navigator.vibrate?.(200);
    }
  };

  const createTodo = async (title: string, dueDate?: string) => {
    if (!userId) throw new Error('User not authenticated');

    let { data: lists } = await supabase
      .from('todo_lists')
      .select('id')
      .eq('created_by', userId)
      .order('sort_order', { ascending: true })
      .limit(1);

    let listId: string;
    let sectionId: string;

    if (lists && lists.length > 0) {
      listId = lists[0].id;
    } else {
      await supabase.rpc('ensure_default_todo_list');
      const { data: newLists } = await supabase
        .from('todo_lists')
        .select('id')
        .eq('created_by', userId)
        .order('sort_order', { ascending: true })
        .limit(1);
      if (!newLists || newLists.length === 0) throw new Error('Failed to create default list');
      listId = newLists[0].id;
    }

    const { data: sections } = await supabase
      .from('todo_sections')
      .select('id')
      .eq('list_id', listId)
      .order('sort_order', { ascending: true })
      .limit(1);

    if (!sections || sections.length === 0) throw new Error('No sections found in list');
    sectionId = sections[0].id;

    const { error: taskError } = await supabase
      .from('todo_items')
      .insert({
        section_id: sectionId,
        list_id: listId,
        title,
        due_date: dueDate || null,
        status: 'todo',
        sort_order: Date.now(),
        created_by: userId,
        assigned_to: userId,
      });

    if (taskError) throw taskError;
    toastManager.showSuccess('Todo created!');
  };

  const createRoadmapItem = async (rawIdea: string) => {
    const expanded = await expandRoadmapIdea(rawIdea);

    const { data: { user } } = await supabase.auth.getUser();

    const { error } = await supabase.from('roadmap_items').insert({
      hub: expanded.hub || 'general',
      title: expanded.title,
      raw_idea: expanded.raw_idea || rawIdea,
      claude_analysis: expanded.claude_analysis,
      importance: expanded.importance || 3,
      complexity: expanded.complexity || 'M',
      status: 'idea',
      created_by: user?.id || null,
    });

    if (error) throw error;
    toastManager.showSuccess('Roadmap idea created!');
  };

  const handleManualSelect = async (intent: VoiceIntent) => {
    if (!classification || !transcript) return;

    const updatedClassification: ClassificationResult = {
      ...classification,
      intent,
      confidence: 1,
    };

    await autoCreate(updatedClassification, transcript);
  };

  const handleRetry = () => {
    if (lastAudioBlobRef.current) {
      setErrorMessage('');
      processRecording(lastAudioBlobRef.current);
    }
  };

  const reset = () => {
    setState('idle');
    setRecordingTime(0);
    setTranscript('');
    setDetectedLanguage(undefined);
    setClassification(null);
    setCreatedItem(null);
    setErrorMessage('');
    lastAudioBlobRef.current = null;
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const renderContent = () => {
    // Idle state
    if (state === 'idle') {
      return (
        <div className="text-center py-8">
          <p className="text-gray-600 mb-6">Tap to start recording your voice note</p>
          <button
            onClick={startRecording}
            className="w-24 h-24 bg-gradient-to-br from-purple-600 to-blue-600 text-white rounded-full shadow-lg flex items-center justify-center mx-auto active:scale-95 transition-transform"
          >
            <Mic className="w-10 h-10" />
          </button>
          <p className="text-sm text-gray-500 mt-4">Voice notes are transcribed and categorized automatically</p>
        </div>
      );
    }

    // Recording state
    if (state === 'recording') {
      return (
        <div className="text-center py-8">
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
            <span className="text-red-600 font-medium">Recording</span>
          </div>
          <div className="text-4xl font-mono font-bold text-gray-800 mb-6">{formatTime(recordingTime)}</div>
          <button
            onClick={stopRecording}
            className="w-20 h-20 bg-red-600 text-white rounded-full shadow-lg flex items-center justify-center mx-auto hover:bg-red-700 transition-colors"
          >
            <Square className="w-8 h-8" />
          </button>
          <p className="text-sm text-gray-500 mt-4">Tap to stop recording</p>
        </div>
      );
    }

    // Processing states
    if (state === 'processing' || state === 'classifying' || state === 'creating') {
      const statusText = {
        processing: 'Transcribing...',
        classifying: 'Analyzing intent...',
        creating: 'Creating item...',
      }[state];

      return (
        <div className="text-center py-12">
          <Loader2 className="w-12 h-12 text-purple-600 animate-spin mx-auto mb-4" />
          <span className="text-gray-700 font-medium">{statusText}</span>
        </div>
      );
    }

    // Error state
    if (state === 'error') {
      return (
        <div className="text-center py-8">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-10 h-10 text-red-600" />
          </div>
          <div className="text-gray-800 font-medium mb-1">Something went wrong</div>
          <div className="text-sm text-gray-500 mb-6 max-w-xs mx-auto">{errorMessage}</div>
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={handleRetry}
              className="flex items-center gap-2 px-5 py-2.5 bg-purple-600 text-white rounded-xl font-medium active:scale-95 transition-transform"
            >
              <RotateCcw className="w-4 h-4" />
              Try Again
            </button>
            <button
              onClick={reset}
              className="px-5 py-2.5 text-gray-600 hover:text-gray-800 font-medium"
            >
              Record Again
            </button>
          </div>
        </div>
      );
    }

    // Confirmation state
    if (state === 'confirming' && classification && transcript) {
      const config = INTENT_CONFIG[classification.intent];
      const Icon = config.icon;

      return (
        <div className="py-4">
          {/* Transcript preview */}
          <div className="text-sm text-gray-500 bg-gray-50 rounded-lg p-3 mb-3 max-h-20 overflow-auto">
            "{transcript.substring(0, 200)}{transcript.length > 200 ? '...' : ''}"
          </div>

          {/* Detected language badge */}
          {detectedLanguage && detectedLanguage !== 'en' && detectedLanguage !== 'english' && (
            <div className="flex justify-center mb-3">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-700">
                Detected: {detectedLanguage.toUpperCase()}
              </span>
            </div>
          )}

          {/* Detected intent */}
          <div className="flex items-center gap-3 p-3 rounded-xl border-2 border-purple-500 bg-purple-50 mb-4">
            <Icon className={`w-6 h-6 ${config.color}`} />
            <div className="flex-1">
              <div className="font-medium text-gray-800">{config.label}</div>
              <div className="text-sm text-gray-500 truncate">{classification.summary}</div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-2">
            <button
              onClick={() => autoCreate(classification, transcript)}
              className="w-full px-4 py-3 bg-purple-600 text-white rounded-xl font-medium active:scale-[0.98] transition-transform"
            >
              Create {config.label}
            </button>
            <button
              onClick={() => setState('manual')}
              className="w-full px-4 py-2 text-gray-600 hover:text-gray-800 text-sm font-medium"
            >
              Change Type
            </button>
          </div>
        </div>
      );
    }

    // Success state
    if (state === 'success' && createdItem) {
      return (
        <div className="text-center py-8">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-10 h-10 text-green-600" />
          </div>
          <div className="font-semibold text-lg text-gray-800 mb-1">{createdItem.type} Created!</div>
          <div className="text-gray-600 max-w-xs mx-auto truncate">{createdItem.title}</div>
        </div>
      );
    }

    // Manual selection state
    if (state === 'manual' && classification) {
      return (
        <div className="py-4">
          <div className="text-center mb-4">
            <span className="font-medium text-gray-800">What type of item is this?</span>
          </div>

          {transcript && (
            <div className="text-sm text-gray-500 bg-gray-50 rounded-lg p-3 mb-4 max-h-20 overflow-auto">
              "{transcript.substring(0, 200)}{transcript.length > 200 ? '...' : ''}"
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            {(['todo', 'roadmap', 'request', 'meeting'] as VoiceIntent[]).map((intent) => {
              const config = INTENT_CONFIG[intent];
              const Icon = config.icon;
              const isDetected = classification.intent === intent;

              return (
                <button
                  key={intent}
                  onClick={() => handleManualSelect(intent)}
                  className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-colors ${
                    isDetected
                      ? 'border-purple-500 bg-purple-50'
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <Icon className={`w-6 h-6 ${config.color}`} />
                  <span className="text-sm font-medium text-gray-700">{config.label}</span>
                  {isDetected && (
                    <span className="text-xs text-purple-600">Detected</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      );
    }

    return null;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-lg bg-white rounded-t-2xl shadow-xl animate-slide-up safe-area-bottom">
        {/* Handle bar */}
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-10 h-1 bg-gray-300 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 pb-2">
          <h2 className="text-lg font-semibold text-gray-900">Voice Recording</h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="px-4 pb-6">
          {renderContent()}
        </div>
      </div>
    </div>
  );
}
