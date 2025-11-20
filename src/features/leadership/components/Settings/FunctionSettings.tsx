import { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Plus,
  Folder,
  Edit2,
  Trash2,
  Briefcase,
  Target,
  TrendingUp,
  Users,
  DollarSign,
  BarChart,
  Wrench,
  Truck,
  Building,
  ShoppingCart,
  Megaphone,
  Award,
  Zap,
  UserPlus
} from 'lucide-react';
import { useFunctionsQuery, useCreateFunction, useUpdateFunction, useAreasQuery, useCreateArea, useUpdateArea, useFunctionOwnersQuery, useAddFunctionOwner, useRemoveFunctionOwner } from '../../hooks/useLeadershipQuery';
import { useUsers } from '../../../requests/hooks/useRequests';
import type { CreateFunctionInput, CreateAreaInput, ProjectFunction, ProjectArea } from '../../lib/leadership';

// Available icons for functions
const FUNCTION_ICONS = [
  { name: 'Briefcase', Icon: Briefcase },
  { name: 'Target', Icon: Target },
  { name: 'TrendingUp', Icon: TrendingUp },
  { name: 'Users', Icon: Users },
  { name: 'DollarSign', Icon: DollarSign },
  { name: 'BarChart', Icon: BarChart },
  { name: 'Wrench', Icon: Wrench },
  { name: 'Truck', Icon: Truck },
  { name: 'Building', Icon: Building },
  { name: 'ShoppingCart', Icon: ShoppingCart },
  { name: 'Megaphone', Icon: Megaphone },
  { name: 'Award', Icon: Award },
  { name: 'Zap', Icon: Zap },
];

interface FunctionSettingsProps {
  onBack: () => void;
}

export default function FunctionSettings({ onBack }: FunctionSettingsProps) {
  const [selectedFunctionId, setSelectedFunctionId] = useState<string | null>(null);
  const [isCreatingFunction, setIsCreatingFunction] = useState(false);
  const [isCreatingArea, setIsCreatingArea] = useState(false);
  const [editingFunction, setEditingFunction] = useState<ProjectFunction | null>(null);
  const [editingArea, setEditingArea] = useState<ProjectArea | null>(null);
  const [deletingFunction, setDeletingFunction] = useState<ProjectFunction | null>(null);
  const [deletingArea, setDeletingArea] = useState<ProjectArea | null>(null);

  const { data: functions, isLoading: functionsLoading } = useFunctionsQuery();
  const { data: areas, isLoading: areasLoading } = useAreasQuery(selectedFunctionId || undefined);
  const createFunction = useCreateFunction();
  const updateFunction = useUpdateFunction();
  const createArea = useCreateArea();
  const updateArea = useUpdateArea();

  const [functionForm, setFunctionForm] = useState<CreateFunctionInput>({
    name: '',
    description: '',
    color: 'blue',
    sort_order: 0,
  });

  const [areaForm, setAreaForm] = useState<CreateAreaInput>({
    function_id: '',
    name: '',
    strategic_description: '',
    sort_order: 0,
  });

  const handleCreateFunction = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createFunction.mutateAsync(functionForm);
      setIsCreatingFunction(false);
      setFunctionForm({ name: '', description: '', color: 'blue', sort_order: 0 });
    } catch (error) {
      console.error('Failed to create function:', error);
    }
  };

  const handleCreateArea = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFunctionId) return;

    try {
      await createArea.mutateAsync({
        ...areaForm,
        function_id: selectedFunctionId,
      });
      setIsCreatingArea(false);
      setAreaForm({ function_id: '', name: '', strategic_description: '', sort_order: 0 });
    } catch (error) {
      console.error('Failed to create area:', error);
    }
  };

  const handleUpdateFunction = async (e: React.FormEvent, editedData?: any) => {
    e.preventDefault();
    if (!editingFunction) return;

    // Use editedData if provided (from modal), otherwise use editingFunction state
    const dataToSave = editedData || editingFunction;

    try {
      await updateFunction.mutateAsync({
        id: editingFunction.id,
        name: dataToSave.name,
        description: dataToSave.description,
        color: dataToSave.color,
        icon: dataToSave.icon,
      });
      // Don't close here - let the modal handle it
      if (!editedData) {
        setEditingFunction(null);
      }
    } catch (error) {
      console.error('Failed to update function:', error);
    }
  };

  const handleDeleteFunction = async () => {
    if (!deletingFunction) return;

    try {
      await updateFunction.mutateAsync({
        id: deletingFunction.id,
        is_active: false,
      });
      setDeletingFunction(null);
      if (selectedFunctionId === deletingFunction.id) {
        setSelectedFunctionId(null);
      }
    } catch (error) {
      console.error('Failed to delete function:', error);
    }
  };

  const handleUpdateArea = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingArea) return;

    try {
      await updateArea.mutateAsync({
        id: editingArea.id,
        name: editingArea.name,
        strategic_description: editingArea.strategic_description,
      });
      setEditingArea(null);
    } catch (error) {
      console.error('Failed to update area:', error);
    }
  };

  const handleDeleteArea = async () => {
    if (!deletingArea) return;

    try {
      await updateArea.mutateAsync({
        id: deletingArea.id,
        is_active: false,
      });
      setDeletingArea(null);
    } catch (error) {
      console.error('Failed to delete area:', error);
    }
  };

  if (functionsLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading functions...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Functions & Areas</h1>
              <p className="text-sm text-gray-600">Manage organizational structure</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-2 gap-6">
          {/* Functions List */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900">Functions</h2>
              <button
                onClick={() => setIsCreatingFunction(true)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
              >
                <Plus className="w-4 h-4" />
                Add Function
              </button>
            </div>

            {/* Create Function Form */}
            {isCreatingFunction && (
              <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 mb-4">
                <h3 className="font-semibold text-gray-900 mb-3">Create New Function</h3>
                <form onSubmit={handleCreateFunction} className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Name *
                    </label>
                    <input
                      type="text"
                      value={functionForm.name}
                      onChange={(e) => setFunctionForm({ ...functionForm, name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Description
                    </label>
                    <textarea
                      value={functionForm.description}
                      onChange={(e) => setFunctionForm({ ...functionForm, description: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      rows={2}
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      disabled={createFunction.isPending}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                    >
                      {createFunction.isPending ? 'Creating...' : 'Create'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsCreatingFunction(false)}
                      className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Edit Function Modal */}
            {editingFunction && (
              <EditFunctionModal
                func={editingFunction}
                onClose={() => setEditingFunction(null)}
                onSave={handleUpdateFunction}
                isLoading={updateFunction.isPending}
              />
            )}

            {/* Delete Function Confirmation */}
            {deletingFunction && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
                  <h3 className="text-lg font-semibold mb-2">Delete Function?</h3>
                  <p className="text-gray-600 mb-4">
                    Are you sure you want to delete "{deletingFunction.name}"? This will also archive all areas and initiatives within this function.
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={handleDeleteFunction}
                      disabled={updateFunction.isPending}
                      className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                    >
                      {updateFunction.isPending ? 'Deleting...' : 'Delete'}
                    </button>
                    <button
                      onClick={() => setDeletingFunction(null)}
                      className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Functions List */}
            <div className="space-y-2">
              {functions && functions.length > 0 ? (
                functions.map((func) => (
                  <div
                    key={func.id}
                    className={`p-4 rounded-lg border-2 transition-all ${
                      selectedFunctionId === func.id
                        ? 'bg-blue-50 border-blue-400'
                        : 'bg-white border-gray-200'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <button
                        onClick={() => setSelectedFunctionId(func.id)}
                        className="flex-1 text-left"
                      >
                        <h3 className="font-semibold text-gray-900">{func.name}</h3>
                        {func.description && (
                          <p className="text-sm text-gray-600 mt-1">{func.description}</p>
                        )}
                        <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                          <span>{func.area_count || 0} areas</span>
                          <span>•</span>
                          <span>{func.initiative_count || 0} initiatives</span>
                        </div>
                      </button>
                      <div className="flex gap-1 ml-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingFunction(func);
                          }}
                          className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                          title="Edit function"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeletingFunction(func);
                          }}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Delete function"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="bg-white rounded-lg border-2 border-dashed border-gray-300 p-8 text-center">
                  <Folder className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                  <p className="text-gray-600 mb-3">No functions yet</p>
                  <button
                    onClick={() => setIsCreatingFunction(true)}
                    className="text-blue-600 hover:text-blue-700 font-medium text-sm"
                  >
                    Create your first function
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Areas List */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900">
                {selectedFunctionId ? 'Areas' : 'Select a Function'}
              </h2>
              {selectedFunctionId && (
                <button
                  onClick={() => setIsCreatingArea(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm"
                >
                  <Plus className="w-4 h-4" />
                  Add Area
                </button>
              )}
            </div>

            {selectedFunctionId ? (
              <>
                {/* Create Bucket Form */}
                {isCreatingArea && (
                  <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 mb-4">
                    <h3 className="font-semibold text-gray-900 mb-3">Create New Area</h3>
                    <form onSubmit={handleCreateArea} className="space-y-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Name *
                        </label>
                        <input
                          type="text"
                          value={areaForm.name}
                          onChange={(e) => setAreaForm({ ...areaForm, name: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Strategic Description
                        </label>
                        <textarea
                          value={areaForm.strategic_description}
                          onChange={(e) => setAreaForm({ ...areaForm, strategic_description: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                          rows={3}
                          placeholder="Describe the strategic direction and purpose..."
                        />
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="submit"
                          disabled={createArea.isPending}
                          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                        >
                          {createArea.isPending ? 'Creating...' : 'Create'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setIsCreatingArea(false)}
                          className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  </div>
                )}

                {/* Edit Area Modal */}
                {editingArea && (
                  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
                      <h3 className="text-lg font-semibold mb-4">Edit Area</h3>
                      <form onSubmit={handleUpdateArea} className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                          <input
                            type="text"
                            value={editingArea.name}
                            onChange={(e) => setEditingArea({ ...editingArea, name: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Strategic Description</label>
                          <textarea
                            value={editingArea.strategic_description || ''}
                            onChange={(e) => setEditingArea({ ...editingArea, strategic_description: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                            rows={3}
                            placeholder="Describe the strategic direction and purpose..."
                          />
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="submit"
                            disabled={updateArea.isPending}
                            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                          >
                            {updateArea.isPending ? 'Saving...' : 'Save'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingArea(null)}
                            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                          >
                            Cancel
                          </button>
                        </div>
                      </form>
                    </div>
                  </div>
                )}

                {/* Delete Area Confirmation */}
                {deletingArea && (
                  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
                      <h3 className="text-lg font-semibold mb-2">Delete Area?</h3>
                      <p className="text-gray-600 mb-4">
                        Are you sure you want to delete "{deletingArea.name}"? This will also archive all initiatives within this area.
                      </p>
                      <div className="flex gap-2">
                        <button
                          onClick={handleDeleteArea}
                          disabled={updateArea.isPending}
                          className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                        >
                          {updateArea.isPending ? 'Deleting...' : 'Delete'}
                        </button>
                        <button
                          onClick={() => setDeletingArea(null)}
                          className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Areas List */}
                {areasLoading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto mb-2"></div>
                    <p className="text-sm text-gray-600">Loading areas...</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {areas && areas.length > 0 ? (
                      areas.map((area) => (
                        <div
                          key={area.id}
                          className="bg-white p-4 rounded-lg border border-gray-200"
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <h3 className="font-semibold text-gray-900">{area.name}</h3>
                              {area.strategic_description && (
                                <p className="text-sm text-gray-600 mt-1">{area.strategic_description}</p>
                              )}
                            </div>
                            <div className="flex gap-1 ml-2">
                              <button
                                onClick={() => setEditingArea(area)}
                                className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                                title="Edit area"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => setDeletingArea(area)}
                                className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                title="Delete area"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="bg-white rounded-lg border-2 border-dashed border-gray-300 p-8 text-center">
                        <p className="text-gray-600 mb-3">No areas yet</p>
                        <button
                          onClick={() => setIsCreatingArea(true)}
                          className="text-green-600 hover:text-green-700 font-medium text-sm"
                        >
                          Create your first area
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </>
            ) : (
              <div className="bg-gray-50 rounded-lg border-2 border-dashed border-gray-300 p-12 text-center">
                <p className="text-gray-500">Select a function to manage its areas</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Edit Function Modal Component with Owner Management
interface EditFunctionModalProps {
  func: ProjectFunction;
  onClose: () => void;
  onSave: (e: React.FormEvent, editedData?: any) => Promise<void>;
  isLoading: boolean;
}

function EditFunctionModal({ func, onClose, onSave, isLoading }: EditFunctionModalProps) {
  const [editedFunction, setEditedFunction] = useState(func);
  const [selectedOwnerIds, setSelectedOwnerIds] = useState<string[]>([]);

  const { data: owners, isLoading: ownersLoading } = useFunctionOwnersQuery(func.id);
  const { users, loading: usersLoading } = useUsers();
  const addOwner = useAddFunctionOwner();
  const removeOwner = useRemoveFunctionOwner();

  // Initialize selected owners from existing owners
  useEffect(() => {
    if (owners) {
      setSelectedOwnerIds(owners.map(o => o.user_id));
    }
  }, [owners]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      // Save function details
      await onSave(e, editedFunction);

      // Update owners
      if (owners && !ownersLoading) {
        const currentOwnerIds = owners.map(o => o.user_id);

        // Add new owners
        const ownersToAdd = selectedOwnerIds.filter(id => !currentOwnerIds.includes(id));
        for (const userId of ownersToAdd) {
          await addOwner.mutateAsync({ functionId: func.id, userId });
        }

        // Remove old owners
        const ownersToRemove = owners.filter(o => !selectedOwnerIds.includes(o.user_id));
        for (const owner of ownersToRemove) {
          await removeOwner.mutateAsync({ id: owner.id, functionId: func.id });
        }
      }

      onClose();
    } catch (error) {
      console.error('Failed to save function:', error);
    }
  };

  const toggleOwner = (userId: string) => {
    setSelectedOwnerIds(prev =>
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <h3 className="text-lg font-semibold mb-4">Edit Function</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
            <input
              type="text"
              value={editedFunction.name}
              onChange={(e) => setEditedFunction({ ...editedFunction, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={editedFunction.description || ''}
              onChange={(e) => setEditedFunction({ ...editedFunction, description: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              rows={3}
            />
          </div>

          {/* Icon Picker */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Icon</label>
            <div className="grid grid-cols-7 gap-2">
              {FUNCTION_ICONS.map(({ name, Icon }) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => setEditedFunction({ ...editedFunction, icon: name })}
                  className={`p-2 rounded-lg border-2 transition-colors ${
                    editedFunction.icon === name
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                  title={name}
                >
                  <Icon className="w-5 h-5 mx-auto" style={{ color: editedFunction.color }} />
                </button>
              ))}
            </div>
          </div>

          {/* Color Picker */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Color</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={editedFunction.color || '#3B82F6'}
                onChange={(e) => setEditedFunction({ ...editedFunction, color: e.target.value })}
                className="h-10 w-20 border border-gray-300 rounded cursor-pointer"
              />
              <span className="text-sm text-gray-600">{editedFunction.color || '#3B82F6'}</span>
            </div>
          </div>

          {/* Function Owners */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <div className="flex items-center gap-2">
                <UserPlus className="w-4 h-4" />
                <span>Function Owners</span>
              </div>
              <span className="text-xs text-gray-500 font-normal mt-1 block">
                Owners can edit the function and receive weekly email summaries
              </span>
            </label>
            {usersLoading || ownersLoading ? (
              <div className="text-sm text-gray-500">Loading users...</div>
            ) : (
              <div className="border border-gray-300 rounded-lg max-h-48 overflow-y-auto">
                {users.length === 0 ? (
                  <div className="p-3 text-sm text-gray-500">No users available</div>
                ) : (
                  users.map((user) => (
                    <label
                      key={user.id}
                      className="flex items-center gap-3 p-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                    >
                      <input
                        type="checkbox"
                        checked={selectedOwnerIds.includes(user.id)}
                        onChange={() => toggleOwner(user.id)}
                        className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                      />
                      <div className="flex-1">
                        <div className="text-sm font-medium text-gray-900">{user.name}</div>
                        <div className="text-xs text-gray-500">{user.email}</div>
                      </div>
                    </label>
                  ))
                )}
              </div>
            )}
            {selectedOwnerIds.length > 0 && (
              <div className="mt-2 text-xs text-gray-600">
                {selectedOwnerIds.length} owner{selectedOwnerIds.length !== 1 ? 's' : ''} selected
              </div>
            )}
          </div>

          <div className="flex gap-2 pt-4">
            <button
              type="submit"
              disabled={isLoading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {isLoading ? 'Saving...' : 'Save'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
