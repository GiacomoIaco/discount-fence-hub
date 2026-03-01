/**
 * VoiceMessageRecorder - Inline voice message recorder for chat composers
 * Provides mic button, recording UI with timer, upload to Supabase, and inline playback
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { Mic, Square, Send, Trash2, Loader2, Play, Pause } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { transcribeAudio } from '../../../lib/openai';
import { useAuth } from '../../../contexts/AuthContext';
import { cn } from '../../../lib/utils';
import toast from 'react-hot-toast';

const MAX_DURATION = 120; // 2 minutes max

interface VoiceMessageRecorderProps {
  /** Called with the public URL of the uploaded audio file */
  onSend: (audioUrl: string, durationSeconds: number, transcript?: string) => void;
  disabled?: boolean;
  /** Supabase storage bucket name */
  bucket?: string;
  /** Start recording immediately on mount (skip idle state) */
  autoStart?: boolean;
  /** Called when user discards recording or cancels */
  onCancel?: () => void;
}

type RecorderState = 'idle' | 'recording' | 'recorded' | 'uploading';

export function VoiceMessageRecorder({
  onSend,
  disabled = false,
  bucket = 'voice-messages',
  autoStart = false,
  onCancel,
}: VoiceMessageRecorderProps) {
  const { user } = useAuth();
  const [state, setState] = useState<RecorderState>('idle');
  const [duration, setDuration] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackProgress, setPlaybackProgress] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioBlobRef = useRef<Blob | null>(null);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, []);

  // Auto-start recording on mount if requested
  useEffect(() => {
    if (autoStart && state === 'idle') {
      startRecording();
    }
  }, [autoStart]);

  const cleanup = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    if (audioElementRef.current) {
      audioElementRef.current.pause();
      audioElementRef.current = null;
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
  }, [audioUrl]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : 'audio/webm',
      });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        audioBlobRef.current = audioBlob;
        const url = URL.createObjectURL(audioBlob);
        setAudioUrl(url);
        setState('recorded');

        // Stop tracks
        stream.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      };

      mediaRecorder.start(100);
      setState('recording');
      setDuration(0);

      timerRef.current = setInterval(() => {
        setDuration(prev => {
          if (prev >= MAX_DURATION) {
            stopRecording();
            return MAX_DURATION;
          }
          return prev + 1;
        });
      }, 1000);
    } catch (error) {
      console.error('Error starting recording:', error);
      toast.error('Could not access microphone. Check permissions.');
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

  const discardRecording = () => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    if (audioElementRef.current) {
      audioElementRef.current.pause();
      audioElementRef.current = null;
    }
    setAudioUrl(null);
    audioBlobRef.current = null;
    setDuration(0);
    setIsPlaying(false);
    setPlaybackProgress(0);
    setState('idle');
    onCancel?.();
  };

  const togglePlayback = () => {
    if (!audioUrl) return;

    if (!audioElementRef.current) {
      const audio = new Audio(audioUrl);
      audioElementRef.current = audio;

      audio.onended = () => {
        setIsPlaying(false);
        setPlaybackProgress(0);
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
        }
      };
    }

    const audio = audioElementRef.current;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    } else {
      audio.play();
      setIsPlaying(true);
      updateProgress();
    }
  };

  const updateProgress = () => {
    const audio = audioElementRef.current;
    if (audio && !audio.paused) {
      const progress = audio.duration > 0 ? (audio.currentTime / audio.duration) * 100 : 0;
      setPlaybackProgress(progress);
      animationFrameRef.current = requestAnimationFrame(updateProgress);
    }
  };

  const handleSend = async () => {
    if (!audioBlobRef.current || !user) return;

    setState('uploading');

    try {
      const audioBlob = audioBlobRef.current;
      const fileName = `voice-msg-${Date.now()}.webm`;
      const filePath = `${user.id}/${fileName}`;

      // Upload audio and transcribe in parallel
      const [uploadResult, transcript] = await Promise.all([
        supabase.storage
          .from(bucket)
          .upload(filePath, audioBlob, {
            contentType: 'audio/webm',
            cacheControl: '3600',
          }),
        transcribeAudio(audioBlob).catch((err) => {
          console.warn('Transcription failed, sending without:', err);
          return undefined;
        }),
      ]);

      if (uploadResult.error) throw uploadResult.error;

      const { data } = supabase.storage.from(bucket).getPublicUrl(filePath);

      if (!data?.publicUrl) throw new Error('Failed to get public URL');

      onSend(data.publicUrl, duration, transcript || undefined);

      // Reset after successful send
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      if (audioElementRef.current) {
        audioElementRef.current.pause();
        audioElementRef.current = null;
      }
      setAudioUrl(null);
      audioBlobRef.current = null;
      setDuration(0);
      setIsPlaying(false);
      setPlaybackProgress(0);
      setState('idle');
    } catch (error: any) {
      console.error('Error uploading voice message:', error);
      toast.error('Failed to send voice message');
      setState('recorded');
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Idle state: show mic button (or nothing if autoStart - recording is initializing)
  if (state === 'idle') {
    if (autoStart) {
      return (
        <div className="flex items-center gap-2 px-3 py-2 text-sm text-gray-500">
          <Loader2 className="w-4 h-4 animate-spin" />
          Starting microphone...
        </div>
      );
    }
    return (
      <button
        type="button"
        onClick={startRecording}
        disabled={disabled}
        className={cn(
          'p-2 rounded-lg transition-colors',
          disabled
            ? 'text-gray-300 cursor-not-allowed'
            : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
        )}
        title="Record voice message"
      >
        <Mic className="w-5 h-5" />
      </button>
    );
  }

  // Recording state: show recording UI inline
  if (state === 'recording') {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg w-full">
        <div className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse flex-shrink-0" />
        <span className="text-sm text-red-700 font-medium flex-shrink-0">
          {formatTime(duration)}
        </span>

        {/* Waveform visualization placeholder */}
        <div className="flex-1 flex items-center gap-0.5 h-6 overflow-hidden">
          {Array.from({ length: 24 }).map((_, i) => (
            <div
              key={i}
              className="w-1 bg-red-400 rounded-full animate-pulse"
              style={{
                height: `${Math.max(4, Math.random() * 20 + 4)}px`,
                animationDelay: `${i * 50}ms`,
              }}
            />
          ))}
        </div>

        <button
          type="button"
          onClick={stopRecording}
          className="p-1.5 bg-red-600 text-white rounded-full hover:bg-red-700 transition-colors flex-shrink-0"
          title="Stop recording"
        >
          <Square className="w-4 h-4" />
        </button>
      </div>
    );
  }

  // Recorded state: show playback + send/discard
  if (state === 'recorded') {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg w-full">
        {/* Play/Pause */}
        <button
          type="button"
          onClick={togglePlayback}
          className="p-1.5 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-colors flex-shrink-0"
          title={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? (
            <Pause className="w-4 h-4" />
          ) : (
            <Play className="w-4 h-4" />
          )}
        </button>

        {/* Progress bar */}
        <div className="flex-1 h-1.5 bg-blue-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-600 rounded-full transition-all"
            style={{ width: `${playbackProgress}%` }}
          />
        </div>

        {/* Duration */}
        <span className="text-xs text-blue-700 font-mono flex-shrink-0">
          {formatTime(duration)}
        </span>

        {/* Discard */}
        <button
          type="button"
          onClick={discardRecording}
          className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors flex-shrink-0"
          title="Discard recording"
        >
          <Trash2 className="w-4 h-4" />
        </button>

        {/* Send */}
        <button
          type="button"
          onClick={handleSend}
          className="p-1.5 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-colors flex-shrink-0"
          title="Send voice message"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    );
  }

  // Uploading state
  if (state === 'uploading') {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg w-full">
        <Loader2 className="w-5 h-5 text-blue-600 animate-spin flex-shrink-0" />
        <span className="text-sm text-gray-600">Sending voice message...</span>
      </div>
    );
  }

  return null;
}

/**
 * VoiceMessagePlayer - Inline player for received/sent voice messages
 * Renders inside a message bubble
 */
interface VoiceMessagePlayerProps {
  audioUrl: string;
  durationSeconds?: number;
  variant?: 'outbound' | 'inbound';
}

export function VoiceMessagePlayer({
  audioUrl,
  durationSeconds,
  variant = 'inbound',
}: VoiceMessagePlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [totalDuration, setTotalDuration] = useState(durationSeconds || 0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const animationRef = useRef<number | null>(null);

  useEffect(() => {
    const audio = new Audio(audioUrl);
    audioRef.current = audio;

    audio.onloadedmetadata = () => {
      if (audio.duration && isFinite(audio.duration)) {
        setTotalDuration(audio.duration);
      }
    };

    audio.onended = () => {
      setIsPlaying(false);
      setProgress(0);
      setCurrentTime(0);
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };

    return () => {
      audio.pause();
      audio.src = '';
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [audioUrl]);

  const updatePlayback = () => {
    const audio = audioRef.current;
    if (audio && !audio.paused) {
      const pct = audio.duration > 0 ? (audio.currentTime / audio.duration) * 100 : 0;
      setProgress(pct);
      setCurrentTime(audio.currentTime);
      animationRef.current = requestAnimationFrame(updatePlayback);
    }
  };

  const toggle = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    } else {
      audio.play();
      setIsPlaying(true);
      updatePlayback();
    }
  };

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const isOut = variant === 'outbound';

  return (
    <div className="flex items-center gap-2 min-w-[180px]">
      <button
        type="button"
        onClick={toggle}
        className={cn(
          'p-1.5 rounded-full transition-colors flex-shrink-0',
          isOut
            ? 'bg-blue-500 text-white hover:bg-blue-400'
            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
        )}
      >
        {isPlaying ? (
          <Pause className="w-3.5 h-3.5" />
        ) : (
          <Play className="w-3.5 h-3.5" />
        )}
      </button>

      {/* Waveform / progress bar */}
      <div className="flex-1 flex flex-col gap-0.5">
        <div
          className={cn(
            'h-1.5 rounded-full overflow-hidden',
            isOut ? 'bg-blue-400/40' : 'bg-gray-200'
          )}
        >
          <div
            className={cn(
              'h-full rounded-full transition-all',
              isOut ? 'bg-white' : 'bg-blue-600'
            )}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <span
        className={cn(
          'text-xs font-mono flex-shrink-0',
          isOut ? 'text-blue-200' : 'text-gray-500'
        )}
      >
        {isPlaying
          ? formatTime(currentTime)
          : formatTime(totalDuration)}
      </span>

      <Mic
        className={cn(
          'w-3.5 h-3.5 flex-shrink-0',
          isOut ? 'text-blue-200' : 'text-gray-400'
        )}
      />
    </div>
  );
}

export default VoiceMessageRecorder;
