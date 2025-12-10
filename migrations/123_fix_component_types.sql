-- ============================================
-- FIX: Restore component_types_v2 data
-- Migration 122 accidentally deleted all component types
-- ============================================

-- Re-insert all component types (original 18 + new ones)
INSERT INTO component_types_v2 (code, name, description, unit_type, display_order) VALUES
  ('post', 'Post', 'Vertical support structure', 'Each', 1),
  ('picket', 'Picket', 'Vertical boards for wood vertical fences', 'Each', 2),
  ('rail', 'Rail', 'Horizontal support boards', 'Each', 3),
  ('cap', 'Cap Board', 'Horizontal board along top of fence', 'Each', 4),
  ('trim', 'Trim Board', 'Vertical trim boards on posts', 'Each', 5),
  ('rot_board', 'Rot Board', 'Bottom board protecting from moisture', 'Each', 6),
  ('steel_post_cap', 'Steel Post Cap', 'Cap for steel posts', 'Each', 7),
  ('bracket', 'Rail Bracket', 'Metal bracket for steel posts', 'Each', 8),
  ('nails_picket', 'Picket Nails', 'Nails for attaching pickets', 'Coil', 9),
  ('nails_framing', 'Framing Nails', 'Nails for rails and structure', 'Box', 10),
  ('board', 'Horizontal Board', 'Horizontal boards for horizontal fences', 'Each', 11),
  ('nailer', 'Nailer', 'Support for horizontal boards', 'Each', 12),
  ('vertical_trim', 'Vertical Trim', 'Trim for horizontal fences', 'Each', 13),
  ('panel', 'Iron Panel', 'Pre-fabricated iron fence panel', 'Each', 14),
  ('iron_post_cap', 'Iron Post Cap', 'Decorative cap for iron posts', 'Each', 15),
  ('concrete_sand', 'Concrete Sand', '3-part concrete sand', 'Yard', 16),
  ('concrete_portland', 'Portland Cement', '3-part portland cement', 'Bag', 17),
  ('concrete_quickrock', 'QuickRock', '3-part quickrock', 'Bag', 18),
  ('lag_screws', 'Lag Screws', 'Lag screws for steel post brackets', 'Box', 19),
  ('self_tapping_screws', 'Self Tapping Screws', 'Self tapping screws for steel posts', 'Box', 20),
  ('concrete', 'Concrete', 'System calculated concrete', 'System', 21)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  unit_type = EXCLUDED.unit_type,
  display_order = EXCLUDED.display_order,
  is_active = true;
