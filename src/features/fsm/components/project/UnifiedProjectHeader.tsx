/**
 * UnifiedProjectHeader - Single header component for all project views
 *
 * Combines ProjectPage's EntityHeader and ProjectContextHeader into one unified design.
 *
 * Layout (5 rows):
 * - Row 1: Identity - Back button, Client Name — Community, Property Address, Project ID (right)
 * - Row 2: Meta - BU badge, Rep, Phone, Value, Date, [Edit] [⋮] (right), Status badge
 * - Row 3: Smart Pipeline - Quote → Jobs → Invoice → Paid with sub-status awareness
 * - Row 4: Tabs - Overview, Estimates (n), Work (n), Billing (n), Files, Activity
 * - Row 5 (optional): Breadcrumb when viewing Q/J/I within project
 */

import { useState, useRef, useEffect } from 'react';
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
  MoreVertical,
  ExternalLink,
} from 'lucide-react';
import type { Project, ProjectStatus } from '../../types';
import {
  ProjectPipelineProgress,
  extractPipelineData,
  type ProjectPipelineData,
} from '../shared/ProjectPipelineProgress';

// Tab types
export type ProjectTab = 'overview' | 'estimates' | 'work' | 'billing' | 'files' | 'activity';

// Extended project type that includes v_projects_full computed fields
interface ProjectWithViewFields extends Project {
  // Flattened fields from v_projects_full
  client_display_name?: string;
  client_phone?: string;
  property_address?: string;
  property_city?: string;
  property_state?: string;
  property_zip?: string;
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
  quote_count?: number;
  job_count?: number;
  invoice_count?: number;
}

const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  active: 'Active',
  complete: 'Complete',
  on_hold: 'On Hold',
  cancelled: 'Cancelled',
  warranty: 'Warranty',
};

const PROJECT_STATUS_COLORS: Record<ProjectStatus, string> = {
  active: 'bg-green-100 text-green-700',
  complete: 'bg-blue-100 text-blue-700',
  on_hold: 'bg-amber-100 text-amber-700',
  cancelled: 'bg-gray-100 text-gray-500',
  warranty: 'bg-purple-100 text-purple-700',
};

// BU type colors
const BU_TYPE_COLORS: Record<string, string> = {
  residential: 'bg-blue-100 text-blue-700',
  builders: 'bg-orange-100 text-orange-700',
  commercial: 'bg-green-100 text-green-700',
};

interface UnifiedProjectHeaderProps {
  project: ProjectWithViewFields | null | undefined;
  /** Current active tab */
  activeTab?: ProjectTab;
  /** Callback when tab changes */
  onTabChange?: (tab: ProjectTab) => void;
  /** Show tabs (default: true) */
  showTabs?: boolean;
  /** Tab counts - pass counts for badges */
  tabCounts?: {
    estimates?: number;
    work?: number;
    billing?: number;
  };
  /** Callback when back button is clicked */
  onBack?: () => void;
  /** Callback when Edit button is clicked */
  onEdit?: () => void;
  /** Custom actions for specific tabs */
  tabActions?: React.ReactNode;
  /** Current child entity type being viewed (shows breadcrumb) */
  childEntityType?: 'quote' | 'job' | 'invoice' | null;
  /** Label for the child entity (e.g., "Quote #Q-2024-001") */
  childEntityLabel?: string;
  /** Pipeline data if not available from project object */
  pipelineData?: ProjectPipelineData;
  /** Callback when pipeline stage is clicked */
  onPipelineStageClick?: (stageId: string) => void;
  /** Callback when clicking on client name to navigate to client detail */
  onNavigateToClient?: (clientId: string) => void;
  /** Callback when clicking on community name to navigate to community detail */
  onNavigateToCommunity?: (communityId: string) => void;
}

export default function UnifiedProjectHeader({
  project,
  activeTab = 'overview',
  onTabChange,
  showTabs = true,
  tabCounts,
  onBack,
  onEdit,
  tabActions,
  childEntityType,
  childEntityLabel,
  pipelineData: externalPipelineData,
  onPipelineStageClick,
  onNavigateToClient,
  onNavigateToCommunity,
}: UnifiedProjectHeaderProps) {
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const moreMenuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(event.target as Node)) {
        setShowMoreMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!project) return null;

  // Get display values - prefer flattened view properties, fallback to nested objects
  const clientName =
    project.client_display_name ||
    project.client?.company_name ||
    project.client?.name ||
    'No client';

  const communityName = project.community_name || project.community?.name;

  const propertyAddress =
    project.property_address ||
    (project.property?.address_line1
      ? `${project.property.address_line1}, ${project.property.city || ''} ${project.property.state || ''} ${project.property.zip || ''}`
      : 'No address');

  // QBO Class - view returns qbo_labor_code, qbo_class_name; fallback returns qbo_class.labor_code
  const qboClassCode = project.qbo_labor_code || project.qbo_class?.labor_code;
  const qboClassName = project.qbo_class_name || project.qbo_class?.name;
  const buType = project.qbo_class?.bu_type || 'residential';
  const buColor = BU_TYPE_COLORS[buType] || BU_TYPE_COLORS.residential;

  const assignedRep =
    project.rep_name ||
    project.assigned_rep_user?.name ||
    project.assigned_rep_user?.full_name;

  // Client phone - only use the flattened view field (client join doesn't include phone)
  const clientPhone = project.client_phone || null;

  // Format BU display - prefer code (shorter), fallback to name
  const buDisplay = qboClassCode || qboClassName;

  // Project value - prefer computed sum, fallback to total_quoted
  const projectValue = project.sum_invoiced || project.total_invoiced || project.total_quoted || project.total_job_value || 0;

  // Pipeline data - use external if provided, otherwise extract from project
  const pipelineData: ProjectPipelineData = externalPipelineData || extractPipelineData({
    cnt_quotes: project.cnt_quotes ?? project.quote_count,
    accepted_quote_id: project.accepted_quote_id,
    cnt_jobs: project.cnt_jobs ?? project.job_count,
    cnt_active_jobs: project.cnt_active_jobs,
    cnt_invoices: project.cnt_invoices ?? project.invoice_count,
    cnt_unpaid_invoices: project.cnt_unpaid_invoices,
    sum_invoiced: project.sum_invoiced || project.total_invoiced,
    sum_paid: project.sum_paid || project.total_paid,
    sum_balance_due: project.sum_balance_due,
  });

  // Format project ID for display
  const projectId = project.project_number || `P-${project.id.slice(0, 8).toUpperCase()}`;

  // Tab configuration with dynamic counts
  const tabs: { id: ProjectTab; label: string; count?: number }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'estimates', label: 'Estimates', count: tabCounts?.estimates ?? project.cnt_quotes ?? project.quote_count },
    { id: 'work', label: 'Work', count: tabCounts?.work ?? project.cnt_jobs ?? project.job_count },
    { id: 'billing', label: 'Billing', count: tabCounts?.billing ?? project.cnt_invoices ?? project.invoice_count },
    { id: 'files', label: 'Files' },
    { id: 'activity', label: 'Activity' },
  ];

  return (
    <div className="bg-white border-b shadow-sm">
      {/* Row 1: Identity - Back, Client/Community + Project Name, Project ID */}
      <div className="px-6 py-3 flex items-center gap-4">
        {/* Back button */}
        {onBack && (
          <button
            onClick={onBack}
            className="flex items-center gap-1 text-gray-500 hover:text-gray-700 transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
            <span className="text-sm font-medium">Back</span>
          </button>
        )}

        {/* Client / Community - Most prominent */}
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <Building2 className="w-5 h-5 text-gray-400 flex-shrink-0" />
          {/* Client name - clickable to navigate to client detail */}
          {onNavigateToClient && project.client_id ? (
            <button
              onClick={() => onNavigateToClient(project.client_id!)}
              className="text-xl font-bold text-blue-600 hover:text-blue-800 hover:underline truncate transition-colors"
              title={`View ${clientName} details`}
            >
              {clientName}
            </button>
          ) : (
            <h1 className="text-xl font-bold text-gray-900 truncate">{clientName}</h1>
          )}
          {communityName && (
            <>
              <span className="text-gray-300">—</span>
              {/* Community name - clickable to navigate to community detail */}
              {onNavigateToCommunity && project.community_id ? (
                <button
                  onClick={() => onNavigateToCommunity(project.community_id!)}
                  className="text-gray-600 hover:text-blue-600 hover:underline truncate transition-colors"
                  title={`View ${communityName} details`}
                >
                  {communityName}
                </button>
              ) : (
                <span className="text-gray-600 truncate">{communityName}</span>
              )}
            </>
          )}
          {/* Project name/title if set */}
          {project.name && (
            <>
              <span className="text-gray-300">•</span>
              <span className="text-gray-500 italic truncate" title={project.name}>
                {project.name}
              </span>
            </>
          )}
        </div>

        {/* Status badge */}
        <span
          className={`px-2.5 py-1 rounded-full text-xs font-semibold ${PROJECT_STATUS_COLORS[project.status]}`}
        >
          {PROJECT_STATUS_LABELS[project.status]}
        </span>

        {/* Project ID - Right corner */}
        <div className="text-sm text-gray-400 font-mono ml-2">{projectId}</div>
      </div>

      {/* Row 1.5: Full Address - Clickable to open Google Maps */}
      {(() => {
        // Build full address for Google Maps link
        const fullAddress = project.property_city
          ? `${propertyAddress}, ${project.property_city}, ${project.property_state} ${project.property_zip}`
          : propertyAddress;
        const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress)}`;

        return (
          <a
            href={mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="px-6 py-2 flex items-center gap-2 bg-blue-50 border-t border-blue-100 hover:bg-blue-100 transition-colors group"
          >
            <MapPin className="w-4 h-4 text-blue-500 flex-shrink-0" />
            <span className="text-sm font-medium text-blue-900 group-hover:underline">
              {propertyAddress}
            </span>
            {project.property_city && (
              <span className="text-sm text-blue-700">
                {project.property_city}, {project.property_state} {project.property_zip}
              </span>
            )}
            <ExternalLink className="w-3.5 h-3.5 text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity ml-1" />
          </a>
        );
      })()}

      {/* Row 2: Meta - BU, Rep, Phone, Value, Date + Actions */}
      <div className="px-6 py-2 flex items-center gap-6 text-sm bg-gray-50 border-t border-gray-100">
        {/* Business Unit badge */}
        {buDisplay && (
          <div className="flex items-center gap-1.5">
            <Briefcase className="w-4 h-4 text-gray-400" />
            <span className={`px-2 py-0.5 rounded font-medium text-xs ${buColor}`}>
              {buDisplay}
            </span>
          </div>
        )}

        {/* Assigned Rep */}
        {assignedRep && (
          <div className="flex items-center gap-1.5 text-gray-600">
            <User className="w-4 h-4 text-gray-400" />
            <span>{assignedRep}</span>
          </div>
        )}

        {/* Client Phone */}
        {clientPhone && (
          <a
            href={`tel:${clientPhone}`}
            className="flex items-center gap-1.5 text-gray-600 hover:text-blue-600 transition-colors"
          >
            <Phone className="w-4 h-4 text-gray-400" />
            <span>{clientPhone}</span>
          </a>
        )}

        {/* Project Value */}
        {projectValue > 0 && (
          <div className="flex items-center gap-1.5 text-gray-600">
            <DollarSign className="w-4 h-4 text-gray-400" />
            <span className="font-medium">
              ${projectValue.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </span>
          </div>
        )}

        {/* Created date */}
        {project.created_at && (
          <div className="flex items-center gap-1.5 text-gray-400">
            <Calendar className="w-4 h-4" />
            <span>
              {new Date(project.created_at).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
            </span>
          </div>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Tab-specific actions */}
        {tabActions}

        {/* Edit button */}
        {onEdit && (
          <button
            onClick={onEdit}
            className="flex items-center gap-1 px-3 py-1.5 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors"
          >
            <Edit2 className="w-4 h-4" />
            <span className="text-sm">Edit</span>
          </button>
        )}

        {/* More menu */}
        <div className="relative" ref={moreMenuRef}>
          <button
            onClick={() => setShowMoreMenu(!showMoreMenu)}
            className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors"
          >
            <MoreVertical className="w-5 h-5" />
          </button>
          {showMoreMenu && (
            <div className="absolute right-0 mt-1 w-48 bg-white rounded-lg shadow-lg border z-50">
              <div className="py-1">
                <button className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                  Duplicate Project
                </button>
                <button className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                  Export PDF
                </button>
                <button className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                  Send to Client
                </button>
                <hr className="my-1" />
                <button className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50">
                  Archive Project
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Row 3: Smart Pipeline Progress */}
      <div className="px-6 py-3 flex items-center justify-center border-t border-gray-100">
        <ProjectPipelineProgress
          data={pipelineData}
          compact
          showDetails
          onStageClick={(stageId: string) => {
            // Call external handler if provided
            if (onPipelineStageClick) {
              onPipelineStageClick(stageId);
            }
            // Default behavior: navigate to corresponding tab
            if (onTabChange) {
              const stageToTab: Record<string, ProjectTab> = {
                quote: 'estimates',
                job: 'work',
                invoice: 'billing',
                paid: 'billing',
              };
              const targetTab = stageToTab[stageId];
              if (targetTab) {
                onTabChange(targetTab);
              }
            }
          }}
        />
      </div>

      {/* Row 4: Tabs */}
      {showTabs && onTabChange && (
        <div className="px-6 flex items-center gap-1 border-t border-gray-100 overflow-x-auto">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 font-medium transition-colors whitespace-nowrap border-b-2 -mb-px ${
                  isActive
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.label}
                {tab.count !== undefined && tab.count > 0 && (
                  <span
                    className={`px-1.5 py-0.5 text-xs rounded-full ${
                      isActive ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Row 5 (optional): Breadcrumb when viewing Q/J/I */}
      {childEntityType && childEntityLabel && (
        <div className="px-6 py-2 flex items-center gap-3 text-sm bg-blue-50 border-t border-blue-100">
          <span className="text-blue-600">Viewing:</span>
          <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded font-medium">
            {childEntityLabel}
          </span>
          <span className="text-blue-400">in project</span>
          <span className="font-medium text-blue-700">{projectId}</span>
        </div>
      )}
    </div>
  );
}
