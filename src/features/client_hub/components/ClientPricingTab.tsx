import { useState } from 'react';
import {
  Plus,
  BookOpen,
  DollarSign,
  Star,
  Trash2,
  Edit2,
  AlertCircle,
  Check,
  ChevronDown,
  Home,
} from 'lucide-react';
import {
  useClientPriceBookAssignments,
  useCreateClientPriceBookAssignment,
  useUpdateClientPriceBookAssignment,
  useDeleteClientPriceBookAssignment,
  usePriceBooks,
} from '../hooks/usePriceBooks';
import { useRateSheets } from '../hooks/useRateSheets';
import type { ClientPriceBookAssignment } from '../types';

interface ClientPricingTabProps {
  clientId: string;
  clientName: string;
  /** Communities with overrides for display */
  communities?: Array<{
    id: string;
    name: string;
    rate_sheet_override_id: string | null;
    rate_sheet_override?: { id: string; name: string } | null;
    community_products_count?: number;
  }>;
}

export default function ClientPricingTab({
  clientId,
  clientName,
  communities = [],
}: ClientPricingTabProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState<ClientPriceBookAssignment | null>(null);

  // Fetch assignments
  const { data: assignments, isLoading } = useClientPriceBookAssignments(clientId);

  // Fetch available price books and rate sheets for dropdowns
  const { data: priceBooks } = usePriceBooks({ is_active: true });
  const { data: rateSheets } = useRateSheets({ is_active: true });

  // Mutations
  const createMutation = useCreateClientPriceBookAssignment();
  const updateMutation = useUpdateClientPriceBookAssignment();
  const deleteMutation = useDeleteClientPriceBookAssignment();

  // Form state
  const [formData, setFormData] = useState({
    price_book_id: '',
    rate_sheet_id: '',
    is_default: false,
    effective_date: new Date().toISOString().split('T')[0],
  });

  const handleAdd = async () => {
    if (!formData.price_book_id) return;

    await createMutation.mutateAsync({
      client_id: clientId,
      price_book_id: formData.price_book_id,
      rate_sheet_id: formData.rate_sheet_id || null,
      is_default: formData.is_default,
      effective_date: formData.effective_date,
    });

    setFormData({
      price_book_id: '',
      rate_sheet_id: '',
      is_default: false,
      effective_date: new Date().toISOString().split('T')[0],
    });
    setShowAddForm(false);
  };

  const handleUpdate = async () => {
    if (!editingAssignment) return;

    await updateMutation.mutateAsync({
      id: editingAssignment.id,
      client_id: clientId,
      rate_sheet_id: formData.rate_sheet_id || null,
      is_default: formData.is_default,
      effective_date: formData.effective_date,
    });

    setEditingAssignment(null);
  };

  const handleDelete = async (assignment: ClientPriceBookAssignment) => {
    if (confirm(`Remove "${assignment.price_book?.name}" from ${clientName}?`)) {
      await deleteMutation.mutateAsync({
        id: assignment.id,
        client_id: clientId,
      });
    }
  };

  const handleSetDefault = async (assignment: ClientPriceBookAssignment) => {
    await updateMutation.mutateAsync({
      id: assignment.id,
      client_id: clientId,
      is_default: true,
    });
  };

  const startEdit = (assignment: ClientPriceBookAssignment) => {
    setEditingAssignment(assignment);
    setFormData({
      price_book_id: assignment.price_book_id,
      rate_sheet_id: assignment.rate_sheet_id || '',
      is_default: assignment.is_default,
      effective_date: assignment.effective_date,
    });
  };

  // Get already assigned price book IDs to filter dropdown
  const assignedPriceBookIds = new Set(assignments?.map(a => a.price_book_id) || []);
  const availablePriceBooks = priceBooks?.filter(pb => !assignedPriceBookIds.has(pb.id)) || [];

  // Filter communities with overrides
  const communitiesWithOverrides = communities.filter(
    c => c.rate_sheet_override_id || (c.community_products_count && c.community_products_count > 0)
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Product & Pricing Assignments</h3>
            <p className="text-sm text-gray-500 mt-1">
              Assign price books (product catalogs) and rate sheets (pricing tiers) to this client
            </p>
          </div>
          <button
            onClick={() => setShowAddForm(true)}
            disabled={availablePriceBooks.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus className="w-4 h-4" />
            Add Assignment
          </button>
        </div>

        {/* Add Form */}
        {showAddForm && (
          <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
            <h4 className="font-medium text-gray-900 mb-4">New Assignment</h4>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Price Book *
                </label>
                <select
                  value={formData.price_book_id}
                  onChange={(e) => setFormData({ ...formData, price_book_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg"
                >
                  <option value="">Select a price book...</option>
                  {availablePriceBooks.map((pb) => (
                    <option key={pb.id} value={pb.id}>
                      {pb.name} ({pb.items_count || 0} SKUs)
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Which products can this client purchase?
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Rate Sheet
                </label>
                <select
                  value={formData.rate_sheet_id}
                  onChange={(e) => setFormData({ ...formData, rate_sheet_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg"
                >
                  <option value="">Use BU Default</option>
                  {rateSheets?.map((rs) => (
                    <option key={rs.id} value={rs.id}>
                      {rs.name} ({rs.pricing_type})
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  What pricing tier applies? Leave empty for BU default.
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Effective Date
                </label>
                <input
                  type="date"
                  value={formData.effective_date}
                  onChange={(e) => setFormData({ ...formData, effective_date: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg"
                />
              </div>
              <div className="flex items-center">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.is_default}
                    onChange={(e) => setFormData({ ...formData, is_default: e.target.checked })}
                    className="w-4 h-4 text-blue-600 rounded"
                  />
                  <span className="text-sm text-gray-700">Set as default assignment</span>
                </label>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowAddForm(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={handleAdd}
                disabled={!formData.price_book_id || createMutation.isPending}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {createMutation.isPending ? 'Adding...' : 'Add Assignment'}
              </button>
            </div>
          </div>
        )}

        {/* Assignments List */}
        {assignments && assignments.length > 0 ? (
          <div className="space-y-3">
            {assignments.map((assignment) => (
              <div
                key={assignment.id}
                className={`p-4 rounded-lg border ${
                  assignment.is_default
                    ? 'border-blue-200 bg-blue-50'
                    : 'border-gray-200 bg-white'
                }`}
              >
                {editingAssignment?.id === assignment.id ? (
                  // Edit mode
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Price Book
                        </label>
                        <div className="px-3 py-2 bg-gray-100 rounded-lg text-gray-600">
                          {assignment.price_book?.name}
                        </div>
                        <p className="text-xs text-gray-500 mt-1">Cannot change price book</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Rate Sheet
                        </label>
                        <select
                          value={formData.rate_sheet_id}
                          onChange={(e) => setFormData({ ...formData, rate_sheet_id: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg"
                        >
                          <option value="">Use BU Default</option>
                          {rateSheets?.map((rs) => (
                            <option key={rs.id} value={rs.id}>
                              {rs.name} ({rs.pricing_type})
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Effective Date
                        </label>
                        <input
                          type="date"
                          value={formData.effective_date}
                          onChange={(e) => setFormData({ ...formData, effective_date: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg"
                        />
                      </div>
                      <div className="flex items-center">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={formData.is_default}
                            onChange={(e) => setFormData({ ...formData, is_default: e.target.checked })}
                            className="w-4 h-4 text-blue-600 rounded"
                          />
                          <span className="text-sm text-gray-700">Default assignment</span>
                        </label>
                      </div>
                    </div>
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => setEditingAssignment(null)}
                        className="px-3 py-1.5 text-gray-600 hover:text-gray-800"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleUpdate}
                        disabled={updateMutation.isPending}
                        className="px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                      >
                        {updateMutation.isPending ? 'Saving...' : 'Save'}
                      </button>
                    </div>
                  </div>
                ) : (
                  // Display mode
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="p-2 bg-green-100 rounded-lg">
                        <BookOpen className="w-5 h-5 text-green-600" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-900">
                            {assignment.price_book?.name}
                          </span>
                          {assignment.is_default && (
                            <span className="px-2 py-0.5 text-xs bg-blue-600 text-white rounded-full">
                              Default
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-sm text-gray-500 mt-1">
                          <span className="flex items-center gap-1">
                            <BookOpen className="w-3 h-3" />
                            {assignment.price_book?.items_count || 0} products
                          </span>
                          <span>→</span>
                          <span className="flex items-center gap-1">
                            <DollarSign className="w-3 h-3" />
                            {assignment.rate_sheet?.name || 'BU Default Rate Sheet'}
                          </span>
                        </div>
                        <div className="text-xs text-gray-400 mt-1">
                          Effective: {new Date(assignment.effective_date).toLocaleDateString()}
                          {assignment.expires_at && (
                            <span> • Expires: {new Date(assignment.expires_at).toLocaleDateString()}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {!assignment.is_default && (
                        <button
                          onClick={() => handleSetDefault(assignment)}
                          className="p-2 text-gray-400 hover:text-yellow-500 rounded"
                          title="Set as default"
                        >
                          <Star className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => startEdit(assignment)}
                        className="p-2 text-gray-400 hover:text-blue-500 rounded"
                        title="Edit"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(assignment)}
                        className="p-2 text-gray-400 hover:text-red-500 rounded"
                        title="Remove"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="font-medium">No product assignments</p>
            <p className="text-sm mt-1">
              This client has access to the full product catalog with BU default pricing.
            </p>
          </div>
        )}
      </div>

      {/* Info Box */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5" />
          <div className="text-sm text-blue-800">
            <p className="font-medium">How Product & Pricing Works</p>
            <ul className="mt-2 space-y-1 text-blue-700">
              <li className="flex items-center gap-2">
                <Check className="w-3 h-3" />
                <span><strong>Price Books</strong> define which products the client can buy</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-3 h-3" />
                <span><strong>Rate Sheets</strong> define what prices they pay</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-3 h-3" />
                <span>No assignment = Full catalog access with BU default pricing</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-3 h-3" />
                <span>Community overrides take priority over client assignments</span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Community Overrides Section */}
      {communitiesWithOverrides.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Home className="w-5 h-5 text-orange-500" />
            <h3 className="text-lg font-semibold text-gray-900">Community Overrides</h3>
          </div>
          <p className="text-sm text-gray-500 mb-4">
            These communities have custom pricing or product restrictions that override the client-level settings.
          </p>
          <div className="space-y-2">
            {communitiesWithOverrides.map((community) => (
              <div
                key={community.id}
                className="flex items-center justify-between p-3 bg-orange-50 rounded-lg border border-orange-100"
              >
                <div className="flex items-center gap-3">
                  <Home className="w-4 h-4 text-orange-600" />
                  <div>
                    <div className="font-medium text-gray-900">{community.name}</div>
                    <div className="text-sm text-gray-600">
                      {community.rate_sheet_override && (
                        <span className="mr-3">
                          Rate Sheet: {community.rate_sheet_override.name}
                        </span>
                      )}
                      {community.community_products_count && community.community_products_count > 0 && (
                        <span>
                          {community.community_products_count} restricted products
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <ChevronDown className="w-4 h-4 text-gray-400" />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
