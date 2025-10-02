// Anthropic Claude API integration for intelligent parsing via Netlify function

interface ParsedRequestData {
  customerName: string;
  address: string;
  fenceType: string;
  linearFeet: string;
  specialRequirements: string;
  deadline: string;
  urgency: string;
  confidence: {
    customerName: number;
    address: number;
    fenceType: number;
    linearFeet: number;
    specialRequirements: number;
    deadline: number;
    urgency: number;
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
