import { X } from 'lucide-react';

interface KeyboardShortcutsHelpProps {
  onClose: () => void;
}

const shortcuts = [
  { key: 'n', description: 'Add new task in first section' },
  { key: 'f  /', description: 'Focus search input' },
  { key: 'm', description: 'Toggle @Me filter' },
  { key: '1', description: 'Filter: To Do' },
  { key: '2', description: 'Filter: In Progress' },
  { key: '3', description: 'Filter: Done' },
  { key: '4', description: 'Filter: Blocked' },
  { key: 'Esc', description: 'Clear filters / close modal' },
  { key: '?', description: 'Show this help' },
];

export default function KeyboardShortcutsHelp({ onClose }: KeyboardShortcutsHelpProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-sm mx-4 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Keyboard Shortcuts</h2>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5 space-y-2">
          {shortcuts.map(({ key, description }) => (
            <div key={key} className="flex items-center justify-between py-1.5">
              <span className="text-sm text-gray-600">{description}</span>
              <div className="flex items-center gap-1">
                {key.split('  ').map((k, i) => (
                  <span key={i} className="flex items-center gap-1">
                    {i > 0 && <span className="text-xs text-gray-400 mx-1">or</span>}
                    <kbd className="px-2 py-1 text-xs font-mono font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md shadow-sm">
                      {k}
                    </kbd>
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="px-5 py-3 bg-gray-50 border-t border-gray-200">
          <p className="text-xs text-gray-500 text-center">
            Shortcuts are disabled when typing in inputs
          </p>
        </div>
      </div>
    </div>
  );
}
