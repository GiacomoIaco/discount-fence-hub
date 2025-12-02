-- ============================================
-- IMPORT MATERIALS DATA
-- Created: 2025-12-01
-- Purpose: Import complete materials catalog from spreadsheet
-- Uses UPSERT to preserve existing IDs that have foreign key references
-- ============================================

-- Insert/Update all materials (using UPSERT)
INSERT INTO materials (
  material_sku, material_name, category, sub_category, unit_type, unit_cost,
  length_ft, width_nominal, actual_width, thickness, quantity_per_unit,
  fence_category_standard, is_bom_default, status, normally_stocked, notes
) VALUES
-- 01-Post
('NS24', '3x3x8 Post - Black', '01-Post', 'Iron Squared Post', 'Each', 30.67, 8, 3, NULL, NULL, 1, NULL, false, 'Active', true, 'Not Standard'),
('PNS2', '3x3 Steel Post - PowderC Grey - 8FT', '01-Post', 'Iron Squared Post', 'Each', 53.20, 8, 3, NULL, NULL, 1, NULL, false, 'Active', true, 'Not Standard'),
('PS08', '2x2x4 Post - Black Plated', '01-Post', 'Iron Squared Post', 'Each', 15.43, 4, 0, NULL, NULL, 1, NULL, false, 'Active', true, 'Standard'),
('PNS3', '2x2x48 16ga Pre-Drilled Plated Post for Cable Railing w/Cap', '01-Post', 'Rail Post', 'Each', 8.88, 4, 2, NULL, NULL, 1, NULL, false, 'Active', true, 'Standard'),
('PS10', '2x2x8 Post - Black', '01-Post', 'Iron Squared Post', 'Each', 18.43, 8, 2, NULL, NULL, 1, ARRAY['Horizontal W', 'Iron'], false, 'Active', true, 'Standard'),
('PNS4', '2x2x48 16ga 45 Degree Angle Pre-Drilled Plated Post for Cable Railing w/Cap', '01-Post', 'Rail Post', 'Each', 9.23, 4, 2, NULL, NULL, 1, NULL, false, 'Active', true, 'Standard'),
('NS31', '3x3x10 Post - Black', '01-Post', 'Steel Post', 'Each', 46.61, 10, 3, NULL, NULL, 1, NULL, false, 'Active', true, 'Not Standard'),
('PS13', '4x4 Wood Post - PTP - 8FT', '01-Post', 'Wood 4x4', 'Each', 7.85, 8, 4, NULL, NULL, 1, ARRAY['Vertical W', 'Horizontal W'], true, 'Active', true, 'Standard'),
('PS07', '2x2x10 Post - Black', '01-Post', 'Iron Squared Post', 'Each', 14.50, 10, 2, NULL, NULL, 1, NULL, false, 'Active', true, 'Not Standard'),
('PS14', '4x4 Wood Post - Cedar - 8FT', '01-Post', 'Wood 4x4', 'Each', 30.59, 8, 4, NULL, NULL, 1, NULL, false, 'Active', true, 'Not Standard'),
('PS04', 'D2-3/8 Steel Post - Galv - 8FT', '01-Post', 'Steel Post', 'Each', 10.63, 8, NULL, NULL, '16ga', 1, ARRAY['Vertical W', 'Horizontal W'], true, 'Active', true, 'Standard'),
('NS22', '2.5x2.5x8 Post - Black', '01-Post', 'Iron Squared Post', 'Each', 35.91, 8, NULL, NULL, NULL, 1, ARRAY['Horizontal W', 'Iron'], false, 'Active', true, 'Not Standard'),
('PS12', '4x4 Wood Post - PTP - 10FT', '01-Post', 'Wood 4x4', 'Each', 11.55, 10, 4, NULL, NULL, 1, ARRAY['Vertical W', 'Horizontal W'], true, 'Active', true, 'Standard'),
('PNS9', 'Post Master - 8FT', '01-Post', 'Post Master', 'Each', 20.07, 8, 0, NULL, NULL, 1, NULL, false, 'Active', true, 'Standard'),
('PNS5', '4x4 Steel Post - Galvanized - 8FT', '01-Post', 'Steel Post', 'Each', 83.33, 8, 4, NULL, NULL, 1, NULL, false, 'Active', true, 'Not Standard'),
('PS03', 'D2-3/8 Steel Post - Galv - 10FT', '01-Post', 'Steel Post', 'Each', 15.41, 10, NULL, NULL, '16ga', 1, ARRAY['Vertical W', 'Horizontal W'], true, 'Active', true, 'Standard'),
('PNS6', '4'' Round Post - Galvanized - 9FT', '01-Post', 'Steel Post', 'Each', 61.87, 9, 4, NULL, NULL, 1, NULL, false, 'Active', true, 'Not Standard'),
('PS11', '4x4 Wood Post - Fir - 8FT', '01-Post', 'Wood 4x4', 'Each', 17.06, 8, 4, NULL, NULL, 1, NULL, false, 'Active', true, 'Standard'),

-- 02-Pickets
('P403', '1x4x6 WRC', '02-Pickets', '02-01 1x4 Pickets', 'Each', 2.22, 6, 4, 3.5, '5/8"', 1, ARRAY['Vertical W'], false, 'Active', true, NULL),
('P604', '1x6x6 5/8 Stained - DFE Cedar Tone', '02-Pickets', '02-02 1x6 Pickets', 'Each', 2.34, 6, 6, 5.5, '5/8"', 1, ARRAY['Vertical W', 'Horizontal W'], false, 'Active', true, NULL),
('P601', '1x6x6 Sierra Placer', '02-Pickets', '02-02 1x6 Pickets', 'Each', 2.09, 6, 6, 5.5, '5/8"', 1, ARRAY['Vertical W', 'Horizontal W'], true, 'Active', true, NULL),
('P613', '1X8X6 Sierra Placer', '02-Pickets', '02-03 1x8 Boards', 'Each', 2.14, 6, 8, 5.5, '5/8"', 1, ARRAY['Vertical W', 'Horizontal W'], false, 'Active', true, NULL),
('P602', '1x6x6 Red D/Light H', '02-Pickets', '02-02 1x6 Pickets', 'Each', 2.27, 6, 6, 5.5, '5/8"', 1, ARRAY['Vertical W', 'Horizontal W'], true, 'Active', true, NULL),
('P801', '1x6x8 Red D/Light H', '02-Pickets', '02-02 1x6 Pickets', 'Each', 3.27, 6, 6, 5.5, '5/8"', 1, ARRAY['Vertical W', 'Horizontal W'], false, 'Active', true, NULL),
('P603', '1X6X6 WRC', '02-Pickets', '02-02 1x6 Pickets', 'Each', 3.88, 6, 6, 5.5, '5/8"', 1, ARRAY['Vertical W', 'Horizontal W'], true, 'Active', true, NULL),
('P401', '1x4x6 Sierra Placer', '02-Pickets', '02-01 1x4 Pickets', 'Each', 2.01, 6, 4, 3.5, '5/8"', 1, ARRAY['Vertical W'], true, 'Active', true, NULL),
('P609', '1x6x6 3/4 Stained - Alta/Orange Tag', '02-Pickets', '02-02 1x6 Pickets', 'Each', 2.58, 6, 6, 6, '3/4"', 1, ARRAY['Vertical W', 'Horizontal W'], true, 'Active', true, NULL),
('P10', '1x6x6 Sierra Rustic', '02-Pickets', '02-02 1x6 Pickets', 'Each', 1.06, 6, 6, 5.5, '5/8"', 1, ARRAY['Vertical W', 'Horizontal W'], false, 'Active', true, NULL),
('P606', '1x6x6 5/8 Stained - FLW - Dark Brown', '02-Pickets', '02-02 1x6 Pickets', 'Each', 3.38, 6, 6, 5.5, '5/8"', 1, ARRAY['Vertical W', 'Horizontal W'], false, 'Active', true, 'Stained'),
('P605', '1x6x6 5/8 Stained - DFE Oxford', '02-Pickets', '02-02 1x6 Pickets', 'Each', 2.73, 6, 6, 5.5, '5/8"', 1, ARRAY['Vertical W', 'Horizontal W'], false, 'Active', true, NULL),
('NS33', '1x6x6 Sierra El Dorado', '02-Pickets', '02-02 1x6 Pickets', 'Each', 2.19, 6, 6, 5.5, '5/8"', 1, ARRAY['Horizontal W', 'Vertical W'], false, 'Active', true, NULL),
('P804', '1X6X8 Sierra Placer', '02-Pickets', '02-02 1x6 Pickets', 'Each', 2.31, 8, 6, 5.5, '5/8"', 1, ARRAY['Vertical W', 'Horizontal W'], false, 'Active', true, NULL),
('P402', '1x4x6 Red D/Light H', '02-Pickets', '02-01 1x4 Pickets', 'Each', 1.29, 6, 4, 3.5, '5/8"', 1, ARRAY['Vertical W'], false, 'Active', true, NULL),
('P611', '1x6x6 3/4 Non Stained Red D/Light', '02-Pickets', '02-02 1x6 Pickets', 'Each', 0.00, 6, 6, 5.5, '3/4"', 1, ARRAY['Vertical W', 'Horizontal W'], false, 'Active', true, NULL),
('P803', '1X4X8 Sierra El Dorado', '02-Pickets', '02-01 1x4 Pickets', 'Each', 1.74, 8, 4, 3.5, '5/8"', 1, ARRAY['Vertical W', 'Horizontal W'], false, 'Active', true, NULL),
('NS20', '1x6x10 Western Red Cedar Picket/Trim', '02-Pickets', '02-02 1x6 Pickets', 'Each', 8.61, 10, 6, 5.5, '5/8"', 1, NULL, false, 'Active', true, NULL),

-- 03-Rails
('RNS3', '2x4x10 Rail - PTP', '03-Rails', '2x4 Rails', 'Each', 5.15, 10, 4, NULL, NULL, 1, NULL, false, 'Active', true, NULL),
('RA02', '2x4x8 Rail - PTP', '03-Rails', '2x4 Rails', 'Each', 3.44, 8, 4, NULL, NULL, 1, ARRAY['Vertical W'], true, 'Active', true, NULL),
('RA03', '2x4x8 Rail - Cedar', '03-Rails', '2x4 Rails', 'Each', 0.00, 8, 4, NULL, NULL, 1, NULL, false, 'Active', true, NULL),
('RA01', '2x4x8 Rail - SPF', '03-Rails', '2x4 Rails', 'Each', 3.40, 8, 4, NULL, NULL, 1, ARRAY['Vertical W'], true, 'Active', true, NULL),
('RNS2', '2x4x10 Rail - FIR', '03-Rails', 'Wood 4x4', 'Each', 4.95, 10, 4, NULL, NULL, 1, NULL, false, 'Active', true, NULL),

-- 04-Caps, Trims & Nailers
('NS32', '2x6x12 PTP', '04-Caps, Trims & Nailers', 'Cap', 'Each', 7.66, 12, NULL, NULL, NULL, 1, NULL, false, 'Active', true, NULL),
('NS01', '1x4x12- Cedar', '04-Caps, Trims & Nailers', 'Trim', 'Each', 0.00, 12, NULL, NULL, NULL, 1, NULL, false, 'Active', true, 'Rackable'),
('CTN05', '1x2x10 Trim', '04-Caps, Trims & Nailers', 'Trim', 'Each', 3.21, 10, NULL, NULL, NULL, 1, NULL, false, 'Active', true, NULL),
('CTN07', '1x4x8 Cedar - Flat', '04-Caps, Trims & Nailers', 'Trim', 'Each', 4.55, 8, NULL, NULL, NULL, 1, NULL, false, 'Active', true, NULL),
('CTN10', '2x6x12 Red Diamond', '04-Caps, Trims & Nailers', 'Cap', 'Each', 14.70, 12, NULL, NULL, NULL, 1, ARRAY['Vertical W', 'Horizontal W'], false, 'Active', true, NULL),
('CTN04', '2x2x8 Nailer - PTP', '04-Caps, Trims & Nailers', 'Nailer', 'Each', 2.87, 8, NULL, NULL, NULL, 1, ARRAY['Horizontal W'], false, 'Active', true, NULL),
('CTN02', '2x6x12 Rough Cedar', '04-Caps, Trims & Nailers', 'Cap', 'Each', 15.91, 12, NULL, NULL, NULL, 1, ARRAY['Vertical W', 'Horizontal W'], false, 'Active', true, NULL),
('CTN09', '2x6x10 SPF', '04-Caps, Trims & Nailers', 'Cap', 'Each', 7.85, 10, NULL, NULL, NULL, 1, ARRAY['Vertical W', 'Horizontal W'], false, 'Active', true, NULL),
('CTN03', '2x2x8 Nailer - Cedar', '04-Caps, Trims & Nailers', 'Nailer', 'Each', 5.04, 8, NULL, NULL, NULL, 1, ARRAY['Horizontal W'], false, 'Active', true, NULL),

-- 05-Iron Panels
('IP03', '3x8 2R FF Panel - Black', '05-Iron Panels', '2 Rail F/F', 'Each', 51.10, 3, 8, 8, NULL, 1, ARRAY['Iron'], true, 'Active', true, 'No Rack'),
('IP05', '4x8 2R FF Panel - Black', '05-Iron Panels', '2 Rail F/F', 'Each', 47.76, 4, 8, 8, NULL, 1, ARRAY['Iron'], true, 'Active', true, 'No Rack'),
('NS21', '40x8'' FF Panel - Black Rackable', '05-Iron Panels', 'Rail Panel', 'Each', 53.04, 3.5, 8, 8, NULL, 1, ARRAY['Iron'], true, 'Active', true, 'Rackable'),
('NS04', 'Ameristar 6x8 3R FP Panel - Rackable', '05-Iron Panels', 'Ameristar', 'Each', 0.00, 6, 8, 8, NULL, 1, ARRAY['Iron'], true, 'Active', true, 'Rackable'),
('IP02', '3x10 2R FF Panel - Black Rackable', '05-Iron Panels', 'Rail Panel', 'Each', 93.44, 3, 10, 10, NULL, 1, NULL, true, 'Active', true, 'Rackable'),
('IP10', '6x8 2R FF Panel - Black', '05-Iron Panels', '2 Rail F/F', 'Each', 81.00, 6, 8, 8, NULL, 1, ARRAY['Iron'], true, 'Active', true, 'No Rack'),
('IP01', '3x10 2R FF Panel - Black', '05-Iron Panels', 'Rail Panel', 'Each', 91.12, 3, 10, 10, NULL, 1, ARRAY['Iron'], true, 'Active', true, 'No Rack'),
('IP12', '6x8 3R FP Panel - Black Rackable', '05-Iron Panels', '3 Rail  F/P', 'Each', 0.00, 6, 8, 8, NULL, 1, NULL, true, 'Active', true, 'Rackable'),
('IP09', '5x8 2R FF Panel - Black Rackable', '05-Iron Panels', '2 Rail F/F', 'Each', 75.69, 5, 8, 8, NULL, 1, ARRAY['Iron'], true, 'Active', true, 'Rackable'),
('NS52', '6x8 2R PP Panel - Black Rackable', '05-Iron Panels', '2 Rail F/F', 'Each', 84.44, 6, 8, 8, NULL, 1, ARRAY['Iron'], true, 'Active', true, 'Rackable'),
('IP11', '6x8 2R FF Panel - Black Rackable', '05-Iron Panels', '2 Rail F/F', 'Each', 85.20, 6, 8, 8, NULL, 1, ARRAY['Iron'], true, 'Active', true, 'Rackable'),
('IP08', '5x8 2R FF Panel - Black', '05-Iron Panels', '2 Rail F/F', 'Each', 71.17, 5, 8, 8, NULL, 1, ARRAY['Iron'], true, 'Active', true, 'No Rack'),
('IP06', '4x8 2R FF Panel - Black Rackable', '05-Iron Panels', '2 Rail F/F', 'Each', 60.51, 4, 8, 8, NULL, 1, ARRAY['Iron'], true, 'Active', true, 'Rackable'),
('IP04', '3x8 2R FF Panel - Black Rackable', '05-Iron Panels', 'Rail Panel', 'Each', 45.51, 3, 8, 8, NULL, 1, ARRAY['Iron'], true, 'Active', true, 'Rackable'),

-- 06-Concrete
('CTP', 'Portland Cement (94 Pound)', '06-Concrete', 'Sand & Gravel Mix', 'Bags', 12.65, NULL, 0, NULL, NULL, 1, ARRAY['Vertical W', 'Horizontal W', 'Iron'], true, 'Active', true, NULL),
('CTR', 'Red Bag Concrete (50lb)', '06-Concrete', 'Fast-Setting Concrete Bag', 'Bags', 7.44, NULL, 0, NULL, NULL, 1, NULL, true, 'Active', true, NULL),
('CTY', 'Yellow Bag Concrete (80lb)', '06-Concrete', 'Standard Concrete Bag', 'Bags', 5.63, NULL, 0, NULL, NULL, 1, NULL, true, 'Active', true, NULL),
('CTQ', 'QuickRock Pounds', '06-Concrete', 'Sand & Gravel Mix', 'Pounds', 39.40, NULL, 0, NULL, NULL, 50, ARRAY['Vertical W', 'Horizontal W', 'Iron'], true, 'Active', true, NULL),
('CTS', 'Sand & Gravel Mix Scoops', '06-Concrete', 'Sand & Gravel Mix', 'Scoop', 45.07, NULL, 0, NULL, NULL, 1, ARRAY['Vertical W', 'Horizontal W', 'Iron'], true, 'Active', true, NULL),

-- 07-Gates
('G11', 'Magna Latch (M)', '07-Gates', NULL, 'Each', 64.83, NULL, NULL, NULL, NULL, 1, NULL, false, 'Active', true, NULL),
('G02', 'Batwing Hinge - Iron (M)', '07-Gates', NULL, 'Each', 2.00, NULL, NULL, NULL, NULL, 1, NULL, false, 'Active', true, NULL),
('G08', 'Gate Kit - Vertical', '07-Gates', 'Gate Kit', 'Each', 11.20, NULL, NULL, NULL, NULL, 1, ARRAY['Vertical W'], false, 'Active', true, NULL),
('G09', 'Gate Spring', '07-Gates', NULL, 'Each', 9.97, NULL, NULL, NULL, NULL, 1, NULL, false, 'Active', true, NULL),
('G01', 'Batwing Hinge - Iron (F)', '07-Gates', NULL, 'Each', 1.89, NULL, NULL, NULL, NULL, 1, NULL, false, 'Active', true, NULL),
('G05', 'Gate Ends 1x1x6', '07-Gates', NULL, 'Each', 10.15, NULL, NULL, NULL, NULL, 1, NULL, false, 'Active', true, NULL),
('G04', 'Gate End Cap - SQ 1x1 Black', '07-Gates', NULL, 'Each', 0.64, NULL, NULL, NULL, NULL, 1, NULL, false, 'Active', true, NULL),
('G03', 'Drop Rod Kit', '07-Gates', NULL, 'Each', 7.04, NULL, NULL, NULL, NULL, 1, NULL, false, 'Active', true, NULL),
('G07', 'Gate Kit - Horizontal', '07-Gates', 'Gate Kit', 'Each', 14.76, NULL, NULL, NULL, NULL, 1, ARRAY['Horizontal W'], false, 'Active', true, NULL),
('G10', 'IRON GATE KIT', '07-Gates', 'Gate Kit', 'Each', 69.68, NULL, NULL, NULL, NULL, 1, ARRAY['Iron'], false, 'Active', true, NULL),
('NSG02', '1-1/4 Gate End Cap', '07-Gates', NULL, 'Each', 0.00, NULL, NULL, NULL, NULL, 1, NULL, false, 'Active', true, NULL),
('G06', 'Gate Gravity Latch', '07-Gates', NULL, 'Each', 2.00, NULL, NULL, NULL, NULL, 1, NULL, false, 'Active', true, NULL),
('GNS01', '1 1/4X1 1/4X6 GATE END', '07-Gates', NULL, 'Each', 7.58, NULL, NULL, NULL, NULL, 1, NULL, false, 'Active', true, NULL),
('G16', 'Metal Gate Frame', '07-Gates', NULL, 'Each', 105.47, NULL, NULL, NULL, NULL, 1, NULL, false, 'Active', true, NULL),

-- 08-Hardware
('NS26', '6x6 Butt - Hinges', '08-Hardware', 'Gate Hardware', 'Each', 33.41, NULL, NULL, NULL, NULL, 1, NULL, false, 'Active', true, NULL),
('HW07', 'Nails - Framing/Post (# Rails)', '08-Hardware', 'Nails & Screws', 'Rails', 0.53, NULL, NULL, NULL, NULL, 28, ARRAY['Vertical W', 'Horizontal W'], false, 'Active', true, 'Framing/Post nails'),
('HNS1', 'Ameristar Bracket', '08-Hardware', 'Brackets', 'Each', 0.00, NULL, NULL, NULL, NULL, 1, ARRAY['Iron'], false, 'Active', true, NULL),
('CS01', 'Black Caulk (10oz)', '08-Hardware', 'Paint', 'Each', 9.03, NULL, NULL, NULL, NULL, 1, ARRAY['Iron'], false, 'Active', true, NULL),
('HNS8', 'Self-Tapping Tek Screw 1''''', '08-Hardware', 'Nails & Screws', 'Each', 5.65, NULL, NULL, NULL, NULL, 1, ARRAY['Vertical W', 'Horizontal W'], false, 'Active', true, 'Self-Tapping Screws'),
('HW03', '3'''' Deck Screw', '08-Hardware', 'Nails & Screws', 'Each', 0.06, NULL, NULL, NULL, NULL, 1, NULL, false, 'Active', true, NULL),
('CS02', 'Black Spray Paint (12oz)', '08-Hardware', 'Paint', 'Each', 5.20, NULL, NULL, NULL, NULL, 1, ARRAY['Iron'], false, 'Active', true, NULL),
('NS12', '4x4 Plastic Plate Covers', '08-Hardware', 'Post Cap', 'Each', 0.00, NULL, NULL, NULL, NULL, 1, NULL, false, 'Active', true, NULL),
('HW04', '4x4 Plates', '08-Hardware', 'Plates', 'Each', 1.70, NULL, NULL, NULL, NULL, 1, NULL, false, 'Active', true, NULL),
('HW06', 'D2-3/8 Bracket - Galvanized', '08-Hardware', 'Brackets', 'Each', 0.86, NULL, NULL, NULL, NULL, 1, ARRAY['Vertical W', 'Horizontal W'], false, 'Active', true, NULL),
('HNS13', 'Saddle Cap', '08-Hardware', NULL, 'Each', 0.37, NULL, NULL, NULL, NULL, 1, NULL, false, 'Active', true, NULL),
('HW05', 'Concrete Anchors', '08-Hardware', 'Anchors', 'Each', 0.76, NULL, NULL, NULL, NULL, 1, NULL, false, 'Active', true, NULL),
('HNS9', 'Stainless Cable', '08-Hardware', NULL, 'Each', 0.09, NULL, NULL, NULL, NULL, 1, NULL, false, 'Active', true, NULL),
('HW01', '1.5" Lag Screws', '08-Hardware', 'Nails & Screws', 'Each', 0.04, NULL, NULL, NULL, NULL, 1, NULL, false, 'Active', true, NULL),
('HW10', 'Wall Mount L Bracket', '08-Hardware', 'Brackets', 'Each', 1.49, NULL, NULL, NULL, NULL, 1, NULL, false, 'Active', true, NULL),
('HW08', 'NAILS - PICKET (# Coils)', '08-Hardware', 'Nails', 'Coils', 2.48, NULL, NULL, NULL, NULL, 300, ARRAY['Vertical W', 'Horizontal W'], false, 'Active', true, NULL),
('HW02', '3'' Black Lag Bolt', '08-Hardware', 'Nails & Screws', 'Each', 0.22, NULL, NULL, NULL, NULL, 1, NULL, false, 'Active', true, NULL),
('HW11', '2 Black Lag Bolt', '08-Hardware', 'Nails & Screws', 'Each', 0.34, NULL, NULL, NULL, NULL, 1, NULL, false, 'Active', true, NULL),
('NS27', 'Butterfly - Hinge', '08-Hardware', 'Gate Hardware', 'Each', 5.78, NULL, NULL, NULL, NULL, 1, NULL, false, 'Active', true, NULL),
('HW09', 'Self-Tapping Tek Screw (2-3/4)', '08-Hardware', 'Nails', 'Each', 0.40, NULL, NULL, NULL, NULL, 1, NULL, false, 'Active', true, NULL),

-- 10-Raw Steel
('NS09', '2-7/8x6.5 Drill Stem', '10-Raw Steel', NULL, 'Each', 0.00, NULL, NULL, NULL, NULL, 1, NULL, false, 'Active', true, NULL),
('NS10', '2-7/8x7.5 Drill Stem', '10-Raw Steel', NULL, 'Each', 0.00, NULL, NULL, NULL, NULL, 1, NULL, false, 'Active', true, NULL),
('RS04', '1x2x24 11GA Steel Tube', '10-Raw Steel', NULL, 'Each', 3.45, NULL, NULL, NULL, NULL, 1, NULL, false, 'Active', true, NULL),
('RS03', '1x1x24 Raw Steel', '10-Raw Steel', NULL, 'Each', 0.00, NULL, NULL, NULL, NULL, 1, NULL, false, 'Active', true, NULL),
('RS02', '1/4x6x10 Steel Picket', '10-Raw Steel', 'Steel Picket', 'Each', 0.00, NULL, NULL, NULL, NULL, 1, NULL, false, 'Active', true, NULL),
('NS07', '1/2x4x12 Flat Bar', '10-Raw Steel', NULL, 'Each', 0.00, NULL, NULL, NULL, NULL, 1, NULL, false, 'Active', true, NULL),
('NS08', '1/2x4x8 Flat Bar', '10-Raw Steel', NULL, 'Each', 0.00, NULL, NULL, NULL, NULL, 1, NULL, false, 'Active', true, NULL),
('RS07', '1/4x3x20 Steel Picket', '10-Raw Steel', 'Steel Picket', 'Each', 54.07, NULL, NULL, NULL, NULL, 1, NULL, false, 'Active', true, NULL),
('RS08', '6x6 Plates', '10-Raw Steel', 'Plate', 'Each', 7.29, NULL, NULL, NULL, NULL, 1, NULL, false, 'Active', true, NULL),
('RS06', '3x3x12 Steel Tube', '10-Raw Steel', NULL, 'Each', 0.00, NULL, NULL, NULL, NULL, 1, NULL, false, 'Active', true, NULL),
('RS01', '1/4x4x10 Steel Picket', '10-Raw Steel', 'Steel Picket', 'Each', 77.93, NULL, NULL, NULL, NULL, 1, NULL, false, 'Active', true, NULL),
('NS06', '1.5x1.5 Bull Panel - 4x12', '10-Raw Steel', 'Bull Panel', 'Each', 0.00, NULL, NULL, NULL, NULL, 1, NULL, false, 'Active', true, NULL),
('NS11', '2-7/8x9 Drill Stem', '10-Raw Steel', NULL, 'Each', 0.00, NULL, NULL, NULL, NULL, 1, NULL, false, 'Active', true, NULL),
('RS05', '2x2x24 11GA Steel Tube', '10-Raw Steel', NULL, 'Each', 48.66, NULL, NULL, NULL, NULL, 1, NULL, false, 'Active', true, NULL),

-- 13-Raw Materials
('ST03', 'Stain Oxford Brown', '13-Raw Materials', NULL, 'Each', 20.37, NULL, NULL, NULL, NULL, 1, NULL, false, 'Active', true, NULL),
('ST02', 'Stain Natural', '13-Raw Materials', NULL, 'Each', 19.49, NULL, NULL, NULL, NULL, 1, NULL, false, 'Active', true, NULL),

-- 14-Post Cap
('NS23', '2.5x2.5 SQ Post Cap - Black', '14-Post Cap', '2.5x2.5', 'Each', 1.35, NULL, NULL, NULL, NULL, 1, NULL, false, 'Active', true, NULL),
('PC03', '2x2 SQ Post Cap - Black', '14-Post Cap', 'Post Cap', 'Each', 0.81, NULL, NULL, NULL, NULL, 1, NULL, false, 'Active', true, NULL),
('PC07', '4 Post Cap - Dome', '14-Post Cap', '4x4', 'Each', 2.46, NULL, NULL, NULL, NULL, 1, NULL, false, 'Active', true, NULL),
('PC06', '4x4 Galvanized Cap', '14-Post Cap', 'Post Cap', 'Each', 2.05, NULL, NULL, NULL, NULL, 1, NULL, false, 'Active', true, NULL),
('PC04', '2x2 Post Plug - Black', '14-Post Cap', 'Plug', 'Each', 0.47, NULL, NULL, NULL, NULL, 1, NULL, false, 'Active', true, NULL),
('PC05', '3x3 Post Plug - Grey', '14-Post Cap', 'Post Cap', 'Each', 3.21, NULL, NULL, NULL, NULL, 1, NULL, false, 'Active', true, NULL),
('NS25', '3x3 SQ Post Cap - Black', '14-Post Cap', '3x3', 'Each', 1.62, NULL, NULL, NULL, NULL, 1, NULL, false, 'Active', true, NULL),
('PC01', 'D2-3/8 Post Cap - Dome', '14-Post Cap', 'Dome', 'Each', 0.71, NULL, NULL, NULL, NULL, 1, ARRAY['Vertical W', 'Horizontal W'], false, 'Active', true, NULL),
('PC02', 'D2-3/8 Post Plug - Galvanized', '14-Post Cap', 'Plug', 'Each', 1.82, NULL, NULL, NULL, NULL, 1, ARRAY['Vertical W', 'Horizontal W'], false, 'Active', true, NULL),

-- 20-Non-Standard
('NS50', 'U Channel (Side Frame)1.1 x 1.26"x71"-2 Pack', '20-Non-Standard', NULL, 'Each', 31.30, NULL, NULL, NULL, NULL, 1, NULL, false, 'Active', true, NULL),
('NS35', '1x3x12 Black Powder Coat-11Ga', '20-Non-Standard', NULL, 'Each', 71.84, NULL, NULL, NULL, NULL, 1, NULL, false, 'Active', true, NULL),
('NS34', '2x4x12 Black Powder Coat Iron Rail', '20-Non-Standard', NULL, 'Each', 5.66, NULL, NULL, NULL, NULL, 1, NULL, false, 'Active', true, NULL)
ON CONFLICT (material_sku) DO UPDATE SET
  material_name = EXCLUDED.material_name,
  category = EXCLUDED.category,
  sub_category = EXCLUDED.sub_category,
  unit_type = EXCLUDED.unit_type,
  unit_cost = EXCLUDED.unit_cost,
  length_ft = EXCLUDED.length_ft,
  width_nominal = EXCLUDED.width_nominal,
  actual_width = EXCLUDED.actual_width,
  thickness = EXCLUDED.thickness,
  quantity_per_unit = EXCLUDED.quantity_per_unit,
  fence_category_standard = EXCLUDED.fence_category_standard,
  is_bom_default = EXCLUDED.is_bom_default,
  status = EXCLUDED.status,
  normally_stocked = EXCLUDED.normally_stocked,
  notes = EXCLUDED.notes,
  updated_at = NOW();
