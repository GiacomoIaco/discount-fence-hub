import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import type {
  QuarterlyObjective,
  CreateQuarterlyObjectiveInput,
  UpdateQuarterlyObjectiveInput,
  BonusKPI,
  CreateBonusKPIInput,
  UpdateBonusKPIInput,
  BonusKPIWeight,
  CreateBonusKPIWeightInput,
  UpdateBonusKPIWeightInput,
  BonusCalculation,
  CalculateBonusInput,
  BonusCalculationDetails,
} from '../lib/operating-plan.types';

// ============================================
// Quarterly Objectives Queries
// ============================================

export const useQuarterlyObjectivesQuery = (initiativeId: string, year: number) => {
  return useQuery({
    queryKey: ['quarterly-objectives', initiativeId, year],
    queryFn: async (): Promise<QuarterlyObjective[]> => {
      const { data, error } = await supabase
        .from('initiative_quarterly_objectives')
        .select('*')
        .eq('initiative_id', initiativeId)
        .eq('year', year)
        .order('quarter', { ascending: true });

      if (error) throw error;
      return data || [];
    },
  });
};

export const useQuarterlyObjectivesByFunctionQuery = (functionId: string, year: number, quarter?: number) => {
  return useQuery({
    queryKey: ['quarterly-objectives-by-function', functionId, year, quarter],
    queryFn: async (): Promise<QuarterlyObjective[]> => {
      let query = supabase
        .from('initiative_quarterly_objectives')
        .select(`
          *,
          initiative:project_initiatives!inner(
            id,
            title,
            area:project_areas!inner(
              id,
              function_id
            )
          )
        `)
        .eq('year', year);

      if (quarter) {
        query = query.eq('quarter', quarter);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Filter by function_id in the nested data
      const filtered = data?.filter((obj: any) =>
        obj.initiative?.area?.function_id === functionId
      ) || [];

      return filtered;
    },
  });
};

export const useCreateQuarterlyObjective = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateQuarterlyObjectiveInput) => {
      const { data: { user } } = await supabase.auth.getUser();

      const { data, error } = await supabase
        .from('initiative_quarterly_objectives')
        .insert({
          ...input,
          created_by: user?.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['quarterly-objectives', data.initiative_id] });
      queryClient.invalidateQueries({ queryKey: ['quarterly-objectives-by-function'] });
    },
  });
};

export const useUpdateQuarterlyObjective = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...input }: UpdateQuarterlyObjectiveInput) => {
      const { data, error } = await supabase
        .from('initiative_quarterly_objectives')
        .update(input)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['quarterly-objectives', data.initiative_id] });
      queryClient.invalidateQueries({ queryKey: ['quarterly-objectives-by-function'] });
    },
  });
};

export const useDeleteQuarterlyObjective = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('initiative_quarterly_objectives')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quarterly-objectives'] });
      queryClient.invalidateQueries({ queryKey: ['quarterly-objectives-by-function'] });
    },
  });
};

// ============================================
// Bonus KPIs Queries
// ============================================

export const useBonusKPIsQuery = (functionId: string, year: number) => {
  return useQuery({
    queryKey: ['bonus-kpis', functionId, year],
    queryFn: async (): Promise<BonusKPI[]> => {
      const { data, error} = await supabase
        .from('bonus_kpis')
        .select(`
          *,
          weights:bonus_kpi_weights(*)
        `)
        .eq('function_id', functionId)
        .eq('year', year)
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

      if (error) throw error;
      return data || [];
    },
  });
};

export const useBonusKPIQuery = (id: string) => {
  return useQuery({
    queryKey: ['bonus-kpi', id],
    queryFn: async (): Promise<BonusKPI> => {
      const { data, error } = await supabase
        .from('bonus_kpis')
        .select(`
          *,
          weights:bonus_kpi_weights(*)
        `)
        .eq('id', id)
        .single();

      if (error) throw error;
      return data;
    },
  });
};

export const useCreateBonusKPI = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateBonusKPIInput) => {
      const { data: { user } } = await supabase.auth.getUser();

      const { data, error } = await supabase
        .from('bonus_kpis')
        .insert({
          ...input,
          created_by: user?.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['bonus-kpis', data.function_id, data.year] });
    },
  });
};

export const useUpdateBonusKPI = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...input }: UpdateBonusKPIInput) => {
      const { data, error } = await supabase
        .from('bonus_kpis')
        .update(input)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['bonus-kpis', data.function_id, data.year] });
      queryClient.invalidateQueries({ queryKey: ['bonus-kpi', data.id] });
    },
  });
};

export const useDeleteBonusKPI = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('bonus_kpis')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bonus-kpis'] });
    },
  });
};

// ============================================
// Bonus KPI Weights Queries
// ============================================

export const useBonusKPIWeightsQuery = (bonusKpiId: string) => {
  return useQuery({
    queryKey: ['bonus-kpi-weights', bonusKpiId],
    queryFn: async (): Promise<BonusKPIWeight[]> => {
      const { data, error } = await supabase
        .from('bonus_kpi_weights')
        .select('*')
        .eq('bonus_kpi_id', bonusKpiId);

      if (error) throw error;
      return data || [];
    },
  });
};

export const useUserBonusWeightsQuery = (userId: string, functionId: string, year: number) => {
  return useQuery({
    queryKey: ['user-bonus-weights', userId, functionId, year],
    queryFn: async (): Promise<BonusKPIWeight[]> => {
      const { data, error } = await supabase
        .from('bonus_kpi_weights')
        .select(`
          *,
          bonus_kpi:bonus_kpis!inner(*)
        `)
        .eq('user_id', userId)
        .eq('bonus_kpi.function_id', functionId)
        .eq('bonus_kpi.year', year);

      if (error) throw error;
      return data || [];
    },
  });
};

export const useCreateBonusKPIWeight = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateBonusKPIWeightInput) => {
      const { data, error } = await supabase
        .from('bonus_kpi_weights')
        .insert(input)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['bonus-kpi-weights', data.bonus_kpi_id] });
      queryClient.invalidateQueries({ queryKey: ['user-bonus-weights', data.user_id] });
    },
  });
};

export const useUpdateBonusKPIWeight = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, weight }: UpdateBonusKPIWeightInput) => {
      const { data, error } = await supabase
        .from('bonus_kpi_weights')
        .update({ weight })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['bonus-kpi-weights', data.bonus_kpi_id] });
      queryClient.invalidateQueries({ queryKey: ['user-bonus-weights', data.user_id] });
    },
  });
};

export const useDeleteBonusKPIWeight = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('bonus_kpi_weights')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bonus-kpi-weights'] });
      queryClient.invalidateQueries({ queryKey: ['user-bonus-weights'] });
    },
  });
};

// ============================================
// Bonus Calculations
// ============================================

export const useCalculateBonus = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CalculateBonusInput): Promise<BonusCalculation> => {
      const { data: { user } } = await supabase.auth.getUser();

      // Fetch KPIs with weights for this user
      const { data: kpis, error: kpisError } = await supabase
        .from('bonus_kpis')
        .select(`
          *,
          weights:bonus_kpi_weights!inner(weight)
        `)
        .eq('function_id', input.function_id)
        .eq('year', input.year)
        .eq('weights.user_id', input.user_id);

      if (kpisError) throw kpisError;

      // Calculate bonus multiplier
      let totalMultiplier = 0;
      const kpiDetails = [];

      for (const kpi of kpis || []) {
        const weight = kpi.weights[0]?.weight || 0;

        // Calculate achieved multiplier based on current value
        let achievedMultiplier = 1.0; // Default

        if (kpi.current_value !== null && kpi.target_value !== null) {
          if (kpi.current_value <= (kpi.min_threshold || 0)) {
            achievedMultiplier = kpi.min_multiplier;
          } else if (kpi.current_value >= (kpi.max_threshold || kpi.target_value)) {
            achievedMultiplier = kpi.max_multiplier;
          } else {
            // Linear interpolation
            const targetValue = kpi.target_value;
            const minThreshold = kpi.min_threshold || 0;
            const maxThreshold = kpi.max_threshold || targetValue;

            if (kpi.current_value < targetValue) {
              // Between min and target
              const range = targetValue - minThreshold;
              const position = kpi.current_value - minThreshold;
              const multiplierRange = 1.0 - kpi.min_multiplier;
              achievedMultiplier = kpi.min_multiplier + (position / range) * multiplierRange;
            } else {
              // Between target and max
              const range = maxThreshold - targetValue;
              const position = kpi.current_value - targetValue;
              const multiplierRange = kpi.max_multiplier - 1.0;
              achievedMultiplier = 1.0 + (position / range) * multiplierRange;
            }
          }
        }

        const weightedContribution = (achievedMultiplier * weight) / 100;
        totalMultiplier += weightedContribution;

        kpiDetails.push({
          kpi_id: kpi.id,
          kpi_name: kpi.name,
          weight,
          target_value: kpi.target_value,
          current_value: kpi.current_value,
          achieved_multiplier: achievedMultiplier,
          weighted_contribution: weightedContribution,
        });
      }

      const calculationDetails: BonusCalculationDetails = {
        kpis: kpiDetails,
        total_multiplier: totalMultiplier,
        calculation_date: new Date().toISOString(),
      };

      // Save calculation
      const { data, error } = await supabase
        .from('bonus_calculations')
        .insert({
          function_id: input.function_id,
          user_id: input.user_id,
          year: input.year,
          quarter: input.quarter || null,
          calculated_multiplier: totalMultiplier,
          calculation_details: calculationDetails,
          created_by: user?.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: ['bonus-calculations', data.function_id, data.user_id, data.year]
      });
    },
  });
};

export const useBonusCalculationsQuery = (functionId: string, userId: string, year: number) => {
  return useQuery({
    queryKey: ['bonus-calculations', functionId, userId, year],
    queryFn: async (): Promise<BonusCalculation[]> => {
      const { data, error } = await supabase
        .from('bonus_calculations')
        .select('*')
        .eq('function_id', functionId)
        .eq('user_id', userId)
        .eq('year', year)
        .order('calculated_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
  });
};
