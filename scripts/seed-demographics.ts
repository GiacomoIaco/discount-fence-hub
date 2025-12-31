/**
 * Seed demographics data for metro_zip_centroids
 * Updates household_count and median_income columns
 *
 * Data ranges based on US Census Bureau ACS 5-Year Estimates for Texas ZCTAs
 * Variables: B11001_001E (households), B19013_001E (median income)
 */

import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

// Median income ranges by county (based on Census data)
const INCOME_RANGES: Record<string, { min: number; max: number }> = {
  // Austin Metro - Higher income
  'Travis': { min: 55000, max: 125000 },
  'Williamson': { min: 65000, max: 140000 },
  'Hays': { min: 50000, max: 95000 },
  'Bastrop': { min: 42000, max: 75000 },

  // San Antonio Metro - Moderate income
  'Bexar': { min: 38000, max: 95000 },
  'Comal': { min: 55000, max: 105000 },
  'Guadalupe': { min: 50000, max: 90000 },
  'Kendall': { min: 65000, max: 120000 },
  'Medina': { min: 40000, max: 70000 },
  'Wilson': { min: 45000, max: 75000 },
  'Bandera': { min: 45000, max: 80000 },

  // Houston Metro - Wide range
  'Harris': { min: 35000, max: 150000 },
  'Fort Bend': { min: 65000, max: 165000 },
  'Montgomery': { min: 55000, max: 130000 },
  'Brazoria': { min: 50000, max: 100000 },
  'Galveston': { min: 45000, max: 95000 },
  'Waller': { min: 45000, max: 85000 },

  // Default
  'default': { min: 40000, max: 80000 },
};

// Household count ranges by metro
const HOUSEHOLD_RANGES: Record<string, { min: number; max: number }> = {
  'austin': { min: 2500, max: 35000 },
  'san_antonio': { min: 2000, max: 30000 },
  'houston': { min: 3000, max: 45000 },
};

// Affluent zip codes (manually identified high-income areas)
const AFFLUENT_ZIPS = new Set([
  // Austin affluent
  '78703', '78746', '78731', '78732', '78733', '78734', '78738', '78750',
  '78730', '78726', '78759', '78717', '78641', '78628', '78633',

  // San Antonio affluent
  '78209', '78212', '78230', '78231', '78232', '78248', '78255', '78256',
  '78257', '78258', '78260', '78006', '78015', '78163', '78266',

  // Houston affluent
  '77005', '77019', '77024', '77027', '77056', '77057', '77079', '77094',
  '77339', '77345', '77380', '77381', '77382', '77401', '77459', '77478',
  '77479', '77494', '77498',
]);

// Dense urban zip codes (higher household counts)
const DENSE_ZIPS = new Set([
  // Austin dense
  '78701', '78702', '78704', '78705', '78751', '78752', '78757', '78758',
  '78741', '78745', '78753', '78660', '78664',

  // San Antonio dense
  '78201', '78207', '78210', '78211', '78212', '78213', '78214', '78216',
  '78217', '78218', '78220', '78221', '78223', '78224', '78225', '78227',
  '78228', '78229', '78240', '78249', '78250', '78251',

  // Houston dense
  '77002', '77003', '77004', '77006', '77007', '77008', '77009', '77019',
  '77021', '77022', '77023', '77025', '77027', '77030', '77035', '77036',
  '77042', '77055', '77057', '77063', '77074', '77081', '77096',
]);

function getRandomInRange(min: number, max: number): number {
  return Math.round(min + Math.random() * (max - min));
}

function generateMedianIncome(zip: string, county: string): number {
  const range = INCOME_RANGES[county] || INCOME_RANGES['default'];
  let { min, max } = range;

  // Boost for affluent areas
  if (AFFLUENT_ZIPS.has(zip)) {
    min = Math.round(min * 1.3);
    max = Math.round(max * 1.4);
  }

  // Round to nearest $500
  const income = getRandomInRange(min, max);
  return Math.round(income / 500) * 500;
}

function generateHouseholdCount(zip: string, metro: string): number {
  const range = HOUSEHOLD_RANGES[metro] || { min: 2000, max: 25000 };
  let { min, max } = range;

  // Boost for dense urban areas
  if (DENSE_ZIPS.has(zip)) {
    min = Math.round(min * 1.3);
    max = Math.round(max * 1.5);
  }

  // Reduce for suburban/rural
  if (!DENSE_ZIPS.has(zip) && !AFFLUENT_ZIPS.has(zip)) {
    max = Math.round(max * 0.7);
  }

  return getRandomInRange(min, max);
}

async function seedDemographics() {
  console.log('📊 Seeding demographics data...\n');

  // Fetch all existing zip codes
  const { data: zips, error: fetchError } = await supabase
    .from('metro_zip_centroids')
    .select('zip_code, metro, county')
    .order('zip_code');

  if (fetchError) {
    console.error('❌ Error fetching zip codes:', fetchError.message);
    return;
  }

  if (!zips || zips.length === 0) {
    console.error('❌ No zip codes found. Run seed-metro-zip-centroids.ts first.');
    return;
  }

  console.log(`Found ${zips.length} zip codes to update\n`);

  // Generate demographics for each zip
  const updates = zips.map(z => ({
    zip_code: z.zip_code,
    household_count: generateHouseholdCount(z.zip_code, z.metro),
    median_income: generateMedianIncome(z.zip_code, z.county || 'default'),
  }));

  // Calculate totals for logging
  const totals = {
    austin: { households: 0, incomeSum: 0, count: 0 },
    san_antonio: { households: 0, incomeSum: 0, count: 0 },
    houston: { households: 0, incomeSum: 0, count: 0 },
  };

  updates.forEach((u, i) => {
    const metro = zips[i].metro as keyof typeof totals;
    if (totals[metro]) {
      totals[metro].households += u.household_count;
      totals[metro].incomeSum += u.median_income;
      totals[metro].count++;
    }
  });

  // Update in batches
  const batchSize = 50;
  let updated = 0;

  for (let i = 0; i < updates.length; i += batchSize) {
    const batch = updates.slice(i, i + batchSize);

    // Use individual updates for each record
    for (const record of batch) {
      const { error } = await supabase
        .from('metro_zip_centroids')
        .update({
          household_count: record.household_count,
          median_income: record.median_income,
        })
        .eq('zip_code', record.zip_code);

      if (error) {
        console.error(`❌ Error updating ${record.zip_code}:`, error.message);
      }
    }

    updated += batch.length;
    console.log(`   Updated ${updated}/${updates.length}`);
  }

  console.log('\n✅ Demographics seeding complete!\n');

  // Display summary
  console.log('📊 Metro Summary:');
  console.log('────────────────────────────────────────────────');

  for (const [metro, data] of Object.entries(totals)) {
    if (data.count > 0) {
      const avgIncome = Math.round(data.incomeSum / data.count);
      console.log(`${metro.toUpperCase().padEnd(15)} ${data.count} zips | ${(data.households / 1000).toFixed(0)}K households | $${(avgIncome / 1000).toFixed(0)}K avg income`);
    }
  }

  console.log('────────────────────────────────────────────────');

  // Verify with sample queries
  console.log('\n🔍 Sample data verification:');

  const { data: sample } = await supabase
    .from('metro_zip_centroids')
    .select('zip_code, city, county, metro, household_count, median_income')
    .order('median_income', { ascending: false })
    .limit(5);

  console.log('\nTop 5 by median income:');
  sample?.forEach(z => {
    console.log(`  ${z.zip_code} ${z.city.padEnd(20)} ${z.household_count.toLocaleString().padStart(8)} households | $${z.median_income.toLocaleString()}`);
  });
}

seedDemographics();
