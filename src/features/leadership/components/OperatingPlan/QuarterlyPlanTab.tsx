import { useState } from 'react';
import { Plus, Calendar, Trash2, Lock, CheckCircle2, AlertCircle, Clock, ChevronDown, ChevronRight } from 'lucide-react';
import {
  useAreasQuery,
  useInitiativesByFunctionQuery,
  useAllAnnualActionsByFunctionQuery,
  useAllAnnualTargetsByFunctionQuery,
} from '../../hooks/useLeadershipQuery';
import {
  useQuarterlyObjectivesByFunctionQuery,
  useUpdateQuarterlyObjective,
  useCreateQuarterlyObjective,
  useDeleteQuarterlyObjective,
} from '../../hooks/useOperatingPlanQuery';
import type { QuarterlyObjective, WorkflowState, Assessment } from '../../lib/operating-plan.types';
import { toast } from 'react-hot-toast';

interface QuarterlyPlanTabProps {
  functionId: string;
  year: number;
}

type QuarterNumber = 1 | 2 | 3 | 4;

export default function QuarterlyPlanTab({ functionId, year }: QuarterlyPlanTabProps) {
  const [selectedQuarter, setSelectedQuarter] = useState<QuarterNumber>(1);
  const [addingObjective, setAddingObjective] = useState<string | null>(null);
  const [editingObjective, setEditingObjective] = useState<string | null>(null);
  const [scoringMode, setScoringMode] = useState<'bu' | 'ceo' | null>(null);
  const [collapsedAreas, setCollapsedAreas] = useState<Set<string>>(new Set());

  const { data: areas } = useAreasQuery(functionId);
  const { data: initiatives } = useInitiativesByFunctionQuery(functionId);
  const { data: allObjectives } = useQuarterlyObjectivesByFunctionQuery(functionId, year);
  const { data: annualActionsByInitiative } = useAllAnnualActionsByFunctionQuery(functionId, year);
  const { data: annualTargetsByInitiative } = useAllAnnualTargetsByFunctionQuery(functionId, year);
  const updateObjective = useUpdateQuarterlyObjective();
  const createObjective = useCreateQuarterlyObjective();
  const deleteObjective = useDeleteQuarterlyObjective();

  // Toggle area collapse
  const toggleArea = (areaId: string) => {
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

  // Get objectives for the selected quarter
  const quarterObjectives = allObjectives?.filter(obj => obj.quarter === selectedQuarter) || [];

  // Get previous quarter objectives (Q1 has no previous quarter)
  const previousQuarter = selectedQuarter === 1 ? null : (selectedQuarter - 1) as QuarterNumber;
  const previousQuarterObjectives = previousQuarter
    ? allObjectives?.filter(obj => obj.quarter === previousQuarter) || []
    : [];

  // Group objectives by initiative
  const objectivesByInitiative = quarterObjectives.reduce((acc, obj) => {
    if (!acc[obj.initiative_id]) {
      acc[obj.initiative_id] = [];
    }
    acc[obj.initiative_id].push(obj);
    return acc;
  }, {} as Record<string, QuarterlyObjective[]>);

  // Group previous quarter objectives by initiative
  const previousObjectivesByInitiative = previousQuarterObjectives.reduce((acc, obj) => {
    if (!acc[obj.initiative_id]) {
      acc[obj.initiative_id] = [];
    }
    acc[obj.initiative_id].push(obj);
    return acc;
  }, {} as Record<string, QuarterlyObjective[]>);

  // Group initiatives by area
  const initiativesByArea = initiatives?.reduce((acc, initiative) => {
    const areaId = initiative.area?.id || 'uncategorized';
    if (!acc[areaId]) {
      acc[areaId] = [];
    }
    acc[areaId].push(initiative);
    return acc;
  }, {} as Record<string, typeof initiatives>) || {};

  // Get workflow state for each quarter (for tab status dots)
  const getQuarterStatus = (quarter: QuarterNumber): WorkflowState | 'mixed' | 'empty' => {
    const quarterObjs = allObjectives?.filter(obj => obj.quarter === quarter) || [];
    if (quarterObjs.length === 0) return 'empty';

    const states = new Set(quarterObjs.map(obj => obj.workflow_state));
    if (states.size === 1) return Array.from(states)[0];
    return 'mixed';
  };

  // Determine quarter workflow state
  const getQuarterWorkflowState = (): { state: WorkflowState | 'mixed' | 'empty'; canEdit: boolean; canScoreBU: boolean; canScoreCEO: boolean; canLock: boolean } => {
    if (quarterObjectives.length === 0) {
      return { state: 'empty', canEdit: true, canScoreBU: false, canScoreCEO: false, canLock: false };
    }

    const states = new Set(quarterObjectives.map(obj => obj.workflow_state));

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

  const workflowState = getQuarterWorkflowState();

  // Handlers
  const handleAddObjective = async (initiativeId: string, objectiveText: string) => {
    if (!objectiveText.trim()) return;

    try {
      await createObjective.mutateAsync({
        initiative_id: initiativeId,
        year,
        quarter: selectedQuarter,
        objective_text: objectiveText,
      });
      setAddingObjective(null);
      toast.success('Objective added');
    } catch (error) {
      console.error('Failed to create objective:', error);
      toast.error('Failed to add objective');
    }
  };

  const handleUpdateObjective = async (objective: QuarterlyObjective, updates: Partial<QuarterlyObjective>) => {
    try {
      await updateObjective.mutateAsync({
        id: objective.id,
        ...updates,
      });
      setEditingObjective(null);
    } catch (error) {
      console.error('Failed to update objective:', error);
      toast.error('Failed to update objective');
    }
  };

  const handleDeleteObjective = async (objective: QuarterlyObjective) => {
    if (!window.confirm('Delete this objective?')) return;

    try {
      await deleteObjective.mutateAsync(objective.id);
      toast.success('Objective deleted');
    } catch (error) {
      console.error('Failed to delete objective:', error);
      toast.error('Failed to delete objective');
    }
  };

  const handleLockQuarter = async () => {
    if (!window.confirm(`Lock Q${selectedQuarter} objectives? This will start the scoring process.`)) return;

    try {
      await Promise.all(
        quarterObjectives.map(obj =>
          updateObjective.mutateAsync({
            id: obj.id,
            workflow_state: 'bu_scoring',
            locked: true,
          })
        )
      );
      toast.success(`Q${selectedQuarter} locked for BU scoring`);
    } catch (error) {
      console.error('Failed to lock quarter:', error);
      toast.error('Failed to lock quarter');
    }
  };

  const handleSubmitBUScores = async () => {
    const unscored = quarterObjectives.filter(obj => !obj.bu_assessment);
    if (unscored.length > 0) {
      toast.error(`Please score all ${unscored.length} objective${unscored.length !== 1 ? 's' : ''} before submitting for Q${selectedQuarter}`);
      return;
    }

    if (!window.confirm(`Submit BU scores for CEO review? All ${quarterObjectives.length} Q${selectedQuarter} objectives will be locked for BU changes.`)) return;

    try {
      await Promise.all(
        quarterObjectives.map(obj =>
          updateObjective.mutateAsync({
            id: obj.id,
            workflow_state: 'pending_ceo_review',
            scored_at: new Date().toISOString(),
          })
        )
      );
      setScoringMode(null);
      toast.success('Submitted for CEO review');
    } catch (error) {
      console.error('Failed to submit scores:', error);
      toast.error('Failed to submit scores');
    }
  };

  const handleCEOApprove = async () => {
    const unscored = quarterObjectives.filter(obj => !obj.ceo_assessment);
    if (unscored.length > 0) {
      toast.error(`Please score all ${unscored.length} objective${unscored.length !== 1 ? 's' : ''} before approving Q${selectedQuarter}`);
      return;
    }

    if (!window.confirm(`Approve Q${selectedQuarter} ${year}? This will finalize all ${quarterObjectives.length} objectives.`)) return;

    try {
      await Promise.all(
        quarterObjectives.map(obj =>
          updateObjective.mutateAsync({
            id: obj.id,
            workflow_state: 'ceo_approved',
            approved_at: new Date().toISOString(),
          })
        )
      );
      setScoringMode(null);
      toast.success(`Q${selectedQuarter} approved`);
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
      case 'ceo_approved':
        return <CheckCircle2 className="w-5 h-5 text-green-500" />;
      default:
        return <Calendar className="w-5 h-5 text-gray-500" />;
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
      case 'ceo_approved':
        return 'CEO Approved & Complete';
      case 'mixed':
        return 'Mixed States';
      case 'empty':
        return 'No Objectives Yet';
      default:
        return 'Unknown';
    }
  };

  const getStatusDotColor = (status: WorkflowState | 'mixed' | 'empty') => {
    switch (status) {
      case 'draft':
        return 'bg-gray-400';
      case 'bu_scoring':
        return 'bg-blue-500';
      case 'pending_ceo_review':
        return 'bg-purple-500';
      case 'ceo_approved':
      case 'approved':
        return 'bg-green-500';
      case 'mixed':
        return 'bg-yellow-500';
      case 'empty':
        return 'bg-gray-300';
      default:
        return 'bg-gray-300';
    }
  };

  if (!initiatives || initiatives.length === 0) {
    return (
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <Calendar className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            No initiatives created yet
          </h3>
          <p className="text-gray-600">
            Create initiatives in the Annual Plan tab first to organize your quarterly objectives
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-full mx-auto space-y-4">
      {/* Header with Quarter Tabs and Workflow Status */}
      <div className="bg-white rounded-lg border border-gray-200">
        {/* Quarter Tabs */}
        <div className="border-b border-gray-200">
          <div className="flex items-center">
            {([1, 2, 3, 4] as QuarterNumber[]).map((q) => {
              const status = getQuarterStatus(q);
              const isActive = selectedQuarter === q;
              return (
                <button
                  key={q}
                  onClick={() => setSelectedQuarter(q)}
                  className={`
                    flex items-center gap-2 px-6 py-3 border-b-2 font-medium text-sm transition-colors
                    ${isActive
                      ? 'border-blue-600 text-blue-600 bg-blue-50'
                      : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                    }
                  `}
                >
                  <div className={`w-2 h-2 rounded-full ${getStatusDotColor(status)}`} />
                  Q{q} {year}
                </button>
              );
            })}
          </div>
        </div>

        {/* Workflow Status and Actions */}
        <div className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg border border-gray-200">
              {getWorkflowIcon()}
              <span className="text-sm font-medium text-gray-700">{getWorkflowLabel()}</span>
            </div>

          {/* Workflow Actions */}
          <div className="flex items-center gap-2">
            {workflowState.canLock && quarterObjectives.length > 0 && (
              <button
                onClick={handleLockQuarter}
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
          </div>
        </div>

          <p className="text-sm text-gray-600 mt-2">
            Define quarterly objectives for each initiative. Previous quarter results and annual plan context are shown for reference.
          </p>
        </div>
      </div>

      {/* 4-Column Table: Initiative | Annual Plan | Previous Quarter | Current Quarter */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {/* Table Header */}
        <div className="grid grid-cols-12 gap-4 bg-gray-50 border-b border-gray-200 px-4 py-3">
          <div className="col-span-2 text-xs font-semibold text-gray-700 uppercase tracking-wider">
            Initiative
          </div>
          <div className="col-span-4 text-xs font-semibold text-gray-700 uppercase tracking-wider">
            {year} Annual Plan Reference
          </div>
          {previousQuarter && (
            <div className="col-span-3 text-xs font-semibold text-gray-700 uppercase tracking-wider">
              Q{previousQuarter} Results
            </div>
          )}
          <div className={`${previousQuarter ? "col-span-3" : "col-span-6"} text-xs font-semibold text-gray-700 uppercase tracking-wider`}>
            Q{selectedQuarter} Objectives
          </div>
        </div>

        {/* Table Rows Grouped by Area */}
        <div>
          {areas?.map((area) => {
            const areaInitiatives = initiativesByArea[area.id] || [];
            const isAreaCollapsed = collapsedAreas.has(area.id);

            if (areaInitiatives.length === 0) return null;

            return (
              <div key={area.id}>
                {/* Area Separator Row */}
                <div
                  className="bg-blue-900 border-b border-blue-700 px-4 py-2 cursor-pointer hover:bg-blue-800 transition-colors flex items-center gap-2"
                  onClick={() => toggleArea(area.id)}
                >
                  {isAreaCollapsed ? (
                    <ChevronRight className="w-4 h-4 text-white" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-white" />
                  )}
                  <h3 className="text-base font-semibold text-white">{area.name}</h3>
                  <span className="text-xs text-blue-200">
                    ({areaInitiatives.length} initiative{areaInitiatives.length !== 1 ? 's' : ''})
                  </span>
                </div>

                {/* Area Initiatives */}
                {!isAreaCollapsed && (
                  <div className="divide-y divide-gray-200">
                    {areaInitiatives.map((initiative) => {
                      const objectives = objectivesByInitiative[initiative.id] || [];
                      const previousObjectives = previousObjectivesByInitiative[initiative.id] || [];
                      const annualActions = annualActionsByInitiative?.[initiative.id] || [];
                      const annualTargets = annualTargetsByInitiative?.[initiative.id] || [];

                      return (
                        <div key={initiative.id} className="grid grid-cols-12 gap-4 px-4 py-4 hover:bg-gray-50">
                {/* Column 1: Initiative Name (15% ~ 2 cols) */}
                <div className="col-span-2">
                  <div className="sticky top-0">
                    <h4 className="text-sm font-semibold text-gray-900 leading-tight">
                      {initiative.title}
                    </h4>
                    {initiative.area && (
                      <p className="text-xs text-gray-500 mt-1">{initiative.area.name}</p>
                    )}
                  </div>
                </div>

                {/* Column 2: Annual Plan Reference (30% ~ 4 cols) */}
                <div className="col-span-4 space-y-2">
                  {annualActions.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-gray-600 mb-1">Actions:</p>
                      <ul className="space-y-1">
                        {annualActions.map((action) => (
                          <li key={action.id} className="text-xs text-gray-700 pl-2 border-l-2 border-gray-300">
                            {action.action_text}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {annualTargets.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-gray-600 mb-1">Targets:</p>
                      <ul className="space-y-1">
                        {annualTargets.map((target) => (
                          <li key={target.id} className="text-xs text-gray-700 pl-2 border-l-2 border-blue-300">
                            {target.target_text}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {annualActions.length === 0 && annualTargets.length === 0 && (
                    <p className="text-xs text-gray-400 italic">No annual plan items</p>
                  )}
                </div>

                {/* Column 3: Previous Quarter Results (25% ~ 3 cols) - Only show if not Q1 */}
                {previousQuarter && (
                  <div className="col-span-3 space-y-2">
                    {previousObjectives.length > 0 ? (
                      previousObjectives.map((obj) => (
                        <div key={obj.id} className="text-xs bg-gray-50 rounded p-2 border border-gray-200">
                          <p className="text-gray-700 mb-1">{obj.objective_text}</p>
                          <div className="flex items-center gap-2 flex-wrap">
                            {obj.bu_assessment && (
                              <div className="flex items-center gap-1">
                                <span className="text-xs text-gray-600">BU:</span>
                                <span className={`inline-block w-6 h-4 rounded border ${getAssessmentColor(obj.bu_assessment)}`} title={obj.bu_assessment.replace('_', ' ')} />
                              </div>
                            )}
                            {obj.ceo_assessment && (
                              <div className="flex items-center gap-1">
                                <span className="text-xs text-gray-600">CEO:</span>
                                <span className={`inline-block w-6 h-4 rounded border ${getAssessmentColor(obj.ceo_assessment)}`} title={obj.ceo_assessment.replace('_', ' ')} />
                              </div>
                            )}
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-gray-400 italic">No Q{previousQuarter} objectives</p>
                    )}
                  </div>
                )}

                {/* Column 4: Current Quarter Objectives (30% ~ 3 or 6 cols) */}
                <div className={previousQuarter ? "col-span-3" : "col-span-6"}>
                  <div className="space-y-2">
                        {objectives.map((objective) => (
                          <div key={objective.id} className="group border border-gray-200 rounded p-3 hover:border-gray-300">
                            {editingObjective === objective.id ? (
                              <textarea
                                autoFocus
                                defaultValue={objective.objective_text}
                                onBlur={(e) => handleUpdateObjective(objective, { objective_text: e.target.value })}
                                onKeyDown={(e) => {
                                  if (e.key === 'Escape') setEditingObjective(null);
                                }}
                                className="w-full px-2 py-1 text-sm border border-blue-300 rounded focus:ring-2 focus:ring-blue-500"
                                rows={3}
                              />
                            ) : (
                              <>
                                <div className="flex items-start justify-between gap-2">
                                  <p
                                    onClick={() => workflowState.canEdit && setEditingObjective(objective.id)}
                                    className={`flex-1 text-sm text-gray-700 ${workflowState.canEdit ? 'cursor-pointer hover:text-gray-900' : ''}`}
                                  >
                                    {objective.objective_text}
                                  </p>
                                  {workflowState.canEdit && (
                                    <button
                                      onClick={() => handleDeleteObjective(objective)}
                                      className="opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-700"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  )}
                                </div>

                                {/* Scoring UI */}
                                <div className="flex items-center gap-4 mt-3">
                                  {/* BU Score */}
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs font-medium text-gray-600">BU:</span>
                                    {scoringMode === 'bu' && workflowState.canScoreBU ? (
                                      <select
                                        value={objective.bu_assessment || ''}
                                        onChange={(e) => handleUpdateObjective(objective, { bu_assessment: (e.target.value as Assessment) || null })}
                                        className="text-xs border-gray-200 rounded px-2 py-1"
                                      >
                                        <option value="">Not Scored</option>
                                        <option value="dark_green">Dark Green - Excellent</option>
                                        <option value="light_green">Light Green - Good</option>
                                        <option value="light_yellow">Light Yellow - Met</option>
                                        <option value="dark_yellow">Dark Yellow - Below</option>
                                        <option value="red">Red - Poor</option>
                                      </select>
                                    ) : objective.bu_assessment ? (
                                      <span className={`inline-block w-6 h-4 rounded border ${getAssessmentColor(objective.bu_assessment)}`} title={objective.bu_assessment.replace('_', ' ')} />
                                    ) : (
                                      <span className="text-xs text-gray-400">Not scored</span>
                                    )}
                                  </div>

                                  {/* CEO Score */}
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs font-medium text-gray-600">CEO:</span>
                                    {scoringMode === 'ceo' && workflowState.canScoreCEO ? (
                                      <select
                                        value={objective.ceo_assessment || ''}
                                        onChange={(e) => handleUpdateObjective(objective, { ceo_assessment: (e.target.value as Assessment) || null })}
                                        className="text-xs border-gray-200 rounded px-2 py-1"
                                      >
                                        <option value="">Not Scored</option>
                                        <option value="dark_green">Dark Green - Excellent</option>
                                        <option value="light_green">Light Green - Good</option>
                                        <option value="light_yellow">Light Yellow - Met</option>
                                        <option value="dark_yellow">Dark Yellow - Below</option>
                                        <option value="red">Red - Poor</option>
                                      </select>
                                    ) : objective.ceo_assessment ? (
                                      <span className={`inline-block w-6 h-4 rounded border ${getAssessmentColor(objective.ceo_assessment)}`} title={objective.ceo_assessment.replace('_', ' ')} />
                                    ) : (
                                      <span className="text-xs text-gray-400">Not scored</span>
                                    )}
                                  </div>

                                  {objective.locked && (
                                    <div className="flex items-center gap-1 text-xs text-gray-500">
                                      <Lock className="w-3 h-3" />
                                      <span>Locked</span>
                                    </div>
                                  )}
                                </div>
                              </>
                            )}
                          </div>
                        ))}

                        {addingObjective === initiative.id && (
                          <div className="border border-blue-300 rounded p-3">
                            <textarea
                              autoFocus
                              placeholder="Describe the quarterly objective..."
                              onBlur={(e) => {
                                if (e.target.value.trim()) {
                                  handleAddObjective(initiative.id, e.target.value);
                                } else {
                                  setAddingObjective(null);
                                }
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Escape') setAddingObjective(null);
                                if (e.key === 'Enter' && !e.shiftKey) {
                                  e.preventDefault();
                                  if (e.currentTarget.value.trim()) {
                                    handleAddObjective(initiative.id, e.currentTarget.value);
                                  }
                                }
                              }}
                              className="w-full px-2 py-1 text-sm border-0 focus:ring-0"
                              rows={3}
                            />
                          </div>
                        )}

                    {objectives.length === 0 && addingObjective !== initiative.id && (
                      <p className="text-xs text-gray-400 italic">No objectives for Q{selectedQuarter} yet</p>
                    )}

                    {/* Add Objective Button */}
                    {workflowState.canEdit && addingObjective !== initiative.id && (
                      <button
                        onClick={() => setAddingObjective(initiative.id)}
                        className="flex items-center gap-1 px-3 py-2 text-xs text-blue-600 hover:bg-blue-50 rounded transition-colors border border-dashed border-gray-300 hover:border-blue-300 w-full justify-center"
                      >
                        <Plus className="w-3 h-3" />
                        Add Q{selectedQuarter} Objective
                      </button>
                    )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
      </div>
    </div>
  );
}
