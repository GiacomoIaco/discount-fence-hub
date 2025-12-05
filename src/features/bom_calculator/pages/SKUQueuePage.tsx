import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ListTodo, CheckCircle, Clock, Search, ExternalLink, AlertTriangle
} from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import type { FenceTypeDB, SKUStatus } from '../database.types';

type SKUType = FenceTypeDB | 'custom';

interface QueueItem {
  id: string;
  sku_code: string;
  sku_name: string;
  sku_type: SKUType;
  sku_status: SKUStatus;
  imported_at: string | null;
  populated_at: string | null;
  import_notes: string | null;
  created_at: string;
}

interface QueueStats {
  total: number;
  draft: number;
  complete: number;
  byType: Record<SKUType, { draft: number; complete: number }>;
}

const TYPE_LABELS: Record<SKUType, { label: string; abbr: string; color: string }> = {
  wood_vertical: { label: 'Wood Vertical', abbr: 'WV', color: 'bg-green-100 text-green-700' },
  wood_horizontal: { label: 'Wood Horizontal', abbr: 'WH', color: 'bg-blue-100 text-blue-700' },
  iron: { label: 'Iron', abbr: 'IR', color: 'bg-gray-100 text-gray-700' },
  custom: { label: 'Custom', abbr: 'CU', color: 'bg-purple-100 text-purple-700' },
};

interface SKUQueuePageProps {
  onEditSKU: (id: string, type: SKUType) => void;
}

export default function SKUQueuePage({ onEditSKU }: SKUQueuePageProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<SKUType | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<SKUStatus | 'all'>('all');

  // Fetch all SKUs with status
  const { data: allSKUs = [], isLoading } = useQuery({
    queryKey: ['sku-queue'],
    queryFn: async () => {
      const items: QueueItem[] = [];

      // Fetch from all product tables
      const [wv, wh, ir, custom] = await Promise.all([
        supabase.from('wood_vertical_products').select('id, sku_code, sku_name, sku_status, imported_at, populated_at, import_notes, created_at').order('sku_code'),
        supabase.from('wood_horizontal_products').select('id, sku_code, sku_name, sku_status, imported_at, populated_at, import_notes, created_at').order('sku_code'),
        supabase.from('iron_products').select('id, sku_code, sku_name, sku_status, imported_at, populated_at, import_notes, created_at').order('sku_code'),
        supabase.from('custom_products').select('id, sku_code, sku_name, sku_status, imported_at, populated_at, import_notes, created_at').order('sku_code'),
      ]);

      wv.data?.forEach(p => items.push({ ...p, sku_type: 'wood_vertical' as SKUType, sku_status: (p.sku_status || 'complete') as SKUStatus }));
      wh.data?.forEach(p => items.push({ ...p, sku_type: 'wood_horizontal' as SKUType, sku_status: (p.sku_status || 'complete') as SKUStatus }));
      ir.data?.forEach(p => items.push({ ...p, sku_type: 'iron' as SKUType, sku_status: (p.sku_status || 'complete') as SKUStatus }));
      custom.data?.forEach(p => items.push({ ...p, sku_type: 'custom' as SKUType, sku_status: (p.sku_status || 'complete') as SKUStatus }));

      // Sort by status (draft first) then by code
      items.sort((a, b) => {
        if (a.sku_status === 'draft' && b.sku_status !== 'draft') return -1;
        if (a.sku_status !== 'draft' && b.sku_status === 'draft') return 1;
        return a.sku_code.localeCompare(b.sku_code);
      });

      return items;
    },
  });

  // Calculate stats
  const stats: QueueStats = {
    total: allSKUs.length,
    draft: allSKUs.filter(s => s.sku_status === 'draft').length,
    complete: allSKUs.filter(s => s.sku_status === 'complete').length,
    byType: {
      wood_vertical: {
        draft: allSKUs.filter(s => s.sku_type === 'wood_vertical' && s.sku_status === 'draft').length,
        complete: allSKUs.filter(s => s.sku_type === 'wood_vertical' && s.sku_status === 'complete').length,
      },
      wood_horizontal: {
        draft: allSKUs.filter(s => s.sku_type === 'wood_horizontal' && s.sku_status === 'draft').length,
        complete: allSKUs.filter(s => s.sku_type === 'wood_horizontal' && s.sku_status === 'complete').length,
      },
      iron: {
        draft: allSKUs.filter(s => s.sku_type === 'iron' && s.sku_status === 'draft').length,
        complete: allSKUs.filter(s => s.sku_type === 'iron' && s.sku_status === 'complete').length,
      },
      custom: {
        draft: allSKUs.filter(s => s.sku_type === 'custom' && s.sku_status === 'draft').length,
        complete: allSKUs.filter(s => s.sku_type === 'custom' && s.sku_status === 'complete').length,
      },
    },
  };

  // Filter SKUs
  const filteredSKUs = allSKUs.filter(sku => {
    const matchesSearch = searchTerm === '' ||
      sku.sku_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      sku.sku_name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = typeFilter === 'all' || sku.sku_type === typeFilter;
    const matchesStatus = statusFilter === 'all' || sku.sku_status === statusFilter;
    return matchesSearch && matchesType && matchesStatus;
  });

  // Progress percentage
  const progressPercent = stats.total > 0 ? Math.round((stats.complete / stats.total) * 100) : 0;

  // Format date
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <div className="flex-1 flex flex-col bg-gray-50 overflow-hidden h-full">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ListTodo className="w-5 h-5 text-orange-600" />
            <div>
              <h1 className="text-lg font-bold text-gray-900">SKU Queue</h1>
              <p className="text-xs text-gray-500">Track SKU population progress</p>
            </div>
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="bg-white border-b border-gray-200 px-4 py-3">
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-gray-700">Overall Progress</span>
              <span className="text-xs text-gray-500">{stats.complete} / {stats.total} complete</span>
            </div>
            <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-green-500 transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
          <div className="text-2xl font-bold text-green-600">{progressPercent}%</div>
        </div>

        {/* Stats by Type */}
        <div className="grid grid-cols-4 gap-3 mt-3">
          {(Object.keys(TYPE_LABELS) as SKUType[]).map(type => {
            const typeStats = stats.byType[type];
            const typeTotal = typeStats.draft + typeStats.complete;
            const typePercent = typeTotal > 0 ? Math.round((typeStats.complete / typeTotal) * 100) : 100;
            return (
              <div
                key={type}
                className={`p-2 rounded-lg border cursor-pointer transition-colors ${
                  typeFilter === type ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
                }`}
                onClick={() => setTypeFilter(typeFilter === type ? 'all' : type)}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${TYPE_LABELS[type].color}`}>
                    {TYPE_LABELS[type].abbr}
                  </span>
                  <span className="text-[10px] text-gray-500">{typeStats.complete}/{typeTotal}</span>
                </div>
                <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-green-500"
                    style={{ width: `${typePercent}%` }}
                  />
                </div>
                {typeStats.draft > 0 && (
                  <div className="text-[10px] text-orange-600 mt-1">{typeStats.draft} pending</div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border-b border-gray-200 px-4 py-2 flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search SKU code or name..."
            className="w-full pl-8 pr-3 py-1.5 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as SKUStatus | 'all')}
          className="px-3 py-1.5 border border-gray-300 rounded text-sm"
        >
          <option value="all">All Status</option>
          <option value="draft">Draft (Pending)</option>
          <option value="complete">Complete</option>
        </select>

        <button
          onClick={() => { setSearchTerm(''); setTypeFilter('all'); setStatusFilter('all'); }}
          className="px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded"
        >
          Clear Filters
        </button>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
              <p className="text-sm text-gray-600">Loading SKUs...</p>
            </div>
          </div>
        ) : filteredSKUs.length === 0 ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
              <p className="text-sm font-medium text-gray-900">
                {stats.draft === 0 ? 'All SKUs are configured!' : 'No matching SKUs'}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {stats.draft === 0 ? 'Great job! All imported SKUs have been populated.' : 'Try adjusting your filters'}
              </p>
            </div>
          </div>
        ) : (
          <table className="w-full text-xs">
            <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
              <tr className="text-[10px] text-gray-500 uppercase">
                <th className="text-left py-2 px-4 w-8"></th>
                <th className="text-left py-2 px-4">SKU Code</th>
                <th className="text-left py-2 px-4">SKU Name</th>
                <th className="text-left py-2 px-4 w-24">Type</th>
                <th className="text-left py-2 px-4 w-24">Status</th>
                <th className="text-left py-2 px-4 w-28">Imported</th>
                <th className="text-left py-2 px-4 w-28">Populated</th>
                <th className="w-20"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredSKUs.map(sku => (
                <tr
                  key={`${sku.sku_type}-${sku.id}`}
                  className={`hover:bg-gray-50 ${sku.sku_status === 'draft' ? 'bg-orange-50' : ''}`}
                >
                  <td className="py-2 px-4 text-center">
                    {sku.sku_status === 'draft' ? (
                      <Clock className="w-4 h-4 text-orange-500" />
                    ) : (
                      <CheckCircle className="w-4 h-4 text-green-500" />
                    )}
                  </td>
                  <td className="py-2 px-4 font-mono font-medium">{sku.sku_code}</td>
                  <td className="py-2 px-4">
                    <div>{sku.sku_name}</div>
                    {sku.import_notes && (
                      <div className="text-[10px] text-gray-400 truncate max-w-xs">{sku.import_notes}</div>
                    )}
                  </td>
                  <td className="py-2 px-4">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${TYPE_LABELS[sku.sku_type].color}`}>
                      {TYPE_LABELS[sku.sku_type].label}
                    </span>
                  </td>
                  <td className="py-2 px-4">
                    {sku.sku_status === 'draft' ? (
                      <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-orange-100 text-orange-700 flex items-center gap-1 w-fit">
                        <AlertTriangle className="w-3 h-3" />
                        Draft
                      </span>
                    ) : (
                      <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-green-100 text-green-700 flex items-center gap-1 w-fit">
                        <CheckCircle className="w-3 h-3" />
                        Complete
                      </span>
                    )}
                  </td>
                  <td className="py-2 px-4 text-gray-500">{formatDate(sku.imported_at)}</td>
                  <td className="py-2 px-4 text-gray-500">{formatDate(sku.populated_at)}</td>
                  <td className="py-2 px-4">
                    <button
                      onClick={() => onEditSKU(sku.id, sku.sku_type)}
                      className={`px-2 py-1 text-xs rounded flex items-center gap-1 ${
                        sku.sku_status === 'draft'
                          ? 'bg-orange-600 text-white hover:bg-orange-700'
                          : 'text-blue-600 hover:bg-blue-50'
                      }`}
                    >
                      <ExternalLink className="w-3 h-3" />
                      {sku.sku_status === 'draft' ? 'Configure' : 'Edit'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
