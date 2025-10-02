import type { Handler } from '@netlify/functions';
import FormData from 'form-data';

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { audioData, userId, clientName, meetingDate, processType } = JSON.parse(event.body || '{}');

    if (!audioData) {
      throw new Error('No audio data provided');
    }

    // Convert base64 to buffer
    const audioBuffer = Buffer.from(audioData, 'base64');

    // Generate unique recording ID
    const recordingId = `rec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Store recording metadata in localStorage (will be handled by client)
    // In production, this would save to Supabase or S3

    return {
      statusCode: 200,
      body: JSON.stringify({
        recordingId,
        userId,
        clientName,
        meetingDate,
        processType: processType || 'standard',
        status: 'uploaded',
        uploadedAt: new Date().toISOString(),
        message: 'Recording uploaded successfully. Starting transcription...'
      }),
    };
  } catch (error: any) {
    console.error('Upload error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: error.message || 'Upload failed'
      }),
    };
  }
};
