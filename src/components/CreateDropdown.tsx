import { useState, useRef, useEffect } from 'react';
import {
  Plus,
  ClipboardList,
  FileText,
  Hammer,
  Receipt,
  ChevronDown,
} from 'lucide-react';

interface CreateOption {
  id: string;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  enabled: boolean;
}

const getCreateOptions = (hasQuoteHandler: boolean): CreateOption[] => [
  {
    id: 'request',
    label: 'New Request',
    description: 'Create a service request',
    icon: ClipboardList,
    enabled: true,
  },
  {
    id: 'quote',
    label: 'New Quote',
    description: 'Create a quote for a customer',
    icon: FileText,
    enabled: hasQuoteHandler,
  },
  {
    id: 'job',
    label: 'New Job',
    description: 'Schedule a work order',
    icon: Hammer,
    enabled: false, // Coming soon
  },
  {
    id: 'invoice',
    label: 'New Invoice',
    description: 'Create an invoice',
    icon: Receipt,
    enabled: false, // Coming soon
  },
];

interface CreateDropdownProps {
  sidebarOpen: boolean;
  onCreateRequest: () => void;
  onCreateQuote?: () => void;
}

export default function CreateDropdown({ sidebarOpen, onCreateRequest, onCreateQuote }: CreateDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const createOptions = getCreateOptions(!!onCreateQuote);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (optionId: string) => {
    setIsOpen(false);
    if (optionId === 'request') {
      onCreateRequest();
    } else if (optionId === 'quote' && onCreateQuote) {
      onCreateQuote();
    }
    // Other options coming soon
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-center gap-2 px-3 py-2.5 bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-white rounded-lg font-medium transition-all shadow-lg shadow-teal-500/25 ${
          sidebarOpen ? '' : 'px-2'
        }`}
      >
        <Plus className="w-5 h-5" />
        {sidebarOpen && (
          <>
            <span>Create</span>
            <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
          </>
        )}
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className={`absolute z-50 mt-2 bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden ${
          sidebarOpen ? 'left-0 right-0' : 'left-0 w-64'
        }`}>
          <div className="p-2">
            {createOptions.map((option) => {
              const Icon = option.icon;
              return (
                <button
                  key={option.id}
                  onClick={() => option.enabled && handleSelect(option.id)}
                  disabled={!option.enabled}
                  className={`w-full flex items-start gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${
                    option.enabled
                      ? 'hover:bg-gray-50 text-gray-900'
                      : 'text-gray-400 cursor-not-allowed'
                  }`}
                >
                  <div className={`p-2 rounded-lg ${
                    option.enabled ? 'bg-teal-50 text-teal-600' : 'bg-gray-100 text-gray-400'
                  }`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{option.label}</span>
                      {!option.enabled && (
                        <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">
                          Soon
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">{option.description}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
