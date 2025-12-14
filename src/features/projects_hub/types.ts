export type ProjectsHubView =
  | 'dashboard'
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
