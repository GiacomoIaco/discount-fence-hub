import { useState } from 'react';
import {
  Plus,
  Search,
  BookOpen,
  MoreVertical,
  Edit2,
  Trash2,
  Copy,
  Building2,
  Check,
  X,
  Tag,
  Star,
} from 'lucide-react';
import { usePriceBooks, useDeletePriceBook, useCreatePriceBook, usePriceBookTags } from '../hooks/usePriceBooks';
import type { PriceBook } from '../types';
import PriceBookEditorModal from './PriceBookEditorModal';

export default function PriceBooksList() {
  const [search, setSearch] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [activeFilter, setActiveFilter] = useState<string>('active');

  const [showEditor, setShowEditor] = useState(false);
  const [editingBook, setEditingBook] = useState<PriceBook | null>(null);
  const [menuOpen, setMenuOpen] = useState<string | null>(null);

  const { data: priceBooks, isLoading } = usePriceBooks({
    search,
    tags: selectedTags.length > 0 ? selectedTags : undefined,
    is_active: activeFilter === 'active' ? true : activeFilter === 'inactive' ? false : undefined,
  });

  const { data: allTags } = usePriceBookTags();

  const deleteMutation = useDeletePriceBook();
  const createMutation = useCreatePriceBook();

  const handleEdit = (book: PriceBook) => {
    setEditingBook(book);
    setShowEditor(true);
    setMenuOpen(null);
  };

  const handleDelete = (book: PriceBook) => {
    if (confirm(`Delete price book "${book.name}"? This will remove all SKU associations. This cannot be undone.`)) {
      deleteMutation.mutate(book.id);
    }
    setMenuOpen(null);
  };

  const handleClone = async (book: PriceBook) => {
    const newName = `${book.name} (Copy)`;
    await createMutation.mutateAsync({
      name: newName,
      code: null,
      description: book.description,
      tags: book.tags,
      is_active: false,
    });
    setMenuOpen(null);
  };

  const toggleTag = (tag: string) => {
    setSelectedTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4 flex-1">
          {/* Search */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search price books..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Status Filter */}
          <select
            value={activeFilter}
            onChange={(e) => setActiveFilter(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
          >
            <option value="">All</option>
            <option value="active">Active Only</option>
            <option value="inactive">Inactive Only</option>
          </select>
        </div>

        <button
          onClick={() => {
            setEditingBook(null);
            setShowEditor(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Price Book
        </button>
      </div>

      {/* Tags Filter */}
      {allTags && allTags.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <Tag className="w-4 h-4 text-gray-400" />
          {allTags.map((tag) => (
            <button
              key={tag}
              onClick={() => toggleTag(tag)}
              className={`px-2 py-1 text-xs rounded-full transition-colors ${
                selectedTags.includes(tag)
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {tag}
            </button>
          ))}
          {selectedTags.length > 0 && (
            <button
              onClick={() => setSelectedTags([])}
              className="px-2 py-1 text-xs text-gray-500 hover:text-gray-700"
            >
              Clear all
            </button>
          )}
        </div>
      )}

      {/* List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full" />
        </div>
      ) : priceBooks?.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-100">
          <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900">No price books yet</h3>
          <p className="text-gray-500 mt-1">Create your first price book to define which products clients can buy</p>
          <button
            onClick={() => setShowEditor(true)}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Create Price Book
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {priceBooks?.map((book) => (
            <div
              key={book.id}
              className="bg-white rounded-xl border border-gray-100 p-4 hover:shadow-md transition-shadow"
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-50 rounded-lg">
                    <BookOpen className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-900">{book.name}</h3>
                    {book.code && (
                      <span className="text-sm text-gray-500">{book.code}</span>
                    )}
                  </div>
                </div>
                <div className="relative">
                  <button
                    onClick={() => setMenuOpen(menuOpen === book.id ? null : book.id)}
                    className="p-1 text-gray-400 hover:text-gray-600 rounded"
                  >
                    <MoreVertical className="w-4 h-4" />
                  </button>
                  {menuOpen === book.id && (
                    <div className="absolute right-0 top-8 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-10 min-w-[140px]">
                      <button
                        onClick={() => handleEdit(book)}
                        className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                      >
                        <Edit2 className="w-4 h-4" />
                        Edit
                      </button>
                      <button
                        onClick={() => handleClone(book)}
                        className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                      >
                        <Copy className="w-4 h-4" />
                        Clone
                      </button>
                      <hr className="my-1" />
                      <button
                        onClick={() => handleDelete(book)}
                        className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-gray-50"
                      >
                        <Trash2 className="w-4 h-4" />
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Tags */}
              {book.tags && book.tags.length > 0 && (
                <div className="flex items-center gap-1 mb-3 flex-wrap">
                  {book.tags.map((tag) => (
                    <span
                      key={tag}
                      className="px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-600"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              {/* Status Badge */}
              <div className="flex items-center gap-2 mb-3">
                <span className={`px-2 py-0.5 text-xs rounded-full ${
                  book.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                }`}>
                  {book.is_active ? <Check className="w-3 h-3 inline mr-1" /> : <X className="w-3 h-3 inline mr-1" />}
                  {book.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>

              {/* Description */}
              {book.description && (
                <p className="text-sm text-gray-600 mb-3 line-clamp-2">{book.description}</p>
              )}

              {/* Stats */}
              <div className="flex items-center gap-4 text-sm text-gray-500 border-t border-gray-100 pt-3">
                <div className="flex items-center gap-1">
                  <BookOpen className="w-4 h-4" />
                  <span>{book.items_count || 0} SKUs</span>
                </div>

                {book.featured_count && book.featured_count > 0 && (
                  <div className="flex items-center gap-1">
                    <Star className="w-4 h-4 text-yellow-500" />
                    <span>{book.featured_count} Featured</span>
                  </div>
                )}

                {book.assigned_clients_count && book.assigned_clients_count > 0 && (
                  <div className="flex items-center gap-1 ml-auto">
                    <Building2 className="w-4 h-4" />
                    <span>{book.assigned_clients_count} clients</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Editor Modal */}
      {showEditor && (
        <PriceBookEditorModal
          priceBook={editingBook}
          onClose={() => {
            setShowEditor(false);
            setEditingBook(null);
          }}
        />
      )}
    </div>
  );
}
