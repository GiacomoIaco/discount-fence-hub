import { useState } from 'react';
import { Plus, X, Settings, Users, User, Calendar } from 'lucide-react';
import type { CalendarViewTab, CalendarViewType } from '../../hooks/useCalendarViews';
import { VIEW_TYPE_LABELS } from '../../hooks/useCalendarViews';

// ============================================
// VIEW TAB MANAGER
// ============================================

interface ViewTabManagerProps {
  tabs: CalendarViewTab[];
  activeTabId: string;
  onSelectTab: (tabId: string) => void;
  onUpdateTab: (tabId: string, updates: Partial<CalendarViewTab>) => void;
  onAddTab: (tab: Omit<CalendarViewTab, 'id'>) => void;
  onRemoveTab: (tabId: string) => void;
}

export function ViewTabManager({
  tabs,
  activeTabId,
  onSelectTab,
  onUpdateTab,
  onAddTab,
  onRemoveTab,
}: ViewTabManagerProps) {
  const [showSettings, setShowSettings] = useState<string | null>(null);
  const [showAddMenu, setShowAddMenu] = useState(false);

  const handleAddTab = (viewType: CalendarViewType) => {
    const defaults: Partial<CalendarViewTab> = {
      viewType,
      showCrews: viewType === 'crew_capacity',
      showReps: viewType !== 'crew_capacity',
      daysToShow: viewType === 'crew_capacity' ? 5 : undefined,
    };

    onAddTab({
      name: VIEW_TYPE_LABELS[viewType],
      viewType,
      showCrews: defaults.showCrews ?? true,
      showReps: defaults.showReps ?? true,
      daysToShow: defaults.daysToShow,
    });
    setShowAddMenu(false);
  };

  return (
    <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
      {/* Tab Buttons */}
      {tabs.map((tab) => (
        <div key={tab.id} className="relative group">
          <button
            onClick={() => onSelectTab(tab.id)}
            className={`
              flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md transition-colors
              ${activeTabId === tab.id
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200'
              }
            `}
          >
            <TabIcon viewType={tab.viewType} showCrews={tab.showCrews} showReps={tab.showReps} />
            <span>{tab.name}</span>
          </button>

          {/* Settings Button (on hover) */}
          {activeTabId === tab.id && (
            <button
              onClick={() => setShowSettings(showSettings === tab.id ? null : tab.id)}
              className="absolute -right-1 -top-1 p-0.5 bg-white border rounded shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <Settings className="w-3 h-3 text-gray-500" />
            </button>
          )}

          {/* Tab Settings Dropdown */}
          {showSettings === tab.id && (
            <TabSettingsDropdown
              tab={tab}
              onUpdate={(updates) => onUpdateTab(tab.id, updates)}
              onRemove={tabs.length > 1 ? () => onRemoveTab(tab.id) : undefined}
              onClose={() => setShowSettings(null)}
            />
          )}
        </div>
      ))}

      {/* Add Tab Button */}
      {tabs.length < 4 && (
        <div className="relative">
          <button
            onClick={() => setShowAddMenu(!showAddMenu)}
            className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded-md transition-colors"
            title="Add view tab"
          >
            <Plus className="w-4 h-4" />
          </button>

          {showAddMenu && (
            <div className="absolute top-full left-0 mt-1 bg-white border rounded-lg shadow-lg z-50 min-w-[180px]">
              <div className="p-2">
                <p className="text-xs font-medium text-gray-500 mb-2 px-2">Add View</p>
                {(['crew_capacity', 'timeline_week', 'timeline_day', 'month', 'list'] as CalendarViewType[]).map(
                  (viewType) => (
                    <button
                      key={viewType}
                      onClick={() => handleAddTab(viewType)}
                      className="w-full text-left px-2 py-1.5 text-sm text-gray-700 hover:bg-gray-100 rounded flex items-center gap-2"
                    >
                      <ViewTypeIcon viewType={viewType} />
                      {VIEW_TYPE_LABELS[viewType]}
                    </button>
                  )
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================
// TAB SETTINGS DROPDOWN
// ============================================

interface TabSettingsDropdownProps {
  tab: CalendarViewTab;
  onUpdate: (updates: Partial<CalendarViewTab>) => void;
  onRemove?: () => void;
  onClose: () => void;
}

function TabSettingsDropdown({
  tab,
  onUpdate,
  onRemove,
  onClose,
}: TabSettingsDropdownProps) {
  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40"
        onClick={onClose}
      />

      {/* Dropdown */}
      <div className="absolute top-full left-0 mt-1 bg-white border rounded-lg shadow-lg z-50 min-w-[220px]">
        <div className="p-3">
          {/* Tab Name */}
          <div className="mb-3">
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Tab Name
            </label>
            <input
              type="text"
              value={tab.name}
              onChange={(e) => onUpdate({ name: e.target.value })}
              className="w-full px-2 py-1 text-sm border rounded focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* View Type */}
          <div className="mb-3">
            <label className="block text-xs font-medium text-gray-500 mb-1">
              View Type
            </label>
            <select
              value={tab.viewType}
              onChange={(e) => onUpdate({ viewType: e.target.value as CalendarViewType })}
              className="w-full px-2 py-1 text-sm border rounded focus:ring-2 focus:ring-blue-500"
            >
              <option value="crew_capacity">Crew Capacity</option>
              <option value="timeline_week">Week Timeline</option>
              <option value="timeline_day">Day Timeline</option>
              <option value="month">Month</option>
              <option value="list">List</option>
            </select>
          </div>

          {/* Show Options */}
          <div className="mb-3 space-y-2">
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Show
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={tab.showCrews}
                onChange={(e) => onUpdate({ showCrews: e.target.checked })}
                className="w-4 h-4 text-blue-600 rounded"
              />
              Crews
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={tab.showReps}
                onChange={(e) => onUpdate({ showReps: e.target.checked })}
                className="w-4 h-4 text-blue-600 rounded"
              />
              Sales Reps
            </label>
          </div>

          {/* Days to show (crew_capacity only) */}
          {tab.viewType === 'crew_capacity' && (
            <div className="mb-3">
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Days to Show
              </label>
              <select
                value={tab.daysToShow || 5}
                onChange={(e) => onUpdate({ daysToShow: parseInt(e.target.value) })}
                className="w-full px-2 py-1 text-sm border rounded focus:ring-2 focus:ring-blue-500"
              >
                <option value={5}>5 Days (Mon-Fri)</option>
                <option value={6}>6 Days (Mon-Sat)</option>
                <option value={7}>7 Days (Full Week)</option>
              </select>
            </div>
          )}

          {/* Remove Button */}
          {onRemove && (
            <button
              onClick={onRemove}
              className="w-full flex items-center justify-center gap-2 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded border border-red-200"
            >
              <X className="w-3.5 h-3.5" />
              Remove Tab
            </button>
          )}
        </div>
      </div>
    </>
  );
}

// ============================================
// ICONS
// ============================================

function TabIcon({
  viewType,
  showCrews,
  showReps,
}: {
  viewType: CalendarViewType;
  showCrews: boolean;
  showReps: boolean;
}) {
  if (viewType === 'crew_capacity' || (showCrews && !showReps)) {
    return <Users className="w-4 h-4" />;
  }
  if (showReps && !showCrews) {
    return <User className="w-4 h-4" />;
  }
  return <Calendar className="w-4 h-4" />;
}

function ViewTypeIcon({ viewType }: { viewType: CalendarViewType }) {
  switch (viewType) {
    case 'crew_capacity':
      return <Users className="w-4 h-4 text-gray-500" />;
    case 'timeline_day':
    case 'timeline_week':
      return <Calendar className="w-4 h-4 text-gray-500" />;
    default:
      return <Calendar className="w-4 h-4 text-gray-500" />;
  }
}
