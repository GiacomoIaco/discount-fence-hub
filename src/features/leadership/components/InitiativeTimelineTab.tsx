import { useState } from 'react';
import { Plus, ChevronDown, ChevronRight, Calendar, CheckSquare, Square, Clock, Filter, Eye, EyeOff, Archive, ArchiveRestore } from 'lucide-react';
import { useAreasQuery, useInitiativesByFunctionQuery, useInitiativeUpdatesQuery, useCreateInitiativeUpdate, useDeactivateInitiative, useActivateInitiative } from '../hooks/useLeadershipQuery';
import { useTasksQuery, useCreateTask, useUpdateTask } from '../hooks/useGoalsQuery';
import type { ProjectInitiative, InitiativeUpdate } from '../lib/leadership';
import type { Task } from '../lib/goals.types';
import { toast } from 'react-hot-toast';
import { getMondayOfWeek } from '../lib/leadership';

interface InitiativeTimelineTabProps {
  functionId: string;
}

type ActiveFilter = 'all' | 'active' | 'inactive';

export default function InitiativeTimelineTab({ functionId }: InitiativeTimelineTabProps) {
  const [collapsedAreas, setCollapsedAreas] = useState<Set<string>>(new Set());
  const [expandedInitiatives, setExpandedInitiatives] = useState<Set<string>>(new Set());
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>('active');
  const [addingUpdateTo, setAddingUpdateTo] = useState<string | null>(null);
  const [addingTaskTo, setAddingTaskTo] = useState<string | null>(null);
  const [selectedWeek, setSelectedWeek] = useState<Date>(getMondayOfWeek());

  const { data: areas } = useAreasQuery(functionId);
  const { data: allInitiatives } = useInitiativesByFunctionQuery(functionId);
  const createUpdate = useCreateInitiativeUpdate();
  const createTask = useCreateTask();
  const updateTask = useUpdateTask();
  const deactivateInitiative = useDeactivateInitiative();
  const activateInitiative = useActivateInitiative();

  // Filter initiatives by active status
  const initiatives = allInitiatives?.filter(initiative => {
    if (activeFilter === 'all') return true;
    if (activeFilter === 'active') return initiative.is_active !== false;
    if (activeFilter === 'inactive') return initiative.is_active === false;
    return true;
  }) || [];

  const toggleAreaCollapse = (areaId: string) => {
    setCollapsedAreas(prev => {
      const next = new Set(prev);
      if (next.has(areaId)) {
        next.delete(areaId);
      } else {
        next.add(areaId);
      }
      return next;
    });
  };

  const toggleInitiativeExpand = (initiativeId: string) => {
    setExpandedInitiatives(prev => {
      const next = new Set(prev);
      if (next.has(initiativeId)) {
        next.delete(initiativeId);
      } else {
        next.add(initiativeId);
      }
      return next;
    });
  };

  // Group initiatives by area
  const initiativesByArea = initiatives.reduce((acc, initiative) => {
    const areaId = initiative.area?.id || 'uncategorized';
    if (!acc[areaId]) {
      acc[areaId] = [];
    }
    acc[areaId].push(initiative);
    return acc;
  }, {} as Record<string, ProjectInitiative[]>);

  const handleAddUpdate = async (initiativeId: string, updateText: string) => {
    if (!updateText.trim()) return;

    try {
      await createUpdate.mutateAsync({
        initiative_id: initiativeId,
        update_text: updateText,
        week_start_date: selectedWeek.toISOString().split('T')[0],
      });
      setAddingUpdateTo(null);
      toast.success('Update added');
    } catch (error) {
      console.error('Failed to create update:', error);
      toast.error('Failed to add update');
    }
  };

  const handleAddTask = async (initiativeId: string, taskTitle: string) => {
    if (!taskTitle.trim()) return;

    try {
      await createTask.mutateAsync({
        initiative_id: initiativeId,
        title: taskTitle,
        status: 'todo',
      });
      setAddingTaskTo(null);
      toast.success('Task added');
    } catch (error) {
      console.error('Failed to create task:', error);
      toast.error('Failed to add task');
    }
  };

  const handleToggleTask = async (task: Task) => {
    try {
      await updateTask.mutateAsync({
        id: task.id,
        status: task.status === 'done' ? 'todo' : 'done',
        completed_at: task.status === 'done' ? null : new Date().toISOString(),
      });
    } catch (error) {
      console.error('Failed to update task:', error);
      toast.error('Failed to update task');
    }
  };

  const handleDeactivateInitiative = async (initiative: ProjectInitiative) => {
    if (!window.confirm(`Deactivate "${initiative.title}"? This will hide it from planning views.`)) {
      return;
    }

    try {
      await deactivateInitiative.mutateAsync(initiative.id);
      toast.success(`Deactivated "${initiative.title}"`);
    } catch (error) {
      console.error('Failed to deactivate initiative:', error);
      toast.error('Failed to deactivate initiative');
    }
  };

  const handleActivateInitiative = async (initiative: ProjectInitiative) => {
    try {
      await activateInitiative.mutateAsync(initiative.id);
      toast.success(`Activated "${initiative.title}"`);
    } catch (error) {
      console.error('Failed to activate initiative:', error);
      toast.error('Failed to activate initiative');
    }
  };

  const formatWeekRange = (date: Date) => {
    const monday = new Date(date);
    const sunday = new Date(date);
    sunday.setDate(sunday.getDate() + 6);

    return `${monday.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${sunday.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
  };

  if (!areas || areas.length === 0) {
    return (
      <div className="max-w-full mx-auto">
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <Calendar className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            No areas created yet
          </h3>
          <p className="text-gray-600">
            Create areas in the Annual Plan tab first to organize your initiatives
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-full mx-auto space-y-4">
      {/* Header with Filters */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-500" />
              <span className="text-sm font-medium text-gray-700">Show:</span>
              <div className="flex gap-1">
                <button
                  onClick={() => setActiveFilter('active')}
                  className={`px-3 py-1 text-sm rounded ${
                    activeFilter === 'active'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <Eye className="w-3 h-3 inline-block mr-1" />
                  Active
                </button>
                <button
                  onClick={() => setActiveFilter('inactive')}
                  className={`px-3 py-1 text-sm rounded ${
                    activeFilter === 'inactive'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <EyeOff className="w-3 h-3 inline-block mr-1" />
                  Inactive
                </button>
                <button
                  onClick={() => setActiveFilter('all')}
                  className={`px-3 py-1 text-sm rounded ${
                    activeFilter === 'all'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  All
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2 pl-4 border-l border-gray-300">
              <Calendar className="w-4 h-4 text-gray-500" />
              <span className="text-sm font-medium text-gray-700">Week of:</span>
              <input
                type="date"
                value={selectedWeek.toISOString().split('T')[0]}
                onChange={(e) => setSelectedWeek(getMondayOfWeek(new Date(e.target.value)))}
                className="px-2 py-1 text-sm border border-gray-300 rounded"
              />
              <span className="text-sm text-gray-600">({formatWeekRange(selectedWeek)})</span>
            </div>
          </div>
        </div>

        <p className="text-sm text-gray-600 mt-2">
          Track ongoing work with tasks and weekly updates. Tasks are operational to-dos, updates are progress narratives.
        </p>
      </div>

      {/* Areas and Initiatives */}
      {areas.map((area) => {
        const areaInitiatives = initiativesByArea[area.id] || [];
        const isCollapsed = collapsedAreas.has(area.id);

        // Skip areas with no initiatives based on current filter
        if (areaInitiatives.length === 0) return null;

        return (
          <div key={area.id} className="bg-white rounded-lg border border-gray-200">
            {/* Area Header */}
            <div
              className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-200 cursor-pointer hover:bg-gray-100"
              onClick={() => toggleAreaCollapse(area.id)}
            >
              <div className="flex items-center gap-2">
                {isCollapsed ? (
                  <ChevronRight className="w-4 h-4 text-gray-500" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-gray-500" />
                )}
                <h3 className="text-base font-semibold text-gray-900">{area.name}</h3>
                <span className="text-sm text-gray-500">
                  ({areaInitiatives.length} initiative{areaInitiatives.length !== 1 ? 's' : ''})
                </span>
              </div>
            </div>

            {/* Initiatives */}
            {!isCollapsed && (
              <div className="divide-y divide-gray-200">
                {areaInitiatives.map((initiative) => {
                  const isExpanded = expandedInitiatives.has(initiative.id);

                  return (
                    <InitiativeRow
                      key={initiative.id}
                      initiative={initiative}
                      isExpanded={isExpanded}
                      onToggleExpand={() => toggleInitiativeExpand(initiative.id)}
                      selectedWeek={selectedWeek}
                      addingUpdateTo={addingUpdateTo}
                      setAddingUpdateTo={setAddingUpdateTo}
                      addingTaskTo={addingTaskTo}
                      setAddingTaskTo={setAddingTaskTo}
                      onAddUpdate={handleAddUpdate}
                      onAddTask={handleAddTask}
                      onToggleTask={handleToggleTask}
                      onDeactivate={handleDeactivateInitiative}
                      onActivate={handleActivateInitiative}
                    />
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// Separate component for each initiative row
interface InitiativeRowProps {
  initiative: ProjectInitiative;
  isExpanded: boolean;
  onToggleExpand: () => void;
  selectedWeek: Date;
  addingUpdateTo: string | null;
  setAddingUpdateTo: (id: string | null) => void;
  addingTaskTo: string | null;
  setAddingTaskTo: (id: string | null) => void;
  onAddUpdate: (initiativeId: string, updateText: string) => void;
  onAddTask: (initiativeId: string, taskTitle: string) => void;
  onToggleTask: (task: Task) => void;
  onDeactivate: (initiative: ProjectInitiative) => void;
  onActivate: (initiative: ProjectInitiative) => void;
}

function InitiativeRow({
  initiative,
  isExpanded,
  onToggleExpand,
  selectedWeek,
  addingUpdateTo,
  setAddingUpdateTo,
  addingTaskTo,
  setAddingTaskTo,
  onAddUpdate,
  onAddTask,
  onToggleTask,
  onDeactivate,
  onActivate,
}: InitiativeRowProps) {
  const { data: tasks } = useTasksQuery(initiative.id);
  const { data: updates } = useInitiativeUpdatesQuery(initiative.id);

  // Filter updates for selected week (optional)
  const weekUpdates = updates?.filter(update => {
    const updateDate = new Date(update.week_start_date);
    return updateDate.getTime() === selectedWeek.getTime();
  }) || [];

  const activeTasks = tasks?.filter(t => t.status !== 'done') || [];
  const completedTasks = tasks?.filter(t => t.status === 'done') || [];

  return (
    <div className="p-4">
      <div className="flex items-center justify-between group">
        <div
          className="flex items-center gap-2 flex-1 cursor-pointer"
          onClick={onToggleExpand}
        >
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 text-gray-400" />
          ) : (
            <ChevronRight className="w-4 h-4 text-gray-400" />
          )}
          <h4 className="text-base font-semibold text-gray-900">{initiative.title}</h4>
          {!initiative.is_active && (
            <span className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded">Inactive</span>
          )}
        </div>
        {initiative.is_active ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDeactivate(initiative);
            }}
            className="flex items-center gap-1 px-2 py-1 text-xs text-orange-600 hover:bg-orange-50 rounded transition-colors"
            title="Deactivate initiative"
          >
            <Archive className="w-3 h-3" />
            Deactivate
          </button>
        ) : (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onActivate(initiative);
            }}
            className="flex items-center gap-1 px-2 py-1 text-xs text-green-600 hover:bg-green-50 rounded transition-colors"
            title="Activate initiative"
          >
            <ArchiveRestore className="w-3 h-3" />
            Activate
          </button>
        )}
      </div>

        <div className="flex items-center gap-4 text-sm text-gray-600">
          <span className="flex items-center gap-1">
            <CheckSquare className="w-4 h-4" />
            {activeTasks.length} task{activeTasks.length !== 1 ? 's' : ''}
          </span>
          <span className="flex items-center gap-1">
            <Clock className="w-4 h-4" />
            {weekUpdates.length} update{weekUpdates.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {isExpanded && (
        <div className="mt-4 ml-6 space-y-4">
          {/* Tasks Section */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h5 className="text-sm font-semibold text-gray-700">Tasks</h5>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setAddingTaskTo(initiative.id);
                }}
                className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
              >
                <Plus className="w-3 h-3" />
                Add Task
              </button>
            </div>

            <div className="space-y-1">
              {activeTasks.map((task) => (
                <div key={task.id} className="flex items-center gap-2 py-1">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleTask(task);
                    }}
                    className="text-gray-400 hover:text-blue-600"
                  >
                    <Square className="w-4 h-4" />
                  </button>
                  <span className="text-sm text-gray-700">{task.title}</span>
                </div>
              ))}

              {completedTasks.length > 0 && (
                <details className="mt-2">
                  <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-700">
                    {completedTasks.length} completed task{completedTasks.length !== 1 ? 's' : ''}
                  </summary>
                  <div className="ml-4 mt-1 space-y-1">
                    {completedTasks.map((task) => (
                      <div key={task.id} className="flex items-center gap-2 py-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onToggleTask(task);
                          }}
                          className="text-green-600 hover:text-gray-400"
                        >
                          <CheckSquare className="w-4 h-4" />
                        </button>
                        <span className="text-sm text-gray-500 line-through">{task.title}</span>
                      </div>
                    ))}
                  </div>
                </details>
              )}

              {addingTaskTo === initiative.id && (
                <div className="flex items-center gap-2 py-1">
                  <Square className="w-4 h-4 text-gray-300" />
                  <input
                    autoFocus
                    type="text"
                    placeholder="Task title..."
                    onBlur={(e) => {
                      if (e.target.value.trim()) {
                        onAddTask(initiative.id, e.target.value);
                      } else {
                        setAddingTaskTo(null);
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') setAddingTaskTo(null);
                      if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                        onAddTask(initiative.id, e.currentTarget.value);
                      }
                    }}
                    className="flex-1 text-sm px-2 py-1 border border-blue-300 rounded focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}

              {activeTasks.length === 0 && addingTaskTo !== initiative.id && (
                <p className="text-sm text-gray-400 italic py-1">No active tasks</p>
              )}
            </div>
          </div>

          {/* Updates Timeline Section */}
          <div className="border-t border-gray-200 pt-4">
            <div className="flex items-center justify-between mb-2">
              <h5 className="text-sm font-semibold text-gray-700">Weekly Updates</h5>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setAddingUpdateTo(initiative.id);
                }}
                className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
              >
                <Plus className="w-3 h-3" />
                Add Update
              </button>
            </div>

            <div className="space-y-2">
              {updates?.slice(0, 5).map((update) => (
                <div key={update.id} className="border-l-2 border-blue-200 pl-3 py-1">
                  <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
                    <Calendar className="w-3 h-3" />
                    <span>Week of {new Date(update.week_start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                    {update.author && <span>• {update.author.full_name}</span>}
                  </div>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{update.update_text}</p>
                </div>
              ))}

              {addingUpdateTo === initiative.id && (
                <div className="border-l-2 border-blue-400 pl-3 py-1">
                  <textarea
                    autoFocus
                    placeholder="What progress was made this week?"
                    onBlur={(e) => {
                      if (e.target.value.trim()) {
                        onAddUpdate(initiative.id, e.target.value);
                      } else {
                        setAddingUpdateTo(null);
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') setAddingUpdateTo(null);
                    }}
                    className="w-full text-sm px-2 py-1 border border-blue-300 rounded focus:ring-2 focus:ring-blue-500"
                    rows={3}
                  />
                </div>
              )}

              {(!updates || updates.length === 0) && addingUpdateTo !== initiative.id && (
                <p className="text-sm text-gray-400 italic py-1">No updates yet</p>
              )}

              {updates && updates.length > 5 && (
                <p className="text-xs text-gray-500 italic">
                  Showing 5 most recent. Total: {updates.length} updates.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
