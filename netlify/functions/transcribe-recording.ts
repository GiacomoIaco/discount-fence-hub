import type { Handler } from '@netlify/functions';
import FormData from 'form-data';
import axios from 'axios';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const apiKey = process.env.VITE_ASSEMBLYAI_API_KEY;
    console.log('API Key present:', !!apiKey);
    console.log('API Key prefix:', apiKey ? apiKey.substring(0, 10) + '...' : 'MISSING');

    if (!apiKey) {
      throw new Error('AssemblyAI API key not configured');
    }

    const { audioData } = JSON.parse(event.body || '{}');
    console.log('Audio data received:', !!audioData);
    console.log('Audio data size:', audioData ? audioData.length : 0);

    if (!audioData) {
      throw new Error('No audio data provided');
    }

    // Convert base64 to buffer
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

    // Step 3: Poll for completion (with timeout)
    let transcript: any = { status: 'processing' };
    let attempts = 0;
    const maxAttempts = 60; // 3 minutes max

    while (transcript.status !== 'completed' && transcript.status !== 'error' && attempts < maxAttempts) {
      await sleep(3000);

      const statusResponse = await axios.get(
        `https://api.assemblyai.com/v2/transcript/${transcriptId}`,
        {
          headers: {
            'authorization': apiKey
          }
        }
      );

      transcript = statusResponse.data;
      attempts++;
      console.log(`Transcription status: ${transcript.status} (attempt ${attempts}/${maxAttempts})`);
    }

    if (transcript.status === 'error') {
      throw new Error(`Transcription failed: ${transcript.error}`);
    }

    if (transcript.status !== 'completed') {
      throw new Error('Transcription timeout - file may be too long');
    }

    // Step 4: Format transcript with speaker labels
    const formattedText = transcript.utterances?.map((utterance: any) => {
      const speaker = utterance.speaker === 'A' ? 'Sales Rep' : 'Client';
      return `${speaker}: ${utterance.text}`;
    }).join('\n\n') || transcript.text;

    // Calculate duration in MM:SS format
    const durationMs = transcript.audio_duration * 1000;
    const minutes = Math.floor(durationMs / 60000);
    const seconds = Math.floor((durationMs % 60000) / 1000);
    const duration = `${minutes}:${seconds.toString().padStart(2, '0')}`;

    return {
      statusCode: 200,
      body: JSON.stringify({
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
        ],
        rawData: transcript
      }),
    };
  } catch (error: any) {
    console.error('Transcription error:', error.response?.data || error.message);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: error.response?.data?.error || error.message || 'Transcription failed'
      }),
    };
  }
};
