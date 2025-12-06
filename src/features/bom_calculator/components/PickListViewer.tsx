import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  X,
  Loader2,
  Package,
  MapPin,
  List,
  Grid3X3,
  Printer,
  CheckCircle2,
} from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { fetchAndGeneratePickListPDF } from './PickListPDF';
import { showSuccess, showError } from '../../../lib/toast';

interface PickListViewerProps {
  projectId: string;
  projectCode: string;
  projectName: string;
  isBundle: boolean;
  onClose: () => void;
}

interface BOMItem {
  id: string;
  material_id: string;
  material_sku: string;
  material_name: string;
  category: string;
  sub_category: string | null;
  quantity: number;
  unit: string;
  notes: string | null;
}

interface PickProgress {
  id: string;
  project_id: string;
  material_id: string;
  is_complete: boolean;
  picked_quantity: number;
}

interface MaterialLocation {
  material_id: string;
  material_sku: string;
  area_id: string;
  area_name: string;
  area_code: string;
  color_hex: string;
  slot_id: string | null;
  slot_code: string | null;
  location_display: string;
}

type ViewMode = 'category' | 'location';

export default function PickListViewer({
  projectId,
  projectCode,
  projectName,
  isBundle,
  onClose,
}: PickListViewerProps) {
  const queryClient = useQueryClient();
  const [viewMode, setViewMode] = useState<ViewMode>('category');
  const [printing, setPrinting] = useState(false);
  const [pickedItems, setPickedItems] = useState<Set<string>>(new Set());
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // Get current user ID
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setCurrentUserId(data.user?.id || null);
    });
  }, []);

  // Fetch BOM items for the project
  const { data: bomItems = [], isLoading: loadingBOM } = useQuery({
    queryKey: ['pick-list-items', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('project_materials')
        .select(`
          id,
          material_id,
          final_quantity,
          materials (
            id,
            material_sku,
            material_name,
            category,
            sub_category,
            unit_type
          )
        `)
        .eq('project_id', projectId)
        .order('id');

      if (error) throw error;

      return data.map((item: any) => ({
        id: item.id,
        material_id: item.material_id,
        material_sku: item.materials?.material_sku || 'Unknown',
        material_name: item.materials?.material_name || 'Unknown Material',
        category: item.materials?.category || 'Other',
        sub_category: item.materials?.sub_category || null,
        quantity: item.final_quantity ?? 0,
        unit: item.materials?.unit_type || 'EA',
        notes: null,
      })) as BOMItem[];
    },
  });

  // Fetch existing pick progress
  const { data: pickProgress = [] } = useQuery({
    queryKey: ['pick-progress', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pick_progress')
        .select('*')
        .eq('project_id', projectId);

      if (error) throw error;
      return data as PickProgress[];
    },
  });

  // Initialize picked items from database
  useEffect(() => {
    if (pickProgress.length > 0) {
      const completedMaterialIds = new Set(
        pickProgress.filter(p => p.is_complete).map(p => p.material_id)
      );
      // Map material_ids to item ids
      const pickedItemIds = new Set(
        bomItems.filter(item => completedMaterialIds.has(item.material_id)).map(item => item.id)
      );
      setPickedItems(pickedItemIds);
    }
  }, [pickProgress, bomItems]);

  // Fetch material locations
  const { data: locations = [] } = useQuery({
    queryKey: ['material-locations-all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_material_locations')
        .select('*');

      if (error) throw error;
      return data as MaterialLocation[];
    },
  });

  // Create a map of material SKU to location
  const locationMap = useMemo(() => {
    const map = new Map<string, MaterialLocation>();
    locations.forEach(loc => {
      map.set(loc.material_sku, loc);
    });
    return map;
  }, [locations]);

  // Group items by category
  const itemsByCategory = useMemo(() => {
    const groups = new Map<string, BOMItem[]>();
    bomItems.forEach(item => {
      const key = item.category || 'Other';
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(item);
    });
    return Array.from(groups.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [bomItems]);

  // Group items by location
  const itemsByLocation = useMemo(() => {
    const groups = new Map<string, { location: MaterialLocation | null; items: BOMItem[] }>();
    const unassigned: BOMItem[] = [];

    bomItems.forEach(item => {
      const loc = locationMap.get(item.material_sku);
      if (loc) {
        const key = loc.area_id + (loc.slot_id || '');
        if (!groups.has(key)) {
          groups.set(key, { location: loc, items: [] });
        }
        groups.get(key)!.items.push(item);
      } else {
        unassigned.push(item);
      }
    });

    const result = Array.from(groups.values()).sort((a, b) =>
      (a.location?.area_name || '').localeCompare(b.location?.area_name || '')
    );

    if (unassigned.length > 0) {
      result.push({ location: null, items: unassigned });
    }

    return result;
  }, [bomItems, locationMap]);

  // Mutation to save pick progress
  const savePickProgressMutation = useMutation({
    mutationFn: async ({ materialId, quantity, isComplete }: { materialId: string; quantity: number; isComplete: boolean }) => {
      // Upsert the pick progress record
      const { error } = await supabase
        .from('pick_progress')
        .upsert({
          project_id: projectId,
          material_id: materialId,
          required_quantity: quantity,
          picked_quantity: isComplete ? quantity : 0,
          is_complete: isComplete,
          picked_by: isComplete ? currentUserId : null,
          picked_at: isComplete ? new Date().toISOString() : null,
        }, {
          onConflict: 'project_id,material_id',
        });

      if (error) throw error;
    },
    onSuccess: () => {
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['pick-progress', projectId] });
      queryClient.invalidateQueries({ queryKey: ['yard-mobile-schedule'] });
      queryClient.invalidateQueries({ queryKey: ['my-claimed-jobs'] });
    },
    onError: (error: any) => {
      showError(`Failed to save: ${error.message}`);
    },
  });

  // Toggle picked item
  const togglePicked = (itemId: string) => {
    const item = bomItems.find(i => i.id === itemId);
    if (!item) return;

    const newIsComplete = !pickedItems.has(itemId);

    // Update local state immediately for responsive UI
    setPickedItems(prev => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });

    // Save to database
    savePickProgressMutation.mutate({
      materialId: item.material_id,
      quantity: item.quantity,
      isComplete: newIsComplete,
    });
  };

  // Handle print
  const handlePrint = async () => {
    setPrinting(true);
    try {
      await fetchAndGeneratePickListPDF(projectId, supabase, 3);
      showSuccess('Pick list PDF generated');
    } catch (err: any) {
      showError(err.message);
    } finally {
      setPrinting(false);
    }
  };

  const pickedCount = pickedItems.size;
  const totalItems = bomItems.length;

  return (
    <div className="fixed inset-0 bg-black/50 sm:flex sm:items-center sm:justify-center z-50 sm:p-4">
      <div className="bg-white sm:rounded-xl shadow-2xl w-full sm:max-w-4xl h-full sm:h-auto sm:max-h-[90vh] flex flex-col">
        {/* Header - stacks vertically on phones */}
        <div className="px-3 py-2 sm:px-6 sm:py-4 border-b border-gray-200 flex-shrink-0">
          {/* Top row: code, name, close */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 sm:gap-4 flex-1 min-w-0">
              <div className="w-12 h-8 sm:w-16 sm:h-12 bg-gray-900 rounded-lg flex items-center justify-center flex-shrink-0">
                <span className="text-white font-mono font-bold text-sm sm:text-lg">{projectCode}</span>
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-sm sm:text-lg font-bold text-gray-900 truncate">{projectName}</h2>
                <div className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm text-gray-500">
                  <Package className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
                  <span>{totalItems} items</span>
                  {isBundle && (
                    <span className="px-1.5 py-0.5 bg-purple-100 text-purple-700 text-xs rounded-full hidden sm:inline">
                      Bundle
                    </span>
                  )}
                </div>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Bottom row: view toggle, progress, print - compact on phones */}
          <div className="flex items-center justify-between gap-2 mt-2 sm:mt-3">
            {/* View Mode Toggle - icons only on phones */}
            <div className="flex rounded-lg border border-gray-300 overflow-hidden flex-shrink-0">
              <button
                onClick={() => setViewMode('category')}
                className={`px-2 sm:px-3 py-1.5 text-sm font-medium flex items-center gap-1 sm:gap-1.5 transition-colors ${
                  viewMode === 'category'
                    ? 'bg-amber-500 text-white'
                    : 'bg-white text-gray-600 hover:bg-gray-50'
                }`}
                title="View by Category"
              >
                <List className="w-4 h-4" />
                <span className="hidden sm:inline">Category</span>
              </button>
              <button
                onClick={() => setViewMode('location')}
                className={`px-2 sm:px-3 py-1.5 text-sm font-medium flex items-center gap-1 sm:gap-1.5 transition-colors ${
                  viewMode === 'location'
                    ? 'bg-amber-500 text-white'
                    : 'bg-white text-gray-600 hover:bg-gray-50'
                }`}
                title="View by Location"
              >
                <MapPin className="w-4 h-4" />
                <span className="hidden sm:inline">Location</span>
              </button>
            </div>

            {/* Progress indicator - visible on phones */}
            {pickedCount > 0 && (
              <div className="flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                <CheckCircle2 className="w-3 h-3" />
                <span>{pickedCount}/{totalItems}</span>
              </div>
            )}

            <button
              onClick={handlePrint}
              disabled={printing}
              className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-50 flex-shrink-0"
              title="Print PDF"
            >
              {printing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Printer className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-3 sm:p-6">
          {loadingBOM ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="w-8 h-8 animate-spin text-amber-600" />
            </div>
          ) : bomItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-gray-500">
              <Package className="w-12 h-12 mb-3 text-gray-300" />
              <p className="text-lg font-medium">No items in pick list</p>
            </div>
          ) : viewMode === 'category' ? (
            // Category View
            <div className="space-y-4 sm:space-y-6">
              {itemsByCategory.map(([category, items]) => (
                <div key={category}>
                  <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                    <Grid3X3 className="w-4 h-4" />
                    {category}
                    <span className="text-gray-400 font-normal">({items.length})</span>
                  </h3>
                  {/* Card layout for phones, table for tablets+ */}
                  <div className="sm:hidden space-y-2">
                    {items.map((item) => {
                      const loc = locationMap.get(item.material_sku);
                      const isPicked = pickedItems.has(item.id);
                      return (
                        <div
                          key={item.id}
                          onClick={() => togglePicked(item.id)}
                          className={`p-3 rounded-lg cursor-pointer transition-colors ${
                            isPicked ? 'bg-green-50 border border-green-200' : 'bg-gray-50 border border-gray-200 active:bg-gray-100'
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <div
                              className={`w-6 h-6 rounded border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${
                                isPicked ? 'bg-green-500 border-green-500' : 'border-gray-300'
                              }`}
                            >
                              {isPicked && <CheckCircle2 className="w-4 h-4 text-white" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-2">
                                <span className={`font-mono font-bold text-sm ${isPicked ? 'text-green-700 line-through' : 'text-gray-900'}`}>
                                  {item.material_sku}
                                </span>
                                <span className={`font-bold text-sm flex-shrink-0 ${isPicked ? 'text-green-700' : 'text-gray-900'}`}>
                                  {item.quantity} {item.unit}
                                </span>
                              </div>
                              <p className={`text-sm mt-0.5 ${isPicked ? 'text-green-600 line-through' : 'text-gray-600'}`}>
                                {item.material_name}
                              </p>
                              {loc && (
                                <span
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium mt-1.5"
                                  style={{ backgroundColor: loc.color_hex + '20', color: loc.color_hex }}
                                >
                                  <MapPin className="w-3 h-3" />
                                  {loc.location_display}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {/* Table layout for tablets+ */}
                  <div className="hidden sm:block bg-gray-50 rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-100">
                        <tr>
                          <th className="w-10 px-3 py-2"></th>
                          <th className="px-3 py-2 text-left font-medium text-gray-600">SKU</th>
                          <th className="px-3 py-2 text-left font-medium text-gray-600">Description</th>
                          <th className="px-3 py-2 text-right font-medium text-gray-600">Qty</th>
                          <th className="px-3 py-2 text-left font-medium text-gray-600">Location</th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((item) => {
                          const loc = locationMap.get(item.material_sku);
                          const isPicked = pickedItems.has(item.id);
                          return (
                            <tr
                              key={item.id}
                              className={`border-t border-gray-200 cursor-pointer transition-colors ${
                                isPicked ? 'bg-green-50' : 'hover:bg-gray-100'
                              }`}
                              onClick={() => togglePicked(item.id)}
                            >
                              <td className="px-3 py-2">
                                <div
                                  className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                                    isPicked
                                      ? 'bg-green-500 border-green-500'
                                      : 'border-gray-300'
                                  }`}
                                >
                                  {isPicked && <CheckCircle2 className="w-3 h-3 text-white" />}
                                </div>
                              </td>
                              <td className={`px-3 py-2 font-mono font-medium ${isPicked ? 'text-green-700 line-through' : 'text-gray-900'}`}>
                                {item.material_sku}
                              </td>
                              <td className={`px-3 py-2 ${isPicked ? 'text-green-600 line-through' : 'text-gray-600'}`}>
                                {item.material_name}
                              </td>
                              <td className={`px-3 py-2 text-right font-semibold ${isPicked ? 'text-green-700' : 'text-gray-900'}`}>
                                {item.quantity} {item.unit}
                              </td>
                              <td className="px-3 py-2">
                                {loc ? (
                                  <span
                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium"
                                    style={{
                                      backgroundColor: loc.color_hex + '20',
                                      color: loc.color_hex,
                                    }}
                                  >
                                    <MapPin className="w-3 h-3" />
                                    {loc.location_display}
                                  </span>
                                ) : (
                                  <span className="text-gray-400 text-xs">Not assigned</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            // Location View
            <div className="space-y-4 sm:space-y-6">
              {itemsByLocation.map((group) => (
                <div key={group.location?.area_id || 'unassigned'}>
                  <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                    {group.location ? (
                      <>
                        <div
                          className="w-4 h-4 rounded"
                          style={{ backgroundColor: group.location.color_hex }}
                        />
                        <span style={{ color: group.location.color_hex }}>
                          {group.location.location_display}
                        </span>
                        <span className="text-gray-400 font-normal">({group.items.length})</span>
                      </>
                    ) : (
                      <>
                        <MapPin className="w-4 h-4 text-gray-400" />
                        <span className="text-gray-500">No Location Assigned</span>
                        <span className="text-gray-400 font-normal">({group.items.length})</span>
                      </>
                    )}
                  </h3>
                  {/* Card layout for phones */}
                  <div className="sm:hidden space-y-2">
                    {group.items.map((item) => {
                      const isPicked = pickedItems.has(item.id);
                      return (
                        <div
                          key={item.id}
                          onClick={() => togglePicked(item.id)}
                          className={`p-3 rounded-lg cursor-pointer transition-colors ${
                            isPicked ? 'bg-green-50 border border-green-200' : 'border active:bg-white/50'
                          }`}
                          style={{
                            backgroundColor: isPicked ? undefined : (group.location ? group.location.color_hex + '10' : '#f9fafb'),
                            borderColor: isPicked ? undefined : (group.location ? group.location.color_hex + '30' : '#e5e7eb'),
                          }}
                        >
                          <div className="flex items-start gap-3">
                            <div
                              className={`w-6 h-6 rounded border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${
                                isPicked ? 'bg-green-500 border-green-500' : 'border-gray-300'
                              }`}
                            >
                              {isPicked && <CheckCircle2 className="w-4 h-4 text-white" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-2">
                                <span className={`font-mono font-bold text-sm ${isPicked ? 'text-green-700 line-through' : 'text-gray-900'}`}>
                                  {item.material_sku}
                                </span>
                                <span className={`font-bold text-sm flex-shrink-0 ${isPicked ? 'text-green-700' : 'text-gray-900'}`}>
                                  {item.quantity} {item.unit}
                                </span>
                              </div>
                              <p className={`text-sm mt-0.5 ${isPicked ? 'text-green-600 line-through' : 'text-gray-600'}`}>
                                {item.material_name}
                              </p>
                              <span className="text-gray-500 text-xs mt-1 inline-block">
                                {item.category}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {/* Table layout for tablets+ */}
                  <div
                    className="hidden sm:block rounded-lg overflow-hidden"
                    style={{
                      backgroundColor: group.location ? group.location.color_hex + '10' : '#f9fafb',
                    }}
                  >
                    <table className="w-full text-sm">
                      <thead style={{
                        backgroundColor: group.location ? group.location.color_hex + '20' : '#f3f4f6',
                      }}>
                        <tr>
                          <th className="w-10 px-3 py-2"></th>
                          <th className="px-3 py-2 text-left font-medium text-gray-600">SKU</th>
                          <th className="px-3 py-2 text-left font-medium text-gray-600">Description</th>
                          <th className="px-3 py-2 text-right font-medium text-gray-600">Qty</th>
                          <th className="px-3 py-2 text-left font-medium text-gray-600">Category</th>
                        </tr>
                      </thead>
                      <tbody>
                        {group.items.map((item) => {
                          const isPicked = pickedItems.has(item.id);
                          return (
                            <tr
                              key={item.id}
                              className={`border-t cursor-pointer transition-colors ${
                                isPicked ? 'bg-green-50' : 'hover:bg-white/50'
                              }`}
                              style={{
                                borderColor: group.location ? group.location.color_hex + '30' : '#e5e7eb',
                              }}
                              onClick={() => togglePicked(item.id)}
                            >
                              <td className="px-3 py-2">
                                <div
                                  className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                                    isPicked
                                      ? 'bg-green-500 border-green-500'
                                      : 'border-gray-300'
                                  }`}
                                >
                                  {isPicked && <CheckCircle2 className="w-3 h-3 text-white" />}
                                </div>
                              </td>
                              <td className={`px-3 py-2 font-mono font-medium ${isPicked ? 'text-green-700 line-through' : 'text-gray-900'}`}>
                                {item.material_sku}
                              </td>
                              <td className={`px-3 py-2 ${isPicked ? 'text-green-600 line-through' : 'text-gray-600'}`}>
                                {item.material_name}
                              </td>
                              <td className={`px-3 py-2 text-right font-semibold ${isPicked ? 'text-green-700' : 'text-gray-900'}`}>
                                {item.quantity} {item.unit}
                              </td>
                              <td className="px-3 py-2 text-gray-500 text-xs">
                                {item.category}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer with progress - compact on phones */}
        <div className="px-3 py-3 sm:px-6 sm:py-4 border-t border-gray-200 bg-gray-50 sm:rounded-b-xl flex items-center justify-between flex-shrink-0 gap-3">
          <div className="flex items-center gap-2 sm:gap-4 flex-1 min-w-0">
            <div className="text-xs sm:text-sm text-gray-500 flex-shrink-0">
              {pickedCount}/{totalItems} picked
            </div>
            <div className="flex-1 max-w-32 sm:max-w-48 h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-green-500 transition-all duration-300"
                style={{ width: `${totalItems > 0 ? (pickedCount / totalItems) * 100 : 0}%` }}
              />
            </div>
          </div>
          <button
            onClick={onClose}
            className="px-3 sm:px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors text-sm font-medium flex-shrink-0"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
