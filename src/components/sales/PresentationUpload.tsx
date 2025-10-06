import { useState } from 'react';
import { ArrowLeft, Upload, FileText, Wand2, Check, Edit2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import * as pdfjsLib from 'pdfjs-dist';
import mammoth from 'mammoth';
import { showError } from '../../lib/toast';

// Set up PDF.js worker - using local worker from node_modules
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

interface PresentationUploadProps {
  onBack: () => void;
  onUploadComplete: () => void;
}

interface SlideWithTalkingPoints {
  slide_number: number;
  title: string;
  talking_points: string;
  thumbnail?: string;
}

export default function PresentationUpload({ onBack, onUploadComplete }: PresentationUploadProps) {
  const { user } = useAuth();
  const [step, setStep] = useState<'upload' | 'ai-processing' | 'review'>('upload');

  // Upload step
  const [presentationFile, setPresentationFile] = useState<File | null>(null);
  const [talkingPointsFile, setTalkingPointsFile] = useState<File | null>(null);
  const [presentationName, setPresentationName] = useState('');
  const [description, setDescription] = useState('');

  // Processing step
  const [processingStatus, setProcessingStatus] = useState('');

  // Review step
  const [slides, setSlides] = useState<SlideWithTalkingPoints[]>([]);
  const [editingSlide, setEditingSlide] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);

  const handlePresentationSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type === 'application/pdf') {
      setPresentationFile(file);
      if (!presentationName) {
        setPresentationName(file.name.replace('.pdf', ''));
      }
    } else {
      showError('Please select a PDF file');
    }
  };

  const handleTalkingPointsSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && (file.type === 'application/pdf' || file.name.endsWith('.docx') || file.name.endsWith('.doc'))) {
      setTalkingPointsFile(file);
    } else {
      showError('Please select a PDF or Word document');
    }
  };

  const extractPDFText = async (file: File): Promise<{ pages: string[], pageCount: number }> => {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const pageCount = pdf.numPages;
    const pages: string[] = [];

    for (let i = 1; i <= pageCount; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item: any) => item.str)
        .join(' ');
      pages.push(pageText);
    }

    return { pages, pageCount };
  };

  const generatePDFThumbnail = async (file: File): Promise<Blob | null> => {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      const page = await pdf.getPage(1); // First page

      const viewport = page.getViewport({ scale: 1.5 });
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');

      if (!context) return null;

      canvas.width = viewport.width;
      canvas.height = viewport.height;

      await page.render({
        canvasContext: context,
        viewport: viewport
      }).promise;

      return new Promise((resolve) => {
        canvas.toBlob((blob) => {
          resolve(blob);
        }, 'image/jpeg', 0.8);
      });
    } catch (error) {
      console.error('Error generating thumbnail:', error);
      return null;
    }
  };

  const extractWordText = async (file: File): Promise<string> => {
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    return result.value;
  };

  const matchTalkingPointsWithAI = async (slideTexts: string[], talkingPointsText: string) => {
    try {
      const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY;

      if (!apiKey) {
        throw new Error('VITE_ANTHROPIC_API_KEY is not configured');
      }

      console.log('Calling Claude API directly with', slideTexts.length, 'slides');

      // Call Claude API directly from client - no timeout limit!
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true'
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-5-20250929',
          max_tokens: 4000,
          messages: [{
            role: 'user',
            content: `You are helping match talking points to presentation slides for a sales presentation.

I have ${slideTexts.length} slides with the following content:
${slideTexts.map((text, i) => `Slide ${i + 1}: ${text.substring(0, 250)}...`).join('\n\n')}

And these talking points:
${talkingPointsText}

Please match the talking points to the appropriate slides. For each slide, provide:
1. A brief, descriptive title (4-6 words)
2. Detailed talking points from the document that relate to that slide

IMPORTANT:
- Include ALL relevant details from the talking points document for each slide
- Each talking point should be a complete sentence or phrase (not just a few words)
- Include context, explanations, and specific details where provided
- Aim for 3-6 detailed talking points per slide when available
- Use the exact wording from the document when possible
- Format each point as a complete thought

Return ONLY a valid JSON array with this exact structure:
[
  {
    "slide_number": 1,
    "title": "Brief slide title",
    "talking_points": "• Detailed point 1 with full context and explanation\\n• Detailed point 2 with specific information\\n• Detailed point 3 with complete thought"
  }
]

Make sure every slide (1-${slideTexts.length}) is included. If no talking points match a slide, write "• No specific talking points available for this slide"`
          }]
        })
      });

      console.log('API response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('API error response:', errorText);
        throw new Error(`AI matching failed: ${response.status}`);
      }

      const data = await response.json();
      const content = data.content[0].text;

      // Extract JSON from response
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (!jsonMatch) throw new Error('Could not parse AI response');

      return JSON.parse(jsonMatch[0]);
    } catch (error) {
      console.error('AI matching error:', error);
      throw error;
    }
  };

  const processFiles = async () => {
    if (!presentationFile || !talkingPointsFile) return;

    setStep('ai-processing');

    try {
      // Extract presentation slides
      setProcessingStatus('Reading presentation slides...');
      const { pages: slideTexts } = await extractPDFText(presentationFile);

      // Extract talking points
      setProcessingStatus('Reading talking points document...');
      let talkingPointsText: string;
      if (talkingPointsFile.type === 'application/pdf') {
        const { pages } = await extractPDFText(talkingPointsFile);
        talkingPointsText = pages.join('\n\n');
      } else {
        talkingPointsText = await extractWordText(talkingPointsFile);
      }

      // AI matching
      setProcessingStatus('AI is matching talking points to slides...');
      const matchedSlides = await matchTalkingPointsWithAI(slideTexts, talkingPointsText);

      setSlides(matchedSlides);
      setStep('review');
    } catch (error: any) {
      console.error('Processing error:', error);
      showError(`Error processing files: ${error.message}`);
      setStep('upload');
    }
  };

  const updateSlide = (slideNumber: number, field: 'title' | 'talking_points', value: string) => {
    setSlides(prev => prev.map(slide =>
      slide.slide_number === slideNumber
        ? { ...slide, [field]: value }
        : slide
    ));
  };

  const handleFinalUpload = async () => {
    if (!presentationFile || !user) return;

    setUploading(true);

    try {
      // Upload PDF to storage
      const fileName = `${Date.now()}-${presentationFile.name}`;
      const filePath = `presentations/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('client-presentations')
        .upload(filePath, presentationFile);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('client-presentations')
        .getPublicUrl(filePath);

      // Generate and upload thumbnail
      let thumbnailUrl: string | null = null;
      const thumbnailBlob = await generatePDFThumbnail(presentationFile);

      if (thumbnailBlob) {
        const thumbnailFileName = `thumbnails/${Date.now()}-thumb.jpg`;
        const { error: thumbError } = await supabase.storage
          .from('client-presentations')
          .upload(thumbnailFileName, thumbnailBlob, {
            contentType: 'image/jpeg'
          });

        if (!thumbError) {
          const { data: { publicUrl: thumbUrl } } = supabase.storage
            .from('client-presentations')
            .getPublicUrl(thumbnailFileName);
          thumbnailUrl = thumbUrl;
        }
      }

      // Insert presentation record
      const { data: presentation, error: dbError } = await supabase
        .from('client_presentations')
        .insert({
          name: presentationName,
          description: description || null,
          file_path: filePath,
          file_url: publicUrl,
          thumbnail_url: thumbnailUrl,
          file_type: 'pdf',
          slide_count: slides.length,
          uploaded_by: user.id
        })
        .select()
        .single();

      if (dbError) throw dbError;

      // Insert slides with talking points
      const slidesData = slides.map(slide => ({
        presentation_id: presentation.id,
        slide_number: slide.slide_number,
        title: slide.title,
        talking_points: slide.talking_points
      }));

      const { error: slidesError } = await supabase
        .from('presentation_slides')
        .insert(slidesData);

      if (slidesError) throw slidesError;

      onUploadComplete();
    } catch (error: any) {
      console.error('Upload error:', error);
      showError(`Upload failed: ${error.message}`);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 p-4 pb-20">
      <button
        onClick={onBack}
        className="text-blue-600 font-medium mb-4 flex items-center gap-2"
      >
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      <div className="max-w-4xl mx-auto">
        {/* Upload Step */}
        {step === 'upload' && (
          <div className="bg-white rounded-lg shadow-lg p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Upload New Presentation</h2>

            <div className="space-y-6">
              {/* Presentation Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Presentation Name *
                </label>
                <input
                  type="text"
                  value={presentationName}
                  onChange={(e) => setPresentationName(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Q4 Sales Deck"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description (Optional)
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows={3}
                  placeholder="Main sales presentation for Q4..."
                />
              </div>

              {/* PDF Upload */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Presentation PDF *
                </label>
                <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                  {presentationFile ? (
                    <div className="flex items-center gap-3">
                      <FileText className="w-8 h-8 text-blue-600" />
                      <div className="text-left">
                        <p className="font-medium text-gray-900">{presentationFile.name}</p>
                        <p className="text-sm text-gray-500">
                          {(presentationFile.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>
                    </div>
                  ) : (
                    <>
                      <Upload className="w-8 h-8 text-gray-400 mb-2" />
                      <p className="text-sm text-gray-600">Click to upload PDF presentation</p>
                    </>
                  )}
                  <input
                    type="file"
                    accept=".pdf"
                    onChange={handlePresentationSelect}
                    className="hidden"
                  />
                </label>
              </div>

              {/* Talking Points Upload */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Talking Points Document *
                </label>
                <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                  {talkingPointsFile ? (
                    <div className="flex items-center gap-3">
                      <FileText className="w-8 h-8 text-green-600" />
                      <div className="text-left">
                        <p className="font-medium text-gray-900">{talkingPointsFile.name}</p>
                        <p className="text-sm text-gray-500">
                          {(talkingPointsFile.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>
                    </div>
                  ) : (
                    <>
                      <Upload className="w-8 h-8 text-gray-400 mb-2" />
                      <p className="text-sm text-gray-600">Click to upload PDF or Word document</p>
                      <p className="text-xs text-gray-500 mt-1">AI will match these to your slides</p>
                    </>
                  )}
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx"
                    onChange={handleTalkingPointsSelect}
                    className="hidden"
                  />
                </label>
              </div>

              {/* Process Button */}
              <button
                onClick={processFiles}
                disabled={!presentationFile || !talkingPointsFile || !presentationName}
                className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Wand2 className="w-5 h-5" />
                Process with AI
              </button>
            </div>
          </div>
        )}

        {/* AI Processing Step */}
        {step === 'ai-processing' && (
          <div className="bg-white rounded-lg shadow-lg p-12 text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto mb-6"></div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Processing...</h3>
            <p className="text-gray-600">{processingStatus}</p>
          </div>
        )}

        {/* Review Step */}
        {step === 'review' && (
          <div className="bg-white rounded-lg shadow-lg p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Review AI-Matched Talking Points</h2>
            <p className="text-gray-600 mb-6">Review and edit the talking points for each slide</p>

            <div className="space-y-4 max-h-[600px] overflow-y-auto mb-6">
              {slides.map((slide) => (
                <div key={slide.slide_number} className="border border-gray-200 rounded-lg p-4 hover:border-blue-300 transition-colors">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="bg-blue-100 text-blue-800 text-sm font-semibold px-3 py-1 rounded">
                          Slide {slide.slide_number}
                        </span>
                        {editingSlide === slide.slide_number ? (
                          <input
                            type="text"
                            value={slide.title}
                            onChange={(e) => updateSlide(slide.slide_number, 'title', e.target.value)}
                            className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm"
                            autoFocus
                          />
                        ) : (
                          <h4 className="font-semibold text-gray-900">{slide.title}</h4>
                        )}
                      </div>

                      {editingSlide === slide.slide_number ? (
                        <textarea
                          value={slide.talking_points}
                          onChange={(e) => updateSlide(slide.slide_number, 'talking_points', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                          rows={6}
                        />
                      ) : (
                        <p className="text-sm text-gray-700 whitespace-pre-wrap">{slide.talking_points}</p>
                      )}
                    </div>

                    <button
                      onClick={() => setEditingSlide(editingSlide === slide.slide_number ? null : slide.slide_number)}
                      className="ml-4 p-2 text-gray-600 hover:text-blue-600 transition-colors"
                    >
                      {editingSlide === slide.slide_number ? (
                        <Check className="w-5 h-5" />
                      ) : (
                        <Edit2 className="w-5 h-5" />
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex gap-4">
              <button
                onClick={() => setStep('upload')}
                className="flex-1 px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-50 transition-colors"
              >
                Start Over
              </button>
              <button
                onClick={handleFinalUpload}
                disabled={uploading}
                className="flex-1 px-6 py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition-colors disabled:opacity-50"
              >
                {uploading ? 'Uploading...' : 'Upload Presentation'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
