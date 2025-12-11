import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

const code = process.argv[2] || 'G-022';

(async () => {
  const { data, error } = await supabase
    .from('roadmap_items')
    .select('code, title, status, importance, complexity, raw_idea, claude_analysis')
    .eq('code', code)
    .single();

  if (error) {
    console.error('Error:', error);
  } else {
    console.log('='.repeat(60));
    console.log(`[${data.code}] ${data.title}`);
    console.log('='.repeat(60));
    console.log(`Status: ${data.status} | Importance: ${data.importance}/5 | Complexity: ${data.complexity}`);
    console.log('-'.repeat(60));
    console.log('RAW IDEA:');
    console.log(data.raw_idea || '(none)');
    console.log('-'.repeat(60));
    console.log('CLAUDE ANALYSIS:');
    console.log(data.claude_analysis || '(none)');
  }
})();
