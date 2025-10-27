import { Star, Heart, X } from 'lucide-react';
import type { Photo, FilterState } from '../lib/photos';
import { getTagCount } from '../lib/photos';

interface PhotoFiltersProps {
  show: boolean;
  onClose: () => void;
  filters: FilterState;
  photos: Photo[];
  filteredCount: number;
  allTags: {
    productType: string[];
    material: string[];
    style: string[];
  };
  onToggleFilter: (category: keyof FilterState, value: string | boolean) => void;
  onClearFilters: () => void;
}

export function PhotoFilters({
  show,
  onClose,
  filters,
  photos,
  filteredCount,
  allTags,
  onToggleFilter,
  onClearFilters,
}: PhotoFiltersProps) {
  if (!show) return null;

  return (
    <div className="fixed inset-0 bg-white z-30 overflow-y-auto">
      <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex justify-between items-center">
        <h2 className="text-xl font-bold text-gray-900">Filters</h2>
        <div className="flex items-center space-x-4">
          <p className="text-sm text-gray-600 font-medium">{filteredCount} photos match</p>
          <button onClick={onClose} className="text-blue-600 font-semibold">
            Apply
          </button>
        </div>
      </div>

      <div className="p-4 space-y-6">
        {/* Product Type */}
        <div>
          <h3 className="font-semibold text-gray-900 mb-3">PRODUCT TYPE</h3>
          <div className="flex flex-wrap gap-2">
            {allTags.productType.map((tag) => {
              const count = getTagCount(photos, tag);
              const isSelected = filters.productTypes.includes(tag);
              return (
                <button
                  key={tag}
                  onClick={() => onToggleFilter('productTypes', tag)}
                  className={`px-4 py-2 rounded-full text-sm font-medium border-2 transition-colors ${
                    isSelected
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-blue-600 border-blue-600'
                  }`}
                >
                  {tag} <span className="opacity-70">({count})</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Material */}
        <div>
          <h3 className="font-semibold text-gray-900 mb-3">MATERIAL</h3>
          <div className="flex flex-wrap gap-2">
            {allTags.material.map((tag) => {
              const count = getTagCount(photos, tag);
              const isSelected = filters.materials.includes(tag);
              return (
                <button
                  key={tag}
                  onClick={() => onToggleFilter('materials', tag)}
                  className={`px-4 py-2 rounded-full text-sm font-medium border-2 transition-colors ${
                    isSelected
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-blue-600 border-blue-600'
                  }`}
                >
                  {tag} <span className="opacity-70">({count})</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Style */}
        <div>
          <h3 className="font-semibold text-gray-900 mb-3">STYLE</h3>
          <div className="flex flex-wrap gap-2">
            {allTags.style.map((tag) => {
              const count = getTagCount(photos, tag);
              const isSelected = filters.styles.includes(tag);
              return (
                <button
                  key={tag}
                  onClick={() => onToggleFilter('styles', tag)}
                  className={`px-4 py-2 rounded-full text-sm font-medium border-2 transition-colors ${
                    isSelected
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-blue-600 border-blue-600'
                  }`}
                >
                  {tag} <span className="opacity-70">({count})</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Special Filters */}
        <div>
          <h3 className="font-semibold text-gray-900 mb-3">SPECIAL</h3>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => onToggleFilter('showFavorites', true)}
              className={`px-4 py-2 rounded-full text-sm font-medium border-2 transition-colors flex items-center space-x-2 ${
                filters.showFavorites
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-blue-600 border-blue-600'
              }`}
            >
              <Star className="w-4 h-4" />
              <span>Favorites</span>
            </button>

            <button
              onClick={() => onToggleFilter('showLiked', true)}
              className={`px-4 py-2 rounded-full text-sm font-medium border-2 transition-colors flex items-center space-x-2 ${
                filters.showLiked
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-blue-600 border-blue-600'
              }`}
            >
              <Heart className="w-4 h-4" />
              <span>Liked</span>
            </button>
          </div>
        </div>

        {/* Clear Filters Button */}
        {(filters.productTypes.length > 0 ||
          filters.materials.length > 0 ||
          filters.styles.length > 0 ||
          filters.showFavorites ||
          filters.showLiked) && (
          <button
            onClick={onClearFilters}
            className="w-full py-3 border-2 border-red-600 text-red-600 rounded-xl font-semibold hover:bg-red-50 transition-colors flex items-center justify-center space-x-2"
          >
            <X className="w-5 h-5" />
            <span>Clear All Filters</span>
          </button>
        )}
      </div>
    </div>
  );
}
