import { useState, useRef, useEffect } from 'react';
import { Mic, Square, Loader2, X, CheckCircle, ListTodo, Map, Ticket, MessageSquare, HelpCircle } from 'lucide-react';
import { transcribeAudio } from '../lib/openai';
import { expandRoadmapIdea } from '../lib/claude';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';

type VoiceIntent = 'todo' | 'roadmap' | 'request' | 'meeting' | 'unknown';
type Section = 'home' | 'custom-pricing' | 'requests' | 'my-requests' | 'presentation' | 'stain-calculator' | 'sales-coach' | 'sales-coach-admin' | 'photo-gallery' | 'sales-resources' | 'dashboard' | 'request-queue' | 'analytics' | 'team' | 'manager-dashboard' | 'team-communication' | 'direct-messages' | 'assignment-rules' | 'bom-calculator' | 'leadership' | 'my-todos' | 'yard' | 'roadmap';

interface ClassificationResult {
  intent: VoiceIntent;
  confidence: number;
  summary: string;
  todoTitle?: string;
  todoDueDate?: string;
  requestType?: 'pricing' | 'support' | 'material' | 'other';
}

interface QuickRecordingFABProps {
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

export default function QuickRecordingFAB({ onNavigate, userId }: QuickRecordingFABProps) {
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
      const transcribedText = await transcribeAudio(audioBlob);
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
          reset();
          return;

        case 'meeting':
          // For meetings, navigate to sales coach
          onNavigate('sales-coach');
          toast.success('Opening Sales Coach...');
          reset();
          return;

        default:
          setState('manual');
          return;
      }

      setState('success');
      setTimeout(() => reset(), 2500);
    } catch (error) {
      console.error('Error creating item:', error);
      toast.error('Failed to create item');
      setState('manual');
    }
  };

  const createTodo = async (title: string, dueDate?: string) => {
    if (!userId) throw new Error('User not authenticated');

    // Get or create a "Quick Tasks" personal initiative
    const { data: existingInitiatives } = await supabase
      .from('project_initiatives')
      .select('id')
      .eq('created_by', userId)
      .eq('is_personal', true)
      .eq('title', 'Quick Tasks')
      .single();

    let initiativeId: string;

    if (existingInitiatives) {
      initiativeId = existingInitiatives.id;
    } else {
      // Create the Quick Tasks initiative
      const { data: newInitiative, error: initError } = await supabase
        .from('project_initiatives')
        .insert({
          title: 'Quick Tasks',
          description: 'Tasks created via voice recording',
          is_personal: true,
          is_private: false,
          status: 'active',
          priority: 'medium',
          progress_percent: 0,
          color_status: 'green',
          is_active: true,
          created_by: userId,
          sort_order: 0,
        })
        .select('id')
        .single();

      if (initError) throw initError;
      initiativeId = newInitiative.id;
    }

    // Create the task
    const { error: taskError } = await supabase
      .from('project_tasks')
      .insert({
        initiative_id: initiativeId,
        title,
        due_date: dueDate || null,
        status: 'todo',
        sort_order: 0,
        created_by: userId,
        owner_id: userId,
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

  // Idle state - show FAB
  if (state === 'idle') {
    return (
      <button
        onClick={startRecording}
        className="fixed bottom-6 right-4 w-14 h-14 bg-gradient-to-br from-purple-600 to-blue-600 text-white rounded-full shadow-lg flex items-center justify-center active:scale-95 transition-transform z-40"
        title="Quick Voice Recording"
      >
        <Mic className="w-6 h-6" />
      </button>
    );
  }

  // Recording state - show recording indicator
  if (state === 'recording') {
    return (
      <div className="fixed bottom-6 right-4 z-40">
        <div className="bg-white rounded-2xl shadow-xl p-4 w-64">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
              <span className="text-red-600 font-medium">Recording</span>
            </div>
            <span className="text-2xl font-mono font-bold text-gray-800">{formatTime(recordingTime)}</span>
          </div>
          <button
            onClick={stopRecording}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors font-medium"
          >
            <Square className="w-5 h-5" />
            Stop Recording
          </button>
        </div>
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
      <div className="fixed bottom-6 right-4 z-40">
        <div className="bg-white rounded-2xl shadow-xl p-4 w-64">
          <div className="flex items-center justify-center gap-3 py-4">
            <Loader2 className="w-6 h-6 text-purple-600 animate-spin" />
            <span className="text-gray-700 font-medium">{statusText}</span>
          </div>
        </div>
      </div>
    );
  }

  // Success state
  if (state === 'success' && createdItem) {
    return (
      <div className="fixed bottom-6 right-4 z-40">
        <div className="bg-white rounded-2xl shadow-xl p-4 w-72">
          <div className="flex items-center gap-3 text-green-600">
            <CheckCircle className="w-6 h-6" />
            <div>
              <div className="font-medium">{createdItem.type} Created!</div>
              <div className="text-sm text-gray-600 truncate">{createdItem.title}</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Manual selection state
  if (state === 'manual' && classification) {
    return (
      <div className="fixed bottom-6 right-4 z-40">
        <div className="bg-white rounded-2xl shadow-xl p-4 w-80">
          <div className="flex items-center justify-between mb-3">
            <span className="font-medium text-gray-800">What is this?</span>
            <button onClick={reset} className="p-1 text-gray-400 hover:text-gray-600">
              <X className="w-5 h-5" />
            </button>
          </div>

          {transcript && (
            <div className="text-xs text-gray-500 bg-gray-50 rounded-lg p-2 mb-3 max-h-16 overflow-auto">
              "{transcript.substring(0, 150)}{transcript.length > 150 ? '...' : ''}"
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            {(['todo', 'roadmap', 'request', 'meeting'] as VoiceIntent[]).map((intent) => {
              const config = INTENT_CONFIG[intent];
              const Icon = config.icon;
              const isDetected = classification.intent === intent;

              return (
                <button
                  key={intent}
                  onClick={() => handleManualSelect(intent)}
                  className={`flex flex-col items-center gap-1 p-3 rounded-xl border-2 transition-colors ${
                    isDetected
                      ? 'border-purple-500 bg-purple-50'
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <Icon className={`w-5 h-5 ${config.color}`} />
                  <span className="text-xs font-medium text-gray-700">{config.label}</span>
                  {isDetected && (
                    <span className="text-[10px] text-purple-600">Detected</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  return null;
}
