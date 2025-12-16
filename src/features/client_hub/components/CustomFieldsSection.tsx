/**
 * CustomFieldsSection Component
 *
 * Displays and allows editing of custom fields for any entity type
 * (client, community, project).
 *
 * Usage:
 *   <CustomFieldsSection entityType="client" entityId={clientId} />
 */

import { useState, useEffect } from 'react';
import { Settings, Save, X, ChevronDown, ChevronUp } from 'lucide-react';
import {
  useCustomFieldsWithValues,
  useBatchUpdateCustomFields,
  type CustomFieldWithValue,
  type CustomFieldEntityType,
} from '../hooks/useCustomFields';

interface Props {
  entityType: CustomFieldEntityType;
  entityId: string;
  /** Render in compact mode (inline with other content) */
  compact?: boolean;
  /** Allow collapsing the section */
  collapsible?: boolean;
  /** Start collapsed */
  defaultCollapsed?: boolean;
}

export default function CustomFieldsSection({
  entityType,
  entityId,
  compact = false,
  collapsible = true,
  defaultCollapsed = false,
}: Props) {
  const { data: fields, isLoading } = useCustomFieldsWithValues(entityType, entityId);
  const batchUpdate = useBatchUpdateCustomFields();

  const [isEditing, setIsEditing] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);
  const [editedValues, setEditedValues] = useState<Record<string, unknown>>({});

  // Reset edited values when fields change or editing is cancelled
  useEffect(() => {
    if (fields && !isEditing) {
      const initialValues: Record<string, unknown> = {};
      fields.forEach((field) => {
        initialValues[field.id] = field.field_value;
      });
      setEditedValues(initialValues);
    }
  }, [fields, isEditing]);

  const handleSave = async () => {
    const fieldsToUpdate = Object.entries(editedValues)
      .filter(([id, value]) => {
        const field = fields?.find((f) => f.id === id);
        return field && value !== field.field_value;
      })
      .map(([id, value]) => ({
        definitionId: id,
        value,
      }));

    if (fieldsToUpdate.length === 0) {
      setIsEditing(false);
      return;
    }

    await batchUpdate.mutateAsync({
      entityType,
      entityId,
      fields: fieldsToUpdate,
    });

    setIsEditing(false);
  };

  const handleCancel = () => {
    // Reset to original values
    const initialValues: Record<string, unknown> = {};
    fields?.forEach((field) => {
      initialValues[field.id] = field.field_value;
    });
    setEditedValues(initialValues);
    setIsEditing(false);
  };

  const updateValue = (fieldId: string, value: unknown) => {
    setEditedValues((prev) => ({ ...prev, [fieldId]: value }));
  };

  const renderFieldInput = (field: CustomFieldWithValue) => {
    const value = editedValues[field.id];

    switch (field.field_type) {
      case 'text':
        return (
          <input
            type="text"
            value={(value as string) || ''}
            onChange={(e) => updateValue(field.id, e.target.value)}
            placeholder={field.placeholder || ''}
            disabled={!isEditing}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50 disabled:text-gray-600"
          />
        );

      case 'textarea':
        return (
          <textarea
            value={(value as string) || ''}
            onChange={(e) => updateValue(field.id, e.target.value)}
            placeholder={field.placeholder || ''}
            disabled={!isEditing}
            rows={3}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50 disabled:text-gray-600"
          />
        );

      case 'number':
        return (
          <input
            type="number"
            value={(value as number) ?? ''}
            onChange={(e) => updateValue(field.id, e.target.value ? Number(e.target.value) : null)}
            placeholder={field.placeholder || ''}
            disabled={!isEditing}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50 disabled:text-gray-600"
          />
        );

      case 'date':
        return (
          <input
            type="date"
            value={(value as string) || ''}
            onChange={(e) => updateValue(field.id, e.target.value || null)}
            disabled={!isEditing}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50 disabled:text-gray-600"
          />
        );

      case 'boolean':
        return (
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={(value as boolean) || false}
              onChange={(e) => updateValue(field.id, e.target.checked)}
              disabled={!isEditing}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700">{value ? 'Yes' : 'No'}</span>
          </label>
        );

      case 'select':
        return (
          <select
            value={(value as string) || ''}
            onChange={(e) => updateValue(field.id, e.target.value || null)}
            disabled={!isEditing}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50 disabled:text-gray-600"
          >
            <option value="">Select...</option>
            {field.options?.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        );

      default:
        return null;
    }
  };

  const renderFieldValue = (field: CustomFieldWithValue) => {
    const value = field.field_value;

    if (value === null || value === undefined || value === '') {
      return <span className="text-gray-400">-</span>;
    }

    switch (field.field_type) {
      case 'boolean':
        return <span>{value ? 'Yes' : 'No'}</span>;
      case 'date':
        return (
          <span>
            {new Date(value as string).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })}
          </span>
        );
      case 'select':
        const option = field.options?.find((o) => o.value === value);
        return <span>{option?.label || value}</span>;
      default:
        return <span>{String(value)}</span>;
    }
  };

  if (isLoading) {
    return (
      <div className="animate-pulse">
        <div className="h-4 bg-gray-200 rounded w-24 mb-4" />
        <div className="space-y-3">
          <div className="h-8 bg-gray-100 rounded" />
          <div className="h-8 bg-gray-100 rounded" />
        </div>
      </div>
    );
  }

  if (!fields || fields.length === 0) {
    return null; // No custom fields defined for this entity type
  }

  const content = (
    <div className={compact ? 'space-y-3' : 'space-y-4'}>
      {isEditing ? (
        // Edit mode - show inputs
        fields.map((field) => (
          <div key={field.id}>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {field.field_label}
              {field.is_required && <span className="text-red-500 ml-1">*</span>}
            </label>
            {renderFieldInput(field)}
          </div>
        ))
      ) : (
        // View mode - show values in grid
        <div className="grid grid-cols-2 gap-4">
          {fields.map((field) => (
            <div key={field.id}>
              <div className="text-sm text-gray-500">{field.field_label}</div>
              <div className="text-gray-900">{renderFieldValue(field)}</div>
            </div>
          ))}
        </div>
      )}

      {/* Edit/Save buttons */}
      {isEditing ? (
        <div className="flex justify-end gap-2 pt-2">
          <button
            onClick={handleCancel}
            className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800"
          >
            <X className="w-4 h-4 inline mr-1" />
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={batchUpdate.isPending}
            className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            <Save className="w-4 h-4 inline mr-1" />
            {batchUpdate.isPending ? 'Saving...' : 'Save'}
          </button>
        </div>
      ) : (
        <button
          onClick={() => setIsEditing(true)}
          className="text-sm text-blue-600 hover:text-blue-800"
        >
          Edit custom fields
        </button>
      )}
    </div>
  );

  if (compact) {
    return content;
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200">
      {/* Header */}
      <div
        className={`px-6 py-4 border-b border-gray-100 flex items-center justify-between ${
          collapsible ? 'cursor-pointer hover:bg-gray-50' : ''
        }`}
        onClick={collapsible ? () => setIsCollapsed(!isCollapsed) : undefined}
      >
        <div className="flex items-center gap-2">
          <Settings className="w-5 h-5 text-gray-400" />
          <h3 className="font-semibold text-gray-900">Custom Fields</h3>
          <span className="text-sm text-gray-500">({fields.length})</span>
        </div>
        {collapsible && (
          <button className="p-1 text-gray-400 hover:text-gray-600">
            {isCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>
        )}
      </div>

      {/* Content */}
      {!isCollapsed && <div className="p-6">{content}</div>}
    </div>
  );
}
