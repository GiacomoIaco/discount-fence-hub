import { useRef, useState } from 'react';
import {
  ArrowLeft,
  Camera,
  Filter,
  CheckSquare,
  X,
  Settings,
  BarChart3,
  Sparkles,
} from 'lucide-react';
import { isSelectedInSession } from '../../lib/photos';
import PhotoAnalytics from '../../components/PhotoAnalytics';

// Import custom hooks
import {
  usePhotoGallery,
  usePhotoFilters,
  usePhotoUpload,
  usePhotoReview,
  usePhotoEnhance,
  usePhotoActions,
  usePhotoBulkEdit,
  useTagManagement,
} from './hooks';

// Import UI components
import {
  PhotoGrid,
  PhotoFilters,
  PhotoUploadModal,
  PhotoDetailModal,
  PhotoReviewModal,
  BulkEditToolbar,
  TagManagementModal,
} from './components';

interface PhotoGalleryProps {
  onBack: () => void;
  userRole?: 'sales' | 'operations' | 'sales-manager' | 'admin';
  viewMode?: 'mobile' | 'desktop';
  userId?: string;
  userName?: string;
}

export function PhotoGalleryRefactored({
  onBack,
  userRole = 'sales',
  viewMode = 'mobile',
  userId,
  userName,
}: PhotoGalleryProps) {
  // Refs for file inputs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Core gallery state
  const gallery = usePhotoGallery(userRole, viewMode);
  const { activeTab, setActiveTab, photos, setPhotos, currentIndex, setCurrentIndex, sessionId, loadPhotos } =
    gallery;

  // Filtering
  const filters = usePhotoFilters(photos);
  const { showFilters, setShowFilters, filters: filterState, filteredPhotos, toggleFilter, clearFilters, activeFilterCount } = filters;

  // Photo upload
  const upload = usePhotoUpload(userId, userName, (photo) => {
    setPhotos((prev) => [...prev, photo]);
    loadPhotos(); // Reload to get fresh data from server
  });
  const { showUploadModal, setShowUploadModal, uploading, uploadPhotos } = upload;

  // Photo enhancement
  const enhance = usePhotoEnhance();
  const { enhancedUrl, showingEnhanced, isEnhancing, enhancePhoto, resetEnhancement, toggleEnhancedView } = enhance;

  // Photo actions
  const actions = usePhotoActions(sessionId, userId, setPhotos);
  const { toggleFavorite, toggleLike, toggleClientSelection, deletePhoto } = actions;

  // Photo review workflow
  const review = usePhotoReview(userId, loadPhotos, enhancedUrl, showingEnhanced);
  const {
    reviewingPhoto,
    editingTags,
    editingScore,
    setEditingScore,
    reviewNotes,
    setReviewNotes,
    reviewLoading,
    uploaderName,
    openReviewModal,
    closeReviewModal,
    toggleReviewTag,
    handlePublishPhoto,
    handleSaveDraft,
    handleSaveNotPublished,
    handleUpdateSaved,
    handleArchivePhoto,
    handlePermanentDelete,
  } = review;

  // Bulk edit
  const bulkEdit = usePhotoBulkEdit(photos, loadPhotos);
  const {
    editMode,
    setEditMode,
    selectedPhotoIds,
    togglePhotoSelection,
    selectAll,
    deselectAll,
    handleBulkStatusChange,
    handleBulkDelete,
  } = bulkEdit;

  // Tag management (admin)
  const tagManagement = useTagManagement();
  const { showTagManagement, setShowTagManagement, customTags, addCustomTag, deleteCustomTag, getAllTags } =
    tagManagement;

  // Analytics
  const [showAnalytics, setShowAnalytics] = useState(false);

  // Handle file upload
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    await uploadPhotos(e.target.files);
    e.target.value = ''; // Reset input
  };

  const handleUploadClick = () => setShowUploadModal(true);
  const handleTakePhoto = () => {
    cameraInputRef.current?.click();
    setShowUploadModal(false);
  };
  const handleChooseFromLibrary = () => {
    fileInputRef.current?.click();
    setShowUploadModal(false);
  };

  // Full-screen photo viewer
  const openFullScreen = (index: number) => setCurrentIndex(index);
  const closeFullScreen = () => {
    setCurrentIndex(-1);
    resetEnhancement();
  };
  const currentPhoto = currentIndex >= 0 ? filteredPhotos[currentIndex] : null;

  const navigatePhoto = (direction: 'prev' | 'next') => {
    if (direction === 'prev') {
      setCurrentIndex((prev) => (prev > 0 ? prev - 1 : filteredPhotos.length - 1));
    } else {
      setCurrentIndex((prev) => (prev < filteredPhotos.length - 1 ? prev + 1 : 0));
    }
    resetEnhancement();
  };

  // Touch/swipe handling for mobile
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const minSwipeDistance = 50;

  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e: React.TouchEvent) => setTouchEnd(e.targetTouches[0].clientX);

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;
    if (isLeftSwipe) navigatePhoto('next');
    if (isRightSwipe) navigatePhoto('prev');
  };

  // Auto-enhance photo
  const handleAutoEnhance = () => {
    if (reviewingPhoto) {
      enhancePhoto(reviewingPhoto.url);
    }
  };

  // Show analytics
  if (showAnalytics) {
    return <PhotoAnalytics onBack={() => setShowAnalytics(false)} userRole={userRole} />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-20">
        <div className="p-4 flex items-center justify-between">
          <button onClick={onBack} className="text-blue-600 font-medium flex items-center space-x-2">
            <ArrowLeft className="w-5 h-5" />
            <span>Back</span>
          </button>

          <div className="text-center flex-1">
            <h1 className="text-xl font-bold text-gray-900">Photo Gallery</h1>
            <p className="text-xs text-gray-600">
              {filteredPhotos.length} {filteredPhotos.length === 1 ? 'photo' : 'photos'}
            </p>
          </div>

          <div className="w-20"></div>
        </div>

        {/* Tabs (Desktop Only) */}
        {viewMode === 'desktop' && (
          <div className="border-t border-gray-200">
            <div className="flex justify-between items-center p-2">
              <div className="flex space-x-1">
                <button
                  onClick={() => setActiveTab('gallery')}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    activeTab === 'gallery'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Gallery
                </button>
                {(userRole === 'sales-manager' || userRole === 'admin') && (
                  <>
                    <button
                      onClick={() => setActiveTab('pending')}
                      className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                        activeTab === 'pending'
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      Pending Review
                    </button>
                    <button
                      onClick={() => setActiveTab('saved')}
                      className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                        activeTab === 'saved'
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      Saved
                    </button>
                    <button
                      onClick={() => setActiveTab('archived')}
                      className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                        activeTab === 'archived'
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      Archived
                    </button>
                    <button
                      onClick={() => setActiveTab('flagged')}
                      className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                        activeTab === 'flagged'
                          ? 'bg-orange-600 text-white'
                          : 'bg-orange-100 text-orange-700 hover:bg-orange-200'
                      }`}
                    >
                      Flagged
                    </button>
                  </>
                )}
              </div>

              {/* Edit/Select Mode Button */}
              {(userRole === 'sales-manager' || userRole === 'admin') && (
                <button
                  onClick={() => {
                    setEditMode(!editMode);
                    if (editMode) deselectAll();
                  }}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center space-x-2 ${
                    editMode
                      ? 'bg-red-600 text-white hover:bg-red-700'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {editMode ? (
                    <>
                      <X className="w-4 h-4" />
                      <span>Cancel</span>
                    </>
                  ) : (
                    <>
                      <CheckSquare className="w-4 h-4" />
                      <span>Select</span>
                    </>
                  )}
                </button>
              )}

              {/* Analytics Button */}
              {(userRole === 'admin' || userRole === 'sales-manager') && (
                <button
                  onClick={() => setShowAnalytics(true)}
                  className="px-4 py-2 rounded-lg font-medium transition-colors flex items-center space-x-2 bg-purple-100 text-purple-700 hover:bg-purple-200"
                >
                  <BarChart3 className="w-4 h-4" />
                  <span>Analytics</span>
                </button>
              )}

              {/* Manage Tags Button (Admin only) */}
              {userRole === 'admin' && (
                <button
                  onClick={() => setShowTagManagement(true)}
                  className="px-4 py-2 rounded-lg font-medium transition-colors flex items-center space-x-2 bg-gray-100 text-gray-700 hover:bg-gray-200"
                >
                  <Settings className="w-4 h-4" />
                  <span>Manage Tags</span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Gallery Grid */}
      <div className="p-4 pb-24">
        <PhotoGrid
          photos={filteredPhotos}
          viewMode={viewMode}
          activeTab={activeTab}
          editMode={editMode}
          selectedPhotoIds={selectedPhotoIds}
          photoFlags={new Map()} // TODO: Implement photo flags
          activeFilterCount={activeFilterCount}
          onPhotoClick={(photo, index) => {
            if (activeTab === 'pending' && (userRole === 'sales-manager' || userRole === 'admin')) {
              openReviewModal(photo);
            } else {
              openFullScreen(index);
            }
          }}
          onToggleSelection={togglePhotoSelection}
          onDeletePhoto={deletePhoto}
          onOpenFlagModal={() => {}} // TODO: Implement flag modal
          onViewFlags={() => {}} // TODO: Implement view flags
        />
      </div>

      {/* Bulk Action Bar */}
      <BulkEditToolbar
        show={editMode}
        viewMode={viewMode}
        activeTab={activeTab}
        userRole={userRole}
        selectedCount={selectedPhotoIds.size}
        isEnhancing={isEnhancing}
        onSelectAll={selectAll}
        onSelectAIRecommended={() => {}} // TODO: Implement AI recommended selection
        onDeselectAll={deselectAll}
        onBulkStatusChange={handleBulkStatusChange}
        onBulkEnhance={() => {}} // TODO: Implement bulk enhance
        onBulkDelete={handleBulkDelete}
      />

      {/* Floating Action Buttons */}
      {!editMode && (activeTab === 'gallery' || viewMode === 'mobile') && (
        <div
          className={`fixed bottom-4 right-4 pointer-events-none ${
            viewMode === 'desktop' ? 'left-auto' : 'left-4'
          }`}
        >
          <div className="flex justify-between items-center pointer-events-auto">
            <button
              onClick={() => setShowFilters(true)}
              className="relative bg-white border-2 border-blue-600 text-blue-600 p-4 rounded-full shadow-lg active:scale-95 transition-transform"
            >
              <Filter className="w-6 h-6" />
              {activeFilterCount > 0 && (
                <div className="absolute -top-1 -right-1 bg-red-600 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center font-bold">
                  {activeFilterCount}
                </div>
              )}
            </button>

            <button
              onClick={handleUploadClick}
              disabled={uploading}
              className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-5 rounded-full shadow-lg active:scale-95 transition-transform disabled:opacity-50"
            >
              {uploading ? <Sparkles className="w-7 h-7 animate-spin" /> : <Camera className="w-7 h-7" />}
            </button>
          </div>
        </div>
      )}

      {/* Modals */}
      <PhotoUploadModal
        show={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        onTakePhoto={handleTakePhoto}
        onChooseFromLibrary={handleChooseFromLibrary}
      />

      <PhotoFilters
        show={showFilters}
        onClose={() => setShowFilters(false)}
        filters={filterState}
        photos={photos}
        filteredCount={filteredPhotos.length}
        allTags={getAllTags()}
        onToggleFilter={toggleFilter}
        onClearFilters={clearFilters}
      />

      <PhotoDetailModal
        photo={currentPhoto}
        viewMode={viewMode}
        sessionId={sessionId}
        onClose={closeFullScreen}
        onToggleFavorite={toggleFavorite}
        onToggleLike={toggleLike}
        onToggleClientSelection={toggleClientSelection}
        onNavigate={navigatePhoto}
        isSelectedInSession={isSelectedInSession}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      />

      <PhotoReviewModal
        photo={reviewingPhoto}
        activeTab={activeTab}
        userRole={userRole}
        uploaderName={uploaderName}
        editingTags={editingTags}
        editingScore={editingScore}
        reviewNotes={reviewNotes}
        reviewLoading={reviewLoading}
        enhancedUrl={enhancedUrl}
        showingEnhanced={showingEnhanced}
        isEnhancing={isEnhancing}
        allTags={getAllTags()}
        onClose={closeReviewModal}
        onToggleTag={toggleReviewTag}
        onSetScore={setEditingScore}
        onSetNotes={setReviewNotes}
        onPublish={handlePublishPhoto}
        onSaveDraft={handleSaveDraft}
        onSaveNotPublished={handleSaveNotPublished}
        onUpdateSaved={handleUpdateSaved}
        onArchive={handleArchivePhoto}
        onPermanentDelete={handlePermanentDelete}
        onAutoEnhance={handleAutoEnhance}
        onToggleEnhancedView={toggleEnhancedView}
      />

      <TagManagementModal
        show={showTagManagement}
        customTags={customTags}
        onClose={() => setShowTagManagement(false)}
        onAddTag={addCustomTag}
        onDeleteTag={deleteCustomTag}
      />

      {/* Hidden File Inputs */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleFileSelect}
        className="hidden"
      />

      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        onChange={handleFileSelect}
        className="hidden"
      />
    </div>
  );
}
