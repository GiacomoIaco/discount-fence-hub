# Project Standards for Claude Code

## Session Setup

### Chrome MCP (Browser Testing)
The Chrome DevTools MCP allows automated browser testing. If it fails to connect:
1. Kill any existing Chrome processes: `powershell -Command "Get-Process chrome -ErrorAction SilentlyContinue | Stop-Process -Force"`
2. Clear stale lock files: `powershell -Command "Remove-Item -Path 'C:\Users\giaco\.cache\chrome-devtools-mcp\chrome-profile\Singleton*' -ErrorAction SilentlyContinue"`
3. Use the MCP tools directly (e.g., `mcp__chrome-devtools__new_page`) - it will launch Chrome automatically

**Common failure**: Stale lock files from a previous session or Chrome already running.

### Supabase Migrations
Migrations use the service key from `.env` (not CLI auth). Commands:
- `npm run migrate:status` - Check which migrations are applied
- `npm run migrate:apply <name>` - Apply a specific migration (e.g., `npm run migrate:apply 144_fsm_core_tables`)
- `npm run migrate:direct <file.sql>` - Run SQL file directly via `exec_sql` RPC

**Common failure**: Running from wrong directory (`.env` not found).

---

## Deployment

- **Git pushes to `main` trigger automatic Netlify deployments**
- After committing changes, push to `origin/main` to deploy
- Netlify URL: https://discount-fence-hub.netlify.app/

## Development

- React + TypeScript + Vite
- TanStack Query (React Query) for data fetching
- Tailwind CSS for styling
- Supabase for backend database

## Testing Changes

- After pushing, verify changes on the live Netlify URL
- Use Chrome DevTools MCP for browser testing (see Session Setup above)

---

## Roadmap System

The project uses a database-backed roadmap (`roadmap_items` table) with hub-prefixed codes:
- **O-XXX**: Ops Hub (Calculator, Yard)
- **R-XXX**: Requests
- **C-XXX**: Chat/Communication
- **A-XXX**: Analytics
- **S-XXX**: Settings/Admin
- **G-XXX**: General/App-wide
- **L-XXX**: Leadership Hub

### Working with Roadmap Items

**When user mentions a roadmap code** (e.g., "let's work on O-012"):
- Reference codes in commit messages: `feat: yard improvements (O-012)`
- After completing work, update item status to 'done'

**Reading items** - Use Supabase dashboard or create a migration to query:
```sql
SELECT code, title, status, raw_idea, claude_analysis
FROM roadmap_items WHERE code = 'O-012';
```

**Updating items** - Use `npm run migrate:direct` with an UPDATE statement, or update via the app's Roadmap UI.

### Expanding Ideas

When user asks to expand on an idea (e.g., "expand on S-001"):
1. Read the raw_idea field
2. Research best practices
3. Update claude_analysis with detailed thoughts
4. Consider related items and link them

---

## FSM (Field Service Management) System

The FSM is the core business logic managing the service lifecycle. **All FSM code is centralized in `/src/features/fsm/`**.

### Directory Structure

```
src/features/fsm/
├── components/    # UI components (editors, lists, modals)
├── hooks/         # React Query hooks (useRequests, useQuotes, useJobs, etc.)
├── pages/         # Page components (RequestsHub, QuotesHub, JobsHub, etc.)
├── types.ts       # ALL FSM types, statuses, transitions (1200+ lines)
└── utils/         # Helper functions
```

**Related features that import from FSM:**
- `/src/features/projects_hub/` - Wrapper providing sidebar navigation
- `/src/features/schedule/` - Schedule entries linked to Jobs
- `/src/features/client_hub/` - Clients/Properties referenced by FSM entities

### Core Lifecycle

```
REQUEST ──────► QUOTE ──────► JOB ──────► INVOICE ──────► PAYMENT
(Lead/Ask)    (Estimate)   (Scheduled)  (Billing)      (Collected)
```

**Key principle**: Status is COMPUTED from data, not manually set (migration 194).

### Status Automation (Database Triggers)

Statuses are derived from timestamps and foreign keys. To change status, update the underlying data:

| To Get This Status | Set This Data |
|-------------------|---------------|
| `assessment_scheduled` | `assessment_scheduled_at = [date]` |
| `assessment_completed` | `assessment_completed_at = [date]` |
| `converted` (request) | Create Quote with `request_id` |
| `converted` (quote) | Create Job with `quote_id` |
| `scheduled` (job) | Set `scheduled_date` AND `assigned_crew_id` |
| `requires_invoicing` | Create Invoice with `job_id` |
| `paid` (invoice) | Record Payment (triggers recalc) |

**Never manually set `status` field** - let the triggers compute it.

### Lifecycle Cascade Triggers

When you create a child entity, the parent auto-updates:

```
Insert Quote with request_id  →  Request.converted_to_quote_id = quote.id
                              →  Request.status = 'converted' (computed)

Insert Job with quote_id      →  Quote.converted_to_job_id = job.id
                              →  Quote.status = 'converted' (computed)

Insert Invoice with job_id    →  Job.invoice_id, Job.invoiced_at set
                              →  Job.status = 'requires_invoicing' (computed)
```

### Key Hooks

| Hook | File | Purpose |
|------|------|---------|
| `useRequests` | useRequests.ts | CRUD + convert to Quote/Job |
| `useQuotes` | useQuotes.ts | CRUD + convert to Job |
| `useJobs` | useJobs.ts | CRUD + create Invoice |
| `useInvoices` | useInvoices.ts | CRUD + payments |
| `useConvertQuoteToProject` | useQuoteToProject.ts | Multi-job conversion |
| `useTerritories` | useTerritories.ts | Territory lookup |
| `useCrews` | useCrews.ts | Crew management |
| `useFsmTeamProfiles` | useFsmTeamProfiles.ts | Person-centric team |

### Types Quick Reference

**Status types** (in `types.ts`):
- `RequestStatus`: pending → assessment_scheduled → assessment_completed → converted
- `QuoteStatus`: draft → pending_approval → sent → approved → converted
- `JobStatus`: won → scheduled → ready_for_yard → picking → staged → loaded → in_progress → completed
- `InvoiceStatus`: draft → sent → past_due → paid

**Transition maps**: `REQUEST_TRANSITIONS`, `QUOTE_TRANSITIONS`, `JOB_TRANSITIONS`, `INVOICE_TRANSITIONS`

### Team Management (Person-Centric)

Team members are in `fsm_team_profiles` (not legacy `sales_reps`):

```
fsm_team_profiles
├── user_id (FK to auth.users)
├── assigned_qbo_class_ids[]   # Which QBO classes they handle
├── fsm_roles[]                # rep, project_manager, crew_lead, etc.
├── fsm_territory_coverage     # Territory assignments by day
├── fsm_work_schedule          # Weekly availability
└── fsm_person_skills          # Skills with proficiency levels
```

**Access via**: Settings → Team Management

### BU vs QBO Class

| Concept | Table | Purpose | Examples |
|---------|-------|---------|----------|
| Location | `locations` | Geographic market | ATX, SA, HOU |
| QBO Class | `qbo_classes` | Accounting category | ATX-RES, ATX-HB, COM |
| BU Type | `qbo_classes.bu_type` | Business segment | residential, builders, commercial |

Entities reference `location_code` (where) and `qbo_class_id` (accounting).

### Quick Debugging

| Problem | Check |
|---------|-------|
| Status not updating | Is the data field set? (triggers compute from data) |
| Conversion not working | Check `fsm_status_history` for trigger activity |
| Territory not matching | Check `find_territories_by_zip` RPC |
| Team member missing | Check `fsm_team_profiles.is_active` |
| Request not showing | Check filters in `useRequests.ts` |

### Daily Maintenance

Call `refresh_time_based_statuses()` via cron at midnight to update:
- `assessment_today` → `assessment_overdue`
- `sent` → `follow_up` (quotes after 3 days)
- `sent` → `past_due` (invoices after due date)
