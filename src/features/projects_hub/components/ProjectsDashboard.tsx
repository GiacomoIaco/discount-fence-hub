import {
  ClipboardList,
  FileText,
  Hammer,
  Receipt,
  TrendingUp,
  Calendar,
  Clock
} from 'lucide-react';
import type { ProjectsHubView } from '../types';

interface ProjectsDashboardProps {
  onNavigate: (view: ProjectsHubView) => void;
}

export default function ProjectsDashboard({ onNavigate }: ProjectsDashboardProps) {
  // TODO: Fetch real stats from database
  const stats = {
    newRequests: 12,
    scheduledAssessments: 5,
    pendingQuotes: 8,
    activeJobs: 15,
    unpaidInvoices: 23,
    overduePayments: 3,
  };

  const cards = [
    {
      title: 'New Requests',
      value: stats.newRequests,
      icon: ClipboardList,
      color: 'bg-blue-500',
      view: 'requests' as ProjectsHubView,
      description: 'Awaiting assessment',
    },
    {
      title: 'Scheduled Assessments',
      value: stats.scheduledAssessments,
      icon: Calendar,
      color: 'bg-purple-500',
      view: 'requests' as ProjectsHubView,
      description: 'This week',
    },
    {
      title: 'Pending Quotes',
      value: stats.pendingQuotes,
      icon: FileText,
      color: 'bg-amber-500',
      view: 'quotes' as ProjectsHubView,
      description: 'Awaiting approval',
    },
    {
      title: 'Active Jobs',
      value: stats.activeJobs,
      icon: Hammer,
      color: 'bg-green-500',
      view: 'jobs' as ProjectsHubView,
      description: 'In progress',
    },
    {
      title: 'Unpaid Invoices',
      value: stats.unpaidInvoices,
      icon: Receipt,
      color: 'bg-orange-500',
      view: 'invoices' as ProjectsHubView,
      description: 'Outstanding',
    },
    {
      title: 'Overdue Payments',
      value: stats.overduePayments,
      icon: Clock,
      color: 'bg-red-500',
      view: 'payments' as ProjectsHubView,
      description: 'Past due',
    },
  ];

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Projects Overview</h1>
        <p className="text-gray-500 mt-1">
          Manage your service requests, quotes, jobs, and payments
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <button
              key={card.title}
              onClick={() => onNavigate(card.view)}
              className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 hover:shadow-md hover:border-gray-200 transition-all text-left"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500">{card.title}</p>
                  <p className="text-3xl font-bold text-gray-900 mt-1">{card.value}</p>
                  <p className="text-xs text-gray-400 mt-1">{card.description}</p>
                </div>
                <div className={`p-3 rounded-lg ${card.color}`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-blue-600" />
          Quick Actions
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <button
            onClick={() => onNavigate('requests')}
            className="flex items-center gap-2 px-4 py-3 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg font-medium text-sm transition-colors"
          >
            <ClipboardList className="w-4 h-4" />
            New Request
          </button>
          <button
            onClick={() => onNavigate('quotes')}
            className="flex items-center gap-2 px-4 py-3 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-lg font-medium text-sm transition-colors"
          >
            <FileText className="w-4 h-4" />
            Create Quote
          </button>
          <button
            onClick={() => onNavigate('jobs')}
            className="flex items-center gap-2 px-4 py-3 bg-green-50 hover:bg-green-100 text-green-700 rounded-lg font-medium text-sm transition-colors"
          >
            <Hammer className="w-4 h-4" />
            Schedule Job
          </button>
          <button
            onClick={() => onNavigate('invoices')}
            className="flex items-center gap-2 px-4 py-3 bg-orange-50 hover:bg-orange-100 text-orange-700 rounded-lg font-medium text-sm transition-colors"
          >
            <Receipt className="w-4 h-4" />
            Send Invoice
          </button>
        </div>
      </div>
    </div>
  );
}
