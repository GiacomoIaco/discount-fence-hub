import { useState } from 'react';
import { ArrowLeft, Calculator } from 'lucide-react';
import type { ProjectDetails, LineItem, CalculationResult } from './types';
import { ProjectDetailsForm } from './components/ProjectDetailsForm';
import { LineItemsTable } from './components/LineItemsTable';
import { ResultsSection } from './components/ResultsSection';

interface BOMCalculatorProps {
  onBack: () => void;
  userRole: 'operations' | 'admin';
  userId?: string;
  userName?: string;
}

export function BOMCalculator({ onBack, userRole: _userRole, userId: _userId, userName: _userName }: BOMCalculatorProps) {
  // Project state
  const [projectDetails, setProjectDetails] = useState<ProjectDetails>({
    customerName: '',
    projectName: '',
    businessUnit: 'austin',
  });

  // Line items state
  const [lineItems, setLineItems] = useState<LineItem[]>([]);

  // Calculation results
  const [calculationResult, setCalculationResult] = useState<CalculationResult | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);

  // Handle calculate button click
  const handleCalculate = async () => {
    // Validate inputs
    if (!projectDetails.customerName.trim()) {
      alert('Please enter a customer name');
      return;
    }

    if (lineItems.length === 0) {
      alert('Please add at least one line item');
      return;
    }

    setIsCalculating(true);

    // TODO: Replace with actual calculation service
    // For now, simulate calculation delay
    setTimeout(() => {
      // Mock calculation result
      const mockResult: CalculationResult = {
        projectDetails,
        lineItems,
        bom: [],
        bol: [],
        totalMaterialCost: 0,
        totalLaborCost: 0,
        totalProjectCost: 0,
        costPerLinearFoot: 0,
        totalLinearFeet: lineItems.reduce((sum, item) => sum + item.length, 0),
        calculatedAt: new Date().toISOString(),
      };

      setCalculationResult(mockResult);
      setIsCalculating(false);
    }, 1000);
  };

  const handleReset = () => {
    setCalculationResult(null);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-20">
        <div className="p-4 flex items-center justify-between">
          <button
            onClick={onBack}
            className="text-blue-600 font-medium flex items-center space-x-2 hover:text-blue-700"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Back</span>
          </button>

          <div className="text-center flex-1">
            <h1 className="text-xl font-bold text-gray-900">BOM Calculator</h1>
            <p className="text-xs text-gray-600">Bill of Materials & Labor</p>
          </div>

          <div className="w-20"></div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto p-4 space-y-6">
        {/* Project Details Section */}
        <ProjectDetailsForm
          projectDetails={projectDetails}
          onChange={setProjectDetails}
          disabled={calculationResult !== null}
        />

        {/* Line Items Section */}
        <LineItemsTable
          lineItems={lineItems}
          onChange={setLineItems}
          disabled={calculationResult !== null}
        />

        {/* Calculate Button */}
        {!calculationResult && (
          <div className="flex justify-center py-6">
            <button
              onClick={handleCalculate}
              disabled={isCalculating || lineItems.length === 0}
              className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-8 py-4 rounded-lg font-bold text-lg shadow-lg hover:shadow-xl active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-3"
            >
              <Calculator className="w-6 h-6" />
              <span>{isCalculating ? 'Calculating...' : 'Calculate BOM/BOL'}</span>
            </button>
          </div>
        )}

        {/* Results Section */}
        {calculationResult && (
          <ResultsSection result={calculationResult} onReset={handleReset} />
        )}
      </div>
    </div>
  );
}
