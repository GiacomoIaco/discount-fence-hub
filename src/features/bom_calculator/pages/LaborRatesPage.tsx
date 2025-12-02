import { useState, useEffect, useRef } from 'react';
import { Save, Loader2, AlertCircle, Upload, Download, CheckCircle, X, AlertTriangle } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { showSuccess, showError } from '../../../lib/toast';

interface BusinessUnit {
  id: string;
  name: string;
  code: string;
}

interface LaborCode {
  id: string;
  labor_sku: string;
  description: string;
  unit_type: string;
  fence_category_standard: string[] | null;
}

interface LaborRate {
  id: string;
  labor_code_id: string;
  business_unit_id: string;
  rate: number;
  updated_at: string;
}

interface RateChange {
  laborCodeId: string;
  businessUnitId: string;
  newRate: number;
}

interface CSVRateRow {
  labor_sku: string;
  bu_code: string;
  rate: number;
  currentRate?: number;
  laborCodeId?: string;
  businessUnitId?: string;
  status: 'match' | 'not_found' | 'error';
  error?: string;
}

export default function LaborRatesPage() {
  const [businessUnits, setBusinessUnits] = useState<BusinessUnit[]>([]);
  const [laborCodes, setLaborCodes] = useState<LaborCode[]>([]);
  const [laborRates, setLaborRates] = useState<LaborRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingChanges, setPendingChanges] = useState<RateChange[]>([]);
  const [saving, setSaving] = useState(false);
  const [fenceTypeFilter, setFenceTypeFilter] = useState<string>('');

  // CSV Import state
  const [showImportModal, setShowImportModal] = useState(false);
  const [csvData, setCsvData] = useState<CSVRateRow[]>([]);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);

      // Load all data in parallel
      const [buResult, codesResult, ratesResult] = await Promise.all([
        supabase.from('business_units').select('id, name, code').order('name'),
        supabase.from('labor_codes').select('id, labor_sku, description, unit_type, fence_category_standard').order('labor_sku'),
        supabase.from('labor_rates').select('id, labor_code_id, business_unit_id, rate, updated_at'),
      ]);

      if (buResult.error) throw buResult.error;
      if (codesResult.error) throw codesResult.error;
      if (ratesResult.error) throw ratesResult.error;

      setBusinessUnits(buResult.data || []);
      setLaborCodes(codesResult.data || []);
      setLaborRates(ratesResult.data || []);
    } catch (error) {
      console.error('Error loading data:', error);
      showError('Failed to load labor rates data');
    } finally {
      setLoading(false);
    }
  };

  // Get rate for a specific labor code and business unit
  const getRate = (laborCodeId: string, businessUnitId: string): number | null => {
    // Check pending changes first
    const pending = pendingChanges.find(
      c => c.laborCodeId === laborCodeId && c.businessUnitId === businessUnitId
    );
    if (pending !== undefined) {
      return pending.newRate;
    }

    // Check existing rates
    const rate = laborRates.find(
      r => r.labor_code_id === laborCodeId && r.business_unit_id === businessUnitId
    );
    return rate?.rate ?? null;
  };

  // Check if a rate has pending changes
  const hasPendingChange = (laborCodeId: string, businessUnitId: string): boolean => {
    return pendingChanges.some(
      c => c.laborCodeId === laborCodeId && c.businessUnitId === businessUnitId
    );
  };

  // Handle rate change
  const handleRateChange = (laborCodeId: string, businessUnitId: string, value: string) => {
    const newRate = parseFloat(value) || 0;

    // Remove existing pending change for this cell
    const filtered = pendingChanges.filter(
      c => !(c.laborCodeId === laborCodeId && c.businessUnitId === businessUnitId)
    );

    // Get original rate
    const originalRate = laborRates.find(
      r => r.labor_code_id === laborCodeId && r.business_unit_id === businessUnitId
    );

    // Only add to pending if different from original
    if (originalRate?.rate !== newRate) {
      setPendingChanges([...filtered, { laborCodeId, businessUnitId, newRate }]);
    } else {
      setPendingChanges(filtered);
    }
  };

  // Save all pending changes
  const handleSaveAll = async () => {
    if (pendingChanges.length === 0) return;

    setSaving(true);
    try {
      const upserts = pendingChanges.map(change => ({
        labor_code_id: change.laborCodeId,
        business_unit_id: change.businessUnitId,
        rate: change.newRate,
        updated_at: new Date().toISOString(),
      }));

      const { error } = await supabase
        .from('labor_rates')
        .upsert(upserts, {
          onConflict: 'labor_code_id,business_unit_id',
        });

      if (error) throw error;

      showSuccess(`${pendingChanges.length} rate(s) updated`);
      setPendingChanges([]);
      loadData(); // Refresh data
    } catch (error) {
      console.error('Error saving rates:', error);
      showError('Failed to save rates');
    } finally {
      setSaving(false);
    }
  };

  // Discard all pending changes
  const handleDiscardChanges = () => {
    setPendingChanges([]);
  };

  // CSV Import functions
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      parseCSV(text);
    };
    reader.readAsText(file);
  };

  const parseCSV = (text: string) => {
    const lines = text.trim().split('\n');
    if (lines.length < 2) {
      showError('CSV file is empty or has no data rows');
      return;
    }

    // Parse header row
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/['"]/g, ''));
    const skuIndex = headers.findIndex(h => h === 'labor_sku' || h === 'sku' || h === 'code');
    const buIndex = headers.findIndex(h => h === 'bu_code' || h === 'business_unit' || h === 'bu');
    const rateIndex = headers.findIndex(h => h === 'rate' || h === 'cost' || h === 'price');

    if (skuIndex === -1 || buIndex === -1 || rateIndex === -1) {
      showError('CSV must have "labor_sku", "bu_code", and "rate" columns');
      return;
    }

    // Parse data rows
    const rows: CSVRateRow[] = [];
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim().replace(/['"]/g, ''));
      const sku = values[skuIndex]?.toUpperCase();
      const buCode = values[buIndex]?.toUpperCase();
      const rateStr = values[rateIndex]?.replace(/[$,]/g, '');
      const rate = parseFloat(rateStr);

      if (!sku || !buCode) continue;

      if (isNaN(rate)) {
        rows.push({
          labor_sku: sku,
          bu_code: buCode,
          rate: 0,
          status: 'error',
          error: 'Invalid rate value',
        });
        continue;
      }

      // Find matching labor code and business unit
      const laborCode = laborCodes.find(lc => lc.labor_sku.toUpperCase() === sku);
      const businessUnit = businessUnits.find(bu => bu.code.toUpperCase() === buCode);

      if (!laborCode) {
        rows.push({
          labor_sku: sku,
          bu_code: buCode,
          rate,
          status: 'not_found',
          error: 'Labor code not found',
        });
        continue;
      }

      if (!businessUnit) {
        rows.push({
          labor_sku: sku,
          bu_code: buCode,
          rate,
          status: 'not_found',
          error: 'Business unit not found',
        });
        continue;
      }

      // Find current rate
      const currentRateObj = laborRates.find(
        r => r.labor_code_id === laborCode.id && r.business_unit_id === businessUnit.id
      );

      rows.push({
        labor_sku: sku,
        bu_code: buCode,
        rate,
        currentRate: currentRateObj?.rate,
        laborCodeId: laborCode.id,
        businessUnitId: businessUnit.id,
        status: 'match',
      });
    }

    setCsvData(rows);
    setShowImportModal(true);

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleImportConfirm = async () => {
    const validRows = csvData.filter(r => r.status === 'match' && r.laborCodeId && r.businessUnitId);
    if (validRows.length === 0) {
      showError('No valid rows to import');
      return;
    }

    setImporting(true);
    try {
      const upserts = validRows.map(row => ({
        labor_code_id: row.laborCodeId!,
        business_unit_id: row.businessUnitId!,
        rate: row.rate,
        updated_at: new Date().toISOString(),
      }));

      const { error } = await supabase
        .from('labor_rates')
        .upsert(upserts, {
          onConflict: 'labor_code_id,business_unit_id',
        });

      if (error) throw error;

      showSuccess(`${validRows.length} rate(s) imported`);
      setShowImportModal(false);
      setCsvData([]);
      loadData();
    } catch (error) {
      console.error('Error importing rates:', error);
      showError('Failed to import rates');
    } finally {
      setImporting(false);
    }
  };

  const handleExportRates = () => {
    const headers = 'labor_sku,bu_code,rate\n';
    const rows: string[] = [];

    for (const code of laborCodes) {
      for (const bu of businessUnits) {
        const rate = laborRates.find(
          r => r.labor_code_id === code.id && r.business_unit_id === bu.id
        );
        if (rate) {
          rows.push(`${code.labor_sku},${bu.code},${rate.rate.toFixed(2)}`);
        }
      }
    }

    const csv = headers + rows.join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'labor_rates.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  // Get unique fence types from labor codes
  const fenceTypes = [...new Set(
    laborCodes
      .flatMap(lc => lc.fence_category_standard || [])
      .filter(Boolean)
  )].sort();

  // Filter labor codes by fence type
  const filteredLaborCodes = fenceTypeFilter
    ? laborCodes.filter(lc => lc.fence_category_standard?.includes(fenceTypeFilter))
    : laborCodes;

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-green-600 mx-auto mb-3" />
          <p className="text-gray-600">Loading labor rates...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-gray-50 overflow-hidden">
      {/* Header - Compact */}
      <div className="bg-white border-b border-gray-200 px-4 py-2">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div>
              <h1 className="text-lg font-bold text-gray-900">Labor Rates</h1>
              <p className="text-xs text-gray-500">
                {filteredLaborCodes.length} codes · {businessUnits.length} units
              </p>
            </div>

            {/* Fence Type Filter */}
            <select
              value={fenceTypeFilter}
              onChange={(e) => setFenceTypeFilter(e.target.value)}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
            >
              <option value="">All Fence Types</option>
              {fenceTypes.map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleFileSelect}
              className="hidden"
            />
            <button
              onClick={handleExportRates}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-1.5 text-gray-700 transition-colors"
              title="Export current rates to CSV"
            >
              <Download className="w-3.5 h-3.5" />
              Export
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-1.5 text-gray-700 transition-colors"
              title="Import rates from CSV"
            >
              <Upload className="w-3.5 h-3.5" />
              Import
            </button>

            {/* Save/Discard buttons */}
            {pendingChanges.length > 0 && (
              <>
                <span className="text-xs text-amber-600 flex items-center gap-1 ml-2">
                  <AlertCircle className="w-3.5 h-3.5" />
                  {pendingChanges.length} unsaved
                </span>
                <button
                  onClick={handleDiscardChanges}
                  className="px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Discard
                </button>
                <button
                  onClick={handleSaveAll}
                  disabled={saving}
                  className="bg-green-600 text-white px-3 py-1.5 text-sm rounded-lg hover:bg-green-700 flex items-center gap-1.5 font-medium transition-colors disabled:bg-gray-400"
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-3.5 h-3.5" />
                      Save
                    </>
                  )}
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Matrix Table */}
      <div className="flex-1 overflow-auto p-3">
        {filteredLaborCodes.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500">No labor codes found</p>
          </div>
        ) : (
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-2 py-1.5 text-left font-semibold text-gray-600 uppercase tracking-wider sticky left-0 bg-gray-50 z-10 min-w-[60px]">
                      Code
                    </th>
                    <th className="px-2 py-1.5 text-left font-semibold text-gray-600 uppercase tracking-wider sticky left-[60px] bg-gray-50 z-10 min-w-[160px]">
                      Description
                    </th>
                    <th className="px-1 py-1.5 text-center font-semibold text-gray-600 uppercase tracking-wider min-w-[40px]">
                      UOM
                    </th>
                    {businessUnits.map(bu => (
                      <th
                        key={bu.id}
                        className="px-1 py-1.5 text-center font-semibold text-gray-600 uppercase tracking-wider min-w-[80px]"
                        title={bu.name}
                      >
                        {bu.code}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredLaborCodes.map(code => (
                    <tr key={code.id} className="hover:bg-gray-50">
                      <td className="px-2 py-1 font-mono text-gray-900 sticky left-0 bg-white z-10">
                        {code.labor_sku}
                      </td>
                      <td className="px-2 py-1 text-gray-700 sticky left-[60px] bg-white z-10 truncate max-w-[160px]" title={code.description}>
                        {code.description}
                      </td>
                      <td className="px-1 py-1 text-center text-gray-500">
                        {code.unit_type}
                      </td>
                      {businessUnits.map(bu => {
                        const rate = getRate(code.id, bu.id);
                        const isPending = hasPendingChange(code.id, bu.id);

                        return (
                          <td key={bu.id} className="px-1 py-0.5 text-center">
                            <div className="relative">
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={rate ?? ''}
                                onChange={(e) => handleRateChange(code.id, bu.id, e.target.value)}
                                className={`w-full px-1 py-0.5 text-xs text-right border rounded focus:ring-1 focus:ring-green-500 focus:border-green-500 ${
                                  isPending
                                    ? 'border-amber-400 bg-amber-50'
                                    : 'border-gray-200'
                                }`}
                                placeholder="0"
                              />
                              {isPending && (
                                <div className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-amber-400 rounded-full" />
                              )}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Legend - Compact */}
      <div className="bg-white border-t border-gray-200 px-4 py-1.5">
        <div className="flex items-center gap-4 text-xs text-gray-500">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 border border-gray-200 rounded" />
            <span>Saved</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 border border-amber-400 bg-amber-50 rounded relative">
              <div className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-amber-400 rounded-full" />
            </div>
            <span>Unsaved</span>
          </div>
        </div>
      </div>

      {/* Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Import Labor Rates</h2>
                <p className="text-sm text-gray-500 mt-1">
                  Review changes before importing
                </p>
              </div>
              <button
                onClick={() => { setShowImportModal(false); setCsvData([]); }}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Summary */}
            <div className="px-6 py-3 bg-gray-50 border-b flex items-center gap-6 text-sm">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-600" />
                <span>{csvData.filter(r => r.status === 'match').length} will update</span>
              </div>
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                <span>{csvData.filter(r => r.status === 'not_found').length} not found</span>
              </div>
              <div className="flex items-center gap-2">
                <X className="w-4 h-4 text-red-500" />
                <span>{csvData.filter(r => r.status === 'error').length} errors</span>
              </div>
            </div>

            {/* Table */}
            <div className="flex-1 overflow-auto p-4">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold text-gray-600">Status</th>
                    <th className="px-3 py-2 text-left font-semibold text-gray-600">Labor SKU</th>
                    <th className="px-3 py-2 text-left font-semibold text-gray-600">BU</th>
                    <th className="px-3 py-2 text-right font-semibold text-gray-600">Current</th>
                    <th className="px-3 py-2 text-right font-semibold text-gray-600">New</th>
                    <th className="px-3 py-2 text-right font-semibold text-gray-600">Change</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {csvData.map((row, idx) => {
                    const diff = row.status === 'match' && row.currentRate !== undefined
                      ? row.rate - row.currentRate
                      : null;
                    return (
                      <tr key={idx} className={row.status !== 'match' ? 'bg-gray-50' : ''}>
                        <td className="px-3 py-2">
                          {row.status === 'match' && (
                            <span className="inline-flex items-center gap-1 text-green-600">
                              <CheckCircle className="w-4 h-4" />
                            </span>
                          )}
                          {row.status === 'not_found' && (
                            <span className="inline-flex items-center gap-1 text-amber-500" title={row.error}>
                              <AlertTriangle className="w-4 h-4" />
                            </span>
                          )}
                          {row.status === 'error' && (
                            <span className="inline-flex items-center gap-1 text-red-500" title={row.error}>
                              <X className="w-4 h-4" />
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 font-mono">{row.labor_sku}</td>
                        <td className="px-3 py-2 font-mono text-gray-600">{row.bu_code}</td>
                        <td className="px-3 py-2 text-right text-gray-500">
                          {row.currentRate !== undefined ? `$${row.currentRate.toFixed(2)}` : '-'}
                        </td>
                        <td className="px-3 py-2 text-right font-medium">
                          ${row.rate.toFixed(2)}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {diff !== null && (
                            <span className={diff > 0 ? 'text-red-600' : diff < 0 ? 'text-green-600' : 'text-gray-400'}>
                              {diff > 0 ? '+' : ''}{diff.toFixed(2)}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50">
              <button
                onClick={() => { setShowImportModal(false); setCsvData([]); }}
                className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleImportConfirm}
                disabled={importing || csvData.filter(r => r.status === 'match').length === 0}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 flex items-center gap-2 font-medium transition-colors"
              >
                {importing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Importing...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    Import {csvData.filter(r => r.status === 'match').length} Rates
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
