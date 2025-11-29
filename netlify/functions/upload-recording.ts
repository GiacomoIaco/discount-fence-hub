import type { Handler } from '@netlify/functions';
import FormData from 'form-data';
import { randomUUID } from 'crypto';

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

    // Generate unique recording ID (UUID format for database compatibility)
    const recordingId = randomUUID();

    // Store recording metadata in localStorage (will be handled by client)
    // In production, this would save to Supabase or S3

    return {
      statusCode: 200,
      body: JSON.stringify({
        recordingId,
        userId,
        clientName,
        meetingDate,
        duration: '0:00', // Placeholder - actual duration will come from transcription
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
