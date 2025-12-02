import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2, Search, Package, Layers, Grid3X3 } from 'lucide-react';
import { supabase } from '../../../lib/supabase';

interface WoodVerticalProduct {
  id: string;
  sku_code: string;
  sku_name: string;
  height: number;
  rail_count: number;
  post_type: 'WOOD' | 'STEEL';
  style: string;
  post_spacing: number;
  is_active: boolean;
  post_material: { material_sku: string; material_name: string } | null;
  picket_material: { material_sku: string; material_name: string } | null;
  rail_material: { material_sku: string; material_name: string } | null;
  cap_material: { material_sku: string; material_name: string } | null;
  trim_material: { material_sku: string; material_name: string } | null;
}

interface WoodHorizontalProduct {
  id: string;
  sku_code: string;
  sku_name: string;
  height: number;
  post_type: 'WOOD' | 'STEEL';
  style: string;
  post_spacing: number;
  board_width_actual: number;
  is_active: boolean;
  post_material: { material_sku: string; material_name: string } | null;
  board_material: { material_sku: string; material_name: string } | null;
  nailer_material: { material_sku: string; material_name: string } | null;
  cap_material: { material_sku: string; material_name: string } | null;
}

interface IronProduct {
  id: string;
  sku_code: string;
  sku_name: string;
  height: number;
  post_type: string;
  style: string;
  panel_width: number;
  rails_per_panel: number;
  is_active: boolean;
  post_material: { material_sku: string; material_name: string } | null;
  panel_material: { material_sku: string; material_name: string } | null;
}

type FenceCategory = 'all' | 'wood-vertical' | 'wood-horizontal' | 'iron';

export default function SKUCatalogPage() {
  const [category, setCategory] = useState<FenceCategory>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [showInactive, setShowInactive] = useState(false);

  // Fetch all products
  const { data: woodVertical = [], isLoading: loadingWV } = useQuery({
    queryKey: ['wood-vertical-products'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('wood_vertical_products')
        .select(`
          *,
          post_material:post_material_id(material_sku, material_name),
          picket_material:picket_material_id(material_sku, material_name),
          rail_material:rail_material_id(material_sku, material_name),
          cap_material:cap_material_id(material_sku, material_name),
          trim_material:trim_material_id(material_sku, material_name)
        `)
        .order('sku_code');
      if (error) throw error;
      return data as WoodVerticalProduct[];
    },
  });

  const { data: woodHorizontal = [], isLoading: loadingWH } = useQuery({
    queryKey: ['wood-horizontal-products'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('wood_horizontal_products')
        .select(`
          *,
          post_material:post_material_id(material_sku, material_name),
          board_material:board_material_id(material_sku, material_name),
          nailer_material:nailer_material_id(material_sku, material_name),
          cap_material:cap_material_id(material_sku, material_name)
        `)
        .order('sku_code');
      if (error) throw error;
      return data as WoodHorizontalProduct[];
    },
  });

  const { data: iron = [], isLoading: loadingIron } = useQuery({
    queryKey: ['iron-products'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('iron_products')
        .select(`
          *,
          post_material:post_material_id(material_sku, material_name),
          panel_material:panel_material_id(material_sku, material_name)
        `)
        .order('sku_code');
      if (error) throw error;
      return data as IronProduct[];
    },
  });

  const isLoading = loadingWV || loadingWH || loadingIron;

  // Filter products
  const filterProducts = <T extends { sku_code: string; sku_name: string; is_active: boolean }>(
    products: T[]
  ): T[] => {
    return products.filter(p => {
      if (!showInactive && !p.is_active) return false;
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        return (
          p.sku_code.toLowerCase().includes(term) ||
          p.sku_name.toLowerCase().includes(term)
        );
      }
      return true;
    });
  };

  const filteredWV = filterProducts(woodVertical);
  const filteredWH = filterProducts(woodHorizontal);
  const filteredIron = filterProducts(iron);

  const showWV = category === 'all' || category === 'wood-vertical';
  const showWH = category === 'all' || category === 'wood-horizontal';
  const showIron = category === 'all' || category === 'iron';

  const totalCount =
    (showWV ? filteredWV.length : 0) +
    (showWH ? filteredWH.length : 0) +
    (showIron ? filteredIron.length : 0);

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-green-600 mx-auto mb-3" />
          <p className="text-gray-600">Loading SKU catalog...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-gray-50 overflow-hidden">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-lg font-bold text-gray-900">SKU Catalog</h1>
            <p className="text-xs text-gray-500">
              {totalCount} products
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Search */}
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search SKUs..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 pr-4 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 w-48"
              />
            </div>

            {/* Category Filter */}
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as FenceCategory)}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
            >
              <option value="all">All Categories</option>
              <option value="wood-vertical">Wood Vertical</option>
              <option value="wood-horizontal">Wood Horizontal</option>
              <option value="iron">Iron</option>
            </select>

            {/* Show Inactive Toggle */}
            <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
              <input
                type="checkbox"
                checked={showInactive}
                onChange={(e) => setShowInactive(e.target.checked)}
                className="rounded border-gray-300 text-green-600 focus:ring-green-500"
              />
              Show Inactive
            </label>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4 space-y-6">
        {/* Wood Vertical Section */}
        {showWV && filteredWV.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center">
                <Grid3X3 className="w-4 h-4 text-amber-700" />
              </div>
              <h2 className="text-sm font-semibold text-gray-700">
                Wood Vertical ({filteredWV.length})
              </h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {filteredWV.map(product => (
                <SKUCard
                  key={product.id}
                  sku={product.sku_code}
                  name={product.sku_name}
                  isActive={product.is_active}
                  details={[
                    `${product.height}' Height`,
                    `${product.rail_count} Rails`,
                    `${product.post_type} Post`,
                    `${product.post_spacing}' Spacing`,
                  ]}
                  materials={[
                    product.post_material?.material_name,
                    product.picket_material?.material_name,
                    product.rail_material?.material_name,
                    product.cap_material?.material_name,
                    product.trim_material?.material_name,
                  ].filter(Boolean) as string[]}
                />
              ))}
            </div>
          </section>
        )}

        {/* Wood Horizontal Section */}
        {showWH && filteredWH.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                <Layers className="w-4 h-4 text-blue-700" />
              </div>
              <h2 className="text-sm font-semibold text-gray-700">
                Wood Horizontal ({filteredWH.length})
              </h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {filteredWH.map(product => (
                <SKUCard
                  key={product.id}
                  sku={product.sku_code}
                  name={product.sku_name}
                  isActive={product.is_active}
                  details={[
                    `${product.height}' Height`,
                    `${product.post_type} Post`,
                    `${product.post_spacing}' Spacing`,
                    `${product.board_width_actual}" Boards`,
                  ]}
                  materials={[
                    product.post_material?.material_name,
                    product.board_material?.material_name,
                    product.nailer_material?.material_name,
                    product.cap_material?.material_name,
                  ].filter(Boolean) as string[]}
                />
              ))}
            </div>
          </section>
        )}

        {/* Iron Section */}
        {showIron && filteredIron.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 bg-gray-200 rounded-lg flex items-center justify-center">
                <Package className="w-4 h-4 text-gray-700" />
              </div>
              <h2 className="text-sm font-semibold text-gray-700">
                Iron ({filteredIron.length})
              </h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {filteredIron.map(product => (
                <SKUCard
                  key={product.id}
                  sku={product.sku_code}
                  name={product.sku_name}
                  isActive={product.is_active}
                  details={[
                    `${product.height}' Height`,
                    product.style,
                    `${product.panel_width}' Panels`,
                    product.rails_per_panel ? `${product.rails_per_panel} Rails` : null,
                  ].filter(Boolean) as string[]}
                  materials={[
                    product.post_material?.material_name,
                    product.panel_material?.material_name,
                  ].filter(Boolean) as string[]}
                />
              ))}
            </div>
          </section>
        )}

        {/* Empty State */}
        {totalCount === 0 && (
          <div className="text-center py-12">
            <Package className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-1">No products found</h3>
            <p className="text-gray-500">
              {searchTerm
                ? 'Try a different search term'
                : 'No products match the selected filters'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// SKU Card Component
function SKUCard({
  sku,
  name,
  isActive,
  details,
  materials,
}: {
  sku: string;
  name: string;
  isActive: boolean;
  details: string[];
  materials: string[];
}) {
  return (
    <div className={`bg-white rounded-lg border p-3 ${isActive ? 'border-gray-200' : 'border-gray-200 opacity-60'}`}>
      <div className="flex items-start justify-between mb-2">
        <div>
          <span className="font-mono text-sm font-semibold text-gray-900">{sku}</span>
          {!isActive && (
            <span className="ml-2 text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded">
              Inactive
            </span>
          )}
        </div>
      </div>
      <p className="text-xs text-gray-700 mb-2 line-clamp-2" title={name}>
        {name}
      </p>

      {/* Details */}
      <div className="flex flex-wrap gap-1 mb-2">
        {details.map((detail, i) => (
          <span key={i} className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded">
            {detail}
          </span>
        ))}
      </div>

      {/* Materials */}
      {materials.length > 0 && (
        <div className="border-t border-gray-100 pt-2 mt-2">
          <p className="text-[10px] text-gray-400 uppercase mb-1">Materials</p>
          <div className="space-y-0.5">
            {materials.slice(0, 3).map((mat, i) => (
              <p key={i} className="text-[10px] text-gray-500 truncate" title={mat}>
                {mat}
              </p>
            ))}
            {materials.length > 3 && (
              <p className="text-[10px] text-gray-400">+{materials.length - 3} more</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
