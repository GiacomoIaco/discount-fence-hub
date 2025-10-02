// Anthropic Claude API integration for intelligent parsing

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
  const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY;

  if (!apiKey) {
    throw new Error('Anthropic API key not configured');
  }

  const prompt = `You are an AI assistant helping parse voice-recorded fence pricing requests.

Extract the following information from this transcript and provide confidence scores (0-100) for each field:

Transcript: "${transcript}"

Extract:
1. Customer name
2. Address/location
3. Fence type (height, material, style)
4. Linear feet
5. Special requirements (staining, slope, gates, etc.)
6. Deadline/timeline
7. Urgency level

Respond ONLY with valid JSON in this exact format:
{
  "customerName": "extracted name or empty string",
  "address": "extracted address or empty string",
  "fenceType": "extracted fence type or empty string",
  "linearFeet": "extracted number or empty string",
  "specialRequirements": "extracted requirements or empty string",
  "deadline": "extracted deadline or empty string",
  "urgency": "extracted urgency or empty string",
  "confidence": {
    "customerName": 85,
    "address": 90,
    "fenceType": 95,
    "linearFeet": 80,
    "specialRequirements": 75,
    "deadline": 85,
    "urgency": 90
  }
}`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1024,
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

    // Extract JSON from response (Claude might wrap it in markdown)
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Failed to parse Claude response');
    }

    const parsed = JSON.parse(jsonMatch[0]);
    return parsed as ParsedRequestData;
  } catch (error) {
    console.error('Claude API error:', error);
    throw error;
  }
}
