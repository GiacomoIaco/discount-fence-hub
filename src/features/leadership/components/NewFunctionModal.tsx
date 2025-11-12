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
  Zap
} from 'lucide-react';
import { useCreateFunction } from '../hooks/useLeadershipQuery';

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
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    color: '#3B82F6',
    icon: 'Briefcase',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      alert('Please enter a function name');
      return;
    }

    try {
      await createFunction.mutateAsync({
        name: formData.name,
        description: formData.description || undefined,
        color: formData.color,
        icon: formData.icon,
      });

      onSuccess?.();
      onClose();
    } catch (error) {
      console.error('Failed to create function:', error);
      alert('Failed to create function. Please try again.');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
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
              rows={3}
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
