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
    let contentType = body.mimeType || 'audio/webm';

    // Map MIME type to file extension for OpenAI
    const ext = contentType.includes('mp4') || contentType.includes('m4a') ? 'mp4'
      : contentType.includes('ogg') ? 'ogg'
      : contentType.includes('wav') ? 'wav'
      : 'webm';

    // Support both base64 data (small files) and storage URLs (large files)
    if (body.audioUrl) {
      // Fetch from Supabase storage
      console.log('Fetching audio from storage URL...');

      const response = await axios.get(body.audioUrl, {
        responseType: 'arraybuffer',
        timeout: 60000, // 60 second timeout for download
      });

      audioBuffer = Buffer.from(response.data);
      contentType = response.headers['content-type'] || contentType;

      console.log(`Downloaded audio: ${audioBuffer.length} bytes`);
    } else if (body.audioData) {
      // Base64 encoded audio (for small files < 1MB)
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
    // gpt-4o-mini-transcribe only supports "json" and "text" (NOT verbose_json)
    const formData = new FormData();
    formData.append('file', audioBuffer, {
      filename: `audio.${ext}`,
      contentType: contentType,
    });
    formData.append('model', AI_MODELS.transcription);
    formData.append('response_format', 'json');

    console.log(`Sending to transcription API (model: ${AI_MODELS.transcription}, type: ${contentType})...`);

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

    const transcribedText: string = response.data.text;
    console.log('Transcription complete');

    // gpt-4o-mini-transcribe doesn't return language, so detect it with a cheap chat call
    let detectedLanguage: string | undefined;
    if (transcribedText.length >= 3) {
      try {
        const langResponse = await axios.post(
          'https://api.openai.com/v1/chat/completions',
          {
            model: 'gpt-4o-mini',
            messages: [
              { role: 'system', content: 'Reply with ONLY the ISO 639-1 language code (e.g. en, es, fr). Nothing else.' },
              { role: 'user', content: transcribedText.slice(0, 200) },
            ],
            max_tokens: 4,
            temperature: 0,
          },
          {
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
            },
            timeout: 5000,
          }
        );
        detectedLanguage = langResponse.data.choices?.[0]?.message?.content?.trim().toLowerCase();
        console.log(`Detected language: ${detectedLanguage}`);
      } catch (langErr) {
        console.warn('Language detection failed, continuing without:', langErr);
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        text: transcribedText,
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
