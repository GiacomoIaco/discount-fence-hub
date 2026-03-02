import { useState, useRef, useEffect } from 'react';
import { Mic, StopCircle, Play, Pause, Loader2, X, Sparkles } from 'lucide-react';
import { transcribeAudio } from '../../lib/openai';
import toast from 'react-hot-toast';

export type VoiceInputState = 'idle' | 'recording' | 'recorded' | 'transcribing';

interface VoiceInputProps {
  onTranscript: (transcript: string) => void;
  onProcess?: (transcript: string) => Promise<void>;
  processButtonLabel?: string;
  placeholder?: string;
  compact?: boolean;
  className?: string;
}

export default function VoiceInput({
  onTranscript,
  onProcess,
  processButtonLabel = 'Process',
  placeholder = 'Tap to record',
  compact = false,
  className = '',
}: VoiceInputProps) {
  const [state, setState] = useState<VoiceInputState>('idle');
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioDuration, setAudioDuration] = useState(0);
  const [recordingTime, setRecordingTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackProgress, setPlaybackProgress] = useState(0);
  const [transcript, setTranscript] = useState('');

  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const recordingStartTimeRef = useRef<number>(0);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, [audioUrl]);

  const stopTimer = () => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      recordingStartTimeRef.current = Date.now();

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const url = URL.createObjectURL(blob);
        setAudioBlob(blob);
        setAudioUrl(url);
        setAudioDuration(Math.floor((Date.now() - recordingStartTimeRef.current) / 1000));
        setState('recorded');
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start(100);
      setState('recording');
      setRecordingTime(0);

      timerIntervalRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } catch (error) {
      console.error('Error starting recording:', error);
      toast.error('Failed to start recording. Check microphone permissions.');
    }
  };

  const stopRecording = () => {
    stopTimer();
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  };

  const playAudio = () => {
    if (audioRef.current) {
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  const pauseAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current && audioRef.current.duration && isFinite(audioRef.current.duration)) {
      setPlaybackProgress((audioRef.current.currentTime / audioRef.current.duration) * 100);
    }
  };

  const handleAudioEnded = () => {
    setIsPlaying(false);
    setPlaybackProgress(0);
  };

  const handleTranscribe = async () => {
    if (!audioBlob) return;

    setState('transcribing');
    try {
      const result = await transcribeAudio(audioBlob);
      setTranscript(result.text);
      onTranscript(result.text);
      toast.success('Transcribed!');
    } catch (error: any) {
      console.error('Transcription error:', error);
      toast.error(`Transcription failed: ${error.message}`);
      setState('recorded');
    }
  };

  const handleProcess = async () => {
    if (!transcript || !onProcess) return;

    setState('transcribing');
    try {
      await onProcess(transcript);
    } catch (error: any) {
      console.error('Process error:', error);
      toast.error(`Processing failed: ${error.message}`);
    } finally {
      setState('recorded');
    }
  };

  const clearRecording = () => {
    stopTimer();
    setState('idle');
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(null);
    setAudioBlob(null);
    setRecordingTime(0);
    setAudioDuration(0);
    setTranscript('');
    setPlaybackProgress(0);
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Compact mode for inline use
  if (compact) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        {state === 'idle' && (
          <button
            type="button"
            onClick={startRecording}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition-colors"
            title={placeholder}
          >
            <Mic className="w-4 h-4" />
            <span className="hidden sm:inline">Record</span>
          </button>
        )}

        {state === 'recording' && (
          <button
            type="button"
            onClick={stopRecording}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors animate-pulse"
          >
            <StopCircle className="w-4 h-4" />
            <span>{formatDuration(recordingTime)}</span>
          </button>
        )}

        {state === 'recorded' && audioUrl && (
          <>
            <audio
              ref={audioRef}
              src={audioUrl}
              onTimeUpdate={handleTimeUpdate}
              onEnded={handleAudioEnded}
              className="hidden"
            />
            <button
              type="button"
              onClick={isPlaying ? pauseAudio : playAudio}
              className="p-1.5 bg-gray-100 text-gray-600 rounded hover:bg-gray-200"
            >
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            </button>
            <span className="text-xs text-gray-500">{formatDuration(audioDuration)}</span>
            {!transcript ? (
              <button
                type="button"
                onClick={handleTranscribe}
                className="flex items-center gap-1 px-2 py-1 text-xs bg-purple-600 text-white rounded hover:bg-purple-700"
              >
                <Sparkles className="w-3 h-3" />
                Transcribe
              </button>
            ) : onProcess && (
              <button
                type="button"
                onClick={handleProcess}
                className="flex items-center gap-1 px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                <Sparkles className="w-3 h-3" />
                {processButtonLabel}
              </button>
            )}
            <button
              type="button"
              onClick={clearRecording}
              className="p-1 text-gray-400 hover:text-gray-600"
            >
              <X className="w-4 h-4" />
            </button>
          </>
        )}

        {state === 'transcribing' && (
          <div className="flex items-center gap-2 text-purple-600">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm">Processing...</span>
          </div>
        )}

        {transcript && (
          <span className="text-xs text-gray-500 truncate max-w-[200px]" title={transcript}>
            "{transcript.substring(0, 50)}..."
          </span>
        )}
      </div>
    );
  }

  // Full mode (card-style)
  return (
    <div className={`bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg p-4 border border-purple-200 ${className}`}>
      <div className="flex items-center gap-2 mb-3">
        <Mic className="w-5 h-5 text-purple-600" />
        <span className="font-medium text-purple-900">Voice Input</span>
      </div>

      {state === 'idle' && (
        <button
          type="button"
          onClick={startRecording}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
        >
          <Mic className="w-5 h-5" />
          <span>{placeholder}</span>
        </button>
      )}

      {state === 'recording' && (
        <div className="space-y-3">
          <div className="flex flex-col items-center justify-center py-4 bg-red-50 rounded-xl border-2 border-red-200">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-4 h-4 bg-red-500 rounded-full animate-pulse shadow-lg shadow-red-500/50" />
              <span className="text-red-600 font-semibold text-lg">Recording</span>
            </div>
            <div className="text-3xl font-bold text-red-700 font-mono">
              {formatDuration(recordingTime)}
            </div>
          </div>
          <button
            type="button"
            onClick={stopRecording}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            <StopCircle className="w-5 h-5" />
            <span>Stop Recording</span>
          </button>
        </div>
      )}

      {state === 'recorded' && audioUrl && (
        <div className="space-y-3">
          <div className="flex items-center gap-3 bg-white rounded-lg p-3 border border-gray-200">
            <button
              type="button"
              onClick={isPlaying ? pauseAudio : playAudio}
              className="p-2 bg-purple-100 text-purple-600 rounded-full hover:bg-purple-200 transition-colors"
            >
              {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
            </button>
            <div className="flex-1">
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-purple-600 transition-all"
                  style={{ width: `${playbackProgress}%` }}
                />
              </div>
            </div>
            <span className="text-sm text-gray-500">{formatDuration(audioDuration)}</span>
          </div>

          <audio
            ref={audioRef}
            src={audioUrl}
            onTimeUpdate={handleTimeUpdate}
            onEnded={handleAudioEnded}
            className="hidden"
          />

          <div className="flex gap-2">
            <button
              type="button"
              onClick={clearRecording}
              className="px-3 py-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Clear
            </button>
            {!transcript ? (
              <button
                type="button"
                onClick={handleTranscribe}
                className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
              >
                <Sparkles className="w-4 h-4" />
                <span>Transcribe</span>
              </button>
            ) : onProcess && (
              <button
                type="button"
                onClick={handleProcess}
                className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Sparkles className="w-4 h-4" />
                <span>{processButtonLabel}</span>
              </button>
            )}
          </div>

          {transcript && (
            <div className="text-sm text-gray-600 bg-white rounded-lg p-3 border border-gray-200">
              <strong className="text-gray-700">Transcript:</strong> {transcript}
            </div>
          )}
        </div>
      )}

      {state === 'transcribing' && (
        <div className="flex items-center justify-center gap-3 py-6">
          <Loader2 className="w-5 h-5 text-purple-600 animate-spin" />
          <span className="text-purple-600">Processing...</span>
        </div>
      )}
    </div>
  );
}
