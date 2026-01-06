/**
 * ProjectsListView - List of projects with search/filter and navigation
 *
 * Part of the Project-First architecture (Phase 3H)
 * Updated with responsive table/cards variant switching (Part 0.1)
 */

import { useState } from 'react';
import {
  Search,
  Plus,
  Briefcase,
  Filter,
  ArrowRight,
  ChevronDown,
  MapPin,
  CheckCircle,
  Clock,
  AlertTriangle,
} from 'lucide-react';
import { useProjects } from '../../fsm/hooks/useProjects';
import type { ProjectStatus } from '../../fsm/types';
import {
  useListVariant,
  VariantToggle,
  type ListVariant,
} from '../../fsm/components/shared/ResponsiveList';

const PROJECT_STATUS_CONFIG: Record<
  ProjectStatus,
  { label: string; bgClass: string; textClass: string; icon: typeof CheckCircle }
> = {
  active: {
    label: 'Active',
    bgClass: 'bg-blue-100',
    textClass: 'text-blue-700',
    icon: Clock,
  },
  complete: {
    label: 'Complete',
    bgClass: 'bg-green-100',
    textClass: 'text-green-700',
    icon: CheckCircle,
  },
  on_hold: {
    label: 'On Hold',
    bgClass: 'bg-amber-100',
    textClass: 'text-amber-700',
    icon: AlertTriangle,
  },
  cancelled: {
    label: 'Cancelled',
    bgClass: 'bg-gray-100',
    textClass: 'text-gray-500',
    icon: AlertTriangle,
  },
  warranty: {
    label: 'Warranty',
    bgClass: 'bg-purple-100',
    textClass: 'text-purple-700',
    icon: Clock,
  },
};

interface ProjectsListViewProps {
  onSelectProject: (projectId: string) => void;
  onCreateProject: () => void;
  /** Initial list variant - defaults to 'auto' (switches at md breakpoint) */
  initialVariant?: ListVariant;
}

export default function ProjectsListView({
  onSelectProject,
  onCreateProject,
  initialVariant = 'auto',
}: ProjectsListViewProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<ProjectStatus | 'all'>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [userVariant, setUserVariant] = useState<ListVariant>(initialVariant);
  const effectiveVariant = useListVariant(userVariant);

  const { data: projects = [], isLoading } = useProjects();

  // Filter projects
  const filteredProjects = projects.filter((project) => {
    // Search filter
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      const matchesName = project.name?.toLowerCase().includes(search);
      const matchesNumber = project.project_number?.toLowerCase().includes(search);
      const matchesClient = (project.client_display_name || '')
        .toLowerCase()
        .includes(search);
      const matchesAddress = (project.property_address || '')
        .toLowerCase()
        .includes(search);
      if (!matchesName && !matchesNumber && !matchesClient && !matchesAddress) {
        return false;
      }
    }

    // Status filter
    if (statusFilter !== 'all' && project.status !== statusFilter) {
      return false;
    }

    return true;
  });

  // Sort by created_at desc
  const sortedProjects = [...filteredProjects].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  // Group stats
  const stats = {
    total: projects.length,
    active: projects.filter((p) => p.status === 'active').length,
    complete: projects.filter((p) => p.status === 'complete').length,
    onHold: projects.filter((p) => p.status === 'on_hold').length,
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Projects</h1>
          <p className="text-gray-500">
            Manage projects from quote to completion
          </p>
        </div>
        <button
          onClick={onCreateProject}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Project
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border p-4 text-center">
          <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
          <div className="text-sm text-gray-500">Total</div>
        </div>
        <div className="bg-white rounded-lg border p-4 text-center">
          <div className="text-2xl font-bold text-blue-600">{stats.active}</div>
          <div className="text-sm text-gray-500">Active</div>
        </div>
        <div className="bg-white rounded-lg border p-4 text-center">
          <div className="text-2xl font-bold text-green-600">{stats.complete}</div>
          <div className="text-sm text-gray-500">Complete</div>
        </div>
        <div className="bg-white rounded-lg border p-4 text-center">
          <div className="text-2xl font-bold text-amber-600">{stats.onHold}</div>
          <div className="text-sm text-gray-500">On Hold</div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-wrap gap-4">
        <div className="flex-1 min-w-[200px] relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search projects by name, client, or address..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        <div className="relative">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-4 py-2 border rounded-lg transition-colors ${
              statusFilter !== 'all'
                ? 'bg-blue-50 border-blue-300 text-blue-700'
                : 'hover:bg-gray-50'
            }`}
          >
            <Filter className="w-4 h-4" />
            {statusFilter === 'all' ? 'Filter' : PROJECT_STATUS_CONFIG[statusFilter].label}
            <ChevronDown className="w-4 h-4" />
          </button>
          {showFilters && (
            <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border z-10">
              <div className="p-2">
                <button
                  onClick={() => {
                    setStatusFilter('all');
                    setShowFilters(false);
                  }}
                  className={`w-full text-left px-3 py-2 rounded ${
                    statusFilter === 'all' ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100'
                  }`}
                >
                  All Statuses
                </button>
                {(Object.keys(PROJECT_STATUS_CONFIG) as ProjectStatus[]).map((status) => {
                  const config = PROJECT_STATUS_CONFIG[status];
                  return (
                    <button
                      key={status}
                      onClick={() => {
                        setStatusFilter(status);
                        setShowFilters(false);
                      }}
                      className={`w-full text-left px-3 py-2 rounded flex items-center gap-2 ${
                        statusFilter === status
                          ? 'bg-blue-100 text-blue-700'
                          : 'hover:bg-gray-100'
                      }`}
                    >
                      <span
                        className={`w-2 h-2 rounded-full ${config.bgClass}`}
                      />
                      {config.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
        {/* Variant Toggle - hidden on mobile (auto switches anyway) */}
        <div className="hidden md:block">
          <VariantToggle
            variant={effectiveVariant}
            onChange={(v) => setUserVariant(v)}
          />
        </div>
      </div>

      {/* Projects List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-pulse text-gray-500">Loading projects...</div>
        </div>
      ) : sortedProjects.length === 0 ? (
        <div className="bg-white rounded-lg border p-12 text-center">
          <Briefcase className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No projects found</h3>
          <p className="text-gray-500 mb-6">
            {searchTerm || statusFilter !== 'all'
              ? 'Try adjusting your search or filters'
              : 'Get started by creating your first project'}
          </p>
          {!searchTerm && statusFilter === 'all' && (
            <button
              onClick={onCreateProject}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Plus className="w-4 h-4" />
              Create Project
            </button>
          )}
        </div>
      ) : effectiveVariant === 'table' ? (
        /* =============== TABLE VIEW =============== */
        <div className="bg-white rounded-lg border overflow-hidden">
          {/* Table Header */}
          <div className="grid grid-cols-[1fr_180px_100px_100px_120px_80px_40px] gap-4 px-4 py-3 bg-gray-50 border-b font-medium text-sm text-gray-600">
            <div>Client / Address</div>
            <div className="hidden lg:block">Community</div>
            <div>Status</div>
            <div className="text-center">Quotes</div>
            <div className="text-center">Jobs</div>
            <div className="text-right">Value</div>
            <div></div>
          </div>
          {/* Table Rows */}
          <div className="divide-y divide-gray-100">
            {sortedProjects.map((project) => {
              const statusConfig = PROJECT_STATUS_CONFIG[project.status];
              return (
                <div
                  key={project.id}
                  onClick={() => onSelectProject(project.id)}
                  className="grid grid-cols-[1fr_180px_100px_100px_120px_80px_40px] gap-4 px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors text-sm items-center"
                >
                  {/* Client / Address */}
                  <div className="min-w-0">
                    <div className="font-medium text-gray-900 truncate">
                      {project.client_display_name || project.name || 'Unnamed'}
                    </div>
                    <div className="text-gray-500 text-xs truncate flex items-center gap-1">
                      <MapPin className="w-3 h-3 flex-shrink-0" />
                      {project.property_address || 'No address'}
                    </div>
                  </div>
                  {/* Community - hidden on smaller screens */}
                  <div className="hidden lg:block text-gray-600 truncate">
                    {project.community_name || '-'}
                  </div>
                  {/* Status */}
                  <div>
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${statusConfig.bgClass} ${statusConfig.textClass}`}>
                      {statusConfig.label}
                    </span>
                    {project.has_rework && (
                      <span className="ml-1 px-1.5 py-0.5 bg-red-100 text-red-700 rounded text-[10px]">
                        !
                      </span>
                    )}
                  </div>
                  {/* Quotes */}
                  <div className="text-center text-gray-600">
                    {project.quote_count || 0}
                  </div>
                  {/* Jobs */}
                  <div className="text-center text-gray-600">
                    {project.job_count || 0}
                  </div>
                  {/* Value */}
                  <div className="text-right font-medium text-gray-900">
                    {(project.total_job_value ?? 0) > 0
                      ? formatCurrency(project.total_job_value || 0)
                      : '-'}
                  </div>
                  {/* Arrow */}
                  <div className="text-right">
                    <ArrowRight className="w-4 h-4 text-gray-400 inline-block" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* =============== CARD VIEW =============== */
        <div className="space-y-3">
          {sortedProjects.map((project) => {
            const statusConfig = PROJECT_STATUS_CONFIG[project.status];

            return (
              <div
                key={project.id}
                onClick={() => onSelectProject(project.id)}
                className="bg-white rounded-lg border p-4 cursor-pointer hover:border-blue-300 hover:shadow-md transition-all"
              >
                <div className="flex items-start gap-4">
                  {/* Icon */}
                  <div
                    className={`p-3 rounded-lg ${
                      project.status === 'complete'
                        ? 'bg-green-100'
                        : project.status === 'active'
                        ? 'bg-blue-100'
                        : 'bg-gray-100'
                    }`}
                  >
                    <Briefcase
                      className={`w-6 h-6 ${
                        project.status === 'complete'
                          ? 'text-green-600'
                          : project.status === 'active'
                          ? 'text-blue-600'
                          : 'text-gray-500'
                      }`}
                    />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                      <h3 className="font-semibold text-gray-900 truncate">
                        {project.client_display_name || project.name || 'Unnamed Project'}
                      </h3>
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusConfig.bgClass} ${statusConfig.textClass}`}
                      >
                        {statusConfig.label}
                      </span>
                      {project.has_rework && (
                        <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded text-xs">
                          Has Rework
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
                      {project.property_address && (
                        <span className="flex items-center gap-1 truncate max-w-[200px]">
                          <MapPin className="w-4 h-4" />
                          {project.property_address}
                          {project.property_city && `, ${project.property_city}`}
                        </span>
                      )}
                      {project.qbo_class?.labor_code && (
                        <span className="px-2 py-0.5 bg-gray-100 rounded text-xs">
                          {project.qbo_class.labor_code}
                        </span>
                      )}
                    </div>

                    {/* Stats row */}
                    <div className="flex items-center gap-4 mt-2 text-sm">
                      <span className="text-gray-500">
                        {project.quote_count || 0} quotes
                      </span>
                      <span className="text-gray-500">
                        {project.job_count || 0} jobs
                      </span>
                      {(project.total_job_value ?? 0) > 0 && (
                        <span className="font-medium text-gray-900">
                          {formatCurrency(project.total_job_value || 0)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Arrow */}
                  <ArrowRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
