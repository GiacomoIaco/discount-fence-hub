import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import {
  TrendingUp,
  TrendingDown,
  BarChart3,
  Users,
  Calendar,
  Filter,
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from 'recharts';
import type { SurveyCampaign, SurveyDistribution } from '../types';

export default function AnalyticsDashboard() {
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>('all');

  // Fetch campaigns for filter
  const { data: campaigns } = useQuery({
    queryKey: ['campaigns-for-analytics'],
    queryFn: async () => {
      const { data } = await supabase
        .from('survey_campaigns')
        .select('id, code, name')
        .order('name');
      return data as Pick<SurveyCampaign, 'id' | 'code' | 'name'>[];
    },
  });

  // Fetch distributions with response counts
  const { data: distributions } = useQuery({
    queryKey: ['analytics-distributions', selectedCampaignId],
    queryFn: async () => {
      let query = supabase
        .from('survey_distributions')
        .select(`
          *,
          campaign:survey_campaigns(name, code),
          survey:surveys(title)
        `)
        .not('sent_at', 'is', null)
        .order('sent_at', { ascending: true });

      if (selectedCampaignId !== 'all') {
        query = query.eq('campaign_id', selectedCampaignId);
      }

      const { data } = await query;
      return data as (SurveyDistribution & {
        campaign: { name: string; code: string } | null;
        survey: { title: string } | null;
      })[];
    },
  });

  // Fetch all responses for detailed analytics
  const { data: responses } = useQuery({
    queryKey: ['analytics-responses', selectedCampaignId],
    queryFn: async () => {
      let query = supabase
        .from('survey_responses')
        .select(`
          id,
          nps_score,
          csat_score,
          completed_at,
          time_to_complete,
          respondent_company,
          distribution:survey_distributions(campaign_id, sent_at)
        `)
        .not('completed_at', 'is', null);

      const { data } = await query;

      // Filter by campaign if selected
      if (selectedCampaignId !== 'all') {
        return data?.filter((r: any) => r.distribution?.campaign_id === selectedCampaignId) || [];
      }
      return data || [];
    },
  });

  // Calculate NPS trend data
  const npsTrendData = distributions?.map(dist => {
    const distResponses = responses?.filter(
      (r: any) => r.distribution?.sent_at === dist.sent_at
    ) || [];
    const npsResponses = distResponses.filter((r: any) => r.nps_score !== null);

    let nps = null;
    if (npsResponses.length > 0) {
      const promoters = npsResponses.filter((r: any) => r.nps_score >= 9).length;
      const detractors = npsResponses.filter((r: any) => r.nps_score <= 6).length;
      nps = Math.round(((promoters - detractors) / npsResponses.length) * 100);
    }

    return {
      date: dist.sent_at ? new Date(dist.sent_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '',
      nps,
      responses: dist.total_completed,
      responseRate: dist.response_rate,
      campaign: dist.campaign?.name || 'Ad-hoc',
    };
  }).filter(d => d.nps !== null) || [];

  // Calculate overall stats
  const totalResponses = responses?.length || 0;
  const npsResponses = responses?.filter((r: any) => r.nps_score !== null) || [];
  const avgNPS = npsResponses.length > 0
    ? Math.round(
        ((npsResponses.filter((r: any) => r.nps_score >= 9).length -
          npsResponses.filter((r: any) => r.nps_score <= 6).length) /
          npsResponses.length) *
          100
      )
    : null;

  const avgResponseRate = distributions?.length
    ? Math.round(
        distributions.reduce((sum, d) => sum + (d.response_rate || 0), 0) / distributions.length
      )
    : null;

  const avgCompletionTime = responses?.length
    ? Math.round(
        responses.reduce((sum: number, r: any) => sum + (r.time_to_complete || 0), 0) /
          responses.filter((r: any) => r.time_to_complete).length
      )
    : null;

  // NPS distribution for bar chart
  const npsDistribution = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(score => ({
    score: score.toString(),
    count: npsResponses.filter((r: any) => r.nps_score === score).length,
    type: score <= 6 ? 'Detractor' : score <= 8 ? 'Passive' : 'Promoter',
  }));

  const getNPSTrend = () => {
    if (npsTrendData.length < 2) return null;
    const latest = npsTrendData[npsTrendData.length - 1]?.nps;
    const previous = npsTrendData[npsTrendData.length - 2]?.nps;
    if (latest === null || previous === null) return null;
    return latest - previous;
  };

  const npsTrend = getNPSTrend();

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
          <p className="text-gray-500 mt-1">Track survey performance and trends over time</p>
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-400" />
          <select
            value={selectedCampaignId}
            onChange={(e) => setSelectedCampaignId(e.target.value)}
            className="px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500"
          >
            <option value="all">All Campaigns</option>
            {campaigns?.map(c => (
              <option key={c.id} value={c.id}>[{c.code}] {c.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Total Responses</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{totalResponses}</p>
              <p className="text-xs text-gray-400 mt-1">across {distributions?.length || 0} distributions</p>
            </div>
            <div className="bg-blue-500 p-3 rounded-lg">
              <Users className="w-5 h-5 text-white" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Average NPS</p>
              <div className="flex items-center gap-2 mt-1">
                <p className={`text-3xl font-bold ${avgNPS !== null && avgNPS >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {avgNPS !== null ? (avgNPS > 0 ? `+${avgNPS}` : avgNPS) : '-'}
                </p>
                {npsTrend !== null && (
                  <span className={`flex items-center text-sm ${npsTrend >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {npsTrend >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                    {Math.abs(npsTrend)}
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-400 mt-1">from {npsResponses.length} NPS responses</p>
            </div>
            <div className="bg-emerald-500 p-3 rounded-lg">
              <BarChart3 className="w-5 h-5 text-white" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Avg Response Rate</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">
                {avgResponseRate !== null ? `${avgResponseRate}%` : '-'}
              </p>
              <p className="text-xs text-gray-400 mt-1">of recipients responded</p>
            </div>
            <div className="bg-purple-500 p-3 rounded-lg">
              <TrendingUp className="w-5 h-5 text-white" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Avg Completion Time</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">
                {avgCompletionTime ? `${Math.round(avgCompletionTime / 60)}m` : '-'}
              </p>
              <p className="text-xs text-gray-400 mt-1">to complete survey</p>
            </div>
            <div className="bg-orange-500 p-3 rounded-lg">
              <Calendar className="w-5 h-5 text-white" />
            </div>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* NPS Trend */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <h3 className="font-semibold text-gray-900 mb-4">NPS Trend Over Time</h3>
          {npsTrendData.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-gray-400">
              <p>No NPS data available yet</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={npsTrendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis domain={[-100, 100]} tick={{ fontSize: 12 }} />
                <Tooltip
                  formatter={(value: number) => [value, 'NPS']}
                  labelFormatter={(label) => `Date: ${label}`}
                />
                <Line
                  type="monotone"
                  dataKey="nps"
                  stroke="#10b981"
                  strokeWidth={2}
                  dot={{ fill: '#10b981', strokeWidth: 2 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* NPS Distribution */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <h3 className="font-semibold text-gray-900 mb-4">NPS Score Distribution</h3>
          {npsResponses.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-gray-400">
              <p>No NPS responses yet</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={npsDistribution}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="score" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar
                  dataKey="count"
                  fill="#10b981"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
          <div className="flex justify-center gap-6 mt-4 text-sm">
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded bg-red-400" />
              Detractors (0-6)
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded bg-yellow-400" />
              Passives (7-8)
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded bg-green-400" />
              Promoters (9-10)
            </span>
          </div>
        </div>
      </div>

      {/* Response Rate Trend */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
        <h3 className="font-semibold text-gray-900 mb-4">Response Rate Trend</h3>
        {distributions?.length === 0 ? (
          <div className="h-64 flex items-center justify-center text-gray-400">
            <p>No distribution data available yet</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={npsTrendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} tickFormatter={(v) => `${v}%`} />
              <Tooltip formatter={(value: number) => [`${value}%`, 'Response Rate']} />
              <Line
                type="monotone"
                dataKey="responseRate"
                stroke="#8b5cf6"
                strokeWidth={2}
                dot={{ fill: '#8b5cf6', strokeWidth: 2 }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Distribution History Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">Distribution Details</h3>
        </div>
        {distributions?.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            <p>No distributions yet</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Campaign</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Sent</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Responses</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Rate</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">NPS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {distributions?.map((dist) => (
                  <tr key={dist.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {dist.sent_at ? new Date(dist.sent_at).toLocaleDateString() : '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {dist.campaign?.name || 'Ad-hoc'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 text-right">{dist.total_sent}</td>
                    <td className="px-4 py-3 text-sm text-gray-900 text-right">{dist.total_completed}</td>
                    <td className="px-4 py-3 text-sm text-gray-900 text-right">
                      {dist.response_rate ? `${dist.response_rate}%` : '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-right">
                      {dist.nps_score !== null ? (
                        <span className={dist.nps_score >= 0 ? 'text-green-600' : 'text-red-600'}>
                          {dist.nps_score > 0 ? '+' : ''}{dist.nps_score}
                        </span>
                      ) : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
