import { useState } from 'react';
import { Plus, ChevronDown, ChevronRight, FolderOpen, Target, Trash2, Archive, ArchiveRestore } from 'lucide-react';
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
  useDeleteAnnualAction,
  useCreateAnnualTarget,
  useUpdateAnnualTarget,
} from '../../hooks/useLeadershipQuery';
import type { ProjectArea, ProjectInitiative } from '../../lib/leadership';
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
  const [editingActions, setEditingActions] = useState<string | null>(null); // initiative ID being edited
  const [editingTarget, setEditingTarget] = useState<string | null>(null); // initiative ID being edited
  const [actionsText, setActionsText] = useState<string>(''); // temp text for actions
  const [targetText, setTargetText] = useState<string>(''); // temp text for target

  const updateArea = useUpdateArea();
  const deleteArea = useDeleteArea();
  const deactivateArea = useDeactivateArea();
  const activateArea = useActivateArea();
  const deactivateInitiative = useDeactivateInitiative();
  const activateInitiative = useActivateInitiative();
  const createAction = useCreateAnnualAction();
  const deleteAction = useDeleteAnnualAction();
  const createTarget = useCreateAnnualTarget();
  const updateTarget = useUpdateAnnualTarget();

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

  // Save actions - parse text into bullet points
  const handleSaveActions = async (initiativeId: string, text: string) => {
    const existingActions = actionsByInitiative?.[initiativeId] || [];

    // Parse text into lines (each line starting with - is an action)
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    const newActionTexts = lines.map(l => l.startsWith('-') ? l.substring(1).trim() : l);

    try {
      // Delete all existing actions
      for (const action of existingActions) {
        await deleteAction.mutateAsync({ id: action.id, initiative_id: initiativeId, year });
      }

      // Create new actions
      for (let i = 0; i < newActionTexts.length; i++) {
        if (newActionTexts[i].trim()) {
          await createAction.mutateAsync({
            initiative_id: initiativeId,
            year,
            action_text: newActionTexts[i],
            sort_order: i,
          });
        }
      }

      setEditingActions(null);
      toast.success('Actions updated');
    } catch (error) {
      console.error('Failed to save actions:', error);
      toast.error('Failed to save actions');
    }
  };

  // Save target
  const handleSaveTarget = async (initiativeId: string, text: string) => {
    const existingTargets = targetsByInitiative?.[initiativeId] || [];

    try {
      // Delete all existing targets
      for (const target of existingTargets) {
        await updateTarget.mutateAsync({
          id: target.id,
          initiative_id: initiativeId,
          year,
        });
      }

      // Create/update single target
      if (text.trim()) {
        if (existingTargets.length > 0) {
          await updateTarget.mutateAsync({
            id: existingTargets[0].id,
            initiative_id: initiativeId,
            year,
            metric_name: 'Annual Target',
            target_value: text,
          });
        } else {
          await createTarget.mutateAsync({
            initiative_id: initiativeId,
            year,
            metric_name: 'Annual Target',
            target_value: text,
            sort_order: 0,
          });
        }
      }

      setEditingTarget(null);
      toast.success('Target updated');
    } catch (error) {
      console.error('Failed to save target:', error);
      toast.error('Failed to save target');
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
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider w-1/5">
                        Initiative
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider w-[45%]">
                        Actions/Objectives
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider w-[30%]">
                        Annual Target
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {areaInitiatives.map((initiative) => {
                      const actions = actionsByInitiative?.[initiative.id] || [];
                      const targets = targetsByInitiative?.[initiative.id] || [];
                      const actionsTextValue = actions.map(a => `- ${a.action_text}`).join('\n');
                      const targetValue = targets[0]?.target_value || '';

                      return (
                        <tr key={initiative.id} className="hover:bg-gray-50">
                          {/* Initiative Name */}
                          <td className="px-4 py-4 align-top">
                            <div className="flex items-start gap-2">
                              <span className="w-2 h-2 bg-red-600 rounded-full flex-shrink-0 mt-1"></span>
                              <div className="flex-1">
                                <div className="font-semibold text-red-600 text-sm">
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
                            {editingActions === initiative.id ? (
                              <textarea
                                autoFocus
                                value={actionsText}
                                onChange={(e) => setActionsText(e.target.value)}
                                onBlur={() => handleSaveActions(initiative.id, actionsText)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Escape') {
                                    setEditingActions(null);
                                  }
                                }}
                                className="w-full px-3 py-2 text-sm border border-blue-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-h-[100px]"
                                placeholder="Add actions (one per line, use - for bullets)&#10;- Action 1&#10;- Action 2"
                              />
                            ) : (
                              <div
                                onClick={() => {
                                  setActionsText(actionsTextValue);
                                  setEditingActions(initiative.id);
                                }}
                                className="w-full px-3 py-2 text-sm border border-transparent rounded hover:border-gray-300 hover:bg-gray-100 cursor-text min-h-[60px]"
                              >
                                {actions.length > 0 ? (
                                  <div className="text-gray-700 space-y-1">
                                    {actions.map((action) => (
                                      <div key={action.id} className="flex gap-2">
                                        <span>-</span>
                                        <span>{action.action_text}</span>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <p className="text-gray-400 italic">Click to add actions...</p>
                                )}
                              </div>
                            )}
                          </td>

                          {/* Annual Target */}
                          <td className="px-4 py-4 align-top">
                            {editingTarget === initiative.id ? (
                              <input
                                type="text"
                                autoFocus
                                value={targetText}
                                onChange={(e) => setTargetText(e.target.value)}
                                onBlur={() => handleSaveTarget(initiative.id, targetText)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Escape') {
                                    setEditingTarget(null);
                                  } else if (e.key === 'Enter') {
                                    handleSaveTarget(initiative.id, targetText);
                                  }
                                }}
                                className="w-full px-3 py-2 text-sm border border-blue-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                placeholder="e.g., $7M revenue at 27%+ margins"
                              />
                            ) : (
                              <div
                                onClick={() => {
                                  setTargetText(targetValue);
                                  setEditingTarget(initiative.id);
                                }}
                                className="w-full px-3 py-2 text-sm border border-transparent rounded hover:border-gray-300 hover:bg-gray-100 cursor-text"
                              >
                                {targetValue ? (
                                  <p className="text-gray-700">{targetValue}</p>
                                ) : (
                                  <p className="text-gray-400 italic">Click to add target...</p>
                                )}
                              </div>
                            )}
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
