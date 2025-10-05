import { Handler } from '@netlify/functions';
import OpenAI from 'openai';

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
  confidenceScore: number;
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

    const apiKey = process.env.OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY not configured in Netlify environment variables');
    }

    const openai = new OpenAI({ apiKey });

    // Create prompt for GPT-5 Vision
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

5. **Provide a confidence score** (0-100) for how certain you are about the tags
   - 80-100: High confidence - clearly identifiable
   - 60-79: Medium confidence - likely correct but some uncertainty
   - 0-59: Low confidence - significant uncertainty

6. **Provide brief analysis notes** explaining your ratings and any recommendations.

IMPORTANT:
- Only select tags that you are confident about (>70% confidence)
- If you can't identify something clearly, don't guess
- Multiple product types can be tagged if multiple structures are visible
- Be specific with materials and styles

Respond ONLY with valid JSON in this exact format:
{
  "suggestedTags": ["tag1", "tag2", "tag3"],
  "qualityScore": 7,
  "confidenceScore": 85,
  "analysisNotes": "Brief description of what you see and quality assessment"
}`;

    // Call GPT-5 Vision API
    const response = await openai.chat.completions.create({
      model: 'gpt-5-2025-08-07',
      max_completion_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: {
                url: `data:image/jpeg;base64,${imageBase64}`,
              },
            },
            {
              type: 'text',
              text: prompt,
            },
          ],
        },
      ],
      response_format: { type: 'json_object' },
    });

    // Parse the JSON response
    const analysisResult: AnalysisResult = JSON.parse(response.choices[0].message.content || '{}');

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

    // Log full error details for debugging
    if (error && typeof error === 'object') {
      console.error('Error details:', JSON.stringify(error, null, 2));
    }

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Failed to analyze photo',
        details: error instanceof Error ? error.message : 'Unknown error',
        fullError: error && typeof error === 'object' ? JSON.stringify(error) : String(error),
      }),
    };
  }
};
