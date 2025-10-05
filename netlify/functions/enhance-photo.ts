import { Handler } from '@netlify/functions';

export const handler: Handler = async (event) => {
  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };

  // Handle preflight request
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: '',
    };
  }

  // Only allow POST
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    const { imageBase64 } = JSON.parse(event.body || '{}');

    if (!imageBase64) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing imageBase64 parameter' }),
      };
    }

    const apiKey = process.env.GOOGLE_API_KEY || process.env.VITE_GOOGLE_API_KEY;
    if (!apiKey) {
      throw new Error('GOOGLE_API_KEY not configured in Netlify environment variables');
    }

    // Call Gemini 2.5 Flash Image API for enhancement
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  inline_data: {
                    mime_type: 'image/jpeg',
                    data: imageBase64,
                  },
                },
                {
                  text: 'Enhance this fence/construction photo: improve brightness and clarity, sharpen details, reduce noise, enhance colors naturally while maintaining realistic look. Make it suitable for professional portfolio display.',
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.4,
            responseModalities: ['image'],
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Gemini API error:', errorText);
      throw new Error(`Gemini API error: ${response.status}`);
    }

    const data = await response.json();

    // Extract the enhanced image from response
    if (!data.candidates || !data.candidates[0]?.content?.parts?.[0]?.inline_data) {
      throw new Error('No enhanced image in response');
    }

    const enhancedImageBase64 = data.candidates[0].content.parts[0].inline_data.data;

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        enhancedImageBase64,
      }),
    };
  } catch (error) {
    console.error('Photo enhancement error:', error);

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Failed to enhance photo',
        details: error instanceof Error ? error.message : 'Unknown error',
      }),
    };
  }
};
