/**
 * Data Migration Utility: Fix Photo Attribution
 *
 * Updates photos that have incorrect "Unknown" or missing uploader names
 * by fetching the correct name from the user_profiles table.
 */

import { supabase } from '../../../lib/supabase';

interface PhotoToFix {
  id: string;
  uploaded_by: string;
  uploader_name: string | null;
}

interface FixResult {
  success: boolean;
  fixed: number;
  errors: number;
  details: string[];
}

/**
 * Fix photo attribution for all photos with "Unknown" uploader names
 *
 * This function:
 * 1. Finds all photos with uploaded_by but missing or "Unknown" uploader_name
 * 2. Fetches the correct user name from user_profiles
 * 3. Updates the photos with the correct uploader_name
 */
export async function fixAllPhotoAttribution(): Promise<FixResult> {
  const result: FixResult = {
    success: true,
    fixed: 0,
    errors: 0,
    details: []
  };

  try {
    // Step 1: Find all photos with missing or "Unknown" uploader names
    const { data: photosToFix, error: fetchError } = await supabase
      .from('photos')
      .select('id, uploaded_by, uploader_name')
      .or('uploader_name.is.null,uploader_name.eq.Unknown,uploader_name.eq.Unknown User');

    if (fetchError) {
      result.success = false;
      result.details.push(`Error fetching photos: ${fetchError.message}`);
      return result;
    }

    if (!photosToFix || photosToFix.length === 0) {
      result.details.push('No photos need fixing');
      return result;
    }

    result.details.push(`Found ${photosToFix.length} photos to fix`);

    // Step 2: Group photos by user ID
    const photosByUser = new Map<string, PhotoToFix[]>();
    photosToFix.forEach(photo => {
      if (!photo.uploaded_by) return;

      const existing = photosByUser.get(photo.uploaded_by) || [];
      existing.push(photo as PhotoToFix);
      photosByUser.set(photo.uploaded_by, existing);
    });

    // Step 3: For each user, fetch their name and update their photos
    for (const [userId, photos] of photosByUser.entries()) {
      try {
        // Fetch user profile
        const { data: profile, error: profileError } = await supabase
          .from('user_profiles')
          .select('full_name')
          .eq('id', userId)
          .single();

        if (profileError || !profile) {
          result.details.push(`❌ Could not find profile for user ${userId}`);
          result.errors += photos.length;
          continue;
        }

        const userName = profile.full_name;

        // Update all photos for this user
        const photoIds = photos.map(p => p.id);
        const { error: updateError } = await supabase
          .from('photos')
          .update({ uploader_name: userName })
          .in('id', photoIds);

        if (updateError) {
          result.details.push(`❌ Error updating photos for ${userName}: ${updateError.message}`);
          result.errors += photos.length;
        } else {
          result.details.push(`✅ Updated ${photos.length} photos for ${userName}`);
          result.fixed += photos.length;
        }
      } catch (error) {
        result.details.push(`❌ Error processing user ${userId}: ${error}`);
        result.errors += photos.length;
      }
    }

    result.details.push(`\n📊 Summary: Fixed ${result.fixed} photos, ${result.errors} errors`);
    result.success = result.errors === 0;

  } catch (error) {
    result.success = false;
    result.details.push(`❌ Fatal error: ${error}`);
  }

  return result;
}

/**
 * Fix photo attribution for a specific user
 * Updates all photos uploaded by this user with their correct name
 */
export async function fixPhotoAttributionForUser(userId: string): Promise<FixResult> {
  const result: FixResult = {
    success: true,
    fixed: 0,
    errors: 0,
    details: []
  };

  try {
    // Fetch user profile
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('full_name')
      .eq('id', userId)
      .single();

    if (profileError || !profile) {
      result.success = false;
      result.details.push(`❌ Could not find profile for user ${userId}`);
      return result;
    }

    const userName = profile.full_name;

    // Find photos to fix
    const { data: photosToFix, error: fetchError } = await supabase
      .from('photos')
      .select('id')
      .eq('uploaded_by', userId)
      .or('uploader_name.is.null,uploader_name.eq.Unknown,uploader_name.eq.Unknown User');

    if (fetchError) {
      result.success = false;
      result.details.push(`❌ Error fetching photos: ${fetchError.message}`);
      return result;
    }

    if (!photosToFix || photosToFix.length === 0) {
      result.details.push('✅ No photos need fixing for this user');
      return result;
    }

    // Update photos
    const photoIds = photosToFix.map(p => p.id);
    const { error: updateError } = await supabase
      .from('photos')
      .update({ uploader_name: userName })
      .in('id', photoIds);

    if (updateError) {
      result.success = false;
      result.details.push(`❌ Error updating photos: ${updateError.message}`);
    } else {
      result.fixed = photosToFix.length;
      result.details.push(`✅ Updated ${photosToFix.length} photos for ${userName}`);
    }

  } catch (error) {
    result.success = false;
    result.details.push(`❌ Error: ${error}`);
  }

  return result;
}

/**
 * Fix photo attribution for the currently logged-in user
 */
export async function fixMyPhotoAttribution(): Promise<FixResult> {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return {
      success: false,
      fixed: 0,
      errors: 0,
      details: ['❌ No user logged in']
    };
  }

  return fixPhotoAttributionForUser(user.id);
}
