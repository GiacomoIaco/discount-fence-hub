import type { Handler } from '@netlify/functions';

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const apiKey = process.env.VITE_OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OpenAI API key not configured');
    }

    // The body contains the base64 encoded audio
    const { audioData } = JSON.parse(event.body || '{}');

    // Convert base64 to blob
    const audioBlob = Buffer.from(audioData, 'base64');

    const formData = new FormData();
    formData.append('file', new Blob([audioBlob], { type: 'audio/webm' }), 'audio.webm');
    formData.append('model', 'whisper-1');

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Transcription failed');
    }

    const data = await response.json();

    return {
      statusCode: 200,
      body: JSON.stringify({ text: data.text }),
    };
  } catch (error) {
    console.error('Transcription error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: error instanceof Error ? error.message : 'Transcription failed'
      }),
    };
  }
};
