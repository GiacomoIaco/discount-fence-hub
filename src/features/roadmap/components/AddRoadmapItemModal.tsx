import { useState, useRef } from 'react';
import { X, Mic, StopCircle, Play, Pause, Loader2, Sparkles } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { HUB_CONFIG, type HubKey } from '../RoadmapHub';
import { COMPLEXITY_CONFIG, type ComplexityType } from '../types';
import { transcribeAudio } from '../../../lib/openai';
import { expandRoadmapIdea } from '../../../lib/claude';
import toast from 'react-hot-toast';

interface AddRoadmapItemModalProps {
  onClose: () => void;
  onSuccess: () => void;
  selectedHubs: Set<HubKey>;
}

type RecordingState = 'idle' | 'recording' | 'recorded' | 'processing';

export default function AddRoadmapItemModal({
  onClose,
  onSuccess,
  selectedHubs,
}: AddRoadmapItemModalProps) {
  const [saving, setSaving] = useState(false);
  const [expanding, setExpanding] = useState(false);
  const [formData, setFormData] = useState({
    hub: selectedHubs.size === 1 ? Array.from(selectedHubs)[0] : 'general' as HubKey,
    title: '',
    raw_idea: '',
    claude_analysis: '',
    importance: 3,
    complexity: 'M' as ComplexityType,
  });

  // Voice recording state
  const [recordingState, setRecordingState] = useState<RecordingState>('idle');
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioDuration, setAudioDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackProgress, setPlaybackProgress] = useState(0);
  const [transcript, setTranscript] = useState('');

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const recordingStartTimeRef = useRef<number>(0);

  // Voice recording handlers
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
        setRecordingState('recorded');

        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start(100);
      setRecordingState('recording');
    } catch (error) {
      console.error('Error starting recording:', error);
      toast.error('Failed to start recording. Please check microphone permissions.');
    }
  };

  const stopRecording = () => {
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

  const processVoiceRecording = async () => {
    if (!audioBlob) return;

    setRecordingState('processing');

    try {
      // Transcribe audio
      const transcriptionText = await transcribeAudio(audioBlob);
      setTranscript(transcriptionText);

      // Expand with AI
      const expanded = await expandRoadmapIdea(transcriptionText);

      // Auto-fill form with AI-generated data
      setFormData({
        hub: (expanded.hub as HubKey) || formData.hub,
        title: expanded.title || '',
        raw_idea: expanded.raw_idea || transcriptionText,
        claude_analysis: expanded.claude_analysis || '',
        importance: expanded.importance || 3,
        complexity: (expanded.complexity as ComplexityType) || 'M',
      });

      toast.success('AI expanded your idea!');
      setRecordingState('recorded');
    } catch (error) {
      console.error('Error processing voice:', error);
      toast.error('Failed to process voice recording. Please try again.');
      setRecordingState('recorded');
    }
  };

  const clearRecording = () => {
    setRecordingState('idle');
    setAudioUrl(null);
    setAudioBlob(null);
    setAudioDuration(0);
    setTranscript('');
    setPlaybackProgress(0);
  };

  // Expand typed idea with AI
  const expandTypedIdea = async () => {
    if (!formData.raw_idea.trim()) {
      toast.error('Please enter a description first');
      return;
    }

    setExpanding(true);
    try {
      const expanded = await expandRoadmapIdea(formData.raw_idea);

      setFormData({
        hub: (expanded.hub as HubKey) || formData.hub,
        title: expanded.title || formData.title,
        raw_idea: expanded.raw_idea || formData.raw_idea,
        claude_analysis: expanded.claude_analysis || '',
        importance: expanded.importance || formData.importance,
        complexity: (expanded.complexity as ComplexityType) || formData.complexity,
      });

      toast.success('AI expanded your idea!');
    } catch (error) {
      console.error('Error expanding idea:', error);
      toast.error('Failed to expand idea. Please try again.');
    } finally {
      setExpanding(false);
    }
  };

  // Handle audio element events
  const handleAudioTimeUpdate = () => {
    if (audioRef.current && audioRef.current.duration && isFinite(audioRef.current.duration)) {
      setPlaybackProgress((audioRef.current.currentTime / audioRef.current.duration) * 100);
    }
  };

  const handleAudioEnded = () => {
    setIsPlaying(false);
    setPlaybackProgress(0);
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      toast.error('Title is required');
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.from('roadmap_items').insert({
        hub: formData.hub,
        title: formData.title.trim(),
        raw_idea: formData.raw_idea.trim() || null,
        claude_analysis: formData.claude_analysis.trim() || null,
        importance: formData.importance,
        complexity: formData.complexity,
        status: 'idea',
      });

      if (error) throw error;

      toast.success('Idea added to roadmap!');
      onSuccess();
    } catch (error) {
      console.error('Error adding item:', error);
      toast.error('Failed to add idea');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Add New Idea</h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form - scrollable */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-auto p-4 space-y-4">
          {/* Voice Recording Section */}
          <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg p-4 border border-purple-200">
            <div className="flex items-center gap-2 mb-3">
              <Mic className="w-5 h-5 text-purple-600" />
              <span className="font-medium text-purple-900">Voice Record</span>
              <span className="text-xs text-purple-600 bg-purple-100 px-2 py-0.5 rounded-full">AI-powered</span>
            </div>

            {recordingState === 'idle' && (
              <button
                type="button"
                onClick={startRecording}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
              >
                <Mic className="w-5 h-5" />
                <span>Tap to Record Your Idea</span>
              </button>
            )}

            {recordingState === 'recording' && (
              <div className="space-y-3">
                <div className="flex items-center justify-center gap-3">
                  <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                  <span className="text-red-600 font-medium">Recording...</span>
                  <span className="text-gray-500">{formatDuration(Math.floor((Date.now() - recordingStartTimeRef.current) / 1000))}</span>
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

            {recordingState === 'recorded' && audioUrl && (
              <div className="space-y-3">
                {/* Audio player */}
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
                  onTimeUpdate={handleAudioTimeUpdate}
                  onEnded={handleAudioEnded}
                  className="hidden"
                />

                {/* Actions */}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={clearRecording}
                    className="flex-1 px-3 py-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    Clear
                  </button>
                  <button
                    type="button"
                    onClick={processVoiceRecording}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>Expand with AI</span>
                  </button>
                </div>

                {transcript && (
                  <div className="text-xs text-gray-500 bg-gray-50 rounded p-2 max-h-20 overflow-auto">
                    <strong>Transcript:</strong> {transcript}
                  </div>
                )}
              </div>
            )}

            {recordingState === 'processing' && (
              <div className="flex items-center justify-center gap-3 py-4">
                <Loader2 className="w-5 h-5 text-purple-600 animate-spin" />
                <span className="text-purple-600">AI is expanding your idea...</span>
              </div>
            )}
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-gray-500">or type manually</span>
            </div>
          </div>

          {/* Hub Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Hub</label>
            <select
              value={formData.hub}
              onChange={(e) => setFormData({ ...formData, hub: e.target.value as HubKey })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {(Object.keys(HUB_CONFIG) as HubKey[]).map((hub) => (
                <option key={hub} value={hub}>
                  {HUB_CONFIG[hub].prefix} - {HUB_CONFIG[hub].label}
                </option>
              ))}
            </select>
          </div>

          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="Brief title for the idea"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Raw Idea */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={formData.raw_idea}
              onChange={(e) => setFormData({ ...formData, raw_idea: e.target.value })}
              placeholder="Quick brain dump - what's the idea about?"
              rows={3}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            {!formData.claude_analysis && (
              <button
                type="button"
                onClick={expandTypedIdea}
                disabled={expanding || !formData.raw_idea.trim()}
                className="mt-2 flex items-center gap-2 px-3 py-1.5 text-sm bg-gradient-to-r from-purple-500 to-blue-600 text-white rounded-lg hover:from-purple-600 hover:to-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {expanding ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Expanding...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Expand with AI</span>
                  </>
                )}
              </button>
            )}
          </div>

          {/* Claude Analysis */}
          {formData.claude_analysis && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <span className="flex items-center gap-1">
                  <Sparkles className="w-4 h-4 text-purple-600" />
                  AI Analysis
                </span>
              </label>
              <textarea
                value={formData.claude_analysis}
                onChange={(e) => setFormData({ ...formData, claude_analysis: e.target.value })}
                placeholder="AI-expanded analysis..."
                rows={4}
                className="w-full border border-purple-200 bg-purple-50 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-sm"
              />
            </div>
          )}

          {/* Importance & Complexity row */}
          <div className="grid grid-cols-2 gap-4">
            {/* Importance */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Importance (1-5)
              </label>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((level) => (
                  <button
                    key={level}
                    type="button"
                    onClick={() => setFormData({ ...formData, importance: level })}
                    className={`flex-1 py-2 text-lg transition-colors rounded ${
                      formData.importance >= level
                        ? 'text-yellow-500'
                        : 'text-gray-300'
                    }`}
                  >
                    ★
                  </button>
                ))}
              </div>
            </div>

            {/* Complexity */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Complexity</label>
              <div className="flex gap-1">
                {(Object.keys(COMPLEXITY_CONFIG) as ComplexityType[]).map((size) => (
                  <button
                    key={size}
                    type="button"
                    onClick={() => setFormData({ ...formData, complexity: size })}
                    className={`flex-1 py-2 text-sm font-medium rounded border transition-colors ${
                      formData.complexity === size
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </form>

        {/* Actions - fixed at bottom */}
        <div className="flex justify-end gap-3 p-4 border-t border-gray-200 bg-gray-50">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving || !formData.title.trim()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {saving ? 'Adding...' : 'Add Idea'}
          </button>
        </div>
      </div>
    </div>
  );
}
