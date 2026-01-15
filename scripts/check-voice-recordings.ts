import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function checkVoiceRecordings() {
  const { data, error } = await supabase
    .from('roadmap_items')
    .select('id, code, title, audio_url, voice_transcript, created_at')
    .not('audio_url', 'is', null)
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) {
    console.error('Error:', error.message);
    return;
  }

  console.log(`\nFound ${data.length} items with audio_url:\n`);

  for (const item of data) {
    console.log(`${item.code}: ${(item.title || '').substring(0, 50)}`);
    console.log(`  Created: ${new Date(item.created_at).toLocaleDateString()}`);
    console.log(`  Audio URL: ${item.audio_url ? 'EXISTS (' + item.audio_url.length + ' chars)' : 'NULL'}`);
    console.log(`  Transcript: ${item.voice_transcript ? '"' + item.voice_transcript.substring(0, 60) + '..."' : 'NULL (not saved)'}`);

    // Check if URL looks expired (signed URLs have token param)
    if (item.audio_url) {
      const hasToken = item.audio_url.includes('token=');
      console.log(`  URL Type: ${hasToken ? 'Signed URL (may expire)' : 'Public URL'}`);
    }
    console.log('');
  }
}

checkVoiceRecordings();
