import { useState, useRef, useEffect } from 'react';
import { Mic, Square, Loader2, X, CheckCircle, ListTodo, Map, Ticket, MessageSquare, HelpCircle } from 'lucide-react';
import { transcribeAudio } from '../lib/openai';
import { expandRoadmapIdea } from '../lib/claude';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
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

type RecordingState = 'idle' | 'recording' | 'processing' | 'classifying' | 'creating' | 'success' | 'manual';

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
  const [classification, setClassification] = useState<ClassificationResult | null>(null);
  const [createdItem, setCreatedItem] = useState<{ type: string; title: string } | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

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
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        stream.getTracks().forEach(track => track.stop());
        await processRecording(audioBlob);
      };

      mediaRecorder.start(100);
      setState('recording');
      setRecordingTime(0);

      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } catch (error) {
      console.error('Error starting recording:', error);
      toast.error('Could not access microphone');
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
  };

  const processRecording = async (audioBlob: Blob) => {
    setState('processing');

    try {
      // Step 1: Transcribe
      const transcriptionResult = await transcribeAudio(audioBlob);
      const transcribedText = transcriptionResult.text;
      setTranscript(transcribedText);

      // Step 2: Classify intent
      setState('classifying');
      const classifyResponse = await fetch('/.netlify/functions/classify-voice-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript: transcribedText }),
      });

      if (!classifyResponse.ok) {
        throw new Error('Classification failed');
      }

      const result: ClassificationResult = await classifyResponse.json();
      setClassification(result);

      // If confidence is high enough, auto-create
      if (result.confidence >= 0.7 && result.intent !== 'unknown') {
        await autoCreate(result, transcribedText);
      } else {
        // Low confidence - let user choose
        setState('manual');
      }
    } catch (error) {
      console.error('Error processing recording:', error);
      toast.error('Failed to process recording');
      reset();
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
          // For requests, navigate to the request form with pre-filled data
          sessionStorage.setItem('quick-recording-transcript', transcribedText);
          sessionStorage.setItem('quick-recording-type', result.requestType || 'pricing');
          onNavigate('requests');
          toast.success('Opening request form with your recording...');
          onClose();
          return;

        case 'meeting':
          // For meetings, navigate to sales coach
          onNavigate('sales-coach');
          toast.success('Opening Sales Coach...');
          onClose();
          return;

        default:
          setState('manual');
          return;
      }

      setState('success');
      setTimeout(() => {
        onClose();
      }, 2000);
    } catch (error) {
      console.error('Error creating item:', error);
      toast.error('Failed to create item');
      setState('manual');
    }
  };

  const createTodo = async (title: string, dueDate?: string) => {
    if (!userId) throw new Error('User not authenticated');

    // Find user's first todo list
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
      // Create default list via RPC
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

    // Get first section of the list
    const { data: sections } = await supabase
      .from('todo_sections')
      .select('id')
      .eq('list_id', listId)
      .order('sort_order', { ascending: true })
      .limit(1);

    if (!sections || sections.length === 0) throw new Error('No sections found in list');
    sectionId = sections[0].id;

    // Create the todo item
    const { error: taskError } = await supabase
      .from('todo_items')
      .insert({
        section_id: sectionId,
        list_id: listId,
        title,
        due_date: dueDate || null,
        status: 'todo',
        sort_order: Date.now(), // Use timestamp to put at end
        created_by: userId,
        assigned_to: userId,
      });

    if (taskError) throw taskError;
    toast.success('Todo created!');
  };

  const createRoadmapItem = async (rawIdea: string) => {
    // Use existing expand roadmap idea function
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
    toast.success('Roadmap idea created!');
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

  const reset = () => {
    setState('idle');
    setRecordingTime(0);
    setTranscript('');
    setClassification(null);
    setCreatedItem(null);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Render the modal content based on state
  const renderContent = () => {
    // Idle state - show big record button
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
