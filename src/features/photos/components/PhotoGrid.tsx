import { Star, Heart, Check, Trash2, Sparkles, Flag, ImageIcon } from 'lucide-react';
import type { Photo } from '../../../lib/photos';

interface PhotoGridProps {
  photos: Photo[];
  viewMode: 'mobile' | 'desktop';
  activeTab: 'gallery' | 'pending' | 'saved' | 'archived' | 'flagged';
  editMode: boolean;
  selectedPhotoIds: Set<string>;
  photoFlags: Map<string, any[]>;
  activeFilterCount: number;
  onPhotoClick: (photo: Photo, index: number) => void;
  onToggleSelection: (photoId: string) => void;
  onDeletePhoto: (photo: Photo, e: React.MouseEvent) => void;
  onOpenFlagModal: (photo: Photo) => void;
  onViewFlags: (photo: Photo, flags: any[]) => void;
}

export function PhotoGrid({
  photos,
  viewMode,
  activeTab,
  editMode,
  selectedPhotoIds,
  photoFlags,
  activeFilterCount,
  onPhotoClick,
  onToggleSelection,
  onDeletePhoto,
  onOpenFlagModal,
  onViewFlags,
}: PhotoGridProps) {
  if (photos.length === 0) {
    return (
      <div className="text-center py-16">
        <ImageIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
        <p className="text-gray-500 font-medium">No photos yet</p>
        <p className="text-sm text-gray-400 mt-1">
          {activeFilterCount > 0 ? 'Try adjusting your filters' : 'Tap + to add photos'}
        </p>
      </div>
    );
  }

  return (
    <div className={`grid gap-3 ${viewMode === 'mobile' ? 'grid-cols-2' : 'grid-cols-3 md:grid-cols-4'}`}>
      {photos.map((photo, index) => (
        <div
          key={photo.id}
          className="relative aspect-square rounded-lg overflow-hidden cursor-pointer group"
          onClick={() => {
            if (editMode) {
              onToggleSelection(photo.id);
            } else if (activeTab === 'flagged' && photoFlags.has(photo.id)) {
              onViewFlags(photo, photoFlags.get(photo.id) || []);
            } else {
              onPhotoClick(photo, index);
            }
          }}
        >
          <img
            src={photo.thumbnailUrl || photo.url}
            alt="Gallery"
            className={`w-full h-full object-cover transition-opacity ${
              editMode && selectedPhotoIds.has(photo.id) ? 'opacity-60' : ''
            }`}
          />

          {/* Checkbox for edit mode */}
          {editMode && (
            <div className="absolute top-2 left-2">
              <div
                className={`w-6 h-6 rounded border-2 flex items-center justify-center transition-colors ${
                  selectedPhotoIds.has(photo.id)
                    ? 'bg-blue-600 border-blue-600'
                    : 'bg-white border-gray-400'
                }`}
              >
                {selectedPhotoIds.has(photo.id) && <Check className="w-4 h-4 text-white" />}
              </div>
            </div>
          )}

          {/* Favorite star (only show when not in edit mode) */}
          {!editMode && photo.isFavorite && (
            <div className="absolute top-2 left-2">
              <Star className="w-5 h-5 fill-yellow-400 text-yellow-400" />
            </div>
          )}

          {/* Like count */}
          {photo.likes > 0 && (
            <div className="absolute top-2 right-2 bg-white/90 rounded-full px-2 py-1 text-xs font-semibold text-red-600 flex items-center space-x-1">
              <Heart className="w-3 h-3 fill-red-600" />
              <span>{photo.likes}</span>
            </div>
          )}

          {/* Confidence Score Badge (only in pending tab with confidence score) */}
          {!editMode && activeTab === 'pending' && photo.confidenceScore !== undefined && (
            <div className="absolute top-2 left-2">
              <div
                className={`text-white text-xs px-2 py-1 rounded font-bold flex items-center space-x-1 ${
                  photo.confidenceScore >= 80
                    ? 'bg-green-600'
                    : photo.confidenceScore >= 60
                    ? 'bg-yellow-600'
                    : 'bg-red-600'
                }`}
              >
                <Sparkles className="w-3 h-3" />
                <span>{photo.confidenceScore}%</span>
              </div>
            </div>
          )}

          {/* Pending badge and delete button (only show when not in edit mode) */}
          {!editMode && photo.status === 'pending' && (
            <>
              <div className="absolute bottom-2 left-2 flex flex-col gap-1">
                {photo.reviewNotes && (
                  <div className="bg-blue-600 text-white text-xs px-2 py-1 rounded font-semibold">
                    DRAFT
                  </div>
                )}
                <div className="bg-orange-500 text-white text-xs px-2 py-1 rounded">
                  Pending Review
                </div>
              </div>
              <button
                onClick={(e) => onDeletePhoto(photo, e)}
                className="absolute bottom-2 right-2 bg-red-600 text-white p-2 rounded-full shadow-lg active:scale-95 transition-transform"
                title="Delete photo"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </>
          )}

          {/* Flag badge (show on flagged tab) */}
          {!editMode && activeTab === 'flagged' && photoFlags.has(photo.id) && (
            <div className="absolute top-2 left-2">
              <div className="bg-orange-600 text-white text-xs px-2 py-1 rounded font-bold flex items-center space-x-1">
                <Flag className="w-3 h-3" />
                <span>{photoFlags.get(photo.id)?.length || 0} flag(s)</span>
              </div>
            </div>
          )}

          {/* Flag button for published photos (only show when not in edit mode and NOT on flagged tab) */}
          {!editMode && photo.status === 'published' && activeTab !== 'flagged' && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onOpenFlagModal(photo);
              }}
              className="absolute bottom-2 right-2 bg-orange-600 text-white p-2 rounded-full shadow-lg active:scale-95 transition-transform opacity-0 group-hover:opacity-100"
              title="Flag for review"
            >
              <Flag className="w-4 h-4" />
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
