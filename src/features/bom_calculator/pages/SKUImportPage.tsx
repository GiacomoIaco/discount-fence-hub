import { useState, useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Upload, FileSpreadsheet, AlertTriangle, CheckCircle, X, Loader2, Download
} from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { showSuccess, showError } from '../../../lib/toast';
import type { FenceTypeDB } from '../database.types';

type SKUType = FenceTypeDB | 'custom';

interface ImportRow {
  sku_code: string;
  sku_name: string;
  sku_type: SKUType;
  category?: string;
  height?: number;
  post_type?: 'WOOD' | 'STEEL';
  notes?: string;
  // Validation
  isValid: boolean;
  isDuplicate: boolean;
  errors: string[];
}

interface ImportSummary {
  total: number;
  valid: number;
  duplicates: number;
  invalid: number;
}

const SKU_TYPE_OPTIONS: { value: SKUType; label: string }[] = [
  { value: 'wood_vertical', label: 'Wood Vertical' },
  { value: 'wood_horizontal', label: 'Wood Horizontal' },
  { value: 'iron', label: 'Iron' },
  { value: 'custom', label: 'Custom/Service' },
];

const SAMPLE_CSV = `sku_code,sku_name,sku_type,category,height,post_type,notes
WV-6-WRC-8OC,6ft WRC Vertical 8' OC,wood_vertical,Standard,72,WOOD,
WH-6-PT-8OC,6ft PT Horizontal 8' OC,wood_horizontal,Standard,72,WOOD,
IR-6-BLK,6ft Black Iron Panel,iron,Standard,6,STEEL,
TOFO,Tear Out & Haul Off,custom,Service,,,Labor only
STAIN-NEW,Stain New Fence,custom,Service,,,Outsourced`;

export default function SKUImportPage() {
  const queryClient = useQueryClient();
  const [importRows, setImportRows] = useState<ImportRow[]>([]);
  const [fileName, setFileName] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);

  // Fetch existing SKU codes for duplicate detection
  const { data: existingCodes = new Set<string>() } = useQuery({
    queryKey: ['existing-sku-codes'],
    queryFn: async () => {
      const codes = new Set<string>();

      const [wv, wh, ir, custom] = await Promise.all([
        supabase.from('wood_vertical_products').select('sku_code'),
        supabase.from('wood_horizontal_products').select('sku_code'),
        supabase.from('iron_products').select('sku_code'),
        supabase.from('custom_products').select('sku_code'),
      ]);

      wv.data?.forEach(p => codes.add(p.sku_code.toUpperCase()));
      wh.data?.forEach(p => codes.add(p.sku_code.toUpperCase()));
      ir.data?.forEach(p => codes.add(p.sku_code.toUpperCase()));
      custom.data?.forEach(p => codes.add(p.sku_code.toUpperCase()));

      return codes;
    },
  });

  // Parse CSV content
  const parseCSV = useCallback((content: string): ImportRow[] => {
    const lines = content.trim().split('\n');
    if (lines.length < 2) return [];

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    const rows: ImportRow[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim());
      const row: Record<string, string> = {};
      headers.forEach((h, idx) => {
        row[h] = values[idx] || '';
      });

      const errors: string[] = [];
      const skuCode = row.sku_code?.toUpperCase() || '';
      const skuName = row.sku_name || '';
      const skuType = row.sku_type as SKUType || 'custom';

      if (!skuCode) errors.push('SKU code is required');
      if (!skuName) errors.push('SKU name is required');
      if (!['wood_vertical', 'wood_horizontal', 'iron', 'custom'].includes(skuType)) {
        errors.push('Invalid SKU type');
      }

      const isDuplicate = existingCodes.has(skuCode);
      if (isDuplicate) errors.push('SKU already exists');

      rows.push({
        sku_code: skuCode,
        sku_name: skuName,
        sku_type: skuType,
        category: row.category || undefined,
        height: row.height ? parseFloat(row.height) : undefined,
        post_type: row.post_type as 'WOOD' | 'STEEL' || undefined,
        notes: row.notes || undefined,
        isValid: errors.length === 0,
        isDuplicate,
        errors,
      });
    }

    return rows;
  }, [existingCodes]);

  // Handle file upload
  const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      const rows = parseCSV(content);
      setImportRows(rows);
      setIsProcessing(false);
    };
    reader.onerror = () => {
      showError('Failed to read file');
      setIsProcessing(false);
    };
    reader.readAsText(file);

    // Reset input
    event.target.value = '';
  }, [parseCSV]);

  // Calculate summary
  const summary: ImportSummary = {
    total: importRows.length,
    valid: importRows.filter(r => r.isValid).length,
    duplicates: importRows.filter(r => r.isDuplicate).length,
    invalid: importRows.filter(r => !r.isValid && !r.isDuplicate).length,
  };

  // Import mutation
  const importMutation = useMutation({
    mutationFn: async () => {
      const validRows = importRows.filter(r => r.isValid);
      if (validRows.length === 0) throw new Error('No valid rows to import');

      const now = new Date().toISOString();

      // Group by type
      const woodVertical = validRows.filter(r => r.sku_type === 'wood_vertical');
      const woodHorizontal = validRows.filter(r => r.sku_type === 'wood_horizontal');
      const iron = validRows.filter(r => r.sku_type === 'iron');
      const custom = validRows.filter(r => r.sku_type === 'custom');

      // Insert wood vertical
      if (woodVertical.length > 0) {
        const { error } = await supabase.from('wood_vertical_products').insert(
          woodVertical.map(r => ({
            sku_code: r.sku_code,
            sku_name: r.sku_name,
            height: r.height || 72,
            post_type: r.post_type || 'WOOD',
            rail_count: 3,
            style: 'Standard',
            post_spacing: 96,
            post_material_id: null,
            picket_material_id: null,
            rail_material_id: null,
            is_active: true,
            sku_status: 'draft',
            imported_at: now,
            import_notes: r.notes || null,
          }))
        );
        if (error) throw error;
      }

      // Insert wood horizontal
      if (woodHorizontal.length > 0) {
        const { error } = await supabase.from('wood_horizontal_products').insert(
          woodHorizontal.map(r => ({
            sku_code: r.sku_code,
            sku_name: r.sku_name,
            height: r.height || 72,
            post_type: r.post_type || 'WOOD',
            style: 'Standard',
            post_spacing: 96,
            board_width_actual: 5.5,
            post_material_id: null,
            board_material_id: null,
            is_active: true,
            sku_status: 'draft',
            imported_at: now,
            import_notes: r.notes || null,
          }))
        );
        if (error) throw error;
      }

      // Insert iron
      if (iron.length > 0) {
        const { error } = await supabase.from('iron_products').insert(
          iron.map(r => ({
            sku_code: r.sku_code,
            sku_name: r.sku_name,
            height: r.height || 6,
            post_type: 'STEEL',
            style: 'Standard',
            panel_width: 6,
            post_material_id: null,
            panel_material_id: null,
            is_active: true,
            sku_status: 'draft',
            imported_at: now,
            import_notes: r.notes || null,
          }))
        );
        if (error) throw error;
      }

      // Insert custom
      if (custom.length > 0) {
        const { error } = await supabase.from('custom_products').insert(
          custom.map(r => ({
            sku_code: r.sku_code,
            sku_name: r.sku_name,
            unit_basis: 'LF',
            category: r.category || 'Service',
            is_active: true,
            sku_status: 'draft',
            imported_at: now,
            import_notes: r.notes || null,
            standard_material_cost: 0,
            standard_labor_cost: 0,
            standard_cost_per_unit: 0,
          }))
        );
        if (error) throw error;
      }

      return validRows.length;
    },
    onSuccess: (count) => {
      showSuccess(`Imported ${count} SKUs as drafts`);
      setImportRows([]);
      setFileName('');
      queryClient.invalidateQueries({ queryKey: ['existing-sku-codes'] });
      queryClient.invalidateQueries({ queryKey: ['sku-queue'] });
    },
    onError: (err: Error) => {
      showError(err.message || 'Failed to import SKUs');
    },
  });

  // Remove row
  const removeRow = (index: number) => {
    setImportRows(importRows.filter((_, i) => i !== index));
  };

  // Update row type
  const updateRowType = (index: number, newType: SKUType) => {
    setImportRows(importRows.map((row, i) =>
      i === index ? { ...row, sku_type: newType } : row
    ));
  };

  // Download sample CSV
  const downloadSample = () => {
    const blob = new Blob([SAMPLE_CSV], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sku_import_template.csv';
    // Must append to DOM for click to work in all browsers
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex-1 flex flex-col bg-gray-50 overflow-hidden h-full">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Upload className="w-5 h-5 text-blue-600" />
            <div>
              <h1 className="text-lg font-bold text-gray-900">SKU Import</h1>
              <p className="text-xs text-gray-500">Import SKUs from CSV, then populate materials in SKU Builder</p>
            </div>
          </div>
          <button
            onClick={downloadSample}
            className="px-3 py-1.5 text-xs text-blue-600 hover:bg-blue-50 rounded flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            Download Template
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <div className="max-w-5xl mx-auto space-y-4">
          {/* Upload Area */}
          {importRows.length === 0 && (
            <div className="bg-white rounded-lg border-2 border-dashed border-gray-300 p-8">
              <div className="text-center">
                <FileSpreadsheet className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-sm font-medium text-gray-900 mb-1">Upload CSV File</h3>
                <p className="text-xs text-gray-500 mb-4">
                  CSV with columns: sku_code, sku_name, sku_type, category, height, post_type, notes
                </p>
                <label className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer text-sm">
                  <Upload className="w-4 h-4" />
                  Choose File
                  <input
                    type="file"
                    accept=".csv,.txt"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>
                <p className="text-[10px] text-gray-400 mt-3">
                  sku_type values: wood_vertical, wood_horizontal, iron, custom
                </p>
              </div>
            </div>
          )}

          {/* Processing */}
          {isProcessing && (
            <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-3" />
              <p className="text-sm text-gray-600">Processing file...</p>
            </div>
          )}

          {/* Preview */}
          {importRows.length > 0 && !isProcessing && (
            <>
              {/* Summary Bar */}
              <div className="bg-white rounded-lg border border-gray-200 p-3 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <span className="text-sm text-gray-600">
                    <span className="font-medium">{fileName}</span>
                  </span>
                  <div className="flex items-center gap-3 text-xs">
                    <span className="px-2 py-1 bg-gray-100 rounded">{summary.total} total</span>
                    <span className="px-2 py-1 bg-green-100 text-green-700 rounded flex items-center gap-1">
                      <CheckCircle className="w-3 h-3" />
                      {summary.valid} valid
                    </span>
                    {summary.duplicates > 0 && (
                      <span className="px-2 py-1 bg-amber-100 text-amber-700 rounded flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        {summary.duplicates} duplicates
                      </span>
                    )}
                    {summary.invalid > 0 && (
                      <span className="px-2 py-1 bg-red-100 text-red-700 rounded flex items-center gap-1">
                        <X className="w-3 h-3" />
                        {summary.invalid} invalid
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => { setImportRows([]); setFileName(''); }}
                    className="px-3 py-1.5 text-gray-600 hover:bg-gray-100 rounded text-xs"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => importMutation.mutate()}
                    disabled={importMutation.isPending || summary.valid === 0}
                    className="px-4 py-1.5 bg-blue-600 text-white rounded text-xs font-medium hover:bg-blue-700 disabled:bg-gray-400 flex items-center gap-1.5"
                  >
                    {importMutation.isPending ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Upload className="w-3.5 h-3.5" />
                    )}
                    Import {summary.valid} SKUs
                  </button>
                </div>
              </div>

              {/* Table */}
              <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr className="text-[10px] text-gray-500 uppercase">
                      <th className="text-left py-2 px-3 w-8"></th>
                      <th className="text-left py-2 px-3">SKU Code</th>
                      <th className="text-left py-2 px-3">SKU Name</th>
                      <th className="text-left py-2 px-3 w-36">Type</th>
                      <th className="text-left py-2 px-3 w-24">Category</th>
                      <th className="text-left py-2 px-3 w-32">Status</th>
                      <th className="w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {importRows.map((row, index) => (
                      <tr
                        key={index}
                        className={`${row.isValid ? 'hover:bg-gray-50' : 'bg-red-50'} ${row.isDuplicate ? 'bg-amber-50' : ''}`}
                      >
                        <td className="py-2 px-3 text-center">
                          {row.isValid ? (
                            <CheckCircle className="w-4 h-4 text-green-500" />
                          ) : row.isDuplicate ? (
                            <AlertTriangle className="w-4 h-4 text-amber-500" />
                          ) : (
                            <X className="w-4 h-4 text-red-500" />
                          )}
                        </td>
                        <td className="py-2 px-3 font-mono font-medium">{row.sku_code}</td>
                        <td className="py-2 px-3">{row.sku_name}</td>
                        <td className="py-2 px-3">
                          <select
                            value={row.sku_type}
                            onChange={(e) => updateRowType(index, e.target.value as SKUType)}
                            className="w-full px-2 py-1 border border-gray-300 rounded text-xs bg-white"
                          >
                            {SKU_TYPE_OPTIONS.map(opt => (
                              <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                          </select>
                        </td>
                        <td className="py-2 px-3 text-gray-600">{row.category || '-'}</td>
                        <td className="py-2 px-3">
                          {row.errors.length > 0 ? (
                            <span className="text-red-600 text-[10px]">{row.errors.join(', ')}</span>
                          ) : (
                            <span className="text-green-600 text-[10px]">Ready to import</span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-center">
                          <button
                            onClick={() => removeRow(index)}
                            className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* Instructions */}
          <div className="bg-blue-50 rounded-lg border border-blue-200 p-4">
            <h4 className="text-xs font-semibold text-blue-800 mb-2">How SKU Import Works</h4>
            <ol className="text-xs text-blue-700 space-y-1 list-decimal list-inside">
              <li>Upload a CSV file with your SKU codes and names</li>
              <li>Review and fix any validation errors or duplicates</li>
              <li>Import valid SKUs - they will be created as <strong>Draft</strong> status</li>
              <li>Go to <strong>SKU Queue</strong> to see all draft SKUs</li>
              <li>Click on each SKU to open it in the Builder and configure materials/labor</li>
              <li>Once saved with materials, the SKU status changes to <strong>Complete</strong></li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}
