import { lazy, Suspense } from 'react';
import { DollarSign, Ticket, Image, BookOpen, FileText, Mic, MessageCircle, MessageSquare } from 'lucide-react';
import CustomPricingRequest from './CustomPricingRequest';

type Section = 'home' | 'custom-pricing' | 'requests' | 'my-requests' | 'presentation' | 'stain-calculator' | 'sales-coach' | 'sales-coach-admin' | 'photo-gallery' | 'sales-resources' | 'dashboard' | 'request-queue' | 'analytics' | 'team' | 'manager-dashboard' | 'team-communication' | 'direct-messages' | 'assignment-rules' | 'bom-calculator' | 'leadership' | 'my-todos';

// Lazy load components
const StainCalculator = lazy(() => import('../../features/sales-tools').then(module => ({ default: module.StainCalculator })));
const ClientPresentation = lazy(() => import('../../features/sales-tools').then(module => ({ default: module.ClientPresentation })));
const SalesCoach = lazy(() => import('../../features/ai-coach').then(module => ({ default: module.SalesCoach })));
const SalesCoachAdmin = lazy(() => import('../../features/ai-coach').then(module => ({ default: module.SalesCoachAdmin })));
const PhotoGalleryRefactored = lazy(() => import('../../features/photos').then(module => ({ default: module.PhotoGalleryRefactored })));
const SalesResources = lazy(() => import('../../features/sales-resources').then(module => ({ default: module.SalesResources })));
const RequestHub = lazy(() => import('../../features/requests').then(module => ({ default: module.RequestHub })));
const MyRequestsView = lazy(() => import('../../features/requests').then(module => ({ default: module.MyRequestsView })));
const TeamCommunication = lazy(() => import('../../features/communication').then(module => ({ default: module.TeamCommunication })));
const DirectMessages = lazy(() => import('../../features/communication').then(module => ({ default: module.DirectMessages })));

// Loading fallback component
const LoadingFallback = () => (
  <div className="flex items-center justify-center min-h-[400px]">
    <div className="text-center">
      <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
      <div className="text-gray-600">Loading...</div>
    </div>
  </div>
);

interface SalesRepViewProps {
  activeSection: Section;
  setActiveSection: (section: Section) => void;
  viewMode: 'mobile' | 'desktop';
  unreadAnnouncementsCount: number;
  announcementEngagementCount: number;
  userId?: string;
  userName?: string;
  onMarkAsRead?: (requestId: string) => void;
  onUnreadCountChange?: (count: number) => void;
  onTeamCommunicationUnreadCountChange?: (count: number) => void;
  teamCommunicationRefresh?: number;
}

export default function SalesRepView({
  activeSection,
  setActiveSection,
  viewMode,
  unreadAnnouncementsCount,
  announcementEngagementCount,
  userId,
  userName,
  onMarkAsRead,
  onUnreadCountChange,
  onTeamCommunicationUnreadCountChange,
  teamCommunicationRefresh
}: SalesRepViewProps) {
  if (activeSection === 'requests') {
    return (
      <Suspense fallback={<LoadingFallback />}>
        <RequestHub onBack={() => setActiveSection('home')} />
      </Suspense>
    );
  }

  if (activeSection === 'custom-pricing') {
    return <CustomPricingRequest onBack={() => setActiveSection('home')} viewMode={viewMode} />;
  }

  if (activeSection === 'my-requests') {
    return (
      <Suspense fallback={<LoadingFallback />}>
        <MyRequestsView onBack={() => setActiveSection('home')} onMarkAsRead={onMarkAsRead} />
      </Suspense>
    );
  }

  if (activeSection === 'stain-calculator') {
    return (
      <Suspense fallback={<LoadingFallback />}>
        <StainCalculator onBack={() => setActiveSection('home')} />
      </Suspense>
    );
  }

  if (activeSection === 'presentation') {
    return (
      <Suspense fallback={<LoadingFallback />}>
        <ClientPresentation onBack={() => setActiveSection('home')} isMobile={true} />
      </Suspense>
    );
  }

  if (activeSection === 'sales-coach') {
    return (
      <Suspense fallback={<LoadingFallback />}>
        <SalesCoach userId="user123" onOpenAdmin={() => setActiveSection('sales-coach-admin')} />
      </Suspense>
    );
  }

  if (activeSection === 'sales-coach-admin') {
    return (
      <Suspense fallback={<LoadingFallback />}>
        <SalesCoachAdmin onBack={() => setActiveSection('sales-coach')} />
      </Suspense>
    );
  }

  if (activeSection === 'photo-gallery') {
    return (
      <Suspense fallback={<LoadingFallback />}>
        <PhotoGalleryRefactored onBack={() => setActiveSection('home')} userRole="sales" viewMode="mobile" userId={userId} userName={userName} />
      </Suspense>
    );
  }

  if (activeSection === 'sales-resources') {
    return (
      <Suspense fallback={<LoadingFallback />}>
        <SalesResources onBack={() => setActiveSection('home')} userRole="sales" viewMode={viewMode} />
      </Suspense>
    );
  }

  if (activeSection === 'team-communication') {
    return (
      <Suspense fallback={<LoadingFallback />}>
        <TeamCommunication onBack={() => setActiveSection('home')} onUnreadCountChange={onTeamCommunicationUnreadCountChange} refreshTrigger={teamCommunicationRefresh} />
      </Suspense>
    );
  }

  if (activeSection === 'direct-messages') {
    return (
      <Suspense fallback={<LoadingFallback />}>
        <DirectMessages onUnreadCountChange={onUnreadCountChange} />
      </Suspense>
    );
  }

  return (
    <div className="space-y-4 p-4">
      {/* Sales Tools Section - No Title */}
      <div className="space-y-3">
        <button
          onClick={() => setActiveSection('presentation')}
          onTouchStart={(e) => e.currentTarget.classList.add('scale-95')}
          onTouchEnd={(e) => e.currentTarget.classList.remove('scale-95')}
          className="w-full bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6 rounded-xl shadow-lg transition-transform touch-manipulation"
          style={{ WebkitTapHighlightColor: 'transparent' }}
        >
          <div className="flex items-center space-x-4">
            <div className="bg-white/20 p-3 rounded-lg">
              <FileText className="w-8 h-8" />
            </div>
            <div className="flex-1 text-left">
              <div className="font-bold text-lg">Client Presentation</div>
              <div className="text-sm text-blue-100">Show customers why we're #1</div>
            </div>
          </div>
        </button>

        <button
          onClick={() => setActiveSection('sales-coach')}
          className="w-full bg-gradient-to-r from-purple-600 to-purple-700 text-white p-6 rounded-xl shadow-lg active:scale-98 transition-transform"
        >
          <div className="flex items-center space-x-4">
            <div className="bg-white/20 p-3 rounded-lg">
              <Mic className="w-8 h-8" />
            </div>
            <div className="flex-1 text-left">
              <div className="font-bold text-lg">AI Sales Coach</div>
              <div className="text-sm text-purple-100">Record & analyze meetings</div>
            </div>
          </div>
        </button>

        <button
          onClick={() => setActiveSection('photo-gallery')}
          className="w-full bg-white border-2 border-gray-200 p-5 rounded-xl shadow-sm active:scale-98 transition-transform"
        >
          <div className="flex items-center space-x-4">
            <div className="bg-green-100 p-3 rounded-lg">
              <Image className="w-7 h-7 text-green-600" />
            </div>
            <div className="flex-1 text-left">
              <div className="font-bold text-gray-900">Photo Gallery</div>
              <div className="text-sm text-gray-600">Browse & capture job photos</div>
            </div>
          </div>
        </button>

        <button
          onClick={() => setActiveSection('stain-calculator')}
          className="w-full bg-white border-2 border-gray-200 p-5 rounded-xl shadow-sm active:scale-98 transition-transform"
        >
          <div className="flex items-center space-x-4">
            <div className="bg-orange-100 p-3 rounded-lg">
              <DollarSign className="w-7 h-7 text-orange-600" />
            </div>
            <div className="flex-1 text-left">
              <div className="font-bold text-gray-900">Pre-Stain Calculator</div>
              <div className="text-sm text-gray-600">Show ROI vs DIY staining</div>
            </div>
          </div>
        </button>

        <button
          onClick={() => setActiveSection('direct-messages')}
          className="w-full bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6 rounded-xl shadow-lg active:scale-98 transition-transform relative"
        >
          <div className="flex items-center space-x-4">
            <div className="bg-white/20 p-3 rounded-lg">
              <MessageCircle className="w-8 h-8" />
            </div>
            <div className="flex-1 text-left">
              <div className="font-bold text-lg">Chat</div>
              <div className="text-sm text-blue-100">Direct messages with team</div>
            </div>
            {unreadAnnouncementsCount > 0 && (
              <div className="absolute top-3 right-3 bg-red-500 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center">
                {unreadAnnouncementsCount > 99 ? '99+' : unreadAnnouncementsCount}
              </div>
            )}
          </div>
        </button>

        <button
          onClick={() => setActiveSection('team-communication')}
          className="w-full bg-gradient-to-r from-indigo-600 to-indigo-700 text-white p-6 rounded-xl shadow-lg active:scale-98 transition-transform relative"
        >
          <div className="flex items-center space-x-4">
            <div className="bg-white/20 p-3 rounded-lg">
              <MessageSquare className="w-8 h-8" />
            </div>
            <div className="flex-1 text-left">
              <div className="font-bold text-lg">Announcements</div>
              <div className="text-sm text-indigo-100">Team updates & announcements</div>
            </div>
            {announcementEngagementCount > 0 && (
              <div className="absolute top-3 right-3 bg-red-500 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center">
                {announcementEngagementCount > 99 ? '99+' : announcementEngagementCount}
              </div>
            )}
          </div>
        </button>
      </div>

      {/* Requests Section */}
      <div className="space-y-3 pt-4">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Requests</h2>

        <button
          onClick={() => setActiveSection('requests')}
          className="w-full bg-gradient-to-r from-green-600 to-green-700 text-white p-6 rounded-xl shadow-lg active:scale-98 transition-transform"
        >
          <div className="flex items-center space-x-4">
            <div className="bg-white/20 p-3 rounded-lg">
              <Ticket className="w-8 h-8" />
            </div>
            <div className="flex-1 text-left">
              <div className="font-bold text-lg">Requests</div>
              <div className="text-sm text-green-100">Submit & track all requests</div>
            </div>
            <div className="text-xs bg-white/20 px-3 py-1.5 rounded-full font-medium">
              🎤 Voice
            </div>
          </div>
        </button>
      </div>

      {/* Other Tools Section */}
      <div className="space-y-3 pt-4 pb-8">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Other Tools</h2>

        <button
          onClick={() => setActiveSection('sales-resources')}
          className="w-full bg-white border border-gray-200 p-4 rounded-xl shadow-sm active:bg-gray-50"
        >
          <div className="flex items-center space-x-3">
            <div className="bg-indigo-100 p-2 rounded-lg">
              <BookOpen className="w-6 h-6 text-indigo-600" />
            </div>
            <div className="flex-1 text-left">
              <div className="font-semibold text-gray-900">Sales Resources</div>
              <div className="text-xs text-gray-600">Guides, catalogs & training</div>
            </div>
          </div>
        </button>
      </div>
    </div>
  );
}
