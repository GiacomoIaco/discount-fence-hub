const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function check() {
  // Get all QBO classes with their default rate sheets
  const { data: qboClasses, error: qboError } = await supabase
    .from('qbo_classes')
    .select('id, name, default_rate_sheet_id');
  
  console.log('All QBO Classes and their default rate sheets:');
  for (const qc of qboClasses || []) {
    console.log('  ' + qc.name + ': ' + (qc.default_rate_sheet_id || 'NO DEFAULT RATE SHEET!'));
  }

  // Check rate sheet pricing type
  const { data: rateSheets } = await supabase
    .from('rate_sheets')
    .select('id, name, pricing_type, default_labor_markup, default_material_markup');
  
  console.log('\nRate Sheets:');
  for (const rs of rateSheets || []) {
    console.log('  ' + rs.name + ' (' + rs.pricing_type + ')');
    console.log('    Labor markup: ' + rs.default_labor_markup + '%');
    console.log('    Material markup: ' + rs.default_material_markup + '%');
  }
}

check();
