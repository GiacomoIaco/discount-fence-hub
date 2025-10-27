import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { TAG_CATEGORIES } from '../lib/photos';
import { showSuccess, showError } from '../../../lib/toast';

interface CustomTags {
  productType: string[];
  material: string[];
  style: string[];
}

/**
 * Hook for managing custom photo tags (Admin only)
 * Handles CRUD operations for custom tags in database
 */
export function useTagManagement() {
  const [showTagManagement, setShowTagManagement] = useState(false);
  const [customTags, setCustomTags] = useState<CustomTags>({
    productType: [],
    material: [],
    style: [],
  });

  // Load custom tags from Supabase
  const loadCustomTags = async () => {
    try {
      const { data, error } = await supabase
        .from('custom_photo_tags')
        .select('category, tag_name')
        .order('tag_name');

      if (error) throw error;

      if (data) {
        const tags = {
          productType: data.filter((t) => t.category === 'productType').map((t) => t.tag_name),
          material: data.filter((t) => t.category === 'material').map((t) => t.tag_name),
          style: data.filter((t) => t.category === 'style').map((t) => t.tag_name),
        };
        setCustomTags(tags);
      }
    } catch (e) {
      console.error('Error loading custom tags:', e);
    }
  };

  useEffect(() => {
    loadCustomTags();
  }, []);

  const addCustomTag = async (category: 'productType' | 'material' | 'style', tag: string) => {
    try {
      // Get current user ID
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        showError('You must be logged in to add custom tags');
        return;
      }

      const { error } = await supabase
        .from('custom_photo_tags')
        .insert({
          category,
          tag_name: tag,
          created_by: user.id
        });

      if (error) throw error;

      setCustomTags((prev) => ({
        ...prev,
        [category]: [...prev[category], tag],
      }));

      showSuccess(`Custom tag "${tag}" added to ${category}`);
    } catch (e) {
      console.error('Error adding custom tag:', e);
      showError('Failed to add custom tag');
    }
  };

  const deleteCustomTag = async (category: 'productType' | 'material' | 'style', tag: string) => {
    if (!confirm(`Delete custom tag "${tag}"? This will not remove it from existing photos.`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('custom_photo_tags')
        .delete()
        .eq('category', category)
        .eq('tag_name', tag);

      if (error) throw error;

      setCustomTags((prev) => ({
        ...prev,
        [category]: prev[category].filter((t) => t !== tag),
      }));

      showSuccess(`Custom tag "${tag}" deleted`);
    } catch (e) {
      console.error('Error deleting custom tag:', e);
      showError('Failed to delete custom tag');
    }
  };

  // Get all available tags (built-in + custom)
  const getAllTags = () => {
    return {
      productType: [...TAG_CATEGORIES.productType, ...customTags.productType],
      material: [...TAG_CATEGORIES.material, ...customTags.material],
      style: [...TAG_CATEGORIES.style, ...customTags.style],
    };
  };

  return {
    showTagManagement,
    setShowTagManagement,
    customTags,
    addCustomTag,
    deleteCustomTag,
    getAllTags,
    refreshTags: loadCustomTags,
  };
}
