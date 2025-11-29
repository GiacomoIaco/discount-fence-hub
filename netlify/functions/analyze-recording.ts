import type { Handler } from '@netlify/functions';

interface SalesProcess {
  id: string;
  name: string;
  steps: Array<{
    name: string;
    description: string;
    keyBehaviors: string[];
  }>;
}

interface KnowledgeBase {
  companyInfo: string;
  products: string[];
  commonObjections: string[];
  bestPractices: string[];
  industryContext: string;
}

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    // ✅ Use correct env var name (ANTHROPIC_API_KEY without VITE_ prefix)
    // Fallback to VITE_ version for backward compatibility during migration
    const apiKey = process.env.ANTHROPIC_API_KEY || process.env.VITE_ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('Anthropic API key not configured');
    }

    const { transcript, processType, knowledgeBase } = JSON.parse(event.body || '{}');

    if (!transcript) {
      throw new Error('No transcript provided');
    }

    // Get the sales process (from localStorage or default)
    const salesProcess: SalesProcess = processType || {
      id: 'standard',
      name: 'Standard 5-Step Sales Process',
      steps: [
        {
          name: 'Greeting & Rapport Building',
          description: 'Establish connection and build trust',
          keyBehaviors: [
            'Warm and professional greeting',
            'Small talk to establish rapport',
            'Set agenda for the meeting',
            'Build initial trust'
          ]
        },
        {
          name: 'Needs Discovery',
          description: 'Understand client pain points and goals through questions',
          keyBehaviors: [
            'Ask open-ended questions',
            'Active listening',
            'Probe for pain points',
            'Understand budget and timeline',
            'Identify decision makers'
          ]
        },
        {
          name: 'Product Presentation',
          description: 'Present solution matching their specific needs',
          keyBehaviors: [
            'Tailor presentation to discovered needs',
            'Focus on benefits not features',
            'Use stories and examples',
            'Address specific pain points',
            'Demonstrate value clearly'
          ]
        },
        {
          name: 'Objection Handling',
          description: 'Address concerns and hesitations professionally',
          keyBehaviors: [
            'Listen to objections fully',
            'Validate concerns',
            'Provide evidence-based responses',
            'Reframe objections as opportunities',
            'Confirm resolution'
          ]
        },
        {
          name: 'Closing',
          description: 'Ask for commitment and establish next steps',
          keyBehaviors: [
            'Trial close throughout',
            'Ask for the sale directly',
            'Create urgency when appropriate',
            'Outline clear next steps',
            'Confirm commitment'
          ]
        }
      ]
    };

    // Build knowledge base context
    const kbContext = knowledgeBase ? `
COMPANY KNOWLEDGE BASE:
${knowledgeBase.companyInfo || ''}

PRODUCTS/SERVICES:
${knowledgeBase.products?.join('\n') || ''}

COMMON OBJECTIONS & RESPONSES:
${knowledgeBase.commonObjections?.join('\n') || ''}

BEST PRACTICES:
${knowledgeBase.bestPractices?.join('\n') || ''}

INDUSTRY CONTEXT:
${knowledgeBase.industryContext || ''}
` : '';

    const prompt = `You are an expert sales coach analyzing a sales meeting transcript for a fence installation company.

${kbContext}

SALES PROCESS FRAMEWORK: "${salesProcess.name}"
${salesProcess.steps.map((step, idx) => `
${idx + 1}. ${step.name}
   Description: ${step.description}
   Key Behaviors to Look For:
   ${step.keyBehaviors.map(b => `   - ${b}`).join('\n')}
`).join('\n')}

TRANSCRIPT (with speaker labels):
${transcript}

Analyze this sales conversation and provide detailed coaching feedback in JSON format:

{
  "overallScore": 0-100,
  "processSteps": [
    {
      "name": "Step name",
      "completed": true/false,
      "quality": 0-100,
      "feedback": "Specific feedback with examples from the conversation",
      "examples": ["Direct quote 1", "Direct quote 2"],
      "missedOpportunities": ["What could have been done better"]
    }
  ],
  "metrics": {
    "talkListenRatio": "XX/YY (sales rep/client)",
    "questionsAsked": number of questions asked by sales rep,
    "objections": number of objections raised by client,
    "callToActions": number of times sales rep asked for commitment,
    "rapportMoments": number of rapport-building moments,
    "valueStatements": number of clear value propositions
  },
  "strengths": [
    "Specific strength with example from conversation"
  ],
  "improvements": [
    "Specific area for improvement with actionable advice"
  ],
  "keyMoments": [
    {
      "timestamp": "approximate time in conversation (beginning/early/middle/late/end)",
      "description": "What happened",
      "type": "positive|negative|neutral|turning_point",
      "impact": "Why this mattered for the outcome",
      "quote": "Relevant quote from conversation"
    }
  ],
  "coachingPriorities": [
    "Top priority 1 with specific action",
    "Top priority 2 with specific action",
    "Top priority 3 with specific action"
  ],
  "predictedOutcome": {
    "likelihood": "high|medium|low",
    "reasoning": "Why you predict this outcome",
    "nextSteps": "What should happen next"
  },
  "sentiment": {
    "overall": "positive|neutral|negative",
    "overallScore": 0-100 (emotional tone of entire conversation),
    "clientSentiment": "positive|neutral|negative",
    "repSentiment": "positive|neutral|negative",
    "sentimentShift": "Description of how sentiment evolved (e.g., 'Started neutral, became positive after addressing concerns')",
    "emotionalHighs": [
      {
        "timestamp": "approximate time (beginning/early/middle/late/end)",
        "description": "What created positive emotion",
        "quote": "Quote showing positive emotion"
      }
    ],
    "emotionalLows": [
      {
        "timestamp": "approximate time",
        "description": "What created negative emotion or tension",
        "quote": "Quote showing frustration/concern"
      }
    ],
    "empathyMoments": [
      {
        "timestamp": "approximate time",
        "description": "When sales rep showed genuine understanding",
        "quote": "Quote demonstrating empathy",
        "impact": "How this affected the relationship/outcome"
      }
    ]
  }
}

SCORING GUIDELINES:
- 90-100: Exceptional - Sales excellence demonstrated
- 80-89: Strong - Solid performance with minor gaps
- 70-79: Good - Competent with room for improvement
- 60-69: Fair - Needs development in key areas
- Below 60: Needs Significant Development

SENTIMENT ANALYSIS GUIDELINES:
- Analyze emotional tone of both parties throughout conversation
- Identify moments where emotions shifted (positive or negative)
- Note empathy moments where rep connected emotionally with client
- Overall sentiment should reflect the general emotional arc of the conversation
- Sentiment score (0-100): 80+ very positive, 50-79 positive, 30-49 neutral, below 30 negative

Be specific, reference actual quotes, and provide actionable coaching advice.`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5-20250929',
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

    const analysis = JSON.parse(jsonMatch[0]);

    return {
      statusCode: 200,
      body: JSON.stringify(analysis),
    };
  } catch (error: any) {
    console.error('Analysis error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: error.message || 'Analysis failed'
      }),
    };
  }
};
