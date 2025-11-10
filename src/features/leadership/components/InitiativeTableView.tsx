import { useState, useEffect } from 'react';
import { Target, AlertCircle, ChevronDown } from 'lucide-react';
import { useUpdateInitiative } from '../hooks/useLeadershipQuery';
import { useInitiativeGoalLinksQuery } from '../hooks/useGoalsQuery';
import type { Initiative } from '../lib/leadership';

interface InitiativeTableViewProps {
  initiatives: Initiative[];
  onInitiativeClick: (initiativeId: string) => void;
}

interface EditingCell {
  initiativeId: string;
  field: 'this_week' | 'next_week' | 'status' | 'priority' | 'progress_percent';
}

export default function InitiativeTableView({ initiatives, onInitiativeClick }: InitiativeTableViewProps) {
  const [editingCell, setEditingCell] = useState<EditingCell | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const updateInitiative = useUpdateInitiative();

  const handleStartEdit = (initiativeId: string, field: EditingCell['field'], currentValue: any) => {
    setEditingCell({ initiativeId, field });
    setEditValue(currentValue?.toString() || '');
  };

  const handleSaveEdit = async (initiativeId: string, field: string) => {
    if (!editingCell) return;

    try {
      let updateData: any = {};

      if (field === 'progress_percent') {
        updateData[field] = parseInt(editValue) || 0;
      } else {
        updateData[field] = editValue || undefined;
      }

      await updateInitiative.mutateAsync({
        id: initiativeId,
        ...updateData,
      });

      setEditingCell(null);
      setEditValue('');
    } catch (error) {
      console.error('Failed to update initiative:', error);
    }
  };

  const handleCancelEdit = () => {
    setEditingCell(null);
    setEditValue('');
  };

  const handleKeyDown = (e: React.KeyboardEvent, initiativeId: string, field: string) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSaveEdit(initiativeId, field);
    } else if (e.key === 'Escape') {
      handleCancelEdit();
    }
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      not_started: 'bg-gray-100 text-gray-700',
      active: 'bg-blue-100 text-blue-700',
      on_hold: 'bg-yellow-100 text-yellow-700',
      at_risk: 'bg-red-100 text-red-700',
      completed: 'bg-green-100 text-green-700',
      cancelled: 'bg-gray-100 text-gray-500',
    };
    return colors[status] || colors.not_started;
  };

  const getPriorityColor = (priority: string) => {
    const colors: Record<string, string> = {
      low: 'bg-gray-100 text-gray-700',
      medium: 'bg-blue-100 text-blue-700',
      high: 'bg-orange-100 text-orange-700',
    };
    return colors[priority] || colors.medium;
  };

  const renderEditableCell = (
    initiative: Initiative,
    field: 'this_week' | 'next_week',
    value: string | null
  ) => {
    const isEditing = editingCell?.initiativeId === initiative.id && editingCell?.field === field;

    if (isEditing) {
      return (
        <textarea
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={() => handleSaveEdit(initiative.id, field)}
          onKeyDown={(e) => handleKeyDown(e, initiative.id, field)}
          className="w-full px-2 py-1 text-sm border border-blue-500 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          rows={2}
          autoFocus
        />
      );
    }

    return (
      <div
        onClick={() => handleStartEdit(initiative.id, field, value)}
        className="w-full px-2 py-1 text-sm text-gray-700 hover:bg-gray-50 rounded cursor-text min-h-[40px]"
      >
        {value || <span className="text-gray-400 italic">Click to edit...</span>}
      </div>
    );
  };

  const renderStatusCell = (initiative: Initiative) => {
    const isEditing = editingCell?.initiativeId === initiative.id && editingCell?.field === 'status';

    if (isEditing) {
      return (
        <select
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={() => handleSaveEdit(initiative.id, 'status')}
          className="w-full px-2 py-1 text-sm border border-blue-500 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          autoFocus
        >
          <option value="not_started">Not Started</option>
          <option value="active">Active</option>
          <option value="on_hold">On Hold</option>
          <option value="at_risk">At Risk</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>
      );
    }

    return (
      <button
        onClick={() => handleStartEdit(initiative.id, 'status', initiative.status)}
        className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(initiative.status)} hover:opacity-80 transition-opacity flex items-center gap-1`}
      >
        {initiative.status.replace('_', ' ')}
        <ChevronDown className="w-3 h-3" />
      </button>
    );
  };

  const renderPriorityCell = (initiative: Initiative) => {
    const isEditing = editingCell?.initiativeId === initiative.id && editingCell?.field === 'priority';

    if (isEditing) {
      return (
        <select
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={() => handleSaveEdit(initiative.id, 'priority')}
          className="w-full px-2 py-1 text-sm border border-blue-500 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          autoFocus
        >
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
        </select>
      );
    }

    return (
      <button
        onClick={() => handleStartEdit(initiative.id, 'priority', initiative.priority)}
        className={`px-2 py-1 text-xs font-medium rounded-full ${getPriorityColor(initiative.priority)} hover:opacity-80 transition-opacity flex items-center gap-1 capitalize`}
      >
        {initiative.priority}
        <ChevronDown className="w-3 h-3" />
      </button>
    );
  };

  const renderProgressCell = (initiative: Initiative) => {
    const isEditing = editingCell?.initiativeId === initiative.id && editingCell?.field === 'progress_percent';

    if (isEditing) {
      return (
        <input
          type="number"
          min="0"
          max="100"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={() => handleSaveEdit(initiative.id, 'progress_percent')}
          onKeyDown={(e) => handleKeyDown(e, initiative.id, 'progress_percent')}
          className="w-full px-2 py-1 text-sm border border-blue-500 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          autoFocus
        />
      );
    }

    return (
      <div
        onClick={() => handleStartEdit(initiative.id, 'progress_percent', initiative.progress_percent)}
        className="cursor-pointer hover:bg-gray-50 rounded p-2"
      >
        <div className="flex items-center gap-2">
          <div className="flex-1 bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all"
              style={{ width: `${Math.min(initiative.progress_percent, 100)}%` }}
            />
          </div>
          <span className="text-xs text-gray-600 w-10 text-right">
            {initiative.progress_percent}%
          </span>
        </div>
      </div>
    );
  };

  const GoalIndicator = ({ initiativeId }: { initiativeId: string }) => {
    const { data: goalLinks } = useInitiativeGoalLinksQuery(initiativeId);
    const hasGoals = goalLinks && goalLinks.length > 0;

    if (!hasGoals) {
      return (
        <div className="flex items-center justify-center text-yellow-600" title="No goals linked">
          <AlertCircle className="w-4 h-4" />
        </div>
      );
    }

    // Check if any linked goal is high-weight (≥25%)
    const hasHighWeightGoal = goalLinks.some((link) => {
      const annualGoal = link.quarterly_goal?.annual_goal;
      return annualGoal && annualGoal.weight >= 25;
    });

    if (hasHighWeightGoal) {
      return (
        <div className="flex items-center justify-center gap-1" title={`${goalLinks.length} goal(s) linked • High Priority`}>
          <span className="text-orange-500 text-base">🔥</span>
          <Target className="w-4 h-4 text-orange-600" />
          <span className="text-xs text-orange-600 font-semibold">{goalLinks.length}</span>
        </div>
      );
    }

    return (
      <div className="flex items-center justify-center text-purple-600" title={`${goalLinks.length} goal(s) linked`}>
        <Target className="w-4 h-4" />
        <span className="text-xs ml-1">{goalLinks.length}</span>
      </div>
    );
  };

  if (initiatives.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        No initiatives to display
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse bg-white">
        <thead>
          <tr className="bg-gray-50 border-b-2 border-gray-200">
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider sticky left-0 bg-gray-50 min-w-[250px]">
              Initiative
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider min-w-[120px]">
              Status
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider min-w-[100px]">
              Priority
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider min-w-[200px]">
              This Week
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider min-w-[200px]">
              Next Week
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider min-w-[150px]">
              Progress
            </th>
            <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider min-w-[80px]">
              Goals
            </th>
          </tr>
        </thead>
        <tbody>
          {initiatives.map((initiative, idx) => (
            <tr
              key={initiative.id}
              className={`border-b border-gray-200 hover:bg-gray-50 transition-colors ${
                idx % 2 === 0 ? 'bg-white' : 'bg-gray-25'
              }`}
            >
              {/* Title */}
              <td className="px-4 py-3 sticky left-0 bg-inherit">
                <button
                  onClick={() => onInitiativeClick(initiative.id)}
                  className="text-left font-medium text-gray-900 hover:text-blue-600 transition-colors"
                >
                  {initiative.title}
                </button>
                <div className="text-xs text-gray-500 mt-0.5">
                  {initiative.area?.name || 'Unknown Area'}
                </div>
              </td>

              {/* Status */}
              <td className="px-4 py-3">{renderStatusCell(initiative)}</td>

              {/* Priority */}
              <td className="px-4 py-3">{renderPriorityCell(initiative)}</td>

              {/* This Week */}
              <td className="px-4 py-3">
                {renderEditableCell(initiative, 'this_week', initiative.this_week)}
              </td>

              {/* Next Week */}
              <td className="px-4 py-3">
                {renderEditableCell(initiative, 'next_week', initiative.next_week)}
              </td>

              {/* Progress */}
              <td className="px-4 py-3">{renderProgressCell(initiative)}</td>

              {/* Goals Indicator */}
              <td className="px-4 py-3">
                <GoalIndicator initiativeId={initiative.id} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
