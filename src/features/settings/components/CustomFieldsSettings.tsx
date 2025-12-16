/**
 * CustomFieldsSettings - Admin UI for managing custom field definitions
 *
 * Allows users to:
 * - View all custom fields by entity type
 * - Add new custom fields
 * - Edit existing fields (label, type, options, transferability)
 * - Deactivate fields (soft delete)
 * - Reorder fields
 */

import { useState } from 'react';
import {
  Plus,
  Edit2,
  Trash2,
  ChevronDown,
  ChevronUp,
  Settings,
  ArrowRight,
  Eye,
  EyeOff,
  GripVertical,
  Check,
  X,
} from 'lucide-react';
import {
  useAllCustomFieldDefinitions,
  useCreateCustomFieldDefinition,
  useUpdateCustomFieldDefinition,
  useDeleteCustomFieldDefinition,
  type CustomFieldDefinition,
  type CustomFieldType,
  type CustomFieldEntityType,
} from '../../client_hub/hooks/useCustomFields';

// Entity type configuration
const ENTITY_TYPES: { value: CustomFieldEntityType; label: string; color: string }[] = [
  { value: 'client', label: 'Clients', color: 'bg-blue-100 text-blue-700' },
  { value: 'community', label: 'Communities', color: 'bg-green-100 text-green-700' },
  { value: 'property', label: 'Properties', color: 'bg-yellow-100 text-yellow-700' },
  { value: 'quote', label: 'Quotes', color: 'bg-purple-100 text-purple-700' },
  { value: 'job', label: 'Jobs', color: 'bg-orange-100 text-orange-700' },
  { value: 'invoice', label: 'Invoices', color: 'bg-pink-100 text-pink-700' },
];

const FIELD_TYPES: { value: CustomFieldType; label: string }[] = [
  { value: 'text', label: 'Text' },
  { value: 'textarea', label: 'Long Text' },
  { value: 'number', label: 'Number' },
  { value: 'date', label: 'Date' },
  { value: 'boolean', label: 'Yes/No' },
  { value: 'select', label: 'Dropdown' },
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Phone' },
  { value: 'url', label: 'URL' },
];

// Which entity types can receive transfers
const TRANSFER_TARGETS: Record<CustomFieldEntityType, CustomFieldEntityType[]> = {
  client: [],
  community: [],
  property: [],
  request: ['quote'],
  quote: ['job', 'invoice'],
  job: ['invoice'],
  invoice: [],
};

interface FieldFormData {
  field_name: string;
  field_label: string;
  field_type: CustomFieldType;
  placeholder: string;
  help_text: string;
  is_required: boolean;
  is_transferable: boolean;
  transfers_to: CustomFieldEntityType[];
  is_client_facing: boolean;
  show_in_reports: boolean;
}

const emptyFormData: FieldFormData = {
  field_name: '',
  field_label: '',
  field_type: 'text',
  placeholder: '',
  help_text: '',
  is_required: false,
  is_transferable: false,
  transfers_to: [],
  is_client_facing: false,
  show_in_reports: true,
};

export default function CustomFieldsSettings() {
  const { data: allFields, isLoading } = useAllCustomFieldDefinitions();
  const createMutation = useCreateCustomFieldDefinition();
  const updateMutation = useUpdateCustomFieldDefinition();
  const deleteMutation = useDeleteCustomFieldDefinition();

  const [selectedEntityType, setSelectedEntityType] = useState<CustomFieldEntityType>('client');
  const [expandedSections, setExpandedSections] = useState<Set<CustomFieldEntityType>>(
    new Set(['client', 'quote', 'job'])
  );
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingField, setEditingField] = useState<CustomFieldDefinition | null>(null);
  const [formData, setFormData] = useState<FieldFormData>(emptyFormData);

  // Group fields by entity type
  const fieldsByEntity = ENTITY_TYPES.reduce((acc, { value }) => {
    acc[value] = (allFields || []).filter((f) => f.entity_type === value);
    return acc;
  }, {} as Record<CustomFieldEntityType, CustomFieldDefinition[]>);

  const toggleSection = (entityType: CustomFieldEntityType) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(entityType)) {
        next.delete(entityType);
      } else {
        next.add(entityType);
      }
      return next;
    });
  };

  const openAddModal = (entityType: CustomFieldEntityType) => {
    setSelectedEntityType(entityType);
    setFormData(emptyFormData);
    setEditingField(null);
    setShowAddModal(true);
  };

  const openEditModal = (field: CustomFieldDefinition) => {
    setSelectedEntityType(field.entity_type);
    setFormData({
      field_name: field.field_name,
      field_label: field.field_label,
      field_type: field.field_type,
      placeholder: field.placeholder || '',
      help_text: field.help_text || '',
      is_required: field.is_required,
      is_transferable: field.is_transferable,
      transfers_to: field.transfers_to || [],
      is_client_facing: field.is_client_facing,
      show_in_reports: field.show_in_reports,
    });
    setEditingField(field);
    setShowAddModal(true);
  };

  const handleSave = async () => {
    // Generate field_name from label if not set
    const fieldName = formData.field_name || formData.field_label.toLowerCase().replace(/\s+/g, '_');

    if (editingField) {
      await updateMutation.mutateAsync({
        id: editingField.id,
        data: {
          field_label: formData.field_label,
          field_type: formData.field_type,
          placeholder: formData.placeholder || null,
          help_text: formData.help_text || null,
          is_required: formData.is_required,
          is_transferable: formData.is_transferable,
          transfers_to: formData.transfers_to,
          is_client_facing: formData.is_client_facing,
          show_in_reports: formData.show_in_reports,
        },
      });
    } else {
      await createMutation.mutateAsync({
        entity_type: selectedEntityType,
        field_name: fieldName,
        field_label: formData.field_label,
        field_type: formData.field_type,
        options: null,
        placeholder: formData.placeholder || null,
        help_text: formData.help_text || null,
        is_required: formData.is_required,
        is_transferable: formData.is_transferable,
        transfers_to: formData.transfers_to,
        is_client_facing: formData.is_client_facing,
        show_in_reports: formData.show_in_reports,
        sort_order: (fieldsByEntity[selectedEntityType]?.length || 0) + 1,
        is_active: true,
        default_value: null,
      });
    }

    setShowAddModal(false);
    setEditingField(null);
    setFormData(emptyFormData);
  };

  const handleDelete = async (field: CustomFieldDefinition) => {
    if (confirm(`Are you sure you want to deactivate "${field.field_label}"? Data will be preserved.`)) {
      await deleteMutation.mutateAsync(field.id);
    }
  };

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-8 bg-gray-200 rounded w-48" />
        <div className="h-32 bg-gray-100 rounded" />
        <div className="h-32 bg-gray-100 rounded" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Custom Fields</h2>
          <p className="text-sm text-gray-500">
            Define custom fields for clients, communities, quotes, jobs, and more
          </p>
        </div>
      </div>

      {/* Entity Type Sections */}
      <div className="space-y-4">
        {ENTITY_TYPES.map(({ value: entityType, label, color }) => {
          const fields = fieldsByEntity[entityType] || [];
          const isExpanded = expandedSections.has(entityType);
          const transferTargets = TRANSFER_TARGETS[entityType];

          return (
            <div key={entityType} className="bg-white rounded-lg border border-gray-200">
              {/* Section Header */}
              <div
                className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50"
                onClick={() => toggleSection(entityType)}
              >
                <div className="flex items-center gap-3">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${color}`}>
                    {label}
                  </span>
                  <span className="text-sm text-gray-500">
                    {fields.length} field{fields.length !== 1 ? 's' : ''}
                  </span>
                  {transferTargets.length > 0 && (
                    <span className="text-xs text-gray-400">
                      Can transfer to: {transferTargets.join(', ')}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      openAddModal(entityType);
                    }}
                    className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                  {isExpanded ? (
                    <ChevronUp className="w-4 h-4 text-gray-400" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-gray-400" />
                  )}
                </div>
              </div>

              {/* Fields List */}
              {isExpanded && (
                <div className="border-t border-gray-100">
                  {fields.length === 0 ? (
                    <div className="p-4 text-center text-gray-500 text-sm">
                      No custom fields defined for {label.toLowerCase()}
                      <button
                        onClick={() => openAddModal(entityType)}
                        className="block mx-auto mt-2 text-blue-600 hover:text-blue-700"
                      >
                        + Add first field
                      </button>
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-100">
                      {fields.map((field) => (
                        <div
                          key={field.id}
                          className="flex items-center justify-between p-4 hover:bg-gray-50"
                        >
                          <div className="flex items-center gap-4">
                            <GripVertical className="w-4 h-4 text-gray-300 cursor-grab" />
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-gray-900">
                                  {field.field_label}
                                </span>
                                <span className="text-xs text-gray-400 font-mono">
                                  {field.field_name}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                                  {FIELD_TYPES.find((t) => t.value === field.field_type)?.label || field.field_type}
                                </span>
                                {field.is_required && (
                                  <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded">
                                    Required
                                  </span>
                                )}
                                {field.is_transferable && (
                                  <span className="text-xs bg-purple-100 text-purple-600 px-2 py-0.5 rounded flex items-center gap-1">
                                    <ArrowRight className="w-3 h-3" />
                                    {field.transfers_to?.join(', ')}
                                  </span>
                                )}
                                {field.is_client_facing && (
                                  <span className="text-xs bg-green-100 text-green-600 px-2 py-0.5 rounded flex items-center gap-1">
                                    <Eye className="w-3 h-3" />
                                    Client-facing
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => openEditModal(field)}
                              className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(field)}
                              className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Add/Edit Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div className="flex items-center gap-3">
                <Settings className="w-5 h-5 text-gray-400" />
                <h3 className="text-lg font-semibold text-gray-900">
                  {editingField ? 'Edit Custom Field' : 'Add Custom Field'}
                </h3>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1 text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
              {/* Entity Type (read-only when editing) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Entity Type
                </label>
                <div className={`px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 ${
                  ENTITY_TYPES.find((t) => t.value === selectedEntityType)?.color
                }`}>
                  {ENTITY_TYPES.find((t) => t.value === selectedEntityType)?.label}
                </div>
              </div>

              {/* Field Label */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Field Label <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.field_label}
                  onChange={(e) => setFormData({ ...formData, field_label: e.target.value })}
                  placeholder="e.g., Warranty Contact"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {/* Field Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Field Type
                </label>
                <select
                  value={formData.field_type}
                  onChange={(e) => setFormData({ ...formData, field_type: e.target.value as CustomFieldType })}
                  disabled={!!editingField}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
                >
                  {FIELD_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
                {editingField && (
                  <p className="text-xs text-gray-400 mt-1">Field type cannot be changed after creation</p>
                )}
              </div>

              {/* Placeholder */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Placeholder Text
                </label>
                <input
                  type="text"
                  value={formData.placeholder}
                  onChange={(e) => setFormData({ ...formData, placeholder: e.target.value })}
                  placeholder="e.g., Enter warranty contact name..."
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {/* Help Text */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Help Text
                </label>
                <input
                  type="text"
                  value={formData.help_text}
                  onChange={(e) => setFormData({ ...formData, help_text: e.target.value })}
                  placeholder="e.g., The main contact for warranty claims"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {/* Checkboxes */}
              <div className="space-y-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.is_required}
                    onChange={(e) => setFormData({ ...formData, is_required: e.target.checked })}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">Required field</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.is_client_facing}
                    onChange={(e) => setFormData({ ...formData, is_client_facing: e.target.checked })}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">
                    Client-facing (visible on PDFs and customer portal)
                  </span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.show_in_reports}
                    onChange={(e) => setFormData({ ...formData, show_in_reports: e.target.checked })}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">Show in reports</span>
                </label>
              </div>

              {/* Transferability (only for quote, job, request) */}
              {TRANSFER_TARGETS[selectedEntityType]?.length > 0 && (
                <div className="border-t border-gray-200 pt-4 space-y-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.is_transferable}
                      onChange={(e) => setFormData({
                        ...formData,
                        is_transferable: e.target.checked,
                        transfers_to: e.target.checked ? TRANSFER_TARGETS[selectedEntityType] : []
                      })}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700 font-medium">
                      Transferable field
                    </span>
                  </label>

                  {formData.is_transferable && (
                    <div className="ml-6 space-y-2">
                      <p className="text-xs text-gray-500">
                        When this entity is converted, the field value will copy to:
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {TRANSFER_TARGETS[selectedEntityType].map((target) => (
                          <label key={target} className="flex items-center gap-1 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={formData.transfers_to.includes(target)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setFormData({
                                    ...formData,
                                    transfers_to: [...formData.transfers_to, target],
                                  });
                                } else {
                                  setFormData({
                                    ...formData,
                                    transfers_to: formData.transfers_to.filter((t) => t !== target),
                                  });
                                }
                              }}
                              className="w-3 h-3 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                            />
                            <span className="text-xs text-gray-600 capitalize">{target}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 p-6 border-t border-gray-200">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={!formData.field_label.trim() || createMutation.isPending || updateMutation.isPending}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {(createMutation.isPending || updateMutation.isPending) ? (
                  'Saving...'
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    {editingField ? 'Save Changes' : 'Create Field'}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
