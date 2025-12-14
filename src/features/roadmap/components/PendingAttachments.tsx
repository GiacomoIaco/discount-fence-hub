import { useRef } from 'react';
import {
  Paperclip,
  Upload,
  X,
  FileText,
  Image as ImageIcon,
  Video,
  Music,
  File,
} from 'lucide-react';
import { type FileCategory, getFileCategory, formatFileSize } from '../types';
import toast from 'react-hot-toast';

export interface PendingFile {
  file: File;
  category: FileCategory;
  preview?: string;
}

interface PendingAttachmentsProps {
  files: PendingFile[];
  onFilesChange: (files: PendingFile[]) => void;
}

const FILE_ICONS: Record<FileCategory, typeof FileText> = {
  image: ImageIcon,
  video: Video,
  audio: Music,
  document: FileText,
  other: File,
};

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
const MAX_FILES = 5;

export default function PendingAttachments({
  files,
  onFilesChange,
}: PendingAttachmentsProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (!selectedFiles || selectedFiles.length === 0) return;

    const newFiles: PendingFile[] = [];

    for (let i = 0; i < selectedFiles.length; i++) {
      const file = selectedFiles[i];

      // Check limits
      if (files.length + newFiles.length >= MAX_FILES) {
        toast.error(`Maximum ${MAX_FILES} files allowed`);
        break;
      }

      if (file.size > MAX_FILE_SIZE) {
        toast.error(`"${file.name}" is too large. Maximum size is ${formatFileSize(MAX_FILE_SIZE)}`);
        continue;
      }

      const category = getFileCategory(file.type);
      const preview = category === 'image' ? URL.createObjectURL(file) : undefined;

      newFiles.push({ file, category, preview });
    }

    if (newFiles.length > 0) {
      onFilesChange([...files, ...newFiles]);
    }

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeFile = (index: number) => {
    const file = files[index];
    if (file.preview) {
      URL.revokeObjectURL(file.preview);
    }
    onFilesChange(files.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
          <Paperclip className="w-4 h-4 text-gray-500" />
          Attachments
          {files.length > 0 && (
            <span className="text-xs text-gray-400">({files.length}/{MAX_FILES})</span>
          )}
        </label>
        <label className="cursor-pointer">
          <input
            ref={fileInputRef}
            type="file"
            onChange={handleFileSelect}
            className="hidden"
            accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.md"
            multiple
            disabled={files.length >= MAX_FILES}
          />
          <span className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg transition-colors ${
            files.length >= MAX_FILES
              ? 'text-gray-400 cursor-not-allowed'
              : 'text-blue-600 hover:bg-blue-50'
          }`}>
            <Upload className="w-4 h-4" />
            Add Files
          </span>
        </label>
      </div>

      {files.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {files.map((pf, index) => {
            const Icon = FILE_ICONS[pf.category];
            return (
              <div
                key={index}
                className="relative group flex items-center gap-2 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg"
              >
                {pf.preview ? (
                  <img src={pf.preview} alt="" className="w-8 h-8 object-cover rounded" />
                ) : (
                  <Icon className="w-5 h-5 text-gray-400" />
                )}
                <div className="max-w-[120px]">
                  <p className="text-xs text-gray-700 truncate">{pf.file.name}</p>
                  <p className="text-[10px] text-gray-400">{formatFileSize(pf.file.size)}</p>
                </div>
                <button
                  type="button"
                  onClick={() => removeFile(index)}
                  className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-xs text-gray-400">
          Optional: Add screenshots, mockups, or reference files
        </p>
      )}
    </div>
  );
}
