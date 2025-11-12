import { useState } from 'react';
import { Plus, ChevronDown, ChevronRight, Folder, FolderOpen, Target } from 'lucide-react';
import { useAreasQuery, useInitiativesByFunctionQuery, useUpdateArea, useUpdateInitiative } from '../../hooks/useLeadershipQuery';
import type { ProjectArea, ProjectInitiative } from '../../lib/leadership';

interface AnnualPlanTabProps {
  functionId: string;
  year: number;
}

export default function AnnualPlanTab({ functionId, year }: AnnualPlanTabProps) {
  const { data: areas } = useAreasQuery(functionId);
  const { data: initiatives } = useInitiativesByFunctionQuery(functionId);
  const [collapsedAreas, setCollapsedAreas] = useState<Set<string>>(new Set());
  const [editingStrategicDesc, setEditingStrategicDesc] = useState<string | null>(null);
  const [editingAnnualTarget, setEditingAnnualTarget] = useState<string | null>(null);

  const updateArea = useUpdateArea();
  const updateInitiative = useUpdateInitiative();

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

  const handleSaveAnnualTarget = async (initiative: ProjectInitiative, newTarget: string) => {
    try {
      await updateInitiative.mutateAsync({
        id: initiative.id,
        annual_target: newTarget || undefined,
      });
      setEditingAnnualTarget(null);
    } catch (error) {
      console.error('Failed to update annual target:', error);
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
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <Folder className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            No areas created yet
          </h3>
          <p className="text-gray-600 mb-6">
            Create areas to organize your initiatives and define strategic direction
          </p>
          <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
            <Plus className="w-4 h-4 inline-block mr-2" />
            Create First Area
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Year Context */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-center gap-2 text-blue-900">
          <Target className="w-5 h-5" />
          <span className="font-medium">Annual Plan for {year}</span>
        </div>
        <p className="text-sm text-blue-700 mt-1">
          Define strategic direction and annual targets for each area and initiative
        </p>
      </div>

      {/* Areas */}
      {areas.map((area) => {
        const areaInitiatives = initiativesByArea[area.id] || [];
        const isCollapsed = collapsedAreas.has(area.id);

        return (
          <div key={area.id} className="bg-white rounded-lg border border-gray-200 shadow-sm">
            {/* Area Header */}
            <div className="border-b border-gray-200 p-4 bg-gray-50">
              <button
                onClick={() => toggleAreaCollapse(area.id)}
                className="flex items-center gap-2 w-full text-left"
              >
                {isCollapsed ? (
                  <ChevronRight className="w-5 h-5 text-gray-600 flex-shrink-0" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-gray-600 flex-shrink-0" />
                )}
                {isCollapsed ? (
                  <FolderOpen className="w-5 h-5 text-gray-600 flex-shrink-0" />
                ) : (
                  <Folder className="w-5 h-5 text-gray-600 flex-shrink-0" />
                )}
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900">{area.name}</h3>
                  <p className="text-sm text-gray-600">
                    {areaInitiatives.length} initiative{areaInitiatives.length !== 1 ? 's' : ''}
                  </p>
                </div>
              </button>
            </div>

            {!isCollapsed && (
              <div className="p-6 space-y-6">
                {/* Strategic Description */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Strategic Description
                  </label>
                  {editingStrategicDesc === area.id ? (
                    <div className="space-y-2">
                      <textarea
                        autoFocus
                        defaultValue={area.strategic_description || ''}
                        onBlur={(e) => handleSaveStrategicDescription(area, e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Escape') {
                            setEditingStrategicDesc(null);
                          }
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-h-[100px]"
                        placeholder="Describe the strategic direction for this area..."
                      />
                      <p className="text-xs text-gray-500">
                        Press Esc to cancel • Click outside to save
                      </p>
                    </div>
                  ) : (
                    <div
                      onClick={() => setEditingStrategicDesc(area.id)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg hover:border-gray-300 cursor-text min-h-[100px] whitespace-pre-wrap"
                    >
                      {area.strategic_description || (
                        <span className="text-gray-400 italic">
                          Click to add strategic description...
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Initiatives Table */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-medium text-gray-900">Initiatives</h4>
                    <button className="flex items-center gap-1 px-3 py-1 text-sm text-blue-600 hover:bg-blue-50 rounded transition-colors">
                      <Plus className="w-4 h-4" />
                      Add Initiative
                    </button>
                  </div>

                  {areaInitiatives.length > 0 ? (
                    <div className="border border-gray-200 rounded-lg overflow-hidden">
                      <table className="w-full">
                        <thead className="bg-gray-50 border-b border-gray-200">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                              Initiative
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                              Annual Target
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                              Status
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                              Priority
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {areaInitiatives.map((initiative) => (
                            <tr key={initiative.id} className="hover:bg-gray-50">
                              <td className="px-4 py-3">
                                <button
                                  className="text-left font-medium text-gray-900 hover:text-blue-600 transition-colors"
                                >
                                  {initiative.title}
                                </button>
                              </td>
                              <td className="px-4 py-3">
                                {editingAnnualTarget === initiative.id ? (
                                  <input
                                    type="text"
                                    autoFocus
                                    defaultValue={initiative.annual_target || ''}
                                    onBlur={(e) => handleSaveAnnualTarget(initiative, e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        handleSaveAnnualTarget(initiative, e.currentTarget.value);
                                      } else if (e.key === 'Escape') {
                                        setEditingAnnualTarget(null);
                                      }
                                    }}
                                    className="w-full px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    placeholder="e.g., $7M in revenues at 28%+ margins"
                                  />
                                ) : (
                                  <div
                                    onClick={() => setEditingAnnualTarget(initiative.id)}
                                    className="text-sm text-gray-700 hover:bg-gray-100 px-2 py-1 rounded cursor-text"
                                  >
                                    {initiative.annual_target || (
                                      <span className="text-gray-400 italic">
                                        Click to add target...
                                      </span>
                                    )}
                                  </div>
                                )}
                              </td>
                              <td className="px-4 py-3">
                                <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-700">
                                  {initiative.status?.replace('_', ' ') || 'Not Started'}
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-700 capitalize">
                                  {initiative.priority || 'Medium'}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="border border-gray-200 rounded-lg p-8 text-center">
                      <p className="text-gray-500 text-sm">
                        No initiatives in this area yet
                      </p>
                      <button className="mt-4 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                        <Plus className="w-4 h-4 inline-block mr-2" />
                        Add First Initiative
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}

      {/* Add Area Button */}
      <button className="w-full border-2 border-dashed border-gray-300 rounded-lg p-6 hover:border-gray-400 hover:bg-gray-50 transition-colors text-gray-600 hover:text-gray-900">
        <Plus className="w-5 h-5 inline-block mr-2" />
        Add New Area
      </button>
    </div>
  );
}
