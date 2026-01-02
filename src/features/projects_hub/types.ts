export type ProjectsHubView =
  | 'dashboard'
  | 'projects'       // Project-First view (Phase 3)
  | 'requests'
  | 'quotes'
  | 'jobs'
  | 'invoices'
  | 'payments';

export interface ProjectsStats {
  totalRequests: number;
  pendingRequests: number;
  scheduledAssessments: number;
  activeJobs: number;
  pendingQuotes: number;
  unpaidInvoices: number;
}
