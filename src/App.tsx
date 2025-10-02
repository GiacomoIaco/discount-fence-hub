import { useState, useRef } from 'react';
import { Home, DollarSign, MessageSquare, Ticket, Image, BookOpen, Menu, X, User, Mic, StopCircle, Play, CheckCircle, AlertCircle, Send, FileText, Building2, Wrench, Package, AlertTriangle } from 'lucide-react';
import StainCalculator from './components/sales/StainCalculator';
import { transcribeAudio } from './lib/openai';
import { parseVoiceTranscript } from './lib/claude';

type UserRole = 'sales' | 'operations';
type Section = 'home' | 'custom-pricing' | 'my-requests' | 'presentation' | 'stain-calculator' | 'dashboard' | 'request-queue' | 'analytics' | 'team' | 'manager-dashboard';
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

function App() {
  const [userRole] = useState<UserRole>('sales');
  const [userName] = useState('John Smith');
  const [activeSection, setActiveSection] = useState<Section>('home');
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const operationsNav = [
    { id: 'dashboard' as Section, name: 'Dashboard', icon: Home },
    { id: 'request-queue' as Section, name: 'Request Queue', icon: Ticket },
    { id: 'analytics' as Section, name: 'Analytics', icon: DollarSign },
    { id: 'team' as Section, name: 'Team', icon: User },
  ];

  const renderContent = () => {
    if (userRole === 'sales') {
      return <SalesRepView activeSection={activeSection} setActiveSection={setActiveSection} />;
    } else {
      return <OperationsView activeSection={activeSection} />;
    }
  };

  if (userRole === 'sales') {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
          <div className="px-4 py-3 flex items-center justify-between">
            <div>
              <h1 className="font-bold text-lg text-gray-900">Discount Fence USA</h1>
              <p className="text-xs text-gray-500">Hey {userName}! 👋</p>
            </div>
            <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center">
              <User className="w-6 h-6 text-white" />
            </div>
          </div>
        </div>
        <div className="pb-20">
          {renderContent()}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50">
      <div className={`${sidebarOpen ? 'w-64' : 'w-20'} bg-gray-900 text-white transition-all duration-300 flex flex-col`}>
        <div className="p-4 border-b border-gray-800 flex items-center justify-between">
          {sidebarOpen ? (
            <>
              <div>
                <h1 className="font-bold text-lg">Discount Fence USA</h1>
                <p className="text-xs text-gray-400">Operations</p>
              </div>
              <button onClick={() => setSidebarOpen(false)} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </>
          ) : (
            <button onClick={() => setSidebarOpen(true)} className="mx-auto text-gray-400 hover:text-white">
              <Menu className="w-6 h-6" />
            </button>
          )}
        </div>

        <nav className="flex-1 p-4 space-y-2">
          {operationsNav.map((item) => {
            const Icon = item.icon;
            const isActive = activeSection === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveSection(item.id)}
                className={`w-full flex items-center space-x-3 px-3 py-3 rounded-lg transition-colors ${
                  isActive ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                }`}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                {sidebarOpen && <span className="font-medium">{item.name}</span>}
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-gray-800">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
              <User className="w-6 h-6" />
            </div>
            {sidebarOpen && (
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{userName}</p>
                <p className="text-xs text-gray-400">Operations Manager</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <div className="p-8 max-w-7xl mx-auto">
          {renderContent()}
        </div>
      </div>
    </div>
  );
}

interface SalesRepViewProps {
  activeSection: Section;
  setActiveSection: (section: Section) => void;
}

const SalesRepView = ({ activeSection, setActiveSection }: SalesRepViewProps) => {
  if (activeSection === 'custom-pricing') {
    return <CustomPricingRequest onBack={() => setActiveSection('home')} />;
  }

  if (activeSection === 'my-requests') {
    return <MyRequests onBack={() => setActiveSection('home')} />;
  }

  if (activeSection === 'presentation') {
    return <ClientPresentation onBack={() => setActiveSection('home')} />;
  }

  if (activeSection === 'stain-calculator') {
    return <StainCalculator onBack={() => setActiveSection('home')} />;
  }

  return (
    <div className="space-y-4 p-4">
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Daily Essentials</h2>

        <button
          onClick={() => setActiveSection('presentation')}
          className="w-full bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6 rounded-xl shadow-lg active:scale-98 transition-transform"
        >
          <div className="flex items-center space-x-4">
            <div className="bg-white/20 p-3 rounded-lg">
              <FileText className="w-8 h-8" />
            </div>
            <div className="flex-1 text-left">
              <div className="font-bold text-lg">Start Client Presentation</div>
              <div className="text-sm text-blue-100">Show customers why we're #1</div>
            </div>
          </div>
        </button>

        <button className="w-full bg-white border-2 border-gray-200 p-5 rounded-xl shadow-sm active:scale-98 transition-transform">
          <div className="flex items-center space-x-4">
            <div className="bg-purple-100 p-3 rounded-lg">
              <Image className="w-7 h-7 text-purple-600" />
            </div>
            <div className="flex-1 text-left">
              <div className="font-bold text-gray-900">Take Photo Now</div>
              <div className="text-sm text-gray-600">Quick capture for this job</div>
            </div>
          </div>
        </button>
      </div>

      <div className="space-y-3 pt-4">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Track Requests</h2>

        <button
          onClick={() => setActiveSection('my-requests')}
          className="w-full bg-gradient-to-r from-green-600 to-green-700 text-white p-5 rounded-xl shadow-md active:scale-98 transition-transform"
        >
          <div className="flex items-center space-x-4">
            <div className="bg-white/20 p-3 rounded-lg">
              <Ticket className="w-7 h-7" />
            </div>
            <div className="flex-1 text-left">
              <div className="font-bold text-lg">My Requests</div>
              <div className="text-sm text-green-100">View status & pricing responses</div>
            </div>
            <div className="bg-white/30 px-3 py-1 rounded-full font-bold">3</div>
          </div>
        </button>
      </div>

      <div className="space-y-3 pt-4">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Sales Tools</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <button
            onClick={() => setActiveSection('stain-calculator')}
            className="w-full bg-white border border-gray-200 p-4 rounded-xl shadow-sm active:bg-gray-50"
          >
            <div className="flex items-center space-x-3">
              <div className="bg-green-100 p-2 rounded-lg">
                <DollarSign className="w-6 h-6 text-green-600" />
              </div>
              <div className="flex-1 text-left">
                <div className="font-semibold text-gray-900">Pre-Stain Calculator</div>
                <div className="text-xs text-gray-600">Show ROI vs DIY staining</div>
              </div>
            </div>
          </button>

          <button className="w-full bg-white border border-gray-200 p-4 rounded-xl shadow-sm active:bg-gray-50">
            <div className="flex items-center space-x-3">
              <div className="bg-blue-100 p-2 rounded-lg">
                <MessageSquare className="w-6 h-6 text-blue-600" />
              </div>
              <div className="flex-1 text-left">
                <div className="font-semibold text-gray-900">AI Sales Coach</div>
                <div className="text-xs text-gray-600">Get real-time guidance</div>
              </div>
            </div>
          </button>
        </div>
      </div>

      <div className="space-y-3 pt-4">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Submit Request</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          <button
            onClick={() => setActiveSection('custom-pricing')}
            className="w-full bg-white border border-gray-200 p-4 rounded-xl shadow-sm active:bg-gray-50 relative"
          >
            <div className="flex items-center space-x-3">
              <div className="bg-orange-100 p-2 rounded-lg">
                <DollarSign className="w-6 h-6 text-orange-600" />
              </div>
              <div className="flex-1 text-left">
                <div className="font-semibold text-gray-900">Custom Pricing Request</div>
                <div className="text-xs text-gray-600">Get pricing for special projects</div>
              </div>
              <div className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full font-medium">
                🎤 Voice
              </div>
            </div>
          </button>

          <button className="w-full bg-white border border-gray-200 p-4 rounded-xl shadow-sm active:bg-gray-50">
            <div className="flex items-center space-x-3">
              <div className="bg-blue-100 p-2 rounded-lg">
                <Building2 className="w-6 h-6 text-blue-600" />
              </div>
              <div className="flex-1 text-left">
                <div className="font-semibold text-gray-900">New Builder/Community</div>
                <div className="text-xs text-gray-600">Submit new client info</div>
              </div>
            </div>
          </button>

          <button className="w-full bg-white border border-gray-200 p-4 rounded-xl shadow-sm active:bg-gray-50">
            <div className="flex items-center space-x-3">
              <div className="bg-red-100 p-2 rounded-lg">
                <Wrench className="w-6 h-6 text-red-600" />
              </div>
              <div className="flex-1 text-left">
                <div className="font-semibold text-gray-900">Installation Issue</div>
                <div className="text-xs text-gray-600">Report installation problems</div>
              </div>
            </div>
          </button>

          <button className="w-full bg-white border border-gray-200 p-4 rounded-xl shadow-sm active:bg-gray-50">
            <div className="flex items-center space-x-3">
              <div className="bg-yellow-100 p-2 rounded-lg">
                <Package className="w-6 h-6 text-yellow-600" />
              </div>
              <div className="flex-1 text-left">
                <div className="font-semibold text-gray-900">Material Request</div>
                <div className="text-xs text-gray-600">Request supplies or materials</div>
              </div>
            </div>
          </button>

          <button className="w-full bg-white border border-gray-200 p-4 rounded-xl shadow-sm active:bg-gray-50">
            <div className="flex items-center space-x-3">
              <div className="bg-purple-100 p-2 rounded-lg">
                <AlertTriangle className="w-6 h-6 text-purple-600" />
              </div>
              <div className="flex-1 text-left">
                <div className="font-semibold text-gray-900">Customer Escalation</div>
                <div className="text-xs text-gray-600">Escalate customer issues</div>
              </div>
            </div>
          </button>
        </div>
      </div>

      <div className="space-y-3 pt-4 pb-8">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">More Tools</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <button className="w-full bg-white border border-gray-200 p-4 rounded-xl shadow-sm active:bg-gray-50">
            <div className="flex items-center space-x-3">
              <BookOpen className="w-6 h-6 text-gray-600" />
              <div className="flex-1 text-left">
                <div className="font-semibold text-gray-900">Sales Resources</div>
              </div>
            </div>
          </button>

          <button className="w-full bg-white border border-gray-200 p-4 rounded-xl shadow-sm active:bg-gray-50">
            <div className="flex items-center space-x-3">
              <Image className="w-6 h-6 text-gray-600" />
              <div className="flex-1 text-left">
                <div className="font-semibold text-gray-900">Browse Photo Gallery</div>
              </div>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};

interface CustomPricingRequestProps {
  onBack: () => void;
}

const CustomPricingRequest = ({ onBack }: CustomPricingRequestProps) => {
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

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setPhotos(prev => [...prev, ...Array.from(e.target.files!)]);
    }
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
      alert('Microphone access denied. Please enable microphone permissions.');
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

          // Stay on form view
        } catch (error) {
          console.error('Error processing audio:', error);
          alert('Failed to process audio. Using demo mode.\n\nError: ' + (error as Error).message);

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

          // Stay on form view
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
      projectNumber: formData.projectNumber || `REQ-${Date.now()}`,
      customerName: formData.customerName,
      address: formData.address,
      fenceType: formData.fenceType,
      linearFeet: formData.linearFeet,
      status: 'pending',
      priority: formData.urgency === 'high' ? 'high' : formData.urgency === 'medium' ? 'medium' : 'low',
      submittedDate: new Date().toISOString().split('T')[0],
      responseTime: 'pending',
      specialRequirements: formData.specialRequirements,
      deadline: formData.deadline,
      photos: photoBase64,
      messages: []
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
          <div className="sticky top-0 z-50 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-xl p-4 mb-4 shadow-lg animate-pulse">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="bg-white/20 p-2 rounded-lg">
                  <Mic className="w-6 h-6" />
                </div>
                <div>
                  <div className="font-bold text-lg">Recording...</div>
                  <div className="text-sm text-red-100">{formatTime(recordingTime)}</div>
                </div>
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={cancelRecording}
                  className="bg-white/20 text-white px-4 py-2 rounded-lg font-semibold hover:bg-white/30 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={stopRecording}
                  className="bg-white text-red-600 px-4 py-2 rounded-lg font-semibold hover:bg-gray-100 transition flex items-center space-x-1"
                >
                  <StopCircle className="w-4 h-4" />
                  <span>Stop</span>
                </button>
              </div>
            </div>
            <div className="mt-2 text-xs text-red-100">
              Speak naturally - mention customer name, address, fence type, linear feet, special requirements, and deadline
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
            <label className="text-sm font-semibold text-gray-700 block mb-2">Photos</label>
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={handlePhotoUpload}
              className="w-full text-sm text-gray-600"
            />
            {photos.length > 0 && (
              <div className="mt-3 grid grid-cols-3 gap-2">
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
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4">
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

        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4">
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
};

interface MyRequestsProps {
  onBack: () => void;
}

const MyRequests = ({ onBack }: MyRequestsProps) => {
  const [selectedRequest, setSelectedRequest] = useState<number | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  // Load from localStorage - merge with mock data for demo
  const savedRequests = JSON.parse(localStorage.getItem('myRequests') || '[]');
  const mockRequests = [
    {
      id: 1,
      projectNumber: 'JOB-2453',
      customerName: 'The Johnsons',
      address: '123 Oak Street',
      fenceType: '6-foot cedar privacy',
      linearFeet: '200',
      status: 'quoted',
      priority: 'high',
      submittedDate: '2025-10-01',
      responseTime: '2 hours',
      quotedPrice: '$8,950',
      messages: [
        { from: 'Operations', text: 'Reviewed your request. Quote is ready!', time: '2 hours ago' },
        { from: 'You', text: 'Customer needs this before June 15th', time: '4 hours ago' }
      ]
    },
    {
      id: 2,
      projectNumber: 'JOB-2441',
      customerName: 'Smith Residence',
      address: '456 Maple Drive',
      fenceType: '4-foot vinyl picket',
      linearFeet: '150',
      status: 'pending',
      priority: 'medium',
      submittedDate: '2025-10-01',
      responseTime: 'pending',
      messages: [
        { from: 'You', text: 'Straightforward install, no slope issues', time: '1 hour ago' }
      ]
    },
    {
      id: 3,
      projectNumber: 'ST-8821',
      customerName: 'Garcia Family',
      address: '789 Pine Lane',
      fenceType: '6-foot wood privacy with gates',
      linearFeet: '300',
      status: 'won',
      priority: 'low',
      submittedDate: '2025-09-28',
      responseTime: '3 hours',
      quotedPrice: '$12,450',
      finalPrice: '$12,200',
      messages: [
        { from: 'You', text: 'Customer accepted! Scheduled for next week.', time: '2 days ago' },
        { from: 'Operations', text: 'Great work! Updated in system.', time: '2 days ago' }
      ]
    }
  ];

  const allRequests = [...savedRequests, ...mockRequests];

  // Filter and search
  const requests = allRequests.filter(req => {
    const matchesSearch = searchQuery === '' ||
      req.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      req.projectNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      req.address.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesFilter = filterStatus === 'all' || req.status === filterStatus;

    return matchesSearch && matchesFilter;
  });

  const selectedReq = allRequests.find(r => r.id === selectedRequest);

  const updateRequestStatus = (newStatus: string) => {
    if (!selectedReq) return;

    const updatedRequests = allRequests.map(req => {
      if (req.id === selectedRequest) {
        return { ...req, status: newStatus };
      }
      return req;
    });

    // Update localStorage for saved requests
    const savedOnly = updatedRequests.filter((r: any) => savedRequests.find((s: any) => s.id === r.id));
    localStorage.setItem('myRequests', JSON.stringify(savedOnly));

    alert(`Request marked as ${newStatus}!`);
    setSelectedRequest(null);
  };

  const sendMessage = () => {
    if (!newMessage.trim() || !selectedReq) return;

    const updatedRequests = requests.map(req => {
      if (req.id === selectedRequest) {
        return {
          ...req,
          messages: [
            ...req.messages,
            { from: 'You', text: newMessage, time: 'Just now' }
          ]
        };
      }
      return req;
    });

    // Update localStorage for saved requests
    const savedOnly = updatedRequests.filter((r: any) => savedRequests.find((s: any) => s.id === r.id));
    localStorage.setItem('myRequests', JSON.stringify(savedOnly));

    setNewMessage('');
    alert('Message sent to operations team!');
  };

  if (selectedRequest && selectedReq) {
    return (
      <div className="min-h-screen bg-gray-50 p-4 pb-24">
        <button onClick={() => setSelectedRequest(null)} className="text-blue-600 font-medium mb-4">← Back to Requests</button>

        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-2xl font-bold text-gray-900">{selectedReq.projectNumber}</h1>
            <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
              selectedReq.status === 'quoted' ? 'bg-blue-100 text-blue-700' :
              selectedReq.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
              'bg-green-100 text-green-700'
            }`}>
              {selectedReq.status.toUpperCase()}
            </span>
          </div>
          <p className="text-gray-600">{selectedReq.customerName} • {selectedReq.address}</p>
        </div>

        {/* Quoted Price Card */}
        {selectedReq.quotedPrice && (
          <div className="bg-gradient-to-r from-green-600 to-green-700 text-white rounded-xl p-6 mb-4 shadow-lg">
            <div className="text-sm font-semibold mb-1">QUOTED PRICE</div>
            <div className="text-4xl font-bold">{selectedReq.quotedPrice}</div>
            {selectedReq.finalPrice && (
              <div className="mt-2 text-sm">Final sold at: {selectedReq.finalPrice}</div>
            )}
          </div>
        )}

        {/* Quick Actions */}
        {selectedReq.status === 'quoted' && (
          <div className="grid grid-cols-2 gap-3 mb-4">
            <button
              onClick={() => updateRequestStatus('won')}
              className="bg-green-600 text-white py-3 rounded-xl font-semibold flex items-center justify-center space-x-2"
            >
              <CheckCircle className="w-5 h-5" />
              <span>Mark Won</span>
            </button>
            <button
              onClick={() => updateRequestStatus('lost')}
              className="bg-red-600 text-white py-3 rounded-xl font-semibold flex items-center justify-center space-x-2"
            >
              <X className="w-5 h-5" />
              <span>Mark Lost</span>
            </button>
          </div>
        )}

        {/* Project Details */}
        <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4">
          <h3 className="font-bold text-gray-900 mb-3">Project Details</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Fence Type:</span>
              <span className="font-semibold text-gray-900">{selectedReq.fenceType}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Linear Feet:</span>
              <span className="font-semibold text-gray-900">{selectedReq.linearFeet}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Response Time:</span>
              <span className="font-semibold text-gray-900">{selectedReq.responseTime}</span>
            </div>
          </div>
        </div>

        {/* Photos */}
        {selectedReq.photos && selectedReq.photos.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4">
            <h3 className="font-bold text-gray-900 mb-3">Photos ({selectedReq.photos.length})</h3>
            <div className="grid grid-cols-2 gap-2">
              {selectedReq.photos.map((photo: string, idx: number) => (
                <img
                  key={idx}
                  src={photo}
                  alt={`Photo ${idx + 1}`}
                  className="w-full h-32 object-cover rounded-lg cursor-pointer"
                  onClick={() => window.open(photo, '_blank')}
                />
              ))}
            </div>
          </div>
        )}

        {/* Messages */}
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <h3 className="font-bold text-gray-900 mb-3">Messages</h3>
          <div className="space-y-3">
            {selectedReq.messages.map((msg: any, idx: number) => (
              <div key={idx} className={`p-3 rounded-lg ${
                msg.from === 'You' ? 'bg-blue-50 ml-8' : 'bg-gray-50 mr-8'
              }`}>
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold text-sm text-gray-900">{msg.from}</span>
                  <span className="text-xs text-gray-500">{msg.time}</span>
                </div>
                <p className="text-sm text-gray-700">{msg.text}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Add Message Input */}
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4">
          <div className="flex space-x-2">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Type your message..."
              className="flex-1 border border-gray-300 rounded-xl px-4 py-3 text-gray-900"
              onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
            />
            <button
              onClick={sendMessage}
              disabled={!newMessage.trim()}
              className="bg-blue-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center space-x-2"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <button onClick={onBack} className="text-blue-600 font-medium mb-4">← Back</button>

      <div className="mb-4">
        <h1 className="text-2xl font-bold text-gray-900">My Requests</h1>
        <p className="text-gray-600 mt-1">Track status and view pricing responses</p>
      </div>

      {/* Search Bar */}
      <div className="mb-4">
        <input
          type="text"
          placeholder="Search by customer, project #, or address..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full border border-gray-300 rounded-xl px-4 py-3 text-gray-900"
        />
      </div>

      {/* Filter Buttons */}
      <div className="flex space-x-2 mb-4 overflow-x-auto pb-2">
        {['all', 'pending', 'quoted', 'won', 'lost'].map((status) => (
          <button
            key={status}
            onClick={() => setFilterStatus(status)}
            className={`px-4 py-2 rounded-lg font-semibold whitespace-nowrap ${
              filterStatus === status
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 border border-gray-300'
            }`}
          >
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </button>
        ))}
      </div>

      {/* Results Count */}
      <div className="mb-3 text-sm text-gray-600">
        Showing {requests.length} request{requests.length !== 1 ? 's' : ''}
      </div>

      <div className="space-y-3">
        {requests.map((request) => (
          <button
            key={request.id}
            onClick={() => setSelectedRequest(request.id)}
            className="w-full bg-white border-2 border-gray-200 rounded-xl p-4 text-left hover:border-blue-300 transition-colors"
          >
            <div className="flex items-start justify-between mb-2">
              <div>
                <div className="font-bold text-gray-900">{request.projectNumber}</div>
                <div className="text-sm text-gray-600">{request.customerName}</div>
              </div>
              <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                request.status === 'quoted' ? 'bg-blue-100 text-blue-700' :
                request.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                'bg-green-100 text-green-700'
              }`}>
                {request.status.toUpperCase()}
              </span>
            </div>

            <div className="text-sm text-gray-700 mb-2">{request.address}</div>
            <div className="text-sm text-gray-600">{request.fenceType} • {request.linearFeet} LF</div>

            {request.quotedPrice && (
              <div className="mt-3 pt-3 border-t border-gray-200">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-gray-700">Quoted Price:</span>
                  <span className="text-lg font-bold text-green-600">{request.quotedPrice}</span>
                </div>
              </div>
            )}

            {request.status === 'pending' && (
              <div className="mt-3 pt-3 border-t border-gray-200 text-sm text-yellow-700">
                <AlertCircle className="w-4 h-4 inline mr-1" />
                Waiting for operations response...
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
};

interface ClientPresentationProps {
  onBack: () => void;
}

const ClientPresentation = ({ onBack }: ClientPresentationProps) => {
  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <button onClick={onBack} className="text-blue-600 font-medium mb-4">← Back</button>

      <div className="bg-white border border-gray-200 rounded-xl p-8 text-center">
        <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-gray-900 mb-2">Client Presentation</h2>
        <p className="text-gray-600 mb-6">
          Upload your PowerPoint or PDF presentation here. It will open in fullscreen for customer viewing.
        </p>
        <button className="bg-blue-600 text-white px-6 py-3 rounded-lg font-medium">
          Upload Presentation
        </button>
      </div>
    </div>
  );
};

interface OperationsViewProps {
  activeSection: Section;
}

const OperationsView = ({ activeSection }: OperationsViewProps) => {
  if (activeSection === 'manager-dashboard') {
    return <ManagerDashboard onBack={() => window.location.reload()} />;
  }

  if (activeSection === 'request-queue') {
    return <RequestQueue onBack={() => window.location.reload()} />;
  }

  return (
    <div className="space-y-4 p-4">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">Operations Hub</h1>
      <p className="text-gray-600 mb-6">Manage pricing requests and track team performance</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <a
          href="#manager-dashboard"
          onClick={(e) => { e.preventDefault(); window.location.hash = 'manager-dashboard'; window.location.reload(); }}
          className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6 rounded-xl shadow-lg hover:shadow-xl transition-shadow"
        >
          <div className="flex items-center space-x-4">
            <div className="bg-white/20 p-3 rounded-lg">
              <DollarSign className="w-8 h-8" />
            </div>
            <div>
              <div className="font-bold text-xl">Manager Dashboard</div>
              <div className="text-sm text-blue-100">Track metrics, response times, win rates</div>
            </div>
          </div>
        </a>

        <a
          href="#request-queue"
          onClick={(e) => { e.preventDefault(); window.location.hash = 'request-queue'; window.location.reload(); }}
          className="bg-white border-2 border-gray-200 p-6 rounded-xl shadow-sm hover:border-blue-300 transition-colors"
        >
          <div className="flex items-center space-x-4">
            <div className="bg-orange-100 p-3 rounded-lg">
              <Ticket className="w-8 h-8 text-orange-600" />
            </div>
            <div>
              <div className="font-bold text-xl text-gray-900">Request Queue</div>
              <div className="text-sm text-gray-600">Process incoming pricing requests</div>
            </div>
          </div>
        </a>
      </div>
    </div>
  );
};

interface ManagerDashboardProps {
  onBack: () => void;
}

const ManagerDashboard = ({ onBack }: ManagerDashboardProps) => {
  // Mock data - would come from Supabase in production
  const metrics = {
    avgResponseTime: '2.4 hours',
    pendingRequests: 5,
    quotedToday: 12,
    conversionRate: '68%',
    avgCloseTime: '18 hours',
    totalRevenue: '$142,350'
  };

  const teamPerformance = [
    { name: 'Operations Lead', responseTime: '1.8h', closed: 24, winRate: '72%' },
    { name: 'Pricing Specialist', responseTime: '2.1h', closed: 18, winRate: '65%' },
    { name: 'Support Team', responseTime: '3.2h', closed: 15, winRate: '60%' }
  ];

  const recentRequests = [
    { id: 'REQ-2453', salesRep: 'John Smith', customer: 'The Johnsons', status: 'quoted', responseTime: '2h', priority: 'high', quotedPrice: '$8,950' },
    { id: 'REQ-2452', salesRep: 'Sarah Lee', customer: 'Garcia Family', status: 'pending', responseTime: '—', priority: 'medium', quotedPrice: '—' },
    { id: 'REQ-2451', salesRep: 'Mike Johnson', customer: 'Smith Residence', status: 'won', responseTime: '3h', priority: 'low', quotedPrice: '$6,200' },
    { id: 'REQ-2450', salesRep: 'John Smith', customer: 'Browns', status: 'lost', responseTime: '4h', priority: 'medium', quotedPrice: '$9,500' },
  ];

  return (
    <div className="min-h-screen bg-gray-50 p-4 pb-8">
      <button onClick={onBack} className="text-blue-600 font-medium mb-4">← Back</button>

      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Manager Dashboard</h1>
        <p className="text-gray-600 mt-1">Track team performance and pricing request metrics</p>
      </div>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="text-sm text-gray-600 mb-1">Avg Response Time</div>
          <div className="text-2xl font-bold text-gray-900">{metrics.avgResponseTime}</div>
          <div className="text-xs text-green-600 mt-1">↓ 12% vs last week</div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="text-sm text-gray-600 mb-1">Pending</div>
          <div className="text-2xl font-bold text-yellow-600">{metrics.pendingRequests}</div>
          <div className="text-xs text-gray-500 mt-1">Needs attention</div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="text-sm text-gray-600 mb-1">Quoted Today</div>
          <div className="text-2xl font-bold text-blue-600">{metrics.quotedToday}</div>
          <div className="text-xs text-green-600 mt-1">↑ 8% vs yesterday</div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="text-sm text-gray-600 mb-1">Win Rate</div>
          <div className="text-2xl font-bold text-green-600">{metrics.conversionRate}</div>
          <div className="text-xs text-green-600 mt-1">↑ 5% vs last month</div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="text-sm text-gray-600 mb-1">Avg Close Time</div>
          <div className="text-2xl font-bold text-gray-900">{metrics.avgCloseTime}</div>
          <div className="text-xs text-green-600 mt-1">↓ 6h vs last week</div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="text-sm text-gray-600 mb-1">Total Revenue</div>
          <div className="text-2xl font-bold text-green-600">{metrics.totalRevenue}</div>
          <div className="text-xs text-gray-500 mt-1">Last 30 days</div>
        </div>
      </div>

      {/* Team Performance */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4">
        <h2 className="font-bold text-lg text-gray-900 mb-4">Team Performance</h2>
        <div className="space-y-3">
          {teamPerformance.map((member, idx) => (
            <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex-1">
                <div className="font-semibold text-gray-900">{member.name}</div>
                <div className="text-sm text-gray-600">Response: {member.responseTime} • Closed: {member.closed}</div>
              </div>
              <div className="text-right">
                <div className="text-lg font-bold text-green-600">{member.winRate}</div>
                <div className="text-xs text-gray-500">Win Rate</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Requests */}
      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <h2 className="font-bold text-lg text-gray-900 mb-4">Recent Requests</h2>
        <div className="space-y-2">
          {recentRequests.map((req) => (
            <div key={req.id} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
              <div className="flex-1">
                <div className="flex items-center space-x-2">
                  <span className="font-semibold text-gray-900">{req.id}</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                    req.status === 'quoted' ? 'bg-blue-100 text-blue-700' :
                    req.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                    req.status === 'won' ? 'bg-green-100 text-green-700' :
                    'bg-red-100 text-red-700'
                  }`}>
                    {req.status.toUpperCase()}
                  </span>
                  <span className={`px-2 py-0.5 rounded-full text-xs ${
                    req.priority === 'high' ? 'bg-red-50 text-red-700' :
                    req.priority === 'medium' ? 'bg-yellow-50 text-yellow-700' :
                    'bg-gray-100 text-gray-600'
                  }`}>
                    {req.priority}
                  </span>
                </div>
                <div className="text-sm text-gray-600 mt-1">
                  {req.salesRep} • {req.customer} • Response: {req.responseTime}
                </div>
              </div>
              <div className="text-right">
                <div className="font-bold text-gray-900">{req.quotedPrice}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

interface RequestQueueProps {
  onBack: () => void;
}

const RequestQueue = ({ onBack }: RequestQueueProps) => {
  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <button onClick={onBack} className="text-blue-600 font-medium mb-4">← Back</button>
      <h1 className="text-2xl font-bold text-gray-900 mb-4">Request Queue</h1>
      <p className="text-gray-600">Process incoming pricing requests - coming soon</p>
    </div>
  );
};

export default App;
