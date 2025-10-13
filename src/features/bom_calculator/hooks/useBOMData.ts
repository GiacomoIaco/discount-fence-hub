/**
 * Custom hooks for fetching BOM Calculator data from Supabase
 */

import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import type {
  BusinessUnit,
  Material,
  LaborCode,
  LaborRateWithDetails,
  WoodVerticalProductWithMaterials,
  WoodHorizontalProductWithMaterials,
  IronProductWithMaterials,
  BOMProject,
  ProjectWithDetails,
} from '../database.types';

// ============================================================================
// BUSINESS UNITS
// ============================================================================

export function useBusinessUnits() {
  const [businessUnits, setBusinessUnits] = useState<BusinessUnit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchBusinessUnits() {
      try {
        const { data, error } = await supabase
          .from('business_units')
          .select('*')
          .eq('is_active', true)
          .order('code');

        if (error) throw error;
        setBusinessUnits(data || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch business units');
      } finally {
        setLoading(false);
      }
    }

    fetchBusinessUnits();
  }, []);

  return { businessUnits, loading, error };
}

// ============================================================================
// MATERIALS
// ============================================================================

export function useMaterials(category?: string) {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchMaterials() {
      try {
        let query = supabase
          .from('materials')
          .select('*')
          .eq('status', 'Active')
          .order('category')
          .order('material_sku');

        if (category) {
          query = query.eq('category', category);
        }

        const { data, error } = await query;

        if (error) throw error;
        setMaterials(data || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch materials');
      } finally {
        setLoading(false);
      }
    }

    fetchMaterials();
  }, [category]);

  return { materials, loading, error };
}

// ============================================================================
// LABOR RATES (with business unit filter)
// ============================================================================

export function useLaborRates(businessUnitId?: string) {
  const [laborRates, setLaborRates] = useState<LaborRateWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!businessUnitId) {
      setLaborRates([]);
      setLoading(false);
      return;
    }

    async function fetchLaborRates() {
      try {
        const { data, error } = await supabase
          .from('labor_rates')
          .select(
            `
            *,
            labor_code:labor_codes(*),
            business_unit:business_units(*)
          `
          )
          .eq('business_unit_id', businessUnitId)
          .order('labor_code(labor_sku)');

        if (error) throw error;
        setLaborRates((data || []) as LaborRateWithDetails[]);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch labor rates');
      } finally {
        setLoading(false);
      }
    }

    fetchLaborRates();
  }, [businessUnitId]);

  return { laborRates, loading, error };
}

// ============================================================================
// PRODUCTS (SKUs)
// ============================================================================

export function useWoodVerticalProducts() {
  const [products, setProducts] = useState<WoodVerticalProductWithMaterials[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchProducts() {
      try {
        const { data, error } = await supabase
          .from('wood_vertical_products')
          .select(
            `
            *,
            post_material:materials!wood_vertical_products_post_material_id_fkey(*),
            picket_material:materials!wood_vertical_products_picket_material_id_fkey(*),
            rail_material:materials!wood_vertical_products_rail_material_id_fkey(*),
            cap_material:materials!wood_vertical_products_cap_material_id_fkey(*),
            trim_material:materials!wood_vertical_products_trim_material_id_fkey(*),
            rot_board_material:materials!wood_vertical_products_rot_board_material_id_fkey(*)
          `
          )
          .eq('is_active', true)
          .order('sku_code');

        if (error) throw error;
        setProducts((data || []) as WoodVerticalProductWithMaterials[]);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch wood vertical products');
      } finally {
        setLoading(false);
      }
    }

    fetchProducts();
  }, []);

  return { products, loading, error };
}

export function useWoodHorizontalProducts() {
  const [products, setProducts] = useState<WoodHorizontalProductWithMaterials[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchProducts() {
      try {
        const { data, error } = await supabase
          .from('wood_horizontal_products')
          .select(
            `
            *,
            post_material:materials!wood_horizontal_products_post_material_id_fkey(*),
            board_material:materials!wood_horizontal_products_board_material_id_fkey(*),
            nailer_material:materials!wood_horizontal_products_nailer_material_id_fkey(*),
            cap_material:materials!wood_horizontal_products_cap_material_id_fkey(*)
          `
          )
          .eq('is_active', true)
          .order('sku_code');

        if (error) throw error;
        setProducts((data || []) as WoodHorizontalProductWithMaterials[]);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch wood horizontal products');
      } finally {
        setLoading(false);
      }
    }

    fetchProducts();
  }, []);

  return { products, loading, error };
}

export function useIronProducts() {
  const [products, setProducts] = useState<IronProductWithMaterials[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchProducts() {
      try {
        const { data, error } = await supabase
          .from('iron_products')
          .select(
            `
            *,
            post_material:materials!iron_products_post_material_id_fkey(*),
            panel_material:materials!iron_products_panel_material_id_fkey(*),
            bracket_material:materials!iron_products_bracket_material_id_fkey(*),
            rail_material:materials!iron_products_rail_material_id_fkey(*),
            picket_material:materials!iron_products_picket_material_id_fkey(*)
          `
          )
          .eq('is_active', true)
          .order('sku_code');

        if (error) throw error;
        setProducts((data || []) as IronProductWithMaterials[]);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch iron products');
      } finally {
        setLoading(false);
      }
    }

    fetchProducts();
  }, []);

  return { products, loading, error };
}

// ============================================================================
// PROJECTS
// ============================================================================

export function useProjects() {
  const [projects, setProjects] = useState<BOMProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchProjects() {
      try {
        const { data, error } = await supabase
          .from('bom_projects')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) throw error;
        setProjects(data || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch projects');
      } finally {
        setLoading(false);
      }
    }

    fetchProjects();
  }, []);

  const refetch = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('bom_projects')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setProjects(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch projects');
    } finally {
      setLoading(false);
    }
  };

  return { projects, loading, error, refetch };
}

export function useProject(projectId: string | null) {
  const [project, setProject] = useState<ProjectWithDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!projectId) {
      setProject(null);
      setLoading(false);
      return;
    }

    async function fetchProject() {
      try {
        const { data, error } = await supabase
          .from('bom_projects')
          .select(
            `
            *,
            business_unit:business_units(*),
            line_items:project_line_items(*),
            materials:project_materials(
              *,
              material:materials(*)
            ),
            labor:project_labor(
              *,
              labor_code:labor_codes(*)
            )
          `
          )
          .eq('id', projectId)
          .single();

        if (error) throw error;
        setProject((data || null) as ProjectWithDetails | null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch project');
      } finally {
        setLoading(false);
      }
    }

    fetchProject();
  }, [projectId]);

  return { project, loading, error };
}

// ============================================================================
// COMBINED HOOK (for calculator page)
// ============================================================================

export function useBOMCalculatorData(businessUnitId?: string) {
  const { businessUnits, loading: buLoading, error: buError } = useBusinessUnits();
  const { materials, loading: matLoading, error: matError } = useMaterials();
  const { laborRates, loading: lrLoading, error: lrError } = useLaborRates(businessUnitId);
  const { products: woodVertical, loading: wvLoading, error: wvError } = useWoodVerticalProducts();
  const { products: woodHorizontal, loading: whLoading, error: whError } = useWoodHorizontalProducts();
  const { products: iron, loading: ironLoading, error: ironError } = useIronProducts();

  const loading =
    buLoading || matLoading || lrLoading || wvLoading || whLoading || ironLoading;
  const error = buError || matError || lrError || wvError || whError || ironError;

  return {
    businessUnits,
    materials,
    laborRates,
    products: {
      woodVertical,
      woodHorizontal,
      iron,
    },
    loading,
    error,
  };
}
