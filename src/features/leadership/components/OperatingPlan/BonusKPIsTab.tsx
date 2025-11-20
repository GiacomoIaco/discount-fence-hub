import { useState, useMemo } from 'react';
import { Plus, Award, Save, X, Trash2, Edit2, ChevronDown, ChevronRight } from 'lucide-react';
import {
  useBonusKPIsQuery,
  useCreateBonusKPI,
  useUpdateBonusKPI,
  useDeleteBonusKPI,
  useUpsertBonusKPIWeight,
} from '../../hooks/useOperatingPlanQuery';
import { useFunctionOwnersQuery } from '../../hooks/useLeadershipQuery';
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
  const [expandedKpiId, setExpandedKpiId] = useState<string | null>(null);

  const { data: kpis } = useBonusKPIsQuery(functionId, year);
  const { data: owners } = useFunctionOwnersQuery(functionId);

  // Get up to 3 owners for column headers
  const displayOwners = useMemo(() => {
    console.log('[BonusKPIsTab] Owners data:', owners);
    console.log('[BonusKPIsTab] Display owners:', owners?.slice(0, 3) || []);
    return owners?.slice(0, 3) || [];
  }, [owners]);

  const handleCancelCreate = () => {
    setIsCreatingNew(false);
  };

  const handleStartEdit = (kpiId: string) => {
    setEditingKpiId(kpiId);
    setExpandedKpiId(kpiId);
  };

  const handleCancelEdit = () => {
    setEditingKpiId(null);
    setExpandedKpiId(null);
  };

  return (
    <div className="max-w-full mx-auto space-y-6 p-6">
      {/* Header */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-center gap-2 text-blue-900">
          <Award className="w-5 h-5" />
          <span className="font-medium">Annual Bonus KPIs for {year}</span>
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
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider w-8"></th>
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
                Progress
              </th>
              {displayOwners.map((owner) => (
                <th
                  key={owner.id}
                  className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider"
                  title={owner.user_profile?.email}
                >
                  {owner.user_profile?.first_name} {owner.user_profile?.last_name}
                  <div className="text-xs font-normal text-gray-500 normal-case">Weight %</div>
                </th>
              ))}
              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
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
                isExpanded={true}
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
                    isExpanded={expandedKpiId === kpi.id}
                  />
                ) : (
                  <KPIDisplayRow
                    key={kpi.id}
                    kpi={kpi}
                    owners={displayOwners}
                    onEdit={() => handleStartEdit(kpi.id)}
                    isExpanded={expandedKpiId === kpi.id}
                    onToggleExpand={() => setExpandedKpiId(expandedKpiId === kpi.id ? null : kpi.id)}
                  />
                )
              ))
            ) : !isCreatingNew ? (
              <tr>
                <td colSpan={7 + displayOwners.length} className="px-4 py-12 text-center">
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
        </table>
      </div>
    </div>
  );
}

// Display Row Component
interface KPIDisplayRowProps {
  kpi: BonusKPI;
  owners: any[];
  onEdit: () => void;
  isExpanded: boolean;
  onToggleExpand: () => void;
}

function KPIDisplayRow({ kpi, owners, onEdit, isExpanded, onToggleExpand }: KPIDisplayRowProps) {
  const deleteKPI = useDeleteBonusKPI();
  const upsertWeight = useUpsertBonusKPIWeight();

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

  return (
    <>
      <tr className="hover:bg-gray-50">
        <td className="px-4 py-3">
          <button
            onClick={onToggleExpand}
            className="text-gray-500 hover:text-gray-700"
          >
            {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>
        </td>
        <td className="px-4 py-3">
          <div className="font-medium text-gray-900">{kpi.name}</div>
          {kpi.description && (
            <div className="text-sm text-gray-600">{kpi.description}</div>
          )}
        </td>
        <td className="px-4 py-3 text-sm text-gray-700 capitalize">{kpi.unit}</td>
        <td className="px-4 py-3 text-sm text-gray-700">
          {formatValue(kpi.target_value, kpi.unit)}
        </td>
        <td className="px-4 py-3 text-sm text-gray-700">
          {formatValue(kpi.current_value, kpi.unit)}
        </td>
        <td className="px-4 py-3">
          {progress ? (
            <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
              progress.status === 'below' ? 'bg-red-100 text-red-700' :
              progress.status === 'exceeding' ? 'bg-green-100 text-green-700' :
              'bg-blue-100 text-blue-700'
            }`}>
              {progress.multiplier.toFixed(2)}x
            </div>
          ) : (
            <span className="text-sm text-gray-400">-</span>
          )}
        </td>
        {owners.map((owner) => (
          <td key={owner.id} className="px-4 py-3">
            <input
              type="number"
              min="0"
              max="100"
              value={getWeight(owner.user_id)}
              onChange={(e) => handleWeightChange(owner.user_id, parseInt(e.target.value) || 0)}
              className="w-16 px-2 py-1 text-center border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </td>
        ))}
        <td className="px-4 py-3">
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
      {isExpanded && (
        <tr className="bg-gray-50">
          <td colSpan={7 + owners.length} className="px-4 py-3">
            <div className="text-xs text-gray-600">
              <strong>Incentive Curve:</strong>
              <div className="mt-1 space-y-1">
                <div>• Min: {formatValue(kpi.min_threshold, kpi.unit)} → {kpi.min_multiplier}x multiplier</div>
                <div>• Target: {formatValue(kpi.target_value, kpi.unit)} → 1.0x multiplier</div>
                <div>• Max: {formatValue(kpi.max_threshold, kpi.unit)} → {kpi.max_multiplier}x multiplier</div>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
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
  isExpanded: boolean;
}

function KPIEditRow({ functionId, year, kpi, owners, onSave, onCancel, isExpanded }: KPIEditRowProps) {
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
    <>
      <tr className="bg-yellow-50">
        <td className="px-4 py-3"></td>
        <td className="px-4 py-3">
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="KPI Name"
            className="w-full px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
          />
          <textarea
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="Description (optional)"
            rows={2}
            className="w-full mt-1 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
          />
        </td>
        <td className="px-4 py-3">
          <select
            value={formData.unit}
            onChange={(e) => setFormData({ ...formData, unit: e.target.value as BonusKPIUnit })}
            className="w-full px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
          >
            <option value="dollars">Dollars</option>
            <option value="percent">Percent</option>
            <option value="score">Score</option>
            <option value="count">Count</option>
          </select>
        </td>
        <td className="px-4 py-3">
          <input
            type="number"
            step="any"
            value={formData.target_value}
            onChange={(e) => setFormData({ ...formData, target_value: e.target.value })}
            placeholder="Target"
            className="w-24 px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
          />
        </td>
        <td className="px-4 py-3">
          <input
            type="number"
            step="any"
            value={formData.current_value}
            onChange={(e) => setFormData({ ...formData, current_value: e.target.value })}
            placeholder="Current"
            className="w-24 px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
          />
        </td>
        <td className="px-4 py-3 text-sm text-gray-500">-</td>
        {owners.map((owner) => (
          <td key={owner.id} className="px-4 py-3">
            <input
              type="number"
              min="0"
              max="100"
              value={weights[owner.user_id] || 0}
              onChange={(e) => setWeights({ ...weights, [owner.user_id]: parseInt(e.target.value) || 0 })}
              className="w-16 px-2 py-1 text-center border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
            />
          </td>
        ))}
        <td className="px-4 py-3">
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
      {isExpanded && (
        <tr className="bg-yellow-50">
          <td colSpan={7 + owners.length} className="px-4 py-3">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Min Threshold
                </label>
                <input
                  type="number"
                  step="any"
                  value={formData.min_threshold}
                  onChange={(e) => setFormData({ ...formData, min_threshold: e.target.value })}
                  className="w-full px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Min Multiplier
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={formData.min_multiplier}
                  onChange={(e) => setFormData({ ...formData, min_multiplier: e.target.value })}
                  className="w-full px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Max Threshold
                </label>
                <input
                  type="number"
                  step="any"
                  value={formData.max_threshold}
                  onChange={(e) => setFormData({ ...formData, max_threshold: e.target.value })}
                  className="w-full px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Max Multiplier
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={formData.max_multiplier}
                  onChange={(e) => setFormData({ ...formData, max_multiplier: e.target.value })}
                  className="w-full px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div className="mt-2 text-xs text-gray-500">
              Incentive curve: At min threshold get {formData.min_multiplier || 0.5}x, at target get 1.0x, at max threshold get {formData.max_multiplier || 2.0}x
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
