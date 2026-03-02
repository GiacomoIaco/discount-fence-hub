import { Globe, Loader2 } from 'lucide-react';
import { useTranslation } from '../hooks/useTranslation';
import { useAuth } from '../../../contexts/AuthContext';

interface TranslatedTextProps {
  content: string;
  detectedLanguage?: string | null;
  sourceType?: string;
  sourceId?: string;
  /** If true, search highlighting is active — render plain text instead */
  searchHighlight?: React.ReactNode;
  isOwn?: boolean;
  /** If true, skip translation for this conversation */
  translationsOff?: boolean;
}

/**
 * Renders message content with automatic translation when the message language
 * differs from the user's preferred language.
 *
 * For voice messages (content starts with "🎤 Voice message"), only the transcript
 * portion after the double newline is translated.
 *
 * WhatsApp-style UX: original text + translated text shown below.
 */
export function TranslatedText({
  content,
  detectedLanguage,
  sourceType,
  sourceId,
  searchHighlight,
  isOwn,
  translationsOff,
}: TranslatedTextProps) {
  const { profile } = useAuth();
  const userLang = profile?.preferred_language || 'en';

  // Determine what text to translate
  const isVoiceMessage = content.startsWith('🎤 Voice message');
  let textToTranslate = content;
  let voicePrefix = '';

  if (isVoiceMessage) {
    const splitIndex = content.indexOf('\n\n');
    if (splitIndex !== -1) {
      voicePrefix = content.substring(0, splitIndex + 2);
      textToTranslate = content.substring(splitIndex + 2);
    }
  }

  // For own messages, we know the language
  const sourceLang = detectedLanguage || (isOwn ? userLang : undefined);
  const needsTranslation = !translationsOff && sourceLang && sourceLang !== userLang;

  const { data: translation, isLoading, isError } = useTranslation(
    needsTranslation ? textToTranslate : undefined,
    sourceLang || undefined,
    sourceType,
    sourceId,
  );

  // If search highlighting is active, just show the highlighted text
  if (searchHighlight) {
    return (
      <p className="text-sm whitespace-pre-wrap break-words">
        {searchHighlight}
      </p>
    );
  }

  // No translation needed — just show the content
  if (!needsTranslation) {
    return (
      <p className="text-sm whitespace-pre-wrap break-words">
        {content}
      </p>
    );
  }

  return (
    <div className="space-y-1">
      {/* Original text */}
      <p className="text-sm whitespace-pre-wrap break-words">
        {content}
      </p>

      {/* Translation */}
      {isLoading && (
        <div className="flex items-center gap-1.5 text-xs text-gray-400">
          <Loader2 className="w-3 h-3 animate-spin" />
          <span>Translating...</span>
        </div>
      )}

      {translation?.translatedText && !isLoading && (
        <div className={`flex items-start gap-1.5 text-xs ${
          isOwn ? 'text-blue-200/80' : 'text-gray-500'
        }`}>
          <Globe className="w-3 h-3 mt-0.5 shrink-0" />
          <p className="whitespace-pre-wrap break-words italic">
            {isVoiceMessage && voicePrefix
              ? `${voicePrefix}${translation.translatedText}`
              : translation.translatedText
            }
          </p>
        </div>
      )}

      {isError && (
        <div className="flex items-center gap-1.5 text-xs text-gray-400">
          <Globe className="w-3 h-3" />
          <span>Translation unavailable</span>
        </div>
      )}
    </div>
  );
}
