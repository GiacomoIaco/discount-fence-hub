import { useState } from 'react';
import {
  Plus,
  Trash2,
  GripVertical,
  ChevronDown,
  ChevronUp,
  Star,
  CheckSquare,
  Circle,
  Type,
  AlignLeft,
  ThumbsUp
} from 'lucide-react';

export interface SurveyQuestion {
  id: string;
  text: string;
  type: 'multiple_choice' | 'yes_no' | 'rating' | 'short_text' | 'long_text';
  options?: string[];
  allow_multiple?: boolean;
  required: boolean;
}

interface SurveyBuilderProps {
  questions: SurveyQuestion[];
  onChange: (questions: SurveyQuestion[]) => void;
}

const questionTypes = [
  { value: 'multiple_choice', label: 'Multiple Choice', icon: CheckSquare, description: 'Single or multiple select' },
  { value: 'yes_no', label: 'Yes/No', icon: ThumbsUp, description: 'Simple yes or no question' },
  { value: 'rating', label: 'Rating', icon: Star, description: '1-5 star rating' },
  { value: 'short_text', label: 'Short Text', icon: Type, description: 'One line answer' },
  { value: 'long_text', label: 'Long Text', icon: AlignLeft, description: 'Paragraph answer' },
];

export default function SurveyBuilder({ questions, onChange }: SurveyBuilderProps) {
  const [expandedQuestion, setExpandedQuestion] = useState<string | null>(questions[0]?.id || null);

  const addQuestion = () => {
    const newQuestion: SurveyQuestion = {
      id: `q${Date.now()}`,
      text: '',
      type: 'multiple_choice',
      options: ['Option 1', 'Option 2'],
      allow_multiple: false,
      required: true
    };
    onChange([...questions, newQuestion]);
    setExpandedQuestion(newQuestion.id);
  };

  const updateQuestion = (id: string, updates: Partial<SurveyQuestion>) => {
    onChange(questions.map(q => q.id === id ? { ...q, ...updates } : q));
  };

  const deleteQuestion = (id: string) => {
    onChange(questions.filter(q => q.id !== id));
    if (expandedQuestion === id) {
      setExpandedQuestion(questions[0]?.id || null);
    }
  };

  const addOption = (questionId: string) => {
    const question = questions.find(q => q.id === questionId);
    if (question && question.options) {
      updateQuestion(questionId, {
        options: [...question.options, `Option ${question.options.length + 1}`]
      });
    }
  };

  const updateOption = (questionId: string, optionIndex: number, value: string) => {
    const question = questions.find(q => q.id === questionId);
    if (question && question.options) {
      const newOptions = [...question.options];
      newOptions[optionIndex] = value;
      updateQuestion(questionId, { options: newOptions });
    }
  };

  const deleteOption = (questionId: string, optionIndex: number) => {
    const question = questions.find(q => q.id === questionId);
    if (question && question.options && question.options.length > 2) {
      updateQuestion(questionId, {
        options: question.options.filter((_, i) => i !== optionIndex)
      });
    }
  };

  const moveQuestion = (index: number, direction: 'up' | 'down') => {
    const newQuestions = [...questions];
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex >= 0 && newIndex < questions.length) {
      [newQuestions[index], newQuestions[newIndex]] = [newQuestions[newIndex], newQuestions[index]];
      onChange(newQuestions);
    }
  };

  if (questions.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-600 mb-4">No questions yet. Add your first question to get started.</p>
        <button
          onClick={addQuestion}
          className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors inline-flex items-center space-x-2"
        >
          <Plus className="w-4 h-4" />
          <span>Add Question</span>
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {questions.map((question, index) => {
        const isExpanded = expandedQuestion === question.id;
        const questionType = questionTypes.find(t => t.value === question.type);
        const Icon = questionType?.icon || CheckSquare;

        return (
          <div
            key={question.id}
            className="bg-white rounded-xl border-2 border-gray-200 overflow-hidden"
          >
            {/* Question Header */}
            <div
              onClick={() => setExpandedQuestion(isExpanded ? null : question.id)}
              className="p-4 flex items-center space-x-3 cursor-pointer hover:bg-gray-50 transition-colors"
            >
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  // Drag handle - could implement drag & drop
                }}
                className="p-1 text-gray-400 hover:text-gray-600 cursor-grab active:cursor-grabbing"
              >
                <GripVertical className="w-5 h-5" />
              </button>

              <div className="bg-purple-100 p-2 rounded-lg">
                <Icon className="w-5 h-5 text-purple-600" />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center space-x-2">
                  <span className="text-sm font-semibold text-gray-500">Q{index + 1}</span>
                  <span className="text-gray-900 font-medium truncate">
                    {question.text || 'Untitled Question'}
                  </span>
                </div>
                <p className="text-sm text-gray-500">{questionType?.label}</p>
              </div>

              <div className="flex items-center space-x-2">
                {question.required && (
                  <span className="px-2 py-1 bg-red-100 text-red-700 text-xs font-semibold rounded">
                    Required
                  </span>
                )}
                <button className="p-1">
                  {isExpanded ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
                </button>
              </div>
            </div>

            {/* Question Editor */}
            {isExpanded && (
              <div className="p-4 border-t border-gray-200 bg-gray-50 space-y-4">
                {/* Question Text */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Question Text *
                  </label>
                  <input
                    type="text"
                    value={question.text}
                    onChange={(e) => updateQuestion(question.id, { text: e.target.value })}
                    placeholder="Enter your question..."
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  />
                </div>

                {/* Question Type */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Question Type
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {questionTypes.map(type => {
                      const TypeIcon = type.icon;
                      return (
                        <button
                          key={type.value}
                          onClick={() => {
                            const updates: Partial<SurveyQuestion> = { type: type.value as any };
                            if (type.value === 'multiple_choice' && !question.options) {
                              updates.options = ['Option 1', 'Option 2'];
                              updates.allow_multiple = false;
                            } else if (type.value === 'yes_no') {
                              updates.options = ['Yes', 'No'];
                              updates.allow_multiple = false;
                            }
                            updateQuestion(question.id, updates);
                          }}
                          className={`p-3 rounded-lg border-2 text-left transition-all ${
                            question.type === type.value
                              ? 'border-purple-500 bg-purple-50'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <div className="flex items-center space-x-2">
                            <TypeIcon className={`w-4 h-4 ${question.type === type.value ? 'text-purple-600' : 'text-gray-400'}`} />
                            <div>
                              <div className={`text-sm font-medium ${question.type === type.value ? 'text-purple-900' : 'text-gray-900'}`}>
                                {type.label}
                              </div>
                              <div className="text-xs text-gray-500">{type.description}</div>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Options (for multiple choice and yes/no) */}
                {(question.type === 'multiple_choice' || question.type === 'yes_no') && question.options && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Options
                    </label>
                    <div className="space-y-2">
                      {question.options.map((option, optionIndex) => (
                        <div key={optionIndex} className="flex items-center space-x-2">
                          <Circle className="w-4 h-4 text-gray-400 flex-shrink-0" />
                          <input
                            type="text"
                            value={option}
                            onChange={(e) => updateOption(question.id, optionIndex, e.target.value)}
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                            placeholder={`Option ${optionIndex + 1}`}
                          />
                          {question.options!.length > 2 && question.type !== 'yes_no' && (
                            <button
                              onClick={() => deleteOption(question.id, optionIndex)}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      ))}
                      {question.type === 'multiple_choice' && (
                        <button
                          onClick={() => addOption(question.id)}
                          className="flex items-center space-x-2 px-3 py-2 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors text-sm"
                        >
                          <Plus className="w-4 h-4" />
                          <span>Add Option</span>
                        </button>
                      )}
                    </div>

                    {question.type === 'multiple_choice' && (
                      <label className="flex items-center space-x-2 mt-3">
                        <input
                          type="checkbox"
                          checked={question.allow_multiple}
                          onChange={(e) => updateQuestion(question.id, { allow_multiple: e.target.checked })}
                          className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                        />
                        <span className="text-sm text-gray-700">Allow multiple selections</span>
                      </label>
                    )}
                  </div>
                )}

                {/* Settings */}
                <div className="flex items-center justify-between pt-3 border-t border-gray-200">
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={question.required}
                      onChange={(e) => updateQuestion(question.id, { required: e.target.checked })}
                      className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                    />
                    <span className="text-sm text-gray-700">Required question</span>
                  </label>

                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => moveQuestion(index, 'up')}
                      disabled={index === 0}
                      className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      title="Move up"
                    >
                      <ChevronUp className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => moveQuestion(index, 'down')}
                      disabled={index === questions.length - 1}
                      className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      title="Move down"
                    >
                      <ChevronDown className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => deleteQuestion(question.id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Delete question"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}

      {/* Add Question Button */}
      <button
        onClick={addQuestion}
        className="w-full py-3 border-2 border-dashed border-gray-300 text-gray-600 rounded-xl hover:border-purple-500 hover:text-purple-600 hover:bg-purple-50 transition-colors flex items-center justify-center space-x-2"
      >
        <Plus className="w-5 h-5" />
        <span className="font-medium">Add Question</span>
      </button>
    </div>
  );
}
