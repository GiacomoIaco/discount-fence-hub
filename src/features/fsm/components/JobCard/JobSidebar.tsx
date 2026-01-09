/**
 * JobSidebar - Right sidebar for JobCard
 *
 * Sections:
 * - JOB DETAILS: Dates, status, phase
 * - ASSIGNMENT: Crew, Rep
 * - SCHEDULE: Date/Time, Duration
 * - MATERIAL STATUS: BOM/BOL progress (link to Ops Hub)
 */

import { useState } from 'react';
import {
  Calendar,
  Clock,
  Users,
  User,
  Package,
  ChevronDown,
  ChevronRight,
  MapPin,
  ExternalLink,
  Hash,
  Layers,
} from 'lucide-react';
import type { JobSidebarProps, JobFormState } from './types';
import { JOB_STATUS_COLORS } from './types';
import { useSalesReps } from '../../hooks/useSalesReps';

interface CollapsibleSectionProps {
  title: string;
  icon: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

function CollapsibleSection({
  title,
  icon,
  defaultOpen = true,
  children,
}: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border-b last:border-b-0">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50"
      >
        <div className="flex items-center gap-2">
          {icon}
          {title}
        </div>
        {isOpen ? (
          <ChevronDown className="w-4 h-4 text-gray-400" />
        ) : (
          <ChevronRight className="w-4 h-4 text-gray-400" />
        )}
      </button>
      {isOpen && <div className="px-4 pb-4 space-y-3">{children}</div>}
    </div>
  );
}

export default function JobSidebar({
  mode,
  form,
  job,
  crews,
  isLoadingCrews,
  validation,
  onFieldChange,
  onCrewChange,
  onRepChange,
}: JobSidebarProps) {
  const { data: salesReps = [], isLoading: isLoadingReps } = useSalesReps();
  const isEditable = mode !== 'view';

  // Material status from job
  const materialStatus = job?.status;
  const hasBom = job?.bom_project_id;

  return (
    <aside className="w-80 bg-white border-l flex flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto">
        {/* JOB DETAILS Section */}
        <CollapsibleSection
          title="JOB DETAILS"
          icon={<Calendar className="w-4 h-4 text-gray-400" />}
          defaultOpen={mode === 'view'}
        >
          {/* Status (view only) */}
          {mode === 'view' && job && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">Status</span>
              <span
                className={`px-2 py-0.5 rounded text-xs font-medium ${
                  JOB_STATUS_COLORS[job.status].bg
                } ${JOB_STATUS_COLORS[job.status].text}`}
              >
                {JOB_STATUS_COLORS[job.status].label}
              </span>
            </div>
          )}

          {/* Job Number (view only) */}
          {mode === 'view' && job?.job_number && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">Job Number</span>
              <span className="text-sm font-medium">{job.job_number}</span>
            </div>
          )}

          {/* Phase */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">Phase</span>
            {isEditable ? (
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="1"
                  value={form.phaseNumber}
                  onChange={(e) => onFieldChange('phaseNumber', parseInt(e.target.value) || 1)}
                  className="w-12 px-2 py-1 text-sm border rounded text-center"
                />
                <input
                  type="text"
                  value={form.phaseName}
                  onChange={(e) => onFieldChange('phaseName', e.target.value)}
                  placeholder="Phase name"
                  className="flex-1 px-2 py-1 text-sm border rounded"
                />
              </div>
            ) : (
              <span className="text-sm font-medium">
                Phase {form.phaseNumber}{form.phaseName && `: ${form.phaseName}`}
              </span>
            )}
          </div>

          {/* Created Date */}
          {job?.created_at && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">Created</span>
              <span className="text-sm text-gray-700">
                {new Date(job.created_at).toLocaleDateString()}
              </span>
            </div>
          )}

          {/* Scheduled Date */}
          {job?.scheduled_date && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">Scheduled</span>
              <span className="text-sm text-gray-700">
                {new Date(job.scheduled_date).toLocaleDateString()}
              </span>
            </div>
          )}

          {/* Completed Date */}
          {job?.work_completed_at && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">Completed</span>
              <span className="text-sm text-green-600">
                {new Date(job.work_completed_at).toLocaleDateString()}
              </span>
            </div>
          )}
        </CollapsibleSection>

        {/* ASSIGNMENT Section */}
        <CollapsibleSection
          title="ASSIGNMENT"
          icon={<Users className="w-4 h-4 text-gray-400" />}
        >
          {/* Crew */}
          <div>
            <label className="block text-sm text-gray-500 mb-1">
              Assigned Crew
              {isEditable && form.scheduledDate && (
                <span className="text-red-500 ml-1">*</span>
              )}
            </label>
            {isEditable ? (
              <select
                value={form.assignedCrewId}
                onChange={(e) => onCrewChange(e.target.value)}
                className={`w-full px-3 py-2 border rounded-lg text-sm ${
                  validation.errors.assignedCrewId ? 'border-red-300' : 'border-gray-300'
                }`}
                disabled={isLoadingCrews}
              >
                <option value="">Select crew...</option>
                {crews.map((crew) => (
                  <option key={crew.id} value={crew.id}>
                    {crew.name} {crew.code && `(${crew.code})`}
                  </option>
                ))}
              </select>
            ) : (
              <span className="text-sm font-medium">
                {job?.assigned_crew?.name || 'Not assigned'}
              </span>
            )}
            {validation.errors.assignedCrewId && (
              <p className="text-xs text-red-500 mt-1">
                {validation.errors.assignedCrewId}
              </p>
            )}
          </div>

          {/* Sales Rep */}
          <div>
            <label className="block text-sm text-gray-500 mb-1">Project Manager</label>
            {isEditable ? (
              <select
                value={form.assignedRepId}
                onChange={(e) => onRepChange(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                disabled={isLoadingReps}
              >
                <option value="">Select PM...</option>
                {salesReps.map((rep) => (
                  <option key={rep.user_id} value={rep.user_id}>
                    {rep.name}
                  </option>
                ))}
              </select>
            ) : (
              <span className="text-sm font-medium">
                {job?.assigned_rep_user?.name || job?.assigned_rep_user?.full_name || 'Not assigned'}
              </span>
            )}
          </div>
        </CollapsibleSection>

        {/* SCHEDULE Section */}
        <CollapsibleSection
          title="SCHEDULE"
          icon={<Clock className="w-4 h-4 text-gray-400" />}
        >
          {/* Scheduled Date */}
          <div>
            <label className="block text-sm text-gray-500 mb-1">Date</label>
            {isEditable ? (
              <input
                type="date"
                value={form.scheduledDate}
                onChange={(e) => onFieldChange('scheduledDate', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            ) : (
              <span className="text-sm font-medium">
                {form.scheduledDate
                  ? new Date(form.scheduledDate).toLocaleDateString('en-US', {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })
                  : 'Not scheduled'}
              </span>
            )}
          </div>

          {/* Time Range */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-sm text-gray-500 mb-1">Start Time</label>
              {isEditable ? (
                <input
                  type="time"
                  value={form.scheduledTimeStart}
                  onChange={(e) => onFieldChange('scheduledTimeStart', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              ) : (
                <span className="text-sm font-medium">
                  {form.scheduledTimeStart || '-'}
                </span>
              )}
            </div>
            <div>
              <label className="block text-sm text-gray-500 mb-1">End Time</label>
              {isEditable ? (
                <input
                  type="time"
                  value={form.scheduledTimeEnd}
                  onChange={(e) => onFieldChange('scheduledTimeEnd', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              ) : (
                <span className="text-sm font-medium">
                  {form.scheduledTimeEnd || '-'}
                </span>
              )}
            </div>
          </div>

          {/* Estimated Duration */}
          <div>
            <label className="block text-sm text-gray-500 mb-1">Est. Duration (hours)</label>
            {isEditable ? (
              <input
                type="number"
                min="0"
                step="0.5"
                value={form.estimatedDurationHours || ''}
                onChange={(e) =>
                  onFieldChange('estimatedDurationHours', parseFloat(e.target.value) || null)
                }
                placeholder="8"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            ) : (
              <span className="text-sm font-medium">
                {form.estimatedDurationHours ? `${form.estimatedDurationHours}h` : '-'}
              </span>
            )}
          </div>
        </CollapsibleSection>

        {/* MATERIAL STATUS Section */}
        <CollapsibleSection
          title="MATERIAL STATUS"
          icon={<Package className="w-4 h-4 text-gray-400" />}
          defaultOpen={false}
        >
          {hasBom ? (
            <>
              {/* Material workflow status */}
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">Status</span>
                <span
                  className={`px-2 py-0.5 rounded text-xs font-medium ${
                    materialStatus === 'staged' || materialStatus === 'loaded'
                      ? 'bg-green-100 text-green-700'
                      : materialStatus === 'picking'
                      ? 'bg-amber-100 text-amber-700'
                      : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {materialStatus === 'ready_for_yard' && 'Ready for Yard'}
                  {materialStatus === 'picking' && 'Picking'}
                  {materialStatus === 'staged' && 'Staged'}
                  {materialStatus === 'loaded' && 'Loaded'}
                  {!['ready_for_yard', 'picking', 'staged', 'loaded'].includes(materialStatus || '') &&
                    'Not Started'}
                </span>
              </div>

              {/* Link to Ops Hub */}
              <a
                href={`/bom/${job?.bom_project_id}`}
                className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 mt-2"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                View in Ops Hub
              </a>
            </>
          ) : (
            <div className="text-sm text-gray-500">
              No material order created yet.
              {isEditable && (
                <button
                  className="block mt-2 text-blue-600 hover:text-blue-700 text-sm"
                  onClick={() => {
                    // TODO: Create BOM/BOL from job
                    alert('Create BOM functionality coming soon');
                  }}
                >
                  + Create Material Order
                </button>
              )}
            </div>
          )}
        </CollapsibleSection>

        {/* SCOPE Section (edit mode only) */}
        {isEditable && (
          <CollapsibleSection
            title="SCOPE"
            icon={<Layers className="w-4 h-4 text-gray-400" />}
            defaultOpen={false}
          >
            {/* Product Type */}
            <div>
              <label className="block text-sm text-gray-500 mb-1">Product Type</label>
              <input
                type="text"
                value={form.productType}
                onChange={(e) => onFieldChange('productType', e.target.value)}
                placeholder="e.g., Wood Privacy"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>

            {/* Linear Feet */}
            <div>
              <label className="block text-sm text-gray-500 mb-1">Linear Feet</label>
              <input
                type="number"
                min="0"
                value={form.linearFeet || ''}
                onChange={(e) =>
                  onFieldChange('linearFeet', parseFloat(e.target.value) || null)
                }
                placeholder="150"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>

            {/* Quoted Total */}
            <div>
              <label className="block text-sm text-gray-500 mb-1">Quoted Total</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                  $
                </span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.quotedTotal || ''}
                  onChange={(e) =>
                    onFieldChange('quotedTotal', parseFloat(e.target.value) || null)
                  }
                  className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
            </div>
          </CollapsibleSection>
        )}
      </div>
    </aside>
  );
}
