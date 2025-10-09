import { BarChart, TrendingUp, Download } from 'lucide-react';
import type { AnalyticsData } from '../../hooks/useAnalytics';

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

  const getStageLabel = (stage: string) => {
    const labels: Record<string, string> = {
      new: 'New',
      pending: 'Pending',
      completed: 'Completed',
      archived: 'Archived'
    };
    return labels[stage] || stage;
  };

  const exportToCSV = () => {
    const headers = ['Type', 'Count', 'Percentage'];
    const rows = data.requestsByType.map(item => [
      getTypeLabel(item.type),
      item.count,
      `${item.percentage.toFixed(1)}%`
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

      {/* Request Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Requests by Type */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <BarChart className="w-5 h-5 text-blue-600" />
            <h3 className="text-lg font-semibold text-gray-900">Requests by Type</h3>
          </div>
          <div className="space-y-3">
            {data.requestsByType.map((item) => (
              <div key={item.type}>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="text-gray-600">{getTypeLabel(item.type)}</span>
                  <span className="font-medium text-gray-900">{item.count} ({item.percentage.toFixed(1)}%)</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all"
                    style={{ width: `${item.percentage}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Requests by Stage */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-5 h-5 text-green-600" />
            <h3 className="text-lg font-semibold text-gray-900">Requests by Stage</h3>
          </div>
          <div className="space-y-3">
            {data.requestsByStage.map((item) => (
              <div key={item.stage} className="flex items-center justify-between">
                <span className="text-gray-600">{getStageLabel(item.stage)}</span>
                <span className="font-semibold text-gray-900 text-lg">{item.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Detailed Stats Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Request Type Details</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Type</th>
                <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Count</th>
                <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Percentage</th>
              </tr>
            </thead>
            <tbody>
              {data.requestsByType.map((item) => (
                <tr key={item.type} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-3 px-4 text-gray-900">{getTypeLabel(item.type)}</td>
                  <td className="py-3 px-4 text-right text-gray-700 font-semibold">{item.count}</td>
                  <td className="py-3 px-4 text-right text-gray-700">{item.percentage.toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t-2 border-gray-300">
              <tr>
                <td className="py-3 px-4 font-bold text-gray-900">Total</td>
                <td className="py-3 px-4 text-right font-bold text-gray-900">
                  {data.requestsByType.reduce((sum, item) => sum + item.count, 0)}
                </td>
                <td className="py-3 px-4 text-right font-bold text-gray-900">100.0%</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
