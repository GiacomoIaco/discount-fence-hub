import { useState } from 'react';
import { X, Plus, Edit2, FolderOpen } from 'lucide-react';
import { useAreasQuery, useCreateArea, useUpdateArea } from '../hooks/useLeadershipQuery';
import type { CreateAreaInput, ProjectArea } from '../lib/leadership';

interface AreaManagementModalProps {
  functionId: string;
  onClose: () => void;
}

export default function AreaManagementModal({ functionId, onClose }: AreaManagementModalProps) {
  const { data: areas, isLoading } = useAreasQuery(functionId);
  const createArea = useCreateArea();
  const updateArea = useUpdateArea();

  const [isCreating, setIsCreating] = useState(false);
  const [editingArea, setEditingArea] = useState<ProjectArea | null>(null);
  const [formData, setFormData] = useState<CreateAreaInput>({
    function_id: functionId,
    name: '',
    description: '',
    sort_order: 0,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (editingArea) {
        await updateArea.mutateAsync({
          id: editingArea.id,
          ...formData,
        });
        setEditingArea(null);
      } else {
        await createArea.mutateAsync(formData);
      }

      setIsCreating(false);
      setFormData({
        function_id: functionId,
        name: '',
        description: '',
        sort_order: 0,
      });
    } catch (error) {
      console.error('Failed to save area:', error);
    }
  };

  const handleEdit = (area: ProjectArea) => {
    setEditingArea(area);
    setFormData({
      function_id: area.function_id,
      name: area.name,
      description: area.description || '',
      sort_order: area.sort_order,
    });
    setIsCreating(true);
  };

  const handleCancel = () => {
    setIsCreating(false);
    setEditingArea(null);
    setFormData({
      function_id: functionId,
      name: '',
      description: '',
      sort_order: 0,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <FolderOpen className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Manage Areas</h2>
              <p className="text-sm text-gray-600">Organize initiatives into areas</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {isLoading ? (
            <div className="text-center py-12 text-gray-500">
              Loading areas...
            </div>
          ) : (
            <>
              {/* Areas List */}
              <div className="space-y-3 mb-6">
                {areas && areas.length > 0 ? (
                  areas.map((area) => (
                    <div
                      key={area.id}
                      className="bg-gray-50 rounded-lg p-4 flex items-start justify-between hover:bg-gray-100 transition-colors"
                    >
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900">{area.name}</h3>
                        {area.description && (
                          <p className="text-sm text-gray-600 mt-1">{area.description}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleEdit(area)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Edit area"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <FolderOpen className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <p>No areas yet. Create your first area to get started.</p>
                  </div>
                )}
              </div>

              {/* Create/Edit Form */}
              {isCreating ? (
                <div className="bg-white rounded-lg border border-gray-200 p-4">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    {editingArea ? 'Edit Area' : 'Create New Area'}
                  </h3>

                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Area Name *
                      </label>
                      <input
                        type="text"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="e.g., Process Improvement, Cost Reduction"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Description
                      </label>
                      <textarea
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        rows={2}
                        placeholder="Optional description of this area"
                      />
                    </div>

                    <div className="flex items-center gap-3 pt-2">
                      <button
                        type="submit"
                        className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors font-medium"
                      >
                        {editingArea ? 'Update Area' : 'Create Area'}
                      </button>
                      <button
                        type="button"
                        onClick={handleCancel}
                        className="flex-1 bg-gray-100 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-200 transition-colors font-medium"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                </div>
              ) : (
                <button
                  onClick={() => setIsCreating(true)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                >
                  <Plus className="w-5 h-5" />
                  Add New Area
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
