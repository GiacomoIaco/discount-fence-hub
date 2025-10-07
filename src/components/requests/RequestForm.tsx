import { useState, useRef, useEffect } from 'react';
import { X, Mic, StopCircle, Play, Pause, Send, Loader2, Camera, ImageIcon, Trash2 } from 'lucide-react';
import type { RequestType, Urgency, CreateRequestInput } from '../../lib/requests';
import { useCreateRequest } from '../../hooks/useRequests';
import { transcribeAudio } from '../../lib/openai';
import { parseVoiceTranscript } from '../../lib/claude';
import { supabase } from '../../lib/supabase';
import { showError } from '../../lib/toast';

interface RequestFormProps {
  requestType: RequestType;
  onClose: () => void;
  onSuccess: () => void;
}

type RecordingState = 'idle' | 'recording' | 'recorded' | 'processing';

interface ParsedData {
  customerName?: string;
  customerAddress?: string;
  customerPhone?: string;
  customerEmail?: string;
  fenceType?: string;
  linearFeet?: number;
  specialRequirements?: string;
  deadline?: string;
  urgency?: Urgency;
  description?: string;
  expectedValue?: number;
  confidence?: { [key: string]: number };
}

export default function RequestForm({ requestType, onClose, onSuccess }: RequestFormProps) {
  const { create, creating } = useCreateRequest();

  // Form data
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [fenceType, setFenceType] = useState('');
  const [linearFeet, setLinearFeet] = useState('');
  const [urgency, setUrgency] = useState<Urgency>('medium');
  const [expectedValue, setExpectedValue] = useState('');
  const [deadline, setDeadline] = useState('');
  const [specialRequirements, setSpecialRequirements] = useState('');
  const [photos, setPhotos] = useState<File[]>([]);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Voice recording
  const [recordingState, setRecordingState] = useState<RecordingState>('idle');
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioDuration, setAudioDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackProgress, setPlaybackProgress] = useState(0);
  const [transcript, setTranscript] = useState('');
  const [_parsedData, setParsedData] = useState<ParsedData | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const recordingStartTimeRef = useRef<number>(0);

  // Get request type label and description
  const getRequestTypeInfo = () => {
    switch (requestType) {
      case 'pricing':
        return {
          title: 'Custom Pricing Request',
          description: 'Submit a custom pricing request for special projects',
          icon: '💰'
        };
      case 'material':
        return {
          title: 'Material Request',
          description: 'Request materials or supplies',
          icon: '📦'
        };
      case 'support':
        return {
          title: 'Support Request',
          description: 'Report installation issues or customer escalations',
          icon: '🔧'
        };
      case 'new_builder':
        return {
          title: 'New Builder Request',
          description: 'Submit new builder community information',
          icon: '🏘️'
        };
      case 'warranty':
        return {
          title: 'Warranty Request',
          description: 'Report warranty or installation issues',
          icon: '⚠️'
        };
      default:
        return {
          title: 'Request',
          description: 'Submit a request',
          icon: '📝'
        };
    }
  };

  const typeInfo = getRequestTypeInfo();

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

      // Start recording with 100ms timeslice to ensure continuous data collection
      mediaRecorder.start(100);
      setRecordingState('recording');
    } catch (error) {
      console.error('Error starting recording:', error);
      showError('Failed to start recording. Please check microphone permissions.');
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

      // Parse transcript with AI
      const parsed = await parseVoiceTranscript(transcriptionText);
      setParsedData(parsed as any); // Type cast to avoid complex type mismatch

      // Auto-fill form fields with AI-generated data
      if (parsed.title) setTitle(parsed.title);
      if (parsed.customerName) setCustomerName(parsed.customerName);
      if (parsed.address) setCustomerAddress(parsed.address);
      if (parsed.fenceType) setFenceType(parsed.fenceType);
      if (parsed.linearFeet) setLinearFeet(parsed.linearFeet);
      if (parsed.specialRequirements) setSpecialRequirements(parsed.specialRequirements);
      if (parsed.deadline) setDeadline(parsed.deadline);
      if (parsed.urgency) setUrgency(parsed.urgency as Urgency);
      if (parsed.expectedValue) setExpectedValue(parsed.expectedValue);
      // Use AI-generated structured description instead of raw transcript
      if (parsed.description) setDescription(parsed.description);

      setRecordingState('recorded');
    } catch (error) {
      console.error('Error processing voice:', error);
      showError('Failed to process voice recording. Please try again.');
      setRecordingState('recorded');
    }
  };

  // Audio playback progress
  useEffect(() => {
    if (audioUrl) {
      const audio = new Audio(audioUrl);
      audioRef.current = audio;

      audio.addEventListener('timeupdate', () => {
        setPlaybackProgress((audio.currentTime / audio.duration) * 100);
      });

      audio.addEventListener('ended', () => {
        setIsPlaying(false);
        setPlaybackProgress(0);
      });

      return () => {
        audio.pause();
        audio.remove();
      };
    }
  }, [audioUrl]);

  // Photo handling functions
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setPhotos(prev => [...prev, ...Array.from(e.target.files!)]);
    }
  };

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });
      setStream(mediaStream);
      setShowCamera(true);

      // Wait for video element to be ready
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }
      }, 100);
    } catch (error) {
      console.error('Camera access error:', error);
      showError('Could not access camera. Please use file upload instead.');
    }
  };

  const capturePhoto = () => {
    if (!videoRef.current || !stream) return;

    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx?.drawImage(videoRef.current, 0, 0);

    canvas.toBlob((blob) => {
      if (blob) {
        const file = new File([blob], `photo-${Date.now()}.jpg`, { type: 'image/jpeg' });
        setPhotos(prev => [...prev, file]);
        closeCamera();
      }
    }, 'image/jpeg', 0.9);
  };

  const closeCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    setShowCamera(false);
  };

  const removePhoto = (index: number) => {
    setPhotos(prev => prev.filter((_, i) => i !== index));
  };

  const uploadPhotosToStorage = async (): Promise<string[]> => {
    if (photos.length === 0) return [];

    setUploadingPhotos(true);
    const uploadedUrls: string[] = [];

    try {
      for (const photo of photos) {
        const fileName = `request-photos/${Date.now()}-${Math.random().toString(36).substring(7)}.jpg`;

        const { error: uploadError } = await supabase.storage
          .from('photos')
          .upload(fileName, photo, {
            contentType: 'image/jpeg',
            upsert: false
          });

        if (uploadError) {
          console.error('Photo upload error:', uploadError);
          continue;
        }

        const { data: { publicUrl } } = supabase.storage
          .from('photos')
          .getPublicUrl(fileName);

        uploadedUrls.push(publicUrl);
      }

      return uploadedUrls;
    } catch (error) {
      console.error('Error uploading photos:', error);
      throw error;
    } finally {
      setUploadingPhotos(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      showError('Please enter a title for this request');
      return;
    }

    let requestData: CreateRequestInput | null = null;

    try {
      // Upload photos first if there are any
      let uploadedPhotoUrls: string[] = [];
      if (photos.length > 0) {
        uploadedPhotoUrls = await uploadPhotosToStorage();
      }

      requestData = {
        request_type: requestType,
        title,
        description: description || undefined,
        customer_name: customerName || undefined,
        customer_address: customerAddress || undefined,
        customer_phone: customerPhone || undefined,
        customer_email: customerEmail || undefined,
        fence_type: fenceType || undefined,
        linear_feet: linearFeet ? parseInt(linearFeet) : undefined,
        urgency,
        expected_value: expectedValue ? parseFloat(expectedValue) : undefined,
        deadline: deadline || undefined,
        special_requirements: specialRequirements || undefined,
        voice_recording_url: audioUrl || undefined,
        voice_duration: audioDuration || undefined,
        transcript: transcript || undefined,
        photo_urls: uploadedPhotoUrls.length > 0 ? uploadedPhotoUrls : undefined
      };

      await create(requestData);
      onSuccess();
    } catch (error: any) {
      console.error('Error creating request:', error);
      console.error('Request data:', requestData);
      const errorMessage = error?.message || error?.details || 'Unknown error';
      showError(`Failed to create request: ${errorMessage}\n\nPlease check console for details.`);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-end sm:items-center justify-center">
      <div className="bg-white w-full sm:max-w-2xl sm:rounded-t-2xl rounded-t-3xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{typeInfo.icon}</span>
            <div>
              <h2 className="text-lg font-bold text-gray-900">{typeInfo.title}</h2>
              <p className="text-xs text-gray-600">{typeInfo.description}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Voice Recording Section */}
          <div className="bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <Mic className="w-4 h-4 text-purple-600" />
              Voice Recording (Optional)
            </h3>

            {recordingState === 'idle' && (
              <button
                type="button"
                onClick={startRecording}
                className="w-full bg-purple-600 text-white py-3 rounded-lg font-medium hover:bg-purple-700 transition-colors flex items-center justify-center gap-2"
              >
                <Mic className="w-5 h-5" />
                Start Recording
              </button>
            )}

            {recordingState === 'recording' && (
              <div className="space-y-3">
                <div className="flex items-center justify-center gap-3 text-red-600">
                  <div className="w-3 h-3 bg-red-600 rounded-full animate-pulse"></div>
                  <span className="font-medium">Recording...</span>
                </div>
                <button
                  type="button"
                  onClick={stopRecording}
                  className="w-full bg-red-600 text-white py-3 rounded-lg font-medium hover:bg-red-700 transition-colors flex items-center justify-center gap-2"
                >
                  <StopCircle className="w-5 h-5" />
                  Stop Recording
                </button>
              </div>
            )}

            {recordingState === 'recorded' && audioUrl && (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={isPlaying ? pauseAudio : playAudio}
                    className="p-3 bg-purple-600 text-white rounded-full hover:bg-purple-700 transition-colors"
                  >
                    {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                  </button>
                  <div className="flex-1">
                    <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-purple-600 transition-all"
                        style={{ width: `${playbackProgress}%` }}
                      ></div>
                    </div>
                    <p className="text-xs text-gray-600 mt-1">{audioDuration}s</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={processVoiceRecording}
                  className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white py-2 rounded-lg font-medium hover:from-purple-700 hover:to-indigo-700 transition-colors text-sm"
                >
                  Extract Info with AI
                </button>
              </div>
            )}

            {recordingState === 'processing' && (
              <div className="flex items-center justify-center gap-3 text-purple-600 py-4">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span className="font-medium">Processing audio...</span>
              </div>
            )}

            {transcript && (
              <div className="mt-3 p-3 bg-white rounded-lg border border-purple-200">
                <p className="text-xs font-semibold text-gray-700 mb-1">Transcript:</p>
                <p className="text-sm text-gray-600">{transcript}</p>
              </div>
            )}
          </div>

          {/* Title (Required) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Brief description of request"
              required
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              rows={3}
              placeholder="Additional details..."
            />
          </div>

          {/* Customer Information */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-900">Customer Information</h3>

            <input
              type="text"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Customer Name"
            />

            <input
              type="text"
              value={customerAddress}
              onChange={(e) => setCustomerAddress(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Address"
            />

            <div className="grid grid-cols-2 gap-3">
              <input
                type="tel"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Phone"
              />
              <input
                type="email"
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Email"
              />
            </div>
          </div>

          {/* Project Details (for pricing/material requests) */}
          {(requestType === 'pricing' || requestType === 'material') && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-gray-900">Project Details</h3>

              <input
                type="text"
                value={fenceType}
                onChange={(e) => setFenceType(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Fence Type (e.g., Cedar, Vinyl)"
              />

              <div className="grid grid-cols-2 gap-3">
                <input
                  type="number"
                  value={linearFeet}
                  onChange={(e) => setLinearFeet(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Linear Feet"
                />
                {requestType === 'pricing' && (
                  <input
                    type="number"
                    value={expectedValue}
                    onChange={(e) => setExpectedValue(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Expected Value ($)"
                  />
                )}
              </div>
            </div>
          )}

          {/* Urgency & Deadline */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Urgency</label>
              <select
                value={urgency}
                onChange={(e) => setUrgency(e.target.value as Urgency)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Deadline</label>
              <input
                type="date"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Special Requirements */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Special Requirements
            </label>
            <textarea
              value={specialRequirements}
              onChange={(e) => setSpecialRequirements(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              rows={2}
              placeholder="Any special requirements or notes..."
            />
          </div>

          {/* Photo Upload */}
          <div className="border border-gray-200 rounded-xl p-4 bg-gray-50">
            <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <ImageIcon className="w-4 h-4 text-gray-600" />
              Photos (Optional)
            </h3>

            <div className="flex gap-2 mb-3">
              <button
                type="button"
                onClick={startCamera}
                className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
              >
                <Camera className="w-4 h-4" />
                Take Photo
              </button>
              <label className="flex-1 bg-gray-700 text-white py-2 px-4 rounded-lg font-medium hover:bg-gray-800 transition-colors flex items-center justify-center gap-2 cursor-pointer">
                <ImageIcon className="w-4 h-4" />
                Upload
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handlePhotoUpload}
                  className="hidden"
                />
              </label>
            </div>

            {photos.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {photos.map((photo, index) => (
                  <div key={index} className="relative">
                    <img
                      src={URL.createObjectURL(photo)}
                      alt={`Upload ${index + 1}`}
                      className="w-full h-24 object-cover rounded-lg"
                    />
                    <button
                      type="button"
                      onClick={() => removePhoto(index)}
                      className="absolute top-1 right-1 bg-red-600 text-white rounded-full p-1 hover:bg-red-700 transition-colors"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {photos.length === 0 && (
              <p className="text-sm text-gray-500 text-center py-3">
                Add photos to help with your request
              </p>
            )}
          </div>

          {/* Submit Buttons */}
          <div className="flex gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={creating || uploadingPhotos || !title.trim()}
              className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {uploadingPhotos ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Uploading photos...
                </>
              ) : creating ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <Send className="w-5 h-5" />
                  Submit Request
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Camera Preview Modal */}
      {showCamera && (
        <div className="fixed inset-0 bg-black z-[60] flex flex-col">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            className="flex-1 w-full object-cover"
          />
          <div className="p-4 bg-black flex justify-between items-center">
            <button
              type="button"
              onClick={closeCamera}
              className="px-4 py-2 bg-gray-700 text-white rounded-lg font-medium"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={capturePhoto}
              className="w-16 h-16 bg-white rounded-full flex items-center justify-center"
            >
              <div className="w-14 h-14 bg-blue-600 rounded-full"></div>
            </button>
            <div className="w-20"></div>
          </div>
        </div>
      )}
    </div>
  );
}
