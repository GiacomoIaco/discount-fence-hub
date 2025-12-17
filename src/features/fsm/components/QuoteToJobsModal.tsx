/**
 * QuoteToJobsModal - Convert a quote to one or more jobs
 *
 * Supports the multi-job pattern for projects requiring different crews.
 * Example: Fence + Automatic Gate = 2 jobs, same invoice
 */

import { useState, useEffect } from 'react';
import {
  X,
  Plus,
  Trash2,
  Loader2,
  Check,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { useCrews } from '../hooks/useCrews';
import { useProjectTypes } from '../hooks/useProjectTypes';
import { useSkillTags } from '../hooks/useSkillTags';
import { useConvertQuoteToProject } from '../hooks/useQuoteToProject';
import type { Quote, QuoteToJobConfig } from '../types';

interface Props {
  quote: Quote;
  onClose: () => void;
  onSuccess: (result: { projectId: string; jobIds: string[] }) => void;
}

interface JobDraft {
  id: string;  // Temporary ID for UI
  name: string;
  project_type_id: string;
  skill_tag_ids: string[];
  quote_line_item_ids: string[];
  assigned_crew_id: string;
  scheduled_date: string;
  depends_on_previous: boolean;
  isExpanded: boolean;
}

export default function QuoteToJobsModal({ quote, onClose, onSuccess }: Props) {
  const lineItems = quote.line_items || [];
  const [invoiceTogether, setInvoiceTogether] = useState(true);
  const [selectedLineItemIds, setSelectedLineItemIds] = useState<Set<string>>(new Set());
  const [jobs, setJobs] = useState<JobDraft[]>([]);

  const { data: crews } = useCrews();
  const { data: projectTypes } = useProjectTypes();
  const { data: skillTags } = useSkillTags({ isActive: true });
  const convertMutation = useConvertQuoteToProject();

  const activeCrews = crews?.filter(c => c.is_active) || [];

  // Initialize with one empty job
  useEffect(() => {
    if (jobs.length === 0) {
      addJob();
    }
  }, []);

  const addJob = () => {
    const newJob: JobDraft = {
      id: crypto.randomUUID(),
      name: `Job ${jobs.length + 1}`,
      project_type_id: '',
      skill_tag_ids: [],
      quote_line_item_ids: [],
      assigned_crew_id: '',
      scheduled_date: '',
      depends_on_previous: jobs.length > 0,  // Default to depends on previous for 2nd+ job
      isExpanded: true,
    };
    setJobs([...jobs, newJob]);
  };

  const removeJob = (jobId: string) => {
    if (jobs.length <= 1) return;

    // Return line items to unassigned
    const job = jobs.find(j => j.id === jobId);
    if (job) {
      // Line items will now show as unassigned
    }

    setJobs(jobs.filter(j => j.id !== jobId));
  };

  const updateJob = (jobId: string, updates: Partial<JobDraft>) => {
    setJobs(jobs.map(j => j.id === jobId ? { ...j, ...updates } : j));
  };

  const toggleLineItemSelection = (itemId: string) => {
    const newSet = new Set(selectedLineItemIds);
    if (newSet.has(itemId)) {
      newSet.delete(itemId);
    } else {
      newSet.add(itemId);
    }
    setSelectedLineItemIds(newSet);
  };

  const addSelectedToJob = (jobId: string) => {
    if (selectedLineItemIds.size === 0) return;

    // Remove these items from any other job
    const updatedJobs = jobs.map(job => {
      if (job.id === jobId) {
        // Add to this job
        const newIds = new Set([...job.quote_line_item_ids, ...selectedLineItemIds]);
        return { ...job, quote_line_item_ids: Array.from(newIds) };
      } else {
        // Remove from other jobs
        return {
          ...job,
          quote_line_item_ids: job.quote_line_item_ids.filter(id => !selectedLineItemIds.has(id)),
        };
      }
    });

    setJobs(updatedJobs);
    setSelectedLineItemIds(new Set());
  };

  const getUnassignedLineItems = () => {
    const assignedIds = new Set(jobs.flatMap(j => j.quote_line_item_ids));
    return lineItems.filter(item => !assignedIds.has(item.id));
  };

  const getLineItemsForJob = (jobId: string) => {
    const job = jobs.find(j => j.id === jobId);
    if (!job) return [];
    return lineItems.filter(item => job.quote_line_item_ids.includes(item.id));
  };

  const calculateJobValue = (jobId: string) => {
    const items = getLineItemsForJob(jobId);
    return items.reduce((sum, item) => sum + (item.total_price || 0), 0);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const handleSubmit = async () => {
    // Validate all jobs have at least a name
    const invalidJobs = jobs.filter(j => !j.name.trim());
    if (invalidJobs.length > 0) {
      alert('All jobs must have a name');
      return;
    }

    // Build conversion data
    const conversion = {
      quote_id: quote.id,
      project_name: quote.client?.name || 'Project',
      invoice_together: invoiceTogether,
      jobs: jobs.map((job, index): QuoteToJobConfig => ({
        name: job.name,
        project_type_id: job.project_type_id || '',
        skill_tag_ids: job.skill_tag_ids,
        quote_line_item_ids: job.quote_line_item_ids,
        assigned_crew_id: job.assigned_crew_id || '',
        scheduled_date: job.scheduled_date || '',
        sequence_order: index + 1,
        depends_on_previous: job.depends_on_previous,
      })),
    };

    try {
      const result = await convertMutation.mutateAsync(conversion);
      onSuccess({
        projectId: result.project.id,
        jobIds: result.jobs.map(j => j.id),
      });
    } catch (error) {
      console.error('Conversion failed:', error);
    }
  };

  const unassignedItems = getUnassignedLineItems();
  const allItemsAssigned = unassignedItems.length === 0;
  const hasAtLeastOneJobWithItems = jobs.some(j => j.quote_line_item_ids.length > 0);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Convert to Jobs</h2>
            <p className="text-sm text-gray-500">
              {quote.quote_number} • {formatCurrency(quote.total)}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-2 gap-6">
            {/* Left: Line Items */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-gray-900">
                  Line Items
                  {unassignedItems.length > 0 && (
                    <span className="ml-2 text-gray-500">
                      ({unassignedItems.length} unassigned)
                    </span>
                  )}
                </h3>
                {selectedLineItemIds.size > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-blue-600">
                      {selectedLineItemIds.size} selected
                    </span>
                  </div>
                )}
              </div>

              {/* Line items list */}
              <div className="border rounded-lg divide-y max-h-80 overflow-y-auto">
                {lineItems.length === 0 ? (
                  <div className="p-4 text-center text-gray-500">
                    No line items in this quote
                  </div>
                ) : (
                  lineItems.map(item => {
                    const assignedJob = jobs.find(j => j.quote_line_item_ids.includes(item.id));
                    const isSelected = selectedLineItemIds.has(item.id);

                    return (
                      <div
                        key={item.id}
                        onClick={() => !assignedJob && toggleLineItemSelection(item.id)}
                        className={`p-3 flex items-center gap-3 cursor-pointer transition-colors ${
                          assignedJob
                            ? 'bg-gray-50 cursor-default'
                            : isSelected
                            ? 'bg-blue-50'
                            : 'hover:bg-gray-50'
                        }`}
                      >
                        {/* Checkbox */}
                        <div className={`w-5 h-5 rounded border flex items-center justify-center ${
                          assignedJob
                            ? 'border-gray-300 bg-gray-100'
                            : isSelected
                            ? 'border-blue-600 bg-blue-600'
                            : 'border-gray-300'
                        }`}>
                          {isSelected && <Check className="w-3 h-3 text-white" />}
                          {assignedJob && <div className="w-2 h-2 rounded-full bg-gray-400" />}
                        </div>

                        {/* Item info */}
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-gray-900 truncate">
                            {item.description}
                          </div>
                          <div className="text-xs text-gray-500">
                            {item.quantity} {item.unit_type} • {formatCurrency(item.total_price)}
                          </div>
                        </div>

                        {/* Assigned badge */}
                        {assignedJob && (
                          <span className="text-xs px-2 py-1 rounded bg-gray-200 text-gray-600">
                            {assignedJob.name}
                          </span>
                        )}
                      </div>
                    );
                  })
                )}
              </div>

              {/* Add to Job buttons */}
              {selectedLineItemIds.size > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {jobs.map(job => (
                    <button
                      key={job.id}
                      onClick={() => addSelectedToJob(job.id)}
                      className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      Add to {job.name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Right: Jobs */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-gray-900">
                  Jobs ({jobs.length})
                </h3>
                <button
                  onClick={addJob}
                  className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
                >
                  <Plus className="w-4 h-4" />
                  Add Job
                </button>
              </div>

              {/* Jobs list */}
              <div className="space-y-3">
                {jobs.map((job, index) => {
                  const jobItems = getLineItemsForJob(job.id);
                  const jobValue = calculateJobValue(job.id);

                  return (
                    <div key={job.id} className="border rounded-lg">
                      {/* Job header */}
                      <div
                        className="p-3 flex items-center justify-between cursor-pointer hover:bg-gray-50"
                        onClick={() => updateJob(job.id, { isExpanded: !job.isExpanded })}
                      >
                        <div className="flex items-center gap-3">
                          {job.isExpanded ? (
                            <ChevronUp className="w-4 h-4 text-gray-400" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-gray-400" />
                          )}
                          <div>
                            <div className="font-medium text-gray-900">{job.name || `Job ${index + 1}`}</div>
                            <div className="text-xs text-gray-500">
                              {jobItems.length} items • {formatCurrency(jobValue)}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {job.depends_on_previous && index > 0 && (
                            <span className="text-xs px-2 py-0.5 bg-amber-100 text-amber-700 rounded">
                              After Job {index}
                            </span>
                          )}
                          {jobs.length > 1 && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                removeJob(job.id);
                              }}
                              className="p-1 text-gray-400 hover:text-red-600"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Job details (expanded) */}
                      {job.isExpanded && (
                        <div className="border-t p-3 space-y-3 bg-gray-50">
                          {/* Name */}
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                              Job Name
                            </label>
                            <input
                              type="text"
                              value={job.name}
                              onChange={(e) => updateJob(job.id, { name: e.target.value })}
                              placeholder="e.g., Fence Install, Auto Gate"
                              className="w-full px-2 py-1.5 text-sm border rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            />
                          </div>

                          {/* Project Type & Skills */}
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">
                                Project Type
                              </label>
                              <select
                                value={job.project_type_id}
                                onChange={(e) => updateJob(job.id, { project_type_id: e.target.value })}
                                className="w-full px-2 py-1.5 text-sm border rounded focus:ring-2 focus:ring-blue-500"
                              >
                                <option value="">-- Select --</option>
                                {projectTypes?.filter(pt => pt.is_active).map(pt => (
                                  <option key={pt.id} value={pt.id}>{pt.name}</option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">
                                Crew
                              </label>
                              <select
                                value={job.assigned_crew_id}
                                onChange={(e) => updateJob(job.id, { assigned_crew_id: e.target.value })}
                                className="w-full px-2 py-1.5 text-sm border rounded focus:ring-2 focus:ring-blue-500"
                              >
                                <option value="">-- Not assigned --</option>
                                {activeCrews.map(crew => (
                                  <option key={crew.id} value={crew.id}>{crew.name}</option>
                                ))}
                              </select>
                            </div>
                          </div>

                          {/* Skills multi-select */}
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                              Required Skills
                            </label>
                            <div className="flex flex-wrap gap-1">
                              {skillTags?.map(skill => {
                                const isSelected = job.skill_tag_ids.includes(skill.id);
                                return (
                                  <button
                                    key={skill.id}
                                    type="button"
                                    onClick={() => {
                                      const newIds = isSelected
                                        ? job.skill_tag_ids.filter(id => id !== skill.id)
                                        : [...job.skill_tag_ids, skill.id];
                                      updateJob(job.id, { skill_tag_ids: newIds });
                                    }}
                                    className={`px-2 py-0.5 text-xs rounded border transition-colors ${
                                      isSelected
                                        ? 'bg-blue-100 border-blue-300 text-blue-800'
                                        : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                                    }`}
                                    style={isSelected ? { backgroundColor: `${skill.color}20`, borderColor: skill.color, color: skill.color } : {}}
                                  >
                                    {skill.name}
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          {/* Schedule & Dependencies */}
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">
                                Scheduled Date
                              </label>
                              <input
                                type="date"
                                value={job.scheduled_date}
                                onChange={(e) => updateJob(job.id, { scheduled_date: e.target.value })}
                                className="w-full px-2 py-1.5 text-sm border rounded focus:ring-2 focus:ring-blue-500"
                              />
                            </div>
                            {index > 0 && (
                              <div className="flex items-end pb-1">
                                <label className="flex items-center gap-2">
                                  <input
                                    type="checkbox"
                                    checked={job.depends_on_previous}
                                    onChange={(e) => updateJob(job.id, { depends_on_previous: e.target.checked })}
                                    className="rounded border-gray-300 text-blue-600"
                                  />
                                  <span className="text-xs text-gray-600">
                                    After Job {index}
                                  </span>
                                </label>
                              </div>
                            )}
                          </div>

                          {/* Assigned items */}
                          {jobItems.length > 0 && (
                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">
                                Assigned Items
                              </label>
                              <div className="bg-white border rounded p-2 text-xs text-gray-600 max-h-20 overflow-y-auto">
                                {jobItems.map(item => (
                                  <div key={item.id} className="flex justify-between py-0.5">
                                    <span className="truncate">{item.description}</span>
                                    <span className="text-gray-500 ml-2">{formatCurrency(item.total_price)}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Invoice Together Toggle */}
          <div className="mt-6 pt-6 border-t">
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={invoiceTogether}
                onChange={(e) => setInvoiceTogether(e.target.checked)}
                className="w-5 h-5 rounded border-gray-300 text-blue-600"
              />
              <div>
                <span className="font-medium text-gray-900">Invoice all jobs together</span>
                <p className="text-sm text-gray-500">
                  {invoiceTogether
                    ? 'All jobs will be grouped into a single invoice'
                    : 'Each job will be invoiced separately'
                  }
                </p>
              </div>
            </label>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-gray-50">
          <div className="text-sm text-gray-500">
            {!allItemsAssigned && (
              <span className="text-amber-600">
                {unassignedItems.length} item{unassignedItems.length !== 1 ? 's' : ''} not assigned to any job
              </span>
            )}
            {allItemsAssigned && hasAtLeastOneJobWithItems && (
              <span className="text-green-600">All items assigned</span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={convertMutation.isPending || !hasAtLeastOneJobWithItems}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 flex items-center gap-2 font-medium transition-colors"
            >
              {convertMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  Create {jobs.length} Job{jobs.length !== 1 ? 's' : ''}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
