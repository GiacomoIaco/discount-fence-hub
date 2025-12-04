/**
 * Projects Page - v2
 *
 * View and manage saved BOM projects.
 * Shared data with v1 - uses same bom_projects table.
 */

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Loader2, Search, Folder, Trash2, Send, Package,
  MoreVertical, Clock, Check, CheckCircle, ChevronDown, ChevronRight,
  Pencil, Copy, ArrowRight
} from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { showSuccess, showError } from '../../../lib/toast';
import { format, isToday, isTomorrow, isPast } from 'date-fns';

// =============================================================================
// TYPES
// =============================================================================

interface BOMProject {
  id: string;
  project_name: string;
  customer_name: string | null;
  status: string;
  total_material_cost: number | null;
  total_labor_cost: number | null;
  total_cost: number | null;
  expected_pickup_date: string | null;
  partial_pickup: boolean | null;
  partial_pickup_notes: string | null;
  is_bundle: boolean | null;
  bundle_id: string | null;
  created_at: string;
  updated_at: string;
  business_unit: { id: string; code: string; name: string } | null;
  yard: { id: string; code: string; name: string } | null;
  children?: BOMProject[];
}

interface Yard {
  id: string;
  code: string;
  name: string;
}

type StatusFilter = 'all' | 'draft' | 'ready' | 'sent_to_yard' | 'staged' | 'completed';

// =============================================================================
// CONSTANTS
// =============================================================================

const STATUS_CONFIG: Record<string, { label: string; color: string; bgColor: string; icon: React.ReactNode }> = {
  draft: { label: 'Draft', color: 'text-gray-600', bgColor: 'bg-gray-100', icon: <Clock className="w-3 h-3" /> },
  ready: { label: 'Ready', color: 'text-blue-600', bgColor: 'bg-blue-100', icon: <Check className="w-3 h-3" /> },
  sent_to_yard: { label: 'Sent to Yard', color: 'text-orange-600', bgColor: 'bg-orange-100', icon: <Send className="w-3 h-3" /> },
  staged: { label: 'Staged', color: 'text-purple-600', bgColor: 'bg-purple-100', icon: <Package className="w-3 h-3" /> },
  completed: { label: 'Completed', color: 'text-green-600', bgColor: 'bg-green-100', icon: <CheckCircle className="w-3 h-3" /> },
};

const STATUS_WORKFLOW: Record<string, string | null> = {
  draft: 'ready',
  ready: 'sent_to_yard',
  sent_to_yard: 'staged',
  staged: 'completed',
  completed: null,
};

// =============================================================================
// MAIN COMPONENT
// =============================================================================

interface ProjectsPageProps {
  onEditProject?: (projectId: string) => void;
  onDuplicateProject?: (projectId: string) => void;
}

export function ProjectsPage({ onEditProject, onDuplicateProject }: ProjectsPageProps) {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [yardFilter, setYardFilter] = useState<string>('all');
  const [expandedBundles, setExpandedBundles] = useState<Set<string>>(new Set());

  // Fetch projects
  const { data: projects = [], isLoading } = useQuery({
    queryKey: ['bom-projects-v2'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bom_projects')
        .select(`
          id, project_name, customer_name, status,
          total_material_cost, total_labor_cost, total_cost,
          expected_pickup_date, partial_pickup, partial_pickup_notes,
          is_bundle, bundle_id, created_at, updated_at,
          business_unit:business_unit_id(id, code, name),
          yard:yard_id(id, code, name)
        `)
        .order('updated_at', { ascending: false });

      if (error) throw error;
      // Handle Supabase returning arrays for single relations
      return (data || []).map((p: any) => ({
        ...p,
        business_unit: Array.isArray(p.business_unit) ? p.business_unit[0] : p.business_unit,
        yard: Array.isArray(p.yard) ? p.yard[0] : p.yard,
      })) as BOMProject[];
    },
  });

  // Fetch yards for filter
  const { data: yards = [] } = useQuery({
    queryKey: ['yards-v2'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('yards')
        .select('id, code, name')
        .eq('is_active', true)
        .order('code');
      if (error) throw error;
      return data as Yard[];
    },
  });

  // Filter and organize projects
  const { filteredProjects, bundles, standaloneProjects } = useMemo(() => {
    let filtered = projects.filter(p => {
      if (statusFilter !== 'all' && p.status !== statusFilter) return false;
      if (yardFilter !== 'all' && p.yard?.id !== yardFilter) return false;
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        return (
          p.project_name.toLowerCase().includes(term) ||
          p.customer_name?.toLowerCase().includes(term) ||
          p.business_unit?.code.toLowerCase().includes(term)
        );
      }
      return true;
    });

    // Separate bundles and standalone projects
    const bundleMap = new Map<string, BOMProject>();
    const childMap = new Map<string, BOMProject[]>();
    const standalone: BOMProject[] = [];

    filtered.forEach(p => {
      if (p.is_bundle) {
        bundleMap.set(p.id, p);
        if (!childMap.has(p.id)) childMap.set(p.id, []);
      } else if (p.bundle_id) {
        const children = childMap.get(p.bundle_id) || [];
        children.push(p);
        childMap.set(p.bundle_id, children);
      } else {
        standalone.push(p);
      }
    });

    return {
      filteredProjects: filtered,
      bundles: Array.from(bundleMap.values()).map(b => ({
        ...b,
        children: childMap.get(b.id) || [],
      })),
      standaloneProjects: standalone,
    };
  }, [projects, statusFilter, yardFilter, searchTerm]);

  // Status change mutation
  const statusMutation = useMutation({
    mutationFn: async ({ projectId, newStatus }: { projectId: string; newStatus: string }) => {
      const { error } = await supabase
        .from('bom_projects')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', projectId);
      if (error) throw error;
    },
    onSuccess: () => {
      showSuccess('Status updated');
      queryClient.invalidateQueries({ queryKey: ['bom-projects-v2'] });
    },
    onError: (err: Error) => showError(err.message),
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (projectId: string) => {
      const { error } = await supabase
        .from('bom_projects')
        .delete()
        .eq('id', projectId);
      if (error) throw error;
    },
    onSuccess: () => {
      showSuccess('Project deleted');
      queryClient.invalidateQueries({ queryKey: ['bom-projects-v2'] });
    },
    onError: (err: Error) => showError(err.message),
  });

  const toggleBundleExpand = (bundleId: string) => {
    const newSet = new Set(expandedBundles);
    if (newSet.has(bundleId)) {
      newSet.delete(bundleId);
    } else {
      newSet.add(bundleId);
    }
    setExpandedBundles(newSet);
  };

  const formatPickupDate = (date: string | null) => {
    if (!date) return null;
    const d = new Date(date);
    if (isToday(d)) return 'Today';
    if (isTomorrow(d)) return 'Tomorrow';
    return format(d, 'MMM d');
  };

  const getPickupDateStyle = (date: string | null) => {
    if (!date) return 'text-gray-400';
    const d = new Date(date);
    if (isPast(d) && !isToday(d)) return 'text-red-600 font-semibold';
    if (isToday(d)) return 'text-orange-600 font-semibold';
    if (isTomorrow(d)) return 'text-amber-600 font-semibold';
    return 'text-gray-700';
  };

  const formatCurrency = (num: number | null) =>
    num != null ? '$' + num.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) : '-';

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-purple-600 mx-auto mb-3" />
          <p className="text-gray-600">Loading projects...</p>
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
            <h1 className="text-lg font-bold text-gray-900">Projects</h1>
            <p className="text-xs text-gray-500">
              {filteredProjects.length} project{filteredProjects.length !== 1 ? 's' : ''}
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Search */}
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search projects..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 pr-4 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 w-48"
              />
            </div>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
            >
              <option value="all">All Status</option>
              <option value="draft">Draft</option>
              <option value="ready">Ready</option>
              <option value="sent_to_yard">Sent to Yard</option>
              <option value="staged">Staged</option>
              <option value="completed">Completed</option>
            </select>

            {/* Yard Filter */}
            <select
              value={yardFilter}
              onChange={(e) => setYardFilter(e.target.value)}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
            >
              <option value="all">All Yards</option>
              {yards.map(y => (
                <option key={y.id} value={y.id}>{y.code}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {filteredProjects.length === 0 ? (
          <div className="text-center py-12">
            <Folder className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No projects found</h3>
            <p className="text-gray-500">
              {searchTerm || statusFilter !== 'all' || yardFilter !== 'all'
                ? 'Try adjusting your filters'
                : 'Create your first project using the Calculator'}
            </p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 sticky top-0">
              <tr className="text-xs text-gray-500 uppercase border-b border-gray-200">
                <th className="w-10 px-3 py-3"></th>
                <th className="text-left px-3 py-3 font-medium">Status</th>
                <th className="text-left px-3 py-3 font-medium">Project</th>
                <th className="text-left px-3 py-3 font-medium">Customer</th>
                <th className="text-center px-3 py-3 font-medium">Yard</th>
                <th className="text-center px-3 py-3 font-medium">Pickup</th>
                <th className="text-right px-3 py-3 font-medium">Material</th>
                <th className="text-right px-3 py-3 font-medium">Labor</th>
                <th className="text-right px-3 py-3 font-medium">Total</th>
                <th className="text-center px-3 py-3 font-medium w-24">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {/* Bundles */}
              {bundles.map(bundle => (
                <BundleRow
                  key={bundle.id}
                  bundle={bundle}
                  isExpanded={expandedBundles.has(bundle.id)}
                  onToggle={() => toggleBundleExpand(bundle.id)}
                  onStatusChange={(status) => statusMutation.mutate({ projectId: bundle.id, newStatus: status })}
                  formatPickupDate={formatPickupDate}
                  getPickupDateStyle={getPickupDateStyle}
                  formatCurrency={formatCurrency}
                />
              ))}

              {/* Standalone Projects */}
              {standaloneProjects.map(project => (
                <ProjectRow
                  key={project.id}
                  project={project}
                  onEdit={onEditProject ? () => onEditProject(project.id) : undefined}
                  onDuplicate={onDuplicateProject ? () => onDuplicateProject(project.id) : undefined}
                  onDelete={() => {
                    if (confirm('Delete this project? This cannot be undone.')) {
                      deleteMutation.mutate(project.id);
                    }
                  }}
                  onStatusChange={(status) => statusMutation.mutate({ projectId: project.id, newStatus: status })}
                  formatPickupDate={formatPickupDate}
                  getPickupDateStyle={getPickupDateStyle}
                  formatCurrency={formatCurrency}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// STATUS BADGE
// =============================================================================

function StatusBadge({ status }: { status: string }) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.draft;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${config.bgColor} ${config.color}`}>
      {config.icon}
      {config.label}
    </span>
  );
}

// =============================================================================
// BUNDLE ROW
// =============================================================================

function BundleRow({
  bundle,
  isExpanded,
  onToggle,
  onStatusChange,
  formatPickupDate,
  getPickupDateStyle,
  formatCurrency,
}: {
  bundle: BOMProject;
  isExpanded: boolean;
  onToggle: () => void;
  onStatusChange: (status: string) => void;
  formatPickupDate: (date: string | null) => string | null;
  getPickupDateStyle: (date: string | null) => string;
  formatCurrency: (num: number | null) => string;
}) {
  return (
    <>
      <tr className="bg-purple-50 hover:bg-purple-100">
        <td className="px-3 py-2">
          <button onClick={onToggle} className="p-1 hover:bg-purple-200 rounded">
            {isExpanded ? (
              <ChevronDown className="w-4 h-4 text-purple-600" />
            ) : (
              <ChevronRight className="w-4 h-4 text-purple-600" />
            )}
          </button>
        </td>
        <td className="px-3 py-2"><StatusBadge status={bundle.status} /></td>
        <td className="px-3 py-2">
          <div className="flex items-center gap-2">
            <Package className="w-4 h-4 text-purple-600" />
            <div>
              <div className="font-semibold text-gray-900">{bundle.project_name}</div>
              <div className="text-xs text-purple-600">{bundle.children?.length || 0} projects</div>
            </div>
          </div>
        </td>
        <td className="px-3 py-2 text-sm text-gray-500">-</td>
        <td className="px-3 py-2 text-center">
          {bundle.yard && (
            <span className="px-2 py-0.5 bg-gray-200 text-gray-700 text-xs font-medium rounded">
              {bundle.yard.code}
            </span>
          )}
        </td>
        <td className={`px-3 py-2 text-center text-sm ${getPickupDateStyle(bundle.expected_pickup_date)}`}>
          {formatPickupDate(bundle.expected_pickup_date) || '-'}
        </td>
        <td className="px-3 py-2 text-right text-sm text-gray-500">-</td>
        <td className="px-3 py-2 text-right text-sm text-gray-500">-</td>
        <td className="px-3 py-2 text-right font-semibold text-gray-900">
          {formatCurrency(bundle.total_cost)}
        </td>
        <td className="px-3 py-2 text-center">
          <select
            value={bundle.status}
            onChange={(e) => onStatusChange(e.target.value)}
            className="text-xs px-2 py-1 border border-gray-300 rounded"
          >
            {Object.entries(STATUS_CONFIG).map(([key, config]) => (
              <option key={key} value={key}>{config.label}</option>
            ))}
          </select>
        </td>
      </tr>
      {/* Bundle Children */}
      {isExpanded && bundle.children?.map(child => (
        <tr key={child.id} className="bg-purple-25 hover:bg-gray-50">
          <td className="px-3 py-2">
            <div className="w-4 h-4 ml-2 border-l-2 border-b-2 border-purple-300 rounded-bl" />
          </td>
          <td className="px-3 py-2"><StatusBadge status={child.status} /></td>
          <td className="px-3 py-2 pl-8">
            <div className="font-medium text-gray-900">{child.project_name}</div>
            {child.business_unit && (
              <div className="text-xs text-gray-500">{child.business_unit.code}</div>
            )}
          </td>
          <td className="px-3 py-2 text-sm text-gray-600">{child.customer_name || '-'}</td>
          <td className="px-3 py-2 text-center">
            {child.yard && (
              <span className="px-2 py-0.5 bg-gray-200 text-gray-700 text-xs font-medium rounded">
                {child.yard.code}
              </span>
            )}
          </td>
          <td className={`px-3 py-2 text-center text-sm ${getPickupDateStyle(child.expected_pickup_date)}`}>
            {formatPickupDate(child.expected_pickup_date) || '-'}
          </td>
          <td className="px-3 py-2 text-right text-sm text-green-600">{formatCurrency(child.total_material_cost)}</td>
          <td className="px-3 py-2 text-right text-sm text-blue-600">{formatCurrency(child.total_labor_cost)}</td>
          <td className="px-3 py-2 text-right font-semibold text-gray-900">{formatCurrency(child.total_cost)}</td>
          <td className="px-3 py-2"></td>
        </tr>
      ))}
    </>
  );
}

// =============================================================================
// PROJECT ROW
// =============================================================================

function ProjectRow({
  project,
  onEdit,
  onDuplicate,
  onDelete,
  onStatusChange,
  formatPickupDate,
  getPickupDateStyle,
  formatCurrency,
}: {
  project: BOMProject;
  onEdit?: () => void;
  onDuplicate?: () => void;
  onDelete: () => void;
  onStatusChange: (status: string) => void;
  formatPickupDate: (date: string | null) => string | null;
  getPickupDateStyle: (date: string | null) => string;
  formatCurrency: (num: number | null) => string;
}) {
  const [showMenu, setShowMenu] = useState(false);
  const nextStatus = STATUS_WORKFLOW[project.status];

  return (
    <tr className="hover:bg-gray-50">
      <td className="px-3 py-2"></td>
      <td className="px-3 py-2"><StatusBadge status={project.status} /></td>
      <td className="px-3 py-2">
        <div className="font-medium text-gray-900">{project.project_name}</div>
        {project.business_unit && (
          <div className="text-xs text-gray-500">{project.business_unit.code}</div>
        )}
      </td>
      <td className="px-3 py-2 text-sm text-gray-600">{project.customer_name || '-'}</td>
      <td className="px-3 py-2 text-center">
        {project.yard && (
          <span className="px-2 py-0.5 bg-gray-200 text-gray-700 text-xs font-medium rounded">
            {project.yard.code}
          </span>
        )}
      </td>
      <td className={`px-3 py-2 text-center text-sm ${getPickupDateStyle(project.expected_pickup_date)}`}>
        {formatPickupDate(project.expected_pickup_date) || '-'}
      </td>
      <td className="px-3 py-2 text-right text-sm text-green-600">{formatCurrency(project.total_material_cost)}</td>
      <td className="px-3 py-2 text-right text-sm text-blue-600">{formatCurrency(project.total_labor_cost)}</td>
      <td className="px-3 py-2 text-right font-semibold text-gray-900">{formatCurrency(project.total_cost)}</td>
      <td className="px-3 py-2">
        <div className="flex items-center justify-center gap-1">
          {onEdit && (
            <button
              onClick={onEdit}
              className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"
              title="Edit"
            >
              <Pencil className="w-4 h-4" />
            </button>
          )}
          {nextStatus && (
            <button
              onClick={() => onStatusChange(nextStatus)}
              className="p-1.5 text-green-600 hover:bg-green-50 rounded"
              title={`Advance to ${STATUS_CONFIG[nextStatus]?.label}`}
            >
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
          <div className="relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
            >
              <MoreVertical className="w-4 h-4" />
            </button>
            {showMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
                <div className="absolute right-0 top-full mt-1 w-40 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-20">
                  {onDuplicate && (
                    <button
                      onClick={() => { setShowMenu(false); onDuplicate(); }}
                      className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                    >
                      <Copy className="w-4 h-4" />
                      Duplicate
                    </button>
                  )}
                  <hr className="my-1" />
                  <button
                    onClick={() => { setShowMenu(false); onDelete(); }}
                    className="w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </td>
    </tr>
  );
}
