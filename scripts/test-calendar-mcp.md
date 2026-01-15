# Calendar Testing Script (Chrome DevTools MCP)

Run these tests after restarting Claude Code with Chrome DevTools MCP enabled.

## Pre-requisites
- Chrome DevTools MCP connected (`claude mcp list` shows it connected)
- User logged into the app (may need to login first)

---

## Test 1: Calendar Page Load

**Steps:**
1. Navigate to https://discount-fence-hub.netlify.app/schedule
2. Wait for page to fully load
3. Take a screenshot

**Expected Results:**
- FullCalendar renders with resource timeline view
- Crews listed as rows under "CREWS" group
- Sales reps listed under "SALES REPS" group
- Header shows "Schedule" title with legend

---

## Test 2: Unscheduled Jobs Sidebar

**Steps:**
1. On the schedule page, look for the sidebar on the right
2. Check if it shows "Unscheduled Jobs" header
3. Take a screenshot of the sidebar area

**Expected Results:**
- Sidebar visible on right side (~280px wide)
- Shows list of jobs with:
  - Job number
  - Client name
  - Footage (LF)
  - Product type
  - Location/community
- Footer shows count of unscheduled jobs
- Each job card has a drag handle (grip icon)

---

## Test 3: Crew Capacity Display

**Steps:**
1. Look at crew resource labels in the left column
2. Check for capacity indicators under crew names

**Expected Results:**
- Each crew shows:
  - Crew name
  - Mini progress bar (green/yellow/red based on utilization)
  - Available footage text (e.g., "180 LF")
  - Job count in parentheses if > 0

---

## Test 4: Calendar Navigation

**Steps:**
1. Click "Today" button
2. Click "prev" arrow to go to previous week
3. Click "next" arrow to go to next week
4. Switch views: Day, Week, Month, List

**Expected Results:**
- Calendar updates smoothly
- Events re-render for new date range
- View changes correctly

---

## Test 5: Create Schedule Entry (Click)

**Steps:**
1. Click on an empty time slot on a crew's row
2. Check if modal opens

**Expected Results:**
- ScheduleEntryModal opens in "create" mode
- Crew is pre-selected based on clicked row
- Date/time pre-filled based on clicked slot
- Entry type defaults to "job_visit" for crews

---

## Test 6: Sidebar Collapse/Expand

**Steps:**
1. Click the collapse button (×) in sidebar header
2. Sidebar should collapse to ~48px width
3. Click expand button (chevron) to re-open

**Expected Results:**
- Sidebar collapses showing only truck icon
- Expand button appears on collapsed state
- Sidebar expands back to full width

---

## Test 7: Console Errors Check

**Steps:**
1. Open browser console
2. Navigate through the calendar
3. Check for any JavaScript errors

**Expected Results:**
- No critical errors in console
- Warnings acceptable (e.g., React dev warnings)

---

## Test 8: Drag-Drop from Sidebar (if jobs exist)

**Steps:**
1. If unscheduled jobs exist in sidebar
2. Drag a job card onto a crew's timeline
3. Release on a specific date/time

**Expected Results:**
- Job creates a new schedule_entry in database
- Event appears on calendar
- Sidebar updates (job removed from list)
- Toast/notification confirms creation

---

## Prompt to Use After Restart

Copy and paste this after restarting Claude Code:

```
Use Chrome DevTools MCP to test the calendar at https://discount-fence-hub.netlify.app/schedule

1. Navigate to the schedule page and take a screenshot
2. Check if the calendar loads with crews as rows
3. Verify the unscheduled jobs sidebar is visible on the right
4. Check if capacity bars appear under crew names
5. Look for any console errors
6. Try clicking on an empty slot to see if the create modal opens

Report what you find with screenshots.
```

---

## Manual Testing Checklist

If MCP testing has issues, verify manually:

- [ ] Calendar renders (not blank)
- [ ] Crews appear as rows
- [ ] Sales reps appear as rows
- [ ] Sidebar visible on right
- [ ] Jobs listed in sidebar (if any unscheduled)
- [ ] Capacity bars under crew names
- [ ] Can click to create entry
- [ ] Can drag events to reschedule
- [ ] Can drag from sidebar to schedule
- [ ] No console errors
