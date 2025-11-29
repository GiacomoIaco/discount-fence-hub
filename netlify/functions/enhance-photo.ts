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

    // Call Gemini 2.0 Flash with image generation capabilities
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`,
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
                  text: `Transform this fence/construction photo into a premium marketing image that will impress potential customers.

Use your expert judgment to enhance whatever needs improvement - lighting, colors, sharpness, composition, or overall visual appeal. Make it look professional and eye-catching while keeping it realistic.

The goal: create a stunning "after" version that showcases this work at its absolute best.`,
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.7, // Balanced: creative enough for improvements, consistent enough for editing
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

    // Log the full response for debugging
    console.log('Gemini API response:', JSON.stringify(data, null, 2));

    // Check for error responses from Gemini
    if (data.candidates && data.candidates[0]?.finishReason) {
      const finishReason = data.candidates[0].finishReason;

      if (finishReason === 'NO_IMAGE') {
        throw new Error('Gemini declined to generate enhanced image. This may be due to: rate limiting (too many requests), content policy issues, or image quality problems. Please try again in a few moments.');
      }

      if (finishReason !== 'STOP') {
        throw new Error(`Gemini finished with reason: ${finishReason}. Please try again or contact support.`);
      }
    }

    // Extract the enhanced image from response
    // Check multiple possible response formats
    let enhancedImageBase64;

    if (data.candidates && data.candidates[0]?.content?.parts) {
      // Find the part with inline_data (image)
      const imagePart = data.candidates[0].content.parts.find(
        (part: any) => part.inline_data || part.inlineData
      );

      if (imagePart) {
        enhancedImageBase64 = imagePart.inline_data?.data || imagePart.inlineData?.data;
      }
    }

    if (!enhancedImageBase64) {
      console.error('Full API response:', JSON.stringify(data, null, 2));
      throw new Error(`No enhanced image in response. This may indicate rate limiting or an API issue. Please wait a moment and try again.`);
    }

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
