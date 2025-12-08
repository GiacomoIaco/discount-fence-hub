import type { Handler } from '@netlify/functions';

// App context for UX-focused analysis
const APP_CONTEXT = `
## Discount Fence Hub - App Context

**Business**: Discount Fence Enterprises USA - fence installation company in South Florida.

**Users**:
- Sales Reps (mobile-first): Field workers using phone/tablet for quotes, photos, AI coach
- Yard Workers (mobile-only): Pick materials from yard, stage for delivery, use QR codes
- Operations Managers (desktop): Manage request queue, assignments, scheduling
- Leadership: Track KPIs, operating plans, business intelligence

**Core Workflow**: Sales creates quote → BOM generated → Pick list created → Yard picks materials → Staged → Loaded → Delivered

**Key Features**:
- Ops Hub: BOM Calculator (fence quotes), Pick Lists, Yard Mobile interface
- Requests: Pricing/support/material requests with queue management
- Communication: Team announcements, direct messages, chat
- Sales Tools: AI Sales Coach, Pre-Stain Calculator, Photo Gallery
- Analytics: Sales, operations, and yard performance dashboards
- Leadership Hub: Operating plans, function workspaces, KPI tracking

**UX Patterns**:
- Mobile: Large touch targets, collapsible headers, card-based lists
- Desktop: Sidebar navigation, queue views with filters
- Role-based visibility: Features shown/hidden per user role
- Real-time updates for pick lists, chat, notifications

**Integrations**: ServiceTitan (planned export), QuickBooks Online (planned sync)
`;

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const apiKey = process.env.ANTHROPIC_API_KEY || process.env.VITE_ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('Anthropic API key not configured');
    }

    const { rawIdea, transcript } = JSON.parse(event.body || '{}');
    const ideaText = rawIdea || transcript;

    const prompt = `You are a UX strategist helping analyze roadmap ideas for the Discount Fence Hub app.

${APP_CONTEXT}

A team member shared this idea:
"${ideaText}"

**Your job**: Provide UX-focused analysis that helps prioritize and shape this feature. Focus on user experience, workflows, and business value - NOT technical implementation (that's handled separately during development).

**Hub Categories**:
- ops-hub: BOM calculator, yard management, pick lists
- requests: Pricing/support/material request workflows
- chat: Messaging, notifications, team communication
- analytics: Reporting, dashboards, KPIs
- settings: Configuration, user management
- general: Cross-cutting, app-wide improvements
- leadership: Executive tools, operating plans
- future: Long-term vision, major initiatives

**Complexity** (effort to design + build):
- XS: Tiny tweak (<1hr)
- S: Small (few hours)
- M: Medium (1 day)
- L: Large (few days)
- XL: Major initiative (week+)

Respond ONLY with valid JSON:
{
  "title": "concise professional title",
  "hub": "one of the hub categories above",
  "importance": 1-5,
  "complexity": "XS|S|M|L|XL",
  "raw_idea": "cleaned up version preserving their voice and intent",
  "claude_analysis": "UX-focused analysis covering: (1) Which user persona benefits most and how their workflow improves, (2) How this integrates with existing features, (3) Key UX considerations (mobile vs desktop, information density, touch targets), (4) Business value - time saved, errors reduced, customer experience improved, (5) Potential gotchas or scope creep risks. Keep it concise and actionable. Do NOT include technical implementation details, testing strategies, or code architecture - focus on the WHAT and WHY, not the HOW."
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
