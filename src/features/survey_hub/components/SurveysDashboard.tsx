import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import {
  FileText,
  Users,
  Calendar,
  CheckCircle2,
  Clock,
  BarChart3,
  ArrowRight,
} from 'lucide-react';
import type { SurveyHubView, SurveyCampaign } from '../types';

interface SurveysDashboardProps {
  onNavigate: (view: SurveyHubView) => void;
}

export default function SurveysDashboard({ onNavigate }: SurveysDashboardProps) {
  // Fetch stats
  const { data: stats } = useQuery({
    queryKey: ['survey-hub-stats'],
    queryFn: async () => {
      const [surveysRes, populationsRes, campaignsRes, responsesRes] = await Promise.all([
        supabase.from('surveys').select('id, status', { count: 'exact' }),
        supabase.from('survey_populations').select('id, contact_count', { count: 'exact' }),
        supabase.from('survey_campaigns').select('id, status', { count: 'exact' }),
        supabase.from('survey_responses').select('id, nps_score, completed_at', { count: 'exact' }),
      ]);

      const activeSurveys = surveysRes.data?.filter(s => s.status === 'active').length || 0;
      const totalContacts = populationsRes.data?.reduce((sum, p) => sum + (p.contact_count || 0), 0) || 0;
      const activeCampaigns = campaignsRes.data?.filter(c => c.status === 'active').length || 0;
      const totalResponses = responsesRes.count || 0;

      // Calculate average NPS from responses with nps_score
      const npsResponses = responsesRes.data?.filter(r => r.nps_score !== null) || [];
      let avgNPS: number | null = null;
      if (npsResponses.length > 0) {
        const promoters = npsResponses.filter(r => r.nps_score! >= 9).length;
        const detractors = npsResponses.filter(r => r.nps_score! <= 6).length;
        avgNPS = Math.round(((promoters - detractors) / npsResponses.length) * 100);
      }

      return {
        totalSurveys: surveysRes.count || 0,
        activeSurveys,
        totalPopulations: populationsRes.count || 0,
        totalContacts,
        totalCampaigns: campaignsRes.count || 0,
        activeCampaigns,
        totalResponses,
        avgNPS,
      };
    },
  });

  // Fetch recent campaigns
  const { data: recentCampaigns } = useQuery({
    queryKey: ['recent-campaigns'],
    queryFn: async () => {
      const { data } = await supabase
        .from('survey_campaigns')
        .select(`
          *,
          survey:surveys(title, code),
          population:survey_populations(name, contact_count)
        `)
        .order('created_at', { ascending: false })
        .limit(5);
      return data as (SurveyCampaign & { survey: { title: string; code: string }; population: { name: string; contact_count: number } })[];
    },
  });

  // Fetch recent responses
  const { data: recentResponses } = useQuery({
    queryKey: ['recent-responses'],
    queryFn: async () => {
      const { data } = await supabase
        .from('survey_responses')
        .select(`
          id,
          respondent_name,
          respondent_company,
          nps_score,
          completed_at,
          distribution:survey_distributions(
            survey:surveys(title, code)
          )
        `)
        .order('completed_at', { ascending: false })
        .limit(10);
      return data;
    },
  });

  const statCards = [
    {
      label: 'Active Surveys',
      value: stats?.activeSurveys || 0,
      subtext: `${stats?.totalSurveys || 0} total`,
      icon: FileText,
      color: 'bg-blue-500',
      onClick: () => onNavigate('surveys'),
    },
    {
      label: 'Total Contacts',
      value: stats?.totalContacts || 0,
      subtext: `${stats?.totalPopulations || 0} populations`,
      icon: Users,
      color: 'bg-purple-500',
      onClick: () => onNavigate('populations'),
    },
    {
      label: 'Active Campaigns',
      value: stats?.activeCampaigns || 0,
      subtext: `${stats?.totalCampaigns || 0} total`,
      icon: Calendar,
      color: 'bg-emerald-500',
      onClick: () => onNavigate('campaigns'),
    },
    {
      label: 'Total Responses',
      value: stats?.totalResponses || 0,
      subtext: stats?.avgNPS !== null && stats?.avgNPS !== undefined ? `NPS: ${stats.avgNPS > 0 ? '+' : ''}${stats.avgNPS}` : 'No NPS data',
      icon: BarChart3,
      color: 'bg-orange-500',
      onClick: () => onNavigate('analytics'),
    },
  ];

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

  const getNPSColor = (score: number) => {
    if (score >= 9) return 'text-green-600 bg-green-50';
    if (score >= 7) return 'text-yellow-600 bg-yellow-50';
    return 'text-red-600 bg-red-50';
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Survey Dashboard</h1>
        <p className="text-gray-500 mt-1">Monitor your customer feedback programs</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <button
              key={stat.label}
              onClick={stat.onClick}
              className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 hover:shadow-md hover:border-gray-200 transition-all text-left"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500">{stat.label}</p>
                  <p className="text-3xl font-bold text-gray-900 mt-1">{stat.value.toLocaleString()}</p>
                  <p className="text-xs text-gray-400 mt-1">{stat.subtext}</p>
                </div>
                <div className={`${stat.color} p-3 rounded-lg`}>
                  <Icon className="w-5 h-5 text-white" />
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Campaigns */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-semibold text-gray-900 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-emerald-600" />
              Recent Campaigns
            </h2>
            <button
              onClick={() => onNavigate('campaigns')}
              className="text-sm text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
            >
              View all <ArrowRight className="w-3 h-3" />
            </button>
          </div>
          <div className="divide-y divide-gray-50">
            {recentCampaigns?.length === 0 && (
              <div className="p-8 text-center text-gray-400">
                <Calendar className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>No campaigns yet</p>
                <button
                  onClick={() => onNavigate('campaigns')}
                  className="text-emerald-600 text-sm mt-2 hover:underline"
                >
                  Create your first campaign
                </button>
              </div>
            )}
            {recentCampaigns?.map((campaign) => (
              <div key={campaign.id} className="p-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900 truncate">{campaign.name}</span>
                      <span className={`px-2 py-0.5 text-xs rounded-full ${getStatusBadge(campaign.status)}`}>
                        {campaign.status}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 mt-0.5">
                      {campaign.survey?.title} • {campaign.population?.contact_count || 0} contacts
                    </p>
                  </div>
                  <div className="text-right text-xs text-gray-400">
                    {campaign.schedule_type === 'recurring' ? (
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        Every {campaign.recurrence_interval} {campaign.recurrence_unit}
                      </span>
                    ) : (
                      <span>One-time</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Responses */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-semibold text-gray-900 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-blue-600" />
              Recent Responses
            </h2>
            <button
              onClick={() => onNavigate('analytics')}
              className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
            >
              View analytics <ArrowRight className="w-3 h-3" />
            </button>
          </div>
          <div className="divide-y divide-gray-50">
            {recentResponses?.length === 0 && (
              <div className="p-8 text-center text-gray-400">
                <BarChart3 className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>No responses yet</p>
                <p className="text-xs mt-1">Send your first survey to collect feedback</p>
              </div>
            )}
            {recentResponses?.map((response: any) => (
              <div key={response.id} className="p-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate">
                      {response.respondent_name || response.respondent_company || 'Anonymous'}
                    </p>
                    <p className="text-sm text-gray-500 truncate">
                      {response.distribution?.survey?.title || 'Survey'}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    {response.nps_score !== null && (
                      <span className={`px-2 py-1 text-sm font-medium rounded ${getNPSColor(response.nps_score)}`}>
                        {response.nps_score}
                      </span>
                    )}
                    <span className="text-xs text-gray-400">
                      {new Date(response.completed_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Quick Start Guide */}
      {(stats?.totalSurveys === 0 || stats?.totalCampaigns === 0) && (
        <div className="bg-gradient-to-r from-emerald-50 to-teal-50 rounded-xl p-6 border border-emerald-200">
          <h3 className="font-semibold text-emerald-900 text-lg mb-4">Quick Start Guide</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center text-sm font-bold">1</div>
              <div>
                <p className="font-medium text-gray-900">Create Survey</p>
                <p className="text-sm text-gray-500">Design your questions</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center text-sm font-bold">2</div>
              <div>
                <p className="font-medium text-gray-900">Import Contacts</p>
                <p className="text-sm text-gray-500">Upload CSV or add manually</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center text-sm font-bold">3</div>
              <div>
                <p className="font-medium text-gray-900">Create Campaign</p>
                <p className="text-sm text-gray-500">Schedule your sends</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center text-sm font-bold">4</div>
              <div>
                <p className="font-medium text-gray-900">Analyze Results</p>
                <p className="text-sm text-gray-500">Track trends over time</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
