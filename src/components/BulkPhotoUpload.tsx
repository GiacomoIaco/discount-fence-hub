import { useState } from 'react';
import { Upload, ArrowLeft, Sparkles, CheckCircle, XCircle, Loader } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { imageToBase64 } from '../lib/photos';
import { showSuccess } from '../lib/toast';
import { getOptimizedImageUrl } from '../lib/storage';

interface BulkPhotoUploadProps {
  onBack: () => void;
}

interface UploadProgress {
  fileName: string;
  status: 'pending' | 'uploading' | 'tagging' | 'complete' | 'error';
  error?: string;
  photoId?: string;
}

const BulkPhotoUpload = ({ onBack }: BulkPhotoUploadProps) => {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress[]>([]);
  const [enableTagging, setEnableTagging] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [batchSize, setBatchSize] = useState(5);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const imageFiles = files.filter(file =>
      file.type.startsWith('image/')
    );
    setSelectedFiles(imageFiles);

    // Initialize progress tracking
    setUploadProgress(imageFiles.map(file => ({
      fileName: file.name,
      status: 'pending'
    })));
  };

  const uploadSinglePhoto = async (
    file: File,
    index: number
  ): Promise<void> => {
    const updateProgress = (updates: Partial<UploadProgress>) => {
      setUploadProgress(prev => prev.map((p, i) =>
        i === index ? { ...p, ...updates } : p
      ));
    };

    try {
      updateProgress({ status: 'uploading' });

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Upload to storage
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `photos/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('photos')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) throw uploadError;

      // Get public URL (full resolution)
      const { data: { publicUrl } } = supabase.storage
        .from('photos')
        .getPublicUrl(filePath);

      // Create database record with optimized thumbnail
      const photoRecord = {
        url: publicUrl,                                           // Full resolution for AI/enhance/full-screen
        thumbnail_url: getOptimizedImageUrl('photos', filePath, 'thumb'),  // Optimized 200x200 thumbnail (~20KB)
        uploaded_by: user.id,
        uploaded_at: new Date().toISOString(),
        tags: [] as string[],
        is_favorite: false,
        likes: 0,
        status: 'pending',
        suggested_tags: [] as string[],
        quality_score: null,
        confidence_score: null
      };

      const { data: photoData, error: dbError } = await supabase
        .from('photos')
        .insert(photoRecord)
        .select()
        .single();

      if (dbError) throw dbError;

      updateProgress({ photoId: photoData.id });

      // Tag if enabled
      if (enableTagging) {
        updateProgress({ status: 'tagging' });
        await tagPhoto(file, photoData.id, index);
      } else {
        updateProgress({ status: 'complete' });
      }
    } catch (error) {
      console.error('Upload error:', error);
      updateProgress({
        status: 'error',
        error: error instanceof Error ? error.message : 'Upload failed'
      });
    }
  };

  const tagPhoto = async (file: File, photoId: string, progressIndex: number) => {
    try {
      // Convert image to base64
      const base64 = await imageToBase64(file);

      // Call AI tagging function
      const response = await fetch('/.netlify/functions/analyze-photo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: base64 })
      });

      if (!response.ok) {
        throw new Error(`Tagging failed: ${response.statusText}`);
      }

      const result = await response.json();

      // Update photo with AI tags
      await supabase
        .from('photos')
        .update({
          suggested_tags: result.suggestedTags || [],
          quality_score: result.qualityScore,
          confidence_score: result.confidenceScore
        })
        .eq('id', photoId);

      setUploadProgress(prev => prev.map((p, i) =>
        i === progressIndex ? { ...p, status: 'complete' } : p
      ));
    } catch (error) {
      console.error('Tagging error:', error);
      // Don't fail the upload if tagging fails
      setUploadProgress(prev => prev.map((p, i) =>
        i === progressIndex ? { ...p, status: 'complete' } : p
      ));
    }
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0) return;

    setIsUploading(true);

    // Process in batches
    for (let i = 0; i < selectedFiles.length; i += batchSize) {
      const batch = selectedFiles.slice(i, i + batchSize);
      const batchPromises = batch.map((file, batchIndex) =>
        uploadSinglePhoto(file, i + batchIndex)
      );

      await Promise.all(batchPromises);

      // Small delay between batches
      if (i + batchSize < selectedFiles.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    setIsUploading(false);

    const successCount = uploadProgress.filter(p => p.status === 'complete').length;
    const errorCount = uploadProgress.filter(p => p.status === 'error').length;

    showSuccess(`Upload complete! ${successCount} photos uploaded, ${errorCount} failed.`);
  };

  const handleClear = () => {
    setSelectedFiles([]);
    setUploadProgress([]);
  };

  const getStatusIcon = (status: UploadProgress['status']) => {
    switch (status) {
      case 'complete':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'error':
        return <XCircle className="w-5 h-5 text-red-600" />;
      case 'uploading':
      case 'tagging':
        return <Loader className="w-5 h-5 text-blue-600 animate-spin" />;
      default:
        return <div className="w-5 h-5 rounded-full border-2 border-gray-300" />;
    }
  };

  const getStatusText = (status: UploadProgress['status']) => {
    switch (status) {
      case 'uploading':
        return 'Uploading...';
      case 'tagging':
        return 'AI Tagging...';
      case 'complete':
        return 'Complete';
      case 'error':
        return 'Error';
      default:
        return 'Pending';
    }
  };

  const completedCount = uploadProgress.filter(p => p.status === 'complete').length;
  const errorCount = uploadProgress.filter(p => p.status === 'error').length;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 p-4">
        <button
          onClick={onBack}
          className="text-blue-600 font-medium flex items-center space-x-2 mb-3"
          disabled={isUploading}
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Back</span>
        </button>

        <div>
          <h1 className="text-2xl font-bold text-gray-900">Bulk Photo Upload</h1>
          <p className="text-gray-600 mt-1">
            Upload multiple photos to the gallery at once
          </p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-6 space-y-6">
        {/* Upload Settings */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Upload Settings</h2>

          <div className="space-y-4">
            {/* AI Tagging Toggle */}
            <div className="flex items-center justify-between">
              <div>
                <label className="font-medium text-gray-900 flex items-center space-x-2">
                  <Sparkles className="w-5 h-5 text-purple-600" />
                  <span>AI Auto-Tagging</span>
                </label>
                <p className="text-sm text-gray-600 mt-1">
                  Automatically analyze and tag photos using AI (slower but recommended)
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={enableTagging}
                  onChange={(e) => setEnableTagging(e.target.checked)}
                  disabled={isUploading}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>

            {/* Batch Size */}
            <div>
              <label className="font-medium text-gray-900 block mb-2">
                Batch Size: {batchSize} photos at a time
              </label>
              <input
                type="range"
                min="1"
                max="10"
                value={batchSize}
                onChange={(e) => setBatchSize(parseInt(e.target.value))}
                disabled={isUploading}
                className="w-full"
              />
              <p className="text-sm text-gray-600 mt-1">
                Smaller batches are slower but safer for large uploads
              </p>
            </div>
          </div>
        </div>

        {/* File Selection */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Select Photos</h2>

          <div className="mb-4">
            <label
              htmlFor="file-upload"
              className="flex flex-col items-center justify-center w-full h-64 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors"
            >
              <div className="flex flex-col items-center justify-center pt-5 pb-6">
                <Upload className="w-12 h-12 text-gray-400 mb-3" />
                <p className="mb-2 text-sm text-gray-500">
                  <span className="font-semibold">Click to upload</span> or drag and drop
                </p>
                <p className="text-xs text-gray-500">PNG, JPG, GIF, WebP (any size)</p>
              </div>
              <input
                id="file-upload"
                type="file"
                multiple
                accept="image/*"
                onChange={handleFileSelect}
                disabled={isUploading}
                className="hidden"
              />
            </label>
          </div>

          {selectedFiles.length > 0 && (
            <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg">
              <p className="text-sm font-medium text-gray-900">
                {selectedFiles.length} photo{selectedFiles.length !== 1 ? 's' : ''} selected
              </p>
              {!isUploading && (
                <button
                  onClick={handleClear}
                  className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                >
                  Clear
                </button>
              )}
            </div>
          )}
        </div>

        {/* Upload Progress */}
        {uploadProgress.length > 0 && (
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Upload Progress</h2>
              <div className="text-sm text-gray-600">
                {completedCount} of {uploadProgress.length} complete
                {errorCount > 0 && (
                  <span className="text-red-600 ml-2">({errorCount} errors)</span>
                )}
              </div>
            </div>

            <div className="space-y-2 max-h-96 overflow-y-auto">
              {uploadProgress.map((progress, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <div className="flex items-center space-x-3 flex-1 min-w-0">
                    {getStatusIcon(progress.status)}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {progress.fileName}
                      </p>
                      {progress.error && (
                        <p className="text-xs text-red-600 truncate">{progress.error}</p>
                      )}
                    </div>
                  </div>
                  <span className="text-xs text-gray-600 ml-3">
                    {getStatusText(progress.status)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Upload Button */}
        <div className="flex space-x-3">
          <button
            onClick={handleUpload}
            disabled={selectedFiles.length === 0 || isUploading}
            className="flex-1 bg-blue-600 text-white py-3 rounded-lg font-semibold flex items-center justify-center space-x-2 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isUploading ? (
              <>
                <Loader className="w-5 h-5 animate-spin" />
                <span>Uploading...</span>
              </>
            ) : (
              <>
                <Upload className="w-5 h-5" />
                <span>Upload {selectedFiles.length} Photo{selectedFiles.length !== 1 ? 's' : ''}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default BulkPhotoUpload;
