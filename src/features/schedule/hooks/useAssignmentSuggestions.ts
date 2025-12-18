// Assignment Suggestions Hook - Phase 5B
// Fetches data and computes crew suggestions for job assignment

import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import { useCrews } from '../../fsm/hooks/useCrews';
import { useCrewCapacityForDate } from './useCrewCapacity';
import {
  calculateCrewSuggestions,
  getQuickPicks,
  getBestMatch,
  type SuggestionContext,
  type CrewWithContext,
  type AssignmentSuggestion,
} from '../utils/assignmentSuggester';

// ============================================
// MAIN HOOK
// ============================================

export interface UseAssignmentSuggestionsOptions {
  // Job details
  jobId?: string;
  scheduledDate: string | null;
  estimatedFootage: number | null;
  productType: string | null;
  skillTagIds?: string[];
  territoryId?: string | null;

  // Location for proximity calc
  jobLatitude?: number | null;
  jobLongitude?: number | null;

  // Builder context (from job -> client/community)
  clientId?: string | null;
  communityId?: string | null;

  // Enable/disable
  enabled?: boolean;
}

export interface UseAssignmentSuggestionsResult {
  suggestions: AssignmentSuggestion[];
  quickPicks: AssignmentSuggestion[];
  bestMatch: AssignmentSuggestion | null;
  isLoading: boolean;
  error: Error | null;
}

export function useAssignmentSuggestions(
  options: UseAssignmentSuggestionsOptions
): UseAssignmentSuggestionsResult {
  const {
    jobId,
    scheduledDate,
    estimatedFootage,
    productType,
    skillTagIds = [],
    territoryId,
    jobLatitude,
    jobLongitude,
    clientId,
    communityId,
    enabled = true,
  } = options;

  // Fetch base crews data (for loading state)
  const { isLoading: crewsLoading } = useCrews();

  // Fetch crews with skill tags
  const { data: crewsWithSkills, isLoading: skillsLoading } = useQuery({
    queryKey: ['crews_with_skills'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('crews')
        .select(`
          *,
          territory:territories(id, name, code),
          skill_tags:crew_skill_tags(
            skill_tag_id,
            proficiency,
            skill_tag:skill_tags(id, name, code)
          )
        `)
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      return data;
    },
    enabled,
  });

  // Fetch capacity for the scheduled date
  const { data: capacityData, isLoading: capacityLoading } = useCrewCapacityForDate(
    scheduledDate ? new Date(scheduledDate) : new Date()
  );

  // Fetch builder preferences from client/community
  const { data: builderPrefs, isLoading: prefsLoading } = useQuery({
    queryKey: ['builder_preferences', clientId, communityId],
    queryFn: async () => {
      let preferredCrewId: string | null = null;
      const avoidCrewIds: string[] = [];

      // Get community preferences first (more specific)
      if (communityId) {
        const { data: community } = await supabase
          .from('communities')
          .select('preferred_crew_id, priority_crew_ids')
          .eq('id', communityId)
          .single();

        if (community?.preferred_crew_id) {
          preferredCrewId = community.preferred_crew_id;
        }
      }

      // Fall back to client preferences
      if (!preferredCrewId && clientId) {
        const { data: client } = await supabase
          .from('clients')
          .select('preferred_crew_id')
          .eq('id', clientId)
          .single();

        if (client?.preferred_crew_id) {
          preferredCrewId = client.preferred_crew_id;
        }
      }

      // Note: avoidCrewIds would come from a future table
      // For now, return empty array

      return { preferredCrewId, avoidCrewIds };
    },
    enabled: enabled && (!!clientId || !!communityId),
  });

  // Calculate suggestions when all data is available
  const isLoading = crewsLoading || skillsLoading || capacityLoading || prefsLoading;

  let suggestions: AssignmentSuggestion[] = [];
  let quickPicks: AssignmentSuggestion[] = [];
  let bestMatch: AssignmentSuggestion | null = null;

  if (!isLoading && crewsWithSkills && scheduledDate) {
    // Build crew context with capacity data
    const crewsWithContext: CrewWithContext[] = crewsWithSkills.map(crew => {
      const capacity = capacityData?.find(c => c.crew_id === crew.id);
      return {
        ...crew,
        capacity: capacity || undefined,
      };
    });

    // Build suggestion context
    const context: SuggestionContext = {
      jobId,
      scheduledDate,
      estimatedFootage,
      productType,
      skillTagIds,
      territoryId: territoryId || null,
      jobLatitude: jobLatitude || null,
      jobLongitude: jobLongitude || null,
      preferredCrewId: builderPrefs?.preferredCrewId || null,
      avoidCrewIds: builderPrefs?.avoidCrewIds || [],
    };

    // Calculate suggestions
    suggestions = calculateCrewSuggestions(crewsWithContext, context);
    quickPicks = getQuickPicks(suggestions, 3);
    bestMatch = getBestMatch(suggestions);
  }

  return {
    suggestions,
    quickPicks,
    bestMatch,
    isLoading,
    error: null,
  };
}

// ============================================
// SIMPLIFIED HOOK FOR QUICK SUGGESTIONS
// ============================================

/**
 * Quick hook for getting crew suggestions when you just have a job ID
 * Fetches job details automatically
 */
export function useJobAssignmentSuggestions(
  jobId: string | undefined,
  scheduledDate: string | null
): UseAssignmentSuggestionsResult {
  // Fetch job details
  const { data: job, isLoading: jobLoading } = useQuery({
    queryKey: ['job_for_suggestions', jobId],
    queryFn: async () => {
      if (!jobId) return null;

      const { data, error } = await supabase
        .from('jobs')
        .select(`
          id,
          product_type,
          linear_feet,
          territory_id,
          client_id,
          community_id,
          site_latitude,
          site_longitude,
          skill_tag_ids
        `)
        .eq('id', jobId)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!jobId,
  });

  // Use main suggestions hook with job data
  const suggestionsResult = useAssignmentSuggestions({
    jobId,
    scheduledDate,
    estimatedFootage: job?.linear_feet || null,
    productType: job?.product_type || null,
    skillTagIds: job?.skill_tag_ids || [],
    territoryId: job?.territory_id || null,
    jobLatitude: job?.site_latitude || null,
    jobLongitude: job?.site_longitude || null,
    clientId: job?.client_id || null,
    communityId: job?.community_id || null,
    enabled: !!job && !!scheduledDate,
  });

  return {
    ...suggestionsResult,
    isLoading: jobLoading || suggestionsResult.isLoading,
  };
}

export default useAssignmentSuggestions;
