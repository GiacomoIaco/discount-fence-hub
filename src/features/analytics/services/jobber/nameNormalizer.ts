// Name Normalizer for Jobber Imports
// Handles salesperson name resolution and normalization

import { supabase } from '../../../../lib/supabase';
import type { CSVRow, JobberNameNormalization } from '../../types/jobber';

// In-memory cache for name normalization lookup
let nameNormalizationCache: Map<string, string> | null = null;

/**
 * Load name normalization mappings from database
 */
export async function loadNameNormalizationMap(): Promise<Map<string, string>> {
  if (nameNormalizationCache) {
    return nameNormalizationCache;
  }

  const { data, error } = await supabase
    .from('jobber_name_normalization')
    .select('original_name, canonical_name');

  if (error) {
    console.error('Failed to load name normalization map:', error);
    return new Map();
  }

  nameNormalizationCache = new Map(
    (data as JobberNameNormalization[]).map(row => [row.original_name, row.canonical_name])
  );

  return nameNormalizationCache;
}

/**
 * Clear the name normalization cache (call after adding new mappings)
 */
export function clearNameNormalizationCache(): void {
  nameNormalizationCache = null;
}

/**
 * Normalize a name using the database lookup
 */
export function normalizeName(
  name: string | null | undefined,
  normMap: Map<string, string>
): string {
  if (!name || name.trim() === '') {
    return name || '';
  }

  const trimmed = name.trim();

  // Check for direct match in normalization map
  if (normMap.has(trimmed)) {
    return normMap.get(trimmed)!;
  }

  // Return original (will be stored as-is if no mapping exists)
  return trimmed;
}

/**
 * Get the effective salesperson from a CSV row
 * Priority: Salesperson > Builder Rep > First name from Visits Assigned To
 */
export function getEffectiveSalesperson(
  row: CSVRow,
  normMap: Map<string, string>
): string {
  // Priority 1: Salesperson field
  let name = (row['Salesperson'] || '').trim();

  // Priority 2: Builder Rep field (check both cases)
  if (!name) {
    name = (row['Builder Rep'] || row['BUILDER REP'] || '').trim();
  }

  // Priority 3: Visits Assigned To (first person only)
  if (!name || name === '[Add Builder Rep]') {
    const visits = (row['Visits assigned to'] || '').trim();
    if (visits) {
      // Take first person before comma or "and"
      name = visits.split(',')[0].split(' and ')[0].trim();
    }
  }

  // No salesperson found
  if (!name || name === '[Add Builder Rep]') {
    return '(Unassigned)';
  }

  // Apply normalization from database
  return normalizeName(name, normMap);
}

/**
 * Add a new name normalization mapping to the database
 */
export async function addNameNormalization(
  originalName: string,
  canonicalName: string
): Promise<boolean> {
  const { error } = await supabase
    .from('jobber_name_normalization')
    .upsert({
      original_name: originalName,
      canonical_name: canonicalName,
    }, {
      onConflict: 'original_name',
    });

  if (error) {
    console.error('Failed to add name normalization:', error);
    return false;
  }

  // Clear cache so next load picks up new mapping
  clearNameNormalizationCache();
  return true;
}

/**
 * Get all name normalization mappings
 */
export async function getAllNameNormalizations(): Promise<JobberNameNormalization[]> {
  const { data, error } = await supabase
    .from('jobber_name_normalization')
    .select('*')
    .order('canonical_name');

  if (error) {
    console.error('Failed to load name normalizations:', error);
    return [];
  }

  return data as JobberNameNormalization[];
}

/**
 * Delete a name normalization mapping
 */
export async function deleteNameNormalization(id: string): Promise<boolean> {
  const { error } = await supabase
    .from('jobber_name_normalization')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Failed to delete name normalization:', error);
    return false;
  }

  clearNameNormalizationCache();
  return true;
}
