import { useState, useRef, useCallback, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Camera,
  X,
  Upload,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  MapPin,
} from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { showSuccess, showError } from '../../../lib/toast';

interface CrewSignoffModalProps {
  projectId: string;
  projectCode: string;
  projectName: string;
  onClose: () => void;
  onSuccess?: () => void;
}

interface GeoPosition {
  latitude: number;
  longitude: number;
}

export default function CrewSignoffModal({
  projectId,
  projectCode,
  projectName,
  onClose,
  onSuccess,
}: CrewSignoffModalProps) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [crewName, setCrewName] = useState('');
  const [isPartialPickup, setIsPartialPickup] = useState(false);
  const [partialNotes, setPartialNotes] = useState('');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [geoPosition, setGeoPosition] = useState<GeoPosition | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);

  // Get geolocation on mount
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setGeoPosition({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          });
        },
        (error) => {
          console.warn('Geolocation error:', error.message);
          setGeoError('Location access denied');
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    }
  }, []);

  // Cleanup camera stream on unmount
  useEffect(() => {
    return () => {
      if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [cameraStream]);

  // Start camera
  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }, // Prefer back camera
        audio: false,
      });
      setCameraStream(stream);
      setIsCameraActive(true);

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch (err) {
      console.error('Camera error:', err);
      showError('Could not access camera. Please use file upload instead.');
    }
  }, []);

  // Stop camera
  const stopCamera = useCallback(() => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
    setIsCameraActive(false);
  }, [cameraStream]);

  // Capture photo from camera
  const capturePhoto = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    if (!context) return;

    // Set canvas size to video size
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Draw video frame to canvas
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Convert to blob
    canvas.toBlob((blob) => {
      if (blob) {
        const file = new File([blob], `signoff_${projectCode}_${Date.now()}.jpg`, {
          type: 'image/jpeg',
        });
        setPhotoFile(file);
        setPhotoPreview(URL.createObjectURL(blob));
        stopCamera();
      }
    }, 'image/jpeg', 0.85);
  }, [projectCode, stopCamera]);

  // Handle file upload
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        showError('Please select an image file');
        return;
      }
      setPhotoFile(file);
      setPhotoPreview(URL.createObjectURL(file));
    }
  };

  // Clear photo
  const clearPhoto = () => {
    setPhotoFile(null);
    if (photoPreview) {
      URL.revokeObjectURL(photoPreview);
    }
    setPhotoPreview(null);
  };

  // Submit sign-off
  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!crewName.trim()) throw new Error('Crew name is required');
      if (!photoFile) throw new Error('Photo is required');
      if (isPartialPickup && !partialNotes.trim()) throw new Error('Notes are required for partial pickup');

      // 1. Upload photo to Supabase storage
      const fileExt = photoFile.name.split('.').pop();
      const fileName = `${projectId}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('signoff-photos')
        .upload(fileName, photoFile);

      if (uploadError) {
        // If bucket doesn't exist, try creating it or give helpful error
        if (uploadError.message?.includes('bucket') || uploadError.message?.includes('not found')) {
          throw new Error('Storage bucket not configured. Please run the migration first.');
        }
        throw uploadError;
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('signoff-photos')
        .getPublicUrl(fileName);

      // 2. Create sign-off record
      const { error: signoffError } = await supabase
        .from('project_signoffs')
        .insert({
          project_id: projectId,
          crew_name: crewName.trim(),
          is_partial_pickup: isPartialPickup,
          partial_pickup_notes: isPartialPickup ? partialNotes.trim() : null,
          photo_url: urlData?.publicUrl || null,
          photo_path: fileName,
          gps_latitude: geoPosition?.latitude || null,
          gps_longitude: geoPosition?.longitude || null,
        });

      if (signoffError) throw signoffError;

      // 3. Update project status to 'loaded' and set partial pickup flag
      const updates: Record<string, unknown> = {
        status: 'loaded',
        loaded_at: new Date().toISOString(),
        crew_name: crewName.trim(),
        partial_pickup: isPartialPickup,
        partial_pickup_notes: isPartialPickup ? partialNotes.trim() : null,
      };

      const { error: projectError } = await supabase
        .from('bom_projects')
        .update(updates)
        .eq('id', projectId);

      if (projectError) throw projectError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['yard-schedule'] });
      queryClient.invalidateQueries({ queryKey: ['yard-spots'] });
      showSuccess('Sign-off recorded successfully');
      onSuccess?.();
      onClose();
    },
    onError: (err: Error) => {
      showError(err.message || 'Failed to record sign-off');
    },
  });

  const canSubmit = crewName.trim() && photoFile && (!isPartialPickup || partialNotes.trim());

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Crew Sign-off</h2>
            <p className="text-sm text-gray-500">
              <span className="font-mono font-medium">{projectCode}</span> - {projectName}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Crew Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Crew Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={crewName}
              onChange={(e) => setCrewName(e.target.value)}
              placeholder="Enter crew/driver name"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
            />
          </div>

          {/* Photo Capture */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Photo of Signed Pick List <span className="text-red-500">*</span>
            </label>

            {/* Photo Preview */}
            {photoPreview ? (
              <div className="relative">
                <img
                  src={photoPreview}
                  alt="Sign-off preview"
                  className="w-full h-48 object-cover rounded-lg border border-gray-200"
                />
                <button
                  onClick={clearPhoto}
                  className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
                <div className="absolute bottom-2 left-2 px-2 py-1 bg-green-500 text-white text-xs rounded flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  Photo captured
                </div>
              </div>
            ) : isCameraActive ? (
              <div className="relative">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  className="w-full h-48 object-cover rounded-lg bg-gray-900"
                />
                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-2">
                  <button
                    onClick={capturePhoto}
                    className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors flex items-center gap-2"
                  >
                    <Camera className="w-4 h-4" />
                    Capture
                  </button>
                  <button
                    onClick={stopCamera}
                    className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex gap-2">
                <button
                  onClick={startCamera}
                  className="flex-1 py-8 border-2 border-dashed border-gray-300 rounded-lg hover:border-green-400 hover:bg-green-50 transition-colors flex flex-col items-center gap-2 text-gray-500 hover:text-green-600"
                >
                  <Camera className="w-8 h-8" />
                  <span className="text-sm font-medium">Take Photo</span>
                </button>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex-1 py-8 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-400 hover:bg-blue-50 transition-colors flex flex-col items-center gap-2 text-gray-500 hover:text-blue-600"
                >
                  <Upload className="w-8 h-8" />
                  <span className="text-sm font-medium">Upload Photo</span>
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </div>
            )}

            {/* Hidden canvas for photo capture */}
            <canvas ref={canvasRef} className="hidden" />
          </div>

          {/* Partial Pickup */}
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={isPartialPickup}
                onChange={(e) => setIsPartialPickup(e.target.checked)}
                className="w-5 h-5 rounded border-amber-300 text-amber-600 focus:ring-amber-500"
              />
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <span className="font-medium text-amber-800">Partial Pickup</span>
              </div>
            </label>

            {isPartialPickup && (
              <div className="mt-3">
                <label className="block text-sm font-medium text-amber-700 mb-1">
                  What materials remain? <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={partialNotes}
                  onChange={(e) => setPartialNotes(e.target.value)}
                  placeholder="List materials that were not picked up..."
                  rows={2}
                  className="w-full px-3 py-2 border border-amber-300 rounded-lg focus:ring-2 focus:ring-amber-500 bg-white"
                />
              </div>
            )}
          </div>

          {/* Location Info */}
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <MapPin className="w-4 h-4" />
            {geoPosition ? (
              <span className="text-green-600">
                Location captured ({geoPosition.latitude.toFixed(4)}, {geoPosition.longitude.toFixed(4)})
              </span>
            ) : geoError ? (
              <span className="text-amber-600">{geoError}</span>
            ) : (
              <span>Getting location...</span>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-4 py-3 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => submitMutation.mutate()}
            disabled={!canSubmit || submitMutation.isPending}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 transition-colors flex items-center gap-2"
          >
            {submitMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                Complete Sign-off
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
