import type { Handler } from '@netlify/functions';
import { AI_MODELS } from './lib/ai-models';

interface ParsedArea {
  name: string;
  strategic_description?: string;
}

interface ParsedInitiative {
  area_name: string;
  title: string;
  description?: string;
  annual_target?: string;
}

interface ParsedQuarterlyObjective {
  initiative_title: string;
  quarter: number;
  objective: string;
}

interface ParsedBonusKPI {
  name: string;
  description?: string;
  unit: 'dollars' | 'percent' | 'score' | 'count' | 'text';
  target_value?: number;
  target_text?: string;
  min_threshold?: number;
  min_multiplier?: number;
  max_threshold?: number;
  max_multiplier?: number;
}

interface ParsedOperatingPlan {
  year?: number;
  areas: ParsedArea[];
  initiatives: ParsedInitiative[];
  quarterly_objectives: ParsedQuarterlyObjective[];
  bonus_kpis: ParsedBonusKPI[];
  confidence: {
    overall: number;
    areas: number;
    initiatives: number;
    quarterly_objectives: number;
    bonus_kpis: number;
  };
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

    const { documentText, documentType } = JSON.parse(event.body || '{}');

    if (!documentText) {
      throw new Error('No document text provided');
    }

    const prompt = `You are an AI assistant helping parse strategic operating plans from uploaded documents.

Extract the following information from this ${documentType || 'document'} and provide confidence scores (0-100):

Document Content:
"""
${documentText}
"""

Extract and structure the following:

1. **AREAS**: Strategic focus areas or functional areas (e.g., "Revenues", "Cost Optimization", "Operations")
   - Area name
   - Strategic description (if mentioned)

2. **INITIATIVES**: Projects or initiatives within each area
   - Which area it belongs to (area_name)
   - Initiative title
   - Description/details of what this initiative is and why it matters
   - Annual target (if mentioned - e.g., "$7M revenue at 28%+ margins")

3. **QUARTERLY OBJECTIVES**: Specific quarterly goals per initiative (if structured by quarters)
   - Which initiative it belongs to (initiative_title)
   - Quarter number (1-4)
   - Objective description

4. **BONUS KPIs**: High-level outcome metrics for bonus calculation (if mentioned)
   - KPI name
   - Description
   - Unit type (dollars, percent, score, count, or text)
   - Target value (if numeric)
   - Target text (if qualitative)
   - Min/max thresholds and multipliers (if incentive curves are defined)

5. **YEAR**: What year is this plan for? (extract from document or use current year)

**IMPORTANT EXTRACTION RULES:**
- If quarters are mentioned (Q1, Q2, Q3, Q4), extract them as quarterly_objectives
- If annual targets are mentioned, put them in the initiative's annual_target field
- If no quarters are mentioned, leave quarterly_objectives as empty array
- Areas are high-level groupings (usually 3-8 areas)
- Initiatives are specific projects under each area (usually 2-5 per area)
- Bonus KPIs are outcome metrics (usually 3-6 total)

Respond ONLY with valid JSON in this exact format:
{
  "year": 2025,
  "areas": [
    {
      "name": "Area name",
      "strategic_description": "Strategic direction for this area"
    }
  ],
  "initiatives": [
    {
      "area_name": "Area name (must match an area above)",
      "title": "Initiative title",
      "description": "What this initiative is and why it matters",
      "annual_target": "e.g., $7M revenue at 28%+ margins"
    }
  ],
  "quarterly_objectives": [
    {
      "initiative_title": "Initiative title (must match an initiative above)",
      "quarter": 1,
      "objective": "What should be achieved in Q1"
    }
  ],
  "bonus_kpis": [
    {
      "name": "KPI name",
      "description": "What this measures",
      "unit": "dollars",
      "target_value": 1000000,
      "min_threshold": 500000,
      "min_multiplier": 0.5,
      "max_threshold": 1500000,
      "max_multiplier": 2.0
    }
  ],
  "confidence": {
    "overall": 85,
    "areas": 90,
    "initiatives": 85,
    "quarterly_objectives": 75,
    "bonus_kpis": 70
  }
}`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: AI_MODELS.claude,
        max_tokens: 4096,
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

    const parsed: ParsedOperatingPlan = JSON.parse(jsonMatch[0]);

    return {
      statusCode: 200,
      body: JSON.stringify(parsed),
    };
  } catch (error) {
    console.error('Parse error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: error instanceof Error ? error.message : 'Parse failed'
      }),
    };
  }
};
