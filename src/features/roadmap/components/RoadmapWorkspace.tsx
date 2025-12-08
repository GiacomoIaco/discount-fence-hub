import { useState, useEffect } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  GripVertical,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Plus,
  Search,
  Filter,
  RefreshCw,
  User,
  Mic,
  SlidersHorizontal,
  ArrowUpDown,
  Copy,
  Check
} from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../../../lib/supabase';
import { HUB_CONFIG, type HubKey } from '../RoadmapHub';
import { STATUS_CONFIG, COMPLEXITY_CONFIG, type RoadmapItem, type StatusType, type ComplexityType } from '../types';
import RoadmapItemModal from './RoadmapItemModal';
import AddRoadmapItemModal from './AddRoadmapItemModal';

interface RoadmapWorkspaceProps {
  items: RoadmapItem[];
  loading: boolean;
  onRefresh: () => void;
  selectedHubs: Set<HubKey>;
  isAdmin: boolean;
}

const FILTER_STORAGE_KEY = 'roadmap-filter-state';

type SortOption = 'importance' | 'updated_at' | 'created_at' | 'title';

interface FilterState {
  statusFilter: StatusType | 'all';
  importanceFilter: number | 'all';
  complexityFilter: ComplexityType | 'all';
  showCompleted: boolean;
  sortBy: SortOption;
}

function loadFilterState(): FilterState | null {
  try {
    const saved = localStorage.getItem(FILTER_STORAGE_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch {
    // Ignore parse errors
  }
  return null;
}

function saveFilterState(state: FilterState) {
  try {
    localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage errors
  }
}

// Sortable item card with description on right (desktop)
function SortableItemCard({
  item,
  onOpen,
  isAdmin,
}: {
  item: RoadmapItem;
  onOpen: () => void;
  isAdmin: boolean;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const hubConfig = HUB_CONFIG[item.hub as HubKey];
  const statusConfig = STATUS_CONFIG[item.status];

  // Check if there's content to show on right side
  const hasDescription = item.raw_idea || item.claude_analysis;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`bg-white rounded-lg border p-4 transition-all ${
        isDragging ? 'shadow-lg ring-2 ring-blue-500' : 'hover:shadow-md'
      } ${hubConfig?.border || 'border-gray-200'}`}
    >
      {/* Desktop: Grid layout - left 40% for info, right 60% for description */}
      <div className="lg:grid lg:grid-cols-[minmax(300px,40%)_1fr] gap-4">
        {/* Left side - Main info */}
        <div className="flex items-start gap-3 min-w-0">
          {/* Drag handle */}
          <button
            {...attributes}
            {...listeners}
            className="p-1 text-gray-400 hover:text-gray-600 cursor-grab active:cursor-grabbing touch-none mt-1"
            onClick={(e) => e.stopPropagation()}
          >
            <GripVertical className="w-5 h-5" />
          </button>

          {/* Content */}
          <div className="flex-1 min-w-0">
            {/* Code and Title */}
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className={`text-xs font-mono px-1.5 py-0.5 rounded ${hubConfig?.bgLight || 'bg-gray-100'} ${hubConfig?.textColor || 'text-gray-600'}`}>
                {item.code}
              </span>
              <h3 className="font-medium text-gray-900 cursor-pointer hover:text-blue-600" onClick={onOpen}>
                {item.title}
              </h3>
            </div>

            {/* Meta row */}
            <div className="flex items-center gap-3 text-sm flex-wrap">
              {/* Status badge */}
              <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${statusConfig.bgColor} ${statusConfig.color}`}>
                {statusConfig.label}
              </span>

              {/* Importance */}
              {item.importance && (
                <span className="text-gray-500 text-xs">
                  {'★'.repeat(item.importance)}{'☆'.repeat(5 - item.importance)}
                </span>
              )}

              {/* Complexity */}
              {item.complexity && (
                <span className={`text-xs font-medium ${COMPLEXITY_CONFIG[item.complexity].color}`}>
                  {item.complexity}
                </span>
              )}

              {/* Submitter */}
              {item.creator_name && (
                <span className="text-xs text-gray-400 flex items-center gap-1">
                  <User className="w-3 h-3" />
                  {item.creator_name}
                </span>
              )}

              {/* Admin indicator for status changes */}
              {!isAdmin && (
                <span className="text-xs text-gray-400 italic">view only</span>
              )}
            </div>

            {/* Mobile: Show description in expanded section */}
            <div className="lg:hidden">
              {hasDescription && (
                <button
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="mt-2 text-xs text-blue-600 hover:underline flex items-center gap-1"
                >
                  {isExpanded ? 'Hide details' : 'Show details'}
                  {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                </button>
              )}
              {isExpanded && hasDescription && (
                <div className="mt-2 pt-2 border-t border-gray-100 text-sm text-gray-600">
                  {item.raw_idea && <p className="whitespace-pre-wrap">{item.raw_idea}</p>}
                  {item.claude_analysis && (
                    <div className="mt-2 p-2 bg-blue-50 rounded text-blue-800 text-xs">
                      <strong>AI Analysis:</strong> {item.claude_analysis}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right side - Description (desktop only) */}
        {hasDescription ? (
          <div className="hidden lg:block border-l border-gray-100 pl-4">
            <div className="text-sm text-gray-600">
              {item.raw_idea && (
                <p className="line-clamp-3">{item.raw_idea}</p>
              )}
              {item.claude_analysis && (
                <p className="text-xs text-blue-600 mt-1 line-clamp-2">
                  AI: {item.claude_analysis}
                </p>
              )}
            </div>
          </div>
        ) : (
          <div className="hidden lg:block" />
        )}
      </div>
    </div>
  );
}

export default function RoadmapWorkspace({
  items,
  loading,
  onRefresh,
  selectedHubs,
  isAdmin,
}: RoadmapWorkspaceProps) {
  const [localItems, setLocalItems] = useState<RoadmapItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Initialize filter state from localStorage
  const savedFilters = loadFilterState();
  const [statusFilter, setStatusFilter] = useState<StatusType | 'all'>(savedFilters?.statusFilter ?? 'all');
  const [importanceFilter, setImportanceFilter] = useState<number | 'all'>(savedFilters?.importanceFilter ?? 'all');
  const [complexityFilter, setComplexityFilter] = useState<ComplexityType | 'all'>(savedFilters?.complexityFilter ?? 'all');
  const [showCompleted, setShowCompleted] = useState(savedFilters?.showCompleted ?? false);
  const [sortBy, setSortBy] = useState<SortOption>(savedFilters?.sortBy ?? 'importance');

  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<RoadmapItem | null>(null);
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  // Copy filtered items as markdown
  const copyAsMarkdown = async () => {
    const markdown = filteredItems.map(item => {
      const stars = item.importance ? '★'.repeat(item.importance) + '☆'.repeat(5 - item.importance) : '';
      let md = `## ${item.code}: ${item.title}\n`;
      md += `**Status:** ${STATUS_CONFIG[item.status].label} | **Importance:** ${stars} | **Size:** ${item.complexity || 'N/A'}\n\n`;
      if (item.raw_idea) {
        md += `**Description:**\n${item.raw_idea}\n\n`;
      }
      if (item.claude_analysis) {
        md += `**Analysis:**\n${item.claude_analysis}\n\n`;
      }
      md += `---\n`;
      return md;
    }).join('\n');

    const header = `# Roadmap Items (${filteredItems.length} items)\n\n`;
    const fullMarkdown = header + markdown;

    try {
      await navigator.clipboard.writeText(fullMarkdown);
      setCopied(true);
      toast.success(`Copied ${filteredItems.length} items to clipboard`);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast.error('Failed to copy to clipboard');
    }
  };

  // Save filter state when filters change
  useEffect(() => {
    saveFilterState({
      statusFilter,
      importanceFilter,
      complexityFilter,
      showCompleted,
      sortBy,
    });
  }, [statusFilter, importanceFilter, complexityFilter, showCompleted, sortBy]);

  // Sync local items with props
  useEffect(() => {
    setLocalItems(items);
  }, [items]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = localItems.findIndex((item) => item.id === active.id);
      const newIndex = localItems.findIndex((item) => item.id === over.id);

      const newItems = arrayMove(localItems, oldIndex, newIndex);
      setLocalItems(newItems);

      // Update importance based on new position (higher = more important)
      const updates = newItems.map((item, index) => ({
        id: item.id,
        importance: Math.max(1, 5 - Math.floor(index / 5)), // Top items get higher importance
      }));

      try {
        for (const update of updates.slice(0, 10)) { // Only update moved items
          await supabase
            .from('roadmap_items')
            .update({ importance: update.importance })
            .eq('id', update.id);
        }
      } catch (error) {
        console.error('Failed to update importance:', error);
        setLocalItems(items); // Revert on error
      }
    }
  };

  // Filter items
  const filteredItems = localItems.filter(item => {
    // Hide completed items unless showCompleted is true
    if (!showCompleted && (item.status === 'done' || item.status === 'wont_do')) {
      return false;
    }

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      if (
        !item.title.toLowerCase().includes(query) &&
        !item.code.toLowerCase().includes(query) &&
        !(item.raw_idea?.toLowerCase().includes(query))
      ) {
        return false;
      }
    }

    // Status filter
    if (statusFilter !== 'all' && item.status !== statusFilter) {
      return false;
    }

    // Importance filter
    if (importanceFilter !== 'all' && item.importance !== importanceFilter) {
      return false;
    }

    // Complexity filter
    if (complexityFilter !== 'all' && item.complexity !== complexityFilter) {
      return false;
    }

    return true;
  }).sort((a, b) => {
    switch (sortBy) {
      case 'updated_at':
        return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
      case 'created_at':
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      case 'title':
        return a.title.localeCompare(b.title);
      case 'importance':
      default:
        return (b.importance || 0) - (a.importance || 0);
    }
  });

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center h-full">
        <RefreshCw className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  // Count active filters for badge
  const activeFilterCount = [
    statusFilter !== 'all',
    importanceFilter !== 'all',
    complexityFilter !== 'all',
    showCompleted,
  ].filter(Boolean).length;

  return (
    <div className="p-4 lg:p-6 h-full flex flex-col">
      {/* Toolbar */}
      <div className="space-y-3 mb-6">
        {/* Top row: Search + Actions */}
        <div className="flex items-center gap-2">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search items..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Mobile: Filter toggle button */}
          <button
            onClick={() => setFiltersExpanded(!filtersExpanded)}
            className="lg:hidden flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors relative"
          >
            <SlidersHorizontal className="w-4 h-4" />
            <span className="hidden sm:inline">Filters</span>
            {filtersExpanded ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
            {activeFilterCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 w-5 h-5 text-xs bg-blue-600 text-white rounded-full flex items-center justify-center">
                {activeFilterCount}
              </span>
            )}
          </button>

          {/* Actions */}
          <button
            onClick={copyAsMarkdown}
            className={`p-2 rounded-lg transition-colors ${
              copied ? 'text-green-600 bg-green-50' : 'text-gray-600 hover:bg-gray-100'
            }`}
            title="Copy as Markdown"
          >
            {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
          </button>
          <button
            onClick={onRefresh}
            className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            title="Refresh"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Add Idea</span>
          </button>
        </div>

        {/* Filters row - always visible on desktop, collapsible on mobile */}
        <div className={`${filtersExpanded ? 'block' : 'hidden'} lg:block`}>
          <div className="flex flex-wrap items-center gap-2 p-3 lg:p-0 bg-gray-50 lg:bg-transparent rounded-lg lg:rounded-none">
            <Filter className="w-4 h-4 text-gray-400" />

            {/* Status filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusType | 'all')}
              className="text-sm border border-gray-300 rounded-lg px-2 py-1.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
            >
              <option value="all">All Status</option>
              {Object.entries(STATUS_CONFIG).map(([key, config]) => (
                <option key={key} value={key}>{config.label}</option>
              ))}
            </select>

            {/* Importance filter */}
            <select
              value={importanceFilter}
              onChange={(e) => setImportanceFilter(e.target.value === 'all' ? 'all' : parseInt(e.target.value))}
              className="text-sm border border-gray-300 rounded-lg px-2 py-1.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
            >
              <option value="all">All Importance</option>
              <option value="5">★★★★★ Critical</option>
              <option value="4">★★★★☆ High</option>
              <option value="3">★★★☆☆ Medium</option>
              <option value="2">★★☆☆☆ Low</option>
              <option value="1">★☆☆☆☆ Nice-to-have</option>
            </select>

            {/* Complexity filter */}
            <select
              value={complexityFilter}
              onChange={(e) => setComplexityFilter(e.target.value as ComplexityType | 'all')}
              className="text-sm border border-gray-300 rounded-lg px-2 py-1.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
            >
              <option value="all">All Size</option>
              {Object.entries(COMPLEXITY_CONFIG).map(([key, config]) => (
                <option key={key} value={key}>{key} - {config.label}</option>
              ))}
            </select>

            {/* Sort separator */}
            <span className="hidden lg:block w-px h-5 bg-gray-300 mx-1" />

            {/* Sort dropdown */}
            <div className="flex items-center gap-1">
              <ArrowUpDown className="w-4 h-4 text-gray-400" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                className="text-sm border border-gray-300 rounded-lg px-2 py-1.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
              >
                <option value="importance">By Importance</option>
                <option value="updated_at">Last Modified</option>
                <option value="created_at">Date Created</option>
                <option value="title">Alphabetical</option>
              </select>
            </div>

            {/* Show Completed toggle */}
            <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer ml-2">
              <input
                type="checkbox"
                checked={showCompleted}
                onChange={(e) => setShowCompleted(e.target.checked)}
                className="w-4 h-4 text-green-600 bg-gray-100 border-gray-300 rounded focus:ring-green-500 focus:ring-2 cursor-pointer"
              />
              <span>Show Completed</span>
            </label>

            {/* Clear filters button - show when filters are active */}
            {activeFilterCount > 0 && (
              <button
                onClick={() => {
                  setStatusFilter('all');
                  setImportanceFilter('all');
                  setComplexityFilter('all');
                  setShowCompleted(false);
                }}
                className="text-xs text-gray-500 hover:text-gray-700 underline ml-2"
              >
                Clear filters
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Items list with drag and drop */}
      <div className="flex-1 overflow-auto">
        {filteredItems.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            {selectedHubs.size === 0 ? (
              <p>Select at least one hub from the sidebar</p>
            ) : searchQuery || statusFilter !== 'all' || importanceFilter !== 'all' || complexityFilter !== 'all' ? (
              <p>No items match your filters</p>
            ) : (
              <div className="space-y-4">
                <p>No roadmap items yet.</p>
                <button
                  onClick={() => setShowAddModal(true)}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Mic className="w-5 h-5" />
                  Record your first idea
                </button>
              </div>
            )}
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={filteredItems.map(i => i.id)} strategy={verticalListSortingStrategy}>
              <div className="space-y-3">
                {filteredItems.map((item) => (
                  <SortableItemCard
                    key={item.id}
                    item={item}
                    onOpen={() => setSelectedItem(item)}
                    isAdmin={isAdmin}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </div>

      {/* Add Modal */}
      {showAddModal && (
        <AddRoadmapItemModal
          onClose={() => setShowAddModal(false)}
          onSuccess={() => {
            setShowAddModal(false);
            onRefresh();
          }}
          selectedHubs={selectedHubs}
        />
      )}

      {/* Detail Modal */}
      {selectedItem && (
        <RoadmapItemModal
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
          onUpdate={() => {
            setSelectedItem(null);
            onRefresh();
          }}
          isAdmin={isAdmin}
        />
      )}
    </div>
  );
}
