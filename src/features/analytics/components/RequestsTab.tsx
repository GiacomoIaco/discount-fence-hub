import { BarChart, TrendingUp, Download, Clock, DollarSign, Users, FileText, CheckCircle, AlertCircle, Target, UserCheck } from 'lucide-react';
import type { AnalyticsData } from '../hooks/useAnalytics';

interface RequestsTabProps {
  data: AnalyticsData;
}

export function RequestsTab({ data }: RequestsTabProps) {
  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      pricing: 'Pricing',
      material: 'Material',
      warranty: 'Warranty',
      new_builder: 'New Builder',
      support: 'Support'
    };
    return labels[type] || type;
  };

  const formatHours = (hours: number) => {
    if (hours < 1) return `${Math.round(hours * 60)}m`;
    if (hours < 24) return `${hours.toFixed(1)}h`;
    return `${(hours / 24).toFixed(1)}d`;
  };

  const exportToCSV = () => {
    const headers = ['Type', 'Created', 'Active', 'Closed', 'Avg Close Time (hrs)', '% <24h', '% <48h'];
    const rows = data.requestMetricsByType.map(item => [
      getTypeLabel(item.type),
      item.created,
      item.active,
      item.closed,
      item.averageCloseTime.toFixed(1),
      item.percentUnder24h.toFixed(1) + '%',
      item.percentUnder48h.toFixed(1) + '%'
    ]);

    const csv = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `request-analytics-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Export Button */}
      <div className="flex justify-end">
        <button
          onClick={exportToCSV}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Download className="w-4 h-4" />
          <span>Export CSV</span>
        </button>
      </div>

      {/* Overall Request Stats */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center gap-2 mb-6">
          <FileText className="w-6 h-6 text-blue-600" />
          <h2 className="text-xl font-bold text-gray-900">Request Overview</h2>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="text-sm text-blue-600 mb-1">Total Requests</div>
            <div className="text-3xl font-bold text-blue-700">
              {data.overview.totalRequests}
            </div>
            <div className="text-xs text-blue-600 mt-1">In period</div>
          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="text-sm text-yellow-600 mb-1 flex items-center gap-1">
              <AlertCircle className="w-4 h-4" />
              Active
            </div>
            <div className="text-3xl font-bold text-yellow-700">
              {data.overview.activeRequests}
            </div>
            <div className="text-xs text-yellow-600 mt-1">New + Pending</div>
          </div>

          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="text-sm text-green-600 mb-1 flex items-center gap-1">
              <CheckCircle className="w-4 h-4" />
              Closed
            </div>
            <div className="text-3xl font-bold text-green-700">
              {data.overview.completedRequests}
            </div>
            <div className="text-xs text-green-600 mt-1">Completed</div>
          </div>

          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
            <div className="text-sm text-purple-600 mb-1 flex items-center gap-1">
              <Target className="w-4 h-4" />
              Completion Rate
            </div>
            <div className="text-3xl font-bold text-purple-700">
              {data.overview.completionRate.toFixed(0)}%
            </div>
            <div className="text-xs text-purple-600 mt-1">Closed / Total</div>
          </div>

          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
            <div className="text-sm text-orange-600 mb-1 flex items-center gap-1">
              <Clock className="w-4 h-4" />
              Avg Response
            </div>
            <div className="text-3xl font-bold text-orange-700">
              {formatHours(data.overview.averageResponseTime)}
            </div>
            <div className="text-xs text-orange-600 mt-1">To close</div>
          </div>

          <div className="bg-teal-50 border border-teal-200 rounded-lg p-4">
            <div className="text-sm text-teal-600 mb-1">SLA Compliance</div>
            <div className={`text-3xl font-bold ${
              data.overview.slaComplianceRate >= 80 ? 'text-teal-700' :
              data.overview.slaComplianceRate >= 60 ? 'text-yellow-700' :
              'text-red-700'
            }`}>
              {data.overview.slaComplianceRate.toFixed(0)}%
            </div>
            <div className="text-xs text-teal-600 mt-1">On track</div>
          </div>
        </div>
      </div>

      {/* Pricing Request Analytics */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center gap-2 mb-6">
          <DollarSign className="w-6 h-6 text-green-600" />
          <h2 className="text-xl font-bold text-gray-900">Pricing Request Analytics</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="text-sm text-green-600 mb-1">Win Rate</div>
            <div className="text-3xl font-bold text-green-700">
              {data.pricingAnalytics.winRate.toFixed(1)}%
            </div>
            <div className="text-xs text-green-600 mt-1">
              {data.pricingAnalytics.wonRequests} won / {data.pricingAnalytics.wonRequests + data.pricingAnalytics.lostRequests} total
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="text-sm text-blue-600 mb-1">Total Quote Value</div>
            <div className="text-3xl font-bold text-blue-700">
              ${data.pricingAnalytics.totalQuoteValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </div>
            <div className="text-xs text-blue-600 mt-1">
              Based on {data.pricingAnalytics.totalPricingRequests} requests
            </div>
          </div>

          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
            <div className="text-sm text-purple-600 mb-1">Total Value Won</div>
            <div className="text-3xl font-bold text-purple-700">
              ${data.pricingAnalytics.totalValueWon.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </div>
            <div className="text-xs text-purple-600 mt-1">
              From {data.pricingAnalytics.wonRequests} won requests
            </div>
          </div>

          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
            <div className="text-sm text-orange-600 mb-1">Avg Quote Value</div>
            <div className="text-3xl font-bold text-orange-700">
              ${data.pricingAnalytics.averageQuoteValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </div>
            <div className="text-xs text-orange-600 mt-1">
              Per pricing request
            </div>
          </div>
        </div>
      </div>

      {/* Metrics by Request Type */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <BarChart className="w-5 h-5 text-blue-600" />
          <h3 className="text-lg font-semibold text-gray-900">Metrics by Request Type</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Type</th>
                <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Created</th>
                <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Active</th>
                <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Closed</th>
                <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Avg Close Time</th>
                <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">% &lt;24h</th>
                <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">% &lt;48h</th>
              </tr>
            </thead>
            <tbody>
              {data.requestMetricsByType.map((item) => (
                <tr key={item.type} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-3 px-4 text-gray-900 font-medium">{getTypeLabel(item.type)}</td>
                  <td className="py-3 px-4 text-right text-gray-700">{item.created}</td>
                  <td className="py-3 px-4 text-right">
                    <span className={`font-medium ${item.active > 0 ? 'text-yellow-600' : 'text-gray-500'}`}>
                      {item.active}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right text-gray-700">{item.closed}</td>
                  <td className="py-3 px-4 text-right text-gray-700">
                    <div className="flex items-center justify-end gap-1">
                      <Clock className="w-4 h-4 text-gray-400" />
                      <span>{formatHours(item.averageCloseTime)}</span>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <span className={`font-medium ${
                      item.percentUnder24h >= 80 ? 'text-green-600' :
                      item.percentUnder24h >= 50 ? 'text-yellow-600' :
                      'text-red-600'
                    }`}>
                      {item.percentUnder24h.toFixed(0)}%
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <span className={`font-medium ${
                      item.percentUnder48h >= 90 ? 'text-green-600' :
                      item.percentUnder48h >= 70 ? 'text-yellow-600' :
                      'text-red-600'
                    }`}>
                      {item.percentUnder48h.toFixed(0)}%
                    </span>
                  </td>
                </tr>
              ))}
              {/* Totals Row */}
              <tr className="bg-gray-50 font-semibold">
                <td className="py-3 px-4 text-gray-900">Total</td>
                <td className="py-3 px-4 text-right text-gray-900">
                  {data.requestMetricsByType.reduce((sum, item) => sum + item.created, 0)}
                </td>
                <td className="py-3 px-4 text-right text-yellow-600">
                  {data.requestMetricsByType.reduce((sum, item) => sum + item.active, 0)}
                </td>
                <td className="py-3 px-4 text-right text-gray-900">
                  {data.requestMetricsByType.reduce((sum, item) => sum + item.closed, 0)}
                </td>
                <td className="py-3 px-4 text-right text-gray-700">
                  {formatHours(data.overview.averageResponseTime)}
                </td>
                <td className="py-3 px-4 text-right text-gray-500">-</td>
                <td className="py-3 px-4 text-right text-gray-500">-</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Metrics by Assignee */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <UserCheck className="w-5 h-5 text-purple-600" />
          <h3 className="text-lg font-semibold text-gray-900">Metrics by Assignee</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Assignee</th>
                <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Assigned</th>
                <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Active</th>
                <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Closed</th>
                <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Avg Close Time</th>
                <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">% &lt;24h</th>
                <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">% &lt;48h</th>
              </tr>
            </thead>
            <tbody>
              {data.requestMetricsByAssignee.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-gray-500">
                    No assigned requests in this period
                  </td>
                </tr>
              ) : (
                data.requestMetricsByAssignee.map((item) => (
                  <tr key={item.userId} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4 text-gray-900 font-medium">{item.userName}</td>
                    <td className="py-3 px-4 text-right text-gray-700">{item.created}</td>
                    <td className="py-3 px-4 text-right">
                      <span className={`font-medium ${item.active > 0 ? 'text-yellow-600' : 'text-gray-500'}`}>
                        {item.active}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right text-gray-700">{item.closed}</td>
                    <td className="py-3 px-4 text-right text-gray-700">
                      <div className="flex items-center justify-end gap-1">
                        <Clock className="w-4 h-4 text-gray-400" />
                        <span>{formatHours(item.averageCloseTime)}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span className={`font-medium ${
                        item.percentUnder24h >= 80 ? 'text-green-600' :
                        item.percentUnder24h >= 50 ? 'text-yellow-600' :
                        'text-red-600'
                      }`}>
                        {item.percentUnder24h.toFixed(0)}%
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span className={`font-medium ${
                        item.percentUnder48h >= 90 ? 'text-green-600' :
                        item.percentUnder48h >= 70 ? 'text-yellow-600' :
                        'text-red-600'
                      }`}>
                        {item.percentUnder48h.toFixed(0)}%
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Metrics by Submitter */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Users className="w-5 h-5 text-orange-600" />
          <h3 className="text-lg font-semibold text-gray-900">Metrics by Submitter</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Submitter</th>
                <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Submitted</th>
                <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Active</th>
                <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Closed</th>
                <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Avg Close Time</th>
                <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">% &lt;24h</th>
                <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">% &lt;48h</th>
              </tr>
            </thead>
            <tbody>
              {data.requestMetricsBySubmitter.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-gray-500">
                    No submitted requests in this period
                  </td>
                </tr>
              ) : (
                data.requestMetricsBySubmitter.map((item) => (
                  <tr key={item.userId} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4 text-gray-900 font-medium">{item.userName}</td>
                    <td className="py-3 px-4 text-right text-gray-700">{item.created}</td>
                    <td className="py-3 px-4 text-right">
                      <span className={`font-medium ${item.active > 0 ? 'text-yellow-600' : 'text-gray-500'}`}>
                        {item.active}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right text-gray-700">{item.closed}</td>
                    <td className="py-3 px-4 text-right text-gray-700">
                      <div className="flex items-center justify-end gap-1">
                        <Clock className="w-4 h-4 text-gray-400" />
                        <span>{formatHours(item.averageCloseTime)}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span className={`font-medium ${
                        item.percentUnder24h >= 80 ? 'text-green-600' :
                        item.percentUnder24h >= 50 ? 'text-yellow-600' :
                        'text-red-600'
                      }`}>
                        {item.percentUnder24h.toFixed(0)}%
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span className={`font-medium ${
                        item.percentUnder48h >= 90 ? 'text-green-600' :
                        item.percentUnder48h >= 70 ? 'text-yellow-600' :
                        'text-red-600'
                      }`}>
                        {item.percentUnder48h.toFixed(0)}%
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Time Series Charts */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center gap-2 mb-6">
          <TrendingUp className="w-5 h-5 text-green-600" />
          <h3 className="text-lg font-semibold text-gray-900">Trends (Last 12 Weeks)</h3>
        </div>

        {/* Requests Created by Week - Bar Chart with Labels */}
        <div className="mb-8">
          <h4 className="text-sm font-semibold text-gray-700 mb-4">Requests Created by Week</h4>
          <div className="flex items-end justify-between h-56 gap-1 px-2">
            {data.timeSeries.map((week, index) => {
              const maxValue = Math.max(...data.timeSeries.map(w => w.requestsCreated), 1);
              const heightPercent = (week.requestsCreated / maxValue) * 100;

              return (
                <div key={index} className="flex-1 flex flex-col items-center">
                  {/* Value label on top */}
                  <div className="text-xs font-semibold text-gray-700 mb-1">
                    {week.requestsCreated > 0 ? week.requestsCreated : ''}
                  </div>
                  {/* Bar */}
                  <div
                    className="w-full bg-blue-500 rounded-t hover:bg-blue-600 transition-colors cursor-pointer"
                    style={{ height: `${Math.max(heightPercent, week.requestsCreated > 0 ? 5 : 0)}%`, minHeight: week.requestsCreated > 0 ? '4px' : '0' }}
                    title={`${week.weekLabel}: ${week.requestsCreated} requests`}
                  />
                  {/* Date label */}
                  <div className="text-[10px] text-gray-500 mt-2 text-center leading-tight">
                    {week.weekLabel.split('of ')[1]}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Average Close Time by Week - Line Chart with Labels */}
        <div className="mb-8">
          <h4 className="text-sm font-semibold text-gray-700 mb-4">Average Close Time by Week (hours)</h4>
          <div className="relative h-48">
            {/* Y-axis labels */}
            <div className="absolute left-0 top-0 bottom-0 w-12 flex flex-col justify-between text-xs text-gray-500">
              <span>{Math.max(...data.timeSeries.map(w => w.averageCloseTime), 48).toFixed(0)}h</span>
              <span>{(Math.max(...data.timeSeries.map(w => w.averageCloseTime), 48) / 2).toFixed(0)}h</span>
              <span>0h</span>
            </div>

            <div className="ml-14">
              <svg className="w-full h-full" viewBox="0 0 1000 200" preserveAspectRatio="none">
                {/* Grid lines */}
                <line x1="0" y1="0" x2="1000" y2="0" stroke="#e5e7eb" strokeWidth="1" />
                <line x1="0" y1="50" x2="1000" y2="50" stroke="#e5e7eb" strokeWidth="1" strokeDasharray="4" />
                <line x1="0" y1="100" x2="1000" y2="100" stroke="#e5e7eb" strokeWidth="1" strokeDasharray="4" />
                <line x1="0" y1="150" x2="1000" y2="150" stroke="#e5e7eb" strokeWidth="1" strokeDasharray="4" />
                <line x1="0" y1="200" x2="1000" y2="200" stroke="#e5e7eb" strokeWidth="1" />

                {/* Area fill */}
                {data.timeSeries.length > 1 && (
                  <polygon
                    points={[
                      '0,200',
                      ...data.timeSeries.map((week, index) => {
                        const x = (index / (data.timeSeries.length - 1)) * 1000;
                        const maxTime = Math.max(...data.timeSeries.map(w => w.averageCloseTime), 48);
                        const y = 200 - ((week.averageCloseTime / maxTime) * 200);
                        return `${x},${y}`;
                      }),
                      '1000,200'
                    ].join(' ')}
                    fill="url(#greenGradient)"
                    opacity="0.3"
                  />
                )}

                {/* Gradient definition */}
                <defs>
                  <linearGradient id="greenGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#10b981" />
                    <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
                  </linearGradient>
                </defs>

                {/* Line chart */}
                {data.timeSeries.length > 1 && (
                  <polyline
                    points={data.timeSeries.map((week, index) => {
                      const x = (index / (data.timeSeries.length - 1)) * 1000;
                      const maxTime = Math.max(...data.timeSeries.map(w => w.averageCloseTime), 48);
                      const y = 200 - ((week.averageCloseTime / maxTime) * 200);
                      return `${x},${y}`;
                    }).join(' ')}
                    fill="none"
                    stroke="#10b981"
                    strokeWidth="3"
                  />
                )}

                {/* Data points with labels */}
                {data.timeSeries.map((week, index) => {
                  const x = data.timeSeries.length > 1 ? (index / (data.timeSeries.length - 1)) * 1000 : 500;
                  const maxTime = Math.max(...data.timeSeries.map(w => w.averageCloseTime), 48);
                  const y = 200 - ((week.averageCloseTime / maxTime) * 200);
                  return (
                    <g key={index}>
                      <circle cx={x} cy={y} r="6" fill="#10b981" stroke="white" strokeWidth="2" />
                      {week.averageCloseTime > 0 && (
                        <text
                          x={x}
                          y={y - 12}
                          textAnchor="middle"
                          className="text-[11px] font-semibold"
                          fill="#374151"
                        >
                          {week.averageCloseTime.toFixed(1)}h
                        </text>
                      )}
                    </g>
                  );
                })}
              </svg>
            </div>
          </div>
        </div>

        {/* SLA Compliance by Week - Line Chart with Labels */}
        <div>
          <h4 className="text-sm font-semibold text-gray-700 mb-4">SLA Compliance (% Resolved &lt;24h)</h4>
          <div className="relative h-48">
            {/* Y-axis labels */}
            <div className="absolute left-0 top-0 bottom-0 w-12 flex flex-col justify-between text-xs text-gray-500">
              <span>100%</span>
              <span>50%</span>
              <span>0%</span>
            </div>

            <div className="ml-14">
              <svg className="w-full h-full" viewBox="0 0 1000 200" preserveAspectRatio="none">
                {/* Target line at 80% */}
                <line x1="0" y1="40" x2="1000" y2="40" stroke="#f59e0b" strokeWidth="2" strokeDasharray="8" />
                <text x="10" y="35" fill="#f59e0b" fontSize="10">Target: 80%</text>

                {/* Grid lines */}
                <line x1="0" y1="0" x2="1000" y2="0" stroke="#e5e7eb" strokeWidth="1" />
                <line x1="0" y1="100" x2="1000" y2="100" stroke="#e5e7eb" strokeWidth="1" strokeDasharray="4" />
                <line x1="0" y1="200" x2="1000" y2="200" stroke="#e5e7eb" strokeWidth="1" />

                {/* Area fill */}
                {data.timeSeries.length > 1 && (
                  <polygon
                    points={[
                      '0,200',
                      ...data.timeSeries.map((week, index) => {
                        const x = (index / (data.timeSeries.length - 1)) * 1000;
                        const y = 200 - ((week.percentUnder24h / 100) * 200);
                        return `${x},${y}`;
                      }),
                      '1000,200'
                    ].join(' ')}
                    fill="url(#blueGradient)"
                    opacity="0.3"
                  />
                )}

                <defs>
                  <linearGradient id="blueGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#3b82f6" />
                    <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
                  </linearGradient>
                </defs>

                {/* Line chart */}
                {data.timeSeries.length > 1 && (
                  <polyline
                    points={data.timeSeries.map((week, index) => {
                      const x = (index / (data.timeSeries.length - 1)) * 1000;
                      const y = 200 - ((week.percentUnder24h / 100) * 200);
                      return `${x},${y}`;
                    }).join(' ')}
                    fill="none"
                    stroke="#3b82f6"
                    strokeWidth="3"
                  />
                )}

                {/* Data points with labels */}
                {data.timeSeries.map((week, index) => {
                  const x = data.timeSeries.length > 1 ? (index / (data.timeSeries.length - 1)) * 1000 : 500;
                  const y = 200 - ((week.percentUnder24h / 100) * 200);
                  return (
                    <g key={index}>
                      <circle
                        cx={x}
                        cy={y}
                        r="6"
                        fill={week.percentUnder24h >= 80 ? '#10b981' : week.percentUnder24h >= 50 ? '#f59e0b' : '#ef4444'}
                        stroke="white"
                        strokeWidth="2"
                      />
                      <text
                        x={x}
                        y={y - 12}
                        textAnchor="middle"
                        className="text-[11px] font-semibold"
                        fill="#374151"
                      >
                        {week.percentUnder24h.toFixed(0)}%
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Additional Ideas Section */}
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-3">Performance Insights</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          {/* Best Performer */}
          {data.requestMetricsByAssignee.length > 0 && (
            <div className="bg-white rounded-lg p-4 shadow-sm">
              <div className="text-gray-600 mb-1">Fastest Response</div>
              <div className="font-semibold text-green-700">
                {data.requestMetricsByAssignee.reduce((best, current) =>
                  current.closed > 0 && (best.closed === 0 || current.averageCloseTime < best.averageCloseTime)
                    ? current : best
                ).userName}
              </div>
              <div className="text-xs text-gray-500">
                Avg {formatHours(Math.min(...data.requestMetricsByAssignee.filter(a => a.closed > 0).map(a => a.averageCloseTime)))}
              </div>
            </div>
          )}

          {/* Most Active Type */}
          {data.requestMetricsByType.length > 0 && (
            <div className="bg-white rounded-lg p-4 shadow-sm">
              <div className="text-gray-600 mb-1">Most Active Type</div>
              <div className="font-semibold text-blue-700">
                {getTypeLabel(data.requestMetricsByType.reduce((max, current) =>
                  current.active > max.active ? current : max
                ).type)}
              </div>
              <div className="text-xs text-gray-500">
                {Math.max(...data.requestMetricsByType.map(t => t.active))} active requests
              </div>
            </div>
          )}

          {/* Needs Attention */}
          {data.requestMetricsByAssignee.some(a => a.active > 3) && (
            <div className="bg-white rounded-lg p-4 shadow-sm border-l-4 border-yellow-500">
              <div className="text-gray-600 mb-1">Needs Attention</div>
              <div className="font-semibold text-yellow-700">
                {data.requestMetricsByAssignee.filter(a => a.active > 3).length} assignee(s)
              </div>
              <div className="text-xs text-gray-500">
                Have more than 3 active requests
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
