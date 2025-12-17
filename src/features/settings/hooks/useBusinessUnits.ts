import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';

export interface BusinessUnit {
  id: string;
  name: string;
  code: string;
  is_active: boolean;
  created_at: string;
}

export function useBusinessUnits() {
  return useQuery({
    queryKey: ['business_units'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('business_units')
        .select('*')
        .eq('is_active', true)
        .order('code');

      if (error) throw error;
      return data as BusinessUnit[];
    },
  });
}
