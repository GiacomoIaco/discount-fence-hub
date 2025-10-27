import { X } from 'lucide-react';
import type { Photo } from '../lib/photos';

interface PhotoFlagModalProps {
  show: boolean;
  photo: Photo | null;
  flagReason: 'wrong_tags' | 'poor_quality' | 'needs_enhancement' | 'other';
  flagNotes: string;
  flagSuggestedTags: string[];
  allTags: {
    productType: string[];
    material: string[];
    style: string[];
  };
  onClose: () => void;
  onSetReason: (reason: 'wrong_tags' | 'poor_quality' | 'needs_enhancement' | 'other') => void;
  onSetNotes: (notes: string) => void;
  onSetSuggestedTags: (tags: string[]) => void;
  onSubmit: () => void;
}

export function PhotoFlagModal({
  show,
  photo,
  flagReason,
  flagNotes,
  flagSuggestedTags,
  allTags,
  onClose,
  onSetReason,
  onSetNotes,
  onSetSuggestedTags,
  onSubmit,
}: PhotoFlagModalProps) {
  if (!show || !photo) return null;

  const allAvailableTags = [
    ...allTags.productType,
    ...allTags.material,
    ...allTags.style,
  ];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-md w-full p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">Flag Photo for Review</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="mb-4">
          <img
            src={photo.thumbnailUrl || photo.url}
            alt="Flagging"
            className="w-full h-48 object-cover rounded-lg"
          />
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Reason for Flag
            </label>
            <select
              value={flagReason}
              onChange={(e) => onSetReason(e.target.value as any)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="wrong_tags">Wrong Tags</option>
              <option value="poor_quality">Poor Quality</option>
              <option value="needs_enhancement">Needs Enhancement</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notes (Optional)
            </label>
            <textarea
              value={flagNotes}
              onChange={(e) => onSetNotes(e.target.value)}
              placeholder="Describe the issue..."
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {flagReason === 'wrong_tags' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Suggested Tags (Optional)
              </label>
              <div className="flex flex-wrap gap-2 mb-2">
                {flagSuggestedTags.map((tag) => (
                  <span
                    key={tag}
                    className="bg-blue-100 text-blue-800 px-2 py-1 rounded-lg text-sm flex items-center space-x-1"
                  >
                    <span>{tag}</span>
                    <button
                      onClick={() => onSetSuggestedTags(flagSuggestedTags.filter((t) => t !== tag))}
                      className="text-blue-600 hover:text-blue-800"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
              <select
                onChange={(e) => {
                  if (e.target.value && !flagSuggestedTags.includes(e.target.value)) {
                    onSetSuggestedTags([...flagSuggestedTags, e.target.value]);
                  }
                  e.target.value = '';
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Add suggested tag...</option>
                {allAvailableTags.map((tag) => (
                  <option key={tag} value={tag}>
                    {tag}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="flex space-x-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={onSubmit}
              className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-lg font-medium hover:bg-orange-700"
            >
              Submit Flag
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
