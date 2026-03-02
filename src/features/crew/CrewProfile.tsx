import { useState } from 'react';
import { LogOut, Globe, Bell, BellOff, User } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { usePushNotifications } from '../../hooks/usePushNotifications';

export default function CrewProfile() {
  const { profile, updateProfile, signOut } = useAuth();
  const { isSupported, isSubscribed, permissionState, enable, disable, isLoading: pushLoading } = usePushNotifications();
  const [savingLang, setSavingLang] = useState(false);

  const currentLang = profile?.preferred_language || 'es';

  const handleLanguageChange = async (lang: 'en' | 'es') => {
    if (lang === currentLang || savingLang) return;
    setSavingLang(true);
    await updateProfile({ preferred_language: lang });
    setSavingLang(false);
  };

  const handlePushToggle = async () => {
    if (isSubscribed) {
      await disable();
    } else {
      await enable();
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 pb-24">
      {/* Avatar + Info */}
      <div className="flex flex-col items-center pt-6 pb-8">
        {profile?.avatar_url ? (
          <img
            src={profile.avatar_url}
            alt={profile.full_name}
            className="w-20 h-20 rounded-full object-cover mb-3"
          />
        ) : (
          <div className="w-20 h-20 rounded-full bg-blue-100 flex items-center justify-center mb-3">
            <User className="w-10 h-10 text-blue-600" />
          </div>
        )}
        <h2 className="text-xl font-bold text-gray-900">
          {profile?.full_name || 'Crew Member'}
        </h2>
        {profile?.phone && (
          <p className="text-gray-500 mt-1">{profile.phone}</p>
        )}
      </div>

      {/* Settings cards */}
      <div className="space-y-4 max-w-md mx-auto">
        {/* Language */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center space-x-2 mb-3">
            <Globe className="w-5 h-5 text-gray-600" />
            <h3 className="font-semibold text-gray-900">Idioma / Language</h3>
          </div>
          <div className="flex space-x-2">
            <button
              onClick={() => handleLanguageChange('es')}
              disabled={savingLang}
              className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                currentLang === 'es'
                  ? 'bg-blue-50 text-blue-700 border-2 border-blue-500'
                  : 'bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100'
              }`}
            >
              Espanol
            </button>
            <button
              onClick={() => handleLanguageChange('en')}
              disabled={savingLang}
              className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                currentLang === 'en'
                  ? 'bg-blue-50 text-blue-700 border-2 border-blue-500'
                  : 'bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100'
              }`}
            >
              English
            </button>
          </div>
        </div>

        {/* Push Notifications */}
        {isSupported && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                {isSubscribed ? (
                  <Bell className="w-5 h-5 text-blue-600" />
                ) : (
                  <BellOff className="w-5 h-5 text-gray-400" />
                )}
                <div>
                  <h3 className="font-semibold text-gray-900">Notificaciones</h3>
                  <p className="text-xs text-gray-500">
                    {permissionState === 'denied'
                      ? 'Bloqueado en navegador'
                      : isSubscribed
                        ? 'Activadas'
                        : 'Desactivadas'}
                  </p>
                </div>
              </div>
              <button
                onClick={handlePushToggle}
                disabled={pushLoading || permissionState === 'denied'}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isSubscribed
                    ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                } disabled:opacity-50`}
              >
                {pushLoading ? '...' : isSubscribed ? 'Desactivar' : 'Activar'}
              </button>
            </div>
          </div>
        )}

        {/* Sign Out */}
        <button
          onClick={signOut}
          className="w-full bg-white rounded-lg shadow-sm border border-gray-200 p-4 flex items-center space-x-3 text-red-600 hover:bg-red-50 transition-colors"
        >
          <LogOut className="w-5 h-5" />
          <span className="font-semibold">Cerrar Sesion</span>
        </button>
      </div>
    </div>
  );
}
