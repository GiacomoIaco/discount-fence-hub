import type { Handler } from '@netlify/functions';
import FormData from 'form-data';
import axios from 'axios';
import { AI_MODELS } from './lib/ai-models';

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const body = JSON.parse(event.body || '{}');

    let audioBuffer: Buffer;
    let contentType = 'audio/webm';

    // Support both base64 data (small files) and storage URLs (large files)
    if (body.audioUrl) {
      // Fetch from Supabase storage
      console.log('Fetching audio from storage URL...');

      const response = await axios.get(body.audioUrl, {
        responseType: 'arraybuffer',
        timeout: 60000, // 60 second timeout for download
      });

      audioBuffer = Buffer.from(response.data);
      contentType = response.headers['content-type'] || 'audio/webm';

      console.log(`Downloaded audio: ${audioBuffer.length} bytes`);
    } else if (body.audioData) {
      // Legacy: base64 encoded audio (for small files < 1MB)
      audioBuffer = Buffer.from(body.audioData, 'base64');
    } else {
      throw new Error('Either audioUrl or audioData is required');
    }

    // Check file size (API limit is 25MB)
    const maxSize = 25 * 1024 * 1024;
    if (audioBuffer.length > maxSize) {
      throw new Error(`Audio file too large (${Math.round(audioBuffer.length / 1024 / 1024)}MB). Maximum is 25MB.`);
    }

    // Create FormData — no language param = auto-detect
    const formData = new FormData();
    formData.append('file', audioBuffer, {
      filename: 'audio.webm',
      contentType: contentType,
    });
    formData.append('model', AI_MODELS.transcription);
    formData.append('response_format', 'verbose_json');

    console.log(`Sending to transcription API (model: ${AI_MODELS.transcription})...`);

    const response = await axios.post(
      'https://api.openai.com/v1/audio/transcriptions',
      formData,
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          ...formData.getHeaders(),
        },
        timeout: 120000, // 2 minute timeout for transcription
      }
    );

    const detectedLanguage = response.data.language || undefined;
    console.log(`Transcription complete (detected language: ${detectedLanguage || 'unknown'})`);

    return {
      statusCode: 200,
      body: JSON.stringify({
        text: response.data.text,
        detectedLanguage,
      }),
    };
  } catch (error: any) {
    console.error('Transcription error:', error.response?.data || error.message);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: error.response?.data?.error?.message || error.message || 'Transcription failed'
      }),
    };
  }
};
