/**
 * Mobile-optimized Analytics View
 * Shows SalespersonDetailPage for the current user's mapped salesperson
 * Admins can select any salesperson to view
 */

import { useState } from 'react';
import { AlertCircle, ChevronDown, User, Settings } from 'lucide-react';
import { useAnalyticsFilter, useDistinctSalespeople } from '../hooks/useUserSalespersonMapping';
import { SalespersonDetailPage } from './jobber/residential/SalespersonDetailPage';
import { UserSalespersonMappingAdmin } from './UserSalespersonMappingAdmin';
import { cn } from '../../../lib/utils';

interface MobileAnalyticsViewProps {
  onBack?: () => void;
}

export function MobileAnalyticsView({ onBack }: MobileAnalyticsViewProps) {
  const {
    salespersonFilter,
    requiresSetup,
    isUnverified,
    isAdmin,
    isLoading: mappingLoading,
  } = useAnalyticsFilter();

  // For admin "view as" functionality
  const [selectedSalesperson, setSelectedSalesperson] = useState<string | null>(null);
  const [showSelector, setShowSelector] = useState(false);
  const [showMappingAdmin, setShowMappingAdmin] = useState(false);

  // Get list of salespeople for admin dropdown
  const { data: salespeople = [] } = useDistinctSalespeople();

  // Determine which salesperson to show
  // Admin: use selected or first available
  // User: use their mapped salesperson
  const effectiveSalesperson = isAdmin
    ? (selectedSalesperson || salespeople[0] || null)
    : salespersonFilter;

  // Loading state
  if (mappingLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // User needs setup - show message with link to settings
  if (requiresSetup) {
    return (
      <div className="p-4">
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 text-center">
          <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-6 h-6 text-amber-600" />
          </div>
          <h3 className="text-lg font-semibold text-amber-800 mb-2">Account Setup Required</h3>
          <p className="text-amber-700 text-sm mb-4">
            Your account needs to be linked to your sales data. Please contact your administrator to complete the setup.
          </p>
          {onBack && (
            <button
              onClick={onBack}
              className="px-4 py-2 bg-amber-600 text-white rounded-lg font-medium hover:bg-amber-700"
            >
              Go Back
            </button>
          )}
        </div>
      </div>
    );
  }

  // No salesperson data available
  if (!effectiveSalesperson) {
    return (
      <div className="p-4">
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 text-center">
          <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <User className="w-6 h-6 text-gray-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-800 mb-2">No Data Available</h3>
          <p className="text-gray-600 text-sm">
            {isAdmin
              ? "No salesperson data found in the system."
              : "Your account is not linked to any salesperson data."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-20">
      {/* Admin selector bar */}
      {isAdmin && (
        <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <User className="w-4 h-4" />
            <span>Viewing as:</span>
          </div>

          <div className="relative flex items-center gap-2">
            <button
              onClick={() => setShowSelector(!showSelector)}
              className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-sm font-medium"
            >
              {effectiveSalesperson}
              <ChevronDown className={cn('w-4 h-4 transition-transform', showSelector && 'rotate-180')} />
            </button>

            <button
                onClick={() => setShowMappingAdmin(true)}
                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
                title="Manage user mappings"
              >
                <Settings className="w-4 h-4" />
              </button>

            {showSelector && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setShowSelector(false)}
                />
                <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-xl shadow-xl border border-gray-200 z-50 max-h-80 overflow-auto">
                  {salespeople.map((sp) => (
                    <button
                      key={sp}
                      onClick={() => {
                        setSelectedSalesperson(sp);
                        setShowSelector(false);
                      }}
                      className={cn(
                        'w-full px-4 py-3 text-left text-sm hover:bg-gray-50 border-b border-gray-100 last:border-0',
                        effectiveSalesperson === sp && 'bg-blue-50 text-blue-700'
                      )}
                    >
                      {sp}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Unverified warning for non-admins */}
      {!isAdmin && isUnverified && (
        <div className="mx-4 mt-4 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-700">
          <strong>Note:</strong> Your account was auto-matched to "{salespersonFilter}".
          Contact an admin if this is incorrect.
        </div>
      )}

      {/* Salesperson Detail Page */}
      <SalespersonDetailPage
        salesperson={effectiveSalesperson}
        onBack={onBack || (() => {})}
      />

      {/* Admin Mapping Panel */}
      {showMappingAdmin && (
        <UserSalespersonMappingAdmin onClose={() => setShowMappingAdmin(false)} />
      )}
    </div>
  );
}

export default MobileAnalyticsView;
