import { useState } from 'react';
import { ArrowLeft, Plus, Folder } from 'lucide-react';
import { useFunctionsQuery, useCreateFunction, useBucketsQuery, useCreateBucket } from '../../hooks/useLeadershipQuery';
import type { CreateFunctionInput, CreateBucketInput } from '../../lib/leadership';

interface FunctionSettingsProps {
  onBack: () => void;
}

export default function FunctionSettings({ onBack }: FunctionSettingsProps) {
  const [selectedFunctionId, setSelectedFunctionId] = useState<string | null>(null);
  const [isCreatingFunction, setIsCreatingFunction] = useState(false);
  const [isCreatingBucket, setIsCreatingBucket] = useState(false);

  const { data: functions, isLoading: functionsLoading } = useFunctionsQuery();
  const { data: buckets, isLoading: bucketsLoading } = useBucketsQuery(selectedFunctionId || undefined);
  const createFunction = useCreateFunction();
  const createBucket = useCreateBucket();

  const [functionForm, setFunctionForm] = useState<CreateFunctionInput>({
    name: '',
    description: '',
    color: 'blue',
    sort_order: 0,
  });

  const [bucketForm, setBucketForm] = useState<CreateBucketInput>({
    function_id: '',
    name: '',
    description: '',
    sort_order: 0,
  });

  const handleCreateFunction = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createFunction.mutateAsync(functionForm);
      setIsCreatingFunction(false);
      setFunctionForm({ name: '', description: '', color: 'blue', sort_order: 0 });
    } catch (error) {
      console.error('Failed to create function:', error);
    }
  };

  const handleCreateBucket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFunctionId) return;

    try {
      await createBucket.mutateAsync({
        ...bucketForm,
        function_id: selectedFunctionId,
      });
      setIsCreatingBucket(false);
      setBucketForm({ function_id: '', name: '', description: '', sort_order: 0 });
    } catch (error) {
      console.error('Failed to create bucket:', error);
    }
  };

  if (functionsLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading functions...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Functions & Buckets</h1>
              <p className="text-sm text-gray-600">Manage organizational structure</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-2 gap-6">
          {/* Functions List */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900">Functions</h2>
              <button
                onClick={() => setIsCreatingFunction(true)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
              >
                <Plus className="w-4 h-4" />
                Add Function
              </button>
            </div>

            {/* Create Function Form */}
            {isCreatingFunction && (
              <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 mb-4">
                <h3 className="font-semibold text-gray-900 mb-3">Create New Function</h3>
                <form onSubmit={handleCreateFunction} className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Name *
                    </label>
                    <input
                      type="text"
                      value={functionForm.name}
                      onChange={(e) => setFunctionForm({ ...functionForm, name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Description
                    </label>
                    <textarea
                      value={functionForm.description}
                      onChange={(e) => setFunctionForm({ ...functionForm, description: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      rows={2}
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      disabled={createFunction.isPending}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                    >
                      {createFunction.isPending ? 'Creating...' : 'Create'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsCreatingFunction(false)}
                      className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Functions List */}
            <div className="space-y-2">
              {functions && functions.length > 0 ? (
                functions.map((func) => (
                  <button
                    key={func.id}
                    onClick={() => setSelectedFunctionId(func.id)}
                    className={`w-full p-4 rounded-lg border-2 transition-all text-left ${
                      selectedFunctionId === func.id
                        ? 'bg-blue-50 border-blue-400'
                        : 'bg-white border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900">{func.name}</h3>
                        {func.description && (
                          <p className="text-sm text-gray-600 mt-1">{func.description}</p>
                        )}
                        <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                          <span>{func.bucket_count || 0} buckets</span>
                          <span>•</span>
                          <span>{func.initiative_count || 0} initiatives</span>
                        </div>
                      </div>
                    </div>
                  </button>
                ))
              ) : (
                <div className="bg-white rounded-lg border-2 border-dashed border-gray-300 p-8 text-center">
                  <Folder className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                  <p className="text-gray-600 mb-3">No functions yet</p>
                  <button
                    onClick={() => setIsCreatingFunction(true)}
                    className="text-blue-600 hover:text-blue-700 font-medium text-sm"
                  >
                    Create your first function
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Buckets List */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900">
                {selectedFunctionId ? 'Buckets' : 'Select a Function'}
              </h2>
              {selectedFunctionId && (
                <button
                  onClick={() => setIsCreatingBucket(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm"
                >
                  <Plus className="w-4 h-4" />
                  Add Bucket
                </button>
              )}
            </div>

            {selectedFunctionId ? (
              <>
                {/* Create Bucket Form */}
                {isCreatingBucket && (
                  <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 mb-4">
                    <h3 className="font-semibold text-gray-900 mb-3">Create New Bucket</h3>
                    <form onSubmit={handleCreateBucket} className="space-y-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Name *
                        </label>
                        <input
                          type="text"
                          value={bucketForm.name}
                          onChange={(e) => setBucketForm({ ...bucketForm, name: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Description
                        </label>
                        <textarea
                          value={bucketForm.description}
                          onChange={(e) => setBucketForm({ ...bucketForm, description: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                          rows={2}
                        />
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="submit"
                          disabled={createBucket.isPending}
                          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                        >
                          {createBucket.isPending ? 'Creating...' : 'Create'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setIsCreatingBucket(false)}
                          className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  </div>
                )}

                {/* Buckets List */}
                {bucketsLoading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto mb-2"></div>
                    <p className="text-sm text-gray-600">Loading buckets...</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {buckets && buckets.length > 0 ? (
                      buckets.map((bucket) => (
                        <div
                          key={bucket.id}
                          className="bg-white p-4 rounded-lg border border-gray-200"
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <h3 className="font-semibold text-gray-900">{bucket.name}</h3>
                              {bucket.description && (
                                <p className="text-sm text-gray-600 mt-1">{bucket.description}</p>
                              )}
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="bg-white rounded-lg border-2 border-dashed border-gray-300 p-8 text-center">
                        <p className="text-gray-600 mb-3">No buckets yet</p>
                        <button
                          onClick={() => setIsCreatingBucket(true)}
                          className="text-green-600 hover:text-green-700 font-medium text-sm"
                        >
                          Create your first bucket
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </>
            ) : (
              <div className="bg-gray-50 rounded-lg border-2 border-dashed border-gray-300 p-12 text-center">
                <p className="text-gray-500">Select a function to manage its buckets</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
