import { useState, useRef } from 'react';
import {
  Paperclip,
  Upload,
  X,
  FileText,
  Image as ImageIcon,
  Video,
  Music,
  File,
  Trash2,
  Download,
  Eye,
  Loader2,
} from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../contexts/AuthContext';
import {
  type RoadmapAttachment,
  type FileCategory,
  getFileCategory,
  formatFileSize,
} from '../types';
import toast from 'react-hot-toast';

interface RoadmapAttachmentsProps {
  roadmapItemId: string;
  attachments: RoadmapAttachment[];
  onAttachmentsChange: () => void;
  readOnly?: boolean;
}

const FILE_ICONS: Record<FileCategory, typeof FileText> = {
  image: ImageIcon,
  video: Video,
  audio: Music,
  document: FileText,
  other: File,
};

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB

export default function RoadmapAttachments({
  roadmapItemId,
  attachments,
  onAttachmentsChange,
  readOnly = false,
}: RoadmapAttachmentsProps) {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewType, setPreviewType] = useState<FileCategory | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !user) return;

    const file = files[0];

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      toast.error(`File too large. Maximum size is ${formatFileSize(MAX_FILE_SIZE)}`);
      return;
    }

    setUploading(true);
    setUploadProgress(0);

    try {
      // Generate unique file path: userId/roadmapItemId/timestamp_filename
      const timestamp = Date.now();
      const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const filePath = `${user.id}/${roadmapItemId}/${timestamp}_${sanitizedName}`;

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from('roadmap-attachments')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) throw uploadError;

      setUploadProgress(50);

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('roadmap-attachments')
        .getPublicUrl(filePath);

      const fileUrl = urlData.publicUrl;
      const fileType = getFileCategory(file.type);

      // Insert attachment record
      const { error: insertError } = await supabase
        .from('roadmap_attachments')
        .insert({
          roadmap_item_id: roadmapItemId,
          uploaded_by: user.id,
          file_name: file.name,
          file_url: fileUrl,
          file_type: fileType,
          file_size: file.size,
          mime_type: file.type,
        });

      if (insertError) throw insertError;

      setUploadProgress(100);
      toast.success('File uploaded');
      onAttachmentsChange();
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Failed to upload file');
    } finally {
      setUploading(false);
      setUploadProgress(0);
      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDelete = async (attachment: RoadmapAttachment) => {
    if (!confirm(`Delete "${attachment.file_name}"?`)) return;

    setDeletingId(attachment.id);
    try {
      // Extract file path from URL for storage deletion
      const url = new URL(attachment.file_url);
      const pathParts = url.pathname.split('/roadmap-attachments/');
      const filePath = pathParts[1] ? decodeURIComponent(pathParts[1]) : null;

      // Delete from storage (best effort)
      if (filePath) {
        await supabase.storage
          .from('roadmap-attachments')
          .remove([filePath]);
      }

      // Delete record
      const { error } = await supabase
        .from('roadmap_attachments')
        .delete()
        .eq('id', attachment.id);

      if (error) throw error;

      toast.success('Attachment deleted');
      onAttachmentsChange();
    } catch (error) {
      console.error('Delete error:', error);
      toast.error('Failed to delete attachment');
    } finally {
      setDeletingId(null);
    }
  };

  const openPreview = (attachment: RoadmapAttachment) => {
    if (attachment.file_type === 'image' || attachment.file_type === 'video') {
      setPreviewUrl(attachment.file_url);
      setPreviewType(attachment.file_type);
    } else {
      // Open in new tab for non-previewable files
      window.open(attachment.file_url, '_blank');
    }
  };

  const closePreview = () => {
    setPreviewUrl(null);
    setPreviewType(null);
  };

  return (
    <div className="space-y-3">
      {/* Header with upload button */}
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
          <Paperclip className="w-4 h-4 text-gray-500" />
          Attachments
          {attachments.length > 0 && (
            <span className="text-xs text-gray-400">({attachments.length})</span>
          )}
        </label>
        {!readOnly && (
          <label className="cursor-pointer">
            <input
              ref={fileInputRef}
              type="file"
              onChange={handleFileSelect}
              className="hidden"
              accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.md"
              disabled={uploading}
            />
            <span className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
              {uploading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Uploading {uploadProgress}%
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  Add File
                </>
              )}
            </span>
          </label>
        )}
      </div>

      {/* Attachments grid */}
      {attachments.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
          {attachments.map((attachment) => {
            const Icon = FILE_ICONS[attachment.file_type];
            const isImage = attachment.file_type === 'image';
            const isVideo = attachment.file_type === 'video';
            const isDeleting = deletingId === attachment.id;

            return (
              <div
                key={attachment.id}
                className="group relative border border-gray-200 rounded-lg overflow-hidden bg-gray-50 hover:border-blue-300 transition-colors"
              >
                {/* Thumbnail/Icon */}
                <div
                  className="aspect-square flex items-center justify-center cursor-pointer"
                  onClick={() => openPreview(attachment)}
                >
                  {isImage ? (
                    <img
                      src={attachment.file_url}
                      alt={attachment.file_name}
                      className="w-full h-full object-cover"
                    />
                  ) : isVideo ? (
                    <div className="relative w-full h-full bg-gray-900 flex items-center justify-center">
                      <Video className="w-10 h-10 text-white/70" />
                      <div className="absolute bottom-1 right-1 bg-black/70 text-white text-[10px] px-1 rounded">
                        VIDEO
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-1 p-2">
                      <Icon className="w-8 h-8 text-gray-400" />
                      <span className="text-[10px] text-gray-500 uppercase tracking-wider">
                        {attachment.mime_type?.split('/')[1]?.substring(0, 4) || attachment.file_type}
                      </span>
                    </div>
                  )}
                </div>

                {/* File name */}
                <div className="p-1.5 bg-white border-t border-gray-100">
                  <p className="text-xs text-gray-700 truncate" title={attachment.file_name}>
                    {attachment.file_name}
                  </p>
                  <p className="text-[10px] text-gray-400">
                    {formatFileSize(attachment.file_size)}
                  </p>
                </div>

                {/* Action buttons - shown on hover */}
                <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => openPreview(attachment)}
                    className="p-1 bg-white/90 hover:bg-white rounded shadow-sm"
                    title="Preview"
                  >
                    <Eye className="w-3.5 h-3.5 text-gray-600" />
                  </button>
                  <a
                    href={attachment.file_url}
                    download={attachment.file_name}
                    className="p-1 bg-white/90 hover:bg-white rounded shadow-sm"
                    title="Download"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Download className="w-3.5 h-3.5 text-gray-600" />
                  </a>
                  {!readOnly && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(attachment);
                      }}
                      disabled={isDeleting}
                      className="p-1 bg-white/90 hover:bg-red-50 rounded shadow-sm"
                      title="Delete"
                    >
                      {isDeleting ? (
                        <Loader2 className="w-3.5 h-3.5 text-gray-400 animate-spin" />
                      ) : (
                        <Trash2 className="w-3.5 h-3.5 text-red-500" />
                      )}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-6 text-gray-400 text-sm border border-dashed border-gray-200 rounded-lg">
          {readOnly ? 'No attachments' : 'No attachments yet. Click "Add File" to upload.'}
        </div>
      )}

      {/* Preview Modal */}
      {previewUrl && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-[60] p-4"
          onClick={closePreview}
        >
          <button
            onClick={closePreview}
            className="absolute top-4 right-4 p-2 text-white/70 hover:text-white transition-colors"
          >
            <X className="w-8 h-8" />
          </button>
          <div
            className="max-w-[90vw] max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {previewType === 'image' ? (
              <img
                src={previewUrl}
                alt="Preview"
                className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl"
              />
            ) : previewType === 'video' ? (
              <video
                src={previewUrl}
                controls
                autoPlay
                className="max-w-full max-h-[85vh] rounded-lg shadow-2xl"
              />
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
