import { Handler } from '@netlify/functions';
import Anthropic from '@anthropic-ai/sdk';
import { AI_MODELS } from './lib/ai-models';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export const handler: Handler = async (event) => {
  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    const { documentText, documentType, isImage, imageData } = JSON.parse(event.body || '{}');

    if (!documentText && !imageData) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Document text or image data is required' }),
      };
    }

    const systemPrompt = `You are an expert at extracting structured knowledge base information from company documents.
Your task is to analyze the provided document and extract information relevant to a sales team's knowledge base.

Extract the following categories of information:
1. **Company Information**: Company overview, mission, values, unique selling points, history
2. **Products/Services**: List of products or services offered with key features
3. **Common Objections & Responses**: Customer objections and how to handle them
4. **Best Practices**: Sales techniques, customer service tips, proven approaches
5. **Industry Context**: Market trends, competitive landscape, industry-specific information

Respond ONLY with a valid JSON object in this exact format:
{
  "companyInfo": "Comprehensive company information as a single string...",
  "products": ["Product/Service 1 with description", "Product/Service 2 with description", ...],
  "commonObjections": ["Objection: Response", "Objection: Response", ...],
  "bestPractices": ["Best practice 1", "Best practice 2", ...],
  "industryContext": "Industry context information as a single string...",
  "confidence": {
    "overall": 85,
    "companyInfo": 90,
    "products": 80,
    "commonObjections": 75,
    "bestPractices": 85,
    "industryContext": 70
  },
  "suggestions": ["Suggestion for additional information that would be helpful", ...]
}

Important:
- Extract as much relevant information as possible
- If a category has no relevant information, use empty string or empty array
- Include confidence scores (0-100) for each category
- Add suggestions for what additional information would improve the knowledge base
- Keep responses factual and based on the document content`;

    let response;

    if (isImage && imageData) {
      // Handle image with Claude Vision
      const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');
      const mediaType = imageData.match(/^data:(image\/\w+);base64,/)?.[1] || 'image/jpeg';

      response = await anthropic.messages.create({
        model: AI_MODELS.claudeVision,
        max_tokens: 4096,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: mediaType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
                  data: base64Data,
                },
              },
              {
                type: 'text',
                text: `Analyze this ${documentType} and extract knowledge base information.\n\n${systemPrompt}`,
              },
            ],
          },
        ],
      });
    } else {
      // Handle text documents
      response = await anthropic.messages.create({
        model: AI_MODELS.claude,
        max_tokens: 4096,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: `Analyze this ${documentType} and extract knowledge base information:\n\n${documentText}`,
          },
        ],
      });
    }

    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type');
    }

    // Extract JSON from the response
    let jsonMatch = content.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Failed to parse knowledge base from document');
    }

    const parsedKB = JSON.parse(jsonMatch[0]);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(parsedKB),
    };
  } catch (error) {
    console.error('Parse knowledge base error:', error);

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Failed to parse document',
        details: error instanceof Error ? error.message : 'Unknown error',
      }),
    };
  }
};
