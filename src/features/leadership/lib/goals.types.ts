// ============================================
// SIMPLIFIED GOAL SYSTEM - TYPE DEFINITIONS
// ============================================

// ============================================
// ANNUAL GOALS
// ============================================

export interface AnnualGoal {
  id: string;
  function_id: string;
  year: number;

  title: string;
  description?: string;
  target?: string; // Simple text: "-15% cost reduction", "98% delivery"

  weight: number; // % of focus (must total 100% per function)
  achievement_percentage: number; // 0-100, manually set

  status: 'active' | 'completed' | 'cancelled';

  created_by?: string;
  sort_order: number;

  created_at: string;
  updated_at: string;
}

export interface CreateAnnualGoalInput {
  function_id: string;
  year: number;
  title: string;
  description?: string;
  target?: string;
  weight: number;
  sort_order?: number;
}

export interface UpdateAnnualGoalInput extends Partial<CreateAnnualGoalInput> {
  id: string;
  achievement_percentage?: number;
  status?: 'active' | 'completed' | 'cancelled';
}

// ============================================
// QUARTERLY GOALS
// ============================================

export interface QuarterlyGoal {
  id: string;
  annual_goal_id: string;
  quarter: 1 | 2 | 3 | 4;
  year: number;

  target?: string; // Q1 milestone
  achievement_percentage: number; // 0-100, manually set
  notes?: string; // Review notes

  created_at: string;
  updated_at: string;
}

export interface CreateQuarterlyGoalInput {
  annual_goal_id: string;
  quarter: 1 | 2 | 3 | 4;
  year: number;
  target?: string;
}

export interface UpdateQuarterlyGoalInput extends Partial<CreateQuarterlyGoalInput> {
  id: string;
  achievement_percentage?: number;
  notes?: string;
}

// ============================================
// TASKS
// ============================================

export interface Task {
  id: string;
  initiative_id: string;

  title: string;
  description?: string;

  assigned_to?: string;
  status: 'todo' | 'in_progress' | 'done' | 'blocked';

  due_date?: string;
  sort_order: number;
  completed_at?: string;

  created_at: string;
  updated_at: string;
}

export interface CreateTaskInput {
  initiative_id: string;
  title: string;
  description?: string;
  assigned_to?: string;
  status?: 'todo' | 'in_progress' | 'done' | 'blocked';
  due_date?: string;
  sort_order?: number;
}

export interface UpdateTaskInput extends Partial<CreateTaskInput> {
  id: string;
}

// ============================================
// INITIATIVE GOAL LINKS
// ============================================

export interface InitiativeGoalLink {
  id: string;
  initiative_id: string;
  quarterly_goal_id: string;
  created_at: string;
}

export interface CreateInitiativeGoalLinkInput {
  initiative_id: string;
  quarterly_goal_id: string;
}

// ============================================
// EXTENDED TYPES (WITH JOINS)
// ============================================

export interface AnnualGoalWithQuarterly extends AnnualGoal {
  quarterly_goals?: QuarterlyGoal[];
  function?: {
    id: string;
    name: string;
    color?: string;
  };
}

export interface QuarterlyGoalWithAnnual extends QuarterlyGoal {
  annual_goal?: AnnualGoal;
}

export interface InitiativeWithGoals {
  id: string;
  title: string;
  status: string;
  priority: string;
  this_week?: string;
  next_week?: string;
  progress_percent: number;
  assigned_to?: string;
  target_date?: string;

  // Linked goals
  linked_goals?: Array<{
    quarterly_goal: QuarterlyGoalWithAnnual;
  }>;

  // Tasks
  tasks?: Task[];
}

// ============================================
// UTILITY TYPES
// ============================================

export interface FunctionGoalSummary {
  function_id: string;
  function_name: string;
  year: number;
  quarter?: number;

  goals: Array<{
    goal: AnnualGoal;
    quarterly_goals: QuarterlyGoal[];
    linked_initiatives_count: number;
  }>;

  total_weight: number; // Should always be 100
  average_achievement: number; // Weighted average
}

// ============================================
// HELPER FUNCTIONS
// ============================================

export const getGoalWeightLabel = (weight: number): string => {
  if (weight >= 30) return 'High Priority';
  if (weight >= 15) return 'Medium Priority';
  return 'Low Priority';
};

export const isHighWeightGoal = (weight: number): boolean => {
  return weight >= 25;
};

export const calculateWeightedAverage = (goals: AnnualGoal[]): number => {
  const totalWeightedScore = goals.reduce((sum, goal) => {
    return sum + (goal.achievement_percentage * goal.weight / 100);
  }, 0);

  const totalWeight = goals.reduce((sum, goal) => sum + goal.weight, 0);

  return totalWeight > 0 ? totalWeightedScore / totalWeight * 100 : 0;
};

export const validateWeights = (goals: AnnualGoal[]): boolean => {
  const total = goals
    .filter(g => g.status === 'active')
    .reduce((sum, goal) => sum + goal.weight, 0);

  return total === 100;
};

export const getQuarterLabel = (quarter: 1 | 2 | 3 | 4, year: number): string => {
  return `Q${quarter} ${year}`;
};

export const getCurrentQuarter = (): { quarter: 1 | 2 | 3 | 4; year: number } => {
  const now = new Date();
  const month = now.getMonth() + 1; // 1-12
  const year = now.getFullYear();

  let quarter: 1 | 2 | 3 | 4;
  if (month <= 3) quarter = 1;
  else if (month <= 6) quarter = 2;
  else if (month <= 9) quarter = 3;
  else quarter = 4;

  return { quarter, year };
};
