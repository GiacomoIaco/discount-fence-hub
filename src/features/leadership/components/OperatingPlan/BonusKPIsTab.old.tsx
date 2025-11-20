import { useState } from 'react';
import { Plus, TrendingUp, DollarSign, Percent, Hash, Type, Award, Users, Calculator } from 'lucide-react';
import {
  useBonusKPIsQuery,
  useCreateBonusKPI,
  useUpdateBonusKPI,
  useDeleteBonusKPI,
} from '../../hooks/useOperatingPlanQuery';
import type { BonusKPI, BonusKPIUnit } from '../../lib/operating-plan.types';

interface BonusKPIsTabProps {
  functionId: string;
  year: number;
}

export default function BonusKPIsTab({ functionId, year }: BonusKPIsTabProps) {
  const [editingKPI, setEditingKPI] = useState<BonusKPI | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [showWeightManager, setShowWeightManager] = useState(false);
  const [showCalculator, setShowCalculator] = useState(false);

  const { data: kpis } = useBonusKPIsQuery(functionId, year);

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-center gap-2 text-blue-900">
          <Award className="w-5 h-5" />
          <span className="font-medium">Annual Bonus KPIs for {year}</span>
        </div>
        <p className="text-sm text-blue-700 mt-1">
          Define high-level outcome metrics, incentive curves, and individual weights for bonus calculations
        </p>
      </div>

      {/* Action Bar */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsCreating(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add KPI
            </button>

            <button
              onClick={() => setShowWeightManager(true)}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
              disabled={!kpis || kpis.length === 0}
            >
              <Users className="w-4 h-4" />
              Manage Weights
            </button>

            <button
              onClick={() => setShowCalculator(true)}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              disabled={!kpis || kpis.length === 0}
            >
              <Calculator className="w-4 h-4" />
              Calculate Bonuses
            </button>
          </div>

          <div className="text-sm text-gray-600">
            {kpis?.length || 0} KPI{(kpis?.length || 0) !== 1 ? 's' : ''}
          </div>
        </div>
      </div>

      {/* KPIs Table */}
      {kpis && kpis.length > 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  KPI Name
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Unit
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Target
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Current
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Incentive Curve
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {kpis.map((kpi) => (
                <KPIRow
                  key={kpi.id}
                  kpi={kpi}
                  onEdit={() => setEditingKPI(kpi)}
                />
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <TrendingUp className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            No Bonus KPIs defined yet
          </h3>
          <p className="text-gray-600 mb-6">
            Create high-level outcome metrics to drive bonus calculations
          </p>
          <button
            onClick={() => setIsCreating(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4 inline-block mr-2" />
            Add First KPI
          </button>
        </div>
      )}

      {/* KPI Editor Modal */}
      {(isCreating || editingKPI) && (
        <KPIEditorModal
          functionId={functionId}
          year={year}
          kpi={editingKPI}
          onClose={() => {
            setIsCreating(false);
            setEditingKPI(null);
          }}
        />
      )}

      {/* Weight Manager Modal */}
      {showWeightManager && kpis && (
        <WeightManagerModal
          functionId={functionId}
          year={year}
          kpis={kpis}
          onClose={() => setShowWeightManager(false)}
        />
      )}

      {/* Bonus Calculator Modal */}
      {showCalculator && kpis && (
        <BonusCalculatorModal
          functionId={functionId}
          year={year}
          kpis={kpis}
          onClose={() => setShowCalculator(false)}
        />
      )}
    </div>
  );
}

// KPI Row Component
interface KPIRowProps {
  kpi: BonusKPI;
  onEdit: () => void;
}

function KPIRow({ kpi, onEdit }: KPIRowProps) {
  const deleteKPI = useDeleteBonusKPI();

  const getUnitIcon = (unit: BonusKPIUnit) => {
    switch (unit) {
      case 'dollars': return <DollarSign className="w-4 h-4" />;
      case 'percent': return <Percent className="w-4 h-4" />;
      case 'score': return <TrendingUp className="w-4 h-4" />;
      case 'count': return <Hash className="w-4 h-4" />;
      case 'text': return <Type className="w-4 h-4" />;
    }
  };

  const formatValue = (value: number | null, unit: BonusKPIUnit) => {
    if (value === null) return '-';
    switch (unit) {
      case 'dollars': return `$${value.toLocaleString()}`;
      case 'percent': return `${value}%`;
      default: return value.toString();
    }
  };

  const getProgress = () => {
    if (kpi.current_value === null || kpi.target_value === null) return null;

    const current = kpi.current_value;
    const target = kpi.target_value;
    const min = kpi.min_threshold || 0;
    const max = kpi.max_threshold || target;

    let multiplier = 1.0;
    let status: 'below' | 'on-track' | 'exceeding' = 'on-track';

    if (current <= min) {
      multiplier = kpi.min_multiplier;
      status = 'below';
    } else if (current >= max) {
      multiplier = kpi.max_multiplier;
      status = 'exceeding';
    } else if (current < target) {
      const range = target - min;
      const position = current - min;
      const multiplierRange = 1.0 - kpi.min_multiplier;
      multiplier = kpi.min_multiplier + (position / range) * multiplierRange;
    } else {
      const range = max - target;
      const position = current - target;
      const multiplierRange = kpi.max_multiplier - 1.0;
      multiplier = 1.0 + (position / range) * multiplierRange;
      status = 'exceeding';
    }

    return { multiplier, status };
  };

  const progress = getProgress();

  return (
    <tr className="hover:bg-gray-50">
      <td className="px-4 py-3">
        <div>
          <div className="font-medium text-gray-900">{kpi.name}</div>
          {kpi.description && (
            <div className="text-sm text-gray-600">{kpi.description}</div>
          )}
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2 text-gray-700">
          {getUnitIcon(kpi.unit)}
          <span className="text-sm capitalize">{kpi.unit}</span>
        </div>
      </td>
      <td className="px-4 py-3 text-sm text-gray-700">
        {kpi.unit === 'text'
          ? (kpi.target_text || '-')
          : formatValue(kpi.target_value, kpi.unit)
        }
      </td>
      <td className="px-4 py-3 text-sm text-gray-700">
        {kpi.unit === 'text'
          ? (kpi.target_text || '-')
          : formatValue(kpi.current_value, kpi.unit)
        }
      </td>
      <td className="px-4 py-3">
        <div className="text-xs text-gray-600">
          Min: {formatValue(kpi.min_threshold, kpi.unit)} → {kpi.min_multiplier}x
          <br />
          Target: {formatValue(kpi.target_value, kpi.unit)} → 1.0x
          <br />
          Max: {formatValue(kpi.max_threshold, kpi.unit)} → {kpi.max_multiplier}x
        </div>
      </td>
      <td className="px-4 py-3">
        {progress ? (
          <div>
            <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
              progress.status === 'below' ? 'bg-red-100 text-red-700' :
              progress.status === 'exceeding' ? 'bg-green-100 text-green-700' :
              'bg-blue-100 text-blue-700'
            }`}>
              {progress.multiplier.toFixed(2)}x
            </div>
          </div>
        ) : (
          <span className="text-sm text-gray-400">No data</span>
        )}
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <button
            onClick={onEdit}
            className="text-sm text-blue-600 hover:text-blue-700 font-medium"
          >
            Edit
          </button>
          <button
            onClick={() => {
              if (confirm('Delete this KPI?')) {
                deleteKPI.mutate(kpi.id);
              }
            }}
            className="text-sm text-red-600 hover:text-red-700 font-medium"
          >
            Delete
          </button>
        </div>
      </td>
    </tr>
  );
}

// KPI Editor Modal
interface KPIEditorModalProps {
  functionId: string;
  year: number;
  kpi: BonusKPI | null;
  onClose: () => void;
}

function KPIEditorModal({ functionId, year, kpi, onClose }: KPIEditorModalProps) {
  const [formData, setFormData] = useState({
    name: kpi?.name || '',
    description: kpi?.description || '',
    unit: (kpi?.unit || 'dollars') as BonusKPIUnit,
    target_value: kpi?.target_value?.toString() || '',
    target_text: kpi?.target_text || '',
    current_value: kpi?.current_value?.toString() || '',
    min_threshold: kpi?.min_threshold?.toString() || '',
    min_multiplier: kpi?.min_multiplier?.toString() || '0.5',
    max_threshold: kpi?.max_threshold?.toString() || '',
    max_multiplier: kpi?.max_multiplier?.toString() || '2.0',
  });

  const createKPI = useCreateBonusKPI();
  const updateKPI = useUpdateBonusKPI();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const data: any = {
      name: formData.name,
      description: formData.description || undefined,
      unit: formData.unit,
      min_multiplier: parseFloat(formData.min_multiplier),
      max_multiplier: parseFloat(formData.max_multiplier),
    };

    if (formData.unit === 'text') {
      data.target_text = formData.target_text || undefined;
    } else {
      data.target_value = formData.target_value ? parseFloat(formData.target_value) : undefined;
      data.current_value = formData.current_value ? parseFloat(formData.current_value) : undefined;
      data.min_threshold = formData.min_threshold ? parseFloat(formData.min_threshold) : undefined;
      data.max_threshold = formData.max_threshold ? parseFloat(formData.max_threshold) : undefined;
    }

    if (kpi) {
      await updateKPI.mutateAsync({ id: kpi.id, ...data });
    } else {
      await createKPI.mutateAsync({
        function_id: functionId,
        year,
        ...data,
      });
    }

    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          {kpi ? 'Edit Bonus KPI' : 'Create Bonus KPI'}
        </h3>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              KPI Name *
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="e.g., Gross Margin %"
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
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              rows={2}
              placeholder="Optional description..."
            />
          </div>

          {/* Unit Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Unit Type *
            </label>
            <select
              required
              value={formData.unit}
              onChange={(e) => setFormData({ ...formData, unit: e.target.value as BonusKPIUnit })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="dollars">Dollars ($)</option>
              <option value="percent">Percent (%)</option>
              <option value="score">Score</option>
              <option value="count">Count (#)</option>
              <option value="text">Text (qualitative)</option>
            </select>
          </div>

          {/* Numeric KPI fields */}
          {formData.unit !== 'text' && (
            <>
              {/* Target Value */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Target Value *
                </label>
                <input
                  type="number"
                  step="any"
                  required
                  value={formData.target_value}
                  onChange={(e) => setFormData({ ...formData, target_value: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="100"
                />
              </div>

              {/* Current Value */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Current Value
                </label>
                <input
                  type="number"
                  step="any"
                  value={formData.current_value}
                  onChange={(e) => setFormData({ ...formData, current_value: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="85"
                />
              </div>

              {/* Incentive Curve */}
              <div className="border-t border-gray-200 pt-4">
                <h4 className="text-sm font-semibold text-gray-900 mb-3">Incentive Curve</h4>

                <div className="grid grid-cols-2 gap-4">
                  {/* Min Threshold */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Min Threshold
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={formData.min_threshold}
                      onChange={(e) => setFormData({ ...formData, min_threshold: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="50"
                    />
                  </div>

                  {/* Min Multiplier */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Min Multiplier *
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      required
                      value={formData.min_multiplier}
                      onChange={(e) => setFormData({ ...formData, min_multiplier: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="0.5"
                    />
                  </div>

                  {/* Max Threshold */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Max Threshold
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={formData.max_threshold}
                      onChange={(e) => setFormData({ ...formData, max_threshold: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="150"
                    />
                  </div>

                  {/* Max Multiplier */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Max Multiplier *
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      required
                      value={formData.max_multiplier}
                      onChange={(e) => setFormData({ ...formData, max_multiplier: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="2.0"
                    />
                  </div>
                </div>

                <div className="mt-3 text-xs text-gray-500">
                  At min threshold: {formData.min_multiplier || 0.5}x multiplier<br />
                  At target: 1.0x multiplier<br />
                  At max threshold: {formData.max_multiplier || 2.0}x multiplier
                </div>
              </div>
            </>
          )}

          {/* Text KPI field */}
          {formData.unit === 'text' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Target Description
              </label>
              <textarea
                value={formData.target_text}
                onChange={(e) => setFormData({ ...formData, target_text: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                rows={3}
                placeholder="Describe the qualitative target..."
              />
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              {kpi ? 'Save Changes' : 'Create KPI'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Weight Manager Modal (Placeholder)
interface WeightManagerModalProps {
  functionId: string;
  year: number;
  kpis: BonusKPI[];
  onClose: () => void;
}

function WeightManagerModal({ onClose }: WeightManagerModalProps) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Manage KPI Weights
        </h3>
        <div className="text-center py-12 text-gray-500">
          Weight assignment interface - Coming soon
          <br />
          <span className="text-sm">
            Assign weights to each KPI per team member (must sum to 100%)
          </span>
        </div>
        <div className="flex justify-end mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// Bonus Calculator Modal (Placeholder)
interface BonusCalculatorModalProps {
  functionId: string;
  year: number;
  kpis: BonusKPI[];
  onClose: () => void;
}

function BonusCalculatorModal({ onClose }: BonusCalculatorModalProps) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Calculate Team Bonuses
        </h3>
        <div className="text-center py-12 text-gray-500">
          Bonus calculator interface - Coming soon
          <br />
          <span className="text-sm">
            Calculate bonus multipliers based on KPI achievement and individual weights
          </span>
        </div>
        <div className="flex justify-end mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
