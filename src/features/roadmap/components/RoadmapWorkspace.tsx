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
  RefreshCw
} from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { HUB_CONFIG, type HubKey } from '../RoadmapHub';
import { STATUS_CONFIG, COMPLEXITY_CONFIG, type RoadmapItem, type StatusType } from '../types';
import RoadmapItemModal from './RoadmapItemModal';
import AddRoadmapItemModal from './AddRoadmapItemModal';

interface RoadmapWorkspaceProps {
  items: RoadmapItem[];
  loading: boolean;
  onRefresh: () => void;
  selectedHubs: Set<HubKey>;
}

// Sortable item card
function SortableItemCard({
  item,
  onOpen,
}: {
  item: RoadmapItem;
  onOpen: () => void;
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

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`bg-white rounded-lg border p-4 transition-all ${
        isDragging ? 'shadow-lg ring-2 ring-blue-500' : 'hover:shadow-md'
      } ${hubConfig?.border || 'border-gray-200'}`}
    >
      <div className="flex items-start gap-3">
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
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              {/* Code and Title */}
              <div className="flex items-center gap-2 mb-1">
                <span className={`text-xs font-mono px-1.5 py-0.5 rounded ${hubConfig?.bgLight || 'bg-gray-100'} ${hubConfig?.textColor || 'text-gray-600'}`}>
                  {item.code}
                </span>
                <h3 className="font-medium text-gray-900 truncate cursor-pointer hover:text-blue-600" onClick={onOpen}>
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
                    Importance: <span className="font-medium">{'★'.repeat(item.importance)}</span>
                  </span>
                )}

                {/* Complexity */}
                {item.complexity && (
                  <span className={`text-xs ${COMPLEXITY_CONFIG[item.complexity].color}`}>
                    {item.complexity}
                  </span>
                )}

                {/* Hub label */}
                <span className={`text-xs ${hubConfig?.textColor || 'text-gray-500'}`}>
                  {hubConfig?.label || item.hub}
                </span>
              </div>
            </div>

            {/* Expand button */}
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
            >
              {isExpanded ? (
                <ChevronDown className="w-5 h-5" />
              ) : (
                <ChevronRight className="w-5 h-5" />
              )}
            </button>
          </div>

          {/* Expanded content */}
          {isExpanded && (
            <div className="mt-3 pt-3 border-t border-gray-100 space-y-2">
              {item.raw_idea && (
                <div>
                  <div className="text-xs text-gray-500 mb-1">Raw Idea:</div>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{item.raw_idea}</p>
                </div>
              )}
              {item.claude_analysis && (
                <div>
                  <div className="text-xs text-gray-500 mb-1">Claude Analysis:</div>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{item.claude_analysis}</p>
                </div>
              )}
              {item.completed_at && (
                <div className="text-xs text-gray-500">
                  Completed: {new Date(item.completed_at).toLocaleDateString()}
                </div>
              )}
            </div>
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
}: RoadmapWorkspaceProps) {
  const [localItems, setLocalItems] = useState<RoadmapItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusType | 'all'>('all');
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
    <div className="p-6 h-full flex flex-col">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-4 flex-1">
          {/* Search */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search items..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Status filter */}
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusType | 'all')}
              className="text-sm border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">All Statuses</option>
              {Object.entries(STATUS_CONFIG).map(([key, config]) => (
                <option key={key} value={key}>{config.label}</option>
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
            Add Idea
          </button>
        </div>
      </div>

      {/* Items list with drag and drop */}
      <div className="flex-1 overflow-auto">
        {filteredItems.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            {selectedHubs.size === 0 ? (
              <p>Select at least one hub from the sidebar</p>
            ) : searchQuery || statusFilter !== 'all' ? (
              <p>No items match your filters</p>
            ) : (
              <p>No roadmap items yet. Click "Add Idea" to get started!</p>
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
        />
      )}
    </div>
  );
}
