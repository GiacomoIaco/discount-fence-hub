import { Model } from 'survey-core';
import { Survey } from 'survey-react-ui';
import 'survey-core/survey-core.min.css';
import { useCallback } from 'react';

interface SurveyRendererProps {
  surveyJson: any;
  onComplete: (results: any) => void;
  disabled?: boolean;
  initialData?: any;
}

/**
 * Survey Renderer Component
 *
 * Displays a Survey.js survey for users to complete
 * Handles all question types including stars, ratings, multiple choice, etc.
 */
export default function SurveyRenderer({
  surveyJson,
  onComplete,
  disabled = false,
  initialData
}: SurveyRendererProps) {
  // Create survey model
  const survey = new Model(surveyJson);

  // Apply initial data if provided (for viewing completed surveys)
  if (initialData) {
    survey.data = initialData;
  }

  // Set survey to read-only if disabled
  if (disabled) {
    survey.mode = 'display';
  }

  // Handle survey completion
  const handleComplete = useCallback((sender: Model) => {
    onComplete(sender.data);
  }, [onComplete]);

  survey.onComplete.add(handleComplete);

  return (
    <div className="survey-container">
      <Survey model={survey} />
    </div>
  );
}
