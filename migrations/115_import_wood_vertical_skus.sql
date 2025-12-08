-- ============================================
-- Migration 115: Import Wood Vertical SKUs (112 SKUs)
-- ============================================
-- Uses ON CONFLICT DO NOTHING to skip existing SKUs
-- Existing SKUs will NOT be modified

-- Create temporary table with raw SKU data
CREATE TEMP TABLE temp_sku_import (
  sku_code TEXT,
  sku_name TEXT,
  height INTEGER,
  post_type TEXT,
  rail_count INTEGER,
  style TEXT,
  post_spacing DECIMAL(10,2),
  post_material TEXT,
  picket_material TEXT,
  rail_material TEXT,
  cap_material TEXT,
  trim_material TEXT,
  rot_board_material TEXT,
  steel_post_cap_material TEXT,
  bracket_material TEXT
);

-- Insert all SKU data
INSERT INTO temp_sku_import VALUES
-- Standard (untreated) - A series (1x6 WOOD)
('A01', '6'' Ver 1x6 : 2R : WOOD Post', 6, 'WOOD', 2, 'standard', NULL, 'PS13', 'P601', 'RA01', NULL, NULL, NULL, NULL, NULL),
('A02', '6'' Ver 1x6 : 2R : WOOD Post : GN', 6, 'WOOD', 2, 'good-neighbor-builder', NULL, 'PS13', 'P601', 'RA01', NULL, NULL, NULL, NULL, NULL),
('A03', '6'' Ver 1x6 : 2R : WOOD Post : C&T', 6, 'WOOD', 2, 'standard', NULL, 'PS13', 'P601', 'RA01', 'CTN09', 'CTN07', NULL, NULL, NULL),
('A04', '6'' Ver 1x6 : 3R : WOOD Post', 6, 'WOOD', 3, 'standard', NULL, 'PS13', 'P601', 'RA01', NULL, NULL, NULL, NULL, NULL),
('A05', '6'' Ver 1x6 : 3R : WOOD Post : GN', 6, 'WOOD', 3, 'good-neighbor-builder', NULL, 'PS13', 'P601', 'RA01', NULL, NULL, NULL, NULL, NULL),
('A06', '6'' Ver 1x6 : 3R : WOOD Post : C&T2', 6, 'WOOD', 3, 'standard', NULL, 'PS13', 'P601', 'RA01', 'CTN09', 'CTN05', NULL, NULL, NULL),
('A07', '6'' Ver 1x6 : 3R : WOOD Post : C&T4', 6, 'WOOD', 3, 'standard', NULL, 'PS13', 'P601', 'RA01', 'CTN09', 'CTN07', NULL, NULL, NULL),

-- Standard (untreated) - B series (1x4 WOOD)
('B01', '6'' Ver 1x4 : 2R : WOOD Post', 6, 'WOOD', 2, 'standard', NULL, 'PS13', 'P401', 'RA01', NULL, NULL, NULL, NULL, NULL),
('B02', '6'' Ver 1x4 : 2R : WOOD Post : GN', 6, 'WOOD', 2, 'good-neighbor-builder', NULL, 'PS13', 'P401', 'RA01', NULL, NULL, NULL, NULL, NULL),
('B03', '6'' Ver 1x4 : 2R : WOOD Post : C&T', 6, 'WOOD', 2, 'standard', NULL, 'PS13', 'P401', 'RA01', 'CTN09', 'CTN07', NULL, NULL, NULL),
('B04', '6'' Ver 1x4 : 3R : WOOD Post', 6, 'WOOD', 3, 'standard', NULL, 'PS13', 'P401', 'RA01', NULL, NULL, NULL, NULL, NULL),
('B05', '6'' Ver 1x4 : 3R : WOOD Post : GN', 6, 'WOOD', 3, 'good-neighbor-builder', NULL, 'PS13', 'P401', 'RA01', NULL, NULL, NULL, NULL, NULL),
('B06', '6'' Ver 1x4 : 3R : WOOD Post : C&T2', 6, 'WOOD', 3, 'standard', NULL, 'PS13', 'P401', 'RA01', 'CTN09', 'CTN05', NULL, NULL, NULL),
('B07', '6'' Ver 1x4 : 3R : WOOD Post : C&T4', 6, 'WOOD', 3, 'standard', NULL, 'PS13', 'P401', 'RA01', 'CTN09', 'CTN07', NULL, NULL, NULL),

-- Standard (untreated) - C series (1x6 STEEL)
('C01', '6'' Ver 1x6 : 2R : STEEL Post', 6, 'STEEL', 2, 'standard', NULL, 'PS04', 'P601', 'RA01', NULL, NULL, NULL, 'PC01', 'HW06'),
('C02', '6'' Ver 1x6 : 2R : STEEL Post : GN', 6, 'STEEL', 2, 'good-neighbor-builder', NULL, 'PS04', 'P601', 'RA01', NULL, NULL, NULL, 'PC01', NULL),
('C03', '6'' Ver 1x6 : 2R : STEEL Post : C&T', 6, 'STEEL', 2, 'standard', NULL, 'PS04', 'P601', 'RA01', 'CTN09', 'CTN07', NULL, 'PC02', 'HW06'),
('C04', '6'' Ver 1x6 : 3R : STEEL Post', 6, 'STEEL', 3, 'standard', NULL, 'PS04', 'P601', 'RA01', NULL, NULL, NULL, 'PC01', 'HW06'),
('C05', '6'' Ver 1x6 : 3R : STEEL Post : GN', 6, 'STEEL', 3, 'good-neighbor-builder', NULL, 'PS04', 'P601', 'RA01', NULL, NULL, NULL, 'PC01', NULL),
('C06', '6'' Ver 1x6 : 3R : STEEL Post : C&T2', 6, 'STEEL', 3, 'standard', NULL, 'PS04', 'P601', 'RA01', 'CTN09', 'CTN05', NULL, 'PC02', 'HW06'),
('C07', '6'' Ver 1x6 : 3R : STEEL Post : C&T4', 6, 'STEEL', 3, 'standard', NULL, 'PS04', 'P601', 'RA01', 'CTN09', 'CTN07', NULL, 'PC02', 'HW06'),

-- Standard (untreated) - D series (1x4 STEEL)
('D01', '6'' Ver 1x4 : 2R : STEEL Post', 6, 'STEEL', 2, 'standard', NULL, 'PS04', 'P401', 'RA01', NULL, NULL, NULL, 'PC01', 'HW06'),
('D02', '6'' Ver 1x4 : 2R : STEEL Post : GN', 6, 'STEEL', 2, 'good-neighbor-builder', NULL, 'PS04', 'P401', 'RA01', NULL, NULL, NULL, 'PC01', NULL),
('D03', '6'' Ver 1x4 : 2R : STEEL Post : C&T', 6, 'STEEL', 2, 'standard', NULL, 'PS04', 'P401', 'RA01', 'CTN09', 'CTN07', NULL, 'PC02', 'HW06'),
('D04', '6'' Ver 1x4 : 3R : STEEL Post', 6, 'STEEL', 3, 'standard', NULL, 'PS04', 'P401', 'RA01', NULL, NULL, NULL, 'PC01', 'HW06'),
('D05', '6'' Ver 1x4 : 3R : STEEL Post : GN', 6, 'STEEL', 3, 'good-neighbor-builder', NULL, 'PS04', 'P401', 'RA01', NULL, NULL, NULL, 'PC01', NULL),
('D06', '6'' Ver 1x4 : 3R : STEEL Post : C&T2', 6, 'STEEL', 3, 'standard', NULL, 'PS04', 'P401', 'RA01', 'CTN09', 'CTN05', NULL, 'PC02', 'HW06'),
('D07', '6'' Ver 1x4 : 3R : STEEL Post : C&T4', 6, 'STEEL', 3, 'standard', NULL, 'PS04', 'P401', 'RA01', 'CTN09', 'CTN07', NULL, 'PC02', 'HW06'),

-- Treated (T suffix) - A series
('A01T', '6'' Ver 1x6 : 2R Tr: WOOD Post', 6, 'WOOD', 2, 'standard', NULL, 'PS13', 'P601', 'RA02', NULL, NULL, NULL, NULL, NULL),
('A02T', '6'' Ver 1x6 : 2R Tr: WOOD Post : GN', 6, 'WOOD', 2, 'good-neighbor-builder', NULL, 'PS13', 'P601', 'RA02', NULL, NULL, NULL, NULL, NULL),
('A03T', '6'' Ver 1x6 : 2R Tr: WOOD Post : C&T', 6, 'WOOD', 2, 'standard', NULL, 'PS13', 'P601', 'RA02', 'CTN09', 'CTN07', NULL, NULL, NULL),
('A04T', '6'' Ver 1x6 : 3R Tr: WOOD Post', 6, 'WOOD', 3, 'standard', NULL, 'PS13', 'P601', 'RA02', NULL, NULL, NULL, NULL, NULL),
('A05T', '6'' Ver 1x6 : 3R Tr: WOOD Post : GN', 6, 'WOOD', 3, 'good-neighbor-builder', NULL, 'PS13', 'P601', 'RA02', NULL, NULL, NULL, NULL, NULL),
('A06T', '6'' Ver 1x6 : 3R Tr: WOOD Post : C&T2', 6, 'WOOD', 3, 'standard', NULL, 'PS13', 'P601', 'RA02', 'CTN09', 'CTN05', NULL, NULL, NULL),
('A07T', '6'' Ver 1x6 : 3R Tr: WOOD Post : C&T4', 6, 'WOOD', 3, 'standard', NULL, 'PS13', 'P601', 'RA02', 'CTN09', 'CTN07', NULL, NULL, NULL),

-- Treated (T suffix) - B series
('B01T', '6'' Ver 1x4 : 2R Tr: WOOD Post', 6, 'WOOD', 2, 'standard', NULL, 'PS13', 'P401', 'RA02', NULL, NULL, NULL, NULL, NULL),
('B02T', '6'' Ver 1x4 : 2R Tr: WOOD Post : GN', 6, 'WOOD', 2, 'good-neighbor-builder', NULL, 'PS13', 'P401', 'RA02', NULL, NULL, NULL, NULL, NULL),
('B03T', '6'' Ver 1x4 : 2R Tr: WOOD Post : C&T', 6, 'WOOD', 2, 'standard', NULL, 'PS13', 'P401', 'RA02', 'CTN09', 'CTN07', NULL, NULL, NULL),
('B04T', '6'' Ver 1x4 : 3R Tr: WOOD Post', 6, 'WOOD', 3, 'standard', NULL, 'PS13', 'P401', 'RA02', NULL, NULL, NULL, NULL, NULL),
('B05T', '6'' Ver 1x4 : 3R Tr: WOOD Post : GN', 6, 'WOOD', 3, 'good-neighbor-builder', NULL, 'PS13', 'P401', 'RA02', NULL, NULL, NULL, NULL, NULL),
('B06T', '6'' Ver 1x4 : 3R Tr: WOOD Post : C&T2', 6, 'WOOD', 3, 'standard', NULL, 'PS13', 'P401', 'RA02', 'CTN09', 'CTN05', NULL, NULL, NULL),
('B07T', '6'' Ver 1x4 : 3R Tr: WOOD Post : C&T4', 6, 'WOOD', 3, 'standard', NULL, 'PS13', 'P401', 'RA02', 'CTN09', 'CTN07', NULL, NULL, NULL),

-- Treated (T suffix) - C series
('C01T', '6'' Ver 1x6 : 2R Tr: STEEL Post', 6, 'STEEL', 2, 'standard', NULL, 'PS04', 'P601', 'RA02', NULL, NULL, NULL, 'PC01', 'HW06'),
('C02T', '6'' Ver 1x6 : 2R Tr: STEEL Post : GN', 6, 'STEEL', 2, 'good-neighbor-builder', NULL, 'PS04', 'P601', 'RA02', NULL, NULL, NULL, 'PC01', NULL),
('C03T', '6'' Ver 1x6 : 2R Tr: STEEL Post : C&T', 6, 'STEEL', 2, 'standard', NULL, 'PS04', 'P601', 'RA02', 'CTN09', 'CTN07', NULL, 'PC02', 'HW06'),
('C04T', '6'' Ver 1x6 : 3R Tr: STEEL Post', 6, 'STEEL', 3, 'standard', NULL, 'PS04', 'P601', 'RA02', NULL, NULL, NULL, 'PC01', 'HW06'),
('C05T', '6'' Ver 1x6 : 3R Tr: STEEL Post : GN', 6, 'STEEL', 3, 'good-neighbor-builder', NULL, 'PS04', 'P601', 'RA02', NULL, NULL, NULL, 'PC01', NULL),
('C06T', '6'' Ver 1x6 : 3R Tr: STEEL Post : C&T2', 6, 'STEEL', 3, 'standard', NULL, 'PS04', 'P601', 'RA02', 'CTN09', 'CTN05', NULL, 'PC02', 'HW06'),
('C07T', '6'' Ver 1x6 : 3R Tr: STEEL Post : C&T4', 6, 'STEEL', 3, 'standard', NULL, 'PS04', 'P601', 'RA02', 'CTN09', 'CTN07', NULL, 'PC02', 'HW06'),

-- Treated (T suffix) - D series
('D01T', '6'' Ver 1x4 : 2R Tr: STEEL Post', 6, 'STEEL', 2, 'standard', NULL, 'PS04', 'P401', 'RA02', NULL, NULL, NULL, 'PC01', 'HW06'),
('D02T', '6'' Ver 1x4 : 2R Tr: STEEL Post : GN', 6, 'STEEL', 2, 'good-neighbor-builder', NULL, 'PS04', 'P401', 'RA02', NULL, NULL, NULL, 'PC01', NULL),
('D03T', '6'' Ver 1x4 : 2R Tr: STEEL Post : C&T', 6, 'STEEL', 2, 'standard', NULL, 'PS04', 'P401', 'RA02', 'CTN09', 'CTN07', NULL, 'PC02', 'HW06'),
('D04T', '6'' Ver 1x4 : 3R Tr: STEEL Post', 6, 'STEEL', 3, 'standard', NULL, 'PS04', 'P401', 'RA02', NULL, NULL, NULL, 'PC01', 'HW06'),
('D05T', '6'' Ver 1x4 : 3R Tr: STEEL Post : GN', 6, 'STEEL', 3, 'good-neighbor-builder', NULL, 'PS04', 'P401', 'RA02', NULL, NULL, NULL, 'PC01', NULL),
('D06T', '6'' Ver 1x4 : 3R Tr: STEEL Post : C&T2', 6, 'STEEL', 3, 'standard', NULL, 'PS04', 'P401', 'RA02', 'CTN09', 'CTN05', NULL, 'PC02', 'HW06'),
('D07T', '6'' Ver 1x4 : 3R Tr: STEEL Post : C&T4', 6, 'STEEL', 3, 'standard', NULL, 'PS04', 'P401', 'RA02', 'CTN09', 'CTN07', NULL, 'PC02', 'HW06'),

-- Cedartone (C suffix) - A series
('A01C', '6'' Ver 1x6 : 2R : WOOD Post - Cedartone', 6, 'WOOD', 2, 'standard', NULL, 'PS13C', 'P604', 'RA01C', NULL, NULL, NULL, NULL, NULL),
('A02C', '6'' Ver 1x6 : 2R : WOOD Post : GN - Cedartone', 6, 'WOOD', 2, 'good-neighbor-builder', NULL, 'PS13C', 'P604', 'RA01C', NULL, NULL, NULL, NULL, NULL),
('A03C', '6'' Ver 1x6 : 2R : WOOD Post : C&T - Cedartone', 6, 'WOOD', 2, 'standard', NULL, 'PS13C', 'P604', 'RA01C', 'CTN09C', 'CTN07C', NULL, NULL, NULL),
('A04C', '6'' Ver 1x6 : 3R : WOOD Post - Cedartone', 6, 'WOOD', 3, 'standard', NULL, 'PS13C', 'P604', 'RA01C', NULL, NULL, NULL, NULL, NULL),
('A05C', '6'' Ver 1x6 : 3R : WOOD Post : GN - Cedartone', 6, 'WOOD', 3, 'good-neighbor-builder', NULL, 'PS13C', 'P604', 'RA01C', NULL, NULL, NULL, NULL, NULL),
('A06C', '6'' Ver 1x6 : 3R : WOOD Post : C&T2 - Cedartone', 6, 'WOOD', 3, 'standard', NULL, 'PS13C', 'P604', 'RA01C', 'CTN09C', 'CTN05C', NULL, NULL, NULL),
('A07C', '6'' Ver 1x6 : 3R : WOOD Post : C&T4 - Cedartone', 6, 'WOOD', 3, 'standard', NULL, 'PS13C', 'P604', 'RA01C', 'CTN09C', 'CTN07C', NULL, NULL, NULL),

-- Cedartone (C suffix) - B series
('B01C', '6'' Ver 1x4 : 2R : WOOD Post - Cedartone', 6, 'WOOD', 2, 'standard', NULL, 'PS13C', 'P404', 'RA01C', NULL, NULL, NULL, NULL, NULL),
('B02C', '6'' Ver 1x4 : 2R : WOOD Post : GN - Cedartone', 6, 'WOOD', 2, 'good-neighbor-builder', NULL, 'PS13C', 'P404', 'RA01C', NULL, NULL, NULL, NULL, NULL),
('B03C', '6'' Ver 1x4 : 2R : WOOD Post : C&T - Cedartone', 6, 'WOOD', 2, 'standard', NULL, 'PS13C', 'P404', 'RA01C', 'CTN09C', 'CTN07C', NULL, NULL, NULL),
('B04C', '6'' Ver 1x4 : 3R : WOOD Post - Cedartone', 6, 'WOOD', 3, 'standard', NULL, 'PS13C', 'P404', 'RA01C', NULL, NULL, NULL, NULL, NULL),
('B05C', '6'' Ver 1x4 : 3R : WOOD Post : GN - Cedartone', 6, 'WOOD', 3, 'good-neighbor-builder', NULL, 'PS13C', 'P404', 'RA01C', NULL, NULL, NULL, NULL, NULL),
('B06C', '6'' Ver 1x4 : 3R : WOOD Post : C&T2 - Cedartone', 6, 'WOOD', 3, 'standard', NULL, 'PS13C', 'P404', 'RA01C', 'CTN09C', 'CTN05C', NULL, NULL, NULL),
('B07C', '6'' Ver 1x4 : 3R : WOOD Post : C&T4 - Cedartone', 6, 'WOOD', 3, 'standard', NULL, 'PS13C', 'P404', 'RA01C', 'CTN09C', 'CTN07C', NULL, NULL, NULL),

-- Cedartone (C suffix) - C series
('C01C', '6'' Ver 1x6 : 2R : STEEL Post - Cedartone', 6, 'STEEL', 2, 'standard', NULL, 'PS04', 'P604', 'RA01C', NULL, NULL, NULL, 'PC01', 'HW06'),
('C02C', '6'' Ver 1x6 : 2R : STEEL Post : GN - Cedartone', 6, 'STEEL', 2, 'good-neighbor-builder', NULL, 'PS04', 'P604', 'RA01C', NULL, NULL, NULL, 'PC01', NULL),
('C03C', '6'' Ver 1x6 : 2R : STEEL Post : C&T - Cedartone', 6, 'STEEL', 2, 'standard', NULL, 'PS04', 'P604', 'RA01C', 'CTN09C', 'CTN07C', NULL, 'PC02', 'HW06'),
('C04C', '6'' Ver 1x6 : 3R : STEEL Post - Cedartone', 6, 'STEEL', 3, 'standard', NULL, 'PS04', 'P604', 'RA01C', NULL, NULL, NULL, 'PC01', 'HW06'),
('C05C', '6'' Ver 1x6 : 3R : STEEL Post : GN - Cedartone', 6, 'STEEL', 3, 'good-neighbor-builder', NULL, 'PS04', 'P604', 'RA01C', NULL, NULL, NULL, 'PC01', NULL),
('C06C', '6'' Ver 1x6 : 3R : STEEL Post : C&T2 - Cedartone', 6, 'STEEL', 3, 'standard', NULL, 'PS04', 'P604', 'RA01C', 'CTN09C', 'CTN05C', NULL, 'PC02', 'HW06'),
('C07C', '6'' Ver 1x6 : 3R : STEEL Post : C&T4 - Cedartone', 6, 'STEEL', 3, 'standard', NULL, 'PS04', 'P604', 'RA01C', 'CTN09C', 'CTN07C', NULL, 'PC02', 'HW06'),

-- Cedartone (C suffix) - D series
('D01C', '6'' Ver 1x4 : 2R : STEEL Post - Cedartone', 6, 'STEEL', 2, 'standard', NULL, 'PS04', 'P404', 'RA01C', NULL, NULL, NULL, 'PC01', 'HW06'),
('D02C', '6'' Ver 1x4 : 2R : STEEL Post : GN - Cedartone', 6, 'STEEL', 2, 'good-neighbor-builder', NULL, 'PS04', 'P404', 'RA01C', NULL, NULL, NULL, 'PC01', NULL),
('D03C', '6'' Ver 1x4 : 2R : STEEL Post : C&T - Cedartone', 6, 'STEEL', 2, 'standard', NULL, 'PS04', 'P404', 'RA01C', 'CTN09C', 'CTN07C', NULL, 'PC02', 'HW06'),
('D04C', '6'' Ver 1x4 : 3R : STEEL Post - Cedartone', 6, 'STEEL', 3, 'standard', NULL, 'PS04', 'P404', 'RA01C', NULL, NULL, NULL, 'PC01', 'HW06'),
('D05C', '6'' Ver 1x4 : 3R : STEEL Post : GN - Cedartone', 6, 'STEEL', 3, 'good-neighbor-builder', NULL, 'PS04', 'P404', 'RA01C', NULL, NULL, NULL, 'PC01', NULL),
('D06C', '6'' Ver 1x4 : 3R : STEEL Post : C&T2 - Cedartone', 6, 'STEEL', 3, 'standard', NULL, 'PS04', 'P404', 'RA01C', 'CTN09C', 'CTN05C', NULL, 'PC02', 'HW06'),
('D07C', '6'' Ver 1x4 : 3R : STEEL Post : C&T4 - Cedartone', 6, 'STEEL', 3, 'standard', NULL, 'PS04', 'P404', 'RA01C', 'CTN09C', 'CTN07C', NULL, 'PC02', 'HW06'),

-- Oxford (O suffix) - A series
('A01O', '6'' Ver 1x6 : 2R Tr: WOOD Post - Oxford', 6, 'WOOD', 2, 'standard', NULL, 'PS13O', 'P605', 'RA01O', NULL, NULL, NULL, NULL, NULL),
('A02O', '6'' Ver 1x6 : 2R Tr: WOOD Post : GN - Oxford', 6, 'WOOD', 2, 'good-neighbor-builder', NULL, 'PS13O', 'P605', 'RA01O', NULL, NULL, NULL, NULL, NULL),
('A03O', '6'' Ver 1x6 : 2R Tr: WOOD Post : C&T - Oxford', 6, 'WOOD', 2, 'standard', NULL, 'PS13O', 'P605', 'RA01O', 'CTN09O', 'CTN07O', NULL, NULL, NULL),
('A04O', '6'' Ver 1x6 : 3R Tr: WOOD Post - Oxford', 6, 'WOOD', 3, 'standard', NULL, 'PS13O', 'P605', 'RA01O', NULL, NULL, NULL, NULL, NULL),
('A05O', '6'' Ver 1x6 : 3R Tr: WOOD Post : GN - Oxford', 6, 'WOOD', 3, 'good-neighbor-builder', NULL, 'PS13O', 'P605', 'RA01O', NULL, NULL, NULL, NULL, NULL),
('A06O', '6'' Ver 1x6 : 3R Tr: WOOD Post : C&T2 - Oxford', 6, 'WOOD', 3, 'standard', NULL, 'PS13O', 'P605', 'RA01O', 'CTN09O', 'CTN05O', NULL, NULL, NULL),
('A07O', '6'' Ver 1x6 : 3R Tr: WOOD Post : C&T4 - Oxford', 6, 'WOOD', 3, 'standard', NULL, 'PS13O', 'P605', 'RA01O', 'CTN09O', 'CTN07O', NULL, NULL, NULL),

-- Oxford (O suffix) - B series
('B01O', '6'' Ver 1x4 : 2R Tr: WOOD Post - Oxford', 6, 'WOOD', 2, 'standard', NULL, 'PS13O', 'P405', 'RA01O', NULL, NULL, NULL, NULL, NULL),
('B02O', '6'' Ver 1x4 : 2R Tr: WOOD Post : GN - Oxford', 6, 'WOOD', 2, 'good-neighbor-builder', NULL, 'PS13O', 'P405', 'RA01O', NULL, NULL, NULL, NULL, NULL),
('B03O', '6'' Ver 1x4 : 2R Tr: WOOD Post : C&T - Oxford', 6, 'WOOD', 2, 'standard', NULL, 'PS13O', 'P405', 'RA01O', 'CTN09O', 'CTN07O', NULL, NULL, NULL),
('B04O', '6'' Ver 1x4 : 3R Tr: WOOD Post - Oxford', 6, 'WOOD', 3, 'standard', NULL, 'PS13O', 'P405', 'RA01O', NULL, NULL, NULL, NULL, NULL),
('B05O', '6'' Ver 1x4 : 3R Tr: WOOD Post : GN - Oxford', 6, 'WOOD', 3, 'good-neighbor-builder', NULL, 'PS13O', 'P405', 'RA01O', NULL, NULL, NULL, NULL, NULL),
('B06O', '6'' Ver 1x4 : 3R Tr: WOOD Post : C&T2 - Oxford', 6, 'WOOD', 3, 'standard', NULL, 'PS13O', 'P405', 'RA01O', 'CTN09O', 'CTN05O', NULL, NULL, NULL),
('B07O', '6'' Ver 1x4 : 3R Tr: WOOD Post : C&T4 - Oxford', 6, 'WOOD', 3, 'standard', NULL, 'PS13O', 'P405', 'RA01O', 'CTN09O', 'CTN07O', NULL, NULL, NULL),

-- Oxford (O suffix) - C series
('C01O', '6'' Ver 1x6 : 2R Tr: STEEL Post - Oxford', 6, 'STEEL', 2, 'standard', NULL, 'PS04', 'P605', 'RA01O', NULL, NULL, NULL, 'PC01', 'HW06'),
('C02O', '6'' Ver 1x6 : 2R Tr: STEEL Post : GN - Oxford', 6, 'STEEL', 2, 'good-neighbor-builder', NULL, 'PS04', 'P605', 'RA01O', NULL, NULL, NULL, 'PC01', NULL),
('C03O', '6'' Ver 1x6 : 2R Tr: STEEL Post : C&T - Oxford', 6, 'STEEL', 2, 'standard', NULL, 'PS04', 'P605', 'RA01O', 'CTN09O', 'CTN07O', NULL, 'PC02', 'HW06'),
('C04O', '6'' Ver 1x6 : 3R Tr: STEEL Post - Oxford', 6, 'STEEL', 3, 'standard', NULL, 'PS04', 'P605', 'RA01O', NULL, NULL, NULL, 'PC01', 'HW06'),
('C05O', '6'' Ver 1x6 : 3R Tr: STEEL Post : GN - Oxford', 6, 'STEEL', 3, 'good-neighbor-builder', NULL, 'PS04', 'P605', 'RA01O', NULL, NULL, NULL, 'PC01', NULL),
('C06O', '6'' Ver 1x6 : 3R Tr: STEEL Post : C&T2 - Oxford', 6, 'STEEL', 3, 'standard', NULL, 'PS04', 'P605', 'RA01O', 'CTN09O', 'CTN05O', NULL, 'PC02', 'HW06'),
('C07O', '6'' Ver 1x6 : 3R Tr: STEEL Post : C&T4 - Oxford', 6, 'STEEL', 3, 'standard', NULL, 'PS04', 'P605', 'RA01O', 'CTN09O', 'CTN07O', NULL, 'PC02', 'HW06'),

-- Oxford (O suffix) - D series
('D01O', '6'' Ver 1x4 : 2R Tr: STEEL Post - Oxford', 6, 'STEEL', 2, 'standard', NULL, 'PS04', 'P405', 'RA01O', NULL, NULL, NULL, 'PC01', 'HW06'),
('D02O', '6'' Ver 1x4 : 2R Tr: STEEL Post : GN - Oxford', 6, 'STEEL', 2, 'good-neighbor-builder', NULL, 'PS04', 'P405', 'RA01O', NULL, NULL, NULL, 'PC01', NULL),
('D03O', '6'' Ver 1x4 : 2R Tr: STEEL Post : C&T - Oxford', 6, 'STEEL', 2, 'standard', NULL, 'PS04', 'P405', 'RA01O', 'CTN09O', 'CTN07O', NULL, 'PC02', 'HW06'),
('D04O', '6'' Ver 1x4 : 3R Tr: STEEL Post - Oxford', 6, 'STEEL', 3, 'standard', NULL, 'PS04', 'P405', 'RA01O', NULL, NULL, NULL, 'PC01', 'HW06'),
('D05O', '6'' Ver 1x4 : 3R Tr: STEEL Post : GN - Oxford', 6, 'STEEL', 3, 'good-neighbor-builder', NULL, 'PS04', 'P405', 'RA01O', NULL, NULL, NULL, 'PC01', NULL),
('D06O', '6'' Ver 1x4 : 3R Tr: STEEL Post : C&T2 - Oxford', 6, 'STEEL', 3, 'standard', NULL, 'PS04', 'P405', 'RA01O', 'CTN09O', 'CTN05O', NULL, 'PC02', 'HW06'),
('D07O', '6'' Ver 1x4 : 3R Tr: STEEL Post : C&T4 - Oxford', 6, 'STEEL', 3, 'standard', NULL, 'PS04', 'P405', 'RA01O', 'CTN09O', 'CTN07O', NULL, 'PC02', 'HW06');

-- Insert SKUs into product_skus table (skip existing)
INSERT INTO product_skus (
  sku_code,
  sku_name,
  product_type_id,
  product_style_id,
  height,
  post_type,
  post_spacing,
  config_json,
  is_active
)
SELECT
  t.sku_code,
  t.sku_name,
  pt.id,
  ps.id,
  t.height,
  t.post_type,
  t.post_spacing,
  jsonb_build_object('rail_count', t.rail_count),
  true
FROM temp_sku_import t
JOIN product_types pt ON pt.code = 'wood-vertical'
JOIN product_styles ps ON ps.product_type_id = pt.id AND ps.code = t.style
WHERE t.sku_code IS NOT NULL AND t.sku_code != ''
ON CONFLICT (sku_code) DO NOTHING;

-- Insert component assignments for POST
INSERT INTO sku_components_v2 (sku_id, component_id, material_id)
SELECT
  ps.id,
  cd.id,
  m.id
FROM temp_sku_import t
JOIN product_skus ps ON ps.sku_code = t.sku_code
JOIN component_definitions_v2 cd ON cd.code = 'post'
JOIN materials m ON m.material_sku = t.post_material
WHERE t.post_material IS NOT NULL AND t.post_material != ''
ON CONFLICT (sku_id, component_id) DO NOTHING;

-- Insert component assignments for PICKET
INSERT INTO sku_components_v2 (sku_id, component_id, material_id)
SELECT
  ps.id,
  cd.id,
  m.id
FROM temp_sku_import t
JOIN product_skus ps ON ps.sku_code = t.sku_code
JOIN component_definitions_v2 cd ON cd.code = 'picket'
JOIN materials m ON m.material_sku = t.picket_material
WHERE t.picket_material IS NOT NULL AND t.picket_material != ''
ON CONFLICT (sku_id, component_id) DO NOTHING;

-- Insert component assignments for RAIL
INSERT INTO sku_components_v2 (sku_id, component_id, material_id)
SELECT
  ps.id,
  cd.id,
  m.id
FROM temp_sku_import t
JOIN product_skus ps ON ps.sku_code = t.sku_code
JOIN component_definitions_v2 cd ON cd.code = 'rail'
JOIN materials m ON m.material_sku = t.rail_material
WHERE t.rail_material IS NOT NULL AND t.rail_material != ''
ON CONFLICT (sku_id, component_id) DO NOTHING;

-- Insert component assignments for CAP
INSERT INTO sku_components_v2 (sku_id, component_id, material_id)
SELECT
  ps.id,
  cd.id,
  m.id
FROM temp_sku_import t
JOIN product_skus ps ON ps.sku_code = t.sku_code
JOIN component_definitions_v2 cd ON cd.code = 'cap'
JOIN materials m ON m.material_sku = t.cap_material
WHERE t.cap_material IS NOT NULL AND t.cap_material != ''
ON CONFLICT (sku_id, component_id) DO NOTHING;

-- Insert component assignments for TRIM
INSERT INTO sku_components_v2 (sku_id, component_id, material_id)
SELECT
  ps.id,
  cd.id,
  m.id
FROM temp_sku_import t
JOIN product_skus ps ON ps.sku_code = t.sku_code
JOIN component_definitions_v2 cd ON cd.code = 'trim'
JOIN materials m ON m.material_sku = t.trim_material
WHERE t.trim_material IS NOT NULL AND t.trim_material != ''
ON CONFLICT (sku_id, component_id) DO NOTHING;

-- Insert component assignments for ROT_BOARD
INSERT INTO sku_components_v2 (sku_id, component_id, material_id)
SELECT
  ps.id,
  cd.id,
  m.id
FROM temp_sku_import t
JOIN product_skus ps ON ps.sku_code = t.sku_code
JOIN component_definitions_v2 cd ON cd.code = 'rot-board'
JOIN materials m ON m.material_sku = t.rot_board_material
WHERE t.rot_board_material IS NOT NULL AND t.rot_board_material != ''
ON CONFLICT (sku_id, component_id) DO NOTHING;

-- Insert component assignments for STEEL_POST_CAP
INSERT INTO sku_components_v2 (sku_id, component_id, material_id)
SELECT
  ps.id,
  cd.id,
  m.id
FROM temp_sku_import t
JOIN product_skus ps ON ps.sku_code = t.sku_code
JOIN component_definitions_v2 cd ON cd.code = 'steel-post-cap'
JOIN materials m ON m.material_sku = t.steel_post_cap_material
WHERE t.steel_post_cap_material IS NOT NULL AND t.steel_post_cap_material != ''
ON CONFLICT (sku_id, component_id) DO NOTHING;

-- Insert component assignments for BRACKET
INSERT INTO sku_components_v2 (sku_id, component_id, material_id)
SELECT
  ps.id,
  cd.id,
  m.id
FROM temp_sku_import t
JOIN product_skus ps ON ps.sku_code = t.sku_code
JOIN component_definitions_v2 cd ON cd.code = 'bracket'
JOIN materials m ON m.material_sku = t.bracket_material
WHERE t.bracket_material IS NOT NULL AND t.bracket_material != ''
ON CONFLICT (sku_id, component_id) DO NOTHING;

-- Cleanup
DROP TABLE temp_sku_import;
