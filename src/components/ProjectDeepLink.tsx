import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

/**
 * Handles deep links to projects via /p/:projectCode
 * Stores the project code in sessionStorage and redirects to the main app
 * The app will then open the BOM Calculator/Yard view for that project
 */
export function ProjectDeepLink() {
  const { projectCode } = useParams<{ projectCode: string }>();
  const navigate = useNavigate();

  useEffect(() => {
    if (projectCode) {
      // Store the claim code for the app to pick up
      sessionStorage.setItem('qr-claim-code', projectCode.toUpperCase());
      // Navigate to home - the app will detect the claim code and open the project
      navigate('/', { replace: true });
    }
  }, [projectCode, navigate]);

  // Show a brief loading state while redirecting
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-800 to-blue-500 flex items-center justify-center p-5">
      <div className="bg-white rounded-2xl p-10 max-w-sm w-full text-center shadow-2xl">
        <div className="w-20 h-20 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <svg className="w-12 h-12 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" fill="currentColor" stroke="currentColor"/>
            <polyline points="9 22 9 12 15 12 15 22" stroke="white"/>
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Opening Project</h1>
        <div className="font-mono text-xl font-bold text-blue-600 bg-blue-50 px-4 py-2 rounded-lg inline-block mb-4">
          {projectCode?.toUpperCase()}
        </div>
        <p className="text-gray-500">Loading pick list...</p>
        <div className="w-6 h-6 border-3 border-gray-200 border-t-blue-600 rounded-full animate-spin mx-auto mt-4"></div>
      </div>
    </div>
  );
}
