import { useState, useRef, useEffect } from 'react';
import { Home, DollarSign, Ticket, Image, BookOpen, Menu, X, User, Mic, StopCircle, Play, CheckCircle, AlertCircle, Send, FileText, Building2, Wrench, Package, AlertTriangle, Camera, ArrowLeft, FolderOpen, LogOut, MessageSquare } from 'lucide-react';
import StainCalculator from './components/sales/StainCalculator';
import ClientPresentation from './components/sales/ClientPresentation';
import SalesCoach from './components/sales/SalesCoach';
import SalesCoachAdmin from './components/sales/SalesCoachAdmin';
import PhotoGallery from './components/PhotoGallery';
import SalesResources from './components/SalesResources';
import TeamManagement from './components/TeamManagement';
import TeamCommunicationMobileV2 from './components/TeamCommunicationMobileV2';
import MessageComposer from './components/MessageComposer';
import UserProfileEditor from './components/UserProfileEditor';
import UserProfileView from './components/UserProfileView';
import Login from './components/auth/Login';
import InstallAppBanner from './components/InstallAppBanner';
import { useAuth } from './contexts/AuthContext';
import { supabase } from './lib/supabase';
import { transcribeAudio } from './lib/openai';
import { parseVoiceTranscript } from './lib/claude';

type UserRole = 'sales' | 'operations' | 'sales-manager' | 'admin';
type Section = 'home' | 'custom-pricing' | 'my-requests' | 'presentation' | 'stain-calculator' | 'sales-coach' | 'sales-coach-admin' | 'photo-gallery' | 'sales-resources' | 'dashboard' | 'request-queue' | 'analytics' | 'team' | 'manager-dashboard' | 'team-communication';
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
  const { user, profile, loading, signOut } = useAuth();

  // Get role and name from authenticated profile, with fallback for role switching
  const [userRole, setUserRole] = useState<UserRole>(profile?.role || 'sales');

  // Update userRole from profile when it changes
  useEffect(() => {
    if (profile?.role) {
      setUserRole(profile.role);
    }
  }, [profile]);

  const userName = profile?.full_name || 'User';
  const [activeSection, setActiveSection] = useState<Section>('home');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [viewMode, setViewMode] = useState<'mobile' | 'desktop'>(() => {
    const saved = localStorage.getItem('viewMode');
    return (saved as 'mobile' | 'desktop') || 'mobile';
  });
  const [unreadCount, setUnreadCount] = useState(0);
  const [showMessageComposer, setShowMessageComposer] = useState(false);
  const [showProfileEditor, setShowProfileEditor] = useState(false);
  const [showProfileView, setShowProfileView] = useState(false);

  // Save viewMode to localStorage when it changes
  useEffect(() => {
    localStorage.setItem('viewMode', viewMode);
  }, [viewMode]);

  // Load unread message count
  useEffect(() => {
    if (!user) return;

    const loadUnreadCount = async () => {
      try {
        const { data, error } = await supabase
          .from('user_unread_messages')
          .select('unread_count')
          .eq('user_id', user.id)
          .single();

        if (!error && data) {
          setUnreadCount(data.unread_count || 0);
        }
      } catch (error) {
        console.error('Error loading unread count:', error);
      }
    };

    loadUnreadCount();

    // Refresh every 30 seconds
    const interval = setInterval(loadUnreadCount, 30000);
    return () => clearInterval(interval);
  }, [user]);

  // Handle browser back button to prevent app close
  useEffect(() => {
    // Push initial state
    window.history.pushState(null, '', window.location.href);

    const handlePopState = (e: PopStateEvent) => {
      e.preventDefault();
      // Push state again to keep user in app
      window.history.pushState(null, '', window.location.href);

      // Navigate back within app if not on home
      if (activeSection !== 'home') {
        setActiveSection('home');
      }
    };

    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [activeSection]);

  // Universal navigation items - same for all roles (permissions controlled inside each component)
  const getNavigationItems = () => {
    const items = [
      { id: 'dashboard' as Section, name: 'Dashboard', icon: Home },
      { id: 'team-communication' as Section, name: 'Messages', icon: MessageSquare, badge: unreadCount },
      { id: 'presentation' as Section, name: 'Client Presentation', icon: FileText },
      { id: 'sales-coach' as Section, name: 'AI Sales Coach', icon: Mic },
      { id: 'photo-gallery' as Section, name: 'Photo Gallery', icon: Image },
      { id: 'stain-calculator' as Section, name: 'Pre-Stain Calculator', icon: DollarSign },
      { id: 'my-requests' as Section, name: 'My Requests', icon: Ticket },
      { id: 'analytics' as Section, name: 'Analytics', icon: DollarSign },
      { id: 'sales-resources' as Section, name: 'Sales Resources', icon: FolderOpen },
      { id: 'team' as Section, name: 'Team', icon: User, separator: true },
    ];

    // Photo Review is now accessed via tabs in Photo Gallery (desktop only)
    return items;
  };

  const navigationItems = getNavigationItems();

  const renderContent = () => {
    // Handle common sections for all roles
    if (activeSection === 'presentation') {
      return <ClientPresentation onBack={() => setActiveSection('home')} isMobile={viewMode === 'mobile'} />;
    }
    if (activeSection === 'sales-coach') {
      return <SalesCoach userId="user123" onOpenAdmin={() => setActiveSection('sales-coach-admin')} />;
    }
    if (activeSection === 'photo-gallery') {
      return <PhotoGallery onBack={() => setActiveSection('home')} userRole={userRole} viewMode={viewMode} />;
    }
    if (activeSection === 'stain-calculator') {
      return <StainCalculator onBack={() => setActiveSection('home')} />;
    }
    if (activeSection === 'my-requests') {
      return <MyRequests onBack={() => setActiveSection('home')} userRole={userRole} />;
    }
    if (activeSection === 'sales-coach-admin') {
      return <SalesCoachAdmin onBack={() => setActiveSection('home')} userRole={userRole} />;
    }
    if (activeSection === 'dashboard') {
      return <Dashboard userRole={userRole} />;
    }
    if (activeSection === 'analytics') {
      return <Analytics userRole={userRole} />;
    }
    if (activeSection === 'team') {
      return <TeamManagement userRole={userRole} />;
    }
    if (activeSection === 'sales-resources') {
      return <SalesResources onBack={() => setActiveSection('home')} userRole={userRole} viewMode={viewMode} />;
    }
    if (activeSection === 'team-communication') {
      return <TeamCommunicationMobileV2 onBack={() => setActiveSection('home')} />;
    }

    // Default home view
    return <Dashboard userRole={userRole} />;
  };

  // Show loading screen while checking authentication
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <img src="/Logo-1.jpg" alt="Logo" className="h-24 w-auto mx-auto mb-4" />
          <div className="text-gray-600">Loading...</div>
        </div>
      </div>
    );
  }

  // Show login screen if not authenticated
  // TEMPORARY: Allow bypass for development - remove this once auth is fully implemented
  const bypassAuth = localStorage.getItem('bypassAuth') === 'true';
  if (!user && !bypassAuth) {
    return <Login />;
  }

  // Mobile view - same for all roles
  if (viewMode === 'mobile') {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
          <div className="px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3 flex-1">
              <img src="/Logo-DF-Transparent.png" alt="Discount Fence USA" className="h-12 w-auto" />
              <p className="text-sm text-gray-500">Hey {userName}! 👋</p>
            </div>
            <div className="flex items-center gap-2">
              {/* View Mode Switcher */}
              <button
                onClick={() => setViewMode('desktop')}
                className="px-2 py-1 text-xs bg-gray-100 border border-gray-300 rounded text-gray-700 hover:bg-gray-200"
              >
                Desktop
              </button>
              {/* Profile Avatar */}
              <button
                onClick={() => setShowProfileView(true)}
                className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 hover:opacity-80 transition-opacity"
              >
                {profile?.avatar_url ? (
                  <img
                    src={profile.avatar_url}
                    alt={userName}
                    className="w-10 h-10 rounded-full object-cover border-2 border-blue-600"
                  />
                ) : (
                  <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center">
                    <User className="w-6 h-6 text-white" />
                  </div>
                )}
              </button>
            </div>
          </div>
        </div>
        <div className="pb-20">
          <SalesRepView activeSection={activeSection} setActiveSection={setActiveSection} viewMode={viewMode} unreadCount={unreadCount} />
        </div>

        {/* Install App Banner */}
        <InstallAppBanner />

        {/* Profile Modals */}
        {showProfileView && (
          <UserProfileView
            onClose={() => setShowProfileView(false)}
            onEdit={() => {
              setShowProfileView(false);
              setShowProfileEditor(true);
            }}
          />
        )}

        {showProfileEditor && (
          <UserProfileEditor
            onClose={() => setShowProfileEditor(false)}
            onSave={() => {
              setShowProfileEditor(false);
              window.location.reload(); // Reload to refresh profile data
            }}
          />
        )}
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50">
      <div className={`${sidebarOpen ? 'w-64' : 'w-20'} bg-gray-900 text-white transition-all duration-300 flex flex-col`}>
        <div className="p-4 border-b border-gray-800 flex items-center justify-between">
          {sidebarOpen ? (
            <>
              <div className="flex items-center gap-3">
                <img src="/logo-transparent.png" alt="Discount Fence USA" className="h-12 w-auto" />
                <p className="text-xs text-gray-400 capitalize">{userRole}</p>
              </div>
              <button onClick={() => setSidebarOpen(false)} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <img src="/logo-transparent.png" alt="Logo" className="h-10 w-auto" />
              <button onClick={() => setSidebarOpen(true)} className="text-gray-400 hover:text-white">
                <Menu className="w-6 h-6" />
              </button>
            </div>
          )}
        </div>

        <nav className="flex-1 p-4 space-y-2">
          {navigationItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeSection === item.id;
            return (
              <div key={item.id}>
                {item.separator && <div className="my-4 border-t border-gray-700"></div>}
                <button
                  onClick={() => setActiveSection(item.id)}
                  className={`w-full flex items-center space-x-3 px-3 py-3 rounded-lg transition-colors ${
                    isActive ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                  }`}
                >
                  <Icon className="w-5 h-5 flex-shrink-0" />
                  {sidebarOpen && (
                    <span className="font-medium flex-1 text-left">{item.name}</span>
                  )}
                  {item.badge && item.badge > 0 && (
                    <span className="ml-auto bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                      {item.badge > 99 ? '99+' : item.badge}
                    </span>
                  )}
                </button>
              </div>
            );
          })}
        </nav>

        <div className="p-4 border-t border-gray-800">
          {/* View Mode Switcher */}
          {sidebarOpen && (
            <div className="mb-3">
              <button
                onClick={() => setViewMode('mobile')}
                className="w-full px-3 py-2 text-sm bg-blue-600 hover:bg-blue-700 rounded text-white font-medium"
              >
                Switch to Mobile View
              </button>
            </div>
          )}

          {/* Role Switcher for Admin Only - show based on authenticated profile, not current view */}
          {sidebarOpen && profile?.role === 'admin' && (
            <div className="mb-3">
              <p className="text-xs text-gray-400 mb-2">Switch View (Admin):</p>
              <select
                value={userRole}
                onChange={(e) => {
                  setUserRole(e.target.value as UserRole);
                  setActiveSection('home');
                }}
                className="w-full px-2 py-1 text-sm bg-gray-800 border border-gray-700 rounded text-white"
              >
                <option value="sales">Sales View</option>
                <option value="operations">Operations View</option>
                <option value="sales-manager">Sales Manager View</option>
                <option value="admin">Admin View</option>
              </select>
            </div>
          )}

          <div className="space-y-3">
            {/* User Profile */}
            <button
              onClick={() => setShowProfileView(true)}
              className="flex items-center space-x-3 w-full hover:bg-gray-800 rounded-lg p-2 transition-colors"
            >
              {profile?.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt={userName}
                  className="w-10 h-10 rounded-full object-cover border-2 border-blue-600 flex-shrink-0"
                />
              ) : (
                <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
                  <User className="w-6 h-6 text-white" />
                </div>
              )}
              {sidebarOpen && (
                <div className="flex-1 min-w-0 text-left">
                  <p className="font-medium text-sm text-white truncate">
                    {profile?.full_name || userName}
                  </p>
                  <p className="text-xs text-gray-400 capitalize">{profile?.role || userRole}</p>
                </div>
              )}
            </button>

            {/* Logout Button */}
            {user && sidebarOpen && (
              <button
                onClick={() => signOut()}
                className="w-full flex items-center space-x-2 px-3 py-2 text-sm text-gray-300 hover:bg-gray-800 rounded-lg transition-colors"
              >
                <LogOut className="w-4 h-4" />
                <span>Sign Out</span>
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <div className="p-8 max-w-7xl mx-auto">
          {renderContent()}
        </div>
      </div>

      {/* Install App Banner */}
      <InstallAppBanner />

      {/* Floating Action Button for Composing Messages (Admin/Manager only) */}
      {(userRole === 'admin' || userRole === 'sales-manager') && activeSection === 'team-communication' && (
        <button
          onClick={() => setShowMessageComposer(true)}
          className="fixed bottom-8 right-8 w-16 h-16 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg flex items-center justify-center transition-all hover:scale-110 z-40"
          title="New Message"
        >
          <Send className="w-6 h-6" />
        </button>
      )}

      {/* Message Composer Modal */}
      {showMessageComposer && (
        <MessageComposer
          onClose={() => setShowMessageComposer(false)}
          onMessageSent={() => {
            setShowMessageComposer(false);
            // Reload messages by re-rendering TeamCommunication
            setActiveSection('home');
            setTimeout(() => setActiveSection('team-communication'), 0);
          }}
        />
      )}

      {/* Profile Modals */}
      {showProfileView && (
        <UserProfileView
          onClose={() => setShowProfileView(false)}
          onEdit={() => {
            setShowProfileView(false);
            setShowProfileEditor(true);
          }}
        />
      )}

      {showProfileEditor && (
        <UserProfileEditor
          onClose={() => setShowProfileEditor(false)}
          onSave={() => {
            setShowProfileEditor(false);
            window.location.reload(); // Reload to refresh profile data
          }}
        />
      )}
    </div>
  );
}

interface SalesRepViewProps {
  activeSection: Section;
  setActiveSection: (section: Section) => void;
  viewMode: 'mobile' | 'desktop';
  unreadCount: number;
}

const SalesRepView = ({ activeSection, setActiveSection, viewMode, unreadCount }: SalesRepViewProps) => {
  // Count pending/quoted requests
  const savedRequests = JSON.parse(localStorage.getItem('myRequests') || '[]');
  const pendingCount = savedRequests.filter((r: any) => r.status === 'pending' || r.status === 'quoted').length;

  if (activeSection === 'custom-pricing') {
    return <CustomPricingRequest onBack={() => setActiveSection('home')} viewMode={viewMode} />;
  }

  if (activeSection === 'my-requests') {
    return <MyRequests onBack={() => setActiveSection('home')} viewMode={viewMode} />;
  }

  if (activeSection === 'stain-calculator') {
    return <StainCalculator onBack={() => setActiveSection('home')} />;
  }

  if (activeSection === 'presentation') {
    return <ClientPresentation onBack={() => setActiveSection('home')} isMobile={true} />;
  }

  if (activeSection === 'sales-coach') {
    return <SalesCoach userId="user123" onOpenAdmin={() => setActiveSection('sales-coach-admin')} />;
  }

  if (activeSection === 'sales-coach-admin') {
    return <SalesCoachAdmin onBack={() => setActiveSection('sales-coach')} />;
  }

  if (activeSection === 'photo-gallery') {
    return <PhotoGallery onBack={() => setActiveSection('home')} />;
  }

  if (activeSection === 'sales-resources') {
    return <SalesResources onBack={() => setActiveSection('home')} userRole="sales" viewMode={viewMode} />;
  }

  if (activeSection === 'team-communication') {
    return <TeamCommunicationMobileV2 onBack={() => setActiveSection('home')} />;
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
          onClick={() => setActiveSection('team-communication')}
          className="w-full bg-gradient-to-r from-indigo-600 to-indigo-700 text-white p-6 rounded-xl shadow-lg active:scale-98 transition-transform relative"
        >
          <div className="flex items-center space-x-4">
            <div className="bg-white/20 p-3 rounded-lg">
              <MessageSquare className="w-8 h-8" />
            </div>
            <div className="flex-1 text-left">
              <div className="font-bold text-lg">Messages</div>
              <div className="text-sm text-indigo-100">Team updates & announcements</div>
            </div>
            {unreadCount > 0 && (
              <div className="absolute top-3 right-3 bg-red-500 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center">
                {unreadCount > 99 ? '99+' : unreadCount}
              </div>
            )}
          </div>
        </button>
      </div>

      {/* Requests Section */}
      <div className="space-y-3 pt-4">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Requests</h2>

        <button
          onClick={() => setActiveSection('my-requests')}
          className="w-full bg-gradient-to-r from-green-600 to-green-700 text-white p-5 rounded-xl shadow-md active:scale-98 transition-transform"
        >
          <div className="flex items-center space-x-4">
            <div className="bg-white/20 p-3 rounded-lg">
              <Ticket className="w-7 h-7" />
            </div>
            <div className="flex-1 text-left">
              <div className="font-bold text-lg">Track Requests</div>
              <div className="text-sm text-green-100">View status & pricing responses</div>
            </div>
            {pendingCount > 0 && (
              <div className="bg-white/30 px-3 py-1 rounded-full font-bold">{pendingCount}</div>
            )}
          </div>
        </button>

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
                <div className="font-semibold text-gray-900">Custom Pricing</div>
                <div className="text-xs text-gray-600">Special projects</div>
              </div>
              <div className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full font-medium">
                🎤
              </div>
            </div>
          </button>

          <button className="w-full bg-white border border-gray-200 p-4 rounded-xl shadow-sm active:bg-gray-50">
            <div className="flex items-center space-x-3">
              <div className="bg-blue-100 p-2 rounded-lg">
                <Building2 className="w-6 h-6 text-blue-600" />
              </div>
              <div className="flex-1 text-left">
                <div className="font-semibold text-gray-900">New Builder</div>
                <div className="text-xs text-gray-600">Submit client info</div>
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
                <div className="text-xs text-gray-600">Report problems</div>
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
                <div className="text-xs text-gray-600">Request supplies</div>
              </div>
            </div>
          </button>

          <button className="w-full bg-white border border-gray-200 p-4 rounded-xl shadow-sm active:bg-gray-50">
            <div className="flex items-center space-x-3">
              <div className="bg-purple-100 p-2 rounded-lg">
                <AlertTriangle className="w-6 h-6 text-purple-600" />
              </div>
              <div className="flex-1 text-left">
                <div className="font-semibold text-gray-900">Escalation</div>
                <div className="text-xs text-gray-600">Customer issues</div>
              </div>
            </div>
          </button>
        </div>
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
};

interface CustomPricingRequestProps {
  onBack: () => void;
  viewMode: 'mobile' | 'desktop';
}

const CustomPricingRequest = ({ onBack, viewMode }: CustomPricingRequestProps) => {
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

          // Return to form view
          setStep('choice');
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
        <div className={`fixed bottom-0 right-0 bg-white border-t border-gray-200 p-4 ${
          viewMode === 'desktop' ? 'left-64' : 'left-0'
        }`}>
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

        <div className={`fixed bottom-0 right-0 bg-white border-t border-gray-200 p-4 ${
          viewMode === 'desktop' ? 'left-64' : 'left-0'
        }`}>
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
  userRole?: UserRole;
  viewMode?: 'mobile' | 'desktop';
}

const MyRequests = ({ onBack, userRole: _userRole = 'sales', viewMode = 'mobile' }: MyRequestsProps) => {
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
      <div className="min-h-screen bg-gray-50 p-4 pb-32">
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
        <div className={`fixed bottom-0 right-0 bg-white border-t border-gray-200 p-4 ${
          viewMode === 'desktop' ? 'left-64' : 'left-0'
        }`}>
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

interface OperationsViewProps {
  activeSection: Section;
  setActiveSection: (section: Section) => void;
}

// @ts-ignore - Unused legacy component
const OperationsView = ({ activeSection, setActiveSection }: OperationsViewProps) => {
  if (activeSection === 'manager-dashboard') {
    return <ManagerDashboard onBack={() => setActiveSection('home')} />;
  }

  if (activeSection === 'request-queue') {
    return <RequestQueue onBack={() => setActiveSection('home')} userRole="operations" />;
  }

  return (
    <div className="space-y-4 p-4">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">Operations Hub</h1>
      <p className="text-gray-600 mb-6">Manage pricing requests and track team performance</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <button
          onClick={() => setActiveSection('manager-dashboard')}
          className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6 rounded-xl shadow-lg hover:shadow-xl transition-shadow text-left"
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
        </button>

        <button
          onClick={() => setActiveSection('request-queue')}
          className="bg-white border-2 border-gray-200 p-6 rounded-xl shadow-sm hover:border-blue-300 transition-colors text-left"
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
        </button>
      </div>
    </div>
  );
};

interface ManagerDashboardProps {
  onBack: () => void;
}

// @ts-ignore - Unused legacy component
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
  userRole?: 'sales' | 'operations' | 'sales-manager' | 'admin';
}

const RequestQueue = ({ onBack, userRole = 'operations' }: RequestQueueProps) => {
  const [requests, setRequests] = useState<any[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'quoted' | 'approved' | 'rejected' | 'closed'>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [salespersonFilter, setSalespersonFilter] = useState<string>('all');
  const [ageFilter, setAgeFilter] = useState<string>('all');
  const [newNote, setNewNote] = useState('');
  const [newMessage, setNewMessage] = useState('');

  useEffect(() => {
    loadRequests();
  }, []);

  const loadRequests = () => {
    const saved = JSON.parse(localStorage.getItem('myRequests') || '[]');
    setRequests(saved);
  };

  const updateRequest = (id: string, updates: any) => {
    const saved = JSON.parse(localStorage.getItem('myRequests') || '[]');
    const updated = saved.map((req: any) =>
      req.id === id ? { ...req, ...updates, updatedAt: new Date().toISOString() } : req
    );
    localStorage.setItem('myRequests', JSON.stringify(updated));
    loadRequests();
    if (selectedRequest?.id === id) {
      setSelectedRequest({ ...selectedRequest, ...updates });
    }
  };

  const addNote = (requestId: string) => {
    if (!newNote.trim()) return;
    const request = requests.find(r => r.id === requestId);
    const notes = request?.notes || [];
    notes.push({
      id: Date.now(),
      text: newNote,
      author: 'Back Office',
      timestamp: new Date().toISOString()
    });
    updateRequest(requestId, { notes });
    setNewNote('');
  };

  const addMessage = (requestId: string) => {
    if (!newMessage.trim()) return;
    const request = requests.find(r => r.id === requestId);
    const messages = request?.messages || [];
    messages.push({
      id: Date.now(),
      text: newMessage,
      from: 'operations',
      timestamp: new Date().toISOString()
    });
    updateRequest(requestId, { messages });
    setNewMessage('');
  };

  const deleteRequest = (requestId: string) => {
    if (userRole !== 'admin') {
      alert('Only admins can delete requests');
      return;
    }
    if (confirm('Are you sure you want to delete this request? This action cannot be undone.')) {
      const saved = JSON.parse(localStorage.getItem('myRequests') || '[]');
      const updated = saved.filter((req: any) => req.id !== requestId);
      localStorage.setItem('myRequests', JSON.stringify(updated));
      loadRequests();
      setSelectedRequest(null);
    }
  };

  const getRequestAge = (timestamp: string) => {
    const now = new Date();
    const submitted = new Date(timestamp);
    const diffTime = Math.abs(now.getTime() - submitted.getTime());
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return '1 day';
    return `${diffDays} days`;
  };

  const getAgeInDays = (timestamp: string) => {
    const now = new Date();
    const submitted = new Date(timestamp);
    const diffTime = Math.abs(now.getTime() - submitted.getTime());
    return Math.floor(diffTime / (1000 * 60 * 60 * 24));
  };

  // Get unique values for filters
  const requestTypes = Array.from(new Set(requests.map(r => r.requestType || 'custom-pricing')));
  const salespeople = Array.from(new Set(requests.map(r => r.salesperson || 'Unknown')));

  // Apply filters
  const filteredRequests = requests.filter(req => {
    if (statusFilter !== 'all' && req.status !== statusFilter) return false;
    if (typeFilter !== 'all' && (req.requestType || 'custom-pricing') !== typeFilter) return false;
    if (salespersonFilter !== 'all' && (req.salesperson || 'Unknown') !== salespersonFilter) return false;
    if (ageFilter !== 'all') {
      const days = getAgeInDays(req.timestamp);
      if (ageFilter === 'today' && days !== 0) return false;
      if (ageFilter === '1-3' && (days < 1 || days > 3)) return false;
      if (ageFilter === '4-7' && (days < 4 || days > 7)) return false;
      if (ageFilter === '7+' && days <= 7) return false;
    }
    return true;
  });

  const getStatusBadge = (status: string) => {
    const badges = {
      pending: 'bg-yellow-100 text-yellow-800',
      quoted: 'bg-blue-100 text-blue-800',
      approved: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800',
      closed: 'bg-gray-100 text-gray-800'
    };
    return badges[status as keyof typeof badges] || 'bg-gray-100 text-gray-800';
  };

  // Detailed view
  if (selectedRequest) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <button onClick={() => setSelectedRequest(null)} className="text-blue-600 font-medium mb-4 flex items-center gap-2">
          <ArrowLeft className="w-4 h-4" /> Back to Queue
        </button>

        <div className="bg-white rounded-xl shadow p-6 mb-4">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{selectedRequest.customerName}</h1>
              <p className="text-gray-600">{selectedRequest.address}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusBadge(selectedRequest.status)}`}>
                {selectedRequest.status}
              </span>
              {userRole === 'admin' && (
                <button
                  onClick={() => deleteRequest(selectedRequest.id)}
                  className="px-3 py-1 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium text-sm"
                >
                  Delete
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4 p-4 bg-gray-50 rounded-lg">
            <div>
              <p className="text-xs text-gray-600">Salesperson</p>
              <p className="font-medium">{selectedRequest.salesperson || 'Unknown'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-600">Request Type</p>
              <p className="font-medium capitalize">{selectedRequest.requestType || 'Custom Pricing'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-600">Age</p>
              <p className="font-medium">{getRequestAge(selectedRequest.timestamp)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-600">Submitted</p>
              <p className="font-medium">{new Date(selectedRequest.timestamp).toLocaleDateString()}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <p className="text-sm text-gray-600">Fence Type</p>
              <p className="font-medium">{selectedRequest.fenceType}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Linear Feet</p>
              <p className="font-medium">{selectedRequest.linearFeet}</p>
            </div>
          </div>

          {selectedRequest.specialRequirements && (
            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-1">Special Requirements</p>
              <p className="bg-gray-50 p-3 rounded-lg">{selectedRequest.specialRequirements}</p>
            </div>
          )}

          {/* Status Change */}
          <div className="mb-4 p-4 bg-blue-50 rounded-lg">
            <p className="text-sm font-medium mb-2">Change Status</p>
            <div className="flex gap-2">
              {['pending', 'quoted', 'approved', 'rejected', 'closed'].map(status => (
                <button
                  key={status}
                  onClick={() => updateRequest(selectedRequest.id, { status })}
                  className={`px-3 py-1 rounded-lg text-sm font-medium ${
                    selectedRequest.status === status
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  {status}
                </button>
              ))}
            </div>
          </div>

          {/* Notes Section */}
          <div className="mb-4">
            <h3 className="font-semibold mb-2">Internal Notes</h3>
            <div className="space-y-2 mb-3">
              {(selectedRequest.notes || []).map((note: any) => (
                <div key={note.id} className="bg-yellow-50 p-3 rounded-lg">
                  <p className="text-sm">{note.text}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {note.author} - {new Date(note.timestamp).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                placeholder="Add internal note..."
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                onKeyPress={(e) => e.key === 'Enter' && addNote(selectedRequest.id)}
              />
              <button
                onClick={() => addNote(selectedRequest.id)}
                className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 font-medium text-sm"
              >
                Add Note
              </button>
            </div>
          </div>

          {/* Chat Section */}
          <div>
            <h3 className="font-semibold mb-2">Chat with Sales Rep</h3>
            <div className="space-y-2 mb-3 max-h-60 overflow-y-auto">
              {(selectedRequest.messages || []).map((msg: any) => (
                <div key={msg.id} className={`p-3 rounded-lg ${
                  msg.from === 'operations' ? 'bg-blue-50 ml-8' : 'bg-gray-100 mr-8'
                }`}>
                  <p className="text-sm">{msg.text}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {msg.from === 'operations' ? 'You' : selectedRequest.salesperson} - {new Date(msg.timestamp).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Message to sales rep..."
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                onKeyPress={(e) => e.key === 'Enter' && addMessage(selectedRequest.id)}
              />
              <button
                onClick={() => addMessage(selectedRequest.id)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium text-sm"
              >
                Send
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <button onClick={onBack} className="text-blue-600 font-medium mb-4 flex items-center gap-2">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Request Queue</h1>
        <p className="text-gray-600">Review and respond to pricing requests from the sales team</p>
      </div>

      {/* Advanced Filters */}
      <div className="bg-white rounded-xl shadow p-4 mb-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <label className="text-xs font-medium text-gray-700 block mb-1">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="quoted">Quoted</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="closed">Closed</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-700 block mb-1">Request Type</label>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            >
              <option value="all">All Types</option>
              {requestTypes.map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-700 block mb-1">Salesperson</label>
            <select
              value={salespersonFilter}
              onChange={(e) => setSalespersonFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            >
              <option value="all">All Salespeople</option>
              {salespeople.map(person => (
                <option key={person} value={person}>{person}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-700 block mb-1">Age</label>
            <select
              value={ageFilter}
              onChange={(e) => setAgeFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            >
              <option value="all">All Ages</option>
              <option value="today">Today</option>
              <option value="1-3">1-3 days</option>
              <option value="4-7">4-7 days</option>
              <option value="7+">7+ days</option>
            </select>
          </div>
        </div>
      </div>

      {/* Requests List */}
      <div className="space-y-4">
        {filteredRequests.length === 0 ? (
          <div className="bg-white rounded-xl shadow p-8 text-center">
            <Ticket className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No {statusFilter !== 'all' ? statusFilter : ''} requests</p>
          </div>
        ) : (
          filteredRequests.map((request) => (
            <button
              key={request.id}
              onClick={() => setSelectedRequest(request)}
              className="w-full bg-white rounded-xl shadow p-4 hover:shadow-lg transition-shadow text-left"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-lg">{request.customerName}</h3>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusBadge(request.status)}`}>
                      {request.status}
                    </span>
                    <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-medium">
                      {getRequestAge(request.timestamp)}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600">{request.address}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {request.salesperson || 'Unknown Sales Rep'} • {new Date(request.timestamp).toLocaleDateString()}
                  </p>
                </div>
              </div>

              {/* Request Details */}
              <div className="grid grid-cols-2 gap-3 mb-3 p-3 bg-gray-50 rounded-lg">
                <div>
                  <p className="text-xs text-gray-600">Fence Type</p>
                  <p className="font-medium">{request.fenceType}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-600">Linear Feet</p>
                  <p className="font-medium">{request.linearFeet}</p>
                </div>
                {request.deadline && (
                  <div>
                    <p className="text-xs text-gray-600">Deadline</p>
                    <p className="font-medium">{request.deadline}</p>
                  </div>
                )}
                {request.urgency && (
                  <div>
                    <p className="text-xs text-gray-600">Urgency</p>
                    <p className="font-medium capitalize">{request.urgency}</p>
                  </div>
                )}
              </div>

              {request.specialRequirements && (
                <div className="mb-3">
                  <p className="text-xs text-gray-600 mb-1">Special Requirements</p>
                  <p className="text-sm bg-gray-50 p-2 rounded">{request.specialRequirements}</p>
                </div>
              )}

              <div className="mt-2 text-sm text-blue-600 font-medium">
                Click to view details and respond →
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
};

interface SalesManagerViewProps {
  activeSection: Section;
  setActiveSection: (section: Section) => void;
}

// @ts-ignore - Unused legacy component
const SalesManagerView = ({ activeSection, setActiveSection }: SalesManagerViewProps) => {
  if (activeSection === 'sales-coach') {
    return <SalesCoach userId="user123" onOpenAdmin={() => setActiveSection('sales-coach-admin')} />;
  }

  if (activeSection === 'sales-coach-admin') {
    return <SalesCoachAdmin onBack={() => setActiveSection('sales-coach')} userRole="sales-manager" />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Sales Manager Dashboard</h1>
        <p className="text-gray-600">Review team performance and coach sales reps</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <button
          onClick={() => setActiveSection('sales-coach')}
          className="bg-gradient-to-r from-purple-600 to-purple-700 text-white p-6 rounded-xl shadow-lg hover:shadow-xl transition-shadow text-left"
        >
          <div className="flex items-center space-x-4">
            <div className="bg-white/20 p-3 rounded-lg">
              <Mic className="w-8 h-8" />
            </div>
            <div>
              <div className="font-bold text-xl">Sales Coach</div>
              <div className="text-sm text-purple-100">Review recordings & add feedback</div>
            </div>
          </div>
        </button>

        <button
          onClick={() => setActiveSection('team')}
          className="bg-white border-2 border-gray-200 p-6 rounded-xl shadow-sm hover:border-purple-300 transition-colors text-left"
        >
          <div className="flex items-center space-x-4">
            <div className="bg-green-100 p-3 rounded-lg">
              <User className="w-8 h-8 text-green-600" />
            </div>
            <div>
              <div className="font-bold text-xl text-gray-900">Team Performance</div>
              <div className="text-sm text-gray-600">Track team metrics & leaderboards</div>
            </div>
          </div>
        </button>
      </div>
    </div>
  );
};

interface AdminViewProps {
  activeSection: Section;
  setActiveSection: (section: Section) => void;
}

// @ts-ignore - Unused legacy component
const AdminView = ({ activeSection, setActiveSection }: AdminViewProps) => {
  if (activeSection === 'sales-coach-admin') {
    return <SalesCoachAdmin onBack={() => setActiveSection('home')} userRole="admin" />;
  }

  if (activeSection === 'request-queue') {
    return <RequestQueue onBack={() => setActiveSection('home')} userRole="admin" />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Admin Dashboard</h1>
        <p className="text-gray-600">Full system access and configuration</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <button
          onClick={() => setActiveSection('sales-coach-admin')}
          className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6 rounded-xl shadow-lg hover:shadow-xl transition-shadow text-left"
        >
          <div className="flex items-center space-x-4">
            <div className="bg-white/20 p-3 rounded-lg">
              <Wrench className="w-8 h-8" />
            </div>
            <div>
              <div className="font-bold text-xl">Sales Coach Admin</div>
              <div className="text-sm text-blue-100">Configure processes & knowledge</div>
            </div>
          </div>
        </button>

        <button
          onClick={() => setActiveSection('request-queue')}
          className="bg-white border-2 border-gray-200 p-6 rounded-xl shadow-sm hover:border-blue-300 transition-colors text-left"
        >
          <div className="flex items-center space-x-4">
            <div className="bg-orange-100 p-3 rounded-lg">
              <Ticket className="w-8 h-8 text-orange-600" />
            </div>
            <div>
              <div className="font-bold text-xl text-gray-900">Request Queue</div>
              <div className="text-sm text-gray-600">Process pricing requests</div>
            </div>
          </div>
        </button>

        <button
          onClick={() => setActiveSection('analytics')}
          className="bg-white border-2 border-gray-200 p-6 rounded-xl shadow-sm hover:border-blue-300 transition-colors text-left"
        >
          <div className="flex items-center space-x-4">
            <div className="bg-green-100 p-3 rounded-lg">
              <DollarSign className="w-8 h-8 text-green-600" />
            </div>
            <div>
              <div className="font-bold text-xl text-gray-900">Analytics</div>
              <div className="text-sm text-gray-600">System-wide metrics</div>
            </div>
          </div>
        </button>
      </div>
    </div>
  );
};

// Placeholder Dashboard Component
interface DashboardProps {
  userRole: UserRole;
}

const Dashboard = ({ userRole }: DashboardProps) => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Dashboard</h1>
        <p className="text-gray-600">Welcome back! Here's your overview.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border-2 border-gray-200 p-6 rounded-xl">
          <div className="flex items-center space-x-3 mb-2">
            <div className="bg-blue-100 p-2 rounded-lg">
              <Ticket className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Active Requests</p>
              <p className="text-2xl font-bold text-gray-900">12</p>
            </div>
          </div>
        </div>

        <div className="bg-white border-2 border-gray-200 p-6 rounded-xl">
          <div className="flex items-center space-x-3 mb-2">
            <div className="bg-green-100 p-2 rounded-lg">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Completed</p>
              <p className="text-2xl font-bold text-gray-900">45</p>
            </div>
          </div>
        </div>

        <div className="bg-white border-2 border-gray-200 p-6 rounded-xl">
          <div className="flex items-center space-x-3 mb-2">
            <div className="bg-orange-100 p-2 rounded-lg">
              <DollarSign className="w-6 h-6 text-orange-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Value</p>
              <p className="text-2xl font-bold text-gray-900">$127K</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-gray-100 border-2 border-gray-300 p-8 rounded-xl text-center">
        <p className="text-gray-600">Dashboard metrics will be displayed here based on role: <span className="font-semibold capitalize">{userRole}</span></p>
      </div>
    </div>
  );
};

// Placeholder Analytics Component
interface AnalyticsProps {
  userRole: UserRole;
}

const Analytics = ({ userRole }: AnalyticsProps) => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Analytics</h1>
        <p className="text-gray-600">Performance metrics and insights</p>
      </div>

      <div className="bg-gray-100 border-2 border-gray-300 p-8 rounded-xl text-center">
        <p className="text-gray-600">Analytics dashboard coming soon for role: <span className="font-semibold capitalize">{userRole}</span></p>
      </div>
    </div>
  );
};

export default App;
