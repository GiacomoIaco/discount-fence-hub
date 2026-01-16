const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function check() {
  // Get rate sheets with ALL pricing fields
  const { data: rateSheets } = await supabase
    .from('rate_sheets')
    .select('*');
  
  console.log('Rate Sheets - Full pricing config:');
  for (const rs of rateSheets || []) {
    console.log('\n' + rs.name + ' (' + rs.pricing_type + ')');
    console.log('  default_margin_target: ' + rs.default_margin_target + '%');
    console.log('  default_labor_markup: ' + rs.default_labor_markup + '%');
    console.log('  default_material_markup: ' + rs.default_material_markup + '%');
  }
}

check();
