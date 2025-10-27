import { useState, useEffect } from 'react';
import { ArrowLeft, FileText, Video, Archive, Trash2, Eye, Plus } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { supabase } from '../../../lib/supabase';
import PresentationUpload from './PresentationUpload';
import PresentationViewer from './PresentationViewer';
import { showError } from '../../../lib/toast';

interface ClientPresentationProps {
  onBack: () => void;
  isMobile?: boolean;
}

interface Presentation {
  id: string;
  name: string;
  description?: string;
  file_url: string;
  thumbnail_url?: string;
  file_type: string;
  slide_count: number;
  status: 'active' | 'archived';
  created_at: string;
  uploaded_by?: string;
}

export default function ClientPresentation({ onBack, isMobile = false }: ClientPresentationProps) {
  const { profile } = useAuth();
  const [presentations, setPresentations] = useState<Presentation[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [selectedPresentation, setSelectedPresentation] = useState<Presentation | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  const canManage = profile?.role === 'admin' || profile?.role === 'sales-manager';
  const canDelete = profile?.role === 'admin';

  useEffect(() => {
    loadPresentations();
  }, [showArchived]);

  const loadPresentations = async () => {
    try {
      const status = showArchived ? 'archived' : 'active';
      const { data, error } = await supabase
        .from('client_presentations')
        .select('*')
        .eq('status', status)
        .order('display_order', { ascending: true });

      if (error) throw error;
      setPresentations(data || []);
    } catch (error) {
      console.error('Error loading presentations:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleArchive = async (id: string) => {
    if (!confirm('Archive this presentation?')) return;

    try {
      const { error } = await supabase
        .from('client_presentations')
        .update({ status: 'archived' })
        .eq('id', id);

      if (error) throw error;
      await loadPresentations();
    } catch (error: any) {
      showError(`Failed to archive: ${error.message}`);
    }
  };

  const handleDelete = async (presentation: Presentation) => {
    if (!confirm(`Permanently delete "${presentation.name}"? This cannot be undone.`)) return;

    try {
      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from('client-presentations')
        .remove([presentation.file_url.split('/').pop() || '']);

      if (storageError) console.error('Storage delete error:', storageError);

      // Delete from database
      const { error: dbError } = await supabase
        .from('client_presentations')
        .delete()
        .eq('id', presentation.id);

      if (dbError) throw dbError;

      await loadPresentations();
    } catch (error: any) {
      showError(`Failed to delete: ${error.message}`);
    }
  };

  const trackView = async (presentationId: string) => {
    try {
      await supabase.from('presentation_views').insert({
        presentation_id: presentationId,
        user_id: profile?.id
      });
    } catch (error) {
      console.error('Error tracking view:', error);
    }
  };

  if (selectedPresentation) {
    return (
      <PresentationViewer
        presentation={selectedPresentation}
        onBack={() => setSelectedPresentation(null)}
        isMobile={isMobile}
      />
    );
  }

  if (showUpload && canManage) {
    return (
      <PresentationUpload
        onBack={() => setShowUpload(false)}
        onUploadComplete={() => {
          setShowUpload(false);
          loadPresentations();
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 p-4 pb-20">
      <button
        onClick={onBack}
        className="text-blue-600 font-medium mb-4 flex items-center gap-2"
      >
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Client Presentations</h1>
              <p className="text-gray-600 mt-1">
                {isMobile ? 'Present to clients' : 'Review presentations and add your notes'}
              </p>
            </div>
            {canManage && (
              <button
                onClick={() => setShowUpload(true)}
                className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus className="w-5 h-5" />
                Upload
              </button>
            )}
          </div>

          {/* Toggle Archived */}
          {canManage && (
            <div className="mt-4">
              <button
                onClick={() => setShowArchived(!showArchived)}
                className="text-sm text-gray-600 hover:text-gray-900 flex items-center gap-2"
              >
                <Archive className="w-4 h-4" />
                {showArchived ? 'Show Active' : 'Show Archived'}
              </button>
            </div>
          )}
        </div>

        {/* Presentations Grid */}
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="text-gray-600 mt-4">Loading presentations...</p>
          </div>
        ) : presentations.length === 0 ? (
          <div className="bg-white rounded-lg shadow-lg p-12 text-center">
            <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 text-lg">
              {showArchived ? 'No archived presentations' : 'No presentations available'}
            </p>
            {canManage && !showArchived && (
              <button
                onClick={() => setShowUpload(true)}
                className="mt-4 text-blue-600 hover:text-blue-700 font-medium"
              >
                Upload your first presentation
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {presentations.map((presentation) => (
              <div
                key={presentation.id}
                className="bg-white rounded-lg shadow-lg overflow-hidden hover:shadow-xl transition-shadow"
              >
                {/* Thumbnail */}
                <div
                  className="relative h-48 bg-gradient-to-br from-blue-500 to-purple-600 cursor-pointer group"
                  onClick={() => {
                    trackView(presentation.id);
                    setSelectedPresentation(presentation);
                  }}
                >
                  {presentation.thumbnail_url ? (
                    <img
                      src={presentation.thumbnail_url}
                      alt={presentation.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full">
                      {presentation.file_type === 'pdf' ? (
                        <FileText className="w-20 h-20 text-white opacity-50" />
                      ) : (
                        <Video className="w-20 h-20 text-white opacity-50" />
                      )}
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all flex items-center justify-center">
                    <Eye className="w-12 h-12 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  {presentation.slide_count > 0 && (
                    <div className="absolute top-2 right-2 bg-black/70 text-white px-2 py-1 rounded text-sm">
                      {presentation.slide_count} slides
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="p-4">
                  <h3 className="font-bold text-lg text-gray-900 mb-1">
                    {presentation.name}
                  </h3>
                  {presentation.description && (
                    <p className="text-sm text-gray-600 line-clamp-2 mb-3">
                      {presentation.description}
                    </p>
                  )}

                  {/* Actions */}
                  <div className="flex items-center justify-between pt-3 border-t border-gray-200">
                    <button
                      onClick={() => {
                        trackView(presentation.id);
                        setSelectedPresentation(presentation);
                      }}
                      className="text-blue-600 hover:text-blue-700 font-medium text-sm"
                    >
                      {isMobile ? 'Present' : 'View'}
                    </button>

                    {canManage && (
                      <div className="flex items-center gap-2">
                        {!showArchived && (
                          <button
                            onClick={() => handleArchive(presentation.id)}
                            className="p-2 text-gray-600 hover:text-orange-600 transition-colors"
                            title="Archive"
                          >
                            <Archive className="w-4 h-4" />
                          </button>
                        )}
                        {canDelete && (
                          <button
                            onClick={() => handleDelete(presentation)}
                            className="p-2 text-gray-600 hover:text-red-600 transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
