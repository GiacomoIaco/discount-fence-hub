# Team Communication V2 - Comprehensive Redesign

## 🎯 What's Been Built

### 1. **Enhanced Database Schema** ✅
**File:** `update-team-communication-schema.sql`

**New Tables:**
- `message_engagement` - Tracks individual user interactions (opened, acknowledged, responded, archived)

**New Columns on `company_messages`:**
- `status` - draft, active, expired, archived
- `is_draft` - Save messages before sending
- `allow_edit_responses` - Let users edit survey answers
- `show_results_after_submit` - Show survey results
- `anonymous_responses` - Hide responder names
- `survey_questions` (JSONB) - Multi-question surveys with various types

**New Functions:**
- `get_message_state()` - Returns message state for a user
- `auto_archive_messages()` - Auto-archives based on rules
- `create_message_engagement()` - Creates engagement records
- `track_message_opened()` - Updates engagement on open
- `track_message_response()` - Updates engagement on response

**New View:**
- `message_states` - Aggregated engagement stats per message

**Auto-Archive Rules:**
- Announcements → 30 days after read
- Surveys → After user responds
- Alerts → After acknowledged
- Events → After event date

---

### 2. **Mobile Interface V2** ✅
**File:** `TeamCommunicationMobileV2.tsx`

**Tab System:**
- **📬 Inbox Tab** - Messages TO you
  - Active (default)
  - Archived
- **📤 Sent Tab** - Messages FROM you (Admin/Manager only)
  - Active
  - Drafts
  - Archived

**Message States:**
- `unread` - Not opened yet (NEW badge, blue ring)
- `read` - Opened but no action needed (READ badge)
- `read_needs_action` - Needs acknowledgment (ACTION REQUIRED badge, yellow)
- `read_needs_response` - Needs survey answer (ANSWER SURVEY badge, purple)
- `answered` - Survey completed (COMPLETED badge, green)
- `acknowledged` - Policy/alert confirmed (ACKNOWLEDGED badge, green)
- `archived` - Manually or auto-archived (ARCHIVED badge, gray)

**Inbox Features:**
- State-based badges (NEW, ACTION REQUIRED, COMPLETED, etc.)
- Swipe-ready structure (archive action)
- Auto-expand urgent unread messages
- Acknowledge button for policies/alerts
- Archive button for cleanup

**Sent Features:**
- Engagement stats (opened %, acknowledged %, responded %)
- Visual progress indicators
- Draft management
- "View Details" button for full analytics

---

## 🚧 What Still Needs to Be Built

### 3. **Multi-Question Survey Builder** 🔨
**Next Step:** Create `SurveyBuilder.tsx` component

**Question Types Needed:**
- Multiple Choice (single/multi-select)
- Yes/No
- Rating (1-5 stars)
- Short Text
- Long Text

**Features:**
- Add/remove questions
- Drag to reorder
- Mark as required
- Preview mode

**Example Structure:**
```typescript
{
  questions: [
    {
      id: "q1",
      text: "How was the training?",
      type: "multiple_choice",
      options: ["Excellent", "Good", "Fair", "Poor"],
      allow_multiple: false,
      required: true
    },
    {
      id: "q2",
      text: "What would you improve?",
      type: "long_text",
      required: false
    }
  ]
}
```

---

### 4. **Survey Response Component** 🔨
**Next Step:** Create `SurveyResponse.tsx`

**Features:**
- Render questions based on type
- Validate required fields
- Save progress (optional)
- Submit all answers
- Prevent duplicate submissions (unless edit allowed)

---

### 5. **Engagement Dashboard** 🔨
**Next Step:** Create `MessageEngagementDashboard.tsx`

**For Message Creators:**
- Overall stats (opened, acknowledged, responded)
- List of who hasn't responded
- Send reminder button
- Export CSV

**View:**
```
┌─────────────────────────────┐
│  Safety Training Required   │
│  📊 15 recipients            │
├─────────────────────────────┤
│  ✓ Opened: 12/15 (80%)      │
│  ✓ Acked:   8/15 (53%)      │
│                             │
│  ⚠️ Not acknowledged:        │
│  • John Smith               │
│  • Sarah Johnson            │
│  • Mike Davis               │
│                             │
│  [Send Reminder] [Export]   │
└─────────────────────────────┘
```

---

### 6. **Survey Results View** 🔨
**Next Step:** Create `SurveyResults.tsx`

**Features:**
- Bar charts for multiple choice
- Yes/No pie charts
- Star rating averages
- Text responses list
- Export to CSV
- Filter by date/role

**View:**
```
┌─────────────────────────────┐
│  Training Feedback          │
│  📊 12 responses (80%)      │
├─────────────────────────────┤
│  Q1: How was it?            │
│  Excellent: ████████ 60%    │
│  Good:      ████     40%    │
│                             │
│  Q2: Improvements?          │
│  [View 12 text responses →] │
│                             │
│  [Export CSV]               │
└─────────────────────────────┘
```

---

### 7. **Draft Message System** 🔨
**Next Step:** Update `MessageComposer.tsx`

**Features:**
- "Save Draft" button
- Auto-save every 30s
- Draft list in Sent tab
- Edit draft → Send
- Delete draft

---

### 8. **Enhanced MessageComposer** 🔨
**Next Step:** Update existing composer

**New Features:**
- Survey Builder integration
- Draft save/load
- Preview before send
- Schedule send (optional)
- Target specific users (not just roles)

---

## 📝 Implementation Order

### Phase 1: Core Functionality ✅ DONE
- [x] Enhanced database schema
- [x] Message engagement tracking
- [x] Auto-archive logic
- [x] Inbox/Sent tab system
- [x] Message states

### Phase 2: Survey System 🔨 NEXT
- [ ] Multi-question survey builder
- [ ] Survey response component
- [ ] Survey results view
- [ ] Export results to CSV

### Phase 3: Analytics & Engagement 🔨
- [ ] Engagement dashboard
- [ ] Who hasn't responded list
- [ ] Send reminder functionality
- [ ] Detailed analytics view

### Phase 4: Polish & UX 🔨
- [ ] Draft message system
- [ ] Swipe gestures (archive, pin)
- [ ] Pull-to-refresh
- [ ] Push notifications integration

---

## 🔄 Migration Steps

**To deploy V2:**

1. **Run SQL in Supabase:**
   ```bash
   # Copy contents of update-team-communication-schema.sql
   # Paste in Supabase SQL Editor
   # Execute
   ```

2. **Update App.tsx to use V2:**
   ```typescript
   // Change import
   import TeamCommunicationMobileV2 from './components/TeamCommunicationMobileV2';

   // Update in SalesRepView
   if (activeSection === 'team-communication') {
     return <TeamCommunicationMobileV2 onBack={() => setActiveSection('home')} />;
   }
   ```

3. **Test Each Flow:**
   - Inbox → Active messages
   - Inbox → Archive message
   - Inbox → Acknowledge alert
   - Sent → View engagement stats
   - Sent → Drafts

4. **Build Survey Features** (Phase 2)

---

## 🎯 Key Improvements Over V1

**V1 Problems:**
- ❌ Everything mixed together
- ❌ Can answer surveys repeatedly
- ❌ No visibility for senders
- ❌ Old messages clutter feed
- ❌ Single question surveys only

**V2 Solutions:**
- ✅ Inbox/Sent separation
- ✅ Message states prevent duplicates
- ✅ Engagement dashboard for senders
- ✅ Auto-archive old messages
- ✅ Multi-question surveys (pending)
- ✅ Various question types (pending)
- ✅ Results analytics (pending)

---

## 📊 Database Changes Summary

**New:**
- `message_engagement` table
- `message_states` view
- Multiple triggers and functions

**Modified:**
- `company_messages` (7 new columns)
- `message_responses` (2 new columns)

**Auto-Archive:**
- Runs via `auto_archive_messages()` function
- Can be scheduled or called manually

---

## 🚀 Next Steps

**Immediate (1-2 hours):**
1. Deploy schema update
2. Switch to V2 component
3. Test Inbox/Sent flows

**Short-term (3-5 hours):**
4. Build Survey Builder
5. Build Survey Response
6. Build Results View

**Medium-term (5-8 hours):**
7. Engagement Dashboard
8. Draft system
9. Enhanced composer

**Long-term (optional):**
10. Swipe gestures
11. Push notifications
12. Advanced analytics

---

**Status:** Core V2 framework complete. Survey system is next priority.
