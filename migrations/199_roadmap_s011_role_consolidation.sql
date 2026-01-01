-- Migration 199: Add S-011 roadmap item for role consolidation
-- This is a future planning item, not immediate work

INSERT INTO roadmap_items (code, hub, title, raw_idea, status, complexity)
VALUES (
  'S-011',
  'settings',
  'User Role Architecture Consolidation',
  'Consolidate the overlapping role systems into a unified architecture:

CURRENT STATE:
- user_profiles.role: Admin, Manager, Sales, Operations, Accounting, Viewer
- fsm_team_profiles.fsm_roles[]: rep, project_manager, crew_lead, dispatcher, etc.
- Overlapping concepts: "Sales" role vs "rep" FSM role

TARGET STATE OPTIONS:
1. Merge into single role system with hierarchical permissions
2. Keep app roles + FSM roles but with clear boundaries
3. Implement role inheritance (Sales automatically gets rep capabilities)

CONSIDERATIONS:
- Migration path for existing users
- Permission matrix needs redesign
- RLS policies may need updates
- Impact on team management UI

DEPENDENCIES:
- Phase 2 (hooks using user_profiles) must be done first
- Requires full audit of permission checks',
  'idea',
  'XL'
)
ON CONFLICT (code) DO NOTHING;
