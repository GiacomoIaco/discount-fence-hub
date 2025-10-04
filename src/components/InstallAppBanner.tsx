import { useState, useEffect } from 'react';
import { X, Download } from 'lucide-react';

const InstallAppBanner = () => {
  const [showBanner, setShowBanner] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    // Check if user has already dismissed or installed the app
    const bannerDismissed = localStorage.getItem('installBannerDismissed');
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;

    if (!bannerDismissed && !isStandalone) {
      setShowBanner(true);
    }

    // Listen for the beforeinstallprompt event
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;

      if (outcome === 'accepted') {
        setShowBanner(false);
        localStorage.setItem('installBannerDismissed', 'true');
      }

      setDeferredPrompt(null);
    }
  };

  const handleDismiss = () => {
    setShowBanner(false);
    localStorage.setItem('installBannerDismissed', 'true');
  };

  if (!showBanner) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-blue-600 text-white p-4 shadow-lg z-50 md:left-64">
      <div className="max-w-4xl mx-auto flex items-start justify-between space-x-4">
        <div className="flex items-start space-x-3 flex-1">
          <Download className="w-6 h-6 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="font-bold text-lg mb-1">Install Discount Fence Hub</h3>
            <p className="text-sm text-blue-100 mb-3">
              Install our app for quick access and offline capabilities
            </p>

            {/* Platform-specific instructions */}
            <div className="space-y-2 text-xs text-blue-100">
              <p className="hidden md:block">
                <strong>Desktop:</strong> Look for the install icon in your browser's address bar
              </p>
              <p className="md:hidden">
                <strong>iPhone/iPad:</strong> Tap Share → Add to Home Screen
              </p>
              <p className="md:hidden">
                <strong>Android:</strong> Tap Menu (⋮) → Install App
              </p>
            </div>

            {/* Install button for browsers that support it */}
            {deferredPrompt && (
              <button
                onClick={handleInstallClick}
                className="mt-3 px-4 py-2 bg-white text-blue-600 rounded-lg font-semibold hover:bg-blue-50 transition-colors text-sm"
              >
                Install Now
              </button>
            )}
          </div>
        </div>

        <button
          onClick={handleDismiss}
          className="text-white hover:text-blue-200 transition-colors flex-shrink-0"
          aria-label="Dismiss"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};

export default InstallAppBanner;
