import { useState, useEffect } from 'react';
import { ArrowLeft, ChevronLeft, ChevronRight, StickyNote, Save } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';

interface PresentationViewerProps {
  presentation: {
    id: string;
    name: string;
    file_url: string;
    slide_count: number;
  };
  onBack: () => void;
  isMobile?: boolean;
}

interface Slide {
  slide_number: number;
  title: string;
  talking_points: string;
}

interface Note {
  id?: string;
  slide_number: number;
  note: string;
}

export default function PresentationViewer({ presentation, onBack, isMobile = false }: PresentationViewerProps) {
  const { user } = useAuth();
  const [currentSlide, setCurrentSlide] = useState(1);
  const [slides, setSlides] = useState<Slide[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [currentNote, setCurrentNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [savingNote, setSavingNote] = useState(false);

  useEffect(() => {
    loadSlides();
    loadNotes();
  }, []);

  useEffect(() => {
    // Load note for current slide
    const note = notes.find(n => n.slide_number === currentSlide);
    setCurrentNote(note?.note || '');
  }, [currentSlide, notes]);

  const loadSlides = async () => {
    try {
      const { data, error } = await supabase
        .from('presentation_slides')
        .select('*')
        .eq('presentation_id', presentation.id)
        .order('slide_number');

      if (error) throw error;
      setSlides(data || []);
    } catch (error) {
      console.error('Error loading slides:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadNotes = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('presentation_notes')
        .select('*')
        .eq('presentation_id', presentation.id)
        .eq('user_id', user.id);

      if (error) throw error;
      setNotes(data || []);
    } catch (error) {
      console.error('Error loading notes:', error);
    }
  };

  const saveNote = async () => {
    if (!user || !currentNote.trim()) return;

    setSavingNote(true);

    try {
      const existingNote = notes.find(n => n.slide_number === currentSlide);

      if (existingNote?.id) {
        // Update existing note
        const { error } = await supabase
          .from('presentation_notes')
          .update({ note: currentNote })
          .eq('id', existingNote.id);

        if (error) throw error;
      } else {
        // Insert new note
        const { data, error } = await supabase
          .from('presentation_notes')
          .insert({
            presentation_id: presentation.id,
            slide_number: currentSlide,
            user_id: user.id,
            note: currentNote
          })
          .select()
          .single();

        if (error) throw error;
        setNotes(prev => [...prev, data]);
      }

      await loadNotes();
    } catch (error: any) {
      alert(`Failed to save note: ${error.message}`);
    } finally {
      setSavingNote(false);
    }
  };

  const currentSlideData = slides.find(s => s.slide_number === currentSlide);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p>Loading presentation...</p>
        </div>
      </div>
    );
  }

  // Mobile: Fullscreen presentation mode
  if (isMobile) {
    return (
      <div className="fixed inset-0 bg-black z-50 flex flex-col">
        {/* Header */}
        <div className="bg-gray-900 p-4 flex items-center justify-between">
          <button
            onClick={onBack}
            className="text-white p-2 hover:bg-gray-800 rounded"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h2 className="text-white font-semibold text-lg flex-1 mx-4 truncate">
            {presentation.name}
          </h2>
          <span className="text-white text-sm">
            {currentSlide} / {presentation.slide_count}
          </span>
        </div>

        {/* PDF Viewer */}
        <div className="flex-1 relative bg-white">
          <iframe
            src={`${presentation.file_url}#page=${currentSlide}&view=FitH`}
            className="w-full h-full"
            title={presentation.name}
          />
        </div>

        {/* Navigation */}
        <div className="bg-gray-900 p-4 flex items-center justify-between">
          <button
            onClick={() => setCurrentSlide(Math.max(1, currentSlide - 1))}
            disabled={currentSlide === 1}
            className="p-3 bg-gray-800 text-white rounded-full hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>

          <button
            onClick={() => setCurrentSlide(Math.min(presentation.slide_count, currentSlide + 1))}
            disabled={currentSlide === presentation.slide_count}
            className="p-3 bg-gray-800 text-white rounded-full hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        </div>
      </div>
    );
  }

  // Desktop: PDF at top, talking points and notes at bottom
  return (
    <div className="min-h-screen bg-gray-100">
      <div className="bg-white border-b border-gray-200 p-4">
        <button
          onClick={onBack}
          className="text-blue-600 font-medium flex items-center gap-2 mb-2"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <h1 className="text-2xl font-bold text-gray-900">{presentation.name}</h1>
      </div>

      <div className="p-6 flex flex-col gap-4" style={{ height: 'calc(100vh - 120px)' }}>
        {/* Top: PDF Viewer - Takes 65% of height */}
        <div className="bg-white rounded-lg shadow-lg overflow-hidden flex flex-col" style={{ height: '65%' }}>
          <div className="bg-gray-800 text-white p-3 flex items-center justify-between">
            <span className="font-semibold">Slide {currentSlide} of {presentation.slide_count}</span>
            <div className="flex gap-2">
              <button
                onClick={() => setCurrentSlide(Math.max(1, currentSlide - 1))}
                disabled={currentSlide === 1}
                className="p-2 hover:bg-gray-700 rounded disabled:opacity-30"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                onClick={() => setCurrentSlide(Math.min(presentation.slide_count, currentSlide + 1))}
                disabled={currentSlide === presentation.slide_count}
                className="p-2 hover:bg-gray-700 rounded disabled:opacity-30"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
          <div className="flex-1">
            <iframe
              src={`${presentation.file_url}#page=${currentSlide}&view=FitH`}
              className="w-full h-full"
              title={presentation.name}
            />
          </div>
        </div>

        {/* Bottom: Talking Points & Notes - Takes 35% of height */}
        <div className="grid grid-cols-2 gap-4" style={{ height: '35%' }}>
          {/* Talking Points */}
          <div className="bg-white rounded-lg shadow-lg p-4 overflow-y-auto">
            <h3 className="text-lg font-bold text-gray-900 mb-2">
              {currentSlideData?.title || `Slide ${currentSlide}`}
            </h3>
            <div className="text-sm text-gray-700 whitespace-pre-wrap">
              {currentSlideData?.talking_points || 'No talking points for this slide'}
            </div>
          </div>

          {/* Your Notes */}
          <div className="bg-white rounded-lg shadow-lg p-4 flex flex-col">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                <StickyNote className="w-4 h-4" />
                Your Notes
              </h3>
              <button
                onClick={saveNote}
                disabled={savingNote || !currentNote.trim()}
                className="flex items-center gap-1 px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-xs"
              >
                <Save className="w-3 h-3" />
                {savingNote ? 'Saving...' : 'Save'}
              </button>
            </div>
            <textarea
              value={currentNote}
              onChange={(e) => setCurrentNote(e.target.value)}
              placeholder="Add your personal notes for this slide..."
              className="flex-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none text-sm"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
