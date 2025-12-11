import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '../../../lib/supabase';
import { CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import SurveyRenderer from '../../surveys/components/SurveyRenderer';
import type { Survey, SurveyDistribution, SurveyRecipient } from '../types';

interface SurveyData {
  survey: Survey;
  distribution: SurveyDistribution;
  recipient: SurveyRecipient | null;
}

export default function PublicSurveyPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || searchParams.get('t');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [surveyData, setSurveyData] = useState<SurveyData | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [startTime] = useState(Date.now());

  useEffect(() => {
    if (!token) {
      setError('Invalid survey link');
      setLoading(false);
      return;
    }

    loadSurvey();
  }, [token]);

  const loadSurvey = async () => {
    try {
      // First try to find by recipient token (personalized link)
      let recipient: SurveyRecipient | null = null;
      let distribution: SurveyDistribution | null = null;

      const { data: recipientData } = await supabase
        .from('survey_recipients')
        .select(`
          *,
          distribution:survey_distributions(
            *,
            survey:surveys(*)
          )
        `)
        .eq('response_token', token)
        .single();

      if (recipientData) {
        recipient = recipientData as SurveyRecipient;
        distribution = (recipientData as any).distribution;

        // Check if already completed
        if (recipientData.completed_at) {
          setError('You have already completed this survey. Thank you!');
          setLoading(false);
          return;
        }

        // Mark as started
        if (!recipientData.started_at) {
          await supabase
            .from('survey_recipients')
            .update({ started_at: new Date().toISOString() })
            .eq('id', recipientData.id);
        }
      } else {
        // Try public distribution token
        const { data: distData } = await supabase
          .from('survey_distributions')
          .select(`
            *,
            survey:surveys(*)
          `)
          .eq('public_token', token)
          .single();

        if (distData) {
          distribution = distData as any;
        }
      }

      if (!distribution) {
        setError('Survey not found or link has expired');
        setLoading(false);
        return;
      }

      // Check expiration
      if (distribution.expires_at && new Date(distribution.expires_at) < new Date()) {
        setError('This survey has expired');
        setLoading(false);
        return;
      }

      const survey = (distribution as any).survey as Survey;
      if (!survey) {
        setError('Survey configuration error');
        setLoading(false);
        return;
      }

      setSurveyData({ survey, distribution, recipient });
      setLoading(false);
    } catch (err) {
      console.error('Error loading survey:', err);
      setError('Failed to load survey');
      setLoading(false);
    }
  };

  const handleComplete = async (responseData: Record<string, any>) => {
    if (!surveyData) return;

    const { survey, distribution, recipient } = surveyData;
    const completionTime = Math.round((Date.now() - startTime) / 1000);

    try {
      // Extract NPS and CSAT scores if present
      let npsScore: number | null = null;
      let csatScore: number | null = null;

      Object.entries(responseData).forEach(([key, value]) => {
        if (typeof value === 'number') {
          const lowerKey = key.toLowerCase();
          if (lowerKey.includes('nps') || lowerKey.includes('recommend')) {
            npsScore = value;
          } else if (lowerKey.includes('csat') || lowerKey.includes('satisfaction')) {
            csatScore = value;
          }
        }
      });

      // Detect device type
      const width = window.innerWidth;
      const deviceType = width < 768 ? 'mobile' : width < 1024 ? 'tablet' : 'desktop';

      // Insert response
      const { error: insertError } = await supabase.from('survey_responses').insert({
        distribution_id: distribution.id,
        recipient_id: recipient?.id || null,
        response_data: responseData,
        nps_score: npsScore,
        csat_score: csatScore,
        respondent_name: responseData.name || responseData.respondent_name || null,
        respondent_email: responseData.email || responseData.respondent_email || null,
        respondent_phone: responseData.phone || responseData.respondent_phone || null,
        respondent_company: responseData.company || responseData.respondent_company || null,
        is_anonymous: survey.is_anonymous,
        device_type: deviceType,
        started_at: new Date(startTime).toISOString(),
        completed_at: new Date().toISOString(),
        time_to_complete: completionTime,
      });

      if (insertError) throw insertError;

      // Update recipient if exists
      if (recipient) {
        await supabase
          .from('survey_recipients')
          .update({ completed_at: new Date().toISOString() })
          .eq('id', recipient.id);
      }

      setSubmitted(true);
    } catch (err) {
      console.error('Error submitting response:', err);
      alert('Failed to submit response. Please try again.');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-emerald-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading survey...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-xl font-semibold text-gray-900 mb-2">Oops!</h1>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md text-center">
          <CheckCircle className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
          <h1 className="text-2xl font-semibold text-gray-900 mb-2">Thank You!</h1>
          <p className="text-gray-600">
            Your response has been submitted successfully. We appreciate your feedback!
          </p>
        </div>
      </div>
    );
  }

  if (!surveyData) return null;

  const { survey } = surveyData;
  const brandConfig = survey.brand_config || {};
  const primaryColor = brandConfig.primaryColor || '#059669';

  return (
    <div
      className="min-h-screen"
      style={{
        backgroundColor: '#f3f4f6',
        backgroundImage: brandConfig.backgroundImage ? `url(${brandConfig.backgroundImage})` : undefined,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      {/* Header */}
      <div
        className="py-8 px-4"
        style={{ backgroundColor: primaryColor }}
      >
        <div className="max-w-2xl mx-auto text-center text-white">
          {brandConfig.logo && (
            <img src={brandConfig.logo} alt="Logo" className="h-12 mx-auto mb-4" />
          )}
          <h1 className="text-2xl font-bold">
            {brandConfig.companyName || 'Discount Fence USA'}
          </h1>
          <p className="text-white/80 mt-1">{survey.title}</p>
        </div>
      </div>

      {/* Survey Content */}
      <div className="max-w-2xl mx-auto py-8 px-4">
        <div className="bg-white rounded-xl shadow-lg p-6 md:p-8">
          {survey.description && (
            <p className="text-gray-600 mb-6">{survey.description}</p>
          )}

          <SurveyRenderer
            surveyJson={survey.survey_json}
            onComplete={handleComplete}
          />
        </div>

        {/* Footer */}
        <p className="text-center text-gray-400 text-sm mt-6">
          Powered by Discount Fence Hub
        </p>
      </div>
    </div>
  );
}
