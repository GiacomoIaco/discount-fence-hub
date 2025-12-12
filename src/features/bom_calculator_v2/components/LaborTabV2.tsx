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
  AlertCircle, Check, Settings, Search
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
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
  const [editingGroup, setEditingGroup] = useState<LaborGroupV2 | null>(null);
  const [formula, setFormula] = useState('');
  const [selectedLaborCodeId, setSelectedLaborCodeId] = useState('');
  const [laborCodeSearch, setLaborCodeSearch] = useState('');

  // Fetch product variables for formula reference
  const { data: productVariables = [] } = useProductVariablesV2(productType.id);

  // Fetch assigned components for optional material component variables
  const { data: assignedComponents = [] } = useProductTypeComponentsFull(productType.id);
  const materialComponents = assignedComponents.filter(c => c.is_assigned && !c.is_labor);

  // Fetch ALL available labor groups
  const { data: allLaborGroups = [], isLoading: loadingAllGroups, refetch: refetchAllGroups } = useLaborGroupsV2();

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
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm font-medium text-gray-700">
              Assign Labor Groups to {productType.name}
            </div>
            <button
              onClick={() => setShowCreateGroupModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Create Group
            </button>
          </div>
          <div className="space-y-2">
            {allLaborGroups.map(group => {
              const isAssigned = assignedGroupIds.has(group.id);
              return (
                <div
                  key={group.id}
                  className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
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
                    className="w-4 h-4 text-purple-600 rounded border-gray-300 focus:ring-purple-500 cursor-pointer"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-gray-900">{group.name}</span>
                      <span className="text-xs text-gray-400 font-mono">{group.code}</span>
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
                  <button
                    onClick={() => setEditingGroup(group)}
                    className="p-1.5 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded transition-colors flex-shrink-0"
                    title="Edit group settings"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                </div>
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
                  {/* Labor Codes Table - Auto layout for natural column widths */}
                  {groupEligibility.length > 0 ? (
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="w-14 px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Def
                          </th>
                          <th className="w-20 px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Code
                          </th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" style={{ minWidth: '200px', maxWidth: '350px' }}>
                            Description
                          </th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" style={{ minWidth: '180px' }}>
                            Condition
                          </th>
                          <th className="w-20 px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {groupEligibility.map(eligibility => {
                          const laborCode = eligibility.labor_code || getLaborCode(eligibility.labor_code_id);
                          return (
                            <tr key={eligibility.id} className="hover:bg-gray-50">
                              <td className="w-14 px-3 py-2">
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
                              <td className="w-20 px-3 py-2">
                                <span className="font-mono text-sm text-gray-900">
                                  {laborCode?.labor_sku || 'Unknown'}
                                </span>
                              </td>
                              <td className="px-3 py-2" style={{ minWidth: '200px', maxWidth: '350px' }}>
                                <span className="text-sm text-gray-700 line-clamp-2">
                                  {laborCode?.description || 'Unknown labor code'}
                                </span>
                                <div className="text-xs text-gray-400">{laborCode?.unit_type}</div>
                              </td>
                              <td className="px-3 py-2" style={{ minWidth: '180px' }}>
                                {eligibility.condition_formula ? (
                                  <code className="text-xs bg-purple-50 text-purple-700 px-2 py-1 rounded font-mono block truncate" title={eligibility.condition_formula}>
                                    {eligibility.condition_formula}
                                  </code>
                                ) : (
                                  <span className="text-xs text-gray-400 italic">
                                    Always eligible
                                  </span>
                                )}
                              </td>
                              <td className="w-20 px-3 py-2 text-right">
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

      {/* Add Modal - Improved with filterable list */}
      {showAddModal && (() => {
        const availableCodes = getAvailableLaborCodes(showAddModal.groupId, showAddModal.groupCode);
        const filteredCodes = availableCodes.filter(lc =>
          laborCodeSearch === '' ||
          lc.labor_sku.toLowerCase().includes(laborCodeSearch.toLowerCase()) ||
          lc.description.toLowerCase().includes(laborCodeSearch.toLowerCase())
        );
        const selectedCode = allLaborCodes.find(lc => lc.id === selectedLaborCodeId);

        return (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
              <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between flex-shrink-0">
                <h2 className="text-lg font-semibold text-gray-900">
                  Add Labor Code to {showAddModal.groupName}
                </h2>
                <button
                  onClick={() => {
                    setShowAddModal(null);
                    setSelectedLaborCodeId('');
                    setLaborCodeSearch('');
                    setFormula('');
                  }}
                  className="p-1 hover:bg-gray-100 rounded-full"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              <div className="flex-1 overflow-hidden flex flex-col">
                {/* Two-panel layout */}
                <div className="flex flex-1 overflow-hidden">
                  {/* Left Panel - Labor Code List */}
                  <div className="w-1/2 border-r border-gray-200 flex flex-col">
                    <div className="p-3 border-b border-gray-100">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                          type="text"
                          value={laborCodeSearch}
                          onChange={(e) => setLaborCodeSearch(e.target.value)}
                          placeholder="Search labor codes..."
                          className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                        />
                      </div>
                      <div className="text-xs text-gray-500 mt-2">
                        {filteredCodes.length} of {availableCodes.length} codes available
                      </div>
                    </div>
                    <div className="flex-1 overflow-y-auto p-2">
                      {filteredCodes.length === 0 ? (
                        <div className="text-center text-sm text-gray-500 py-8">
                          {availableCodes.length === 0
                            ? 'All labor codes are already assigned'
                            : 'No matching labor codes'}
                        </div>
                      ) : (
                        <div className="space-y-1">
                          {filteredCodes.map(lc => (
                            <button
                              key={lc.id}
                              onClick={() => setSelectedLaborCodeId(lc.id)}
                              className={`w-full text-left p-2 rounded-lg transition-colors ${
                                selectedLaborCodeId === lc.id
                                  ? 'bg-purple-100 border-purple-300 border'
                                  : 'hover:bg-gray-50 border border-transparent'
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-sm font-medium text-gray-900">
                                  {lc.labor_sku}
                                </span>
                                <span className="text-xs text-gray-400">{lc.unit_type}</span>
                              </div>
                              <div className="text-sm text-gray-600 line-clamp-2 mt-0.5">
                                {lc.description}
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right Panel - Selected Code & Formula */}
                  <div className="w-1/2 flex flex-col">
                    {selectedCode ? (
                      <div className="p-4 flex-1 overflow-y-auto space-y-4">
                        {/* Selected Code Display */}
                        <div className="bg-purple-50 rounded-lg p-3">
                          <div className="text-xs text-purple-600 font-medium mb-1">Selected</div>
                          <div className="font-mono text-lg font-bold text-purple-900">
                            {selectedCode.labor_sku}
                          </div>
                          <div className="text-sm text-purple-800 mt-1">
                            {selectedCode.description}
                          </div>
                          <div className="text-xs text-purple-600 mt-1">
                            Unit: {selectedCode.unit_type}
                          </div>
                        </div>

                        {/* Condition Formula */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Condition Formula (optional)
                          </label>
                          <p className="text-xs text-gray-500 mb-2">
                            Leave blank for always eligible. Use AND/OR for multiple conditions.
                          </p>
                          <textarea
                            value={formula}
                            onChange={(e) => setFormula(e.target.value)}
                            placeholder="e.g., [height]==6 AND [post_type]=='Wood'"
                            rows={2}
                            className="w-full px-3 py-2 text-sm font-mono border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                          />
                        </div>

                        {/* Available Variables - Compact */}
                        <div className="bg-gray-50 rounded-lg p-3">
                          <div className="text-xs font-medium text-gray-700 mb-2">
                            Click to insert variable
                          </div>
                          <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto">
                            {allVariables.slice(0, 20).map(v => (
                              <button
                                key={v.code}
                                type="button"
                                onClick={() => insertVariable(v.code)}
                                className="px-2 py-1 bg-white border border-gray-300 rounded text-xs font-mono hover:bg-purple-50 hover:border-purple-400 hover:text-purple-700 transition-colors"
                                title={`${v.name} (${v.group})`}
                              >
                                {v.code}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="flex-1 flex items-center justify-center p-4">
                        <div className="text-center text-gray-500">
                          <div className="text-4xl mb-2">←</div>
                          <div className="text-sm">Select a labor code from the list</div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end gap-3 flex-shrink-0">
                <button
                  onClick={() => {
                    setShowAddModal(null);
                    setSelectedLaborCodeId('');
                    setLaborCodeSearch('');
                    setFormula('');
                  }}
                  className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddLaborCode}
                  disabled={!selectedLaborCodeId || saving}
                  className="px-4 py-2 text-sm font-medium bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                  {saving ? 'Adding...' : 'Add Labor Code'}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

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

      {/* Create/Edit Group Modal */}
      {(showCreateGroupModal || editingGroup) && (
        <LaborGroupModal
          group={editingGroup}
          onClose={() => {
            setShowCreateGroupModal(false);
            setEditingGroup(null);
          }}
          onSaved={async () => {
            setShowCreateGroupModal(false);
            setEditingGroup(null);
            await refetchAllGroups();
            await refetchLaborGroups();
          }}
        />
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

// =============================================================================
// LABOR GROUP MODAL - Create/Edit labor groups
// =============================================================================

interface LaborGroupModalProps {
  group: LaborGroupV2 | null;
  onClose: () => void;
  onSaved: () => void;
}

function LaborGroupModal({ group, onClose, onSaved }: LaborGroupModalProps) {
  const isEditing = !!group;
  const [formData, setFormData] = useState({
    code: group?.code || '',
    name: group?.name || '',
    description: group?.description || '',
    is_required: group?.is_required ?? false,
    allow_multiple: group?.allow_multiple ?? false,
    display_order: group?.display_order ?? 10,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    if (!formData.code.trim() || !formData.name.trim()) {
      setError('Code and Name are required');
      return;
    }

    setSaving(true);
    setError(null);

    const data = {
      code: formData.code.toLowerCase().replace(/\s+/g, '_'),
      name: formData.name,
      description: formData.description || null,
      is_required: formData.is_required,
      allow_multiple: formData.allow_multiple,
      display_order: formData.display_order,
    };

    let result;
    if (isEditing && group) {
      result = await supabase
        .from('labor_groups_v2')
        .update(data)
        .eq('id', group.id);
    } else {
      result = await supabase
        .from('labor_groups_v2')
        .insert(data);
    }

    if (result.error) {
      setError(result.error.message);
      setSaving(false);
    } else {
      onSaved();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">
            {isEditing ? 'Edit Labor Group' : 'Create Labor Group'}
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-full">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 rounded-lg text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Code *</label>
            <input
              type="text"
              value={formData.code}
              onChange={(e) => setFormData({ ...formData, code: e.target.value })}
              placeholder="e.g., demo_labor"
              disabled={isEditing}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 disabled:bg-gray-50 disabled:text-gray-500"
            />
            <p className="text-xs text-gray-500 mt-1">Unique identifier (cannot be changed after creation)</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Demo Labor"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={2}
              placeholder="Optional description of this labor group"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
            />
          </div>

          {/* Required/Optional Toggle */}
          <div className="bg-gray-50 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-gray-900">Required</div>
                <p className="text-xs text-gray-500">SKUs must have a labor code from this group</p>
              </div>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, is_required: !formData.is_required })}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 ${
                  formData.is_required ? 'bg-purple-600' : 'bg-gray-200'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    formData.is_required ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Single/Multiple Toggle */}
            <div className="flex items-center justify-between pt-3 border-t border-gray-200">
              <div>
                <div className="text-sm font-medium text-gray-900">Allow Multiple</div>
                <p className="text-xs text-gray-500">SKUs can have multiple codes from this group</p>
              </div>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, allow_multiple: !formData.allow_multiple })}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 ${
                  formData.allow_multiple ? 'bg-purple-600' : 'bg-gray-200'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    formData.allow_multiple ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Display Order</label>
            <input
              type="number"
              value={formData.display_order}
              onChange={(e) => setFormData({ ...formData, display_order: parseInt(e.target.value) || 0 })}
              min={0}
              className="w-24 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
            />
            <p className="text-xs text-gray-500 mt-1">Lower numbers appear first</p>
          </div>
        </div>

        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 rounded-lg"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 text-sm font-medium bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-300"
          >
            {saving ? 'Saving...' : (isEditing ? 'Update' : 'Create')}
          </button>
        </div>
      </div>
    </div>
  );
}
