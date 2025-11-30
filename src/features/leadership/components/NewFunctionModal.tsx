import { useState } from 'react';
import {
  X,
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
  Crown,
  Plus,
  Search
} from 'lucide-react';
import { useCreateFunction, useAddFunctionOwner, useAddFunctionMember } from '../hooks/useLeadershipQuery';
import { useUsers } from '../../requests/hooks/useRequests';

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

interface NewFunctionModalProps {
  onClose: () => void;
  onSuccess?: () => void;
}

export default function NewFunctionModal({ onClose, onSuccess }: NewFunctionModalProps) {
  const createFunction = useCreateFunction();
  const addFunctionOwner = useAddFunctionOwner();
  const addFunctionMember = useAddFunctionMember();
  const { users, loading: usersLoading } = useUsers();

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    color: '#3B82F6',
    icon: 'Briefcase',
    ownerIds: [] as string[],
    memberIds: [] as string[],
  });

  const [showOwnerPicker, setShowOwnerPicker] = useState(false);
  const [showMemberPicker, setShowMemberPicker] = useState(false);
  const [ownerSearch, setOwnerSearch] = useState('');
  const [memberSearch, setMemberSearch] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      alert('Please enter a function name');
      return;
    }

    try {
      // Create the function
      const newFunction = await createFunction.mutateAsync({
        name: formData.name,
        description: formData.description || undefined,
        color: formData.color,
        icon: formData.icon,
      });

      // Add owners
      if (formData.ownerIds.length > 0) {
        await Promise.all(
          formData.ownerIds.map((userId) =>
            addFunctionOwner.mutateAsync({
              functionId: newFunction.id,
              userId,
            })
          )
        );
      }

      // Add members
      if (formData.memberIds.length > 0) {
        await Promise.all(
          formData.memberIds.map((userId) =>
            addFunctionMember.mutateAsync({
              functionId: newFunction.id,
              userId,
            })
          )
        );
      }

      onSuccess?.();
      onClose();
    } catch (error) {
      console.error('Failed to create function:', error);
      alert('Failed to create function. Please try again.');
    }
  };

  const addOwner = (userId: string) => {
    if (!formData.ownerIds.includes(userId)) {
      setFormData(prev => ({
        ...prev,
        ownerIds: [...prev.ownerIds, userId],
        // Remove from members if they were a member
        memberIds: prev.memberIds.filter(id => id !== userId),
      }));
    }
    setShowOwnerPicker(false);
    setOwnerSearch('');
  };

  const removeOwner = (userId: string) => {
    setFormData(prev => ({
      ...prev,
      ownerIds: prev.ownerIds.filter(id => id !== userId),
    }));
  };

  const addMember = (userId: string) => {
    if (!formData.memberIds.includes(userId) && !formData.ownerIds.includes(userId)) {
      setFormData(prev => ({
        ...prev,
        memberIds: [...prev.memberIds, userId],
      }));
    }
    setShowMemberPicker(false);
    setMemberSearch('');
  };

  const removeMember = (userId: string) => {
    setFormData(prev => ({
      ...prev,
      memberIds: prev.memberIds.filter(id => id !== userId),
    }));
  };

  // Get user details for display
  const getUser = (userId: string) => users.find(u => u.id === userId);

  // Filter users for pickers (exclude already selected)
  const availableOwners = users.filter(
    user => !formData.ownerIds.includes(user.id) &&
    (user.name.toLowerCase().includes(ownerSearch.toLowerCase()) ||
     user.email.toLowerCase().includes(ownerSearch.toLowerCase()))
  );

  const availableMembers = users.filter(
    user => !formData.memberIds.includes(user.id) &&
    !formData.ownerIds.includes(user.id) && // Owners can't be members
    (user.name.toLowerCase().includes(memberSearch.toLowerCase()) ||
     user.email.toLowerCase().includes(memberSearch.toLowerCase()))
  );

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Create New Function</h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Function Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Function Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Marketing, Sales, Operations"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              autoFocus
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Brief description of this function's purpose"
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Icon Picker */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Icon
            </label>
            <div className="grid grid-cols-7 gap-2">
              {FUNCTION_ICONS.map(({ name, Icon }) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => setFormData({ ...formData, icon: name })}
                  className={`p-2 rounded-lg border-2 transition-colors ${
                    formData.icon === name
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                  title={name}
                >
                  <Icon className="w-5 h-5 mx-auto" style={{ color: formData.color }} />
                </button>
              ))}
            </div>
          </div>

          {/* Color */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Color
            </label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={formData.color}
                onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                className="h-10 w-20 border border-gray-300 rounded cursor-pointer"
              />
              <span className="text-sm text-gray-600">{formData.color}</span>
            </div>
          </div>

          {/* Function Owners */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <Crown className="w-3.5 h-3.5 text-amber-500" />
                <span className="text-sm font-medium text-gray-700">Owners</span>
              </div>
              <button
                type="button"
                onClick={() => setShowOwnerPicker(!showOwnerPicker)}
                className="flex items-center gap-1 text-xs text-amber-600 hover:text-amber-700 font-medium"
              >
                <Plus className="w-3 h-3" />
                Add
              </button>
            </div>
            <p className="text-xs text-gray-500 mb-2">
              Owners can edit the function in Leadership Hub
            </p>

            {/* Selected Owners as badges */}
            {formData.ownerIds.length > 0 ? (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {formData.ownerIds.map(userId => {
                  const user = getUser(userId);
                  return user ? (
                    <span
                      key={userId}
                      className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-700 text-white text-xs font-medium rounded-full"
                    >
                      {user.name}
                      <button
                        type="button"
                        onClick={() => removeOwner(userId)}
                        className="ml-0.5 hover:bg-slate-600 rounded-full p-0.5"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ) : null;
                })}
              </div>
            ) : (
              <div className="text-sm text-gray-400 italic mb-2">No owners assigned</div>
            )}

            {/* Owner Picker Dropdown */}
            {showOwnerPicker && (
              <div className="border border-gray-300 rounded-lg overflow-hidden">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={ownerSearch}
                    onChange={(e) => setOwnerSearch(e.target.value)}
                    placeholder="Search users..."
                    className="w-full pl-9 pr-3 py-2 text-sm border-b border-gray-200 focus:outline-none focus:bg-gray-50"
                    autoFocus
                  />
                </div>
                <div className="max-h-32 overflow-y-auto">
                  {usersLoading ? (
                    <div className="p-3 text-sm text-gray-500 text-center">Loading...</div>
                  ) : availableOwners.length === 0 ? (
                    <div className="p-3 text-sm text-gray-500 text-center">
                      {ownerSearch ? 'No users match' : 'No available users'}
                    </div>
                  ) : (
                    availableOwners.slice(0, 5).map(user => (
                      <button
                        key={user.id}
                        type="button"
                        onClick={() => addOwner(user.id)}
                        className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
                      >
                        <div className="font-medium text-gray-900">{user.name}</div>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Function Members */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-blue-500" />
                <span className="text-sm font-medium text-gray-700">Members</span>
              </div>
              <button
                type="button"
                onClick={() => setShowMemberPicker(!showMemberPicker)}
                className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium"
              >
                <Plus className="w-3 h-3" />
                Add
              </button>
            </div>
            <p className="text-xs text-gray-500 mb-2">
              Members can see Team View in My To-Dos
            </p>

            {/* Selected Members as badges */}
            {formData.memberIds.length > 0 ? (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {formData.memberIds.map(userId => {
                  const user = getUser(userId);
                  return user ? (
                    <span
                      key={userId}
                      className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-700 text-white text-xs font-medium rounded-full"
                    >
                      {user.name}
                      <button
                        type="button"
                        onClick={() => removeMember(userId)}
                        className="ml-0.5 hover:bg-slate-600 rounded-full p-0.5"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ) : null;
                })}
              </div>
            ) : (
              <div className="text-sm text-gray-400 italic mb-2">No members assigned</div>
            )}

            {/* Member Picker Dropdown */}
            {showMemberPicker && (
              <div className="border border-gray-300 rounded-lg overflow-hidden">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={memberSearch}
                    onChange={(e) => setMemberSearch(e.target.value)}
                    placeholder="Search users..."
                    className="w-full pl-9 pr-3 py-2 text-sm border-b border-gray-200 focus:outline-none focus:bg-gray-50"
                    autoFocus
                  />
                </div>
                <div className="max-h-32 overflow-y-auto">
                  {usersLoading ? (
                    <div className="p-3 text-sm text-gray-500 text-center">Loading...</div>
                  ) : availableMembers.length === 0 ? (
                    <div className="p-3 text-sm text-gray-500 text-center">
                      {memberSearch ? 'No users match' : 'No available users'}
                    </div>
                  ) : (
                    availableMembers.slice(0, 5).map(user => (
                      <button
                        key={user.id}
                        type="button"
                        onClick={() => addMember(user.id)}
                        className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
                      >
                        <div className="font-medium text-gray-900">{user.name}</div>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createFunction.isPending}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {createFunction.isPending ? 'Creating...' : 'Create Function'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
