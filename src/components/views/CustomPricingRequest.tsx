import { useState, useRef } from 'react';
import { Mic, StopCircle, Play, CheckCircle, AlertCircle, Send, Camera, Image } from 'lucide-react';
import { showError, showWarning } from '../../lib/toast';
import { transcribeAudio } from '../../lib/openai';
import { parseVoiceTranscript } from '../../lib/claude';

type RequestStep = 'choice' | 'recording' | 'processing' | 'review' | 'success';

interface ParsedData {
  customerName: string;
  address: string;
  fenceType: string;
  linearFeet: string;
  specialRequirements: string;
  deadline: string;
  urgency: string;
  confidence: {
    [key: string]: number;
  };
}

interface CustomPricingRequestProps {
  onBack: () => void;
  viewMode: 'mobile' | 'desktop';
}

export default function CustomPricingRequest({ onBack, viewMode: _viewMode }: CustomPricingRequestProps) {
  const [step, setStep] = useState<RequestStep>('choice');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [parsedData, setParsedData] = useState<ParsedData | null>(null);
  const [photos, setPhotos] = useState<File[]>([]);
  const [audioURL, setAudioURL] = useState<string>('');
  const [formData, setFormData] = useState({
    projectNumber: '',
    customerName: '',
    address: '',
    fenceType: '',
    linearFeet: '',
    specialRequirements: '',
    deadline: '',
    urgency: ''
  });


  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setPhotos(prev => [...prev, ...Array.from(e.target.files!)]);
    }
  };

  const handleCameraCapture = () => {
    cameraInputRef.current?.click();
  };

  const handleFileSelect = () => {
    fileInputRef.current?.click();
  };

  const removePhoto = (index: number) => {
    setPhotos(prev => prev.filter((_, i) => i !== index));
  };

  const updateFormData = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);

      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } catch (err) {
      showError('Microphone access denied. Please enable microphone permissions.');
    }
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
      setRecordingTime(0);
      audioChunksRef.current = [];
    }
  };

  const stopRecording = async () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
      setStep('processing');

      // Wait for the audio blob to be available
      setTimeout(async () => {
        try {
          // Create audio blob from collected chunks
          const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          setAudioURL(URL.createObjectURL(blob));

          // Transcribe with Whisper
          const transcript = await transcribeAudio(blob);

          // Parse with Claude
          const parsed = await parseVoiceTranscript(transcript);
          setParsedData(parsed);

          // Auto-fill form with parsed data
          setFormData({
            projectNumber: formData.projectNumber, // Keep existing project number
            customerName: parsed.customerName,
            address: parsed.address,
            fenceType: parsed.fenceType,
            linearFeet: parsed.linearFeet,
            specialRequirements: parsed.specialRequirements,
            deadline: parsed.deadline,
            urgency: parsed.urgency
          });

          // Return to form view
          setStep('choice');
        } catch (error) {
          console.error('Error processing audio:', error);
          showWarning('Failed to process audio. Using demo mode. Error: ' + (error as Error).message);

          // Fallback to demo data if API fails
          const demoData = {
            customerName: 'The Johnsons',
            address: '123 Oak Street',
            fenceType: '6-foot cedar privacy fence',
            linearFeet: '200',
            specialRequirements: 'Dark walnut stain, sloped terrain (15°)',
            deadline: 'Before June 15th',
            urgency: 'high',
            confidence: {
              customerName: 85,
              address: 95,
              fenceType: 90,
              linearFeet: 88,
              specialRequirements: 92,
              deadline: 85,
              urgency: 90
            }
          };
          setParsedData(demoData);

          // Auto-fill form with demo data
          setFormData({
            projectNumber: formData.projectNumber,
            customerName: demoData.customerName,
            address: demoData.address,
            fenceType: demoData.fenceType,
            linearFeet: demoData.linearFeet,
            specialRequirements: demoData.specialRequirements,
            deadline: demoData.deadline,
            urgency: demoData.urgency
          });

          // Return to form view
          setStep('choice');
        }
      }, 100); // Small delay to ensure chunks are collected
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const submitRequest = async () => {
    // Convert photos to base64 for storage
    const photoPromises = photos.map(photo => {
      return new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(photo);
      });
    });

    const photoBase64 = await Promise.all(photoPromises);

    // Save to localStorage
    const newRequest = {
      id: Date.now(),
      requestType: 'custom-pricing',
      projectNumber: formData.projectNumber || `REQ-${Date.now()}`,
      customerName: formData.customerName,
      address: formData.address,
      fenceType: formData.fenceType,
      linearFeet: formData.linearFeet,
      status: 'pending',
      priority: formData.urgency === 'high' ? 'high' : formData.urgency === 'medium' ? 'medium' : 'low',
      submittedDate: new Date().toISOString(),
      timestamp: new Date().toISOString(),
      responseTime: 'pending',
      specialRequirements: formData.specialRequirements,
      deadline: formData.deadline,
      photos: photoBase64,
      messages: [],
      notes: [],
      salesperson: localStorage.getItem('userName') || 'Unknown Sales Rep'
    };

    const requests = JSON.parse(localStorage.getItem('myRequests') || '[]');
    requests.unshift(newRequest); // Add to beginning
    localStorage.setItem('myRequests', JSON.stringify(requests));

    setStep('success');
    setTimeout(() => {
      onBack();
    }, 2000);
  };

  if (step === 'choice') {
    return (
      <div className="min-h-screen bg-gray-50 p-4 pb-24">
        <button onClick={onBack} className="text-blue-600 font-medium mb-4">← Back</button>

        <div className="mb-4">
          <h1 className="text-2xl font-bold text-gray-900">Custom Pricing Request</h1>
          <p className="text-gray-600 mt-1">Fill in the details below or use voice to auto-fill</p>
        </div>

        {/* Recording Banner (sticky at top while recording) */}
        {isRecording && (
          <div className="sticky top-0 z-50 bg-gradient-to-r from-purple-600 to-purple-700 text-white rounded-xl p-5 mb-4 shadow-lg">
            <div className="text-center mb-4">
              <div className="bg-white/20 p-4 rounded-full inline-block animate-pulse mb-3">
                <Mic className="w-8 h-8" />
              </div>
              <div className="font-bold text-2xl">{formatTime(recordingTime)}</div>
              <div className="text-sm text-purple-100 mt-2">Recording in progress...</div>
            </div>

            <div className="bg-white/10 rounded-lg p-3 mb-4 text-xs text-purple-100">
              <strong>What to mention:</strong> Customer name, address, fence type, linear feet, special requirements, and deadline
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={cancelRecording}
                className="bg-white/20 text-white py-3 rounded-lg font-semibold hover:bg-white/30 transition"
              >
                Cancel
              </button>
              <button
                onClick={stopRecording}
                className="bg-white text-purple-600 py-3 rounded-lg font-semibold hover:bg-gray-100 transition flex items-center justify-center space-x-2"
              >
                <StopCircle className="w-5 h-5" />
                <span>Stop Recording</span>
              </button>
            </div>
          </div>
        )}

        {/* Audio Playback (if recording exists) */}
        {audioURL && !isRecording && (
          <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 mb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="bg-purple-100 p-2 rounded-lg">
                  <Mic className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <div className="font-semibold text-gray-900">Voice Recording</div>
                  <div className="text-sm text-gray-600">{formatTime(recordingTime)}</div>
                </div>
              </div>
              <button
                onClick={() => audioRef.current?.play()}
                className="bg-purple-600 text-white p-2 rounded-lg hover:bg-purple-700 transition"
              >
                <Play className="w-5 h-5" />
              </button>
            </div>
            <audio ref={audioRef} src={audioURL} className="hidden" />
          </div>
        )}

        {/* Compact Voice Recording Button */}
        {!isRecording && (
          <div className="mb-4">
            <button
              onClick={startRecording}
              className="w-full bg-purple-600 text-white py-3 px-4 rounded-xl shadow-md active:scale-98 transition-transform flex items-center justify-center space-x-2"
            >
              <Mic className="w-5 h-5" />
              <span className="font-semibold">{audioURL ? 'Re-record' : 'Record to Auto-Fill Form'}</span>
            </button>
            <p className="text-xs text-gray-500 text-center mt-1">Speak naturally - AI will fill the fields below</p>
          </div>
        )}

        {/* Manual Form - Always Visible */}
        <div className="space-y-3">
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <label className="text-sm font-semibold text-gray-700 block mb-2">Project Number/Reference</label>
            <input
              type="text"
              placeholder="Enter Jobber or Service Titan project #"
              value={formData.projectNumber}
              onChange={(e) => updateFormData('projectNumber', e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900"
            />
            <p className="text-xs text-gray-500 mt-1">For linking to Jobber/Service Titan</p>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <label className="text-sm font-semibold text-gray-700 block mb-2">Customer Name</label>
            <input
              type="text"
              placeholder="Enter customer name"
              value={formData.customerName}
              onChange={(e) => updateFormData('customerName', e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900"
            />
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <label className="text-sm font-semibold text-gray-700 block mb-2">Address/Location</label>
            <input
              type="text"
              placeholder="Enter site address"
              value={formData.address}
              onChange={(e) => updateFormData('address', e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900"
            />
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <label className="text-sm font-semibold text-gray-700 block mb-2">Fence Type</label>
            <input
              type="text"
              placeholder="e.g., 6-foot cedar privacy fence"
              value={formData.fenceType}
              onChange={(e) => updateFormData('fenceType', e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900"
            />
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <label className="text-sm font-semibold text-gray-700 block mb-2">Linear Feet</label>
            <input
              type="text"
              placeholder="Enter linear feet"
              value={formData.linearFeet}
              onChange={(e) => updateFormData('linearFeet', e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900"
            />
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <label className="text-sm font-semibold text-gray-700 block mb-2">Special Requirements</label>
            <textarea
              placeholder="Staining, slope, gates, custom features..."
              value={formData.specialRequirements}
              onChange={(e) => updateFormData('specialRequirements', e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900 h-24"
            />
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <label className="text-sm font-semibold text-gray-700 block mb-2">Deadline/Timeline</label>
            <input
              type="text"
              placeholder="When does the customer need this?"
              value={formData.deadline}
              onChange={(e) => updateFormData('deadline', e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900"
            />
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <label className="text-sm font-semibold text-gray-700 block mb-2">Urgency Level</label>
            <select
              value={formData.urgency}
              onChange={(e) => updateFormData('urgency', e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900"
            >
              <option value="">Select urgency</option>
              <option value="low">Low - Standard timing</option>
              <option value="medium">Medium - Within a week</option>
              <option value="high">High - ASAP/Rush</option>
            </select>
          </div>

          {/* Photo Upload Section */}
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <label className="text-sm font-semibold text-gray-700 block mb-3">Photos</label>

            {/* Hidden file inputs */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handlePhotoUpload}
              className="hidden"
            />
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handlePhotoUpload}
              className="hidden"
            />

            {/* Action buttons */}
            <div className="grid grid-cols-2 gap-2 mb-3">
              <button
                type="button"
                onClick={handleCameraCapture}
                className="bg-purple-600 text-white py-2 px-4 rounded-lg flex items-center justify-center space-x-2 hover:bg-purple-700 transition"
              >
                <Camera className="w-5 h-5" />
                <span className="text-sm font-medium">Take Photo</span>
              </button>
              <button
                type="button"
                onClick={handleFileSelect}
                className="bg-blue-600 text-white py-2 px-4 rounded-lg flex items-center justify-center space-x-2 hover:bg-blue-700 transition"
              >
                <Image className="w-5 h-5" />
                <span className="text-sm font-medium">Choose Photo</span>
              </button>
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
                      onClick={() => removePhoto(index)}
                      className="absolute top-1 right-1 bg-red-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Submit Button */}
        <div className="p-4 mt-4">
          {isRecording && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 mb-3 text-center">
              <p className="text-sm text-yellow-800 font-semibold">
                ⚠️ Stop recording before submitting
              </p>
            </div>
          )}
          <button
            onClick={submitRequest}
            disabled={isRecording}
            className={`w-full py-4 rounded-xl font-bold text-lg shadow-lg transition-all flex items-center justify-center space-x-2 ${
              isRecording
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-blue-600 text-white active:scale-98'
            }`}
          >
            <Send className="w-6 h-6" />
            <span>{isRecording ? 'Recording...' : 'Submit Request'}</span>
          </button>
        </div>
      </div>
    );
  }

  if (step === 'processing') {
    return (
      <div className="min-h-screen bg-gray-50 p-4 flex items-center justify-center">
        <div className="text-center space-y-6">
          <div className="w-20 h-20 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <div>
            <div className="text-xl font-bold text-gray-900">Processing your request...</div>
            <div className="text-gray-600 mt-2">AI is transcribing and parsing the information</div>
          </div>
        </div>
      </div>
    );
  }

  if (step === 'review' && parsedData) {
    return (
      <div className="min-h-screen bg-gray-50 p-4 pb-24">
        <button onClick={() => setStep('choice')} className="text-blue-600 font-medium mb-4">← Re-record</button>

        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Review Parsed Data</h1>
          <p className="text-gray-600 mt-1">Check if everything looks correct</p>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="bg-purple-100 p-2 rounded-lg">
                <Mic className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <div className="font-semibold text-gray-900">Original Recording</div>
                <div className="text-sm text-gray-600">{formatTime(recordingTime)}</div>
              </div>
            </div>
            <button className="bg-purple-600 text-white p-2 rounded-lg">
              <Play className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="space-y-3">
          {Object.entries(parsedData).filter(([key]) => key !== 'confidence').map(([key, value]) => {
            const confidence = parsedData.confidence[key];
            const label = key.split(/(?=[A-Z])/).join(' ').replace(/^\w/, c => c.toUpperCase());

            return (
              <div key={key} className="bg-white border border-gray-200 rounded-xl p-4">
                <div className="flex items-start justify-between mb-2">
                  <label className="text-sm font-semibold text-gray-700">{label}</label>
                  {confidence >= 90 ? (
                    <CheckCircle className="w-5 h-5 text-green-600" />
                  ) : confidence >= 70 ? (
                    <AlertCircle className="w-5 h-5 text-yellow-600" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-red-600" />
                  )}
                </div>
                <input
                  type="text"
                  defaultValue={value as string}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900"
                />
                <div className="text-xs text-gray-500 mt-1">Confidence: {confidence}%</div>
              </div>
            );
          })}
        </div>

        <div className="p-4 mt-4">
          <button
            onClick={submitRequest}
            className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold text-lg shadow-lg active:scale-98 transition-transform flex items-center justify-center space-x-2"
          >
            <Send className="w-6 h-6" />
            <span>Submit Request</span>
          </button>
        </div>
      </div>
    );
  }

  if (step === 'success') {
    return (
      <div className="min-h-screen bg-gray-50 p-4 flex items-center justify-center">
        <div className="text-center space-y-6">
          <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle className="w-16 h-16 text-green-600" />
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-900">Request Submitted!</div>
            <div className="text-gray-600 mt-2">Operations team will review and respond soon</div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
