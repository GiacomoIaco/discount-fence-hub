import { useState, useRef } from 'react';
import { useMutation } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import { X, Upload, FileText, CheckCircle, AlertCircle, Download } from 'lucide-react';
import toast from 'react-hot-toast';
import type { SurveyPopulation } from '../types';

interface CSVImportModalProps {
  population: SurveyPopulation;
  onClose: () => void;
  onSuccess: () => void;
}

interface ParsedRow {
  name?: string;
  email?: string;
  phone?: string;
  company?: string;
  valid: boolean;
  error?: string;
}

export default function CSVImportModal({ population, onClose, onSuccess }: CSVImportModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<ParsedRow[]>([]);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [headers, setHeaders] = useState<string[]>([]);
  const [step, setStep] = useState<'upload' | 'map' | 'preview' | 'importing'>('upload');

  const parseCSV = (text: string) => {
    const lines = text.split('\n').filter(line => line.trim());
    if (lines.length === 0) return { headers: [], rows: [] };

    // Parse headers
    const headerLine = lines[0];
    const headers = headerLine.split(',').map(h => h.trim().replace(/^"|"$/g, ''));

    // Parse rows
    const rows = lines.slice(1).map(line => {
      const values: string[] = [];
      let current = '';
      let inQuotes = false;

      for (const char of line) {
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          values.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      values.push(current.trim());

      return headers.reduce((obj, header, i) => {
        obj[header] = values[i]?.replace(/^"|"$/g, '') || '';
        return obj;
      }, {} as Record<string, string>);
    });

    return { headers, rows };
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    const text = await selectedFile.text();
    const { headers, rows } = parseCSV(text);
    setHeaders(headers);

    // Auto-map common column names
    const autoMapping: Record<string, string> = {};
    headers.forEach(h => {
      const lower = h.toLowerCase();
      if (lower.includes('name') && !lower.includes('company')) autoMapping[h] = 'name';
      else if (lower.includes('email')) autoMapping[h] = 'email';
      else if (lower.includes('phone') || lower.includes('mobile')) autoMapping[h] = 'phone';
      else if (lower.includes('company') || lower.includes('organization') || lower.includes('business')) autoMapping[h] = 'company';
    });
    setColumnMapping(autoMapping);

    // Store raw rows for later processing
    setParsedData(rows.map(row => ({
      ...row,
      valid: true,
    })) as any);

    setStep('map');
  };

  const processMapping = () => {
    const processed = parsedData.map((row: any) => {
      const mapped: ParsedRow = { valid: true };

      // Apply column mapping
      Object.entries(columnMapping).forEach(([csvCol, targetField]) => {
        if (targetField && row[csvCol]) {
          (mapped as any)[targetField] = row[csvCol];
        }
      });

      // Validate - must have email or phone
      if (!mapped.email && !mapped.phone) {
        mapped.valid = false;
        mapped.error = 'Missing email or phone';
      }

      // Validate email format
      if (mapped.email && !mapped.email.includes('@')) {
        mapped.valid = false;
        mapped.error = 'Invalid email format';
      }

      return mapped;
    });

    setParsedData(processed);
    setStep('preview');
  };

  const importMutation = useMutation({
    mutationFn: async () => {
      const validRows = parsedData.filter(r => r.valid);
      if (validRows.length === 0) throw new Error('No valid rows to import');

      // Insert in batches
      const batchSize = 100;
      let imported = 0;
      let skipped = 0;

      for (let i = 0; i < validRows.length; i += batchSize) {
        const batch = validRows.slice(i, i + batchSize).map(row => ({
          population_id: population.id,
          contact_name: row.name || null,
          contact_email: row.email || null,
          contact_phone: row.phone || null,
          contact_company: row.company || null,
        }));

        const { error, data } = await supabase
          .from('survey_population_contacts')
          .upsert(batch, { onConflict: 'population_id,contact_email', ignoreDuplicates: true })
          .select();

        if (error) {
          console.error('Batch import error:', error);
          skipped += batch.length;
        } else {
          imported += data?.length || 0;
        }
      }

      return { imported, skipped };
    },
    onSuccess: ({ imported, skipped }) => {
      toast.success(`Imported ${imported} contacts${skipped > 0 ? `, ${skipped} skipped/duplicates` : ''}`);
      onSuccess();
    },
    onError: (err: any) => toast.error(err.message || 'Import failed'),
  });

  const validCount = parsedData.filter(r => r.valid).length;
  const invalidCount = parsedData.filter(r => !r.valid).length;

  const downloadTemplate = () => {
    const csv = 'name,email,phone,company\nJohn Doe,john@example.com,555-123-4567,ABC Company\nJane Smith,jane@example.com,555-987-6543,XYZ Corp';
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'contacts_template.csv';
    a.click();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Import Contacts</h2>
            <p className="text-sm text-gray-500">Add contacts to {population.name}</p>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {step === 'upload' && (
            <div className="space-y-6">
              {/* Upload Area */}
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-gray-300 rounded-xl p-12 text-center cursor-pointer hover:border-emerald-500 hover:bg-emerald-50 transition-colors"
              >
                <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-lg font-medium text-gray-700">Drop CSV file here or click to browse</p>
                <p className="text-sm text-gray-500 mt-2">Supports .csv files with name, email, phone, company columns</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </div>

              {/* Template Download */}
              <button
                onClick={downloadTemplate}
                className="flex items-center gap-2 text-sm text-emerald-600 hover:text-emerald-700"
              >
                <Download className="w-4 h-4" />
                Download template CSV
              </button>
            </div>
          )}

          {step === 'map' && (
            <div className="space-y-6">
              <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg">
                <FileText className="w-5 h-5 text-blue-600" />
                <div>
                  <p className="font-medium text-blue-900">{file?.name}</p>
                  <p className="text-sm text-blue-600">{parsedData.length} rows found</p>
                </div>
              </div>

              <div>
                <h3 className="font-medium text-gray-900 mb-3">Map columns to fields</h3>
                <div className="space-y-3">
                  {headers.map(header => (
                    <div key={header} className="flex items-center gap-4">
                      <span className="w-1/3 text-sm font-medium text-gray-700 truncate">{header}</span>
                      <select
                        value={columnMapping[header] || ''}
                        onChange={(e) => setColumnMapping({ ...columnMapping, [header]: e.target.value })}
                        className="flex-1 px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500"
                      >
                        <option value="">Skip this column</option>
                        <option value="name">Name</option>
                        <option value="email">Email</option>
                        <option value="phone">Phone</option>
                        <option value="company">Company</option>
                      </select>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 'preview' && (
            <div className="space-y-4">
              {/* Summary */}
              <div className="flex gap-4">
                <div className="flex-1 p-4 bg-green-50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                    <span className="font-medium text-green-900">{validCount} valid</span>
                  </div>
                </div>
                {invalidCount > 0 && (
                  <div className="flex-1 p-4 bg-red-50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="w-5 h-5 text-red-600" />
                      <span className="font-medium text-red-900">{invalidCount} invalid</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Preview Table */}
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="max-h-64 overflow-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Status</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Name</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Email</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Phone</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Company</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {parsedData.slice(0, 20).map((row, i) => (
                        <tr key={i} className={row.valid ? '' : 'bg-red-50'}>
                          <td className="px-3 py-2">
                            {row.valid ? (
                              <CheckCircle className="w-4 h-4 text-green-600" />
                            ) : (
                              <span className="text-xs text-red-600">{row.error}</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-gray-900">{row.name || '-'}</td>
                          <td className="px-3 py-2 text-gray-600">{row.email || '-'}</td>
                          <td className="px-3 py-2 text-gray-600">{row.phone || '-'}</td>
                          <td className="px-3 py-2 text-gray-600">{row.company || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {parsedData.length > 20 && (
                  <div className="px-3 py-2 bg-gray-50 text-sm text-gray-500 text-center">
                    Showing first 20 of {parsedData.length} rows
                  </div>
                )}
              </div>
            </div>
          )}

          {step === 'importing' && (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="animate-spin w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full mb-4" />
              <p className="text-gray-600">Importing contacts...</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-gray-200 bg-gray-50">
          <button
            onClick={() => {
              if (step === 'map') setStep('upload');
              else if (step === 'preview') setStep('map');
              else onClose();
            }}
            className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            {step === 'upload' ? 'Cancel' : 'Back'}
          </button>

          {step === 'map' && (
            <button
              onClick={processMapping}
              disabled={!Object.values(columnMapping).some(v => v === 'email' || v === 'phone')}
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50"
            >
              Preview Import
            </button>
          )}

          {step === 'preview' && (
            <button
              onClick={() => {
                setStep('importing');
                importMutation.mutate();
              }}
              disabled={validCount === 0}
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50"
            >
              Import {validCount} Contacts
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
