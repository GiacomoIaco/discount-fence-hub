import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function fetchData() {
  // Fetch wood vertical products with materials
  const { data: woodVertical, error: e1 } = await supabase
    .from('wood_vertical_products')
    .select(`
      *,
      post_material:materials!wood_vertical_products_post_material_id_fkey(*),
      picket_material:materials!wood_vertical_products_picket_material_id_fkey(*),
      rail_material:materials!wood_vertical_products_rail_material_id_fkey(*),
      cap_material:materials!wood_vertical_products_cap_material_id_fkey(*),
      trim_material:materials!wood_vertical_products_trim_material_id_fkey(*),
      rot_board_material:materials!wood_vertical_products_rot_board_material_id_fkey(*)
    `)
    .eq('is_active', true)
    .order('sku_code');

  if (e1) console.error('Wood vertical error:', e1.message);

  // Fetch wood horizontal products
  const { data: woodHorizontal, error: e2 } = await supabase
    .from('wood_horizontal_products')
    .select(`
      *,
      post_material:materials!wood_horizontal_products_post_material_id_fkey(*),
      board_material:materials!wood_horizontal_products_board_material_id_fkey(*),
      nailer_material:materials!wood_horizontal_products_nailer_material_id_fkey(*),
      cap_material:materials!wood_horizontal_products_cap_material_id_fkey(*),
      vertical_trim_material:materials!wood_horizontal_products_vertical_trim_material_id_fkey(*)
    `)
    .eq('is_active', true)
    .order('sku_code');

  if (e2) console.error('Wood horizontal error:', e2.message);

  // Fetch iron products
  const { data: iron, error: e3 } = await supabase
    .from('iron_products')
    .select(`
      *,
      post_material:materials!iron_products_post_material_id_fkey(*),
      panel_material:materials!iron_products_panel_material_id_fkey(*),
      bracket_material:materials!iron_products_bracket_material_id_fkey(*)
    `)
    .eq('is_active', true)
    .order('sku_code');

  if (e3) console.error('Iron error:', e3.message);

  // Fetch custom products with their materials and labor
  const { data: custom, error: e4 } = await supabase
    .from('custom_products')
    .select(`
      *,
      custom_product_materials(*, material:materials(*)),
      custom_product_labor(*, labor_code:labor_codes(*))
    `)
    .eq('is_active', true)
    .order('sku_code');

  if (e4) console.error('Custom error:', e4.message);

  console.log(JSON.stringify({
    woodVertical: woodVertical || [],
    woodHorizontal: woodHorizontal || [],
    iron: iron || [],
    custom: custom || []
  }, null, 2));
}

fetchData();
