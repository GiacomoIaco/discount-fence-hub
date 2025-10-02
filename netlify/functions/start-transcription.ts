import type { Handler } from '@netlify/functions';
import axios from 'axios';

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const apiKey = process.env.VITE_ASSEMBLYAI_API_KEY;
    if (!apiKey) {
      throw new Error('AssemblyAI API key not configured');
    }

    const { audioData } = JSON.parse(event.body || '{}');
    if (!audioData) {
      throw new Error('No audio data provided');
    }

    const audioBuffer = Buffer.from(audioData, 'base64');

    // Step 1: Upload audio file to AssemblyAI
    console.log('Uploading audio to AssemblyAI...');
    const uploadResponse = await axios.post(
      'https://api.assemblyai.com/v2/upload',
      audioBuffer,
      {
        headers: {
          'authorization': apiKey,
          'content-type': 'application/octet-stream'
        }
      }
    );

    const audioUrl = uploadResponse.data.upload_url;
    console.log('Audio uploaded:', audioUrl);

    // Step 2: Request transcription with speaker diarization
    console.log('Requesting transcription...');
    const transcriptResponse = await axios.post(
      'https://api.assemblyai.com/v2/transcript',
      {
        audio_url: audioUrl,
        speaker_labels: true,
        speakers_expected: 2,
        punctuate: true,
        format_text: true
      },
      {
        headers: {
          'authorization': apiKey,
          'content-type': 'application/json'
        }
      }
    );

    const transcriptId = transcriptResponse.data.id;
    console.log('Transcription started:', transcriptId);

    // Return immediately with the transcript ID
    // Frontend will poll for completion
    return {
      statusCode: 200,
      body: JSON.stringify({
        transcriptId: transcriptId,
        status: 'processing'
      }),
    };
  } catch (error: any) {
    console.error('Start transcription error:', error.response?.data || error.message);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: error.response?.data?.error || error.message || 'Failed to start transcription'
      }),
    };
  }
};
