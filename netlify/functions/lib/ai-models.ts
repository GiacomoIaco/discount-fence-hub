/**
 * Centralized AI model configuration.
 * Update model IDs here — all AI functions will pick up the change.
 */

export const AI_MODELS = {
  /** Anthropic Claude — primary text model for structured parsing, analysis, generation */
  claude: 'claude-sonnet-4-6-20250514',

  /** Anthropic Claude — vision model for image + text tasks */
  claudeVision: 'claude-sonnet-4-6-20250514',

  /** OpenAI — speech-to-text transcription */
  whisper: 'whisper-1',

  /** OpenAI — vision model for photo analysis/tagging */
  openaiVision: 'gpt-5-1',

  /** Google Gemini — image generation / photo enhancement */
  geminiImage: 'gemini-3-pro',
} as const;

export type AIModelKey = keyof typeof AI_MODELS;
