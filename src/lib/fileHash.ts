/**
 * File hashing utilities for duplicate detection
 * Uses Web Crypto API (SHA-256) to generate file content hashes
 */

/**
 * Generate SHA-256 hash of a file
 * @param file - File object to hash
 * @returns Promise resolving to hex-encoded hash string
 */
export async function hashFile(file: File): Promise<string> {
  try {
    // Read file as ArrayBuffer
    const buffer = await file.arrayBuffer();

    // Generate SHA-256 hash
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);

    // Convert to hex string
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');

    return hashHex;
  } catch (error) {
    console.error('Error hashing file:', error);
    throw new Error(`Failed to hash file: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Check if a file hash already exists in the database
 * @param hash - File hash to check
 * @param supabase - Supabase client
 * @returns Promise resolving to existing photo record or null
 */
export async function checkDuplicateByHash(
  hash: string,
  supabase: any
): Promise<{ id: string; url: string; uploaded_by: string; uploaded_at: string } | null> {
  try {
    const { data, error } = await supabase
      .from('photos')
      .select('id, url, uploaded_by, uploaded_at')
      .eq('file_hash', hash)
      .single();

    if (error) {
      // No match found (which is expected most of the time)
      if (error.code === 'PGRST116') {
        return null;
      }
      throw error;
    }

    return data;
  } catch (error) {
    console.error('Error checking for duplicate:', error);
    return null; // Return null on error to allow upload to proceed
  }
}

/**
 * Batch check multiple file hashes for duplicates
 * @param hashes - Array of file hashes to check
 * @param supabase - Supabase client
 * @returns Promise resolving to Map of hash -> existing photo record
 */
export async function batchCheckDuplicates(
  hashes: string[],
  supabase: any
): Promise<Map<string, { id: string; url: string; uploaded_by: string; uploaded_at: string }>> {
  try {
    const { data, error } = await supabase
      .from('photos')
      .select('id, url, uploaded_by, uploaded_at, file_hash')
      .in('file_hash', hashes);

    if (error) throw error;

    const duplicatesMap = new Map();
    if (data) {
      data.forEach((photo: any) => {
        if (photo.file_hash) {
          duplicatesMap.set(photo.file_hash, photo);
        }
      });
    }

    return duplicatesMap;
  } catch (error) {
    console.error('Error batch checking for duplicates:', error);
    return new Map(); // Return empty map on error to allow uploads to proceed
  }
}
