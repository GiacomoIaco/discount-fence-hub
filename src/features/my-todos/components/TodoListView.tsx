import { useState, useMemo, useCallback, type Dispatch, type SetStateAction } from 'react';
import { Plus, ChevronDown, ChevronRight, Pencil, Trash2, Settings, Users, Archive, GripVertical } from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useTodoListsQuery } from '../hooks/useTodoLists';
import { useTodoSectionsQuery, useCreateTodoSection, useUpdateTodoSection, useDeleteTodoSection, useReorderTodoSections } from '../hooks/useTodoSections';
import {
  useTodoItemsQuery,
  useUpdateTodoItemStatus,
  useUpdateTodoItem,
  useDeleteTodoItem,
  useReorderTodoItems,
  useTodoLastCommentsQuery,
} from '../hooks/useTodoItems';
import { setTaskViewed } from '../hooks/useMyTodos';
import { SortableTaskRow, MobileTaskCard } from './SortableTaskRow';
import { InlineCommentPopup, SectionColorPicker, EmptyState, QuickAddTask, MobileQuickAddTask } from './InlineEditors';
import TaskDetailModal from './TaskDetailModal';
import { getSectionColor } from '../utils/todoHelpers';
import type { TodoItem, TodoSection } from '../types';

interface TodoListViewProps {
  listId: string;
  onEditList: () => void;
  onManageMembers: () => void;
  onArchiveList: () => void;
}

export default function TodoListView({ listId, onEditList, onManageMembers, onArchiveList }: TodoListViewProps) {
  const { data: lists } = useTodoListsQuery();
  const { data: sections } = useTodoSectionsQuery(listId);
  const { data: items } = useTodoItemsQuery(listId);

  const list = lists?.find(l => l.id === listId);

  // Collect item IDs for last comments query
  const itemIds = useMemo(() => (items || []).map(i => i.id), [items]);
  const { data: lastComments } = useTodoLastCommentsQuery(itemIds);

  // State
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
  const [addingTaskInSection, setAddingTaskInSection] = useState<string | null>(null);
  const [addingSectionTitle, setAddingSectionTitle] = useState('');
  const [showAddSection, setShowAddSection] = useState(false);
  const [commentPopup, setCommentPopup] = useState<{
    taskId: string;
    taskTitle: string;
    position: { top: number; left: number };
  } | null>(null);
  const [showListMenu, setShowListMenu] = useState(false);

  // Mutations
  const updateStatus = useUpdateTodoItemStatus();
  const updateItem = useUpdateTodoItem();
  const deleteItem = useDeleteTodoItem();
  const reorderItems = useReorderTodoItems();
  const createSection = useCreateTodoSection();
  const updateSection = useUpdateTodoSection();
  const deleteSection = useDeleteTodoSection();
  const reorderSections = useReorderTodoSections();

  // Drag sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // Group items by section
  const itemsBySection = useMemo(() => {
    const map: Record<string, TodoItem[]> = {};
    (sections || []).forEach(s => { map[s.id] = []; });
    (items || []).forEach(item => {
      if (map[item.section_id]) {
        map[item.section_id].push(item);
      }
    });
    // Sort each section's items by sort_order
    Object.values(map).forEach(arr => arr.sort((a, b) => a.sort_order - b.sort_order));
    return map;
  }, [items, sections]);

  const toggleSection = useCallback((sectionId: string) => {
    setCollapsedSections(prev => {
      const next = new Set(prev);
      if (next.has(sectionId)) next.delete(sectionId);
      else next.add(sectionId);
      return next;
    });
  }, []);

  const handleItemDragEnd = useCallback((event: DragEndEvent, sectionId: string) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const sectionItems = itemsBySection[sectionId] || [];
    const oldIndex = sectionItems.findIndex(i => i.id === active.id);
    const newIndex = sectionItems.findIndex(i => i.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(sectionItems, oldIndex, newIndex);
    const updates = reordered.map((item, idx) => ({
      id: item.id,
      sort_order: idx,
    }));

    reorderItems.mutate({ listId, items: updates });
  }, [itemsBySection, listId, reorderItems]);

  const handleSectionDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id || !sections) return;

    const oldIndex = sections.findIndex(s => s.id === active.id);
    const newIndex = sections.findIndex(s => s.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(sections, oldIndex, newIndex);
    const updates = reordered.map((s, idx) => ({
      id: s.id,
      sort_order: idx,
    }));

    reorderSections.mutate({ listId, sections: updates });
  }, [sections, listId, reorderSections]);

  const handleStatusChange = useCallback(async (taskId: string, status: string) => {
    await updateStatus.mutateAsync({ id: taskId, status, listId });
  }, [updateStatus, listId]);

  const handleUpdateField = useCallback(async (params: { id: string; field: string; value: any }) => {
    await updateItem.mutateAsync({
      id: params.id,
      listId,
      [params.field]: params.value,
    });
  }, [updateItem, listId]);

  const handleDeleteTask = useCallback(async (taskId: string) => {
    if (!window.confirm('Delete this task?')) return;
    await deleteItem.mutateAsync({ id: taskId, listId });
  }, [deleteItem, listId]);

  const handleAddSection = async () => {
    if (!addingSectionTitle.trim()) {
      setShowAddSection(false);
      return;
    }
    await createSection.mutateAsync({
      listId,
      title: addingSectionTitle.trim(),
    });
    setAddingSectionTitle('');
    setShowAddSection(false);
  };

  const handleDeleteSection = async (sectionId: string, sectionTitle: string) => {
    const sectionItems = itemsBySection[sectionId] || [];
    if (sectionItems.length > 0) {
      if (!window.confirm(`Delete "${sectionTitle}" and its ${sectionItems.length} task(s)?`)) return;
    }
    await deleteSection.mutateAsync({ id: sectionId, listId });
  };

  if (!list) {
    return <div className="p-8 text-center text-gray-500">List not found</div>;
  }

  return (
    <div className="p-4 md:p-6">
      {/* List Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{list.title}</h1>
          {list.description && <p className="text-sm text-gray-500 mt-1">{list.description}</p>}
        </div>
        <div className="relative">
          <button
            onClick={() => setShowListMenu(!showListMenu)}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <Settings className="w-5 h-5 text-gray-500" />
          </button>
          {showListMenu && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowListMenu(false)} />
              <div className="absolute right-0 top-full mt-1 z-50 w-48 bg-white border border-gray-200 rounded-lg shadow-lg py-1">
                <button
                  onClick={() => { setShowListMenu(false); onEditList(); }}
                  className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                >
                  <Pencil className="w-4 h-4" /> Edit List
                </button>
                {list.visibility === 'private' && (
                  <button
                    onClick={() => { setShowListMenu(false); onManageMembers(); }}
                    className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                  >
                    <Users className="w-4 h-4" /> Manage Members
                  </button>
                )}
                <button
                  onClick={() => { setShowListMenu(false); onArchiveList(); }}
                  className="w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                >
                  <Archive className="w-4 h-4" /> Archive List
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Sections + Tasks */}
      <div className="space-y-4">
        {(!sections || sections.length === 0) ? (
          <EmptyState message="No sections yet. Add a section to get started." />
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleSectionDragEnd}
          >
            <SortableContext
              items={sections.map(s => s.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-4">
                {sections.map(section => (
                  <SortableSectionBlock
                    key={section.id}
                    section={section}
                    sectionItems={itemsBySection[section.id] || []}
                    isCollapsed={collapsedSections.has(section.id)}
                    listId={listId}
                    allSections={sections}
                    lastComments={lastComments}
                    addingTaskInSection={addingTaskInSection}
                    sensors={sensors}
                    onToggleSection={toggleSection}
                    onDragEnd={handleItemDragEnd}
                    onStatusChange={handleStatusChange}
                    onUpdateField={handleUpdateField}
                    onDeleteTask={handleDeleteTask}
                    onDeleteSection={handleDeleteSection}
                    onSetAddingTask={setAddingTaskInSection}
                    onOpenTask={(itemId) => {
                      setTaskViewed(itemId);
                      setSelectedTaskId(itemId);
                    }}
                    onOpenCommentPopup={(taskId, taskTitle, position) => {
                      setCommentPopup({ taskId, taskTitle, position });
                    }}
                    updateSection={updateSection}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}

        {/* Add Section — always visible */}
        {showAddSection ? (
          <div className="flex items-center gap-2 p-3 border border-dashed border-gray-300 rounded-lg">
            <input
              type="text"
              value={addingSectionTitle}
              onChange={(e) => setAddingSectionTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAddSection();
                if (e.key === 'Escape') { setShowAddSection(false); setAddingSectionTitle(''); }
              }}
              placeholder="Section title..."
              className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              autoFocus
            />
            <button
              onClick={handleAddSection}
              disabled={createSection.isPending}
              className="px-3 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
              Add
            </button>
            <button
              onClick={() => { setShowAddSection(false); setAddingSectionTitle(''); }}
              className="px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShowAddSection(true)}
            className="w-full px-4 py-3 text-sm text-gray-400 hover:text-blue-600 hover:bg-blue-50 border border-dashed border-gray-300 rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Section
          </button>
        )}
      </div>

      {/* Task Detail Modal */}
      {selectedTaskId && (
        <TaskDetailModal
          taskId={selectedTaskId}
          listId={listId}
          onClose={() => setSelectedTaskId(null)}
        />
      )}

      {/* Comment Popup */}
      {commentPopup && (
        <InlineCommentPopup
          taskId={commentPopup.taskId}
          taskTitle={commentPopup.taskTitle}
          lastComment={lastComments?.[commentPopup.taskId] || null}
          onClose={() => setCommentPopup(null)}
          position={commentPopup.position}
        />
      )}
    </div>
  );
}

// Sortable wrapper for SectionBlock
function SortableSectionBlock(props: SectionBlockProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: props.section.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : undefined,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <SectionBlock {...props} dragListeners={listeners} />
    </div>
  );
}

// Props type shared between SortableSectionBlock and SectionBlock
interface SectionBlockProps {
  section: TodoSection;
  sectionItems: TodoItem[];
  isCollapsed: boolean;
  listId: string;
  allSections: TodoSection[];
  lastComments: Record<string, any> | undefined;
  addingTaskInSection: string | null;
  sensors: ReturnType<typeof useSensors>;
  onToggleSection: (sectionId: string) => void;
  onDragEnd: (event: DragEndEvent, sectionId: string) => void;
  onStatusChange: (taskId: string, status: string) => Promise<void>;
  onUpdateField: (params: { id: string; field: string; value: any }) => Promise<any>;
  onDeleteTask: (taskId: string) => Promise<void>;
  onDeleteSection: (sectionId: string, title: string) => Promise<void>;
  onSetAddingTask: Dispatch<SetStateAction<string | null>>;
  onOpenTask: (itemId: string) => void;
  onOpenCommentPopup: (taskId: string, taskTitle: string, position: { top: number; left: number }) => void;
  updateSection: ReturnType<typeof useUpdateTodoSection>;
  dragListeners?: Record<string, any>;
}

// Extracted section component to avoid useState in .map()
function SectionBlock({
  section,
  sectionItems,
  isCollapsed,
  listId,
  allSections,
  lastComments,
  addingTaskInSection,
  sensors,
  onToggleSection,
  onDragEnd,
  onStatusChange,
  onUpdateField,
  onDeleteTask,
  onDeleteSection,
  onSetAddingTask,
  onOpenTask,
  onOpenCommentPopup,
  updateSection,
  dragListeners,
}: SectionBlockProps) {
  const [editingSectionName, setEditingSectionName] = useState<string | null>(null);
  const sectionColor = getSectionColor(section.color);

  return (
    <div className="rounded-lg overflow-hidden border border-gray-200">
      {/* Section Header */}
      <div
        className={`${sectionColor.bg} px-4 py-3 flex items-center gap-3 cursor-pointer`}
        onClick={() => onToggleSection(section.id)}
      >
        {/* Drag handle for section reorder */}
        <div
          className="cursor-grab active:cursor-grabbing text-white/60 hover:text-white/90 -ml-1"
          onClick={(e) => e.stopPropagation()}
          {...dragListeners}
        >
          <GripVertical className="w-4 h-4" />
        </div>

        {isCollapsed ? (
          <ChevronRight className="w-4 h-4 text-white/80" />
        ) : (
          <ChevronDown className="w-4 h-4 text-white/80" />
        )}

        {editingSectionName !== null ? (
          <input
            type="text"
            value={editingSectionName}
            onChange={(e) => setEditingSectionName(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            onBlur={async () => {
              if (editingSectionName.trim() && editingSectionName !== section.title) {
                await updateSection.mutateAsync({ id: section.id, listId, title: editingSectionName.trim() });
              }
              setEditingSectionName(null);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
              if (e.key === 'Escape') setEditingSectionName(null);
            }}
            className="bg-white/20 text-white placeholder-white/60 px-2 py-0.5 rounded text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-white/50"
            autoFocus
          />
        ) : (
          <span className="text-white font-semibold text-sm flex-1">
            {section.title}
            <span className="ml-2 text-white/70 font-normal">({sectionItems.length})</span>
          </span>
        )}

        <div className="flex items-center gap-1 ml-auto" onClick={(e) => e.stopPropagation()}>
          <SectionColorPicker
            sectionId={section.id}
            listId={listId}
            currentColor={section.color}
          />
          <button
            onClick={() => setEditingSectionName(section.title)}
            className="p-1 text-white/70 hover:text-white hover:bg-white/20 rounded transition-colors"
            title="Rename section"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onDeleteSection(section.id, section.title)}
            className="p-1 text-white/70 hover:text-white hover:bg-white/20 rounded transition-colors"
            title="Delete section"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Section Items */}
      {!isCollapsed && (
        <div className="bg-white">
          {sectionItems.length > 0 ? (
            <>
              {/* Desktop: Table layout */}
              <div className="hidden md:block">
                <table className="w-full">
                  <thead>
                    <tr className="text-xs text-gray-500 uppercase border-b border-gray-200">
                      <th className="px-4 py-2 text-left font-medium">Task</th>
                      <th className="px-4 py-2 text-left font-medium w-24">Assigned</th>
                      <th className="px-4 py-2 text-left font-medium w-28">Status</th>
                      <th className="px-4 py-2 text-left font-medium w-24">Due</th>
                      <th className="px-4 py-2 text-left font-medium w-28">Notes</th>
                      <th className="px-4 py-2 text-left font-medium w-40">Comment</th>
                      <th className="px-4 py-2 text-center font-medium w-20">Actions</th>
                    </tr>
                  </thead>
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={(e) => onDragEnd(e, section.id)}
                  >
                    <SortableContext
                      items={sectionItems.map(i => i.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      <tbody>
                        {sectionItems.map((item, idx) => (
                          <SortableTaskRow
                            key={item.id}
                            task={item}
                            idx={idx}
                            listId={listId}
                            sections={allSections}
                            lastComment={lastComments?.[item.id] || null}
                            onOpenTask={() => onOpenTask(item.id)}
                            onOpenCommentPopup={onOpenCommentPopup}
                            onStatusChange={onStatusChange}
                            onUpdateField={onUpdateField}
                            onDeleteTask={onDeleteTask}
                          />
                        ))}
                      </tbody>
                    </SortableContext>
                  </DndContext>
                </table>
              </div>

              {/* Mobile: Card layout */}
              <div className="md:hidden">
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={(e) => onDragEnd(e, section.id)}
                >
                  <SortableContext
                    items={sectionItems.map(i => i.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="divide-y divide-gray-100">
                      {sectionItems.map((item, idx) => (
                        <MobileTaskCard
                          key={item.id}
                          task={item}
                          idx={idx}
                          listId={listId}
                          sections={allSections}
                          lastComment={lastComments?.[item.id] || null}
                          onOpenTask={() => onOpenTask(item.id)}
                          onOpenCommentPopup={onOpenCommentPopup}
                          onStatusChange={onStatusChange}
                          onUpdateField={onUpdateField}
                          onDeleteTask={onDeleteTask}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              </div>
            </>
          ) : null}

          {/* Quick Add Task */}
          {addingTaskInSection === section.id ? (
            <>
              {/* Desktop quick-add */}
              <div className="hidden md:block">
                <table className="w-full">
                  <tbody>
                    <QuickAddTask
                      sectionId={section.id}
                      listId={listId}
                      onCancel={() => onSetAddingTask(null)}
                      onSuccess={() => onSetAddingTask(null)}
                    />
                  </tbody>
                </table>
              </div>
              {/* Mobile quick-add */}
              <div className="md:hidden">
                <MobileQuickAddTask
                  sectionId={section.id}
                  listId={listId}
                  onCancel={() => onSetAddingTask(null)}
                  onSuccess={() => onSetAddingTask(null)}
                />
              </div>
            </>
          ) : (
            <button
              onClick={() => onSetAddingTask(section.id)}
              className="w-full px-4 py-2 text-left text-sm text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Add task
            </button>
          )}
        </div>
      )}
    </div>
  );
}
