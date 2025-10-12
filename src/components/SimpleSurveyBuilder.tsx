import { useState } from 'react';
import { Trash2, GripVertical, Star, CheckSquare, Type, ToggleLeft } from 'lucide-react';

interface SurveyBuilderProps {
  initialJson?: any;
  onSave: (surveyJson: any) => void;
  onCancel: () => void;
}

interface QuestionConfig {
  id: string;
  name: string;
  title: string;
  type: 'rating' | 'radiogroup' | 'checkbox' | 'text' | 'comment' | 'boolean';
  required: boolean;
  // Rating specific
  rateMin?: number;
  rateMax?: number;
  // Multiple choice specific
  choices?: string[];
}

export default function SimpleSurveyBuilder({ initialJson, onSave, onCancel }: SurveyBuilderProps) {
  const [questions, setQuestions] = useState<QuestionConfig[]>(() => {
    if (initialJson?.elements) {
      return initialJson.elements.map((el: any, idx: number) => ({
        id: `q${idx + 1}`,
        name: el.name || `question${idx + 1}`,
        title: el.title || '',
        type: el.type || 'text',
        required: el.isRequired || false,
        rateMin: el.rateMin,
        rateMax: el.rateMax,
        choices: el.choices || []
      }));
    }
    return [];
  });

  const addQuestion = (type: QuestionConfig['type']) => {
    const newQuestion: QuestionConfig = {
      id: `q${Date.now()}`,
      name: `question${questions.length + 1}`,
      title: '',
      type,
      required: false,
      ...(type === 'rating' && { rateMin: 1, rateMax: 5 }),
      ...((['radiogroup', 'checkbox'].includes(type)) && { choices: ['Option 1', 'Option 2'] })
    };
    setQuestions([...questions, newQuestion]);
  };

  const updateQuestion = (id: string, updates: Partial<QuestionConfig>) => {
    setQuestions(questions.map(q => q.id === id ? { ...q, ...updates } : q));
  };

  const deleteQuestion = (id: string) => {
    setQuestions(questions.filter(q => q.id !== id));
  };

  const addChoice = (questionId: string) => {
    setQuestions(questions.map(q => {
      if (q.id === questionId && q.choices) {
        return { ...q, choices: [...q.choices, `Option ${q.choices.length + 1}`] };
      }
      return q;
    }));
  };

  const updateChoice = (questionId: string, choiceIndex: number, value: string) => {
    setQuestions(questions.map(q => {
      if (q.id === questionId && q.choices) {
        const newChoices = [...q.choices];
        newChoices[choiceIndex] = value;
        return { ...q, choices: newChoices };
      }
      return q;
    }));
  };

  const deleteChoice = (questionId: string, choiceIndex: number) => {
    setQuestions(questions.map(q => {
      if (q.id === questionId && q.choices) {
        return { ...q, choices: q.choices.filter((_, i) => i !== choiceIndex) };
      }
      return q;
    }));
  };

  const handleSave = () => {
    const surveyJson = {
      elements: questions.map(q => {
        const element: any = {
          name: q.name,
          title: q.title,
          type: q.type,
          isRequired: q.required
        };

        if (q.type === 'rating') {
          element.rateMin = q.rateMin;
          element.rateMax = q.rateMax;
        }

        if (q.choices && q.choices.length > 0) {
          element.choices = q.choices;
        }

        return element;
      })
    };
    onSave(surveyJson);
  };

  const getQuestionIcon = (type: string) => {
    switch (type) {
      case 'rating': return <Star className="w-4 h-4" />;
      case 'radiogroup': return <CheckSquare className="w-4 h-4" />;
      case 'checkbox': return <CheckSquare className="w-4 h-4" />;
      case 'boolean': return <ToggleLeft className="w-4 h-4" />;
      default: return <Type className="w-4 h-4" />;
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Survey Builder</h2>
          <p className="text-sm text-gray-600">Create your survey by adding questions below</p>
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
            disabled={questions.length === 0}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Save Survey
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Question List */}
          {questions.map((question, index) => (
            <div key={question.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              {/* Question Header */}
              <div className="flex items-start gap-3 mb-4">
                <GripVertical className="w-5 h-5 text-gray-400 mt-2 cursor-move" />
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-3">
                    {getQuestionIcon(question.type)}
                    <span className="text-sm font-medium text-gray-600">
                      Question {index + 1}
                      {question.type === 'rating' && ' - Star Rating'}
                      {question.type === 'radiogroup' && ' - Single Choice'}
                      {question.type === 'checkbox' && ' - Multiple Choice'}
                      {question.type === 'text' && ' - Short Text'}
                      {question.type === 'comment' && ' - Long Text'}
                      {question.type === 'boolean' && ' - Yes/No'}
                    </span>
                  </div>

                  {/* Question Title */}
                  <input
                    type="text"
                    value={question.title}
                    onChange={(e) => updateQuestion(question.id, { title: e.target.value })}
                    placeholder="Enter your question..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent mb-3"
                  />

                  {/* Rating Options */}
                  {question.type === 'rating' && (
                    <div className="flex items-center gap-4 mb-3">
                      <label className="flex items-center gap-2">
                        <span className="text-sm text-gray-600">Min:</span>
                        <input
                          type="number"
                          value={question.rateMin || 1}
                          onChange={(e) => updateQuestion(question.id, { rateMin: parseInt(e.target.value) })}
                          className="w-20 px-2 py-1 border border-gray-300 rounded"
                          min="0"
                        />
                      </label>
                      <label className="flex items-center gap-2">
                        <span className="text-sm text-gray-600">Max:</span>
                        <input
                          type="number"
                          value={question.rateMax || 5}
                          onChange={(e) => updateQuestion(question.id, { rateMax: parseInt(e.target.value) })}
                          className="w-20 px-2 py-1 border border-gray-300 rounded"
                          min="1"
                        />
                      </label>
                    </div>
                  )}

                  {/* Multiple Choice Options */}
                  {(['radiogroup', 'checkbox'].includes(question.type)) && question.choices && (
                    <div className="space-y-2 mb-3">
                      <label className="text-sm font-medium text-gray-700">Choices:</label>
                      {question.choices.map((choice, choiceIndex) => (
                        <div key={choiceIndex} className="flex items-center gap-2">
                          <input
                            type="text"
                            value={choice}
                            onChange={(e) => updateChoice(question.id, choiceIndex, e.target.value)}
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                            placeholder={`Option ${choiceIndex + 1}`}
                          />
                          <button
                            onClick={() => deleteChoice(question.id, choiceIndex)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            disabled={question.choices!.length <= 1}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                      <button
                        onClick={() => addChoice(question.id)}
                        className="text-sm text-indigo-600 hover:text-indigo-700 font-medium"
                      >
                        + Add Choice
                      </button>
                    </div>
                  )}

                  {/* Required Toggle */}
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={question.required}
                      onChange={(e) => updateQuestion(question.id, { required: e.target.checked })}
                      className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="text-gray-700">Required question</span>
                  </label>
                </div>

                {/* Delete Button */}
                <button
                  onClick={() => deleteQuestion(question.id)}
                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            </div>
          ))}

          {/* Add Question Buttons */}
          <div className="bg-white rounded-lg shadow-sm border-2 border-dashed border-gray-300 p-6">
            <h3 className="text-sm font-medium text-gray-700 mb-4">Add Question Type:</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <button
                onClick={() => addQuestion('rating')}
                className="flex items-center gap-2 px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-left"
              >
                <Star className="w-5 h-5 text-yellow-500" />
                <span className="text-sm font-medium">Star Rating</span>
              </button>
              <button
                onClick={() => addQuestion('radiogroup')}
                className="flex items-center gap-2 px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-left"
              >
                <CheckSquare className="w-5 h-5 text-blue-500" />
                <span className="text-sm font-medium">Single Choice</span>
              </button>
              <button
                onClick={() => addQuestion('checkbox')}
                className="flex items-center gap-2 px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-left"
              >
                <CheckSquare className="w-5 h-5 text-green-500" />
                <span className="text-sm font-medium">Multiple Choice</span>
              </button>
              <button
                onClick={() => addQuestion('boolean')}
                className="flex items-center gap-2 px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-left"
              >
                <ToggleLeft className="w-5 h-5 text-purple-500" />
                <span className="text-sm font-medium">Yes/No</span>
              </button>
              <button
                onClick={() => addQuestion('text')}
                className="flex items-center gap-2 px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-left"
              >
                <Type className="w-5 h-5 text-indigo-500" />
                <span className="text-sm font-medium">Short Text</span>
              </button>
              <button
                onClick={() => addQuestion('comment')}
                className="flex items-center gap-2 px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-left"
              >
                <Type className="w-5 h-5 text-gray-500" />
                <span className="text-sm font-medium">Long Text</span>
              </button>
            </div>
          </div>

          {questions.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              <p className="text-lg font-medium mb-2">No questions yet</p>
              <p className="text-sm">Click a button above to add your first question</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Legacy interface for backwards compatibility with existing survey components
// TODO: Remove after full migration to Survey.js format
export interface SurveyQuestion {
  id: string;
  text: string;
  type: 'multiple_choice' | 'yes_no' | 'rating' | 'short_text' | 'long_text';
  options?: string[];
  allow_multiple?: boolean;
  required: boolean;
}
