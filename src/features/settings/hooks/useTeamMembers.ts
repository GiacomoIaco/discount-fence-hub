import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';

export interface TeamMember {
  id: string;
  user_id: string;
  email: string;
  full_name: string | null;
  role: string;
  phone: string | null;
  is_active: boolean;
  created_at: string;
}

export function useTeamMembers() {
  return useQuery({
    queryKey: ['team_members'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('id, email, full_name, role, phone, is_active, created_at')
        .eq('is_active', true)
        .order('full_name', { ascending: true });

      if (error) throw error;

      // Map id to user_id for consistency
      return (data || []).map(m => ({
        ...m,
        user_id: m.id,
      })) as TeamMember[];
    },
  });
}
