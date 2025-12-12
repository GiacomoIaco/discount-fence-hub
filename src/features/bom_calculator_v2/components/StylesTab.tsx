/**
 * StylesTab - Manage product styles with formula adjustments
 */

import { useState } from 'react';
import { Plus, Save, X, Edit2, AlertCircle, Layers } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { EmptyState } from './SharedComponents';
import type { ProductTypeV2, ProductStyleV2 } from '../hooks/useProductTypesV2';

// =============================================================================
// STYLES TAB
// =============================================================================

interface StylesTabProps {
  productType: ProductTypeV2;
  styles: ProductStyleV2[];
  isLoading: boolean;
  onRefresh: () => void;
}

export function StylesTab({
  productType,
  styles,
  isLoading,
  onRefresh,
}: StylesTabProps) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingStyle, setEditingStyle] = useState<ProductStyleV2 | null>(null);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Styles for {productType.name}</h2>
          <p className="text-sm text-gray-500">Define style variations with formula adjustments</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Style
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-8 h-8 border-2 border-purple-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : styles.length === 0 ? (
        <EmptyState
          icon={<Layers className="w-12 h-12" />}
          title="No styles configured"
          description="Add styles to define variations like 'Standard', 'Good Neighbor', etc."
          action={
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
            >
              <Plus className="w-4 h-4" />
              Add First Style
            </button>
          }
        />
      ) : (
        <div className="grid gap-4">
          {styles.map((style) => (
            <div
              key={style.id}
              className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-gray-900">{style.name}</h3>
                    <span className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded">
                      {style.code}
                    </span>
                  </div>
                  {style.description && (
                    <p className="text-sm text-gray-500 mt-1">{style.description}</p>
                  )}
                  {Object.keys(style.formula_adjustments || {}).length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {Object.entries(style.formula_adjustments).map(([key, value]) => (
                        <span key={key} className="px-2 py-1 text-xs bg-purple-50 text-purple-700 rounded">
                          {key}: {value}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setEditingStyle(style)}
                    className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-gray-700"
                    title="Edit"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Style Modal */}
      {(showAddModal || editingStyle) && (
        <StyleModal
          productTypeId={productType.id}
          style={editingStyle}
          onClose={() => {
            setShowAddModal(false);
            setEditingStyle(null);
          }}
          onSaved={() => {
            setShowAddModal(false);
            setEditingStyle(null);
            onRefresh();
          }}
        />
      )}
    </div>
  );
}

// =============================================================================
// STYLE MODAL
// =============================================================================

interface StyleModalProps {
  productTypeId: string;
  style: ProductStyleV2 | null;
  onClose: () => void;
  onSaved: () => void;
}

function StyleModal({
  productTypeId,
  style,
  onClose,
  onSaved,
}: StyleModalProps) {
  const [formData, setFormData] = useState({
    code: style?.code || '',
    name: style?.name || '',
    description: style?.description || '',
    formula_adjustments: JSON.stringify(style?.formula_adjustments || {}, null, 2),
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEditing = !!style;

  const handleSave = async () => {
    if (!formData.code.trim() || !formData.name.trim()) {
      setError('Code and Name are required');
      return;
    }

    let adjustments = {};
    try {
      adjustments = JSON.parse(formData.formula_adjustments || '{}');
    } catch {
      setError('Invalid JSON in formula adjustments');
      return;
    }

    setSaving(true);
    setError(null);

    const data = {
      product_type_id: productTypeId,
      code: formData.code.toLowerCase().replace(/\s+/g, '-'),
      name: formData.name,
      description: formData.description || null,
      formula_adjustments: adjustments,
    };

    let result;
    if (isEditing && style) {
      result = await supabase
        .from('product_styles_v2')
        .update(data)
        .eq('id', style.id);
    } else {
      result = await supabase
        .from('product_styles_v2')
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
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">
            {isEditing ? 'Edit Style' : 'Add Style'}
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5" />
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
              placeholder="e.g., standard-2-rail"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Standard 2 Rail"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Formula Adjustments (JSON)
            </label>
            <textarea
              value={formData.formula_adjustments}
              onChange={(e) => setFormData({ ...formData, formula_adjustments: e.target.value })}
              rows={4}
              placeholder='{"picket_multiplier": 1.11}'
              className="w-full px-3 py-2 border border-gray-300 rounded-lg font-mono text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              Key-value pairs for style-specific multipliers
            </p>
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
