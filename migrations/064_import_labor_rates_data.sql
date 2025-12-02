-- ============================================
-- IMPORT LABOR RATES DATA
-- Created: 2025-12-01
-- Purpose: Import complete labor rates from spreadsheet
-- ============================================

-- First, update fence_category_standard on labor_codes
UPDATE labor_codes SET fence_category_standard = ARRAY['Iron'] WHERE labor_sku = 'IR01';
UPDATE labor_codes SET fence_category_standard = ARRAY['Iron'] WHERE labor_sku = 'IR02';
UPDATE labor_codes SET fence_category_standard = ARRAY['Iron'] WHERE labor_sku = 'IR04';
UPDATE labor_codes SET fence_category_standard = ARRAY['Iron'] WHERE labor_sku = 'IR05';
UPDATE labor_codes SET fence_category_standard = ARRAY['Iron'] WHERE labor_sku = 'IR06';
UPDATE labor_codes SET fence_category_standard = ARRAY['Iron'] WHERE labor_sku = 'IR07';
UPDATE labor_codes SET fence_category_standard = ARRAY['Service'] WHERE labor_sku = 'LB04';
UPDATE labor_codes SET fence_category_standard = ARRAY['Vertical W'] WHERE labor_sku = 'M03';
UPDATE labor_codes SET fence_category_standard = ARRAY['Vertical W'] WHERE labor_sku = 'M04';
UPDATE labor_codes SET fence_category_standard = ARRAY['Vertical W', 'Horizontal W'] WHERE labor_sku = 'M06';
UPDATE labor_codes SET fence_category_standard = ARRAY['Vertical W'] WHERE labor_sku = 'M07';
UPDATE labor_codes SET fence_category_standard = ARRAY['Service'] WHERE labor_sku = 'W01';
UPDATE labor_codes SET fence_category_standard = ARRAY['Vertical W', 'Horizontal W', 'Iron'] WHERE labor_sku = 'W02';
UPDATE labor_codes SET fence_category_standard = ARRAY['Vertical W'] WHERE labor_sku = 'W03';
UPDATE labor_codes SET fence_category_standard = ARRAY['Vertical W'] WHERE labor_sku = 'W04';
UPDATE labor_codes SET fence_category_standard = ARRAY['Vertical W'] WHERE labor_sku = 'W05';
UPDATE labor_codes SET fence_category_standard = ARRAY['Vertical W'] WHERE labor_sku = 'W06';
UPDATE labor_codes SET fence_category_standard = ARRAY['Vertical W'] WHERE labor_sku = 'W07';
UPDATE labor_codes SET fence_category_standard = ARRAY['Vertical W'] WHERE labor_sku = 'W08';
UPDATE labor_codes SET fence_category_standard = ARRAY['Vertical W', 'Horizontal W'] WHERE labor_sku = 'W09';
UPDATE labor_codes SET fence_category_standard = ARRAY['Vertical W'] WHERE labor_sku = 'W10';
UPDATE labor_codes SET fence_category_standard = ARRAY['Vertical W'] WHERE labor_sku = 'W11';
UPDATE labor_codes SET fence_category_standard = ARRAY['Horizontal W'] WHERE labor_sku = 'W12';
UPDATE labor_codes SET fence_category_standard = ARRAY['Horizontal W'] WHERE labor_sku = 'W13';
UPDATE labor_codes SET fence_category_standard = ARRAY['Horizontal W'] WHERE labor_sku = 'W15';
UPDATE labor_codes SET fence_category_standard = ARRAY['Horizontal W'] WHERE labor_sku = 'W16';
UPDATE labor_codes SET fence_category_standard = ARRAY['Horizontal W'] WHERE labor_sku = 'W17';
UPDATE labor_codes SET fence_category_standard = ARRAY['Horizontal W'] WHERE labor_sku = 'W18';

-- Delete existing labor_rates to avoid conflicts
DELETE FROM labor_rates;

-- Insert all labor rates
-- Format: labor_code_id, business_unit_id, rate
INSERT INTO labor_rates (labor_code_id, business_unit_id, rate, effective_date)
SELECT lc.id, bu.id, rates.rate, '2025-01-01'::DATE
FROM labor_codes lc
CROSS JOIN business_units bu
INNER JOIN (VALUES
  -- IR01: Iron Set Post 8' O.C.
  ('IR01', 'ATX-RES', 1.75),
  ('IR01', 'ATX-HB', 1.75),
  ('IR01', 'SA-RES', 1.50),
  ('IR01', 'SA-HB', 1.50),
  ('IR01', 'HOU-RES', 1.50),
  ('IR01', 'HOU-HB', 1.50),

  -- IR02: Iron Weld Standard Fence
  ('IR02', 'ATX-RES', 2.50),
  ('IR02', 'ATX-HB', 2.50),
  ('IR02', 'SA-RES', 1.25),
  ('IR02', 'SA-HB', 1.25),
  ('IR02', 'HOU-RES', 1.25),
  ('IR02', 'HOU-HB', 1.25),

  -- IR04: Set and Weld Railing
  ('IR04', 'ATX-RES', 4.75),
  ('IR04', 'ATX-HB', 4.75),

  -- IR05: Set Post 8' O.C. Ameristar/3 rail brackets
  ('IR05', 'ATX-RES', 2.25),
  ('IR05', 'ATX-HB', 2.25),

  -- IR06: Weld/Bracket Fence - Ameristar/3 rail
  ('IR06', 'ATX-RES', 2.75),
  ('IR06', 'ATX-HB', 2.75),

  -- IR07: Iron Gate - Single
  ('IR07', 'ATX-RES', 30.00),
  ('IR07', 'ATX-HB', 30.00),
  ('IR07', 'SA-RES', 15.00),
  ('IR07', 'SA-HB', 15.00),
  ('IR07', 'HOU-RES', 15.00),
  ('IR07', 'HOU-HB', 15.00),

  -- LB04: Rock Fee
  ('LB04', 'ATX-RES', 0.50),
  ('LB04', 'ATX-HB', 0.50),
  ('LB04', 'SA-RES', 0.40),
  ('LB04', 'SA-HB', 0.40),
  ('LB04', 'HOU-RES', 0.40),
  ('LB04', 'HOU-HB', 0.40),

  -- M03: Steel Post - Nail Up - Vertical up to 6' High
  ('M03', 'ATX-RES', 2.25),
  ('M03', 'ATX-HB', 2.00),
  ('M03', 'SA-RES', 2.00),
  ('M03', 'SA-HB', 1.50),
  ('M03', 'HOU-RES', 2.00),
  ('M03', 'HOU-HB', 1.50),

  -- M04: Steel Post - Nail Up - Vertical 7' or 8' High
  ('M04', 'ATX-RES', 2.50),
  ('M04', 'ATX-HB', 2.15),
  ('M04', 'SA-RES', 2.20),
  ('M04', 'SA-HB', 1.70),
  ('M04', 'HOU-RES', 2.20),
  ('M04', 'HOU-HB', 1.70),

  -- M06: Steel Post - Goodneighbor Style
  ('M06', 'ATX-RES', 0.40),
  ('M06', 'ATX-HB', 0.40),
  ('M06', 'SA-RES', 0.00),
  ('M06', 'SA-HB', 0.00),
  ('M06', 'HOU-RES', 0.00),
  ('M06', 'HOU-HB', 0.00),

  -- M07: Steel Post - Cap and Trim
  ('M07', 'ATX-RES', 0.50),
  ('M07', 'ATX-HB', 0.50),
  ('M07', 'SA-RES', 0.50),
  ('M07', 'SA-HB', 0.00),
  ('M07', 'HOU-RES', 0.50),
  ('M07', 'HOU-HB', 0.00),

  -- W01: Tear Out and Haul Off
  ('W01', 'ATX-RES', 2.00),
  ('W01', 'ATX-HB', 2.00),
  ('W01', 'SA-RES', 1.25),
  ('W01', 'SA-HB', 1.25),
  ('W01', 'HOU-RES', 1.25),
  ('W01', 'HOU-HB', 1.25),

  -- W02: Set Post 8' OC
  ('W02', 'ATX-RES', 2.00),
  ('W02', 'ATX-HB', 1.75),
  ('W02', 'SA-RES', 2.00),
  ('W02', 'SA-HB', 1.50),
  ('W02', 'HOU-RES', 2.00),
  ('W02', 'HOU-HB', 1.50),

  -- W03: Nail Up - Vertical up to 6' High
  ('W03', 'ATX-RES', 2.00),
  ('W03', 'ATX-HB', 1.65),
  ('W03', 'SA-RES', 1.50),
  ('W03', 'SA-HB', 1.25),
  ('W03', 'HOU-RES', 1.50),
  ('W03', 'HOU-HB', 1.25),

  -- W04: Nail Up - Vertical 7' or 8' High
  ('W04', 'ATX-RES', 2.25),
  ('W04', 'ATX-HB', 1.90),
  ('W04', 'SA-RES', 1.70),
  ('W04', 'SA-HB', 1.50),
  ('W04', 'HOU-RES', 1.70),
  ('W04', 'HOU-HB', 1.50),

  -- W05: Additional Rail
  ('W05', 'ATX-RES', 0.20),
  ('W05', 'ATX-HB', 0.15),
  ('W05', 'SA-RES', 0.00),
  ('W05', 'SA-HB', 0.00),
  ('W05', 'HOU-RES', 0.00),
  ('W05', 'HOU-HB', 0.00),

  -- W06: Goodneighbor Style
  ('W06', 'ATX-RES', 0.20),
  ('W06', 'ATX-HB', 0.10),
  ('W06', 'SA-RES', 0.00),
  ('W06', 'SA-HB', 0.00),
  ('W06', 'HOU-RES', 0.00),
  ('W06', 'HOU-HB', 0.00),

  -- W07: Cap and Trim
  ('W07', 'ATX-RES', 0.50),
  ('W07', 'ATX-HB', 0.50),
  ('W07', 'SA-RES', 0.50),
  ('W07', 'SA-HB', 0.00),
  ('W07', 'HOU-RES', 0.50),
  ('W07', 'HOU-HB', 0.00),

  -- W08: Just Trim/Additional Trim
  ('W08', 'ATX-RES', 0.25),
  ('W08', 'ATX-HB', 0.20),
  ('W08', 'SA-RES', 0.15),
  ('W08', 'SA-HB', 0.00),
  ('W08', 'HOU-RES', 0.15),
  ('W08', 'HOU-HB', 0.00),

  -- W09: Just CAP
  ('W09', 'ATX-RES', 0.25),
  ('W09', 'ATX-HB', 0.20),
  ('W09', 'SA-RES', 0.25),
  ('W09', 'SA-HB', 0.00),
  ('W09', 'HOU-RES', 0.25),
  ('W09', 'HOU-HB', 0.00),

  -- W10: Wood Gate - Vert - Single (up to 6FT)
  ('W10', 'ATX-RES', 30.00),
  ('W10', 'ATX-HB', 30.00),
  ('W10', 'SA-RES', 25.00),
  ('W10', 'SA-HB', 15.00),
  ('W10', 'HOU-RES', 25.00),
  ('W10', 'HOU-HB', 25.00),

  -- W11: Wood Gate - Vertical - Single (8FT)
  ('W11', 'ATX-RES', 35.00),
  ('W11', 'ATX-HB', 35.00),
  ('W11', 'SA-RES', 30.00),
  ('W11', 'SA-HB', 20.00),
  ('W11', 'HOU-RES', 30.00),
  ('W11', 'HOU-HB', 30.00),

  -- W12: Horizontal Set Post 6' OC
  ('W12', 'ATX-RES', 2.25),
  ('W12', 'ATX-HB', 2.00),
  ('W12', 'SA-RES', 2.00),
  ('W12', 'SA-HB', 1.75),
  ('W12', 'HOU-RES', 2.00),
  ('W12', 'HOU-HB', 1.75),

  -- W13: Horizontal Nail Up 6' High
  ('W13', 'ATX-RES', 3.00),
  ('W13', 'ATX-HB', 2.90),
  ('W13', 'SA-RES', 1.50),
  ('W13', 'SA-HB', 1.25),
  ('W13', 'HOU-RES', 1.50),
  ('W13', 'HOU-HB', 1.25),

  -- W15: Horizontal Wood Gate Single
  ('W15', 'ATX-RES', 50.00),
  ('W15', 'ATX-HB', 50.00),
  ('W15', 'SA-RES', 25.00),
  ('W15', 'SA-HB', 20.00),
  ('W15', 'HOU-RES', 25.00),
  ('W15', 'HOU-HB', 20.00),

  -- W16: Set Post for Exposed Horizontal Fence
  ('W16', 'ATX-RES', 2.75),
  ('W16', 'ATX-HB', 2.75),
  ('W16', 'SA-RES', 2.00),
  ('W16', 'SA-HB', 1.75),
  ('W16', 'HOU-RES', 2.00),
  ('W16', 'HOU-HB', 1.75),

  -- W17: Nail up Exposed Horizontal fence
  ('W17', 'ATX-RES', 6.00),
  ('W17', 'ATX-HB', 6.00),
  ('W17', 'SA-RES', 4.00),
  ('W17', 'SA-HB', 4.00),
  ('W17', 'HOU-RES', 4.00),
  ('W17', 'HOU-HB', 4.00),

  -- W18: Horizontal Nail Up 7' or 8' High
  ('W18', 'ATX-RES', 3.50),
  ('W18', 'ATX-HB', 3.40),
  ('W18', 'SA-RES', 2.00),
  ('W18', 'SA-HB', 1.65),
  ('W18', 'HOU-RES', 2.00),
  ('W18', 'HOU-HB', 1.65)

) AS rates(labor_sku, bu_code, rate)
  ON lc.labor_sku = rates.labor_sku
  AND bu.code = rates.bu_code;
