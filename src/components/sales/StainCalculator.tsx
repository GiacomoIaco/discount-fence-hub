import React, { useState, useEffect } from 'react';
import { ArrowLeft, DollarSign, Clock, CheckCircle, X, ChevronLeft, ChevronRight, Upload } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

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

interface MediaItem {
  url: string;
  type: 'image' | 'video';
  caption?: string;
}

const StainCalculator: React.FC<StainCalculatorProps> = ({ onBack }) => {
  const { profile } = useAuth();
  const [fenceLength, setFenceLength] = useState<number>(100);
  const [fenceHeight, setFenceHeight] = useState<number>(6);
  const [showResults, setShowResults] = useState<boolean>(false);

  // Media gallery state
  const [mediaItems, setMediaItems] = useState<MediaItem[]>(() => {
    // Load from localStorage on mount
    const saved = localStorage.getItem('stainCalculatorMedia');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return [{ url: '/fence-comparison.jpg', type: 'image', caption: 'Left: Wood Defender stained | Right: Untreated after 2 years' }];
      }
    }
    return [{ url: '/fence-comparison.jpg', type: 'image', caption: 'Left: Wood Defender stained | Right: Untreated after 2 years' }];
  });
  const [showGallery, setShowGallery] = useState(false);
  const [currentMediaIndex, setCurrentMediaIndex] = useState(0);

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

  const handleMediaUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const url = event.target?.result as string;
        const type = file.type.startsWith('video') ? 'video' : 'image';
        setMediaItems(prev => [...prev, { url, type }]);
      };
      reader.readAsDataURL(file);
    });
  };

  const openGallery = (index: number) => {
    setCurrentMediaIndex(index);
    setShowGallery(true);
  };

  const nextMedia = () => {
    setCurrentMediaIndex((prev) => (prev + 1) % mediaItems.length);
  };

  const prevMedia = () => {
    setCurrentMediaIndex((prev) => (prev - 1 + mediaItems.length) % mediaItems.length);
  };

  // Save media items to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('stainCalculatorMedia', JSON.stringify(mediaItems));
  }, [mediaItems]);

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
        <div className="bg-gradient-to-r from-red-700 to-red-900 rounded-lg shadow-lg mb-6 p-6 md:p-8">
          <div className="text-center">
            <div className="flex items-center justify-center gap-4 mb-4">
              <img src="/wood-defender-logo.png" alt="Wood Defender" className="h-16 md:h-20 w-auto" />
            </div>
            <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">
              Premium Oil-Based Pre-Stain System
            </h1>
            <p className="text-2xl md:text-3xl text-yellow-300 font-bold mb-2">
              A Game Changer!
            </p>
            <p className="text-lg md:text-xl text-white/90">
              Skip the Hassle. Choose Pre-Stained!
            </p>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Left Column - Benefits & Media */}
          <div className="space-y-6">
            {/* Comparison Image Gallery */}
            <div className="bg-white rounded-lg shadow-lg p-6 border-l-4 border-red-600">
              <h2 className="text-2xl font-bold mb-4 text-gray-800">
                The Difference is Clear
              </h2>
              <div className="relative rounded-lg overflow-hidden cursor-pointer" onClick={() => openGallery(0)}>
                {mediaItems[0].type === 'image' ? (
                  <img
                    src={mediaItems[0].url}
                    alt="Fence comparison"
                    className="w-full h-auto object-cover hover:opacity-90 transition-opacity"
                  />
                ) : (
                  <video
                    src={mediaItems[0].url}
                    className="w-full h-auto object-cover"
                    controls
                  />
                )}
                {mediaItems.length > 1 && (
                  <div className="absolute top-2 right-2 bg-black/70 text-white px-2 py-1 rounded text-sm">
                    +{mediaItems.length - 1} more
                  </div>
                )}
              </div>
              {mediaItems[0].caption && (
                <p className="text-gray-600 mt-4 text-center font-semibold">
                  {mediaItems[0].caption}
                </p>
              )}

              {/* Upload button - Admin only */}
              {profile?.role === 'admin' && (
                <label className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-red-600 hover:bg-red-50 transition-colors">
                  <Upload className="w-5 h-5 text-gray-600" />
                  <span className="text-sm font-medium text-gray-700">Add Photos or Videos</span>
                  <input
                    type="file"
                    multiple
                    accept="image/*,video/*"
                    onChange={handleMediaUpload}
                    className="hidden"
                  />
                </label>
              )}
            </div>

            {/* Benefits */}
            <div className="bg-gradient-to-br from-red-600 to-red-800 text-white rounded-lg shadow-lg p-6">
              <h2 className="text-3xl font-bold text-center mb-6">
                Why Choose Pre-Stained Fence?
              </h2>

              <div className="space-y-4">
                {/* Benefits of Stained Fence First */}
                {[
                  {
                    title: 'Superior Aesthetics',
                    desc: 'Untreated fences turn grey and weathered in just 6 months. Our Wood Defender-stained fences maintain their beautiful, rich appearance for years.'
                  },
                  {
                    title: 'Longer Fence Life',
                    desc: 'Wood Defender penetrates deep into the wood, protecting against moisture, UV damage, and rot. Your fence will last significantly longer than untreated wood.'
                  },
                  {
                    title: 'Highest Quality Product on the Market',
                    desc: 'We use premium Wood Defender oil-based stain - the industry\'s leading protection system. Factory-applied for consistent, professional results.'
                  },
                  {
                    title: 'Extended 2-Year Warranty',
                    desc: 'Get a 2-year warranty instead of the standard 1-year. Our factory-applied stain is professionally applied for superior protection you can trust.'
                  },
                  {
                    title: 'No Mess, No Wait',
                    desc: 'Avoid the mess, smell, and inconvenience of having contractors work at your property. Your fence arrives pre-stained and ready to install immediately.'
                  },
                  {
                    title: '...And Cheaper Than DIY!',
                    desc: 'When you factor in materials, tools, time, and labor, our pre-stained option costs less than doing it yourself. Plus, you save your entire weekend!'
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
            </div>
          </div>

          {/* Right Column - Calculator (moved after benefits) */}
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
        </div>

        {/* Our Promise and CTA sections */}
        <div className="mt-6 space-y-6">
          {/* No profit message */}
          <div className="bg-yellow-400 text-gray-900 p-4 rounded-lg border-2 border-yellow-500">
            <p className="text-center font-semibold">
              <strong>Our Promise:</strong> We're not making money on staining. We want your fence to be the best fence on the street!
            </p>
          </div>

          {/* Ready for Best Fence CTA */}
          <div className="bg-white text-gray-800 p-6 rounded-lg text-center shadow-lg border-4 border-yellow-400">
            <p className="text-3xl font-bold mb-2 text-red-600">
              Ready for the Best Fence on Your Block?
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

        {/* Footer */}
        <div className="mt-6 bg-white rounded-lg shadow-lg p-6 text-center border-t-4 border-red-600">
          <div className="flex items-center justify-center gap-6 mb-4">
            <img src="/dfusa-logo.png" alt="Discount Fence USA" className="h-16 w-auto" />
            <div className="border-l-2 border-gray-300 h-16"></div>
            <img src="/wood-defender-logo.png" alt="Wood Defender" className="h-16 w-auto" />
          </div>
          <p className="text-gray-800 font-bold text-xl mb-2">
            Discount Fence USA - Professional Fence Installation
          </p>
          <p className="text-gray-600 mb-2">
            Powered by <strong>Wood Defender</strong> Premium Oil-Based Wood Stain & Sealer
          </p>
          <p className="text-sm text-gray-500">
            Calculator assumes double-sided staining. Actual costs may vary based on fence condition and specific requirements.
          </p>
        </div>
      </div>

      {/* Fullscreen Gallery Modal */}
      {showGallery && (
        <div className="fixed inset-0 bg-black z-50 flex items-center justify-center">
          <button
            onClick={() => setShowGallery(false)}
            className="absolute top-4 right-4 p-2 bg-white/20 hover:bg-white/30 rounded-full transition-colors z-10"
          >
            <X className="w-8 h-8 text-white" />
          </button>

          {mediaItems.length > 1 && (
            <>
              <button
                onClick={prevMedia}
                className="absolute left-4 p-3 bg-white/20 hover:bg-white/30 rounded-full transition-colors z-10"
              >
                <ChevronLeft className="w-8 h-8 text-white" />
              </button>
              <button
                onClick={nextMedia}
                className="absolute right-4 p-3 bg-white/20 hover:bg-white/30 rounded-full transition-colors z-10"
              >
                <ChevronRight className="w-8 h-8 text-white" />
              </button>
            </>
          )}

          <div className="max-w-7xl max-h-screen p-8 flex flex-col items-center justify-center">
            {mediaItems[currentMediaIndex].type === 'image' ? (
              <img
                src={mediaItems[currentMediaIndex].url}
                alt="Gallery"
                className="max-w-full max-h-[85vh] object-contain"
              />
            ) : (
              <video
                src={mediaItems[currentMediaIndex].url}
                className="max-w-full max-h-[85vh] object-contain"
                controls
                autoPlay
              />
            )}
            {mediaItems[currentMediaIndex].caption && (
              <p className="text-white text-center mt-4 text-lg">
                {mediaItems[currentMediaIndex].caption}
              </p>
            )}
            {mediaItems.length > 1 && (
              <p className="text-white/70 text-sm mt-2">
                {currentMediaIndex + 1} / {mediaItems.length}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default StainCalculator;
