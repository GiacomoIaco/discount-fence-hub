const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function main() {
  // Get all product types
  const { data: types, error } = await supabase
    .from('product_types_v2')
    .select('id, code, name, is_active')
    .order('display_order');

  if (error) {
    console.log('Error:', error.message);
    return;
  }

  console.log('=== ALL PRODUCT TYPES ===');
  if (!types || types.length === 0) {
    console.log('No product types found');
  } else {
    types.forEach(t => console.log(t.code + ' - ' + t.name + ' (active=' + t.is_active + ')'));
  }

  // Get all component types
  const { data: comps } = await supabase
    .from('component_types_v2')
    .select('id, code, name, is_active')
    .order('display_order');

  console.log('\n=== ALL COMPONENT TYPES ===');
  if (!comps || comps.length === 0) {
    console.log('No component types found');
  } else {
    comps.forEach(c => console.log(c.code + ' - ' + c.name + ' (active=' + c.is_active + ')'));
  }
}

main();
