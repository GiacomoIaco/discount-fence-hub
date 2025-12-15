/**
 * QuoteBuilderPage - Full page for creating/editing quotes
 *
 * Layout follows UI_SPEC_CONTEXT_SIDEBAR:
 * - Left sidebar (320px): Context info - client, property, assignment, profitability
 * - Main content (right): Line items editor, scope, terms
 *
 * Features:
 * - Client/Community selection with cascade
 * - Property selection
 * - Line items with materials, labor, services
 * - Real-time totals calculation
 * - Margin tracking with approval warnings
 * - Terms and deposit configuration
 */

import { useState, useEffect } from 'react';
import {
  ArrowLeft,
  FileText,
  Building2,
  MapPin,
  DollarSign,
  Plus,
  Trash2,
  Calendar,
  Percent,
  Save,
  Send,
  User,
  Package,
  Wrench,
  AlertTriangle,
  Phone,
  Mail,
  Copy,
  Check,
  ChevronDown,
  ChevronRight,
  Users,
} from 'lucide-react';
import {
  useQuote,
  useCreateQuote,
  useUpdateQuote,
  useAddQuoteLineItem,
  useDeleteQuoteLineItem,
  useUpdateQuoteLineItem,
} from '../hooks/useQuotes';
import { useSalesReps } from '../hooks/useSalesReps';
import { useClients } from '../../client_hub/hooks/useClients';
import { useCommunities } from '../../client_hub/hooks/useCommunities';
import { useProperties } from '../../client_hub/hooks/useProperties';

interface QuoteBuilderPageProps {
  /** Quote ID for editing, undefined for new quote */
  quoteId?: string;
  /** Request ID to create quote from */
  requestId?: string;
  /** Pre-filled data from request */
  requestData?: {
    client_id?: string;
    client_name?: string;
    community_id?: string;
    community_name?: string;
    property_id?: string;
    product_type?: string;
    linear_feet?: number;
    description?: string;
  };
  onBack: () => void;
  onSuccess?: (quoteId: string) => void;
}

const PRODUCT_TYPE_OPTIONS = [
  'Wood Vertical',
  'Wood Horizontal',
  'Iron',
  'Chain Link',
  'Vinyl',
  'Gate Only',
  'Deck',
  'Glass Railing',
];

const PAYMENT_TERMS_OPTIONS = [
  'Due on Receipt',
  'Net 15',
  'Net 30',
  'Net 45',
  'Net 60',
  '50% Deposit, Balance on Completion',
];

const LINE_TYPE_OPTIONS = [
  { value: 'material', label: 'Material', icon: Package },
  { value: 'labor', label: 'Labor', icon: Wrench },
  { value: 'service', label: 'Service', icon: User },
  { value: 'adjustment', label: 'Adjustment', icon: DollarSign },
];

interface LineItemForm {
  id?: string;
  line_type: 'material' | 'labor' | 'service' | 'adjustment' | 'discount';
  description: string;
  quantity: number;
  unit_type: string;
  unit_price: number;
  unit_cost: number;
  isNew?: boolean;
}

const DEFAULT_LINE_ITEM: LineItemForm = {
  line_type: 'material',
  description: '',
  quantity: 1,
  unit_type: 'EA',
  unit_price: 0,
  unit_cost: 0,
  isNew: true,
};

// Collapsible Section Component
function CollapsibleSection({
  title,
  icon: Icon,
  children,
  defaultOpen = true,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border-b border-gray-200 pb-4 mb-4 last:border-b-0 last:pb-0 last:mb-0">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between w-full text-left"
      >
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4 text-gray-500" />
          <span className="text-sm font-semibold text-gray-700">{title}</span>
        </div>
        {isOpen ? (
          <ChevronDown className="w-4 h-4 text-gray-400" />
        ) : (
          <ChevronRight className="w-4 h-4 text-gray-400" />
        )}
      </button>
      {isOpen && <div className="mt-3">{children}</div>}
    </div>
  );
}

// Copy button with feedback
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
      title="Copy"
    >
      {copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
    </button>
  );
}

export default function QuoteBuilderPage({
  quoteId,
  requestId,
  requestData,
  onBack,
  onSuccess,
}: QuoteBuilderPageProps) {
  // Load existing quote if editing
  const { data: existingQuote, isLoading: isLoadingQuote } = useQuote(quoteId);

  // Form state
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [selectedCommunityId, setSelectedCommunityId] = useState<string>('');
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>('');
  const [jobTitle, setJobTitle] = useState('');
  const [productType, setProductType] = useState('');
  const [linearFeet, setLinearFeet] = useState('');
  const [scopeSummary, setScopeSummary] = useState('');
  const [validUntil, setValidUntil] = useState('');
  const [paymentTerms, setPaymentTerms] = useState('Net 30');
  const [depositPercent, setDepositPercent] = useState('0');
  const [salesRepId, setSalesRepId] = useState('');
  const [taxRate, setTaxRate] = useState('8.25');
  const [discountPercent, setDiscountPercent] = useState('0');

  // Line items
  const [lineItems, setLineItems] = useState<LineItemForm[]>([]);

  // Data fetching
  const { data: clients } = useClients({ status: 'active' });
  const { data: communities } = useCommunities(selectedClientId ? { client_id: selectedClientId } : undefined);
  const { data: properties } = useProperties(selectedCommunityId || null);
  const { data: salesReps } = useSalesReps();

  // Derived data
  const selectedClient = clients?.find(c => c.id === selectedClientId);
  const selectedCommunity = communities?.find(c => c.id === selectedCommunityId);
  const selectedProperty = properties?.find(p => p.id === selectedPropertyId);

  const createMutation = useCreateQuote();
  const updateMutation = useUpdateQuote();
  const addLineItemMutation = useAddQuoteLineItem();
  const deleteLineItemMutation = useDeleteQuoteLineItem();
  const updateLineItemMutation = useUpdateQuoteLineItem();

  const isEditing = !!quoteId;
  const isPending = createMutation.isPending || updateMutation.isPending;

  // Initialize form
  useEffect(() => {
    if (existingQuote) {
      // Editing existing quote
      setSelectedClientId(existingQuote.client_id || '');
      setSelectedCommunityId(existingQuote.community_id || '');
      setSelectedPropertyId(existingQuote.property_id || '');
      setProductType(existingQuote.product_type || '');
      setLinearFeet(existingQuote.linear_feet?.toString() || '');
      setScopeSummary(existingQuote.scope_summary || '');
      setValidUntil(existingQuote.valid_until || '');
      setPaymentTerms(existingQuote.payment_terms || 'Net 30');
      setDepositPercent(existingQuote.deposit_percent?.toString() || '0');
      setSalesRepId(existingQuote.sales_rep_id || '');
      setTaxRate(((existingQuote.tax_rate || 0.0825) * 100).toString());
      setDiscountPercent(existingQuote.discount_percent?.toString() || '0');
      setLineItems((existingQuote.line_items || []).map(li => ({
        id: li.id,
        line_type: li.line_type,
        description: li.description,
        quantity: li.quantity,
        unit_type: li.unit_type || 'EA',
        unit_price: li.unit_price,
        unit_cost: li.unit_cost || 0,
      })));
    } else if (requestData) {
      // Creating from request
      if (requestData.client_id) {
        setSelectedClientId(requestData.client_id);
      }
      if (requestData.community_id) {
        setSelectedCommunityId(requestData.community_id);
      }
      if (requestData.property_id) {
        setSelectedPropertyId(requestData.property_id);
      }
      setProductType(requestData.product_type || '');
      setLinearFeet(requestData.linear_feet?.toString() || '');
      setScopeSummary(requestData.description || '');
      // Set default valid until (30 days from now)
      const validDate = new Date();
      validDate.setDate(validDate.getDate() + 30);
      setValidUntil(validDate.toISOString().split('T')[0]);
    } else if (!quoteId) {
      // New quote from scratch
      const validDate = new Date();
      validDate.setDate(validDate.getDate() + 30);
      setValidUntil(validDate.toISOString().split('T')[0]);
    }
  }, [existingQuote, requestData, quoteId]);

  // Calculate totals
  const subtotal = lineItems.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
  const materialCost = lineItems.reduce((sum, item) => sum + (item.quantity * item.unit_cost), 0);
  const laborCost = lineItems
    .filter(item => item.line_type === 'labor')
    .reduce((sum, item) => sum + (item.quantity * item.unit_cost), 0);
  const discountAmount = subtotal * (parseFloat(discountPercent) || 0) / 100;
  const taxableAmount = subtotal - discountAmount;
  const taxAmount = taxableAmount * (parseFloat(taxRate) || 0) / 100;
  const total = taxableAmount + taxAmount;
  const grossProfit = total - materialCost - laborCost;
  const marginPercent = total > 0 ? (grossProfit / total * 100) : 0;
  const depositAmount = total * (parseFloat(depositPercent) || 0) / 100;

  // Check if approval needed
  const needsApproval = marginPercent < 15 || parseFloat(discountPercent) > 10 || total > 25000;
  const approvalReasons: string[] = [];
  if (marginPercent < 15 && lineItems.length > 0) approvalReasons.push(`Margin (${marginPercent.toFixed(1)}%) below 15%`);
  if (parseFloat(discountPercent) > 10) approvalReasons.push(`Discount (${discountPercent}%) exceeds 10%`);
  if (total > 25000) approvalReasons.push(`Total ($${total.toLocaleString()}) exceeds $25,000`);

  const handleAddLineItem = () => {
    setLineItems([...lineItems, { ...DEFAULT_LINE_ITEM }]);
  };

  const handleUpdateLineItem = (index: number, updates: Partial<LineItemForm>) => {
    setLineItems(lineItems.map((item, i) =>
      i === index ? { ...item, ...updates } : item
    ));
  };

  const handleRemoveLineItem = async (index: number) => {
    const item = lineItems[index];
    if (item.id) {
      await deleteLineItemMutation.mutateAsync(item.id);
    }
    setLineItems(lineItems.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!selectedClientId) {
      return;
    }

    try {
      let savedQuoteId = quoteId;

      if (isEditing && existingQuote) {
        // Update existing quote
        await updateMutation.mutateAsync({
          id: existingQuote.id,
          data: {
            client_id: selectedClientId,
            community_id: selectedCommunityId || null,
            property_id: selectedPropertyId || null,
            product_type: productType || null,
            linear_feet: linearFeet ? parseFloat(linearFeet) : null,
            scope_summary: scopeSummary || null,
            valid_until: validUntil || null,
            payment_terms: paymentTerms,
            deposit_percent: parseFloat(depositPercent) || 0,
            deposit_required: depositAmount,
            sales_rep_id: salesRepId || null,
            tax_rate: (parseFloat(taxRate) || 0) / 100,
            discount_percent: parseFloat(discountPercent) || 0,
            discount_amount: discountAmount,
            subtotal,
            tax_amount: taxAmount,
            total,
            total_material_cost: materialCost,
            total_labor_cost: laborCost,
            margin_percent: marginPercent,
            requires_approval: needsApproval,
            approval_reason: needsApproval ? approvalReasons.join('; ') : null,
          },
        });

        // Sync line items
        const existingIds = existingQuote.line_items?.map(li => li.id) || [];
        const currentIds = lineItems.filter(li => li.id).map(li => li.id!);

        for (const id of existingIds.filter(id => !currentIds.includes(id))) {
          await deleteLineItemMutation.mutateAsync(id);
        }

        for (let i = 0; i < lineItems.length; i++) {
          const item = lineItems[i];
          if (item.id) {
            await updateLineItemMutation.mutateAsync({
              id: item.id,
              data: {
                line_type: item.line_type,
                description: item.description,
                quantity: item.quantity,
                unit_type: item.unit_type,
                unit_price: item.unit_price,
                unit_cost: item.unit_cost,
                total_price: item.quantity * item.unit_price,
                sort_order: i,
              },
            });
          } else {
            await addLineItemMutation.mutateAsync({
              quote_id: existingQuote.id,
              line_type: item.line_type,
              description: item.description,
              quantity: item.quantity,
              unit_type: item.unit_type,
              unit_price: item.unit_price,
              unit_cost: item.unit_cost,
              total_price: item.quantity * item.unit_price,
              sort_order: i,
              is_visible_to_client: true,
              group_name: null,
              material_id: null,
              labor_code_id: null,
              sku_id: null,
              bom_line_item_id: null,
            });
          }
        }

        savedQuoteId = existingQuote.id;
      } else {
        // Create new quote
        const result = await createMutation.mutateAsync({
          request_id: requestId || undefined,
          client_id: selectedClientId,
          community_id: selectedCommunityId || undefined,
          property_id: selectedPropertyId || undefined,
          product_type: productType || undefined,
          linear_feet: linearFeet ? parseFloat(linearFeet) : undefined,
          scope_summary: scopeSummary || undefined,
          valid_until: validUntil || undefined,
          payment_terms: paymentTerms,
          deposit_percent: parseFloat(depositPercent) || 0,
          deposit_required: depositAmount,
          sales_rep_id: salesRepId || undefined,
        });

        savedQuoteId = result.id;

        for (let i = 0; i < lineItems.length; i++) {
          const item = lineItems[i];
          await addLineItemMutation.mutateAsync({
            quote_id: result.id,
            line_type: item.line_type,
            description: item.description,
            quantity: item.quantity,
            unit_type: item.unit_type,
            unit_price: item.unit_price,
            unit_cost: item.unit_cost,
            total_price: item.quantity * item.unit_price,
            sort_order: i,
            is_visible_to_client: true,
            group_name: null,
            material_id: null,
            labor_code_id: null,
            sku_id: null,
            bom_line_item_id: null,
          });
        }

        await updateMutation.mutateAsync({
          id: result.id,
          data: {
            subtotal,
            tax_rate: (parseFloat(taxRate) || 0) / 100,
            tax_amount: taxAmount,
            discount_percent: parseFloat(discountPercent) || 0,
            discount_amount: discountAmount,
            total,
            total_material_cost: materialCost,
            total_labor_cost: laborCost,
            margin_percent: marginPercent,
            requires_approval: needsApproval,
            approval_reason: needsApproval ? approvalReasons.join('; ') : null,
          },
        });
      }

      if (savedQuoteId) {
        onSuccess?.(savedQuoteId);
      }
      onBack();
    } catch (error) {
      console.error('Failed to save quote:', error);
    }
  };

  const selectedSalesRep = salesReps?.find(r => r.id === salesRepId);

  if (isLoadingQuote) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-20">
        <div className="px-6 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={onBack}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <FileText className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <h1 className="text-lg font-bold text-gray-900">
                    {isEditing ? existingQuote?.quote_number : 'New Quote'}
                  </h1>
                  {requestId && (
                    <p className="text-xs text-gray-500">From request</p>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => handleSave()}
                disabled={isPending || !selectedClientId}
                className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                Save Draft
              </button>
              <button
                onClick={() => handleSave()}
                disabled={isPending || !selectedClientId || lineItems.length === 0}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
                {isPending ? 'Saving...' : 'Save & Send'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Layout: Content Left + Sidebar Right */}
      <div className="flex">
        {/* Main Content - Left Side */}
        <main className="flex-1 p-6 overflow-auto">
          {/* Jobber-style Header */}
          <div className="bg-white rounded-xl border p-6 mb-6">
            {/* Quote for CLIENT-NAME */}
            <h1 className="text-2xl font-bold text-gray-900 mb-4">
              Quote for{' '}
              <span className="text-blue-600">
                {selectedClient?.name || 'Select Client'}
              </span>
            </h1>

            {/* Job Title */}
            <div className="mb-4">
              <label className="block text-sm font-semibold text-gray-900 mb-1">Job title</label>
              <input
                type="text"
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
                placeholder="Title"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              />
            </div>

            {/* Property & Contact Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Property Address */}
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-1">Property address</label>
                {selectedProperty ? (
                  <div className="text-gray-700">
                    <div>{selectedProperty.address_line1}</div>
                    <div>{selectedProperty.city}, {selectedProperty.state} {selectedProperty.zip}</div>
                    <button
                      type="button"
                      onClick={() => {
                        // Scroll to client selection in sidebar or open modal
                        // For now, just a visual indicator
                      }}
                      className="text-blue-600 text-sm hover:underline mt-1"
                    >
                      Change
                    </button>
                  </div>
                ) : selectedCommunity ? (
                  <div className="text-gray-500 italic">
                    <div>{selectedCommunity.name}</div>
                    <div className="text-sm">Select a property in the sidebar</div>
                  </div>
                ) : (
                  <div className="text-gray-400 italic">Select client and property in sidebar</div>
                )}
              </div>

              {/* Contact Details */}
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-1">Contact details</label>
                {selectedClient ? (
                  <div className="space-y-1">
                    {selectedClient.primary_contact_name && (
                      <div className="text-gray-700 font-medium">
                        {selectedClient.primary_contact_name}
                      </div>
                    )}
                    {selectedClient.primary_contact_email && (
                      <a
                        href={`mailto:${selectedClient.primary_contact_email}`}
                        className="text-blue-600 hover:underline block"
                      >
                        {selectedClient.primary_contact_email}
                      </a>
                    )}
                    {selectedClient.primary_contact_phone && (
                      <a
                        href={`tel:${selectedClient.primary_contact_phone}`}
                        className="text-blue-600 hover:underline block"
                      >
                        {selectedClient.primary_contact_phone}
                      </a>
                    )}
                    {!selectedClient.primary_contact_email && !selectedClient.primary_contact_phone && (
                      <span className="text-gray-400 italic">No contact info on file</span>
                    )}
                  </div>
                ) : (
                  <div className="text-gray-400 italic">Select a client</div>
                )}
              </div>
            </div>
          </div>

          {/* Line Items */}
          <div className="bg-white rounded-xl border overflow-hidden mb-6">
            <div className="flex items-center justify-between px-6 py-4 border-b bg-gray-50">
              <h2 className="text-lg font-semibold">Line Items</h2>
              <button
                onClick={handleAddLineItem}
                className="flex items-center gap-1 px-3 py-1.5 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700"
              >
                <Plus className="w-4 h-4" />
                Add Item
              </button>
            </div>

            {lineItems.length === 0 ? (
              <div className="p-12 text-center">
                <DollarSign className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p className="text-gray-500 mb-4">No items added yet</p>
                <button
                  onClick={handleAddLineItem}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                >
                  <Plus className="w-4 h-4" />
                  Add First Item
                </button>
              </div>
            ) : (
              <div className="divide-y">
                {/* Header */}
                <div className="grid grid-cols-12 gap-2 px-6 py-2 bg-gray-50 text-xs font-medium text-gray-500 uppercase">
                  <div className="col-span-1">Type</div>
                  <div className="col-span-3">Description</div>
                  <div className="col-span-1 text-right">Qty</div>
                  <div className="col-span-1">Unit</div>
                  <div className="col-span-2 text-right">Price</div>
                  <div className="col-span-2 text-right">Cost</div>
                  <div className="col-span-1 text-right">Total</div>
                  <div className="col-span-1"></div>
                </div>

                {/* Items */}
                {lineItems.map((item, index) => (
                  <div key={index} className="grid grid-cols-12 gap-2 px-6 py-3 items-center hover:bg-gray-50">
                    <div className="col-span-1">
                      <select
                        value={item.line_type}
                        onChange={(e) => handleUpdateLineItem(index, { line_type: e.target.value as LineItemForm['line_type'] })}
                        className="w-full px-1.5 py-1 text-xs border rounded focus:ring-2 focus:ring-purple-500"
                      >
                        {LINE_TYPE_OPTIONS.map(opt => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </div>
                    <div className="col-span-3">
                      <input
                        type="text"
                        value={item.description}
                        onChange={(e) => handleUpdateLineItem(index, { description: e.target.value })}
                        placeholder="Description"
                        className="w-full px-2 py-1 text-sm border rounded focus:ring-2 focus:ring-purple-500"
                      />
                    </div>
                    <div className="col-span-1">
                      <input
                        type="number"
                        value={item.quantity}
                        onChange={(e) => handleUpdateLineItem(index, { quantity: parseFloat(e.target.value) || 0 })}
                        className="w-full px-2 py-1 text-sm text-right border rounded focus:ring-2 focus:ring-purple-500"
                      />
                    </div>
                    <div className="col-span-1">
                      <select
                        value={item.unit_type}
                        onChange={(e) => handleUpdateLineItem(index, { unit_type: e.target.value })}
                        className="w-full px-1 py-1 text-xs border rounded focus:ring-2 focus:ring-purple-500"
                      >
                        <option value="EA">EA</option>
                        <option value="LF">LF</option>
                        <option value="SF">SF</option>
                        <option value="HR">HR</option>
                        <option value="DAY">DAY</option>
                      </select>
                    </div>
                    <div className="col-span-2">
                      <input
                        type="number"
                        value={item.unit_price}
                        onChange={(e) => handleUpdateLineItem(index, { unit_price: parseFloat(e.target.value) || 0 })}
                        className="w-full px-2 py-1 text-sm text-right border rounded focus:ring-2 focus:ring-purple-500"
                        step="0.01"
                        placeholder="Price"
                      />
                    </div>
                    <div className="col-span-2">
                      <input
                        type="number"
                        value={item.unit_cost}
                        onChange={(e) => handleUpdateLineItem(index, { unit_cost: parseFloat(e.target.value) || 0 })}
                        className="w-full px-2 py-1 text-sm text-right border rounded focus:ring-2 focus:ring-purple-500"
                        step="0.01"
                        placeholder="Cost"
                      />
                    </div>
                    <div className="col-span-1 text-right font-medium text-sm">
                      ${(item.quantity * item.unit_price).toFixed(2)}
                    </div>
                    <div className="col-span-1 text-right">
                      <button
                        onClick={() => handleRemoveLineItem(index)}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}

                {/* Totals Row */}
                <div className="px-6 py-4 bg-gray-50">
                  <div className="flex justify-end gap-8 text-sm">
                    <div className="text-right">
                      <div className="text-gray-500">Subtotal</div>
                      <div className="font-medium">${subtotal.toFixed(2)}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-gray-500">Discount ({discountPercent}%)</div>
                      <div className="font-medium text-green-600">-${discountAmount.toFixed(2)}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-gray-500">Tax ({taxRate}%)</div>
                      <div className="font-medium">${taxAmount.toFixed(2)}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-gray-500">Total</div>
                      <div className="text-xl font-bold">${total.toFixed(2)}</div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Scope Summary */}
          <div className="bg-white rounded-xl border p-6 mb-6">
            <h2 className="text-lg font-semibold mb-4">Scope Summary</h2>
            <textarea
              value={scopeSummary}
              onChange={(e) => setScopeSummary(e.target.value)}
              rows={3}
              placeholder="Describe the work to be done..."
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
            />
          </div>

          {/* Terms */}
          <div className="bg-white rounded-xl border p-6">
            <h2 className="text-lg font-semibold mb-4">Terms</h2>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <Calendar className="w-4 h-4 inline mr-1" />
                  Valid Until
                </label>
                <input
                  type="date"
                  value={validUntil}
                  onChange={(e) => setValidUntil(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Payment Terms
                </label>
                <select
                  value={paymentTerms}
                  onChange={(e) => setPaymentTerms(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
                >
                  {PAYMENT_TERMS_OPTIONS.map((term) => (
                    <option key={term} value={term}>{term}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <Percent className="w-4 h-4 inline mr-1" />
                  Deposit %
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={depositPercent}
                    onChange={(e) => setDepositPercent(e.target.value)}
                    min="0"
                    max="100"
                    className="w-20 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
                  />
                  <span className="text-gray-500">%</span>
                  {depositAmount > 0 && (
                    <span className="text-sm text-purple-600 font-medium">
                      ${depositAmount.toFixed(2)}
                    </span>
                  )}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <Percent className="w-4 h-4 inline mr-1" />
                  Discount %
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={discountPercent}
                    onChange={(e) => setDiscountPercent(e.target.value)}
                    min="0"
                    max="100"
                    className="w-20 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
                  />
                  <span className="text-gray-500">%</span>
                </div>
              </div>
            </div>
          </div>
        </main>

        {/* Context Sidebar - Right Side */}
        <aside className="w-80 min-w-[280px] max-w-[400px] h-[calc(100vh-57px)] sticky top-[57px] overflow-y-auto bg-gray-50 border-l border-gray-200 p-4">
          {/* Entity Header */}
          <div className="bg-white rounded-lg p-4 mb-4 border">
            <div className="flex items-center gap-2 mb-2">
              <FileText className="w-4 h-4 text-purple-600" />
              <span className="text-xs font-medium text-gray-500 uppercase">Quote</span>
            </div>
            {isEditing && existingQuote?.quote_number && (
              <div className="flex items-center gap-2">
                <span className="font-semibold text-gray-900">{existingQuote.quote_number}</span>
                <CopyButton text={existingQuote.quote_number} />
              </div>
            )}
            <div className="mt-2">
              <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-full">
                {isEditing ? existingQuote?.status || 'Draft' : 'Draft'}
              </span>
            </div>
            {requestId && (
              <div className="mt-3 pt-3 border-t">
                <span className="text-xs text-gray-500">From Request</span>
              </div>
            )}
          </div>

          {/* Client & Property Section */}
          <div className="bg-white rounded-lg p-4 mb-4 border">
            <CollapsibleSection title="CLIENT & PROPERTY" icon={User}>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Client *</label>
                  <select
                    value={selectedClientId}
                    onChange={(e) => {
                      setSelectedClientId(e.target.value);
                      setSelectedCommunityId('');
                      setSelectedPropertyId('');
                    }}
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="">Select client...</option>
                    {clients?.map((client) => (
                      <option key={client.id} value={client.id}>{client.name}</option>
                    ))}
                  </select>
                </div>

                {selectedClientId && communities && communities.length > 0 && (
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Community</label>
                    <select
                      value={selectedCommunityId}
                      onChange={(e) => {
                        setSelectedCommunityId(e.target.value);
                        setSelectedPropertyId('');
                      }}
                      className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-purple-500"
                    >
                      <option value="">Select community...</option>
                      {communities.map((community) => (
                        <option key={community.id} value={community.id}>{community.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                {selectedCommunityId && (
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Property/Lot</label>
                    <select
                      value={selectedPropertyId}
                      onChange={(e) => setSelectedPropertyId(e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-purple-500"
                    >
                      <option value="">Select property...</option>
                      {properties?.map((property) => (
                        <option key={property.id} value={property.id}>
                          {property.lot_number ? `Lot ${property.lot_number} - ` : ''}{property.address_line1}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {selectedProperty && (
                  <div className="p-3 bg-gray-50 rounded-lg text-sm">
                    <div className="flex items-start gap-2">
                      <MapPin className="w-4 h-4 text-gray-400 mt-0.5" />
                      <div>
                        <div className="font-medium text-gray-900">{selectedProperty.address_line1}</div>
                        <div className="text-gray-500 text-xs">
                          {selectedProperty.city}, {selectedProperty.state} {selectedProperty.zip}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </CollapsibleSection>
          </div>

          {/* Assignment Section */}
          <div className="bg-white rounded-lg p-4 mb-4 border">
            <CollapsibleSection title="ASSIGNMENT" icon={Users}>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Sales Rep</label>
                  <select
                    value={salesRepId}
                    onChange={(e) => setSalesRepId(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="">Select rep...</option>
                    {salesReps?.filter(r => r.is_active).map((rep) => (
                      <option key={rep.id} value={rep.id}>{rep.name}</option>
                    ))}
                  </select>
                </div>
                {selectedSalesRep && (
                  <div className="p-3 bg-gray-50 rounded-lg text-sm">
                    <div className="font-medium text-gray-900">{selectedSalesRep.name}</div>
                    {selectedSalesRep.email && (
                      <div className="flex items-center gap-2 text-gray-500 text-xs mt-1">
                        <Mail className="w-3 h-3" />
                        {selectedSalesRep.email}
                        <CopyButton text={selectedSalesRep.email} />
                      </div>
                    )}
                    {selectedSalesRep.phone && (
                      <div className="flex items-center gap-2 text-gray-500 text-xs mt-1">
                        <Phone className="w-3 h-3" />
                        {selectedSalesRep.phone}
                        <CopyButton text={selectedSalesRep.phone} />
                      </div>
                    )}
                  </div>
                )}
              </div>
            </CollapsibleSection>
          </div>

          {/* Project Info Section */}
          <div className="bg-white rounded-lg p-4 mb-4 border">
            <CollapsibleSection title="PROJECT INFO" icon={Building2}>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Product Type</label>
                  <select
                    value={productType}
                    onChange={(e) => setProductType(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="">Select type...</option>
                    {PRODUCT_TYPE_OPTIONS.map((type) => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Linear Feet</label>
                  <input
                    type="number"
                    value={linearFeet}
                    onChange={(e) => setLinearFeet(e.target.value)}
                    placeholder="e.g., 150"
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              </div>
            </CollapsibleSection>
          </div>

          {/* Profitability Section */}
          <div className="bg-white rounded-lg p-4 border">
            <CollapsibleSection title="PROFITABILITY" icon={DollarSign}>
              <div className="space-y-2 text-sm">
                <div className="text-xs text-gray-500 uppercase font-medium">Estimated Costs</div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Materials:</span>
                  <span>${materialCost.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Labor:</span>
                  <span>${laborCost.toFixed(2)}</span>
                </div>
                <div className="flex justify-between border-t pt-2">
                  <span className="text-gray-600">Total Cost:</span>
                  <span className="font-medium">${(materialCost + laborCost).toFixed(2)}</span>
                </div>

                <div className="text-xs text-gray-500 uppercase font-medium mt-4">Pricing</div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Quote Total:</span>
                  <span className="font-semibold">${total.toFixed(2)}</span>
                </div>

                <div className="text-xs text-gray-500 uppercase font-medium mt-4">Margin</div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Gross Profit:</span>
                  <span>${grossProfit.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Gross Margin:</span>
                  <span className={`font-semibold ${marginPercent >= 15 ? 'text-green-600' : 'text-red-600'}`}>
                    {marginPercent.toFixed(1)}% {marginPercent >= 15 ? '✓' : '⚠'}
                  </span>
                </div>

                {needsApproval && lineItems.length > 0 && (
                  <div className="mt-3 p-2 bg-orange-50 border border-orange-200 rounded text-xs text-orange-800">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-orange-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <div className="font-medium">Approval Required</div>
                        <ul className="mt-1 space-y-0.5">
                          {approvalReasons.map((reason, i) => (
                            <li key={i}>• {reason}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </CollapsibleSection>
          </div>
        </aside>
      </div>
    </div>
  );
}
