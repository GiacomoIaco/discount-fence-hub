import { useState, useRef, useEffect } from 'react';
import { Mic, Square, Play, Pause, Check, X, AlertCircle } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../contexts/AuthContext';

interface VoiceSampleRecorderProps {
  onComplete: (voiceSampleUrl: string) => void;
  onCancel: () => void;
}

const SAMPLE_SCRIPT = `
Hello, this is my voice sample for AI coaching.
I'm excited to improve my sales skills and grow professionally.
This recording will help the AI understand my natural speaking patterns,
pace, and tone, so it can provide personalized feedback on my calls.
Thank you for helping me become a better sales professional.
`;

const MIN_DURATION = 10; // seconds
const MAX_DURATION = 90; // seconds

export default function VoiceSampleRecorder({
  onComplete,
  onCancel
}: VoiceSampleRecorderProps) {
  const { user } = useAuth();
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [audioUrl]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const url = URL.createObjectURL(audioBlob);
        setAudioUrl(url);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setError(null);

      // Start timer
      timerRef.current = setInterval(() => {
        setDuration(prev => {
          if (prev >= MAX_DURATION) {
            stopRecording();
            return MAX_DURATION;
          }
          return prev + 1;
        });
      }, 1000);
    } catch (err: any) {
      console.error('Recording error:', err);
      setError('Failed to access microphone. Please check permissions.');
    }
  };

  const pauseRecording = () => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.pause();
      setIsPaused(true);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  const resumeRecording = () => {
    if (mediaRecorderRef.current?.state === 'paused') {
      mediaRecorderRef.current.resume();
      setIsPaused(false);

      // Resume timer
      timerRef.current = setInterval(() => {
        setDuration(prev => {
          if (prev >= MAX_DURATION) {
            stopRecording();
            return MAX_DURATION;
          }
          return prev + 1;
        });
      }, 1000);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current?.state !== 'inactive') {
      mediaRecorderRef.current?.stop();
      setIsRecording(false);
      setIsPaused(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  };

  const resetRecording = () => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(null);
    setDuration(0);
    setError(null);
  };

  const handleUpload = async () => {
    if (!audioUrl || !user) return;

    if (duration < MIN_DURATION) {
      setError(`Recording must be at least ${MIN_DURATION} seconds long`);
      return;
    }

    try {
      setUploading(true);
      setError(null);

      // Get the blob from the audio URL
      const response = await fetch(audioUrl);
      const blob = await response.blob();

      // Upload to Supabase Storage
      const fileName = `voice-sample-${Date.now()}.webm`;
      const filePath = `${user.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('voice-samples')
        .upload(filePath, blob, {
          contentType: 'audio/webm',
          upsert: true
        });

      if (uploadError) throw uploadError;

      // Get signed URL (private bucket)
      const { data, error: urlError } = await supabase.storage
        .from('voice-samples')
        .createSignedUrl(filePath, 31536000); // 1 year expiry

      if (urlError) throw urlError;
      if (!data?.signedUrl) throw new Error('Failed to generate signed URL');

      // Update user profile
      const { error: updateError } = await supabase
        .from('user_profiles')
        .update({ voice_sample_url: data.signedUrl })
        .eq('id', user.id);

      if (updateError) throw updateError;

      onComplete(data.signedUrl);
    } catch (err: any) {
      console.error('Upload error:', err);
      setError(err.message || 'Failed to upload voice sample');
    } finally {
      setUploading(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Record Voice Sample</h2>
            <p className="text-sm text-gray-600">Help AI learn your voice for personalized coaching</p>
          </div>
          <button
            onClick={onCancel}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Script */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-semibold text-blue-900 mb-2">Please read this script:</h3>
            <p className="text-blue-800 leading-relaxed whitespace-pre-line">
              {SAMPLE_SCRIPT.trim()}
            </p>
          </div>

          {/* Recording Controls */}
          <div className="flex flex-col items-center space-y-4">
            {/* Duration */}
            <div className="text-4xl font-mono font-bold text-gray-900">
              {formatTime(duration)}
            </div>

            {/* Duration Hint */}
            <div className="text-sm text-gray-600">
              Minimum: {MIN_DURATION}s | Maximum: {MAX_DURATION}s
            </div>

            {/* Progress Bar */}
            {isRecording && (
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-red-500 h-2 rounded-full transition-all duration-1000"
                  style={{ width: `${(duration / MAX_DURATION) * 100}%` }}
                />
              </div>
            )}

            {/* Record Button */}
            {!audioUrl && !isRecording && (
              <button
                onClick={startRecording}
                className="flex items-center space-x-3 px-8 py-4 bg-red-600 text-white rounded-full hover:bg-red-700 transition-all transform hover:scale-105 shadow-lg"
              >
                <Mic className="w-6 h-6" />
                <span className="font-semibold">Start Recording</span>
              </button>
            )}

            {/* Pause/Resume/Stop Buttons */}
            {isRecording && (
              <div className="flex space-x-3">
                {!isPaused ? (
                  <button
                    onClick={pauseRecording}
                    className="flex items-center space-x-2 px-6 py-3 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors"
                  >
                    <Pause className="w-5 h-5" />
                    <span>Pause</span>
                  </button>
                ) : (
                  <button
                    onClick={resumeRecording}
                    className="flex items-center space-x-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                  >
                    <Play className="w-5 h-5" />
                    <span>Resume</span>
                  </button>
                )}
                <button
                  onClick={stopRecording}
                  className="flex items-center space-x-2 px-6 py-3 bg-gray-800 text-white rounded-lg hover:bg-gray-900 transition-colors"
                >
                  <Square className="w-5 h-5" />
                  <span>Stop</span>
                </button>
              </div>
            )}

            {/* Playback */}
            {audioUrl && (
              <div className="w-full space-y-3">
                <audio
                  ref={audioRef}
                  src={audioUrl}
                  controls
                  className="w-full"
                />
                <div className="flex space-x-3">
                  <button
                    onClick={resetRecording}
                    className="flex-1 px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Re-record
                  </button>
                  <button
                    onClick={handleUpload}
                    disabled={uploading || duration < MIN_DURATION}
                    className="flex-1 flex items-center justify-center space-x-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {uploading ? (
                      <>
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                        <span>Uploading...</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-5 h-5" />
                        <span>Save Voice Sample</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="flex items-center space-x-2 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg w-full">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}
          </div>

          {/* Info */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <h3 className="font-semibold text-gray-900 mb-2">Why record a voice sample?</h3>
            <ul className="text-sm text-gray-700 space-y-1">
              <li>• Helps AI learn your natural speaking patterns</li>
              <li>• Enables personalized feedback on pace, tone, and clarity</li>
              <li>• Tracks your vocal improvement over time</li>
              <li>• Calibrates emotion and sentiment analysis to your baseline</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
