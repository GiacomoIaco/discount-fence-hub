# FSM Testing Scenarios & Deployment Guide
## Supplement to FSM_IMPLEMENTATION_MASTER.md

**Version:** 1.0
**Created:** December 2024
**Status:** Ready for Implementation

---

## Table of Contents

1. [Testing Scenarios](#1-testing-scenarios)
2. [Environment Variables](#2-environment-variables)
3. [Phase Breakdown](#3-phase-breakdown-week-by-week)

---

## 1. Testing Scenarios

### 1.1 Happy Path Test (Complete Pipeline)

Execute each step in order. All should pass for a successful implementation.

```
REQUEST STAGE
[ ] 1. Create new request (simulate phone call from new customer)
[ ] 2. Smart lookup finds no match → create new client inline
[ ] 3. Property address entered, no existing property → create inline
[ ] 4. Territory auto-assigned based on zip code
[ ] 5. Request status: PENDING → UNSCHEDULED

ASSESSMENT
[ ] 6. Schedule assessment for sales rep
[ ] 7. Request status: UNSCHEDULED → SCHEDULED
[ ] 8. Day of assessment: status auto-updates to TODAY
[ ] 9. Rep completes assessment, marks complete
[ ] 10. Request status: TODAY → ASSESSMENT_COMPLETED

QUOTE STAGE
[ ] 11. Rep creates BOM estimate in Calculator
[ ] 12. Convert BOM to Quote with Good/Better/Best options
[ ] 13. Quote total < $25K, margin > 15% → no approval needed
[ ] 14. Quote status: DRAFT → SENT (via email)
[ ] 15. Client views quote, selects "Best" option
[ ] 16. Mark quote as accepted
[ ] 17. Quote status: SENT → APPROVED → CONVERTED
[ ] 18. Request status: ASSESSMENT_COMPLETED → CONVERTED

JOB STAGE
[ ] 19. Create job from quote with crew assignment
[ ] 20. Job status: WON → SCHEDULED
[ ] 21. 2 days before install → auto triggers READY_FOR_YARD
[ ] 22. Yard worker claims job → status: PICKING
[ ] 23. Materials staged and verified → status: STAGED
[ ] 24. Truck loaded, crew signs off → status: LOADED
[ ] 25. Day of install: status shows TODAY
[ ] 26. Crew arrives, starts work → status: IN_PROGRESS
[ ] 27. Work complete → status: COMPLETED → REQUIRES_INVOICING

INVOICE STAGE
[ ] 28. Generate invoice from completed job
[ ] 29. Invoice auto-populated with job details + quoted amounts
[ ] 30. Invoice status: DRAFT → SENT
[ ] 31. Invoice synced to QuickBooks
[ ] 32. Record payment → Invoice status: PAID
[ ] 33. Payment synced to QuickBooks
```

### 1.2 Edge Cases

Test each scenario independently:

**Client & Property Lookup**
```
[ ] Phone number matches existing client → show match, allow selection
[ ] Email matches existing client → show match, allow selection
[ ] Same address, different client → warn about potential duplicate
[ ] Builder client → show Community → Lot cascade
[ ] Unknown zip code (no territory match) → flag for manual assignment
```

**Quote Approval Workflow**
```
[ ] Quote total > $25,000 → requires manager approval before send
[ ] Quote margin < 15% → requires manager approval
[ ] Quote discount > 10% → requires manager approval
[ ] Manager rejects quote → back to DRAFT with notes
[ ] Multiple quotes for same request → all tracked, funnel correct
[ ] Client requests changes → back to DRAFT, version increments (v2, v3...)
```

**Scheduling & Crew**
```
[ ] No crew available on requested date → show availability calendar
[ ] Job rescheduled → update yard timing
[ ] Job rescheduled after materials picked → notify yard, hold materials
[ ] Crew double-booked → warning on assignment
[ ] Job spans multiple days → create JobVisits correctly
```

**Material Prep Pipeline**
```
[ ] BOM changes after STAGED → alert yard supervisor
[ ] Materials short during PICKING → create shortage alert
[ ] Wrong materials loaded → allow correction before sign-off
[ ] Truck breakdown → allow reassignment to different truck
```

**Invoice & Payment**
```
[ ] Partial payment recorded → balance updates correctly
[ ] Invoice past due > 30 days → escalate alert
[ ] Payment recorded in QBO → syncs back to FSM
[ ] Invoice voided → updates job status accordingly
[ ] Refund required → create credit memo flow
```

**Data Integrity**
```
[ ] Delete client with active quotes → blocked
[ ] Delete property with active jobs → blocked
[ ] Archive request with unconverted quotes → quotes also archived
[ ] Restore archived request → quotes remain archived (manual restore)
```

---

## 2. Environment Variables

### 2.1 Required (Already Configured)

```env
# Supabase
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

### 2.2 QuickBooks Online Integration (Phase 4)

```env
# QBO OAuth
QBO_CLIENT_ID=your_client_id
QBO_CLIENT_SECRET=your_client_secret
QBO_REDIRECT_URI=https://discount-fence-hub.netlify.app/.netlify/functions/qbo-callback
QBO_ENVIRONMENT=sandbox  # Change to 'production' when ready

# QBO Realm (set after OAuth connection)
QBO_REALM_ID=your_company_id
```

### 2.3 Notifications (Optional)

```env
# Email (for quote/invoice sending)
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=SG.your_sendgrid_api_key

# SMS (for appointment reminders)
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_PHONE_NUMBER=+15125551234
```

### 2.4 Feature Flags (Optional)

```env
# FSM Feature Flags
FSM_ENABLE_AUTO_TERRITORY=true
FSM_ENABLE_QBO_SYNC=false  # Enable in Phase 4
FSM_ENABLE_SMS_REMINDERS=false
FSM_YARD_AUTO_TRIGGER_DAYS=2  # Days before install to trigger yard
```

---

## 3. Phase Breakdown (Week-by-Week)

### Phase 1: Foundation (Weeks 1-2)
**Goal:** Requests + Smart Client Lookup working end-to-end

| Week | Tasks | Deliverables |
|------|-------|--------------|
| **Week 1** | | |
| | Verify FSM database tables exist | Migration check script |
| | Build `SmartClientLookup` component | Component + hook |
| | Build `SmartPropertyLookup` component | Component + hook |
| | Integrate lookups into `RequestEditorModal` | Updated modal |
| **Week 2** | | |
| | Build `RequestQueuePage` with filters | New page |
| | Implement request status transitions | Service functions |
| | Add territory auto-assignment by zip | Logic + settings UI |
| | End-to-end test: Request creation flow | Test passing |

### Phase 2: Quoting (Weeks 3-5)
**Goal:** Quote creation with Good/Better/Best, approval workflow

| Week | Tasks | Deliverables |
|------|-------|--------------|
| **Week 3** | | |
| | Build `QuoteBuilderPage` layout | New page shell |
| | Integrate BOM Calculator for line items | Calculator integration |
| | Build `QuoteOptionsBuilder` (G/B/B) | Component |
| **Week 4** | | |
| | Implement approval thresholds | Settings + logic |
| | Build approval workflow UI | Manager approve/reject |
| | Build `QuotePreview` component | Preview + print |
| **Week 5** | | |
| | Generate PDF quotes | jsPDF template |
| | Email quote to client | Netlify function |
| | Client signature capture | Signature component |
| | End-to-end test: Quote flow | Test passing |

### Phase 3: Jobs + Scheduling (Weeks 6-9)
**Goal:** Job management + calendar scheduling + yard integration

| Week | Tasks | Deliverables |
|------|-------|--------------|
| **Week 6** | | |
| | Build `JobBoardPage` (Kanban view) | New page |
| | Implement job status transitions | Service functions |
| | Build `JobCard` component | Drag-drop ready |
| **Week 7** | | |
| | Install and configure FullCalendar | Calendar setup |
| | Build resource timeline view | Crew scheduling |
| | Implement crew capacity checking | Overbooking prevention |
| **Week 8** | | |
| | Implement yard sync (auto READY_FOR_YARD) | Scheduled function |
| | Build material prep status tracking | Status updates |
| | Yard worker mobile interface | Mobile-optimized |
| **Week 9** | | |
| | Build `JobVisit` support for multi-day | Visit tracking |
| | Job completion workflow | Checklist + photos |
| | End-to-end test: Job flow | Test passing |

### Phase 4: Invoicing + QBO (Weeks 10-13)
**Goal:** Complete pipeline + QuickBooks sync

| Week | Tasks | Deliverables |
|------|-------|--------------|
| **Week 10** | | |
| | Build `InvoiceListPage` | New page |
| | Auto-generate invoice from job | Service function |
| | Build invoice editor | Adjust line items |
| **Week 11** | | |
| | QBO OAuth connection flow | Netlify functions |
| | Push invoices to QBO | Sync function |
| | Handle QBO sync errors | Error UI + retry |
| **Week 12** | | |
| | Build payment recording UI | Payment modal |
| | QBO payment webhook | Incoming sync |
| | Partial payment handling | Balance tracking |
| **Week 13** | | |
| | Past due alerts | Notification system |
| | Collections escalation | Status + alerts |
| | End-to-end test: Invoice flow | Test passing |

### Phase 5: Reporting + Polish (Weeks 14-16)
**Goal:** Analytics dashboard + mobile polish

| Week | Tasks | Deliverables |
|------|-------|--------------|
| **Week 14** | | |
| | Build opportunity funnel dashboard | Analytics page |
| | Sales rep performance metrics | Leaderboard |
| | Conversion rate tracking (fixed!) | Accurate rates |
| **Week 15** | | |
| | Yard efficiency metrics | Yard dashboard |
| | Job profitability analysis | Margin tracking |
| | Team utilization reports | Capacity analysis |
| **Week 16** | | |
| | Mobile crew experience polish | PWA optimization |
| | Offline capability for field | Service worker |
| | End-to-end regression testing | Full test suite |

### Phase 6: Launch Prep (Weeks 17-18)
**Goal:** Production readiness

| Week | Tasks | Deliverables |
|------|-------|--------------|
| **Week 17** | | |
| | Data migration from existing systems | Migration scripts |
| | User training documentation | Help docs |
| | Role-based access verification | Permission audit |
| **Week 18** | | |
| | Soft launch with pilot crew | Limited rollout |
| | Bug fixes from pilot feedback | Patches |
| | Full production launch | Go live! |

---

## Appendix: Quick Reference

### Status Colors

| Status Type | Color | Tailwind Class |
|-------------|-------|----------------|
| Pending/Draft | Gray | `bg-gray-100 text-gray-700` |
| Awaiting/Scheduled | Yellow | `bg-yellow-100 text-yellow-800` |
| In Progress | Purple | `bg-purple-100 text-purple-800` |
| Completed/Paid | Green | `bg-green-100 text-green-800` |
| Overdue/Error | Red | `bg-red-100 text-red-800` |
| Archived | Gray (muted) | `bg-gray-100 text-gray-500` |

### Auto-Number Formats

| Entity | Format | Example |
|--------|--------|---------|
| Request | REQ-YYYY-NNNN | REQ-2024-0001 |
| Quote | QUO-YYYY-NNNN | QUO-2024-0042 |
| Job | JOB-YYYY-NNNN | JOB-2024-0038 |
| Invoice | INV-YYYY-NNNN | INV-2024-0156 |

---

*Document Version: 1.0*
*Supplement to FSM_IMPLEMENTATION_MASTER.md*
