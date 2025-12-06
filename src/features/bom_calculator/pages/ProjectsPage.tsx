import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Loader2, Search, Folder, Trash2, Send, Package,
  MoreVertical, Archive, Eye, Users, AlertTriangle, Check, Clock,
  Truck, CheckCircle, ChevronDown, ChevronRight, X, Copy, Pencil,
  ArrowRight
} from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { showSuccess, showError } from '../../../lib/toast';
import { format, isToday, isTomorrow, isPast } from 'date-fns';

interface ProjectsPageProps {
  onEditProject?: (projectId: string) => void;
  onDuplicateProject?: (projectId: string) => void;
}

interface BOMProject {
  id: string;
  project_name: string;
  customer_name: string | null;
  status: string;
  total_linear_feet: number | null;
  total_material_cost: number | null;
  total_labor_cost: number | null;
  total_project_cost: number | null;
  cost_per_foot: number | null;
  notes: string | null;
  yard_id: string | null;
  expected_pickup_date: string | null;
  crew_name: string | null;
  adjustment_flagged: boolean | null;
  is_bundle: boolean | null;
  bundle_id: string | null;
  bundle_name: string | null;
  created_by: string | null;
  partial_pickup: boolean | null;
  partial_pickup_notes: string | null;
  is_archived: boolean | null;
  archived_at: string | null;
  archived_by: string | null;
  created_at: string;
  updated_at: string;
  business_unit: {
    id: string;
    code: string;
    name: string;
  } | null;
  yard: {
    id: string;
    code: string;
    name: string;
  } | null;
  creator: {
    id: string;
    full_name: string | null;
    email: string;
  } | null;
  children?: BOMProject[];
}

interface Yard {
  id: string;
  code: string;
  name: string;
}

type StatusFilter = 'all' | 'draft' | 'ready' | 'sent_to_yard' | 'staged' | 'completed' | 'partial_pickup';

const STATUS_CONFIG: Record<string, { label: string; color: string; bgColor: string; icon: React.ReactNode }> = {
  draft: { label: 'Draft', color: 'text-gray-600', bgColor: 'bg-gray-100', icon: <Clock className="w-3 h-3" /> },
  ready: { label: 'Ready', color: 'text-blue-600', bgColor: 'bg-blue-100', icon: <Check className="w-3 h-3" /> },
  sent_to_yard: { label: 'Sent to Yard', color: 'text-orange-600', bgColor: 'bg-orange-100', icon: <Send className="w-3 h-3" /> },
  staged: { label: 'Staged', color: 'text-purple-600', bgColor: 'bg-purple-100', icon: <Package className="w-3 h-3" /> },
  completed: { label: 'Completed', color: 'text-green-600', bgColor: 'bg-green-100', icon: <CheckCircle className="w-3 h-3" /> },
  cancelled: { label: 'Cancelled', color: 'text-red-600', bgColor: 'bg-red-100', icon: <X className="w-3 h-3" /> },
  archived: { label: 'Archived', color: 'text-gray-500', bgColor: 'bg-gray-200', icon: <Archive className="w-3 h-3" /> },
};

// Status workflow - defines the next status in the workflow
const STATUS_WORKFLOW: Record<string, string | null> = {
  draft: 'ready',
  ready: 'sent_to_yard',
  sent_to_yard: 'staged',
  staged: 'completed',
  completed: null, // No next status
};

export default function ProjectsPage({ onEditProject, onDuplicateProject }: ProjectsPageProps) {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [yardFilter, setYardFilter] = useState<string>('all');
  const [creatorFilter, setCreatorFilter] = useState<string>('all');
  const [selectedProjects, setSelectedProjects] = useState<Set<string>>(new Set());
  const [expandedBundles, setExpandedBundles] = useState<Set<string>>(new Set());
  const [showBundleModal, setShowBundleModal] = useState(false);
  const [completionModal, setCompletionModal] = useState<{ projectId: string; projectName: string; isChildOfBundle?: boolean } | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  // Fetch projects
  const { data: projects = [], isLoading } = useQuery({
    queryKey: ['bom-projects'],
    queryFn: async () => {
      // Fetch projects
      const { data: projectsData, error: projectsError } = await supabase
        .from('bom_projects')
        .select(`
          *,
          business_unit:business_unit_id(id, code, name),
          yard:yard_id(id, code, name)
        `)
        .order('expected_pickup_date', { ascending: true, nullsFirst: false })
        .order('updated_at', { ascending: false });

      if (projectsError) throw projectsError;

      // Get unique creator IDs
      const creatorIds = [...new Set(projectsData?.map(p => p.created_by).filter(Boolean))] as string[];

      // Fetch creators if any
      let creatorsMap: Record<string, { id: string; full_name: string | null; email: string }> = {};
      if (creatorIds.length > 0) {
        const { data: creators } = await supabase
          .from('user_profiles')
          .select('id, full_name, email')
          .in('id', creatorIds);

        if (creators) {
          creatorsMap = Object.fromEntries(creators.map(c => [c.id, c]));
        }
      }

      // Merge creator info
      return (projectsData || []).map(p => ({
        ...p,
        creator: p.created_by ? creatorsMap[p.created_by] || null : null,
      })) as BOMProject[];
    },
  });

  // Fetch yards for filter
  const { data: yards = [] } = useQuery({
    queryKey: ['yards'],
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

  // Get unique creators for filter dropdown
  const uniqueCreators = useMemo(() => {
    const creators = new Map<string, { id: string; name: string }>();
    projects.forEach(p => {
      if (p.creator) {
        creators.set(p.creator.id, {
          id: p.creator.id,
          name: p.creator.full_name || p.creator.email.split('@')[0]
        });
      }
    });
    return Array.from(creators.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [projects]);

  // Filter and organize projects
  const { filteredProjects, bundles, standaloneProjects } = useMemo(() => {
    let filtered = projects.filter(p => {
      // Archive filter - hide archived unless showArchived is true
      if (!showArchived && p.is_archived) return false;
      if (showArchived && !p.is_archived) return false;
      // Status filter - special handling for partial_pickup
      if (statusFilter === 'partial_pickup') {
        if (!p.partial_pickup) return false;
      } else if (statusFilter !== 'all' && p.status !== statusFilter) {
        return false;
      }
      // Yard filter
      if (yardFilter !== 'all' && p.yard_id !== yardFilter) return false;
      // Creator filter
      if (creatorFilter !== 'all' && p.created_by !== creatorFilter) return false;
      // Search
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        return (
          p.project_name.toLowerCase().includes(term) ||
          p.customer_name?.toLowerCase().includes(term) ||
          p.business_unit?.code.toLowerCase().includes(term) ||
          p.crew_name?.toLowerCase().includes(term)
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
  }, [projects, statusFilter, yardFilter, creatorFilter, searchTerm, showArchived]);

  // Status change mutation - handles bundle auto-breaking for child projects
  const statusMutation = useMutation({
    mutationFn: async ({ projectIds, newStatus, isChildOfBundle }: { projectIds: string[]; newStatus: string; isChildOfBundle?: boolean }) => {
      // Update the status
      const { error } = await supabase
        .from('bom_projects')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .in('id', projectIds);
      if (error) throw error;

      // If this is a child of a bundle changing independently, remove it from bundle
      if (isChildOfBundle && projectIds.length === 1) {
        const project = projects.find(p => p.id === projectIds[0]);
        if (project?.bundle_id) {
          // Remove from bundle
          await supabase
            .from('bom_projects')
            .update({ bundle_id: null })
            .eq('id', projectIds[0]);

          // Check if bundle now has less than 2 children
          const { data: remainingChildren } = await supabase
            .from('bom_projects')
            .select('id')
            .eq('bundle_id', project.bundle_id);

          if (remainingChildren && remainingChildren.length < 2) {
            // Dissolve bundle - remove bundle_id from remaining child(ren)
            await supabase
              .from('bom_projects')
              .update({ bundle_id: null })
              .eq('bundle_id', project.bundle_id);

            // Delete the bundle itself
            await supabase
              .from('bom_projects')
              .delete()
              .eq('id', project.bundle_id);
          }
        }
      }
    },
    onSuccess: (_, variables) => {
      showSuccess(variables.isChildOfBundle ? 'Status updated (removed from bundle)' : 'Status updated');
      queryClient.invalidateQueries({ queryKey: ['bom-projects'] });
      setSelectedProjects(new Set());
    },
    onError: (err: Error) => showError(err.message),
  });

  // Create bundle mutation
  const createBundleMutation = useMutation({
    mutationFn: async ({ projectIds, bundleName }: { projectIds: string[]; bundleName: string }) => {
      // Get the first project to copy yard/pickup date
      const firstProject = projects.find(p => projectIds.includes(p.id));
      if (!firstProject) throw new Error('No projects selected');

      // Create bundle
      const { data: bundle, error: bundleError } = await supabase
        .from('bom_projects')
        .insert({
          project_name: bundleName,
          is_bundle: true,
          bundle_name: bundleName,
          status: firstProject.status,
          yard_id: firstProject.yard_id,
          expected_pickup_date: firstProject.expected_pickup_date,
          crew_name: firstProject.crew_name,
          business_unit_id: firstProject.business_unit?.id,
        })
        .select('id')
        .single();

      if (bundleError) throw bundleError;

      // Update projects to point to bundle
      const { error: updateError } = await supabase
        .from('bom_projects')
        .update({ bundle_id: bundle.id })
        .in('id', projectIds);

      if (updateError) throw updateError;
    },
    onSuccess: () => {
      showSuccess('Bundle created');
      queryClient.invalidateQueries({ queryKey: ['bom-projects'] });
      setSelectedProjects(new Set());
      setShowBundleModal(false);
    },
    onError: (err: Error) => showError(err.message),
  });

  // Unbundle mutation
  const unbundleMutation = useMutation({
    mutationFn: async (bundleId: string) => {
      // Remove bundle_id from children
      const { error: updateError } = await supabase
        .from('bom_projects')
        .update({ bundle_id: null })
        .eq('bundle_id', bundleId);
      if (updateError) throw updateError;

      // Delete bundle
      const { error: deleteError } = await supabase
        .from('bom_projects')
        .delete()
        .eq('id', bundleId);
      if (deleteError) throw deleteError;
    },
    onSuccess: () => {
      showSuccess('Bundle dissolved');
      queryClient.invalidateQueries({ queryKey: ['bom-projects'] });
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
      queryClient.invalidateQueries({ queryKey: ['bom-projects'] });
    },
    onError: (err: Error) => showError(err.message),
  });

  // Complete with partial pickup mutation
  const completeWithPartialMutation = useMutation({
    mutationFn: async ({
      projectId,
      isPartial,
      notes,
      isChildOfBundle
    }: {
      projectId: string;
      isPartial: boolean;
      notes: string;
      isChildOfBundle?: boolean
    }) => {
      // Update the project
      const { error } = await supabase
        .from('bom_projects')
        .update({
          status: 'completed',
          partial_pickup: isPartial,
          partial_pickup_notes: isPartial ? notes : null,
          updated_at: new Date().toISOString()
        })
        .eq('id', projectId);
      if (error) throw error;

      // Handle bundle auto-breaking if this is a child
      if (isChildOfBundle) {
        const project = projects.find(p => p.id === projectId);
        if (project?.bundle_id) {
          // Remove from bundle
          await supabase
            .from('bom_projects')
            .update({ bundle_id: null })
            .eq('id', projectId);

          // Check if bundle now has less than 2 children
          const { data: remainingChildren } = await supabase
            .from('bom_projects')
            .select('id')
            .eq('bundle_id', project.bundle_id);

          if (remainingChildren && remainingChildren.length < 2) {
            // Dissolve bundle
            await supabase
              .from('bom_projects')
              .update({ bundle_id: null })
              .eq('bundle_id', project.bundle_id);
            await supabase
              .from('bom_projects')
              .delete()
              .eq('id', project.bundle_id);
          }
        }
      }
    },
    onSuccess: (_, variables) => {
      showSuccess(variables.isPartial ? 'Marked completed (partial pickup)' : 'Marked completed');
      queryClient.invalidateQueries({ queryKey: ['bom-projects'] });
      setCompletionModal(null);
    },
    onError: (err: Error) => showError(err.message),
  });

  // Clear partial pickup mutation (for completing the remaining pickup)
  const clearPartialPickupMutation = useMutation({
    mutationFn: async (projectId: string) => {
      const { error } = await supabase
        .from('bom_projects')
        .update({
          partial_pickup: false,
          partial_pickup_notes: null,
          updated_at: new Date().toISOString()
        })
        .eq('id', projectId);
      if (error) throw error;
    },
    onSuccess: () => {
      showSuccess('Partial pickup cleared - project fully completed');
      queryClient.invalidateQueries({ queryKey: ['bom-projects'] });
    },
    onError: (err: Error) => showError(err.message),
  });

  // Archive/Unarchive mutation
  const archiveMutation = useMutation({
    mutationFn: async ({ projectId, archive }: { projectId: string; archive: boolean }) => {
      const { error } = await supabase
        .from('bom_projects')
        .update({
          is_archived: archive,
          archived_at: archive ? new Date().toISOString() : null,
          updated_at: new Date().toISOString()
        })
        .eq('id', projectId);
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      showSuccess(variables.archive ? 'Project archived' : 'Project restored');
      queryClient.invalidateQueries({ queryKey: ['bom-projects'] });
    },
    onError: (err: Error) => showError(err.message),
  });

  const toggleProjectSelection = (projectId: string) => {
    const newSet = new Set(selectedProjects);
    if (newSet.has(projectId)) {
      newSet.delete(projectId);
    } else {
      newSet.add(projectId);
    }
    setSelectedProjects(newSet);
  };

  const toggleBundleExpand = (bundleId: string) => {
    const newSet = new Set(expandedBundles);
    if (newSet.has(bundleId)) {
      newSet.delete(bundleId);
    } else {
      newSet.add(bundleId);
    }
    setExpandedBundles(newSet);
  };

  // Check if selected projects can be bundled (same yard + pickup date)
  const canBundle = useMemo(() => {
    if (selectedProjects.size < 2) return false;
    const selected = projects.filter(p => selectedProjects.has(p.id) && !p.is_bundle && !p.bundle_id);
    if (selected.length < 2) return false;

    const firstYard = selected[0].yard_id;
    const firstDate = selected[0].expected_pickup_date;

    return selected.every(p => p.yard_id === firstYard && p.expected_pickup_date === firstDate);
  }, [selectedProjects, projects]);

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

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-green-600 mx-auto mb-3" />
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
              {selectedProjects.size > 0 && ` • ${selectedProjects.size} selected`}
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
                className="pl-9 pr-4 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 w-48"
              />
            </div>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
            >
              <option value="all">All Status</option>
              <option value="draft">Draft</option>
              <option value="ready">Ready</option>
              <option value="sent_to_yard">Sent to Yard</option>
              <option value="staged">Staged</option>
              <option value="completed">Completed</option>
              <option value="partial_pickup">⚠️ Partial Pickup</option>
            </select>

            {/* Yard Filter */}
            <select
              value={yardFilter}
              onChange={(e) => setYardFilter(e.target.value)}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
            >
              <option value="all">All Yards</option>
              {yards.map(y => (
                <option key={y.id} value={y.id}>{y.code}</option>
              ))}
            </select>

            {/* Creator Filter */}
            <select
              value={creatorFilter}
              onChange={(e) => setCreatorFilter(e.target.value)}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
            >
              <option value="all">All Creators</option>
              {uniqueCreators.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>

            {/* Show Archived Toggle */}
            <button
              onClick={() => setShowArchived(!showArchived)}
              className={`px-3 py-1.5 text-sm rounded-lg flex items-center gap-2 transition-colors ${
                showArchived
                  ? 'bg-gray-700 text-white'
                  : 'border border-gray-300 text-gray-600 hover:bg-gray-50'
              }`}
            >
              <Archive className="w-4 h-4" />
              {showArchived ? 'Viewing Archived' : 'Show Archived'}
            </button>

            {/* Bundle Button */}
            {selectedProjects.size >= 2 && (
              <button
                onClick={() => setShowBundleModal(true)}
                disabled={!canBundle}
                className={`px-4 py-1.5 text-sm rounded-lg flex items-center gap-2 font-medium transition-colors ${
                  canBundle
                    ? 'bg-purple-600 text-white hover:bg-purple-700'
                    : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                }`}
                title={!canBundle ? 'Selected projects must have same yard and pickup date' : ''}
              >
                <Package className="w-4 h-4" />
                Bundle ({selectedProjects.size})
              </button>
            )}

            {/* Send to Yard Button */}
            {selectedProjects.size > 0 && (
              <button
                onClick={() => {
                  const ids = Array.from(selectedProjects);
                  statusMutation.mutate({ projectIds: ids, newStatus: 'sent_to_yard' });
                }}
                className="px-4 py-1.5 bg-orange-600 text-white text-sm rounded-lg hover:bg-orange-700 flex items-center gap-2 font-medium transition-colors"
              >
                <Send className="w-4 h-4" />
                Send to Yard
              </button>
            )}
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
                : 'Create your first BOM project using the Calculator'}
            </p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 sticky top-0">
              <tr className="text-xs text-gray-500 uppercase border-b border-gray-200">
                <th className="w-10 px-3 py-3">
                  <input
                    type="checkbox"
                    checked={selectedProjects.size === standaloneProjects.length && standaloneProjects.length > 0}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedProjects(new Set(standaloneProjects.map(p => p.id)));
                      } else {
                        setSelectedProjects(new Set());
                      }
                    }}
                    className="rounded border-gray-300"
                  />
                </th>
                <th className="text-left px-3 py-3 font-medium">Status</th>
                <th className="text-left px-3 py-3 font-medium">Project</th>
                <th className="text-left px-3 py-3 font-medium">Customer</th>
                <th className="text-left px-3 py-3 font-medium">Created By</th>
                <th className="text-center px-3 py-3 font-medium">Yard</th>
                <th className="text-center px-3 py-3 font-medium">Pickup</th>
                <th className="text-center px-3 py-3 font-medium w-10">Crew</th>
                <th className="text-right px-3 py-3 font-medium">Total</th>
                <th className="text-center px-3 py-3 font-medium w-20">Actions</th>
                <th className="w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {/* Bundles */}
              {bundles.map(bundle => (
                <>
                  <tr key={bundle.id} className="bg-purple-50 hover:bg-purple-100">
                    <td className="px-3 py-2">
                      <button
                        onClick={() => toggleBundleExpand(bundle.id)}
                        className="p-1 hover:bg-purple-200 rounded"
                      >
                        {expandedBundles.has(bundle.id) ? (
                          <ChevronDown className="w-4 h-4 text-purple-600" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-purple-600" />
                        )}
                      </button>
                    </td>
                    <td className="px-3 py-2">
                      <StatusBadge status={bundle.status} />
                    </td>
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
                    <td className="px-3 py-2 text-sm text-gray-500">-</td>
                    <td className="px-3 py-2 text-center">
                      {bundle.yard && (
                        <span className="px-2 py-0.5 bg-gray-200 text-gray-700 text-xs font-medium rounded">
                          {bundle.yard.code}
                        </span>
                      )}
                    </td>
                    <td className={`px-3 py-2 text-center text-sm ${getPickupDateStyle(bundle.expected_pickup_date)}`}>
                      {formatPickupDate(bundle.expected_pickup_date) || (
                        <span className="text-gray-400 flex items-center justify-center gap-1">
                          <AlertTriangle className="w-3 h-3" />
                          Not set
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-center">
                      {bundle.crew_name ? (
                        <span title={bundle.crew_name} className="text-green-600">
                          <Users className="w-4 h-4 mx-auto" />
                        </span>
                      ) : (
                        <span className="text-gray-300">
                          <Users className="w-4 h-4 mx-auto" />
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="font-semibold text-gray-900">
                        ${(bundle.total_project_cost || 0).toLocaleString()}
                      </div>
                    </td>
                    <td className="px-3 py-2"></td>
                    <td className="px-3 py-2">
                      <BundleActions
                        bundle={bundle}
                        onUnbundle={() => {
                          if (confirm('Dissolve this bundle? Projects will become standalone.')) {
                            unbundleMutation.mutate(bundle.id);
                          }
                        }}
                        onStatusChange={(status) => statusMutation.mutate({ projectIds: [bundle.id], newStatus: status })}
                      />
                    </td>
                  </tr>
                  {/* Bundle Children */}
                  {expandedBundles.has(bundle.id) && bundle.children?.map(child => (
                    <ProjectRow
                      key={child.id}
                      project={child}
                      isChild
                      isSelected={false}
                      onSelect={() => {}}
                      onDelete={() => {}}
                      onStatusChange={(status) => statusMutation.mutate({ projectIds: [child.id], newStatus: status, isChildOfBundle: true })}
                      onOpenCompletionModal={() => setCompletionModal({ projectId: child.id, projectName: child.project_name, isChildOfBundle: true })}
                      onClearPartial={() => clearPartialPickupMutation.mutate(child.id)}
                      onArchive={() => archiveMutation.mutate({ projectId: child.id, archive: !child.is_archived })}
                      onEdit={onEditProject ? () => onEditProject(child.id) : undefined}
                      onDuplicate={onDuplicateProject ? () => onDuplicateProject(child.id) : undefined}
                      formatPickupDate={formatPickupDate}
                      getPickupDateStyle={getPickupDateStyle}
                    />
                  ))}
                </>
              ))}

              {/* Standalone Projects */}
              {standaloneProjects.map(project => (
                <ProjectRow
                  key={project.id}
                  project={project}
                  isSelected={selectedProjects.has(project.id)}
                  onSelect={() => toggleProjectSelection(project.id)}
                  onDelete={() => {
                    if (confirm('Delete this project? This cannot be undone.')) {
                      deleteMutation.mutate(project.id);
                    }
                  }}
                  onStatusChange={(status) => statusMutation.mutate({ projectIds: [project.id], newStatus: status })}
                  onOpenCompletionModal={() => setCompletionModal({ projectId: project.id, projectName: project.project_name })}
                  onClearPartial={() => clearPartialPickupMutation.mutate(project.id)}
                  onArchive={() => archiveMutation.mutate({ projectId: project.id, archive: !project.is_archived })}
                  onEdit={onEditProject ? () => onEditProject(project.id) : undefined}
                  onDuplicate={onDuplicateProject ? () => onDuplicateProject(project.id) : undefined}
                  formatPickupDate={formatPickupDate}
                  getPickupDateStyle={getPickupDateStyle}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Bundle Creation Modal */}
      {showBundleModal && (
        <BundleModal
          selectedCount={selectedProjects.size}
          onClose={() => setShowBundleModal(false)}
          onCreate={(name) => {
            createBundleMutation.mutate({
              projectIds: Array.from(selectedProjects),
              bundleName: name,
            });
          }}
          isCreating={createBundleMutation.isPending}
        />
      )}

      {/* Completion Modal */}
      {completionModal && (
        <CompletionModal
          projectName={completionModal.projectName}
          onClose={() => setCompletionModal(null)}
          onComplete={(isPartial, notes) => {
            completeWithPartialMutation.mutate({
              projectId: completionModal.projectId,
              isPartial,
              notes,
              isChildOfBundle: completionModal.isChildOfBundle,
            });
          }}
          isCompleting={completeWithPartialMutation.isPending}
        />
      )}
    </div>
  );
}

// Status Badge Component
function StatusBadge({ status }: { status: string }) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.draft;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${config.bgColor} ${config.color}`}>
      {config.icon}
      {config.label}
    </span>
  );
}

// Project Row Component
function ProjectRow({
  project,
  isChild = false,
  isSelected,
  onSelect,
  onDelete,
  onStatusChange,
  onOpenCompletionModal,
  onClearPartial,
  onArchive,
  onEdit,
  onDuplicate,
  formatPickupDate,
  getPickupDateStyle,
}: {
  project: BOMProject;
  isChild?: boolean;
  isSelected: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onStatusChange: (status: string) => void;
  onOpenCompletionModal: () => void;
  onClearPartial: () => void;
  onArchive: () => void;
  onEdit?: () => void;
  onDuplicate?: () => void;
  formatPickupDate: (date: string | null) => string | null;
  getPickupDateStyle: (date: string | null) => string;
}) {
  const [showMenu, setShowMenu] = useState(false);
  const nextStatus = STATUS_WORKFLOW[project.status];

  return (
    <tr className={`hover:bg-gray-50 ${isChild ? 'bg-purple-25' : ''}`}>
      <td className="px-3 py-2">
        {isChild ? (
          <div className="w-4 h-4 ml-2 border-l-2 border-b-2 border-purple-300 rounded-bl" />
        ) : (
          <input
            type="checkbox"
            checked={isSelected}
            onChange={onSelect}
            className="rounded border-gray-300"
          />
        )}
      </td>
      <td className="px-3 py-2">
        <div className="flex items-center gap-1">
          <StatusBadge status={project.status} />
          {project.partial_pickup && (
            <span
              title={`Partial pickup: ${project.partial_pickup_notes || 'Material remaining'}`}
              className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-700"
            >
              <Truck className="w-3 h-3 mr-0.5" />
              Partial
            </span>
          )}
        </div>
      </td>
      <td className="px-3 py-2">
        <div className={isChild ? 'pl-2' : ''}>
          <div className="font-medium text-gray-900 flex items-center gap-1">
            {project.project_name}
            {project.adjustment_flagged && (
              <span title="Has adjustments">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
              </span>
            )}
          </div>
          {project.business_unit && (
            <div className="text-xs text-gray-500">{project.business_unit.code}</div>
          )}
        </div>
      </td>
      <td className="px-3 py-2 text-sm text-gray-600">{project.customer_name || '-'}</td>
      <td className="px-3 py-2 text-sm text-gray-600">
        {project.creator ? (
          <span title={project.creator.email}>
            {project.creator.full_name || project.creator.email.split('@')[0]}
          </span>
        ) : '-'}
      </td>
      <td className="px-3 py-2 text-center">
        {project.yard ? (
          <span className="px-2 py-0.5 bg-gray-200 text-gray-700 text-xs font-medium rounded">
            {project.yard.code}
          </span>
        ) : (
          <span className="text-gray-300">-</span>
        )}
      </td>
      <td className={`px-3 py-2 text-center text-sm ${getPickupDateStyle(project.expected_pickup_date)}`}>
        {formatPickupDate(project.expected_pickup_date) || (
          <span className="text-gray-400 flex items-center justify-center gap-1">
            <AlertTriangle className="w-3 h-3" />
            Not set
          </span>
        )}
      </td>
      <td className="px-3 py-2 text-center">
        {project.crew_name ? (
          <span title={project.crew_name} className="text-green-600">
            <Users className="w-4 h-4 mx-auto" />
          </span>
        ) : (
          <span className="text-gray-300">
            <Users className="w-4 h-4 mx-auto" />
          </span>
        )}
      </td>
      <td className="px-3 py-2 text-right">
        <div className="font-semibold text-gray-900">
          ${(project.total_project_cost || 0).toLocaleString()}
        </div>
        <div className="text-xs text-gray-500">
          {project.total_linear_feet ? `${project.total_linear_feet} ft` : '-'}
        </div>
      </td>
      {/* Quick Actions - View/Edit and Next Stage */}
      <td className="px-3 py-2">
        <div className="flex items-center gap-1">
          {/* View/Edit Button */}
          {onEdit && (
            <button
              onClick={onEdit}
              className="p-1.5 text-blue-600 hover:text-blue-700 rounded-lg hover:bg-blue-50 transition-colors"
              title="View/Edit in Calculator"
            >
              <Pencil className="w-4 h-4" />
            </button>
          )}
          {/* Next Stage Button - only show if not completed */}
          {nextStatus && (
            <button
              onClick={() => {
                if (nextStatus === 'completed') {
                  onOpenCompletionModal();
                } else {
                  onStatusChange(nextStatus);
                }
              }}
              className="p-1.5 text-green-600 hover:text-green-700 rounded-lg hover:bg-green-50 transition-colors"
              title={`Advance to ${STATUS_CONFIG[nextStatus]?.label || nextStatus}`}
            >
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </td>
      <td className="px-3 py-2">
        <div className="relative">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
          >
            <MoreVertical className="w-4 h-4" />
          </button>
          {showMenu && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
              <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-20">
                {onEdit && (
                  <button
                    onClick={() => {
                      setShowMenu(false);
                      onEdit();
                    }}
                    className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                  >
                    <Eye className="w-4 h-4" />
                    View / Edit
                  </button>
                )}
                {onDuplicate && (
                  <button
                    onClick={() => {
                      setShowMenu(false);
                      onDuplicate();
                    }}
                    className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                  >
                    <Copy className="w-4 h-4" />
                    Duplicate Project
                  </button>
                )}
                <hr className="my-1" />
                <div className="px-3 py-1 text-xs text-gray-400 uppercase">Change Status</div>
                {['ready', 'sent_to_yard', 'staged'].map(status => (
                  <button
                    key={status}
                    onClick={() => {
                      onStatusChange(status);
                      setShowMenu(false);
                    }}
                    className="w-full px-3 py-1.5 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                  >
                    {STATUS_CONFIG[status]?.icon}
                    {STATUS_CONFIG[status]?.label}
                  </button>
                ))}
                <button
                  onClick={() => {
                    setShowMenu(false);
                    onOpenCompletionModal();
                  }}
                  className="w-full px-3 py-1.5 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                >
                  {STATUS_CONFIG.completed?.icon}
                  Mark Completed...
                </button>
                {project.partial_pickup && (
                  <>
                    <hr className="my-1" />
                    <button
                      onClick={() => {
                        setShowMenu(false);
                        onClearPartial();
                      }}
                      className="w-full px-3 py-1.5 text-left text-sm text-amber-600 hover:bg-amber-50 flex items-center gap-2"
                    >
                      <CheckCircle className="w-4 h-4" />
                      Clear Partial Pickup
                    </button>
                  </>
                )}
                <hr className="my-1" />
                <button
                  onClick={() => {
                    setShowMenu(false);
                    onArchive();
                  }}
                  className="w-full px-3 py-2 text-left text-sm text-gray-600 hover:bg-gray-50 flex items-center gap-2"
                >
                  <Archive className="w-4 h-4" />
                  {project.is_archived ? 'Restore from Archive' : 'Archive'}
                </button>
                <button
                  onClick={() => {
                    setShowMenu(false);
                    onDelete();
                  }}
                  className="w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete
                </button>
              </div>
            </>
          )}
        </div>
      </td>
    </tr>
  );
}

// Bundle Actions Component
function BundleActions({
  onUnbundle,
  onStatusChange,
}: {
  bundle: BOMProject;
  onUnbundle: () => void;
  onStatusChange: (status: string) => void;
}) {
  const [showMenu, setShowMenu] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setShowMenu(!showMenu)}
        className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-purple-200"
      >
        <MoreVertical className="w-4 h-4" />
      </button>
      {showMenu && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
          <div className="absolute right-0 top-full mt-1 w-44 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-20">
            <div className="px-3 py-1 text-xs text-gray-400 uppercase">Bundle Status</div>
            {['ready', 'sent_to_yard', 'staged', 'completed'].map(status => (
              <button
                key={status}
                onClick={() => {
                  onStatusChange(status);
                  setShowMenu(false);
                }}
                className="w-full px-3 py-1.5 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
              >
                {STATUS_CONFIG[status]?.icon}
                {STATUS_CONFIG[status]?.label}
              </button>
            ))}
            <hr className="my-1" />
            <button
              onClick={() => {
                setShowMenu(false);
                onUnbundle();
              }}
              className="w-full px-3 py-2 text-left text-sm text-purple-600 hover:bg-purple-50 flex items-center gap-2"
            >
              <X className="w-4 h-4" />
              Dissolve Bundle
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// Bundle Creation Modal
function BundleModal({
  selectedCount,
  onClose,
  onCreate,
  isCreating,
}: {
  selectedCount: number;
  onClose: () => void;
  onCreate: (name: string) => void;
  isCreating: boolean;
}) {
  const [bundleName, setBundleName] = useState('');

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Package className="w-5 h-5 text-purple-600" />
            <h2 className="text-lg font-bold text-gray-900">Create Bundle</h2>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <p className="text-sm text-gray-600">
            Bundling {selectedCount} projects together. They will move through the workflow as a single unit.
          </p>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Bundle Name *
            </label>
            <input
              type="text"
              value={bundleName}
              onChange={(e) => setBundleName(e.target.value)}
              placeholder="e.g., ATX Dec 5 Bundle"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              autoFocus
            />
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-xl flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg text-sm transition-colors"
            disabled={isCreating}
          >
            Cancel
          </button>
          <button
            onClick={() => onCreate(bundleName)}
            disabled={isCreating || !bundleName.trim()}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm font-medium flex items-center gap-2 transition-colors disabled:bg-gray-400"
          >
            {isCreating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <Package className="w-4 h-4" />
                Create Bundle
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// Completion Modal - for marking project as completed with partial pickup option
function CompletionModal({
  projectName,
  onClose,
  onComplete,
  isCompleting,
}: {
  projectName: string;
  onClose: () => void;
  onComplete: (isPartial: boolean, notes: string) => void;
  isCompleting: boolean;
}) {
  const [isPartial, setIsPartial] = useState(false);
  const [notes, setNotes] = useState('');

  const canComplete = !isPartial || notes.trim().length > 0;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-green-600" />
            <h2 className="text-lg font-bold text-gray-900">Complete Project</h2>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <p className="text-sm text-gray-600">
            Marking <span className="font-semibold">{projectName}</span> as completed.
          </p>

          <div className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <input
              type="checkbox"
              id="partial-pickup"
              checked={isPartial}
              onChange={(e) => setIsPartial(e.target.checked)}
              className="mt-1 rounded border-amber-300 text-amber-600 focus:ring-amber-500"
            />
            <div>
              <label htmlFor="partial-pickup" className="text-sm font-medium text-amber-800 cursor-pointer">
                Partial Pickup
              </label>
              <p className="text-xs text-amber-600 mt-0.5">
                Check this if the crew only took part of the material and will return for the rest.
              </p>
            </div>
          </div>

          {isPartial && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                What material remains? *
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g., 10 pickets and 2 posts remaining, crew will return tomorrow morning"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500 h-24 resize-none"
                autoFocus
              />
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-xl flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg text-sm transition-colors"
            disabled={isCompleting}
          >
            Cancel
          </button>
          <button
            onClick={() => onComplete(isPartial, notes)}
            disabled={isCompleting || !canComplete}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium flex items-center gap-2 transition-colors disabled:bg-gray-400"
          >
            {isCompleting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Completing...
              </>
            ) : (
              <>
                <CheckCircle className="w-4 h-4" />
                {isPartial ? 'Mark Partial Completion' : 'Mark Completed'}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
