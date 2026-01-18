// Modal for managing salesperson comparison group and status

import { useState, useEffect } from 'react';
import { X, Users, Check, AlertCircle, Loader2, Save } from 'lucide-react';
import {
  useSalespersonConfigs,
  useBatchUpdateComparisonGroup,
} from '../../../hooks/jobber/residential';

interface ManageSalespeopleModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ManageSalespeopleModal({ isOpen, onClose }: ManageSalespeopleModalProps) {
  const { data: configs, isLoading, error } = useSalespersonConfigs();
  const batchUpdate = useBatchUpdateComparisonGroup();

  // Local state for checkbox selections
  const [localSelections, setLocalSelections] = useState<Record<string, boolean>>({});
  const [hasChanges, setHasChanges] = useState(false);

  // Initialize local state from server data
  useEffect(() => {
    if (configs) {
      const initial: Record<string, boolean> = {};
      for (const c of configs) {
        initial[c.salesperson_name] = c.is_comparison_group;
      }
      setLocalSelections(initial);
      setHasChanges(false);
    }
  }, [configs]);

  if (!isOpen) return null;

  const handleToggle = (name: string) => {
    setLocalSelections((prev) => {
      const newState = { ...prev, [name]: !prev[name] };
      // Check if different from server
      const changed = Object.entries(newState).some(([n, v]) => {
        const serverValue = configs?.find((c) => c.salesperson_name === n)?.is_comparison_group ?? false;
        return v !== serverValue;
      });
      setHasChanges(changed);
      return newState;
    });
  };

  const handleSave = async () => {
    const selected = Object.entries(localSelections)
      .filter(([_, v]) => v)
      .map(([name]) => name);
    await batchUpdate.mutateAsync(selected);
    setHasChanges(false);
  };

  const handleSelectAll = () => {
    const allSelected: Record<string, boolean> = {};
    for (const c of configs || []) {
      allSelected[c.salesperson_name] = true;
    }
    setLocalSelections(allSelected);
    setHasChanges(true);
  };

  const handleSelectNone = () => {
    const noneSelected: Record<string, boolean> = {};
    for (const c of configs || []) {
      noneSelected[c.salesperson_name] = false;
    }
    setLocalSelections(noneSelected);
    setHasChanges(true);
  };

  const selectedCount = Object.values(localSelections).filter(Boolean).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-gray-900">Manage Comparison Group</h2>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Description */}
        <div className="px-4 py-3 bg-blue-50 border-b border-blue-100">
          <p className="text-sm text-blue-800">
            Select salespeople to include in the <strong>comparison group</strong>.
            Only these people will be used when calculating team averages and percentile rankings.
          </p>
        </div>

        {/* Quick actions */}
        <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-200">
          <button
            onClick={handleSelectAll}
            className="text-xs text-blue-600 hover:text-blue-800"
          >
            Select All
          </button>
          <span className="text-gray-300">|</span>
          <button
            onClick={handleSelectNone}
            className="text-xs text-blue-600 hover:text-blue-800"
          >
            Select None
          </button>
          <span className="flex-1" />
          <span className="text-xs text-gray-500">
            {selectedCount} of {configs?.length ?? 0} selected
          </span>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {isLoading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 rounded-lg">
              <AlertCircle className="w-5 h-5" />
              <span className="text-sm">Failed to load salespeople. Is the table created?</span>
            </div>
          )}

          {configs && configs.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              No salespeople found. Upload Jobber data first.
            </div>
          )}

          {configs && configs.length > 0 && (
            <div className="space-y-1">
              {configs.map((config) => (
                <label
                  key={config.salesperson_name}
                  className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors ${
                    localSelections[config.salesperson_name]
                      ? 'bg-blue-50 hover:bg-blue-100'
                      : 'hover:bg-gray-50'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={localSelections[config.salesperson_name] ?? false}
                    onChange={() => handleToggle(config.salesperson_name)}
                    className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="flex-1 text-sm text-gray-900">{config.salesperson_name}</span>
                  {localSelections[config.salesperson_name] && (
                    <Check className="w-4 h-4 text-blue-600" />
                  )}
                </label>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!hasChanges || batchUpdate.isPending}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              hasChanges
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-gray-200 text-gray-500 cursor-not-allowed'
            }`}
          >
            {batchUpdate.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}
