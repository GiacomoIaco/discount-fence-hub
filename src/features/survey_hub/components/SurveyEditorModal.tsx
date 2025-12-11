import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import { X, Save, FileText, Settings, Palette } from 'lucide-react';
import toast from 'react-hot-toast';
import type { Survey, BrandConfig } from '../types';
import SimpleSurveyBuilder from '../../surveys/SurveyBuilder';
import { useAuth } from '../../../contexts/AuthContext';

interface SurveyEditorModalProps {
  survey: Survey | null;
  onClose: () => void;
  onSave: () => void;
}

type EditorTab = 'questions' | 'settings' | 'branding';

export default function SurveyEditorModal({ survey, onClose, onSave }: SurveyEditorModalProps) {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<EditorTab>('questions');
  const [title, setTitle] = useState(survey?.title || '');
  const [description, setDescription] = useState(survey?.description || '');
  const [category, setCategory] = useState<Survey['category']>(survey?.category || 'custom');
  const [isAnonymous, setIsAnonymous] = useState(survey?.is_anonymous || false);
  const [collectInfo, setCollectInfo] = useState(survey?.collect_respondent_info ?? true);
  const [surveyJson, setSurveyJson] = useState<any>(survey?.survey_json || { elements: [] });
  const [brandConfig, setBrandConfig] = useState<BrandConfig>(survey?.brand_config || {});
  const [showBuilder, setShowBuilder] = useState(false);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const data = {
        title,
        description: description || null,
        category,
        is_anonymous: isAnonymous,
        collect_respondent_info: collectInfo,
        survey_json: surveyJson,
        brand_config: brandConfig,
        created_by: user?.id,
      };

      if (survey?.id) {
        const { error } = await supabase.from('surveys').update(data).eq('id', survey.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('surveys').insert(data);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(survey ? 'Survey updated' : 'Survey created');
      onSave();
    },
    onError: (err: any) => toast.error(err.message || 'Failed to save survey'),
  });

  const handleBuilderSave = (json: any) => {
    setSurveyJson(json);
    setShowBuilder(false);
  };

  const getQuestionCount = () => {
    if (surveyJson?.pages) {
      return surveyJson.pages.reduce((sum: number, page: any) => sum + (page.elements?.length || 0), 0);
    }
    return surveyJson?.elements?.length || 0;
  };

  const tabs = [
    { key: 'questions' as EditorTab, label: 'Questions', icon: FileText },
    { key: 'settings' as EditorTab, label: 'Settings', icon: Settings },
    { key: 'branding' as EditorTab, label: 'Branding', icon: Palette },
  ];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            {survey ? 'Edit Survey' : 'New Survey'}
          </h2>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 px-4">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors ${
                  activeTab === tab.key
                    ? 'border-emerald-600 text-emerald-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {activeTab === 'questions' && (
            <div className="space-y-6">
              {/* Basic Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g., Builder Satisfaction Survey"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as Survey['category'])}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  >
                    <option value="nps">NPS (Net Promoter Score)</option>
                    <option value="csat">CSAT (Customer Satisfaction)</option>
                    <option value="feedback">General Feedback</option>
                    <option value="onboarding">Onboarding</option>
                    <option value="custom">Custom</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Brief description of the survey purpose..."
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                />
              </div>

              {/* Questions Builder */}
              <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-medium text-gray-900">Survey Questions</h3>
                    <p className="text-sm text-gray-500">
                      {getQuestionCount()} questions configured
                    </p>
                  </div>
                  <button
                    onClick={() => setShowBuilder(true)}
                    className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm"
                  >
                    {getQuestionCount() > 0 ? 'Edit Questions' : 'Add Questions'}
                  </button>
                </div>

                {getQuestionCount() > 0 && (
                  <div className="space-y-2">
                    {(surveyJson.pages || [{ elements: surveyJson.elements }]).map((page: any, pageIdx: number) =>
                      page.elements?.map((el: any, idx: number) => (
                        <div
                          key={`${pageIdx}-${idx}`}
                          className="flex items-center gap-3 p-3 bg-white rounded-lg border border-gray-200"
                        >
                          <span className="w-6 h-6 bg-emerald-100 text-emerald-700 rounded text-xs font-medium flex items-center justify-center">
                            {idx + 1}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">{el.title}</p>
                            <p className="text-xs text-gray-500 capitalize">{el.type}</p>
                          </div>
                          {el.isRequired && (
                            <span className="text-xs text-red-500">Required</span>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="space-y-6">
              <div className="space-y-4">
                <h3 className="font-medium text-gray-900">Response Settings</h3>

                <label className="flex items-start gap-3 p-4 bg-gray-50 rounded-lg cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isAnonymous}
                    onChange={(e) => setIsAnonymous(e.target.checked)}
                    className="mt-0.5 rounded text-emerald-600 focus:ring-emerald-500"
                  />
                  <div>
                    <p className="font-medium text-gray-900">Anonymous Responses</p>
                    <p className="text-sm text-gray-500">
                      Responses won't be linked to the recipient's identity (pseudonymous - you'll know who was sent the survey but not who responded with what)
                    </p>
                  </div>
                </label>

                <label className="flex items-start gap-3 p-4 bg-gray-50 rounded-lg cursor-pointer">
                  <input
                    type="checkbox"
                    checked={collectInfo}
                    onChange={(e) => setCollectInfo(e.target.checked)}
                    className="mt-0.5 rounded text-emerald-600 focus:ring-emerald-500"
                  />
                  <div>
                    <p className="font-medium text-gray-900">Collect Respondent Info</p>
                    <p className="text-sm text-gray-500">
                      Ask for name, email, and company at the start of the survey
                    </p>
                  </div>
                </label>
              </div>
            </div>
          )}

          {activeTab === 'branding' && (
            <div className="space-y-6">
              <div>
                <h3 className="font-medium text-gray-900 mb-4">Survey Appearance</h3>
                <p className="text-sm text-gray-500 mb-4">
                  Customize how the public survey page looks to respondents
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Company Name</label>
                    <input
                      type="text"
                      value={brandConfig.companyName || ''}
                      onChange={(e) => setBrandConfig({ ...brandConfig, companyName: e.target.value })}
                      placeholder="Discount Fence USA"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Primary Color</label>
                    <div className="flex gap-2">
                      <input
                        type="color"
                        value={brandConfig.primaryColor || '#059669'}
                        onChange={(e) => setBrandConfig({ ...brandConfig, primaryColor: e.target.value })}
                        className="w-12 h-10 rounded cursor-pointer"
                      />
                      <input
                        type="text"
                        value={brandConfig.primaryColor || '#059669'}
                        onChange={(e) => setBrandConfig({ ...brandConfig, primaryColor: e.target.value })}
                        placeholder="#059669"
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Logo URL</label>
                    <input
                      type="text"
                      value={brandConfig.logo || ''}
                      onChange={(e) => setBrandConfig({ ...brandConfig, logo: e.target.value })}
                      placeholder="https://..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Background Image URL</label>
                    <input
                      type="text"
                      value={brandConfig.backgroundImage || ''}
                      onChange={(e) => setBrandConfig({ ...brandConfig, backgroundImage: e.target.value })}
                      placeholder="https://..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>
              </div>

              {/* Preview */}
              <div className="border border-gray-200 rounded-lg p-4">
                <h4 className="text-sm font-medium text-gray-700 mb-3">Preview</h4>
                <div
                  className="rounded-lg p-6 text-center"
                  style={{
                    backgroundColor: brandConfig.primaryColor || '#059669',
                    backgroundImage: brandConfig.backgroundImage ? `url(${brandConfig.backgroundImage})` : undefined,
                    backgroundSize: 'cover',
                  }}
                >
                  {brandConfig.logo && (
                    <img src={brandConfig.logo} alt="Logo" className="h-12 mx-auto mb-3" />
                  )}
                  <h3 className="text-white font-semibold text-lg">
                    {brandConfig.companyName || 'Your Company'}
                  </h3>
                  <p className="text-white/80 text-sm mt-1">{title || 'Survey Title'}</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-4 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => saveMutation.mutate()}
            disabled={!title || saveMutation.isPending}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {saveMutation.isPending ? 'Saving...' : 'Save Survey'}
          </button>
        </div>
      </div>

      {/* Survey Builder Overlay */}
      {showBuilder && (
        <div className="fixed inset-0 bg-white z-[60] overflow-auto">
          <SimpleSurveyBuilder
            initialJson={surveyJson}
            onSave={handleBuilderSave}
            onCancel={() => setShowBuilder(false)}
          />
        </div>
      )}
    </div>
  );
}
