import { useState, useEffect } from 'react';
import {
  X,
  FileSpreadsheet,
  Search,
  Trash2,
  DollarSign,
  Percent,
  Save,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Plus,
} from 'lucide-react';
import {
  useRateSheet,
  useCreateRateSheet,
  useUpdateRateSheet,
  useSkuCatalog,
  useBulkUpsertRateSheetItems,
  useDeleteRateSheetItem,
} from '../hooks/useRateSheets';
import {
  type RateSheet,
  type RateSheetItem,
  type PricingType,
  type PricingMethod,
  PRICING_TYPE_LABELS,
  PRICING_METHOD_LABELS,
} from '../types';
import RateSheetBulkAddModal, { type SkuData } from './RateSheetBulkAddModal';

interface Props {
  rateSheet: RateSheet | null;
  onClose: () => void;
}

interface ItemEdit {
  sku_id: string;
  sku: string;
  description: string;
  unit: string;
  catalog_price: number;
  pricing_method: PricingMethod;
  fixed_price: string;
  fixed_labor_price: string;
  fixed_material_price: string;
  labor_markup_percent: string;
  material_markup_percent: string;
  margin_target_percent: string;
  cost_plus_amount: string;
  isNew?: boolean;
  isModified?: boolean;
  itemId?: string;
}

export default function RateSheetEditorModal({ rateSheet, onClose }: Props) {
  const isEditing = !!rateSheet;

  // Form state - initialize from rateSheet prop immediately when editing
  const [name, setName] = useState(rateSheet?.name || '');
  const [code, setCode] = useState(rateSheet?.code || '');
  const [description, setDescription] = useState(rateSheet?.description || '');
  const [pricingType, setPricingType] = useState<PricingType>(rateSheet?.pricing_type || 'custom');
  const [defaultLaborMarkup, setDefaultLaborMarkup] = useState(String(rateSheet?.default_labor_markup || 0));
  const [defaultMaterialMarkup, setDefaultMaterialMarkup] = useState(String(rateSheet?.default_material_markup || 0));
  const [defaultMarginTarget, setDefaultMarginTarget] = useState(rateSheet?.default_margin_target ? String(rateSheet.default_margin_target) : '');
  const [effectiveDate, setEffectiveDate] = useState(rateSheet?.effective_date || new Date().toISOString().split('T')[0]);
  const [expiresAt, setExpiresAt] = useState(rateSheet?.expires_at || '');
  const [isActive, setIsActive] = useState(rateSheet?.is_active ?? true);
  const [isTemplate, setIsTemplate] = useState(rateSheet?.is_template ?? false);
  const [notes, setNotes] = useState(rateSheet?.notes || '');

  // Validation state
  const [validationError, setValidationError] = useState('');
  const [saveError, setSaveError] = useState('');

  // Items state
  const [items, setItems] = useState<ItemEdit[]>([]);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [activeTab, setActiveTab] = useState<'info' | 'items'>('info');
  const [showBulkAdd, setShowBulkAdd] = useState(false);

  // SKU search
  const [skuSearch, setSkuSearch] = useState('');
  const [showSkuDropdown, setShowSkuDropdown] = useState(false);

  // Queries
  const { data: fullRateSheet, isLoading: loadingSheet } = useRateSheet(rateSheet?.id || null);
  const { data: skuCatalog } = useSkuCatalog(skuSearch);

  // Mutations
  const createMutation = useCreateRateSheet();
  const updateMutation = useUpdateRateSheet();
  const bulkUpsertMutation = useBulkUpsertRateSheetItems();
  const deleteItemMutation = useDeleteRateSheetItem();

  // Load existing data
  useEffect(() => {
    if (fullRateSheet) {
      setName(fullRateSheet.name);
      setCode(fullRateSheet.code || '');
      setDescription(fullRateSheet.description || '');
      setPricingType(fullRateSheet.pricing_type);
      setDefaultLaborMarkup(String(fullRateSheet.default_labor_markup || 0));
      setDefaultMaterialMarkup(String(fullRateSheet.default_material_markup || 0));
      setDefaultMarginTarget(fullRateSheet.default_margin_target ? String(fullRateSheet.default_margin_target) : '');
      setEffectiveDate(fullRateSheet.effective_date);
      setExpiresAt(fullRateSheet.expires_at || '');
      setIsActive(fullRateSheet.is_active);
      setIsTemplate(fullRateSheet.is_template);
      setNotes(fullRateSheet.notes || '');

      // Load items
      if (fullRateSheet.items) {
        setItems(
          fullRateSheet.items.map((item: RateSheetItem & { sku: any }) => ({
            sku_id: item.sku_id,
            sku: item.sku?.sku || '',
            description: item.sku?.description || '',
            unit: item.unit || item.sku?.unit || 'EA',
            catalog_price: item.sku?.sell_price || 0,
            pricing_method: item.pricing_method,
            fixed_price: item.fixed_price !== null ? String(item.fixed_price) : '',
            fixed_labor_price: item.fixed_labor_price !== null ? String(item.fixed_labor_price) : '',
            fixed_material_price: item.fixed_material_price !== null ? String(item.fixed_material_price) : '',
            labor_markup_percent: item.labor_markup_percent !== null ? String(item.labor_markup_percent) : '',
            material_markup_percent: item.material_markup_percent !== null ? String(item.material_markup_percent) : '',
            margin_target_percent: item.margin_target_percent !== null ? String(item.margin_target_percent) : '',
            cost_plus_amount: item.cost_plus_amount !== null ? String(item.cost_plus_amount) : '',
            itemId: item.id,
          }))
        );
      }
    }
  }, [fullRateSheet]);

  const handleAddSku = (sku: { id: string; sku: string; description: string; unit: string; sell_price: number }) => {
    if (items.find(i => i.sku_id === sku.id)) {
      return; // Already added
    }

    setItems([
      ...items,
      {
        sku_id: sku.id,
        sku: sku.sku,
        description: sku.description || '',
        unit: sku.unit || 'EA',
        catalog_price: sku.sell_price || 0,
        pricing_method: 'fixed',
        fixed_price: '',
        fixed_labor_price: '',
        fixed_material_price: '',
        labor_markup_percent: '',
        material_markup_percent: '',
        margin_target_percent: '',
        cost_plus_amount: '',
        isNew: true,
        isModified: true,
      },
    ]);
    setSkuSearch('');
    setShowSkuDropdown(false);
  };

  const handleBulkAddSkus = (skus: SkuData[]) => {
    const newItems = skus
      .filter(sku => !items.find(i => i.sku_id === sku.id))
      .map(sku => ({
        sku_id: sku.id,
        sku: sku.sku,
        description: sku.description || '',
        unit: sku.unit || 'EA',
        catalog_price: sku.sell_price || 0,
        pricing_method: 'fixed' as PricingMethod,
        fixed_price: '',
        fixed_labor_price: '',
        fixed_material_price: '',
        labor_markup_percent: '',
        material_markup_percent: '',
        margin_target_percent: '',
        cost_plus_amount: '',
        isNew: true,
        isModified: true,
      }));

    setItems([...items, ...newItems]);
  };

  const handleRemoveItem = (skuId: string) => {
    const item = items.find(i => i.sku_id === skuId);
    if (item?.itemId && rateSheet?.id) {
      deleteItemMutation.mutate({ id: item.itemId, rate_sheet_id: rateSheet.id });
    }
    setItems(items.filter(i => i.sku_id !== skuId));
  };

  const handleItemChange = (skuId: string, field: keyof ItemEdit, value: string) => {
    setItems(
      items.map(item =>
        item.sku_id === skuId
          ? { ...item, [field]: value, isModified: true }
          : item
      )
    );
  };

  const handleSave = async () => {
    // Validate required fields
    if (!name.trim()) {
      setValidationError('Name is required');
      return;
    }
    setValidationError('');
    setSaveError('');

    try {
      let sheetId = rateSheet?.id;

      // Save/update the rate sheet
      const sheetData = {
        name: name.trim(),
        code: code.trim() || null,
        description: description.trim() || null,
        pricing_type: pricingType,
        default_labor_markup: parseFloat(defaultLaborMarkup) || 0,
        default_material_markup: parseFloat(defaultMaterialMarkup) || 0,
        default_margin_target: defaultMarginTarget ? parseFloat(defaultMarginTarget) : null,
        effective_date: effectiveDate,
        expires_at: expiresAt || null,
        is_active: isActive,
        is_template: isTemplate,
        notes: notes.trim() || null,
      };

      console.log('Saving rate sheet:', isEditing ? 'UPDATE' : 'CREATE', sheetData);

      if (isEditing) {
        const result = await updateMutation.mutateAsync({ id: sheetId!, ...sheetData });
        console.log('Update result:', result);
      } else {
        const result = await createMutation.mutateAsync(sheetData);
        console.log('Create result:', result);
        sheetId = result.id;
      }

      // Save items
      const modifiedItems = items.filter(i => i.isModified);
      if (modifiedItems.length > 0 && sheetId) {
        console.log('Saving modified items:', modifiedItems.length);
        await bulkUpsertMutation.mutateAsync({
          rate_sheet_id: sheetId,
          items: modifiedItems.map(item => ({
            sku_id: item.sku_id,
            pricing_method: item.pricing_method,
            fixed_price: item.fixed_price ? parseFloat(item.fixed_price) : null,
            fixed_labor_price: item.fixed_labor_price ? parseFloat(item.fixed_labor_price) : null,
            fixed_material_price: item.fixed_material_price ? parseFloat(item.fixed_material_price) : null,
            labor_markup_percent: item.labor_markup_percent ? parseFloat(item.labor_markup_percent) : null,
            material_markup_percent: item.material_markup_percent ? parseFloat(item.material_markup_percent) : null,
            margin_target_percent: item.margin_target_percent ? parseFloat(item.margin_target_percent) : null,
            cost_plus_amount: item.cost_plus_amount ? parseFloat(item.cost_plus_amount) : null,
            unit: item.unit,
          })),
        });
      }

      onClose();
    } catch (error: any) {
      console.error('Error saving rate sheet:', error);
      setSaveError(error?.message || 'Failed to save rate sheet. Please try again.');
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending || bulkUpsertMutation.isPending;

  if (loadingSheet) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-xl p-8">
          <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <FileSpreadsheet className="w-5 h-5 text-blue-600" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900">
              {isEditing ? 'Edit Rate Sheet' : 'New Rate Sheet'}
            </h2>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 px-6">
          <button
            onClick={() => setActiveTab('info')}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'info'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Sheet Info
          </button>
          <button
            onClick={() => setActiveTab('items')}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'items'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            SKU Prices ({items.length})
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'info' ? (
            <div className="space-y-6">
              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      if (validationError) setValidationError('');
                    }}
                    placeholder="e.g., Perry Homes - Standard"
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                      validationError ? 'border-red-300 bg-red-50' : 'border-gray-200'
                    }`}
                  />
                  {validationError && (
                    <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
                      <AlertCircle className="w-4 h-4" />
                      {validationError}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Code</label>
                  <input
                    type="text"
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    placeholder="e.g., PERRY-STD"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  placeholder="Optional description..."
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Pricing Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Pricing Type</label>
                <div className="grid grid-cols-3 gap-3">
                  {(Object.keys(PRICING_TYPE_LABELS) as PricingType[]).map((type) => (
                    <button
                      key={type}
                      onClick={() => setPricingType(type)}
                      className={`p-4 border rounded-lg text-left transition-colors ${
                        pricingType === type
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="font-medium text-gray-900">{PRICING_TYPE_LABELS[type]}</div>
                      <div className="text-xs text-gray-500 mt-1">
                        {type === 'custom' && 'Enter fixed prices for each SKU'}
                        {type === 'formula' && 'Calculate prices from cost + markup'}
                        {type === 'hybrid' && 'Mix of fixed and calculated prices'}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Default Pricing Rules (for formula/hybrid) */}
              {(pricingType === 'formula' || pricingType === 'hybrid') && (
                <div className="bg-purple-50 rounded-lg p-4">
                  <h3 className="text-sm font-medium text-purple-900 mb-3">Default Pricing Rules</h3>
                  <p className="text-xs text-purple-700 mb-3">
                    Choose ONE method: Target Margin OR Markup percentages (not both)
                  </p>

                  {/* Pricing Method Toggle */}
                  <div className="flex gap-2 mb-4">
                    <button
                      type="button"
                      onClick={() => {
                        setDefaultMarginTarget('');
                        // Keep existing markup values or set defaults
                      }}
                      className={`flex-1 px-3 py-2 text-sm rounded-lg border transition-colors ${
                        !defaultMarginTarget
                          ? 'bg-purple-600 text-white border-purple-600'
                          : 'bg-white text-purple-700 border-purple-200 hover:border-purple-400'
                      }`}
                    >
                      Use Markup %
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setDefaultLaborMarkup('0');
                        setDefaultMaterialMarkup('0');
                        if (!defaultMarginTarget) setDefaultMarginTarget('33');
                      }}
                      className={`flex-1 px-3 py-2 text-sm rounded-lg border transition-colors ${
                        defaultMarginTarget
                          ? 'bg-purple-600 text-white border-purple-600'
                          : 'bg-white text-purple-700 border-purple-200 hover:border-purple-400'
                      }`}
                    >
                      Use Target Margin %
                    </button>
                  </div>

                  {/* Margin Input (when margin mode selected) */}
                  {defaultMarginTarget && (
                    <div className="bg-white rounded-lg p-3 border border-purple-200">
                      <label className="block text-sm font-medium text-purple-800 mb-1">
                        Target Gross Margin %
                      </label>
                      <p className="text-xs text-purple-600 mb-2">
                        Price = Cost ÷ (1 - Margin%). Example: 40% margin on $10 cost = $16.67 price
                      </p>
                      <div className="relative w-32">
                        <input
                          type="number"
                          value={defaultMarginTarget}
                          onChange={(e) => setDefaultMarginTarget(e.target.value)}
                          placeholder="e.g., 40"
                          className="w-full px-3 py-2 pr-8 border border-purple-200 rounded-lg focus:ring-2 focus:ring-purple-500"
                        />
                        <Percent className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-purple-400" />
                      </div>
                    </div>
                  )}

                  {/* Markup Inputs (when markup mode selected) */}
                  {!defaultMarginTarget && (
                    <div className="bg-white rounded-lg p-3 border border-purple-200">
                      <p className="text-xs text-purple-600 mb-3">
                        Price = Cost × (1 + Markup%). Example: 50% markup on $10 cost = $15 price
                      </p>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-purple-800 mb-1">
                            Labor Markup %
                          </label>
                          <div className="relative">
                            <input
                              type="number"
                              value={defaultLaborMarkup}
                              onChange={(e) => setDefaultLaborMarkup(e.target.value)}
                              placeholder="e.g., 50"
                              className="w-full px-3 py-2 pr-8 border border-purple-200 rounded-lg focus:ring-2 focus:ring-purple-500"
                            />
                            <Percent className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-purple-400" />
                          </div>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-purple-800 mb-1">
                            Material Markup %
                          </label>
                          <div className="relative">
                            <input
                              type="number"
                              value={defaultMaterialMarkup}
                              onChange={(e) => setDefaultMaterialMarkup(e.target.value)}
                              placeholder="e.g., 30"
                              className="w-full px-3 py-2 pr-8 border border-purple-200 rounded-lg focus:ring-2 focus:ring-purple-500"
                            />
                            <Percent className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-purple-400" />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Status & Dates */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Effective Date</label>
                  <input
                    type="date"
                    value={effectiveDate}
                    onChange={(e) => setEffectiveDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Expires At</label>
                  <input
                    type="date"
                    value={expiresAt}
                    onChange={(e) => setExpiresAt(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Advanced Options */}
              <div>
                <button
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-800"
                >
                  {showAdvanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  Advanced Options
                </button>
                {showAdvanced && (
                  <div className="mt-3 space-y-3 pl-6">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isActive}
                        onChange={(e) => setIsActive(e.target.checked)}
                        className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700">Active (can be assigned to clients)</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isTemplate}
                        onChange={(e) => setIsTemplate(e.target.checked)}
                        className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700">Template (can be cloned for new rate sheets)</span>
                    </label>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                      <textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        rows={2}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* SKU Search */}
              <div className="relative">
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      value={skuSearch}
                      onChange={(e) => {
                        setSkuSearch(e.target.value);
                        setShowSkuDropdown(true);
                      }}
                      onFocus={() => setShowSkuDropdown(true)}
                      placeholder="Search SKUs to add..."
                      className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <button
                    onClick={() => setShowBulkAdd(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200"
                  >
                    <Plus className="w-4 h-4" />
                    Bulk Add
                  </button>
                </div>

                {/* SKU Dropdown */}
                {showSkuDropdown && skuCatalog && skuCatalog.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10 max-h-60 overflow-y-auto">
                    {skuCatalog.map((sku) => {
                      const alreadyAdded = items.some(i => i.sku_id === sku.id);
                      return (
                        <button
                          key={sku.id}
                          onClick={() => handleAddSku(sku)}
                          disabled={alreadyAdded}
                          className={`w-full flex items-center justify-between px-4 py-2 text-left hover:bg-gray-50 ${
                            alreadyAdded ? 'opacity-50 cursor-not-allowed' : ''
                          }`}
                        >
                          <div>
                            <div className="font-medium text-gray-900">{sku.sku}</div>
                            <div className="text-sm text-gray-500">{sku.description}</div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm font-medium text-gray-900">
                              ${sku.sell_price?.toFixed(2) || '0.00'}
                            </div>
                            <div className="text-xs text-gray-500">{sku.unit}</div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Click outside to close dropdown */}
              {showSkuDropdown && (
                <div
                  className="fixed inset-0 z-0"
                  onClick={() => setShowSkuDropdown(false)}
                />
              )}

              {/* Items Table */}
              {items.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 rounded-lg">
                  <DollarSign className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900">No SKUs added yet</h3>
                  <p className="text-gray-500 mt-1">Search and add SKUs to set custom prices</p>
                </div>
              ) : (
                <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">SKU</th>
                        <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Catalog</th>
                        <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Method</th>
                        <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Price</th>
                        <th className="w-12"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {items.map((item) => (
                        <tr key={item.sku_id} className={item.isModified ? 'bg-yellow-50' : ''}>
                          <td className="px-4 py-3">
                            <div className="font-medium text-gray-900">{item.sku}</div>
                            <div className="text-sm text-gray-500 truncate max-w-[200px]">
                              {item.description}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            ${item.catalog_price?.toFixed(2) || '0.00'}/{item.unit}
                          </td>
                          <td className="px-4 py-3">
                            <select
                              value={item.pricing_method}
                              onChange={(e) => handleItemChange(item.sku_id, 'pricing_method', e.target.value)}
                              className="px-2 py-1 text-sm border border-gray-200 rounded"
                            >
                              {Object.entries(PRICING_METHOD_LABELS).map(([value, label]) => (
                                <option key={value} value={value}>{label}</option>
                              ))}
                            </select>
                          </td>
                          <td className="px-4 py-3">
                            {item.pricing_method === 'fixed' ? (
                              <div className="space-y-1">
                                <div className="relative w-28">
                                  <DollarSign className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                  <input
                                    type="number"
                                    step="0.01"
                                    value={item.fixed_price}
                                    onChange={(e) => handleItemChange(item.sku_id, 'fixed_price', e.target.value)}
                                    placeholder="Total"
                                    className="w-full pl-7 pr-2 py-1 text-sm border border-gray-200 rounded focus:ring-1 focus:ring-blue-500"
                                  />
                                </div>
                                <div className="flex gap-1">
                                  <div className="relative w-[54px]">
                                    <input
                                      type="number"
                                      step="0.01"
                                      value={item.fixed_labor_price}
                                      onChange={(e) => handleItemChange(item.sku_id, 'fixed_labor_price', e.target.value)}
                                      placeholder="Labor"
                                      title="Labor portion"
                                      className="w-full pl-1 pr-1 py-0.5 text-xs border border-gray-200 rounded focus:ring-1 focus:ring-blue-500"
                                    />
                                  </div>
                                  <div className="relative w-[54px]">
                                    <input
                                      type="number"
                                      step="0.01"
                                      value={item.fixed_material_price}
                                      onChange={(e) => handleItemChange(item.sku_id, 'fixed_material_price', e.target.value)}
                                      placeholder="Mat"
                                      title="Material portion"
                                      className="w-full pl-1 pr-1 py-0.5 text-xs border border-gray-200 rounded focus:ring-1 focus:ring-blue-500"
                                    />
                                  </div>
                                </div>
                              </div>
                            ) : item.pricing_method === 'markup' ? (
                              <div className="space-y-1">
                                <div className="flex items-center gap-1">
                                  <span className="text-xs text-gray-500 w-10">Labor:</span>
                                  <div className="relative w-16">
                                    <input
                                      type="number"
                                      value={item.labor_markup_percent}
                                      onChange={(e) => handleItemChange(item.sku_id, 'labor_markup_percent', e.target.value)}
                                      placeholder="0"
                                      className="w-full pl-2 pr-5 py-1 text-sm border border-gray-200 rounded focus:ring-1 focus:ring-blue-500"
                                    />
                                    <Percent className="absolute right-1 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400" />
                                  </div>
                                </div>
                                <div className="flex items-center gap-1">
                                  <span className="text-xs text-gray-500 w-10">Mat:</span>
                                  <div className="relative w-16">
                                    <input
                                      type="number"
                                      value={item.material_markup_percent}
                                      onChange={(e) => handleItemChange(item.sku_id, 'material_markup_percent', e.target.value)}
                                      placeholder="0"
                                      className="w-full pl-2 pr-5 py-1 text-sm border border-gray-200 rounded focus:ring-1 focus:ring-blue-500"
                                    />
                                    <Percent className="absolute right-1 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400" />
                                  </div>
                                </div>
                              </div>
                            ) : item.pricing_method === 'margin' ? (
                              <div className="flex items-center gap-1">
                                <span className="text-xs text-gray-500">GM:</span>
                                <div className="relative w-20">
                                  <input
                                    type="number"
                                    value={item.margin_target_percent}
                                    onChange={(e) => handleItemChange(item.sku_id, 'margin_target_percent', e.target.value)}
                                    placeholder="0"
                                    className="w-full pl-2 pr-5 py-1 text-sm border border-gray-200 rounded focus:ring-1 focus:ring-blue-500"
                                  />
                                  <Percent className="absolute right-1 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400" />
                                </div>
                              </div>
                            ) : item.pricing_method === 'cost_plus' ? (
                              <div className="flex items-center gap-1">
                                <span className="text-xs text-gray-500">Add:</span>
                                <div className="relative w-20">
                                  <DollarSign className="absolute left-1 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400" />
                                  <input
                                    type="number"
                                    step="0.01"
                                    value={item.cost_plus_amount}
                                    onChange={(e) => handleItemChange(item.sku_id, 'cost_plus_amount', e.target.value)}
                                    placeholder="0"
                                    className="w-full pl-5 pr-2 py-1 text-sm border border-gray-200 rounded focus:ring-1 focus:ring-blue-500"
                                  />
                                </div>
                              </div>
                            ) : null}
                          </td>
                          <td className="px-4 py-3">
                            <button
                              onClick={() => handleRemoveItem(item.sku_id)}
                              className="p-1 text-gray-400 hover:text-red-500"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Helper text */}
              {items.some(i => i.isModified) && (
                <div className="flex items-center gap-2 text-sm text-amber-600 bg-amber-50 px-3 py-2 rounded-lg">
                  <AlertCircle className="w-4 h-4" />
                  <span>You have unsaved changes</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100">
          {saveError ? (
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{saveError}</span>
            </div>
          ) : (
            <div />
          )}
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-600 hover:text-gray-800"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isPending || !name.trim()}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {isPending ? 'Saving...' : isEditing ? 'Save Changes' : 'Create Rate Sheet'}
            </button>
          </div>
        </div>
      </div>

      {/* Bulk Add Modal */}
      {showBulkAdd && (
        <RateSheetBulkAddModal
          rateSheetName={name || 'New Rate Sheet'}
          existingSkuIds={items.map(i => i.sku_id)}
          onAdd={handleBulkAddSkus}
          onClose={() => setShowBulkAdd(false)}
        />
      )}
    </div>
  );
}
