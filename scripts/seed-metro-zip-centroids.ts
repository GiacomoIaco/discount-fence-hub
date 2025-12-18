/**
 * Seed script for metro_zip_centroids table
 * Populates zip code centroids for Greater Austin, San Antonio, and Houston
 *
 * Data sourced from US Census Bureau ZCTA (ZIP Code Tabulation Areas)
 * Centroids are approximate geographic centers of each zip code
 */

import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

// Greater Austin Metro - Travis, Williamson, Hays, Bastrop, Caldwell counties
const austinZips: Array<{ zip: string; city: string; county: string; lat: number; lng: number }> = [
  // Travis County
  { zip: '78701', city: 'Austin', county: 'Travis', lat: 30.2672, lng: -97.7431 },
  { zip: '78702', city: 'Austin', county: 'Travis', lat: 30.2621, lng: -97.7195 },
  { zip: '78703', city: 'Austin', county: 'Travis', lat: 30.2951, lng: -97.7663 },
  { zip: '78704', city: 'Austin', county: 'Travis', lat: 30.2420, lng: -97.7657 },
  { zip: '78705', city: 'Austin', county: 'Travis', lat: 30.2907, lng: -97.7385 },
  { zip: '78721', city: 'Austin', county: 'Travis', lat: 30.2705, lng: -97.6861 },
  { zip: '78722', city: 'Austin', county: 'Travis', lat: 30.2871, lng: -97.7144 },
  { zip: '78723', city: 'Austin', county: 'Travis', lat: 30.3054, lng: -97.6874 },
  { zip: '78724', city: 'Austin', county: 'Travis', lat: 30.2944, lng: -97.6148 },
  { zip: '78725', city: 'Austin', county: 'Travis', lat: 30.2353, lng: -97.6063 },
  { zip: '78726', city: 'Austin', county: 'Travis', lat: 30.4330, lng: -97.8359 },
  { zip: '78727', city: 'Austin', county: 'Travis', lat: 30.4275, lng: -97.7175 },
  { zip: '78728', city: 'Austin', county: 'Travis', lat: 30.4566, lng: -97.6893 },
  { zip: '78729', city: 'Austin', county: 'Travis', lat: 30.4558, lng: -97.7571 },
  { zip: '78730', city: 'Austin', county: 'Travis', lat: 30.3652, lng: -97.8337 },
  { zip: '78731', city: 'Austin', county: 'Travis', lat: 30.3525, lng: -97.7681 },
  { zip: '78732', city: 'Austin', county: 'Travis', lat: 30.3753, lng: -97.8891 },
  { zip: '78733', city: 'Austin', county: 'Travis', lat: 30.3167, lng: -97.8836 },
  { zip: '78734', city: 'Lakeway', county: 'Travis', lat: 30.3553, lng: -97.9609 },
  { zip: '78735', city: 'Austin', county: 'Travis', lat: 30.2611, lng: -97.8560 },
  { zip: '78736', city: 'Austin', county: 'Travis', lat: 30.2308, lng: -97.9280 },
  { zip: '78737', city: 'Austin', county: 'Travis', lat: 30.1896, lng: -97.9383 },
  { zip: '78738', city: 'Bee Cave', county: 'Travis', lat: 30.2942, lng: -97.9530 },
  { zip: '78739', city: 'Austin', county: 'Travis', lat: 30.1831, lng: -97.8698 },
  { zip: '78741', city: 'Austin', county: 'Travis', lat: 30.2316, lng: -97.7192 },
  { zip: '78742', city: 'Austin', county: 'Travis', lat: 30.2380, lng: -97.6580 },
  { zip: '78744', city: 'Austin', county: 'Travis', lat: 30.1877, lng: -97.7318 },
  { zip: '78745', city: 'Austin', county: 'Travis', lat: 30.2080, lng: -97.7880 },
  { zip: '78746', city: 'Austin', county: 'Travis', lat: 30.2950, lng: -97.8145 },
  { zip: '78747', city: 'Austin', county: 'Travis', lat: 30.1400, lng: -97.7500 },
  { zip: '78748', city: 'Austin', county: 'Travis', lat: 30.1739, lng: -97.8169 },
  { zip: '78749', city: 'Austin', county: 'Travis', lat: 30.2164, lng: -97.8507 },
  { zip: '78750', city: 'Austin', county: 'Travis', lat: 30.4066, lng: -97.7880 },
  { zip: '78751', city: 'Austin', county: 'Travis', lat: 30.3159, lng: -97.7245 },
  { zip: '78752', city: 'Austin', county: 'Travis', lat: 30.3310, lng: -97.7003 },
  { zip: '78753', city: 'Austin', county: 'Travis', lat: 30.3648, lng: -97.6788 },
  { zip: '78754', city: 'Austin', county: 'Travis', lat: 30.3519, lng: -97.6315 },
  { zip: '78756', city: 'Austin', county: 'Travis', lat: 30.3253, lng: -97.7399 },
  { zip: '78757', city: 'Austin', county: 'Travis', lat: 30.3524, lng: -97.7335 },
  { zip: '78758', city: 'Austin', county: 'Travis', lat: 30.3865, lng: -97.7081 },
  { zip: '78759', city: 'Austin', county: 'Travis', lat: 30.3976, lng: -97.7536 },

  // Williamson County
  { zip: '78613', city: 'Cedar Park', county: 'Williamson', lat: 30.5105, lng: -97.8203 },
  { zip: '78615', city: 'Coupland', county: 'Williamson', lat: 30.4356, lng: -97.3836 },
  { zip: '78626', city: 'Georgetown', county: 'Williamson', lat: 30.6330, lng: -97.6770 },
  { zip: '78628', city: 'Georgetown', county: 'Williamson', lat: 30.6500, lng: -97.7458 },
  { zip: '78633', city: 'Georgetown', county: 'Williamson', lat: 30.7136, lng: -97.8017 },
  { zip: '78634', city: 'Hutto', county: 'Williamson', lat: 30.5427, lng: -97.5497 },
  { zip: '78641', city: 'Leander', county: 'Williamson', lat: 30.5609, lng: -97.8530 },
  { zip: '78642', city: 'Liberty Hill', county: 'Williamson', lat: 30.6649, lng: -97.9214 },
  { zip: '78660', city: 'Pflugerville', county: 'Travis', lat: 30.4415, lng: -97.6200 },
  { zip: '78664', city: 'Round Rock', county: 'Williamson', lat: 30.5191, lng: -97.6650 },
  { zip: '78665', city: 'Round Rock', county: 'Williamson', lat: 30.5624, lng: -97.6358 },
  { zip: '78681', city: 'Round Rock', county: 'Williamson', lat: 30.5283, lng: -97.7208 },
  { zip: '78717', city: 'Austin', county: 'Williamson', lat: 30.4795, lng: -97.7608 },

  // Hays County
  { zip: '78610', city: 'Buda', county: 'Hays', lat: 30.0852, lng: -97.8400 },
  { zip: '78619', city: 'Driftwood', county: 'Hays', lat: 30.1133, lng: -98.0072 },
  { zip: '78620', city: 'Dripping Springs', county: 'Hays', lat: 30.1902, lng: -98.0867 },
  { zip: '78640', city: 'Kyle', county: 'Hays', lat: 29.9891, lng: -97.8772 },
  { zip: '78666', city: 'San Marcos', county: 'Hays', lat: 29.8833, lng: -97.9414 },
  { zip: '78676', city: 'Wimberley', county: 'Hays', lat: 30.0042, lng: -98.0986 },

  // Bastrop County
  { zip: '78602', city: 'Bastrop', county: 'Bastrop', lat: 30.1105, lng: -97.3155 },
  { zip: '78612', city: 'Cedar Creek', county: 'Bastrop', lat: 30.0844, lng: -97.4786 },
  { zip: '78617', city: 'Del Valle', county: 'Travis', lat: 30.1422, lng: -97.6408 },
  { zip: '78621', city: 'Elgin', county: 'Bastrop', lat: 30.3508, lng: -97.3700 },
  { zip: '78653', city: 'Manor', county: 'Travis', lat: 30.3408, lng: -97.5500 },
  { zip: '78659', city: 'Paige', county: 'Bastrop', lat: 30.1856, lng: -97.1169 },
  { zip: '78662', city: 'Red Rock', county: 'Bastrop', lat: 29.9967, lng: -97.4514 },
];

// Greater San Antonio Metro - Bexar, Comal, Guadalupe, Kendall, Medina counties
const sanAntonioZips: Array<{ zip: string; city: string; county: string; lat: number; lng: number }> = [
  // Bexar County - Central San Antonio
  { zip: '78201', city: 'San Antonio', county: 'Bexar', lat: 29.4683, lng: -98.5250 },
  { zip: '78202', city: 'San Antonio', county: 'Bexar', lat: 29.4359, lng: -98.4608 },
  { zip: '78203', city: 'San Antonio', county: 'Bexar', lat: 29.4172, lng: -98.4625 },
  { zip: '78204', city: 'San Antonio', county: 'Bexar', lat: 29.4072, lng: -98.5019 },
  { zip: '78205', city: 'San Antonio', county: 'Bexar', lat: 29.4241, lng: -98.4936 },
  { zip: '78207', city: 'San Antonio', county: 'Bexar', lat: 29.4308, lng: -98.5239 },
  { zip: '78208', city: 'San Antonio', county: 'Bexar', lat: 29.4422, lng: -98.4619 },
  { zip: '78209', city: 'San Antonio', county: 'Bexar', lat: 29.4847, lng: -98.4550 },
  { zip: '78210', city: 'San Antonio', county: 'Bexar', lat: 29.3947, lng: -98.4692 },
  { zip: '78211', city: 'San Antonio', county: 'Bexar', lat: 29.3572, lng: -98.5281 },
  { zip: '78212', city: 'San Antonio', county: 'Bexar', lat: 29.4689, lng: -98.4933 },
  { zip: '78213', city: 'San Antonio', county: 'Bexar', lat: 29.5119, lng: -98.5217 },
  { zip: '78214', city: 'San Antonio', county: 'Bexar', lat: 29.3619, lng: -98.4814 },
  { zip: '78215', city: 'San Antonio', county: 'Bexar', lat: 29.4431, lng: -98.4864 },
  { zip: '78216', city: 'San Antonio', county: 'Bexar', lat: 29.5272, lng: -98.4900 },
  { zip: '78217', city: 'San Antonio', county: 'Bexar', lat: 29.5350, lng: -98.4375 },
  { zip: '78218', city: 'San Antonio', county: 'Bexar', lat: 29.4933, lng: -98.4058 },
  { zip: '78219', city: 'San Antonio', county: 'Bexar', lat: 29.4508, lng: -98.3864 },
  { zip: '78220', city: 'San Antonio', county: 'Bexar', lat: 29.4092, lng: -98.4042 },
  { zip: '78221', city: 'San Antonio', county: 'Bexar', lat: 29.3350, lng: -98.4906 },
  { zip: '78222', city: 'San Antonio', county: 'Bexar', lat: 29.3783, lng: -98.4078 },
  { zip: '78223', city: 'San Antonio', county: 'Bexar', lat: 29.3539, lng: -98.4306 },
  { zip: '78224', city: 'San Antonio', county: 'Bexar', lat: 29.3242, lng: -98.5264 },
  { zip: '78225', city: 'San Antonio', county: 'Bexar', lat: 29.3967, lng: -98.5200 },
  { zip: '78226', city: 'San Antonio', county: 'Bexar', lat: 29.3914, lng: -98.5658 },
  { zip: '78227', city: 'San Antonio', county: 'Bexar', lat: 29.3972, lng: -98.6136 },
  { zip: '78228', city: 'San Antonio', county: 'Bexar', lat: 29.4611, lng: -98.5711 },
  { zip: '78229', city: 'San Antonio', county: 'Bexar', lat: 29.5022, lng: -98.5708 },
  { zip: '78230', city: 'San Antonio', county: 'Bexar', lat: 29.5436, lng: -98.5553 },
  { zip: '78231', city: 'San Antonio', county: 'Bexar', lat: 29.5722, lng: -98.5306 },
  { zip: '78232', city: 'San Antonio', county: 'Bexar', lat: 29.5825, lng: -98.4778 },
  { zip: '78233', city: 'San Antonio', county: 'Bexar', lat: 29.5531, lng: -98.3739 },
  { zip: '78234', city: 'San Antonio', county: 'Bexar', lat: 29.4656, lng: -98.4372 },
  { zip: '78235', city: 'San Antonio', county: 'Bexar', lat: 29.3667, lng: -98.4456 },
  { zip: '78236', city: 'San Antonio', county: 'Bexar', lat: 29.4233, lng: -98.6183 },
  { zip: '78237', city: 'San Antonio', county: 'Bexar', lat: 29.4250, lng: -98.5658 },
  { zip: '78238', city: 'San Antonio', county: 'Bexar', lat: 29.4642, lng: -98.6194 },
  { zip: '78239', city: 'San Antonio', county: 'Bexar', lat: 29.5133, lng: -98.3592 },
  { zip: '78240', city: 'San Antonio', county: 'Bexar', lat: 29.5228, lng: -98.6061 },
  { zip: '78242', city: 'San Antonio', county: 'Bexar', lat: 29.3353, lng: -98.6181 },
  { zip: '78243', city: 'San Antonio', county: 'Bexar', lat: 29.3867, lng: -98.6156 },
  { zip: '78244', city: 'San Antonio', county: 'Bexar', lat: 29.4661, lng: -98.3489 },
  { zip: '78245', city: 'San Antonio', county: 'Bexar', lat: 29.4089, lng: -98.6722 },
  { zip: '78247', city: 'San Antonio', county: 'Bexar', lat: 29.5758, lng: -98.4236 },
  { zip: '78248', city: 'San Antonio', county: 'Bexar', lat: 29.5925, lng: -98.5139 },
  { zip: '78249', city: 'San Antonio', county: 'Bexar', lat: 29.5611, lng: -98.6061 },
  { zip: '78250', city: 'San Antonio', county: 'Bexar', lat: 29.5100, lng: -98.6667 },
  { zip: '78251', city: 'San Antonio', county: 'Bexar', lat: 29.4639, lng: -98.6822 },
  { zip: '78252', city: 'San Antonio', county: 'Bexar', lat: 29.3350, lng: -98.7069 },
  { zip: '78253', city: 'San Antonio', county: 'Bexar', lat: 29.4692, lng: -98.7378 },
  { zip: '78254', city: 'San Antonio', county: 'Bexar', lat: 29.5375, lng: -98.7353 },
  { zip: '78255', city: 'San Antonio', county: 'Bexar', lat: 29.6472, lng: -98.6708 },
  { zip: '78256', city: 'San Antonio', county: 'Bexar', lat: 29.6178, lng: -98.6147 },
  { zip: '78257', city: 'San Antonio', county: 'Bexar', lat: 29.6436, lng: -98.5706 },
  { zip: '78258', city: 'San Antonio', county: 'Bexar', lat: 29.6367, lng: -98.4878 },
  { zip: '78259', city: 'San Antonio', county: 'Bexar', lat: 29.6233, lng: -98.4256 },
  { zip: '78260', city: 'San Antonio', county: 'Bexar', lat: 29.6722, lng: -98.4525 },
  { zip: '78261', city: 'San Antonio', county: 'Bexar', lat: 29.6656, lng: -98.3733 },
  { zip: '78263', city: 'San Antonio', county: 'Bexar', lat: 29.3378, lng: -98.3472 },
  { zip: '78264', city: 'San Antonio', county: 'Bexar', lat: 29.2633, lng: -98.4653 },

  // Surrounding Counties
  { zip: '78006', city: 'Boerne', county: 'Kendall', lat: 29.7947, lng: -98.7319 },
  { zip: '78015', city: 'Boerne', county: 'Kendall', lat: 29.7283, lng: -98.6633 },
  { zip: '78063', city: 'Pipe Creek', county: 'Bandera', lat: 29.6756, lng: -98.9264 },
  { zip: '78070', city: 'Spring Branch', county: 'Comal', lat: 29.8714, lng: -98.4089 },
  { zip: '78108', city: 'Cibolo', county: 'Guadalupe', lat: 29.5617, lng: -98.2253 },
  { zip: '78109', city: 'Converse', county: 'Bexar', lat: 29.5172, lng: -98.3178 },
  { zip: '78112', city: 'Elmendorf', county: 'Bexar', lat: 29.2611, lng: -98.3347 },
  { zip: '78114', city: 'Floresville', county: 'Wilson', lat: 29.1336, lng: -98.1561 },
  { zip: '78121', city: 'La Vernia', county: 'Wilson', lat: 29.3592, lng: -98.1153 },
  { zip: '78123', city: 'McQueeney', county: 'Guadalupe', lat: 29.5925, lng: -98.0378 },
  { zip: '78124', city: 'Marion', county: 'Guadalupe', lat: 29.5656, lng: -98.1400 },
  { zip: '78130', city: 'New Braunfels', county: 'Comal', lat: 29.6994, lng: -98.1247 },
  { zip: '78132', city: 'New Braunfels', county: 'Comal', lat: 29.7353, lng: -98.1456 },
  { zip: '78133', city: 'Canyon Lake', county: 'Comal', lat: 29.8750, lng: -98.2681 },
  { zip: '78148', city: 'Universal City', county: 'Bexar', lat: 29.5461, lng: -98.2917 },
  { zip: '78150', city: 'JBSA Randolph', county: 'Bexar', lat: 29.5356, lng: -98.2783 },
  { zip: '78152', city: 'St Hedwig', county: 'Bexar', lat: 29.4103, lng: -98.2036 },
  { zip: '78154', city: 'Schertz', county: 'Guadalupe', lat: 29.5700, lng: -98.2631 },
  { zip: '78155', city: 'Seguin', county: 'Guadalupe', lat: 29.5689, lng: -97.9647 },
  { zip: '78163', city: 'Bulverde', county: 'Comal', lat: 29.7436, lng: -98.4528 },
  { zip: '78266', city: 'Garden Ridge', county: 'Comal', lat: 29.6372, lng: -98.3072 },
];

// Greater Houston Metro - Harris and surrounding counties
const houstonZips: Array<{ zip: string; city: string; county: string; lat: number; lng: number }> = [
  // Harris County - Central Houston
  { zip: '77001', city: 'Houston', county: 'Harris', lat: 29.7543, lng: -95.3536 },
  { zip: '77002', city: 'Houston', county: 'Harris', lat: 29.7569, lng: -95.3625 },
  { zip: '77003', city: 'Houston', county: 'Harris', lat: 29.7445, lng: -95.3411 },
  { zip: '77004', city: 'Houston', county: 'Harris', lat: 29.7253, lng: -95.3636 },
  { zip: '77005', city: 'Houston', county: 'Harris', lat: 29.7172, lng: -95.4211 },
  { zip: '77006', city: 'Houston', county: 'Harris', lat: 29.7411, lng: -95.3894 },
  { zip: '77007', city: 'Houston', county: 'Harris', lat: 29.7719, lng: -95.4103 },
  { zip: '77008', city: 'Houston', county: 'Harris', lat: 29.7944, lng: -95.4108 },
  { zip: '77009', city: 'Houston', county: 'Harris', lat: 29.7931, lng: -95.3728 },
  { zip: '77010', city: 'Houston', county: 'Harris', lat: 29.7547, lng: -95.3547 },
  { zip: '77011', city: 'Houston', county: 'Harris', lat: 29.7322, lng: -95.3011 },
  { zip: '77012', city: 'Houston', county: 'Harris', lat: 29.7067, lng: -95.2811 },
  { zip: '77013', city: 'Houston', county: 'Harris', lat: 29.7853, lng: -95.2650 },
  { zip: '77014', city: 'Houston', county: 'Harris', lat: 29.9725, lng: -95.4692 },
  { zip: '77015', city: 'Houston', county: 'Harris', lat: 29.7694, lng: -95.1850 },
  { zip: '77016', city: 'Houston', county: 'Harris', lat: 29.8450, lng: -95.3061 },
  { zip: '77017', city: 'Houston', county: 'Harris', lat: 29.6881, lng: -95.2472 },
  { zip: '77018', city: 'Houston', county: 'Harris', lat: 29.8269, lng: -95.4361 },
  { zip: '77019', city: 'Houston', county: 'Harris', lat: 29.7592, lng: -95.4164 },
  { zip: '77020', city: 'Houston', county: 'Harris', lat: 29.7722, lng: -95.3203 },
  { zip: '77021', city: 'Houston', county: 'Harris', lat: 29.6986, lng: -95.3633 },
  { zip: '77022', city: 'Houston', county: 'Harris', lat: 29.8286, lng: -95.3803 },
  { zip: '77023', city: 'Houston', county: 'Harris', lat: 29.7231, lng: -95.3203 },
  { zip: '77024', city: 'Houston', county: 'Harris', lat: 29.7728, lng: -95.5228 },
  { zip: '77025', city: 'Houston', county: 'Harris', lat: 29.6839, lng: -95.4281 },
  { zip: '77026', city: 'Houston', county: 'Harris', lat: 29.7950, lng: -95.3306 },
  { zip: '77027', city: 'Houston', county: 'Harris', lat: 29.7431, lng: -95.4428 },
  { zip: '77028', city: 'Houston', county: 'Harris', lat: 29.8192, lng: -95.2933 },
  { zip: '77029', city: 'Houston', county: 'Harris', lat: 29.7500, lng: -95.2428 },
  { zip: '77030', city: 'Houston', county: 'Harris', lat: 29.7061, lng: -95.3972 },
  { zip: '77031', city: 'Houston', county: 'Harris', lat: 29.6581, lng: -95.5339 },
  { zip: '77032', city: 'Houston', county: 'Harris', lat: 29.9172, lng: -95.3333 },
  { zip: '77033', city: 'Houston', county: 'Harris', lat: 29.6647, lng: -95.3317 },
  { zip: '77034', city: 'Houston', county: 'Harris', lat: 29.6144, lng: -95.2042 },
  { zip: '77035', city: 'Houston', county: 'Harris', lat: 29.6597, lng: -95.4700 },
  { zip: '77036', city: 'Houston', county: 'Harris', lat: 29.7008, lng: -95.5364 },
  { zip: '77037', city: 'Houston', county: 'Harris', lat: 29.8883, lng: -95.4100 },
  { zip: '77038', city: 'Houston', county: 'Harris', lat: 29.9144, lng: -95.4461 },
  { zip: '77039', city: 'Houston', county: 'Harris', lat: 29.8897, lng: -95.3431 },
  { zip: '77040', city: 'Houston', county: 'Harris', lat: 29.8678, lng: -95.5228 },
  { zip: '77041', city: 'Houston', county: 'Harris', lat: 29.8539, lng: -95.5872 },
  { zip: '77042', city: 'Houston', county: 'Harris', lat: 29.7367, lng: -95.5589 },
  { zip: '77043', city: 'Houston', county: 'Harris', lat: 29.7831, lng: -95.5575 },
  { zip: '77044', city: 'Houston', county: 'Harris', lat: 29.8294, lng: -95.1761 },
  { zip: '77045', city: 'Houston', county: 'Harris', lat: 29.6453, lng: -95.4325 },
  { zip: '77046', city: 'Houston', county: 'Harris', lat: 29.7308, lng: -95.4342 },
  { zip: '77047', city: 'Houston', county: 'Harris', lat: 29.6072, lng: -95.3833 },
  { zip: '77048', city: 'Houston', county: 'Harris', lat: 29.6183, lng: -95.3267 },
  { zip: '77049', city: 'Houston', county: 'Harris', lat: 29.8383, lng: -95.1431 },
  { zip: '77050', city: 'Houston', county: 'Harris', lat: 29.8769, lng: -95.2797 },
  { zip: '77051', city: 'Houston', county: 'Harris', lat: 29.6594, lng: -95.3786 },
  { zip: '77053', city: 'Houston', county: 'Harris', lat: 29.5944, lng: -95.4528 },
  { zip: '77054', city: 'Houston', county: 'Harris', lat: 29.6833, lng: -95.3917 },
  { zip: '77055', city: 'Houston', county: 'Harris', lat: 29.7994, lng: -95.4747 },
  { zip: '77056', city: 'Houston', county: 'Harris', lat: 29.7483, lng: -95.4669 },
  { zip: '77057', city: 'Houston', county: 'Harris', lat: 29.7383, lng: -95.4958 },
  { zip: '77058', city: 'Houston', county: 'Harris', lat: 29.5536, lng: -95.0908 },
  { zip: '77059', city: 'Houston', county: 'Harris', lat: 29.6117, lng: -95.1083 },
  { zip: '77060', city: 'Houston', county: 'Harris', lat: 29.9158, lng: -95.3878 },
  { zip: '77061', city: 'Houston', county: 'Harris', lat: 29.6633, lng: -95.2825 },
  { zip: '77062', city: 'Houston', county: 'Harris', lat: 29.5683, lng: -95.1300 },
  { zip: '77063', city: 'Houston', county: 'Harris', lat: 29.7272, lng: -95.5022 },
  { zip: '77064', city: 'Houston', county: 'Harris', lat: 29.9194, lng: -95.5408 },
  { zip: '77065', city: 'Houston', county: 'Harris', lat: 29.9281, lng: -95.5925 },
  { zip: '77066', city: 'Houston', county: 'Harris', lat: 29.9611, lng: -95.5036 },
  { zip: '77067', city: 'Houston', county: 'Harris', lat: 29.9503, lng: -95.4389 },
  { zip: '77068', city: 'Houston', county: 'Harris', lat: 29.9892, lng: -95.4867 },
  { zip: '77069', city: 'Houston', county: 'Harris', lat: 29.9908, lng: -95.5439 },
  { zip: '77070', city: 'Houston', county: 'Harris', lat: 29.9731, lng: -95.5831 },
  { zip: '77071', city: 'Houston', county: 'Harris', lat: 29.6533, lng: -95.5092 },
  { zip: '77072', city: 'Houston', county: 'Harris', lat: 29.7031, lng: -95.5800 },
  { zip: '77073', city: 'Houston', county: 'Harris', lat: 30.0019, lng: -95.4017 },
  { zip: '77074', city: 'Houston', county: 'Harris', lat: 29.6903, lng: -95.5139 },
  { zip: '77075', city: 'Houston', county: 'Harris', lat: 29.6183, lng: -95.2531 },
  { zip: '77076', city: 'Houston', county: 'Harris', lat: 29.8531, lng: -95.3547 },
  { zip: '77077', city: 'Houston', county: 'Harris', lat: 29.7558, lng: -95.5922 },
  { zip: '77078', city: 'Houston', county: 'Harris', lat: 29.8317, lng: -95.2478 },
  { zip: '77079', city: 'Houston', county: 'Harris', lat: 29.7792, lng: -95.6267 },
  { zip: '77080', city: 'Houston', county: 'Harris', lat: 29.8092, lng: -95.5194 },
  { zip: '77081', city: 'Houston', county: 'Harris', lat: 29.7139, lng: -95.4711 },
  { zip: '77082', city: 'Houston', county: 'Harris', lat: 29.7175, lng: -95.6381 },
  { zip: '77083', city: 'Houston', county: 'Harris', lat: 29.6861, lng: -95.6439 },
  { zip: '77084', city: 'Houston', county: 'Harris', lat: 29.8228, lng: -95.6572 },
  { zip: '77085', city: 'Houston', county: 'Harris', lat: 29.6239, lng: -95.4808 },
  { zip: '77086', city: 'Houston', county: 'Harris', lat: 29.9111, lng: -95.4772 },
  { zip: '77087', city: 'Houston', county: 'Harris', lat: 29.6806, lng: -95.3108 },
  { zip: '77088', city: 'Houston', county: 'Harris', lat: 29.8711, lng: -95.4611 },
  { zip: '77089', city: 'Houston', county: 'Harris', lat: 29.5908, lng: -95.2197 },
  { zip: '77090', city: 'Houston', county: 'Harris', lat: 29.9925, lng: -95.4203 },
  { zip: '77091', city: 'Houston', county: 'Harris', lat: 29.8517, lng: -95.4222 },
  { zip: '77092', city: 'Houston', county: 'Harris', lat: 29.8339, lng: -95.4661 },
  { zip: '77093', city: 'Houston', county: 'Harris', lat: 29.8600, lng: -95.3386 },
  { zip: '77094', city: 'Houston', county: 'Harris', lat: 29.7678, lng: -95.6711 },
  { zip: '77095', city: 'Houston', county: 'Harris', lat: 29.9003, lng: -95.6625 },
  { zip: '77096', city: 'Houston', county: 'Harris', lat: 29.6694, lng: -95.4575 },
  { zip: '77098', city: 'Houston', county: 'Harris', lat: 29.7333, lng: -95.4111 },
  { zip: '77099', city: 'Houston', county: 'Harris', lat: 29.6767, lng: -95.5850 },

  // Surrounding Counties - Key suburbs
  { zip: '77301', city: 'Conroe', county: 'Montgomery', lat: 30.3119, lng: -95.4558 },
  { zip: '77302', city: 'Conroe', county: 'Montgomery', lat: 30.2281, lng: -95.4125 },
  { zip: '77304', city: 'Conroe', county: 'Montgomery', lat: 30.3403, lng: -95.5253 },
  { zip: '77316', city: 'Montgomery', county: 'Montgomery', lat: 30.3881, lng: -95.6994 },
  { zip: '77339', city: 'Kingwood', county: 'Harris', lat: 30.0339, lng: -95.2422 },
  { zip: '77345', city: 'Kingwood', county: 'Harris', lat: 30.0506, lng: -95.1825 },
  { zip: '77346', city: 'Humble', county: 'Harris', lat: 30.0028, lng: -95.1533 },
  { zip: '77354', city: 'Magnolia', county: 'Montgomery', lat: 30.2103, lng: -95.7506 },
  { zip: '77355', city: 'Magnolia', county: 'Montgomery', lat: 30.1317, lng: -95.7658 },
  { zip: '77356', city: 'Montgomery', county: 'Montgomery', lat: 30.3836, lng: -95.7028 },
  { zip: '77357', city: 'New Caney', county: 'Montgomery', lat: 30.1294, lng: -95.1836 },
  { zip: '77362', city: 'Pinehurst', county: 'Montgomery', lat: 30.1728, lng: -95.6800 },
  { zip: '77365', city: 'Porter', county: 'Montgomery', lat: 30.1161, lng: -95.2861 },
  { zip: '77373', city: 'Spring', county: 'Harris', lat: 30.0306, lng: -95.4175 },
  { zip: '77375', city: 'Tomball', county: 'Harris', lat: 30.0783, lng: -95.6078 },
  { zip: '77377', city: 'Tomball', county: 'Harris', lat: 30.0636, lng: -95.6983 },
  { zip: '77378', city: 'Willis', county: 'Montgomery', lat: 30.4250, lng: -95.4803 },
  { zip: '77379', city: 'Spring', county: 'Harris', lat: 30.0211, lng: -95.5225 },
  { zip: '77380', city: 'The Woodlands', county: 'Montgomery', lat: 30.1658, lng: -95.4631 },
  { zip: '77381', city: 'The Woodlands', county: 'Montgomery', lat: 30.1736, lng: -95.4961 },
  { zip: '77382', city: 'The Woodlands', county: 'Montgomery', lat: 30.2058, lng: -95.5094 },
  { zip: '77384', city: 'Conroe', county: 'Montgomery', lat: 30.2183, lng: -95.4731 },
  { zip: '77385', city: 'Conroe', county: 'Montgomery', lat: 30.1628, lng: -95.4131 },
  { zip: '77386', city: 'Spring', county: 'Montgomery', lat: 30.1175, lng: -95.4267 },
  { zip: '77388', city: 'Spring', county: 'Harris', lat: 30.0508, lng: -95.4725 },
  { zip: '77389', city: 'Spring', county: 'Harris', lat: 30.0625, lng: -95.5403 },
  { zip: '77401', city: 'Bellaire', county: 'Harris', lat: 29.7058, lng: -95.4589 },
  { zip: '77406', city: 'Richmond', county: 'Fort Bend', lat: 29.5814, lng: -95.7553 },
  { zip: '77407', city: 'Richmond', county: 'Fort Bend', lat: 29.6217, lng: -95.7128 },
  { zip: '77429', city: 'Cypress', county: 'Harris', lat: 29.9667, lng: -95.6767 },
  { zip: '77433', city: 'Cypress', county: 'Harris', lat: 29.9444, lng: -95.7500 },
  { zip: '77447', city: 'Hockley', county: 'Harris', lat: 30.0250, lng: -95.8208 },
  { zip: '77449', city: 'Katy', county: 'Harris', lat: 29.8056, lng: -95.7531 },
  { zip: '77450', city: 'Katy', county: 'Harris', lat: 29.7856, lng: -95.8072 },
  { zip: '77459', city: 'Missouri City', county: 'Fort Bend', lat: 29.5492, lng: -95.5364 },
  { zip: '77469', city: 'Richmond', county: 'Fort Bend', lat: 29.5536, lng: -95.7628 },
  { zip: '77471', city: 'Rosenberg', county: 'Fort Bend', lat: 29.5447, lng: -95.8119 },
  { zip: '77477', city: 'Stafford', county: 'Fort Bend', lat: 29.6336, lng: -95.5636 },
  { zip: '77478', city: 'Sugar Land', county: 'Fort Bend', lat: 29.5939, lng: -95.6361 },
  { zip: '77479', city: 'Sugar Land', county: 'Fort Bend', lat: 29.5617, lng: -95.6186 },
  { zip: '77484', city: 'Waller', county: 'Waller', lat: 30.0567, lng: -95.9275 },
  { zip: '77489', city: 'Missouri City', county: 'Fort Bend', lat: 29.5889, lng: -95.5175 },
  { zip: '77493', city: 'Katy', county: 'Harris', lat: 29.7906, lng: -95.8456 },
  { zip: '77494', city: 'Katy', county: 'Fort Bend', lat: 29.7628, lng: -95.8311 },
  { zip: '77498', city: 'Sugar Land', county: 'Fort Bend', lat: 29.5858, lng: -95.6697 },
  { zip: '77502', city: 'Pasadena', county: 'Harris', lat: 29.6942, lng: -95.1972 },
  { zip: '77503', city: 'Pasadena', county: 'Harris', lat: 29.6939, lng: -95.1636 },
  { zip: '77504', city: 'Pasadena', county: 'Harris', lat: 29.6647, lng: -95.1594 },
  { zip: '77505', city: 'Pasadena', county: 'Harris', lat: 29.6597, lng: -95.1139 },
  { zip: '77506', city: 'Pasadena', county: 'Harris', lat: 29.7017, lng: -95.2039 },
  { zip: '77530', city: 'Channelview', county: 'Harris', lat: 29.7833, lng: -95.1206 },
  { zip: '77532', city: 'Crosby', county: 'Harris', lat: 29.9081, lng: -95.0756 },
  { zip: '77536', city: 'Deer Park', county: 'Harris', lat: 29.6953, lng: -95.1211 },
  { zip: '77546', city: 'Friendswood', county: 'Galveston', lat: 29.5133, lng: -95.1986 },
  { zip: '77573', city: 'League City', county: 'Galveston', lat: 29.5011, lng: -95.1033 },
  { zip: '77581', city: 'Pearland', county: 'Brazoria', lat: 29.5447, lng: -95.2928 },
  { zip: '77584', city: 'Pearland', county: 'Brazoria', lat: 29.5283, lng: -95.3228 },
  { zip: '77586', city: 'Seabrook', county: 'Harris', lat: 29.5686, lng: -95.0258 },
  { zip: '77587', city: 'South Houston', county: 'Harris', lat: 29.6625, lng: -95.2306 },
  { zip: '77598', city: 'Webster', county: 'Harris', lat: 29.5328, lng: -95.1178 },
];

async function seedMetroZipCentroids() {
  console.log('🌍 Seeding metro zip centroids...');

  // Combine all metros
  const allZips = [
    ...austinZips.map(z => ({ ...z, metro: 'austin' as const })),
    ...sanAntonioZips.map(z => ({ ...z, metro: 'san_antonio' as const })),
    ...houstonZips.map(z => ({ ...z, metro: 'houston' as const })),
  ];

  console.log(`📊 Total zip codes: ${allZips.length}`);
  console.log(`   - Austin: ${austinZips.length}`);
  console.log(`   - San Antonio: ${sanAntonioZips.length}`);
  console.log(`   - Houston: ${houstonZips.length}`);

  // Transform to database format
  const records = allZips.map(z => ({
    zip_code: z.zip,
    metro: z.metro,
    city: z.city,
    county: z.county,
    lat: z.lat,
    lng: z.lng,
  }));

  // Upsert in batches of 100
  const batchSize = 100;
  let inserted = 0;

  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize);

    const { error } = await supabase
      .from('metro_zip_centroids')
      .upsert(batch, { onConflict: 'zip_code' });

    if (error) {
      console.error(`❌ Error inserting batch ${i / batchSize + 1}:`, error.message);
      return;
    }

    inserted += batch.length;
    console.log(`   Inserted ${inserted}/${records.length}`);
  }

  console.log(`✅ Successfully seeded ${inserted} zip code centroids`);

  // Verify counts
  const { count: austinCount } = await supabase
    .from('metro_zip_centroids')
    .select('*', { count: 'exact', head: true })
    .eq('metro', 'austin');

  const { count: saCount } = await supabase
    .from('metro_zip_centroids')
    .select('*', { count: 'exact', head: true })
    .eq('metro', 'san_antonio');

  const { count: houstonCount } = await supabase
    .from('metro_zip_centroids')
    .select('*', { count: 'exact', head: true })
    .eq('metro', 'houston');

  console.log('\n📊 Final counts in database:');
  console.log(`   - Austin: ${austinCount}`);
  console.log(`   - San Antonio: ${saCount}`);
  console.log(`   - Houston: ${houstonCount}`);
}

seedMetroZipCentroids();
