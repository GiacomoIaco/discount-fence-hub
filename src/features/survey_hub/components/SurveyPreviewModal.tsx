import { X } from 'lucide-react';
import type { Survey } from '../types';
import SurveyRenderer from '../../surveys/components/SurveyRenderer';

interface SurveyPreviewModalProps {
  survey: Survey;
  onClose: () => void;
}

export default function SurveyPreviewModal({ survey, onClose }: SurveyPreviewModalProps) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div
          className="p-4 border-b"
          style={{ backgroundColor: survey.brand_config?.primaryColor || '#059669' }}
        >
          <div className="flex items-center justify-between">
            <div className="text-white">
              {survey.brand_config?.logo && (
                <img src={survey.brand_config.logo} alt="Logo" className="h-8 mb-2" />
              )}
              <h2 className="text-lg font-semibold">
                {survey.brand_config?.companyName || 'Survey Preview'}
              </h2>
              <p className="text-white/80 text-sm">{survey.title}</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-white/80 hover:text-white hover:bg-white/20 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Survey Content */}
        <div className="flex-1 overflow-auto p-6">
          <div className="max-w-2xl mx-auto">
            <SurveyRenderer
              surveyJson={survey.survey_json}
              onComplete={(data) => {
                console.log('Preview response:', data);
                alert('This is just a preview. Responses are not saved.');
              }}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 bg-gray-50 text-center">
          <p className="text-sm text-gray-500">
            This is a preview. Actual responses will be collected when sent via a campaign.
          </p>
        </div>
      </div>
    </div>
  );
}
