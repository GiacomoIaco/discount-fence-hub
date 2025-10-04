import { Handler } from '@netlify/functions';
import Anthropic from '@anthropic-ai/sdk';

// Tag categories for photo classification
const TAG_CATEGORIES = {
  productType: [
    'Wood Vertical Fence',
    'Wood Horizontal Fence',
    'Iron Fence',
    'Farm/Ranch Style Fence',
    'Vinyl Fence',
    'Aluminum & Composite Fence',
    'Chain Link',
    'Railing',
    'Automatic Gates',
    'Retaining Wall',
    'Decks',
    'Pergola'
  ],
  material: [
    'Wood',
    'Iron',
    'Aluminum',
    'Composite',
    'Vinyl',
    'Glass',
    'Cable'
  ],
  style: [
    'Shadow Box',
    'Board on Board',
    'Exposed Post',
    'Cap & Trim',
    'Good Neighbor',
    'Stained'
  ]
};

interface AnalysisResult {
  suggestedTags: string[];
  qualityScore: number;
  analysisNotes: string;
}

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

    // Try both VITE_ prefixed (from build) and non-prefixed (Netlify env vars)
    const apiKey = process.env.ANTHROPIC_API_KEY || process.env.VITE_ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY not configured in Netlify environment variables');
    }

    const anthropic = new Anthropic({ apiKey });

    // Create prompt for Claude Vision
    const prompt = `You are analyzing a photo for Discount Fence USA's photo gallery. Your task is to:

1. **Identify the fence/structure type** from these options:
${TAG_CATEGORIES.productType.map(t => `   - ${t}`).join('\n')}

2. **Identify the material** from these options:
${TAG_CATEGORIES.material.map(t => `   - ${t}`).join('\n')}

3. **Identify the style** from these options (if applicable):
${TAG_CATEGORIES.style.map(t => `   - ${t}`).join('\n')}

4. **Rate the photo quality** (1-10) based on:
   - Image sharpness and clarity
   - Lighting quality (not too dark/bright)
   - Composition (fence is clearly visible and centered)
   - Professional presentation value

5. **Provide brief analysis notes** explaining your ratings and any recommendations.

IMPORTANT:
- Only select tags that you are confident about (>70% confidence)
- If you can't identify something clearly, don't guess
- Multiple product types can be tagged if multiple structures are visible
- Be specific with materials and styles

Respond ONLY with valid JSON in this exact format:
{
  "suggestedTags": ["tag1", "tag2", "tag3"],
  "qualityScore": 7,
  "analysisNotes": "Brief description of what you see and quality assessment"
}`;

    // Call Claude Vision API
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: 'image/jpeg',
                data: imageBase64,
              },
            },
            {
              type: 'text',
              text: prompt,
            },
          ],
        },
      ],
    });

    // Extract the text content
    const textContent = response.content.find(block => block.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      throw new Error('No text response from Claude');
    }

    // Parse the JSON response
    const analysisResult: AnalysisResult = JSON.parse(textContent.text);

    // Validate quality score
    if (analysisResult.qualityScore < 1 || analysisResult.qualityScore > 10) {
      analysisResult.qualityScore = Math.max(1, Math.min(10, analysisResult.qualityScore));
    }

    // Validate tags are from our predefined categories
    const allValidTags = [
      ...TAG_CATEGORIES.productType,
      ...TAG_CATEGORIES.material,
      ...TAG_CATEGORIES.style,
    ];
    analysisResult.suggestedTags = analysisResult.suggestedTags.filter(tag =>
      allValidTags.includes(tag)
    );

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(analysisResult),
    };
  } catch (error) {
    console.error('Photo analysis error:', error);

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Failed to analyze photo',
        details: error instanceof Error ? error.message : 'Unknown error',
      }),
    };
  }
};
