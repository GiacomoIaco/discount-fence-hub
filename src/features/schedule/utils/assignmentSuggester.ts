// Assignment Suggester - Phase 5B
// Recommends best crews for a job based on multiple factors

import type { Crew } from '../../fsm/types';
import type { CrewDailyCapacity } from '../types/schedule.types';

// ============================================
// TYPES
// ============================================

export interface SuggestionContext {
  // Job details
  jobId?: string;
  scheduledDate: string;
  estimatedFootage: number | null;
  productType: string | null;  // e.g., 'Wood Vertical', 'Iron'
  skillTagIds: string[];       // Required skills for job
  territoryId: string | null;

  // Location (for proximity)
  jobLatitude: number | null;
  jobLongitude: number | null;

  // Builder preferences
  preferredCrewId: string | null;  // From community or client
  avoidCrewIds: string[];          // Crews marked to avoid
}

export interface CrewWithContext extends Omit<Crew, 'territory'> {
  // Extended data for scoring
  skill_tags?: {
    skill_tag_id: string;
    proficiency: 'trainee' | 'basic' | 'standard' | 'expert';
    skill_tag?: { id: string; name: string; code: string };
  }[];
  territory?: { id: string; name: string; code: string } | null;
  capacity?: CrewDailyCapacity;
  distance_miles?: number;
  travel_minutes?: number;
}

export interface SuggestionReason {
  type: 'positive' | 'neutral' | 'warning';
  label: string;
  detail?: string;
}

export interface AssignmentSuggestion {
  crew: CrewWithContext;
  score: number;           // 0-100
  matchPercent: number;    // Display percentage
  reasons: SuggestionReason[];

  // Breakdown scores (for debugging/transparency)
  breakdown: {
    preferenceScore: number;   // 0-25: Builder preference match
    territoryScore: number;    // 0-20: Territory match
    skillScore: number;        // 0-25: Skills match with proficiency
    capacityScore: number;     // 0-20: Available capacity
    proximityScore: number;    // 0-10: Distance/travel time
  };

  // Quick indicators
  isPreferred: boolean;
  hasAllSkills: boolean;
  isOverCapacity: boolean;
  shouldAvoid: boolean;
}

// ============================================
// SCORING WEIGHTS (total: 100)
// ============================================

const WEIGHTS = {
  PREFERENCE: 25,     // Builder/community preferred crew
  TERRITORY: 20,      // Home territory match
  SKILLS: 25,         // Required skills + proficiency
  CAPACITY: 20,       // Available capacity on date
  PROXIMITY: 10,      // Distance from job
};

// Proficiency multipliers for skill scoring
const PROFICIENCY_SKILL_BONUS: Record<string, number> = {
  expert: 1.2,
  standard: 1.0,
  basic: 0.8,
  trainee: 0.6,
};

// ============================================
// MAIN SCORING FUNCTION
// ============================================

export function calculateCrewSuggestions(
  crews: CrewWithContext[],
  context: SuggestionContext
): AssignmentSuggestion[] {
  const suggestions: AssignmentSuggestion[] = [];

  for (const crew of crews) {
    // Skip inactive crews
    if (!crew.is_active) continue;

    // Calculate individual scores
    const preferenceScore = calculatePreferenceScore(crew, context);
    const territoryScore = calculateTerritoryScore(crew, context);
    const skillScore = calculateSkillScore(crew, context);
    const capacityScore = calculateCapacityScore(crew, context);
    const proximityScore = calculateProximityScore(crew, context);

    // Total score
    const totalScore = preferenceScore + territoryScore + skillScore + capacityScore + proximityScore;

    // Build reasons
    const reasons = buildReasons(crew, context, {
      preferenceScore,
      territoryScore,
      skillScore,
      capacityScore,
      proximityScore,
    });

    // Quick indicators
    const isPreferred = context.preferredCrewId === crew.id;
    const hasAllSkills = checkHasAllSkills(crew, context.skillTagIds);
    const isOverCapacity = checkIsOverCapacity(crew, context);
    const shouldAvoid = context.avoidCrewIds.includes(crew.id);

    suggestions.push({
      crew,
      score: totalScore,
      matchPercent: Math.round(totalScore),
      reasons,
      breakdown: {
        preferenceScore,
        territoryScore,
        skillScore,
        capacityScore,
        proximityScore,
      },
      isPreferred,
      hasAllSkills,
      isOverCapacity,
      shouldAvoid,
    });
  }

  // Sort by score (highest first), but deprioritize "avoid" crews
  return suggestions.sort((a, b) => {
    // Avoid crews go to bottom
    if (a.shouldAvoid && !b.shouldAvoid) return 1;
    if (!a.shouldAvoid && b.shouldAvoid) return -1;

    // Otherwise sort by score
    return b.score - a.score;
  });
}

// ============================================
// INDIVIDUAL SCORE CALCULATIONS
// ============================================

function calculatePreferenceScore(
  crew: CrewWithContext,
  context: SuggestionContext
): number {
  // Full points for preferred crew
  if (context.preferredCrewId === crew.id) {
    return WEIGHTS.PREFERENCE;
  }

  // Penalty for crews to avoid
  if (context.avoidCrewIds.includes(crew.id)) {
    return -10; // Negative score
  }

  // No preference set - partial credit
  if (!context.preferredCrewId) {
    return WEIGHTS.PREFERENCE * 0.5;
  }

  return 0;
}

function calculateTerritoryScore(
  crew: CrewWithContext,
  context: SuggestionContext
): number {
  if (!context.territoryId) {
    // No territory specified - give partial credit to all
    return WEIGHTS.TERRITORY * 0.5;
  }

  // Full match
  if (crew.home_territory_id === context.territoryId) {
    return WEIGHTS.TERRITORY;
  }

  // Partial credit for crews with no home territory (flexible)
  if (!crew.home_territory_id) {
    return WEIGHTS.TERRITORY * 0.3;
  }

  return 0;
}

function calculateSkillScore(
  crew: CrewWithContext,
  context: SuggestionContext
): number {
  // If no skills required, everyone gets partial credit
  if (context.skillTagIds.length === 0 && !context.productType) {
    return WEIGHTS.SKILLS * 0.5;
  }

  // Check for product_skills array match (legacy)
  const productSkillsMatch = context.productType &&
    crew.product_skills?.includes(context.productType);

  // Check for skill_tags match (new system)
  const crewSkillTagIds = (crew.skill_tags || []).map(st => st.skill_tag_id);
  const matchedSkills = context.skillTagIds.filter(id => crewSkillTagIds.includes(id));
  const missingSkills = context.skillTagIds.length - matchedSkills.length;

  // Calculate base skill score
  let baseScore = 0;

  if (context.skillTagIds.length > 0) {
    // Percentage of required skills matched
    const matchPercent = matchedSkills.length / context.skillTagIds.length;
    baseScore = WEIGHTS.SKILLS * matchPercent;

    // Apply proficiency bonus
    const avgProficiency = calculateAverageProficiency(crew, matchedSkills);
    baseScore *= avgProficiency;
  } else if (productSkillsMatch) {
    // Legacy skill match
    baseScore = WEIGHTS.SKILLS;
  }

  // Penalty for missing required skills
  if (missingSkills > 0) {
    baseScore -= missingSkills * 5;
  }

  return Math.max(0, Math.min(WEIGHTS.SKILLS, baseScore));
}

function calculateAverageProficiency(
  crew: CrewWithContext,
  matchedSkillIds: string[]
): number {
  if (matchedSkillIds.length === 0) return 1;

  const proficiencies = matchedSkillIds.map(skillId => {
    const skillTag = crew.skill_tags?.find(st => st.skill_tag_id === skillId);
    return PROFICIENCY_SKILL_BONUS[skillTag?.proficiency || 'standard'];
  });

  return proficiencies.reduce((a, b) => a + b, 0) / proficiencies.length;
}

function calculateCapacityScore(
  crew: CrewWithContext,
  context: SuggestionContext
): number {
  const capacity = crew.capacity;
  const maxFootage = crew.max_daily_lf || 200;
  const jobFootage = context.estimatedFootage || 0;

  // If no capacity data, use crew's max_daily_lf
  if (!capacity) {
    return WEIGHTS.CAPACITY * 0.7; // Partial credit - unknown capacity
  }

  // Calculate what utilization would be after adding this job
  const currentScheduled = capacity.scheduled_footage || 0;
  const newTotal = currentScheduled + jobFootage;
  const newUtilization = newTotal / maxFootage;

  if (newUtilization <= 0.8) {
    // Under 80% - full credit
    return WEIGHTS.CAPACITY;
  } else if (newUtilization <= 1.0) {
    // 80-100% - scaled credit
    return WEIGHTS.CAPACITY * (1 - (newUtilization - 0.8) / 0.2 * 0.3);
  } else if (newUtilization <= 1.3) {
    // 100-130% - reduced credit
    return WEIGHTS.CAPACITY * 0.3;
  } else {
    // Over 130% - minimal credit
    return WEIGHTS.CAPACITY * 0.1;
  }
}

function calculateProximityScore(
  crew: CrewWithContext,
  _context: SuggestionContext
): number {
  // Note: _context available for future distance calculations
  // If distance not calculated, give partial credit
  if (crew.distance_miles === undefined) {
    return WEIGHTS.PROXIMITY * 0.5;
  }

  const distance = crew.distance_miles;

  // Scoring tiers based on distance
  if (distance <= 10) {
    return WEIGHTS.PROXIMITY;
  } else if (distance <= 20) {
    return WEIGHTS.PROXIMITY * 0.8;
  } else if (distance <= 30) {
    return WEIGHTS.PROXIMITY * 0.6;
  } else if (distance <= 50) {
    return WEIGHTS.PROXIMITY * 0.4;
  } else {
    return WEIGHTS.PROXIMITY * 0.2;
  }
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function checkHasAllSkills(crew: CrewWithContext, requiredSkillIds: string[]): boolean {
  if (requiredSkillIds.length === 0) return true;

  const crewSkillIds = (crew.skill_tags || []).map(st => st.skill_tag_id);
  return requiredSkillIds.every(id => crewSkillIds.includes(id));
}

function checkIsOverCapacity(crew: CrewWithContext, context: SuggestionContext): boolean {
  const capacity = crew.capacity;
  if (!capacity) return false;

  const maxFootage = crew.max_daily_lf || 200;
  const jobFootage = context.estimatedFootage || 0;
  const newTotal = (capacity.scheduled_footage || 0) + jobFootage;

  return newTotal > maxFootage;
}

function buildReasons(
  crew: CrewWithContext,
  context: SuggestionContext,
  _scores: {
    preferenceScore: number;
    territoryScore: number;
    skillScore: number;
    capacityScore: number;
    proximityScore: number;
  }
): SuggestionReason[] {
  // Note: _scores available for future debugging/analytics
  const reasons: SuggestionReason[] = [];

  // Preference reasons
  if (context.preferredCrewId === crew.id) {
    reasons.push({
      type: 'positive',
      label: 'Preferred',
      detail: 'Builder preferred crew',
    });
  } else if (context.avoidCrewIds.includes(crew.id)) {
    reasons.push({
      type: 'warning',
      label: 'Avoid',
      detail: 'Marked to avoid for this builder',
    });
  }

  // Territory reasons
  if (context.territoryId && crew.home_territory_id === context.territoryId) {
    reasons.push({
      type: 'positive',
      label: 'Territory',
      detail: `Home territory: ${crew.territory?.name || 'Match'}`,
    });
  }

  // Skill reasons
  const crewSkillIds = (crew.skill_tags || []).map(st => st.skill_tag_id);
  const matchedSkills = context.skillTagIds.filter(id => crewSkillIds.includes(id));
  const missingSkills = context.skillTagIds.filter(id => !crewSkillIds.includes(id));

  if (matchedSkills.length > 0) {
    const hasExpert = crew.skill_tags?.some(
      st => matchedSkills.includes(st.skill_tag_id) && st.proficiency === 'expert'
    );

    if (hasExpert) {
      reasons.push({
        type: 'positive',
        label: 'Expert',
        detail: 'Expert proficiency in required skills',
      });
    } else if (matchedSkills.length === context.skillTagIds.length) {
      reasons.push({
        type: 'positive',
        label: 'Skills',
        detail: 'Has all required skills',
      });
    }
  }

  if (missingSkills.length > 0) {
    reasons.push({
      type: 'warning',
      label: `Missing ${missingSkills.length} skill${missingSkills.length > 1 ? 's' : ''}`,
    });
  }

  // Legacy product_skills check
  if (context.productType && crew.product_skills?.includes(context.productType)) {
    reasons.push({
      type: 'positive',
      label: context.productType,
    });
  }

  // Capacity reasons
  const capacity = crew.capacity;
  if (capacity) {
    const maxFootage = crew.max_daily_lf || 200;
    const jobFootage = context.estimatedFootage || 0;
    const newTotal = (capacity.scheduled_footage || 0) + jobFootage;
    const utilization = Math.round((newTotal / maxFootage) * 100);

    if (utilization > 100) {
      reasons.push({
        type: 'warning',
        label: `${utilization}% capacity`,
        detail: 'Would be over capacity',
      });
    } else if (utilization > 80) {
      reasons.push({
        type: 'neutral',
        label: `${utilization}% capacity`,
        detail: 'Near full capacity',
      });
    } else {
      reasons.push({
        type: 'positive',
        label: 'Available',
        detail: `${utilization}% capacity after job`,
      });
    }
  }

  // Proximity reasons
  if (crew.distance_miles !== undefined) {
    const distance = Math.round(crew.distance_miles);
    const time = crew.travel_minutes ? Math.round(crew.travel_minutes) : null;

    if (distance <= 15) {
      reasons.push({
        type: 'positive',
        label: `${distance} mi`,
        detail: time ? `${time} min drive` : undefined,
      });
    } else if (distance <= 30) {
      reasons.push({
        type: 'neutral',
        label: `${distance} mi`,
        detail: time ? `${time} min drive` : undefined,
      });
    } else {
      reasons.push({
        type: 'warning',
        label: `${distance} mi`,
        detail: time ? `${time} min drive` : 'Far from job site',
      });
    }
  }

  return reasons;
}

// ============================================
// QUICK PICKS HELPER
// ============================================

/**
 * Get top N suggestions as "quick picks" for UI
 */
export function getQuickPicks(
  suggestions: AssignmentSuggestion[],
  limit: number = 3
): AssignmentSuggestion[] {
  return suggestions
    .filter(s => !s.shouldAvoid && s.score >= 50)
    .slice(0, limit);
}

/**
 * Get the best match (if score is high enough)
 */
export function getBestMatch(
  suggestions: AssignmentSuggestion[]
): AssignmentSuggestion | null {
  const best = suggestions[0];
  if (!best || best.shouldAvoid || best.score < 60) return null;
  return best;
}
