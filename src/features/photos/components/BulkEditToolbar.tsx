import { Sparkles } from 'lucide-react';

interface BulkEditToolbarProps {
  show: boolean;
  viewMode: 'mobile' | 'desktop';
  activeTab: 'gallery' | 'pending' | 'saved' | 'archived' | 'flagged';
  userRole: 'sales' | 'operations' | 'sales-manager' | 'admin';
  selectedCount: number;
  isEnhancing: boolean;
  onSelectAll: () => void;
  onSelectAIRecommended: () => void;
  onDeselectAll: () => void;
  onBulkStatusChange: (status: 'published' | 'saved' | 'archived') => void;
  onBulkEnhance: () => void;
  onBulkDelete: () => void;
}

export function BulkEditToolbar({
  show,
  viewMode,
  activeTab,
  userRole,
  selectedCount,
  isEnhancing,
  onSelectAll,
  onSelectAIRecommended,
  onDeselectAll,
  onBulkStatusChange,
  onBulkEnhance,
  onBulkDelete,
}: BulkEditToolbarProps) {
  if (!show) return null;

  return (
    <div
      className={`fixed bottom-0 p-4 bg-white border-t-2 border-gray-300 shadow-lg z-40 ${
        viewMode === 'desktop' ? 'left-64 right-0' : 'left-0 right-0'
      }`}
    >
      <div className="max-w-7xl mx-auto">
        {/* Selection count and select all/deselect all */}
        <div className="flex items-center justify-between mb-3">
          <span className="font-semibold text-gray-700">
            {selectedCount} photo{selectedCount !== 1 ? 's' : ''} selected
          </span>
          <div className="flex space-x-2">
            <button onClick={onSelectAll} className="text-sm text-blue-600 hover:text-blue-700 font-medium">
              Select All
            </button>
            <span className="text-gray-400">|</span>
            {activeTab === 'pending' && (
              <>
                <button
                  onClick={onSelectAIRecommended}
                  className="text-sm text-green-600 hover:text-green-700 font-medium flex items-center space-x-1"
                >
                  <Sparkles className="w-3 h-3" />
                  <span>AI Recommended</span>
                </button>
                <span className="text-gray-400">|</span>
              </>
            )}
            <button onClick={onDeselectAll} className="text-sm text-blue-600 hover:text-blue-700 font-medium">
              Deselect All
            </button>
          </div>
        </div>

        {/* Bulk action buttons */}
        <div className="flex flex-wrap gap-2">
          {/* Move to Published (not shown when already in Gallery tab) */}
          {activeTab !== 'gallery' && (
            <button
              onClick={() => onBulkStatusChange('published')}
              disabled={selectedCount === 0}
              className="px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex-1"
            >
              Move to Published
            </button>
          )}

          {/* Move to Saved (not shown when already in Saved tab) */}
          {activeTab !== 'saved' && (
            <button
              onClick={() => onBulkStatusChange('saved')}
              disabled={selectedCount === 0}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex-1"
            >
              Move to Saved
            </button>
          )}

          {/* Move to Archived (not shown when already in Archived tab) */}
          {activeTab !== 'archived' && (
            <button
              onClick={() => onBulkStatusChange('archived')}
              disabled={selectedCount === 0}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg font-medium hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed flex-1"
            >
              Move to Archived
            </button>
          )}

          {/* Enhance Selected (Admin only) */}
          {userRole === 'admin' && (
            <button
              onClick={onBulkEnhance}
              disabled={selectedCount === 0 || isEnhancing}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex-1 flex items-center justify-center space-x-2"
            >
              <Sparkles className="w-4 h-4" />
              <span>{isEnhancing ? 'Enhancing...' : 'Enhance Selected'}</span>
            </button>
          )}

          {/* Delete (Admin only, not shown on Gallery tab) */}
          {userRole === 'admin' && activeTab !== 'gallery' && (
            <button
              onClick={onBulkDelete}
              disabled={selectedCount === 0}
              className="px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex-1"
            >
              Delete Permanently
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
