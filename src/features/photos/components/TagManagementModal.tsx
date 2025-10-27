import { useState } from 'react';
import { X, Plus } from 'lucide-react';
import { TAG_CATEGORIES } from '../lib/photos';

interface AddTagInputProps {
  onAdd: (tag: string) => void;
  placeholder: string;
}

const AddTagInput = ({ onAdd, placeholder }: AddTagInputProps) => {
  const [value, setValue] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (value.trim()) {
      onAdd(value);
      setValue('');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex space-x-2">
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      <button
        type="submit"
        className="px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 flex items-center space-x-1"
      >
        <Plus className="w-4 h-4" />
        <span>Add</span>
      </button>
    </form>
  );
};

interface TagManagementModalProps {
  show: boolean;
  customTags: {
    productType: string[];
    material: string[];
    style: string[];
  };
  onClose: () => void;
  onAddTag: (category: 'productType' | 'material' | 'style', tag: string) => void;
  onDeleteTag: (category: 'productType' | 'material' | 'style', tag: string) => void;
}

export function TagManagementModal({
  show,
  customTags,
  onClose,
  onAddTag,
  onDeleteTag,
}: TagManagementModalProps) {
  if (!show) return null;

  const getTotalCount = (category: 'productType' | 'material' | 'style') => {
    const builtInCount = TAG_CATEGORIES[category].length;
    const customCount = customTags[category].length;
    return builtInCount + customCount;
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[80vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold">Manage Tags</h2>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
              <X className="w-6 h-6" />
            </button>
          </div>

          <p className="text-gray-600 mb-6">
            Add new tags to each category. Built-in tags cannot be deleted, but custom tags can be removed.
          </p>

          {/* Product Types */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold mb-3 flex items-center space-x-2">
              <span>Product Types</span>
              <span className="text-sm text-gray-500 font-normal">({getTotalCount('productType')} total)</span>
            </h3>

            <AddTagInput onAdd={(tag) => onAddTag('productType', tag)} placeholder="Add new product type..." />

            <div className="mt-3 space-y-2">
              {TAG_CATEGORIES.productType.map((tag) => (
                <div key={tag} className="flex items-center justify-between bg-gray-100 px-3 py-2 rounded">
                  <span>{tag}</span>
                  <span className="text-xs text-gray-500">Built-in</span>
                </div>
              ))}
              {customTags.productType.map((tag) => (
                <div key={tag} className="flex items-center justify-between bg-blue-50 px-3 py-2 rounded">
                  <span className="font-medium">{tag}</span>
                  <button
                    onClick={() => {
                      if (confirm(`Delete custom tag "${tag}"?`)) {
                        onDeleteTag('productType', tag);
                      }
                    }}
                    className="text-red-600 hover:text-red-700 text-sm"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Materials */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold mb-3 flex items-center space-x-2">
              <span>Materials</span>
              <span className="text-sm text-gray-500 font-normal">({getTotalCount('material')} total)</span>
            </h3>

            <AddTagInput onAdd={(tag) => onAddTag('material', tag)} placeholder="Add new material..." />

            <div className="mt-3 space-y-2">
              {TAG_CATEGORIES.material.map((tag) => (
                <div key={tag} className="flex items-center justify-between bg-gray-100 px-3 py-2 rounded">
                  <span>{tag}</span>
                  <span className="text-xs text-gray-500">Built-in</span>
                </div>
              ))}
              {customTags.material.map((tag) => (
                <div key={tag} className="flex items-center justify-between bg-blue-50 px-3 py-2 rounded">
                  <span className="font-medium">{tag}</span>
                  <button
                    onClick={() => {
                      if (confirm(`Delete custom tag "${tag}"?`)) {
                        onDeleteTag('material', tag);
                      }
                    }}
                    className="text-red-600 hover:text-red-700 text-sm"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Styles */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold mb-3 flex items-center space-x-2">
              <span>Styles</span>
              <span className="text-sm text-gray-500 font-normal">({getTotalCount('style')} total)</span>
            </h3>

            <AddTagInput onAdd={(tag) => onAddTag('style', tag)} placeholder="Add new style..." />

            <div className="mt-3 space-y-2">
              {TAG_CATEGORIES.style.map((tag) => (
                <div key={tag} className="flex items-center justify-between bg-gray-100 px-3 py-2 rounded">
                  <span>{tag}</span>
                  <span className="text-xs text-gray-500">Built-in</span>
                </div>
              ))}
              {customTags.style.map((tag) => (
                <div key={tag} className="flex items-center justify-between bg-blue-50 px-3 py-2 rounded">
                  <span className="font-medium">{tag}</span>
                  <button
                    onClick={() => {
                      if (confirm(`Delete custom tag "${tag}"?`)) {
                        onDeleteTag('style', tag);
                      }
                    }}
                    className="text-red-600 hover:text-red-700 text-sm"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end">
            <button
              onClick={onClose}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
