import { useState, useEffect, useRef } from 'react';
import { Save, Loader2, AlertCircle, Upload, Download, CheckCircle, X, AlertTriangle, Plus, Pencil } from 'lucide-react';
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
  notes?: string | null;
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

// Available product types
const PRODUCT_TYPES = [
  'Wood Vertical',
  'Wood Horizontal',
  'Iron',
  'Chain Link',
  'Vinyl',
  'Gate',
  'Deck',
  'Glass Railing',
];

export default function LaborRatesPage() {
  const [businessUnits, setBusinessUnits] = useState<BusinessUnit[]>([]);
  const [laborCodes, setLaborCodes] = useState<LaborCode[]>([]);
  const [laborRates, setLaborRates] = useState<LaborRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingChanges, setPendingChanges] = useState<RateChange[]>([]);
  const [saving, setSaving] = useState(false);
  const [productTypeFilter, setProductTypeFilter] = useState<string>('');

  // CSV Import state
  const [showImportModal, setShowImportModal] = useState(false);
  const [csvData, setCsvData] = useState<CSVRateRow[]>([]);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Labor Code Edit Modal state
  const [editingCode, setEditingCode] = useState<LaborCode | null>(null);
  const [showNewCodeModal, setShowNewCodeModal] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);

      // Load all data in parallel
      const [buResult, codesResult, ratesResult] = await Promise.all([
        supabase.from('business_units').select('id, name, code').order('name'),
        supabase.from('labor_codes').select('id, labor_sku, description, unit_type, fence_category_standard, notes').order('labor_sku'),
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

  // Get unique product types from labor codes
  const productTypes = [...new Set(
    laborCodes
      .flatMap(lc => lc.fence_category_standard || [])
      .filter(Boolean)
  )].sort();

  // Filter labor codes by product type
  const filteredLaborCodes = productTypeFilter
    ? laborCodes.filter(lc => lc.fence_category_standard?.includes(productTypeFilter))
    : laborCodes;

  // Format UOM - remove "Per " prefix if present
  const formatUOM = (uom: string): string => {
    if (!uom) return '-';
    return uom.replace(/^Per\s+/i, '');
  };

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

            {/* Product Type Filter */}
            <select
              value={productTypeFilter}
              onChange={(e) => setProductTypeFilter(e.target.value)}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
            >
              <option value="">All Product Types</option>
              {productTypes.map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            {/* Add New Code */}
            <button
              onClick={() => setShowNewCodeModal(true)}
              className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-1.5 font-medium transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Code
            </button>

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
                    <th className="px-2 py-1.5 text-left font-semibold text-gray-600 uppercase tracking-wider sticky left-0 bg-gray-50 z-10 w-[70px]">
                      Code
                    </th>
                    <th className="px-2 py-1.5 text-left font-semibold text-gray-600 uppercase tracking-wider sticky left-[70px] bg-gray-50 z-10 min-w-[280px]">
                      Description
                    </th>
                    <th className="px-1 py-1.5 text-center font-semibold text-gray-600 uppercase tracking-wider w-[45px]">
                      UOM
                    </th>
                    <th className="px-1 py-1.5 text-left font-semibold text-gray-600 uppercase tracking-wider w-[120px]">
                      Products
                    </th>
                    {businessUnits.map(bu => (
                      <th
                        key={bu.id}
                        className="px-0.5 py-1.5 text-center font-semibold text-gray-600 uppercase tracking-wider w-[55px]"
                        title={bu.name}
                      >
                        {bu.code}
                      </th>
                    ))}
                    <th className="px-1 py-1.5 text-center font-semibold text-gray-600 uppercase tracking-wider w-[30px]">
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredLaborCodes.map(code => (
                    <tr key={code.id} className="hover:bg-gray-50 group">
                      <td className="px-2 py-1 font-mono text-gray-900 sticky left-0 bg-white z-10 group-hover:bg-gray-50">
                        {code.labor_sku}
                      </td>
                      <td className="px-2 py-1 text-gray-700 sticky left-[70px] bg-white z-10 group-hover:bg-gray-50" title={code.description}>
                        <div className="truncate max-w-[280px]">{code.description}</div>
                        {code.notes && (
                          <div className="text-[10px] text-gray-400 truncate" title={code.notes}>
                            {code.notes}
                          </div>
                        )}
                      </td>
                      <td className="px-1 py-1 text-center text-gray-500">
                        {formatUOM(code.unit_type)}
                      </td>
                      <td className="px-1 py-1 text-gray-500">
                        <div className="flex flex-wrap gap-0.5">
                          {(code.fence_category_standard || []).slice(0, 2).map((pt, i) => (
                            <span key={i} className="text-[9px] bg-gray-100 text-gray-600 px-1 rounded">
                              {pt.split(' ').map(w => w[0]).join('')}
                            </span>
                          ))}
                          {(code.fence_category_standard?.length || 0) > 2 && (
                            <span className="text-[9px] text-gray-400">+{(code.fence_category_standard?.length || 0) - 2}</span>
                          )}
                        </div>
                      </td>
                      {businessUnits.map(bu => {
                        const rate = getRate(code.id, bu.id);
                        const isPending = hasPendingChange(code.id, bu.id);

                        return (
                          <td key={bu.id} className="px-0.5 py-0.5 text-center">
                            <div className="relative">
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={rate ?? ''}
                                onChange={(e) => handleRateChange(code.id, bu.id, e.target.value)}
                                className={`w-full px-0.5 py-0.5 text-[11px] text-right border rounded focus:ring-1 focus:ring-green-500 focus:border-green-500 ${
                                  isPending
                                    ? 'border-amber-400 bg-amber-50'
                                    : 'border-gray-200'
                                }`}
                                placeholder="0"
                              />
                              {isPending && (
                                <div className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-amber-400 rounded-full" />
                              )}
                            </div>
                          </td>
                        );
                      })}
                      <td className="px-1 py-0.5 text-center">
                        <button
                          onClick={() => setEditingCode(code)}
                          className="p-0.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors opacity-0 group-hover:opacity-100"
                          title="Edit labor code"
                        >
                          <Pencil className="w-3 h-3" />
                        </button>
                      </td>
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

      {/* Edit Labor Code Modal */}
      {editingCode && (
        <LaborCodeModal
          code={editingCode}
          businessUnits={businessUnits}
          laborRates={laborRates}
          onClose={() => setEditingCode(null)}
          onSaved={() => {
            setEditingCode(null);
            loadData();
          }}
        />
      )}

      {/* New Labor Code Modal */}
      {showNewCodeModal && (
        <LaborCodeModal
          code={null}
          businessUnits={businessUnits}
          laborRates={[]}
          onClose={() => setShowNewCodeModal(false)}
          onSaved={() => {
            setShowNewCodeModal(false);
            loadData();
          }}
        />
      )}
    </div>
  );
}

// Labor Code Edit/Create Modal
function LaborCodeModal({
  code,
  businessUnits,
  laborRates,
  onClose,
  onSaved,
}: {
  code: LaborCode | null;
  businessUnits: BusinessUnit[];
  laborRates: LaborRate[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const isNew = code === null;
  const [laborSku, setLaborSku] = useState(code?.labor_sku || '');
  const [description, setDescription] = useState(code?.description || '');
  const [unitType, setUnitType] = useState(code?.unit_type || 'LF');
  const [productTypes, setProductTypes] = useState<string[]>(code?.fence_category_standard || []);
  const [notes, setNotes] = useState(code?.notes || '');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Rate inputs for each BU
  const [rates, setRates] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    if (code) {
      businessUnits.forEach(bu => {
        const rate = laborRates.find(r => r.labor_code_id === code.id && r.business_unit_id === bu.id);
        initial[bu.id] = rate?.rate?.toString() || '';
      });
    }
    return initial;
  });

  const handleSave = async () => {
    if (!laborSku.trim() || !description.trim()) {
      showError('Code and description are required');
      return;
    }

    setSaving(true);
    try {
      let codeId = code?.id;

      if (isNew) {
        // Create new labor code
        const { data, error } = await supabase
          .from('labor_codes')
          .insert({
            labor_sku: laborSku.toUpperCase().trim(),
            description: description.trim(),
            unit_type: unitType,
            fence_category_standard: productTypes.length > 0 ? productTypes : null,
            notes: notes.trim() || null,
          })
          .select('id')
          .single();

        if (error) throw error;
        codeId = data.id;
      } else {
        // Update existing labor code
        const { error } = await supabase
          .from('labor_codes')
          .update({
            labor_sku: laborSku.toUpperCase().trim(),
            description: description.trim(),
            unit_type: unitType,
            fence_category_standard: productTypes.length > 0 ? productTypes : null,
            notes: notes.trim() || null,
          })
          .eq('id', code!.id);

        if (error) throw error;
      }

      // Save rates
      const rateUpserts = Object.entries(rates)
        .filter(([, val]) => val !== '')
        .map(([buId, val]) => ({
          labor_code_id: codeId!,
          business_unit_id: buId,
          rate: parseFloat(val) || 0,
          updated_at: new Date().toISOString(),
        }));

      if (rateUpserts.length > 0) {
        const { error: rateError } = await supabase
          .from('labor_rates')
          .upsert(rateUpserts, {
            onConflict: 'labor_code_id,business_unit_id',
          });

        if (rateError) throw rateError;
      }

      showSuccess(isNew ? 'Labor code created' : 'Labor code updated');
      onSaved();
    } catch (error: unknown) {
      console.error('Error saving labor code:', error);
      const errMsg = error instanceof Error ? error.message : 'Failed to save labor code';
      showError(errMsg);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!code) return;
    if (!confirm(`Delete labor code "${code.labor_sku}"? This will also delete all associated rates.`)) return;

    setDeleting(true);
    try {
      // Delete rates first
      await supabase.from('labor_rates').delete().eq('labor_code_id', code.id);

      // Delete labor code
      const { error } = await supabase.from('labor_codes').delete().eq('id', code.id);
      if (error) throw error;

      showSuccess('Labor code deleted');
      onSaved();
    } catch (error) {
      console.error('Error deleting labor code:', error);
      showError('Failed to delete labor code');
    } finally {
      setDeleting(false);
    }
  };

  const toggleProductType = (pt: string) => {
    setProductTypes(prev =>
      prev.includes(pt) ? prev.filter(p => p !== pt) : [...prev, pt]
    );
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-bold text-gray-900">
              {isNew ? 'New Labor Code' : 'Edit Labor Code'}
            </h2>
            {!isNew && (
              <p className="text-sm text-gray-500 mt-0.5">{code?.labor_sku}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Code & Description Row */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Code *</label>
              <input
                type="text"
                value={laborSku}
                onChange={(e) => setLaborSku(e.target.value.toUpperCase())}
                placeholder="e.g., LAB001"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 font-mono uppercase"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Description *</label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g., Install wood vertical fence"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
              />
            </div>
          </div>

          {/* UOM */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Unit of Measure</label>
            <select
              value={unitType}
              onChange={(e) => setUnitType(e.target.value)}
              className="w-48 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
            >
              <option value="LF">LF (Linear Foot)</option>
              <option value="SF">SF (Square Foot)</option>
              <option value="EA">EA (Each)</option>
              <option value="HR">HR (Hour)</option>
              <option value="POST">POST</option>
              <option value="PANEL">PANEL</option>
            </select>
          </div>

          {/* Product Types */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Applies to Product Types</label>
            <div className="flex flex-wrap gap-2">
              {PRODUCT_TYPES.map(pt => (
                <button
                  key={pt}
                  type="button"
                  onClick={() => toggleProductType(pt)}
                  className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                    productTypes.includes(pt)
                      ? 'bg-green-100 border-green-300 text-green-800'
                      : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {pt}
                </button>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Additional notes or instructions..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm"
            />
          </div>

          {/* Rates by Business Unit */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Rates by Business Unit ($)</label>
            <div className="grid grid-cols-4 gap-3">
              {businessUnits.map(bu => (
                <div key={bu.id}>
                  <label className="block text-xs text-gray-500 mb-0.5" title={bu.name}>{bu.code}</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={rates[bu.id] || ''}
                    onChange={(e) => setRates(prev => ({ ...prev, [bu.id]: e.target.value }))}
                    placeholder="0.00"
                    className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 text-right"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-gray-50">
          {!isNew ? (
            <button
              onClick={handleDelete}
              disabled={deleting || saving}
              className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
            >
              {deleting ? 'Deleting...' : 'Delete Code'}
            </button>
          ) : (
            <div />
          )}
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || deleting}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 flex items-center gap-2 font-medium transition-colors"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  {isNew ? 'Create Code' : 'Save Changes'}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
