/**
 * ProjectContextHeader - Persistent header showing project context
 *
 * Follows Jobber/ServiceTitan pattern where project context remains visible
 * when viewing/editing quotes, jobs, and invoices within a project.
 *
 * Displays:
 * - Client name (with link to client detail)
 * - Community name (for builder clients)
 * - Property address
 * - Business Unit (QBO Class)
 * - Assigned rep
 */

import { Building2, MapPin, Briefcase, User, ChevronLeft } from 'lucide-react';
import type { Project } from '../../types';

interface ProjectContextHeaderProps {
  project: Project | null | undefined;
  onBack?: () => void;
  /** Current child entity type being viewed */
  childEntityType?: 'quote' | 'job' | 'invoice' | null;
  /** Label for the child entity (e.g., "Quote #Q-2024-001") */
  childEntityLabel?: string;
}

export default function ProjectContextHeader({
  project,
  onBack,
  childEntityType,
  childEntityLabel,
}: ProjectContextHeaderProps) {
  if (!project) return null;

  // Get display values - prefer flattened view properties, fallback to nested objects
  // v_projects_full returns: client_display_name, property_address, community_name, rep_name
  // Fallback queries return: client.name, property.address_line1, etc.
  const clientName = project.client_display_name
    || project.client?.company_name
    || project.client?.name
    || 'Unknown Client';
  const communityName = project.community_name || project.community?.name;
  const propertyAddress = project.property_address
    || (project.property?.address_line1
      ? `${project.property.address_line1}, ${project.property.city || ''} ${project.property.state || ''} ${project.property.zip || ''}`
      : null);
  // QBO Class - view returns qbo_labor_code, qbo_class_name; fallback returns qbo_class.labor_code, qbo_class.name
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const projectAny = project as unknown as Record<string, unknown>;
  const qboClassName = (projectAny.qbo_class_name as string | undefined)
    || project.qbo_class?.name;
  const qboClassCode = (projectAny.qbo_labor_code as string | undefined)
    || project.qbo_class?.labor_code;
  const assignedRep = project.rep_name
    || project.assigned_rep_user?.name
    || project.assigned_rep_user?.full_name;

  // Format BU display
  const buDisplay = qboClassCode || qboClassName;

  return (
    <div className="bg-gradient-to-r from-slate-700 to-slate-800 text-white">
      {/* Top row: Project context */}
      <div className="px-6 py-3 flex items-center gap-6 text-sm border-b border-white/10">
        {/* Back button */}
        {onBack && (
          <button
            onClick={onBack}
            className="flex items-center gap-1 text-slate-300 hover:text-white transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Back</span>
          </button>
        )}

        {/* Client */}
        <div className="flex items-center gap-2">
          <Building2 className="w-4 h-4 text-slate-400" />
          <span className="font-medium">{clientName}</span>
          {communityName && (
            <>
              <span className="text-slate-500">/</span>
              <span className="text-slate-300">{communityName}</span>
            </>
          )}
        </div>

        {/* Property Address */}
        {propertyAddress && (
          <div className="flex items-center gap-2 text-slate-300">
            <MapPin className="w-4 h-4 text-slate-400" />
            <span className="truncate max-w-[300px]" title={propertyAddress}>
              {propertyAddress}
            </span>
          </div>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Business Unit badge */}
        {buDisplay && (
          <div className="flex items-center gap-2">
            <Briefcase className="w-4 h-4 text-slate-400" />
            <span className="px-2 py-0.5 bg-blue-500/30 text-blue-200 rounded text-xs font-medium">
              {buDisplay}
            </span>
          </div>
        )}

        {/* Assigned Rep */}
        {assignedRep && (
          <div className="flex items-center gap-2 text-slate-300">
            <User className="w-4 h-4 text-slate-400" />
            <span>{assignedRep}</span>
          </div>
        )}
      </div>

      {/* Bottom row: Child entity indicator (when viewing quote/job/invoice) */}
      {childEntityType && childEntityLabel && (
        <div className="px-6 py-2 flex items-center gap-3 text-xs bg-white/5">
          <span className="text-slate-400">Viewing:</span>
          <span className="px-2 py-1 bg-white/10 rounded font-medium">
            {childEntityLabel}
          </span>
          <span className="text-slate-500">within project</span>
          <span className="font-medium text-slate-300">
            {project.name || `Project #${project.id.slice(0, 8)}`}
          </span>
        </div>
      )}
    </div>
  );
}
