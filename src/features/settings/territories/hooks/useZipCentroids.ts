import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../../../lib/supabase';
import type { MetroZipCentroid } from '../types/territory.types';

export function useZipCentroids(metro?: string) {
  return useQuery({
    queryKey: ['metro-zip-centroids', metro],
    queryFn: async () => {
      let query = supabase
        .from('metro_zip_centroids')
        .select('*')
        .order('zip_code');

      if (metro) {
        query = query.eq('metro', metro);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as MetroZipCentroid[];
    },
    staleTime: 1000 * 60 * 60, // Cache for 1 hour - this data rarely changes
  });
}

export function useAllZipCentroids() {
  return useQuery({
    queryKey: ['metro-zip-centroids', 'all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('metro_zip_centroids')
        .select('*')
        .order('zip_code');

      if (error) throw error;
      return data as MetroZipCentroid[];
    },
    staleTime: 1000 * 60 * 60, // Cache for 1 hour
  });
}
