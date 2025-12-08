import type { Handler } from '@netlify/functions';
import FormData from 'form-data';
import axios from 'axios';

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OpenAI API key not configured');
    }

    // The body contains the base64 encoded audio
    const { audioData } = JSON.parse(event.body || '{}');

    // Convert base64 to buffer
    const audioBuffer = Buffer.from(audioData, 'base64');

    // Create FormData
    const formData = new FormData();
    formData.append('file', audioBuffer, {
      filename: 'audio.webm',
      contentType: 'audio/webm',
    });
    formData.append('model', 'whisper-1');
    // Limit language to English and Spanish to improve accuracy
    formData.append('language', 'en');

    const response = await axios.post(
      'https://api.openai.com/v1/audio/transcriptions',
      formData,
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          ...formData.getHeaders(),
        },
      }
    );

    return {
      statusCode: 200,
      body: JSON.stringify({ text: response.data.text }),
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
