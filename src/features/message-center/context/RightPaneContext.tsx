import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import type { Contact, Conversation } from '../types';

interface RightPaneState {
  isOpen: boolean;
  isMinimized: boolean;
  selectedContact: Contact | null;
  selectedConversation: Conversation | null;
  prefilledMessage: string;
}

interface OpenOptions {
  contact?: Contact;
  conversation?: Conversation;
  prefilledMessage?: string;
}

interface RightPaneContextValue extends RightPaneState {
  open: (options?: OpenOptions) => void;
  close: () => void;
  minimize: () => void;
  toggle: () => void;
  setContact: (contact: Contact | null) => void;
  setConversation: (conversation: Conversation | null) => void;
  setPrefilledMessage: (message: string) => void;
  reset: () => void;
}

const RightPaneContext = createContext<RightPaneContextValue | null>(null);

const initialState: RightPaneState = {
  isOpen: false,
  isMinimized: false,
  selectedContact: null,
  selectedConversation: null,
  prefilledMessage: '',
};

export function RightPaneProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<RightPaneState>(initialState);

  // Keyboard shortcut: Ctrl/Cmd + M
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'm') {
        e.preventDefault();
        setState(prev => ({ ...prev, isOpen: !prev.isOpen, isMinimized: false }));
      }
      // Escape to close
      if (e.key === 'Escape' && state.isOpen) {
        setState(prev => ({ ...prev, isOpen: false }));
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [state.isOpen]);

  const open = useCallback((options?: OpenOptions) => {
    setState(prev => ({
      ...prev,
      isOpen: true,
      isMinimized: false,
      selectedContact: options?.contact ?? prev.selectedContact,
      selectedConversation: options?.conversation ?? prev.selectedConversation,
      prefilledMessage: options?.prefilledMessage ?? '',
    }));
  }, []);

  const close = useCallback(() => {
    setState(prev => ({ ...prev, isOpen: false }));
  }, []);

  const minimize = useCallback(() => {
    // Toggle minimized state - if already minimized, restore it
    setState(prev => ({ ...prev, isMinimized: !prev.isMinimized }));
  }, []);

  const toggle = useCallback(() => {
    setState(prev => ({
      ...prev,
      isOpen: !prev.isOpen,
      isMinimized: false,
    }));
  }, []);

  const setContact = useCallback((contact: Contact | null) => {
    setState(prev => ({ ...prev, selectedContact: contact }));
  }, []);

  const setConversation = useCallback((conversation: Conversation | null) => {
    setState(prev => ({ ...prev, selectedConversation: conversation }));
  }, []);

  const setPrefilledMessage = useCallback((message: string) => {
    setState(prev => ({ ...prev, prefilledMessage: message }));
  }, []);

  const reset = useCallback(() => {
    setState(initialState);
  }, []);

  return (
    <RightPaneContext.Provider
      value={{
        ...state,
        open,
        close,
        minimize,
        toggle,
        setContact,
        setConversation,
        setPrefilledMessage,
        reset,
      }}
    >
      {children}
    </RightPaneContext.Provider>
  );
}

export function useRightPane() {
  const context = useContext(RightPaneContext);
  if (!context) {
    throw new Error('useRightPane must be used within a RightPaneProvider');
  }
  return context;
}
