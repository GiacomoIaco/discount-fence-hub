import { useState } from 'react';
import { Plus, Edit2, Trash2, Wrench, Building2 } from 'lucide-react';
import { useProjectTypes, useDeleteProjectType } from '../hooks';
import type { ProjectType } from '../types';
import ProjectTypeEditorModal from './ProjectTypeEditorModal';
import { useBusinessUnits } from '../../settings/hooks/useBusinessUnits';

interface ProjectTypesListProps {
  filterByBusinessUnit?: string;
}

export default function ProjectTypesList({ filterByBusinessUnit }: ProjectTypesListProps) {
  const { data: projectTypes, isLoading } = useProjectTypes(filterByBusinessUnit);
  const { data: businessUnits } = useBusinessUnits();
  const deleteMutation = useDeleteProjectType();

  const [showEditor, setShowEditor] = useState(false);
  const [editingType, setEditingType] = useState<ProjectType | null>(null);
  const [selectedBU, setSelectedBU] = useState<string>(filterByBusinessUnit || '');

  const handleEdit = (projectType: ProjectType) => {
    setEditingType(projectType);
    setShowEditor(true);
  };

  const handleDelete = async (projectType: ProjectType) => {
    if (!confirm(`Delete project type "${projectType.name}"? This may affect team skills.`)) return;
    await deleteMutation.mutateAsync(projectType.id);
  };

  const handleClose = () => {
    setShowEditor(false);
    setEditingType(null);
  };

  // Filter by selected BU if not passed as prop
  const filteredTypes = selectedBU && !filterByBusinessUnit
    ? projectTypes?.filter(pt => pt.business_unit_id === selectedBU)
    : projectTypes;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin w-6 h-6 border-2 border-green-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Project Types</h3>
          <p className="text-sm text-gray-500">
            Fence types and skills that can be assigned to team members
          </p>
        </div>
        <div className="flex items-center gap-3">
          {!filterByBusinessUnit && businessUnits && businessUnits.length > 1 && (
            <select
              value={selectedBU}
              onChange={(e) => setSelectedBU(e.target.value)}
              className="text-sm border border-gray-300 rounded-lg px-3 py-2"
            >
              <option value="">All Business Units</option>
              {businessUnits.map(bu => (
                <option key={bu.id} value={bu.id}>{bu.name}</option>
              ))}
            </select>
          )}
          <button
            onClick={() => setShowEditor(true)}
            className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2 text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            Add Project Type
          </button>
        </div>
      </div>

      {/* List */}
      {filteredTypes && filteredTypes.length > 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 divide-y">
          {filteredTypes.map((projectType) => (
            <div
              key={projectType.id}
              className="flex items-center justify-between p-4 hover:bg-gray-50"
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                  <Wrench className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900">{projectType.name}</span>
                    <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded font-mono">
                      {projectType.code}
                    </span>
                    {!projectType.is_active && (
                      <span className="text-xs px-2 py-0.5 bg-red-100 text-red-600 rounded">
                        Inactive
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-gray-500 flex items-center gap-3 mt-0.5">
                    {projectType.business_unit && (
                      <span className="flex items-center gap-1">
                        <Building2 className="w-3.5 h-3.5" />
                        {projectType.business_unit.name}
                      </span>
                    )}
                    {projectType.description && (
                      <span className="text-gray-400">
                        {projectType.description}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => handleEdit(projectType)}
                  className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                  title="Edit"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDelete(projectType)}
                  className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                  title="Delete"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
          <Wrench className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 mb-4">No project types defined yet</p>
          <button
            onClick={() => setShowEditor(true)}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium"
          >
            Create First Project Type
          </button>
        </div>
      )}

      {/* Editor Modal */}
      {showEditor && (
        <ProjectTypeEditorModal
          projectType={editingType}
          defaultBusinessUnitId={selectedBU || filterByBusinessUnit}
          onClose={handleClose}
        />
      )}
    </div>
  );
}
