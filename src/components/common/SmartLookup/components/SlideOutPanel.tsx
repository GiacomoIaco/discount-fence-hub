import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { cn } from '../../../../lib/utils';

interface SlideOutPanelProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  width?: 'sm' | 'md' | 'lg';  // 320px, 400px, 480px
}

const widthClasses = {
  sm: 'w-80',    // 320px
  md: 'w-[400px]',
  lg: 'w-[480px]',
};

export function SlideOutPanel({
  isOpen,
  onClose,
  title,
  children,
  width = 'md',
}: SlideOutPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  // Prevent body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Focus trap - focus first input when opened
  useEffect(() => {
    if (isOpen && panelRef.current) {
      const firstInput = panelRef.current.querySelector('input, textarea, select');
      if (firstInput) {
        (firstInput as HTMLElement).focus();
      }
    }
  }, [isOpen]);

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          'fixed inset-0 bg-black/30 transition-opacity duration-300 z-40',
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        )}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="slide-out-title"
        className={cn(
          'fixed top-0 right-0 h-full bg-white shadow-xl z-50',
          'transform transition-transform duration-300 ease-in-out',
          'flex flex-col',
          widthClasses[width],
          'max-w-[90vw]',
          isOpen ? 'translate-x-0' : 'translate-x-full'
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 id="slide-out-title" className="text-lg font-semibold text-gray-900">
            {title}
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Close panel"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {children}
        </div>
      </div>
    </>
  );
}
