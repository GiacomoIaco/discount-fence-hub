import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Loader2, Plus, Search, Folder, Calendar, MapPin, Trash2,
  ChevronRight, MoreVertical, Archive, Copy, Eye
} from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { showSuccess, showError } from '../../../lib/toast';
import { format } from 'date-fns';

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
  created_at: string;
  updated_at: string;
  business_unit: {
    id: string;
    code: string;
    name: string;
  };
  line_items_count: number;
}

interface BusinessUnit {
  id: string;
  code: string;
  name: string;
}

type StatusFilter = 'all' | 'draft' | 'active' | 'completed' | 'archived';

export default function ProjectsPage() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedProject, setSelectedProject] = useState<string | null>(null);

  // Fetch projects
  const { data: projects = [], isLoading } = useQuery({
    queryKey: ['bom-projects'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bom_projects')
        .select(`
          *,
          business_unit:business_unit_id(id, code, name)
        `)
        .order('updated_at', { ascending: false });

      if (error) throw error;

      // Get line item counts
      const projectIds = data?.map(p => p.id) || [];
      if (projectIds.length === 0) return [];

      const { data: lineCounts } = await supabase
        .from('project_line_items')
        .select('project_id')
        .in('project_id', projectIds);

      const countMap: Record<string, number> = {};
      lineCounts?.forEach(item => {
        countMap[item.project_id] = (countMap[item.project_id] || 0) + 1;
      });

      return data?.map(p => ({
        ...p,
        line_items_count: countMap[p.id] || 0,
      })) as BOMProject[];
    },
  });

  // Fetch business units for create modal
  const { data: businessUnits = [] } = useQuery({
    queryKey: ['business-units'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('business_units')
        .select('id, code, name')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data as BusinessUnit[];
    },
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
      setSelectedProject(null);
    },
    onError: (err: Error) => {
      showError(err.message || 'Failed to delete project');
    },
  });

  // Filter projects
  const filteredProjects = projects.filter(p => {
    if (statusFilter !== 'all' && p.status !== statusFilter) return false;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      return (
        p.project_name.toLowerCase().includes(term) ||
        p.customer_name?.toLowerCase().includes(term) ||
        p.business_unit.code.toLowerCase().includes(term)
      );
    }
    return true;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft':
        return 'bg-gray-100 text-gray-700';
      case 'active':
        return 'bg-blue-100 text-blue-700';
      case 'completed':
        return 'bg-green-100 text-green-700';
      case 'archived':
        return 'bg-amber-100 text-amber-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
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
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
            >
              <option value="all">All Status</option>
              <option value="draft">Draft</option>
              <option value="active">Active</option>
              <option value="completed">Completed</option>
              <option value="archived">Archived</option>
            </select>

            {/* New Project */}
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 flex items-center gap-2 font-medium transition-colors"
            >
              <Plus className="w-4 h-4" />
              New Project
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        {filteredProjects.length === 0 ? (
          <div className="text-center py-12">
            <Folder className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No projects found</h3>
            <p className="text-gray-500 mb-6">
              {searchTerm || statusFilter !== 'all'
                ? 'Try adjusting your filters'
                : 'Create your first BOM project to get started'}
            </p>
            {!searchTerm && statusFilter === 'all' && (
              <button
                onClick={() => setShowCreateModal(true)}
                className="px-6 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 inline-flex items-center gap-2 font-medium transition-colors"
              >
                <Plus className="w-4 h-4" />
                Create Project
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredProjects.map(project => (
              <ProjectCard
                key={project.id}
                project={project}
                getStatusColor={getStatusColor}
                onDelete={() => {
                  if (confirm('Delete this project? This cannot be undone.')) {
                    deleteMutation.mutate(project.id);
                  }
                }}
                isDeleting={deleteMutation.isPending && selectedProject === project.id}
              />
            ))}
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <CreateProjectModal
          businessUnits={businessUnits}
          onClose={() => setShowCreateModal(false)}
          onCreated={() => {
            queryClient.invalidateQueries({ queryKey: ['bom-projects'] });
            setShowCreateModal(false);
          }}
        />
      )}
    </div>
  );
}

// Project Card Component
function ProjectCard({
  project,
  getStatusColor,
  onDelete,
  isDeleting,
}: {
  project: BOMProject;
  getStatusColor: (status: string) => string;
  onDelete: () => void;
  isDeleting: boolean;
}) {
  const [showMenu, setShowMenu] = useState(false);

  return (
    <div className="bg-white rounded-lg border border-gray-200 hover:border-gray-300 transition-colors">
      <div className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-gray-900 truncate">{project.project_name}</h3>
            {project.customer_name && (
              <p className="text-sm text-gray-500 truncate">{project.customer_name}</p>
            )}
          </div>
          <div className="relative ml-2">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
            >
              <MoreVertical className="w-4 h-4" />
            </button>
            {showMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
                <div className="absolute right-0 top-full mt-1 w-36 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-20">
                  <button className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                    <Eye className="w-4 h-4" />
                    View
                  </button>
                  <button className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                    <Copy className="w-4 h-4" />
                    Duplicate
                  </button>
                  <button className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                    <Archive className="w-4 h-4" />
                    Archive
                  </button>
                  <hr className="my-1" />
                  <button
                    onClick={() => {
                      setShowMenu(false);
                      onDelete();
                    }}
                    disabled={isDeleting}
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

        {/* Meta */}
        <div className="flex items-center gap-3 text-xs text-gray-500 mb-3">
          <span className="flex items-center gap-1">
            <MapPin className="w-3 h-3" />
            {project.business_unit.code}
          </span>
          <span className="flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            {format(new Date(project.updated_at), 'MMM d, yyyy')}
          </span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium uppercase ${getStatusColor(project.status)}`}>
            {project.status}
          </span>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2 pt-3 border-t border-gray-100">
          <div>
            <p className="text-[10px] text-gray-400 uppercase">Linear Ft</p>
            <p className="text-sm font-semibold text-gray-900">
              {project.total_linear_feet?.toLocaleString() || '-'}
            </p>
          </div>
          <div>
            <p className="text-[10px] text-gray-400 uppercase">Total Cost</p>
            <p className="text-sm font-semibold text-gray-900">
              {project.total_project_cost
                ? `$${project.total_project_cost.toLocaleString()}`
                : '-'}
            </p>
          </div>
          <div>
            <p className="text-[10px] text-gray-400 uppercase">$/Foot</p>
            <p className="text-sm font-semibold text-gray-900">
              {project.cost_per_foot
                ? `$${project.cost_per_foot.toFixed(2)}`
                : '-'}
            </p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="px-4 py-2 bg-gray-50 border-t border-gray-100 rounded-b-lg flex items-center justify-between">
        <span className="text-xs text-gray-500">
          {project.line_items_count} line item{project.line_items_count !== 1 ? 's' : ''}
        </span>
        <button className="text-xs text-green-600 hover:text-green-700 font-medium flex items-center gap-1">
          Open
          <ChevronRight className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}

// Create Project Modal
function CreateProjectModal({
  businessUnits,
  onClose,
  onCreated,
}: {
  businessUnits: BusinessUnit[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [projectName, setProjectName] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [businessUnitId, setBusinessUnitId] = useState(businessUnits[0]?.id || '');
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    if (!projectName.trim()) {
      showError('Project name is required');
      return;
    }
    if (!businessUnitId) {
      showError('Please select a business unit');
      return;
    }

    setCreating(true);
    try {
      const { error } = await supabase.from('bom_projects').insert({
        project_name: projectName.trim(),
        customer_name: customerName.trim() || null,
        business_unit_id: businessUnitId,
        status: 'draft',
      });

      if (error) throw error;
      showSuccess('Project created');
      onCreated();
    } catch (err: any) {
      showError(err.message || 'Failed to create project');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-bold text-gray-900">New Project</h2>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Project Name *
            </label>
            <input
              type="text"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="Enter project name"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Customer Name
            </label>
            <input
              type="text"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Optional"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Business Unit *
            </label>
            <select
              value={businessUnitId}
              onChange={(e) => setBusinessUnitId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
            >
              {businessUnits.map((bu) => (
                <option key={bu.id} value={bu.id}>
                  {bu.code} - {bu.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-xl flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg text-sm transition-colors"
            disabled={creating}
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={creating}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium flex items-center gap-2 transition-colors disabled:bg-gray-400"
          >
            {creating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <Plus className="w-4 h-4" />
                Create Project
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
