import { useState, useEffect } from 'react';
import { Plus, Trash2, Save, BookOpen, Settings, ArrowLeft, Mic } from 'lucide-react';
import { getSalesProcesses, saveSalesProcess, deleteSalesProcess, getKnowledgeBase, saveKnowledgeBase, getRecordings, deleteRecording, type SalesProcess, type KnowledgeBase, type Recording } from '../../lib/recordings';

interface SalesCoachAdminProps {
  onBack: () => void;
}

export default function SalesCoachAdmin({ onBack }: SalesCoachAdminProps) {
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

  // For editing
  const [editingProcess, setEditingProcess] = useState(false);
  const [newProduct, setNewProduct] = useState('');
  const [newObjection, setNewObjection] = useState('');
  const [newBestPractice, setNewBestPractice] = useState('');

  useEffect(() => {
    loadProcesses();
    loadKnowledgeBase();
    loadAllRecordings();
  }, []);

  const loadAllRecordings = () => {
    // Load recordings from all users (in production, this would be from a database)
    const recordings = getRecordings('user123'); // For now, just user123
    setAllRecordings(recordings);
  };

  const loadProcesses = () => {
    const procs = getSalesProcesses();
    setProcesses(procs);
  };

  const loadKnowledgeBase = () => {
    const kb = getKnowledgeBase();
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
    alert('Process saved successfully!');
  };

  const deleteProcess = (id: string) => {
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
    alert('Knowledge base saved successfully!');
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
                        <h3 className="font-semibold">{proc.name}</h3>
                        <p className="text-sm text-gray-600">{proc.steps.length} steps</p>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteProcess(proc.id);
                        }}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
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
                        onClick={() => {
                          if (confirm(`Delete recording for ${recording.clientName}?`)) {
                            deleteRecording('user123', recording.id);
                            loadAllRecordings();
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
