import { Star, Heart, Flag, X, ChevronLeft, ChevronRight } from 'lucide-react';
import type { Photo } from '../../../lib/photos';

interface PhotoDetailModalProps {
  photo: Photo | null;
  viewMode: 'mobile' | 'desktop';
  sessionId: string;
  onClose: () => void;
  onToggleFavorite: (photo: Photo) => void;
  onToggleLike: (photo: Photo) => void;
  onToggleClientSelection: (photo: Photo) => void;
  onNavigate: (direction: 'prev' | 'next') => void;
  isSelectedInSession: (photo: Photo, sessionId: string) => boolean;
  onTouchStart?: (e: React.TouchEvent) => void;
  onTouchMove?: (e: React.TouchEvent) => void;
  onTouchEnd?: (e: React.TouchEvent) => void;
}

export function PhotoDetailModal({
  photo,
  viewMode,
  sessionId,
  onClose,
  onToggleFavorite,
  onToggleLike,
  onToggleClientSelection,
  onNavigate,
  isSelectedInSession,
  onTouchStart,
  onTouchMove,
  onTouchEnd,
}: PhotoDetailModalProps) {
  if (!photo) return null;

  return (
    <div
      className="fixed inset-0 bg-black z-40"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {/* Top Controls */}
      <div className="absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-black/60 to-transparent z-10 flex justify-between items-start">
        <button
          onClick={() => onToggleFavorite(photo)}
          className="p-2 rounded-full bg-white/20 backdrop-blur-sm"
        >
          <Star
            className={`w-6 h-6 ${photo.isFavorite ? 'fill-yellow-400 text-yellow-400' : 'text-white'}`}
          />
        </button>

        <div className="flex space-x-3">
          <button
            onClick={() => onToggleLike(photo)}
            className="p-2 rounded-full bg-white/20 backdrop-blur-sm flex items-center space-x-2"
          >
            <Heart className={`w-6 h-6 ${photo.likes > 0 ? 'fill-red-600 text-red-600' : 'text-white'}`} />
            {photo.likes > 0 && <span className="text-white font-semibold">{photo.likes}</span>}
          </button>

          <button
            onClick={() => onToggleClientSelection(photo)}
            className="p-2 rounded-full bg-white/20 backdrop-blur-sm"
          >
            <Flag
              className={`w-6 h-6 ${
                isSelectedInSession(photo, sessionId) ? 'fill-blue-400 text-blue-400' : 'text-white'
              }`}
            />
          </button>

          <button onClick={onClose} className="p-2 rounded-full bg-white/20 backdrop-blur-sm">
            <X className="w-6 h-6 text-white" />
          </button>
        </div>
      </div>

      {/* Photo */}
      <div className="absolute inset-0 flex items-center justify-center">
        <img src={photo.url} alt="Full screen" className="max-w-full max-h-full object-contain" />
      </div>

      {/* Navigation Arrows - Desktop only (mobile uses swipe gestures) */}
      {viewMode === 'desktop' && (
        <>
          <button
            onClick={() => onNavigate('prev')}
            className="absolute left-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-white/20 backdrop-blur-sm"
          >
            <ChevronLeft className="w-6 h-6 text-white" />
          </button>

          <button
            onClick={() => onNavigate('next')}
            className="absolute right-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-white/20 backdrop-blur-sm"
          >
            <ChevronRight className="w-6 h-6 text-white" />
          </button>
        </>
      )}

      {/* Bottom Info */}
      <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/60 to-transparent">
        {photo.tags.length > 0 && (
          <div className="flex flex-wrap gap-2 justify-center">
            {photo.tags.map((tag) => (
              <span key={tag} className="px-3 py-1 bg-white/20 backdrop-blur-sm rounded-full text-white text-sm">
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
