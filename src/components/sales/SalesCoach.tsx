import { useState, useRef, useEffect, useCallback } from 'react';
import { Mic, Square, Clock, Award, ChevronRight, CheckCircle, XCircle, AlertCircle, TrendingUp, Settings, MessageSquare, Star, Trash2, WifiOff, Wifi, Trophy, Medal, Crown } from 'lucide-react';
import { uploadRecording, getRecordings, getUserStats, setDebugCallback, setUpdateCallback, addManagerReview, removeManagerReview, processOfflineQueue, getTeamLeaderboard, type Recording, type LeaderboardEntry } from '../../lib/recordings';
import { initOfflineDB, getOfflineQueueSize } from '../../lib/offlineQueue';
import { showError } from '../../lib/toast';

interface SalesCoachProps {
  userId: string;
  onOpenAdmin?: () => void;
}

export default function SalesCoach({ userId, onOpenAdmin }: SalesCoachProps) {
  const [activeTab, setActiveTab] = useState<'record' | 'recordings' | 'leaderboard'>('record');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [selectedRecording, setSelectedRecording] = useState<Recording | null>(null);
  const [clientName, setClientName] = useState('');
  const [meetingDate, setMeetingDate] = useState(new Date().toISOString().split('T')[0]);
  const [stats, setStats] = useState({ totalRecordings: 0, averageScore: 0, completionRate: 0, improvement: 0 });
  const [debugLog, setDebugLog] = useState<string[]>([]);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComments, setReviewComments] = useState('');
  const [reviewKeyTakeaways, setReviewKeyTakeaways] = useState('');
  const [reviewActionItems, setReviewActionItems] = useState('');
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [queueSize, setQueueSize] = useState(0);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [leaderboardTimeframe, setLeaderboardTimeframe] = useState<'week' | 'month' | 'all'>('month');

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Load recordings and queue size
  const loadRecordings = useCallback(async () => {
    const recs = getRecordings(userId);
    setRecordings(recs);
    setStats(getUserStats(userId));

    // Update queue size
    const size = await getOfflineQueueSize();
    setQueueSize(size);

    // Update leaderboard
    setLeaderboard(getTeamLeaderboard(leaderboardTimeframe));
  }, [userId, leaderboardTimeframe]);

  // Set up debug logging and update callback
  useEffect(() => {
    // Initialize offline DB
    initOfflineDB();

    setDebugCallback((msg) => {
      setDebugLog(prev => [...prev, `${new Date().toLocaleTimeString()}: ${msg}`]);
    });
    setUpdateCallback(() => {
      loadRecordings();
    });

    // Listen for storage update events
    const handleUpdate = () => {
      console.log('🔄 Recordings updated event received');
      loadRecordings();
    };
    window.addEventListener('recordings-updated', handleUpdate);

    // Listen for online/offline events
    const handleOnline = async () => {
      console.log('🌐 Back online');
      setIsOnline(true);
      // Process offline queue
      await processOfflineQueue();
      loadRecordings();
    };

    const handleOffline = () => {
      console.log('📵 Gone offline');
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('recordings-updated', handleUpdate);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [loadRecordings]);

  // Load recordings and stats
  useEffect(() => {
    loadRecordings();
  }, [loadRecordings]);

  // Auto-refresh recordings every 5 seconds when processing
  useEffect(() => {
    const hasProcessing = recordings.some(r => r.status === 'transcribing' || r.status === 'analyzing');
    if (hasProcessing) {
      const interval = setInterval(loadRecordings, 5000);
      return () => clearInterval(interval);
    }
  }, [recordings, loadRecordings]);

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
      showError('Microphone access denied. Please enable microphone permissions.');
    }
  };

  const stopRecording = async () => {
    if (!mediaRecorderRef.current || !isRecording) return;

    if (!clientName.trim()) {
      showError('Please enter a client name before stopping the recording.');
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
        showError('Failed to upload recording. Please try again.');
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

  const handleAddReview = () => {
    if (!selectedRecording || !reviewComments.trim()) return;

    const keyTakeaways = reviewKeyTakeaways.trim()
      ? reviewKeyTakeaways.split('\n').filter(t => t.trim())
      : undefined;
    const actionItems = reviewActionItems.trim()
      ? reviewActionItems.split('\n').filter(t => t.trim())
      : undefined;

    addManagerReview(userId, selectedRecording.id, {
      reviewerId: 'manager123',
      reviewerName: 'Manager',
      rating: reviewRating,
      comments: reviewComments,
      keyTakeaways,
      actionItems,
    });

    setShowReviewForm(false);
    setReviewRating(5);
    setReviewComments('');
    setReviewKeyTakeaways('');
    setReviewActionItems('');
    loadRecordings();
  };

  const handleRemoveReview = () => {
    if (!selectedRecording) return;
    if (confirm('Are you sure you want to remove this manager review?')) {
      removeManagerReview(userId, selectedRecording.id);
      loadRecordings();
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
              {/* Offline/Online Indicator */}
              <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium ${
                isOnline ? 'bg-green-100 text-green-800' : 'bg-orange-100 text-orange-800'
              }`}>
                {isOnline ? (
                  <>
                    <Wifi className="w-4 h-4" />
                    <span>Online</span>
                  </>
                ) : (
                  <>
                    <WifiOff className="w-4 h-4" />
                    <span>Offline Mode</span>
                  </>
                )}
                {queueSize > 0 && (
                  <span className="ml-1 px-1.5 py-0.5 bg-white rounded-full text-xs">
                    {queueSize} queued
                  </span>
                )}
              </div>

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
          <button
            onClick={() => setActiveTab('leaderboard')}
            className={`px-4 py-2 font-medium ${
              activeTab === 'leaderboard'
                ? 'text-purple-600 border-b-2 border-purple-600'
                : 'text-gray-600'
            }`}
          >
            <Trophy className="inline w-4 h-4 mr-2" />
            Leaderboard
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

        {/* Leaderboard Tab */}
        {activeTab === 'leaderboard' && (
          <div className="space-y-4">
            {/* Timeframe Filter */}
            <div className="flex gap-2 justify-center">
              <button
                onClick={() => setLeaderboardTimeframe('week')}
                className={`px-4 py-2 rounded-lg font-medium ${
                  leaderboardTimeframe === 'week'
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                This Week
              </button>
              <button
                onClick={() => setLeaderboardTimeframe('month')}
                className={`px-4 py-2 rounded-lg font-medium ${
                  leaderboardTimeframe === 'month'
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                This Month
              </button>
              <button
                onClick={() => setLeaderboardTimeframe('all')}
                className={`px-4 py-2 rounded-lg font-medium ${
                  leaderboardTimeframe === 'all'
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                All Time
              </button>
            </div>

            {/* Leaderboard List */}
            <div className="space-y-3">
              {leaderboard.map((entry) => {
                const isCurrentUser = entry.userId === userId;
                const getRankIcon = (rank: number) => {
                  if (rank === 1) return <Crown className="w-6 h-6 text-yellow-500" />;
                  if (rank === 2) return <Medal className="w-6 h-6 text-gray-400" />;
                  if (rank === 3) return <Medal className="w-6 h-6 text-amber-600" />;
                  return (
                    <div className="w-6 h-6 flex items-center justify-center">
                      <span className="text-sm font-bold text-gray-500">{rank}</span>
                    </div>
                  );
                };

                return (
                  <div
                    key={entry.userId}
                    className={`bg-white rounded-xl shadow p-4 ${
                      isCurrentUser ? 'ring-2 ring-purple-600' : ''
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      {/* Rank */}
                      <div className="flex-shrink-0">
                        {getRankIcon(entry.rank)}
                      </div>

                      {/* User Info */}
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-lg font-semibold">
                            {entry.userName}
                            {isCurrentUser && (
                              <span className="ml-2 text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded-full font-medium">
                                You
                              </span>
                            )}
                          </h3>
                        </div>

                        {/* Stats Grid */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-2">
                          <div>
                            <div className="text-xs text-gray-600">Score</div>
                            <div className={`text-lg font-bold ${getScoreColor(entry.averageScore)}`}>
                              {entry.averageScore}%
                            </div>
                          </div>
                          <div>
                            <div className="text-xs text-gray-600">Recordings</div>
                            <div className="text-lg font-bold text-gray-800">
                              {entry.totalRecordings}
                            </div>
                          </div>
                          <div>
                            <div className="text-xs text-gray-600">Completion</div>
                            <div className="text-lg font-bold text-gray-800">
                              {entry.completionRate}%
                            </div>
                          </div>
                          <div>
                            <div className="text-xs text-gray-600">Call Time</div>
                            <div className="text-lg font-bold text-gray-800">
                              {entry.totalCallTime}m
                            </div>
                          </div>
                        </div>

                        {/* Improvement Badge */}
                        {entry.improvement !== 0 && (
                          <div className="mt-2">
                            <span className={`text-xs px-2 py-1 rounded-full ${
                              entry.improvement > 0
                                ? 'bg-green-100 text-green-800'
                                : 'bg-red-100 text-red-800'
                            }`}>
                              {entry.improvement > 0 ? '↑' : '↓'} {Math.abs(entry.improvement)}% improvement
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}

              {leaderboard.length === 0 && (
                <div className="text-center py-12 text-gray-500">
                  <Trophy className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                  <p className="text-lg font-medium">No data yet</p>
                  <p className="text-sm">Complete some recordings to see the leaderboard</p>
                </div>
              )}
            </div>
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

              {/* Sentiment Analysis */}
              {selectedRecording.analysis.sentiment && (
                <div className="mb-6">
                  <h3 className="text-xl font-bold mb-4">💭 Sentiment Analysis</h3>

                  {/* Overall Sentiment */}
                  <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl p-5 mb-4">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <div className="text-sm text-gray-600 mb-1">Overall Conversation Tone</div>
                        <div className="flex items-center gap-3">
                          <span className={`text-2xl font-bold ${
                            selectedRecording.analysis.sentiment.overall === 'positive' ? 'text-green-600' :
                            selectedRecording.analysis.sentiment.overall === 'negative' ? 'text-red-600' :
                            'text-gray-600'
                          }`}>
                            {selectedRecording.analysis.sentiment.overall === 'positive' ? '😊 Positive' :
                             selectedRecording.analysis.sentiment.overall === 'negative' ? '😞 Negative' :
                             '😐 Neutral'}
                          </span>
                          <span className={`text-xl font-bold ${getScoreColor(selectedRecording.analysis.sentiment.overallScore)}`}>
                            {selectedRecording.analysis.sentiment.overallScore}%
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3 mb-3">
                      <div
                        className={`h-3 rounded-full ${
                          selectedRecording.analysis.sentiment.overallScore >= 80 ? 'bg-green-500' :
                          selectedRecording.analysis.sentiment.overallScore >= 50 ? 'bg-blue-500' :
                          selectedRecording.analysis.sentiment.overallScore >= 30 ? 'bg-gray-500' :
                          'bg-red-500'
                        }`}
                        style={{ width: `${selectedRecording.analysis.sentiment.overallScore}%` }}
                      />
                    </div>
                    <p className="text-sm text-gray-700">
                      <strong>Sentiment Evolution:</strong> {selectedRecording.analysis.sentiment.sentimentShift}
                    </p>
                  </div>

                  {/* Client vs Rep Sentiment */}
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="bg-white border border-gray-200 rounded-lg p-4">
                      <div className="text-sm text-gray-600 mb-2">Client Mood</div>
                      <div className={`text-lg font-bold ${
                        selectedRecording.analysis.sentiment.clientSentiment === 'positive' ? 'text-green-600' :
                        selectedRecording.analysis.sentiment.clientSentiment === 'negative' ? 'text-red-600' :
                        'text-gray-600'
                      }`}>
                        {selectedRecording.analysis.sentiment.clientSentiment === 'positive' ? '😊 Positive' :
                         selectedRecording.analysis.sentiment.clientSentiment === 'negative' ? '😞 Negative' :
                         '😐 Neutral'}
                      </div>
                    </div>
                    <div className="bg-white border border-gray-200 rounded-lg p-4">
                      <div className="text-sm text-gray-600 mb-2">Sales Rep Mood</div>
                      <div className={`text-lg font-bold ${
                        selectedRecording.analysis.sentiment.repSentiment === 'positive' ? 'text-green-600' :
                        selectedRecording.analysis.sentiment.repSentiment === 'negative' ? 'text-red-600' :
                        'text-gray-600'
                      }`}>
                        {selectedRecording.analysis.sentiment.repSentiment === 'positive' ? '😊 Positive' :
                         selectedRecording.analysis.sentiment.repSentiment === 'negative' ? '😞 Negative' :
                         '😐 Neutral'}
                      </div>
                    </div>
                  </div>

                  {/* Empathy Moments */}
                  {selectedRecording.analysis.sentiment.empathyMoments && selectedRecording.analysis.sentiment.empathyMoments.length > 0 && (
                    <div className="mb-4">
                      <h4 className="font-semibold text-gray-800 mb-2">💚 Empathy Moments</h4>
                      <div className="space-y-2">
                        {selectedRecording.analysis.sentiment.empathyMoments.map((moment, idx) => (
                          <div key={idx} className="bg-green-50 border-l-4 border-green-500 rounded-r-lg p-3">
                            <div className="flex items-start justify-between mb-1">
                              <span className="text-xs font-semibold text-green-700">{moment.timestamp}</span>
                            </div>
                            <p className="text-sm text-gray-800 font-medium mb-1">{moment.description}</p>
                            <p className="text-xs text-gray-600 italic bg-white rounded p-2 mb-1">"{moment.quote}"</p>
                            <p className="text-xs text-green-700">💡 {moment.impact}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Emotional Highs */}
                  {selectedRecording.analysis.sentiment.emotionalHighs && selectedRecording.analysis.sentiment.emotionalHighs.length > 0 && (
                    <div className="mb-4">
                      <h4 className="font-semibold text-gray-800 mb-2">📈 Emotional Highs</h4>
                      <div className="space-y-2">
                        {selectedRecording.analysis.sentiment.emotionalHighs.map((high, idx) => (
                          <div key={idx} className="bg-blue-50 rounded-lg p-3">
                            <div className="text-xs font-semibold text-blue-700 mb-1">{high.timestamp}</div>
                            <p className="text-sm text-gray-800 mb-1">{high.description}</p>
                            <p className="text-xs text-gray-600 italic">"{high.quote}"</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Emotional Lows */}
                  {selectedRecording.analysis.sentiment.emotionalLows && selectedRecording.analysis.sentiment.emotionalLows.length > 0 && (
                    <div>
                      <h4 className="font-semibold text-gray-800 mb-2">📉 Emotional Lows / Tension Points</h4>
                      <div className="space-y-2">
                        {selectedRecording.analysis.sentiment.emotionalLows.map((low, idx) => (
                          <div key={idx} className="bg-orange-50 rounded-lg p-3">
                            <div className="text-xs font-semibold text-orange-700 mb-1">{low.timestamp}</div>
                            <p className="text-sm text-gray-800 mb-1">{low.description}</p>
                            <p className="text-xs text-gray-600 italic">"{low.quote}"</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

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

              {/* Manager Review Section */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-bold">👔 Manager Review</h3>
                  {!selectedRecording.managerReview && !showReviewForm && (
                    <button
                      onClick={() => setShowReviewForm(true)}
                      className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm font-medium"
                    >
                      <MessageSquare className="w-4 h-4" />
                      Add Review
                    </button>
                  )}
                </div>

                {selectedRecording.managerReview ? (
                  <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg p-5 border border-purple-200">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold text-gray-800">{selectedRecording.managerReview.reviewerName}</span>
                          <div className="flex items-center gap-1">
                            {[...Array(5)].map((_, i) => (
                              <Star
                                key={i}
                                className={`w-4 h-4 ${i < selectedRecording.managerReview!.rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`}
                              />
                            ))}
                          </div>
                        </div>
                        <p className="text-xs text-gray-600">
                          {new Date(selectedRecording.managerReview.reviewedAt).toLocaleDateString()} at{' '}
                          {new Date(selectedRecording.managerReview.reviewedAt).toLocaleTimeString()}
                        </p>
                      </div>
                      <button
                        onClick={handleRemoveReview}
                        className="text-red-500 hover:text-red-700"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <p className="text-gray-800 mb-3">{selectedRecording.managerReview.comments}</p>
                    {selectedRecording.managerReview.keyTakeaways && selectedRecording.managerReview.keyTakeaways.length > 0 && (
                      <div className="mb-3">
                        <h4 className="font-semibold text-sm text-gray-700 mb-1">Key Takeaways:</h4>
                        <ul className="list-disc list-inside text-sm text-gray-700">
                          {selectedRecording.managerReview.keyTakeaways.map((takeaway, idx) => (
                            <li key={idx}>{takeaway}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {selectedRecording.managerReview.actionItems && selectedRecording.managerReview.actionItems.length > 0 && (
                      <div>
                        <h4 className="font-semibold text-sm text-gray-700 mb-1">Action Items:</h4>
                        <ul className="list-disc list-inside text-sm text-gray-700">
                          {selectedRecording.managerReview.actionItems.map((item, idx) => (
                            <li key={idx}>{item}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ) : showReviewForm ? (
                  <div className="bg-white border border-gray-200 rounded-lg p-5">
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">Rating</label>
                      <div className="flex items-center gap-2">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button
                            key={star}
                            onClick={() => setReviewRating(star)}
                            className="hover:scale-110 transition-transform"
                          >
                            <Star
                              className={`w-8 h-8 ${star <= reviewRating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`}
                            />
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">Comments *</label>
                      <textarea
                        value={reviewComments}
                        onChange={(e) => setReviewComments(e.target.value)}
                        placeholder="Share your feedback on this sales call..."
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        rows={4}
                      />
                    </div>
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">Key Takeaways (optional, one per line)</label>
                      <textarea
                        value={reviewKeyTakeaways}
                        onChange={(e) => setReviewKeyTakeaways(e.target.value)}
                        placeholder="Enter key takeaways, one per line"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        rows={3}
                      />
                    </div>
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">Action Items (optional, one per line)</label>
                      <textarea
                        value={reviewActionItems}
                        onChange={(e) => setReviewActionItems(e.target.value)}
                        placeholder="Enter action items, one per line"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        rows={3}
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={handleAddReview}
                        disabled={!reviewComments.trim()}
                        className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed font-medium"
                      >
                        Save Review
                      </button>
                      <button
                        onClick={() => {
                          setShowReviewForm(false);
                          setReviewRating(5);
                          setReviewComments('');
                          setReviewKeyTakeaways('');
                          setReviewActionItems('');
                        }}
                        className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 font-medium"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="text-gray-500 text-sm italic">No manager review yet</p>
                )}
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
