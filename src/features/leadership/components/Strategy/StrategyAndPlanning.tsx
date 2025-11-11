import { useState, useEffect, useCallback, useRef } from 'react';
import { Sparkles, Check, Loader2 } from 'lucide-react';
import { useFunctionStrategyQuery, useSaveStrategy } from '../../hooks/useLeadershipQuery';
import StrategyComments from './StrategyComments';

interface StrategyAndPlanningProps {
  functionId: string;
}

type SaveStatus = 'saved' | 'saving' | 'unsaved' | 'error';

export default function StrategyAndPlanning({ functionId }: StrategyAndPlanningProps) {
  const { data: strategy, isLoading } = useFunctionStrategyQuery(functionId);
  const saveStrategy = useSaveStrategy();

  const [formData, setFormData] = useState({
    description: '',
    objectives: '',
    current_situation: '',
    challenges: '',
    opportunities: '',
    operating_plan: '',
  });

  const [isGenerating, setIsGenerating] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');
  const saveTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);

  // Load strategy data when it's fetched
  useEffect(() => {
    if (strategy) {
      setFormData({
        description: strategy.description || '',
        objectives: strategy.objectives || '',
        current_situation: strategy.current_situation || '',
        challenges: strategy.challenges || '',
        opportunities: strategy.opportunities || '',
        operating_plan: strategy.operating_plan || '',
      });
    }
  }, [strategy]);

  // Auto-save with debouncing
  const autoSave = useCallback(async (data: typeof formData) => {
    try {
      setSaveStatus('saving');
      await saveStrategy.mutateAsync({
        function_id: functionId,
        ...data,
      });
      setSaveStatus('saved');
    } catch (error) {
      console.error('Auto-save failed:', error);
      setSaveStatus('error');
    }
  }, [functionId, saveStrategy]);

  // Debounced auto-save effect
  useEffect(() => {
    // Don't auto-save on initial load
    if (!strategy && !formData.description && !formData.objectives) {
      return;
    }

    // Mark as unsaved
    setSaveStatus('unsaved');

    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Set new timeout for auto-save (1 second delay)
    saveTimeoutRef.current = setTimeout(() => {
      autoSave(formData);
    }, 1000);

    // Cleanup
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [formData, autoSave, strategy]);

  const completedSections = Object.values(formData).filter(Boolean).length;
  const totalSections = 6;
  const completionPercentage = Math.round((completedSections / totalSections) * 100);

  const handleGenerateDraft = async () => {
    setIsGenerating(true);
    // TODO: Implement AI generation via API
    setTimeout(() => {
      setFormData({
        ...formData,
        operating_plan: `Based on the information provided:\n\n**Strategic Priorities**\n\n1. [Priority 1]\n2. [Priority 2]\n3. [Priority 3]\n\n**Key Initiatives**\n\n• [Initiative 1]\n• [Initiative 2]\n• [Initiative 3]\n\n**Success Metrics**\n\n• [Metric 1]\n• [Metric 2]\n• [Metric 3]`,
      });
      setIsGenerating(false);
    }, 1500);
  };

  const updateField = (field: keyof typeof formData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  if (isLoading) {
    return (
      <div className="max-w-6xl mx-auto">
        <div className="text-center py-12 text-gray-500">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3 text-blue-600" />
          Loading strategy...
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-6 max-w-full">
      {/* Main Strategy Content */}
      <div className="flex-1 max-w-4xl">
        {/* Progress Indicator */}
        <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xl font-bold text-gray-900">Strategy Development</h2>
          <div className="flex items-center gap-4">
            {/* Save Status Indicator */}
            <div className="flex items-center gap-2 text-sm">
              {saveStatus === 'saved' && (
                <>
                  <Check className="w-4 h-4 text-green-600" />
                  <span className="text-green-600">Saved</span>
                </>
              )}
              {saveStatus === 'saving' && (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                  <span className="text-blue-600">Saving...</span>
                </>
              )}
              {saveStatus === 'unsaved' && (
                <span className="text-gray-500">Unsaved changes</span>
              )}
              {saveStatus === 'error' && (
                <span className="text-red-600">Save failed</span>
              )}
            </div>
            <div className="text-sm text-gray-600">
              {completedSections}/{totalSections} sections ({completionPercentage}%)
            </div>
          </div>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${completionPercentage}%` }}
          />
        </div>
      </div>

      <div className="space-y-6">
        {/* Section 1: Function Description */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <label className="block text-sm font-semibold text-gray-900 mb-2">
            Function Description
          </label>
          <p className="text-sm text-gray-600 mb-3">
            Provide a clear description of what this function does and its role in the organization.
          </p>
          <textarea
            value={formData.description}
            onChange={(e) => updateField('description', e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-sans"
            rows={4}
            placeholder="Example: The Operations function is responsible for managing day-to-day production activities, ensuring quality standards, and optimizing operational efficiency across all facilities..."
          />
        </div>

        {/* Section 2: Core Objectives/Responsibilities */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <label className="block text-sm font-semibold text-gray-900 mb-2">
            Core Objectives & Responsibilities
          </label>
          <p className="text-sm text-gray-600 mb-3">
            List the key objectives and areas of responsibility for this function.
          </p>
          <textarea
            value={formData.objectives}
            onChange={(e) => updateField('objectives', e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-sans"
            rows={6}
            placeholder="Example:&#10;• Maintain production efficiency above 85%&#10;• Ensure quality compliance across all products&#10;• Manage supply chain and vendor relationships&#10;• Drive continuous improvement initiatives"
          />
        </div>

        {/* Section 3: Current Situation */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <label className="block text-sm font-semibold text-gray-900 mb-2">
            Current Situation
          </label>
          <p className="text-sm text-gray-600 mb-3">
            Describe the current state of the function - what's working well and what needs attention.
          </p>
          <textarea
            value={formData.current_situation}
            onChange={(e) => updateField('current_situation', e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-sans"
            rows={6}
            placeholder="Example: Current production capacity is at 75%, with strong quality metrics (98% compliance). However, lead times have increased by 15% due to supply chain disruptions..."
          />
        </div>

        {/* Section 4: Key Challenges */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <label className="block text-sm font-semibold text-gray-900 mb-2">
            Key Challenges
          </label>
          <p className="text-sm text-gray-600 mb-3">
            Identify the main challenges and obstacles facing this function.
          </p>
          <textarea
            value={formData.challenges}
            onChange={(e) => updateField('challenges', e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-sans"
            rows={6}
            placeholder="Example:&#10;• Supply chain volatility affecting lead times&#10;• Aging equipment requiring increased maintenance&#10;• Skills gap in technical roles&#10;• Rising material costs impacting margins"
          />
        </div>

        {/* Section 5: Key Opportunities */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <label className="block text-sm font-semibold text-gray-900 mb-2">
            Key Opportunities
          </label>
          <p className="text-sm text-gray-600 mb-3">
            Highlight opportunities for improvement, growth, or innovation.
          </p>
          <textarea
            value={formData.opportunities}
            onChange={(e) => updateField('opportunities', e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-sans"
            rows={6}
            placeholder="Example:&#10;• Automation potential in assembly processes&#10;• New market segments showing strong demand&#10;• Strategic partnerships with key suppliers&#10;• Technology investments improving efficiency"
          />
        </div>

        {/* Section 6: Operating Plan */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-semibold text-gray-900">
              Operating Plan
            </label>
            <button
              onClick={handleGenerateDraft}
              disabled={isGenerating || completedSections < 5}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
              title={completedSections < 5 ? 'Complete at least 5 sections to generate a draft' : 'Generate AI draft based on your inputs'}
            >
              <Sparkles className="w-4 h-4" />
              {isGenerating ? 'Generating...' : 'Generate Draft'}
            </button>
          </div>
          <p className="text-sm text-gray-600 mb-3">
            Draft your operating plan based on the strategy above. Use the "Generate Draft" button for AI assistance.
          </p>
          <textarea
            value={formData.operating_plan}
            onChange={(e) => updateField('operating_plan', e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
            rows={12}
            placeholder="Your operating plan will appear here. Click 'Generate Draft' for AI assistance, then edit and refine as needed..."
          />
        </div>
      </div>
      </div>

      {/* Comments Sidebar */}
      <div className="w-96 flex-shrink-0">
        <div className="sticky top-4">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Comments & Feedback</h3>
          <div className="max-h-[calc(100vh-12rem)] overflow-y-auto">
            <StrategyComments functionId={functionId} />
          </div>
        </div>
      </div>
    </div>
  );
}
