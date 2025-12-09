-- ============================================
-- Migration 116: Import Wood Vertical Products (V1 Table)
-- ============================================
-- Imports 112 SKUs into wood_vertical_products table (V1 architecture)
-- Uses ON CONFLICT DO NOTHING to skip existing SKUs

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
  rot_board_material TEXT
);

-- Insert all SKU data
INSERT INTO temp_sku_import VALUES
-- Standard (untreated) - A series (1x6 WOOD)
('A01', '6'' Ver 1x6 : 2R : WOOD Post', 6, 'WOOD', 2, 'standard', NULL, 'PS13', 'P601', 'RA01', NULL, NULL, NULL),
('A02', '6'' Ver 1x6 : 2R : WOOD Post : GN', 6, 'WOOD', 2, 'good-neighbor', NULL, 'PS13', 'P601', 'RA01', NULL, NULL, NULL),
('A03', '6'' Ver 1x6 : 2R : WOOD Post : C&T', 6, 'WOOD', 2, 'cap-and-trim', NULL, 'PS13', 'P601', 'RA01', 'CTN09', 'CTN07', NULL),
('A04', '6'' Ver 1x6 : 3R : WOOD Post', 6, 'WOOD', 3, 'standard', NULL, 'PS13', 'P601', 'RA01', NULL, NULL, NULL),
('A05', '6'' Ver 1x6 : 3R : WOOD Post : GN', 6, 'WOOD', 3, 'good-neighbor', NULL, 'PS13', 'P601', 'RA01', NULL, NULL, NULL),
('A06', '6'' Ver 1x6 : 3R : WOOD Post : C&T2', 6, 'WOOD', 3, 'cap-and-trim', NULL, 'PS13', 'P601', 'RA01', 'CTN09', 'CTN05', NULL),
('A07', '6'' Ver 1x6 : 3R : WOOD Post : C&T4', 6, 'WOOD', 3, 'cap-and-trim', NULL, 'PS13', 'P601', 'RA01', 'CTN09', 'CTN07', NULL),

-- Standard (untreated) - B series (1x4 WOOD)
('B01', '6'' Ver 1x4 : 2R : WOOD Post', 6, 'WOOD', 2, 'standard', NULL, 'PS13', 'P401', 'RA01', NULL, NULL, NULL),
('B02', '6'' Ver 1x4 : 2R : WOOD Post : GN', 6, 'WOOD', 2, 'good-neighbor', NULL, 'PS13', 'P401', 'RA01', NULL, NULL, NULL),
('B03', '6'' Ver 1x4 : 2R : WOOD Post : C&T', 6, 'WOOD', 2, 'cap-and-trim', NULL, 'PS13', 'P401', 'RA01', 'CTN09', 'CTN07', NULL),
('B04', '6'' Ver 1x4 : 3R : WOOD Post', 6, 'WOOD', 3, 'standard', NULL, 'PS13', 'P401', 'RA01', NULL, NULL, NULL),
('B05', '6'' Ver 1x4 : 3R : WOOD Post : GN', 6, 'WOOD', 3, 'good-neighbor', NULL, 'PS13', 'P401', 'RA01', NULL, NULL, NULL),
('B06', '6'' Ver 1x4 : 3R : WOOD Post : C&T2', 6, 'WOOD', 3, 'cap-and-trim', NULL, 'PS13', 'P401', 'RA01', 'CTN09', 'CTN05', NULL),
('B07', '6'' Ver 1x4 : 3R : WOOD Post : C&T4', 6, 'WOOD', 3, 'cap-and-trim', NULL, 'PS13', 'P401', 'RA01', 'CTN09', 'CTN07', NULL),

-- Standard (untreated) - C series (1x6 STEEL)
('C01', '6'' Ver 1x6 : 2R : STEEL Post', 6, 'STEEL', 2, 'standard', NULL, 'PS04', 'P601', 'RA01', NULL, NULL, NULL),
('C02', '6'' Ver 1x6 : 2R : STEEL Post : GN', 6, 'STEEL', 2, 'good-neighbor', NULL, 'PS04', 'P601', 'RA01', NULL, NULL, NULL),
('C03', '6'' Ver 1x6 : 2R : STEEL Post : C&T', 6, 'STEEL', 2, 'cap-and-trim', NULL, 'PS04', 'P601', 'RA01', 'CTN09', 'CTN07', NULL),
('C04', '6'' Ver 1x6 : 3R : STEEL Post', 6, 'STEEL', 3, 'standard', NULL, 'PS04', 'P601', 'RA01', NULL, NULL, NULL),
('C05', '6'' Ver 1x6 : 3R : STEEL Post : GN', 6, 'STEEL', 3, 'good-neighbor', NULL, 'PS04', 'P601', 'RA01', NULL, NULL, NULL),
('C06', '6'' Ver 1x6 : 3R : STEEL Post : C&T2', 6, 'STEEL', 3, 'cap-and-trim', NULL, 'PS04', 'P601', 'RA01', 'CTN09', 'CTN05', NULL),
('C07', '6'' Ver 1x6 : 3R : STEEL Post : C&T4', 6, 'STEEL', 3, 'cap-and-trim', NULL, 'PS04', 'P601', 'RA01', 'CTN09', 'CTN07', NULL),

-- Standard (untreated) - D series (1x4 STEEL)
('D01', '6'' Ver 1x4 : 2R : STEEL Post', 6, 'STEEL', 2, 'standard', NULL, 'PS04', 'P401', 'RA01', NULL, NULL, NULL),
('D02', '6'' Ver 1x4 : 2R : STEEL Post : GN', 6, 'STEEL', 2, 'good-neighbor', NULL, 'PS04', 'P401', 'RA01', NULL, NULL, NULL),
('D03', '6'' Ver 1x4 : 2R : STEEL Post : C&T', 6, 'STEEL', 2, 'cap-and-trim', NULL, 'PS04', 'P401', 'RA01', 'CTN09', 'CTN07', NULL),
('D04', '6'' Ver 1x4 : 3R : STEEL Post', 6, 'STEEL', 3, 'standard', NULL, 'PS04', 'P401', 'RA01', NULL, NULL, NULL),
('D05', '6'' Ver 1x4 : 3R : STEEL Post : GN', 6, 'STEEL', 3, 'good-neighbor', NULL, 'PS04', 'P401', 'RA01', NULL, NULL, NULL),
('D06', '6'' Ver 1x4 : 3R : STEEL Post : C&T2', 6, 'STEEL', 3, 'cap-and-trim', NULL, 'PS04', 'P401', 'RA01', 'CTN09', 'CTN05', NULL),
('D07', '6'' Ver 1x4 : 3R : STEEL Post : C&T4', 6, 'STEEL', 3, 'cap-and-trim', NULL, 'PS04', 'P401', 'RA01', 'CTN09', 'CTN07', NULL),

-- Treated (T suffix) - A series
('A01T', '6'' Ver 1x6 : 2R Tr: WOOD Post', 6, 'WOOD', 2, 'standard', NULL, 'PS13', 'P601', 'RA02', NULL, NULL, NULL),
('A02T', '6'' Ver 1x6 : 2R Tr: WOOD Post : GN', 6, 'WOOD', 2, 'good-neighbor', NULL, 'PS13', 'P601', 'RA02', NULL, NULL, NULL),
('A03T', '6'' Ver 1x6 : 2R Tr: WOOD Post : C&T', 6, 'WOOD', 2, 'cap-and-trim', NULL, 'PS13', 'P601', 'RA02', 'CTN09', 'CTN07', NULL),
('A04T', '6'' Ver 1x6 : 3R Tr: WOOD Post', 6, 'WOOD', 3, 'standard', NULL, 'PS13', 'P601', 'RA02', NULL, NULL, NULL),
('A05T', '6'' Ver 1x6 : 3R Tr: WOOD Post : GN', 6, 'WOOD', 3, 'good-neighbor', NULL, 'PS13', 'P601', 'RA02', NULL, NULL, NULL),
('A06T', '6'' Ver 1x6 : 3R Tr: WOOD Post : C&T2', 6, 'WOOD', 3, 'cap-and-trim', NULL, 'PS13', 'P601', 'RA02', 'CTN09', 'CTN05', NULL),
('A07T', '6'' Ver 1x6 : 3R Tr: WOOD Post : C&T4', 6, 'WOOD', 3, 'cap-and-trim', NULL, 'PS13', 'P601', 'RA02', 'CTN09', 'CTN07', NULL),

-- Treated (T suffix) - B series
('B01T', '6'' Ver 1x4 : 2R Tr: WOOD Post', 6, 'WOOD', 2, 'standard', NULL, 'PS13', 'P401', 'RA02', NULL, NULL, NULL),
('B02T', '6'' Ver 1x4 : 2R Tr: WOOD Post : GN', 6, 'WOOD', 2, 'good-neighbor', NULL, 'PS13', 'P401', 'RA02', NULL, NULL, NULL),
('B03T', '6'' Ver 1x4 : 2R Tr: WOOD Post : C&T', 6, 'WOOD', 2, 'cap-and-trim', NULL, 'PS13', 'P401', 'RA02', 'CTN09', 'CTN07', NULL),
('B04T', '6'' Ver 1x4 : 3R Tr: WOOD Post', 6, 'WOOD', 3, 'standard', NULL, 'PS13', 'P401', 'RA02', NULL, NULL, NULL),
('B05T', '6'' Ver 1x4 : 3R Tr: WOOD Post : GN', 6, 'WOOD', 3, 'good-neighbor', NULL, 'PS13', 'P401', 'RA02', NULL, NULL, NULL),
('B06T', '6'' Ver 1x4 : 3R Tr: WOOD Post : C&T2', 6, 'WOOD', 3, 'cap-and-trim', NULL, 'PS13', 'P401', 'RA02', 'CTN09', 'CTN05', NULL),
('B07T', '6'' Ver 1x4 : 3R Tr: WOOD Post : C&T4', 6, 'WOOD', 3, 'cap-and-trim', NULL, 'PS13', 'P401', 'RA02', 'CTN09', 'CTN07', NULL),

-- Treated (T suffix) - C series
('C01T', '6'' Ver 1x6 : 2R Tr: STEEL Post', 6, 'STEEL', 2, 'standard', NULL, 'PS04', 'P601', 'RA02', NULL, NULL, NULL),
('C02T', '6'' Ver 1x6 : 2R Tr: STEEL Post : GN', 6, 'STEEL', 2, 'good-neighbor', NULL, 'PS04', 'P601', 'RA02', NULL, NULL, NULL),
('C03T', '6'' Ver 1x6 : 2R Tr: STEEL Post : C&T', 6, 'STEEL', 2, 'cap-and-trim', NULL, 'PS04', 'P601', 'RA02', 'CTN09', 'CTN07', NULL),
('C04T', '6'' Ver 1x6 : 3R Tr: STEEL Post', 6, 'STEEL', 3, 'standard', NULL, 'PS04', 'P601', 'RA02', NULL, NULL, NULL),
('C05T', '6'' Ver 1x6 : 3R Tr: STEEL Post : GN', 6, 'STEEL', 3, 'good-neighbor', NULL, 'PS04', 'P601', 'RA02', NULL, NULL, NULL),
('C06T', '6'' Ver 1x6 : 3R Tr: STEEL Post : C&T2', 6, 'STEEL', 3, 'cap-and-trim', NULL, 'PS04', 'P601', 'RA02', 'CTN09', 'CTN05', NULL),
('C07T', '6'' Ver 1x6 : 3R Tr: STEEL Post : C&T4', 6, 'STEEL', 3, 'cap-and-trim', NULL, 'PS04', 'P601', 'RA02', 'CTN09', 'CTN07', NULL),

-- Treated (T suffix) - D series
('D01T', '6'' Ver 1x4 : 2R Tr: STEEL Post', 6, 'STEEL', 2, 'standard', NULL, 'PS04', 'P401', 'RA02', NULL, NULL, NULL),
('D02T', '6'' Ver 1x4 : 2R Tr: STEEL Post : GN', 6, 'STEEL', 2, 'good-neighbor', NULL, 'PS04', 'P401', 'RA02', NULL, NULL, NULL),
('D03T', '6'' Ver 1x4 : 2R Tr: STEEL Post : C&T', 6, 'STEEL', 2, 'cap-and-trim', NULL, 'PS04', 'P401', 'RA02', 'CTN09', 'CTN07', NULL),
('D04T', '6'' Ver 1x4 : 3R Tr: STEEL Post', 6, 'STEEL', 3, 'standard', NULL, 'PS04', 'P401', 'RA02', NULL, NULL, NULL),
('D05T', '6'' Ver 1x4 : 3R Tr: STEEL Post : GN', 6, 'STEEL', 3, 'good-neighbor', NULL, 'PS04', 'P401', 'RA02', NULL, NULL, NULL),
('D06T', '6'' Ver 1x4 : 3R Tr: STEEL Post : C&T2', 6, 'STEEL', 3, 'cap-and-trim', NULL, 'PS04', 'P401', 'RA02', 'CTN09', 'CTN05', NULL),
('D07T', '6'' Ver 1x4 : 3R Tr: STEEL Post : C&T4', 6, 'STEEL', 3, 'cap-and-trim', NULL, 'PS04', 'P401', 'RA02', 'CTN09', 'CTN07', NULL),

-- Cedartone (C suffix) - A series
('A01C', '6'' Ver 1x6 : 2R : WOOD Post - Cedartone', 6, 'WOOD', 2, 'standard', NULL, 'PS13C', 'P604', 'RA01C', NULL, NULL, NULL),
('A02C', '6'' Ver 1x6 : 2R : WOOD Post : GN - Cedartone', 6, 'WOOD', 2, 'good-neighbor', NULL, 'PS13C', 'P604', 'RA01C', NULL, NULL, NULL),
('A03C', '6'' Ver 1x6 : 2R : WOOD Post : C&T - Cedartone', 6, 'WOOD', 2, 'cap-and-trim', NULL, 'PS13C', 'P604', 'RA01C', 'CTN09C', 'CTN07C', NULL),
('A04C', '6'' Ver 1x6 : 3R : WOOD Post - Cedartone', 6, 'WOOD', 3, 'standard', NULL, 'PS13C', 'P604', 'RA01C', NULL, NULL, NULL),
('A05C', '6'' Ver 1x6 : 3R : WOOD Post : GN - Cedartone', 6, 'WOOD', 3, 'good-neighbor', NULL, 'PS13C', 'P604', 'RA01C', NULL, NULL, NULL),
('A06C', '6'' Ver 1x6 : 3R : WOOD Post : C&T2 - Cedartone', 6, 'WOOD', 3, 'cap-and-trim', NULL, 'PS13C', 'P604', 'RA01C', 'CTN09C', 'CTN05C', NULL),
('A07C', '6'' Ver 1x6 : 3R : WOOD Post : C&T4 - Cedartone', 6, 'WOOD', 3, 'cap-and-trim', NULL, 'PS13C', 'P604', 'RA01C', 'CTN09C', 'CTN07C', NULL),

-- Cedartone (C suffix) - B series
('B01C', '6'' Ver 1x4 : 2R : WOOD Post - Cedartone', 6, 'WOOD', 2, 'standard', NULL, 'PS13C', 'P404', 'RA01C', NULL, NULL, NULL),
('B02C', '6'' Ver 1x4 : 2R : WOOD Post : GN - Cedartone', 6, 'WOOD', 2, 'good-neighbor', NULL, 'PS13C', 'P404', 'RA01C', NULL, NULL, NULL),
('B03C', '6'' Ver 1x4 : 2R : WOOD Post : C&T - Cedartone', 6, 'WOOD', 2, 'cap-and-trim', NULL, 'PS13C', 'P404', 'RA01C', 'CTN09C', 'CTN07C', NULL),
('B04C', '6'' Ver 1x4 : 3R : WOOD Post - Cedartone', 6, 'WOOD', 3, 'standard', NULL, 'PS13C', 'P404', 'RA01C', NULL, NULL, NULL),
('B05C', '6'' Ver 1x4 : 3R : WOOD Post : GN - Cedartone', 6, 'WOOD', 3, 'good-neighbor', NULL, 'PS13C', 'P404', 'RA01C', NULL, NULL, NULL),
('B06C', '6'' Ver 1x4 : 3R : WOOD Post : C&T2 - Cedartone', 6, 'WOOD', 3, 'cap-and-trim', NULL, 'PS13C', 'P404', 'RA01C', 'CTN09C', 'CTN05C', NULL),
('B07C', '6'' Ver 1x4 : 3R : WOOD Post : C&T4 - Cedartone', 6, 'WOOD', 3, 'cap-and-trim', NULL, 'PS13C', 'P404', 'RA01C', 'CTN09C', 'CTN07C', NULL),

-- Cedartone (C suffix) - C series
('C01C', '6'' Ver 1x6 : 2R : STEEL Post - Cedartone', 6, 'STEEL', 2, 'standard', NULL, 'PS04', 'P604', 'RA01C', NULL, NULL, NULL),
('C02C', '6'' Ver 1x6 : 2R : STEEL Post : GN - Cedartone', 6, 'STEEL', 2, 'good-neighbor', NULL, 'PS04', 'P604', 'RA01C', NULL, NULL, NULL),
('C03C', '6'' Ver 1x6 : 2R : STEEL Post : C&T - Cedartone', 6, 'STEEL', 2, 'cap-and-trim', NULL, 'PS04', 'P604', 'RA01C', 'CTN09C', 'CTN07C', NULL),
('C04C', '6'' Ver 1x6 : 3R : STEEL Post - Cedartone', 6, 'STEEL', 3, 'standard', NULL, 'PS04', 'P604', 'RA01C', NULL, NULL, NULL),
('C05C', '6'' Ver 1x6 : 3R : STEEL Post : GN - Cedartone', 6, 'STEEL', 3, 'good-neighbor', NULL, 'PS04', 'P604', 'RA01C', NULL, NULL, NULL),
('C06C', '6'' Ver 1x6 : 3R : STEEL Post : C&T2 - Cedartone', 6, 'STEEL', 3, 'cap-and-trim', NULL, 'PS04', 'P604', 'RA01C', 'CTN09C', 'CTN05C', NULL),
('C07C', '6'' Ver 1x6 : 3R : STEEL Post : C&T4 - Cedartone', 6, 'STEEL', 3, 'cap-and-trim', NULL, 'PS04', 'P604', 'RA01C', 'CTN09C', 'CTN07C', NULL),

-- Cedartone (C suffix) - D series
('D01C', '6'' Ver 1x4 : 2R : STEEL Post - Cedartone', 6, 'STEEL', 2, 'standard', NULL, 'PS04', 'P404', 'RA01C', NULL, NULL, NULL),
('D02C', '6'' Ver 1x4 : 2R : STEEL Post : GN - Cedartone', 6, 'STEEL', 2, 'good-neighbor', NULL, 'PS04', 'P404', 'RA01C', NULL, NULL, NULL),
('D03C', '6'' Ver 1x4 : 2R : STEEL Post : C&T - Cedartone', 6, 'STEEL', 2, 'cap-and-trim', NULL, 'PS04', 'P404', 'RA01C', 'CTN09C', 'CTN07C', NULL),
('D04C', '6'' Ver 1x4 : 3R : STEEL Post - Cedartone', 6, 'STEEL', 3, 'standard', NULL, 'PS04', 'P404', 'RA01C', NULL, NULL, NULL),
('D05C', '6'' Ver 1x4 : 3R : STEEL Post : GN - Cedartone', 6, 'STEEL', 3, 'good-neighbor', NULL, 'PS04', 'P404', 'RA01C', NULL, NULL, NULL),
('D06C', '6'' Ver 1x4 : 3R : STEEL Post : C&T2 - Cedartone', 6, 'STEEL', 3, 'cap-and-trim', NULL, 'PS04', 'P404', 'RA01C', 'CTN09C', 'CTN05C', NULL),
('D07C', '6'' Ver 1x4 : 3R : STEEL Post : C&T4 - Cedartone', 6, 'STEEL', 3, 'cap-and-trim', NULL, 'PS04', 'P404', 'RA01C', 'CTN09C', 'CTN07C', NULL),

-- Oxford (O suffix) - A series
('A01O', '6'' Ver 1x6 : 2R Tr: WOOD Post - Oxford', 6, 'WOOD', 2, 'standard', NULL, 'PS13O', 'P605', 'RA01O', NULL, NULL, NULL),
('A02O', '6'' Ver 1x6 : 2R Tr: WOOD Post : GN - Oxford', 6, 'WOOD', 2, 'good-neighbor', NULL, 'PS13O', 'P605', 'RA01O', NULL, NULL, NULL),
('A03O', '6'' Ver 1x6 : 2R Tr: WOOD Post : C&T - Oxford', 6, 'WOOD', 2, 'cap-and-trim', NULL, 'PS13O', 'P605', 'RA01O', 'CTN09O', 'CTN07O', NULL),
('A04O', '6'' Ver 1x6 : 3R Tr: WOOD Post - Oxford', 6, 'WOOD', 3, 'standard', NULL, 'PS13O', 'P605', 'RA01O', NULL, NULL, NULL),
('A05O', '6'' Ver 1x6 : 3R Tr: WOOD Post : GN - Oxford', 6, 'WOOD', 3, 'good-neighbor', NULL, 'PS13O', 'P605', 'RA01O', NULL, NULL, NULL),
('A06O', '6'' Ver 1x6 : 3R Tr: WOOD Post : C&T2 - Oxford', 6, 'WOOD', 3, 'cap-and-trim', NULL, 'PS13O', 'P605', 'RA01O', 'CTN09O', 'CTN05O', NULL),
('A07O', '6'' Ver 1x6 : 3R Tr: WOOD Post : C&T4 - Oxford', 6, 'WOOD', 3, 'cap-and-trim', NULL, 'PS13O', 'P605', 'RA01O', 'CTN09O', 'CTN07O', NULL),

-- Oxford (O suffix) - B series
('B01O', '6'' Ver 1x4 : 2R Tr: WOOD Post - Oxford', 6, 'WOOD', 2, 'standard', NULL, 'PS13O', 'P405', 'RA01O', NULL, NULL, NULL),
('B02O', '6'' Ver 1x4 : 2R Tr: WOOD Post : GN - Oxford', 6, 'WOOD', 2, 'good-neighbor', NULL, 'PS13O', 'P405', 'RA01O', NULL, NULL, NULL),
('B03O', '6'' Ver 1x4 : 2R Tr: WOOD Post : C&T - Oxford', 6, 'WOOD', 2, 'cap-and-trim', NULL, 'PS13O', 'P405', 'RA01O', 'CTN09O', 'CTN07O', NULL),
('B04O', '6'' Ver 1x4 : 3R Tr: WOOD Post - Oxford', 6, 'WOOD', 3, 'standard', NULL, 'PS13O', 'P405', 'RA01O', NULL, NULL, NULL),
('B05O', '6'' Ver 1x4 : 3R Tr: WOOD Post : GN - Oxford', 6, 'WOOD', 3, 'good-neighbor', NULL, 'PS13O', 'P405', 'RA01O', NULL, NULL, NULL),
('B06O', '6'' Ver 1x4 : 3R Tr: WOOD Post : C&T2 - Oxford', 6, 'WOOD', 3, 'cap-and-trim', NULL, 'PS13O', 'P405', 'RA01O', 'CTN09O', 'CTN05O', NULL),
('B07O', '6'' Ver 1x4 : 3R Tr: WOOD Post : C&T4 - Oxford', 6, 'WOOD', 3, 'cap-and-trim', NULL, 'PS13O', 'P405', 'RA01O', 'CTN09O', 'CTN07O', NULL),

-- Oxford (O suffix) - C series
('C01O', '6'' Ver 1x6 : 2R Tr: STEEL Post - Oxford', 6, 'STEEL', 2, 'standard', NULL, 'PS04', 'P605', 'RA01O', NULL, NULL, NULL),
('C02O', '6'' Ver 1x6 : 2R Tr: STEEL Post : GN - Oxford', 6, 'STEEL', 2, 'good-neighbor', NULL, 'PS04', 'P605', 'RA01O', NULL, NULL, NULL),
('C03O', '6'' Ver 1x6 : 2R Tr: STEEL Post : C&T - Oxford', 6, 'STEEL', 2, 'cap-and-trim', NULL, 'PS04', 'P605', 'RA01O', 'CTN09O', 'CTN07O', NULL),
('C04O', '6'' Ver 1x6 : 3R Tr: STEEL Post - Oxford', 6, 'STEEL', 3, 'standard', NULL, 'PS04', 'P605', 'RA01O', NULL, NULL, NULL),
('C05O', '6'' Ver 1x6 : 3R Tr: STEEL Post : GN - Oxford', 6, 'STEEL', 3, 'good-neighbor', NULL, 'PS04', 'P605', 'RA01O', NULL, NULL, NULL),
('C06O', '6'' Ver 1x6 : 3R Tr: STEEL Post : C&T2 - Oxford', 6, 'STEEL', 3, 'cap-and-trim', NULL, 'PS04', 'P605', 'RA01O', 'CTN09O', 'CTN05O', NULL),
('C07O', '6'' Ver 1x6 : 3R Tr: STEEL Post : C&T4 - Oxford', 6, 'STEEL', 3, 'cap-and-trim', NULL, 'PS04', 'P605', 'RA01O', 'CTN09O', 'CTN07O', NULL),

-- Oxford (O suffix) - D series
('D01O', '6'' Ver 1x4 : 2R Tr: STEEL Post - Oxford', 6, 'STEEL', 2, 'standard', NULL, 'PS04', 'P405', 'RA01O', NULL, NULL, NULL),
('D02O', '6'' Ver 1x4 : 2R Tr: STEEL Post : GN - Oxford', 6, 'STEEL', 2, 'good-neighbor', NULL, 'PS04', 'P405', 'RA01O', NULL, NULL, NULL),
('D03O', '6'' Ver 1x4 : 2R Tr: STEEL Post : C&T - Oxford', 6, 'STEEL', 2, 'cap-and-trim', NULL, 'PS04', 'P405', 'RA01O', 'CTN09O', 'CTN07O', NULL),
('D04O', '6'' Ver 1x4 : 3R Tr: STEEL Post - Oxford', 6, 'STEEL', 3, 'standard', NULL, 'PS04', 'P405', 'RA01O', NULL, NULL, NULL),
('D05O', '6'' Ver 1x4 : 3R Tr: STEEL Post : GN - Oxford', 6, 'STEEL', 3, 'good-neighbor', NULL, 'PS04', 'P405', 'RA01O', NULL, NULL, NULL),
('D06O', '6'' Ver 1x4 : 3R Tr: STEEL Post : C&T2 - Oxford', 6, 'STEEL', 3, 'cap-and-trim', NULL, 'PS04', 'P405', 'RA01O', 'CTN09O', 'CTN05O', NULL),
('D07O', '6'' Ver 1x4 : 3R Tr: STEEL Post : C&T4 - Oxford', 6, 'STEEL', 3, 'cap-and-trim', NULL, 'PS04', 'P405', 'RA01O', 'CTN09O', 'CTN07O', NULL);

-- Insert SKUs into wood_vertical_products table (skip existing)
INSERT INTO wood_vertical_products (
  sku_code,
  sku_name,
  height,
  rail_count,
  post_type,
  style,
  post_spacing,
  post_material_id,
  picket_material_id,
  rail_material_id,
  cap_material_id,
  trim_material_id,
  rot_board_material_id,
  is_active
)
SELECT
  t.sku_code,
  t.sku_name,
  t.height,
  t.rail_count,
  t.post_type,
  t.style,
  COALESCE(t.post_spacing, 8.0),
  pm.id,
  pk.id,
  rm.id,
  cm.id,
  tm.id,
  rb.id,
  true
FROM temp_sku_import t
JOIN materials pm ON pm.material_sku = t.post_material
JOIN materials pk ON pk.material_sku = t.picket_material
JOIN materials rm ON rm.material_sku = t.rail_material
LEFT JOIN materials cm ON cm.material_sku = t.cap_material
LEFT JOIN materials tm ON tm.material_sku = t.trim_material
LEFT JOIN materials rb ON rb.material_sku = t.rot_board_material
WHERE t.sku_code IS NOT NULL AND t.sku_code != ''
ON CONFLICT (sku_code) DO NOTHING;

-- Cleanup
DROP TABLE temp_sku_import;
