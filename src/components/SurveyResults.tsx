import { useState } from 'react';
import { Star, Download, ChevronDown, ChevronUp } from 'lucide-react';
import type { SurveyQuestion } from './SurveyBuilder';

interface SurveyResultsProps {
  questions: SurveyQuestion[];
  responses: Array<{
    user_id: string;
    user_name?: string;
    submitted_at: string;
    answers: Record<string, any>;
  }>;
  anonymousResponses?: boolean;
  onExport?: () => void;
}

export default function SurveyResults({
  questions,
  responses,
  anonymousResponses = false,
  onExport
}: SurveyResultsProps) {
  const [expandedQuestion, setExpandedQuestion] = useState<string | null>(questions[0]?.id || null);

  const totalResponses = responses.length;

  const calculateMultipleChoiceStats = (question: SurveyQuestion) => {
    const stats: Record<string, number> = {};

    question.options?.forEach(option => {
      stats[option] = 0;
    });

    responses.forEach(response => {
      const answer = response.answers[question.id];
      if (Array.isArray(answer)) {
        answer.forEach(option => {
          if (stats[option] !== undefined) stats[option]++;
        });
      } else if (answer && stats[answer] !== undefined) {
        stats[answer]++;
      }
    });

    return stats;
  };

  const calculateRatingStats = (question: SurveyQuestion) => {
    const ratings = responses
      .map(r => r.answers[question.id])
      .filter(r => r !== undefined && r !== null);

    if (ratings.length === 0) return { average: 0, distribution: {} };

    const sum = ratings.reduce((acc, r) => acc + r, 0);
    const average = sum / ratings.length;

    const distribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    ratings.forEach(rating => {
      distribution[rating] = (distribution[rating] || 0) + 1;
    });

    return { average, distribution };
  };

  const getTextResponses = (question: SurveyQuestion) => {
    return responses
      .map(r => ({
        user_name: r.user_name,
        answer: r.answers[question.id],
        submitted_at: r.submitted_at
      }))
      .filter(r => r.answer);
  };

  const renderQuestionResults = (question: SurveyQuestion) => {

    switch (question.type) {
      case 'multiple_choice':
      case 'yes_no': {
        const stats = calculateMultipleChoiceStats(question);
        const maxCount = Math.max(...Object.values(stats), 1);

        return (
          <div className="space-y-3">
            {Object.entries(stats).map(([option, count]) => {
              const percentage = totalResponses > 0 ? (count / totalResponses) * 100 : 0;
              const barWidth = maxCount > 0 ? (count / maxCount) * 100 : 0;

              return (
                <div key={option} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-700 font-medium">{option}</span>
                    <span className="text-gray-600">
                      {count} ({percentage.toFixed(0)}%)
                    </span>
                  </div>
                  <div className="h-8 bg-gray-100 rounded-lg overflow-hidden">
                    <div
                      className="h-full bg-purple-500 transition-all duration-500 flex items-center justify-end pr-3"
                      style={{ width: `${barWidth}%` }}
                    >
                      {barWidth > 15 && (
                        <span className="text-white text-sm font-medium">
                          {count}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        );
      }

      case 'rating': {
        const { average, distribution } = calculateRatingStats(question);

        return (
          <div className="space-y-4">
            <div className="flex items-center justify-center space-x-2 py-4">
              <div className="text-center">
                <div className="text-4xl font-bold text-purple-600">
                  {average.toFixed(1)}
                </div>
                <div className="flex items-center justify-center mt-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      className={`w-5 h-5 ${
                        star <= Math.round(average)
                          ? 'fill-yellow-400 text-yellow-400'
                          : 'text-gray-300'
                      }`}
                    />
                  ))}
                </div>
                <div className="text-sm text-gray-500 mt-1">
                  Average Rating ({Object.values(distribution).reduce((a, b) => a + b, 0)} responses)
                </div>
              </div>
            </div>

            <div className="space-y-2">
              {[5, 4, 3, 2, 1].map((rating) => {
                const count = distribution[rating] || 0;
                const percentage = totalResponses > 0 ? (count / totalResponses) * 100 : 0;
                const maxCount = Math.max(...Object.values(distribution), 1);
                const barWidth = maxCount > 0 ? (count / maxCount) * 100 : 0;

                return (
                  <div key={rating} className="flex items-center space-x-2">
                    <div className="flex items-center w-16">
                      <Star className="w-4 h-4 fill-yellow-400 text-yellow-400 mr-1" />
                      <span className="text-sm font-medium text-gray-700">{rating}</span>
                    </div>
                    <div className="flex-1 h-6 bg-gray-100 rounded overflow-hidden">
                      <div
                        className="h-full bg-yellow-400 transition-all duration-500"
                        style={{ width: `${barWidth}%` }}
                      />
                    </div>
                    <span className="text-sm text-gray-600 w-20 text-right">
                      {count} ({percentage.toFixed(0)}%)
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        );
      }

      case 'short_text':
      case 'long_text': {
        const textResponses = getTextResponses(question);

        return (
          <div className="space-y-3">
            <div className="text-sm text-gray-600 mb-3">
              {textResponses.length} response{textResponses.length !== 1 ? 's' : ''}
            </div>
            {textResponses.length === 0 ? (
              <p className="text-gray-400 italic">No responses yet</p>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {textResponses.map((response, idx) => (
                  <div
                    key={idx}
                    className="bg-gray-50 rounded-lg p-3 border border-gray-200"
                  >
                    <p className="text-gray-800">{response.answer}</p>
                    {!anonymousResponses && response.user_name && (
                      <div className="mt-2 text-xs text-gray-500">
                        — {response.user_name}
                      </div>
                    )}
                    <div className="mt-1 text-xs text-gray-400">
                      {new Date(response.submitted_at).toLocaleDateString()}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      }

      default:
        return null;
    }
  };

  if (questions.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        No survey questions available
      </div>
    );
  }

  if (totalResponses === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500 mb-2">No responses yet</p>
        <p className="text-sm text-gray-400">
          Results will appear here once users submit their answers
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary Header */}
      <div className="bg-purple-50 border-2 border-purple-200 rounded-xl p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-purple-900">
              Survey Results
            </h3>
            <p className="text-sm text-purple-700">
              {totalResponses} response{totalResponses !== 1 ? 's' : ''} collected
            </p>
          </div>
          {onExport && (
            <button
              onClick={onExport}
              className="flex items-center space-x-2 px-4 py-2 bg-white border-2 border-purple-300 text-purple-700 rounded-lg hover:bg-purple-100 transition-colors"
            >
              <Download className="w-4 h-4" />
              <span className="font-medium">Export CSV</span>
            </button>
          )}
        </div>
      </div>

      {/* Question Results */}
      {questions.map((question, index) => {
        const isExpanded = expandedQuestion === question.id;

        return (
          <div
            key={question.id}
            className="bg-white rounded-xl border-2 border-gray-200 overflow-hidden"
          >
            {/* Question Header */}
            <button
              onClick={() => setExpandedQuestion(isExpanded ? null : question.id)}
              className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition-colors text-left"
            >
              <div className="flex-1">
                <h4 className="text-base font-medium text-gray-900">
                  <span className="text-purple-600 mr-2">Q{index + 1}.</span>
                  {question.text}
                </h4>
                <p className="text-sm text-gray-500 mt-1">
                  {question.type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                </p>
              </div>
              {isExpanded ? (
                <ChevronUp className="w-5 h-5 text-gray-400 flex-shrink-0 ml-3" />
              ) : (
                <ChevronDown className="w-5 h-5 text-gray-400 flex-shrink-0 ml-3" />
              )}
            </button>

            {/* Results */}
            {isExpanded && (
              <div className="p-4 border-t border-gray-200 bg-gray-50">
                {renderQuestionResults(question)}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
