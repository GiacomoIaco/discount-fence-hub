import { Download, Printer, RotateCcw } from 'lucide-react';
import type { CalculationResult } from '../types';

interface ResultsSectionProps {
  result: CalculationResult;
  onReset: () => void;
}

export function ResultsSection({ result, onReset }: ResultsSectionProps) {
  const handlePrint = () => {
    window.print();
  };

  const handleExportCSV = () => {
    // TODO: Implement CSV export
    alert('CSV export will be implemented');
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  return (
    <div className="space-y-6">
      {/* Summary Card */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg shadow-lg p-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <p className="text-blue-100 text-sm">Total Materials</p>
            <p className="text-2xl font-bold">{formatCurrency(result.totalMaterialCost)}</p>
          </div>
          <div>
            <p className="text-blue-100 text-sm">Total Labor</p>
            <p className="text-2xl font-bold">{formatCurrency(result.totalLaborCost)}</p>
          </div>
          <div>
            <p className="text-blue-100 text-sm">Total Project</p>
            <p className="text-2xl font-bold">{formatCurrency(result.totalProjectCost)}</p>
          </div>
          <div>
            <p className="text-blue-100 text-sm">Cost per LF</p>
            <p className="text-2xl font-bold">{formatCurrency(result.costPerLinearFoot)}</p>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-gray-900">Calculation Results</h2>
        <div className="flex space-x-3">
          <button
            onClick={handleExportCSV}
            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium flex items-center space-x-2 transition-colors"
          >
            <Download className="w-4 h-4" />
            <span>Export CSV</span>
          </button>
          <button
            onClick={handlePrint}
            className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg font-medium flex items-center space-x-2 transition-colors"
          >
            <Printer className="w-4 h-4" />
            <span>Print</span>
          </button>
          <button
            onClick={onReset}
            className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg font-medium flex items-center space-x-2 transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            <span>New Estimate</span>
          </button>
        </div>
      </div>

      {/* BOM Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-4">Bill of Materials (BOM)</h3>

        {result.bom.length === 0 ? (
          <p className="text-center py-8 text-gray-500">
            No materials calculated. This is expected with mock data.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-gray-300 bg-gray-50">
                  <th className="text-left py-2 px-3 font-semibold text-gray-700">Material Code</th>
                  <th className="text-left py-2 px-3 font-semibold text-gray-700">Description</th>
                  <th className="text-center py-2 px-3 font-semibold text-gray-700">Qty</th>
                  <th className="text-center py-2 px-3 font-semibold text-gray-700">Unit</th>
                  <th className="text-right py-2 px-3 font-semibold text-gray-700">Unit Cost</th>
                  <th className="text-right py-2 px-3 font-semibold text-gray-700">Extended</th>
                </tr>
              </thead>
              <tbody>
                {result.bom.map((item, index) => (
                  <tr key={index} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-2 px-3 text-gray-900 font-mono text-xs">{item.materialCode}</td>
                    <td className="py-2 px-3 text-gray-900">{item.description}</td>
                    <td className="py-2 px-3 text-center text-gray-900 font-semibold">{item.quantity}</td>
                    <td className="py-2 px-3 text-center text-gray-600">{item.unit}</td>
                    <td className="py-2 px-3 text-right text-gray-700">{formatCurrency(item.unitCost)}</td>
                    <td className="py-2 px-3 text-right text-gray-900 font-semibold">
                      {formatCurrency(item.extendedCost)}
                    </td>
                  </tr>
                ))}
                <tr className="border-t-2 border-gray-300 bg-blue-50">
                  <td colSpan={5} className="py-2 px-3 text-right font-bold text-gray-900">
                    Total Materials:
                  </td>
                  <td className="py-2 px-3 text-right font-bold text-blue-900">
                    {formatCurrency(result.totalMaterialCost)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* BOL Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-4">Bill of Labor (BOL)</h3>

        {result.bol.length === 0 ? (
          <p className="text-center py-8 text-gray-500">
            No labor calculated. This is expected with mock data.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-gray-300 bg-gray-50">
                  <th className="text-left py-2 px-3 font-semibold text-gray-700">Labor Code</th>
                  <th className="text-left py-2 px-3 font-semibold text-gray-700">Description</th>
                  <th className="text-center py-2 px-3 font-semibold text-gray-700">Qty</th>
                  <th className="text-center py-2 px-3 font-semibold text-gray-700">Unit</th>
                  <th className="text-right py-2 px-3 font-semibold text-gray-700">Rate</th>
                  <th className="text-right py-2 px-3 font-semibold text-gray-700">Extended</th>
                </tr>
              </thead>
              <tbody>
                {result.bol.map((item, index) => (
                  <tr key={index} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-2 px-3 text-gray-900 font-mono text-xs">{item.laborCode}</td>
                    <td className="py-2 px-3 text-gray-900">{item.description}</td>
                    <td className="py-2 px-3 text-center text-gray-900 font-semibold">{item.quantity}</td>
                    <td className="py-2 px-3 text-center text-gray-600">{item.unit}</td>
                    <td className="py-2 px-3 text-right text-gray-700">{formatCurrency(item.rate)}</td>
                    <td className="py-2 px-3 text-right text-gray-900 font-semibold">
                      {formatCurrency(item.extendedCost)}
                    </td>
                  </tr>
                ))}
                <tr className="border-t-2 border-gray-300 bg-blue-50">
                  <td colSpan={5} className="py-2 px-3 text-right font-bold text-gray-900">
                    Total Labor:
                  </td>
                  <td className="py-2 px-3 text-right font-bold text-blue-900">
                    {formatCurrency(result.totalLaborCost)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Project Info Footer */}
      <div className="text-center text-sm text-gray-600">
        <p>
          Calculated at {new Date(result.calculatedAt).toLocaleString()} | Total Length:{' '}
          {result.totalLinearFeet} LF
        </p>
        <p className="mt-1">
          Customer: {result.projectDetails.customerName}
          {result.projectDetails.projectName && ` | Project: ${result.projectDetails.projectName}`}
        </p>
      </div>
    </div>
  );
}
