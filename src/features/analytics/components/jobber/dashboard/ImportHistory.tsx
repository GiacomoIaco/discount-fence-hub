// Import History component - Shows upload history and data freshness

import { useState } from 'react';
import { History, FileText, CheckCircle, XCircle, AlertTriangle, Calendar, Clock, RefreshCw } from 'lucide-react';
import { useImportLogs, useImportStats } from '../../../hooks/jobber/useJobberImport';
import type { BusinessUnit } from '../../../types/jobber';

interface ImportHistoryProps {
  businessUnit: BusinessUnit;
  onUploadClick?: () => void;
}

export function ImportHistory({ businessUnit, onUploadClick }: ImportHistoryProps) {
  const [showAll, setShowAll] = useState(false);
  const { data: logs, isLoading: logsLoading } = useImportLogs(businessUnit, showAll ? 50 : 10);
  const { data: stats, isLoading: statsLoading } = useImportStats(businessUnit);

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const formatShortDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  const getDaysAgo = (dateStr: string | null | undefined) => {
    if (!dateStr) return null;
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    return `${diffDays} days ago`;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'failed': return <XCircle className="w-4 h-4 text-red-600" />;
      case 'processing': return <RefreshCw className="w-4 h-4 text-blue-600 animate-spin" />;
      default: return <AlertTriangle className="w-4 h-4 text-yellow-600" />;
    }
  };

  const getReportTypeLabel = (type: string) => {
    switch (type) {
      case 'jobs': return 'Jobs';
      case 'quotes': return 'Quotes';
      case 'invoices': return 'Invoices';
      default: return type;
    }
  };

  const getDataFreshness = (lastImport: { uploaded_at: string } | null | undefined) => {
    if (!lastImport) return { status: 'never', color: 'text-red-600', bg: 'bg-red-50' };

    const daysAgo = Math.floor(
      (new Date().getTime() - new Date(lastImport.uploaded_at).getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysAgo <= 7) return { status: 'fresh', color: 'text-green-600', bg: 'bg-green-50' };
    if (daysAgo <= 14) return { status: 'ok', color: 'text-yellow-600', bg: 'bg-yellow-50' };
    return { status: 'stale', color: 'text-red-600', bg: 'bg-red-50' };
  };

  const isLoading = logsLoading || statsLoading;

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Import History</h3>
        <div className="h-64 bg-gray-100 animate-pulse rounded"></div>
      </div>
    );
  }

  const jobsFreshness = getDataFreshness(stats?.lastJobsImport);
  const quotesFreshness = getDataFreshness(stats?.lastQuotesImport);
  const invoicesFreshness = getDataFreshness(stats?.lastInvoicesImport);

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <History className="w-5 h-5 text-blue-600" />
          <h3 className="text-lg font-semibold text-gray-900">Import History & Data Freshness</h3>
        </div>
        {onUploadClick && (
          <button
            onClick={onUploadClick}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium"
          >
            Upload New Data
          </button>
        )}
      </div>

      {/* Data Freshness Cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {/* Jobs */}
        <div className={`p-4 rounded-lg ${jobsFreshness.bg} border border-gray-200`}>
          <div className="flex items-center justify-between mb-2">
            <span className="font-medium text-gray-900">Jobs Data</span>
            <span className={`text-xs font-medium px-2 py-0.5 rounded ${
              jobsFreshness.status === 'fresh' ? 'bg-green-200 text-green-800' :
              jobsFreshness.status === 'ok' ? 'bg-yellow-200 text-yellow-800' :
              'bg-red-200 text-red-800'
            }`}>
              {jobsFreshness.status === 'fresh' ? 'Fresh' :
               jobsFreshness.status === 'ok' ? 'Getting Stale' :
               jobsFreshness.status === 'stale' ? 'Stale' : 'Never Uploaded'}
            </span>
          </div>
          <div className="text-2xl font-bold text-gray-900">{stats?.totalJobs.toLocaleString() || 0}</div>
          <div className="text-sm text-gray-600">records</div>
          <div className="mt-2 text-xs text-gray-500">
            {stats?.lastJobsImport ? (
              <>Last upload: {getDaysAgo(stats.lastJobsImport.uploaded_at)}</>
            ) : (
              <>No data uploaded yet</>
            )}
          </div>
        </div>

        {/* Quotes */}
        <div className={`p-4 rounded-lg ${quotesFreshness.bg} border border-gray-200`}>
          <div className="flex items-center justify-between mb-2">
            <span className="font-medium text-gray-900">Quotes Data</span>
            <span className="text-xs font-medium px-2 py-0.5 rounded bg-gray-200 text-gray-600">
              Optional
            </span>
          </div>
          <div className="text-2xl font-bold text-gray-900">{stats?.totalQuotes.toLocaleString() || 0}</div>
          <div className="text-sm text-gray-600">records</div>
          <div className="mt-2 text-xs text-gray-500">
            {stats?.lastQuotesImport ? (
              <>Last upload: {getDaysAgo(stats.lastQuotesImport.uploaded_at)}</>
            ) : (
              <>Not required for most analytics</>
            )}
          </div>
        </div>

        {/* Invoices */}
        <div className={`p-4 rounded-lg ${invoicesFreshness.bg} border border-gray-200`}>
          <div className="flex items-center justify-between mb-2">
            <span className="font-medium text-gray-900">Invoices Data</span>
            <span className="text-xs font-medium px-2 py-0.5 rounded bg-gray-200 text-gray-600">
              Optional
            </span>
          </div>
          <div className="text-2xl font-bold text-gray-900">{stats?.totalInvoices.toLocaleString() || 0}</div>
          <div className="text-sm text-gray-600">records</div>
          <div className="mt-2 text-xs text-gray-500">
            {stats?.lastInvoicesImport ? (
              <>Last upload: {getDaysAgo(stats.lastInvoicesImport.uploaded_at)}</>
            ) : (
              <>Not required for most analytics</>
            )}
          </div>
        </div>
      </div>

      {/* Recommendation Banner */}
      <div className="mb-6 p-3 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="flex items-start gap-2">
          <FileText className="w-5 h-5 text-blue-600 mt-0.5" />
          <div>
            <div className="font-medium text-blue-900">Recommended: Upload Jobs report weekly</div>
            <div className="text-sm text-blue-700">
              The Jobs file contains 90% of the data needed for analytics. Quotes and Invoices are optional and add pipeline tracking features.
            </div>
          </div>
        </div>
      </div>

      {/* Import Log Table */}
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left font-semibold text-gray-700">Date</th>
              <th className="px-3 py-2 text-left font-semibold text-gray-700">Type</th>
              <th className="px-3 py-2 text-left font-semibold text-gray-700">File</th>
              <th className="px-3 py-2 text-center font-semibold text-gray-700">Status</th>
              <th className="px-3 py-2 text-right font-semibold text-gray-700">Records</th>
              <th className="px-3 py-2 text-left font-semibold text-gray-700">Data Range</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {(logs || []).map((log) => (
              <tr key={log.id} className="hover:bg-gray-50">
                <td className="px-3 py-2">
                  <div className="flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-gray-400" />
                    <span>{formatDate(log.uploaded_at)}</span>
                  </div>
                </td>
                <td className="px-3 py-2">
                  <span className={`px-2 py-0.5 text-xs font-medium rounded ${
                    log.report_type === 'jobs' ? 'bg-blue-100 text-blue-700' :
                    log.report_type === 'quotes' ? 'bg-purple-100 text-purple-700' :
                    'bg-orange-100 text-orange-700'
                  }`}>
                    {getReportTypeLabel(log.report_type)}
                  </span>
                </td>
                <td className="px-3 py-2 text-gray-600 truncate max-w-[200px]" title={log.file_name}>
                  {log.file_name}
                </td>
                <td className="px-3 py-2 text-center">
                  <div className="flex items-center justify-center gap-1">
                    {getStatusIcon(log.status)}
                    <span className={`text-xs ${
                      log.status === 'completed' ? 'text-green-600' :
                      log.status === 'failed' ? 'text-red-600' :
                      'text-blue-600'
                    }`}>
                      {log.status}
                    </span>
                  </div>
                </td>
                <td className="px-3 py-2 text-right">
                  <div>
                    <span className="font-medium">{log.total_rows.toLocaleString()}</span>
                    {log.updated_records > 0 && (
                      <span className="text-xs text-gray-500 ml-1">
                        ({log.updated_records} updated)
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-3 py-2 text-gray-600">
                  {log.data_start_date && log.data_end_date ? (
                    <span className="text-xs">
                      {formatShortDate(log.data_start_date)} - {formatShortDate(log.data_end_date)}
                    </span>
                  ) : '-'}
                </td>
              </tr>
            ))}

            {(!logs || logs.length === 0) && (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-gray-500">
                  No imports yet. Upload a Jobber CSV to get started.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Show More */}
      {logs && logs.length >= 10 && !showAll && (
        <div className="mt-3 text-center">
          <button
            onClick={() => setShowAll(true)}
            className="text-blue-600 hover:text-blue-800 text-sm font-medium"
          >
            Show more history...
          </button>
        </div>
      )}

      {/* Help text about merging */}
      <div className="mt-4 p-3 bg-gray-50 border border-gray-200 rounded-lg">
        <div className="flex items-start gap-2">
          <Clock className="w-4 h-4 text-gray-500 mt-0.5" />
          <div className="text-xs text-gray-600">
            <strong>Duplicate handling:</strong> The system automatically merges overlapping data.
            If you upload a file containing jobs you've already uploaded, they will be updated (not duplicated).
            Jobs are matched by Job #, Quotes by Quote #, Invoices by Invoice #.
          </div>
        </div>
      </div>
    </div>
  );
}
