# Project Standards for Claude Code

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Frontend | React + TypeScript | React 19, TS 5.9 |
| Build | Vite | 7.x |
| Styling | Tailwind CSS | 3.4 |
| Data Fetching | TanStack Query (React Query) | 5.x |
| Routing | React Router | 7.x |
| Database | Supabase (PostgreSQL) | SDK 2.58 |
| Hosting | Netlify (SPA + Functions) | - |
| Serverless | Netlify Functions (esbuild) | Node 20 |
| Validation | Zod | 4.x |
| Charts | Recharts | 3.x |
| Calendar | FullCalendar | 6.x |
| Maps | Leaflet + react-leaflet | 1.9 |
| PDF | jsPDF + autotable | - |
| Drag & Drop | dnd-kit | - |
| AI | Anthropic SDK, OpenAI SDK, AssemblyAI | - |
| Email | SendGrid | - |
| Integrations | QuickBooks Online, Jobber | OAuth |

---

## Codebase Architecture

### Directory Structure

```
/
├── src/                     # React application source
│   ├── App.tsx              # Main app component (navigation, role switching)
│   ├── AppRoutes.tsx        # Route config for public pages
│   ├── main.tsx             # Entry point (React Query, Router, Auth providers)
│   ├── sw.ts                # Service worker (PWA)
│   ├── components/          # Shared UI components
│   │   ├── auth/            # Login, OnboardingWizard
│   │   ├── common/          # SmartLookup
│   │   ├── shared/          # VoiceInput
│   │   ├── sidebar/         # Navigation sidebar
│   │   ├── skeletons/       # Loading skeletons
│   │   └── views/           # Dashboard, SalesRepView
│   ├── contexts/            # React Context providers
│   │   ├── AuthContext.tsx
│   │   ├── PermissionContext.tsx
│   │   └── ToastContext.tsx
│   ├── features/            # Feature modules (see below)
│   ├── hooks/               # Global hooks
│   ├── layouts/             # Sidebar, MobileHeader, MobileBottomNav
│   ├── lib/                 # Utility libraries
│   │   ├── routes.ts        # Route config (Section → URL mapping)
│   │   ├── queryClient.ts   # TanStack Query setup with persistence
│   │   ├── supabase.ts      # Supabase client init
│   │   ├── validation.ts    # Zod schemas (1700+ lines)
│   │   ├── claude.ts        # Anthropic integration
│   │   ├── openai.ts        # OpenAI integration
│   │   ├── offlineQueue.ts  # Offline request queuing
│   │   └── permissions/     # Role-based permission helpers
│   └── types/               # Shared type definitions
├── migrations/              # SQL migration files (~345 files)
├── netlify/functions/       # Serverless functions (40+ files)
├── scripts/                 # Dev/admin utility scripts (120+)
├── docs/                    # Project documentation
├── public/                  # Static assets (logos, legal pages, PWA manifest)
└── supabase/functions/      # Supabase edge functions (morning-digest)
```

### Feature Modules (`src/features/`)

Each feature is self-contained with its own components, hooks, pages, and types.

**Core FSM (Field Service Management):**
- `fsm/` - Request → Quote → Job → Invoice pipeline (see FSM section below)
- `projects_hub/` - Project dashboard and sidebar navigation wrapper
- `schedule/` - Calendar/scheduling (FullCalendar integration)
- `client_hub/` - Client and property management
- `settings/` - Admin settings, team management, territories

**Operations:**
- `bom_calculator/` - Bill of Materials calculator (v1)
- `bom_calculator_v2/` - BOM calculator with FormulaInterpreter engine
- `sales_hub/` - Sales operations hub

**Sales & Marketing:**
- `sales-tools/` - StainCalculator, ClientPresentation
- `sales-resources/` - Document/file library
- `ai-coach/` - AI sales coaching with recording analysis

**Communication:**
- `communication/` - Team announcements and messaging
- `message-center/` - Unified messaging hub (conversations, announcements, notifications, real-time)
- `requests/` - Internal ticket/request system

**Content & Analytics:**
- `photos/` - Photo gallery with AI tagging
- `analytics/` - Dashboards (Jobber, residential API)
- `leadership/` - Goals, operating plans, strategy, KPIs
- `roadmap/` - Roadmap management UI
- `survey_hub/` - Survey distribution and management
- `my-todos/` - Personal to-do list

**Other:**
- `user-profile/` - User profile management
- `shared/` - Shared utilities, hooks, types
- `FEATURE_TEMPLATE/` - Template for new features

### Provider Hierarchy (main.tsx)

```
StrictMode → BrowserRouter → QueryClientProvider → AuthProvider → PermissionProvider → AppRoutes
```

### Key Architectural Patterns

1. **Feature-based organization** - Each feature is a self-contained module
2. **Custom hooks for data** - React Query hooks separated from UI components
3. **Database-driven status** - FSM statuses computed by Postgres triggers, not manually set
4. **Role-based access** - Menu visibility and permissions controlled via PermissionContext
5. **Lazy loading** - Features are code-split in App.tsx
6. **PWA** - Service worker with offline support and push notifications
7. **Serverless backend** - Netlify Functions for AI, integrations, email

---

## Development

### Commands

```bash
npm run dev          # Start Vite dev server (localhost:5173)
npm run build        # TypeScript check + Vite build (tsc -b && vite build)
npm run lint         # Run ESLint
npm run preview      # Preview production build
```

### Build Requirements

- The `build` command runs `tsc -b` first - **all TypeScript errors must be resolved**
- Strict mode is enabled: no unused locals, no unused parameters, no fallthrough cases
- Target: ES2022, module resolution: bundler

### Environment Variables

Client-side variables use `VITE_` prefix (embedded in bundle):
- `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
- `VITE_NETLIFY_FUNCTIONS_URL`, `VITE_VAPID_PUBLIC_KEY`

Server-side secrets (Netlify Functions only):
- `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `ASSEMBLYAI_API_KEY`, `GOOGLE_API_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`, `SENDGRID_API_KEY`
- QBO and Jobber OAuth credentials

See `.env.example` for the full list. **Never commit `.env` files.**

### Testing

No unit test framework is configured. Testing is done via:
- Chrome DevTools MCP for automated browser testing
- Manual verification on the live Netlify URL after deployment

---

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

#### Migration Tracking Best Practices

**CRITICAL**: After running any migration via `migrate:direct`, you MUST update the tracking table to mark it as applied. Otherwise `migrate:status` will show it as "Pending" even though it ran.

**To mark a migration as applied** after running it manually:
```sql
INSERT INTO schema_migrations (version, name, applied_by, execution_time_ms)
VALUES ('NNN', 'migration_name', 'manual', 0)
ON CONFLICT (version) DO NOTHING;
```

**Naming conventions**:
- Standard: `NNN_description.sql` (e.g., `272_new_feature.sql`)
- Sub-migrations: `NNNx_description.sql` (e.g., `272b_fix.sql`) - These are NOT tracked by the system
- Always use the next available number (check `npm run migrate:status` first)
- Latest migration as of writing: `271_fix_api_metrics_formulas.sql`

**Avoid duplicate versions**: Never create two files with the same 3-digit version number. The tracking system uses version as a unique key.

**Workflow for new migrations**:
1. Run `npm run migrate:status` to find the next available number
2. Create `migrations/NNN_description.sql`
3. Run `npm run migrate:direct NNN_description.sql`
4. Verify with `npm run migrate:status` - should show as Applied
   - If it shows Pending, manually insert the tracking record (see above)

---

## Deployment

- **Git pushes to `main` trigger automatic Netlify deployments**
- After committing changes, push to `origin/main` to deploy
- Netlify URL: https://discount-fence-hub.netlify.app/
- Build: `npm run build` → output in `dist/`
- Node 20 runtime

### Netlify Function Timeouts

| Function Category | Timeout |
|-------------------|---------|
| Standard functions | 10s (default) |
| AI functions (transcribe, analyze, ai-product-assistant) | 26s |
| QBO functions (validate, import, search) | 60s |
| Jobber sync functions | 300s |
| Background jobs (jobber-sync-background) | 900s (15 min) |

### Redirects

- `/qr/*` → `qr.html` (QR code claim pages)
- `/privacy`, `/terms` → static legal pages
- `/*` → `index.html` (SPA catch-all)

### Public Routes (no auth)

- `/p/:projectCode` - Deep link for QR code scanning
- `/client-quote/:token` - Public quote viewing
- `/survey` - Public survey page

---

## Route Structure

Routes are defined in `src/lib/routes.ts` as `Section → URL path` mappings:

| Section | URL Path | Feature |
|---------|----------|---------|
| home | `/` | Dashboard |
| dashboard | `/dashboard` | Dashboard |
| schedule | `/schedule` | Calendar |
| client-hub | `/clients` | Client management |
| projects-hub | `/projects` | Projects dashboard |
| sales-hub | `/sales` | Sales operations |
| bom-calculator | `/ops` | BOM Calculator v1 |
| bom-calculator-v2 | `/ops/v2` | BOM Calculator v2 |
| yard | `/ops/yard` | Yard operations |
| requests | `/requests` | FSM service requests |
| quotes | `/quotes` | FSM quotes |
| jobs | `/jobs` | FSM jobs |
| invoices | `/invoices` | FSM invoices |
| tickets | `/tickets` | Internal ticketing |
| message-center | `/messages` | Unified messaging |
| leadership | `/leadership` | Leadership dashboards |
| analytics | `/analytics` | Analytics |
| roadmap | `/roadmap` | Roadmap management |
| team | `/settings` | Team management |
| territories | `/settings/territories` | Territory management |
| sales-coach | `/sales/coach` | AI sales coaching |
| photo-gallery | `/sales/photos` | Photo gallery |

---

## Netlify Functions (`netlify/functions/`)

**AI & Analysis:** ai-formula-assistant, ai-product-assistant, analyze-photo, analyze-recording, enhance-photo, expand-roadmap-idea, parse-knowledge-base, parse-operating-plan

**Voice & Transcription:** transcribe-recording, check-transcription, classify-voice-intent, start-transcription, upload-recording, match-talking-points

**Integrations:** qbo-auth, jobber-auth, jobber-callback, jobber-status, jobber-sync-background, jobber-sync-manual, jobber-sync-residential

**Notifications & Email:** create-notification, send-request-notification, send-roadmap-notification, send-survey, send-weekly-reminder, send-weekly-summary

**Surveys:** survey-analytics-snapshot, survey-email-webhook, survey-reminders, survey-scheduler, survey-sync-app-users, survey-unsubscribe

**Other:** approve-quote, twilio-inbound-webhook, twilio-status-webhook, verify-phone-otp, delete-user, import-communities

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

### Adding Roadmap Items via SQL

The `roadmap_items` table has these constraints:

| Column | Required | Valid Values |
|--------|----------|--------------|
| `code` | Yes | Unique, e.g., 'C-010' |
| `title` | Yes | Text |
| `hub` | Yes (NOT NULL) | `'ops-hub'`, `'requests'`, `'chat'`, `'analytics'`, `'settings'`, `'general'`, `'leadership'`, `'future'` |
| `status` | Yes | `'idea'`, `'researched'`, `'approved'`, `'in_progress'`, `'done'`, `'wont_do'`, `'parked'` |
| `raw_idea` | No | Text description |
| `claude_analysis` | No | Claude's detailed analysis |
| `complexity` | No | `'XS'`, `'S'`, `'M'`, `'L'`, `'XL'` |

**Note**: `priority` column does NOT exist. Use `complexity` instead.

**Example INSERT**:
```sql
INSERT INTO roadmap_items (code, title, status, raw_idea, hub)
VALUES ('C-010', 'My Feature', 'idea', 'Description here', 'chat')
ON CONFLICT (code) DO NOTHING;
```

**IMPORTANT**: Use `ON CONFLICT DO NOTHING` to avoid overwriting existing items. If you need to update, use a separate `UPDATE` statement after confirming the item doesn't exist.

**How to run**: Create a `.sql` file in `migrations/` folder, then:
```bash
npm run migrate:direct <filename.sql>
```

### Expanding Ideas

When user asks to expand on an idea (e.g., "expand on S-001"):
1. Read the raw_idea field
2. Research best practices
3. Update claude_analysis with detailed thoughts
4. Consider related items and link them

---

## FSM (Field Service Management) System

The FSM is the core business logic managing the service lifecycle. **All FSM code is centralized in `/src/features/fsm/`**.

> **Source of Truth**: See `docs/FSM Planning/FSM_SYSTEM_STANDARDS.md` for complete standards, requirements, and implementation phases.
>
> **Current Phase**: B (Entity Unification) - JobCard, InvoiceCard, Right Sidebar
> **Completed**: Phase A (ResponsiveList, ProjectContextHeader, ProjectPipelineProgress)

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
