import { useState } from 'react';
import { Plus, ChevronDown, ChevronRight, FolderOpen, Target, Trash2, Archive, ArchiveRestore, Lock, CheckCircle2, AlertCircle, Clock } from 'lucide-react';
import {
  useAreasQuery,
  useInitiativesByFunctionQuery,
  useUpdateArea,
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
import type { ProjectArea, ProjectInitiative, Assessment } from '../../lib/leadership';
import type { WorkflowState } from '../../lib/operating-plan.types';
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
  const [editingStrategicDesc, setEditingStrategicDesc] = useState<string | null>(null);
  const [showAreaModal, setShowAreaModal] = useState(false);
  const [showInitiativeModal, setShowInitiativeModal] = useState<{ areaId?: string } | null>(null);
  const [addingAction, setAddingAction] = useState<string | null>(null); // initiative ID
  const [addingTarget, setAddingTarget] = useState<string | null>(null); // initiative ID
  const [editingAction, setEditingAction] = useState<string | null>(null); // action ID
  const [editingTarget, setEditingTarget] = useState<string | null>(null); // target ID
  const [scoringMode, setScoringMode] = useState<'bu' | 'ceo' | null>(null);

  const updateArea = useUpdateArea();
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
      setEditingStrategicDesc(null);
    } catch (error) {
      console.error('Failed to update strategic description:', error);
    }
  };

  const handleDeleteArea = async (area: ProjectArea, initiativesCount: number) => {
    const confirmMessage = initiativesCount > 0
      ? `Are you sure you want to delete "${area.name}"? This will also delete ${initiativesCount} initiative${initiativesCount !== 1 ? 's' : ''} and all their data.`
      : `Are you sure you want to delete "${area.name}"?`;

    if (!window.confirm(confirmMessage)) return;

    try {
      await deleteArea.mutateAsync(area.id);
      toast.success(`Deleted "${area.name}" successfully`);
    } catch (error) {
      console.error('Failed to delete area:', error);
      toast.error('Failed to delete area');
    }
  };

  const handleDeactivateArea = async (area: ProjectArea) => {
    if (!window.confirm(`Deactivate "${area.name}"? This will hide it from planning views.`)) return;

    try {
      await deactivateArea.mutateAsync(area.id);
      toast.success(`Deactivated "${area.name}"`);
    } catch (error: any) {
      console.error('Failed to deactivate area:', error);
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
    if (!window.confirm(`Deactivate "${initiative.title}"? This will hide it from planning views.`)) return;

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

  // Add new action
  const handleAddAction = async (initiativeId: string, actionText: string) => {
    if (!actionText.trim()) {
      setAddingAction(null);
      return;
    }

    try {
      const existingActions = actionsByInitiative?.[initiativeId] || [];
      await createAction.mutateAsync({
        initiative_id: initiativeId,
        year,
        action_text: actionText.trim(),
        sort_order: existingActions.length,
        function_id: functionId,
      });
      setAddingAction(null);
      toast.success('Action added');
    } catch (error) {
      console.error('Failed to add action:', error);
      toast.error('Failed to add action');
    }
  };

  // Update existing action
  const handleUpdateAction = async (actionId: string, actionText: string, initiativeId: string) => {
    if (!actionText.trim()) {
      setEditingAction(null);
      return;
    }

    try {
      await updateAction.mutateAsync({
        id: actionId,
        initiative_id: initiativeId,
        year,
        action_text: actionText.trim(),
        function_id: functionId,
      });
      setEditingAction(null);
      toast.success('Action updated');
    } catch (error) {
      console.error('Failed to update action:', error);
      toast.error('Failed to update action');
    }
  };

  // Delete action
  const handleDeleteAction = async (actionId: string, initiativeId: string) => {
    try {
      await deleteAction.mutateAsync({ id: actionId, initiative_id: initiativeId, year, function_id: functionId });
      toast.success('Action deleted');
    } catch (error) {
      console.error('Failed to delete action:', error);
      toast.error('Failed to delete action');
    }
  };

  // Add new target
  const handleAddTarget = async (initiativeId: string, targetText: string) => {
    if (!targetText.trim()) {
      setAddingTarget(null);
      return;
    }

    try {
      const existingTargets = targetsByInitiative?.[initiativeId] || [];
      await createTarget.mutateAsync({
        initiative_id: initiativeId,
        year,
        target_text: targetText.trim(),
        sort_order: existingTargets.length,
        function_id: functionId,
      });
      setAddingTarget(null);
      toast.success('Target added');
    } catch (error) {
      console.error('Failed to add target:', error);
      toast.error('Failed to add target');
    }
  };

  // Update existing target
  const handleUpdateTarget = async (targetId: string, targetText: string, initiativeId: string) => {
    if (!targetText.trim()) {
      setEditingTarget(null);
      return;
    }

    try {
      await updateTarget.mutateAsync({
        id: targetId,
        initiative_id: initiativeId,
        year,
        function_id: functionId,
        target_text: targetText.trim(),
      });
      setEditingTarget(null);
      toast.success('Target updated');
    } catch (error) {
      console.error('Failed to update target:', error);
      toast.error('Failed to update target');
    }
  };

  // Delete target
  const handleDeleteTarget = async (targetId: string, initiativeId: string) => {
    try {
      await deleteTarget.mutateAsync({ id: targetId, initiative_id: initiativeId, year, function_id: functionId });
      toast.success('Target deleted');
    } catch (error) {
      console.error('Failed to delete target:', error);
      toast.error('Failed to delete target');
    }
  };

  // Workflow and Scoring Helpers
  const getAllActionsAndTargets = () => {
    const allActions = Object.values(actionsByInitiative || {}).flat();
    const allTargets = Object.values(targetsByInitiative || {}).flat();
    return [...allActions, ...allTargets];
  };

  const getPlanWorkflowState = (): { state: WorkflowState | 'mixed' | 'empty'; canEdit: boolean; canScoreBU: boolean; canScoreCEO: boolean; canLock: boolean } => {
    const items = getAllActionsAndTargets();

    if (items.length === 0) {
      return { state: 'empty', canEdit: true, canScoreBU: false, canScoreCEO: false, canLock: false };
    }

    const states = new Set(items.map(item => item.workflow_state));

    if (states.size === 1) {
      const state = Array.from(states)[0];
      return {
        state,
        canEdit: state === 'draft',
        canScoreBU: state === 'bu_scoring',
        canScoreCEO: state === 'pending_ceo_review',
        canLock: state === 'draft',
      };
    }

    return { state: 'mixed', canEdit: false, canScoreBU: false, canScoreCEO: false, canLock: false };
  };

  const workflowState = getPlanWorkflowState();

  const handleLockPlan = async () => {
    if (!window.confirm(`Lock the ${year} Annual Plan? This will start the scoring process.`)) return;

    try {
      await Promise.all([
        ...Object.values(actionsByInitiative || {}).flat().map(action =>
          updateAction.mutateAsync({
            id: action.id,
            initiative_id: action.initiative_id,
            year,
            function_id: functionId,
            workflow_state: 'bu_scoring',
            locked: true,
          })
        ),
        ...Object.values(targetsByInitiative || {}).flat().map(target =>
          updateTarget.mutateAsync({
            id: target.id,
            initiative_id: target.initiative_id,
            year,
            function_id: functionId,
            workflow_state: 'bu_scoring',
            locked: true,
          })
        ),
      ]);
      toast.success(`${year} Annual Plan locked for BU scoring`);
    } catch (error) {
      console.error('Failed to lock plan:', error);
      toast.error('Failed to lock plan');
    }
  };

  const handleSubmitBUScores = async () => {
    const actions = Object.values(actionsByInitiative || {}).flat();
    const targets = Object.values(targetsByInitiative || {}).flat();
    const unscoredActions = actions.filter(a => !a.bu_assessment && !a.bu_score);
    const unscoredTargets = targets.filter(t => !t.bu_assessment && !t.bu_score);

    if (unscoredActions.length > 0 || unscoredTargets.length > 0) {
      toast.error(`Please score all ${unscoredActions.length} actions and ${unscoredTargets.length} targets before submitting`);
      return;
    }

    if (!window.confirm(`Submit BU scores for CEO review?`)) return;

    try {
      await Promise.all([
        ...actions.map(action =>
          updateAction.mutateAsync({
            id: action.id,
            initiative_id: action.initiative_id,
            year,
            function_id: functionId,
            workflow_state: 'pending_ceo_review',
            scored_at: new Date().toISOString(),
          })
        ),
        ...targets.map(target =>
          updateTarget.mutateAsync({
            id: target.id,
            initiative_id: target.initiative_id,
            year,
            function_id: functionId,
            workflow_state: 'pending_ceo_review',
            scored_at: new Date().toISOString(),
          })
        ),
      ]);
      setScoringMode(null);
      toast.success('Submitted for CEO review');
    } catch (error) {
      console.error('Failed to submit scores:', error);
      toast.error('Failed to submit scores');
    }
  };

  const handleCEOApprove = async () => {
    const actions = Object.values(actionsByInitiative || {}).flat();
    const targets = Object.values(targetsByInitiative || {}).flat();
    const unscoredActions = actions.filter(a => !a.ceo_assessment && !a.ceo_score);
    const unscoredTargets = targets.filter(t => !t.ceo_assessment && !t.ceo_score);

    if (unscoredActions.length > 0 || unscoredTargets.length > 0) {
      toast.error(`Please score all ${unscoredActions.length} actions and ${unscoredTargets.length} targets before approving`);
      return;
    }

    if (!window.confirm(`Approve the ${year} Annual Plan? This will finalize all scores.`)) return;

    try {
      await Promise.all([
        ...actions.map(action =>
          updateAction.mutateAsync({
            id: action.id,
            initiative_id: action.initiative_id,
            year,
            function_id: functionId,
            workflow_state: 'approved',
            approved_at: new Date().toISOString(),
          })
        ),
        ...targets.map(target =>
          updateTarget.mutateAsync({
            id: target.id,
            initiative_id: target.initiative_id,
            year,
            function_id: functionId,
            workflow_state: 'approved',
            approved_at: new Date().toISOString(),
          })
        ),
      ]);
      setScoringMode(null);
      toast.success(`${year} Annual Plan approved`);
    } catch (error) {
      console.error('Failed to approve:', error);
      toast.error('Failed to approve');
    }
  };

  const getAssessmentColor = (assessment?: Assessment | null) => {
    switch (assessment) {
      case 'dark_green':
        return 'bg-green-600 text-white border-green-700';
      case 'light_green':
        return 'bg-green-100 text-green-800 border-green-300';
      case 'light_yellow':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'dark_yellow':
        return 'bg-yellow-500 text-yellow-900 border-yellow-600';
      case 'red':
        return 'bg-red-100 text-red-800 border-red-300';
      default:
        return 'bg-gray-100 text-gray-600 border-gray-300';
    }
  };

  const getWorkflowIcon = () => {
    switch (workflowState.state) {
      case 'draft':
        return <Clock className="w-5 h-5 text-gray-500" />;
      case 'bu_scoring':
        return <AlertCircle className="w-5 h-5 text-blue-500" />;
      case 'pending_ceo_review':
        return <AlertCircle className="w-5 h-5 text-purple-500" />;
      case 'approved':
        return <CheckCircle2 className="w-5 h-5 text-green-500" />;
      default:
        return <Target className="w-5 h-5 text-gray-500" />;
    }
  };

  const getWorkflowLabel = () => {
    switch (workflowState.state) {
      case 'draft':
        return 'Draft - Editable';
      case 'bu_scoring':
        return 'BU Scoring in Progress';
      case 'pending_ceo_review':
        return 'Pending CEO Review';
      case 'approved':
        return 'Approved & Complete';
      case 'mixed':
        return 'Mixed States';
      case 'empty':
        return 'No Items Yet';
      default:
        return 'Unknown';
    }
  };

  // Group initiatives by area
  const initiativesByArea = initiatives?.reduce((acc, initiative) => {
    const areaId = initiative.area?.id || 'uncategorized';
    if (!acc[areaId]) acc[areaId] = [];
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

  return (
    <div className="max-w-full mx-auto space-y-4">
      {/* Header */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-gray-900">
              <Target className="w-5 h-5" />
              <span className="font-medium">Annual Plan for {year}</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg border border-gray-200">
              {getWorkflowIcon()}
              <span className="text-sm font-medium text-gray-700">{getWorkflowLabel()}</span>
            </div>
          </div>

          {/* Workflow Actions */}
          <div className="flex items-center gap-2">
            {workflowState.canLock && (
              <button
                onClick={handleLockPlan}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Lock className="w-4 h-4" />
                Lock & Start Scoring
              </button>
            )}

            {workflowState.canScoreBU && (
              <>
                {scoringMode === 'bu' ? (
                  <button
                    onClick={handleSubmitBUScores}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition-colors"
                  >
                    Submit BU Scores
                  </button>
                ) : (
                  <button
                    onClick={() => setScoringMode('bu')}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Score as BU
                  </button>
                )}
              </>
            )}

            {workflowState.canScoreCEO && (
              <>
                {scoringMode === 'ceo' ? (
                  <button
                    onClick={handleCEOApprove}
                    className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700 transition-colors"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Approve as CEO
                  </button>
                ) : (
                  <button
                    onClick={() => setScoringMode('ceo')}
                    className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700 transition-colors"
                  >
                    Score as CEO
                  </button>
                )}
              </>
            )}

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
        <p className="text-sm text-gray-600">
          Define actions/objectives and annual targets for each initiative. {workflowState.canScoreBU || workflowState.canScoreCEO ? 'Use scoring dropdowns to assess each item.' : ''}
        </p>
      </div>

      {/* Areas */}
      {areas.map((area) => {
        const areaInitiatives = initiativesByArea[area.id] || [];
        const isStratDescCollapsed = collapsedStrategicDesc.has(area.id);

        return (
          <div key={area.id} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
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
                      title="Deactivate area"
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
                  {editingStrategicDesc === area.id ? (
                    <textarea
                      autoFocus
                      defaultValue={area.strategic_description || ''}
                      onBlur={(e) => handleSaveStrategicDescription(area, e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Escape') setEditingStrategicDesc(null);
                      }}
                      className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-h-[60px]"
                      placeholder="Strategic description for this area..."
                    />
                  ) : (
                    <div
                      onClick={() => setEditingStrategicDesc(area.id)}
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

            {/* Initiatives Table */}
            {areaInitiatives.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider w-1/4">
                        Initiative
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider w-[55%]">
                        Actions/Objectives
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider w-[20%]">
                        Annual Target
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {areaInitiatives.map((initiative) => {
                      const actions = actionsByInitiative?.[initiative.id] || [];
                      const targets = targetsByInitiative?.[initiative.id] || [];

                      return (
                        <tr key={initiative.id} className="hover:bg-gray-50">
                          {/* Initiative Name */}
                          <td className="px-4 py-4 align-top">
                            <div className="flex items-start gap-2">
                              <div className="flex-1">
                                <div className="font-bold text-gray-900 text-sm">
                                  {initiative.title}
                                  {!initiative.is_active && (
                                    <span className="block mt-1 text-xs px-2 py-0.5 bg-gray-200 text-gray-600 rounded inline-block">
                                      Inactive
                                    </span>
                                  )}
                                </div>
                                <div className="mt-2 space-y-1">
                                  {initiative.is_active ? (
                                    <button
                                      onClick={() => handleDeactivateInitiative(initiative)}
                                      className="text-xs text-orange-600 hover:text-orange-700"
                                    >
                                      Deactivate
                                    </button>
                                  ) : (
                                    <button
                                      onClick={() => handleActivateInitiative(initiative)}
                                      className="text-xs text-green-600 hover:text-green-700"
                                    >
                                      Activate
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Actions/Objectives */}
                          <td className="px-4 py-4 align-top">
                            <div className="space-y-2">
                              <div className="flex items-center justify-between mb-2">
                                <button
                                  onClick={() => setAddingAction(initiative.id)}
                                  className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
                                >
                                  <Plus className="w-3 h-3" />
                                  Add Action
                                </button>
                              </div>

                              {actions.map((action) => (
                                <div key={action.id} className="group border border-gray-200 rounded p-2 hover:border-gray-300">
                                  {editingAction === action.id ? (
                                    <textarea
                                      autoFocus
                                      defaultValue={action.action_text}
                                      onBlur={(e) => handleUpdateAction(action.id, e.target.value, initiative.id)}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Escape') setEditingAction(null);
                                        if (e.key === 'Enter' && !e.shiftKey) {
                                          e.preventDefault();
                                          e.currentTarget.blur();
                                        }
                                      }}
                                      className="w-full px-2 py-1 text-sm border border-blue-300 rounded focus:ring-2 focus:ring-blue-500"
                                      rows={2}
                                    />
                                  ) : (
                                    <>
                                      <div className="flex items-start gap-2">
                                        <span className="text-gray-400">-</span>
                                        <p
                                          onClick={() => workflowState.canEdit && setEditingAction(action.id)}
                                          className={`flex-1 text-sm text-gray-700 ${workflowState.canEdit ? 'cursor-pointer hover:text-gray-900' : ''}`}
                                        >
                                          {action.action_text}
                                        </p>
                                        {workflowState.canEdit && (
                                          <button
                                            onClick={() => handleDeleteAction(action.id, initiative.id)}
                                            className="opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-700"
                                          >
                                            <Trash2 className="w-3 h-3" />
                                          </button>
                                        )}
                                      </div>

                                      {/* Scoring UI */}
                                      {(workflowState.canScoreBU || workflowState.canScoreCEO || action.bu_assessment || action.ceo_assessment) && (
                                        <div className="flex items-center gap-4 mt-2 pt-2 border-t border-gray-100">
                                          {/* BU Score */}
                                          <div className="flex items-center gap-2">
                                            <span className="text-xs font-medium text-gray-600">BU:</span>
                                            {scoringMode === 'bu' && workflowState.canScoreBU ? (
                                              <select
                                                value={action.bu_assessment || ''}
                                                onChange={(e) =>
                                                  updateAction.mutateAsync({
                                                    id: action.id,
                                                    initiative_id: initiative.id,
                                                    year,
                                                    function_id: functionId,
                                                    bu_assessment: (e.target.value as Assessment) || null,
                                                  })
                                                }
                                                className="text-xs border-gray-200 rounded px-2 py-1"
                                              >
                                                <option value="">Not Scored</option>
                                                <option value="dark_green">Dark Green - Excellent</option>
                                                <option value="light_green">Light Green - Good</option>
                                                <option value="light_yellow">Light Yellow - Met</option>
                                                <option value="dark_yellow">Dark Yellow - Below</option>
                                                <option value="red">Red - Poor</option>
                                              </select>
                                            ) : action.bu_assessment ? (
                                              <span className={`text-xs px-2 py-1 rounded border ${getAssessmentColor(action.bu_assessment)}`}>
                                                {action.bu_assessment.toUpperCase()}
                                              </span>
                                            ) : (
                                              <span className="text-xs text-gray-400">Not scored</span>
                                            )}
                                          </div>

                                          {/* CEO Score */}
                                          <div className="flex items-center gap-2">
                                            <span className="text-xs font-medium text-gray-600">CEO:</span>
                                            {scoringMode === 'ceo' && workflowState.canScoreCEO ? (
                                              <select
                                                value={action.ceo_assessment || ''}
                                                onChange={(e) =>
                                                  updateAction.mutateAsync({
                                                    id: action.id,
                                                    initiative_id: initiative.id,
                                                    year,
                                                    function_id: functionId,
                                                    ceo_assessment: (e.target.value as Assessment) || null,
                                                  })
                                                }
                                                className="text-xs border-gray-200 rounded px-2 py-1"
                                              >
                                                <option value="">Not Scored</option>
                                                <option value="dark_green">Dark Green - Excellent</option>
                                                <option value="light_green">Light Green - Good</option>
                                                <option value="light_yellow">Light Yellow - Met</option>
                                                <option value="dark_yellow">Dark Yellow - Below</option>
                                                <option value="red">Red - Poor</option>
                                              </select>
                                            ) : action.ceo_assessment ? (
                                              <span className={`text-xs px-2 py-1 rounded border ${getAssessmentColor(action.ceo_assessment)}`}>
                                                {action.ceo_assessment.toUpperCase()}
                                              </span>
                                            ) : (
                                              <span className="text-xs text-gray-400">Not scored</span>
                                            )}
                                          </div>
                                        </div>
                                      )}
                                    </>
                                  )}
                                </div>
                              ))}

                              {addingAction === initiative.id && (
                                <div className="border border-blue-300 rounded p-2">
                                  <textarea
                                    autoFocus
                                    placeholder="Describe the action or objective..."
                                    onBlur={(e) => handleAddAction(initiative.id, e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Escape') setAddingAction(null);
                                      if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault();
                                        handleAddAction(initiative.id, e.currentTarget.value);
                                      }
                                    }}
                                    className="w-full px-2 py-1 text-sm border-0 focus:ring-0"
                                    rows={2}
                                  />
                                </div>
                              )}

                              {actions.length === 0 && addingAction !== initiative.id && (
                                <p className="text-sm text-gray-400 italic">No actions defined yet</p>
                              )}
                            </div>
                          </td>

                          {/* Annual Targets */}
                          <td className="px-4 py-4 align-top">
                            <div className="space-y-2">
                              <div className="flex items-center justify-between mb-2">
                                <button
                                  onClick={() => setAddingTarget(initiative.id)}
                                  className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
                                >
                                  <Plus className="w-3 h-3" />
                                  Add Target
                                </button>
                              </div>

                              {targets.map((target) => (
                                <div key={target.id} className="group p-2 border border-gray-200 rounded hover:border-gray-300">
                                  {editingTarget === target.id ? (
                                    <textarea
                                      autoFocus
                                      defaultValue={target.target_text}
                                      placeholder="Target description (e.g., Achieve $7M revenue at 27%+ margins)"
                                      onBlur={(e) => handleUpdateTarget(target.id, e.target.value, initiative.id)}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Escape') {
                                          setEditingTarget(null);
                                        }
                                      }}
                                      className="w-full px-2 py-1 text-sm border border-blue-300 rounded focus:ring-2 focus:ring-blue-500"
                                      rows={3}
                                    />
                                  ) : (
                                    <>
                                      <div className="flex items-start justify-between gap-2">
                                        <p
                                          onClick={() => workflowState.canEdit && setEditingTarget(target.id)}
                                          className={`flex-1 text-sm text-gray-900 ${workflowState.canEdit ? 'cursor-pointer hover:text-gray-700' : ''}`}
                                        >
                                          {target.target_text}
                                        </p>
                                        {workflowState.canEdit && (
                                          <button
                                            onClick={() => handleDeleteTarget(target.id, initiative.id)}
                                            className="opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-700"
                                          >
                                            <Trash2 className="w-3 h-3" />
                                          </button>
                                        )}
                                      </div>

                                      {/* Scoring UI */}
                                      {(workflowState.canScoreBU || workflowState.canScoreCEO || target.bu_assessment || target.ceo_assessment) && (
                                        <div className="flex items-center gap-4 mt-2 pt-2 border-t border-gray-100">
                                          {/* BU Score */}
                                          <div className="flex items-center gap-2">
                                            <span className="text-xs font-medium text-gray-600">BU:</span>
                                            {scoringMode === 'bu' && workflowState.canScoreBU ? (
                                              <select
                                                value={target.bu_assessment || ''}
                                                onChange={(e) =>
                                                  updateTarget.mutateAsync({
                                                    id: target.id,
                                                    initiative_id: initiative.id,
                                                    year,
                                                    function_id: functionId,
                                                    bu_assessment: (e.target.value as Assessment) || null,
                                                  })
                                                }
                                                className="text-xs border-gray-200 rounded px-2 py-1"
                                              >
                                                <option value="">Not Scored</option>
                                                <option value="dark_green">Dark Green - Excellent</option>
                                                <option value="light_green">Light Green - Good</option>
                                                <option value="light_yellow">Light Yellow - Met</option>
                                                <option value="dark_yellow">Dark Yellow - Below</option>
                                                <option value="red">Red - Poor</option>
                                              </select>
                                            ) : target.bu_assessment ? (
                                              <span className={`text-xs px-2 py-1 rounded border ${getAssessmentColor(target.bu_assessment)}`}>
                                                {target.bu_assessment.toUpperCase()}
                                              </span>
                                            ) : (
                                              <span className="text-xs text-gray-400">Not scored</span>
                                            )}
                                          </div>

                                          {/* CEO Score */}
                                          <div className="flex items-center gap-2">
                                            <span className="text-xs font-medium text-gray-600">CEO:</span>
                                            {scoringMode === 'ceo' && workflowState.canScoreCEO ? (
                                              <select
                                                value={target.ceo_assessment || ''}
                                                onChange={(e) =>
                                                  updateTarget.mutateAsync({
                                                    id: target.id,
                                                    initiative_id: initiative.id,
                                                    year,
                                                    function_id: functionId,
                                                    ceo_assessment: (e.target.value as Assessment) || null,
                                                  })
                                                }
                                                className="text-xs border-gray-200 rounded px-2 py-1"
                                              >
                                                <option value="">Not Scored</option>
                                                <option value="dark_green">Dark Green - Excellent</option>
                                                <option value="light_green">Light Green - Good</option>
                                                <option value="light_yellow">Light Yellow - Met</option>
                                                <option value="dark_yellow">Dark Yellow - Below</option>
                                                <option value="red">Red - Poor</option>
                                              </select>
                                            ) : target.ceo_assessment ? (
                                              <span className={`text-xs px-2 py-1 rounded border ${getAssessmentColor(target.ceo_assessment)}`}>
                                                {target.ceo_assessment.toUpperCase()}
                                              </span>
                                            ) : (
                                              <span className="text-xs text-gray-400">Not scored</span>
                                            )}
                                          </div>
                                        </div>
                                      )}
                                    </>
                                  )}
                                </div>
                              ))}

                              {addingTarget === initiative.id && (
                                <div className="border border-blue-300 rounded p-2">
                                  <textarea
                                    autoFocus
                                    placeholder="Target description (e.g., Achieve $7M revenue at 27%+ margins)"
                                    onBlur={(e) => {
                                      if (e.target.value.trim()) {
                                        handleAddTarget(initiative.id, e.target.value);
                                      } else {
                                        setAddingTarget(null);
                                      }
                                    }}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Escape') {
                                        setAddingTarget(null);
                                      }
                                    }}
                                    className="w-full px-2 py-1 text-sm border-0 focus:ring-0"
                                    rows={3}
                                  />
                                </div>
                              )}

                              {targets.length === 0 && addingTarget !== initiative.id && (
                                <p className="text-sm text-gray-400 italic">No targets defined yet</p>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
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
