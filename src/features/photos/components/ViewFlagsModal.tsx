import { X } from 'lucide-react';
import type { Photo } from '../lib/photos';
import { usePermission } from '../../../contexts/PermissionContext';

interface PhotoFlag {
  id: string;
  photo_id: string;
  flag_reason: string;
  notes?: string;
  suggested_tags?: string[];
  flagged_by: string;
  flagged_by_name: string;
  created_at: string;
  status: 'pending' | 'resolved';
}

interface ViewFlagsModalProps {
  show: boolean;
  photo: Photo | null;
  flags: PhotoFlag[];
  onClose: () => void;
  onResolveFlag: (flagId: string) => void;
  onDismissFlag: (flagId: string) => void;
  onEditPhoto: (photo: Photo) => void;
}

export function ViewFlagsModal({
  show,
  photo,
  flags,
  onClose,
  onResolveFlag,
  onDismissFlag,
  onEditPhoto,
}: ViewFlagsModalProps) {
  const { hasPermission } = usePermission();

  if (!show || !photo) return null;

  const isManager = hasPermission('manage_team');

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b p-4 flex items-center justify-between">
          <h2 className="text-xl font-bold">Photo Flags</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Photo Preview */}
          <div>
            <img
              src={photo.url}
              alt="Flagged"
              className="w-full h-64 object-cover rounded-lg"
            />
          </div>

          {/* Current Tags */}
          <div>
            <h3 className="font-semibold text-lg mb-2">Current Tags</h3>
            <div className="flex flex-wrap gap-2">
              {photo.tags.map((tag) => (
                <span key={tag} className="bg-gray-200 text-gray-800 px-3 py-1 rounded-lg text-sm">
                  {tag}
                </span>
              ))}
            </div>
            {isManager && (
              <button
                onClick={() => {
                  onClose();
                  onEditPhoto(photo);
                }}
                className="mt-3 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
              >
                Edit Tags
              </button>
            )}
          </div>

          {/* Flags List */}
          <div className="space-y-4">
            <h3 className="font-semibold text-lg">
              Flags ({flags.length})
            </h3>
            {flags.map((flag) => (
              <div key={flag.id} className="border rounded-lg p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="inline-block bg-orange-100 text-orange-800 px-2 py-1 rounded text-sm font-medium">
                      {flag.flag_reason.replace('_', ' ').toUpperCase()}
                    </span>
                    <p className="text-sm text-gray-600 mt-1">
                      Flagged by <span className="font-medium">{flag.flagged_by_name}</span> on{' '}
                      {new Date(flag.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                {flag.notes && (
                  <div>
                    <p className="text-sm font-medium text-gray-700 mb-1">Notes:</p>
                    <p className="text-sm text-gray-600">{flag.notes}</p>
                  </div>
                )}

                {flag.suggested_tags && flag.suggested_tags.length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-gray-700 mb-1">Suggested Tags:</p>
                    <div className="flex flex-wrap gap-2">
                      {flag.suggested_tags.map((tag) => (
                        <span
                          key={tag}
                          className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-sm"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {isManager && (
                  <div className="flex space-x-2 pt-2">
                    <button
                      onClick={() => onResolveFlag(flag.id)}
                      className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700"
                    >
                      ✓ Mark Resolved
                    </button>
                    <button
                      onClick={() => onDismissFlag(flag.id)}
                      className="px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700"
                    >
                      ✕ Dismiss Flag
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
