import { useState, useEffect } from 'react';
import { Plus, Search, Edit2, Trash2, X, Save, Loader2 } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { showSuccess, showError } from '../../../lib/toast';

interface Material {
  id: string;
  material_sku: string;
  material_name: string;
  sub_category: string | null;
  category: string;
  unit_cost: number;
  unit_type: string;
  length_ft: number | null;
  width_nominal: number | null;
  actual_width: number | null;
  thickness: string | null;
  status: 'Active' | 'Inactive';
  normally_stocked: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface MaterialFormData {
  material_sku: string;
  material_name: string;
  sub_category: string;
  category: string;
  unit_cost: string;
  unit_type: string;
  status: 'Active' | 'Inactive';
  notes: string;
}

const CATEGORIES = [
  '01-Post',
  '02-Pickets',
  '03-Rails',
  '04-Cap/Trim',
  '05-Rot Board',
  '06-Concrete',
  '07-Horizontal Boards',
  '08-Hardware',
  '09-Iron',
  '10-Other'
];

const UNIT_TYPES = ['Each', 'LF', 'SF', 'Bags', 'Box', 'Set', 'Per LF'];

export default function MaterialsPage() {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'Active' | 'Inactive'>('Active');

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState<Material | null>(null);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState<MaterialFormData>({
    material_sku: '',
    material_name: '',
    sub_category: '',
    category: '01-Post',
    unit_cost: '',
    unit_type: 'Each',
    status: 'Active',
    notes: '',
  });

  useEffect(() => {
    loadMaterials();
  }, []);

  const loadMaterials = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('materials')
        .select('*')
        .order('category', { ascending: true })
        .order('material_name', { ascending: true });

      if (error) throw error;
      setMaterials(data || []);
    } catch (error) {
      console.error('Error loading materials:', error);
      showError('Failed to load materials');
    } finally {
      setLoading(false);
    }
  };

  const openCreateModal = () => {
    setEditingMaterial(null);
    setFormData({
      material_sku: '',
      material_name: '',
      sub_category: '',
      category: '01-Post',
      unit_cost: '',
      unit_type: 'Each',
      status: 'Active',
      notes: '',
    });
    setShowModal(true);
  };

  const openEditModal = (material: Material) => {
    setEditingMaterial(material);
    setFormData({
      material_sku: material.material_sku,
      material_name: material.material_name,
      sub_category: material.sub_category || '',
      category: material.category,
      unit_cost: material.unit_cost.toString(),
      unit_type: material.unit_type,
      status: material.status,
      notes: material.notes || '',
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!formData.material_sku.trim() || !formData.material_name.trim() || !formData.unit_cost) {
      showError('Please fill in all required fields');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        material_sku: formData.material_sku.trim().toUpperCase(),
        material_name: formData.material_name.trim(),
        sub_category: formData.sub_category.trim() || null,
        category: formData.category,
        unit_cost: parseFloat(formData.unit_cost),
        unit_type: formData.unit_type,
        status: formData.status,
        notes: formData.notes.trim() || null,
      };

      if (editingMaterial) {
        // Update existing
        const { error } = await supabase
          .from('materials')
          .update({ ...payload, updated_at: new Date().toISOString() })
          .eq('id', editingMaterial.id);

        if (error) throw error;
        showSuccess('Material updated');
      } else {
        // Create new
        const { error } = await supabase
          .from('materials')
          .insert([payload]);

        if (error) throw error;
        showSuccess('Material created');
      }

      setShowModal(false);
      loadMaterials();
    } catch (error: any) {
      console.error('Error saving material:', error);
      showError(error.message || 'Failed to save material');
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async (material: Material) => {
    if (!confirm(`Are you sure you want to ${material.status === 'Active' ? 'deactivate' : 'activate'} "${material.material_name}"?`)) {
      return;
    }

    try {
      const newStatus = material.status === 'Active' ? 'Inactive' : 'Active';
      const { error } = await supabase
        .from('materials')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', material.id);

      if (error) throw error;
      showSuccess(`Material ${newStatus === 'Active' ? 'activated' : 'deactivated'}`);
      loadMaterials();
    } catch (error) {
      console.error('Error updating status:', error);
      showError('Failed to update status');
    }
  };

  // Filter materials
  const filteredMaterials = materials.filter(m => {
    const matchesSearch =
      m.material_sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.material_name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = !categoryFilter || m.category === categoryFilter;
    const matchesStatus = statusFilter === 'all' || m.status === statusFilter;
    return matchesSearch && matchesCategory && matchesStatus;
  });

  // Get unique categories from data
  const usedCategories = [...new Set(materials.map(m => m.category))].sort();

  return (
    <div className="flex-1 flex flex-col bg-gray-50 overflow-hidden">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Materials</h1>
            <p className="text-sm text-gray-600 mt-1">
              Manage materials and pricing for BOM calculations
            </p>
          </div>
          <button
            onClick={openCreateModal}
            className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 flex items-center gap-2 font-medium transition-colors"
          >
            <Plus className="w-5 h-5" />
            Add Material
          </button>
        </div>

        {/* Filters */}
        <div className="mt-4 flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by SKU or name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
            />
          </div>

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
          >
            <option value="">All Categories</option>
            {usedCategories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
          >
            <option value="Active">Active Only</option>
            <option value="Inactive">Inactive Only</option>
            <option value="all">All Status</option>
          </select>

          <span className="text-sm text-gray-500">
            {filteredMaterials.length} materials
          </span>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 animate-spin text-green-600" />
          </div>
        ) : filteredMaterials.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500">No materials found</p>
          </div>
        ) : (
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    SKU
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Category
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Unit Cost
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Unit
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredMaterials.map(material => (
                  <tr key={material.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-mono text-gray-900">
                      {material.material_sku}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm font-medium text-gray-900">{material.material_name}</div>
                      {material.sub_category && (
                        <div className="text-xs text-gray-500 truncate max-w-xs">
                          {material.sub_category}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {material.category}
                    </td>
                    <td className="px-4 py-3 text-sm text-right font-medium text-gray-900">
                      ${material.unit_cost.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-sm text-center text-gray-600">
                      {material.unit_type}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                        material.status === 'Active'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-600'
                      }`}>
                        {material.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openEditModal(material)}
                          className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded"
                          title="Edit"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeactivate(material)}
                          className={`p-1.5 rounded ${
                            material.status === 'Active'
                              ? 'text-gray-500 hover:text-red-600 hover:bg-red-50'
                              : 'text-gray-500 hover:text-green-600 hover:bg-green-50'
                          }`}
                          title={material.status === 'Active' ? 'Deactivate' : 'Activate'}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900">
                {editingMaterial ? 'Edit Material' : 'Add Material'}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    SKU <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.material_sku}
                    onChange={(e) => setFormData({ ...formData, material_sku: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 uppercase"
                    placeholder="PS13"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Category <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  >
                    {CATEGORIES.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.material_name}
                  onChange={(e) => setFormData({ ...formData, material_name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  placeholder="Material name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Sub-Category
                </label>
                <input
                  type="text"
                  value={formData.sub_category}
                  onChange={(e) => setFormData({ ...formData, sub_category: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  placeholder="e.g., Wood, Steel, 1x6"
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Unit Cost <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.unit_cost}
                      onChange={(e) => setFormData({ ...formData, unit_cost: e.target.value })}
                      className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                      placeholder="0.00"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Unit Type <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.unit_type}
                    onChange={(e) => setFormData({ ...formData, unit_type: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  >
                    {UNIT_TYPES.map(unit => (
                      <option key={unit} value={unit}>{unit}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Status
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notes
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  rows={2}
                  placeholder="Optional notes..."
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 flex items-center gap-2 font-medium transition-colors"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    {editingMaterial ? 'Update' : 'Create'}
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
