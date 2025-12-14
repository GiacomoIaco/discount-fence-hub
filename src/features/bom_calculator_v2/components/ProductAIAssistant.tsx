import { useState } from 'react';
import {
  Sparkles,
  X,
  Loader2,
  Check,
  AlertCircle,
  Play,
  MessageSquare,
  History,
  Minimize2,
  Maximize2,
} from 'lucide-react';
import VoiceInput from '../../../components/shared/VoiceInput';
import toast from 'react-hot-toast';

// Types
export interface ProductContext {
  currentTab: 'types' | 'styles' | 'variables' | 'components' | 'formulas' | 'labor';
  selectedProductType?: {
    id: string;
    code: string;
    name: string;
  };
  selectedStyle?: {
    id: string;
    code: string;
    name: string;
  };
  existingStyles?: Array<{ code: string; name: string }>;
  existingVariables?: Array<{ code: string; name: string; type: string }>;
  existingComponents?: Array<{ code: string; name: string; is_assigned: boolean }>;
  existingFormulas?: Array<{ component_code: string; style_code?: string; has_formula: boolean }>;
}

interface ActionStep {
  action: 'create' | 'update' | 'assign';
  entity: 'product_type' | 'style' | 'variable' | 'component' | 'formula' | 'labor';
  data: Record<string, any>;
  description: string;
}

interface AIResponse {
  type: 'response' | 'single' | 'plan';
  // For response type
  message?: string;
  suggestions?: string[];
  // For single type
  entity?: string;
  data?: Record<string, any>;
  explanation?: string;
  // For plan type
  summary?: string;
  steps?: ActionStep[];
  notes?: string;
}

interface HistoryItem {
  id: string;
  request: string;
  response: AIResponse;
  timestamp: Date;
  executed?: boolean;
}

interface ProductAIAssistantProps {
  context: ProductContext;
  onExecutePlan: (steps: ActionStep[]) => Promise<void>;
  onExecuteSingle: (entity: string, data: Record<string, any>) => Promise<void>;
}

export default function ProductAIAssistant({
  context,
  onExecutePlan,
  onExecuteSingle,
}: ProductAIAssistantProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [isMinimized, setIsMinimized] = useState(false);
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentResponse, setCurrentResponse] = useState<AIResponse | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);

  // Quick actions based on current context
  const quickActions = getQuickActions(context);

  const handleSubmit = async (text?: string) => {
    const request = text || input;
    if (!request.trim()) return;

    setIsProcessing(true);
    setCurrentResponse(null);

    try {
      const response = await fetch('/.netlify/functions/ai-product-assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ request, context }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'AI request failed');
      }

      const data: AIResponse = await response.json();
      setCurrentResponse(data);

      // Add to history
      setHistory(prev => [{
        id: Date.now().toString(),
        request,
        response: data,
        timestamp: new Date(),
      }, ...prev.slice(0, 9)]); // Keep last 10

      setInput('');
    } catch (error: any) {
      console.error('AI Assistant error:', error);
      toast.error(error.message || 'AI request failed');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleVoiceTranscript = (transcript: string) => {
    setInput(transcript);
  };

  const handleVoiceProcess = async (transcript: string) => {
    await handleSubmit(transcript);
  };

  const handleExecutePlan = async () => {
    if (!currentResponse?.steps) return;

    setIsExecuting(true);
    try {
      await onExecutePlan(currentResponse.steps);
      toast.success('Plan executed successfully!');

      // Mark in history as executed
      setHistory(prev => prev.map((item, i) =>
        i === 0 ? { ...item, executed: true } : item
      ));
    } catch (error: any) {
      toast.error(error.message || 'Execution failed');
    } finally {
      setIsExecuting(false);
    }
  };

  const handleExecuteSingle = async () => {
    if (!currentResponse?.entity || !currentResponse?.data) return;

    setIsExecuting(true);
    try {
      await onExecuteSingle(currentResponse.entity, currentResponse.data);
      toast.success('Applied successfully!');

      setHistory(prev => prev.map((item, i) =>
        i === 0 ? { ...item, executed: true } : item
      ));
    } catch (error: any) {
      toast.error(error.message || 'Execution failed');
    } finally {
      setIsExecuting(false);
    }
  };

  const clearResponse = () => {
    setCurrentResponse(null);
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 right-4 p-4 bg-purple-600 text-white rounded-full shadow-lg hover:bg-purple-700 transition-all z-50"
        title="Open AI Assistant"
      >
        <Sparkles className="w-6 h-6" />
      </button>
    );
  }

  return (
    <div className={`fixed bottom-4 right-4 w-96 bg-white rounded-xl shadow-2xl border border-purple-200 overflow-hidden z-50 transition-all ${isMinimized ? 'h-14' : 'max-h-[600px]'}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5" />
          <span className="font-semibold">AI Assistant</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowHistory(!showHistory)}
            className={`p-1.5 rounded hover:bg-white/20 transition-colors ${showHistory ? 'bg-white/20' : ''}`}
            title="History"
          >
            <History className="w-4 h-4" />
          </button>
          <button
            onClick={() => setIsMinimized(!isMinimized)}
            className="p-1.5 rounded hover:bg-white/20 transition-colors"
            title={isMinimized ? 'Expand' : 'Minimize'}
          >
            {isMinimized ? <Maximize2 className="w-4 h-4" /> : <Minimize2 className="w-4 h-4" />}
          </button>
          <button
            onClick={() => setIsOpen(false)}
            className="p-1.5 rounded hover:bg-white/20 transition-colors"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {!isMinimized && (
        <div className="flex flex-col max-h-[550px]">
          {/* Context Display */}
          <div className="px-4 py-2 bg-purple-50 border-b border-purple-100 text-xs">
            <div className="flex flex-wrap gap-1.5">
              <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded">
                {context.currentTab}
              </span>
              {context.selectedProductType && (
                <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded">
                  {context.selectedProductType.code}
                </span>
              )}
              {context.selectedStyle && (
                <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded">
                  {context.selectedStyle.code}
                </span>
              )}
            </div>
          </div>

          {/* Main Content Area */}
          <div className="flex-1 overflow-auto">
            {showHistory ? (
              /* History View */
              <div className="p-3 space-y-2">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">Recent Requests</span>
                  {history.length > 0 && (
                    <button
                      onClick={() => setHistory([])}
                      className="text-xs text-gray-400 hover:text-red-500"
                    >
                      Clear all
                    </button>
                  )}
                </div>
                {history.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-4">No history yet</p>
                ) : (
                  history.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => {
                        setCurrentResponse(item.response);
                        setShowHistory(false);
                      }}
                      className="w-full text-left p-2 rounded-lg hover:bg-gray-50 border border-gray-100 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm text-gray-700 line-clamp-2">{item.request}</p>
                        {item.executed && (
                          <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                        )}
                      </div>
                      <p className="text-xs text-gray-400 mt-1">
                        {item.timestamp.toLocaleTimeString()}
                      </p>
                    </button>
                  ))
                )}
              </div>
            ) : currentResponse ? (
              /* Response Display */
              <div className="p-4 space-y-3">
                {/* Response type: message */}
                {currentResponse.type === 'response' && (
                  <div className="space-y-3">
                    <div className="flex items-start gap-2">
                      <MessageSquare className="w-5 h-5 text-purple-500 flex-shrink-0 mt-0.5" />
                      <p className="text-sm text-gray-700">{currentResponse.message}</p>
                    </div>
                    {currentResponse.suggestions && currentResponse.suggestions.length > 0 && (
                      <div className="space-y-1">
                        <p className="text-xs text-gray-500">Suggestions:</p>
                        {currentResponse.suggestions.map((s, i) => (
                          <button
                            key={i}
                            onClick={() => {
                              setInput(s);
                              clearResponse();
                            }}
                            className="block w-full text-left text-sm px-3 py-1.5 bg-gray-50 hover:bg-gray-100 rounded text-gray-600"
                          >
                            → {s}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Response type: single item */}
                {currentResponse.type === 'single' && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Check className="w-5 h-5 text-green-500" />
                      <span className="font-medium text-gray-800">
                        Generated {currentResponse.entity}
                      </span>
                    </div>
                    <div className="bg-gray-900 text-green-400 font-mono text-xs p-3 rounded-lg overflow-x-auto">
                      <pre>{JSON.stringify(currentResponse.data, null, 2)}</pre>
                    </div>
                    {currentResponse.explanation && (
                      <p className="text-sm text-gray-600">{currentResponse.explanation}</p>
                    )}
                    <button
                      onClick={handleExecuteSingle}
                      disabled={isExecuting}
                      className="w-full flex items-center justify-center gap-2 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                    >
                      {isExecuting ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Play className="w-4 h-4" />
                      )}
                      Apply This
                    </button>
                  </div>
                )}

                {/* Response type: plan */}
                {currentResponse.type === 'plan' && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-purple-500" />
                      <span className="font-medium text-gray-800">Action Plan</span>
                    </div>
                    {currentResponse.summary && (
                      <p className="text-sm text-gray-600 bg-purple-50 p-2 rounded">
                        {currentResponse.summary}
                      </p>
                    )}
                    <div className="space-y-2 max-h-48 overflow-auto">
                      {currentResponse.steps?.map((step, i) => (
                        <div
                          key={i}
                          className="flex items-start gap-2 p-2 bg-gray-50 rounded-lg text-sm"
                        >
                          <span className="w-5 h-5 flex items-center justify-center bg-purple-100 text-purple-700 rounded-full text-xs font-medium flex-shrink-0">
                            {i + 1}
                          </span>
                          <div>
                            <span className="font-medium text-gray-700">
                              {step.action} {step.entity}
                            </span>
                            <p className="text-xs text-gray-500">{step.description}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                    {currentResponse.notes && (
                      <div className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 p-2 rounded">
                        <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                        <span>{currentResponse.notes}</span>
                      </div>
                    )}
                    <button
                      onClick={handleExecutePlan}
                      disabled={isExecuting}
                      className="w-full flex items-center justify-center gap-2 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
                    >
                      {isExecuting ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Play className="w-4 h-4" />
                      )}
                      Execute Plan ({currentResponse.steps?.length} steps)
                    </button>
                  </div>
                )}

                <button
                  onClick={clearResponse}
                  className="w-full text-sm text-gray-400 hover:text-gray-600 py-1"
                >
                  Ask something else
                </button>
              </div>
            ) : (
              /* Input View */
              <div className="p-4 space-y-4">
                {/* Voice Input */}
                <VoiceInput
                  onTranscript={handleVoiceTranscript}
                  onProcess={handleVoiceProcess}
                  processButtonLabel="Ask AI"
                  placeholder="Describe what you need..."
                  compact={false}
                />

                {/* Or divider */}
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-200" />
                  </div>
                  <div className="relative flex justify-center text-xs">
                    <span className="px-2 bg-white text-gray-400">or type</span>
                  </div>
                </div>

                {/* Text Input */}
                <div className="space-y-2">
                  <textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSubmit();
                      }
                    }}
                    placeholder="Ask anything about product configuration..."
                    rows={2}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 resize-none"
                  />
                  <button
                    onClick={() => handleSubmit()}
                    disabled={isProcessing || !input.trim()}
                    className="w-full flex items-center justify-center gap-2 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Thinking...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        Ask AI
                      </>
                    )}
                  </button>
                </div>

                {/* Quick Actions */}
                {quickActions.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs text-gray-500">Quick actions:</p>
                    <div className="flex flex-wrap gap-1.5">
                      {quickActions.map((action, i) => (
                        <button
                          key={i}
                          onClick={() => handleSubmit(action.prompt)}
                          className="text-xs px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded text-gray-600 transition-colors"
                        >
                          {action.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Quick actions based on context
function getQuickActions(context: ProductContext): Array<{ label: string; prompt: string }> {
  const actions: Array<{ label: string; prompt: string }> = [];

  switch (context.currentTab) {
    case 'types':
      actions.push(
        { label: 'New product type', prompt: 'Help me create a new product type' },
        { label: 'Suggest variables', prompt: 'What variables do I need for this product type?' }
      );
      break;
    case 'styles':
      actions.push(
        { label: 'Add style', prompt: 'Add a new style variation' },
        { label: 'Explain adjustments', prompt: 'How do formula adjustments work?' }
      );
      break;
    case 'variables':
      actions.push(
        { label: 'Suggest variables', prompt: 'What variables should I add?' },
        { label: 'Common patterns', prompt: 'Show me common variable configurations' }
      );
      break;
    case 'components':
      actions.push(
        { label: 'Suggest components', prompt: 'Which components should I assign?' },
        { label: 'Explain order', prompt: 'How does component order affect formulas?' }
      );
      break;
    case 'formulas':
      actions.push(
        { label: 'Generate formula', prompt: 'Generate a formula for...' },
        { label: 'Missing formulas', prompt: 'Which components are missing formulas?' },
        { label: 'Check consistency', prompt: 'Are my formulas consistent?' }
      );
      break;
    case 'labor':
      actions.push(
        { label: 'Suggest labor codes', prompt: 'What labor codes should I assign?' },
        { label: 'Common setup', prompt: 'Show me typical labor configuration' }
      );
      break;
  }

  return actions;
}
