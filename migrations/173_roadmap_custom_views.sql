-- Add roadmap item for Custom Saved Views in Message Center
INSERT INTO roadmap_items (code, hub, title, raw_idea, status)
VALUES (
  'C-006',
  'chat',
  'Custom Saved Views in Message Center',
  'Allow users to create and save custom filtered views in the Message Center sidebar. For example: "My Builders", "HOA Contacts", "Pending Responses". Each saved view would remember filter criteria (business unit, location, tags, etc.) and appear as a quick-access item in the sidebar.',
  'idea'
) ON CONFLICT (code) DO UPDATE SET
  title = EXCLUDED.title,
  raw_idea = EXCLUDED.raw_idea;
