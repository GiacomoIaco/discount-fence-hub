import { cn } from '../../../lib/utils';

interface Reaction {
  emoji: string;
  count: number;
  hasReacted: boolean;
}

interface ReactionDisplayProps {
  reactions: Reaction[];
  onToggle: (emoji: string) => void;
  isOwnMessage: boolean;
}

export function ReactionDisplay({ reactions, onToggle, isOwnMessage }: ReactionDisplayProps) {
  if (reactions.length === 0) return null;

  return (
    <div className={cn(
      'flex flex-wrap gap-1 mt-1 px-1',
      isOwnMessage ? 'justify-end' : 'justify-start'
    )}>
      {reactions.map(({ emoji, count, hasReacted }) => (
        <button
          key={emoji}
          onClick={() => onToggle(emoji)}
          className={cn(
            'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs transition-colors border',
            hasReacted
              ? 'bg-blue-50 border-blue-200 text-blue-700'
              : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
          )}
        >
          <span>{emoji}</span>
          <span className="font-medium">{count}</span>
        </button>
      ))}
    </div>
  );
}

export default ReactionDisplay;
