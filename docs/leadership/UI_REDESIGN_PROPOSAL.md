# Leadership UI Redesign - Monday.com Style

## Current Problems ❌

1. **Too Many Entry Points:** Dashboard → Functions → Settings (scattered)
2. **Hidden Features:** Table view behind toggle, goals in separate menu
3. **Too Many Clicks:** Need 3-4 clicks to get to initiatives
4. **Disconnected:** Annual goals, quarterly goals, and initiatives feel like separate systems
5. **Not Default:** Best view (table) is hidden, defaults to cards

## Proposed Solution ✅

### Option A: Dedicated Leadership App (Recommended)

**Make Leadership feel like entering Monday.com entirely**

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│ [Main App Nav - Top Bar]                                                        │
├────────┬────────────────────────────────────────────────────────────────────────┤
│        │ OPERATIONS FUNCTION                    [⚙️ Settings] [👤 Team] [📊]     │
│ LEADER │                                                                         │
│ SHIP   │ ┌──────────────────────────────────────────────────────────────────┐  │
│        │ │ Tabs: [● Initiatives] [Annual Plan] [Q1 2025] [Reports]          │  │
│ ────── │ └──────────────────────────────────────────────────────────────────┘  │
│        │                                                                         │
│ 🏢 Ops │ ┌─ 2025 Annual Goals ──────────────────── 85% Complete ────────────┐  │
│  • 12  │ │ • Reduce costs -15% (30%) ────────── 92% 🟢                       │  │
│        │ │ • Improve delivery 98% (25%) ──────── 88% 🟢                      │  │
│ 💰 Fin │ │ • Vendor consolidation (20%) ───────── 75% 🟡                     │  │
│  • 8   │ └──────────────────────────────────── [Manage Goals →] ────────────┘  │
│        │                                                                         │
│ 📈 Mkt │ ┌─ Initiatives & Tasks ────────────────────────────────────────────┐  │
│  • 5   │ │ Group by: [● Area ▼] [Goal ▼] [Owner ▼]  Filter: [🟢🟡🔴] [All▼] │  │
│        │ │                                                                    │  │
│ ────── │ │ ▼ 📁 Inventory Management                          [+ Add Init]  │  │
│        │ │ ├─────────────┬──────┬────────┬───────────┬───────────┬─────────┤  │
│ + New  │ │ │ Initiative  │Goals │ Status │This Week  │Next Week  │ Owner   │  │
│ Func   │ │ ├─────────────┼──────┼────────┼───────────┼───────────┼─────────┤  │
│        │ │ │▶ Vendor     │🎯-15%│  🟢   │Completed  │Finalize   │ John    │  │
│        │ │ │  Consol.    │      │  75%   │audit.     │terms with │         │  │
│        │ │ │             │      │        │Started    │Supplier A │         │  │
│        │ │ │  ├─ Audit   │      │   ✓    │nego.      │           │ John    │  │
│        │ │ │  ├─ Nego.   │      │   →    │           │           │ Sarah   │  │
│        │ │ │  └─ Close   │      │   ⭕   │           │           │ John    │  │
│        │ │ ├─────────────┼──────┼────────┼───────────┼───────────┼─────────┤  │
│        │ │ │▶ Automate   │🎯-15%│  🟡   │Completed  │Begin      │ Mike    │  │
│        │ │ │  PO Create  │🎯80% │  45%   │software   │workflow   │         │  │
│        │ │ │             │      │        │selection  │config     │         │  │
│        │ │ │  ├─ Select  │      │   ✓    │           │           │ Mike    │  │
│        │ │ │  ├─ Config  │      │   →    │           │           │ Mike    │  │
│        │ │ │  └─ Train   │      │   ⭕   │           │           │ Sarah   │  │
│        │ │ └─────────────┴──────┴────────┴───────────┴───────────┴─────────┘  │
│        │ │                                                                    │  │
│        │ │ ▼ 📁 Fulfillment                                   [+ Add Init]   │  │
│        │ │ ├─────────────┬──────┬────────┬───────────┬───────────┬─────────┤  │
│        │ │ │▶ Improve    │🎯98% │  🟢   │[Click to  │[Click to  │ Lisa    │  │
│        │ │ │  routing    │      │  80%   │ edit]     │ edit]     │         │  │
│        │ │ │  └─ Impl... │      │   →    │           │           │ Lisa    │  │
│        │ │ └─────────────┴──────┴────────┴───────────┴───────────┴─────────┘  │
│        │ │                                                                    │  │
│        │ │ [+ Add Area]                                      [+ New Init]    │  │
│        │ └────────────────────────────────────────────────────────────────────┘  │
└────────┴────────────────────────────────────────────────────────────────────────┘

Key Features:
- Left sidebar shows all Functions with initiative count
- Click function → see everything in one view
- Goals shown as collapsible header (always visible context)
- Table view is DEFAULT
- Inline editing everywhere
- Quick add buttons
- Tabs for different views (Initiatives, Plans, Reports)
```

### Key Improvements

#### 1. **Integrated Function Sidebar** (Like Monday's Board List)
```
┌─────────────────────┐
│ LEADERSHIP          │
│ ─────────────────── │
│ 🏢 Operations       │ ← Click to enter
│   • 12 initiatives  │
│   • 85% on track    │
│                     │
│ 💰 Finance          │
│   • 8 initiatives   │
│   • 78% on track    │
│                     │
│ 📈 Marketing        │
│   • 5 initiatives   │
│   • 90% on track    │
│                     │
│ ─────────────────── │
│ + New Function      │
└─────────────────────┘
```

#### 2. **Contextual Goal Display** (Always Visible)
Instead of hiding goals in a separate menu, show them collapsed at top:

```
┌─ 2025 Annual Goals ─────────── 85% Complete ────────┐
│ • Reduce costs -15% (30%) ────── 92% 🟢              │
│ • Improve delivery 98% (25%) ─── 88% 🟢              │
│ • Vendor consolidation (20%) ─── 75% 🟡              │
│ • Process automation 80% (25%) ─ 82% 🟢              │
│                                                       │
│ [← Q4 2024] [Q1 2025 ▼] [Q2 2025 →]  [Manage Goals] │
└───────────────────────────────────────────────────────┘
```

Click "Manage Goals" → Modal or slide-out with full annual/quarterly planning

#### 3. **Default Table View** (No More Toggle)
- Table is the primary view
- Can group by Area, Goal, Owner, Status
- Collapsible groups
- Inline editing everywhere

#### 4. **Quick Actions Everywhere**
- `[+ Add Area]` - Right in the table
- `[+ Add Initiative]` - In each area group
- `+ New Function` - In sidebar
- `⚙️ Settings` - Top right

#### 5. **Tab Navigation** (Instead of Separate Pages)
```
[● Initiatives] [Annual Plan] [Q1 2025] [Reports]
     ↓              ↓             ↓          ↓
  Table View    Goal Planning  Quarter     Dashboards
  (default)     (full form)    Review      & PDFs
```

---

## Option B: Enhanced Sidebar in Main App

**Keep main app sidebar, add Leadership sub-navigation**

```
┌──────────┬────────┬──────────────────────────────────────────┐
│ Main App │ Leader │ Content                                  │
│ Sidebar  │  ship  │                                          │
├──────────┼────────┼──────────────────────────────────────────┤
│ 🏠 Home  │ FUNC   │ Same as Option A, but integrated         │
│ 📊 Dash  │ ────── │ into main app flow                       │
│ 🎯 Lead  │ • Ops  │                                          │
│ 👥 Team  │ • Fin  │                                          │
│ 📸 Photos│ • Mkt  │                                          │
│ ...      │        │                                          │
│          │ + New  │                                          │
└──────────┴────────┴──────────────────────────────────────────┘
```

**Pros:** Consistent with rest of app
**Cons:** Double sidebar might feel cramped

---

## Proposed Information Architecture

### Main View (Default)
```
Function → Initiatives Tab (DEFAULT)
  ├─ Goal Context (collapsed at top)
  ├─ Table View (default, not cards)
  │   ├─ Group by Area (default)
  │   ├─ Inline edit everything
  │   └─ Collapsible rows with tasks
  ├─ Quick filters (status, owner, goal)
  └─ Quick add buttons
```

### Other Tabs (Easy Access)
```
Function → Annual Plan Tab
  └─ Full goal planning interface

Function → Q1 2025 Tab
  └─ Quarterly breakdown and review

Function → Reports Tab
  └─ Progress analytics and PDF export
```

### Settings (Separate but Accessible)
```
⚙️ Settings Button → Dropdown
  ├─ Manage Functions & Areas
  ├─ Grant Access
  ├─ Email Settings
  └─ System Settings
```

---

## Weekly Update Flow (Simplified)

### Current: Manual inline editing
### Proposed: "My Weekly Update" Quick Flow

**Option 1: Bottom Sheet / Drawer**
```
Click "📝 Weekly Update" button →

┌─────────────────────────────────────────────────┐
│ ▼ Your Updates - Week of Dec 4 (3 initiatives) │
├─────────────────────────────────────────────────┤
│ Vendor Consolidation (Operations)              │
│ This week: [Click to edit...]                  │
│ Next week: [Click to edit...]                  │
│ Progress: ████████ 75% → [80%] ▼               │
│                                                 │
│ [← Previous] [1 of 3] [Next →]   [Submit All]  │
└─────────────────────────────────────────────────┘
```

**Option 2: Highlighted Row Mode**
```
Click "📝 Weekly Update" →
Table highlights rows needing updates
Shows inline prompts
Submit all at once
```

---

## Mobile Considerations

Current table won't work on mobile. Proposed:

**Desktop:** Full table (default)
**Mobile:** Card view with swipe actions

---

## Comparison with Current Implementation

| Feature | Current | Proposed |
|---------|---------|----------|
| **Default View** | Cards | Table (like Monday) |
| **Function Access** | Dashboard → Click card | Sidebar → Click function |
| **Goal Visibility** | Separate page | Collapsed header (always visible) |
| **Initiatives** | Table hidden behind toggle | Table is default |
| **Tasks** | Not implemented | Nested rows (optional expand) |
| **Settings** | Separate page | Dropdown menu |
| **Weekly Updates** | Manual inline edit | Quick flow wizard + inline |
| **Clicks to Initiatives** | 2-3 clicks | 1 click |
| **Context Switching** | High (many pages) | Low (tabs in one view) |

---

## Implementation Phases

### Phase 1: Core Restructure (1 week)
- [ ] Create dedicated Leadership layout with sidebar
- [ ] Move to table-first view (default)
- [ ] Add function sidebar with quick navigation
- [ ] Implement tab navigation (Initiatives/Plans/Reports)

### Phase 2: Integration (1 week)
- [ ] Add goal context header (collapsed)
- [ ] Integrate annual/quarterly planning as tabs
- [ ] Move settings to dropdown
- [ ] Add quick action buttons everywhere

### Phase 3: Polish (3 days)
- [ ] Weekly update flow enhancement
- [ ] Keyboard shortcuts
- [ ] Mobile responsiveness
- [ ] Performance optimization

---

## Questions for Alignment

1. **Layout Preference:**
   - Option A (Dedicated Leadership app) - Feels like entering Monday.com
   - Option B (Sub-sidebar) - Stays integrated with main app
   - Your preference?

2. **Default View:**
   - Agree table should be default? (vs cards)
   - Show goals at top always, or tab only?

3. **Tasks:**
   - Implement nested task rows (like Monday)?
   - Or keep initiative-level only for now?

4. **Weekly Updates:**
   - Quick wizard flow (bottom drawer)?
   - Enhanced inline editing only?
   - Both options available?

5. **Settings:**
   - Dropdown from top bar?
   - Dedicated settings tab?
   - Separate page (current)?

6. **Mobile:**
   - Priority for Phase 1?
   - Or desktop-first, mobile later?

---

## Key Objective Alignment

> "Create transparency between key priorities and weekly/monthly progress while making it super easy to report on updates without creating overdemanding bureaucracy"

**How This Design Achieves It:**

✅ **Transparency:** Goals always visible at top + initiatives linked below
✅ **Easy Updates:** Inline editing + optional quick wizard
✅ **No Bureaucracy:** Direct table editing, no forms unless needed
✅ **Context:** Everything in one view, no page switching
✅ **Speed:** 1 click to your function, instant table view
✅ **Familiarity:** Looks and feels like Monday.com (proven UX)

---

Let me know your thoughts on this approach and we can iterate on the design before building!
