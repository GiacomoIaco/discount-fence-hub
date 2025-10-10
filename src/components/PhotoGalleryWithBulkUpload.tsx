import { useState } from 'react';
import { Upload, ArrowLeft } from 'lucide-react';
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

  // Show bulk upload screen
  if (showBulkUpload) {
    return <BulkPhotoUpload onBack={() => setShowBulkUpload(false)} />;
  }

  // Show gallery with bulk upload button in header
  return (
    <div>
      {/* Custom Header with Bulk Upload Button */}
      {(userRole === 'admin' || userRole === 'sales-manager') && (
        <div className="bg-white border-b border-gray-200 p-4">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <button
              onClick={onBack}
              className="flex items-center space-x-2 text-blue-600 hover:text-blue-700 font-medium"
            >
              <ArrowLeft className="w-5 h-5" />
              <span>Back</span>
            </button>

            <button
              onClick={() => setShowBulkUpload(true)}
              className="flex items-center space-x-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
            >
              <Upload className="w-5 h-5" />
              <span>Bulk Upload</span>
            </button>
          </div>
        </div>
      )}

      <PhotoGallery
        onBack={!showBulkUpload && (userRole === 'admin' || userRole === 'sales-manager') ? undefined : onBack}
        userRole={userRole}
        viewMode={viewMode}
        userId={userId}
        userName={userName}
      />
    </div>
  );
};

export default PhotoGalleryWithBulkUpload;
