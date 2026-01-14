import { useState } from 'react';
import { BookOpen, Package, Plus, Minus, Settings2, CheckCircle, XCircle } from 'lucide-react';
import { usePriceBooks } from '../hooks/usePriceBooks';
import PriceBookEditorModal from './PriceBookEditorModal';
import { BU_TYPE_LABELS } from '../types';

/**
 * PriceBooksList - List of BU Price Books with override management
 *
 * Price Books control which SKUs are available in each Business Unit.
 * By default, SKUs are available based on their bu_types_allowed setting.
 * Price Books allow overrides:
 * - Include: Add SKUs that wouldn't normally be available
 * - Exclude: Remove SKUs that would normally be available
 */
export default function PriceBooksList() {
  const { data: priceBooks, isLoading } = usePriceBooks();
  const [selectedPriceBookId, setSelectedPriceBookId] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Price Books</h1>
          <p className="text-gray-500 mt-1">
            Control which products are available in each Business Unit
          </p>
        </div>
      </div>

      {/* Info Card */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <BookOpen className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-700">
            <p className="font-medium mb-1">How Price Books Work</p>
            <ul className="space-y-1 text-blue-600">
              <li>Each BU (Business Unit) has one Price Book that defines available SKUs</li>
              <li>By default, SKUs are available based on their <code className="bg-blue-100 px-1 rounded">bu_types_allowed</code> setting</li>
              <li>Use <span className="text-green-600 font-medium">Include</span> overrides to add SKUs not normally available</li>
              <li>Use <span className="text-red-600 font-medium">Exclude</span> overrides to remove SKUs that would be available</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Price Books Grid */}
      {priceBooks && priceBooks.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {priceBooks.map((book) => (
            <div
              key={book.id}
              className={`bg-white rounded-xl border p-5 hover:shadow-md transition-shadow cursor-pointer ${
                book.is_active ? 'border-gray-200' : 'border-gray-200 opacity-60'
              }`}
              onClick={() => setSelectedPriceBookId(book.id)}
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-purple-600" />
                  <div>
                    <h3 className="font-semibold text-gray-900">{book.qbo_class_name}</h3>
                    {book.bu_type && (
                      <span className="text-xs text-gray-500">
                        {BU_TYPE_LABELS[book.bu_type as keyof typeof BU_TYPE_LABELS] || book.bu_type}
                      </span>
                    )}
                  </div>
                </div>
                {book.is_active ? (
                  <CheckCircle className="w-4 h-4 text-green-500" />
                ) : (
                  <XCircle className="w-4 h-4 text-gray-400" />
                )}
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="text-center p-2 bg-gray-50 rounded-lg">
                  <div className="text-lg font-semibold text-gray-900">{book.sku_count}</div>
                  <div className="text-xs text-gray-500">SKUs</div>
                </div>
                <div className="text-center p-2 bg-green-50 rounded-lg">
                  <div className="text-lg font-semibold text-green-600">
                    {book.include_count > 0 ? `+${book.include_count}` : '0'}
                  </div>
                  <div className="text-xs text-gray-500">Included</div>
                </div>
                <div className="text-center p-2 bg-red-50 rounded-lg">
                  <div className="text-lg font-semibold text-red-600">
                    {book.exclude_count > 0 ? `-${book.exclude_count}` : '0'}
                  </div>
                  <div className="text-xs text-gray-500">Excluded</div>
                </div>
              </div>

              {/* Rate Sheet Info */}
              {book.default_rate_sheet_name && (
                <div className="text-xs text-gray-500 border-t pt-3 mt-3">
                  <span className="font-medium">Default Rate Sheet:</span> {book.default_rate_sheet_name}
                </div>
              )}

              {/* Action */}
              <button
                className="w-full mt-3 flex items-center justify-center gap-2 px-3 py-2 text-sm text-purple-600 border border-purple-200 rounded-lg hover:bg-purple-50"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedPriceBookId(book.id);
                }}
              >
                <Settings2 className="w-4 h-4" />
                Manage Overrides
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 bg-gray-50 rounded-xl border border-dashed">
          <Package className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <h3 className="text-lg font-medium text-gray-900 mb-1">No Price Books</h3>
          <p className="text-gray-500">
            Price Books are automatically created for each QBO Class.
          </p>
        </div>
      )}

      {/* Price Book Editor Modal */}
      {selectedPriceBookId && (
        <PriceBookEditorModal
          priceBookId={selectedPriceBookId}
          onClose={() => setSelectedPriceBookId(null)}
        />
      )}
    </div>
  );
}
