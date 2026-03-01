import { useEffect, useCallback, useState } from 'react';

interface KeyboardHandlers {
  onNewTask?: () => void;       // 'n' - focus quick-add
  onFocusSearch?: () => void;   // 'f' or '/' - focus search
  onToggleMyTasks?: () => void; // 'm' - toggle @Me filter
  onSetStatus?: (index: number) => void; // '1'-'4' - set status filter
  onEscape?: () => void;        // Escape - clear filters / close modal
  onShowHelp?: () => void;      // '?' - show shortcuts help
}

export function useTodoKeyboard(handlers: KeyboardHandlers) {
  const [showHelp, setShowHelp] = useState(false);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Don't trigger when typing in inputs
    const target = e.target as HTMLElement;
    const tagName = target.tagName.toLowerCase();
    if (tagName === 'input' || tagName === 'textarea' || tagName === 'select' || target.isContentEditable) {
      // Only handle Escape in inputs
      if (e.key === 'Escape') {
        (target as HTMLInputElement).blur();
      }
      return;
    }

    // Don't trigger with modifier keys (except shift for ?)
    if (e.ctrlKey || e.metaKey || e.altKey) return;

    switch (e.key) {
      case 'n':
        e.preventDefault();
        handlers.onNewTask?.();
        break;
      case 'f':
      case '/':
        e.preventDefault();
        handlers.onFocusSearch?.();
        break;
      case 'm':
        e.preventDefault();
        handlers.onToggleMyTasks?.();
        break;
      case '1':
        e.preventDefault();
        handlers.onSetStatus?.(0); // Todo
        break;
      case '2':
        e.preventDefault();
        handlers.onSetStatus?.(1); // In Progress
        break;
      case '3':
        e.preventDefault();
        handlers.onSetStatus?.(2); // Done
        break;
      case '4':
        e.preventDefault();
        handlers.onSetStatus?.(3); // Blocked
        break;
      case 'Escape':
        e.preventDefault();
        if (showHelp) {
          setShowHelp(false);
        } else {
          handlers.onEscape?.();
        }
        break;
      case '?':
        e.preventDefault();
        setShowHelp(prev => !prev);
        break;
    }
  }, [handlers, showHelp]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return { showHelp, setShowHelp };
}
