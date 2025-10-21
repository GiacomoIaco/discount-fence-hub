import { X, Sparkles, CheckCircle, XCircle, Loader } from 'lucide-react';
import type { EnhancementQueueState } from '../types/enhancement';

interface EnhancementProgressModalProps {
  show: boolean;
  queueState: EnhancementQueueState;
  onClose: () => void;
  onCancel: () => void;
  onPublishAll?: () => void;
}

export function EnhancementProgressModal({
  show,
  queueState,
  onClose,
  onCancel,
  onPublishAll,
}: EnhancementProgressModalProps) {
  if (!show) return null;

  const { items, currentIndex, isProcessing, totalCount, completedCount, errorCount } = queueState;
  const canClose = !isProcessing;
  const canPublish = completedCount === totalCount && errorCount === 0;
  const progressPercent = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'complete':
        return <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />;
      case 'error':
        return <XCircle className="w-5 h-5 text-red-600 flex-shrink-0" />;
      case 'enhancing':
        return <Loader className="w-5 h-5 text-blue-600 animate-spin flex-shrink-0" />;
      default:
        return <div className="w-5 h-5 rounded-full border-2 border-gray-300 flex-shrink-0" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'enhancing':
        return 'Enhancing...';
      case 'complete':
        return 'Complete';
      case 'error':
        return 'Failed';
      default:
        return 'Pending';
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="bg-purple-100 p-2 rounded-lg">
                <Sparkles className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">Enhancing Photos</h2>
                <p className="text-sm text-gray-600">
                  {isProcessing
                    ? `Processing ${currentIndex + 1} of ${totalCount}...`
                    : completedCount === totalCount
                    ? 'All photos enhanced!'
                    : `${completedCount} of ${totalCount} complete`}
                </p>
              </div>
            </div>
            <button
              onClick={canClose ? onClose : undefined}
              disabled={!canClose}
              className="text-gray-400 hover:text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Progress Bar */}
          <div className="mt-4">
            <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
              <span>{Math.round(progressPercent)}% complete</span>
              <span>
                {completedCount} / {totalCount}
                {errorCount > 0 && <span className="text-red-600 ml-2">({errorCount} errors)</span>}
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
              <div
                className="bg-gradient-to-r from-purple-600 to-blue-600 h-full transition-all duration-500 ease-out"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        </div>

        {/* Photo List */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-2">
            {items.map((item, index) => (
              <div
                key={item.photoId}
                className={`flex items-center justify-between p-3 rounded-lg transition-colors ${
                  index === currentIndex && isProcessing
                    ? 'bg-blue-50 border border-blue-200'
                    : 'bg-gray-50'
                }`}
              >
                <div className="flex items-center space-x-3 flex-1 min-w-0">
                  {getStatusIcon(item.status)}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{item.fileName}</p>
                    {item.error && <p className="text-xs text-red-600 truncate">{item.error}</p>}
                    {item.status === 'enhancing' && (
                      <p className="text-xs text-blue-600">AI is enhancing this photo...</p>
                    )}
                  </div>
                </div>
                <span
                  className={`text-xs font-medium ml-3 ${
                    item.status === 'complete'
                      ? 'text-green-600'
                      : item.status === 'error'
                      ? 'text-red-600'
                      : item.status === 'enhancing'
                      ? 'text-blue-600'
                      : 'text-gray-500'
                  }`}
                >
                  {getStatusText(item.status)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-6 border-t border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between space-x-3">
            {isProcessing ? (
              <>
                <div className="flex-1 bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <p className="text-sm text-blue-800">
                    <strong>Tip:</strong> Keep this window open. You can continue reviewing other photos
                    in the background.
                  </p>
                </div>
                <button
                  onClick={onCancel}
                  className="px-6 py-3 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 whitespace-nowrap"
                >
                  Cancel Remaining
                </button>
              </>
            ) : completedCount === totalCount ? (
              <>
                <div className="flex-1">
                  {errorCount > 0 ? (
                    <p className="text-sm text-orange-600">
                      {completedCount - errorCount} photos enhanced successfully. {errorCount} failed.
                    </p>
                  ) : (
                    <p className="text-sm text-green-600 font-medium">
                      ✓ All photos enhanced successfully!
                    </p>
                  )}
                </div>
                <div className="flex space-x-3">
                  <button
                    onClick={onClose}
                    className="px-6 py-3 bg-gray-600 text-white rounded-lg font-semibold hover:bg-gray-700"
                  >
                    Close
                  </button>
                  {onPublishAll && canPublish && (
                    <button
                      onClick={onPublishAll}
                      className="px-6 py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 flex items-center space-x-2"
                    >
                      <CheckCircle className="w-5 h-5" />
                      <span>Publish All</span>
                    </button>
                  )}
                </div>
              </>
            ) : (
              <div className="w-full">
                <p className="text-sm text-gray-600">Enhancement stopped. Some photos may not be processed.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
