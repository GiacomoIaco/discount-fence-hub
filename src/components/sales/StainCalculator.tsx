import React, { useState, useEffect } from 'react';
import { ArrowLeft, DollarSign, Clock, CheckCircle } from 'lucide-react';

interface StainCalculatorProps {
  onBack: () => void;
}

interface CalculationResults {
  totalSqft: number;
  gallonsNeeded: number;
  bucketsNeeded: number;
  stainCost: number;
  additionalMaterialCost: number;
  totalMaterialCost: number;
  laborTime: number;
  laborCost: number;
  totalCost: number;
  costPerLinearFoot: number;
  materialCostPerLinearFoot: number;
}

const StainCalculator: React.FC<StainCalculatorProps> = ({ onBack }) => {
  const [fenceLength, setFenceLength] = useState<number>(100);
  const [fenceHeight, setFenceHeight] = useState<number>(6);
  const [showResults, setShowResults] = useState<boolean>(false);

  // Advanced settings
  const [pricePerGallon, setPricePerGallon] = useState<number>(55);
  const [coveragePerGallon, setCoveragePerGallon] = useState<number>(125);
  const [wastePercentage, setWastePercentage] = useState<number>(10);
  const [laborRate, setLaborRate] = useState<number>(20);
  const [baseAdditionalCost, setBaseAdditionalCost] = useState<number>(60);
  const [additionalCostPer100ft, setAdditionalCostPer100ft] = useState<number>(25);
  const [setupTime, setSetupTime] = useState<number>(1.5);
  const [timePerHundredSqft, setTimePerHundredSqft] = useState<number>(1.5);

  const calculateCosts = (): CalculationResults => {
    const totalSqft = fenceLength * fenceHeight * 2;
    const effectiveCoverage = coveragePerGallon * (1 - wastePercentage / 100);
    const gallonsNeeded = totalSqft / effectiveCoverage;
    const bucketsNeeded = Math.ceil(gallonsNeeded / 5);
    const stainCost = gallonsNeeded * pricePerGallon;
    const additionalMaterialCost = baseAdditionalCost + (Math.floor(fenceLength / 100) * additionalCostPer100ft);
    const totalMaterialCost = stainCost + additionalMaterialCost;
    const laborTime = setupTime + (totalSqft / 100) * timePerHundredSqft;
    const laborCost = laborTime * laborRate;
    const totalCost = totalMaterialCost + laborCost;
    const costPerLinearFoot = totalCost / fenceLength;
    const materialCostPerLinearFoot = totalMaterialCost / fenceLength;

    return {
      totalSqft: Math.round(totalSqft),
      gallonsNeeded: Number(gallonsNeeded.toFixed(1)),
      bucketsNeeded,
      stainCost: Math.round(stainCost),
      additionalMaterialCost: Math.round(additionalMaterialCost),
      totalMaterialCost: Math.round(totalMaterialCost),
      laborTime: Number(laborTime.toFixed(1)),
      laborCost: Math.round(laborCost),
      totalCost: Math.round(totalCost),
      costPerLinearFoot: Number(costPerLinearFoot.toFixed(2)),
      materialCostPerLinearFoot: Number(materialCostPerLinearFoot.toFixed(2))
    };
  };

  useEffect(() => {
    if (showResults) {
      // Recalculate when values change
    }
  }, [fenceLength, fenceHeight, pricePerGallon, coveragePerGallon, wastePercentage, laborRate, baseAdditionalCost, additionalCostPer100ft, setupTime, timePerHundredSqft]);

  const results = showResults ? calculateCosts() : null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 p-4 pb-20">
      <button onClick={onBack} className="text-blue-600 font-medium mb-4 flex items-center gap-2">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-gray-800 to-gray-700 rounded-lg shadow-lg mb-6 p-6 md:p-8">
          <div className="text-center">
            <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">
              DIY Staining Cost Calculator
            </h1>
            <p className="text-lg text-red-400 font-semibold">
              See what you'll save with pre-stained fence!
            </p>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Left Column - Calculator */}
          <div className="bg-white rounded-lg shadow-lg p-6 border-l-4 border-gray-800">
            <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-2">
              <DollarSign className="w-6 h-6 text-gray-700" />
              Calculate DIY Staining Cost
            </h2>

            <div className="space-y-6">
              <div className="bg-gray-50 p-4 rounded-lg space-y-4 border border-gray-200">
                <h3 className="font-semibold text-gray-700 mb-3">Fence Dimensions</h3>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Fence Length (ft)
                  </label>
                  <input
                    type="number"
                    value={fenceLength}
                    onChange={(e) => setFenceLength(Number(e.target.value))}
                    min="1"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-800 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Fence Height
                  </label>
                  <div className="flex gap-4">
                    <button
                      onClick={() => setFenceHeight(6)}
                      className={`flex-1 py-3 px-4 rounded-lg font-medium transition-colors ${
                        fenceHeight === 6
                          ? 'bg-gray-800 text-white'
                          : 'bg-white border-2 border-gray-300 text-gray-700 hover:border-gray-800'
                      }`}
                    >
                      6 feet
                    </button>
                    <button
                      onClick={() => setFenceHeight(8)}
                      className={`flex-1 py-3 px-4 rounded-lg font-medium transition-colors ${
                        fenceHeight === 8
                          ? 'bg-gray-800 text-white'
                          : 'bg-white border-2 border-gray-300 text-gray-700 hover:border-gray-800'
                      }`}
                    >
                      8 feet
                    </button>
                  </div>
                </div>
              </div>

              {/* Advanced Settings */}
              <details className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                <summary className="font-semibold text-gray-700 cursor-pointer">
                  Advanced Settings (Click to Modify)
                </summary>
                <div className="mt-4 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Price per Gallon ($)
                      </label>
                      <input
                        type="number"
                        value={pricePerGallon}
                        onChange={(e) => setPricePerGallon(Number(e.target.value))}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-gray-800"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Coverage per Gallon (sqft)
                      </label>
                      <input
                        type="number"
                        value={coveragePerGallon}
                        onChange={(e) => setCoveragePerGallon(Number(e.target.value))}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-gray-800"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Waste Factor (%)
                      </label>
                      <input
                        type="number"
                        value={wastePercentage}
                        onChange={(e) => setWastePercentage(Number(e.target.value))}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-gray-800"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Labor Rate ($/hr)
                      </label>
                      <input
                        type="number"
                        value={laborRate}
                        onChange={(e) => setLaborRate(Number(e.target.value))}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-gray-800"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Base Additional Cost ($)
                      </label>
                      <input
                        type="number"
                        value={baseAdditionalCost}
                        onChange={(e) => setBaseAdditionalCost(Number(e.target.value))}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-gray-800"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Additional Cost per 100ft ($)
                      </label>
                      <input
                        type="number"
                        value={additionalCostPer100ft}
                        onChange={(e) => setAdditionalCostPer100ft(Number(e.target.value))}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-gray-800"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Setup Time (hrs)
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        value={setupTime}
                        onChange={(e) => setSetupTime(Number(e.target.value))}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-gray-800"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Time per 100sqft (hrs)
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        value={timePerHundredSqft}
                        onChange={(e) => setTimePerHundredSqft(Number(e.target.value))}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-gray-800"
                      />
                    </div>
                  </div>
                </div>
              </details>

              {!showResults && (
                <button
                  onClick={() => setShowResults(true)}
                  className="w-full bg-gradient-to-r from-gray-800 to-gray-700 text-white py-4 rounded-lg font-bold text-lg shadow-lg hover:shadow-xl transition-all"
                >
                  Calculate Costs
                </button>
              )}

              {/* Results */}
              {results && (
                <div className="bg-gradient-to-br from-gray-700 to-gray-900 text-white p-6 rounded-lg shadow-xl">
                  <h3 className="text-xl font-bold mb-4">DIY Cost Breakdown</h3>

                  <div className="space-y-3">
                    <div className="flex justify-between items-center pb-2 border-b border-white/30">
                      <span>Total Coverage Needed:</span>
                      <span className="font-semibold">{results.totalSqft.toLocaleString()} sqft</span>
                    </div>

                    <div className="flex justify-between items-center pb-2 border-b border-white/30">
                      <span>Wood Defender Required:</span>
                      <span className="font-semibold">{results.gallonsNeeded} gallons</span>
                    </div>

                    <div className="flex justify-between items-center pb-2 border-b border-white/30">
                      <span>5-Gallon Buckets Needed:</span>
                      <span className="font-semibold">{results.bucketsNeeded} buckets</span>
                    </div>

                    <div className="flex justify-between items-center pb-2 border-b border-white/30">
                      <span>Stain Cost:</span>
                      <span className="font-semibold">${results.stainCost.toLocaleString()}</span>
                    </div>

                    <div className="flex justify-between items-center pb-2 border-b border-white/30">
                      <span>Additional Materials:</span>
                      <span className="font-semibold">${results.additionalMaterialCost.toLocaleString()}</span>
                    </div>

                    <div className="bg-white/10 p-3 rounded-lg my-2">
                      <div className="flex justify-between items-center">
                        <span className="font-bold">Total Material Cost:</span>
                        <span className="text-xl font-bold">${results.totalMaterialCost.toLocaleString()}</span>
                      </div>
                    </div>

                    <div className="flex justify-between items-center pb-2 border-b border-white/30">
                      <span className="flex items-center gap-2">
                        <Clock className="w-4 h-4" />
                        Labor Time:
                      </span>
                      <span className="font-semibold">{results.laborTime} hours</span>
                    </div>

                    <div className="flex justify-between items-center pb-2 border-b border-white/30">
                      <span>Labor Cost:</span>
                      <span className="font-semibold">${results.laborCost.toLocaleString()}</span>
                    </div>

                    <div className="bg-red-600 p-4 rounded-lg mt-4 mb-2 shadow-lg">
                      <div className="flex flex-col sm:flex-row justify-between items-center gap-2">
                        <span className="flex items-center gap-2 text-lg md:text-xl font-bold text-white">
                          <DollarSign className="w-7 h-7" />
                          TOTAL DIY COST:
                        </span>
                        <span className="text-3xl md:text-4xl font-bold text-white">${results.totalCost.toLocaleString()}</span>
                      </div>
                    </div>

                    <div className="bg-gray-800 p-4 rounded-lg border-2 border-white/50">
                      <div className="flex flex-col sm:flex-row justify-between items-center gap-2">
                        <span className="font-bold text-base">Cost per Linear Foot:</span>
                        <span className="text-2xl font-bold text-yellow-400">${results.costPerLinearFoot}/ft</span>
                      </div>
                    </div>

                    <div className="bg-blue-600 p-3 rounded-lg mt-2">
                      <div className="flex flex-col sm:flex-row justify-between items-center gap-2">
                        <span className="font-semibold text-sm text-white">Materials Cost per Linear Foot:</span>
                        <span className="text-lg font-bold text-white">${results.materialCostPerLinearFoot}/ft</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right Column - Benefits */}
          <div className="space-y-6">
            {/* Comparison Image */}
            <div className="bg-white rounded-lg shadow-lg p-6 border-l-4 border-gray-800">
              <h2 className="text-2xl font-bold mb-4 text-gray-800">
                The Difference is Clear
              </h2>
              <div className="relative bg-gray-200 rounded-lg h-64 flex items-center justify-center">
                <p className="text-gray-500">Comparison image placeholder</p>
              </div>
              <p className="text-gray-600 mt-4 text-center font-semibold">
                Left: Wood Defender stained | Right: Untreated after 2 years
              </p>
            </div>

            {/* Benefits */}
            <div className="bg-gradient-to-br from-red-600 to-red-800 text-white rounded-lg shadow-lg p-6">
              <h2 className="text-3xl font-bold text-center mb-6">
                Pre-Stained Fence Benefits
              </h2>

              <div className="space-y-4">
                {[
                  {
                    title: 'Save Time & Money',
                    desc: 'No need to hire contractors or spend your weekend staining. Our pre-stained fences arrive ready to install, saving you the hassle and expense shown above.'
                  },
                  {
                    title: 'Extended 2-Year Warranty',
                    desc: 'Get a 2-year warranty instead of the standard 1-year. Our factory-applied Wood Defender stain is professionally applied for superior protection.'
                  },
                  {
                    title: 'Superior Aesthetics',
                    desc: 'Untreated fences turn grey and weathered in just 6 months. Our Wood Defender-stained fences maintain their beautiful appearance for years.'
                  },
                  {
                    title: 'No Mess at Your Home',
                    desc: 'Avoid the mess, smell, and inconvenience of having contractors work at your property. Your fence is stained in our facility and installed clean.'
                  },
                  {
                    title: 'Longer Fence Life',
                    desc: 'Wood Defender penetrates deep into the wood, protecting against moisture, UV damage, and rot. Your fence will last significantly longer.'
                  }
                ].map((benefit, idx) => (
                  <div key={idx} className="bg-white text-gray-800 p-5 rounded-lg flex items-start gap-3 shadow-md hover:shadow-lg transition-shadow">
                    <CheckCircle className="w-8 h-8 flex-shrink-0 mt-1 text-red-600" />
                    <div>
                      <h3 className="font-bold text-xl mb-2 text-red-700">{benefit.title}</h3>
                      <p className="text-gray-700">{benefit.desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="bg-white text-gray-800 p-6 rounded-lg mt-6 text-center shadow-lg border-4 border-yellow-400">
                <p className="text-3xl font-bold mb-2 text-red-600">
                  Skip the Hassle. Choose Pre-Stained!
                </p>
                <p className="text-xl mb-4 text-gray-700">
                  Contact Discount Fence USA today for a quote
                </p>
                <a
                  href="https://discountfenceusa.com/contact"
                  className="inline-block bg-red-600 text-white px-10 py-4 rounded-lg text-xl font-bold hover:bg-red-700 transition-colors shadow-lg hover:shadow-xl transform hover:scale-105"
                >
                  Get Your Quote
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 bg-white rounded-lg shadow-lg p-6 text-center border-t-4 border-gray-800">
          <p className="text-gray-800 font-bold text-xl mb-2">
            Discount Fence USA - Professional Fence Installation
          </p>
          <p className="text-gray-600 mb-2">
            Powered by <strong>Wood Defender</strong> Premium Wood Stain & Sealer
          </p>
          <p className="text-sm text-gray-500">
            Calculator assumes double-sided staining. Actual costs may vary based on fence condition and specific requirements.
          </p>
        </div>
      </div>
    </div>
  );
};

export default StainCalculator;
