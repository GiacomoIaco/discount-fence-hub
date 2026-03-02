import { useState, useRef, useCallback } from 'react';
import { Pin, PinOff, User, LogOut, Eye } from 'lucide-react';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import CreateDropdown from '../components/CreateDropdown';
import type { Section } from '../lib/routes';
import { usePermission } from '../contexts/PermissionContext';
import type { AppRole } from '../lib/permissions/types';

interface NavigationItem {
  id: Section;
  menuId: string;
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
  separator?: boolean;
  disabled?: boolean;
}

interface SidebarProps {
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  navigationItems: NavigationItem[];
  activeSection: Section;
  onNavigate: (section: Section) => void;
  profileFullName: string | undefined;
  profileAvatarUrl: string | undefined;
  userName: string;
  user: SupabaseUser | null;
  signOut: () => void;
  setViewMode: (mode: 'mobile' | 'desktop') => void;
  setShowProfileView: (show: boolean) => void;
  onCreateRequest?: () => void;
  onCreateQuote?: () => void;
}

// Hover timing constants (in ms)
const EXPAND_DELAY = 300;
const COLLAPSE_DELAY = 500;

export default function Sidebar({
  sidebarOpen,
  setSidebarOpen,
  navigationItems,
  activeSection,
  onNavigate,
  profileFullName,
  profileAvatarUrl,
  userName,
  user,
  signOut,
  setViewMode,
  setShowProfileView,
  onCreateRequest,
  onCreateQuote
}: SidebarProps) {
  const { role: permissionRole, realRole, isSuperAdmin, roleOverride, setRoleOverride } = usePermission();
  const canSwitchRoles = realRole === 'owner' || realRole === 'admin' || isSuperAdmin;
  // Hover-to-peek state
  const [isPeeking, setIsPeeking] = useState(false);
  const expandTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const collapseTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isHoveringRef = useRef(false);

  // Sidebar is expanded if pinned open OR peeking
  const isExpanded = sidebarOpen || isPeeking;

  const clearTimeouts = useCallback(() => {
    if (expandTimeoutRef.current) {
      clearTimeout(expandTimeoutRef.current);
      expandTimeoutRef.current = null;
    }
    if (collapseTimeoutRef.current) {
      clearTimeout(collapseTimeoutRef.current);
      collapseTimeoutRef.current = null;
    }
  }, []);

  const handleMouseEnter = useCallback(() => {
    isHoveringRef.current = true;
    clearTimeouts();

    // Only peek if not already pinned open
    if (!sidebarOpen) {
      expandTimeoutRef.current = setTimeout(() => {
        if (isHoveringRef.current) {
          setIsPeeking(true);
        }
      }, EXPAND_DELAY);
    }
  }, [sidebarOpen, clearTimeouts]);

  const handleMouseLeave = useCallback(() => {
    isHoveringRef.current = false;
    clearTimeouts();

    // Only collapse if peeking (not pinned open)
    if (isPeeking) {
      collapseTimeoutRef.current = setTimeout(() => {
        if (!isHoveringRef.current) {
          setIsPeeking(false);
        }
      }, COLLAPSE_DELAY);
    }
  }, [isPeeking, clearTimeouts]);

  const handleTogglePin = useCallback(() => {
    clearTimeouts();
    if (sidebarOpen) {
      // Unpin - collapse
      setSidebarOpen(false);
      setIsPeeking(false);
    } else {
      // Pin open
      setSidebarOpen(true);
      setIsPeeking(false);
    }
  }, [sidebarOpen, setSidebarOpen, clearTimeouts]);

  return (
    <div
      className={`${isExpanded ? 'w-64' : 'w-20'} h-full bg-gray-900 text-white transition-all duration-300 flex flex-col overflow-visible`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div className="p-3 border-b border-gray-800">
        {isExpanded ? (
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
              <button
                onClick={handleTogglePin}
                className={`p-1 rounded transition-colors ${sidebarOpen ? 'text-blue-400 hover:text-blue-300' : 'text-gray-400 hover:text-white'}`}
                title={sidebarOpen ? 'Unpin sidebar' : 'Pin sidebar open'}
              >
                {sidebarOpen ? <Pin className="w-4 h-4" /> : <PinOff className="w-4 h-4" />}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <img src="/logo-transparent.png" alt="Logo" className="h-10 w-auto" />
          </div>
        )}
      </div>

      {/* Create Dropdown - placed outside nav to avoid overflow clipping */}
      {onCreateRequest && (
        <div className="px-3 pt-3 pb-1">
          <CreateDropdown
            sidebarOpen={isExpanded}
            onCreateRequest={onCreateRequest}
            onCreateQuote={onCreateQuote}
          />
        </div>
      )}

      <nav className="flex-1 overflow-y-auto p-3 pt-2 space-y-1">
        {navigationItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeSection === item.id;
          const isDisabled = item.disabled;
          return (
            <div key={item.id}>
              {item.separator && <div className="my-2 border-t border-gray-700"></div>}
              <button
                onClick={() => !isDisabled && onNavigate(item.id)}
                disabled={isDisabled}
                className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors ${
                  isDisabled
                    ? 'text-gray-600 cursor-not-allowed'
                    : isActive
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                }`}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                {isExpanded && (
                  <span className="font-medium text-sm flex-1 text-left">{item.name}</span>
                )}
                {isDisabled && isExpanded && (
                  <span className="text-[10px] bg-gray-700 text-gray-400 px-1.5 py-0.5 rounded">Soon</span>
                )}
                {!isDisabled && item.badge && item.badge > 0 && (
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
        {isExpanded && (
          <div className="mb-3">
            <button
              onClick={() => setViewMode('mobile')}
              className="w-full px-3 py-2 text-sm bg-blue-600 hover:bg-blue-700 rounded text-white font-medium"
            >
              Switch to Mobile View
            </button>
          </div>
        )}

        {/* Admin role switcher — view app as different roles */}
        {isExpanded && canSwitchRoles && (
          <div className="mb-3">
            <div className="flex items-center gap-1.5 mb-1.5">
              <Eye className="w-3.5 h-3.5 text-gray-400" />
              <p className="text-xs text-gray-400">View As:</p>
            </div>
            <select
              value={roleOverride || ''}
              onChange={(e) => {
                const val = e.target.value as AppRole | '';
                setRoleOverride(val || null);
              }}
              className={`w-full px-2 py-1.5 text-sm rounded border transition-colors ${
                roleOverride
                  ? 'bg-amber-900/40 border-amber-600/50 text-amber-200'
                  : 'bg-gray-800 border-gray-700 text-white'
              }`}
            >
              <option value="">My Role ({realRole})</option>
              <option value="owner">Owner</option>
              <option value="admin">Admin</option>
              <option value="sales_manager">Sales Manager</option>
              <option value="sales_rep">Sales Rep</option>
              <option value="front_desk">Front Desk</option>
              <option value="ops_manager">Ops Manager</option>
              <option value="operations">Operations</option>
              <option value="yard">Yard</option>
              <option value="crew">Crew</option>
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
            {isExpanded && (
              <div className="flex-1 min-w-0 text-left">
                <p className="font-medium text-xs text-white truncate">
                  {profileFullName || userName}
                </p>
                <p className="text-xs text-gray-400 capitalize">{permissionRole || 'user'}</p>
              </div>
            )}
          </button>

          {/* Logout Button */}
          {user && isExpanded && (
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
