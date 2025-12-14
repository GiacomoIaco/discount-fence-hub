import { useState } from 'react';
import { Sparkles, Copy, Check, AlertCircle, RefreshCw, ChevronDown, ChevronUp, Wand2 } from 'lucide-react';
import VoiceInput from '../../../components/shared/VoiceInput';
import toast from 'react-hot-toast';

interface FormulaAIAssistProps {
  productType: string;
  componentType: string;
  availableVariables?: string[];
  onFormulaGenerated: (formula: string, plainEnglish: string) => void;
  existingFormula?: string;
}

interface GenerateResult {
  formula: string;
  plain_english: string;
  variables_used: string[];
  notes: string;
}

interface ExplainResult {
  plain_english: string;
  variables_used: string[];
  step_by_step: string;
}

export default function FormulaAIAssist({
  productType,
  componentType,
  availableVariables = [],
  onFormulaGenerated,
  existingFormula,
}: FormulaAIAssistProps) {
  const [description, setDescription] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isExplaining, setIsExplaining] = useState(false);
  const [result, setResult] = useState<GenerateResult | null>(null);
  const [explanation, setExplanation] = useState<ExplainResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(true);

  const generateFormula = async (text?: string) => {
    const input = text || description;
    if (!input.trim()) {
      toast.error('Please describe the formula first');
      return;
    }

    setIsGenerating(true);
    setResult(null);

    try {
      const response = await fetch('/.netlify/functions/ai-formula-assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'generate',
          description: input,
          productType,
          componentType,
          availableVariables,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to generate formula');
      }

      const data: GenerateResult = await response.json();
      setResult(data);
      toast.success('Formula generated!');
    } catch (error: any) {
      console.error('Generate error:', error);
      toast.error(error.message || 'Failed to generate formula');
    } finally {
      setIsGenerating(false);
    }
  };

  const explainFormula = async () => {
    if (!existingFormula) {
      toast.error('No formula to explain');
      return;
    }

    setIsExplaining(true);
    setExplanation(null);

    try {
      const response = await fetch('/.netlify/functions/ai-formula-assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'explain',
          formula: existingFormula,
          productType,
          componentType,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to explain formula');
      }

      const data: ExplainResult = await response.json();
      setExplanation(data);
    } catch (error: any) {
      console.error('Explain error:', error);
      toast.error(error.message || 'Failed to explain formula');
    } finally {
      setIsExplaining(false);
    }
  };

  const handleCopyFormula = () => {
    if (result?.formula) {
      navigator.clipboard.writeText(result.formula);
      setCopied(true);
      toast.success('Formula copied!');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleUseFormula = () => {
    if (result) {
      onFormulaGenerated(result.formula, result.plain_english);
      toast.success('Formula applied!');
    }
  };

  const handleVoiceTranscript = (transcript: string) => {
    setDescription(transcript);
  };

  const handleVoiceProcess = async (transcript: string) => {
    await generateFormula(transcript);
  };

  return (
    <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg border border-purple-200 overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-3 hover:bg-purple-100/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-purple-600" />
          <span className="font-medium text-purple-900">AI Formula Assistant</span>
          <span className="text-xs text-purple-500 bg-purple-100 px-2 py-0.5 rounded-full">
            Voice + Text
          </span>
        </div>
        {expanded ? (
          <ChevronUp className="w-5 h-5 text-purple-400" />
        ) : (
          <ChevronDown className="w-5 h-5 text-purple-400" />
        )}
      </button>

      {expanded && (
        <div className="p-4 pt-0 space-y-4">
          {/* Context display */}
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="px-2 py-1 bg-white rounded border border-purple-200 text-purple-700">
              Product: {productType || 'Not selected'}
            </span>
            <span className="px-2 py-1 bg-white rounded border border-purple-200 text-purple-700">
              Component: {componentType || 'Not selected'}
            </span>
          </div>

          {/* Voice Input */}
          <VoiceInput
            onTranscript={handleVoiceTranscript}
            onProcess={handleVoiceProcess}
            processButtonLabel="Generate"
            placeholder="Describe how to calculate this component"
            compact={false}
          />

          {/* Or divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-purple-200" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="px-2 bg-gradient-to-r from-purple-50 to-blue-50 text-purple-500">
                or type
              </span>
            </div>
          </div>

          {/* Text Input */}
          <div className="space-y-2">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the formula in plain English... e.g., 'Number of posts is fence length divided by post spacing, plus one for the end'"
              rows={3}
              className="w-full border border-purple-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 resize-none"
            />
            <div className="flex gap-2">
              <button
                onClick={() => generateFormula()}
                disabled={isGenerating || !description.trim()}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isGenerating ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Wand2 className="w-4 h-4" />
                    Generate Formula
                  </>
                )}
              </button>

              {existingFormula && (
                <button
                  onClick={explainFormula}
                  disabled={isExplaining}
                  className="flex items-center gap-2 px-4 py-2 bg-white border border-purple-300 text-purple-700 rounded-lg hover:bg-purple-50 transition-colors disabled:opacity-50"
                >
                  {isExplaining ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Explaining...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      Explain Current
                    </>
                  )}
                </button>
              )}
            </div>
          </div>

          {/* Generated Result */}
          {result && (
            <div className="bg-white rounded-lg border border-green-200 p-4 space-y-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <Check className="w-5 h-5 text-green-600" />
                  <span className="font-medium text-green-800">Generated Formula</span>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={handleCopyFormula}
                    className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
                    title="Copy formula"
                  >
                    {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={() => generateFormula()}
                    className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
                    title="Regenerate"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Formula display */}
              <div className="bg-gray-900 text-green-400 font-mono text-sm p-3 rounded-lg overflow-x-auto">
                {result.formula}
              </div>

              {/* Plain English */}
              <div className="text-sm text-gray-600">
                <strong className="text-gray-700">Explanation:</strong> {result.plain_english}
              </div>

              {/* Variables used */}
              {result.variables_used.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {result.variables_used.map((v) => (
                    <span key={v} className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded">
                      [{v}]
                    </span>
                  ))}
                </div>
              )}

              {/* Notes */}
              {result.notes && (
                <div className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 rounded p-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>{result.notes}</span>
                </div>
              )}

              {/* Action button */}
              <button
                onClick={handleUseFormula}
                className="w-full py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
              >
                Use This Formula
              </button>
            </div>
          )}

          {/* Explanation Result */}
          {explanation && (
            <div className="bg-white rounded-lg border border-blue-200 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-blue-600" />
                <span className="font-medium text-blue-800">Formula Explanation</span>
              </div>

              <div className="text-sm text-gray-700">
                <p className="mb-2">{explanation.plain_english}</p>
                {explanation.step_by_step && (
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <strong className="text-gray-800">Step by step:</strong>
                    <p className="mt-1 text-gray-600 whitespace-pre-line">{explanation.step_by_step}</p>
                  </div>
                )}
              </div>

              {explanation.variables_used.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {explanation.variables_used.map((v) => (
                    <span key={v} className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded">
                      [{v}]
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
