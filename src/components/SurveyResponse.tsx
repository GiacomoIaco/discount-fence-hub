import { useState, useEffect } from 'react';
import { Star, CheckSquare, Square } from 'lucide-react';
import type { SurveyQuestion } from './SimpleSurveyBuilder';

interface SurveyResponseProps {
  questions: SurveyQuestion[];
  existingResponses?: Record<string, any>;
  onSubmit: (responses: Record<string, any>) => void;
  isReadOnly?: boolean;
}

export default function SurveyResponse({
  questions,
  existingResponses = {},
  onSubmit,
  isReadOnly = false
}: SurveyResponseProps) {
  const [responses, setResponses] = useState<Record<string, any>>(existingResponses);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    setResponses(existingResponses);
  }, [existingResponses]);

  const handleResponse = (questionId: string, value: any) => {
    setResponses(prev => ({ ...prev, [questionId]: value }));
    if (errors[questionId]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[questionId];
        return newErrors;
      });
    }
  };

  const handleMultipleChoice = (questionId: string, option: string, allowMultiple: boolean) => {
    if (allowMultiple) {
      const current = responses[questionId] || [];
      const newValue = current.includes(option)
        ? current.filter((o: string) => o !== option)
        : [...current, option];
      handleResponse(questionId, newValue);
    } else {
      handleResponse(questionId, option);
    }
  };

  const validateResponses = () => {
    const newErrors: Record<string, string> = {};

    questions.forEach(question => {
      if (question.required) {
        const response = responses[question.id];

        if (response === undefined || response === null || response === '') {
          newErrors[question.id] = 'This question is required';
        } else if (Array.isArray(response) && response.length === 0) {
          newErrors[question.id] = 'Please select at least one option';
        }
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (validateResponses()) {
      onSubmit(responses);
    }
  };

  const renderQuestion = (question: SurveyQuestion) => {
    const hasError = !!errors[question.id];

    switch (question.type) {
      case 'multiple_choice':
        return (
          <div className="space-y-2">
            {question.options?.map((option: string) => {
              const isSelected = question.allow_multiple
                ? (responses[question.id] || []).includes(option)
                : responses[question.id] === option;

              return (
                <button
                  key={option}
                  type="button"
                  onClick={() => !isReadOnly && handleMultipleChoice(question.id, option, question.allow_multiple || false)}
                  disabled={isReadOnly}
                  className={`w-full flex items-center space-x-3 p-3 rounded-lg border-2 transition-all text-left ${
                    isSelected
                      ? 'border-purple-500 bg-purple-50'
                      : 'border-gray-200 hover:border-gray-300'
                  } ${isReadOnly ? 'cursor-default' : 'cursor-pointer'}`}
                >
                  {question.allow_multiple ? (
                    isSelected ? (
                      <CheckSquare className="w-5 h-5 text-purple-600 flex-shrink-0" />
                    ) : (
                      <Square className="w-5 h-5 text-gray-400 flex-shrink-0" />
                    )
                  ) : (
                    <div
                      className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                        isSelected ? 'border-purple-600' : 'border-gray-400'
                      }`}
                    >
                      {isSelected && (
                        <div className="w-3 h-3 rounded-full bg-purple-600" />
                      )}
                    </div>
                  )}
                  <span className={isSelected ? 'text-purple-900 font-medium' : 'text-gray-700'}>
                    {option}
                  </span>
                </button>
              );
            })}
          </div>
        );

      case 'yes_no':
        return (
          <div className="flex space-x-3">
            {['Yes', 'No'].map((option) => {
              const isSelected = responses[question.id] === option;
              return (
                <button
                  key={option}
                  type="button"
                  onClick={() => !isReadOnly && handleResponse(question.id, option)}
                  disabled={isReadOnly}
                  className={`flex-1 px-6 py-3 rounded-lg border-2 font-medium transition-all ${
                    isSelected
                      ? option === 'Yes'
                        ? 'border-green-500 bg-green-50 text-green-700'
                        : 'border-red-500 bg-red-50 text-red-700'
                      : 'border-gray-200 text-gray-700 hover:border-gray-300'
                  } ${isReadOnly ? 'cursor-default' : 'cursor-pointer'}`}
                >
                  {option}
                </button>
              );
            })}
          </div>
        );

      case 'rating':
        return (
          <div className="flex items-center space-x-2">
            {[1, 2, 3, 4, 5].map((rating) => {
              const isSelected = responses[question.id] >= rating;
              return (
                <button
                  key={rating}
                  type="button"
                  onClick={() => !isReadOnly && handleResponse(question.id, rating)}
                  disabled={isReadOnly}
                  className={`p-1 transition-all ${isReadOnly ? 'cursor-default' : 'cursor-pointer hover:scale-110'}`}
                >
                  <Star
                    className={`w-8 h-8 ${
                      isSelected
                        ? 'fill-yellow-400 text-yellow-400'
                        : 'text-gray-300'
                    }`}
                  />
                </button>
              );
            })}
            {responses[question.id] && (
              <span className="ml-2 text-sm font-medium text-gray-600">
                {responses[question.id]} / 5
              </span>
            )}
          </div>
        );

      case 'short_text':
        return (
          <input
            type="text"
            value={responses[question.id] || ''}
            onChange={(e) => handleResponse(question.id, e.target.value)}
            disabled={isReadOnly}
            placeholder="Enter your answer..."
            className={`w-full px-4 py-2 border-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 ${
              hasError ? 'border-red-500' : 'border-gray-200'
            } ${isReadOnly ? 'bg-gray-50 cursor-default' : ''}`}
          />
        );

      case 'long_text':
        return (
          <textarea
            value={responses[question.id] || ''}
            onChange={(e) => handleResponse(question.id, e.target.value)}
            disabled={isReadOnly}
            placeholder="Enter your answer..."
            rows={4}
            className={`w-full px-4 py-2 border-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none ${
              hasError ? 'border-red-500' : 'border-gray-200'
            } ${isReadOnly ? 'bg-gray-50 cursor-default' : ''}`}
          />
        );

      default:
        return null;
    }
  };

  if (questions.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        No questions available
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {questions.map((question, index) => (
        <div
          key={question.id}
          className={`bg-white rounded-xl p-4 border-2 ${
            errors[question.id] ? 'border-red-500' : 'border-gray-200'
          }`}
        >
          <div className="mb-3">
            <div className="flex items-start justify-between">
              <h3 className="text-lg font-medium text-gray-900">
                <span className="text-purple-600 mr-2">Q{index + 1}.</span>
                {question.text}
              </h3>
              {question.required && (
                <span className="ml-2 px-2 py-1 bg-red-100 text-red-700 text-xs font-semibold rounded flex-shrink-0">
                  Required
                </span>
              )}
            </div>
          </div>

          {renderQuestion(question)}

          {errors[question.id] && (
            <p className="mt-2 text-sm text-red-600">{errors[question.id]}</p>
          )}
        </div>
      ))}

      {!isReadOnly && (
        <div className="flex justify-end space-x-3 pt-4">
          <button
            type="button"
            onClick={handleSubmit}
            className="px-6 py-3 bg-purple-600 text-white font-medium rounded-lg hover:bg-purple-700 transition-colors"
          >
            Submit Survey
          </button>
        </div>
      )}

      {isReadOnly && existingResponses && Object.keys(existingResponses).length > 0 && (
        <div className="bg-green-50 border-2 border-green-200 rounded-lg p-4">
          <p className="text-green-700 font-medium">
            ✓ Survey completed
          </p>
        </div>
      )}
    </div>
  );
}
