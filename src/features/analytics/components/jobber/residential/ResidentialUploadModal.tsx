// Residential Upload Modal
// Bulk upload for Quotes, Jobs, and Requests CSV files

import { useState, useCallback } from 'react';
import { X, Upload, FileText, CheckCircle, AlertCircle, Loader } from 'lucide-react';
import { useResidentialImport } from '../../../hooks/jobber/residential';

interface ResidentialUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ResidentialUploadModal({ isOpen, onClose }: ResidentialUploadModalProps) {
  const [quotesFile, setQuotesFile] = useState<File | null>(null);
  const [jobsFile, setJobsFile] = useState<File | null>(null);
  const [requestsFile, setRequestsFile] = useState<File | null>(null);

  const { importData, isImporting, progress, result, reset } = useResidentialImport();

  const handleClose = useCallback(() => {
    reset();
    setQuotesFile(null);
    setJobsFile(null);
    setRequestsFile(null);
    onClose();
  }, [reset, onClose]);

  const handleImport = useCallback(() => {
    if (!quotesFile) {
      alert('Quotes CSV is required');
      return;
    }

    importData({
      quotesFile,
      jobsFile,
      requestsFile,
    });
  }, [quotesFile, jobsFile, requestsFile, importData]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Upload Residential Data</h2>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-4 space-y-4">
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

                <div className="text-sm space-y-1">
                  <div>
                    <span className="text-gray-600">Opportunities:</span>{' '}
                    <span className="font-medium">{result.opportunities.total.toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Quotes:</span>{' '}
                    <span className="font-medium">{result.quotes.total.toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Jobs linked:</span>{' '}
                    <span className="font-medium">{result.jobs.linked.toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Assessment dates linked:</span>{' '}
                    <span className="font-medium">{result.requests.linked.toLocaleString()}</span>
                  </div>
                </div>

                {result.errors.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-red-200">
                    <div className="text-sm text-red-600 font-medium">
                      {result.errors.length} error(s):
                    </div>
                    <ul className="mt-1 text-xs text-red-600 list-disc list-inside">
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
              <Loader className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-4" />
              <div className="text-gray-900 font-medium mb-2">{progress?.message || 'Processing...'}</div>
              {progress && (
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${progress.progress}%` }}
                  />
                </div>
              )}
            </div>
          ) : (
            // Show file inputs
            <>
              <p className="text-sm text-gray-600">
                Upload your Jobber export files. Quotes CSV is required; Jobs and Requests are
                optional but provide additional insights.
              </p>

              {/* Quotes File (Required) */}
              <FileInput
                label="Quotes CSV"
                description="Required - Primary data source"
                file={quotesFile}
                onChange={setQuotesFile}
                required
              />

              {/* Jobs File (Optional) */}
              <FileInput
                label="Jobs CSV"
                description="Optional - Adds scheduled/closed dates"
                file={jobsFile}
                onChange={setJobsFile}
              />

              {/* Requests File (Optional) */}
              <FileInput
                label="Requests CSV"
                description="Optional - Adds assessment dates for speed-to-quote"
                file={requestsFile}
                onChange={setRequestsFile}
              />
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
              disabled={!quotesFile}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              <Upload className="w-4 h-4" />
              Import Data
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// File input component
function FileInput({
  label,
  description,
  file,
  onChange,
  required = false,
}: {
  label: string;
  description: string;
  file: File | null;
  onChange: (file: File | null) => void;
  required?: boolean;
}) {
  return (
    <div className="border border-gray-200 rounded-lg p-3">
      <div className="flex items-center justify-between mb-2">
        <div>
          <span className="font-medium text-gray-900">{label}</span>
          {required && <span className="text-red-500 ml-1">*</span>}
          <div className="text-xs text-gray-500">{description}</div>
        </div>
        {file && (
          <button
            onClick={() => onChange(null)}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {file ? (
        <div className="flex items-center gap-2 p-2 bg-green-50 rounded text-sm text-green-700">
          <FileText className="w-4 h-4" />
          <span className="truncate">{file.name}</span>
          <span className="text-green-500 text-xs">({(file.size / 1024).toFixed(0)} KB)</span>
        </div>
      ) : (
        <label className="flex items-center justify-center gap-2 p-3 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors">
          <Upload className="w-4 h-4 text-gray-400" />
          <span className="text-sm text-gray-600">Select CSV file</span>
          <input
            type="file"
            accept=".csv"
            className="hidden"
            onChange={(e) => onChange(e.target.files?.[0] || null)}
          />
        </label>
      )}
    </div>
  );
}
