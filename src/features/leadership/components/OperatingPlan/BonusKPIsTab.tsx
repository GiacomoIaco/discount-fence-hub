import { useState, useMemo } from 'react';
import { Plus, Award, Save, X, Trash2, Edit2, Check, AlertCircle } from 'lucide-react';
import {
  useBonusKPIsQuery,
  useCreateBonusKPI,
  useUpdateBonusKPI,
  useDeleteBonusKPI,
  useUpsertBonusKPIWeight,
} from '../../hooks/useOperatingPlanQuery';
import { useFunctionOwnersQuery } from '../../hooks/useLeadershipQuery';
import { useAuth } from '../../../../contexts/AuthContext';
import type { BonusKPI, BonusKPIUnit } from '../../lib/operating-plan.types';

interface BonusKPIsTabProps {
  functionId: string;
  year: number;
}

interface KPIFormData {
  name: string;
  description: string;
  unit: BonusKPIUnit;
  target_value: string;
  current_value: string;
  min_threshold: string;
  min_multiplier: string;
  max_threshold: string;
  max_multiplier: string;
}

export default function BonusKPIsTab({ functionId, year }: BonusKPIsTabProps) {
  const [editingKpiId, setEditingKpiId] = useState<string | null>(null);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [showAchieved, setShowAchieved] = useState(false);

  const { profile } = useAuth();
  const isCEO = profile?.is_super_admin === true;

  const { data: kpis } = useBonusKPIsQuery(functionId, year);
  const { data: owners } = useFunctionOwnersQuery(functionId);

  // Get up to 3 owners for column headers
  const displayOwners = useMemo(() => {
    return owners?.slice(0, 3) || [];
  }, [owners]);

  // Calculate weight totals per owner across all KPIs
  const ownerWeightTotals = useMemo(() => {
    const totals: Record<string, number> = {};

    displayOwners.forEach(owner => {
      let total = 0;
      kpis?.forEach(kpi => {
        const weight = (kpi as any).weights?.find((w: any) => w.user_id === owner.user_id);
        total += weight?.weight || 0;
      });
      totals[owner.user_id] = total;
    });

    return totals;
  }, [kpis, displayOwners]);

  // Calculate weighted multiplier per owner (CEO only)
  const ownerWeightedMultipliers = useMemo(() => {
    if (!isCEO) return {};

    const multipliers: Record<string, number> = {};

    displayOwners.forEach(owner => {
      let weightedSum = 0;
      let totalWeight = 0;

      kpis?.forEach(kpi => {
        const weight = (kpi as any).weights?.find((w: any) => w.user_id === owner.user_id);
        const weightValue = weight?.weight || 0;

        if (weightValue > 0 && kpi.current_value !== null) {
          const multiplier = calculateMultiplier(kpi);
          weightedSum += multiplier * (weightValue / 100);
          totalWeight += (weightValue / 100);
        }
      });

      multipliers[owner.user_id] = totalWeight > 0 ? weightedSum : 0;
    });

    return multipliers;
  }, [kpis, displayOwners, isCEO]);

  const handleCancelCreate = () => {
    setIsCreatingNew(false);
  };

  const handleStartEdit = (kpiId: string) => {
    setEditingKpiId(kpiId);
  };

  const handleCancelEdit = () => {
    setEditingKpiId(null);
  };

  return (
    <div className="max-w-full mx-auto space-y-6 p-6">
      {/* Header */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-blue-900">
            <Award className="w-5 h-5" />
            <span className="font-medium">Annual Bonus KPIs for {year}</span>
          </div>
          <button
            onClick={() => setShowAchieved(!showAchieved)}
            className={`px-3 py-1 text-xs rounded-lg transition-colors ${
              showAchieved
                ? 'bg-blue-600 text-white'
                : 'bg-white text-blue-700 border border-blue-300'
            }`}
          >
            {showAchieved ? 'Hide' : 'Show'} Achieved Values
          </button>
        </div>
        <p className="text-sm text-blue-700 mt-1">
          Define KPIs, set targets and incentive curves, and assign weights to function owners
        </p>
      </div>

      {/* Add New KPI Button */}
      {!isCreatingNew && (
        <div className="flex justify-between items-center">
          <button
            onClick={() => setIsCreatingNew(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add KPI
          </button>
          <div className="text-sm text-gray-600">
            {kpis?.length || 0} KPI{(kpis?.length || 0) !== 1 ? 's' : ''}
          </div>
        </div>
      )}

      {/* KPIs Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
        <table className="w-full table-fixed">
          <colgroup>
            <col style={{ width: '25%' }} /> {/* KPI Name */}
            <col style={{ width: '6%' }} />  {/* Unit */}
            <col style={{ width: '8%' }} />  {/* Target */}
            {showAchieved && <col style={{ width: '8%' }} />}  {/* Achieved */}
            <col style={{ width: '22%' }} /> {/* Incentive Curve */}
            <col style={{ width: '5%' }} />  {/* Mult */}
            {displayOwners.map(() => <col key={Math.random()} style={{ width: '12%' }} />)} {/* Owners */}
            <col style={{ width: `${8}%` }} /> {/* Actions */}
          </colgroup>
          <thead className="bg-gray-50 border-b border-gray-200">
            {/* Header Row 1: Weight % label */}
            <tr>
              <th className="px-3 py-2"></th>
              <th className="px-3 py-2"></th>
              <th className="px-3 py-2"></th>
              {showAchieved && <th className="px-3 py-2"></th>}
              <th className="px-3 py-2"></th>
              <th className="px-3 py-2"></th>
              {displayOwners.length > 0 && (
                <th
                  colSpan={displayOwners.length}
                  className="px-3 py-1 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider border-l border-gray-300"
                >
                  Weight %
                </th>
              )}
              <th className="px-3 py-2"></th>
            </tr>
            {/* Header Row 2: Column labels */}
            <tr>
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                KPI Name
              </th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Unit
              </th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Target
              </th>
              {showAchieved && (
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Achieved
                </th>
              )}
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Incentive Curve
              </th>
              <th className="px-3 py-2 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Mult
              </th>
              {displayOwners.map((owner) => {
                const total = ownerWeightTotals[owner.user_id] || 0;
                const isValid = total === 100;

                return (
                  <th
                    key={owner.id}
                    className="px-3 py-2 text-center text-xs font-semibold text-gray-600 border-l border-gray-300"
                    title={owner.user_profile?.email}
                  >
                    <div className="flex flex-col items-center gap-1">
                      <div className="text-xs leading-tight break-words">
                        {owner.user_profile?.full_name?.split(' ').map((part, i) => (
                          <div key={i}>{part}</div>
                        ))}
                      </div>
                      <div className={`text-xs font-bold flex items-center gap-1 ${
                        isValid ? 'text-green-600' : 'text-orange-600'
                      }`}>
                        {isValid ? <Check className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                        {total}%
                      </div>
                    </div>
                  </th>
                );
              })}
              <th className="px-3 py-2 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {/* New KPI Row */}
            {isCreatingNew && (
              <KPIEditRow
                functionId={functionId}
                year={year}
                kpi={null}
                owners={displayOwners}
                onSave={handleCancelCreate}
                onCancel={handleCancelCreate}
                showAchieved={showAchieved}
              />
            )}

            {/* Existing KPIs */}
            {kpis && kpis.length > 0 ? (
              kpis.map((kpi) => (
                editingKpiId === kpi.id ? (
                  <KPIEditRow
                    key={kpi.id}
                    functionId={functionId}
                    year={year}
                    kpi={kpi}
                    owners={displayOwners}
                    onSave={handleCancelEdit}
                    onCancel={handleCancelEdit}
                    showAchieved={showAchieved}
                  />
                ) : (
                  <KPIDisplayRow
                    key={kpi.id}
                    kpi={kpi}
                    owners={displayOwners}
                    onEdit={() => handleStartEdit(kpi.id)}
                    showAchieved={showAchieved}
                  />
                )
              ))
            ) : !isCreatingNew ? (
              <tr>
                <td colSpan={6 + displayOwners.length + (showAchieved ? 1 : 0)} className="px-4 py-12 text-center">
                  <Award className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                  <p className="text-gray-600 mb-4">No Bonus KPIs defined yet</p>
                  <button
                    onClick={() => setIsCreatingNew(true)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <Plus className="w-4 h-4 inline-block mr-2" />
                    Add First KPI
                  </button>
                </td>
              </tr>
            ) : null}
          </tbody>
          {/* CEO Footer: Weighted Multipliers */}
          {isCEO && kpis && kpis.length > 0 && (
            <tfoot className="bg-blue-50 border-t-2 border-blue-200">
              <tr>
                <td colSpan={5 + (showAchieved ? 1 : 0)} className="px-3 py-2 text-right text-xs font-semibold text-gray-700">
                  Weighted Bonus Multiplier (CEO View):
                </td>
                <td className="px-3 py-2"></td>
                {displayOwners.map((owner) => (
                  <td key={owner.id} className="px-3 py-2 text-center border-l border-blue-300">
                    <span className="text-sm font-bold text-blue-700">
                      {ownerWeightedMultipliers[owner.user_id]?.toFixed(2) || '0.00'}x
                    </span>
                  </td>
                ))}
                <td className="px-3 py-2"></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}

// Helper function to calculate multiplier
function calculateMultiplier(kpi: BonusKPI): number {
  if (kpi.current_value === null || kpi.target_value === null) return 0;

  const current = kpi.current_value;
  const target = kpi.target_value;
  const min = kpi.min_threshold || 0;
  const max = kpi.max_threshold || target;
  const minMult = kpi.min_multiplier;
  const maxMult = kpi.max_multiplier;

  // Below min threshold = 0x
  if (current < min) {
    return 0;
  }
  // At or above max threshold = max multiplier (capped)
  else if (current >= max) {
    return maxMult;
  }
  // Between min and target
  else if (current < target) {
    const range = target - min;
    const position = current - min;
    const multiplierRange = 1.0 - minMult;
    return minMult + (position / range) * multiplierRange;
  }
  // Between target and max
  else {
    const range = max - target;
    const position = current - target;
    const multiplierRange = maxMult - 1.0;
    return 1.0 + (position / range) * multiplierRange;
  }
}

// Display Row Component
interface KPIDisplayRowProps {
  kpi: BonusKPI;
  owners: any[];
  onEdit: () => void;
  showAchieved: boolean;
}

function KPIDisplayRow({ kpi, owners, onEdit, showAchieved }: KPIDisplayRowProps) {
  const deleteKPI = useDeleteBonusKPI();
  const upsertWeight = useUpsertBonusKPIWeight();
  const updateKPI = useUpdateBonusKPI();

  const formatValue = (value: number | null, unit: BonusKPIUnit) => {
    if (value === null) return '-';
    switch (unit) {
      case 'dollars': return `$${value.toLocaleString()}`;
      case 'percent': return `${value}%`;
      default: return value.toString();
    }
  };

  const formatCurve = () => {
    const min = formatValue(kpi.min_threshold, kpi.unit);
    const max = formatValue(kpi.max_threshold, kpi.unit);
    return `${min}(${kpi.min_multiplier}x) → ${max}(${kpi.max_multiplier}x)`;
  };

  const multiplier = calculateMultiplier(kpi);

  // Get weight for each owner
  const getWeight = (ownerId: string) => {
    const weight = (kpi as any).weights?.find((w: any) => w.user_id === ownerId);
    return weight?.weight || 0;
  };

  const handleWeightChange = async (ownerId: string, weight: number) => {
    try {
      await upsertWeight.mutateAsync({
        bonus_kpi_id: kpi.id,
        user_id: ownerId,
        weight,
      });
    } catch (error) {
      console.error('Failed to update weight:', error);
    }
  };

  const handleAchievedChange = async (value: string) => {
    try {
      const numValue = value ? parseFloat(value) : undefined;
      await updateKPI.mutateAsync({
        id: kpi.id,
        current_value: numValue,
      });
    } catch (error) {
      console.error('Failed to update achieved value:', error);
    }
  };

  return (
    <tr className="hover:bg-gray-50">
      <td className="px-3 py-3">
        <div className="font-medium text-gray-900 text-sm">{kpi.name}</div>
        {kpi.description && (
          <div className="text-xs text-gray-600 mt-0.5">{kpi.description}</div>
        )}
      </td>
      <td className="px-3 py-3 text-xs text-gray-700 capitalize">{kpi.unit}</td>
      <td className="px-3 py-3 text-sm text-gray-700">
        {formatValue(kpi.target_value, kpi.unit)}
      </td>
      {showAchieved && (
        <td className="px-3 py-3">
          <input
            type="number"
            step="any"
            value={kpi.current_value || ''}
            onChange={(e) => handleAchievedChange(e.target.value)}
            placeholder="-"
            className="w-full px-2 py-1 text-sm text-center border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </td>
      )}
      <td className="px-3 py-3 text-xs text-gray-700">
        {formatCurve()}
      </td>
      <td className="px-3 py-3">
        {multiplier > 0 ? (
          <div className={`inline-flex items-center justify-center px-2 py-0.5 rounded text-xs font-bold ${
            multiplier < 1 ? 'bg-red-100 text-red-700' :
            multiplier === 1 ? 'bg-blue-100 text-blue-700' :
            'bg-green-100 text-green-700'
          }`}>
            {multiplier.toFixed(2)}x
          </div>
        ) : (
          <span className="text-xs text-gray-400">-</span>
        )}
      </td>
      {owners.map((owner) => (
        <td key={owner.id} className="px-3 py-3 border-l border-gray-200">
          <input
            type="number"
            min="0"
            max="100"
            value={getWeight(owner.user_id)}
            onChange={(e) => handleWeightChange(owner.user_id, parseInt(e.target.value) || 0)}
            className="w-full px-2 py-1 text-sm text-center border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </td>
      ))}
      <td className="px-3 py-3">
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={onEdit}
            className="text-blue-600 hover:text-blue-700"
            title="Edit KPI"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => {
              if (confirm('Delete this KPI?')) {
                deleteKPI.mutate(kpi.id);
              }
            }}
            className="text-red-600 hover:text-red-700"
            title="Delete KPI"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </td>
    </tr>
  );
}

// Edit Row Component
interface KPIEditRowProps {
  functionId: string;
  year: number;
  kpi: BonusKPI | null;
  owners: any[];
  onSave: () => void;
  onCancel: () => void;
  showAchieved: boolean;
}

function KPIEditRow({ functionId, year, kpi, owners, onSave, onCancel, showAchieved }: KPIEditRowProps) {
  const createKPI = useCreateBonusKPI();
  const updateKPI = useUpdateBonusKPI();
  const upsertWeight = useUpsertBonusKPIWeight();

  const [formData, setFormData] = useState<KPIFormData>({
    name: kpi?.name || '',
    description: kpi?.description || '',
    unit: (kpi?.unit || 'dollars') as BonusKPIUnit,
    target_value: kpi?.target_value?.toString() || '',
    current_value: kpi?.current_value?.toString() || '',
    min_threshold: kpi?.min_threshold?.toString() || '',
    min_multiplier: kpi?.min_multiplier?.toString() || '0.5',
    max_threshold: kpi?.max_threshold?.toString() || '',
    max_multiplier: kpi?.max_multiplier?.toString() || '2.0',
  });

  const [weights, setWeights] = useState<Record<string, number>>(() => {
    const initialWeights: Record<string, number> = {};
    owners.forEach((owner) => {
      const existingWeight = (kpi as any)?.weights?.find((w: any) => w.user_id === owner.user_id);
      initialWeights[owner.user_id] = existingWeight?.weight || 0;
    });
    return initialWeights;
  });

  const handleSave = async () => {
    if (!formData.name.trim()) {
      alert('Please enter a KPI name');
      return;
    }

    try {
      const data: any = {
        name: formData.name,
        description: formData.description || undefined,
        unit: formData.unit,
        min_multiplier: parseFloat(formData.min_multiplier),
        max_multiplier: parseFloat(formData.max_multiplier),
        target_value: formData.target_value ? parseFloat(formData.target_value) : undefined,
        current_value: formData.current_value ? parseFloat(formData.current_value) : undefined,
        min_threshold: formData.min_threshold ? parseFloat(formData.min_threshold) : undefined,
        max_threshold: formData.max_threshold ? parseFloat(formData.max_threshold) : undefined,
      };

      let savedKpi: any;
      if (kpi) {
        savedKpi = await updateKPI.mutateAsync({ id: kpi.id, ...data });
      } else {
        savedKpi = await createKPI.mutateAsync({
          function_id: functionId,
          year,
          ...data,
        });
      }

      // Save weights
      await Promise.all(
        Object.entries(weights).map(([userId, weight]) =>
          upsertWeight.mutateAsync({
            bonus_kpi_id: savedKpi.id,
            user_id: userId,
            weight,
          })
        )
      );

      onSave();
    } catch (error) {
      console.error('Failed to save KPI:', error);
      alert('Failed to save KPI. Please try again.');
    }
  };

  return (
    <tr className="bg-yellow-50">
      <td className="px-3 py-3">
        <input
          type="text"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="KPI Name"
          className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
        />
        <textarea
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="Description (optional)"
          rows={2}
          className="w-full mt-1 px-2 py-1 text-xs border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
        />
      </td>
      <td className="px-3 py-3">
        <select
          value={formData.unit}
          onChange={(e) => setFormData({ ...formData, unit: e.target.value as BonusKPIUnit })}
          className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
        >
          <option value="dollars">$</option>
          <option value="percent">%</option>
          <option value="score">Score</option>
          <option value="count">Count</option>
        </select>
      </td>
      <td className="px-3 py-3">
        <input
          type="number"
          step="any"
          value={formData.target_value}
          onChange={(e) => setFormData({ ...formData, target_value: e.target.value })}
          placeholder="Target"
          className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
        />
      </td>
      {showAchieved && (
        <td className="px-3 py-3">
          <input
            type="number"
            step="any"
            value={formData.current_value}
            onChange={(e) => setFormData({ ...formData, current_value: e.target.value })}
            placeholder="Achieved"
            className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
          />
        </td>
      )}
      <td className="px-3 py-3">
        <div className="space-y-1">
          <div className="flex gap-1 items-center">
            <input
              type="number"
              step="any"
              value={formData.min_threshold}
              onChange={(e) => setFormData({ ...formData, min_threshold: e.target.value })}
              placeholder="Min"
              className="w-16 px-1 py-0.5 text-xs border border-gray-300 rounded"
            />
            <span className="text-xs">(</span>
            <input
              type="number"
              step="0.1"
              value={formData.min_multiplier}
              onChange={(e) => setFormData({ ...formData, min_multiplier: e.target.value })}
              placeholder="0.5"
              className="w-12 px-1 py-0.5 text-xs border border-gray-300 rounded"
            />
            <span className="text-xs">x)</span>
          </div>
          <div className="flex gap-1 items-center">
            <input
              type="number"
              step="any"
              value={formData.max_threshold}
              onChange={(e) => setFormData({ ...formData, max_threshold: e.target.value })}
              placeholder="Max"
              className="w-16 px-1 py-0.5 text-xs border border-gray-300 rounded"
            />
            <span className="text-xs">(</span>
            <input
              type="number"
              step="0.1"
              value={formData.max_multiplier}
              onChange={(e) => setFormData({ ...formData, max_multiplier: e.target.value })}
              placeholder="2.0"
              className="w-12 px-1 py-0.5 text-xs border border-gray-300 rounded"
            />
            <span className="text-xs">x)</span>
          </div>
        </div>
      </td>
      <td className="px-3 py-3 text-xs text-gray-500">-</td>
      {owners.map((owner) => (
        <td key={owner.id} className="px-3 py-3 border-l border-gray-200">
          <input
            type="number"
            min="0"
            max="100"
            value={weights[owner.user_id] || 0}
            onChange={(e) => setWeights({ ...weights, [owner.user_id]: parseInt(e.target.value) || 0 })}
            className="w-full px-2 py-1 text-sm text-center border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
          />
        </td>
      ))}
      <td className="px-3 py-3">
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={handleSave}
            className="text-green-600 hover:text-green-700"
            title="Save"
          >
            <Save className="w-4 h-4" />
          </button>
          <button
            onClick={onCancel}
            className="text-red-600 hover:text-red-700"
            title="Cancel"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </td>
    </tr>
  );
}
