import type { Handler } from '@netlify/functions';

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
    const apiKey = process.env.ANTHROPIC_API_KEY;

    if (!apiKey) {
      throw new Error('Anthropic API key not configured');
    }

    // Get data from client
    const { slideTexts, talkingPointsText } = JSON.parse(event.body || '{}');

    if (!slideTexts || !Array.isArray(slideTexts)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'slideTexts must be an array' })
      };
    }

    if (!talkingPointsText || typeof talkingPointsText !== 'string') {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'talkingPointsText must be a string' })
      };
    }

    console.log('Processing', slideTexts.length, 'slides with talking points');

    // Call Claude API from server-side (secure!)
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,  // ✅ Only exists on server
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 4000,
        messages: [{
          role: 'user',
          content: `You are helping match talking points to presentation slides for a sales presentation.

I have ${slideTexts.length} slides with the following content:
${slideTexts.map((text: string, i: number) => `Slide ${i + 1}: ${text.substring(0, 250)}...`).join('\n\n')}

And these talking points:
${talkingPointsText}

Please match the talking points to the appropriate slides. For each slide, provide:
1. A brief, descriptive title (4-6 words)
2. Detailed talking points from the document that relate to that slide

IMPORTANT:
- Include ALL relevant details from the talking points document for each slide
- Each talking point should be a complete sentence or phrase (not just a few words)
- Include context, explanations, and specific details where provided
- Aim for 3-6 detailed talking points per slide when available
- Use the exact wording from the document when possible
- Format each point as a complete thought

Return ONLY a valid JSON array with this exact structure:
[
  {
    "slide_number": 1,
    "title": "Brief slide title",
    "talking_points": "• First detailed point\\n• Second detailed point\\n• Third detailed point"
  },
  {
    "slide_number": 2,
    "title": "Another slide title",
    "talking_points": "• First point here\\n• Second point here"
  }
]

CRITICAL: Return ONLY the JSON array. No explanation, no markdown, no code blocks. Just the raw JSON array.`
        }],
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('Claude API error:', error);
      throw new Error(error.error?.message || 'Claude API request failed');
    }

    const data = await response.json();
    const content = data.content[0].text;

    // Extract JSON from response
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      console.error('Failed to parse Claude response:', content);
      throw new Error('Failed to parse Claude response');
    }

    const slides = JSON.parse(jsonMatch[0]);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ slides }),
    };
  } catch (error: any) {
    console.error('Error matching talking points:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: error.message || 'Failed to match talking points'
      }),
    };
  }
};
