import { useState } from 'react';
import { Plus, ChevronDown, ChevronRight, FolderOpen, Target, Trash2 } from 'lucide-react';
import { useAreasQuery, useInitiativesByFunctionQuery, useUpdateArea, useUpdateInitiative, useDeleteArea } from '../../hooks/useLeadershipQuery';
import type { ProjectArea, ProjectInitiative } from '../../lib/leadership';
import AreaManagementModal from '../AreaManagementModal';
import InitiativeDetailModal from '../InitiativeDetailModal';
import { toast } from 'react-hot-toast';

interface AnnualPlanTabProps {
  functionId: string;
  year: number;
}

export default function AnnualPlanTab({ functionId, year }: AnnualPlanTabProps) {
  const { data: areas } = useAreasQuery(functionId);
  const { data: initiatives } = useInitiativesByFunctionQuery(functionId);
  const [collapsedStrategicDesc, setCollapsedStrategicDesc] = useState<Set<string>>(new Set(areas?.map(a => a.id) || []));
  const [editingField, setEditingField] = useState<{ type: 'strategic_desc' | 'title' | 'description' | 'annual_target'; id: string } | null>(null);
  const [showAreaModal, setShowAreaModal] = useState(false);
  const [showInitiativeModal, setShowInitiativeModal] = useState<{ areaId?: string } | null>(null);

  const updateArea = useUpdateArea();
  const updateInitiative = useUpdateInitiative();
  const deleteArea = useDeleteArea();

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

  const handleSaveInitiativeField = async (
    initiative: ProjectInitiative,
    field: 'title' | 'description' | 'annual_target',
    value: string
  ) => {
    try {
      await updateInitiative.mutateAsync({
        id: initiative.id,
        [field]: value || undefined,
      });
      setEditingField(null);
    } catch (error) {
      console.error(`Failed to update ${field}:`, error);
    }
  };

  const handleDeleteArea = async (area: ProjectArea, initiativesCount: number) => {
    const confirmMessage = initiativesCount > 0
      ? `Are you sure you want to delete "${area.name}"? This will also delete ${initiativesCount} initiative${initiativesCount !== 1 ? 's' : ''} and all their quarterly objectives.`
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

  return (
    <div className="max-w-full mx-auto space-y-4">
      {/* Header */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-blue-900">
            <Target className="w-5 h-5" />
            <span className="font-medium">Annual Plan for {year}</span>
          </div>
          <button
            onClick={() => setShowAreaModal(true)}
            className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Area
          </button>
        </div>
        <p className="text-sm text-blue-700 mt-1">
          Define key initiatives, descriptions, and annual targets for each area
        </p>
      </div>

      {/* Areas - Compact Tabular View */}
      {areas.map((area) => {
        const areaInitiatives = initiativesByArea[area.id] || [];
        const isStratDescCollapsed = collapsedStrategicDesc.has(area.id);

        return (
          <div key={area.id} className="bg-white rounded-lg border border-gray-200">
            {/* Area Header - Compact */}
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

            {/* Initiatives Table - Compact */}
            {areaInitiatives.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider w-[25%]">
                        Initiative
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider w-[45%]">
                        Description / Details
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider w-[30%]">
                        Annual Target
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {areaInitiatives.map((initiative) => (
                      <tr key={initiative.id} className="hover:bg-gray-50">
                        {/* Initiative Name */}
                        <td className="px-3 py-2 align-top">
                          {editingField?.type === 'title' && editingField.id === initiative.id ? (
                            <input
                              type="text"
                              autoFocus
                              defaultValue={initiative.title}
                              onBlur={(e) => handleSaveInitiativeField(initiative, 'title', e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Escape') {
                                  setEditingField(null);
                                } else if (e.key === 'Enter') {
                                  handleSaveInitiativeField(initiative, 'title', e.currentTarget.value);
                                }
                              }}
                              className="w-full px-2 py-1 text-sm font-medium border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                              placeholder="Initiative name"
                            />
                          ) : (
                            <div
                              onClick={() => setEditingField({ type: 'title', id: initiative.id })}
                              className="w-full px-2 py-1 text-sm font-medium border border-transparent rounded hover:border-gray-300 hover:bg-gray-50 cursor-text text-gray-900"
                            >
                              {initiative.title}
                            </div>
                          )}
                        </td>

                        {/* Description */}
                        <td className="px-3 py-2 align-top">
                          {editingField?.type === 'description' && editingField.id === initiative.id ? (
                            <textarea
                              autoFocus
                              defaultValue={initiative.description || ''}
                              onBlur={(e) => handleSaveInitiativeField(initiative, 'description', e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Escape') {
                                  setEditingField(null);
                                }
                              }}
                              className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-h-[60px]"
                              placeholder="What is this initiative and why does it matter?"
                            />
                          ) : (
                            <div
                              onClick={() => setEditingField({ type: 'description', id: initiative.id })}
                              className="w-full px-2 py-1 text-sm border border-transparent rounded hover:border-gray-300 hover:bg-gray-50 cursor-text min-h-[60px]"
                            >
                              {initiative.description ? (
                                <p className="text-gray-700 whitespace-pre-wrap">{initiative.description}</p>
                              ) : (
                                <p className="text-gray-400 italic">Click to add description...</p>
                              )}
                            </div>
                          )}
                        </td>

                        {/* Annual Target */}
                        <td className="px-3 py-2 align-top">
                          {editingField?.type === 'annual_target' && editingField.id === initiative.id ? (
                            <input
                              type="text"
                              autoFocus
                              defaultValue={initiative.annual_target || ''}
                              onBlur={(e) => handleSaveInitiativeField(initiative, 'annual_target', e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Escape') {
                                  setEditingField(null);
                                } else if (e.key === 'Enter') {
                                  handleSaveInitiativeField(initiative, 'annual_target', e.currentTarget.value);
                                }
                              }}
                              className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                              placeholder="e.g., $7M revenue at 28%+ margins"
                            />
                          ) : (
                            <div
                              onClick={() => setEditingField({ type: 'annual_target', id: initiative.id })}
                              className="w-full px-2 py-1 text-sm border border-transparent rounded hover:border-gray-300 hover:bg-gray-50 cursor-text"
                            >
                              {initiative.annual_target ? (
                                <p className="text-gray-700">{initiative.annual_target}</p>
                              ) : (
                                <p className="text-gray-400 italic">Click to add target...</p>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
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
