import type { Handler } from '@netlify/functions';
import axios from 'axios';

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const apiKey = process.env.ASSEMBLYAI_API_KEY;
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

      // Duration as string "M:SS" for display
      const durationSeconds = Math.round(transcript.audio_duration || 0);
      const minutes = Math.floor(durationSeconds / 60);
      const seconds = durationSeconds % 60;
      const duration = `${minutes}:${seconds.toString().padStart(2, '0')}`;

      // Count speaker segments
      const speakerACount = transcript.utterances?.filter((u: any) => u.speaker === 'A').length || 0;
      const speakerBCount = transcript.utterances?.filter((u: any) => u.speaker === 'B').length || 0;

      // Return flat structure matching Recording.transcription interface
      return {
        statusCode: 200,
        body: JSON.stringify({
          status: 'completed',
          text: formattedText,
          duration: duration, // String format "M:SS"
          confidence: Math.round((transcript.confidence || 0) * 100),
          speakers: [
            {
              id: 'A',
              label: 'Sales Rep',
              segments: speakerACount
            },
            {
              id: 'B',
              label: 'Client',
              segments: speakerBCount
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
