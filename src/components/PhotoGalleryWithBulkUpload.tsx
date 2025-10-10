import { useState } from 'react';
import { Upload } from 'lucide-react';
import PhotoGallery from './PhotoGallery';
import BulkPhotoUpload from './BulkPhotoUpload';

interface PhotoGalleryWithBulkUploadProps {
  onBack: () => void;
  userRole: 'sales' | 'operations' | 'sales-manager' | 'admin';
  viewMode: 'mobile' | 'desktop';
  userId?: string;
  userName?: string;
}

const PhotoGalleryWithBulkUpload = ({ onBack, userRole, viewMode, userId, userName }: PhotoGalleryWithBulkUploadProps) => {
  const [showBulkUpload, setShowBulkUpload] = useState(false);

  if (showBulkUpload) {
    return <BulkPhotoUpload onBack={() => setShowBulkUpload(false)} />;
  }

  return (
    <div className="relative">
      {/* Floating Bulk Upload Button - Admin/Sales Manager only */}
      {(userRole === 'admin' || userRole === 'sales-manager') && (
        <button
          onClick={() => setShowBulkUpload(true)}
          className="fixed bottom-8 right-8 w-16 h-16 bg-purple-600 hover:bg-purple-700 text-white rounded-full shadow-lg flex items-center justify-center transition-all hover:scale-110 z-40"
          title="Bulk Upload Photos"
        >
          <Upload className="w-6 h-6" />
        </button>
      )}

      <PhotoGallery
        onBack={onBack}
        userRole={userRole}
        viewMode={viewMode}
        userId={userId}
        userName={userName}
      />
    </div>
  );
};

export default PhotoGalleryWithBulkUpload;
