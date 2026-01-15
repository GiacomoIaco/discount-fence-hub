// Residential Upload Modal - Multi-file selection with auto-detection
// Supports Quotes (required), Jobs (optional), Requests (optional)

import { useState, useCallback, useRef } from 'react';
import { X, Upload, FileSpreadsheet, CheckCircle, AlertCircle, Loader, Files, Trash2 } from 'lucide-react';
import { useResidentialImport } from '../../../hooks/jobber/residential';

interface ResidentialUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type ResidentialFileType = 'quotes' | 'jobs' | 'requests';

interface DetectedFile {
  file: File;
  type: ResidentialFileType | null;
}

// Detect file type from filename
function detectTypeFromFilename(filename: string): ResidentialFileType | null {
  const lower = filename.toLowerCase();
  if (lower.includes('quotes_report') || lower.includes('quotes-report') || lower.includes('quotes.csv')) return 'quotes';
  if (lower.includes('jobs_report') || lower.includes('jobs-report') || lower.includes('jobs.csv')) return 'jobs';
  if (lower.includes('requests_report') || lower.includes('requests-report') || lower.includes('requests.csv')) return 'requests';
  return null;
}

export function ResidentialUploadModal({ isOpen, onClose }: ResidentialUploadModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<DetectedFile[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);

  const { importData, isImporting, progress, result, reset } = useResidentialImport();

  const handleClose = useCallback(() => {
    reset();
    setFiles([]);
    onClose();
  }, [reset, onClose]);

  const handleFilesSelect = useCallback((newFiles: FileList | File[]) => {
    const fileArray = Array.from(newFiles).filter(f => f.name.endsWith('.csv'));

    // Detect type from filename
    const detectedFiles: DetectedFile[] = fileArray.map(file => ({
      file,
      type: detectTypeFromFilename(file.name),
    }));

    setFiles(prev => {
      // Replace files of the same type, add new ones
      const newList = [...prev];
      for (const df of detectedFiles) {
        if (df.type) {
          // Remove existing file of same type
          const existingIdx = newList.findIndex(f => f.type === df.type);
          if (existingIdx >= 0) {
            newList.splice(existingIdx, 1);
          }
        }
        newList.push(df);
      }
      return newList;
    });
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    handleFilesSelect(e.dataTransfer.files);
  }, [handleFilesSelect]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragOver(false);
  }, []);

  const removeFile = (fileName: string) => {
    setFiles(prev => prev.filter(f => f.file.name !== fileName));
  };

  const setFileType = (fileName: string, type: ResidentialFileType | null) => {
    setFiles(prev => {
      // If assigning a type, remove any existing file with that type first
      let newList = prev;
      if (type) {
        newList = prev.filter(f => f.file.name === fileName || f.type !== type);
      }
      return newList.map(f =>
        f.file.name === fileName ? { ...f, type } : f
      );
    });
  };

  const handleImport = useCallback(() => {
    const quotesFile = files.find(f => f.type === 'quotes')?.file || null;
    const jobsFile = files.find(f => f.type === 'jobs')?.file || null;
    const requestsFile = files.find(f => f.type === 'requests')?.file || null;

    if (!quotesFile) {
      alert('Quotes CSV is required');
      return;
    }

    importData({
      quotesFile,
      jobsFile,
      requestsFile,
    });
  }, [files, importData]);

  if (!isOpen) return null;

  const quotesFile = files.find(f => f.type === 'quotes');
  const jobsFile = files.find(f => f.type === 'jobs');
  const requestsFile = files.find(f => f.type === 'requests');
  const hasQuotes = !!quotesFile;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <Files className="w-5 h-5 text-green-600" />
            <h2 className="text-lg font-semibold text-gray-900">Upload Residential Data</h2>
          </div>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-4 space-y-4 overflow-y-auto flex-1">
          {result ? (
            // Show results
            <div className="space-y-4">
              <div className={`p-4 rounded-lg ${result.success ? 'bg-green-50' : 'bg-red-50'}`}>
                <div className="flex items-center gap-2 mb-2">
                  {result.success ? (
                    <CheckCircle className="w-5 h-5 text-green-600" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-red-600" />
                  )}
                  <span className={`font-medium ${result.success ? 'text-green-700' : 'text-red-700'}`}>
                    {result.success ? 'Import Complete!' : 'Import had errors'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="bg-white p-2 rounded">
                    <span className="text-gray-600">Opportunities:</span>{' '}
                    <span className="font-medium">{result.opportunities.total.toLocaleString()}</span>
                  </div>
                  <div className="bg-white p-2 rounded">
                    <span className="text-gray-600">Quotes:</span>{' '}
                    <span className="font-medium">{result.quotes.total.toLocaleString()}</span>
                  </div>
                  <div className="bg-white p-2 rounded">
                    <span className="text-gray-600">Jobs linked:</span>{' '}
                    <span className="font-medium">{result.jobs.linked.toLocaleString()}</span>
                  </div>
                  <div className="bg-white p-2 rounded">
                    <span className="text-gray-600">Assessment dates:</span>{' '}
                    <span className="font-medium">{result.requests.linked.toLocaleString()}</span>
                  </div>
                </div>

                {result.errors.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-red-200">
                    <div className="text-sm text-red-600 font-medium">
                      {result.errors.length} error(s):
                    </div>
                    <ul className="mt-1 text-xs text-red-600 list-disc list-inside max-h-24 overflow-y-auto">
                      {result.errors.slice(0, 5).map((err, i) => (
                        <li key={i}>
                          {err.file} row {err.row}: {err.message}
                        </li>
                      ))}
                      {result.errors.length > 5 && (
                        <li>...and {result.errors.length - 5} more</li>
                      )}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          ) : isImporting ? (
            // Show progress
            <div className="py-8 text-center">
              <Loader className="w-8 h-8 text-green-600 animate-spin mx-auto mb-4" />
              <div className="text-gray-900 font-medium mb-2">{progress?.message || 'Processing...'}</div>
              {progress && (
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-green-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${progress.progress}%` }}
                  />
                </div>
              )}
            </div>
          ) : (
            // File selection
            <>
              <p className="text-sm text-gray-600">
                Select your Jobber export files. <strong>Quotes CSV is required</strong>; Jobs and Requests are optional but improve insights.
              </p>

              {/* Drop Zone */}
              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onClick={() => fileInputRef.current?.click()}
                className={`
                  border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors
                  ${isDragOver ? 'border-green-500 bg-green-50' : 'border-gray-300 hover:border-gray-400'}
                `}
              >
                <Upload className="w-10 h-10 mx-auto text-gray-400 mb-2" />
                <p className="text-gray-600 font-medium">Drop CSV files here or click to browse</p>
                <p className="text-sm text-gray-400 mt-1">
                  Select multiple files at once - they'll be auto-detected
                </p>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files) handleFilesSelect(e.target.files);
                  }}
                />
              </div>

              {/* File Status Cards */}
              <div className="grid grid-cols-3 gap-3">
                {/* Quotes (Required) */}
                <FileStatusCard
                  label="Quotes"
                  required
                  file={quotesFile}
                  onRemove={() => quotesFile && removeFile(quotesFile.file.name)}
                />

                {/* Jobs (Optional) */}
                <FileStatusCard
                  label="Jobs"
                  file={jobsFile}
                  onRemove={() => jobsFile && removeFile(jobsFile.file.name)}
                />

                {/* Requests (Optional) */}
                <FileStatusCard
                  label="Requests"
                  file={requestsFile}
                  onRemove={() => requestsFile && removeFile(requestsFile.file.name)}
                />
              </div>

              {/* Unassigned files */}
              {files.filter(f => f.type === null).length > 0 && (
                <div className="space-y-2">
                  <span className="text-sm font-medium text-gray-700">Unassigned files:</span>
                  {files.filter(f => f.type === null).map(df => (
                    <div key={df.file.name} className="flex items-center gap-3 p-2 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <FileSpreadsheet className="w-5 h-5 text-yellow-600" />
                      <span className="flex-1 text-sm truncate">{df.file.name}</span>
                      <select
                        value=""
                        onChange={(e) => setFileType(df.file.name, e.target.value as ResidentialFileType)}
                        className="text-sm border border-gray-300 rounded px-2 py-1"
                      >
                        <option value="">Assign type...</option>
                        {!quotesFile && <option value="quotes">Quotes</option>}
                        {!jobsFile && <option value="jobs">Jobs</option>}
                        {!requestsFile && <option value="requests">Requests</option>}
                      </select>
                      <button
                        onClick={() => removeFile(df.file.name)}
                        className="p-1 hover:bg-yellow-200 rounded"
                      >
                        <Trash2 className="w-4 h-4 text-yellow-600" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200">
          <button
            onClick={handleClose}
            className="px-4 py-2 text-gray-700 hover:text-gray-900"
          >
            {result ? 'Close' : 'Cancel'}
          </button>
          {!result && !isImporting && (
            <button
              onClick={handleImport}
              disabled={!hasQuotes}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              <Upload className="w-4 h-4" />
              Import {files.filter(f => f.type).length} File{files.filter(f => f.type).length !== 1 ? 's' : ''}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// File status card component
function FileStatusCard({
  label,
  required = false,
  file,
  onRemove,
}: {
  label: string;
  required?: boolean;
  file?: DetectedFile;
  onRemove: () => void;
}) {
  return (
    <div className={`p-3 rounded-lg border ${
      file ? 'bg-green-50 border-green-200' : required ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-200'
    }`}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm font-medium text-gray-700">{label}</span>
        {required && !file && (
          <span className="text-xs text-red-600 font-medium">Required</span>
        )}
        {file && (
          <button onClick={onRemove} className="p-0.5 hover:bg-green-200 rounded">
            <X className="w-3 h-3 text-green-600" />
          </button>
        )}
      </div>
      {file ? (
        <div className="flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-green-600" />
          <span className="text-xs text-green-700 truncate">{file.file.name}</span>
        </div>
      ) : (
        <span className="text-xs text-gray-400">Not selected</span>
      )}
    </div>
  );
}
