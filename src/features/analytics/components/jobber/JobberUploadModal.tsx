// Upload modal for Jobber CSV imports - supports multi-file selection

import { useState, useCallback, useRef } from 'react';
import { X, Upload, FileSpreadsheet, CheckCircle, AlertCircle, Loader2, Files, Trash2 } from 'lucide-react';
import { useJobberImport, useReportTypeDetection } from '../../hooks/jobber';
import type { ReportType, ImportResult } from '../../types/jobber';

interface JobberUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface DetectedFile {
  file: File;
  type: ReportType | null;
  isDetecting: boolean;
}

// Detect report type from filename
function detectTypeFromFilename(filename: string): ReportType | null {
  const lower = filename.toLowerCase();
  if (lower.includes('jobs_report') || lower.includes('jobs-report')) return 'jobs';
  if (lower.includes('quotes_report') || lower.includes('quotes-report')) return 'quotes';
  if (lower.includes('invoices_report') || lower.includes('invoices-report')) return 'invoices';
  return null;
}

export function JobberUploadModal({ isOpen, onClose }: JobberUploadModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<DetectedFile[]>([]);
  const [results, setResults] = useState<Map<string, ImportResult>>(new Map());
  const [isDragOver, setIsDragOver] = useState(false);
  const [importingFile, setImportingFile] = useState<string | null>(null);

  const { importCSV, isImporting, importProgress } = useJobberImport('builder');
  const { detectFromFile } = useReportTypeDetection();

  const handleFilesSelect = useCallback(async (newFiles: FileList | File[]) => {
    const fileArray = Array.from(newFiles).filter(f => f.name.endsWith('.csv'));

    // Add files with initial detection from filename
    const detectedFiles: DetectedFile[] = fileArray.map(file => ({
      file,
      type: detectTypeFromFilename(file.name),
      isDetecting: !detectTypeFromFilename(file.name), // Only detect from content if filename didn't match
    }));

    setFiles(prev => [...prev, ...detectedFiles]);
    setResults(new Map());

    // For files without filename match, detect from content
    for (const df of detectedFiles) {
      if (df.isDetecting) {
        const detected = await detectFromFile(df.file);
        setFiles(prev => prev.map(f =>
          f.file.name === df.file.name
            ? { ...f, type: detected || null, isDetecting: false }
            : f
        ));
      }
    }
  }, [detectFromFile]);

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
    setResults(prev => {
      const newResults = new Map(prev);
      newResults.delete(fileName);
      return newResults;
    });
  };

  const setFileType = (fileName: string, type: ReportType) => {
    setFiles(prev => prev.map(f =>
      f.file.name === fileName ? { ...f, type } : f
    ));
  };

  const handleImportAll = async () => {
    const validFiles = files.filter(f => f.type !== null);

    for (const df of validFiles) {
      setImportingFile(df.file.name);
      const result = await importCSV(df.file, df.type!);
      setResults(prev => new Map(prev).set(df.file.name, result));
    }
    setImportingFile(null);
  };

  const handleReset = () => {
    setFiles([]);
    setResults(new Map());
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  if (!isOpen) return null;

  const allFilesHaveType = files.length > 0 && files.every(f => f.type !== null);
  const allImported = results.size === files.length && files.length > 0;
  const anyImporting = isImporting || importingFile !== null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <Files className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-gray-900">Import Builder Data</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-full"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4 overflow-y-auto flex-1">
          {/* Drop Zone */}
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => fileInputRef.current?.click()}
            className={`
              border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors
              ${isDragOver ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'}
            `}
          >
            <Upload className="w-10 h-10 mx-auto text-gray-400 mb-2" />
            <p className="text-gray-600 font-medium">Drop CSV files here or click to browse</p>
            <p className="text-sm text-gray-400 mt-1">
              Select multiple files at once - Jobs, Quotes, and Invoices
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

          {/* File List */}
          {files.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">
                  {files.length} file{files.length !== 1 ? 's' : ''} selected
                </span>
                {!allImported && (
                  <button
                    onClick={handleReset}
                    className="text-sm text-gray-500 hover:text-gray-700"
                  >
                    Clear all
                  </button>
                )}
              </div>

              <div className="space-y-2">
                {files.map((df) => {
                  const result = results.get(df.file.name);
                  const isCurrentlyImporting = importingFile === df.file.name;

                  return (
                    <div
                      key={df.file.name}
                      className={`flex items-center gap-3 p-3 rounded-lg border ${
                        result?.success ? 'bg-green-50 border-green-200' :
                        result && !result.success ? 'bg-yellow-50 border-yellow-200' :
                        isCurrentlyImporting ? 'bg-blue-50 border-blue-200' :
                        'bg-gray-50 border-gray-200'
                      }`}
                    >
                      <FileSpreadsheet className={`w-8 h-8 flex-shrink-0 ${
                        result?.success ? 'text-green-600' :
                        isCurrentlyImporting ? 'text-blue-600' :
                        'text-gray-400'
                      }`} />

                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 truncate">{df.file.name}</p>
                        <p className="text-xs text-gray-500">
                          {(df.file.size / 1024).toFixed(1)} KB
                        </p>
                      </div>

                      {/* Type selector or status */}
                      {result ? (
                        <div className="flex items-center gap-2">
                          {result.success ? (
                            <CheckCircle className="w-5 h-5 text-green-600" />
                          ) : (
                            <AlertCircle className="w-5 h-5 text-yellow-600" />
                          )}
                          <span className="text-sm text-gray-600">
                            {result.updatedRecords.toLocaleString()} rows
                          </span>
                        </div>
                      ) : isCurrentlyImporting ? (
                        <div className="flex items-center gap-2">
                          <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
                          <span className="text-sm text-blue-600">{importProgress}%</span>
                        </div>
                      ) : df.isDetecting ? (
                        <span className="text-sm text-gray-500">Detecting...</span>
                      ) : (
                        <div className="flex items-center gap-2">
                          <select
                            value={df.type || ''}
                            onChange={(e) => setFileType(df.file.name, e.target.value as ReportType)}
                            className="text-sm border border-gray-300 rounded px-2 py-1"
                          >
                            <option value="">Select type</option>
                            <option value="jobs">Jobs</option>
                            <option value="quotes">Quotes</option>
                            <option value="invoices">Invoices</option>
                          </select>
                          <button
                            onClick={() => removeFile(df.file.name)}
                            className="p-1 hover:bg-gray-200 rounded"
                          >
                            <Trash2 className="w-4 h-4 text-gray-400" />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Summary after import */}
          {allImported && (
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <span className="font-medium text-green-700">All imports complete!</span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-sm">
                {Array.from(results.entries()).map(([fileName, result]) => (
                  <div key={fileName} className="bg-white p-2 rounded">
                    <span className="text-gray-500 block truncate text-xs">{fileName}</span>
                    <span className="font-medium">{result.updatedRecords.toLocaleString()} rows</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 p-4 border-t border-gray-200">
          {allImported ? (
            <>
              <button
                onClick={handleReset}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                Import More
              </button>
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg"
              >
                Done
              </button>
            </>
          ) : (
            <>
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleImportAll}
                disabled={!allFilesHaveType || anyImporting || files.length === 0}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {anyImporting ? 'Importing...' : `Import ${files.length} File${files.length !== 1 ? 's' : ''}`}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
