/**
 * LaborTabV2 - Labor Groups V2 UI
 *
 * Manages labor code eligibility organized by labor groups:
 * - Post Setting (Required, Single)
 * - Nail Up (Required, Single)
 * - Other Labor (Optional, Multiple)
 *
 * Features:
 * - Manage Labor Groups: Assign/unassign groups to product type
 * - Auto-populate Other Labor: All codes appear in Other Labor by default
 * - Fixed column widths for consistent alignment
 */

import { useState, useEffect, useMemo } from 'react';
import {
  Plus, Trash2, X, ChevronDown, ChevronRight, Edit2,
  AlertCircle, Check, Settings
} from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import {
  useProductVariablesV2,
  useProductTypeComponentsFull,
  useProductTypeLaborGroupsV2,
  useLaborGroupEligibilityV2,
  useLaborGroupsV2,
  type ProductTypeV2,
  type ProductStyleV2,
  type LaborGroupEligibilityV2,
  type LaborGroupV2,
} from '../hooks/useProductTypesV2';

interface LaborCode {
  id: string;
  labor_sku: string;
  description: string;
  unit_type: string;
}

interface LaborTabV2Props {
  productType: ProductTypeV2;
  styles: ProductStyleV2[];
}

export default function LaborTabV2({ productType, styles }: LaborTabV2Props) {
  const [saving, setSaving] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(['set_post', 'nail_up', 'other_labor']));
  const [editingEligibility, setEditingEligibility] = useState<LaborGroupEligibilityV2 | null>(null);
  const [showAddModal, setShowAddModal] = useState<{ groupId: string; groupCode: string; groupName: string } | null>(null);
  const [showManageGroups, setShowManageGroups] = useState(false);
  const [formula, setFormula] = useState('');
  const [selectedLaborCodeId, setSelectedLaborCodeId] = useState('');

  // Fetch product variables for formula reference
  const { data: productVariables = [] } = useProductVariablesV2(productType.id);

  // Fetch assigned components for optional material component variables
  const { data: assignedComponents = [] } = useProductTypeComponentsFull(productType.id);
  const materialComponents = assignedComponents.filter(c => c.is_assigned && !c.is_labor);

  // Fetch ALL available labor groups
  const { data: allLaborGroups = [], isLoading: loadingAllGroups } = useLaborGroupsV2();

  // Fetch labor groups assigned to this product type
  const { data: laborGroups = [], isLoading: loadingGroups, refetch: refetchLaborGroups } = useProductTypeLaborGroupsV2(productType.id);

  // Fetch labor code eligibility for this product type
  const { data: eligibilityRules = [], isLoading: loadingEligibility, refetch: refetchEligibility } = useLaborGroupEligibilityV2(productType.id);

  // Fetch all labor codes for adding new ones
  const [allLaborCodes, setAllLaborCodes] = useState<LaborCode[]>([]);
  useEffect(() => {
    const fetchLaborCodes = async () => {
      const { data } = await supabase
        .from('labor_codes')
        .select('id, labor_sku, description, unit_type')
        .order('labor_sku');
      if (data) setAllLaborCodes(data);
    };
    fetchLaborCodes();
  }, []);

  // Group eligibility rules by labor group
  const eligibilityByGroup = useMemo(() => {
    const map = new Map<string, LaborGroupEligibilityV2[]>();
    eligibilityRules.forEach((rule: LaborGroupEligibilityV2) => {
      const existing = map.get(rule.labor_group_id) || [];
      map.set(rule.labor_group_id, [...existing, rule]);
    });
    return map;
  }, [eligibilityRules]);

  // Toggle group expansion
  const toggleGroup = (groupCode: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupCode)) next.delete(groupCode);
      else next.add(groupCode);
      return next;
    });
  };

  // Get which labor groups are assigned to this product type
  const assignedGroupIds = useMemo(() => {
    return new Set(laborGroups.map(ptlg => ptlg.labor_group_id));
  }, [laborGroups]);

  // For Other Labor group: Get all labor codes NOT assigned to other specific groups
  const getOtherLaborAvailableCodes = (otherLaborGroupId: string) => {
    // Get all codes that are assigned to specific groups (not other_labor)
    const codesInSpecificGroups = new Set<string>();
    eligibilityRules.forEach(rule => {
      const group = laborGroups.find(lg => lg.labor_group_id === rule.labor_group_id)?.labor_group;
      if (group && group.code !== 'other_labor') {
        codesInSpecificGroups.add(rule.labor_code_id);
      }
    });

    // Get codes already in other_labor
    const existingOtherCodes = eligibilityByGroup.get(otherLaborGroupId)?.map(e => e.labor_code_id) || [];

    // Return codes not in specific groups AND not already in other_labor
    return allLaborCodes.filter(lc =>
      !codesInSpecificGroups.has(lc.id) && !existingOtherCodes.includes(lc.id)
    );
  };

  // Get available labor codes for a group (not already added)
  const getAvailableLaborCodes = (groupId: string, groupCode: string) => {
    // For other_labor, use special logic
    if (groupCode === 'other_labor') {
      return getOtherLaborAvailableCodes(groupId);
    }
    // For other groups, just exclude codes already in THIS group
    const existingCodes = eligibilityByGroup.get(groupId)?.map(e => e.labor_code_id) || [];
    return allLaborCodes.filter(lc => !existingCodes.includes(lc.id));
  };

  // Toggle labor group assignment for this product type
  const handleToggleLaborGroup = async (group: LaborGroupV2) => {
    setSaving(true);
    const isAssigned = assignedGroupIds.has(group.id);

    if (isAssigned) {
      // Remove group (also removes eligibility rules)
      await supabase
        .from('labor_group_eligibility_v2')
        .delete()
        .eq('product_type_id', productType.id)
        .eq('labor_group_id', group.id);

      await supabase
        .from('product_type_labor_groups_v2')
        .delete()
        .eq('product_type_id', productType.id)
        .eq('labor_group_id', group.id);
    } else {
      // Add group
      await supabase
        .from('product_type_labor_groups_v2')
        .insert({
          product_type_id: productType.id,
          labor_group_id: group.id,
          display_order: group.display_order,
        });
    }

    await refetchLaborGroups();
    await refetchEligibility();
    setSaving(false);
  };

  // Get labor code info by ID
  const getLaborCode = (id: string) => allLaborCodes.find(l => l.id === id);

  // Insert variable into formula field
  const insertVariable = (varCode: string) => {
    setFormula(prev => prev + varCode);
  };

  // Build all available variables for the formula
  const allVariables = [
    { code: '[Quantity]', name: 'Net Length (ft)', group: 'Project' },
    { code: '[Lines]', name: 'Number of Lines', group: 'Project' },
    { code: '[Gates]', name: 'Number of Gates', group: 'Project' },
    { code: '[height]', name: 'Height', group: 'Project' },
    { code: '[post_count]', name: 'Post Count', group: 'Calculated' },
    ...productVariables.map(v => ({
      code: `[${v.variable_code}]`,
      name: v.variable_name,
      group: 'Variables',
    })),
    ...styles.map(s => ({
      code: `"${s.code}"`,
      name: `Style: ${s.name}`,
      group: 'Styles',
    })),
    ...materialComponents.map(c => ({
      code: `[${c.component_code}]`,
      name: c.component_name,
      group: 'Components',
    })),
  ];

  // Add labor code to group
  const handleAddLaborCode = async () => {
    if (!showAddModal || !selectedLaborCodeId) return;
    setSaving(true);

    const { error } = await supabase
      .from('labor_group_eligibility_v2')
      .insert({
        product_type_id: productType.id,
        labor_group_id: showAddModal.groupId,
        labor_code_id: selectedLaborCodeId,
        condition_formula: formula || null,
      });

    if (!error) {
      await refetchEligibility();
      setShowAddModal(null);
      setSelectedLaborCodeId('');
      setFormula('');
    }
    setSaving(false);
  };

  // Update eligibility condition
  const handleUpdateEligibility = async () => {
    if (!editingEligibility) return;
    setSaving(true);

    const { error } = await supabase
      .from('labor_group_eligibility_v2')
      .update({ condition_formula: formula || null })
      .eq('id', editingEligibility.id);

    if (!error) {
      await refetchEligibility();
      setEditingEligibility(null);
      setFormula('');
    }
    setSaving(false);
  };

  // Delete eligibility
  const handleDeleteEligibility = async (eligibilityId: string) => {
    if (!confirm('Remove this labor code from this group?')) return;
    setSaving(true);

    await supabase
      .from('labor_group_eligibility_v2')
      .delete()
      .eq('id', eligibilityId);

    await refetchEligibility();
    setSaving(false);
  };

  // Toggle default status
  const handleToggleDefault = async (eligibility: LaborGroupEligibilityV2) => {
    setSaving(true);
    await supabase
      .from('labor_group_eligibility_v2')
      .update({ is_default: !eligibility.is_default })
      .eq('id', eligibility.id);
    await refetchEligibility();
    setSaving(false);
  };

  // Open edit modal
  const openEditModal = (eligibility: LaborGroupEligibilityV2) => {
    setEditingEligibility(eligibility);
    setFormula(eligibility.condition_formula || '');
  };

  if (loadingGroups || loadingEligibility || loadingAllGroups) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-purple-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Labor Groups</h2>
          <p className="text-sm text-gray-500">
            Configure which labor codes apply to {productType.name} and when
          </p>
        </div>
        <button
          onClick={() => setShowManageGroups(!showManageGroups)}
          className={`flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
            showManageGroups
              ? 'bg-purple-100 text-purple-700'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <Settings className="w-4 h-4" />
          Manage Groups
        </button>
      </div>

      {/* Manage Groups Panel */}
      {showManageGroups && (
        <div className="bg-gray-50 rounded-lg border border-gray-200 p-4">
          <div className="text-sm font-medium text-gray-700 mb-3">
            Assign Labor Groups to {productType.name}
          </div>
          <div className="space-y-2">
            {allLaborGroups.map(group => {
              const isAssigned = assignedGroupIds.has(group.id);
              return (
                <label
                  key={group.id}
                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    isAssigned
                      ? 'bg-purple-50 border-purple-200'
                      : 'bg-white border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isAssigned}
                    onChange={() => handleToggleLaborGroup(group)}
                    disabled={saving}
                    className="w-4 h-4 text-purple-600 rounded border-gray-300 focus:ring-purple-500"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900">{group.name}</span>
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        group.is_required
                          ? 'bg-red-100 text-red-700'
                          : 'bg-gray-100 text-gray-600'
                      }`}>
                        {group.is_required ? 'Required' : 'Optional'}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        group.allow_multiple
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-gray-100 text-gray-600'
                      }`}>
                        {group.allow_multiple ? 'Multiple' : 'Single'}
                      </span>
                    </div>
                    {group.description && (
                      <p className="text-sm text-gray-500 mt-0.5">{group.description}</p>
                    )}
                  </div>
                </label>
              );
            })}
          </div>
        </div>
      )}

      {/* No groups message */}
      {laborGroups.length === 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div>
              <div className="text-sm font-medium text-yellow-800">No Labor Groups Assigned</div>
              <p className="text-sm text-yellow-700 mt-1">
                This product type has no labor groups assigned. Run migration 142_labor_groups_v2.sql to set up the labor grouping system.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Labor Groups */}
      <div className="space-y-3">
        {laborGroups.map((ptlg) => {
          const group = ptlg.labor_group;
          if (!group) return null;

          const groupEligibility = eligibilityByGroup.get(group.id) || [];
          const isExpanded = expandedGroups.has(group.code);
          const availableCodes = getAvailableLaborCodes(group.id, group.code);

          return (
            <div key={group.id} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              {/* Group Header */}
              <button
                onClick={() => toggleGroup(group.code)}
                className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4 text-gray-400" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                  )}
                  <div>
                    <span className="font-medium text-gray-900">{group.name}</span>
                    <span className="text-xs text-gray-500 ml-2">({groupEligibility.length} codes)</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {/* Badges */}
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                    group.is_required
                      ? 'bg-red-100 text-red-700'
                      : 'bg-gray-100 text-gray-600'
                  }`}>
                    {group.is_required ? 'Required' : 'Optional'}
                  </span>
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                    group.allow_multiple
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-gray-100 text-gray-600'
                  }`}>
                    {group.allow_multiple ? 'Multiple' : 'Single'}
                  </span>
                </div>
              </button>

              {/* Group Content */}
              {isExpanded && (
                <div className="border-t border-gray-200">
                  {/* Labor Codes Table - Fixed column widths for alignment */}
                  {groupEligibility.length > 0 ? (
                    <table className="w-full table-fixed">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="w-[60px] px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Def
                          </th>
                          <th className="w-[100px] px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Code
                          </th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Description
                          </th>
                          <th className="w-[200px] px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Condition
                          </th>
                          <th className="w-[80px] px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {groupEligibility.map(eligibility => {
                          const laborCode = eligibility.labor_code || getLaborCode(eligibility.labor_code_id);
                          return (
                            <tr key={eligibility.id} className="hover:bg-gray-50">
                              <td className="w-[60px] px-3 py-2">
                                <button
                                  onClick={() => handleToggleDefault(eligibility)}
                                  className={`w-6 h-6 rounded flex items-center justify-center transition-colors ${
                                    eligibility.is_default
                                      ? 'bg-purple-600 text-white'
                                      : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                                  }`}
                                  title={eligibility.is_default ? 'Default selection' : 'Click to make default'}
                                >
                                  <Check className="w-4 h-4" />
                                </button>
                              </td>
                              <td className="w-[100px] px-3 py-2">
                                <span className="font-mono text-sm text-gray-900">
                                  {laborCode?.labor_sku || 'Unknown'}
                                </span>
                              </td>
                              <td className="px-3 py-2">
                                <span className="text-sm text-gray-700 line-clamp-1">
                                  {laborCode?.description || 'Unknown labor code'}
                                </span>
                                <div className="text-xs text-gray-400">{laborCode?.unit_type}</div>
                              </td>
                              <td className="w-[200px] px-3 py-2">
                                {eligibility.condition_formula ? (
                                  <code className="text-xs bg-purple-50 text-purple-700 px-2 py-1 rounded font-mono">
                                    {eligibility.condition_formula}
                                  </code>
                                ) : (
                                  <span className="text-xs text-gray-400 italic">
                                    Always eligible
                                  </span>
                                )}
                              </td>
                              <td className="w-[80px] px-3 py-2 text-right">
                                <div className="flex items-center justify-end gap-1">
                                  <button
                                    onClick={() => openEditModal(eligibility)}
                                    className="p-1.5 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded transition-colors"
                                    title="Edit condition"
                                  >
                                    <Edit2 className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteEligibility(eligibility.id)}
                                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                    title="Remove"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  ) : (
                    <div className="px-4 py-6 text-center text-sm text-gray-500">
                      No labor codes configured for this group.
                    </div>
                  )}

                  {/* Add Button */}
                  <div className="px-4 py-3 bg-gray-50 border-t border-gray-200">
                    <button
                      onClick={() => setShowAddModal({ groupId: group.id, groupCode: group.code, groupName: group.name })}
                      disabled={availableCodes.length === 0}
                      className="flex items-center gap-2 px-3 py-1.5 text-sm text-purple-600 hover:bg-purple-50 rounded-lg transition-colors disabled:text-gray-400 disabled:hover:bg-transparent"
                    >
                      <Plus className="w-4 h-4" />
                      Add Labor Code to {group.name}
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Info Card */}
      <div className="bg-purple-50 rounded-lg p-4">
        <div className="text-sm font-medium text-purple-900 mb-3">How Labor Groups Work</div>
        <div className="grid grid-cols-2 gap-4 text-xs text-purple-800">
          <div>
            <div className="font-medium mb-1">Required + Single:</div>
            <p>SKU must have exactly one labor code from this group.</p>
          </div>
          <div>
            <div className="font-medium mb-1">Required + Multiple:</div>
            <p>SKU must have at least one labor code from this group.</p>
          </div>
          <div>
            <div className="font-medium mb-1">Optional + Multiple:</div>
            <p>SKU can have zero or more labor codes from this group.</p>
          </div>
          <div>
            <div className="font-medium mb-1">Condition Formula:</div>
            <p>Determines when the code applies (e.g., "height &gt; 6" or "post_type == 'STEEL'")</p>
          </div>
        </div>
      </div>

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">
                Add Labor Code to {showAddModal.groupName}
              </h2>
              <button onClick={() => setShowAddModal(null)} className="p-1 hover:bg-gray-100 rounded-full">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Labor Code Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Labor Code</label>
                <select
                  value={selectedLaborCodeId}
                  onChange={(e) => setSelectedLaborCodeId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                >
                  <option value="">Select a labor code...</option>
                  {getAvailableLaborCodes(showAddModal.groupId, showAddModal.groupCode).map(lc => (
                    <option key={lc.id} value={lc.id}>
                      {lc.labor_sku} - {lc.description}
                    </option>
                  ))}
                </select>
              </div>

              {/* Condition Formula */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Condition Formula (optional)
                </label>
                <p className="text-xs text-gray-500 mb-2">
                  Leave blank for always eligible. Use a formula to conditionally enable.
                </p>
                <textarea
                  value={formula}
                  onChange={(e) => setFormula(e.target.value)}
                  placeholder="e.g., post_spacing == 8"
                  rows={2}
                  className="w-full px-3 py-2 text-sm font-mono border border-gray-300 rounded-lg"
                />
              </div>

              {/* Available Variables - Clickable */}
              <div className="bg-gray-50 rounded-lg p-3 max-h-48 overflow-y-auto">
                <div className="text-xs font-medium text-gray-700 mb-2">
                  Click to insert variable into formula
                </div>
                {['Project', 'Calculated', 'Variables', 'Styles', 'Components'].map(group => {
                  const groupVars = allVariables.filter(v => v.group === group);
                  if (groupVars.length === 0) return null;
                  return (
                    <div key={group} className="mb-2">
                      <div className="text-[10px] text-gray-500 uppercase tracking-wide mb-1">{group}</div>
                      <div className="flex flex-wrap gap-1">
                        {groupVars.map(v => (
                          <button
                            key={v.code}
                            type="button"
                            onClick={() => insertVariable(v.code)}
                            className="px-2 py-1 bg-white border border-gray-300 rounded text-xs font-mono hover:bg-purple-50 hover:border-purple-400 hover:text-purple-700 transition-colors"
                            title={v.name}
                          >
                            {v.code}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => setShowAddModal(null)}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleAddLaborCode}
                disabled={!selectedLaborCodeId || saving}
                className="px-4 py-2 text-sm font-medium bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-300"
              >
                {saving ? 'Adding...' : 'Add Labor Code'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editingEligibility && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Edit Labor Condition</h2>
              <button onClick={() => setEditingEligibility(null)} className="p-1 hover:bg-gray-100 rounded-full">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Labor code info */}
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="text-xs text-gray-500 mb-1">Labor Code</div>
                <div className="font-mono text-sm">
                  {editingEligibility.labor_code?.labor_sku || getLaborCode(editingEligibility.labor_code_id)?.labor_sku}
                </div>
                <div className="text-sm text-gray-700 mt-1">
                  {editingEligibility.labor_code?.description || getLaborCode(editingEligibility.labor_code_id)?.description}
                </div>
              </div>

              {/* Condition Formula */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Condition Formula</label>
                <p className="text-xs text-gray-500 mb-2">
                  Determines when this labor code is eligible. Leave blank for always eligible.
                </p>
                <textarea
                  value={formula}
                  onChange={(e) => setFormula(e.target.value)}
                  placeholder="e.g., height > 6"
                  rows={3}
                  className="w-full px-3 py-2 text-sm font-mono border border-gray-300 rounded-lg"
                />
              </div>

              {/* Available Variables - Clickable */}
              <div className="bg-gray-50 rounded-lg p-3 max-h-48 overflow-y-auto">
                <div className="text-xs font-medium text-gray-700 mb-2">
                  Click to insert variable into formula
                </div>
                {['Project', 'Calculated', 'Variables', 'Styles', 'Components'].map(group => {
                  const groupVars = allVariables.filter(v => v.group === group);
                  if (groupVars.length === 0) return null;
                  return (
                    <div key={group} className="mb-2">
                      <div className="text-[10px] text-gray-500 uppercase tracking-wide mb-1">{group}</div>
                      <div className="flex flex-wrap gap-1">
                        {groupVars.map(v => (
                          <button
                            key={v.code}
                            type="button"
                            onClick={() => insertVariable(v.code)}
                            className="px-2 py-1 bg-white border border-gray-300 rounded text-xs font-mono hover:bg-purple-50 hover:border-purple-400 hover:text-purple-700 transition-colors"
                            title={v.name}
                          >
                            {v.code}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => setEditingEligibility(null)}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdateEligibility}
                disabled={saving}
                className="px-4 py-2 text-sm font-medium bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-300"
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Saving Indicator */}
      {saving && (
        <div className="fixed bottom-4 right-4 bg-gray-900 text-white px-4 py-2 rounded-lg flex items-center gap-2 shadow-lg">
          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          <span className="text-sm">Saving...</span>
        </div>
      )}
    </div>
  );
}
