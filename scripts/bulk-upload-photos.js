#!/usr/bin/env node

/**
 * Bulk Photo Upload Script
 *
 * This script scans a local folder (and subfolders) for images,
 * uploads them to Supabase Storage, and creates database records.
 *
 * Usage:
 *   node scripts/bulk-upload-photos.js <folder-path> <request-id> [options]
 *
 * Options:
 *   --tag           Auto-tag photos using AI (default: false)
 *   --batch-size    Number of photos to process at once (default: 10)
 *   --user-id       User ID for uploads (default: from .env)
 *
 * Example:
 *   node scripts/bulk-upload-photos.js ./photos abc-123-def --tag
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '..', '.env') });

// Configuration
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const DEFAULT_USER_ID = process.env.DEFAULT_USER_ID;

// Supported image extensions
const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.heic'];

// Initialize Supabase client
if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing Supabase credentials in .env file');
  console.error('Required: VITE_SUPABASE_URL and SUPABASE_SERVICE_KEY (or VITE_SUPABASE_ANON_KEY)');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

/**
 * Recursively find all image files in a directory
 */
function findImages(dir, fileList = []) {
  const files = fs.readdirSync(dir);

  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      // Recurse into subdirectory
      findImages(filePath, fileList);
    } else {
      // Check if it's an image
      const ext = path.extname(file).toLowerCase();
      if (IMAGE_EXTENSIONS.includes(ext)) {
        fileList.push(filePath);
      }
    }
  });

  return fileList;
}

/**
 * Get MIME type from file extension
 */
function getMimeType(ext) {
  const mimeTypes = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.webp': 'image/webp',
    '.gif': 'image/gif',
    '.heic': 'image/heic'
  };
  return mimeTypes[ext.toLowerCase()] || 'image/jpeg';
}

/**
 * Upload a single image to Supabase
 */
async function uploadImage(filePath, requestId, userId) {
  const fileName = path.basename(filePath);
  const fileExt = path.extname(filePath).toLowerCase();
  const fileBuffer = fs.readFileSync(filePath);
  const fileSize = fs.statSync(filePath).size;

  // Generate unique file path in storage
  const timestamp = Date.now();
  const storagePath = `${requestId}/${timestamp}-${fileName}`;

  console.log(`  📤 Uploading: ${fileName} (${(fileSize / 1024).toFixed(2)} KB)`);

  // Upload to Supabase Storage
  const { data: uploadData, error: uploadError } = await supabase.storage
    .from('request-attachments')
    .upload(storagePath, fileBuffer, {
      contentType: getMimeType(fileExt),
      upsert: false
    });

  if (uploadError) {
    console.error(`  ❌ Upload failed: ${uploadError.message}`);
    throw uploadError;
  }

  // Get public URL
  const { data: { publicUrl } } = supabase.storage
    .from('request-attachments')
    .getPublicUrl(storagePath);

  // Insert metadata into database
  const { data: dbData, error: dbError } = await supabase
    .from('request_attachments')
    .insert({
      request_id: requestId,
      user_id: userId,
      file_name: fileName,
      file_url: publicUrl,
      file_type: 'image',
      file_size: fileSize,
      mime_type: getMimeType(fileExt),
      tagging_status: 'pending'
    })
    .select()
    .single();

  if (dbError) {
    console.error(`  ❌ Database insert failed: ${dbError.message}`);
    throw dbError;
  }

  console.log(`  ✅ Uploaded successfully (ID: ${dbData.id})`);
  return dbData;
}

/**
 * Auto-tag an image using AI
 */
async function tagImage(imageId, imageUrl) {
  console.log(`  🤖 Tagging image ID: ${imageId}`);

  try {
    // Update status to processing
    await supabase
      .from('request_attachments')
      .update({ tagging_status: 'processing' })
      .eq('id', imageId);

    // Download image and convert to base64
    const response = await fetch(imageUrl);
    const arrayBuffer = await response.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');

    // Call AI tagging function
    const tagResponse = await fetch(`${process.env.VITE_NETLIFY_FUNCTIONS_URL || 'http://localhost:8888/.netlify/functions'}/analyze-photo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageBase64: base64 })
    });

    if (!tagResponse.ok) {
      throw new Error(`Tagging failed: ${tagResponse.statusText}`);
    }

    const result = await tagResponse.json();

    // Update database with tagging results
    await supabase
      .from('request_attachments')
      .update({
        suggested_tags: result.suggestedTags || [],
        tags: result.suggestedTags || [], // Auto-apply suggested tags
        quality_score: result.qualityScore,
        confidence_score: result.confidenceScore,
        ai_analysis: result.analysisNotes,
        tagging_status: 'completed'
      })
      .eq('id', imageId);

    console.log(`  ✅ Tagged successfully (${result.suggestedTags?.length || 0} tags, quality: ${result.qualityScore}/10)`);
  } catch (error) {
    console.error(`  ❌ Tagging failed: ${error.message}`);

    // Update status to failed
    await supabase
      .from('request_attachments')
      .update({
        tagging_status: 'failed',
        ai_analysis: `Tagging error: ${error.message}`
      })
      .eq('id', imageId);
  }
}

/**
 * Process images in batches
 */
async function processBatch(images, requestId, userId, options) {
  const results = {
    uploaded: 0,
    tagged: 0,
    failed: 0
  };

  for (let i = 0; i < images.length; i += options.batchSize) {
    const batch = images.slice(i, i + options.batchSize);
    console.log(`\n📦 Processing batch ${Math.floor(i / options.batchSize) + 1} (${batch.length} images)`);

    const batchPromises = batch.map(async (imagePath) => {
      try {
        // Upload image
        const uploadedImage = await uploadImage(imagePath, requestId, userId);
        results.uploaded++;

        // Tag if requested
        if (options.tag) {
          await tagImage(uploadedImage.id, uploadedImage.file_url);
          results.tagged++;
        }
      } catch (error) {
        results.failed++;
        console.error(`❌ Failed to process ${path.basename(imagePath)}: ${error.message}`);
      }
    });

    await Promise.all(batchPromises);

    // Small delay between batches
    if (i + options.batchSize < images.length) {
      console.log('⏳ Waiting 2 seconds before next batch...');
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  return results;
}

/**
 * Main function
 */
async function main() {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.error('❌ Usage: node scripts/bulk-upload-photos.js <folder-path> <request-id> [--tag] [--batch-size N] [--user-id ID]');
    process.exit(1);
  }

  const folderPath = path.resolve(args[0]);
  const requestId = args[1];

  const options = {
    tag: args.includes('--tag'),
    batchSize: parseInt(args[args.indexOf('--batch-size') + 1] || '10'),
    userId: args[args.indexOf('--user-id') + 1] || DEFAULT_USER_ID
  };

  if (!options.userId) {
    console.error('❌ No user ID provided. Set DEFAULT_USER_ID in .env or use --user-id flag');
    process.exit(1);
  }

  console.log('🚀 Bulk Photo Upload Starting...\n');
  console.log(`📁 Folder: ${folderPath}`);
  console.log(`📋 Request ID: ${requestId}`);
  console.log(`👤 User ID: ${options.userId}`);
  console.log(`🏷️  Auto-tag: ${options.tag ? 'Yes' : 'No'}`);
  console.log(`📦 Batch size: ${options.batchSize}`);

  // Check if folder exists
  if (!fs.existsSync(folderPath)) {
    console.error(`\n❌ Folder not found: ${folderPath}`);
    process.exit(1);
  }

  // Find all images
  console.log('\n🔍 Scanning for images...');
  const images = findImages(folderPath);

  if (images.length === 0) {
    console.log('⚠️  No images found in folder');
    process.exit(0);
  }

  console.log(`✅ Found ${images.length} images\n`);

  // Confirm before proceeding
  console.log(`⚡ About to upload ${images.length} images to request ${requestId}`);
  console.log('Press Ctrl+C to cancel, or wait 3 seconds to continue...\n');
  await new Promise(resolve => setTimeout(resolve, 3000));

  // Process images
  const startTime = Date.now();
  const results = await processBatch(images, requestId, options.userId, options);
  const duration = ((Date.now() - startTime) / 1000).toFixed(2);

  // Summary
  console.log('\n' + '='.repeat(50));
  console.log('📊 UPLOAD SUMMARY');
  console.log('='.repeat(50));
  console.log(`✅ Uploaded: ${results.uploaded}`);
  if (options.tag) {
    console.log(`🏷️  Tagged: ${results.tagged}`);
  }
  console.log(`❌ Failed: ${results.failed}`);
  console.log(`⏱️  Duration: ${duration}s`);
  console.log('='.repeat(50) + '\n');

  console.log('🎉 Bulk upload completed!');
}

// Run main function
main().catch(error => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});
