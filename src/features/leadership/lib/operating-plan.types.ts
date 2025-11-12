/**
 * Operating Plan and Bonus KPI Types
 * For quarterly planning, scoring workflows, and bonus management
 */

// ============================================
// Quarterly Objectives
// ============================================

export type WorkflowState = 'draft' | 'bu_scoring' | 'pending_ceo_review' | 'ceo_approved';
export type QuarterlyScore = 0 | 0.25 | 0.5 | 0.75 | 1.0;

export interface QuarterlyObjective {
  id: string;
  initiative_id: string;
  year: number;
  quarter: number; // 1-4
  objective: string;
  bu_score: QuarterlyScore | null;
  ceo_score: QuarterlyScore | null;
  workflow_state: WorkflowState;
  scored_at: string | null;
  approved_at: string | null;
  locked: boolean;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export interface CreateQuarterlyObjectiveInput {
  initiative_id: string;
  year: number;
  quarter: number;
  objective: string;
}

export interface UpdateQuarterlyObjectiveInput {
  id: string;
  objective?: string;
  quarter?: number;
  bu_score?: QuarterlyScore | null;
  ceo_score?: QuarterlyScore | null;
  workflow_state?: WorkflowState;
  scored_at?: string | null;
  approved_at?: string | null;
  locked?: boolean;
}

export interface BulkScoreObjectivesInput {
  year: number;
  quarter: number;
  initiative_id: string;
  bu_score: QuarterlyScore;
}

// ============================================
// Bonus KPIs
// ============================================

export type BonusKPIUnit = 'dollars' | 'percent' | 'score' | 'count' | 'text';

export interface BonusKPI {
  id: string;
  function_id: string;
  year: number;
  name: string;
  description: string | null;
  target_value: number | null;
  target_text: string | null;
  current_value: number | null;
  unit: BonusKPIUnit;
  min_threshold: number | null;
  min_multiplier: number; // Default 0.5
  max_threshold: number | null;
  max_multiplier: number; // Default 2.0
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by: string | null;

  // Populated from joins
  weights?: BonusKPIWeight[];
}

export interface CreateBonusKPIInput {
  function_id: string;
  year: number;
  name: string;
  description?: string;
  target_value?: number;
  target_text?: string;
  unit: BonusKPIUnit;
  min_threshold?: number;
  min_multiplier?: number;
  max_threshold?: number;
  max_multiplier?: number;
  sort_order?: number;
}

export interface UpdateBonusKPIInput {
  id: string;
  name?: string;
  description?: string;
  target_value?: number;
  target_text?: string;
  current_value?: number;
  unit?: BonusKPIUnit;
  min_threshold?: number;
  min_multiplier?: number;
  max_threshold?: number;
  max_multiplier?: number;
  sort_order?: number;
  is_active?: boolean;
}

// ============================================
// Bonus KPI Weights
// ============================================

export interface BonusKPIWeight {
  id: string;
  bonus_kpi_id: string;
  user_id: string;
  weight: number; // 0-100
  created_at: string;
  updated_at: string;

  // Populated from joins
  user?: {
    id: string;
    name: string;
    email: string;
  };
  bonus_kpi?: BonusKPI;
}

export interface CreateBonusKPIWeightInput {
  bonus_kpi_id: string;
  user_id: string;
  weight: number;
}

export interface UpdateBonusKPIWeightInput {
  id: string;
  weight: number;
}

export interface BulkUpdateWeightsInput {
  bonus_kpi_id: string;
  user_id: string;
  weights: Array<{
    bonus_kpi_id: string;
    weight: number;
  }>;
}

// ============================================
// Bonus Calculations
// ============================================

export interface BonusCalculation {
  id: string;
  function_id: string;
  user_id: string;
  year: number;
  quarter: number | null;
  calculated_multiplier: number;
  calculation_details: BonusCalculationDetails;
  calculated_at: string;
  created_by: string | null;
}

export interface BonusCalculationDetails {
  kpis: Array<{
    kpi_id: string;
    kpi_name: string;
    weight: number;
    target_value: number;
    current_value: number;
    achieved_multiplier: number;
    weighted_contribution: number;
  }>;
  total_multiplier: number;
  calculation_date: string;
}

export interface CalculateBonusInput {
  function_id: string;
  user_id: string;
  year: number;
  quarter?: number;
}

// ============================================
// Helper Types
// ============================================

export interface QuarterlyPlanGridRow {
  initiative_id: string;
  initiative_name: string;
  annual_target: string | null;
  q1: QuarterlyObjective | null;
  q2: QuarterlyObjective | null;
  q3: QuarterlyObjective | null;
  q4: QuarterlyObjective | null;
}

export interface BonusKPIWithProgress extends BonusKPI {
  progress_percent: number; // 0-100
  achieved_multiplier: number;
  status: 'below_min' | 'between' | 'above_max';
}

export interface UserBonusSummary {
  user_id: string;
  user_name: string;
  total_weight: number; // Should equal 100
  current_multiplier: number;
  kpi_contributions: Array<{
    kpi_name: string;
    weight: number;
    achieved_multiplier: number;
    contribution: number;
  }>;
}
