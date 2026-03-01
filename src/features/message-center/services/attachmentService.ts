import { supabase } from '../../../lib/supabase';

export interface AttachmentUploadResult {
  publicUrl: string;
  fileName: string;
  fileType: string;
  fileSize: number;
}

/**
 * Upload a file attachment to the correct storage bucket based on message type
 */
export async function uploadAttachment(
  file: File,
  messageType: 'sms' | 'team_chat' | 'ticket_chat',
  conversationRef: string,
): Promise<AttachmentUploadResult> {
  // Validate file size (10MB limit)
  const MAX_SIZE = 10 * 1024 * 1024;
  if (file.size > MAX_SIZE) {
    throw new Error('File size must be less than 10MB');
  }

  // Route to correct bucket
  const bucket = messageType === 'ticket_chat' ? 'request-attachments' : 'chat-files';
  const filePath = `${conversationRef}/${Date.now()}_${file.name}`;

  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(filePath, file);

  if (uploadError) throw uploadError;

  const { data: { publicUrl } } = supabase.storage
    .from(bucket)
    .getPublicUrl(filePath);

  return {
    publicUrl,
    fileName: file.name,
    fileType: file.type,
    fileSize: file.size,
  };
}

/**
 * Check if a file type is an image
 */
export function isImageFile(fileType: string): boolean {
  return fileType.startsWith('image/');
}

/**
 * Check if a file type is audio
 */
export function isAudioFile(fileType: string): boolean {
  return fileType.startsWith('audio/');
}

/**
 * Check if a file type is video
 */
export function isVideoFile(fileType: string): boolean {
  return fileType.startsWith('video/');
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
