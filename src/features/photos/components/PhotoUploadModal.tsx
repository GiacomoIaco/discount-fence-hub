import { Camera, Image as ImageIcon, X } from 'lucide-react';

interface PhotoUploadModalProps {
  show: boolean;
  onClose: () => void;
  onTakePhoto: () => void;
  onChooseFromLibrary: () => void;
}

export function PhotoUploadModal({
  show,
  onClose,
  onTakePhoto,
  onChooseFromLibrary,
}: PhotoUploadModalProps) {
  if (!show) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-30 flex items-end">
      <div className="bg-white rounded-t-3xl w-full p-6 space-y-3">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-gray-900">Add Photos</h2>
          <button onClick={onClose}>
            <X className="w-6 h-6 text-gray-600" />
          </button>
        </div>

        <button
          onClick={onTakePhoto}
          className="w-full bg-gradient-to-r from-blue-600 to-blue-700 text-white p-4 rounded-xl shadow-lg active:scale-98 transition-transform flex items-center justify-center space-x-3"
        >
          <Camera className="w-6 h-6" />
          <span className="font-semibold">Take Photo</span>
        </button>

        <button
          onClick={onChooseFromLibrary}
          className="w-full bg-white border-2 border-blue-600 text-blue-600 p-4 rounded-xl shadow-sm active:scale-98 transition-transform flex items-center justify-center space-x-3"
        >
          <ImageIcon className="w-6 h-6" />
          <span className="font-semibold">Choose from Library</span>
        </button>
      </div>
    </div>
  );
}
