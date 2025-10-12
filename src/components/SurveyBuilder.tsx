import { useState, useEffect } from 'react';
import { SurveyCreator, SurveyCreatorComponent } from 'survey-creator-react';
import type { ICreatorOptions } from 'survey-creator-core';
import 'survey-core/survey-core.min.css';
import 'survey-creator-core/survey-creator-core.min.css';

interface SurveyBuilderProps {
  initialJson?: any;
  onSave: (surveyJson: any) => void;
  onCancel: () => void;
}

/**
 * Survey Builder Component
 *
 * Uses Survey.js Creator to provide a professional visual survey builder
 * Supports 20+ question types including:
 * - Star ratings
 * - Multiple choice (single/multiple select)
 * - Dropdowns
 * - Text inputs (short/long)
 * - Number inputs
 * - Date/time pickers
 * - Matrix questions
 * - And much more!
 */
export default function SurveyBuilder({ initialJson, onSave, onCancel }: SurveyBuilderProps) {
  const [creator, setCreator] = useState<SurveyCreator | null>(null);

  useEffect(() => {
    const creatorOptions: ICreatorOptions = {
      showLogicTab: false, // Simplify UI - hide advanced features for now
      showTranslationTab: false,
      showJSONEditorTab: false,
      isAutoSave: false,
    };

    const newCreator = new SurveyCreator(creatorOptions);

    // Set initial survey JSON if provided
    if (initialJson) {
      newCreator.text = typeof initialJson === 'string'
        ? initialJson
        : JSON.stringify(initialJson);
    } else {
      // Default template with a sample question
      newCreator.text = JSON.stringify({
        elements: [
          {
            name: "question1",
            title: "How would you rate your experience?",
            type: "rating",
            rateMax: 5,
            rateMin: 1,
            required: true
          }
        ]
      });
    }

    setCreator(newCreator);
  }, []);

  const handleSave = () => {
    if (creator) {
      const surveyJson = JSON.parse(creator.text);
      onSave(surveyJson);
    }
  };

  if (!creator) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Survey Builder</h2>
          <p className="text-sm text-gray-600">Create your survey using the visual editor</p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors"
          >
            Save Survey
          </button>
        </div>
      </div>

      {/* Survey Creator */}
      <div className="flex-1 overflow-hidden">
        <SurveyCreatorComponent creator={creator} />
      </div>
    </div>
  );
}

// Legacy interface for backwards compatibility
// TODO: Remove after full migration
export interface SurveyQuestion {
  id: string;
  text: string;
  type: 'multiple_choice' | 'yes_no' | 'rating' | 'short_text' | 'long_text';
  options?: string[];
  allow_multiple?: boolean;
  required: boolean;
}
