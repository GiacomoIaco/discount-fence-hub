# Discount Fence Hub - Yard Workflow Training Guide

## Overview

This guide covers the complete workflow from creating fence SKUs to picking materials in the yard. The system helps operations staff create accurate material lists and enables yard workers to efficiently pick and stage materials for installation crews.

---

## Part 1: Operations Staff Workflow

### Step 1: SKU Management (One-Time Setup)

SKUs (Stock Keeping Units) are pre-configured fence types that automatically calculate required materials based on footage.

**To access SKU management:**
1. Go to **BOM Calculator** from the main menu
2. Click **SKU Catalog** in the sidebar

**SKU Catalog features:**
- View all available fence SKUs
- Each SKU includes: fence style, height, post spacing, materials list
- SKUs are organized by category (Wood, Chain Link, Iron, etc.)

**To create new SKUs:**
1. Click **SKU Builder** in the sidebar
2. Select fence type, style, height, and options
3. Configure materials and quantities per foot
4. Save to catalog for reuse

---

### Step 2: Creating a Project

Projects represent customer jobs that need materials picked and staged.

**To create a new project:**

1. Go to **BOM Calculator** > **Calculator**
2. Fill in project details:
   - **Project Name**: Customer name or job identifier
   - **Customer**: Customer name
   - **Business Unit**: Select your location (ATX-HB, HOU-RES, etc.)
   - **Yard**: Where materials will be picked from
   - **Expected Pickup Date**: When the crew needs materials

3. Add SKU Lines:
   - Search for the fence SKU
   - Enter **Footage** for each line
   - Adjust **Buffer %** if needed (default 5%)
   - Set **Lines** (number of separate fence runs)
   - Set **Gates** count

4. Review the auto-calculated **Materials (BOM)** section
   - Materials are calculated based on SKU formulas
   - Adjust quantities if needed using the ADJ column

5. Click **Save Project** (or **Save Draft** to continue later)

---

### Step 3: Sending to Yard

Once a project is saved and ready for picking:

1. Go to **BOM Calculator** > **Projects**
2. Find the project in the list
3. Click the **Send to Yard** button
4. The project status changes to "Sent to Yard"

The project now appears in:
- **Pick Lists** (desktop view for yard managers)
- **Mobile View** (for yard workers)

---

### Step 4: Managing Pick Lists (Desktop)

The Pick Lists page shows all projects ready for picking.

**To access:**
1. Go to **BOM Calculator** > **Pick Lists**

**Features:**
- Filter by **Yard**, **Date**, and **Status**
- Quick stats show counts: To Stage, Picking, Staged, Loaded
- Each project card shows:
  - Project code and name
  - Customer info
  - Expected pickup date
  - Assigned crew (if set)
  - **Who is picking** (orange icon with name and progress)
  - Current status

**Actions available:**
- **View Pick List**: See all materials needed
- **Print PDF**: Generate 3 copies for paper workflow
- **Crew Sign-off**: Capture signature when crew picks up
- **Assign Spot**: Select yard staging spot
- **Mark Loaded/Complete**: Update status

**Status Flow:**
```
Sent to Yard → Picking → Staged → Loaded → Complete
```

---

## Part 2: Yard Worker Workflow (Mobile)

### Accessing Mobile View

**For Yard Role Users:**
- Log in with your yard account - you'll automatically land on Mobile View
- No navigation needed!

**For Other Users:**
1. Go to **BOM Calculator** > **Mobile View**
2. Or access directly on your phone at the app URL

The mobile view is optimized for phones with large touch targets.

---

### Understanding Staging Priority

The system automatically calculates when materials need to be staged based on the job pickup date (2 business days before, skipping weekends).

**Urgency Badges:**
| Badge | Meaning | Action |
|-------|---------|--------|
| 🔴 **OVERDUE** | Past staging target date | Stage immediately! |
| 🟠 **TODAY** | Stage today | High priority |
| 🟡 **TOMORROW** | Stage tomorrow | Plan ahead |
| 🟢 **FUTURE** | 2+ days out | Lower priority |

**Filter Buttons** at the top let you focus on:
- **All** - See everything
- **Urgent** - Overdue + Today only
- **Stage Today** - Just today's staging
- **Tomorrow** - Tomorrow's staging

Projects are automatically sorted by urgency (overdue first).

---

### Step 1: Claiming a Job

**Option A: Scan QR Code (Fastest)**
1. Grab a printed pick list from the folder
2. Scan the **QR code** with your phone camera
3. The app opens directly to that project
4. Tap **Claim & Pick** to start

**Option B: Enter Code Manually**
1. Note the **Project Code** (e.g., "AAA-028") on the pick list
2. Enter the code in the "Enter Project Code" field
3. Tap **GO**
4. Review the project details in the popup
5. Tap **Claim & Pick** to start

**Option C: Select from List**
1. Browse the unclaimed jobs list
2. Look for urgent items (red/orange badges)
3. Tap **Claim** on any job

**Important:** Claiming a job prevents others from working on the same project simultaneously.

---

### Step 2: Picking Materials

After claiming, the Pick List Viewer opens showing all materials needed.

**Two View Options:**
- **Category View**: Materials grouped by type (Posts, Rails, Pickets, etc.)
- **Location View**: Materials grouped by yard area/slot

**To pick items:**
1. Find the material in the list
2. Tap the row to mark it as picked (green checkmark)
3. Tap again to unmark if needed
4. Progress is shown at the bottom: "X of Y items picked"

**Your progress is automatically saved!** If you need to stop:
- Your checked items are saved
- You or another worker can continue later

---

### Step 3: Managing Your Jobs

The **My Jobs** section shows all projects you've claimed.

**For each job you can:**
- **Open Pick List**: Continue picking items
- **Print**: Generate PDF if needed
- **Release**: Let someone else finish the job

**Releasing a Job:**
1. Tap **Release** on a job
2. Confirm in the popup
3. Your progress is saved for the next person

---

### Step 4: Assigning Yard Spots

Once materials are staged:

1. Find the job in your list
2. Select a **Yard Spot** from the dropdown
3. The spot is marked as occupied

---

### Step 5: Marking Complete

**From Mobile View:**
- Tap **Mark Loaded** when materials are on the truck
- Tap **Mark Complete** after crew picks up

**From Desktop Pick Lists:**
- Use the status buttons on each project card

---

## Quick Reference

### Project Statuses

| Status | Meaning | Color |
|--------|---------|-------|
| Draft | Project not finalized | Gray |
| Ready | Saved, not sent to yard | Purple |
| Sent to Yard | Ready for picking | Amber |
| Picking | Worker actively picking | Orange |
| Staged | Materials in yard spot | Blue |
| Loaded | On truck, ready for crew | Green |
| Complete | Crew picked up | Gray |

### Key Locations in the App

| Task | Location |
|------|----------|
| Create SKUs | BOM Calculator > SKU Builder |
| View SKU Catalog | BOM Calculator > SKU Catalog |
| Create Projects | BOM Calculator > Calculator |
| View All Projects | BOM Calculator > Projects |
| Manage Pick Lists | BOM Calculator > Pick Lists |
| Yard Worker Mobile | BOM Calculator > Mobile View |
| Manage Yard Spots | BOM Calculator > Yard Spots |
| Manage Stocking Areas | BOM Calculator > Stocking Areas |

---

## Tips for Yard Workers

1. **Check urgency badges first** - Red/orange items need immediate attention
2. **Use QR code scanning** - Fastest way to claim a job from printed pick list
3. **Always claim before picking** - This prevents duplicate work
4. **Check items as you go** - Progress saves automatically
5. **Release if you can't finish** - Your progress is saved for the next person
6. **Use Location view** - Walk the yard efficiently by area
7. **Use filters** - "Urgent" button shows only what needs staging now
8. **Paper backup** - The printed list works if the app has issues

---

## Tips for Operations Staff

1. **Print multiple copies** - The PDF generates 3 copies by default
2. **Set pickup dates** - Helps yard prioritize work
3. **Assign crews** - So yard knows who's picking up
4. **Monitor Pick Lists** - See who's working on what in real-time
5. **Use bundles** - Group related projects together

---

## Troubleshooting

**"Project not found" when entering code:**
- Check the code matches exactly (case-sensitive)
- Verify the project was sent to yard
- Try refreshing the page

**Can't claim a job:**
- Someone else may have claimed it
- Check "Others Picking" section to see who

**Progress not saving:**
- Check internet connection
- Try refreshing and re-opening the pick list

**Need help?**
Contact your supervisor or IT support.

---

*Document Version: 1.1*
*Last Updated: December 2024*

**Version 1.1 Changes:**
- Added staging priority system (urgency badges)
- Added QR code scanning for quick job claiming
- Added yard role with automatic Mobile View access
- Added urgency filter buttons
