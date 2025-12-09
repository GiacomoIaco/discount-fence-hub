// OpenAI Whisper API integration for voice transcription via Netlify function

import { supabase } from './supabase';

// Threshold for using storage upload (500KB - well under Netlify's 1MB limit)
const STORAGE_THRESHOLD = 500 * 1024;

export async function transcribeAudio(audioBlob: Blob): Promise<string> {
  try {
    // Check file size to determine upload method
    if (audioBlob.size > STORAGE_THRESHOLD) {
      return await transcribeViaStorage(audioBlob);
    } else {
      return await transcribeViaBase64(audioBlob);
    }
  } catch (error) {
    console.error('Whisper API error:', error);
    throw error;
  }
}

// For small files: send base64 directly (faster for short recordings)
async function transcribeViaBase64(audioBlob: Blob): Promise<string> {
  const arrayBuffer = await audioBlob.arrayBuffer();
  const base64Audio = btoa(
    new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
  );

  const response = await fetch('/.netlify/functions/transcribe', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      audioData: base64Audio,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Transcription failed');
  }

  const data = await response.json();
  return data.text;
}

// For large files: upload to storage first, then transcribe
// Uses existing 'voice-samples' bucket with temp/ folder for roadmap recordings
async function transcribeViaStorage(audioBlob: Blob): Promise<string> {
  // Get current user
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('Must be logged in to transcribe audio');
  }

  // Generate unique filename in temp folder (will be deleted after transcription)
  const timestamp = Date.now();
  const filename = `temp/${user.id}/${timestamp}.webm`;

  console.log(`Uploading audio to storage (${Math.round(audioBlob.size / 1024)}KB)...`);

  // Upload to Supabase storage (reusing voice-samples bucket)
  const { error: uploadError } = await supabase.storage
    .from('voice-samples')
    .upload(filename, audioBlob, {
      contentType: 'audio/webm',
      upsert: false,
    });

  if (uploadError) {
    throw new Error(`Failed to upload audio: ${uploadError.message}`);
  }

  try {
    // Get signed URL (valid for 5 minutes)
    const { data: urlData, error: urlError } = await supabase.storage
      .from('voice-samples')
      .createSignedUrl(filename, 300);

    if (urlError || !urlData?.signedUrl) {
      throw new Error(`Failed to create signed URL: ${urlError?.message}`);
    }

    console.log('Sending to transcribe function...');

    // Call transcribe function with URL
    const response = await fetch('/.netlify/functions/transcribe', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        audioUrl: urlData.signedUrl,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Transcription failed');
    }

    const data = await response.json();
    return data.text;
  } finally {
    // Always clean up the uploaded file
    console.log('Cleaning up storage...');
    await supabase.storage
      .from('voice-samples')
      .remove([filename]);
  }
}
