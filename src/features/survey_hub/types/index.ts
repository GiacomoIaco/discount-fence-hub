// Survey Hub Types

export interface Survey {
  id: string;
  code: string;
  title: string;
  description: string | null;
  survey_json: any; // SurveyJS format
  category: 'nps' | 'csat' | 'feedback' | 'onboarding' | 'custom';
  tags: string[];
  is_anonymous: boolean;
  collect_respondent_info: boolean;
  allow_multiple_responses: boolean;
  brand_config: BrandConfig;
  status: 'draft' | 'active' | 'archived';
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface BrandConfig {
  logo?: string;
  primaryColor?: string;
  backgroundImage?: string;
  companyName?: string;
}

export interface SurveyPopulation {
  id: string;
  name: string;
  description: string | null;
  population_type: 'app_users' | 'db_clients' | 'imported' | 'mixed';
  filters: Record<string, any>;
  import_source: string | null;
  last_synced_at: string | null;
  contact_count: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface PopulationContact {
  id: string;
  population_id: string;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  contact_company: string | null;
  metadata: Record<string, any>;
  user_id: string | null;
  is_active: boolean;
  unsubscribed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface SurveyCampaign {
  id: string;
  code: string;
  name: string;
  survey_id: string;
  population_id: string;
  schedule_type: 'one_time' | 'recurring';
  send_at: string | null;
  recurrence_interval: number | null;
  recurrence_unit: 'days' | 'weeks' | 'months' | null;
  recurrence_time: string | null;
  next_send_at: string | null;
  last_sent_at: string | null;
  delivery_methods: ('email' | 'sms')[];
  send_reminders: boolean;
  reminder_days: number[];
  response_deadline_days: number;
  status: 'draft' | 'scheduled' | 'active' | 'paused' | 'completed';
  total_distributions: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  // Joined
  survey?: Survey;
  population?: SurveyPopulation;
}

export interface SurveyDistribution {
  id: string;
  campaign_id: string | null;
  survey_id: string;
  population_id: string | null;
  distribution_number: number;
  public_token: string;
  sent_at: string | null;
  expires_at: string | null;
  reminder_1_sent_at: string | null;
  reminder_2_sent_at: string | null;
  total_sent: number;
  total_delivered: number;
  total_opened: number;
  total_started: number;
  total_completed: number;
  response_rate: number | null;
  avg_completion_time: number | null;
  nps_score: number | null;
  created_at: string;
  // Joined
  survey?: Survey;
  campaign?: SurveyCampaign;
}

export interface SurveyRecipient {
  id: string;
  distribution_id: string;
  contact_id: string | null;
  recipient_name: string | null;
  recipient_email: string | null;
  recipient_phone: string | null;
  recipient_company: string | null;
  recipient_metadata: Record<string, any>;
  user_id: string | null;
  response_token: string;
  email_status: 'pending' | 'sent' | 'delivered' | 'opened' | 'bounced' | 'failed';
  email_sent_at: string | null;
  sms_status: 'pending' | 'sent' | 'delivered' | 'failed';
  sms_sent_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface SurveyResponse {
  id: string;
  distribution_id: string;
  recipient_id: string | null;
  response_data: Record<string, any>;
  nps_score: number | null;
  csat_score: number | null;
  respondent_name: string | null;
  respondent_email: string | null;
  respondent_phone: string | null;
  respondent_company: string | null;
  respondent_metadata: Record<string, any>;
  is_anonymous: boolean;
  device_type: string | null;
  started_at: string | null;
  completed_at: string;
  time_to_complete: number | null;
  created_at: string;
}

export interface SurveyAnalyticsSnapshot {
  id: string;
  distribution_id: string;
  survey_id: string;
  campaign_id: string | null;
  snapshot_date: string;
  total_recipients: number;
  total_responses: number;
  response_rate: number | null;
  avg_completion_time: number | null;
  nps_score: number | null;
  nps_promoters: number | null;
  nps_passives: number | null;
  nps_detractors: number | null;
  csat_score: number | null;
  question_analytics: Record<string, any>;
  segment_analytics: Record<string, any>;
  nps_change: number | null;
  response_rate_change: number | null;
  computed_at: string;
}

// UI Types
export type SurveyHubView = 'dashboard' | 'surveys' | 'populations' | 'campaigns' | 'analytics';

export interface CSVContact {
  name?: string;
  email?: string;
  phone?: string;
  company?: string;
  [key: string]: string | undefined;
}
