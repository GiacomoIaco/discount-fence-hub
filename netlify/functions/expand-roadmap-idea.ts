import type { Handler } from '@netlify/functions';

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const apiKey = process.env.ANTHROPIC_API_KEY || process.env.VITE_ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('Anthropic API key not configured');
    }

    const { transcript } = JSON.parse(event.body || '{}');

    const prompt = `You are an AI assistant helping expand and structure roadmap ideas for a software development team.

A team member just recorded a voice memo about a feature idea or improvement. Your job is to:
1. Extract a clear, concise title
2. Suggest which hub/category this belongs to
3. Estimate importance and complexity
4. Expand and articulate the raw idea into a well-structured description
5. Add implementation thoughts, best practices, and considerations

Voice transcript: "${transcript}"

Available hubs:
- ops-hub: Operations Hub - BOM calculator, yard management, pick lists, inventory
- requests: Request Hub - pricing requests, material requests, support tickets
- chat: Chat - messaging, notifications, communication features
- analytics: Analytics - reporting, dashboards, data visualization
- settings: Settings - configuration, user management, system settings
- general: General - cross-cutting concerns, infrastructure, general improvements
- leadership: Leadership - executive tools, KPIs, business intelligence
- future: Future - long-term vision, major initiatives, R&D

Complexity levels:
- XS: Very simple, < 1 hour, minor text/config change
- S: Simple, 1-4 hours, single file change
- M: Medium, 4-16 hours, few files, some logic
- L: Large, 1-3 days, multiple components, backend work
- XL: Extra Large, 3+ days, complex feature, multiple systems

Respond ONLY with valid JSON in this exact format:
{
  "title": "concise professional title for the feature/idea",
  "hub": "one of: ops-hub, requests, chat, analytics, settings, general, leadership, future",
  "importance": 1-5 (5 being most important),
  "complexity": "XS|S|M|L|XL",
  "raw_idea": "cleaned up version of what the user said, preserving their voice",
  "claude_analysis": "Expanded analysis with implementation considerations, best practices, potential challenges, and suggested approach. Be specific and actionable."
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
        max_tokens: 2048,
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

    const parsed = JSON.parse(jsonMatch[0]);

    return {
      statusCode: 200,
      body: JSON.stringify(parsed),
    };
  } catch (error) {
    console.error('Expand roadmap idea error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: error instanceof Error ? error.message : 'Expansion failed'
      }),
    };
  }
};
