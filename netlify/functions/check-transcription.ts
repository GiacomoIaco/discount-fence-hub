import type { Handler } from '@netlify/functions';
import axios from 'axios';

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const apiKey = process.env.VITE_ASSEMBLYAI_API_KEY;
    if (!apiKey) {
      throw new Error('AssemblyAI API key not configured');
    }

    const transcriptId = event.queryStringParameters?.id;
    if (!transcriptId) {
      throw new Error('No transcript ID provided');
    }

    console.log('Checking transcription status:', transcriptId);

    const statusResponse = await axios.get(
      `https://api.assemblyai.com/v2/transcript/${transcriptId}`,
      {
        headers: {
          'authorization': apiKey
        }
      }
    );

    const transcript = statusResponse.data;
    console.log('Transcription status:', transcript.status);

    // If still processing, return status
    if (transcript.status === 'processing' || transcript.status === 'queued') {
      return {
        statusCode: 200,
        body: JSON.stringify({
          status: 'processing'
        }),
      };
    }

    // If error
    if (transcript.status === 'error') {
      throw new Error(`Transcription failed: ${transcript.error}`);
    }

    // If completed, format and return
    if (transcript.status === 'completed') {
      const formattedText = transcript.utterances?.map((utterance: any) => {
        const speaker = utterance.speaker === 'A' ? 'Sales Rep' : 'Client';
        return `${speaker}: ${utterance.text}`;
      }).join('\n\n') || transcript.text;

      const durationMs = transcript.audio_duration * 1000;
      const minutes = Math.floor(durationMs / 60000);
      const seconds = Math.floor((durationMs % 60000) / 1000);
      const duration = `${minutes}:${seconds.toString().padStart(2, '0')}`;

      return {
        statusCode: 200,
        body: JSON.stringify({
          status: 'completed',
          text: formattedText,
          duration: duration,
          confidence: transcript.confidence,
          speakers: [
            {
              id: 'A',
              label: 'Sales Rep',
              segments: transcript.utterances?.filter((u: any) => u.speaker === 'A').length || 0
            },
            {
              id: 'B',
              label: 'Client',
              segments: transcript.utterances?.filter((u: any) => u.speaker === 'B').length || 0
            }
          ]
        }),
      };
    }

    // Unknown status
    return {
      statusCode: 200,
      body: JSON.stringify({
        status: transcript.status
      }),
    };

  } catch (error: any) {
    console.error('Check transcription error:', error.response?.data || error.message);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: error.response?.data?.error || error.message || 'Failed to check transcription'
      }),
    };
  }
};
