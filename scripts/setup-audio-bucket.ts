/**
 * Script to create the audio-recordings storage bucket in Supabase
 *
 * Run with: npx tsx scripts/setup-audio-bucket.ts
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌ Missing environment variables:');
  if (!supabaseUrl) console.error('   - VITE_SUPABASE_URL');
  if (!serviceRoleKey) console.error('   - SUPABASE_SERVICE_ROLE_KEY');
  console.log('\nAdd SUPABASE_SERVICE_ROLE_KEY to your .env file.');
  console.log('You can find it in Supabase Dashboard > Project Settings > API > service_role key');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function main() {
  console.log('🔄 Setting up audio-recordings bucket...\n');

  // Check if bucket already exists
  const { data: buckets, error: listError } = await supabase.storage.listBuckets();

  if (listError) {
    console.error('❌ Failed to list buckets:', listError.message);
    process.exit(1);
  }

  const existingBucket = buckets?.find(b => b.id === 'audio-recordings');

  if (existingBucket) {
    console.log('✅ Bucket "audio-recordings" already exists');
  } else {
    // Create the bucket
    const { error: createError } = await supabase.storage.createBucket('audio-recordings', {
      public: false,
      fileSizeLimit: 52428800, // 50MB
      allowedMimeTypes: ['audio/webm', 'audio/mp3', 'audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/m4a']
    });

    if (createError) {
      console.error('❌ Failed to create bucket:', createError.message);
      process.exit(1);
    }

    console.log('✅ Created bucket "audio-recordings"');
  }

  console.log('\n📋 Bucket settings:');
  console.log('   - Private (not public)');
  console.log('   - 50MB file size limit');
  console.log('   - Allowed: webm, mp3, mpeg, wav, ogg, m4a');

  console.log('\n⚠️  IMPORTANT: You need to manually add RLS policies via Supabase Dashboard:');
  console.log('   1. Go to Storage > audio-recordings > Policies');
  console.log('   2. Add policy for INSERT: Allow authenticated users');
  console.log('   3. Add policy for SELECT: Allow users to read own files (by folder)');
  console.log('   4. Add policy for DELETE: Allow users to delete own files (by folder)');
  console.log('\nOr use the following SQL in the SQL Editor:\n');

  console.log(`
-- Allow authenticated users to upload audio files
CREATE POLICY "Users can upload audio recordings" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'audio-recordings');

-- Allow authenticated users to read their own files
CREATE POLICY "Users can read own audio recordings" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'audio-recordings' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Allow authenticated users to delete their own files
CREATE POLICY "Users can delete own audio recordings" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'audio-recordings' AND auth.uid()::text = (storage.foldername(name))[1]);
`);

  console.log('\n✅ Done! Remember to add the RLS policies.');
}

main().catch(console.error);
