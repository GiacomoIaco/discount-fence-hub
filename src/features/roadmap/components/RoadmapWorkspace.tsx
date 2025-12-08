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
  Plus,
  Search,
  Filter,
  RefreshCw,
  User,
  Mic
} from 'lucide-react';
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
      {/* Desktop: Two-column layout */}
      <div className="flex gap-4">
        {/* Left side - Main info */}
        <div className="flex items-start gap-3 flex-1 min-w-0">
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
        <div className="hidden lg:block w-1/3 border-l border-gray-100 pl-4">
          {hasDescription ? (
            <div className="text-sm text-gray-600 max-h-24 overflow-y-auto">
              {item.raw_idea && (
                <p className="line-clamp-3">{item.raw_idea}</p>
              )}
              {item.claude_analysis && (
                <p className="text-xs text-blue-600 mt-1 line-clamp-2">
                  AI: {item.claude_analysis}
                </p>
              )}
            </div>
          ) : (
            <p className="text-xs text-gray-400 italic">No description</p>
          )}
        </div>
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
  const [statusFilter, setStatusFilter] = useState<StatusType | 'all'>('all');
  const [importanceFilter, setImportanceFilter] = useState<number | 'all'>('all');
  const [complexityFilter, setComplexityFilter] = useState<ComplexityType | 'all'>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<RoadmapItem | null>(null);

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
  });

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center h-full">
        <RefreshCw className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 h-full flex flex-col">
      {/* Toolbar */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 mb-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 flex-1 w-full lg:w-auto">
          {/* Search */}
          <div className="relative flex-1 w-full sm:max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search items..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Filters row */}
          <div className="flex flex-wrap items-center gap-2">
            <Filter className="w-4 h-4 text-gray-400 hidden sm:block" />

            {/* Status filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusType | 'all')}
              className="text-sm border border-gray-300 rounded-lg px-2 py-1.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
              className="text-sm border border-gray-300 rounded-lg px-2 py-1.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
              className="text-sm border border-gray-300 rounded-lg px-2 py-1.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">All Size</option>
              {Object.entries(COMPLEXITY_CONFIG).map(([key, config]) => (
                <option key={key} value={key}>{key} - {config.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
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
