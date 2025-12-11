import { useState } from 'react';
import {
  Plus,
  Search,
  FileSpreadsheet,
  MoreVertical,
  Edit2,
  Trash2,
  Copy,
  Building2,
  Home,
  Check,
  X,
  Calendar,
} from 'lucide-react';
import { useRateSheets, useDeleteRateSheet, useCreateRateSheet } from '../hooks/useRateSheets';
import {
  PRICING_TYPE_LABELS,
  type RateSheet,
  type PricingType,
} from '../types';
import RateSheetEditorModal from './RateSheetEditorModal';

export default function RateSheetsList() {
  const [search, setSearch] = useState('');
  const [pricingTypeFilter, setPricingTypeFilter] = useState<string>('');
  const [activeFilter, setActiveFilter] = useState<string>('active');

  const [showEditor, setShowEditor] = useState(false);
  const [editingSheet, setEditingSheet] = useState<RateSheet | null>(null);
  const [menuOpen, setMenuOpen] = useState<string | null>(null);

  const { data: rateSheets, isLoading } = useRateSheets({
    search,
    pricing_type: pricingTypeFilter || undefined,
    is_active: activeFilter === 'active' ? true : activeFilter === 'inactive' ? false : undefined,
  });

  const deleteMutation = useDeleteRateSheet();
  const createMutation = useCreateRateSheet();

  const handleEdit = (sheet: RateSheet) => {
    setEditingSheet(sheet);
    setShowEditor(true);
    setMenuOpen(null);
  };

  const handleDelete = (sheet: RateSheet) => {
    if (confirm(`Delete rate sheet "${sheet.name}"? This cannot be undone.`)) {
      deleteMutation.mutate(sheet.id);
    }
    setMenuOpen(null);
  };

  const handleClone = async (sheet: RateSheet) => {
    const newName = `${sheet.name} (Copy)`;
    await createMutation.mutateAsync({
      name: newName,
      code: null,
      description: sheet.description,
      pricing_type: sheet.pricing_type,
      default_labor_markup: sheet.default_labor_markup,
      default_material_markup: sheet.default_material_markup,
      default_margin_target: sheet.default_margin_target,
      is_active: false,
      is_template: false,
    });
    setMenuOpen(null);
  };

  const getPricingTypeBadge = (type: PricingType) => {
    const styles: Record<PricingType, string> = {
      custom: 'bg-blue-100 text-blue-700',
      formula: 'bg-purple-100 text-purple-700',
      hybrid: 'bg-orange-100 text-orange-700',
    };
    return styles[type];
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4 flex-1">
          {/* Search */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search rate sheets..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Filters */}
          <select
            value={pricingTypeFilter}
            onChange={(e) => setPricingTypeFilter(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
          >
            <option value="">All Types</option>
            {Object.entries(PRICING_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>

          <select
            value={activeFilter}
            onChange={(e) => setActiveFilter(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
          >
            <option value="">All</option>
            <option value="active">Active Only</option>
            <option value="inactive">Inactive Only</option>
          </select>
        </div>

        <button
          onClick={() => {
            setEditingSheet(null);
            setShowEditor(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Rate Sheet
        </button>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full" />
        </div>
      ) : rateSheets?.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-100">
          <FileSpreadsheet className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900">No rate sheets yet</h3>
          <p className="text-gray-500 mt-1">Create your first rate sheet to start setting prices</p>
          <button
            onClick={() => setShowEditor(true)}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Create Rate Sheet
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {rateSheets?.map((sheet) => (
            <div
              key={sheet.id}
              className="bg-white rounded-xl border border-gray-100 p-4 hover:shadow-md transition-shadow"
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-50 rounded-lg">
                    <FileSpreadsheet className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-900">{sheet.name}</h3>
                    {sheet.code && (
                      <span className="text-sm text-gray-500">{sheet.code}</span>
                    )}
                  </div>
                </div>
                <div className="relative">
                  <button
                    onClick={() => setMenuOpen(menuOpen === sheet.id ? null : sheet.id)}
                    className="p-1 text-gray-400 hover:text-gray-600 rounded"
                  >
                    <MoreVertical className="w-4 h-4" />
                  </button>
                  {menuOpen === sheet.id && (
                    <div className="absolute right-0 top-8 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-10 min-w-[140px]">
                      <button
                        onClick={() => handleEdit(sheet)}
                        className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                      >
                        <Edit2 className="w-4 h-4" />
                        Edit
                      </button>
                      <button
                        onClick={() => handleClone(sheet)}
                        className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                      >
                        <Copy className="w-4 h-4" />
                        Clone
                      </button>
                      <hr className="my-1" />
                      <button
                        onClick={() => handleDelete(sheet)}
                        className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-gray-50"
                      >
                        <Trash2 className="w-4 h-4" />
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Badges */}
              <div className="flex items-center gap-2 mb-3">
                <span className={`px-2 py-0.5 text-xs rounded-full ${getPricingTypeBadge(sheet.pricing_type)}`}>
                  {PRICING_TYPE_LABELS[sheet.pricing_type]}
                </span>
                <span className={`px-2 py-0.5 text-xs rounded-full ${
                  sheet.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                }`}>
                  {sheet.is_active ? <Check className="w-3 h-3 inline mr-1" /> : <X className="w-3 h-3 inline mr-1" />}
                  {sheet.is_active ? 'Active' : 'Inactive'}
                </span>
                {sheet.is_template && (
                  <span className="px-2 py-0.5 text-xs rounded-full bg-yellow-100 text-yellow-700">
                    Template
                  </span>
                )}
              </div>

              {/* Description */}
              {sheet.description && (
                <p className="text-sm text-gray-600 mb-3 line-clamp-2">{sheet.description}</p>
              )}

              {/* Stats */}
              <div className="flex items-center gap-4 text-sm text-gray-500 border-t border-gray-100 pt-3">
                <div className="flex items-center gap-1">
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>{sheet.items_count || 0} SKUs</span>
                </div>

                {sheet.assignments && sheet.assignments.length > 0 && (
                  <div className="flex items-center gap-1">
                    {sheet.assignments.some((a: any) => a.client_id) && (
                      <>
                        <Building2 className="w-4 h-4" />
                        <span>
                          {sheet.assignments.filter((a: any) => a.client_id).length} clients
                        </span>
                      </>
                    )}
                    {sheet.assignments.some((a: any) => a.community_id) && (
                      <>
                        <Home className="w-4 h-4 ml-2" />
                        <span>
                          {sheet.assignments.filter((a: any) => a.community_id).length} communities
                        </span>
                      </>
                    )}
                  </div>
                )}

                <div className="flex items-center gap-1 ml-auto">
                  <Calendar className="w-4 h-4" />
                  <span>{new Date(sheet.effective_date).toLocaleDateString()}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Editor Modal */}
      {showEditor && (
        <RateSheetEditorModal
          rateSheet={editingSheet}
          onClose={() => {
            setShowEditor(false);
            setEditingSheet(null);
          }}
        />
      )}
    </div>
  );
}
