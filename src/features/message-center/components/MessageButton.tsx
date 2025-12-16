import { MessageSquare } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { useRightPane } from '../context/RightPaneContext';
import type { Contact, Conversation } from '../types';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'icon';
type ButtonSize = 'sm' | 'md' | 'lg';

interface MessageButtonProps {
  contact?: Contact;
  conversation?: Conversation;
  prefilledMessage?: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  label?: string;
  className?: string;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary: 'bg-blue-600 text-white hover:bg-blue-700',
  secondary: 'bg-gray-100 text-gray-700 hover:bg-gray-200',
  ghost: 'text-blue-600 hover:bg-blue-50',
  icon: 'p-2 text-gray-400 hover:text-blue-600 hover:bg-gray-100 rounded-lg',
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'px-2.5 py-1.5 text-sm',
  md: 'px-3 py-2 text-sm',
  lg: 'px-4 py-2.5 text-base',
};

export function MessageButton({
  contact,
  conversation,
  prefilledMessage,
  variant = 'secondary',
  size = 'md',
  label = 'Message',
  className,
}: MessageButtonProps) {
  const { open } = useRightPane();

  const handleClick = () => {
    open({
      contact,
      conversation,
      prefilledMessage,
    });
  };

  // Icon-only variant
  if (variant === 'icon') {
    return (
      <button
        onClick={handleClick}
        className={cn(variantStyles.icon, className)}
        title={`Message ${contact?.display_name || 'contact'}`}
      >
        <MessageSquare className="w-4 h-4" />
      </button>
    );
  }

  return (
    <button
      onClick={handleClick}
      className={cn(
        'inline-flex items-center gap-2 rounded-lg font-medium transition-colors',
        variantStyles[variant],
        sizeStyles[size],
        className
      )}
    >
      <MessageSquare className="w-4 h-4" />
      {label}
    </button>
  );
}

export default MessageButton;
