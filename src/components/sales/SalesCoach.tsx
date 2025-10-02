import { useState, useRef, useEffect } from 'react';
import { Mic, Square, Clock, Award, ChevronRight, CheckCircle, XCircle, AlertCircle, TrendingUp, Settings } from 'lucide-react';
import { uploadRecording, getRecordings, getUserStats, setDebugCallback, type Recording } from '../../lib/recordings';

interface SalesCoachProps {
  userId: string;
  onOpenAdmin?: () => void;
}

export default function SalesCoach({ userId, onOpenAdmin }: SalesCoachProps) {
  const [activeTab, setActiveTab] = useState<'record' | 'recordings'>('record');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [selectedRecording, setSelectedRecording] = useState<Recording | null>(null);
  const [clientName, setClientName] = useState('');
  const [meetingDate, setMeetingDate] = useState(new Date().toISOString().split('T')[0]);
  const [stats, setStats] = useState({ totalRecordings: 0, averageScore: 0, completionRate: 0, improvement: 0 });
  const [debugLog, setDebugLog] = useState<string[]>([]);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Set up debug logging
  useEffect(() => {
    setDebugCallback((msg) => {
      setDebugLog(prev => [...prev, `${new Date().toLocaleTimeString()}: ${msg}`]);
    });
  }, []);

  // Load recordings and stats
  useEffect(() => {
    loadRecordings();
  }, [userId]);

  // Auto-refresh recordings every 5 seconds when processing
  useEffect(() => {
    const hasProcessing = recordings.some(r => r.status === 'transcribing' || r.status === 'analyzing');
    if (hasProcessing) {
      const interval = setInterval(loadRecordings, 5000);
      return () => clearInterval(interval);
    }
  }, [recordings]);

  // Recording timer
  useEffect(() => {
    if (isRecording) {
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRecording]);

  const loadRecordings = () => {
    const recs = getRecordings(userId);
    setRecordings(recs);
    setStats(getUserStats(userId));
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
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
    } catch (err) {
      alert('Microphone access denied. Please enable microphone permissions.');
    }
  };

  const stopRecording = async () => {
    if (!mediaRecorderRef.current || !isRecording) return;

    if (!clientName.trim()) {
      alert('Please enter a client name before stopping the recording.');
      return;
    }

    mediaRecorderRef.current.stop();
    setIsRecording(false);
    if (timerRef.current) clearInterval(timerRef.current);

    // Wait for audio blob
    setTimeout(async () => {
      try {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });

        // Upload and process
        await uploadRecording(blob, userId, clientName, meetingDate, 'standard');

        // Reset form
        setClientName('');
        setMeetingDate(new Date().toISOString().split('T')[0]);
        setRecordingTime(0);

        // Switch to recordings tab
        setActiveTab('recordings');
        loadRecordings();
      } catch (error) {
        console.error('Recording upload failed:', error);
        alert('Failed to upload recording. Please try again.');
      }
    }, 100);
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

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getScoreBgColor = (score: number) => {
    if (score >= 80) return 'bg-green-600';
    if (score >= 60) return 'bg-yellow-600';
    return 'bg-red-600';
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-semibold rounded-full">Completed</span>;
      case 'transcribing':
        return <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-semibold rounded-full animate-pulse">Transcribing...</span>;
      case 'analyzing':
        return <span className="px-2 py-1 bg-purple-100 text-purple-800 text-xs font-semibold rounded-full animate-pulse">Analyzing...</span>;
      case 'failed':
        return <span className="px-2 py-1 bg-red-100 text-red-800 text-xs font-semibold rounded-full">Failed</span>;
      default:
        return <span className="px-2 py-1 bg-gray-100 text-gray-800 text-xs font-semibold rounded-full">Processing</span>;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-gray-900">AI Sales Coach</h1>
              <p className="text-xs text-gray-600">Analyze your sales meetings</p>
            </div>
            <div className="flex gap-4 items-center">
              <button
                onClick={onOpenAdmin}
                className="p-2 bg-gray-100 rounded-lg hover:bg-gray-200"
                title="Admin Settings & Delete Recordings"
              >
                <Settings className="w-5 h-5 text-gray-600" />
              </button>
              <div className="text-center">
                <div className={`text-xl font-bold ${getScoreColor(stats.averageScore)}`}>{stats.averageScore}%</div>
                <div className="text-xs text-gray-600">Avg Score</div>
              </div>
              {stats.improvement !== 0 && (
                <div className="text-center">
                  <div className={`text-xl font-bold ${stats.improvement > 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {stats.improvement > 0 ? '+' : ''}{stats.improvement}%
                  </div>
                  <div className="text-xs text-gray-600">Improvement</div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="px-4 mt-4">
        <div className="flex gap-4 border-b border-gray-200">
          <button
            onClick={() => setActiveTab('record')}
            className={`px-4 py-2 font-medium ${
              activeTab === 'record'
                ? 'text-purple-600 border-b-2 border-purple-600'
                : 'text-gray-600'
            }`}
          >
            <Mic className="inline w-4 h-4 mr-2" />
            Record
          </button>
          <button
            onClick={() => setActiveTab('recordings')}
            className={`px-4 py-2 font-medium ${
              activeTab === 'recordings'
                ? 'text-purple-600 border-b-2 border-purple-600'
                : 'text-gray-600'
            }`}
          >
            <TrendingUp className="inline w-4 h-4 mr-2" />
            My Recordings
            {recordings.length > 0 && (
              <span className="ml-2 bg-purple-100 text-purple-800 px-2 py-0.5 rounded-full text-xs font-bold">
                {recordings.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="px-4 py-6 pb-24">
        {activeTab === 'record' && (
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="text-center">
              <h2 className="text-xl font-bold mb-2">Record Sales Meeting</h2>
              <p className="text-sm text-gray-600 mb-6">
                Start recording before your sales appointment. AI will analyze your performance.
              </p>

              {/* Recording Interface */}
              <div className="mb-6">
                <div className={`inline-flex items-center justify-center w-40 h-40 rounded-full ${
                  isRecording ? 'bg-red-100 animate-pulse' : 'bg-gray-100'
                }`}>
                  {isRecording ? (
                    <div className="text-center">
                      <div className="text-3xl font-bold text-red-600 mb-1">{formatTime(recordingTime)}</div>
                      <div className="text-sm text-red-600">Recording...</div>
                    </div>
                  ) : (
                    <Mic className="w-16 h-16 text-gray-400" />
                  )}
                </div>
              </div>

              {/* Client Info Form */}
              {!isRecording && (
                <div className="mb-6 space-y-3">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Client Name</label>
                    <input
                      type="text"
                      value={clientName}
                      onChange={(e) => setClientName(e.target.value)}
                      placeholder="Enter client name"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Meeting Date</label>
                    <input
                      type="date"
                      value={meetingDate}
                      onChange={(e) => setMeetingDate(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    />
                  </div>
                </div>
              )}

              {/* Recording Controls */}
              <div className="flex justify-center gap-4">
                {!isRecording ? (
                  <button
                    onClick={startRecording}
                    disabled={!clientName.trim()}
                    className={`px-6 py-3 rounded-xl font-semibold flex items-center gap-2 ${
                      clientName.trim()
                        ? 'bg-purple-600 text-white hover:bg-purple-700'
                        : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    }`}
                  >
                    <Mic className="w-5 h-5" />
                    Start Recording
                  </button>
                ) : (
                  <>
                    <button
                      onClick={cancelRecording}
                      className="px-6 py-3 bg-gray-200 text-gray-700 rounded-xl font-semibold hover:bg-gray-300 flex items-center gap-2"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={stopRecording}
                      className="px-6 py-3 bg-red-600 text-white rounded-xl font-semibold hover:bg-red-700 flex items-center gap-2"
                    >
                      <Square className="w-5 h-5" />
                      Stop & Analyze
                    </button>
                  </>
                )}
              </div>

              {isRecording && (
                <div className="mt-6 bg-blue-50 rounded-lg p-4">
                  <p className="text-sm text-blue-800">
                    <strong>Tip:</strong> Place your phone where it can clearly capture both voices
                  </p>
                </div>
              )}

              {/* Debug Log */}
              {debugLog.length > 0 && (
                <div className="mt-6 bg-gray-900 rounded-lg p-4 max-h-64 overflow-y-auto">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-white font-semibold text-sm">Debug Log</h3>
                    <button
                      onClick={() => setDebugLog([])}
                      className="text-white text-xs bg-gray-700 px-2 py-1 rounded hover:bg-gray-600"
                    >
                      Clear
                    </button>
                  </div>
                  <div className="space-y-1 font-mono text-xs">
                    {debugLog.map((log, idx) => (
                      <div key={idx} className="text-green-400">{log}</div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'recordings' && (
          <div className="space-y-4">
            {recordings.length === 0 ? (
              <div className="bg-white rounded-xl p-12 text-center">
                <Mic className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No recordings yet</h3>
                <p className="text-gray-600 mb-6">Record your first sales meeting to get AI coaching</p>
                <button
                  onClick={() => setActiveTab('record')}
                  className="px-6 py-3 bg-purple-600 text-white rounded-xl font-semibold hover:bg-purple-700"
                >
                  Start Recording
                </button>
              </div>
            ) : (
              recordings.map(recording => (
                <div
                  key={recording.id}
                  className="bg-white rounded-xl shadow p-4 cursor-pointer hover:shadow-lg transition-shadow"
                  onClick={() => recording.status === 'completed' && setSelectedRecording(recording)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold">{recording.clientName}</h3>
                        {getStatusBadge(recording.status)}
                      </div>

                      <div className="flex items-center gap-4 text-sm text-gray-600 mb-2">
                        <span>{recording.meetingDate}</span>
                        {recording.duration && (
                          <span className="flex items-center gap-1">
                            <Clock className="w-4 h-4" />
                            {recording.duration}
                          </span>
                        )}
                      </div>

                      {recording.status === 'completed' && recording.analysis && (
                        <div className="flex items-center gap-6">
                          <div className="flex items-center gap-2">
                            <Award className={`w-5 h-5 ${getScoreColor(recording.analysis.overallScore)}`} />
                            <span className={`text-xl font-bold ${getScoreColor(recording.analysis.overallScore)}`}>
                              {recording.analysis.overallScore}%
                            </span>
                          </div>
                          <div className="flex gap-1">
                            {recording.analysis.processSteps.map((step, idx) => (
                              step.completed ? (
                                <CheckCircle key={idx} className="w-5 h-5 text-green-500" />
                              ) : (
                                <XCircle key={idx} className="w-5 h-5 text-gray-300" />
                              )
                            ))}
                          </div>
                        </div>
                      )}

                      {recording.error && (
                        <div className="flex items-center gap-2 text-red-600 text-sm">
                          <AlertCircle className="w-4 h-4" />
                          <span>{recording.error}</span>
                        </div>
                      )}
                    </div>
                    {recording.status === 'completed' && <ChevronRight className="w-6 h-6 text-gray-400" />}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Detailed Analysis Modal */}
      {selectedRecording && selectedRecording.analysis && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              {/* Header */}
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-2xl font-bold">{selectedRecording.clientName}</h2>
                  <p className="text-gray-600">{selectedRecording.meetingDate} • {selectedRecording.duration}</p>
                </div>
                <button
                  onClick={() => setSelectedRecording(null)}
                  className="text-gray-500 hover:text-gray-700 text-2xl"
                >
                  ×
                </button>
              </div>

              {/* Overall Score */}
              <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-xl p-6 mb-6">
                <div className="text-center">
                  <div className={`text-5xl font-bold ${getScoreColor(selectedRecording.analysis.overallScore)} mb-2`}>
                    {selectedRecording.analysis.overallScore}%
                  </div>
                  <div className="text-gray-600 font-medium">Overall Performance Score</div>
                  {selectedRecording.analysis.predictedOutcome && (
                    <div className="mt-3 text-sm">
                      <span className={`font-semibold ${
                        selectedRecording.analysis.predictedOutcome.likelihood === 'high' ? 'text-green-600' :
                        selectedRecording.analysis.predictedOutcome.likelihood === 'medium' ? 'text-yellow-600' :
                        'text-red-600'
                      }`}>
                        {selectedRecording.analysis.predictedOutcome.likelihood.toUpperCase()} likelihood of close
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Coaching Priorities */}
              <div className="mb-6">
                <h3 className="text-xl font-bold mb-4">🎯 Top Coaching Priorities</h3>
                <div className="space-y-2">
                  {selectedRecording.analysis.coachingPriorities.map((priority, idx) => (
                    <div key={idx} className="flex items-start gap-3 bg-yellow-50 rounded-lg p-4">
                      <span className="flex-shrink-0 w-6 h-6 bg-yellow-600 text-white rounded-full flex items-center justify-center text-sm font-bold">
                        {idx + 1}
                      </span>
                      <p className="text-gray-800">{priority}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Process Steps */}
              <div className="mb-6">
                <h3 className="text-xl font-bold mb-4">Sales Process Analysis</h3>
                <div className="space-y-3">
                  {selectedRecording.analysis.processSteps.map((step, idx) => (
                    <div key={idx} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                          {step.completed ? (
                            <CheckCircle className="w-6 h-6 text-green-500" />
                          ) : (
                            <XCircle className="w-6 h-6 text-red-500" />
                          )}
                          <span className="font-semibold">{step.name}</span>
                        </div>
                        {step.completed && (
                          <span className={`text-sm font-bold ${getScoreColor(step.quality)}`}>
                            {step.quality}%
                          </span>
                        )}
                      </div>
                      {step.completed && (
                        <>
                          <div className="ml-9 mb-2">
                            <div className="w-full bg-gray-200 rounded-full h-2">
                              <div
                                className={`h-2 rounded-full ${getScoreBgColor(step.quality)}`}
                                style={{ width: `${step.quality}%` }}
                              />
                            </div>
                          </div>
                          <p className="ml-9 text-sm text-gray-700">{step.feedback}</p>
                          {step.examples && step.examples.length > 0 && (
                            <div className="ml-9 mt-2 text-xs text-gray-600 bg-gray-50 rounded p-2">
                              <strong>Examples:</strong>
                              <ul className="list-disc ml-4 mt-1">
                                {step.examples.map((ex, i) => (
                                  <li key={i}>"{ex}"</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Key Metrics */}
              <div className="mb-6">
                <h3 className="text-xl font-bold mb-4">Key Metrics</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="text-sm text-gray-600 mb-1">Talk/Listen Ratio</div>
                    <div className="text-2xl font-bold text-purple-600">
                      {selectedRecording.analysis.metrics.talkListenRatio}
                    </div>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="text-sm text-gray-600 mb-1">Questions Asked</div>
                    <div className="text-2xl font-bold text-purple-600">
                      {selectedRecording.analysis.metrics.questionsAsked}
                    </div>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="text-sm text-gray-600 mb-1">Objections Handled</div>
                    <div className="text-2xl font-bold text-purple-600">
                      {selectedRecording.analysis.metrics.objections}
                    </div>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="text-sm text-gray-600 mb-1">Calls to Action</div>
                    <div className="text-2xl font-bold text-purple-600">
                      {selectedRecording.analysis.metrics.callToActions}
                    </div>
                  </div>
                </div>
              </div>

              {/* Strengths */}
              <div className="mb-6">
                <h3 className="text-xl font-bold mb-4">💪 Strengths</h3>
                <div className="space-y-2">
                  {selectedRecording.analysis.strengths.map((strength, idx) => (
                    <div key={idx} className="flex items-start gap-3 bg-green-50 rounded-lg p-4">
                      <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                      <p className="text-gray-800">{strength}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Areas for Improvement */}
              <div className="mb-6">
                <h3 className="text-xl font-bold mb-4">📈 Areas for Improvement</h3>
                <div className="space-y-2">
                  {selectedRecording.analysis.improvements.map((improvement, idx) => (
                    <div key={idx} className="flex items-start gap-3 bg-blue-50 rounded-lg p-4">
                      <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                      <p className="text-gray-800">{improvement}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Key Moments */}
              {selectedRecording.analysis.keyMoments && selectedRecording.analysis.keyMoments.length > 0 && (
                <div>
                  <h3 className="text-xl font-bold mb-4">⭐ Key Moments</h3>
                  <div className="space-y-3">
                    {selectedRecording.analysis.keyMoments.map((moment, idx) => (
                      <div key={idx} className="border-l-4 rounded-r-lg p-4 bg-gray-50" style={{
                        borderColor: moment.type === 'positive' ? '#10b981' :
                                    moment.type === 'negative' ? '#ef4444' :
                                    moment.type === 'turning_point' ? '#f59e0b' : '#6b7280'
                      }}>
                        <div className="flex items-start justify-between mb-2">
                          <span className="text-sm font-semibold text-gray-600">{moment.timestamp}</span>
                          <span className={`text-xs px-2 py-1 rounded-full ${
                            moment.type === 'positive' ? 'bg-green-100 text-green-800' :
                            moment.type === 'negative' ? 'bg-red-100 text-red-800' :
                            moment.type === 'turning_point' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {moment.type.replace('_', ' ')}
                          </span>
                        </div>
                        <p className="text-gray-900 font-medium mb-1">{moment.description}</p>
                        <p className="text-gray-600 text-sm mb-2">{moment.impact}</p>
                        {moment.quote && (
                          <p className="text-xs text-gray-500 italic bg-white rounded p-2">"{moment.quote}"</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
