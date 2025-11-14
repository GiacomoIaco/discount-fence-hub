import { useState } from 'react';
import { Plus, ChevronDown, ChevronRight, FolderOpen, Target, Trash2, CheckCircle2, Circle, AlertCircle, Archive, ArchiveRestore } from 'lucide-react';
import {
  useAreasQuery,
  useInitiativesByFunctionQuery,
  useUpdateArea,
  useUpdateInitiative,
  useDeleteArea,
  useDeactivateArea,
  useActivateArea,
  useDeactivateInitiative,
  useActivateInitiative,
  useAllAnnualActionsByFunctionQuery,
  useAllAnnualTargetsByFunctionQuery,
  useCreateAnnualAction,
  useUpdateAnnualAction,
  useDeleteAnnualAction,
  useCreateAnnualTarget,
  useUpdateAnnualTarget,
  useDeleteAnnualTarget,
} from '../../hooks/useLeadershipQuery';
import type { ProjectArea, ProjectInitiative, InitiativeAnnualAction, InitiativeAnnualTarget, ActionStatus, Assessment } from '../../lib/leadership';
import AreaManagementModal from '../AreaManagementModal';
import InitiativeDetailModal from '../InitiativeDetailModal';
import CopyYearButton from '../CopyYearButton';
import { toast } from 'react-hot-toast';

interface AnnualPlanTabProps {
  functionId: string;
  year: number;
}

export default function AnnualPlanTab({ functionId, year }: AnnualPlanTabProps) {
  const { data: areas } = useAreasQuery(functionId);
  const { data: initiatives } = useInitiativesByFunctionQuery(functionId);
  const { data: actionsByInitiative } = useAllAnnualActionsByFunctionQuery(functionId, year);
  const { data: targetsByInitiative } = useAllAnnualTargetsByFunctionQuery(functionId, year);

  const [collapsedStrategicDesc, setCollapsedStrategicDesc] = useState<Set<string>>(new Set(areas?.map(a => a.id) || []));
  const [editingField, setEditingField] = useState<{ type: 'strategic_desc' | 'title'; id: string } | null>(null);
  const [showAreaModal, setShowAreaModal] = useState(false);
  const [showInitiativeModal, setShowInitiativeModal] = useState<{ areaId?: string } | null>(null);
  const [addingAction, setAddingAction] = useState<string | null>(null);
  const [addingTarget, setAddingTarget] = useState<string | null>(null);
  const [editingAction, setEditingAction] = useState<string | null>(null);
  const [editingTarget, setEditingTarget] = useState<string | null>(null);

  const updateArea = useUpdateArea();
  const updateInitiative = useUpdateInitiative();
  const deleteArea = useDeleteArea();
  const deactivateArea = useDeactivateArea();
  const activateArea = useActivateArea();
  const deactivateInitiative = useDeactivateInitiative();
  const activateInitiative = useActivateInitiative();
  const createAction = useCreateAnnualAction();
  const updateAction = useUpdateAnnualAction();
  const deleteAction = useDeleteAnnualAction();
  const createTarget = useCreateAnnualTarget();
  const updateTarget = useUpdateAnnualTarget();
  const deleteTarget = useDeleteAnnualTarget();

  const toggleStrategicDesc = (areaId: string) => {
    setCollapsedStrategicDesc(prev => {
      const next = new Set(prev);
      if (next.has(areaId)) {
        next.delete(areaId);
      } else {
        next.add(areaId);
      }
      return next;
    });
  };

  const handleSaveStrategicDescription = async (area: ProjectArea, newDescription: string) => {
    try {
      await updateArea.mutateAsync({
        id: area.id,
        strategic_description: newDescription || undefined,
      });
      setEditingField(null);
    } catch (error) {
      console.error('Failed to update strategic description:', error);
    }
  };

  const handleSaveInitiativeTitle = async (initiative: ProjectInitiative, newTitle: string) => {
    try {
      await updateInitiative.mutateAsync({
        id: initiative.id,
        title: newTitle,
      });
      setEditingField(null);
    } catch (error) {
      console.error('Failed to update title:', error);
    }
  };

  const handleDeleteArea = async (area: ProjectArea, initiativesCount: number) => {
    const confirmMessage = initiativesCount > 0
      ? `Are you sure you want to delete "${area.name}"? This will also delete ${initiativesCount} initiative${initiativesCount !== 1 ? 's' : ''} and all their data.`
      : `Are you sure you want to delete "${area.name}"?`;

    if (!window.confirm(confirmMessage)) {
      return;
    }

    try {
      await deleteArea.mutateAsync(area.id);
      toast.success(`Deleted "${area.name}" successfully`);
    } catch (error) {
      console.error('Failed to delete area:', error);
      toast.error('Failed to delete area');
    }
  };

  const handleDeactivateArea = async (area: ProjectArea) => {
    if (!window.confirm(`Deactivate "${area.name}"? This will hide it from planning views.`)) {
      return;
    }

    try {
      await deactivateArea.mutateAsync(area.id);
      toast.success(`Deactivated "${area.name}"`);
    } catch (error: any) {
      console.error('Failed to deactivate area:', error);
      // Show specific error message about active initiatives
      if (error.message?.includes('some initiatives are still active')) {
        toast.error('Cannot deactivate area: some initiatives are still active');
      } else {
        toast.error('Failed to deactivate area');
      }
    }
  };

  const handleActivateArea = async (area: ProjectArea) => {
    try {
      await activateArea.mutateAsync(area.id);
      toast.success(`Activated "${area.name}"`);
    } catch (error) {
      console.error('Failed to activate area:', error);
      toast.error('Failed to activate area');
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

  // Action handlers
  const handleAddAction = async (initiativeId: string, actionText: string) => {
    if (!actionText.trim()) return;

    try {
      const actions = actionsByInitiative?.[initiativeId] || [];
      await createAction.mutateAsync({
        initiative_id: initiativeId,
        year,
        action_text: actionText,
        sort_order: actions.length,
      });
      setAddingAction(null);
      toast.success('Action added');
    } catch (error) {
      console.error('Failed to create action:', error);
      toast.error('Failed to add action');
    }
  };

  const handleUpdateAction = async (action: InitiativeAnnualAction, updates: Partial<InitiativeAnnualAction>) => {
    try {
      await updateAction.mutateAsync({
        id: action.id,
        initiative_id: action.initiative_id,
        year: action.year,
        ...updates,
      });
      setEditingAction(null);
    } catch (error) {
      console.error('Failed to update action:', error);
      toast.error('Failed to update action');
    }
  };

  const handleDeleteAction = async (action: InitiativeAnnualAction) => {
    if (!window.confirm('Delete this action?')) return;

    try {
      await deleteAction.mutateAsync({
        id: action.id,
        initiative_id: action.initiative_id,
        year: action.year,
      });
      toast.success('Action deleted');
    } catch (error) {
      console.error('Failed to delete action:', error);
      toast.error('Failed to delete action');
    }
  };

  // Target handlers
  const handleAddTarget = async (initiativeId: string, metricName: string, targetValue: string) => {
    if (!metricName.trim()) return;

    try {
      const targets = targetsByInitiative?.[initiativeId] || [];
      await createTarget.mutateAsync({
        initiative_id: initiativeId,
        year,
        metric_name: metricName,
        target_value: targetValue,
        sort_order: targets.length,
      });
      setAddingTarget(null);
      toast.success('Target added');
    } catch (error) {
      console.error('Failed to create target:', error);
      toast.error('Failed to add target');
    }
  };

  const handleUpdateTarget = async (target: InitiativeAnnualTarget, updates: Partial<InitiativeAnnualTarget>) => {
    try {
      await updateTarget.mutateAsync({
        id: target.id,
        initiative_id: target.initiative_id,
        year: target.year,
        ...updates,
      });
      setEditingTarget(null);
    } catch (error) {
      console.error('Failed to update target:', error);
      toast.error('Failed to update target');
    }
  };

  const handleDeleteTarget = async (target: InitiativeAnnualTarget) => {
    if (!window.confirm('Delete this target?')) return;

    try {
      await deleteTarget.mutateAsync({
        id: target.id,
        initiative_id: target.initiative_id,
        year: target.year,
      });
      toast.success('Target deleted');
    } catch (error) {
      console.error('Failed to delete target:', error);
      toast.error('Failed to delete target');
    }
  };

  // Group initiatives by area
  const initiativesByArea = initiatives?.reduce((acc, initiative) => {
    const areaId = initiative.area?.id || 'uncategorized';
    if (!acc[areaId]) {
      acc[areaId] = [];
    }
    acc[areaId].push(initiative);
    return acc;
  }, {} as Record<string, ProjectInitiative[]>) || {};

  if (!areas || areas.length === 0) {
    return (
      <div className="max-w-full mx-auto">
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <FolderOpen className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            No areas created yet
          </h3>
          <p className="text-gray-600 mb-6">
            Create areas to organize your initiatives and define strategic direction
          </p>
          <button
            onClick={() => setShowAreaModal(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4 inline-block mr-2" />
            Create First Area
          </button>
        </div>
      </div>
    );
  }

  const getActionStatusIcon = (status: ActionStatus) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="w-4 h-4 text-green-600" />;
      case 'in_progress':
        return <AlertCircle className="w-4 h-4 text-blue-600" />;
      default:
        return <Circle className="w-4 h-4 text-gray-400" />;
    }
  };

  const getAssessmentColor = (assessment?: Assessment) => {
    switch (assessment) {
      case 'green':
        return 'bg-green-100 text-green-800 border-green-300';
      case 'yellow':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'red':
        return 'bg-red-100 text-red-800 border-red-300';
      default:
        return 'bg-gray-100 text-gray-600 border-gray-300';
    }
  };

  return (
    <div className="max-w-full mx-auto space-y-4">
      {/* Header */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-blue-900">
            <Target className="w-5 h-5" />
            <span className="font-medium">Annual Plan for {year}</span>
          </div>
          <div className="flex items-center gap-2">
            <CopyYearButton functionId={functionId} fromYear={year - 1} toYear={year} />
            <button
              onClick={() => setShowAreaModal(true)}
              className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Area
            </button>
          </div>
        </div>
        <p className="text-sm text-blue-700 mt-1">
          Define actions/objectives and annual targets for each initiative
        </p>
      </div>

      {/* Areas */}
      {areas.map((area) => {
        const areaInitiatives = initiativesByArea[area.id] || [];
        const isStratDescCollapsed = collapsedStrategicDesc.has(area.id);

        return (
          <div key={area.id} className="bg-white rounded-lg border border-gray-200">
            {/* Area Header */}
            <div className="border-b border-blue-700 bg-blue-900 px-4 py-2">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold text-white">{area.name}</h3>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-blue-200">
                    {areaInitiatives.length} initiative{areaInitiatives.length !== 1 ? 's' : ''}
                  </span>
                  <button
                    onClick={() => setShowInitiativeModal({ areaId: area.id })}
                    className="flex items-center gap-1 px-2 py-1 text-xs text-white hover:bg-blue-800 rounded transition-colors"
                  >
                    <Plus className="w-3 h-3" />
                    Add Initiative
                  </button>
                  <button
                    onClick={() => toggleStrategicDesc(area.id)}
                    className="flex items-center gap-1 px-2 py-1 text-xs text-white hover:bg-blue-800 rounded transition-colors"
                  >
                    {isStratDescCollapsed ? (
                      <>
                        <ChevronRight className="w-3 h-3" />
                        <span>Show Strategy</span>
                      </>
                    ) : (
                      <>
                        <ChevronDown className="w-3 h-3" />
                        <span>Hide Strategy</span>
                      </>
                    )}
                  </button>
                  {area.is_active ? (
                    <button
                      onClick={() => handleDeactivateArea(area)}
                      className="flex items-center gap-1 px-2 py-1 text-xs text-orange-200 hover:bg-blue-800 rounded transition-colors"
                      title="Deactivate area (only if all initiatives are inactive)"
                    >
                      <Archive className="w-3 h-3" />
                      <span>Deactivate</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => handleActivateArea(area)}
                      className="flex items-center gap-1 px-2 py-1 text-xs text-green-200 hover:bg-blue-800 rounded transition-colors"
                      title="Activate area"
                    >
                      <ArchiveRestore className="w-3 h-3" />
                      <span>Activate</span>
                    </button>
                  )}
                  <button
                    onClick={() => handleDeleteArea(area, areaInitiatives.length)}
                    className="flex items-center gap-1 px-2 py-1 text-xs text-red-200 hover:bg-blue-800 rounded transition-colors"
                    title="Delete area and all initiatives"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Delete</span>
                  </button>
                </div>
              </div>

              {/* Strategic Description - Collapsible */}
              {!isStratDescCollapsed && (
                <div className="mt-2 pt-2 border-t border-blue-700 bg-white rounded-md">
                  {editingField?.type === 'strategic_desc' && editingField.id === area.id ? (
                    <textarea
                      autoFocus
                      defaultValue={area.strategic_description || ''}
                      onBlur={(e) => handleSaveStrategicDescription(area, e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Escape') {
                          setEditingField(null);
                        }
                      }}
                      className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-h-[60px]"
                      placeholder="Strategic description for this area..."
                    />
                  ) : (
                    <div
                      onClick={() => setEditingField({ type: 'strategic_desc', id: area.id })}
                      className="w-full px-2 py-1.5 text-sm border border-transparent rounded hover:border-gray-300 hover:bg-gray-50 cursor-text min-h-[60px]"
                    >
                      {area.strategic_description ? (
                        <p className="text-gray-700 whitespace-pre-wrap">{area.strategic_description}</p>
                      ) : (
                        <p className="text-gray-400 italic">Click to add strategic description...</p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Initiatives */}
            {areaInitiatives.length > 0 ? (
              <div className="divide-y divide-gray-200">
                {areaInitiatives.map((initiative) => {
                  const actions = actionsByInitiative?.[initiative.id] || [];
                  const targets = targetsByInitiative?.[initiative.id] || [];

                  return (
                    <div key={initiative.id} className="p-4">
                      {/* Initiative Title */}
                      <div className="mb-3 flex items-center justify-between">
                        <div className="flex-1">
                          {editingField?.type === 'title' && editingField.id === initiative.id ? (
                            <input
                              type="text"
                              autoFocus
                              defaultValue={initiative.title}
                              onBlur={(e) => handleSaveInitiativeTitle(initiative, e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Escape') {
                                  setEditingField(null);
                                } else if (e.key === 'Enter') {
                                  handleSaveInitiativeTitle(initiative, e.currentTarget.value);
                                }
                              }}
                              className="w-full px-2 py-1 text-base font-semibold border border-blue-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            />
                          ) : (
                            <h4
                              onClick={() => setEditingField({ type: 'title', id: initiative.id })}
                              className="text-base font-semibold text-gray-900 cursor-pointer hover:text-blue-600"
                            >
                              {initiative.title}
                              {!initiative.is_active && (
                                <span className="ml-2 text-xs px-2 py-0.5 bg-gray-200 text-gray-600 rounded">
                                  Inactive
                                </span>
                              )}
                            </h4>
                          )}
                        </div>
                        {initiative.is_active ? (
                          <button
                            onClick={() => handleDeactivateInitiative(initiative)}
                            className="flex items-center gap-1 px-2 py-1 text-xs text-orange-600 hover:bg-orange-50 rounded transition-colors"
                            title="Deactivate initiative"
                          >
                            <Archive className="w-3 h-3" />
                            Deactivate
                          </button>
                        ) : (
                          <button
                            onClick={() => handleActivateInitiative(initiative)}
                            className="flex items-center gap-1 px-2 py-1 text-xs text-green-600 hover:bg-green-50 rounded transition-colors"
                            title="Activate initiative"
                          >
                            <ArchiveRestore className="w-3 h-3" />
                            Activate
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        {/* Actions/Objectives Column */}
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <h5 className="text-sm font-semibold text-gray-700">Actions/Objectives</h5>
                            <button
                              onClick={() => setAddingAction(initiative.id)}
                              className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
                            >
                              <Plus className="w-3 h-3" />
                              Add
                            </button>
                          </div>

                          <div className="space-y-2">
                            {actions.map((action) => (
                              <div key={action.id} className="group border border-gray-200 rounded p-2 hover:border-gray-300">
                                {editingAction === action.id ? (
                                  <textarea
                                    autoFocus
                                    defaultValue={action.action_text}
                                    onBlur={(e) => handleUpdateAction(action, { action_text: e.target.value })}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Escape') setEditingAction(null);
                                    }}
                                    className="w-full px-2 py-1 text-sm border border-blue-300 rounded focus:ring-2 focus:ring-blue-500"
                                    rows={3}
                                  />
                                ) : (
                                  <>
                                    <div className="flex items-start gap-2">
                                      {getActionStatusIcon(action.status)}
                                      <p
                                        onClick={() => setEditingAction(action.id)}
                                        className="flex-1 text-sm text-gray-700 cursor-pointer hover:text-gray-900"
                                      >
                                        {action.action_text}
                                      </p>
                                      <button
                                        onClick={() => handleDeleteAction(action)}
                                        className="opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-700"
                                      >
                                        <Trash2 className="w-3 h-3" />
                                      </button>
                                    </div>
                                    <div className="flex items-center gap-2 mt-2">
                                      <select
                                        value={action.status}
                                        onChange={(e) => handleUpdateAction(action, { status: e.target.value as ActionStatus })}
                                        className="text-xs border-gray-200 rounded px-2 py-1"
                                      >
                                        <option value="not_started">Not Started</option>
                                        <option value="in_progress">In Progress</option>
                                        <option value="completed">Completed</option>
                                      </select>
                                      {action.assessment && (
                                        <span className={`text-xs px-2 py-1 rounded border ${getAssessmentColor(action.assessment)}`}>
                                          {action.assessment.toUpperCase()}
                                        </span>
                                      )}
                                    </div>
                                  </>
                                )}
                              </div>
                            ))}

                            {addingAction === initiative.id && (
                              <div className="border border-blue-300 rounded p-2">
                                <textarea
                                  autoFocus
                                  placeholder="Describe the action or objective..."
                                  onBlur={(e) => {
                                    if (e.target.value.trim()) {
                                      handleAddAction(initiative.id, e.target.value);
                                    } else {
                                      setAddingAction(null);
                                    }
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Escape') setAddingAction(null);
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                      e.preventDefault();
                                      if (e.currentTarget.value.trim()) {
                                        handleAddAction(initiative.id, e.currentTarget.value);
                                      }
                                    }
                                  }}
                                  className="w-full px-2 py-1 text-sm border-0 focus:ring-0"
                                  rows={3}
                                />
                              </div>
                            )}

                            {actions.length === 0 && addingAction !== initiative.id && (
                              <p className="text-sm text-gray-400 italic">No actions defined yet</p>
                            )}
                          </div>
                        </div>

                        {/* Annual Targets Column */}
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <h5 className="text-sm font-semibold text-gray-700">Annual Targets</h5>
                            <button
                              onClick={() => setAddingTarget(initiative.id)}
                              className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
                            >
                              <Plus className="w-3 h-3" />
                              Add
                            </button>
                          </div>

                          <div className="space-y-2">
                            {targets.map((target) => (
                              <div key={target.id} className="group border border-gray-200 rounded p-2 hover:border-gray-300">
                                {editingTarget === target.id ? (
                                  <div className="space-y-2">
                                    <input
                                      type="text"
                                      autoFocus
                                      defaultValue={target.metric_name}
                                      placeholder="Metric name"
                                      onBlur={(e) => handleUpdateTarget(target, { metric_name: e.target.value })}
                                      className="w-full px-2 py-1 text-sm font-medium border border-blue-300 rounded"
                                    />
                                    <input
                                      type="text"
                                      defaultValue={target.target_value || ''}
                                      placeholder="Target value"
                                      onBlur={(e) => handleUpdateTarget(target, { target_value: e.target.value })}
                                      className="w-full px-2 py-1 text-sm border border-blue-300 rounded"
                                    />
                                  </div>
                                ) : (
                                  <>
                                    <div className="flex items-start justify-between gap-2">
                                      <div onClick={() => setEditingTarget(target.id)} className="flex-1 cursor-pointer">
                                        <p className="text-sm font-medium text-gray-900">{target.metric_name}</p>
                                        {target.target_value && (
                                          <p className="text-sm text-gray-600 mt-1">Target: {target.target_value}</p>
                                        )}
                                        {target.actual_value && (
                                          <p className="text-sm text-gray-600">Actual: {target.actual_value}</p>
                                        )}
                                      </div>
                                      <button
                                        onClick={() => handleDeleteTarget(target)}
                                        className="opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-700"
                                      >
                                        <Trash2 className="w-3 h-3" />
                                      </button>
                                    </div>
                                    {target.assessment && (
                                      <div className="mt-2">
                                        <span className={`text-xs px-2 py-1 rounded border ${getAssessmentColor(target.assessment)}`}>
                                          {target.assessment.toUpperCase()}
                                        </span>
                                      </div>
                                    )}
                                  </>
                                )}
                              </div>
                            ))}

                            {addingTarget === initiative.id && (
                              <div className="border border-blue-300 rounded p-2 space-y-2">
                                <input
                                  type="text"
                                  autoFocus
                                  placeholder="Metric name (e.g., Revenue, Cost Reduction)"
                                  onKeyDown={(e) => {
                                    if (e.key === 'Escape') {
                                      setAddingTarget(null);
                                    } else if (e.key === 'Enter') {
                                      const metricName = e.currentTarget.value;
                                      const targetValue = e.currentTarget.nextElementSibling as HTMLInputElement;
                                      if (metricName.trim()) {
                                        handleAddTarget(initiative.id, metricName, targetValue?.value || '');
                                      }
                                    }
                                  }}
                                  className="w-full px-2 py-1 text-sm font-medium border-0 focus:ring-0"
                                />
                                <input
                                  type="text"
                                  placeholder="Target value (e.g., $2M, 15% reduction)"
                                  onBlur={(e) => {
                                    const metricInput = e.currentTarget.previousElementSibling as HTMLInputElement;
                                    const metricName = metricInput?.value || '';
                                    if (metricName.trim()) {
                                      handleAddTarget(initiative.id, metricName, e.target.value);
                                    } else {
                                      setAddingTarget(null);
                                    }
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Escape') setAddingTarget(null);
                                    if (e.key === 'Enter') {
                                      const metricInput = e.currentTarget.previousElementSibling as HTMLInputElement;
                                      const metricName = metricInput?.value || '';
                                      if (metricName.trim()) {
                                        handleAddTarget(initiative.id, metricName, e.currentTarget.value);
                                      }
                                    }
                                  }}
                                  className="w-full px-2 py-1 text-sm border-0 focus:ring-0"
                                />
                              </div>
                            )}

                            {targets.length === 0 && addingTarget !== initiative.id && (
                              <p className="text-sm text-gray-400 italic">No targets defined yet</p>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-6 text-center text-gray-500 text-sm">
                <p>No initiatives in this area yet</p>
                <button
                  onClick={() => setShowInitiativeModal({ areaId: area.id })}
                  className="mt-3 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Plus className="w-3 h-3 inline-block mr-1" />
                  Add First Initiative
                </button>
              </div>
            )}
          </div>
        );
      })}

      {/* Area Management Modal */}
      {showAreaModal && (
        <AreaManagementModal
          functionId={functionId}
          onClose={() => setShowAreaModal(false)}
        />
      )}

      {/* Initiative Creation Modal */}
      {showInitiativeModal && (
        <InitiativeDetailModal
          areaId={showInitiativeModal.areaId}
          onClose={() => setShowInitiativeModal(null)}
        />
      )}
    </div>
  );
}
