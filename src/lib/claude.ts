// Anthropic Claude API integration for intelligent parsing via Netlify function

// Roadmap idea expansion types
export interface ExpandedRoadmapIdea {
  title: string;
  hub: string;
  importance: number;
  complexity: string;
  raw_idea: string;
  claude_analysis: string;
}

export async function expandRoadmapIdea(transcript: string): Promise<ExpandedRoadmapIdea> {
  try {
    const response = await fetch('/.netlify/functions/expand-roadmap-idea', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        transcript,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Expansion failed');
    }

    const data = await response.json();
    return data as ExpandedRoadmapIdea;
  } catch (error) {
    console.error('Claude API error:', error);
    throw error;
  }
}

interface ParsedRequestData {
  title: string;
  customerName: string;
  address: string;
  fenceType: string;
  linearFeet: string;
  specialRequirements: string;
  deadline: string;
  urgency: string;
  expectedValue: string;
  description: string;
  confidence: {
    title: number;
    customerName: number;
    address: number;
    fenceType: number;
    linearFeet: number;
    specialRequirements: number;
    deadline: number;
    urgency: number;
    expectedValue: number;
  };
}

export async function parseVoiceTranscript(transcript: string): Promise<ParsedRequestData> {
  try {
    const response = await fetch('/.netlify/functions/parse', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        transcript,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Parse failed');
    }

    const data = await response.json();
    return data as ParsedRequestData;
  } catch (error) {
    console.error('Claude API error:', error);
    throw error;
  }
}
