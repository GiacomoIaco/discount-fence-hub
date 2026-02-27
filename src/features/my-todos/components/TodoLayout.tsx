import { useState, useEffect, useCallback, useRef } from 'react';
import type { ReactNode } from 'react';
import {
  ListTodo,
  User,
  Plus,
  ChevronRight,
  Pin,
  PinOff,
  Globe,
  Lock,
  Menu,
} from 'lucide-react';
import { useTodoListsQuery } from '../hooks/useTodoLists';
import { headerColorOptions } from '../utils/todoHelpers';

const STORAGE_KEY = 'sidebar-collapsed-my-todos';

// Hover timing constants (in ms)
const EXPAND_DELAY = 300;
const COLLAPSE_DELAY = 500;

function getColorBg(colorValue: string): string {
  const option = headerColorOptions.find(c => c.value === colorValue);
  return option?.bg || 'bg-blue-900';
}

function getVisibilityIcon(visibility: string) {
  switch (visibility) {
    case 'open': return <Globe className="w-3 h-3 text-teal-300/70" />;
    case 'private': return <Lock className="w-3 h-3 text-teal-300/70" />;
    default: return <User className="w-3 h-3 text-teal-300/70" />;
  }
}

interface TodoLayoutProps {
  children: ReactNode;
  selectedListId: string | null;
  showMyWork: boolean;
  onSelectList: (listId: string) => void;
  onMyWorkClick: () => void;
  onNewListClick: () => void;
  isMobileSidebarOpen: boolean;
  onToggleMobileSidebar: () => void;
}

export default function TodoLayout({
  children,
  selectedListId,
  showMyWork,
  onSelectList,
  onMyWorkClick,
  onNewListClick,
  isMobileSidebarOpen,
  onToggleMobileSidebar,
}: TodoLayoutProps) {
  const { data: lists, isLoading } = useTodoListsQuery();

  // Load initial state from localStorage (hover-to-expand pattern)
  const getInitialSidebarState = () => {
    if (typeof window === 'undefined') return { pinned: false, collapsed: true };
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        return {
          pinned: parsed.pinned ?? false,
          collapsed: parsed.collapsed ?? true,
        };
      }
    } catch {
      return { pinned: false, collapsed: true };
    }
    return { pinned: false, collapsed: true };
  };

  const initialSidebar = getInitialSidebarState();
  const [pinned, setPinned] = useState(initialSidebar.pinned);
  const [collapsed, setCollapsed] = useState(initialSidebar.collapsed);
  const [isPeeking, setIsPeeking] = useState(false);

  // Refs for timeout management
  const expandTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const collapseTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isHoveringRef = useRef(false);

  // Sidebar is expanded if pinned open OR peeking
  const isExpanded = pinned || isPeeking || !collapsed;

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

  // Persist sidebar state to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ pinned, collapsed }));
  }, [pinned, collapsed]);

  const handleSidebarMouseEnter = useCallback(() => {
    isHoveringRef.current = true;
    clearTimeouts();

    if (collapsed && !pinned) {
      expandTimeoutRef.current = setTimeout(() => {
        if (isHoveringRef.current) {
          setIsPeeking(true);
        }
      }, EXPAND_DELAY);
    }
  }, [collapsed, pinned, clearTimeouts]);

  const handleSidebarMouseLeave = useCallback(() => {
    isHoveringRef.current = false;
    clearTimeouts();

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
    if (pinned) {
      setPinned(false);
      setCollapsed(true);
      setIsPeeking(false);
    } else {
      setPinned(true);
      setCollapsed(false);
      setIsPeeking(false);
    }
  }, [pinned, clearTimeouts]);

  const filteredLists = lists || [];

  return (
    <div className="flex h-full">
      {/* Desktop Sidebar — hover-to-expand pattern */}
      <div
        className={`${isExpanded ? 'w-56' : 'w-14'} bg-gradient-to-b from-teal-700 to-emerald-900 text-white flex-col transition-all duration-300 hidden lg:flex`}
        onMouseEnter={handleSidebarMouseEnter}
        onMouseLeave={handleSidebarMouseLeave}
      >
        {/* Header */}
        <div className="p-3 border-b border-teal-600">
          <div className={`flex items-center ${!isExpanded ? 'justify-center' : 'justify-between'}`}>
            {isExpanded ? (
              <h1 className="text-lg font-bold flex items-center gap-2">
                <ListTodo className="w-5 h-5" />
                My To-Dos
              </h1>
            ) : (
              <ListTodo className="w-5 h-5" />
            )}
            <button
              onClick={handleTogglePin}
              className={`p-1.5 rounded transition-colors ${pinned ? 'text-teal-300 hover:text-white' : 'text-teal-200 hover:text-white hover:bg-white/10'}`}
              title={pinned ? 'Unpin sidebar' : 'Pin sidebar open'}
            >
              {pinned ? <Pin className="w-4 h-4" /> : <PinOff className="w-4 h-4" />}
            </button>
          </div>
          {isExpanded && <p className="text-xs text-teal-200 mt-1">Organize your work</p>}
        </div>

        {/* My Work */}
        <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
          <button
            onClick={onMyWorkClick}
            className={`w-full flex items-center ${!isExpanded ? 'justify-center' : 'gap-3'} px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
              showMyWork
                ? 'bg-white/20 text-white shadow-lg'
                : 'text-teal-100 hover:bg-white/10 hover:text-white'
            }`}
            title="My Work"
          >
            <User className="w-4 h-4 flex-shrink-0" />
            {isExpanded && (
              <>
                <span className="flex-1 text-left">My Work</span>
                {showMyWork && <ChevronRight className="w-4 h-4" />}
              </>
            )}
          </button>

          {/* Divider */}
          {isExpanded && (
            <div className="px-1 pt-2 pb-1">
              <div className="text-[10px] font-medium text-teal-300/70 uppercase tracking-wider">Lists</div>
            </div>
          )}
          {!isExpanded && <div className="border-t border-teal-600 my-1" />}

          {/* Lists */}
          {isLoading ? (
            isExpanded && <div className="px-3 py-2 text-xs text-teal-300/70">Loading...</div>
          ) : (
            filteredLists.map(list => {
              const isSelected = selectedListId === list.id && !showMyWork;
              return (
                <button
                  key={list.id}
                  onClick={() => onSelectList(list.id)}
                  className={`w-full flex items-center ${!isExpanded ? 'justify-center' : 'gap-3'} px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    isSelected
                      ? 'bg-white/20 text-white shadow-lg'
                      : 'text-teal-100 hover:bg-white/10 hover:text-white'
                  }`}
                  title={list.title}
                >
                  <div className={`w-3 h-3 rounded-full flex-shrink-0 ${getColorBg(list.color)}`} />
                  {isExpanded && (
                    <>
                      <div className="flex-1 min-w-0 text-left">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate">{list.title}</span>
                          {getVisibilityIcon(list.visibility)}
                        </div>
                        <div className="text-[11px] text-teal-300/70">
                          {list.item_count || 0} task{(list.item_count || 0) !== 1 ? 's' : ''}
                        </div>
                      </div>
                      {isSelected && <ChevronRight className="w-4 h-4 flex-shrink-0" />}
                    </>
                  )}
                </button>
              );
            })
          )}
        </nav>

        {/* New List Button */}
        <div className="p-2 border-t border-teal-600">
          <button
            onClick={onNewListClick}
            className={`w-full flex items-center ${!isExpanded ? 'justify-center' : 'gap-2'} px-3 py-2 text-sm text-teal-200 hover:bg-white/10 hover:text-white rounded-lg transition-colors`}
            title="New List"
          >
            <Plus className="w-4 h-4 flex-shrink-0" />
            {isExpanded && <span>New List</span>}
          </button>
        </div>
      </div>

      {/* Mobile sidebar overlay */}
      {isMobileSidebarOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/30" onClick={onToggleMobileSidebar} />
          <div className="relative z-50 w-64 h-full bg-gradient-to-b from-teal-700 to-emerald-900 text-white flex flex-col">
            {/* Mobile Header */}
            <div className="p-4 border-b border-teal-600 flex items-center justify-between">
              <h1 className="text-lg font-bold flex items-center gap-2">
                <ListTodo className="w-5 h-5" />
                My To-Dos
              </h1>
              <button onClick={onToggleMobileSidebar} className="p-1 hover:bg-white/10 rounded">
                <span className="text-teal-200 text-xl">&times;</span>
              </button>
            </div>

            {/* Mobile My Work */}
            <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
              <button
                onClick={() => { onMyWorkClick(); onToggleMobileSidebar(); }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  showMyWork ? 'bg-white/20 text-white' : 'text-teal-100 hover:bg-white/10'
                }`}
              >
                <User className="w-4 h-4" />
                <span>My Work</span>
              </button>

              <div className="px-1 pt-2 pb-1">
                <div className="text-[10px] font-medium text-teal-300/70 uppercase tracking-wider">Lists</div>
              </div>

              {filteredLists.map(list => {
                const isSelected = selectedListId === list.id && !showMyWork;
                return (
                  <button
                    key={list.id}
                    onClick={() => { onSelectList(list.id); onToggleMobileSidebar(); }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                      isSelected ? 'bg-white/20 text-white' : 'text-teal-100 hover:bg-white/10'
                    }`}
                  >
                    <div className={`w-3 h-3 rounded-full flex-shrink-0 ${getColorBg(list.color)}`} />
                    <span className="truncate">{list.title}</span>
                  </button>
                );
              })}
            </nav>

            <div className="p-2 border-t border-teal-600">
              <button
                onClick={() => { onNewListClick(); onToggleMobileSidebar(); }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-teal-200 hover:bg-white/10 rounded-lg transition-colors"
              >
                <Plus className="w-4 h-4" />
                New List
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden bg-gray-50">
        {/* Mobile top bar */}
        <div className="bg-white border-b border-gray-200 px-4 py-2 flex items-center gap-3 lg:hidden">
          <button
            onClick={onToggleMobileSidebar}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            title="Toggle sidebar"
          >
            <Menu className="w-5 h-5 text-gray-600" />
          </button>
          <span className="text-sm font-medium text-gray-600">My To-Dos</span>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-auto">
          {children}
        </div>
      </div>
    </div>
  );
}
