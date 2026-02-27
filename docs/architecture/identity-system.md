# User Identity System

> Last updated: 2026-02-26 (Phases 1-8 of Identity Consolidation)

## Overview

A single person is consistently identified through 3 independent layers. Changing one layer doesn't affect the others.

## The 3 Layers

### Layer 1 — Access Level (`user_roles.role_key`)

Controls what a user can see and do in the app.

| AppRole | Display Name | Typical Use |
|---------|-------------|-------------|
| `owner` | Owner | Full access, business owner |
| `admin` | Admin | Full access, manages settings/team |
| `sales_manager` | Sales Manager | Manages sales team, views analytics |
| `sales_rep` | Sales Rep | Handles requests, quotes, basic views |
| `front_desk` | Front Desk | Handles requests, limited admin |
| `ops_manager` | Ops Manager | Manages operations and scheduling |
| `operations` | Operations | Day-to-day ops work |
| `yard` | Yard | Yard operations, material staging |
| `crew` | Crew | Field crew, minimal app access |

**Where it's used:**
- `role_permissions` — which actions each role can perform (22 permissions)
- `role_section_access` — which app sections each role can see (24 sections)
- `menu_visibility.visible_for_roles[]` — which menu items each role sees
- `user_permission_overrides` — per-user additive permission grants

**How to change someone's access:**
Update `user_roles.role_key`. A dual-write trigger (`sync_user_role_to_profile`) also syncs to `user_profiles.role` for backward compatibility.

**Key functions (database):**
- `is_current_user_admin()` — used by RLS policies, checks permission system first then legacy fallback
- `user_has_permission(user_id, permission_key)` — checks role_permissions + overrides

**Key hook (frontend):**
```tsx
const { role, hasPermission, hasSection, isSuperAdmin } = usePermission();
// hasPermission('manage_settings') — check a specific permission
// hasSection('analytics') — check section access
// role — the AppRole string
```

### Layer 2 — Operational Identity (`fsm_team_profiles`)

Controls what a person does on the team — their job function, not their access level.

| Field | Purpose |
|-------|---------|
| `fsm_roles[]` | Job functions: `rep`, `project_manager`, `crew_lead`, `dispatcher`, etc. |
| `jobber_salesperson_names[]` | Linked Jobber salesperson names (array for multi-account) |
| `assigned_qbo_class_ids[]` | Which QBO classes/business units they handle |
| `fsm_territory_coverage` | Territory assignments by day of week |
| `fsm_work_schedule` | Weekly availability |
| `fsm_person_skills` | Skills with proficiency levels |

**Where it's used:**
- Rep dropdowns (requests, quotes, jobs) query `fsm_roles @> ['rep']`
- Analytics filtering uses `jobber_salesperson_names`
- Territory-based auto-assignment uses `fsm_territory_coverage`
- Crew scheduling uses `fsm_work_schedule`

**How to change someone's job function:**
Update `fsm_team_profiles` via Settings > Team Management.

### Layer 3 — Profile Data (`user_profiles`)

Basic identity info. Not used for access decisions.

| Field | Purpose |
|-------|---------|
| `full_name` | Display name |
| `email` | Contact email |
| `phone` | Contact phone |
| `avatar_url` | Profile picture |
| `role` | **DEPRECATED** — kept for backward compat via dual-write trigger |
| `is_super_admin` | Emergency override flag |
| `approval_status` | `pending` / `approved` / `rejected` |

## Before vs After (History)

Before consolidation (pre Feb 2026), identity was scattered across 5 overlapping sources:

1. `user_profiles.role` (legacy string) — drove menus and inline access checks
2. `user_roles.role_key` (AppRole) — drove permission system but was underused
3. `fsm_team_profiles.fsm_roles[]` — drove operational assignments
4. `user_salesperson_mapping` — bridged users to Jobber analytics
5. `sales_reps` table — deprecated but still queried

These often disagreed about "who is this person," causing bugs when one was updated but not the others.

## Common Tasks

### Add a new user
1. User signs up (creates `auth.users` + `user_profiles` with `approval_status='pending'`)
2. Admin approves via Team Management (creates `user_roles` entry, sets `approval_status='approved'`)
3. Optionally create `fsm_team_profiles` entry for operational assignments

### Change someone's access level
Update via Team Management role dropdown. This writes to `user_roles.role_key` and the trigger syncs to `user_profiles.role`.

### Change someone's job function
Edit their FSM Team Profile (Settings > Team Management > edit). Change `fsm_roles`, territory, QBO classes, etc.

### Link someone to Jobber
Edit their FSM Team Profile and add their Jobber salesperson name(s) to `jobber_salesperson_names[]`.

## Key Files

| File | Purpose |
|------|---------|
| `src/lib/permissions/types.ts` | AppRole type, Permission keys, Section keys |
| `src/lib/permissions/defaults.ts` | Default permissions/sections per role |
| `src/contexts/PermissionContext.tsx` | React context providing `usePermission()` |
| `src/hooks/useMenuVisibility.ts` | Menu visibility checks (role + platform + user overrides) |
| `src/features/settings/components/TeamManagement.tsx` | Admin UI for managing users and roles |
| `src/features/fsm/hooks/useFsmTeamProfiles.ts` | FSM team profile CRUD |
| `migrations/230_role_permission_system.sql` | Permission system tables + RLS |
| `migrations/279_remove_legacy_role_fallback.sql` | Legacy fallback removal + backfill |
