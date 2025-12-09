import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY  // Use service key to bypass RLS
);

async function checkSKUs() {
  // Check product types
  const { data: types, error: typesError } = await supabase
    .from('product_types')
    .select('id, code, name');
  console.log('Product Types:', types?.length || 0, 'rows', typesError?.message || '');
  types?.forEach(t => console.log(`  ${t.code}: ${t.id}`));

  if (types?.length > 0) {
    const woodVertId = types.find(t => t.code === 'wood-vertical')?.id;
    if (woodVertId) {
      // Check product styles for wood-vertical
      const { data: styles, error: stylesError } = await supabase
        .from('product_styles')
        .select('id, code, name')
        .eq('product_type_id', woodVertId);
      console.log('\nStyles for wood-vertical:', styles?.length || 0, 'rows', stylesError?.message || '');
      styles?.forEach(s => console.log(`  ${s.code}: ${s.id}`));
    }
  }

  // Count all SKUs
  const { data: skus, error: skuError } = await supabase
    .from('product_skus')
    .select('sku_code, sku_name');
  console.log('\nSKUs:', skus?.length || 0, 'rows', skuError?.message || '');
  skus?.slice(0, 20).forEach(s => console.log(`  ${s.sku_code}: ${s.sku_name}`));
}

checkSKUs();
