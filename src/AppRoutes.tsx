import { Routes, Route } from 'react-router-dom';
import { Suspense, lazy } from 'react';
import App from './App';
import { ProjectDeepLink } from './components/ProjectDeepLink';
import PublicSurveyPage from './features/survey_hub/components/PublicSurveyPage';

// Lazy load public pages to keep initial bundle small
const ClientQuoteViewPage = lazy(() => import('./features/fsm/pages/ClientQuoteViewPage'));

// Loading fallback for public pages
const PublicLoadingFallback = () => (
  <div className="min-h-screen bg-gray-50 flex items-center justify-center">
    <div className="text-center">
      <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
      <div className="text-gray-600">Loading...</div>
    </div>
  </div>
);

/**
 * Main routing component
 *
 * Handles:
 * - /p/:projectCode - Deep link to a specific project (QR code scanning)
 * - /client-quote/:token - Public quote viewing/approval (no auth required)
 * - /survey - Public survey page (no auth required)
 * - /* - All other routes go to the main App
 *
 * This is a minimal hybrid routing setup. Most navigation in the app
 * still uses state-based navigation (setActiveSection). Only routes
 * that need deep linking are handled here.
 */
export function AppRoutes() {
  return (
    <Routes>
      {/* Deep link route for QR code scanning */}
      <Route path="/p/:projectCode" element={<ProjectDeepLink />} />

      {/* Public quote view page - no auth required */}
      <Route
        path="/client-quote/:token"
        element={
          <Suspense fallback={<PublicLoadingFallback />}>
            <ClientQuoteViewPage />
          </Suspense>
        }
      />

      {/* Public survey page - no auth required */}
      <Route path="/survey" element={<PublicSurveyPage />} />

      {/* All other routes go to the main app */}
      <Route path="/*" element={<App />} />
    </Routes>
  );
}
