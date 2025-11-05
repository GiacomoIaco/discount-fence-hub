import { useState } from 'react';
import { ArrowLeft, Calendar, CheckCircle2, Clock, Save } from 'lucide-react';
import { useMyInitiativesQuery } from '../hooks/useLeadershipQuery';

interface WeeklyCheckinViewProps {
  onBack: () => void;
}

interface CheckinItem {
  initiativeId: string;
  initiativeTitle: string;
  plan: string;
  accomplished: string;
  notes: string;
  colorStatus: 'green' | 'yellow' | 'red';
  progressPercent: number;
}

export default function WeeklyCheckinView({ onBack }: WeeklyCheckinViewProps) {
  const { data: initiatives, isLoading } = useMyInitiativesQuery();

  const [checkinData, setCheckinData] = useState<Record<string, CheckinItem>>({});
  const [isSaving, setIsSaving] = useState(false);

  // Get current week start (Monday)
  const getWeekStart = () => {
    const today = new Date();
    const day = today.getDay();
    const diff = today.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
    return new Date(today.setDate(diff));
  };

  const weekStart = getWeekStart();
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const updateCheckin = (initiativeId: string, field: keyof CheckinItem, value: any) => {
    setCheckinData(prev => ({
      ...prev,
      [initiativeId]: {
        ...prev[initiativeId],
        [field]: value,
      },
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      // TODO: Implement actual save logic with weekly updates mutations
      console.log('Saving weekly check-ins:', checkinData);

      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));

      alert('Weekly check-in saved successfully!');
      onBack();
    } catch (error) {
      console.error('Failed to save check-in:', error);
      alert('Failed to save check-in. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your initiatives...</p>
        </div>
      </div>
    );
  }

  const activeInitiatives = initiatives?.filter(
    i => i.status === 'active' || i.status === 'at_risk'
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-blue-200">
        <div className="max-w-5xl mx-auto px-6 py-4">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="p-2 hover:bg-white/50 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <Calendar className="w-6 h-6 text-blue-600" />
                <h1 className="text-2xl font-bold text-gray-900">Weekly Check-in</h1>
              </div>
              <p className="text-sm text-gray-700 mt-1">
                Week of {formatDate(weekStart)} - {formatDate(weekEnd)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Instructions */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-6 py-4">
          <div className="flex items-start gap-3">
            <Clock className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-gray-700">
                Review your active initiatives and provide updates on your progress. Share what you've accomplished
                this week and what you plan to work on next week.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Check-in Form */}
      <div className="max-w-5xl mx-auto px-6 py-8">
        {activeInitiatives && activeInitiatives.length > 0 ? (
          <form onSubmit={handleSubmit} className="space-y-6">
            {activeInitiatives.map((initiative) => (
              <div key={initiative.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                {/* Initiative Header */}
                <div className="mb-6">
                  <h3 className="text-lg font-bold text-gray-900 mb-1">{initiative.title}</h3>
                  {initiative.description && (
                    <p className="text-sm text-gray-600">{initiative.description}</p>
                  )}
                </div>

                {/* Check-in Fields */}
                <div className="space-y-4">
                  {/* What was accomplished */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <CheckCircle2 className="w-4 h-4 inline mr-1 text-green-600" />
                      What did you accomplish this week?
                    </label>
                    <textarea
                      value={checkinData[initiative.id]?.accomplished || ''}
                      onChange={(e) => updateCheckin(initiative.id, 'accomplished', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      rows={3}
                      placeholder="Describe what you completed..."
                    />
                  </div>

                  {/* What's planned */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <Calendar className="w-4 h-4 inline mr-1 text-blue-600" />
                      What do you plan to work on next week?
                    </label>
                    <textarea
                      value={checkinData[initiative.id]?.plan || ''}
                      onChange={(e) => updateCheckin(initiative.id, 'plan', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      rows={3}
                      placeholder="Outline your plan for next week..."
                    />
                  </div>

                  {/* Status & Progress */}
                  <div className="grid grid-cols-2 gap-4">
                    {/* Color Status */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Status Indicator
                      </label>
                      <div className="flex gap-2">
                        {['green', 'yellow', 'red'].map((color) => (
                          <button
                            key={color}
                            type="button"
                            onClick={() => updateCheckin(initiative.id, 'colorStatus', color)}
                            className={`flex-1 py-2 px-3 rounded-lg border-2 transition-all ${
                              (checkinData[initiative.id]?.colorStatus || initiative.color_status) === color
                                ? `border-${color}-500 bg-${color}-50`
                                : 'border-gray-200 hover:border-gray-300'
                            }`}
                          >
                            <div className={`w-3 h-3 rounded-full mx-auto ${
                              color === 'green' ? 'bg-green-500' :
                              color === 'yellow' ? 'bg-yellow-500' :
                              'bg-red-500'
                            }`} />
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Progress */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Progress %
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={checkinData[initiative.id]?.progressPercent ?? initiative.progress_percent}
                        onChange={(e) => updateCheckin(initiative.id, 'progressPercent', parseInt(e.target.value) || 0)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  </div>

                  {/* Additional Notes */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Additional Notes (optional)
                    </label>
                    <textarea
                      value={checkinData[initiative.id]?.notes || ''}
                      onChange={(e) => updateCheckin(initiative.id, 'notes', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      rows={2}
                      placeholder="Any blockers, concerns, or additional context..."
                    />
                  </div>
                </div>
              </div>
            ))}

            {/* Submit Button */}
            <div className="flex gap-3 sticky bottom-6 bg-white p-4 rounded-lg shadow-lg border border-gray-200">
              <button
                type="submit"
                disabled={isSaving}
                className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 font-medium"
              >
                <Save className="w-5 h-5" />
                {isSaving ? 'Saving...' : 'Save Weekly Check-in'}
              </button>
              <button
                type="button"
                onClick={onBack}
                className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium"
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <div className="bg-white rounded-lg shadow-sm border-2 border-dashed border-gray-300 p-12 text-center">
            <CheckCircle2 className="w-20 h-20 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No Active Initiatives</h3>
            <p className="text-gray-600 mb-6">
              You don't have any active initiatives requiring a weekly check-in at this time.
            </p>
            <button
              onClick={onBack}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Go Back
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
