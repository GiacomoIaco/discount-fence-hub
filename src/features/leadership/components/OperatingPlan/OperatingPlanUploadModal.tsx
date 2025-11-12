import { useState, useRef } from 'react';
import { Upload, FileText, X, AlertCircle, CheckCircle, ChevronDown, ChevronRight } from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';
import mammoth from 'mammoth';
import toast from 'react-hot-toast';
import { useBulkImportOperatingPlan } from '../../hooks/useOperatingPlanQuery';

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

interface ParsedArea {
  name: string;
  strategic_description?: string;
}

interface ParsedInitiative {
  area_name: string;
  title: string;
  description?: string;
  annual_target?: string;
}

interface ParsedQuarterlyObjective {
  initiative_title: string;
  quarter: number;
  objective: string;
}

interface ParsedBonusKPI {
  name: string;
  description?: string;
  unit: 'dollars' | 'percent' | 'score' | 'count' | 'text';
  target_value?: number;
  target_text?: string;
  min_threshold?: number;
  min_multiplier?: number;
  max_threshold?: number;
  max_multiplier?: number;
}

interface ParsedOperatingPlan {
  year?: number;
  areas: ParsedArea[];
  initiatives: ParsedInitiative[];
  quarterly_objectives: ParsedQuarterlyObjective[];
  bonus_kpis: ParsedBonusKPI[];
  confidence: {
    overall: number;
    areas: number;
    initiatives: number;
    quarterly_objectives: number;
    bonus_kpis: number;
  };
}

interface OperatingPlanUploadModalProps {
  functionId: string;
  year: number;
  onClose: () => void;
  onImportComplete: () => void;
}

type UploadStep = 'upload' | 'extracting' | 'parsing' | 'review' | 'importing';

export default function OperatingPlanUploadModal({
  functionId,
  year,
  onClose,
  onImportComplete,
}: OperatingPlanUploadModalProps) {
  const [step, setStep] = useState<UploadStep>('upload');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<ParsedOperatingPlan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bulkImport = useBulkImportOperatingPlan();

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const validTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'image/jpeg',
      'image/png',
      'image/jpg',
    ];

    if (!validTypes.includes(file.type)) {
      setError('Please select a PDF, Word document, Excel file, or image (JPG/PNG)');
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      setError('File must be less than 10MB');
      return;
    }

    setSelectedFile(file);
    setError(null);
  };

  const extractTextFromPDF = async (file: File): Promise<string> => {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let fullText = '';

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item: any) => item.str)
        .join(' ');
      fullText += pageText + '\n';
    }

    return fullText;
  };

  const extractTextFromWord = async (file: File): Promise<string> => {
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    return result.value;
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    try {
      setStep('extracting');
      setError(null);

      let documentText = '';
      let documentType = '';

      // Extract text based on file type
      if (selectedFile.type === 'application/pdf') {
        documentType = 'PDF document';
        documentText = await extractTextFromPDF(selectedFile);
      } else if (
        selectedFile.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
        selectedFile.type === 'application/msword'
      ) {
        documentType = 'Word document';
        documentText = await extractTextFromWord(selectedFile);
      } else if (selectedFile.type.startsWith('image/')) {
        // For images, we'll send the base64 directly to Claude Vision
        documentType = 'image';
        const reader = new FileReader();
        documentText = await new Promise<string>((resolve, reject) => {
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(selectedFile);
        });
      } else {
        throw new Error('Unsupported file type for text extraction');
      }

      // Parse with Claude
      setStep('parsing');
      const response = await fetch('/.netlify/functions/parse-operating-plan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          documentText,
          documentType,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to parse document');
      }

      const data: ParsedOperatingPlan = await response.json();

      // Set the year if not detected
      if (!data.year) {
        data.year = year;
      }

      setParsedData(data);
      setStep('review');
      toast.success('Document parsed successfully! Review the extracted data below.');
    } catch (err: any) {
      console.error('Upload error:', err);
      setError(err.message || 'Failed to process document');
      setStep('upload');
    }
  };

  const toggleSection = (section: string) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  };

  const handleImport = async () => {
    if (!parsedData) return;

    try {
      setStep('importing');
      setError(null);

      const result = await bulkImport.mutateAsync({
        function_id: functionId,
        year: parsedData.year || year,
        areas: parsedData.areas,
        initiatives: parsedData.initiatives,
        quarterly_objectives: parsedData.quarterly_objectives,
        bonus_kpis: parsedData.bonus_kpis,
      });

      toast.success(
        `Successfully imported: ${result.areasCreated} areas, ${result.initiativesCreated} initiatives, ${result.objectivesCreated} quarterly objectives, ${result.kpisCreated} KPIs`
      );
      onImportComplete();
    } catch (err: any) {
      console.error('Import error:', err);
      setError(err.message || 'Failed to import data');
      setStep('review');
      toast.error(err.message || 'Failed to import data');
    }
  };

  const renderUploadStep = () => (
    <div className="p-6 space-y-4">
      <div className="text-center">
        <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
          <FileText className="w-8 h-8 text-blue-600" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          Upload Operating Plan
        </h3>
        <p className="text-sm text-gray-600 mb-6">
          Upload a PDF, Word document, Excel file, or image of your strategic plan.
          AI will extract and structure the information for you.
        </p>
      </div>

      {/* File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.doc,.docx,.xls,.xlsx,image/jpeg,image/png,image/jpg"
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* Selected File Display */}
      {selectedFile && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FileText className="w-5 h-5 text-gray-600" />
            <div>
              <p className="text-sm font-medium text-gray-900">{selectedFile.name}</p>
              <p className="text-xs text-gray-500">
                {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
              </p>
            </div>
          </div>
          <button
            onClick={() => setSelectedFile(null)}
            className="p-1 hover:bg-gray-200 rounded transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center gap-2">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span className="text-sm">{error}</span>
        </div>
      )}

      {/* Upload Button */}
      <div className="space-y-3">
        {!selectedFile ? (
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Upload className="w-5 h-5" />
            Choose File
          </button>
        ) : (
          <button
            onClick={handleUpload}
            className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            <CheckCircle className="w-5 h-5" />
            Process Document
          </button>
        )}
      </div>

      <div className="text-xs text-gray-500 text-center space-y-1">
        <p>Supported formats: PDF, Word (.doc, .docx), Excel (.xls, .xlsx), Images (JPG, PNG)</p>
        <p>Maximum file size: 10MB</p>
      </div>
    </div>
  );

  const renderProcessingStep = () => (
    <div className="p-12 text-center">
      <div className="mx-auto w-16 h-16 mb-4">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600"></div>
      </div>
      <h3 className="text-lg font-semibold text-gray-900 mb-2">
        {step === 'extracting' && 'Extracting text from document...'}
        {step === 'parsing' && 'Analyzing with AI...'}
        {step === 'importing' && 'Importing data...'}
      </h3>
      <p className="text-sm text-gray-600">
        {step === 'extracting' && 'Reading your document and extracting text content.'}
        {step === 'parsing' && 'Claude is analyzing and structuring your operating plan.'}
        {step === 'importing' && 'Saving all areas, initiatives, objectives, and KPIs.'}
      </p>
    </div>
  );

  const renderReviewStep = () => {
    if (!parsedData) return null;

    return (
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Review Extracted Data
          </h3>
          <p className="text-sm text-gray-600">
            Review and edit the extracted information before importing.
          </p>

          {/* Confidence Scores */}
          <div className="mt-4 grid grid-cols-5 gap-2">
            {Object.entries(parsedData.confidence).map(([key, value]) => (
              <div key={key} className="bg-gray-50 rounded px-2 py-1">
                <p className="text-xs text-gray-600 capitalize">
                  {key.replace('_', ' ')}
                </p>
                <p className={`text-sm font-semibold ${
                  value >= 80 ? 'text-green-600' : value >= 60 ? 'text-yellow-600' : 'text-red-600'
                }`}>
                  {value}%
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6 space-y-4">
          {/* Year */}
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-gray-900">Plan Year</h4>
              <input
                type="number"
                value={parsedData.year || year}
                onChange={(e) => {
                  if (parsedData) {
                    setParsedData({ ...parsedData, year: Number(e.target.value) });
                  }
                }}
                className="px-3 py-1 border border-gray-300 rounded text-sm"
              />
            </div>
          </div>

          {/* Areas */}
          <div className="bg-white border border-gray-200 rounded-lg">
            <button
              onClick={() => toggleSection('areas')}
              className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-2">
                {collapsedSections.has('areas') ? (
                  <ChevronRight className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
                <h4 className="font-semibold text-gray-900">
                  Areas ({parsedData.areas.length})
                </h4>
              </div>
            </button>
            {!collapsedSections.has('areas') && (
              <div className="border-t border-gray-200 p-4 space-y-3">
                {parsedData.areas.map((area, idx) => (
                  <div key={idx} className="border border-gray-200 rounded-lg p-3">
                    <input
                      type="text"
                      value={area.name}
                      onChange={(e) => {
                        const newAreas = [...parsedData.areas];
                        newAreas[idx].name = e.target.value;
                        setParsedData({ ...parsedData, areas: newAreas });
                      }}
                      className="w-full px-2 py-1 border border-gray-300 rounded text-sm font-medium mb-2"
                      placeholder="Area name"
                    />
                    <textarea
                      value={area.strategic_description || ''}
                      onChange={(e) => {
                        const newAreas = [...parsedData.areas];
                        newAreas[idx].strategic_description = e.target.value;
                        setParsedData({ ...parsedData, areas: newAreas });
                      }}
                      className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                      placeholder="Strategic description..."
                      rows={2}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Initiatives */}
          <div className="bg-white border border-gray-200 rounded-lg">
            <button
              onClick={() => toggleSection('initiatives')}
              className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-2">
                {collapsedSections.has('initiatives') ? (
                  <ChevronRight className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
                <h4 className="font-semibold text-gray-900">
                  Initiatives ({parsedData.initiatives.length})
                </h4>
              </div>
            </button>
            {!collapsedSections.has('initiatives') && (
              <div className="border-t border-gray-200 p-4 space-y-3">
                {parsedData.initiatives.map((initiative, idx) => (
                  <div key={idx} className="border border-gray-200 rounded-lg p-3 space-y-2">
                    <input
                      type="text"
                      value={initiative.area_name}
                      onChange={(e) => {
                        const newInitiatives = [...parsedData.initiatives];
                        newInitiatives[idx].area_name = e.target.value;
                        setParsedData({ ...parsedData, initiatives: newInitiatives });
                      }}
                      className="w-full px-2 py-1 border border-gray-300 rounded text-xs text-gray-600"
                      placeholder="Area name"
                    />
                    <input
                      type="text"
                      value={initiative.title}
                      onChange={(e) => {
                        const newInitiatives = [...parsedData.initiatives];
                        newInitiatives[idx].title = e.target.value;
                        setParsedData({ ...parsedData, initiatives: newInitiatives });
                      }}
                      className="w-full px-2 py-1 border border-gray-300 rounded text-sm font-medium"
                      placeholder="Initiative title"
                    />
                    <textarea
                      value={initiative.description || ''}
                      onChange={(e) => {
                        const newInitiatives = [...parsedData.initiatives];
                        newInitiatives[idx].description = e.target.value;
                        setParsedData({ ...parsedData, initiatives: newInitiatives });
                      }}
                      className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                      placeholder="Description..."
                      rows={2}
                    />
                    <input
                      type="text"
                      value={initiative.annual_target || ''}
                      onChange={(e) => {
                        const newInitiatives = [...parsedData.initiatives];
                        newInitiatives[idx].annual_target = e.target.value;
                        setParsedData({ ...parsedData, initiatives: newInitiatives });
                      }}
                      className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                      placeholder="Annual target"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quarterly Objectives */}
          {parsedData.quarterly_objectives.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-lg">
              <button
                onClick={() => toggleSection('quarterly')}
                className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  {collapsedSections.has('quarterly') ? (
                    <ChevronRight className="w-4 h-4" />
                  ) : (
                    <ChevronDown className="w-4 h-4" />
                  )}
                  <h4 className="font-semibold text-gray-900">
                    Quarterly Objectives ({parsedData.quarterly_objectives.length})
                  </h4>
                </div>
              </button>
              {!collapsedSections.has('quarterly') && (
                <div className="border-t border-gray-200 p-4 space-y-3">
                  {parsedData.quarterly_objectives.map((obj, idx) => (
                    <div key={idx} className="border border-gray-200 rounded-lg p-3 space-y-2">
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={obj.initiative_title}
                          onChange={(e) => {
                            const newObjs = [...parsedData.quarterly_objectives];
                            newObjs[idx].initiative_title = e.target.value;
                            setParsedData({ ...parsedData, quarterly_objectives: newObjs });
                          }}
                          className="flex-1 px-2 py-1 border border-gray-300 rounded text-xs text-gray-600"
                          placeholder="Initiative title"
                        />
                        <select
                          value={obj.quarter}
                          onChange={(e) => {
                            const newObjs = [...parsedData.quarterly_objectives];
                            newObjs[idx].quarter = Number(e.target.value);
                            setParsedData({ ...parsedData, quarterly_objectives: newObjs });
                          }}
                          className="px-2 py-1 border border-gray-300 rounded text-xs"
                        >
                          <option value={1}>Q1</option>
                          <option value={2}>Q2</option>
                          <option value={3}>Q3</option>
                          <option value={4}>Q4</option>
                        </select>
                      </div>
                      <textarea
                        value={obj.objective}
                        onChange={(e) => {
                          const newObjs = [...parsedData.quarterly_objectives];
                          newObjs[idx].objective = e.target.value;
                          setParsedData({ ...parsedData, quarterly_objectives: newObjs });
                        }}
                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                        placeholder="Objective..."
                        rows={2}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Bonus KPIs */}
          {parsedData.bonus_kpis.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-lg">
              <button
                onClick={() => toggleSection('kpis')}
                className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  {collapsedSections.has('kpis') ? (
                    <ChevronRight className="w-4 h-4" />
                  ) : (
                    <ChevronDown className="w-4 h-4" />
                  )}
                  <h4 className="font-semibold text-gray-900">
                    Bonus KPIs ({parsedData.bonus_kpis.length})
                  </h4>
                </div>
              </button>
              {!collapsedSections.has('kpis') && (
                <div className="border-t border-gray-200 p-4 space-y-3">
                  {parsedData.bonus_kpis.map((kpi, idx) => (
                    <div key={idx} className="border border-gray-200 rounded-lg p-3 space-y-2">
                      <input
                        type="text"
                        value={kpi.name}
                        onChange={(e) => {
                          const newKPIs = [...parsedData.bonus_kpis];
                          newKPIs[idx].name = e.target.value;
                          setParsedData({ ...parsedData, bonus_kpis: newKPIs });
                        }}
                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm font-medium"
                        placeholder="KPI name"
                      />
                      <textarea
                        value={kpi.description || ''}
                        onChange={(e) => {
                          const newKPIs = [...parsedData.bonus_kpis];
                          newKPIs[idx].description = e.target.value;
                          setParsedData({ ...parsedData, bonus_kpis: newKPIs });
                        }}
                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                        placeholder="Description..."
                        rows={2}
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <select
                          value={kpi.unit}
                          onChange={(e) => {
                            const newKPIs = [...parsedData.bonus_kpis];
                            newKPIs[idx].unit = e.target.value as any;
                            setParsedData({ ...parsedData, bonus_kpis: newKPIs });
                          }}
                          className="px-2 py-1 border border-gray-300 rounded text-sm"
                        >
                          <option value="dollars">Dollars</option>
                          <option value="percent">Percent</option>
                          <option value="score">Score</option>
                          <option value="count">Count</option>
                          <option value="text">Text</option>
                        </select>
                        {kpi.unit !== 'text' ? (
                          <input
                            type="number"
                            value={kpi.target_value || ''}
                            onChange={(e) => {
                              const newKPIs = [...parsedData.bonus_kpis];
                              newKPIs[idx].target_value = Number(e.target.value);
                              setParsedData({ ...parsedData, bonus_kpis: newKPIs });
                            }}
                            className="px-2 py-1 border border-gray-300 rounded text-sm"
                            placeholder="Target value"
                          />
                        ) : (
                          <input
                            type="text"
                            value={kpi.target_text || ''}
                            onChange={(e) => {
                              const newKPIs = [...parsedData.bonus_kpis];
                              newKPIs[idx].target_text = e.target.value;
                              setParsedData({ ...parsedData, bonus_kpis: newKPIs });
                            }}
                            className="px-2 py-1 border border-gray-300 rounded text-sm"
                            placeholder="Target text"
                          />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 p-6 flex justify-end gap-3">
          <button
            onClick={() => {
              setStep('upload');
              setParsedData(null);
            }}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleImport}
            className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
          >
            <CheckCircle className="w-5 h-5" />
            Import Data
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">Import Operating Plan</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {step === 'upload' && renderUploadStep()}
          {(step === 'extracting' || step === 'parsing' || step === 'importing') &&
            renderProcessingStep()}
          {step === 'review' && renderReviewStep()}
        </div>
      </div>
    </div>
  );
}
