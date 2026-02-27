import { useState } from 'react';
import { Plus, Search, ChevronRight, ListTodo, User, Globe, Lock, X } from 'lucide-react';
import { useTodoListsQuery } from '../hooks/useTodoLists';
import { headerColorOptions } from '../utils/todoHelpers';

interface TodoSidebarProps {
  selectedListId: string | null;
  showMyWork: boolean;
  onSelectList: (listId: string) => void;
  onMyWorkClick: () => void;
  onNewListClick: () => void;
  isMobileOpen?: boolean;
  onMobileClose?: () => void;
}

function getColorBg(colorValue: string): string {
  const option = headerColorOptions.find(c => c.value === colorValue);
  return option?.bg || 'bg-blue-900';
}

function getVisibilityIcon(visibility: string) {
  switch (visibility) {
    case 'open': return <Globe className="w-3 h-3 text-gray-400" />;
    case 'private': return <Lock className="w-3 h-3 text-gray-400" />;
    default: return <User className="w-3 h-3 text-gray-400" />;
  }
}

export default function TodoSidebar({
  selectedListId,
  showMyWork,
  onSelectList,
  onMyWorkClick,
  onNewListClick,
  isMobileOpen = false,
  onMobileClose,
}: TodoSidebarProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const { data: lists, isLoading } = useTodoListsQuery();

  const filteredLists = lists?.filter(list =>
    list.title.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  const sidebarContent = (
    <div className="w-60 bg-white border-r border-gray-200 flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <ListTodo className="w-5 h-5 text-blue-600" />
            <h2 className="font-semibold text-gray-900">My To-Dos</h2>
          </div>
          {onMobileClose && (
            <button
              onClick={onMobileClose}
              className="p-1 hover:bg-gray-100 rounded lg:hidden"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          )}
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search lists..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      </div>

      {/* My Work Button */}
      <div className="p-2">
        <button
          onClick={() => {
            onMyWorkClick();
            onMobileClose?.();
          }}
          className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors text-left ${
            showMyWork
              ? 'bg-blue-50 border border-blue-200'
              : 'hover:bg-gray-50 border border-transparent'
          }`}
        >
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center flex-shrink-0">
            <User className="w-4 h-4 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <span className={`text-sm font-medium ${showMyWork ? 'text-blue-900' : 'text-gray-900'}`}>
              My Work
            </span>
            <div className="text-xs text-gray-500">All your tasks</div>
          </div>
          {showMyWork && <ChevronRight className="w-4 h-4 text-blue-600 flex-shrink-0" />}
        </button>
      </div>

      {/* Divider */}
      <div className="px-4">
        <div className="border-t border-gray-200" />
        <div className="text-xs font-medium text-gray-500 uppercase tracking-wider mt-3 mb-1 px-1">
          Lists
        </div>
      </div>

      {/* List of boards */}
      <div className="flex-1 overflow-y-auto p-2">
        {isLoading ? (
          <div className="p-4 text-center text-sm text-gray-500">Loading lists...</div>
        ) : filteredLists.length === 0 ? (
          <div className="p-4 text-center text-sm text-gray-500">
            {searchQuery ? 'No lists found' : 'No lists yet'}
          </div>
        ) : (
          <div className="space-y-1">
            {filteredLists.map(list => {
              const isSelected = selectedListId === list.id && !showMyWork;
              return (
                <button
                  key={list.id}
                  onClick={() => {
                    onSelectList(list.id);
                    onMobileClose?.();
                  }}
                  className={`w-full flex items-center gap-3 p-2.5 rounded-lg transition-colors text-left ${
                    isSelected
                      ? 'bg-blue-50 border border-blue-200'
                      : 'hover:bg-gray-50 border border-transparent'
                  }`}
                >
                  {/* Color dot */}
                  <div className={`w-3 h-3 rounded-full flex-shrink-0 ${getColorBg(list.color)}`} />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className={`text-sm font-medium truncate ${
                        isSelected ? 'text-blue-900' : 'text-gray-900'
                      }`}>
                        {list.title}
                      </span>
                      {getVisibilityIcon(list.visibility)}
                    </div>
                    <div className="text-xs text-gray-500">
                      {list.item_count || 0} task{(list.item_count || 0) !== 1 ? 's' : ''}
                    </div>
                  </div>

                  {isSelected && <ChevronRight className="w-4 h-4 text-blue-600 flex-shrink-0" />}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* New List Button */}
      <div className="p-4 border-t border-gray-200">
        <button
          onClick={() => {
            onNewListClick();
            onMobileClose?.();
          }}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition-colors border border-blue-200"
        >
          <Plus className="w-4 h-4" />
          New List
        </button>
      </div>
    </div>
  );

  // Mobile overlay
  return (
    <>
      {/* Desktop sidebar */}
      <div className="hidden lg:block">
        {sidebarContent}
      </div>

      {/* Mobile overlay */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/30" onClick={onMobileClose} />
          <div className="relative z-50">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
}
