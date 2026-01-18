/**
 * Mobile-optimized Analytics View
 * Auto-filters to user's salesperson data for non-admins
 * Admins can select any salesperson to view
 */

import { useState } from 'react';
import { TrendingUp, DollarSign, FileText, Briefcase, AlertCircle, ChevronDown, User } from 'lucide-react';
import { useAnalyticsFilter, useDistinctSalespeople } from '../hooks/useUserSalespersonMapping';
import { usePersonalMetrics } from '../hooks/usePersonalMetrics';
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

  // Get list of salespeople for admin dropdown
  const { data: salespeople = [] } = useDistinctSalespeople();

  // Determine which salesperson to filter by
  const effectiveFilter = isAdmin ? selectedSalesperson : salespersonFilter;

  // Fetch metrics for the selected salesperson
  const { data: metrics, isLoading: metricsLoading } = usePersonalMetrics(effectiveFilter || undefined);

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

  // User needs setup
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

  return (
    <div className="p-4 space-y-4 pb-20">
      {/* Header with user info */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
              <User className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Viewing data for</p>
              <p className="font-semibold text-gray-900">
                {effectiveFilter || 'All Salespeople'}
              </p>
              {isUnverified && (
                <span className="text-xs text-amber-600">Unverified match</span>
              )}
            </div>
          </div>

          {/* Admin selector */}
          {isAdmin && (
            <div className="relative">
              <button
                onClick={() => setShowSelector(!showSelector)}
                className="flex items-center gap-2 px-3 py-2 bg-gray-100 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-200"
              >
                View as
                <ChevronDown className={cn('w-4 h-4 transition-transform', showSelector && 'rotate-180')} />
              </button>

              {showSelector && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setShowSelector(false)}
                  />
                  <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-xl shadow-xl border border-gray-200 z-50 max-h-80 overflow-auto">
                    <button
                      onClick={() => {
                        setSelectedSalesperson(null);
                        setShowSelector(false);
                      }}
                      className={cn(
                        'w-full px-4 py-3 text-left text-sm hover:bg-gray-50 border-b border-gray-100',
                        !selectedSalesperson && 'bg-blue-50 text-blue-700'
                      )}
                    >
                      All Salespeople
                    </button>
                    {salespeople.map((sp) => (
                      <button
                        key={sp}
                        onClick={() => {
                          setSelectedSalesperson(sp);
                          setShowSelector(false);
                        }}
                        className={cn(
                          'w-full px-4 py-3 text-left text-sm hover:bg-gray-50',
                          selectedSalesperson === sp && 'bg-blue-50 text-blue-700'
                        )}
                      >
                        {sp}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Metrics Loading */}
      {metricsLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : metrics ? (
        <>
          {/* Key Metrics Cards */}
          <div className="grid grid-cols-2 gap-3">
            <MetricCard
              label="Total Revenue"
              value={formatCurrency(metrics.totalRevenue || 0)}
              icon={DollarSign}
              iconColor="text-green-600"
              bgColor="bg-green-50"
            />
            <MetricCard
              label="Jobs Completed"
              value={(metrics.jobsCompleted || 0).toString()}
              icon={Briefcase}
              iconColor="text-blue-600"
              bgColor="bg-blue-50"
            />
            <MetricCard
              label="Quotes Sent"
              value={(metrics.quotesSent || 0).toString()}
              icon={FileText}
              iconColor="text-purple-600"
              bgColor="bg-purple-50"
            />
            <MetricCard
              label="Win Rate"
              value={`${((metrics.winRate || 0) * 100).toFixed(0)}%`}
              icon={TrendingUp}
              iconColor="text-orange-600"
              bgColor="bg-orange-50"
            />
          </div>

          {/* Additional Stats */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
            <h3 className="font-semibold text-gray-900">Performance Summary</h3>

            <StatRow label="Average Job Value" value={formatCurrency(metrics.avgJobValue || 0)} />
            <StatRow label="Total Quotes Value" value={formatCurrency(metrics.totalQuotesValue || 0)} />
            <StatRow label="Avg Days to Quote" value={`${(metrics.avgDaysToQuote || 0).toFixed(1)} days`} />
            <StatRow label="Jobs This Month" value={(metrics.jobsThisMonth || 0).toString()} />
            <StatRow label="Revenue This Month" value={formatCurrency(metrics.revenueThisMonth || 0)} />
          </div>

          {/* Monthly Trend (simplified) */}
          {metrics.monthlyTrend && metrics.monthlyTrend.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <h3 className="font-semibold text-gray-900 mb-3">Last 3 Months</h3>
              <div className="space-y-2">
                {metrics.monthlyTrend.slice(-3).map((month, idx) => (
                  <div key={idx} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                    <span className="text-sm text-gray-600">{month.month}</span>
                    <span className="font-medium text-gray-900">{formatCurrency(month.revenue)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="bg-gray-50 rounded-xl p-6 text-center">
          <p className="text-gray-600">No data available for the selected period.</p>
        </div>
      )}
    </div>
  );
}

interface MetricCardProps {
  label: string;
  value: string;
  icon: typeof TrendingUp;
  iconColor: string;
  bgColor: string;
}

function MetricCard({ label, value, icon: Icon, iconColor, bgColor }: MetricCardProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center mb-2', bgColor)}>
        <Icon className={cn('w-4 h-4', iconColor)} />
      </div>
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className="text-lg font-bold text-gray-900">{value}</p>
    </div>
  );
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-sm text-gray-600">{label}</span>
      <span className="font-medium text-gray-900">{value}</span>
    </div>
  );
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export default MobileAnalyticsView;
