const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function main() {
  const { data: wv } = await supabase
    .from('product_types_v2')
    .select('id, code, name')
    .eq('code', 'wood-vertical')
    .single();

  if (!wv) {
    console.log('Wood Vertical not found');
    return;
  }

  console.log('Product Type:', wv.code, '-', wv.name);
  console.log('');

  const { data: assignments } = await supabase
    .from('product_type_components_v2')
    .select('id, component_type_id, display_order, is_active')
    .eq('product_type_id', wv.id)
    .eq('is_active', true)
    .order('display_order');

  if (!assignments || assignments.length === 0) {
    console.log('No components assigned');
    return;
  }

  const compIds = assignments.map(a => a.component_type_id);
  const { data: comps } = await supabase
    .from('component_types_v2')
    .select('id, code, name')
    .in('id', compIds);

  console.log('=== ASSIGNED COMPONENTS ===');
  assignments.forEach(a => {
    const comp = comps.find(c => c.id === a.component_type_id);
    const code = comp ? comp.code : '?';
    const name = comp ? comp.name : '?';
    const isConcrete = code.includes('concrete') || code.includes('quickrock') || code.includes('portland');
    console.log(a.display_order + '. ' + code + ' - ' + name + (isConcrete ? ' [CONCRETE-RELATED]' : ''));
  });
}

main();
