import { useState } from 'react';
import { Globe, Check } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { showSuccess, showError } from '../../../lib/toast';

const LANGUAGES = [
  { code: 'en' as const, label: 'English', flag: '🇺🇸' },
  { code: 'es' as const, label: 'Español', flag: '🇲🇽' },
];

export default function LanguageSettings() {
  const { profile, updateProfile } = useAuth();
  const [saving, setSaving] = useState(false);
  const currentLang = profile?.preferred_language || 'en';

  const handleChange = async (lang: 'en' | 'es') => {
    if (lang === currentLang || saving) return;
    setSaving(true);
    try {
      const { error } = await updateProfile({ preferred_language: lang } as any);
      if (error) throw error;
      showSuccess(lang === 'en' ? 'Language set to English' : 'Idioma configurado a Español');
    } catch (err) {
      console.error('Error updating language:', err);
      showError('Failed to update language preference');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
          <Globe className="w-5 h-5 text-blue-600" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Language Preference</h2>
          <p className="text-sm text-gray-600">
            Choose your display language. Messages in other languages will be automatically translated.
          </p>
        </div>
      </div>

      <div className="space-y-2">
        {LANGUAGES.map(({ code, label, flag }) => {
          const isSelected = currentLang === code;
          return (
            <button
              key={code}
              onClick={() => handleChange(code)}
              disabled={saving}
              className={`w-full flex items-center gap-3 p-4 rounded-lg border-2 transition-colors text-left ${
                isSelected
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
              } ${saving ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <span className="text-2xl">{flag}</span>
              <span className={`flex-1 font-medium ${isSelected ? 'text-blue-900' : 'text-gray-900'}`}>
                {label}
              </span>
              {isSelected && (
                <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                  <Check className="w-4 h-4 text-white" />
                </div>
              )}
            </button>
          );
        })}
      </div>

      <div className="mt-4 p-3 bg-gray-50 border border-gray-200 rounded-lg">
        <p className="text-sm text-gray-600">
          When you receive a message in a different language, an automatic translation will appear below the original text.
        </p>
      </div>
    </div>
  );
}
