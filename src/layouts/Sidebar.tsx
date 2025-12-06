import { Menu, X, User, LogOut } from 'lucide-react';

type UserRole = 'sales' | 'operations' | 'sales-manager' | 'admin' | 'yard';
type Section = 'home' | 'custom-pricing' | 'requests' | 'my-requests' | 'presentation' | 'stain-calculator' | 'sales-coach' | 'sales-coach-admin' | 'photo-gallery' | 'sales-resources' | 'dashboard' | 'request-queue' | 'analytics' | 'team' | 'manager-dashboard' | 'team-communication' | 'direct-messages' | 'assignment-rules' | 'bom-calculator' | 'leadership' | 'my-todos' | 'yard';

interface NavigationItem {
  id: Section;
  menuId: string;
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
  separator?: boolean;
}

interface SidebarProps {
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  navigationItems: NavigationItem[];
  activeSection: Section;
  setActiveSection: (section: Section) => void;
  userRole: UserRole;
  setUserRole: (role: UserRole) => void;
  profileRole: UserRole | undefined;
  profileFullName: string | undefined;
  profileAvatarUrl: string | undefined;
  userName: string;
  user: any;
  signOut: () => void;
  setViewMode: (mode: 'mobile' | 'desktop') => void;
  setShowProfileView: (show: boolean) => void;
}

export default function Sidebar({
  sidebarOpen,
  setSidebarOpen,
  navigationItems,
  activeSection,
  setActiveSection,
  userRole,
  setUserRole,
  profileRole,
  profileFullName,
  profileAvatarUrl,
  userName,
  user,
  signOut,
  setViewMode,
  setShowProfileView
}: SidebarProps) {
  return (
    <div className={`${sidebarOpen ? 'w-64' : 'w-20'} h-full bg-gray-900 text-white transition-all duration-300 flex flex-col`}>
      <div className="p-3 border-b border-gray-800">
        {sidebarOpen ? (
          <div className="flex items-center justify-between">
            <img src="/logo-transparent.png" alt="Discount Fence USA" className="h-10 w-auto" />
            <div className="flex items-center gap-3">
              <p className="text-gray-500 text-xs">
                {(() => {
                  try {
                    const buildTime = typeof __BUILD_TIME__ !== 'undefined' ? __BUILD_TIME__ : new Date().toISOString();
                    const dateStr = new Date(buildTime).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
                    return import.meta.env.MODE === 'development'
                      ? `v1.0.dev • ${dateStr}`
                      : `v1.0 • ${dateStr}`;
                  } catch {
                    return import.meta.env.MODE === 'development' ? 'v1.0.dev' : 'v1.0';
                  }
                })()}
              </p>
              <button onClick={() => setSidebarOpen(false)} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <img src="/logo-transparent.png" alt="Logo" className="h-10 w-auto" />
            <button onClick={() => setSidebarOpen(true)} className="text-gray-400 hover:text-white">
              <Menu className="w-6 h-6" />
            </button>
          </div>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto p-3 space-y-1">
        {navigationItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeSection === item.id;
          return (
            <div key={item.id}>
              {item.separator && <div className="my-2 border-t border-gray-700"></div>}
              <button
                onClick={() => setActiveSection(item.id)}
                className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors ${
                  isActive ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                }`}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                {sidebarOpen && (
                  <span className="font-medium text-sm flex-1 text-left">{item.name}</span>
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
        {sidebarOpen && profileRole === 'admin' && (
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

        {/* User Profile and Sign Out */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowProfileView(true)}
            className="flex items-center space-x-2 flex-1 hover:bg-gray-800 rounded-lg p-2 transition-colors"
          >
            {profileAvatarUrl ? (
              <img
                src={profileAvatarUrl}
                alt={userName}
                className="w-8 h-8 rounded-full object-cover border-2 border-blue-600 flex-shrink-0"
              />
            ) : (
              <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
                <User className="w-5 h-5 text-white" />
              </div>
            )}
            {sidebarOpen && (
              <div className="flex-1 min-w-0 text-left">
                <p className="font-medium text-xs text-white truncate">
                  {profileFullName || userName}
                </p>
                <p className="text-xs text-gray-400 capitalize">{profileRole || userRole}</p>
              </div>
            )}
          </button>

          {/* Logout Button */}
          {user && sidebarOpen && (
            <button
              onClick={() => signOut()}
              className="p-2 text-gray-300 hover:bg-gray-800 hover:text-red-400 rounded-lg transition-colors"
              title="Sign Out"
            >
              <LogOut className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
