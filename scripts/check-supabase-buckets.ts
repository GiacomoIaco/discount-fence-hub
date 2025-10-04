import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: resolve(__dirname, '../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkBuckets() {
  console.log('🔍 Checking Supabase Storage Buckets...\n');
  console.log(`📍 Supabase URL: ${supabaseUrl}\n`);

  try {
    const { data: buckets, error } = await supabase.storage.listBuckets();

    if (error) {
      console.error('❌ Error fetching buckets:', error.message);
      return;
    }

    if (!buckets || buckets.length === 0) {
      console.log('⚠️  No storage buckets found.\n');
      console.log('📋 Recommended buckets for this project:');
      console.log('   1. voice-recordings (for audio files)');
      console.log('   2. photos (legacy - for job site photos)');
      console.log('   3. presentations (for client presentation files)');
      console.log('   4. photo-gallery (NEW - for photo gallery feature)\n');
      return;
    }

    console.log(`✅ Found ${buckets.length} storage bucket(s):\n`);

    for (const bucket of buckets) {
      console.log(`📦 Bucket: ${bucket.name}`);
      console.log(`   - ID: ${bucket.id}`);
      console.log(`   - Public: ${bucket.public ? 'Yes ✅' : 'No 🔒'}`);
      console.log(`   - Created: ${new Date(bucket.created_at).toLocaleString()}`);

      // Check if we can list files
      const { data: files, error: filesError } = await supabase.storage
        .from(bucket.name)
        .list('', { limit: 5 });

      if (filesError) {
        console.log(`   - Files: Unable to list (${filesError.message})`);
      } else {
        console.log(`   - Files: ${files?.length || 0} files (showing first 5)`);
      }
      console.log('');
    }

    // Check for photo-gallery bucket specifically
    const photoGalleryBucket = buckets.find(b => b.name === 'photo-gallery');
    if (photoGalleryBucket) {
      console.log('✅ photo-gallery bucket exists - Photo Gallery feature ready!\n');
    } else {
      console.log('⚠️  photo-gallery bucket NOT found.');
      console.log('📝 To create it:');
      console.log('   1. Go to Supabase Dashboard → Storage');
      console.log('   2. Click "New bucket"');
      console.log('   3. Name: photo-gallery');
      console.log('   4. Public: No (keep it private)');
      console.log('   5. Click "Create bucket"\n');
    }

    // Check for other expected buckets
    const expectedBuckets = ['voice-recordings', 'photos', 'presentations'];
    const missingBuckets = expectedBuckets.filter(
      name => !buckets.find(b => b.name === name)
    );

    if (missingBuckets.length > 0) {
      console.log('📋 Other missing buckets (optional):');
      missingBuckets.forEach(name => console.log(`   - ${name}`));
      console.log('');
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

checkBuckets();
