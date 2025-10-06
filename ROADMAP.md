# Request Management System - Feature Roadmap

## ✅ Currently Working Features

### Request Creation & Submission
- [x] Photo upload (file picker) ✅
- [x] Camera capture with live preview ✅
- [x] Voice recording with AI transcription
- [x] Submitter info automatically saved (user_id, timestamp)
- [x] All request types supported (pricing, material, support, warranty, new_builder)

### Request Management
- [x] Request assignment ("Assign to Me" button) ✅
- [x] In-app messaging/notes within requests ✅
- [x] Real-time updates via Supabase subscriptions
- [x] SLA tracking (on_track, at_risk, breached)
- [x] Priority scoring
- [x] Activity logging

### Filtering & Search
- [x] Filter by stage (new, pending, completed, archived)
- [x] Filter by request type (pricing, material, etc.)
- [x] Filter by SLA status
- [x] Search functionality

## 🚧 Features To Implement

### 1. Advanced Filtering
**Priority: HIGH**

Missing filters that need to be added:

- [ ] **Filter by Assignee (Person Responsible)**
  - Location: Operations Queue component
  - Implementation: Add user dropdown filter
  - Query: `assigned_to` field

- [ ] **Filter by Requestor/Submitter**
  - Location: Operations Queue component
  - Implementation: Add user dropdown filter
  - Query: `submitter_id` field

**Technical Requirements:**
- Need to fetch list of all users from `auth.users` or `user_profiles`
- Create dropdown component with user search
- Update `useAllRequests` hook (already supports `submitter_id` and `assigned_to`)

### 2. Default Assignment Rules
**Priority: HIGH**

Automatically assign requests based on type.

**Database:** `request_assignment_rules` table already exists!

**Features Needed:**
- [ ] Admin UI to configure assignment rules
  - Location: New "Assignment Rules" settings page
  - For each request type, set default assignee(s)
  - Priority system (if multiple rules match)

- [ ] Auto-assignment logic in backend
  - Trigger on request creation
  - Check rules table for matching rule
  - Auto-assign if rule exists
  - Log assignment activity

**SQL Table Structure (already exists):**
```sql
request_assignment_rules (
  id, request_type, assignee_id,
  priority, is_active, created_at
)
```

### 3. Analytics Dashboard
**Priority: MEDIUM**

Overall analytics including win rate for pricing requests.

**Metrics to Display:**

**Overview Stats:**
- [ ] Total requests (all time, this month, this week)
- [ ] Average response time
- [ ] SLA compliance rate (% on time)
- [ ] Open vs. closed requests

**Pricing Request Analytics:**
- [ ] **Win Rate** = (requests with quote_status='won') / (total pricing requests with quote_status != null) * 100
- [ ] Average quote value
- [ ] Conversion time (submission to won/lost)
- [ ] Win rate by sales rep

**Request Type Breakdown:**
- [ ] Requests by type (pie chart)
- [ ] Average completion time by type
- [ ] Most common request types

**Team Performance:**
- [ ] Requests per assignee
- [ ] Average completion time per assignee
- [ ] SLA compliance per assignee

**Implementation:**
- Create new `Analytics` component
- Query aggregated data from `requests` table
- Use chart library (recharts or similar)
- Add to navigation menu

### 4. Enhanced Request Detail View
**Priority: LOW**

- [ ] Display submitter name and photo in request header
- [ ] Display submitted_at timestamp prominently
- [ ] Show full assignment history
- [ ] Photo gallery view for attached photos
- [ ] Download all photos button

### 5. Bulk Operations
**Priority: LOW**

- [ ] Bulk assign requests
- [ ] Bulk status update
- [ ] Bulk archive
- [ ] Export requests to CSV

## 📋 Implementation Priority

### Phase 1 (Next Session)
1. Default Assignment Rules UI & Logic
2. Filter by Assignee
3. Filter by Submitter

### Phase 2
1. Analytics Dashboard with Win Rate
2. Enhanced Request Detail View

### Phase 3
1. Bulk Operations
2. Advanced Reporting

## 🔧 Technical Notes

### Database Schema
All necessary tables already exist:
- `requests` - Main request table ✅
- `request_notes` - In-app messaging ✅
- `request_activity_log` - Activity tracking ✅
- `request_assignment_rules` - Auto-assignment ✅ (exists but unused)
- `request_sla_defaults` - SLA configuration ✅

### Missing Columns Added
Migration `003_add_missing_request_columns.sql` added:
- title, description
- customer fields
- urgency, deadline
- voice/photo fields
- submitted_at timestamp

### Hooks Available
- `useAllRequests` - with submitter_id, assigned_to filters ✅
- `useMyRequests` - user's own requests ✅
- `useAssignRequest` - assign to user ✅
- `useRequestNotes` - messaging ✅
- `useRequestActivity` - activity log ✅
- `useEscalationEngine` - auto-escalation ✅

## 📊 Analytics Queries (Reference)

### Win Rate for Pricing Requests
```sql
SELECT
  COUNT(*) FILTER (WHERE quote_status = 'won') * 100.0 /
  COUNT(*) FILTER (WHERE quote_status IS NOT NULL) as win_rate_percent
FROM requests
WHERE request_type = 'pricing'
  AND quote_status IN ('won', 'lost');
```

### Requests by Assignee
```sql
SELECT
  assigned_to,
  COUNT(*) as total_requests,
  AVG(EXTRACT(EPOCH FROM (completed_at - submitted_at))/3600) as avg_hours_to_complete
FROM requests
WHERE assigned_to IS NOT NULL
GROUP BY assigned_to;
```

### SLA Compliance
```sql
SELECT
  COUNT(*) FILTER (WHERE sla_status = 'on_track') * 100.0 / COUNT(*) as compliance_rate
FROM requests
WHERE stage IN ('completed', 'archived');
```
