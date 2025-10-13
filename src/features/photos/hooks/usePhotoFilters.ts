import { useState, useEffect } from 'react';
import type { Photo, FilterState } from '../../../lib/photos';
import { filterPhotos, getActiveFilterCount } from '../../../lib/photos';

/**
 * Hook for managing photo gallery filters
 * Handles filter state and applies filters to photo list
 */
export function usePhotoFilters(photos: Photo[]) {
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<FilterState>({
    productTypes: [],
    materials: [],
    styles: [],
    showFavorites: false,
    showLiked: false,
  });
  const [filteredPhotos, setFilteredPhotos] = useState<Photo[]>([]);

  // Apply filters whenever photos or filters change
  useEffect(() => {
    const filtered = filterPhotos(photos, filters);
    setFilteredPhotos(filtered);
  }, [photos, filters]);

  const toggleFilter = (category: keyof FilterState, value: string | boolean) => {
    setFilters((prev) => {
      if (category === 'showFavorites' || category === 'showLiked') {
        return { ...prev, [category]: !prev[category] };
      }

      const currentArray = prev[category] as string[];
      const valueStr = value as string;

      if (currentArray.includes(valueStr)) {
        return {
          ...prev,
          [category]: currentArray.filter((item) => item !== valueStr),
        };
      } else {
        return {
          ...prev,
          [category]: [...currentArray, valueStr],
        };
      }
    });
  };

  const clearFilters = () => {
    setFilters({
      productTypes: [],
      materials: [],
      styles: [],
      showFavorites: false,
      showLiked: false,
    });
  };

  const activeFilterCount = getActiveFilterCount(filters);

  return {
    showFilters,
    setShowFilters,
    filters,
    filteredPhotos,
    toggleFilter,
    clearFilters,
    activeFilterCount,
  };
}
