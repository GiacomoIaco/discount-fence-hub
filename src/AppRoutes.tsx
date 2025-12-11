import { Routes, Route } from 'react-router-dom';
import App from './App';
import { ProjectDeepLink } from './components/ProjectDeepLink';
import PublicSurveyPage from './features/survey_hub/components/PublicSurveyPage';

/**
 * Main routing component
 *
 * Handles:
 * - /p/:projectCode - Deep link to a specific project (QR code scanning)
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

      {/* Public survey page - no auth required */}
      <Route path="/survey" element={<PublicSurveyPage />} />

      {/* All other routes go to the main app */}
      <Route path="/*" element={<App />} />
    </Routes>
  );
}
