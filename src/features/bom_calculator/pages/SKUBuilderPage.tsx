import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Loader2, Plus, Save, X,
  Grid3X3, Layers, Package
} from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { showSuccess, showError } from '../../../lib/toast';

interface Material {
  id: string;
  material_sku: string;
  material_name: string;
  category: string;
  unit_cost: number;
}

type ProductType = 'wood-vertical' | 'wood-horizontal' | 'iron';

interface WoodVerticalForm {
  sku_code: string;
  sku_name: string;
  height: number;
  rail_count: number;
  post_type: 'WOOD' | 'STEEL';
  style: string;
  post_spacing: number;
  post_material_id: string;
  picket_material_id: string;
  rail_material_id: string;
  cap_material_id: string;
  trim_material_id: string;
}

interface WoodHorizontalForm {
  sku_code: string;
  sku_name: string;
  height: number;
  post_type: 'WOOD' | 'STEEL';
  style: string;
  post_spacing: number;
  board_width_actual: number;
  post_material_id: string;
  board_material_id: string;
  nailer_material_id: string;
  cap_material_id: string;
}

interface IronForm {
  sku_code: string;
  sku_name: string;
  height: number;
  style: string;
  panel_width: number;
  rails_per_panel: number;
  post_material_id: string;
  panel_material_id: string;
}

const defaultWoodVertical: WoodVerticalForm = {
  sku_code: '',
  sku_name: '',
  height: 6,
  rail_count: 2,
  post_type: 'STEEL',
  style: 'Standard',
  post_spacing: 8,
  post_material_id: '',
  picket_material_id: '',
  rail_material_id: '',
  cap_material_id: '',
  trim_material_id: '',
};

const defaultWoodHorizontal: WoodHorizontalForm = {
  sku_code: '',
  sku_name: '',
  height: 6,
  post_type: 'WOOD',
  style: 'Standard',
  post_spacing: 6,
  board_width_actual: 5.5,
  post_material_id: '',
  board_material_id: '',
  nailer_material_id: '',
  cap_material_id: '',
};

const defaultIron: IronForm = {
  sku_code: '',
  sku_name: '',
  height: 6,
  style: 'Standard 2 Rail',
  panel_width: 8,
  rails_per_panel: 2,
  post_material_id: '',
  panel_material_id: '',
};

export default function SKUBuilderPage() {
  const queryClient = useQueryClient();
  const [productType, setProductType] = useState<ProductType>('wood-vertical');
  const [isCreating, setIsCreating] = useState(false);
  const [wvForm, setWvForm] = useState<WoodVerticalForm>(defaultWoodVertical);
  const [whForm, setWhForm] = useState<WoodHorizontalForm>(defaultWoodHorizontal);
  const [ironForm, setIronForm] = useState<IronForm>(defaultIron);

  // Fetch materials
  const { data: materials = [], isLoading: loadingMaterials } = useQuery({
    queryKey: ['materials-for-sku'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('materials')
        .select('id, material_sku, material_name, category, unit_cost')
        .eq('status', 'Active')
        .order('category')
        .order('material_name');
      if (error) throw error;
      return data as Material[];
    },
  });

  // Filter materials by category
  const postMaterials = materials.filter(m => m.category === '01-Post');
  const picketMaterials = materials.filter(m => m.category === '02-Pickets');
  const railMaterials = materials.filter(m => m.category === '03-Rails');
  const capTrimMaterials = materials.filter(m => m.category === '04-Cap/Trim');
  const horizontalBoardMaterials = materials.filter(m => m.category === '07-Horizontal Boards');
  const ironMaterials = materials.filter(m => m.category === '09-Iron');

  // Create mutations
  const createWoodVertical = useMutation({
    mutationFn: async (data: WoodVerticalForm) => {
      const { error } = await supabase.from('wood_vertical_products').insert({
        sku_code: data.sku_code,
        sku_name: data.sku_name,
        height: data.height,
        rail_count: data.rail_count,
        post_type: data.post_type,
        style: data.style,
        post_spacing: data.post_spacing,
        post_material_id: data.post_material_id || null,
        picket_material_id: data.picket_material_id || null,
        rail_material_id: data.rail_material_id || null,
        cap_material_id: data.cap_material_id || null,
        trim_material_id: data.trim_material_id || null,
        is_active: true,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      showSuccess('Wood Vertical SKU created');
      queryClient.invalidateQueries({ queryKey: ['wood-vertical-products'] });
      setWvForm(defaultWoodVertical);
      setIsCreating(false);
    },
    onError: (err: Error) => {
      showError(err.message || 'Failed to create SKU');
    },
  });

  const createWoodHorizontal = useMutation({
    mutationFn: async (data: WoodHorizontalForm) => {
      const { error } = await supabase.from('wood_horizontal_products').insert({
        sku_code: data.sku_code,
        sku_name: data.sku_name,
        height: data.height,
        post_type: data.post_type,
        style: data.style,
        post_spacing: data.post_spacing,
        board_width_actual: data.board_width_actual,
        post_material_id: data.post_material_id || null,
        board_material_id: data.board_material_id || null,
        nailer_material_id: data.nailer_material_id || null,
        cap_material_id: data.cap_material_id || null,
        is_active: true,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      showSuccess('Wood Horizontal SKU created');
      queryClient.invalidateQueries({ queryKey: ['wood-horizontal-products'] });
      setWhForm(defaultWoodHorizontal);
      setIsCreating(false);
    },
    onError: (err: Error) => {
      showError(err.message || 'Failed to create SKU');
    },
  });

  const createIron = useMutation({
    mutationFn: async (data: IronForm) => {
      const { error } = await supabase.from('iron_products').insert({
        sku_code: data.sku_code,
        sku_name: data.sku_name,
        height: data.height,
        post_type: 'STEEL',
        style: data.style,
        panel_width: data.panel_width,
        rails_per_panel: data.rails_per_panel,
        post_material_id: data.post_material_id || null,
        panel_material_id: data.panel_material_id || null,
        is_active: true,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      showSuccess('Iron SKU created');
      queryClient.invalidateQueries({ queryKey: ['iron-products'] });
      setIronForm(defaultIron);
      setIsCreating(false);
    },
    onError: (err: Error) => {
      showError(err.message || 'Failed to create SKU');
    },
  });

  const handleSubmit = () => {
    if (productType === 'wood-vertical') {
      if (!wvForm.sku_code || !wvForm.sku_name) {
        showError('SKU code and name are required');
        return;
      }
      createWoodVertical.mutate(wvForm);
    } else if (productType === 'wood-horizontal') {
      if (!whForm.sku_code || !whForm.sku_name) {
        showError('SKU code and name are required');
        return;
      }
      createWoodHorizontal.mutate(whForm);
    } else {
      if (!ironForm.sku_code || !ironForm.sku_name) {
        showError('SKU code and name are required');
        return;
      }
      createIron.mutate(ironForm);
    }
  };

  const isSaving = createWoodVertical.isPending || createWoodHorizontal.isPending || createIron.isPending;

  if (loadingMaterials) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-green-600 mx-auto mb-3" />
          <p className="text-gray-600">Loading materials...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-gray-50 overflow-hidden">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-gray-900">SKU Builder</h1>
            <p className="text-xs text-gray-500">Create new fence product configurations</p>
          </div>

          {!isCreating && (
            <button
              onClick={() => setIsCreating(true)}
              className="px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 flex items-center gap-2 font-medium transition-colors"
            >
              <Plus className="w-4 h-4" />
              New SKU
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        {!isCreating ? (
          <div className="text-center py-12">
            <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Create a New SKU</h3>
            <p className="text-gray-500 mb-6 max-w-md mx-auto">
              Use the SKU Builder to configure new fence products by specifying materials, dimensions, and specifications.
            </p>
            <button
              onClick={() => setIsCreating(true)}
              className="px-6 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 inline-flex items-center gap-2 font-medium transition-colors"
            >
              <Plus className="w-4 h-4" />
              Create New SKU
            </button>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto">
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
              {/* Form Header */}
              <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900">New Product SKU</h2>
                <button
                  onClick={() => setIsCreating(false)}
                  className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Product Type Tabs */}
              <div className="px-6 py-3 border-b border-gray-100 flex gap-2">
                <button
                  onClick={() => setProductType('wood-vertical')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors ${
                    productType === 'wood-vertical'
                      ? 'bg-amber-100 text-amber-800'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <Grid3X3 className="w-4 h-4" />
                  Wood Vertical
                </button>
                <button
                  onClick={() => setProductType('wood-horizontal')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors ${
                    productType === 'wood-horizontal'
                      ? 'bg-blue-100 text-blue-800'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <Layers className="w-4 h-4" />
                  Wood Horizontal
                </button>
                <button
                  onClick={() => setProductType('iron')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors ${
                    productType === 'iron'
                      ? 'bg-gray-200 text-gray-800'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <Package className="w-4 h-4" />
                  Iron
                </button>
              </div>

              {/* Form Content */}
              <div className="p-6 space-y-6">
                {/* Basic Info */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      SKU Code *
                    </label>
                    <input
                      type="text"
                      value={
                        productType === 'wood-vertical' ? wvForm.sku_code :
                        productType === 'wood-horizontal' ? whForm.sku_code :
                        ironForm.sku_code
                      }
                      onChange={(e) => {
                        const val = e.target.value.toUpperCase();
                        if (productType === 'wood-vertical') setWvForm({ ...wvForm, sku_code: val });
                        else if (productType === 'wood-horizontal') setWhForm({ ...whForm, sku_code: val });
                        else setIronForm({ ...ironForm, sku_code: val });
                      }}
                      placeholder="e.g., A01, H01, I01"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      SKU Name *
                    </label>
                    <input
                      type="text"
                      value={
                        productType === 'wood-vertical' ? wvForm.sku_name :
                        productType === 'wood-horizontal' ? whForm.sku_name :
                        ironForm.sku_name
                      }
                      onChange={(e) => {
                        if (productType === 'wood-vertical') setWvForm({ ...wvForm, sku_name: e.target.value });
                        else if (productType === 'wood-horizontal') setWhForm({ ...whForm, sku_name: e.target.value });
                        else setIronForm({ ...ironForm, sku_name: e.target.value });
                      }}
                      placeholder="Descriptive name"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    />
                  </div>
                </div>

                {/* Wood Vertical Form */}
                {productType === 'wood-vertical' && (
                  <>
                    <div className="grid grid-cols-4 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Height (ft)</label>
                        <select
                          value={wvForm.height}
                          onChange={(e) => setWvForm({ ...wvForm, height: Number(e.target.value) })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500"
                        >
                          <option value={4}>4'</option>
                          <option value={5}>5'</option>
                          <option value={6}>6'</option>
                          <option value={7}>7'</option>
                          <option value={8}>8'</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Rails</label>
                        <select
                          value={wvForm.rail_count}
                          onChange={(e) => setWvForm({ ...wvForm, rail_count: Number(e.target.value) })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500"
                        >
                          <option value={2}>2 Rails</option>
                          <option value={3}>3 Rails</option>
                          <option value={4}>4 Rails</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Post Type</label>
                        <select
                          value={wvForm.post_type}
                          onChange={(e) => setWvForm({ ...wvForm, post_type: e.target.value as 'WOOD' | 'STEEL' })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500"
                        >
                          <option value="STEEL">Steel</option>
                          <option value="WOOD">Wood</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Spacing (ft)</label>
                        <select
                          value={wvForm.post_spacing}
                          onChange={(e) => setWvForm({ ...wvForm, post_spacing: Number(e.target.value) })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500"
                        >
                          <option value={6}>6'</option>
                          <option value={8}>8'</option>
                          <option value={10}>10'</option>
                        </select>
                      </div>
                    </div>

                    <div className="border-t border-gray-100 pt-4">
                      <h3 className="text-sm font-medium text-gray-700 mb-3">Materials</h3>
                      <div className="grid grid-cols-2 gap-4">
                        <MaterialSelect
                          label="Post Material"
                          value={wvForm.post_material_id}
                          onChange={(v) => setWvForm({ ...wvForm, post_material_id: v })}
                          materials={postMaterials}
                          required
                        />
                        <MaterialSelect
                          label="Picket Material"
                          value={wvForm.picket_material_id}
                          onChange={(v) => setWvForm({ ...wvForm, picket_material_id: v })}
                          materials={picketMaterials}
                          required
                        />
                        <MaterialSelect
                          label="Rail Material"
                          value={wvForm.rail_material_id}
                          onChange={(v) => setWvForm({ ...wvForm, rail_material_id: v })}
                          materials={railMaterials}
                          required
                        />
                        <MaterialSelect
                          label="Cap Material"
                          value={wvForm.cap_material_id}
                          onChange={(v) => setWvForm({ ...wvForm, cap_material_id: v })}
                          materials={capTrimMaterials}
                        />
                        <MaterialSelect
                          label="Trim Material"
                          value={wvForm.trim_material_id}
                          onChange={(v) => setWvForm({ ...wvForm, trim_material_id: v })}
                          materials={capTrimMaterials}
                        />
                      </div>
                    </div>
                  </>
                )}

                {/* Wood Horizontal Form */}
                {productType === 'wood-horizontal' && (
                  <>
                    <div className="grid grid-cols-4 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Height (ft)</label>
                        <select
                          value={whForm.height}
                          onChange={(e) => setWhForm({ ...whForm, height: Number(e.target.value) })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500"
                        >
                          <option value={4}>4'</option>
                          <option value={5}>5'</option>
                          <option value={6}>6'</option>
                          <option value={7}>7'</option>
                          <option value={8}>8'</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Post Type</label>
                        <select
                          value={whForm.post_type}
                          onChange={(e) => setWhForm({ ...whForm, post_type: e.target.value as 'WOOD' | 'STEEL' })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500"
                        >
                          <option value="WOOD">Wood</option>
                          <option value="STEEL">Steel</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Spacing (ft)</label>
                        <select
                          value={whForm.post_spacing}
                          onChange={(e) => setWhForm({ ...whForm, post_spacing: Number(e.target.value) })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500"
                        >
                          <option value={6}>6'</option>
                          <option value={8}>8'</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Board Width</label>
                        <select
                          value={whForm.board_width_actual}
                          onChange={(e) => setWhForm({ ...whForm, board_width_actual: Number(e.target.value) })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500"
                        >
                          <option value={3.5}>3.5" (1x4)</option>
                          <option value={5.5}>5.5" (1x6)</option>
                          <option value={7.25}>7.25" (1x8)</option>
                        </select>
                      </div>
                    </div>

                    <div className="border-t border-gray-100 pt-4">
                      <h3 className="text-sm font-medium text-gray-700 mb-3">Materials</h3>
                      <div className="grid grid-cols-2 gap-4">
                        <MaterialSelect
                          label="Post Material"
                          value={whForm.post_material_id}
                          onChange={(v) => setWhForm({ ...whForm, post_material_id: v })}
                          materials={postMaterials}
                          required
                        />
                        <MaterialSelect
                          label="Board Material"
                          value={whForm.board_material_id}
                          onChange={(v) => setWhForm({ ...whForm, board_material_id: v })}
                          materials={horizontalBoardMaterials}
                          required
                        />
                        <MaterialSelect
                          label="Nailer Material"
                          value={whForm.nailer_material_id}
                          onChange={(v) => setWhForm({ ...whForm, nailer_material_id: v })}
                          materials={railMaterials}
                        />
                        <MaterialSelect
                          label="Cap Material"
                          value={whForm.cap_material_id}
                          onChange={(v) => setWhForm({ ...whForm, cap_material_id: v })}
                          materials={capTrimMaterials}
                        />
                      </div>
                    </div>
                  </>
                )}

                {/* Iron Form */}
                {productType === 'iron' && (
                  <>
                    <div className="grid grid-cols-4 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Height (ft)</label>
                        <select
                          value={ironForm.height}
                          onChange={(e) => setIronForm({ ...ironForm, height: Number(e.target.value) })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500"
                        >
                          <option value={4}>4'</option>
                          <option value={5}>5'</option>
                          <option value={6}>6'</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Style</label>
                        <select
                          value={ironForm.style}
                          onChange={(e) => setIronForm({ ...ironForm, style: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500"
                        >
                          <option value="Standard 2 Rail">Standard 2 Rail</option>
                          <option value="Standard 3 Rail">Standard 3 Rail</option>
                          <option value="Ameristar">Ameristar</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Panel Width</label>
                        <select
                          value={ironForm.panel_width}
                          onChange={(e) => setIronForm({ ...ironForm, panel_width: Number(e.target.value) })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500"
                        >
                          <option value={6}>6'</option>
                          <option value={8}>8'</option>
                          <option value={10}>10'</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Rails/Panel</label>
                        <select
                          value={ironForm.rails_per_panel}
                          onChange={(e) => setIronForm({ ...ironForm, rails_per_panel: Number(e.target.value) })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500"
                        >
                          <option value={2}>2</option>
                          <option value={3}>3</option>
                        </select>
                      </div>
                    </div>

                    <div className="border-t border-gray-100 pt-4">
                      <h3 className="text-sm font-medium text-gray-700 mb-3">Materials</h3>
                      <div className="grid grid-cols-2 gap-4">
                        <MaterialSelect
                          label="Post Material"
                          value={ironForm.post_material_id}
                          onChange={(v) => setIronForm({ ...ironForm, post_material_id: v })}
                          materials={postMaterials.filter(m => m.category === '01-Post')}
                          required
                        />
                        <MaterialSelect
                          label="Panel Material"
                          value={ironForm.panel_material_id}
                          onChange={(v) => setIronForm({ ...ironForm, panel_material_id: v })}
                          materials={ironMaterials}
                        />
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Form Footer */}
              <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-xl flex items-center justify-end gap-3">
                <button
                  onClick={() => setIsCreating(false)}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg text-sm transition-colors"
                  disabled={isSaving}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={isSaving}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium flex items-center gap-2 transition-colors disabled:bg-gray-400"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      Create SKU
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Material Select Component
function MaterialSelect({
  label,
  value,
  onChange,
  materials,
  required = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  materials: Material[];
  required?: boolean;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label} {required && '*'}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
      >
        <option value="">-- Select --</option>
        {materials.map((m) => (
          <option key={m.id} value={m.id}>
            {m.material_sku} - {m.material_name} (${m.unit_cost.toFixed(2)})
          </option>
        ))}
      </select>
    </div>
  );
}
