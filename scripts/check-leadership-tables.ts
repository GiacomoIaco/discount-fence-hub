import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_KEY!;

const supabase = createClient(supabaseUrl, serviceKey);

async function checkTables() {
  console.log('🔍 Checking leadership tables...\n');

  try {
    // Check for buckets/areas table
    const { data: buckets, error: bucketsError } = await supabase
      .from('project_buckets')
      .select('id')
      .limit(1);

    if (bucketsError) {
      console.log('❌ project_buckets does not exist:', bucketsError.code);
    } else {
      console.log('✅ project_buckets exists');
    }

    // Check for areas table
    const { data: areas, error: areasError } = await supabase
      .from('project_areas')
      .select('id')
      .limit(1);

    if (areasError) {
      console.log('❌ project_areas does not exist:', areasError.code);
    } else {
      console.log('✅ project_areas exists');
    }

    // Check initiatives column
    const { data: initiatives, error: initError } = await supabase
      .from('project_initiatives')
      .select('bucket_id, area_id, this_week, next_week')
      .limit(1);

    if (initError) {
      console.log('❌ Error checking initiatives:', initError);
    } else {
      console.log('✅ project_initiatives exists');
      if (initiatives && initiatives.length > 0) {
        const cols = Object.keys(initiatives[0]);
        console.log('   Columns:', cols.join(', '));
      }
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkTables();
