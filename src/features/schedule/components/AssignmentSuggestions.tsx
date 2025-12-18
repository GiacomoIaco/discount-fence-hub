// Assignment Suggestions Component - Phase 5B
// Displays crew recommendations for job assignment

import { useState } from 'react';
import {
  Star,
  CheckCircle2,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  MapPin,
  Users,
  Percent,
  Clock,
  Wrench,
  Trophy,
  Ban,
} from 'lucide-react';
import type { AssignmentSuggestion, SuggestionReason } from '../utils/assignmentSuggester';

// ============================================
// MAIN COMPONENT
// ============================================

interface AssignmentSuggestionsProps {
  suggestions: AssignmentSuggestion[];
  quickPicks: AssignmentSuggestion[];
  bestMatch: AssignmentSuggestion | null;
  isLoading: boolean;
  selectedCrewId: string | null;
  onSelectCrew: (crewId: string) => void;
  showFullList?: boolean;
}

export function AssignmentSuggestions({
  suggestions,
  quickPicks,
  bestMatch,
  isLoading,
  selectedCrewId,
  onSelectCrew,
  showFullList = false,
}: AssignmentSuggestionsProps) {
  const [isExpanded, setIsExpanded] = useState(showFullList);

  if (isLoading) {
    return (
      <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 animate-pulse">
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-3"></div>
        <div className="space-y-2">
          <div className="h-16 bg-gray-200 dark:bg-gray-700 rounded"></div>
          <div className="h-16 bg-gray-200 dark:bg-gray-700 rounded"></div>
        </div>
      </div>
    );
  }

  if (suggestions.length === 0) {
    return (
      <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 text-center text-gray-500 dark:text-gray-400">
        <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p>No crew suggestions available</p>
        <p className="text-xs mt-1">Select a date to see recommendations</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 dark:bg-gray-800 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 bg-gradient-to-r from-blue-500 to-indigo-500 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Star className="w-4 h-4" />
            <span className="font-medium">Recommended Crews</span>
          </div>
          <span className="text-xs opacity-80">
            {suggestions.length} option{suggestions.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* Best Match Banner */}
      {bestMatch && !selectedCrewId && (
        <div
          className="px-4 py-3 bg-green-50 dark:bg-green-900/20 border-b border-green-200 dark:border-green-800 cursor-pointer hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors"
          onClick={() => onSelectCrew(bestMatch.crew.id)}
        >
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0">
              <div className="w-12 h-12 rounded-full bg-green-500 flex items-center justify-center">
                <Trophy className="w-6 h-6 text-white" />
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-green-800 dark:text-green-200">
                  {bestMatch.crew.name}
                </span>
                <span className="px-2 py-0.5 text-xs bg-green-500 text-white rounded-full">
                  Best Match
                </span>
              </div>
              <div className="flex items-center gap-2 mt-1">
                <MatchScore score={bestMatch.matchPercent} size="sm" />
                <span className="text-xs text-green-600 dark:text-green-400">
                  Click to assign
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quick Picks */}
      <div className="p-4 space-y-2">
        {quickPicks.map((suggestion) => (
          <CrewSuggestionCard
            key={suggestion.crew.id}
            suggestion={suggestion}
            isSelected={selectedCrewId === suggestion.crew.id}
            isBestMatch={bestMatch?.crew.id === suggestion.crew.id}
            onClick={() => onSelectCrew(suggestion.crew.id)}
          />
        ))}

        {/* Show More / Show Less */}
        {suggestions.length > quickPicks.length && (
          <button
            type="button"
            className="w-full py-2 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 flex items-center justify-center gap-1"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded ? (
              <>
                <ChevronUp className="w-4 h-4" />
                Show less
              </>
            ) : (
              <>
                <ChevronDown className="w-4 h-4" />
                Show {suggestions.length - quickPicks.length} more options
              </>
            )}
          </button>
        )}

        {/* Expanded List */}
        {isExpanded && (
          <div className="space-y-2 pt-2 border-t border-gray-200 dark:border-gray-700">
            {suggestions.slice(quickPicks.length).map((suggestion) => (
              <CrewSuggestionCard
                key={suggestion.crew.id}
                suggestion={suggestion}
                isSelected={selectedCrewId === suggestion.crew.id}
                isBestMatch={false}
                onClick={() => onSelectCrew(suggestion.crew.id)}
                compact
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================
// CREW SUGGESTION CARD
// ============================================

interface CrewSuggestionCardProps {
  suggestion: AssignmentSuggestion;
  isSelected: boolean;
  isBestMatch: boolean;
  onClick: () => void;
  compact?: boolean;
}

function CrewSuggestionCard({
  suggestion,
  isSelected,
  isBestMatch: _isBestMatch,
  onClick,
  compact = false,
}: CrewSuggestionCardProps) {
  // Note: _isBestMatch available for future styling enhancements
  const { crew, matchPercent, reasons, isOverCapacity, shouldAvoid } = suggestion;

  return (
    <div
      className={`
        p-3 rounded-lg border cursor-pointer transition-all
        ${isSelected
          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 ring-2 ring-blue-500'
          : shouldAvoid
          ? 'border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-900/10 hover:bg-red-50 dark:hover:bg-red-900/20'
          : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 hover:border-gray-300 dark:hover:border-gray-600'
        }
      `}
      onClick={onClick}
    >
      <div className="flex items-start gap-3">
        {/* Score Circle */}
        <MatchScore score={matchPercent} size={compact ? 'sm' : 'md'} />

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Crew Name */}
          <div className="flex items-center gap-2">
            <span className={`font-medium truncate ${compact ? 'text-sm' : ''}`}>
              {crew.name}
            </span>
            {crew.code && (
              <span className="text-xs text-gray-500 dark:text-gray-400">
                ({crew.code})
              </span>
            )}
            {isSelected && (
              <CheckCircle2 className="w-4 h-4 text-blue-500 flex-shrink-0" />
            )}
            {shouldAvoid && (
              <Ban className="w-4 h-4 text-red-500 flex-shrink-0" />
            )}
          </div>

          {/* Reason Chips */}
          {!compact && (
            <div className="flex flex-wrap gap-1 mt-2">
              {reasons.slice(0, 4).map((reason, idx) => (
                <ReasonChip key={idx} reason={reason} />
              ))}
              {reasons.length > 4 && (
                <span className="px-2 py-0.5 text-xs text-gray-500 dark:text-gray-400">
                  +{reasons.length - 4} more
                </span>
              )}
            </div>
          )}

          {/* Compact view - just show icons */}
          {compact && (
            <div className="flex items-center gap-2 mt-1 text-xs text-gray-500 dark:text-gray-400">
              {suggestion.isPreferred && (
                <span className="flex items-center gap-1">
                  <Star className="w-3 h-3 text-yellow-500" />
                  Preferred
                </span>
              )}
              {isOverCapacity && (
                <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                  <AlertTriangle className="w-3 h-3" />
                  Over capacity
                </span>
              )}
              {crew.territory?.name && (
                <span className="flex items-center gap-1">
                  <MapPin className="w-3 h-3" />
                  {crew.territory.name}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Capacity indicator (non-compact) */}
        {!compact && suggestion.crew.capacity && (
          <div className="flex-shrink-0 text-right">
            <CapacityMini capacity={suggestion.crew.capacity} maxFootage={crew.max_daily_lf || 200} />
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================
// MATCH SCORE CIRCLE
// ============================================

interface MatchScoreProps {
  score: number;
  size?: 'sm' | 'md' | 'lg';
}

function MatchScore({ score, size = 'md' }: MatchScoreProps) {
  const sizes = {
    sm: 'w-10 h-10 text-sm',
    md: 'w-12 h-12 text-base',
    lg: 'w-16 h-16 text-lg',
  };

  const getColor = (score: number) => {
    if (score >= 80) return 'text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30';
    if (score >= 60) return 'text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/30';
    if (score >= 40) return 'text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30';
    return 'text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800';
  };

  return (
    <div
      className={`
        ${sizes[size]}
        rounded-full flex items-center justify-center font-semibold flex-shrink-0
        ${getColor(score)}
      `}
    >
      {score}%
    </div>
  );
}

// ============================================
// REASON CHIP
// ============================================

interface ReasonChipProps {
  reason: SuggestionReason;
}

function ReasonChip({ reason }: ReasonChipProps) {
  const iconMap: Record<string, React.ReactNode> = {
    Preferred: <Star className="w-3 h-3" />,
    Territory: <MapPin className="w-3 h-3" />,
    Expert: <Trophy className="w-3 h-3" />,
    Skills: <Wrench className="w-3 h-3" />,
    Available: <CheckCircle2 className="w-3 h-3" />,
    Avoid: <Ban className="w-3 h-3" />,
  };

  // Check if label contains "capacity" for capacity-related chips
  const isCapacity = reason.label.includes('capacity');
  const isDistance = reason.label.includes('mi');
  const isMissing = reason.label.includes('Missing');

  const getIcon = () => {
    if (isCapacity) return <Percent className="w-3 h-3" />;
    if (isDistance) return <Clock className="w-3 h-3" />;
    if (isMissing) return <AlertTriangle className="w-3 h-3" />;

    // Try to match by label start
    for (const [key, icon] of Object.entries(iconMap)) {
      if (reason.label.startsWith(key)) return icon;
    }
    return null;
  };

  const getStyles = () => {
    switch (reason.type) {
      case 'positive':
        return 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300';
      case 'warning':
        return 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300';
      default:
        return 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300';
    }
  };

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${getStyles()}`}
      title={reason.detail}
    >
      {getIcon()}
      {reason.label}
    </span>
  );
}

// ============================================
// CAPACITY MINI INDICATOR
// ============================================

interface CapacityMiniProps {
  capacity: {
    scheduled_footage: number;
  };
  maxFootage: number;
}

function CapacityMini({ capacity, maxFootage }: CapacityMiniProps) {
  const percent = Math.round((capacity.scheduled_footage / maxFootage) * 100);

  const getColor = () => {
    if (percent >= 100) return 'text-red-600 dark:text-red-400';
    if (percent >= 80) return 'text-amber-600 dark:text-amber-400';
    return 'text-green-600 dark:text-green-400';
  };

  return (
    <div className="text-xs">
      <div className={`font-medium ${getColor()}`}>
        {capacity.scheduled_footage}/{maxFootage} LF
      </div>
      <div className="text-gray-500 dark:text-gray-400">
        {percent}% booked
      </div>
    </div>
  );
}

// ============================================
// INLINE QUICK PICK (for compact spaces)
// ============================================

interface InlineQuickPickProps {
  suggestion: AssignmentSuggestion;
  onClick: () => void;
}

export function InlineQuickPick({ suggestion, onClick }: InlineQuickPickProps) {
  return (
    <button
      type="button"
      className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 text-sm hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
      onClick={onClick}
    >
      <span className="font-medium">{suggestion.crew.name}</span>
      <span className="text-xs opacity-75">{suggestion.matchPercent}%</span>
    </button>
  );
}

export default AssignmentSuggestions;
