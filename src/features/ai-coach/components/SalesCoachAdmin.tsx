import { useState, useEffect, useRef } from 'react';
import { Plus, Trash2, Save, BookOpen, Settings, ArrowLeft, Mic, Upload, Loader2, Sparkles, AlertCircle } from 'lucide-react';
import { getSalesProcesses, saveSalesProcess, deleteSalesProcess, getKnowledgeBase, saveKnowledgeBase, getAllRecordingsForAdmin, deleteRecordingAdmin, type SalesProcess, type KnowledgeBase, type Recording } from '../lib/recordings';
import { supabase } from '../../../lib/supabase';
import { showSuccess, showError } from '../../../lib/toast';
import { usePermission } from '../../../contexts/PermissionContext';
import * as pdfjsLib from 'pdfjs-dist';
import mammoth from 'mammoth';
import * as XLSX from 'xlsx';

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

interface SalesCoachAdminProps {
  onBack: () => void;
}

export default function SalesCoachAdmin({ onBack }: SalesCoachAdminProps) {
  const { hasPermission } = usePermission();
  const [activeTab, setActiveTab] = useState<'processes' | 'knowledge' | 'recordings'>('processes');
  const [processes, setProcesses] = useState<SalesProcess[]>([]);
  const [selectedProcess, setSelectedProcess] = useState<SalesProcess | null>(null);
  const [knowledgeBase, setKnowledgeBase] = useState<KnowledgeBase>({
    companyInfo: '',
    products: [],
    commonObjections: [],
    bestPractices: [],
    industryContext: ''
  });
  const [allRecordings, setAllRecordings] = useState<Recording[]>([]);
  const [userProfiles, setUserProfiles] = useState<Map<string, string>>(new Map());

  // For editing
  const [editingProcess, setEditingProcess] = useState(false);
  const [newProduct, setNewProduct] = useState('');
  const [newObjection, setNewObjection] = useState('');
  const [newBestPractice, setNewBestPractice] = useState('');

  // For file upload
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [parsedSuggestions, setParsedSuggestions] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadProcesses();
    loadKnowledgeBase();
    loadAllRecordings();
  }, []);

  const loadAllRecordings = async () => {
    // Load ALL recordings from ALL users in the database
    const recordings = await getAllRecordingsForAdmin();
    setAllRecordings(recordings);

    // Fetch user profiles for all unique user IDs
    const userIds = [...new Set(recordings.map(r => r.userId).filter(Boolean))];
    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from('user_profiles')
        .select('id, full_name')
        .in('id', userIds);

      if (profiles) {
        const profileMap = new Map<string, string>();
        profiles.forEach(p => profileMap.set(p.id, p.full_name));
        setUserProfiles(profileMap);
      }
    }
  };

  const loadProcesses = async () => {
    const procs = await getSalesProcesses();
    setProcesses(procs);
  };

  const loadKnowledgeBase = async () => {
    const kb = await getKnowledgeBase();
    setKnowledgeBase(kb);
  };

  const createNewProcess = () => {
    const newProcess: SalesProcess = {
      id: `proc_${Date.now()}`,
      name: 'New Sales Process',
      steps: [
        {
          name: 'Step 1',
          description: 'Description',
          keyBehaviors: ['Behavior 1']
        }
      ],
      createdAt: new Date().toISOString(),
      createdBy: 'Admin'
    };
    setSelectedProcess(newProcess);
    setEditingProcess(true);
  };

  const saveCurrentProcess = () => {
    if (!selectedProcess) return;
    saveSalesProcess(selectedProcess);
    loadProcesses();
    setEditingProcess(false);
    showSuccess('Process saved successfully!');
  };

  const deleteProcess = (id: string) => {
    // Prevent deleting default process
    if (id === 'standard') {
      showSuccess('Cannot delete the default sales process');
      return;
    }

    // Only admin can delete
    if (!hasPermission('manage_settings')) {
      showSuccess('Only admins can delete sales processes');
      return;
    }

    if (confirm('Are you sure you want to delete this process?')) {
      deleteSalesProcess(id);
      loadProcesses();
      if (selectedProcess?.id === id) {
        setSelectedProcess(null);
      }
    }
  };

  const addStep = () => {
    if (!selectedProcess) return;
    setSelectedProcess({
      ...selectedProcess,
      steps: [
        ...selectedProcess.steps,
        {
          name: `Step ${selectedProcess.steps.length + 1}`,
          description: 'Description',
          keyBehaviors: ['Behavior 1']
        }
      ]
    });
  };

  const updateStep = (stepIdx: number, field: 'name' | 'description', value: string) => {
    if (!selectedProcess) return;
    const newSteps = [...selectedProcess.steps];
    newSteps[stepIdx] = { ...newSteps[stepIdx], [field]: value };
    setSelectedProcess({ ...selectedProcess, steps: newSteps });
  };

  const addBehavior = (stepIdx: number) => {
    if (!selectedProcess) return;
    const newSteps = [...selectedProcess.steps];
    newSteps[stepIdx].keyBehaviors.push('New behavior');
    setSelectedProcess({ ...selectedProcess, steps: newSteps });
  };

  const updateBehavior = (stepIdx: number, behaviorIdx: number, value: string) => {
    if (!selectedProcess) return;
    const newSteps = [...selectedProcess.steps];
    newSteps[stepIdx].keyBehaviors[behaviorIdx] = value;
    setSelectedProcess({ ...selectedProcess, steps: newSteps });
  };

  const removeBehavior = (stepIdx: number, behaviorIdx: number) => {
    if (!selectedProcess) return;
    const newSteps = [...selectedProcess.steps];
    newSteps[stepIdx].keyBehaviors.splice(behaviorIdx, 1);
    setSelectedProcess({ ...selectedProcess, steps: newSteps });
  };

  const removeStep = (stepIdx: number) => {
    if (!selectedProcess) return;
    const newSteps = [...selectedProcess.steps];
    newSteps.splice(stepIdx, 1);
    setSelectedProcess({ ...selectedProcess, steps: newSteps });
  };

  const saveKnowledgeBaseChanges = () => {
    saveKnowledgeBase(knowledgeBase);
    showSuccess('Knowledge base saved successfully!');
  };

  const addArrayItem = (field: 'products' | 'commonObjections' | 'bestPractices', value: string) => {
    if (!value.trim()) return;
    setKnowledgeBase({
      ...knowledgeBase,
      [field]: [...knowledgeBase[field], value.trim()]
    });

    // Reset input
    if (field === 'products') setNewProduct('');
    if (field === 'commonObjections') setNewObjection('');
    if (field === 'bestPractices') setNewBestPractice('');
  };

  const removeArrayItem = (field: 'products' | 'commonObjections' | 'bestPractices', index: number) => {
    const newArray = [...knowledgeBase[field]];
    newArray.splice(index, 1);
    setKnowledgeBase({
      ...knowledgeBase,
      [field]: newArray
    });
  };

  // File upload handlers for Knowledge Base
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

  const extractTextFromExcel = async (file: File): Promise<string> => {
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    let fullText = '';

    workbook.SheetNames.forEach((sheetName, index) => {
      const worksheet = workbook.Sheets[sheetName];
      fullText += `\n\n=== Sheet ${index + 1}: ${sheetName} ===\n\n`;
      const sheetText = XLSX.utils.sheet_to_csv(worksheet, { FS: '\t' });
      fullText += sheetText;
    });

    return fullText;
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const validTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/plain',
      'image/jpeg',
      'image/png',
      'image/jpg',
    ];

    if (!validTypes.includes(file.type)) {
      setUploadError('Please select a PDF, Word, Excel, text file, or image');
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      setUploadError('File must be less than 10MB');
      return;
    }

    setIsUploading(true);
    setUploadError(null);

    try {
      let documentText = '';
      let documentType = '';
      let isImage = false;
      let imageData = '';

      // Extract text based on file type
      if (file.type === 'application/pdf') {
        documentType = 'PDF document';
        documentText = await extractTextFromPDF(file);
      } else if (
        file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
        file.type === 'application/msword'
      ) {
        documentType = 'Word document';
        documentText = await extractTextFromWord(file);
      } else if (
        file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
        file.type === 'application/vnd.ms-excel'
      ) {
        documentType = 'Excel spreadsheet';
        documentText = await extractTextFromExcel(file);
      } else if (file.type === 'text/plain') {
        documentType = 'text file';
        documentText = await file.text();
      } else if (file.type.startsWith('image/')) {
        documentType = 'image';
        isImage = true;
        const reader = new FileReader();
        imageData = await new Promise<string>((resolve, reject) => {
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
      }

      // Send to AI for parsing
      const response = await fetch('/.netlify/functions/parse-knowledge-base', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentText,
          documentType,
          isImage,
          imageData,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to parse document');
      }

      const parsed = await response.json();

      // Merge parsed content with existing knowledge base
      setKnowledgeBase(prev => ({
        companyInfo: prev.companyInfo
          ? `${prev.companyInfo}\n\n--- Imported from ${file.name} ---\n${parsed.companyInfo || ''}`
          : parsed.companyInfo || '',
        products: [...prev.products, ...(parsed.products || [])],
        commonObjections: [...prev.commonObjections, ...(parsed.commonObjections || [])],
        bestPractices: [...prev.bestPractices, ...(parsed.bestPractices || [])],
        industryContext: prev.industryContext
          ? `${prev.industryContext}\n\n--- Imported from ${file.name} ---\n${parsed.industryContext || ''}`
          : parsed.industryContext || '',
        lastUpdated: prev.lastUpdated,
        updatedBy: prev.updatedBy,
      }));

      // Store suggestions
      if (parsed.suggestions) {
        setParsedSuggestions(parsed.suggestions);
      }

      showSuccess(`Successfully imported knowledge from ${file.name}`);
    } catch (error) {
      console.error('File upload error:', error);
      setUploadError(error instanceof Error ? error.message : 'Failed to process file');
      showError('Failed to import document');
    } finally {
      setIsUploading(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={onBack}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Sales Coach Admin</h1>
                <p className="text-xs text-gray-600">Manage processes and knowledge base</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="px-4 mt-4">
        <div className="flex gap-4 border-b border-gray-200">
          <button
            onClick={() => setActiveTab('processes')}
            className={`px-4 py-2 font-medium ${
              activeTab === 'processes'
                ? 'text-purple-600 border-b-2 border-purple-600'
                : 'text-gray-600'
            }`}
          >
            <Settings className="inline w-4 h-4 mr-2" />
            Sales Processes
          </button>
          <button
            onClick={() => setActiveTab('knowledge')}
            className={`px-4 py-2 font-medium ${
              activeTab === 'knowledge'
                ? 'text-purple-600 border-b-2 border-purple-600'
                : 'text-gray-600'
            }`}
          >
            <BookOpen className="inline w-4 h-4 mr-2" />
            Knowledge Base
          </button>
          <button
            onClick={() => setActiveTab('recordings')}
            className={`px-4 py-2 font-medium ${
              activeTab === 'recordings'
                ? 'text-purple-600 border-b-2 border-purple-600'
                : 'text-gray-600'
            }`}
          >
            <Mic className="inline w-4 h-4 mr-2" />
            Manage Recordings
            {allRecordings.length > 0 && (
              <span className="ml-2 bg-purple-100 text-purple-800 px-2 py-0.5 rounded-full text-xs font-bold">
                {allRecordings.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="px-4 py-6 pb-24">
        {activeTab === 'processes' && (
          <div className="space-y-4">
            {/* Process List */}
            <div className="bg-white rounded-xl p-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold">Sales Processes</h2>
                <button
                  onClick={createNewProcess}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg font-semibold hover:bg-purple-700 flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  New Process
                </button>
              </div>

              <div className="space-y-2">
                {processes.map(proc => (
                  <div
                    key={proc.id}
                    className={`border rounded-lg p-4 cursor-pointer hover:bg-gray-50 ${
                      selectedProcess?.id === proc.id ? 'border-purple-600 bg-purple-50' : ''
                    }`}
                    onClick={() => {
                      setSelectedProcess(proc);
                      setEditingProcess(false);
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold">
                          {proc.name}
                          {proc.id === 'standard' && (
                            <span className="ml-2 text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">Default</span>
                          )}
                        </h3>
                        <p className="text-sm text-gray-600">{proc.steps.length} steps</p>
                      </div>
                      {/* Only show delete button for non-default processes and admin role */}
                      {proc.id !== 'standard' && hasPermission('manage_settings') && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteProcess(proc.id);
                          }}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Process Editor */}
            {selectedProcess && (
              <div className="bg-white rounded-xl p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-bold">
                    {editingProcess ? 'Edit Process' : selectedProcess.name}
                  </h2>
                  <div className="flex gap-2">
                    {!editingProcess ? (
                      <button
                        onClick={() => setEditingProcess(true)}
                        className="px-4 py-2 bg-purple-600 text-white rounded-lg font-semibold hover:bg-purple-700"
                      >
                        Edit
                      </button>
                    ) : (
                      <>
                        <button
                          onClick={() => {
                            setEditingProcess(false);
                            loadProcesses();
                          }}
                          className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={saveCurrentProcess}
                          className="px-4 py-2 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 flex items-center gap-2"
                        >
                          <Save className="w-4 h-4" />
                          Save
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {editingProcess && (
                  <div className="mb-6">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Process Name</label>
                    <input
                      type="text"
                      value={selectedProcess.name}
                      onChange={(e) => setSelectedProcess({ ...selectedProcess, name: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    />
                  </div>
                )}

                {/* Steps */}
                <div className="space-y-4">
                  {selectedProcess.steps.map((step, stepIdx) => (
                    <div key={stepIdx} className="border rounded-lg p-4 bg-gray-50">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          {editingProcess ? (
                            <>
                              <input
                                type="text"
                                value={step.name}
                                onChange={(e) => updateStep(stepIdx, 'name', e.target.value)}
                                className="w-full font-semibold border border-gray-300 rounded-lg px-3 py-2 mb-2"
                              />
                              <textarea
                                value={step.description}
                                onChange={(e) => updateStep(stepIdx, 'description', e.target.value)}
                                rows={2}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                              />
                            </>
                          ) : (
                            <>
                              <h3 className="font-semibold text-lg mb-1">{stepIdx + 1}. {step.name}</h3>
                              <p className="text-sm text-gray-600">{step.description}</p>
                            </>
                          )}
                        </div>
                        {editingProcess && (
                          <button
                            onClick={() => removeStep(stepIdx)}
                            className="ml-2 p-2 text-red-600 hover:bg-red-50 rounded-lg"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>

                      {/* Key Behaviors */}
                      <div className="ml-4">
                        <h4 className="text-sm font-semibold text-gray-700 mb-2">Key Behaviors:</h4>
                        <ul className="space-y-2">
                          {step.keyBehaviors.map((behavior, behaviorIdx) => (
                            <li key={behaviorIdx} className="flex items-center gap-2">
                              {editingProcess ? (
                                <>
                                  <input
                                    type="text"
                                    value={behavior}
                                    onChange={(e) => updateBehavior(stepIdx, behaviorIdx, e.target.value)}
                                    className="flex-1 border border-gray-300 rounded-lg px-3 py-1 text-sm"
                                  />
                                  <button
                                    onClick={() => removeBehavior(stepIdx, behaviorIdx)}
                                    className="p-1 text-red-600 hover:bg-red-50 rounded"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </>
                              ) : (
                                <span className="text-sm text-gray-700">• {behavior}</span>
                              )}
                            </li>
                          ))}
                        </ul>
                        {editingProcess && (
                          <button
                            onClick={() => addBehavior(stepIdx)}
                            className="mt-2 text-sm text-purple-600 hover:text-purple-700 font-medium"
                          >
                            + Add Behavior
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {editingProcess && (
                  <button
                    onClick={addStep}
                    className="mt-4 w-full py-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-purple-600 hover:text-purple-600 font-medium"
                  >
                    + Add Step
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === 'knowledge' && (
          <div className="bg-white rounded-xl p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold">Knowledge Base</h2>
                <p className="text-sm text-gray-600">This information will be used to provide context to the AI coach</p>
              </div>
              <button
                onClick={saveKnowledgeBaseChanges}
                className="px-4 py-2 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                Save Changes
              </button>
            </div>

            {/* AI Document Import */}
            <div className="mb-8 p-4 bg-gradient-to-r from-purple-50 to-blue-50 rounded-xl border border-purple-200">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <Sparkles className="w-6 h-6 text-purple-600" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-purple-900 mb-1">AI-Powered Document Import</h3>
                  <p className="text-sm text-purple-700 mb-3">
                    Upload a company handbook, sales guide, or any document and AI will automatically extract relevant knowledge base information.
                  </p>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.jpg,.jpeg,.png"
                    onChange={handleFileUpload}
                    className="hidden"
                    disabled={isUploading}
                  />

                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                    className={`px-4 py-2 rounded-lg font-semibold flex items-center gap-2 ${
                      isUploading
                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        : 'bg-purple-600 text-white hover:bg-purple-700'
                    }`}
                  >
                    {isUploading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <Upload className="w-4 h-4" />
                        Upload Document
                      </>
                    )}
                  </button>

                  <p className="text-xs text-purple-600 mt-2">
                    Supports PDF, Word, Excel, text files, and images (max 10MB)
                  </p>

                  {uploadError && (
                    <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
                      <p className="text-sm text-red-700">{uploadError}</p>
                    </div>
                  )}

                  {parsedSuggestions.length > 0 && (
                    <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <p className="text-sm font-medium text-blue-900 mb-2">AI Suggestions for improvement:</p>
                      <ul className="text-sm text-blue-700 space-y-1">
                        {parsedSuggestions.map((suggestion, idx) => (
                          <li key={idx} className="flex items-start gap-2">
                            <span className="text-blue-400">•</span>
                            {suggestion}
                          </li>
                        ))}
                      </ul>
                      <button
                        onClick={() => setParsedSuggestions([])}
                        className="mt-2 text-xs text-blue-600 hover:text-blue-800"
                      >
                        Dismiss suggestions
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-6">
              {/* Company Info */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Company Information</label>
                <textarea
                  value={knowledgeBase.companyInfo}
                  onChange={(e) => setKnowledgeBase({ ...knowledgeBase, companyInfo: e.target.value })}
                  rows={4}
                  placeholder="Describe your company, mission, values, unique selling points..."
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                />
              </div>

              {/* Products */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Products/Services</label>
                <div className="flex gap-2 mb-3">
                  <input
                    type="text"
                    value={newProduct}
                    onChange={(e) => setNewProduct(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && addArrayItem('products', newProduct)}
                    placeholder="Add a product or service..."
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-2"
                  />
                  <button
                    onClick={() => addArrayItem('products', newProduct)}
                    className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
                <div className="space-y-2">
                  {knowledgeBase.products.map((product, idx) => (
                    <div key={idx} className="flex items-center justify-between bg-gray-50 rounded-lg p-3">
                      <span className="text-sm">{product}</span>
                      <button
                        onClick={() => removeArrayItem('products', idx)}
                        className="p-1 text-red-600 hover:bg-red-50 rounded"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Common Objections */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Common Objections & Responses</label>
                <div className="flex gap-2 mb-3">
                  <input
                    type="text"
                    value={newObjection}
                    onChange={(e) => setNewObjection(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && addArrayItem('commonObjections', newObjection)}
                    placeholder="Add objection and response..."
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-2"
                  />
                  <button
                    onClick={() => addArrayItem('commonObjections', newObjection)}
                    className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
                <div className="space-y-2">
                  {knowledgeBase.commonObjections.map((objection, idx) => (
                    <div key={idx} className="flex items-center justify-between bg-gray-50 rounded-lg p-3">
                      <span className="text-sm">{objection}</span>
                      <button
                        onClick={() => removeArrayItem('commonObjections', idx)}
                        className="p-1 text-red-600 hover:bg-red-50 rounded"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Best Practices */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Best Practices</label>
                <div className="flex gap-2 mb-3">
                  <input
                    type="text"
                    value={newBestPractice}
                    onChange={(e) => setNewBestPractice(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && addArrayItem('bestPractices', newBestPractice)}
                    placeholder="Add a best practice..."
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-2"
                  />
                  <button
                    onClick={() => addArrayItem('bestPractices', newBestPractice)}
                    className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
                <div className="space-y-2">
                  {knowledgeBase.bestPractices.map((practice, idx) => (
                    <div key={idx} className="flex items-center justify-between bg-gray-50 rounded-lg p-3">
                      <span className="text-sm">{practice}</span>
                      <button
                        onClick={() => removeArrayItem('bestPractices', idx)}
                        className="p-1 text-red-600 hover:bg-red-50 rounded"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Industry Context */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Industry Context</label>
                <textarea
                  value={knowledgeBase.industryContext}
                  onChange={(e) => setKnowledgeBase({ ...knowledgeBase, industryContext: e.target.value })}
                  rows={4}
                  placeholder="Industry-specific information, market trends, competitive landscape..."
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                />
              </div>

              {knowledgeBase.lastUpdated && (
                <div className="text-xs text-gray-500 text-right">
                  Last updated: {new Date(knowledgeBase.lastUpdated).toLocaleString()}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'recordings' && (
          <div className="bg-white rounded-xl p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold">Manage All Recordings</h2>
                <p className="text-sm text-gray-600">View and delete recordings from all users</p>
              </div>
            </div>

            {allRecordings.length === 0 ? (
              <div className="text-center py-12">
                <Mic className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-600">No recordings yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {allRecordings.map(recording => (
                  <div key={recording.id} className="border rounded-lg p-4 hover:bg-gray-50">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="font-semibold">{recording.clientName}</h3>
                          <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                            recording.status === 'completed' ? 'bg-green-100 text-green-800' :
                            recording.status === 'transcribing' ? 'bg-blue-100 text-blue-800' :
                            recording.status === 'analyzing' ? 'bg-purple-100 text-purple-800' :
                            recording.status === 'failed' ? 'bg-red-100 text-red-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {recording.status}
                          </span>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-gray-600">
                          <span className="text-blue-600 font-medium">
                            {userProfiles.get(recording.userId) || 'Unknown User'}
                          </span>
                          <span>{recording.meetingDate}</span>
                          {recording.duration && <span>{recording.duration}</span>}
                          {recording.analysis && (
                            <span className="font-semibold text-purple-600">
                              Score: {recording.analysis.overallScore}%
                            </span>
                          )}
                        </div>
                        {recording.error && (
                          <div className="mt-2 text-sm text-red-600">
                            Error: {recording.error}
                          </div>
                        )}
                      </div>
                      <button
                        onClick={async () => {
                          if (confirm(`Delete recording for ${recording.clientName}?`)) {
                            const success = await deleteRecordingAdmin(recording.id);
                            if (success) {
                              showSuccess('Recording deleted');
                              loadAllRecordings();
                            }
                          }
                        }}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
