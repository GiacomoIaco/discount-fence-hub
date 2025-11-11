# Weekly Update Flow - Decision Guide

## Current Behavior (What We Have Now)

**Manual Inline Editing**
- User clicks on "This Week" or "Next Week" cell in table
- Cell becomes editable textarea
- User types update
- Auto-saves on blur (click away)

**Pros:**
- ✅ Fast for power users
- ✅ No context switching
- ✅ Can update multiple initiatives quickly

**Cons:**
- ❌ Easy to forget initiatives
- ❌ No reminder of what needs updating
- ❌ No "submit" moment (feels incomplete)
- ❌ No notification to manager

---

## Option 1: Quick Wizard Flow (Recommended)

### How It Works

**Trigger:** Click "📝 Weekly Update" button (top right)

**Flow:**
```
┌────────────────────────────────────────────────────────┐
│ Weekly Update - Week of Dec 4, 2024        [3 of 3] ► │
├────────────────────────────────────────────────────────┤
│                                                         │
│ Vendor Consolidation Project                          │
│ Area: Inventory Management                             │
│ Goals: 🎯 Reduce costs -15%                            │
│ Current Progress: 75%                                   │
│                                                         │
│ ┌─────────────────────────────────────────────────┐  │
│ │ ✏️ What did you accomplish this week?           │  │
│ │                                                   │  │
│ │ [Completed vendor audit - identified 2 vendors  │  │
│ │  we can consolidate. Started negotiations with  │  │
│ │  Supplier A for better terms.]                  │  │
│ │                                                   │  │
│ │ Last week: "Started vendor analysis..."         │  │
│ └─────────────────────────────────────────────────┘  │
│                                                         │
│ ┌─────────────────────────────────────────────────┐  │
│ │ ➡️ What are you planning for next week?         │  │
│ │                                                   │  │
│ │ [Finalize pricing with Supplier A. Begin        │  │
│ │  onboarding process. Schedule closeout meeting  │  │
│ │  with Supplier B.]                              │  │
│ │                                                   │  │
│ └─────────────────────────────────────────────────┘  │
│                                                         │
│ Update progress:  ████████░░ 75% → [85%] ▼           │
│ Status: [🟢 On Track ▼]                               │
│                                                         │
│ [Skip] [◄ Previous] [Next Initiative ►] [Submit All]  │
└────────────────────────────────────────────────────────┘

After clicking through all initiatives:

┌────────────────────────────────────────────────────────┐
│ Review & Submit                                         │
├────────────────────────────────────────────────────────┤
│                                                         │
│ ✓ Vendor Consolidation - Updated (75% → 85%)          │
│ ✓ Automate PO Creation - Updated (45% → 50%)          │
│ ✓ Improve Routing - Skipped                            │
│                                                         │
│ ☐ Notify function lead (John Doe)                     │
│ ☐ Copy me on email                                     │
│                                                         │
│ [Cancel] [Save Draft] [Submit Updates]                │
└────────────────────────────────────────────────────────┘
```

**User Experience:**
1. Click "Weekly Update" button
2. Modal/drawer slides up with first initiative
3. Fill in this week / next week
4. Adjust progress if needed
5. Click "Next" to move to next initiative
6. Can skip initiatives already updated
7. Review summary
8. Submit all at once
9. Email sent to function lead

**Pros:**
- ✅ Guided experience (won't forget initiatives)
- ✅ Shows context (goals, last update)
- ✅ Clear "done" moment with submission
- ✅ Notifications to stakeholders
- ✅ Can save draft and come back
- ✅ Good for less frequent users

**Cons:**
- ❌ More clicks than inline editing
- ❌ Modal can feel intrusive
- ❌ Slower for power users

---

## Option 2: Enhanced Inline Editing

### How It Works

**Keep current inline editing BUT add:**

**Visual Highlights:**
```
┌──────────────────────────────────────────────────────┐
│ ⚠️ 3 initiatives need weekly updates                 │
│                                                       │
│ Initiative          | This Week | Next Week | Status │
│ ─────────────────────────────────────────────────────│
│ 🔔 Vendor Consol.  │ [Empty]   │ [Empty]   │  75%  │ ← Highlighted
│    Automate PO     │ Updated ✓ │ Updated ✓ │  45%  │
│ 🔔 Improve Routing │ [Empty]   │ [Empty]   │  80%  │ ← Highlighted
└──────────────────────────────────────────────────────┘
```

**Batch Submit:**
- After editing inline, banner appears:
  ```
  ┌────────────────────────────────────────────────┐
  │ You have unsaved updates to 3 initiatives      │
  │ [Discard] [Save Without Notifying] [Submit →] │
  └────────────────────────────────────────────────┘
  ```

**Pros:**
- ✅ Fast for power users
- ✅ No modal/interruption
- ✅ Still get notifications
- ✅ Visual reminders of what needs updating

**Cons:**
- ❌ Less structured
- ❌ Can still forget initiatives not visible
- ❌ No context about goals/previous updates

---

## Option 3: Hybrid Approach (Best of Both?)

### How It Works

**Default:** Enhanced inline editing (Option 2)

**Optional:** Weekly update wizard available (Option 1)

**Flexible workflow:**
- Power users: Edit inline, click "Submit Updates" banner
- Occasional users: Click "Weekly Update Wizard" button
- Both end with same notification system

**UI:**
```
Top Right Buttons:
[📝 Weekly Update Wizard] [💾 Submit Updates (3)]
         ↓                          ↓
    Guided flow              Quick submit
```

**Pros:**
- ✅ Accommodates both user types
- ✅ Learn at your own pace
- ✅ Same notifications either way

**Cons:**
- ❌ Two ways to do same thing (can be confusing)
- ❌ More code to maintain

---

## Comparison Table

| Feature | Current | Option 1: Wizard | Option 2: Enhanced Inline | Option 3: Hybrid |
|---------|---------|------------------|---------------------------|------------------|
| **Speed** | Fast | Slower | Fast | User's choice |
| **Guidance** | None | High | Medium | User's choice |
| **Context** | None | Shows goals/history | None | Wizard only |
| **Completeness** | Easy to forget | Won't forget | Visual reminders | Both options |
| **Notifications** | None | Yes | Yes | Yes |
| **Learning Curve** | Low | Medium | Low | Medium |
| **Power User** | ✓ | ✗ | ✓ | ✓ |
| **Occasional User** | ✗ | ✓ | ✓ | ✓ |

---

## Recommendation Based on Your Goals

> "Make it super easy to report updates without creating overdemanding bureaucracy"

**I recommend: Option 3 (Hybrid)**

**Why:**
1. **Not bureaucratic:** Inline editing still available (fast path)
2. **Easy updates:** Wizard ensures nothing gets missed (safe path)
3. **Transparency:** Both trigger notifications to function lead
4. **User choice:** Team members can choose their preferred flow

**Implementation:**
- Start with **Option 2** (Enhanced Inline + Submit banner)
- Add **Option 1** (Wizard) as secondary feature
- Let usage patterns determine if both are needed

---

## Example User Flows

### Power User (John - Updates 12 initiatives weekly)
```
1. Opens Operations function
2. Quickly scans table
3. Click-click-click edits This Week cells
4. Click-click-click edits Next Week cells
5. Banner appears: "You have updates to 12 initiatives"
6. Clicks "Submit Updates"
7. Done in 2-3 minutes
```

### Occasional User (Sarah - Updates 2 initiatives weekly)
```
1. Opens Operations function
2. Clicks "📝 Weekly Update Wizard"
3. Modal shows first initiative with context
4. Fills in updates
5. Clicks Next → second initiative
6. Fills in updates
7. Clicks Submit
8. Done in 3-4 minutes
```

### Hybrid User (Mike - Updates 5 initiatives, varies)
```
Busy week:
- Uses inline editing (fast)

Complex week with blockers:
- Uses wizard to add detailed context
```

---

## Questions to Help You Decide

1. **Team size:** How many people will use this weekly?
   - Small team (3-5): Option 2 might be enough
   - Larger team (10+): Option 3 provides flexibility

2. **Update frequency:** How often will updates happen?
   - Weekly ritual: Wizard makes sense
   - Ad-hoc updates: Inline editing better

3. **Detail level:** How detailed should updates be?
   - Quick bullets: Inline editing
   - Contextual narratives: Wizard provides space

4. **Compliance:** Do you need proof everyone submitted?
   - Yes: Wizard with "Submit All" is clear
   - No: Either works

5. **Training time:** How much time for onboarding?
   - Limited: Start with inline only (Option 2)
   - Time available: Hybrid gives options (Option 3)

---

## My Specific Recommendation

Given your statement about "no bureaucracy":

**Start with Option 2 (Enhanced Inline)**
- Add visual highlights for empty updates
- Add "Submit Updates" banner with notifications
- Monitor usage for 2-4 weeks

**Then consider adding Option 1 (Wizard) if:**
- People complain about forgetting initiatives
- Updates are too terse/lacking context
- Function leads want more structured input

This way you **start light** and only add wizard if needed, rather than building complexity upfront.

---

**What do you think? Which option aligns best with how your team actually works?**
