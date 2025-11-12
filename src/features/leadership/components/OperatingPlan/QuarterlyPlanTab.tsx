import { useState } from 'react';
import { ChevronDown, ChevronRight, Folder, FolderOpen, Moon, CheckCircle2, AlertCircle, Clock, Lock, MoveRight } from 'lucide-react';
import { useAreasQuery, useInitiativesByFunctionQuery } from '../../hooks/useLeadershipQuery';
import {
  useQuarterlyObjectivesByFunctionQuery,
  useUpdateQuarterlyObjective,
  useCreateQuarterlyObjective,
} from '../../hooks/useOperatingPlanQuery';
import type { ProjectInitiative } from '../../lib/leadership';
import type { QuarterlyObjective, WorkflowState, QuarterlyScore } from '../../lib/operating-plan.types';

interface QuarterlyPlanTabProps {
  functionId: string;
  year: number;
}

type QuarterNumber = 1 | 2 | 3 | 4;

interface QuarterStatus {
  state: WorkflowState | 'draft';
  label: string;
  color: string;
  icon: React.ReactNode;
  canEdit: boolean;
  canScore: boolean;
  canApprove: boolean;
}

export default function QuarterlyPlanTab({ functionId, year }: QuarterlyPlanTabProps) {
  const [selectedQuarter, setSelectedQuarter] = useState<QuarterNumber>(1);
  const [collapsedAreas, setCollapsedAreas] = useState<Set<string>>(new Set());
  const [scoringObjective, setScoringObjective] = useState<QuarterlyObjective | null>(null);
  const [movingObjective, setMovingObjective] = useState<QuarterlyObjective | null>(null);
  const [editingObjective, setEditingObjective] = useState<QuarterlyObjective | null>(null);
  const [creatingObjective, setCreatingObjective] = useState<{ initiativeId: string; quarter: QuarterNumber } | null>(null);

  const { data: areas } = useAreasQuery(functionId);
  const { data: initiatives } = useInitiativesByFunctionQuery(functionId);
  const { data: allObjectives } = useQuarterlyObjectivesByFunctionQuery(functionId, year);
  const updateObjective = useUpdateQuarterlyObjective();

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

  // Get objectives for a specific quarter
  const quarterObjectives = allObjectives?.filter(obj => obj.quarter === selectedQuarter) || [];

  // Determine quarter status based on objectives workflow states
  const getQuarterStatus = (quarter: QuarterNumber): QuarterStatus => {
    const objectives = allObjectives?.filter(obj => obj.quarter === quarter) || [];

    if (objectives.length === 0) {
      return {
        state: 'draft',
        label: 'Draft - Not Started',
        color: 'gray',
        icon: <Clock className="w-4 h-4" />,
        canEdit: true,
        canScore: false,
        canApprove: false,
      };
    }

    // Check if any objectives are locked (approved)
    const hasLocked = objectives.some(obj => obj.locked);
    const hasScoring = objectives.some(obj => obj.workflow_state === 'bu_scoring');
    const hasPendingReview = objectives.some(obj => obj.workflow_state === 'pending_ceo_review');
    const hasApproved = objectives.some(obj => obj.workflow_state === 'ceo_approved');

    if (hasApproved) {
      return {
        state: 'ceo_approved',
        label: 'Completed & Approved',
        color: 'green',
        icon: <CheckCircle2 className="w-4 h-4" />,
        canEdit: false,
        canScore: false,
        canApprove: false,
      };
    }

    if (hasPendingReview) {
      return {
        state: 'pending_ceo_review',
        label: 'Pending CEO Review',
        color: 'purple',
        icon: <AlertCircle className="w-4 h-4" />,
        canEdit: false,
        canScore: false,
        canApprove: true,
      };
    }

    if (hasScoring) {
      return {
        state: 'bu_scoring',
        label: 'BU Scoring in Progress',
        color: 'yellow',
        icon: <Moon className="w-4 h-4" />,
        canEdit: false,
        canScore: true,
        canApprove: false,
      };
    }

    if (hasLocked) {
      return {
        state: 'draft',
        label: 'Active & Locked',
        color: 'blue',
        icon: <Lock className="w-4 h-4" />,
        canEdit: false,
        canScore: true,
        canApprove: false,
      };
    }

    return {
      state: 'draft',
      label: 'Draft - Ready to Finalize',
      color: 'orange',
      icon: <Clock className="w-4 h-4" />,
      canEdit: true,
      canScore: false,
      canApprove: false,
    };
  };

  const currentQuarterStatus = getQuarterStatus(selectedQuarter);

  // Group initiatives by area
  const initiativesByArea = initiatives?.reduce((acc, initiative) => {
    const areaId = initiative.area?.id || 'uncategorized';
    if (!acc[areaId]) {
      acc[areaId] = [];
    }
    acc[areaId].push(initiative);
    return acc;
  }, {} as Record<string, ProjectInitiative[]>) || {};

  // Get objectives for an initiative across all quarters
  const getInitiativeObjectives = (initiativeId: string) => {
    const byQuarter: Record<QuarterNumber, QuarterlyObjective | undefined> = {
      1: allObjectives?.find(obj => obj.initiative_id === initiativeId && obj.quarter === 1),
      2: allObjectives?.find(obj => obj.initiative_id === initiativeId && obj.quarter === 2),
      3: allObjectives?.find(obj => obj.initiative_id === initiativeId && obj.quarter === 3),
      4: allObjectives?.find(obj => obj.initiative_id === initiativeId && obj.quarter === 4),
    };
    return byQuarter;
  };

  const handleFinalizeQuarter = async () => {
    // Lock all objectives for the selected quarter
    const updates = quarterObjectives.map(obj =>
      updateObjective.mutateAsync({
        id: obj.id,
        locked: true,
      })
    );
    await Promise.all(updates);
  };

  const handleStartScoring = async () => {
    // Move all objectives to bu_scoring state
    const updates = quarterObjectives.map(obj =>
      updateObjective.mutateAsync({
        id: obj.id,
        workflow_state: 'bu_scoring',
      })
    );
    await Promise.all(updates);
  };

  const handleSubmitForReview = async () => {
    // Move all objectives to pending_ceo_review state
    const updates = quarterObjectives.map(obj =>
      updateObjective.mutateAsync({
        id: obj.id,
        workflow_state: 'pending_ceo_review',
        scored_at: new Date().toISOString(),
      })
    );
    await Promise.all(updates);
  };

  const handleCEOApprove = async () => {
    // Move all objectives to ceo_approved state
    const updates = quarterObjectives.map(obj =>
      updateObjective.mutateAsync({
        id: obj.id,
        workflow_state: 'ceo_approved',
        approved_at: new Date().toISOString(),
      })
    );
    await Promise.all(updates);
  };

  if (!areas || areas.length === 0) {
    return (
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <Folder className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            No areas created yet
          </h3>
          <p className="text-gray-600">
            Create areas in the Annual Plan tab first to organize your quarterly objectives
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Quarter Selector and Status */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <label className="text-sm font-medium text-gray-700">Quarter:</label>
            <select
              value={selectedQuarter}
              onChange={(e) => setSelectedQuarter(Number(e.target.value) as QuarterNumber)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
            >
              {[1, 2, 3, 4].map((q) => {
                const status = getQuarterStatus(q as QuarterNumber);
                return (
                  <option key={q} value={q}>
                    Q{q} {year} - {status.label}
                  </option>
                );
              })}
            </select>
          </div>

          {/* Quarter Actions */}
          <div className="flex items-center gap-2">
            {currentQuarterStatus.state === 'draft' && !quarterObjectives.some(obj => obj.locked) && quarterObjectives.length > 0 && (
              <button
                onClick={handleFinalizeQuarter}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
              >
                <Lock className="w-4 h-4" />
                Finalize & Lock Q{selectedQuarter}
              </button>
            )}

            {currentQuarterStatus.state === 'draft' && quarterObjectives.some(obj => obj.locked) && (
              <button
                onClick={handleStartScoring}
                className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors flex items-center gap-2"
              >
                <Moon className="w-4 h-4" />
                Start Scoring
              </button>
            )}

            {currentQuarterStatus.canScore && (
              <button
                onClick={handleSubmitForReview}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4" />
                Submit for CEO Review
              </button>
            )}

            {currentQuarterStatus.canApprove && (
              <button
                onClick={handleCEOApprove}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4" />
                CEO Approve
              </button>
            )}
          </div>
        </div>

        {/* Status Banner */}
        <div className={`bg-${currentQuarterStatus.color}-50 border border-${currentQuarterStatus.color}-200 rounded-lg p-4`}>
          <div className="flex items-center gap-2">
            <span className={`text-${currentQuarterStatus.color}-600`}>
              {currentQuarterStatus.icon}
            </span>
            <span className={`font-medium text-${currentQuarterStatus.color}-900`}>
              Status: {currentQuarterStatus.label}
            </span>
          </div>
          <p className={`text-sm text-${currentQuarterStatus.color}-700 mt-1`}>
            {currentQuarterStatus.state === 'draft' && !quarterObjectives.some(obj => obj.locked) &&
              `Build out Q${selectedQuarter} objectives, then finalize and lock when ready to begin execution.`}
            {currentQuarterStatus.state === 'draft' && quarterObjectives.some(obj => obj.locked) &&
              `Q${selectedQuarter} is active and locked. At end of quarter, start scoring to evaluate achievements.`}
            {currentQuarterStatus.state === 'bu_scoring' &&
              `Score each objective using quarters of moons (0, 0.25, 0.5, 0.75, 1.0), then submit for CEO review.`}
            {currentQuarterStatus.state === 'pending_ceo_review' &&
              `BU has completed scoring. CEO should review and approve final scores.`}
            {currentQuarterStatus.state === 'ceo_approved' &&
              `Q${selectedQuarter} is completed and approved. Scores are finalized.`}
          </p>
        </div>
      </div>

      {/* Areas and Initiatives */}
      {areas.map((area) => {
        const areaInitiatives = initiativesByArea[area.id] || [];
        const isCollapsed = collapsedAreas.has(area.id);

        if (areaInitiatives.length === 0) return null;

        return (
          <div key={area.id} className="bg-white rounded-lg border border-gray-200 shadow-sm">
            {/* Area Header - Compact */}
            <div className="border-b border-blue-700 px-4 py-2 bg-blue-900">
              <button
                onClick={() => toggleAreaCollapse(area.id)}
                className="flex items-center gap-2 w-full text-left"
              >
                {isCollapsed ? (
                  <ChevronRight className="w-4 h-4 text-white flex-shrink-0" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-white flex-shrink-0" />
                )}
                {isCollapsed ? (
                  <Folder className="w-4 h-4 text-white flex-shrink-0" />
                ) : (
                  <FolderOpen className="w-4 h-4 text-white flex-shrink-0" />
                )}
                <div className="flex-1">
                  <h3 className="text-base font-semibold text-white">{area.name}</h3>
                  <p className="text-xs text-blue-200">
                    {areaInitiatives.length} initiative{areaInitiatives.length !== 1 ? 's' : ''}
                  </p>
                </div>
              </button>
            </div>

            {!isCollapsed && (
              <div className="p-6">
                {/* Initiatives Grid */}
                <div className="space-y-4">
                  {areaInitiatives.map((initiative) => {
                    const objectives = getInitiativeObjectives(initiative.id);

                    return (
                      <div key={initiative.id} className="border border-gray-200 rounded-lg overflow-hidden">
                        {/* Initiative Header */}
                        <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                          <h4 className="font-semibold text-gray-900">{initiative.title}</h4>
                          {initiative.annual_target && (
                            <p className="text-sm text-gray-600 mt-1">
                              Annual Target: {initiative.annual_target}
                            </p>
                          )}
                        </div>

                        {/* Quarterly Objectives Grid */}
                        <div className="grid grid-cols-4 divide-x divide-gray-200">
                          {([1, 2, 3, 4] as QuarterNumber[]).map((q) => {
                            const objective = objectives[q];
                            const isSelectedQuarter = q === selectedQuarter;

                            return (
                              <div
                                key={q}
                                className={`p-4 ${isSelectedQuarter ? 'bg-blue-50' : 'bg-white'}`}
                              >
                                <div className="flex items-center justify-between mb-2">
                                  <h5 className="text-xs font-semibold text-gray-700 uppercase">
                                    Q{q}
                                  </h5>
                                  {objective && (
                                    <div className="flex items-center gap-1">
                                      {objective.ceo_score !== null && (
                                        <MoonScoreDisplay score={objective.ceo_score} size="sm" label="CEO" />
                                      )}
                                      {objective.bu_score !== null && objective.ceo_score === null && (
                                        <MoonScoreDisplay score={objective.bu_score} size="sm" label="BU" />
                                      )}
                                    </div>
                                  )}
                                </div>

                                {objective ? (
                                  <div className="space-y-2">
                                    <p className="text-sm text-gray-700">
                                      {objective.objective}
                                    </p>

                                    <div className="flex flex-wrap gap-2">
                                      {currentQuarterStatus.canEdit && isSelectedQuarter && (
                                        <button
                                          onClick={() => setEditingObjective(objective)}
                                          className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                                        >
                                          Edit
                                        </button>
                                      )}

                                      {currentQuarterStatus.canScore && isSelectedQuarter && (
                                        <button
                                          onClick={() => setScoringObjective(objective)}
                                          className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                                        >
                                          {objective.bu_score !== null ? 'Update Score' : 'Add Score'}
                                        </button>
                                      )}

                                      {objective.locked && !objective.ceo_score && isSelectedQuarter && q < 4 && (
                                        <button
                                          onClick={() => setMovingObjective(objective)}
                                          className="text-xs text-orange-600 hover:text-orange-700 font-medium flex items-center gap-1"
                                        >
                                          <MoveRight className="w-3 h-3" />
                                          Move to Q{q + 1}
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => setCreatingObjective({ initiativeId: initiative.id, quarter: q })}
                                    disabled={!currentQuarterStatus.canEdit || !isSelectedQuarter}
                                    className={`text-sm text-left w-full ${
                                      currentQuarterStatus.canEdit && isSelectedQuarter
                                        ? 'text-blue-600 hover:text-blue-700 cursor-pointer'
                                        : 'text-gray-400 cursor-default'
                                    } italic`}
                                  >
                                    {currentQuarterStatus.canEdit && isSelectedQuarter
                                      ? 'Click to add objective...'
                                      : 'TBD - Placeholder'}
                                  </button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        );
      })}

      {/* Scoring Modal */}
      {scoringObjective && (
        <ScoringModal
          objective={scoringObjective}
          onClose={() => setScoringObjective(null)}
        />
      )}

      {/* Move Objective Modal */}
      {movingObjective && (
        <MoveObjectiveModal
          objective={movingObjective}
          onClose={() => setMovingObjective(null)}
        />
      )}

      {/* Objective Editor Modal - Edit */}
      {editingObjective && (
        <ObjectiveEditorModal
          year={year}
          objective={editingObjective}
          onClose={() => setEditingObjective(null)}
        />
      )}

      {/* Objective Editor Modal - Create */}
      {creatingObjective && (
        <ObjectiveEditorModal
          year={year}
          initiativeId={creatingObjective.initiativeId}
          quarter={creatingObjective.quarter}
          onClose={() => setCreatingObjective(null)}
        />
      )}
    </div>
  );
}

// Moon Score Display Component
interface MoonScoreDisplayProps {
  score: QuarterlyScore;
  size?: 'sm' | 'md' | 'lg';
  label?: string;
}

function MoonScoreDisplay({ score, size = 'md', label }: MoonScoreDisplayProps) {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
  };

  const getMoonIcon = () => {
    // Map score to moon phases
    const fillPercentage = score * 100;
    return (
      <div className="relative" title={`${score} (${fillPercentage}%)`}>
        <Moon className={`${sizeClasses[size]} text-gray-300`} />
        <div
          className={`absolute inset-0 overflow-hidden`}
          style={{ clipPath: `inset(0 ${100 - fillPercentage}% 0 0)` }}
        >
          <Moon className={`${sizeClasses[size]} text-yellow-500`} fill="currentColor" />
        </div>
      </div>
    );
  };

  return (
    <div className="flex items-center gap-1">
      {getMoonIcon()}
      {label && <span className="text-xs text-gray-600">{label}</span>}
    </div>
  );
}

// Scoring Modal Component
interface ScoringModalProps {
  objective: QuarterlyObjective;
  onClose: () => void;
}

function ScoringModal({ objective, onClose }: ScoringModalProps) {
  const [score, setScore] = useState<QuarterlyScore>(objective.bu_score || 0);
  const updateObjective = useUpdateQuarterlyObjective();

  const scores: QuarterlyScore[] = [0, 0.25, 0.5, 0.75, 1.0];

  const handleSave = async () => {
    await updateObjective.mutateAsync({
      id: objective.id,
      bu_score: score,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Score Objective - Q{objective.quarter}
        </h3>

        <div className="bg-gray-50 p-4 rounded-lg mb-6">
          <p className="text-sm text-gray-700">{objective.objective}</p>
        </div>

        <div className="space-y-3 mb-6">
          <label className="block text-sm font-medium text-gray-700">
            Select Achievement Level (Quarters of Moons)
          </label>
          <div className="grid grid-cols-5 gap-2">
            {scores.map((s) => (
              <button
                key={s}
                onClick={() => setScore(s)}
                className={`p-4 border-2 rounded-lg transition-all ${
                  score === s
                    ? 'border-blue-600 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <MoonScoreDisplay score={s} size="lg" />
                <p className="text-xs text-gray-600 mt-2 text-center">{s}</p>
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Save Score
          </button>
        </div>
      </div>
    </div>
  );
}

// Move Objective Modal Component
interface MoveObjectiveModalProps {
  objective: QuarterlyObjective;
  onClose: () => void;
}

function MoveObjectiveModal({ objective, onClose }: MoveObjectiveModalProps) {
  const [targetQuarter, setTargetQuarter] = useState<QuarterNumber>(
    Math.min(objective.quarter + 1, 4) as QuarterNumber
  );
  const updateObjective = useUpdateQuarterlyObjective();

  const handleMove = async () => {
    // Update the objective to the new quarter
    await updateObjective.mutateAsync({
      id: objective.id,
      quarter: targetQuarter,
      locked: false,
      workflow_state: 'draft',
      bu_score: null,
      ceo_score: null,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Move Objective to Another Quarter
        </h3>

        <div className="bg-gray-50 p-4 rounded-lg mb-6">
          <p className="text-sm text-gray-700 mb-2">{objective.objective}</p>
          <p className="text-xs text-gray-500">Currently in Q{objective.quarter}</p>
        </div>

        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Move to Quarter:
          </label>
          <select
            value={targetQuarter}
            onChange={(e) => setTargetQuarter(Number(e.target.value) as QuarterNumber)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            {[1, 2, 3, 4].filter(q => q !== objective.quarter).map((q) => (
              <option key={q} value={q}>Q{q}</option>
            ))}
          </select>
          <p className="text-xs text-gray-500 mt-2">
            Note: This will reset the objective to draft state and clear any scores.
          </p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleMove}
            className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
          >
            Move Objective
          </button>
        </div>
      </div>
    </div>
  );
}

// Objective Editor Modal Component
interface ObjectiveEditorModalProps {
  year: number;
  objective?: QuarterlyObjective;
  initiativeId?: string;
  quarter?: QuarterNumber;
  onClose: () => void;
}

function ObjectiveEditorModal({ year, objective, initiativeId, quarter, onClose }: ObjectiveEditorModalProps) {
  const [objectiveText, setObjectiveText] = useState(objective?.objective || '');
  const createObjective = useCreateQuarterlyObjective();
  const updateObjective = useUpdateQuarterlyObjective();

  const handleSave = async () => {
    if (objective) {
      // Edit existing objective
      await updateObjective.mutateAsync({
        id: objective.id,
        objective: objectiveText,
      });
    } else if (initiativeId && quarter) {
      // Create new objective
      await createObjective.mutateAsync({
        initiative_id: initiativeId,
        year,
        quarter,
        objective: objectiveText,
      });
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          {objective ? 'Edit Objective' : `Add Q${quarter} Objective`}
        </h3>

        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Objective Description
          </label>
          <textarea
            autoFocus
            value={objectiveText}
            onChange={(e) => setObjectiveText(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-h-[100px]"
            placeholder="Describe what should be achieved this quarter..."
          />
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!objectiveText.trim()}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {objective ? 'Save Changes' : 'Create Objective'}
          </button>
        </div>
      </div>
    </div>
  );
}
