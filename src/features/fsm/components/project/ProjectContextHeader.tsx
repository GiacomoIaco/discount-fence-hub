/**
 * ProjectContextHeader - Rich persistent header showing project context
 *
 * Follows Jobber/ServiceTitan pattern where project context remains visible
 * when viewing/editing quotes, jobs, and invoices within a project.
 *
 * Layout (3 rows):
 * - Row 1: Identity - Back, Client/Community, Property Address
 * - Row 2: Meta - BU badge, Rep, Value, Key dates
 * - Row 3: Pipeline - Quote → Job → Invoice → Paid progress
 * - Row 4 (optional): Child entity indicator when viewing Q/J/I
 */

import {
  Building2,
  MapPin,
  Briefcase,
  User,
  ChevronLeft,
  DollarSign,
  Calendar,
  Phone,
  Edit2,
  Share2,
  Inbox,
  Link2,
  Shield,
} from 'lucide-react';
import type { Project } from '../../types';
import {
  ProjectPipelineProgress,
  extractPipelineData,
  type ProjectPipelineData,
} from '../shared/ProjectPipelineProgress';

// Extended project type that includes v_projects_full computed fields
interface ProjectWithViewFields extends Project {
  // Flattened fields from v_projects_full
  client_display_name?: string;
  client_phone?: string;
  property_address?: string;
  community_name?: string;
  rep_name?: string;
  qbo_class_name?: string;
  qbo_labor_code?: string;
  // Computed counts from v_projects_full
  cnt_quotes?: number;
  cnt_jobs?: number;
  cnt_active_jobs?: number;
  cnt_invoices?: number;
  cnt_unpaid_invoices?: number;
  sum_invoiced?: number;
  sum_paid?: number;
  sum_balance_due?: number;
  // Request-Project lifecycle fields
  request_id?: string | null;
  request_number?: string;  // From joined request
  // Warranty child project fields
  parent_project_id?: string | null;
  parent_project_number?: string;  // From joined parent project
}

interface ProjectContextHeaderProps {
  project: ProjectWithViewFields | null | undefined;
  onBack?: () => void;
  /** Current child entity type being viewed */
  childEntityType?: 'quote' | 'job' | 'invoice' | null;
  /** Label for the child entity (e.g., "Quote #Q-2024-001") */
  childEntityLabel?: string;
  /** Pipeline data if not available from project object */
  pipelineData?: ProjectPipelineData;
  /** Callback when pipeline stage is clicked */
  onPipelineStageClick?: (stageId: string) => void;
  /** Callback when Edit button is clicked */
  onEdit?: () => void;
  /** Callback when Share/Invite button is clicked */
  onShare?: () => void;
  /** Callback when "From Request" badge is clicked */
  onNavigateToRequest?: (requestId: string) => void;
  /** Callback when "Warranty of" badge is clicked */
  onNavigateToParentProject?: (projectId: string) => void;
}

export default function ProjectContextHeader({
  project,
  onBack,
  childEntityType,
  childEntityLabel,
  pipelineData: externalPipelineData,
  onPipelineStageClick,
  onEdit,
  onShare,
  onNavigateToRequest,
  onNavigateToParentProject,
}: ProjectContextHeaderProps) {
  if (!project) return null;

  // Get display values - prefer flattened view properties, fallback to nested objects
  const clientName =
    project.client_display_name ||
    project.client?.company_name ||
    project.client?.name ||
    'Unknown Client';

  const communityName = project.community_name || project.community?.name;

  const propertyAddress =
    project.property_address ||
    (project.property?.address_line1
      ? `${project.property.address_line1}, ${project.property.city || ''} ${project.property.state || ''} ${project.property.zip || ''}`
      : null);

  // QBO Class - view returns qbo_labor_code, qbo_class_name; fallback returns qbo_class.labor_code
  const qboClassCode =
    project.qbo_labor_code || project.qbo_class?.labor_code;
  const qboClassName = project.qbo_class_name || project.qbo_class?.name;

  const assignedRep =
    project.rep_name ||
    project.assigned_rep_user?.name ||
    project.assigned_rep_user?.full_name;

  const clientPhone = project.client_phone || null;

  // Format BU display - prefer code (shorter), fallback to name
  const buDisplay = qboClassCode || qboClassName;

  // Project value - prefer computed sum, fallback to total_quoted
  const projectValue = project.sum_invoiced || project.total_invoiced || project.total_quoted || 0;

  // Pipeline data - use external if provided, otherwise extract from project
  const pipelineData: ProjectPipelineData = externalPipelineData || extractPipelineData({
    cnt_quotes: project.cnt_quotes,
    accepted_quote_id: project.accepted_quote_id,
    cnt_jobs: project.cnt_jobs,
    cnt_active_jobs: project.cnt_active_jobs,
    cnt_invoices: project.cnt_invoices,
    cnt_unpaid_invoices: project.cnt_unpaid_invoices,
    sum_invoiced: project.sum_invoiced || project.total_invoiced,
    sum_paid: project.sum_paid || project.total_paid,
    sum_balance_due: project.sum_balance_due,
  });

  // Format project name/number for display
  const projectDisplayName = project.name || project.project_number || `P-${project.id.slice(0, 8)}`;

  return (
    <div className="bg-gradient-to-r from-slate-700 to-slate-800 text-white">
      {/* Row 1: Identity - Client, Community, Property */}
      <div className="px-6 py-2.5 flex items-center gap-4 text-sm border-b border-white/10">
        {/* Back button */}
        {onBack && (
          <button
            onClick={onBack}
            className="flex items-center gap-1 text-slate-300 hover:text-white transition-colors mr-2"
          >
            <ChevronLeft className="w-4 h-4" />
            <span className="text-xs">Back</span>
          </button>
        )}

        {/* Client / Community */}
        <div className="flex items-center gap-2 min-w-0">
          <Building2 className="w-4 h-4 text-slate-400 flex-shrink-0" />
          <span className="font-semibold truncate">{clientName}</span>
          {communityName && (
            <>
              <span className="text-slate-500">—</span>
              <span className="text-slate-300 truncate">{communityName}</span>
            </>
          )}
        </div>

        {/* Property Address */}
        {propertyAddress && (
          <div className="flex items-center gap-2 text-slate-300 min-w-0 ml-4">
            <MapPin className="w-4 h-4 text-slate-400 flex-shrink-0" />
            <span className="truncate max-w-[280px]" title={propertyAddress}>
              {propertyAddress}
            </span>
          </div>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Project Name/Number */}
        <div className="text-xs text-slate-400">
          {projectDisplayName}
        </div>
      </div>

      {/* Row 2: Meta - BU, Rep, Value, Dates */}
      <div className="px-6 py-2 flex items-center gap-6 text-xs border-b border-white/10 bg-white/5">
        {/* Business Unit badge */}
        {buDisplay && (
          <div className="flex items-center gap-1.5">
            <Briefcase className="w-3.5 h-3.5 text-slate-400" />
            <span className="px-2 py-0.5 bg-blue-500/30 text-blue-200 rounded font-medium">
              {buDisplay}
            </span>
          </div>
        )}

        {/* Assigned Rep */}
        {assignedRep && (
          <div className="flex items-center gap-1.5 text-slate-300">
            <User className="w-3.5 h-3.5 text-slate-400" />
            <span>{assignedRep}</span>
          </div>
        )}

        {/* Client Phone */}
        {clientPhone && (
          <a
            href={`tel:${clientPhone}`}
            className="flex items-center gap-1.5 text-slate-300 hover:text-white transition-colors"
          >
            <Phone className="w-3.5 h-3.5 text-slate-400" />
            <span>{clientPhone}</span>
          </a>
        )}

        {/* Project Value */}
        {projectValue > 0 && (
          <div className="flex items-center gap-1.5 text-slate-300">
            <DollarSign className="w-3.5 h-3.5 text-slate-400" />
            <span className="font-medium">
              ${projectValue.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </span>
          </div>
        )}

        {/* Created date */}
        {project.created_at && (
          <div className="flex items-center gap-1.5 text-slate-400">
            <Calendar className="w-3.5 h-3.5" />
            <span>
              Created {new Date(project.created_at).toLocaleDateString()}
            </span>
          </div>
        )}

        {/* From Request badge - shows source request when project was created from a request */}
        {project.request_id && (
          <button
            onClick={() => onNavigateToRequest?.(project.request_id!)}
            className="flex items-center gap-1.5 px-2 py-0.5 bg-orange-500/20 hover:bg-orange-500/30 text-orange-200 rounded transition-colors"
            title="View source request"
          >
            <Inbox className="w-3.5 h-3.5" />
            <span className="text-xs">
              From: {project.request_number || 'Request'}
            </span>
            <Link2 className="w-3 h-3 opacity-60" />
          </button>
        )}

        {/* Warranty of badge - shows parent project for warranty child projects */}
        {project.parent_project_id && project.project_type === 'warranty' && (
          <button
            onClick={() => onNavigateToParentProject?.(project.parent_project_id!)}
            className="flex items-center gap-1.5 px-2 py-0.5 bg-purple-500/20 hover:bg-purple-500/30 text-purple-200 rounded transition-colors"
            title="View original project"
          >
            <Shield className="w-3.5 h-3.5" />
            <span className="text-xs">
              Warranty of: {project.parent_project_number || 'Project'}
            </span>
            <Link2 className="w-3 h-3 opacity-60" />
          </button>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          {onEdit && (
            <button
              onClick={onEdit}
              className="flex items-center gap-1 px-2 py-1 text-xs bg-white/10 hover:bg-white/20 rounded transition-colors"
            >
              <Edit2 className="w-3 h-3" />
              Edit
            </button>
          )}
          {onShare && (
            <button
              onClick={onShare}
              className="flex items-center gap-1 px-2 py-1 text-xs bg-blue-500/50 hover:bg-blue-500/70 rounded transition-colors"
            >
              <Share2 className="w-3 h-3" />
              Share
            </button>
          )}
        </div>

        {/* Status badge */}
        {project.status && (
          <span
            className={`
              px-2 py-0.5 rounded text-xs font-medium
              ${project.status === 'active' ? 'bg-green-500/30 text-green-200' :
                project.status === 'complete' ? 'bg-blue-500/30 text-blue-200' :
                project.status === 'on_hold' ? 'bg-amber-500/30 text-amber-200' :
                project.status === 'cancelled' ? 'bg-red-500/30 text-red-200' :
                'bg-white/20 text-slate-300'}
            `}
          >
            {project.status.replace('_', ' ')}
          </span>
        )}
      </div>

      {/* Row 3: Pipeline Progress */}
      <div className="px-6 py-2.5 flex items-center justify-center border-b border-white/10 bg-black/10">
        <ProjectPipelineProgress
          data={pipelineData}
          compact
          darkMode
          showDetails={false}
          onStageClick={onPipelineStageClick}
        />
      </div>

      {/* Row 4 (optional): Child entity indicator when viewing quote/job/invoice */}
      {childEntityType && childEntityLabel && (
        <div className="px-6 py-1.5 flex items-center gap-3 text-xs bg-white/5">
          <span className="text-slate-400">Viewing:</span>
          <span className="px-2 py-0.5 bg-white/10 rounded font-medium">
            {childEntityLabel}
          </span>
          <span className="text-slate-500">in project</span>
          <span className="font-medium text-slate-300">
            {projectDisplayName}
          </span>
        </div>
      )}
    </div>
  );
}
