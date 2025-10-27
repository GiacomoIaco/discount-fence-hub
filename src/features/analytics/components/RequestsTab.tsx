import { BarChart, TrendingUp, Download, Clock, DollarSign, Users } from 'lucide-react';
import type { AnalyticsData } from '../../../hooks/useAnalytics';

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

  const exportToCSV = () => {
    const headers = ['Type', 'Created', 'Closed', 'Avg Close Time (hrs)', '% >24h', '% >48h'];
    const rows = data.requestMetricsByType.map(item => [
      getTypeLabel(item.type),
      item.created,
      item.closed,
      item.averageCloseTime.toFixed(1),
      item.percentOver24h.toFixed(1) + '%',
      item.percentOver48h.toFixed(1) + '%'
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
                <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Closed</th>
                <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Avg Close Time</th>
                <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">% &gt;24h</th>
                <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">% &gt;48h</th>
              </tr>
            </thead>
            <tbody>
              {data.requestMetricsByType.map((item) => (
                <tr key={item.type} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-3 px-4 text-gray-900">{getTypeLabel(item.type)}</td>
                  <td className="py-3 px-4 text-right text-gray-700 font-semibold">{item.created}</td>
                  <td className="py-3 px-4 text-right text-gray-700">{item.closed}</td>
                  <td className="py-3 px-4 text-right text-gray-700">
                    <div className="flex items-center justify-end gap-1">
                      <Clock className="w-4 h-4 text-gray-400" />
                      <span>{item.averageCloseTime.toFixed(1)}h</span>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <span className={`font-medium ${
                      item.percentOver24h < 20 ? 'text-green-600' :
                      item.percentOver24h < 50 ? 'text-yellow-600' :
                      'text-red-600'
                    }`}>
                      {item.percentOver24h.toFixed(1)}%
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <span className={`font-medium ${
                      item.percentOver48h < 10 ? 'text-green-600' :
                      item.percentOver48h < 30 ? 'text-yellow-600' :
                      'text-red-600'
                    }`}>
                      {item.percentOver48h.toFixed(1)}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Metrics by Assignee */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Users className="w-5 h-5 text-purple-600" />
          <h3 className="text-lg font-semibold text-gray-900">Metrics by Assignee</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Assignee</th>
                <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Created</th>
                <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Closed</th>
                <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Avg Close Time</th>
                <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">% &gt;24h</th>
                <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">% &gt;48h</th>
              </tr>
            </thead>
            <tbody>
              {data.requestMetricsByAssignee.map((item) => (
                <tr key={item.userId} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-3 px-4 text-gray-900">{item.userName}</td>
                  <td className="py-3 px-4 text-right text-gray-700 font-semibold">{item.created}</td>
                  <td className="py-3 px-4 text-right text-gray-700">{item.closed}</td>
                  <td className="py-3 px-4 text-right text-gray-700">
                    <div className="flex items-center justify-end gap-1">
                      <Clock className="w-4 h-4 text-gray-400" />
                      <span>{item.averageCloseTime.toFixed(1)}h</span>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <span className={`font-medium ${
                      item.percentOver24h < 20 ? 'text-green-600' :
                      item.percentOver24h < 50 ? 'text-yellow-600' :
                      'text-red-600'
                    }`}>
                      {item.percentOver24h.toFixed(1)}%
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <span className={`font-medium ${
                      item.percentOver48h < 10 ? 'text-green-600' :
                      item.percentOver48h < 30 ? 'text-yellow-600' :
                      'text-red-600'
                    }`}>
                      {item.percentOver48h.toFixed(1)}%
                    </span>
                  </td>
                </tr>
              ))}
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

        {/* Requests Created by Week */}
        <div className="mb-8">
          <h4 className="text-sm font-semibold text-gray-700 mb-4">Requests Created by Week</h4>
          <div className="flex items-end justify-between h-48 gap-2">
            {data.timeSeries.map((week, index) => {
              const maxValue = Math.max(...data.timeSeries.map(w => w.requestsCreated));
              const heightPercent = maxValue > 0 ? (week.requestsCreated / maxValue) * 100 : 0;

              return (
                <div key={index} className="flex-1 flex flex-col items-center">
                  <div className="w-full bg-blue-600 rounded-t hover:bg-blue-700 transition-colors relative group"
                       style={{ height: `${heightPercent}%`, minHeight: week.requestsCreated > 0 ? '4px' : '0' }}>
                    <div className="absolute bottom-full mb-2 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white text-xs py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                      {week.requestsCreated} requests
                    </div>
                  </div>
                  <div className="text-xs text-gray-500 mt-2 transform -rotate-45 origin-top-left">
                    {week.weekLabel.split('of ')[1]}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Average Close Time by Week */}
        <div className="mb-8">
          <h4 className="text-sm font-semibold text-gray-700 mb-4">Average Close Time by Week</h4>
          <div className="relative h-48">
            <svg className="w-full h-full" viewBox="0 0 1000 200">
              {/* Grid lines */}
              <line x1="0" y1="0" x2="1000" y2="0" stroke="#e5e7eb" strokeWidth="1" />
              <line x1="0" y1="50" x2="1000" y2="50" stroke="#e5e7eb" strokeWidth="1" />
              <line x1="0" y1="100" x2="1000" y2="100" stroke="#e5e7eb" strokeWidth="1" />
              <line x1="0" y1="150" x2="1000" y2="150" stroke="#e5e7eb" strokeWidth="1" />
              <line x1="0" y1="200" x2="1000" y2="200" stroke="#e5e7eb" strokeWidth="1" />

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

              {/* Data points */}
              {data.timeSeries.map((week, index) => {
                const x = (index / (data.timeSeries.length - 1)) * 1000;
                const maxTime = Math.max(...data.timeSeries.map(w => w.averageCloseTime), 48);
                const y = 200 - ((week.averageCloseTime / maxTime) * 200);
                return (
                  <circle
                    key={index}
                    cx={x}
                    cy={y}
                    r="5"
                    fill="#10b981"
                    className="cursor-pointer hover:r-8"
                  >
                    <title>{week.weekLabel}: {week.averageCloseTime.toFixed(1)}h</title>
                  </circle>
                );
              })}
            </svg>
          </div>
        </div>

        {/* SLA Breaches by Week */}
        <div>
          <h4 className="text-sm font-semibold text-gray-700 mb-4">% Requests &gt;24h by Week</h4>
          <div className="relative h-48">
            <svg className="w-full h-full" viewBox="0 0 1000 200">
              {/* Grid lines */}
              <line x1="0" y1="0" x2="1000" y2="0" stroke="#e5e7eb" strokeWidth="1" />
              <line x1="0" y1="50" x2="1000" y2="50" stroke="#e5e7eb" strokeWidth="1" />
              <line x1="0" y1="100" x2="1000" y2="100" stroke="#e5e7eb" strokeWidth="1" />
              <line x1="0" y1="150" x2="1000" y2="150" stroke="#e5e7eb" strokeWidth="1" />
              <line x1="0" y1="200" x2="1000" y2="200" stroke="#e5e7eb" strokeWidth="1" />

              {/* Line chart */}
              {data.timeSeries.length > 1 && (
                <polyline
                  points={data.timeSeries.map((week, index) => {
                    const x = (index / (data.timeSeries.length - 1)) * 1000;
                    const y = 200 - ((week.percentOver24h / 100) * 200);
                    return `${x},${y}`;
                  }).join(' ')}
                  fill="none"
                  stroke="#ef4444"
                  strokeWidth="3"
                />
              )}

              {/* Data points */}
              {data.timeSeries.map((week, index) => {
                const x = (index / (data.timeSeries.length - 1)) * 1000;
                const y = 200 - ((week.percentOver24h / 100) * 200);
                return (
                  <circle
                    key={index}
                    cx={x}
                    cy={y}
                    r="5"
                    fill="#ef4444"
                    className="cursor-pointer"
                  >
                    <title>{week.weekLabel}: {week.percentOver24h.toFixed(1)}%</title>
                  </circle>
                );
              })}
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}
