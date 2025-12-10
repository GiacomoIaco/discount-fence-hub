import type { Handler } from '@netlify/functions';

// Intent types the quick recording can route to
export type VoiceIntent = 'todo' | 'roadmap' | 'request' | 'meeting' | 'unknown';

export interface ClassificationResult {
  intent: VoiceIntent;
  confidence: number;
  summary: string;
  // For todos
  todoTitle?: string;
  todoDueDate?: string;
  // For requests
  requestType?: 'pricing' | 'support' | 'material' | 'other';
}

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('Anthropic API key not configured');
    }

    const { transcript } = JSON.parse(event.body || '{}');

    if (!transcript) {
      throw new Error('No transcript provided');
    }

    const prompt = `You are analyzing a voice recording from a fence company app user. Classify the intent and extract key information.

**User said**: "${transcript}"

**Intent Categories**:
1. **todo** - Personal task/reminder (e.g., "remind me to...", "I need to...", "don't forget...", "call back...", "follow up with...")
2. **roadmap** - App feature idea/suggestion (e.g., "we should add...", "it would be nice if...", "feature idea...", "what if the app could...")
3. **request** - Business request needing ops attention (e.g., "need pricing for...", "customer asking about...", "need quote...", "material request...")
4. **meeting** - Sales meeting debrief for coaching (e.g., "just had a meeting with...", "finished call with...", "client said...", longer detailed meeting recap)
5. **unknown** - Can't determine intent clearly

**Request Sub-types** (if intent is 'request'):
- pricing: Customer needs a quote
- support: Issue or question needing help
- material: Need specific materials
- other: Other business request

Analyze the content and respond ONLY with valid JSON:
{
  "intent": "todo|roadmap|request|meeting|unknown",
  "confidence": 0.0-1.0,
  "summary": "one-line summary of what they said",
  "todoTitle": "if todo: suggested task title",
  "todoDueDate": "if todo and mentioned: ISO date string or null",
  "requestType": "if request: pricing|support|material|other"
}`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 512,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Claude API request failed');
    }

    const data = await response.json();
    const content = data.content[0].text;

    // Extract JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Failed to parse Claude response');
    }

    const parsed = JSON.parse(jsonMatch[0]) as ClassificationResult;

    return {
      statusCode: 200,
      body: JSON.stringify(parsed),
    };
  } catch (error) {
    console.error('Classify voice intent error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: error instanceof Error ? error.message : 'Classification failed'
      }),
    };
  }
};
