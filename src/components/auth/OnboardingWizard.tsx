import { useState } from 'react';
import { Camera, Mic, Bell, ChevronRight, ChevronLeft, Check, SkipForward, Sparkles } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import ProfilePictureUpload from '../../features/user-profile/components/ProfilePictureUpload';
import VoiceSampleRecorder from '../../features/user-profile/components/VoiceSampleRecorder';
import { usePushNotifications } from '../../hooks/usePushNotifications';

interface OnboardingWizardProps {
  onComplete: () => void;
}

type OnboardingStep = 'welcome' | 'photo' | 'voice' | 'notifications' | 'complete';

const STEPS: OnboardingStep[] = ['welcome', 'photo', 'voice', 'notifications', 'complete'];

export default function OnboardingWizard({ onComplete }: OnboardingWizardProps) {
  const { user, profile } = useAuth();
  const [currentStep, setCurrentStep] = useState<OnboardingStep>('welcome');
  const [showPhotoUpload, setShowPhotoUpload] = useState(false);
  const [showVoiceRecorder, setShowVoiceRecorder] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(profile?.avatar_url || null);
  const [voiceSampleUrl, setVoiceSampleUrl] = useState<string | null>(profile?.voice_sample_url || null);
  const [completing, setCompleting] = useState(false);

  const { isSupported: pushSupported, permissionState, enable: enablePush, isLoading: pushLoading } = usePushNotifications();

  const currentStepIndex = STEPS.indexOf(currentStep);
  const progressPercent = ((currentStepIndex) / (STEPS.length - 1)) * 100;

  const goToNextStep = () => {
    const nextIndex = currentStepIndex + 1;
    if (nextIndex < STEPS.length) {
      setCurrentStep(STEPS[nextIndex]);
    }
  };

  const goToPreviousStep = () => {
    const prevIndex = currentStepIndex - 1;
    if (prevIndex >= 0) {
      setCurrentStep(STEPS[prevIndex]);
    }
  };

  const handleComplete = async () => {
    if (!user) return;

    try {
      setCompleting(true);

      // Update onboarding_completed_at
      const { error } = await supabase
        .from('user_profiles')
        .update({ onboarding_completed_at: new Date().toISOString() })
        .eq('id', user.id);

      if (error) throw error;

      onComplete();
    } catch (err) {
      console.error('Failed to complete onboarding:', err);
      // Still complete even if save fails
      onComplete();
    } finally {
      setCompleting(false);
    }
  };

  const handlePhotoComplete = (url: string) => {
    setAvatarUrl(url);
    setShowPhotoUpload(false);
  };

  const handleVoiceComplete = (url: string) => {
    setVoiceSampleUrl(url);
    setShowVoiceRecorder(false);
  };

  const handleEnablePush = async () => {
    await enablePush();
    goToNextStep();
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 'welcome':
        return (
          <div className="text-center space-y-6">
            <div className="w-24 h-24 mx-auto bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
              <Sparkles className="w-12 h-12 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Welcome to Discount Fence Hub!
              </h2>
              <p className="text-gray-600">
                Let's get your profile set up in just a few quick steps.
                This will help your team recognize you and enable AI-powered features.
              </p>
            </div>
            <div className="pt-4">
              <button
                onClick={goToNextStep}
                className="w-full flex items-center justify-center space-x-2 px-8 py-4 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors"
              >
                <span>Let's Get Started</span>
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        );

      case 'photo':
        return (
          <div className="space-y-6">
            <div className="text-center">
              <div className="w-20 h-20 mx-auto bg-blue-100 rounded-full flex items-center justify-center mb-4">
                <Camera className="w-10 h-10 text-blue-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">Add Your Profile Photo</h2>
              <p className="text-gray-600 text-sm">
                Help your team recognize you with a profile picture.
              </p>
            </div>

            {/* Photo Preview */}
            <div className="flex justify-center">
              {avatarUrl ? (
                <div className="relative">
                  <img
                    src={avatarUrl}
                    alt="Profile"
                    className="w-32 h-32 rounded-full object-cover border-4 border-green-500"
                  />
                  <div className="absolute -bottom-1 -right-1 w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                    <Check className="w-5 h-5 text-white" />
                  </div>
                </div>
              ) : (
                <div className="w-32 h-32 rounded-full bg-gray-200 flex items-center justify-center">
                  <Camera className="w-12 h-12 text-gray-400" />
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="space-y-3">
              <button
                onClick={() => setShowPhotoUpload(true)}
                className="w-full flex items-center justify-center space-x-2 px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors"
              >
                <Camera className="w-5 h-5" />
                <span>{avatarUrl ? 'Change Photo' : 'Add Photo'}</span>
              </button>
              <button
                onClick={goToNextStep}
                className="w-full flex items-center justify-center space-x-2 px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <SkipForward className="w-4 h-4" />
                <span>{avatarUrl ? 'Continue' : 'Skip for Now'}</span>
              </button>
            </div>
          </div>
        );

      case 'voice':
        return (
          <div className="space-y-6">
            <div className="text-center">
              <div className="w-20 h-20 mx-auto bg-purple-100 rounded-full flex items-center justify-center mb-4">
                <Mic className="w-10 h-10 text-purple-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">Record Your Voice Sample</h2>
              <p className="text-gray-600 text-sm">
                Help AI learn your voice for personalized coaching and call analysis.
              </p>
            </div>

            {/* Voice Status */}
            <div className="flex justify-center">
              {voiceSampleUrl ? (
                <div className="flex items-center space-x-3 px-6 py-4 bg-green-50 border border-green-200 rounded-lg">
                  <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center">
                    <Check className="w-6 h-6 text-white" />
                  </div>
                  <span className="text-green-700 font-medium">Voice sample recorded</span>
                </div>
              ) : (
                <div className="flex items-center space-x-3 px-6 py-4 bg-gray-50 border border-gray-200 rounded-lg">
                  <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                    <Mic className="w-6 h-6 text-gray-400" />
                  </div>
                  <span className="text-gray-600">No voice sample yet</span>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="space-y-3">
              <button
                onClick={() => setShowVoiceRecorder(true)}
                className="w-full flex items-center justify-center space-x-2 px-6 py-3 bg-purple-600 text-white rounded-lg font-semibold hover:bg-purple-700 transition-colors"
              >
                <Mic className="w-5 h-5" />
                <span>{voiceSampleUrl ? 'Re-record Voice' : 'Record Voice Sample'}</span>
              </button>
              <button
                onClick={goToNextStep}
                className="w-full flex items-center justify-center space-x-2 px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <SkipForward className="w-4 h-4" />
                <span>{voiceSampleUrl ? 'Continue' : 'Skip for Now'}</span>
              </button>
            </div>

            {/* Info */}
            <p className="text-xs text-gray-500 text-center">
              You can always record your voice sample later from your profile settings.
            </p>
          </div>
        );

      case 'notifications':
        return (
          <div className="space-y-6">
            <div className="text-center">
              <div className="w-20 h-20 mx-auto bg-amber-100 rounded-full flex items-center justify-center mb-4">
                <Bell className="w-10 h-10 text-amber-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">Enable Push Notifications</h2>
              <p className="text-gray-600 text-sm">
                Stay updated with instant alerts for messages, assignments, and important updates.
              </p>
            </div>

            {/* Notification Benefits */}
            <div className="bg-gray-50 rounded-lg p-4 space-y-3">
              <div className="flex items-start space-x-3">
                <Check className="w-5 h-5 text-green-600 mt-0.5" />
                <span className="text-sm text-gray-700">New message notifications</span>
              </div>
              <div className="flex items-start space-x-3">
                <Check className="w-5 h-5 text-green-600 mt-0.5" />
                <span className="text-sm text-gray-700">Job assignment alerts</span>
              </div>
              <div className="flex items-start space-x-3">
                <Check className="w-5 h-5 text-green-600 mt-0.5" />
                <span className="text-sm text-gray-700">Team announcements</span>
              </div>
              <div className="flex items-start space-x-3">
                <Check className="w-5 h-5 text-green-600 mt-0.5" />
                <span className="text-sm text-gray-700">Schedule updates</span>
              </div>
            </div>

            {/* Actions */}
            <div className="space-y-3">
              {pushSupported ? (
                permissionState === 'granted' ? (
                  <div className="flex items-center justify-center space-x-2 px-6 py-3 bg-green-50 border border-green-200 text-green-700 rounded-lg">
                    <Check className="w-5 h-5" />
                    <span className="font-medium">Notifications enabled!</span>
                  </div>
                ) : permissionState === 'denied' ? (
                  <div className="text-center text-sm text-gray-600 p-4 bg-gray-50 rounded-lg">
                    <p>Notifications are blocked in your browser settings.</p>
                    <p className="mt-1">You can enable them later from your browser or device settings.</p>
                  </div>
                ) : (
                  <button
                    onClick={handleEnablePush}
                    disabled={pushLoading}
                    className="w-full flex items-center justify-center space-x-2 px-6 py-3 bg-amber-500 text-white rounded-lg font-semibold hover:bg-amber-600 transition-colors disabled:opacity-50"
                  >
                    <Bell className="w-5 h-5" />
                    <span>{pushLoading ? 'Enabling...' : 'Enable Notifications'}</span>
                  </button>
                )
              ) : (
                <div className="text-center text-sm text-gray-600 p-4 bg-gray-50 rounded-lg">
                  <p>Push notifications are not supported on this device.</p>
                  <p className="mt-1">You can still receive in-app notifications.</p>
                </div>
              )}
              <button
                onClick={goToNextStep}
                className="w-full flex items-center justify-center space-x-2 px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <SkipForward className="w-4 h-4" />
                <span>{permissionState === 'granted' ? 'Continue' : 'Skip for Now'}</span>
              </button>
            </div>
          </div>
        );

      case 'complete':
        return (
          <div className="text-center space-y-6">
            <div className="w-24 h-24 mx-auto bg-green-100 rounded-full flex items-center justify-center">
              <Check className="w-12 h-12 text-green-600" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                You're All Set!
              </h2>
              <p className="text-gray-600">
                Your profile is ready. Welcome to the team!
              </p>
            </div>

            {/* Summary */}
            <div className="bg-gray-50 rounded-lg p-4 space-y-3 text-left">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Profile Photo</span>
                {avatarUrl ? (
                  <span className="flex items-center text-green-600 text-sm">
                    <Check className="w-4 h-4 mr-1" /> Added
                  </span>
                ) : (
                  <span className="text-gray-400 text-sm">Skipped</span>
                )}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Voice Sample</span>
                {voiceSampleUrl ? (
                  <span className="flex items-center text-green-600 text-sm">
                    <Check className="w-4 h-4 mr-1" /> Recorded
                  </span>
                ) : (
                  <span className="text-gray-400 text-sm">Skipped</span>
                )}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Push Notifications</span>
                {permissionState === 'granted' ? (
                  <span className="flex items-center text-green-600 text-sm">
                    <Check className="w-4 h-4 mr-1" /> Enabled
                  </span>
                ) : (
                  <span className="text-gray-400 text-sm">Skipped</span>
                )}
              </div>
            </div>

            <p className="text-sm text-gray-500">
              You can update these anytime from your profile settings.
            </p>

            <div className="pt-4">
              <button
                onClick={handleComplete}
                disabled={completing}
                className="w-full flex items-center justify-center space-x-2 px-8 py-4 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {completing ? (
                  <span>Finishing up...</span>
                ) : (
                  <>
                    <span>Go to Dashboard</span>
                    <ChevronRight className="w-5 h-5" />
                  </>
                )}
              </button>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <>
      <div className="min-h-screen bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
          {/* Progress Bar */}
          {currentStep !== 'welcome' && (
            <div className="h-2 bg-gray-200">
              <div
                className="h-2 bg-blue-600 transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          )}

          {/* Content */}
          <div className="p-8">
            {renderStepContent()}
          </div>

          {/* Navigation Dots */}
          {currentStep !== 'welcome' && currentStep !== 'complete' && (
            <div className="flex items-center justify-center pb-6 space-x-2">
              {STEPS.filter(s => s !== 'welcome' && s !== 'complete').map((step, index) => (
                <div
                  key={step}
                  className={`w-2 h-2 rounded-full transition-colors ${
                    STEPS.indexOf(currentStep) > index + 1
                      ? 'bg-blue-600'
                      : STEPS.indexOf(currentStep) === index + 1
                      ? 'bg-blue-600'
                      : 'bg-gray-300'
                  }`}
                />
              ))}
            </div>
          )}

          {/* Back Button - only show on middle steps */}
          {currentStep !== 'welcome' && currentStep !== 'complete' && (
            <div className="px-8 pb-6">
              <button
                onClick={goToPreviousStep}
                className="flex items-center text-gray-500 hover:text-gray-700 transition-colors text-sm"
              >
                <ChevronLeft className="w-4 h-4 mr-1" />
                Back
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Photo Upload Modal */}
      {showPhotoUpload && (
        <ProfilePictureUpload
          currentAvatarUrl={avatarUrl || undefined}
          onUploadComplete={handlePhotoComplete}
          onCancel={() => setShowPhotoUpload(false)}
        />
      )}

      {/* Voice Recorder Modal */}
      {showVoiceRecorder && (
        <VoiceSampleRecorder
          onComplete={handleVoiceComplete}
          onCancel={() => setShowVoiceRecorder(false)}
        />
      )}
    </>
  );
}
