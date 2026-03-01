import { useRef } from 'react';
import { X, Camera, Image, FileText } from 'lucide-react';

interface MessageAttachmentPickerProps {
  isOpen: boolean;
  onClose: () => void;
  onFileSelected: (file: File) => void;
}

export function MessageAttachmentPicker({ isOpen, onClose, onFileSelected }: MessageAttachmentPickerProps) {
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const documentInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onFileSelected(file);
      onClose();
    }
    // Reset input so same file can be re-selected
    e.target.value = '';
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Hidden file inputs */}
      <input
        ref={cameraInputRef}
        type="file"
        className="hidden"
        onChange={handleFileChange}
        accept="image/*"
        capture="environment"
      />
      <input
        ref={photoInputRef}
        type="file"
        className="hidden"
        onChange={handleFileChange}
        accept="image/*,video/*"
      />
      <input
        ref={documentInputRef}
        type="file"
        className="hidden"
        onChange={handleFileChange}
        accept=".pdf,.doc,.docx,.txt,.xls,.xlsx,.csv"
      />

      {/* Bottom sheet modal */}
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end justify-center z-50">
        <div className="bg-white rounded-t-xl shadow-xl w-full max-w-lg p-4 pb-8 animate-slide-up">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Attach File</h3>
            <button
              onClick={onClose}
              className="p-1 hover:bg-gray-100 rounded-full"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <button
              onClick={() => {
                onClose();
                setTimeout(() => cameraInputRef.current?.click(), 100);
              }}
              className="flex flex-col items-center gap-2 p-4 bg-purple-50 hover:bg-purple-100 rounded-xl transition-colors border-2 border-purple-200"
            >
              <Camera className="w-7 h-7 text-purple-600" />
              <span className="text-xs font-medium text-purple-900">Camera</span>
            </button>
            <button
              onClick={() => {
                onClose();
                setTimeout(() => photoInputRef.current?.click(), 100);
              }}
              className="flex flex-col items-center gap-2 p-4 bg-blue-50 hover:bg-blue-100 rounded-xl transition-colors border-2 border-blue-200"
            >
              <Image className="w-7 h-7 text-blue-600" />
              <span className="text-xs font-medium text-blue-900">Gallery</span>
            </button>
            <button
              onClick={() => {
                onClose();
                setTimeout(() => documentInputRef.current?.click(), 100);
              }}
              className="flex flex-col items-center gap-2 p-4 bg-green-50 hover:bg-green-100 rounded-xl transition-colors border-2 border-green-200"
            >
              <FileText className="w-7 h-7 text-green-600" />
              <span className="text-xs font-medium text-green-900">Document</span>
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

export default MessageAttachmentPicker;
