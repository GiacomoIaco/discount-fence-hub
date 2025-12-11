import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import {
  Plus,
  Search,
  FileText,
  MoreVertical,
  Edit2,
  Trash2,
  Copy,
  Eye,
  CheckCircle,
  Archive,
} from 'lucide-react';
import toast from 'react-hot-toast';
import type { Survey } from '../types';
import SurveyEditorModal from './SurveyEditorModal';
import SurveyPreviewModal from './SurveyPreviewModal';

export default function SurveysList() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showEditor, setShowEditor] = useState(false);
  const [editingSurvey, setEditingSurvey] = useState<Survey | null>(null);
  const [previewSurvey, setPreviewSurvey] = useState<Survey | null>(null);
  const [menuOpen, setMenuOpen] = useState<string | null>(null);

  const { data: surveys, isLoading } = useQuery({
    queryKey: ['surveys', search, statusFilter],
    queryFn: async () => {
      let query = supabase
        .from('surveys')
        .select('*')
        .order('created_at', { ascending: false });

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }
      if (search) {
        query = query.or(`title.ilike.%${search}%,code.ilike.%${search}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Survey[];
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('surveys').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['surveys'] });
      toast.success('Survey deleted');
    },
    onError: () => toast.error('Failed to delete survey'),
  });

  const duplicateMutation = useMutation({
    mutationFn: async (survey: Survey) => {
      const { id, code, created_at, updated_at, ...rest } = survey;
      const { error } = await supabase.from('surveys').insert({
        ...rest,
        title: `${survey.title} (Copy)`,
        status: 'draft',
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['surveys'] });
      toast.success('Survey duplicated');
    },
    onError: () => toast.error('Failed to duplicate survey'),
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from('surveys').update({ status }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['surveys'] });
      toast.success('Status updated');
    },
  });

  const handleEdit = (survey: Survey) => {
    setEditingSurvey(survey);
    setShowEditor(true);
    setMenuOpen(null);
  };

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this survey?')) {
      deleteMutation.mutate(id);
    }
    setMenuOpen(null);
  };

  const getCategoryBadge = (category: string) => {
    const styles: Record<string, string> = {
      nps: 'bg-purple-100 text-purple-700',
      csat: 'bg-blue-100 text-blue-700',
      feedback: 'bg-green-100 text-green-700',
      onboarding: 'bg-orange-100 text-orange-700',
      custom: 'bg-gray-100 text-gray-700',
    };
    return styles[category] || styles.custom;
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      draft: 'bg-gray-100 text-gray-600',
      active: 'bg-green-100 text-green-600',
      archived: 'bg-red-100 text-red-600',
    };
    return styles[status] || styles.draft;
  };

  const getQuestionCount = (surveyJson: any) => {
    if (surveyJson?.pages) {
      return surveyJson.pages.reduce((sum: number, page: any) => sum + (page.elements?.length || 0), 0);
    }
    return surveyJson?.elements?.length || 0;
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Surveys</h1>
          <p className="text-gray-500 mt-1">Create and manage survey templates</p>
        </div>
        <button
          onClick={() => {
            setEditingSurvey(null);
            setShowEditor(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Survey
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search surveys..."
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
          <option value="active">Active</option>
          <option value="archived">Archived</option>
        </select>
      </div>

      {/* Surveys Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full" />
        </div>
      ) : surveys?.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-100">
          <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900">No surveys yet</h3>
          <p className="text-gray-500 mt-1">Create your first survey to get started</p>
          <button
            onClick={() => setShowEditor(true)}
            className="mt-4 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
          >
            Create Survey
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {surveys?.map((survey) => (
            <div
              key={survey.id}
              className="bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-mono text-gray-400">{survey.code}</span>
                      <span className={`px-2 py-0.5 text-xs rounded-full ${getStatusBadge(survey.status)}`}>
                        {survey.status}
                      </span>
                    </div>
                    <h3 className="font-semibold text-gray-900 truncate">{survey.title}</h3>
                    {survey.description && (
                      <p className="text-sm text-gray-500 mt-1 line-clamp-2">{survey.description}</p>
                    )}
                  </div>
                  <div className="relative">
                    <button
                      onClick={() => setMenuOpen(menuOpen === survey.id ? null : survey.id)}
                      className="p-1 text-gray-400 hover:text-gray-600 rounded"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>
                    {menuOpen === survey.id && (
                      <div className="absolute right-0 top-8 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-10 min-w-[160px]">
                        <button
                          onClick={() => {
                            setPreviewSurvey(survey);
                            setMenuOpen(null);
                          }}
                          className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                        >
                          <Eye className="w-4 h-4" />
                          Preview
                        </button>
                        <button
                          onClick={() => handleEdit(survey)}
                          className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                        >
                          <Edit2 className="w-4 h-4" />
                          Edit
                        </button>
                        <button
                          onClick={() => {
                            duplicateMutation.mutate(survey);
                            setMenuOpen(null);
                          }}
                          className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                        >
                          <Copy className="w-4 h-4" />
                          Duplicate
                        </button>
                        <hr className="my-1" />
                        {survey.status === 'draft' && (
                          <button
                            onClick={() => {
                              updateStatusMutation.mutate({ id: survey.id, status: 'active' });
                              setMenuOpen(null);
                            }}
                            className="w-full flex items-center gap-2 px-4 py-2 text-sm text-green-600 hover:bg-gray-50"
                          >
                            <CheckCircle className="w-4 h-4" />
                            Activate
                          </button>
                        )}
                        {survey.status === 'active' && (
                          <button
                            onClick={() => {
                              updateStatusMutation.mutate({ id: survey.id, status: 'archived' });
                              setMenuOpen(null);
                            }}
                            className="w-full flex items-center gap-2 px-4 py-2 text-sm text-orange-600 hover:bg-gray-50"
                          >
                            <Archive className="w-4 h-4" />
                            Archive
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(survey.id)}
                          className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-gray-50"
                        >
                          <Trash2 className="w-4 h-4" />
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3 mt-4 pt-3 border-t border-gray-100">
                  <span className={`px-2 py-0.5 text-xs rounded-full ${getCategoryBadge(survey.category)}`}>
                    {survey.category.toUpperCase()}
                  </span>
                  <span className="text-xs text-gray-400">
                    {getQuestionCount(survey.survey_json)} questions
                  </span>
                  <span className="text-xs text-gray-400 ml-auto">
                    {new Date(survey.created_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Editor Modal */}
      {showEditor && (
        <SurveyEditorModal
          survey={editingSurvey}
          onClose={() => {
            setShowEditor(false);
            setEditingSurvey(null);
          }}
          onSave={() => {
            queryClient.invalidateQueries({ queryKey: ['surveys'] });
            setShowEditor(false);
            setEditingSurvey(null);
          }}
        />
      )}

      {/* Preview Modal */}
      {previewSurvey && (
        <SurveyPreviewModal
          survey={previewSurvey}
          onClose={() => setPreviewSurvey(null)}
        />
      )}
    </div>
  );
}
