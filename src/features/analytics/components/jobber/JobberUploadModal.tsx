// Upload modal for Jobber CSV imports

import { useState, useCallback, useRef } from 'react';
import { X, Upload, FileSpreadsheet, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { useJobberImport, useReportTypeDetection } from '../../hooks/jobber';
import type { ReportType, ImportResult } from '../../types/jobber';

interface JobberUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function JobberUploadModal({ isOpen, onClose }: JobberUploadModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [manualReportType, setManualReportType] = useState<ReportType | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const { importCSV, isImporting, importProgress, error } = useJobberImport('builder');
  const { detectFromFile, detectedType, isDetecting } = useReportTypeDetection();

  const handleFileSelect = useCallback(async (file: File) => {
    setSelectedFile(file);
    setResult(null);
    setManualReportType(null);
    await detectFromFile(file);
  }, [detectFromFile]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);

    const file = e.dataTransfer.files[0];
    if (file && file.name.endsWith('.csv')) {
      handleFileSelect(file);
    }
  }, [handleFileSelect]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragOver(false);
  }, []);

  const handleImport = async () => {
    if (!selectedFile) return;

    const reportType = manualReportType || detectedType;
    const importResult = await importCSV(selectedFile, reportType || undefined);
    setResult(importResult);
  };

  const handleReset = () => {
    setSelectedFile(null);
    setResult(null);
    setManualReportType(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  if (!isOpen) return null;

  const reportType = manualReportType || detectedType;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Import Jobber Data</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-full"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Drop Zone */}
          {!result && (
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClick={() => fileInputRef.current?.click()}
              className={`
                border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
                ${isDragOver ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'}
                ${selectedFile ? 'bg-green-50 border-green-300' : ''}
              `}
            >
              {selectedFile ? (
                <div className="space-y-2">
                  <FileSpreadsheet className="w-12 h-12 mx-auto text-green-600" />
                  <p className="font-medium text-gray-900">{selectedFile.name}</p>
                  <p className="text-sm text-gray-500">
                    {(selectedFile.size / 1024).toFixed(1)} KB
                  </p>
                  {isDetecting ? (
                    <p className="text-sm text-blue-600">Detecting report type...</p>
                  ) : detectedType ? (
                    <p className="text-sm text-green-600">
                      Detected: {detectedType.charAt(0).toUpperCase() + detectedType.slice(1)} Report
                    </p>
                  ) : (
                    <p className="text-sm text-yellow-600">Could not detect report type</p>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  <Upload className="w-12 h-12 mx-auto text-gray-400" />
                  <p className="text-gray-600">Drop a Jobber CSV file here or click to browse</p>
                  <p className="text-sm text-gray-400">Supports Jobs, Quotes, and Invoices exports</p>
                </div>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFileSelect(file);
                }}
              />
            </div>
          )}

          {/* Manual Report Type Selection */}
          {selectedFile && !detectedType && !result && (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                Select Report Type
              </label>
              <div className="flex gap-2">
                {(['jobs', 'quotes', 'invoices'] as ReportType[]).map((type) => (
                  <button
                    key={type}
                    onClick={() => setManualReportType(type)}
                    className={`
                      flex-1 py-2 px-3 rounded-lg border text-sm font-medium transition-colors
                      ${manualReportType === type
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-gray-300 hover:bg-gray-50'
                      }
                    `}
                  >
                    {type.charAt(0).toUpperCase() + type.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Import Progress */}
          {isImporting && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
                <span className="text-sm text-gray-600">Importing...</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${importProgress}%` }}
                />
              </div>
            </div>
          )}

          {/* Error Display */}
          {error && (
            <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-red-700">Import Error</p>
                <p className="text-sm text-red-600">{error}</p>
              </div>
            </div>
          )}

          {/* Result Display */}
          {result && (
            <div className={`p-4 rounded-lg border ${result.success ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'}`}>
              <div className="flex items-center gap-2 mb-3">
                {result.success ? (
                  <CheckCircle className="w-6 h-6 text-green-600" />
                ) : (
                  <AlertCircle className="w-6 h-6 text-yellow-600" />
                )}
                <span className="font-medium">
                  {result.success ? 'Import Complete!' : 'Import Completed with Issues'}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="bg-white p-2 rounded">
                  <span className="text-gray-500">Total Rows</span>
                  <p className="font-semibold">{result.totalRows.toLocaleString()}</p>
                </div>
                <div className="bg-white p-2 rounded">
                  <span className="text-gray-500">Processed</span>
                  <p className="font-semibold text-green-600">{result.updatedRecords.toLocaleString()}</p>
                </div>
                <div className="bg-white p-2 rounded">
                  <span className="text-gray-500">Skipped</span>
                  <p className="font-semibold text-yellow-600">{result.skippedRecords.toLocaleString()}</p>
                </div>
                <div className="bg-white p-2 rounded">
                  <span className="text-gray-500">Errors</span>
                  <p className="font-semibold text-red-600">{result.errors.length}</p>
                </div>
              </div>

              {result.errors.length > 0 && (
                <div className="mt-3 max-h-32 overflow-y-auto">
                  <p className="text-sm font-medium text-gray-700 mb-1">First few errors:</p>
                  {result.errors.slice(0, 5).map((err, i) => (
                    <p key={i} className="text-xs text-red-600">
                      Row {err.row}: {err.message}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 p-4 border-t border-gray-200">
          {result ? (
            <>
              <button
                onClick={handleReset}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                Import Another
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
                onClick={handleImport}
                disabled={!selectedFile || !reportType || isImporting}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isImporting ? 'Importing...' : 'Import'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
