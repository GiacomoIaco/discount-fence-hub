/**
 * ProjectsListView - List of projects with search/filter and navigation
 *
 * Part of the Project-First architecture (Phase 3H)
 * Updated with:
 * - Computed Pipeline Stage (replaces simple "Active" status)
 * - Separate Title column
 * - Horizontal scroll for all columns
 * - Health indicators for items needing attention
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
  User,
  Calendar,
  AlertCircle,
} from 'lucide-react';
import { useProjects } from '../../fsm/hooks/useProjects';
import type { ProjectStatus } from '../../fsm/types';
import {
  useListVariant,
  VariantToggle,
  type ListVariant,
} from '../../fsm/components/shared/ResponsiveList';
import {
  computeProjectStage,
  PIPELINE_STAGES,
  type PipelineStageId,
} from '../../fsm/utils/computeProjectStage';

// For filtering by the original project status
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

// Pipeline stage filter options (computed stages)
const STAGE_FILTER_OPTIONS: { id: PipelineStageId | 'all'; label: string }[] = [
  { id: 'all', label: 'All Stages' },
  { id: 'new', label: 'New' },
  { id: 'quoting', label: 'Quoting' },
  { id: 'won', label: 'Won' },
  { id: 'scheduled', label: 'Scheduled' },
  { id: 'working', label: 'In Progress' },
  { id: 'work_done', label: 'Work Done' },
  { id: 'invoiced', label: 'Invoiced' },
  { id: 'paid', label: 'Paid' },
  { id: 'complete', label: 'Complete' },
  { id: 'on_hold', label: 'On Hold' },
  { id: 'cancelled', label: 'Cancelled' },
];

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
  const [stageFilter, setStageFilter] = useState<PipelineStageId | 'all'>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [userVariant, setUserVariant] = useState<ListVariant>(initialVariant);
  const effectiveVariant = useListVariant(userVariant);

  const { data: projects = [], isLoading } = useProjects();

  // Compute stages for all projects (memoized via map)
  const projectsWithStage = projects.map((project) => ({
    project,
    computed: computeProjectStage(project),
  }));

  // Filter projects
  const filteredProjects = projectsWithStage.filter(({ project, computed }) => {
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

    // Stage filter (using computed stage)
    if (stageFilter !== 'all' && computed.stage.id !== stageFilter) {
      return false;
    }

    return true;
  });

  // Sort by created_at desc
  const sortedProjects = [...filteredProjects].sort(
    (a, b) => new Date(b.project.created_at).getTime() - new Date(a.project.created_at).getTime()
  );

  // Stats by computed stage
  const stageStats = {
    total: projects.length,
    quoting: projectsWithStage.filter((p) => p.computed.stage.id === 'quoting').length,
    working: projectsWithStage.filter((p) => ['scheduled', 'working'].includes(p.computed.stage.id)).length,
    invoiced: projectsWithStage.filter((p) => p.computed.stage.id === 'invoiced').length,
    needsAttention: projectsWithStage.filter((p) => p.computed.hasWarning).length,
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

      {/* Stats - Now showing pipeline-based stats */}
      <div className="grid grid-cols-5 gap-4">
        <div className="bg-white rounded-lg border p-4 text-center">
          <div className="text-2xl font-bold text-gray-900">{stageStats.total}</div>
          <div className="text-sm text-gray-500">Total</div>
        </div>
        <div className="bg-white rounded-lg border p-4 text-center">
          <div className="text-2xl font-bold text-amber-600">{stageStats.quoting}</div>
          <div className="text-sm text-gray-500">Quoting</div>
        </div>
        <div className="bg-white rounded-lg border p-4 text-center">
          <div className="text-2xl font-bold text-blue-600">{stageStats.working}</div>
          <div className="text-sm text-gray-500">Working</div>
        </div>
        <div className="bg-white rounded-lg border p-4 text-center">
          <div className="text-2xl font-bold text-orange-600">{stageStats.invoiced}</div>
          <div className="text-sm text-gray-500">Invoiced</div>
        </div>
        <div className="bg-white rounded-lg border p-4 text-center">
          <div className="text-2xl font-bold text-red-600">{stageStats.needsAttention}</div>
          <div className="text-sm text-gray-500">Needs Attention</div>
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
              stageFilter !== 'all'
                ? 'bg-blue-50 border-blue-300 text-blue-700'
                : 'hover:bg-gray-50'
            }`}
          >
            <Filter className="w-4 h-4" />
            {stageFilter === 'all' ? 'Filter by Stage' : PIPELINE_STAGES[stageFilter].label}
            <ChevronDown className="w-4 h-4" />
          </button>
          {showFilters && (
            <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border z-10 max-h-80 overflow-y-auto">
              <div className="p-2">
                {STAGE_FILTER_OPTIONS.map((option) => {
                  const stage = option.id !== 'all' ? PIPELINE_STAGES[option.id] : null;
                  return (
                    <button
                      key={option.id}
                      onClick={() => {
                        setStageFilter(option.id);
                        setShowFilters(false);
                      }}
                      className={`w-full text-left px-3 py-2 rounded flex items-center gap-2 ${
                        stageFilter === option.id ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100'
                      }`}
                    >
                      {stage && (
                        <span
                          className={`w-2 h-2 rounded-full ${stage.bgClass}`}
                        />
                      )}
                      {option.label}
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
            {searchTerm || stageFilter !== 'all'
              ? 'Try adjusting your search or filters'
              : 'Get started by creating your first project'}
          </p>
          {!searchTerm && stageFilter === 'all' && (
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
        /* =============== TABLE VIEW with horizontal scroll =============== */
        <div className="bg-white rounded-lg border overflow-x-auto">
          {/* Table Header - fixed minimum widths */}
          <div className="min-w-[1200px]">
            <div className="grid grid-cols-[180px_150px_120px_100px_90px_80px_60px_60px_90px_80px_40px] gap-3 px-4 py-3 bg-gray-50 border-b font-medium text-sm text-gray-600">
              <div>Client</div>
              <div>Address</div>
              <div>Title</div>
              <div>Stage</div>
              <div>BU</div>
              <div>Rep</div>
              <div className="text-center">Q</div>
              <div className="text-center">J</div>
              <div className="text-right">Value</div>
              <div className="text-right">Created</div>
              <div></div>
            </div>
            {/* Table Rows */}
            <div className="divide-y divide-gray-100">
              {sortedProjects.map(({ project, computed }) => {
                // Handle both view field names (cnt_quotes vs quote_count)
                const quoteCount = project.cnt_quotes ?? project.quote_count ?? 0;
                const jobCount = project.cnt_jobs ?? project.job_count ?? 0;
                const totalValue = project.sum_invoiced ?? project.total_job_value ?? 0;
                // BU code - view returns qbo_labor_code, fallback returns qbo_class.labor_code
                const buCode = project.qbo_labor_code || project.qbo_class?.labor_code;
                // Rep name - view returns rep_name, fallback returns assigned_rep_user.name
                const repName = project.rep_name || project.assigned_rep_user?.name;
                // Client name
                const clientName = project.client_display_name || project.client?.company_name || project.client?.name || 'No client';
                // Address
                const address = project.property_address || project.property?.address_line1 || 'No address';

                return (
                  <div
                    key={project.id}
                    onClick={() => onSelectProject(project.id)}
                    className="grid grid-cols-[180px_150px_120px_100px_90px_80px_60px_60px_90px_80px_40px] gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors text-sm items-center"
                  >
                    {/* Client */}
                    <div className="min-w-0">
                      <div className="font-medium text-gray-900 truncate" title={clientName}>
                        {clientName}
                      </div>
                      {project.community_name && (
                        <div className="text-gray-400 text-xs truncate">
                          {project.community_name}
                        </div>
                      )}
                    </div>
                    {/* Address */}
                    <div className="text-gray-600 text-xs truncate flex items-center gap-1" title={address}>
                      <MapPin className="w-3 h-3 flex-shrink-0 text-gray-400" />
                      <span className="truncate">{address}</span>
                    </div>
                    {/* Title */}
                    <div className="text-gray-500 text-xs truncate italic" title={project.name || ''}>
                      {project.name || '-'}
                    </div>
                    {/* Stage (computed) */}
                    <div className="flex items-center gap-1">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${computed.stage.bgClass} ${computed.stage.textClass}`}
                        title={computed.detail || computed.stage.description}
                      >
                        {computed.hasWarning && (
                          <AlertCircle className="w-3 h-3" />
                        )}
                        {computed.stage.shortLabel}
                      </span>
                    </div>
                    {/* BU */}
                    <div className="text-gray-600 truncate">
                      {buCode ? (
                        <span className="px-1.5 py-0.5 bg-gray-100 rounded text-xs font-medium">
                          {buCode}
                        </span>
                      ) : '-'}
                    </div>
                    {/* Rep */}
                    <div className="text-gray-600 truncate text-xs" title={repName || ''}>
                      {repName || '-'}
                    </div>
                    {/* Quotes */}
                    <div className="text-center text-gray-600">
                      {quoteCount}
                    </div>
                    {/* Jobs */}
                    <div className="text-center text-gray-600">
                      {jobCount}
                    </div>
                    {/* Value */}
                    <div className="text-right font-medium text-gray-900">
                      {totalValue > 0 ? formatCurrency(totalValue) : '-'}
                    </div>
                    {/* Created Date */}
                    <div className="text-right text-gray-500 text-xs">
                      {new Date(project.created_at).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                      })}
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
        </div>
      ) : (
        /* =============== CARD VIEW =============== */
        <div className="space-y-3">
          {sortedProjects.map(({ project, computed }) => {
            // Handle both view field names
            const quoteCount = project.cnt_quotes ?? project.quote_count ?? 0;
            const jobCount = project.cnt_jobs ?? project.job_count ?? 0;
            const totalValue = project.sum_invoiced ?? project.total_job_value ?? 0;
            const buCode = project.qbo_labor_code || project.qbo_class?.labor_code;
            const repName = project.rep_name || project.assigned_rep_user?.name;
            const clientName = project.client_display_name || project.client?.company_name || project.client?.name;
            const propertyAddress = project.property_address || project.property?.address_line1;
            const propertyCity = project.property_city || project.property?.city;

            // Pick icon color based on stage
            const iconBg = computed.stage.id === 'paid' || computed.stage.id === 'won'
              ? 'bg-green-100'
              : computed.stage.id === 'working' || computed.stage.id === 'scheduled'
              ? 'bg-blue-100'
              : computed.stage.id === 'invoiced'
              ? 'bg-orange-100'
              : computed.stage.id === 'quoting'
              ? 'bg-amber-100'
              : 'bg-gray-100';

            const iconColor = computed.stage.id === 'paid' || computed.stage.id === 'won'
              ? 'text-green-600'
              : computed.stage.id === 'working' || computed.stage.id === 'scheduled'
              ? 'text-blue-600'
              : computed.stage.id === 'invoiced'
              ? 'text-orange-600'
              : computed.stage.id === 'quoting'
              ? 'text-amber-600'
              : 'text-gray-500';

            return (
              <div
                key={project.id}
                onClick={() => onSelectProject(project.id)}
                className="bg-white rounded-lg border p-4 cursor-pointer hover:border-blue-300 hover:shadow-md transition-all"
              >
                <div className="flex items-start gap-4">
                  {/* Icon */}
                  <div className={`p-3 rounded-lg ${iconBg}`}>
                    <Briefcase className={`w-6 h-6 ${iconColor}`} />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    {/* Row 1: Client + Stage */}
                    <div className="flex items-center gap-3 mb-1">
                      <h3 className="font-semibold text-gray-900 truncate">
                        {clientName || 'No client'}
                      </h3>
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${computed.stage.bgClass} ${computed.stage.textClass}`}
                        title={computed.stage.description}
                      >
                        {computed.hasWarning && (
                          <AlertCircle className="w-3 h-3" />
                        )}
                        {computed.stage.label}
                      </span>
                      {computed.detail && (
                        <span className="text-xs text-gray-500">
                          {computed.detail}
                        </span>
                      )}
                      {project.has_rework && (
                        <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded text-xs">
                          Rework
                        </span>
                      )}
                    </div>

                    {/* Row 2: Title (if set) */}
                    {project.name && (
                      <div className="text-sm text-gray-600 italic mb-1 truncate">
                        {project.name}
                      </div>
                    )}

                    {/* Row 3: Address + BU */}
                    <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500 mb-1">
                      {propertyAddress && (
                        <span className="flex items-center gap-1 truncate max-w-[240px]">
                          <MapPin className="w-4 h-4 flex-shrink-0" />
                          {propertyAddress}
                          {propertyCity && `, ${propertyCity}`}
                        </span>
                      )}
                      {buCode && (
                        <span className="px-2 py-0.5 bg-gray-100 rounded text-xs font-medium">
                          {buCode}
                        </span>
                      )}
                    </div>

                    {/* Row 4: Stats + Rep + Date */}
                    <div className="flex flex-wrap items-center gap-4 text-sm">
                      <span className="text-gray-500">
                        {quoteCount} quote{quoteCount !== 1 ? 's' : ''}
                      </span>
                      <span className="text-gray-500">
                        {jobCount} job{jobCount !== 1 ? 's' : ''}
                      </span>
                      {totalValue > 0 && (
                        <span className="font-medium text-gray-900">
                          {formatCurrency(totalValue)}
                        </span>
                      )}
                      {repName && (
                        <span className="flex items-center gap-1 text-gray-400 text-xs">
                          <User className="w-3 h-3" />
                          {repName}
                        </span>
                      )}
                      <span className="flex items-center gap-1 text-gray-400 text-xs">
                        <Calendar className="w-3 h-3" />
                        {new Date(project.created_at).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </span>
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
