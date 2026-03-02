import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../../contexts/AuthContext';

interface TranslationResult {
  translatedText: string;
  sourceLanguage: string;
  cached: boolean;
}

/**
 * Translate a single message. Uses TanStack Query with infinite staleTime
 * since translations never change. Only fetches when sourceLang !== targetLang.
 */
export function useTranslation(
  text: string | undefined,
  sourceLang: string | undefined,
  sourceType?: string,
  sourceId?: string,
) {
  const { profile } = useAuth();
  const targetLang = profile?.preferred_language || 'en';

  const needsTranslation = Boolean(
    text?.trim() &&
    sourceLang &&
    targetLang &&
    sourceLang !== targetLang
  );

  return useQuery<TranslationResult>({
    queryKey: ['translation', sourceType, sourceId, targetLang],
    queryFn: async () => {
      const response = await fetch('/.netlify/functions/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          sourceLanguage: sourceLang,
          targetLanguage: targetLang,
          sourceType: sourceType || '',
          sourceId: sourceId || '',
        }),
      });

      if (!response.ok) {
        throw new Error('Translation failed');
      }

      return response.json();
    },
    enabled: needsTranslation,
    staleTime: Infinity,
    gcTime: 1000 * 60 * 60, // keep in cache for 1 hour
    retry: 1,
  });
}

/**
 * Batch-translate multiple messages at once and pre-populate individual query caches.
 * Call this when a conversation loads to warm the cache.
 */
export function useBatchTranslation(
  messages: {
    text: string;
    sourceLang: string;
    sourceType: string;
    sourceId: string;
  }[],
) {
  const { profile } = useAuth();
  const targetLang = profile?.preferred_language || 'en';
  const queryClient = useQueryClient();

  // Filter to only messages that need translation
  const needsTranslation = messages.filter(
    m => m.text?.trim() && m.sourceLang && m.sourceLang !== targetLang
  );

  return useQuery<TranslationResult[]>({
    queryKey: ['batch-translation', targetLang, needsTranslation.map(m => m.sourceId).join(',')],
    queryFn: async () => {
      if (needsTranslation.length === 0) return [];

      const response = await fetch('/.netlify/functions/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          batch: needsTranslation.map(m => ({
            text: m.text,
            sourceLanguage: m.sourceLang,
            sourceType: m.sourceType,
            sourceId: m.sourceId,
          })),
          targetLanguage: targetLang,
        }),
      });

      if (!response.ok) {
        throw new Error('Batch translation failed');
      }

      const data = await response.json();
      const results: TranslationResult[] = data.results;

      // Pre-populate individual query caches
      results.forEach((result, i) => {
        const msg = needsTranslation[i];
        queryClient.setQueryData(
          ['translation', msg.sourceType, msg.sourceId, targetLang],
          result
        );
      });

      return results;
    },
    enabled: needsTranslation.length > 0,
    staleTime: Infinity,
    gcTime: 1000 * 60 * 60,
    retry: 1,
  });
}
