import { User } from 'lucide-react';

interface MobileHeaderProps {
  profileAvatarUrl: string | undefined;
  profileFullName: string;
  setViewMode: (mode: 'mobile' | 'desktop') => void;
  setShowProfileView: (show: boolean) => void;
}

export default function MobileHeader({
  profileAvatarUrl,
  profileFullName,
  setViewMode,
  setShowProfileView
}: MobileHeaderProps) {
  return (
    <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
      <div className="px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3 flex-1">
          <img src="/Logo-DF-Transparent.png" alt="Discount Fence USA" className="h-12 w-auto" />
          <p className="text-xs text-gray-500">
            {(() => {
              try {
                const buildTime = typeof __BUILD_TIME__ !== 'undefined' ? __BUILD_TIME__ : new Date().toISOString();
                const dateStr = new Date(buildTime).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
                return import.meta.env.MODE === 'development'
                  ? `v1.0.dev • ${dateStr}`
                  : `v1.0 • ${dateStr}`;
              } catch {
                return import.meta.env.MODE === 'development' ? 'v1.0.dev' : 'v1.0';
              }
            })()}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* View Mode Switcher */}
          <button
            onClick={() => setViewMode('desktop')}
            className="px-2 py-1 text-xs bg-gray-100 border border-gray-300 rounded text-gray-700 hover:bg-gray-200"
          >
            Desktop
          </button>
          {/* Profile Avatar */}
          <button
            onClick={() => setShowProfileView(true)}
            className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 hover:opacity-80 transition-opacity"
          >
            {profileAvatarUrl ? (
              <img
                src={profileAvatarUrl}
                alt={profileFullName}
                className="w-10 h-10 rounded-full object-cover border-2 border-blue-600"
              />
            ) : (
              <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center">
                <User className="w-6 h-6 text-white" />
              </div>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
