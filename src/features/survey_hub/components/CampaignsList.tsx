import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import {
  Plus,
  Search,
  Calendar,
  MoreVertical,
  Edit2,
  Trash2,
  Play,
  Pause,
  Send,
  Clock,
  Users,
  BarChart3,
} from 'lucide-react';
import toast from 'react-hot-toast';
import type { SurveyCampaign, Survey, SurveyPopulation } from '../types';
import CampaignEditorModal from './CampaignEditorModal';
import CampaignDetailModal from './CampaignDetailModal';

export default function CampaignsList() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showEditor, setShowEditor] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<SurveyCampaign | null>(null);
  const [viewingCampaign, setViewingCampaign] = useState<SurveyCampaign | null>(null);
  const [menuOpen, setMenuOpen] = useState<string | null>(null);

  const { data: campaigns, isLoading } = useQuery({
    queryKey: ['survey-campaigns', search, statusFilter],
    queryFn: async () => {
      let query = supabase
        .from('survey_campaigns')
        .select(`
          *,
          survey:surveys(id, title, code),
          population:survey_populations(id, name, contact_count)
        `)
        .order('created_at', { ascending: false });

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }
      if (search) {
        query = query.or(`name.ilike.%${search}%,code.ilike.%${search}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as (SurveyCampaign & { survey: Pick<Survey, 'id' | 'title' | 'code'>; population: Pick<SurveyPopulation, 'id' | 'name' | 'contact_count'> })[];
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from('survey_campaigns').update({ status }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['survey-campaigns'] });
      toast.success('Campaign updated');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('survey_campaigns').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['survey-campaigns'] });
      toast.success('Campaign deleted');
    },
    onError: () => toast.error('Failed to delete campaign'),
  });

  const sendNowMutation = useMutation({
    mutationFn: async (campaign: SurveyCampaign) => {
      // Create distribution and send
      const response = await fetch('/.netlify/functions/send-survey', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaignId: campaign.id,
          surveyId: campaign.survey_id,
          populationId: campaign.population_id,
          deliveryMethods: campaign.delivery_methods,
        }),
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to send survey');
      }
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['survey-campaigns'] });
      toast.success(`Survey sent to ${data.sent} recipients`);
    },
    onError: (err: any) => toast.error(err.message),
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
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Campaigns</h1>
          <p className="text-gray-500 mt-1">Schedule and manage survey distributions</p>
        </div>
        <button
          onClick={() => {
            setEditingCampaign(null);
            setShowEditor(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Campaign
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search campaigns..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
        >
          <option value="all">All Status</option>
          <option value="draft">Draft</option>
          <option value="scheduled">Scheduled</option>
          <option value="active">Active</option>
          <option value="paused">Paused</option>
          <option value="completed">Completed</option>
        </select>
      </div>

      {/* Campaigns List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full" />
        </div>
      ) : campaigns?.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-100">
          <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900">No campaigns yet</h3>
          <p className="text-gray-500 mt-1">Create a campaign to start sending surveys</p>
          <button
            onClick={() => setShowEditor(true)}
            className="mt-4 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
          >
            Create Campaign
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {campaigns?.map((campaign) => (
            <div
              key={campaign.id}
              className="bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow p-4"
            >
              <div className="flex items-start gap-4">
                {/* Main Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-mono text-gray-400">{campaign.code}</span>
                    <span className={`px-2 py-0.5 text-xs rounded-full ${getStatusBadge(campaign.status)}`}>
                      {campaign.status}
                    </span>
                    {campaign.schedule_type === 'recurring' && (
                      <span className="px-2 py-0.5 text-xs rounded-full bg-purple-100 text-purple-600">
                        Recurring
                      </span>
                    )}
                  </div>
                  <h3 className="font-semibold text-gray-900">{campaign.name}</h3>
                  <div className="flex flex-wrap items-center gap-4 mt-2 text-sm text-gray-500">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      {campaign.survey?.title}
                    </span>
                    <span className="flex items-center gap-1">
                      <Users className="w-4 h-4" />
                      {campaign.population?.name} ({campaign.population?.contact_count || 0})
                    </span>
                    {campaign.schedule_type === 'recurring' && (
                      <span className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        Every {campaign.recurrence_interval} {campaign.recurrence_unit}
                      </span>
                    )}
                  </div>
                </div>

                {/* Stats */}
                <div className="flex items-center gap-6 text-center">
                  <div>
                    <p className="text-2xl font-bold text-gray-900">{campaign.total_distributions}</p>
                    <p className="text-xs text-gray-500">Sends</p>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setViewingCampaign(campaign)}
                    className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                    title="View Details"
                  >
                    <BarChart3 className="w-5 h-5" />
                  </button>

                  {campaign.status === 'draft' && (
                    <button
                      onClick={() => {
                        if (confirm('Send this survey now to all contacts?')) {
                          sendNowMutation.mutate(campaign);
                        }
                      }}
                      disabled={sendNowMutation.isPending}
                      className="p-2 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg"
                      title="Send Now"
                    >
                      <Send className="w-5 h-5" />
                    </button>
                  )}

                  {campaign.status === 'active' && (
                    <button
                      onClick={() => updateStatusMutation.mutate({ id: campaign.id, status: 'paused' })}
                      className="p-2 text-gray-400 hover:text-yellow-600 hover:bg-yellow-50 rounded-lg"
                      title="Pause"
                    >
                      <Pause className="w-5 h-5" />
                    </button>
                  )}

                  {campaign.status === 'paused' && (
                    <button
                      onClick={() => updateStatusMutation.mutate({ id: campaign.id, status: 'active' })}
                      className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg"
                      title="Resume"
                    >
                      <Play className="w-5 h-5" />
                    </button>
                  )}

                  <div className="relative">
                    <button
                      onClick={() => setMenuOpen(menuOpen === campaign.id ? null : campaign.id)}
                      className="p-2 text-gray-400 hover:text-gray-600 rounded-lg"
                    >
                      <MoreVertical className="w-5 h-5" />
                    </button>
                    {menuOpen === campaign.id && (
                      <div className="absolute right-0 top-10 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-10 min-w-[140px]">
                        <button
                          onClick={() => {
                            setEditingCampaign(campaign);
                            setShowEditor(true);
                            setMenuOpen(null);
                          }}
                          className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                        >
                          <Edit2 className="w-4 h-4" />
                          Edit
                        </button>
                        <button
                          onClick={() => {
                            if (confirm('Delete this campaign?')) {
                              deleteMutation.mutate(campaign.id);
                            }
                            setMenuOpen(null);
                          }}
                          className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-gray-50"
                        >
                          <Trash2 className="w-4 h-4" />
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Editor Modal */}
      {showEditor && (
        <CampaignEditorModal
          campaign={editingCampaign}
          onClose={() => {
            setShowEditor(false);
            setEditingCampaign(null);
          }}
          onSave={() => {
            queryClient.invalidateQueries({ queryKey: ['survey-campaigns'] });
            setShowEditor(false);
            setEditingCampaign(null);
          }}
        />
      )}

      {/* Detail Modal */}
      {viewingCampaign && (
        <CampaignDetailModal
          campaign={viewingCampaign}
          onClose={() => setViewingCampaign(null)}
        />
      )}
    </div>
  );
}
