import { useState } from 'react';
import { Copy, Loader2 } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { toast } from 'react-hot-toast';
import { useQueryClient } from '@tanstack/react-query';

interface CopyYearButtonProps {
  functionId: string;
  fromYear: number;
  toYear: number;
}

export default function CopyYearButton({ functionId, fromYear, toYear }: CopyYearButtonProps) {
  const [isCopying, setIsCopying] = useState(false);
  const queryClient = useQueryClient();

  const handleCopyYear = async () => {
    if (!window.confirm(`Prepare active areas and initiatives for ${toYear} planning?\n\nThis will confirm ${toYear} is ready to start using the active areas and initiatives from ${fromYear}.`)) {
      return;
    }

    setIsCopying(true);

    try {
      // Get all active areas for this function
      const { data: areas, error: areasError } = await supabase
        .from('project_areas')
        .select('*')
        .eq('function_id', functionId)
        .eq('is_active', true);

      if (areasError) throw areasError;

      if (!areas || areas.length === 0) {
        toast.error('No active areas found. Create areas first before planning.');
        return;
      }

      let totalInitiatives = 0;

      // Count active initiatives across all areas
      for (const area of areas) {
        const { data: initiatives, error: initiativesError } = await supabase
          .from('project_initiatives')
          .select('id')
          .eq('area_id', area.id)
          .eq('is_active', true);

        if (initiativesError) throw initiativesError;

        totalInitiatives += initiatives?.length || 0;
      }

      if (totalInitiatives === 0) {
        toast.error('No active initiatives found. Create initiatives before planning.');
        return;
      }

      // Areas and initiatives are evergreen - they persist across years
      // Year-specific data (actions, targets, objectives) will be created as needed
      toast.success(`Ready for ${toYear}! Found ${areas.length} active areas with ${totalInitiatives} initiatives.`);

      // Invalidate queries to refresh the UI
      queryClient.invalidateQueries({ queryKey: ['leadership'] });

    } catch (error) {
      console.error('Failed to prepare year:', error);
      toast.error('Failed to prepare year for planning');
    } finally {
      setIsCopying(false);
    }
  };

  // Only show if viewing a future year
  const currentYear = new Date().getFullYear();
  const shouldShow = toYear > fromYear;

  if (!shouldShow) return null;

  return (
    <button
      onClick={handleCopyYear}
      disabled={isCopying}
      className="flex items-center gap-2 px-3 py-1.5 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      title={`Copy active areas and initiatives from ${fromYear}`}
    >
      {isCopying ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin" />
          Copying...
        </>
      ) : (
        <>
          <Copy className="w-4 h-4" />
          Copy from {fromYear}
        </>
      )}
    </button>
  );
}
