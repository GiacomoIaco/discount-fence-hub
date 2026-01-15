
import { GoogleGenAI } from "@google/genai";

export async function analyzeTerritory(areaName: string, zipCodes: string[], locationHint: string) {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
  
  const prompt = `
    Analyze the following sales territory:
    Name: ${areaName}
    Location Context: ${locationHint}
    ZIP Codes: ${zipCodes.join(', ')}
    
    Provide a professional summary of this territory's market profile. 
    Mention major landmarks, neighborhoods, and the general demographic/business vibe of these specific ZIP areas in ${locationHint}. 
    Focus on economic density, purchasing power, or industrial presence if applicable.
    Keep it to 2 concise paragraphs.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });
    return response.text;
  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    return "Market analysis currently unavailable. Check your connection or the validity of the selected ZIP codes.";
  }
}
