import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import type { Contact, Conversation } from '../types';

export interface PeekMessage {
  id: string;
  senderName: string;
  preview: string;
  type: 'sms' | 'team_chat' | 'ticket_chat' | 'team_announcement' | 'system_notification';
  timestamp: string;
}

interface RightPaneState {
  isOpen: boolean;
  isMinimized: boolean;
  selectedContact: Contact | null;
  selectedConversation: Conversation | null;
  prefilledMessage: string;
  peekMessage: PeekMessage | null;
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
  showPeek: (message: PeekMessage) => void;
  dismissPeek: () => void;
}

const RightPaneContext = createContext<RightPaneContextValue | null>(null);

const initialState: RightPaneState = {
  isOpen: false,
  isMinimized: false,
  selectedContact: null,
  selectedConversation: null,
  prefilledMessage: '',
  peekMessage: null,
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

  // Peek auto-dismiss timer
  const peekTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dismissPeek = useCallback(() => {
    if (peekTimerRef.current) {
      clearTimeout(peekTimerRef.current);
      peekTimerRef.current = null;
    }
    setState(prev => ({ ...prev, peekMessage: null }));
  }, []);

  const showPeek = useCallback((message: PeekMessage) => {
    // Don't show peek if pane is already open
    setState(prev => {
      if (prev.isOpen) return prev;
      return { ...prev, peekMessage: message };
    });
    // Auto-dismiss after 6 seconds
    if (peekTimerRef.current) clearTimeout(peekTimerRef.current);
    peekTimerRef.current = setTimeout(() => {
      setState(prev => ({ ...prev, peekMessage: null }));
      peekTimerRef.current = null;
    }, 6000);
  }, []);

  // Clear peek when pane opens
  useEffect(() => {
    if (state.isOpen && state.peekMessage) {
      dismissPeek();
    }
  }, [state.isOpen, state.peekMessage, dismissPeek]);

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
        showPeek,
        dismissPeek,
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
