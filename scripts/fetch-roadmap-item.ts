import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

const code = process.argv[2] || 'S-007';

async function main() {
  const { data, error } = await supabase
    .from('roadmap_items')
    .select('*')
    .eq('code', code)
    .single();
  
  if (error) {
    console.error('Error:', error.message);
    return;
  }
  
  console.log('=== ROADMAP ITEM', code, '===');
  console.log('Title:', data.title);
  console.log('Status:', data.status);
  console.log('Hub:', data.hub);
  console.log('');
  console.log('=== RAW IDEA ===');
  console.log(data.raw_idea || '(empty)');
  console.log('');
  console.log('=== CLAUDE ANALYSIS ===');
  console.log(data.claude_analysis || '(empty)');
}

main();
