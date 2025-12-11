import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import { X, Calendar, Clock, Mail, Send } from 'lucide-react';
import type { SurveyCampaign, SurveyDistribution } from '../types';

interface CampaignDetailModalProps {
  campaign: SurveyCampaign;
  onClose: () => void;
}

export default function CampaignDetailModal({ campaign, onClose }: CampaignDetailModalProps) {
  // Fetch distributions for this campaign
  const { data: distributions } = useQuery({
    queryKey: ['campaign-distributions', campaign.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('survey_distributions')
        .select('*')
        .eq('campaign_id', campaign.id)
        .order('sent_at', { ascending: false });
      return data as SurveyDistribution[];
    },
  });

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      draft: 'bg-gray-100 text-gray-600',
      scheduled: 'bg-blue-100 text-blue-600',
      active: 'bg-green-100 text-green-600',
      paused: 'bg-yellow-100 text-yellow-600',
      completed: 'bg-purple-100 text-purple-600',
    };
    return styles[status] || styles.draft;
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-mono text-gray-400">{campaign.code}</span>
              <span className={`px-2 py-0.5 text-xs rounded-full ${getStatusBadge(campaign.status)}`}>
                {campaign.status}
              </span>
            </div>
            <h2 className="text-lg font-semibold text-gray-900">{campaign.name}</h2>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6 space-y-6">
          {/* Campaign Info */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
                <Calendar className="w-4 h-4" />
                Schedule
              </div>
              <p className="font-medium text-gray-900">
                {campaign.schedule_type === 'recurring'
                  ? `Every ${campaign.recurrence_interval} ${campaign.recurrence_unit}`
                  : 'One-time'}
              </p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
                <Send className="w-4 h-4" />
                Distributions
              </div>
              <p className="font-medium text-gray-900">{campaign.total_distributions}</p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
                <Mail className="w-4 h-4" />
                Delivery
              </div>
              <p className="font-medium text-gray-900">
                {campaign.delivery_methods?.join(' + ') || 'Email'}
              </p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
                <Clock className="w-4 h-4" />
                Deadline
              </div>
              <p className="font-medium text-gray-900">{campaign.response_deadline_days} days</p>
            </div>
          </div>

          {/* Distribution History */}
          <div>
            <h3 className="font-semibold text-gray-900 mb-4">Distribution History</h3>
            {distributions?.length === 0 ? (
              <div className="text-center py-8 bg-gray-50 rounded-lg text-gray-500">
                <Send className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>No distributions yet</p>
                <p className="text-sm">Send the campaign to create your first distribution</p>
              </div>
            ) : (
              <div className="space-y-3">
                {distributions?.map((dist) => (
                  <div
                    key={dist.id}
                    className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-lg"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center font-bold">
                        #{dist.distribution_number}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">
                          Wave {dist.distribution_number}
                        </p>
                        <p className="text-sm text-gray-500">
                          Sent {dist.sent_at ? new Date(dist.sent_at).toLocaleDateString() : 'Not sent'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-6 text-sm">
                      <div className="text-center">
                        <p className="font-semibold text-gray-900">{dist.total_sent}</p>
                        <p className="text-xs text-gray-500">Sent</p>
                      </div>
                      <div className="text-center">
                        <p className="font-semibold text-gray-900">{dist.total_completed}</p>
                        <p className="text-xs text-gray-500">Responses</p>
                      </div>
                      <div className="text-center">
                        <p className="font-semibold text-gray-900">
                          {dist.response_rate ? `${dist.response_rate}%` : '-'}
                        </p>
                        <p className="text-xs text-gray-500">Rate</p>
                      </div>
                      {dist.nps_score !== null && (
                        <div className="text-center">
                          <p className={`font-semibold ${dist.nps_score >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {dist.nps_score > 0 ? '+' : ''}{dist.nps_score}
                          </p>
                          <p className="text-xs text-gray-500">NPS</p>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 bg-gray-50 text-right">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
