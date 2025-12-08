export default async (req, context) => {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  try {
    const { slideTexts, talkingPointsText } = await req.json();

    if (!slideTexts || !talkingPointsText) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'API key not configured' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    console.log('Calling Claude API with', slideTexts.length, 'slides');

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-7-sonnet-20250219',
        max_tokens: 4000,
        messages: [{
          role: 'user',
          content: `You are helping match talking points to presentation slides for a sales presentation.

I have ${slideTexts.length} slides with the following content:
${slideTexts.map((text, i) => `Slide ${i + 1}: ${text.substring(0, 250)}...`).join('\n\n')}

And these talking points:
${talkingPointsText}

Please match the talking points to the appropriate slides. For each slide, provide:
1. A brief, descriptive title (4-6 words)
2. Detailed talking points from the document that relate to that slide

IMPORTANT:
- Include ALL relevant details from the talking points document for each slide
- Each talking point should be a complete sentence or phrase (not just a few words)
- Include context, explanations, and specific details where provided
- Aim for 3-6 detailed talking points per slide when available
- Use the exact wording from the document when possible
- Format each point as a complete thought

Return ONLY a valid JSON array with this exact structure:
[
  {
    "slide_number": 1,
    "title": "Brief slide title",
    "talking_points": "• Detailed point 1 with full context and explanation\\n• Detailed point 2 with specific information\\n• Detailed point 3 with complete thought"
  }
]

Make sure every slide (1-${slideTexts.length}) is included. If no talking points match a slide, write "• No specific talking points available for this slide"`
        }]
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Claude API error:', errorText);
      return new Response(JSON.stringify({ error: `Claude API error: ${response.status}` }), {
        status: response.status,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const data = await response.json();
    const content = data.content[0].text;

    // Extract JSON from response
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      return new Response(JSON.stringify({ error: 'Could not parse AI response' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const matchedSlides = JSON.parse(jsonMatch[0]);

    return new Response(JSON.stringify({ matchedSlides }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Function error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
