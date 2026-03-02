import type { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
import { AI_MODELS } from './lib/ai-models';
import { formatGlossaryForPrompt } from './lib/fence-glossary';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface SingleRequest {
  text: string;
  sourceLanguage: string;
  targetLanguage: string;
  sourceType: string;
  sourceId: string;
}

interface BatchRequest {
  batch: {
    text: string;
    sourceLanguage: string;
    sourceType: string;
    sourceId: string;
  }[];
  targetLanguage: string;
}

interface TranslationResult {
  translatedText: string;
  sourceLanguage: string;
  cached: boolean;
}

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error('OpenAI API key not configured');

    const body = JSON.parse(event.body || '{}');

    // Batch mode
    if (body.batch && Array.isArray(body.batch)) {
      const batchReq = body as BatchRequest;
      const results = await translateBatch(batchReq, apiKey);
      return {
        statusCode: 200,
        body: JSON.stringify({ results }),
      };
    }

    // Single mode
    const req = body as SingleRequest;
    if (!req.text || !req.targetLanguage) {
      return { statusCode: 400, body: JSON.stringify({ error: 'text and targetLanguage are required' }) };
    }

    const result = await translateSingle(req, apiKey);
    return {
      statusCode: 200,
      body: JSON.stringify(result),
    };
  } catch (error: any) {
    console.error('Translation error:', error.message);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message || 'Translation failed' }),
    };
  }
};

async function translateSingle(req: SingleRequest, apiKey: string): Promise<TranslationResult> {
  const { text, sourceLanguage, targetLanguage, sourceType, sourceId } = req;

  // Skip if same language
  if (sourceLanguage === targetLanguage) {
    return { translatedText: text, sourceLanguage, cached: true };
  }

  // Skip empty or emoji-only text
  if (!text.trim() || /^[\p{Emoji}\s]+$/u.test(text.trim())) {
    return { translatedText: text, sourceLanguage, cached: true };
  }

  // Check cache
  if (sourceId && sourceType) {
    const { data: cached } = await supabase
      .from('message_translations')
      .select('translated_text, source_language')
      .eq('source_type', sourceType)
      .eq('source_id', sourceId)
      .eq('target_language', targetLanguage)
      .single();

    if (cached) {
      return {
        translatedText: cached.translated_text,
        sourceLanguage: cached.source_language || sourceLanguage,
        cached: true,
      };
    }
  }

  // Call translation model
  const translatedText = await callTranslationAPI(text, sourceLanguage, targetLanguage, apiKey);

  // Cache the result
  if (sourceId && sourceType) {
    await supabase.from('message_translations').upsert({
      source_type: sourceType,
      source_id: sourceId,
      source_language: sourceLanguage,
      target_language: targetLanguage,
      original_text: text,
      translated_text: translatedText,
    }, {
      onConflict: 'source_type,source_id,target_language',
    });
  }

  return { translatedText, sourceLanguage, cached: false };
}

async function translateBatch(req: BatchRequest, apiKey: string): Promise<TranslationResult[]> {
  const { batch, targetLanguage } = req;

  // Check cache for all items first
  const results: (TranslationResult | null)[] = new Array(batch.length).fill(null);
  const needsTranslation: { index: number; item: typeof batch[0] }[] = [];

  for (let i = 0; i < batch.length; i++) {
    const item = batch[i];

    // Same language — skip
    if (item.sourceLanguage === targetLanguage) {
      results[i] = { translatedText: item.text, sourceLanguage: item.sourceLanguage, cached: true };
      continue;
    }

    // Empty / emoji-only — skip
    if (!item.text.trim() || /^[\p{Emoji}\s]+$/u.test(item.text.trim())) {
      results[i] = { translatedText: item.text, sourceLanguage: item.sourceLanguage, cached: true };
      continue;
    }

    // Check cache
    if (item.sourceId && item.sourceType) {
      const { data: cached } = await supabase
        .from('message_translations')
        .select('translated_text, source_language')
        .eq('source_type', item.sourceType)
        .eq('source_id', item.sourceId)
        .eq('target_language', targetLanguage)
        .single();

      if (cached) {
        results[i] = {
          translatedText: cached.translated_text,
          sourceLanguage: cached.source_language || item.sourceLanguage,
          cached: true,
        };
        continue;
      }
    }

    needsTranslation.push({ index: i, item });
  }

  // Translate remaining items in parallel (max 5 concurrent)
  const CONCURRENCY = 5;
  for (let i = 0; i < needsTranslation.length; i += CONCURRENCY) {
    const chunk = needsTranslation.slice(i, i + CONCURRENCY);
    const translations = await Promise.all(
      chunk.map(async ({ index, item }) => {
        const translatedText = await callTranslationAPI(
          item.text, item.sourceLanguage, targetLanguage, apiKey
        );

        // Cache
        if (item.sourceId && item.sourceType) {
          await supabase.from('message_translations').upsert({
            source_type: item.sourceType,
            source_id: item.sourceId,
            source_language: item.sourceLanguage,
            target_language: targetLanguage,
            original_text: item.text,
            translated_text: translatedText,
          }, {
            onConflict: 'source_type,source_id,target_language',
          });
        }

        return { index, translatedText };
      })
    );

    for (const { index, translatedText } of translations) {
      results[index] = {
        translatedText,
        sourceLanguage: needsTranslation.find(n => n.index === index)!.item.sourceLanguage,
        cached: false,
      };
    }
  }

  return results as TranslationResult[];
}

async function callTranslationAPI(
  text: string,
  sourceLang: string,
  targetLang: string,
  apiKey: string,
): Promise<string> {
  const glossary = formatGlossaryForPrompt(sourceLang, targetLang);
  const sourceName = sourceLang === 'es' ? 'Spanish' : 'English';
  const targetName = targetLang === 'es' ? 'Spanish' : 'English';

  const systemPrompt = `You are a professional translator for a fence construction company. Translate the following ${sourceName} text to ${targetName}.
Preserve the original meaning, tone, and any formatting. Keep proper nouns, numbers, and technical codes unchanged.
Return ONLY the translated text, nothing else.

${glossary}`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: AI_MODELS.translation,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: text },
      ],
      temperature: 0.1,
      max_tokens: 2000,
    }),
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error?.message || 'Translation API call failed');
  }

  const data = await response.json();
  return data.choices[0]?.message?.content?.trim() || text;
}
