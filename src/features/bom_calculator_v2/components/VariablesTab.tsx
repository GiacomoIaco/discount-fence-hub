/**
 * VariablesTab - Manage product variables with import from other types
 */

import { useState, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Plus, Save, X, Edit2, Trash2, AlertCircle, Search, Download, ChevronDown } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import {
  useProductTypesV2,
  useAllProductVariablesV2,
  useVariableValueOptions,
  type ProductTypeV2,
  type ProductVariableV2,
} from '../hooks/useProductTypesV2';

// =============================================================================
// VARIABLES TAB
// =============================================================================

interface VariablesTabProps {
  productType: ProductTypeV2;
  variables: ProductVariableV2[];
  isLoading: boolean;
  onRefresh: () => void;
}

export function VariablesTab({
  productType,
  variables,
  isLoading,
  onRefresh,
}: VariablesTabProps) {
  const queryClient = useQueryClient();
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingVariable, setEditingVariable] = useState<ProductVariableV2 | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterProductType, setFilterProductType] = useState<string>('');
  const [importing, setImporting] = useState(false);

  // Fetch all product types for filter dropdown
  const { data: allProductTypes = [] } = useProductTypesV2();

  // Fetch all variables from all product types
  const { data: allVariables = [] } = useAllProductVariablesV2();

  // Get variable codes already used by this product type
  const usedVariableCodes = new Set(variables.map(v => v.variable_code));

  // Available variables = variables from other product types not yet used here
  const availableVariables = allVariables
    .filter(v => v.product_type_id !== productType.id)
    .filter(v => !usedVariableCodes.has(v.variable_code))
    .filter(v => {
      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        return (
          v.variable_code.toLowerCase().includes(search) ||
          v.variable_name.toLowerCase().includes(search)
        );
      }
      return true;
    })
    .filter(v => {
      if (filterProductType) {
        return v.product_type_id === filterProductType;
      }
      return true;
    });

  // Group available variables by variable_code (deduplicate)
  const uniqueAvailableVariables = Object.values(
    availableVariables.reduce((acc, v) => {
      if (!acc[v.variable_code]) {
        acc[v.variable_code] = v;
      }
      return acc;
    }, {} as Record<string, typeof availableVariables[0]>)
  );

  // Import a variable from another product type
  const importVariable = async (sourceVar: typeof allVariables[0]) => {
    setImporting(true);

    const { error } = await supabase
      .from('product_variables_v2')
      .insert({
        product_type_id: productType.id,
        variable_code: sourceVar.variable_code,
        variable_name: sourceVar.variable_name,
        variable_type: sourceVar.variable_type,
        default_value: sourceVar.default_value,
        allowed_values: sourceVar.allowed_values,
        unit: sourceVar.unit,
        is_required: sourceVar.is_required,
        display_order: variables.length + 1,
      });

    if (error) {
      console.error('Error importing variable:', error);
    } else {
      queryClient.invalidateQueries({ queryKey: ['product-variables-v2', productType.id] });
      onRefresh();
    }
    setImporting(false);
  };

  // Remove a variable from this product type
  const removeVariable = async (variableId: string) => {
    const { error } = await supabase
      .from('product_variables_v2')
      .delete()
      .eq('id', variableId);

    if (error) {
      console.error('Error removing variable:', error);
    } else {
      queryClient.invalidateQueries({ queryKey: ['product-variables-v2', productType.id] });
      onRefresh();
    }
  };

  const [showAvailable, setShowAvailable] = useState(true);

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Variables for {productType.name}</h2>
          <p className="text-sm text-gray-500">Configure input variables for this product type</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
        >
          <Plus className="w-4 h-4" />
          Create New Variable
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-8 h-8 border-2 border-purple-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* SELECTED VARIABLES - TOP SECTION */}
          <div className="bg-white rounded-lg border border-gray-200">
            <div className="px-4 py-3 border-b border-gray-200 bg-purple-50">
              <h3 className="text-sm font-semibold text-purple-800">
                Selected Variables ({variables.length})
              </h3>
            </div>
            <div className="p-4">
              {variables.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-8">
                  No variables configured. Import from other product types below or create a new one.
                </p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {variables.map((variable) => (
                    <div
                      key={variable.id}
                      className="p-4 bg-gray-50 border border-gray-200 rounded-lg hover:border-purple-300 transition-colors"
                    >
                      {/* Header: Name + Code + Actions */}
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h4 className="font-semibold text-gray-900">{variable.variable_name}</h4>
                          <span className="text-xs font-mono text-gray-500">{variable.variable_code}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => setEditingVariable(variable)}
                            className="p-1.5 hover:bg-purple-100 rounded text-purple-600"
                            title="Edit variable"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => removeVariable(variable.id)}
                            className="p-1.5 hover:bg-red-100 rounded text-red-600"
                            title="Remove variable"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Details Grid */}
                      <div className="space-y-2 text-sm">
                        <div className="flex items-center justify-between">
                          <span className="text-gray-500">Type</span>
                          <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs font-medium">
                            {variable.variable_type}
                          </span>
                        </div>

                        {variable.default_value && (
                          <div className="flex items-center justify-between">
                            <span className="text-gray-500">Default</span>
                            <span className="font-medium text-gray-900">{variable.default_value}</span>
                          </div>
                        )}

                        {variable.unit && (
                          <div className="flex items-center justify-between">
                            <span className="text-gray-500">Unit</span>
                            <span className="font-medium text-gray-900">{variable.unit}</span>
                          </div>
                        )}

                        <div className="flex items-center justify-between">
                          <span className="text-gray-500">Required</span>
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                            variable.is_required
                              ? 'bg-green-100 text-green-700'
                              : 'bg-gray-100 text-gray-600'
                          }`}>
                            {variable.is_required ? 'Yes' : 'No'}
                          </span>
                        </div>

                        {/* Allowed Values */}
                        {variable.allowed_values && variable.allowed_values.length > 0 && (
                          <div className="pt-2 border-t border-gray-200">
                            <span className="text-gray-500 text-xs">Allowed Values:</span>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {variable.allowed_values.slice(0, 6).map((val) => (
                                <span
                                  key={val}
                                  className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-xs"
                                >
                                  {val}
                                </span>
                              ))}
                              {variable.allowed_values.length > 6 && (
                                <span className="px-2 py-0.5 bg-gray-100 text-gray-500 rounded text-xs">
                                  +{variable.allowed_values.length - 6} more
                                </span>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* AVAILABLE VARIABLES - BOTTOM SECTION (Collapsible) */}
          <div className="bg-white rounded-lg border border-gray-200">
            <button
              onClick={() => setShowAvailable(!showAvailable)}
              className="w-full px-4 py-3 border-b border-gray-200 bg-gray-50 flex items-center justify-between hover:bg-gray-100 transition-colors"
            >
              <h3 className="text-sm font-semibold text-gray-700">
                Import from Other Product Types ({uniqueAvailableVariables.length} available)
              </h3>
              <ChevronDown className={`w-5 h-5 text-gray-500 transition-transform ${showAvailable ? '' : '-rotate-90'}`} />
            </button>

            {showAvailable && (
              <div className="p-4">
                {/* Filters */}
                <div className="flex gap-3 mb-4">
                  <select
                    value={filterProductType}
                    onChange={(e) => setFilterProductType(e.target.value)}
                    className="px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white"
                  >
                    <option value="">All Product Types</option>
                    {allProductTypes.filter(pt => pt.id !== productType.id).map(pt => (
                      <option key={pt.id} value={pt.id}>{pt.name}</option>
                    ))}
                  </select>
                  <div className="relative flex-1 max-w-xs">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Search variables..."
                      className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg"
                    />
                  </div>
                </div>

                {/* Available Variables List */}
                {uniqueAvailableVariables.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-6">
                    {searchTerm || filterProductType
                      ? 'No matching variables found'
                      : 'All available variables have been added'}
                  </p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {uniqueAvailableVariables.map((variable) => (
                      <div
                        key={variable.id}
                        className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg hover:border-purple-300 hover:bg-purple-50 transition-colors"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-gray-900 truncate">{variable.variable_name}</span>
                          </div>
                          <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                            <span className="px-1.5 py-0.5 bg-gray-100 rounded">{variable.variable_type}</span>
                            <span className="truncate">from {variable.product_type?.name || 'Unknown'}</span>
                          </div>
                        </div>
                        <button
                          onClick={() => importVariable(variable)}
                          disabled={importing}
                          className="flex items-center gap-1 px-2 py-1.5 text-xs bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 disabled:opacity-50 ml-2"
                          title="Import to this product type"
                        >
                          <Download className="w-3 h-3" />
                          Import
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}

      {/* Add/Edit Variable Modal */}
      {(showAddModal || editingVariable) && (
        <VariableModal
          productTypeId={productType.id}
          variable={editingVariable}
          onClose={() => {
            setShowAddModal(false);
            setEditingVariable(null);
          }}
          onSaved={() => {
            setShowAddModal(false);
            setEditingVariable(null);
            onRefresh();
          }}
        />
      )}
    </div>
  );
}

// =============================================================================
// VARIABLE MODAL
// =============================================================================

interface VariableModalProps {
  productTypeId: string;
  variable: ProductVariableV2 | null;
  onClose: () => void;
  onSaved: () => void;
}

function VariableModal({
  productTypeId,
  variable,
  onClose,
  onSaved,
}: VariableModalProps) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    variable_code: variable?.variable_code || '',
    variable_name: variable?.variable_name || '',
    variable_type: variable?.variable_type || 'select',
    default_value: variable?.default_value || '',
    unit: variable?.unit || '',
    is_required: variable?.is_required ?? true,
  });
  const [selectedValues, setSelectedValues] = useState<string[]>(variable?.allowed_values || []);
  const [newValueInput, setNewValueInput] = useState('');
  const [newValueLabel, setNewValueLabel] = useState('');
  const [addingValue, setAddingValue] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEditing = !!variable;
  const normalizedCode = formData.variable_code.toLowerCase().replace(/\s+/g, '_');

  // Fetch global value options for this variable code
  const { data: globalOptions = [], refetch: refetchOptions } = useVariableValueOptions(normalizedCode);

  // Fetch all product variables with the same code to aggregate values
  const { data: allVariablesWithCode = [] } = useAllProductVariablesV2();

  // Aggregate values from all product types' allowed_values + global pool
  const aggregatedValues = useMemo(() => {
    const values = new Set<string>(globalOptions.map(opt => opt.value));
    allVariablesWithCode
      .filter(v => v.variable_code === normalizedCode && v.allowed_values)
      .forEach(v => v.allowed_values?.forEach(val => values.add(val)));
    return Array.from(values).sort();
  }, [globalOptions, allVariablesWithCode, normalizedCode]);

  const toggleValueSelection = (value: string) => {
    setSelectedValues(prev =>
      prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value]
    );
  };

  const handleAddGlobalValue = async () => {
    if (!newValueInput.trim()) return;

    setAddingValue(true);
    const { error: insertError } = await supabase
      .from('variable_value_options')
      .insert({
        variable_code: normalizedCode,
        value: newValueInput.trim(),
        display_label: newValueLabel.trim() || null,
        display_order: globalOptions.length + 1,
      });

    if (insertError) {
      setError(insertError.message);
    } else {
      setSelectedValues(prev => [...prev, newValueInput.trim()]);
      setNewValueInput('');
      setNewValueLabel('');
      refetchOptions();
      queryClient.invalidateQueries({ queryKey: ['variable-value-options'] });
    }
    setAddingValue(false);
  };

  const handleSave = async () => {
    if (!formData.variable_code.trim() || !formData.variable_name.trim()) {
      setError('Code and Name are required');
      return;
    }

    setSaving(true);
    setError(null);

    const data = {
      product_type_id: productTypeId,
      variable_code: normalizedCode,
      variable_name: formData.variable_name,
      variable_type: formData.variable_type,
      default_value: formData.default_value || null,
      allowed_values: formData.variable_type === 'select' && selectedValues.length > 0
        ? selectedValues
        : null,
      unit: formData.unit || null,
      is_required: formData.is_required,
    };

    let result;
    if (isEditing && variable) {
      result = await supabase
        .from('product_variables_v2')
        .update(data)
        .eq('id', variable.id);
    } else {
      result = await supabase
        .from('product_variables_v2')
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
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">
            {isEditing ? 'Edit Variable' : 'Add Variable'}
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4 overflow-y-auto flex-1">
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 rounded-lg text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Code *</label>
              <input
                type="text"
                value={formData.variable_code}
                onChange={(e) => setFormData({ ...formData, variable_code: e.target.value })}
                placeholder="e.g., height"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
              <input
                type="text"
                value={formData.variable_name}
                onChange={(e) => setFormData({ ...formData, variable_name: e.target.value })}
                placeholder="e.g., Height"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
              <select
                value={formData.variable_type}
                onChange={(e) => setFormData({ ...formData, variable_type: e.target.value as 'integer' | 'decimal' | 'select' })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
              >
                <option value="select">Select (dropdown)</option>
                <option value="integer">Integer</option>
                <option value="decimal">Decimal</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Unit</label>
              <input
                type="text"
                value={formData.unit}
                onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                placeholder="e.g., ft, in"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Default Value</label>
            <input
              type="text"
              value={formData.default_value}
              onChange={(e) => setFormData({ ...formData, default_value: e.target.value })}
              placeholder="e.g., 6"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
            />
          </div>

          {/* Global Value Pool Section - Only for select type */}
          {formData.variable_type === 'select' && normalizedCode && (
            <div className="border border-gray-200 rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-gray-700">
                  Allowed Values (Global Pool)
                </label>
                <span className="text-xs text-gray-500">
                  {selectedValues.length} selected
                </span>
              </div>

              {aggregatedValues.length > 0 ? (
                <div className="grid grid-cols-2 gap-2 max-h-36 overflow-y-auto">
                  {aggregatedValues.map((value: string) => {
                    const globalOpt = globalOptions.find(opt => opt.value === value);
                    return (
                      <label
                        key={value}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-colors ${
                          selectedValues.includes(value)
                            ? 'bg-purple-50 border-purple-300'
                            : 'bg-white border-gray-200 hover:bg-gray-50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={selectedValues.includes(value)}
                          onChange={() => toggleValueSelection(value)}
                          className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                        />
                        <span className="text-sm">
                          {globalOpt?.display_label || value}
                          {globalOpt?.display_label && (
                            <span className="text-gray-400 ml-1">({value})</span>
                          )}
                        </span>
                      </label>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-gray-500 italic">
                  No values defined for "{normalizedCode}" yet. Add some below.
                </p>
              )}

              {/* Add new global value */}
              <div className="pt-3 border-t border-gray-200">
                <p className="text-xs text-gray-500 mb-2">Add new value to global pool:</p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newValueInput}
                    onChange={(e) => setNewValueInput(e.target.value)}
                    placeholder="Value (e.g., 7)"
                    className="flex-1 px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  />
                  <input
                    type="text"
                    value={newValueLabel}
                    onChange={(e) => setNewValueLabel(e.target.value)}
                    placeholder="Label (e.g., 7 ft)"
                    className="flex-1 px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  />
                  <button
                    onClick={handleAddGlobalValue}
                    disabled={!newValueInput.trim() || addingValue}
                    className="px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50"
                  >
                    {addingValue ? '...' : 'Add'}
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="is_required"
              checked={formData.is_required}
              onChange={(e) => setFormData({ ...formData, is_required: e.target.checked })}
              className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
            />
            <label htmlFor="is_required" className="text-sm text-gray-700">Required field</label>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-xl">
          <button onClick={onClose} className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
          >
            {saving ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            {isEditing ? 'Update' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
}
