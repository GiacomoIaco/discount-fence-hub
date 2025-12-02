import { useState, useEffect } from 'react';
import { Save, Loader2, AlertCircle } from 'lucide-react';
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

export default function LaborRatesPage() {
  const [businessUnits, setBusinessUnits] = useState<BusinessUnit[]>([]);
  const [laborCodes, setLaborCodes] = useState<LaborCode[]>([]);
  const [laborRates, setLaborRates] = useState<LaborRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingChanges, setPendingChanges] = useState<RateChange[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);

      // Load all data in parallel
      const [buResult, codesResult, ratesResult] = await Promise.all([
        supabase.from('business_units').select('id, name, code').order('name'),
        supabase.from('labor_codes').select('id, labor_sku, description, unit_type').order('labor_sku'),
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
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Labor Rates</h1>
            <p className="text-sm text-gray-600 mt-1">
              Manage labor rates by business unit
            </p>
          </div>

          {/* Save/Discard buttons */}
          {pendingChanges.length > 0 && (
            <div className="flex items-center gap-3">
              <span className="text-sm text-amber-600 flex items-center gap-1">
                <AlertCircle className="w-4 h-4" />
                {pendingChanges.length} unsaved change(s)
              </span>
              <button
                onClick={handleDiscardChanges}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Discard
              </button>
              <button
                onClick={handleSaveAll}
                disabled={saving}
                className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 flex items-center gap-2 font-medium transition-colors disabled:bg-gray-400"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    Save All
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Matrix Table */}
      <div className="flex-1 overflow-auto p-6">
        {laborCodes.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500">No labor codes found</p>
          </div>
        ) : (
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider sticky left-0 bg-gray-50 z-10 min-w-[100px]">
                      Code
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider sticky left-[100px] bg-gray-50 z-10 min-w-[200px]">
                      Description
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider min-w-[60px]">
                      UOM
                    </th>
                    {businessUnits.map(bu => (
                      <th
                        key={bu.id}
                        className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider min-w-[120px]"
                      >
                        {bu.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {laborCodes.map(code => (
                    <tr key={code.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-mono text-gray-900 sticky left-0 bg-white z-10">
                        {code.labor_sku}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700 sticky left-[100px] bg-white z-10">
                        {code.description}
                      </td>
                      <td className="px-4 py-3 text-sm text-center text-gray-500">
                        {code.unit_type}
                      </td>
                      {businessUnits.map(bu => {
                        const rate = getRate(code.id, bu.id);
                        const isPending = hasPendingChange(code.id, bu.id);

                        return (
                          <td key={bu.id} className="px-2 py-2 text-center">
                            <div className="relative">
                              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
                                $
                              </span>
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={rate ?? ''}
                                onChange={(e) => handleRateChange(code.id, bu.id, e.target.value)}
                                className={`w-full pl-6 pr-2 py-1.5 text-sm text-right border rounded focus:ring-2 focus:ring-green-500 focus:border-green-500 ${
                                  isPending
                                    ? 'border-amber-400 bg-amber-50'
                                    : 'border-gray-300'
                                }`}
                                placeholder="0.00"
                              />
                              {isPending && (
                                <div className="absolute -top-1 -right-1 w-3 h-3 bg-amber-400 rounded-full" />
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

      {/* Legend */}
      <div className="bg-white border-t border-gray-200 px-6 py-3">
        <div className="flex items-center gap-6 text-sm text-gray-600">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 border border-gray-300 rounded" />
            <span>Saved rate</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 border border-amber-400 bg-amber-50 rounded relative">
              <div className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-amber-400 rounded-full" />
            </div>
            <span>Unsaved change</span>
          </div>
        </div>
      </div>
    </div>
  );
}
