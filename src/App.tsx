import { useState, useRef, useEffect } from 'react';
import { Home, DollarSign, MessageSquare, Ticket, Image, BookOpen, Menu, X, User, Mic, StopCircle, Play, CheckCircle, AlertCircle, Send, FileText, Building2, Wrench, Package, AlertTriangle } from 'lucide-react';
import StainCalculator from './components/sales/StainCalculator';

type UserRole = 'sales' | 'operations';
type Section = 'home' | 'custom-pricing' | 'presentation' | 'stain-calculator' | 'dashboard' | 'request-queue' | 'analytics' | 'team';
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
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Sales Tools</h2>

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

      <div className="space-y-3 pt-4">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Submit Request</h2>

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

      <div className="space-y-3 pt-4 pb-8">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">More Tools</h2>

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
  );
};

interface CustomPricingRequestProps {
  onBack: () => void;
}

const CustomPricingRequest = ({ onBack }: CustomPricingRequestProps) => {
  const [step, setStep] = useState<RequestStep>('choice');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [transcript, setTranscript] = useState('');
  const [parsedData, setParsedData] = useState<ParsedData | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      const chunks: Blob[] = [];
      mediaRecorder.ondataavailable = (e) => chunks.push(e.data);
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        setAudioBlob(blob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      setStep('recording');

      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } catch (err) {
      alert('Microphone access denied. Please enable microphone permissions.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
      setStep('processing');

      setTimeout(() => {
        setTranscript("I'm at 123 Oak Street with the Johnsons. They want a 6-foot cedar privacy fence, about 200 linear feet. They want it stained dark walnut, and they need it done before their daughter's graduation party on June 15th. The backyard has a slope on the left side, maybe 15 degrees. Can we get custom pricing by end of day tomorrow?");
        setParsedData({
          customerName: 'The Johnsons',
          address: '123 Oak Street',
          fenceType: '6-foot cedar privacy fence',
          linearFeet: '200',
          specialRequirements: 'Dark walnut stain, sloped terrain (15°)',
          deadline: 'Before June 15th',
          urgency: 'End of day tomorrow',
          confidence: {
            customerName: 85,
            address: 95,
            fenceType: 90,
            linearFeet: 88,
            specialRequirements: 92,
            deadline: 85,
            urgency: 90
          }
        });
        setStep('review');
      }, 2000);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const submitRequest = () => {
    setStep('success');
    setTimeout(() => {
      onBack();
    }, 2000);
  };

  if (step === 'choice') {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <button onClick={onBack} className="text-blue-600 font-medium mb-4">← Back</button>

        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Custom Pricing Request</h1>
          <p className="text-gray-600 mt-1">How would you like to submit this request?</p>
        </div>

        <div className="space-y-4">
          <button
            onClick={startRecording}
            className="w-full bg-gradient-to-r from-purple-600 to-purple-700 text-white p-8 rounded-2xl shadow-lg active:scale-98 transition-transform"
          >
            <div className="flex flex-col items-center space-y-3">
              <div className="bg-white/20 p-4 rounded-full">
                <Mic className="w-12 h-12" />
              </div>
              <div className="text-center">
                <div className="text-xl font-bold">Record Request (Recommended)</div>
                <div className="text-sm text-purple-100 mt-1">Just talk - we'll fill out the form for you</div>
                <div className="text-xs text-purple-200 mt-2">⚡ Takes 30 seconds vs 5 minutes typing</div>
              </div>
            </div>
          </button>

          <button className="w-full bg-white border-2 border-gray-200 p-6 rounded-xl shadow-sm active:bg-gray-50">
            <div className="flex items-center justify-center space-x-3">
              <FileText className="w-6 h-6 text-gray-600" />
              <div className="font-semibold text-gray-900">Fill Form Manually</div>
            </div>
          </button>
        </div>

        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-xl p-4">
          <p className="text-sm text-blue-800">
            <strong>💡 Pro Tip:</strong> Voice recording captures details you might forget to type, like site conditions or customer urgency!
          </p>
        </div>
      </div>
    );
  }

  if (step === 'recording') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 to-purple-700 p-4 flex items-center justify-center">
        <div className="text-center text-white space-y-8">
          <div className="space-y-4">
            <div className="mx-auto w-32 h-32 bg-white/20 rounded-full flex items-center justify-center animate-pulse">
              <Mic className="w-16 h-16" />
            </div>
            <div className="text-4xl font-bold">{formatTime(recordingTime)}</div>
            <div className="text-xl">Recording...</div>
            <div className="text-purple-200">Describe the pricing request naturally</div>
          </div>

          <button
            onClick={stopRecording}
            className="bg-white text-purple-600 px-8 py-4 rounded-full font-bold text-lg shadow-xl active:scale-95 transition-transform flex items-center space-x-2 mx-auto"
          >
            <StopCircle className="w-6 h-6" />
            <span>Stop Recording</span>
          </button>

          <div className="text-sm text-purple-200 max-w-md mx-auto">
            <strong>What to say:</strong> Customer name, address, fence type, linear feet, special requirements, deadline, urgency
          </div>
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
  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-900 mb-4">Operations Dashboard</h1>
      <p className="text-gray-600">Operations view coming soon - request queue, analytics, team management</p>
    </div>
  );
};

export default App;
