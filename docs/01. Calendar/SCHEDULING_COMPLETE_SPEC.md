# Complete Scheduling & Dispatch System
## Discount Fence USA - FSM Platform

**Version:** 2.0  
**Created:** December 2024  
**For:** Claude Code Implementation  
**Status:** Ready for Implementation

---

## Table of Contents

1. [Executive Summary](#part-1-executive-summary)
2. [Technology Stack](#part-2-technology-stack)
3. [Database Schema](#part-3-database-schema)
4. [Business Logic Layer](#part-4-business-logic-layer)
5. [Calendar UI Implementation](#part-5-calendar-ui-implementation)
6. [iCal Calendar Sync](#part-6-ical-calendar-sync)
7. [API Endpoints](#part-7-api-endpoints)
8. [React Components](#part-8-react-components)
9. [Implementation Plan](#part-9-implementation-plan)

---

## Part 1: Executive Summary

### What We're Building

A professional-grade scheduling and dispatch system for fence installation operations that:

1. **Schedules Assessments** - Sales rep site visits
2. **Schedules Jobs** - Crew installation work (multi-day supported)
3. **Calculates Duration** - Based on SKU hours per 100 linear feet
4. **Suggests Assignments** - Rep/Crew recommendations based on community preferences, territory, and skills
5. **Tracks Capacity** - Linear footage per day per crew
6. **Syncs to Outlook/Google** - Via iCal feed subscription

### Key Differentiators

| Feature | Generic FSM | Our Approach |
|---------|-------------|--------------|
| Duration Calculation | Fixed hours | **SKU-based hours/100LF** |
| Capacity Tracking | Time-based | **Linear Footage + Time** |
| Rep Assignment | Manual | **Community preference → Territory → Availability** |
| Crew Assignment | Skill-based | **Territory + Skill + Fence Type + Capacity** |
| External Calendar | None or paid add-on | **iCal feeds (free, universal)** |
| Material Status | Not integrated | **Full yard pipeline integration** |

---

## Part 2: Technology Stack

### Primary Library: FullCalendar

```bash
npm install @fullcalendar/core @fullcalendar/react @fullcalendar/daygrid \
  @fullcalendar/timegrid @fullcalendar/interaction @fullcalendar/list \
  @fullcalendar/resource @fullcalendar/resource-timeline
```

**Why FullCalendar:**
- Superior TypeScript support with comprehensive type definitions
- Active development and regular updates (vs React Big Schedule's stale releases)
- Native resource-timeline plugin for crew/rep rows
- Excellent mobile responsiveness out of the box
- Rich ecosystem with premium plugins if needed later
- Better documentation and community support

**Note:** The core library is free. Premium plugins ($599/year) only needed for advanced features like resource-timeline - evaluate if free plugins meet needs first.

### Supporting Libraries

```bash
# Already in your stack
date-fns              # Date manipulation
@tanstack/react-query # Server state management (use this instead of Zustand!)

# New additions
npm install @dnd-kit/core @dnd-kit/sortable    # Enhanced drag-drop for sidebar
npm install ical-generator                      # iCal feed generation
npm install @tanstack/react-virtual             # Performance for large calendars
```

**State Management Note:** Use TanStack Query for all server state (schedule entries, capacity data, suggestions). Only add Zustand later if complex client-only UI state emerges (e.g., multi-step modal wizards). Start simple.

### File Structure

```
src/features/schedule/
├── pages/
│   └── SchedulePage.tsx
├── components/
│   ├── calendar/
│   │   ├── ScheduleCalendar.tsx         # Main calendar wrapper
│   │   ├── ScheduleHeader.tsx           # Date nav, view toggle, filters
│   │   ├── EventCard.tsx                # Custom event rendering
│   │   └── CapacityBar.tsx              # Daily LF capacity visualization
│   ├── sidebar/
│   │   ├── UnscheduledSidebar.tsx       # Jobs/Assessments awaiting scheduling
│   │   ├── UnscheduledJobCard.tsx       # Draggable job card
│   │   └── UnscheduledAssessmentCard.tsx
│   ├── modals/
│   │   ├── QuickScheduleModal.tsx       # "Find a Time" with suggestions
│   │   ├── EditScheduleModal.tsx        # Edit existing entry
│   │   └── CalendarSyncModal.tsx        # iCal feed setup
│   └── filters/
│       ├── FilterBar.tsx
│       └── FilterPresets.tsx
├── hooks/
│   ├── useScheduleEntries.ts
│   ├── useCrewCapacity.ts
│   ├── useUnscheduledItems.ts
│   ├── useAssignmentSuggestions.ts
│   └── useDurationCalculator.ts
├── utils/
│   ├── durationCalculator.ts            # SKU-based duration calc
│   ├── assignmentSuggester.ts           # Rep/Crew suggestions
│   ├── capacityUtils.ts
│   ├── icalGenerator.ts                 # Calendar feed generation
│   └── colorUtils.ts
├── types/
│   └── schedule.types.ts
└── api/
    ├── scheduleApi.ts
    └── calendarFeedApi.ts
```

> **Note:** No dedicated store needed - TanStack Query handles server state. If complex UI state emerges, add `store/scheduleUIStore.ts` later.

---

## Part 3: Database Schema

### 3.1 Core Schedule Tables

```sql
-- ============================================================================
-- SCHEDULE ENTRIES
-- Main table for all scheduled items
-- ============================================================================
CREATE TABLE schedule_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Type of schedule item
  entry_type TEXT NOT NULL CHECK (entry_type IN (
    'job_visit',      -- Installation work
    'assessment',     -- Sales rep site visit
    'blocked',        -- Time off, vacation
    'meeting',        -- Team meetings
    'travel'          -- Travel time (calculated)
  )),
  
  -- Reference to source entity
  job_id UUID REFERENCES jobs(id) ON DELETE CASCADE,
  service_request_id UUID REFERENCES service_requests(id) ON DELETE CASCADE,
  
  -- Assignment
  crew_id UUID REFERENCES crews(id),
  sales_rep_id UUID REFERENCES sales_reps(id),
  
  -- Timing
  scheduled_date DATE NOT NULL,
  start_time TIME,
  end_time TIME,
  is_all_day BOOLEAN DEFAULT false,
  
  -- Multi-day support
  is_multi_day BOOLEAN DEFAULT false,
  multi_day_sequence INTEGER,          -- Day 1, Day 2, etc.
  parent_entry_id UUID REFERENCES schedule_entries(id),  -- Links multi-day entries
  total_days INTEGER DEFAULT 1,
  
  -- Capacity tracking (for jobs)
  estimated_footage INTEGER,           -- Linear feet for this visit
  estimated_hours DECIMAL(4,2),        -- Calculated from SKU rates
  
  -- Status workflow
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN (
    'unscheduled',    -- Created but no date/time
    'scheduled',      -- Date/time assigned
    'confirmed',      -- Customer confirmed
    'en_route',       -- Crew/rep traveling
    'arrived',        -- On site
    'in_progress',    -- Work started
    'completed',      -- Done
    'cancelled',      -- Cancelled
    'rescheduled'     -- Moved (keeps history)
  )),
  
  -- Display
  title TEXT,
  notes TEXT,
  color TEXT,                          -- Override crew color if needed
  
  -- Location (denormalized for quick access)
  location_address TEXT,
  location_city TEXT,
  location_lat DECIMAL(10,8),
  location_lng DECIMAL(11,8),
  
  -- Metadata
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT valid_assignment CHECK (
    (entry_type = 'job_visit' AND crew_id IS NOT NULL) OR
    (entry_type = 'assessment' AND sales_rep_id IS NOT NULL) OR
    (entry_type IN ('blocked', 'meeting', 'travel'))
  )
);

-- Indexes for common queries
CREATE INDEX idx_schedule_entries_date ON schedule_entries(scheduled_date);
CREATE INDEX idx_schedule_entries_crew ON schedule_entries(crew_id, scheduled_date);
CREATE INDEX idx_schedule_entries_rep ON schedule_entries(sales_rep_id, scheduled_date);
CREATE INDEX idx_schedule_entries_job ON schedule_entries(job_id);
CREATE INDEX idx_schedule_entries_status ON schedule_entries(status);

-- ============================================================================
-- CREW DAILY CAPACITY
-- Pre-calculated daily capacity for quick lookups
-- ============================================================================
CREATE TABLE crew_daily_capacity (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  crew_id UUID NOT NULL REFERENCES crews(id),
  capacity_date DATE NOT NULL,
  
  -- Footage capacity
  max_footage INTEGER NOT NULL DEFAULT 300,       -- Crew's max LF per day
  scheduled_footage INTEGER NOT NULL DEFAULT 0,   -- Sum of scheduled jobs
  available_footage INTEGER GENERATED ALWAYS AS (max_footage - scheduled_footage) STORED,
  
  -- Hour capacity
  max_hours DECIMAL(4,2) NOT NULL DEFAULT 10.0,
  scheduled_hours DECIMAL(4,2) NOT NULL DEFAULT 0,
  available_hours DECIMAL(4,2) GENERATED ALWAYS AS (max_hours - scheduled_hours) STORED,
  
  -- Utilization
  utilization_percent INTEGER GENERATED ALWAYS AS (
    CASE WHEN max_footage > 0 
    THEN ROUND((scheduled_footage::DECIMAL / max_footage) * 100)
    ELSE 0 END
  ) STORED,
  
  -- Status flags
  is_available BOOLEAN DEFAULT true,              -- Not blocked/vacation
  is_over_capacity BOOLEAN GENERATED ALWAYS AS (scheduled_footage > max_footage) STORED,
  
  -- Jobs scheduled
  job_count INTEGER NOT NULL DEFAULT 0,
  
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(crew_id, capacity_date)
);

-- Index for capacity lookups
CREATE INDEX idx_crew_capacity_lookup ON crew_daily_capacity(crew_id, capacity_date);
CREATE INDEX idx_crew_capacity_available ON crew_daily_capacity(capacity_date, is_available, available_footage);

-- ============================================================================
-- TRIGGER: Auto-update crew_daily_capacity when schedule_entries change
-- ============================================================================
CREATE OR REPLACE FUNCTION update_crew_daily_capacity()
RETURNS TRIGGER AS $$
BEGIN
  -- Handle INSERT or UPDATE
  IF TG_OP IN ('INSERT', 'UPDATE') AND NEW.crew_id IS NOT NULL THEN
    INSERT INTO crew_daily_capacity (crew_id, capacity_date, scheduled_footage, scheduled_hours, job_count)
    SELECT 
      NEW.crew_id,
      NEW.scheduled_date,
      COALESCE(SUM(estimated_footage), 0),
      COALESCE(SUM(estimated_hours), 0),
      COUNT(*)
    FROM schedule_entries
    WHERE crew_id = NEW.crew_id 
      AND scheduled_date = NEW.scheduled_date
      AND entry_type = 'job_visit'
      AND status NOT IN ('cancelled', 'rescheduled')
    ON CONFLICT (crew_id, capacity_date) 
    DO UPDATE SET
      scheduled_footage = EXCLUDED.scheduled_footage,
      scheduled_hours = EXCLUDED.scheduled_hours,
      job_count = EXCLUDED.job_count,
      updated_at = NOW();
  END IF;
  
  -- Handle DELETE or UPDATE (old values)
  IF TG_OP IN ('DELETE', 'UPDATE') AND OLD.crew_id IS NOT NULL THEN
    INSERT INTO crew_daily_capacity (crew_id, capacity_date, scheduled_footage, scheduled_hours, job_count)
    SELECT 
      OLD.crew_id,
      OLD.scheduled_date,
      COALESCE(SUM(estimated_footage), 0),
      COALESCE(SUM(estimated_hours), 0),
      COUNT(*)
    FROM schedule_entries
    WHERE crew_id = OLD.crew_id 
      AND scheduled_date = OLD.scheduled_date
      AND entry_type = 'job_visit'
      AND status NOT IN ('cancelled', 'rescheduled')
    ON CONFLICT (crew_id, capacity_date) 
    DO UPDATE SET
      scheduled_footage = EXCLUDED.scheduled_footage,
      scheduled_hours = EXCLUDED.scheduled_hours,
      job_count = EXCLUDED.job_count,
      updated_at = NOW();
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_crew_capacity
AFTER INSERT OR UPDATE OR DELETE ON schedule_entries
FOR EACH ROW EXECUTE FUNCTION update_crew_daily_capacity();
```

### 3.2 Duration & Assignment Tables

```sql
-- ============================================================================
-- SKU DURATION RATES
-- Hours per 100 linear feet by SKU
-- ============================================================================
CREATE TABLE sku_duration_rates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sku_id UUID NOT NULL REFERENCES skus(id),
  
  -- Base duration rate
  hours_per_100lf DECIMAL(4,2) NOT NULL,    -- e.g., 4.5 hours per 100 LF
  
  -- Standard crew size for this rate
  base_crew_size INTEGER DEFAULT 2,
  
  -- Fence type (for filtering/reporting)
  fence_type TEXT NOT NULL,                  -- 'wood_vertical', 'wood_horizontal', 'iron', 'chain_link'
  
  -- Height adjustments (JSON map)
  -- {"4ft": 0.8, "6ft": 1.0, "8ft": 1.3}
  height_adjustments JSONB DEFAULT '{"6ft": 1.0}'::jsonb,
  
  -- Terrain adjustments (JSON map)
  -- {"flat": 1.0, "sloped": 1.2, "rocky": 1.5}
  terrain_adjustments JSONB DEFAULT '{"flat": 1.0}'::jsonb,
  
  -- Crew size adjustments (if different from base)
  -- {"1": 1.8, "2": 1.0, "3": 0.75, "4": 0.6}
  crew_size_adjustments JSONB DEFAULT '{"2": 1.0}'::jsonb,
  
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(sku_id)
);

-- Seed data for common fence types
INSERT INTO sku_duration_rates (sku_id, fence_type, hours_per_100lf, height_adjustments, terrain_adjustments, notes) VALUES
-- Wood Vertical
('wood-vert-4-sku-id', 'wood_vertical', 4.0, '{"4ft": 1.0}', '{"flat": 1.0, "sloped": 1.2, "rocky": 1.5}', 'Wood vertical 4ft'),
('wood-vert-6-sku-id', 'wood_vertical', 5.0, '{"6ft": 1.0}', '{"flat": 1.0, "sloped": 1.2, "rocky": 1.5}', 'Wood vertical 6ft'),
('wood-vert-8-sku-id', 'wood_vertical', 6.5, '{"8ft": 1.0}', '{"flat": 1.0, "sloped": 1.25, "rocky": 1.6}', 'Wood vertical 8ft'),

-- Wood Horizontal
('wood-horiz-6-sku-id', 'wood_horizontal', 6.0, '{"6ft": 1.0}', '{"flat": 1.0, "sloped": 1.25}', 'Wood horizontal 6ft - more complex'),
('wood-horiz-8-sku-id', 'wood_horizontal', 7.5, '{"8ft": 1.0}', '{"flat": 1.0, "sloped": 1.25}', 'Wood horizontal 8ft'),

-- Iron/Ornamental
('iron-4-sku-id', 'iron', 3.5, '{"4ft": 1.0}', '{"flat": 1.0, "sloped": 1.15}', 'Iron 4ft - faster install'),
('iron-6-sku-id', 'iron', 4.0, '{"6ft": 1.0}', '{"flat": 1.0, "sloped": 1.15}', 'Iron 6ft'),

-- Chain Link
('chain-4-sku-id', 'chain_link', 2.5, '{"4ft": 1.0}', '{"flat": 1.0, "sloped": 1.1}', 'Chain link 4ft - fastest'),
('chain-6-sku-id', 'chain_link', 3.0, '{"6ft": 1.0}', '{"flat": 1.0, "sloped": 1.1}', 'Chain link 6ft');

-- ============================================================================
-- GATE DURATION RATES
-- Fixed hours per gate by type
-- ============================================================================
CREATE TABLE gate_duration_rates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  gate_type TEXT NOT NULL,                  -- 'single_walk', 'double_drive', 'sliding', 'cantilever'
  fence_type TEXT,                          -- NULL = all fence types, or specific type
  
  hours_per_gate DECIMAL(4,2) NOT NULL,     -- e.g., 1.5 hours per gate
  
  -- Width adjustments
  -- {"3ft": 0.8, "4ft": 1.0, "6ft": 1.3, "12ft": 2.0, "16ft": 2.5}
  width_adjustments JSONB DEFAULT '{"4ft": 1.0}'::jsonb,
  
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(gate_type, fence_type)
);

-- Seed data
INSERT INTO gate_duration_rates (gate_type, fence_type, hours_per_gate, width_adjustments, notes) VALUES
('single_walk', 'wood_vertical', 1.0, '{"3ft": 0.8, "4ft": 1.0, "5ft": 1.2}', 'Standard walk gate'),
('single_walk', 'wood_horizontal', 1.5, '{"3ft": 0.9, "4ft": 1.0, "5ft": 1.3}', 'Horizontal more complex'),
('single_walk', 'iron', 1.5, '{"3ft": 0.8, "4ft": 1.0, "5ft": 1.2}', 'Iron walk gate'),
('double_drive', 'wood_vertical', 2.5, '{"8ft": 0.9, "10ft": 1.0, "12ft": 1.3, "16ft": 1.8}', 'Double drive gate'),
('double_drive', 'iron', 3.0, '{"8ft": 0.9, "10ft": 1.0, "12ft": 1.3, "16ft": 1.8}', 'Iron drive gate'),
('sliding', NULL, 4.0, '{"10ft": 0.9, "12ft": 1.0, "16ft": 1.4, "20ft": 1.8}', 'Sliding gate - all fence types'),
('cantilever', NULL, 5.0, '{"12ft": 1.0, "16ft": 1.3, "20ft": 1.6, "24ft": 2.0}', 'Cantilever - most complex');

-- ============================================================================
-- COMMUNITY REP PREFERENCES
-- Preferred sales rep and crew by community (builder relationship)
-- ============================================================================
CREATE TABLE community_rep_preferences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  community_id UUID NOT NULL REFERENCES communities(id),
  
  -- Preferred assignments
  preferred_rep_id UUID REFERENCES sales_reps(id),
  preferred_crew_id UUID REFERENCES crews(id),
  
  -- How strongly to enforce
  preference_level TEXT DEFAULT 'preferred' CHECK (preference_level IN (
    'required',       -- Must use this rep/crew
    'preferred',      -- Strongly suggest
    'suggested'       -- Nice to have
  )),
  
  -- Context
  reason TEXT,                              -- "Builder relationship", "HOA contact", etc.
  notes TEXT,
  
  -- Tracking
  assigned_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(community_id)
);

-- ============================================================================
-- TERRITORY ZIP CODES
-- Territory assignments for rep/crew suggestions
-- ============================================================================
CREATE TABLE territory_assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  territory_id UUID NOT NULL REFERENCES territories(id),
  zip_code TEXT NOT NULL,
  
  -- Primary assignments for this zip
  primary_rep_id UUID REFERENCES sales_reps(id),
  primary_crew_id UUID REFERENCES crews(id),
  backup_crew_id UUID REFERENCES crews(id),
  
  -- For route optimization
  avg_drive_time_from_yard INTEGER,         -- Minutes from main yard
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(zip_code)
);

-- ============================================================================
-- CREW SKILLS
-- Crew certifications/skills by fence type (affects duration and suggestions)
-- ============================================================================
CREATE TABLE crew_skills (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  crew_id UUID NOT NULL REFERENCES crews(id),
  
  fence_type TEXT NOT NULL,                 -- 'wood_vertical', 'wood_horizontal', 'iron', 'chain_link'
  
  -- Skill level affects duration calculation
  skill_level TEXT DEFAULT 'standard' CHECK (skill_level IN (
    'trainee',        -- 1.2x duration
    'standard',       -- 1.0x duration  
    'expert'          -- 0.85x duration
  )),
  
  -- Multiplier (calculated from skill_level, but can be overridden)
  duration_multiplier DECIMAL(3,2) DEFAULT 1.0,
  
  certified_at DATE,
  certified_by UUID REFERENCES auth.users(id),
  notes TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(crew_id, fence_type)
);

-- Default skill multipliers trigger
CREATE OR REPLACE FUNCTION set_default_skill_multiplier()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.duration_multiplier IS NULL OR NEW.duration_multiplier = 1.0 THEN
    NEW.duration_multiplier := CASE NEW.skill_level
      WHEN 'trainee' THEN 1.2
      WHEN 'standard' THEN 1.0
      WHEN 'expert' THEN 0.85
      ELSE 1.0
    END;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_set_skill_multiplier
BEFORE INSERT OR UPDATE ON crew_skills
FOR EACH ROW EXECUTE FUNCTION set_default_skill_multiplier();
```

### 3.3 Calendar Sync Tables

```sql
-- ============================================================================
-- USER CALENDAR TOKENS
-- For iCal feed subscriptions (Outlook, Google, Apple Calendar)
-- ============================================================================
CREATE TABLE user_calendar_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  
  -- Secure token for feed URL
  token TEXT NOT NULL UNIQUE DEFAULT ('cal_' || replace(gen_random_uuid()::text, '-', '')),
  
  -- Feed preferences
  include_jobs BOOLEAN DEFAULT true,
  include_assessments BOOLEAN DEFAULT true,
  include_meetings BOOLEAN DEFAULT true,
  include_blocked_time BOOLEAN DEFAULT false,
  
  -- Scope: only items assigned to this user, or broader?
  scope TEXT DEFAULT 'assigned' CHECK (scope IN (
    'assigned',       -- Only items assigned to this user
    'team',           -- All items for user's team/crews
    'all'             -- All items (admin only)
  )),
  
  -- Security
  is_active BOOLEAN DEFAULT true,
  last_accessed_at TIMESTAMPTZ,
  access_count INTEGER DEFAULT 0,
  
  -- Rate limiting
  last_generated_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(user_id)
);

-- Create token on new user (if needed)
CREATE INDEX idx_calendar_tokens_token ON user_calendar_tokens(token) WHERE is_active = true;

-- ============================================================================
-- CALENDAR SYNC LOG
-- Track when feeds are accessed (for debugging/analytics)
-- ============================================================================
CREATE TABLE calendar_sync_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  token_id UUID NOT NULL REFERENCES user_calendar_tokens(id),
  
  accessed_at TIMESTAMPTZ DEFAULT NOW(),
  user_agent TEXT,
  ip_address INET,
  event_count INTEGER,                      -- How many events were returned
  
  -- Performance
  generation_time_ms INTEGER
);

-- Auto-cleanup old logs (keep 30 days)
CREATE INDEX idx_sync_log_cleanup ON calendar_sync_log(accessed_at);
```

---

## Part 4: Business Logic Layer

### 4.1 Duration Calculator

```typescript
// src/features/schedule/utils/durationCalculator.ts

import { supabase } from '@/lib/supabase';

// ============================================================================
// TYPES
// ============================================================================

export interface DurationLineItem {
  skuId: string;
  footage: number;
  height?: number;           // feet (4, 6, 8)
  gateType?: string;         // 'single_walk', 'double_drive', 'sliding', 'cantilever'
  gateWidth?: number;        // feet
  gateCount?: number;
}

export interface DurationInput {
  lineItems: DurationLineItem[];
  crewId?: string;
  crewSize?: number;
  terrain?: 'flat' | 'sloped' | 'rocky';
}

export interface DurationBreakdown {
  skuName: string;
  fenceType: string;
  footage: number;
  baseHours: number;
  adjustedHours: number;
  adjustments: {
    type: string;
    label: string;
    multiplier: number;
  }[];
}

export interface DurationResult {
  totalHours: number;
  totalDays: number;                        // Based on effective work hours
  effectiveHoursPerDay: number;             // Used in calculation (default 7)
  breakdown: DurationBreakdown[];
  gateBreakdown: {
    gateType: string;
    count: number;
    hoursPerGate: number;
    totalHours: number;
  }[];
  confidence: 'high' | 'medium' | 'low';
  warnings: string[];
  
  // For scheduling
  suggestedSchedule: {
    day: number;
    footage: number;
    hours: number;
  }[];
}

// ============================================================================
// MAIN CALCULATOR
// ============================================================================

export async function calculateJobDuration(
  input: DurationInput
): Promise<DurationResult> {
  const breakdown: DurationBreakdown[] = [];
  const gateBreakdown: DurationResult['gateBreakdown'] = [];
  const warnings: string[] = [];
  let totalHours = 0;
  let totalFootage = 0;

  // Get crew skill multiplier if crew specified
  let crewSkillMultiplier = 1.0;
  let crewFenceTypes: string[] = [];
  
  if (input.crewId) {
    const { data: skills } = await supabase
      .from('crew_skills')
      .select('fence_type, duration_multiplier')
      .eq('crew_id', input.crewId);
    
    if (skills?.length) {
      crewFenceTypes = skills.map(s => s.fence_type);
      // Use average multiplier across fence types in this job
      const relevantSkills = skills.filter(s => 
        input.lineItems.some(item => item.skuId.includes(s.fence_type))
      );
      if (relevantSkills.length) {
        crewSkillMultiplier = relevantSkills.reduce((sum, s) => 
          sum + s.duration_multiplier, 0) / relevantSkills.length;
      }
    }
  }

  // Process each line item
  for (const item of input.lineItems) {
    // Skip if this is a gate-only item
    if (item.gateType && !item.footage) {
      continue;
    }

    // Get SKU duration rate
    const { data: rate } = await supabase
      .from('sku_duration_rates')
      .select('*, skus(name)')
      .eq('sku_id', item.skuId)
      .eq('is_active', true)
      .single();

    if (!rate) {
      warnings.push(`No duration rate found for SKU. Using default 5 hrs/100LF.`);
      const defaultHours = (item.footage / 100) * 5;
      totalHours += defaultHours;
      totalFootage += item.footage;
      
      breakdown.push({
        skuName: 'Unknown SKU',
        fenceType: 'unknown',
        footage: item.footage,
        baseHours: defaultHours,
        adjustedHours: defaultHours,
        adjustments: [{ type: 'default', label: 'Default rate used', multiplier: 1.0 }],
      });
      continue;
    }

    // Base calculation: hours = (footage / 100) * hours_per_100lf
    let hours = (item.footage / 100) * rate.hours_per_100lf;
    const baseHours = hours;
    const adjustments: DurationBreakdown['adjustments'] = [];

    // Height adjustment
    if (item.height && rate.height_adjustments) {
      const heightKey = `${item.height}ft`;
      const heightMultiplier = rate.height_adjustments[heightKey];
      if (heightMultiplier && heightMultiplier !== 1.0) {
        hours *= heightMultiplier;
        adjustments.push({
          type: 'height',
          label: `Height ${item.height}ft`,
          multiplier: heightMultiplier,
        });
      }
    }

    // Terrain adjustment
    if (input.terrain && rate.terrain_adjustments) {
      const terrainMultiplier = rate.terrain_adjustments[input.terrain];
      if (terrainMultiplier && terrainMultiplier !== 1.0) {
        hours *= terrainMultiplier;
        adjustments.push({
          type: 'terrain',
          label: `Terrain: ${input.terrain}`,
          multiplier: terrainMultiplier,
        });
      }
    }

    // Crew size adjustment
    if (input.crewSize && rate.crew_size_adjustments) {
      const crewKey = String(input.crewSize);
      const crewMultiplier = rate.crew_size_adjustments[crewKey];
      if (crewMultiplier && crewMultiplier !== 1.0) {
        hours *= crewMultiplier;
        adjustments.push({
          type: 'crew_size',
          label: `Crew size: ${input.crewSize}`,
          multiplier: crewMultiplier,
        });
      }
    }

    // Crew skill adjustment
    if (crewSkillMultiplier !== 1.0) {
      hours *= crewSkillMultiplier;
      adjustments.push({
        type: 'crew_skill',
        label: `Crew skill level`,
        multiplier: crewSkillMultiplier,
      });
    }

    breakdown.push({
      skuName: rate.skus?.name || 'Unknown',
      fenceType: rate.fence_type,
      footage: item.footage,
      baseHours: Math.round(baseHours * 10) / 10,
      adjustedHours: Math.round(hours * 10) / 10,
      adjustments,
    });

    totalHours += hours;
    totalFootage += item.footage;
  }

  // Process gates
  const gateItems = input.lineItems.filter(item => item.gateType && item.gateCount);
  
  for (const gateItem of gateItems) {
    const fenceType = breakdown[0]?.fenceType || null;
    
    // Get gate rate
    const { data: gateRate } = await supabase
      .from('gate_duration_rates')
      .select('*')
      .eq('gate_type', gateItem.gateType)
      .or(`fence_type.eq.${fenceType},fence_type.is.null`)
      .eq('is_active', true)
      .order('fence_type', { ascending: false, nullsFirst: false })
      .limit(1)
      .single();

    if (!gateRate) {
      warnings.push(`No duration rate for gate type: ${gateItem.gateType}. Using default 1.5 hrs.`);
      const defaultGateHours = 1.5 * (gateItem.gateCount || 1);
      totalHours += defaultGateHours;
      
      gateBreakdown.push({
        gateType: gateItem.gateType!,
        count: gateItem.gateCount || 1,
        hoursPerGate: 1.5,
        totalHours: defaultGateHours,
      });
      continue;
    }

    let gateHours = gateRate.hours_per_gate * (gateItem.gateCount || 1);

    // Width adjustment
    if (gateItem.gateWidth && gateRate.width_adjustments) {
      const widthKey = `${gateItem.gateWidth}ft`;
      const widthMultiplier = gateRate.width_adjustments[widthKey];
      if (widthMultiplier) {
        gateHours *= widthMultiplier;
      }
    }

    gateBreakdown.push({
      gateType: gateItem.gateType!,
      count: gateItem.gateCount || 1,
      hoursPerGate: gateRate.hours_per_gate,
      totalHours: Math.round(gateHours * 10) / 10,
    });

    totalHours += gateHours;
  }

  // Calculate days
  const effectiveHoursPerDay = 7; // 8-hour day with 1 hour buffer
  const totalDays = Math.ceil(totalHours / effectiveHoursPerDay);

  // Generate suggested schedule (how to split across days)
  const suggestedSchedule = generateSuggestedSchedule(
    totalFootage,
    totalHours,
    totalDays,
    effectiveHoursPerDay
  );

  // Determine confidence
  let confidence: DurationResult['confidence'] = 'high';
  if (warnings.length >= 2) confidence = 'low';
  else if (warnings.length === 1) confidence = 'medium';

  return {
    totalHours: Math.round(totalHours * 10) / 10,
    totalDays,
    effectiveHoursPerDay,
    breakdown,
    gateBreakdown,
    confidence,
    warnings,
    suggestedSchedule,
  };
}

// ============================================================================
// HELPER: Generate multi-day schedule suggestion
// ============================================================================

function generateSuggestedSchedule(
  totalFootage: number,
  totalHours: number,
  totalDays: number,
  hoursPerDay: number
): DurationResult['suggestedSchedule'] {
  const schedule: DurationResult['suggestedSchedule'] = [];
  
  if (totalDays === 1) {
    schedule.push({
      day: 1,
      footage: totalFootage,
      hours: totalHours,
    });
    return schedule;
  }

  // Distribute evenly across days
  const footagePerDay = Math.ceil(totalFootage / totalDays);
  const hoursPerDayActual = totalHours / totalDays;
  
  let remainingFootage = totalFootage;
  let remainingHours = totalHours;

  for (let day = 1; day <= totalDays; day++) {
    const isLastDay = day === totalDays;
    const dayFootage = isLastDay ? remainingFootage : Math.min(footagePerDay, remainingFootage);
    const dayHours = isLastDay ? remainingHours : Math.min(hoursPerDay, hoursPerDayActual);

    schedule.push({
      day,
      footage: Math.round(dayFootage),
      hours: Math.round(dayHours * 10) / 10,
    });

    remainingFootage -= dayFootage;
    remainingHours -= dayHours;
  }

  return schedule;
}

// ============================================================================
// QUICK ESTIMATE (without database calls - for UI previews)
// ============================================================================

export function quickEstimateDuration(
  footage: number,
  fenceType: 'wood_vertical' | 'wood_horizontal' | 'iron' | 'chain_link',
  gateCount: number = 0
): { hours: number; days: number } {
  // Default rates (hours per 100 LF)
  const defaultRates: Record<string, number> = {
    wood_vertical: 5.0,
    wood_horizontal: 6.5,
    iron: 4.0,
    chain_link: 3.0,
  };

  const rate = defaultRates[fenceType] || 5.0;
  const fenceHours = (footage / 100) * rate;
  const gateHours = gateCount * 1.5; // Average gate time
  const totalHours = fenceHours + gateHours;
  const days = Math.ceil(totalHours / 7);

  return {
    hours: Math.round(totalHours * 10) / 10,
    days,
  };
}
```

### 4.2 Assignment Suggester

```typescript
// src/features/schedule/utils/assignmentSuggester.ts

import { supabase } from '@/lib/supabase';
import { format, addDays, startOfDay } from 'date-fns';

// ============================================================================
// TYPES
// ============================================================================

export interface AssignmentContext {
  jobId?: string;
  serviceRequestId?: string;
  communityId?: string;
  clientId?: string;
  propertyZip: string;
  propertyAddress?: string;
  fenceTypes: string[];           // ['wood_vertical', 'iron']
  totalFootage: number;
  preferredDate?: Date;
  excludeCrewIds?: string[];      // Crews to exclude from suggestions
  excludeRepIds?: string[];       // Reps to exclude
}

export interface RepSuggestion {
  repId: string;
  repName: string;
  score: number;                  // 0-100
  reasons: string[];
  isPrimary: boolean;             // True if community preference
  avatarUrl?: string;
}

export interface CrewSuggestion {
  crewId: string;
  crewName: string;
  score: number;                  // 0-100
  reasons: string[];
  isPrimary: boolean;             // True if community preference
  
  // Availability info
  nextAvailableDates: {
    date: Date;
    availableFootage: number;
    utilizationPercent: number;
  }[];
  
  // Capacity on preferred date (if provided)
  preferredDateCapacity?: {
    maxFootage: number;
    scheduledFootage: number;
    availableFootage: number;
    utilizationPercent: number;
    canFit: boolean;
  };
  
  // Skill info
  skillLevel?: 'trainee' | 'standard' | 'expert';
  certifiedFenceTypes: string[];
}

export interface AssignmentSuggestions {
  reps: RepSuggestion[];
  crews: CrewSuggestion[];
  warnings: string[];
}

// ============================================================================
// MAIN SUGGESTER
// ============================================================================

export async function suggestAssignments(
  context: AssignmentContext
): Promise<AssignmentSuggestions> {
  const repSuggestions: RepSuggestion[] = [];
  const crewSuggestions: CrewSuggestion[] = [];
  const warnings: string[] = [];

  // ─────────────────────────────────────────────────────────────────────────
  // REP SUGGESTIONS
  // ─────────────────────────────────────────────────────────────────────────

  // 1. Check community preference (highest priority)
  if (context.communityId) {
    const { data: communityPref } = await supabase
      .from('community_rep_preferences')
      .select(`
        *,
        preferred_rep:sales_reps!preferred_rep_id(id, name, avatar_url),
        community:communities(name)
      `)
      .eq('community_id', context.communityId)
      .single();

    if (communityPref?.preferred_rep) {
      const isRequired = communityPref.preference_level === 'required';
      repSuggestions.push({
        repId: communityPref.preferred_rep.id,
        repName: communityPref.preferred_rep.name,
        score: isRequired ? 100 : 95,
        reasons: [
          `${isRequired ? 'Required' : 'Preferred'} rep for ${communityPref.community?.name}`,
          communityPref.reason || 'Builder relationship',
        ].filter(Boolean),
        isPrimary: true,
        avatarUrl: communityPref.preferred_rep.avatar_url,
      });
    }
  }

  // 2. Check territory assignment
  const { data: territoryAssignment } = await supabase
    .from('territory_assignments')
    .select(`
      *,
      primary_rep:sales_reps!primary_rep_id(id, name, avatar_url),
      territory:territories(name)
    `)
    .eq('zip_code', context.propertyZip)
    .single();

  if (territoryAssignment?.primary_rep) {
    const existingRep = repSuggestions.find(r => r.repId === territoryAssignment.primary_rep.id);
    if (!existingRep) {
      repSuggestions.push({
        repId: territoryAssignment.primary_rep.id,
        repName: territoryAssignment.primary_rep.name,
        score: 80,
        reasons: [`Territory: ${territoryAssignment.territory?.name || context.propertyZip}`],
        isPrimary: false,
        avatarUrl: territoryAssignment.primary_rep.avatar_url,
      });
    } else {
      // Boost existing rep's score
      existingRep.score = Math.min(100, existingRep.score + 5);
      existingRep.reasons.push(`Also covers territory: ${context.propertyZip}`);
    }
  }

  // 3. Get other available reps
  const { data: allReps } = await supabase
    .from('sales_reps')
    .select('id, name, avatar_url, is_active')
    .eq('is_active', true)
    .not('id', 'in', `(${context.excludeRepIds?.join(',') || 'null'})`);

  for (const rep of allReps || []) {
    if (!repSuggestions.find(r => r.repId === rep.id)) {
      repSuggestions.push({
        repId: rep.id,
        repName: rep.name,
        score: 50,
        reasons: ['Available'],
        isPrimary: false,
        avatarUrl: rep.avatar_url,
      });
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // CREW SUGGESTIONS
  // ─────────────────────────────────────────────────────────────────────────

  // 1. Check community preference for crew
  if (context.communityId) {
    const { data: communityPref } = await supabase
      .from('community_rep_preferences')
      .select(`
        *,
        preferred_crew:crews!preferred_crew_id(id, name),
        community:communities(name)
      `)
      .eq('community_id', context.communityId)
      .single();

    if (communityPref?.preferred_crew) {
      const crewCapacity = await getCrewCapacityInfo(
        communityPref.preferred_crew.id,
        context.preferredDate,
        context.totalFootage
      );

      crewSuggestions.push({
        crewId: communityPref.preferred_crew.id,
        crewName: communityPref.preferred_crew.name,
        score: communityPref.preference_level === 'required' ? 100 : 95,
        reasons: [`Preferred crew for ${communityPref.community?.name}`],
        isPrimary: true,
        ...crewCapacity,
      });
    }
  }

  // 2. Get crews with matching skills
  const { data: skilledCrews } = await supabase
    .from('crew_skills')
    .select(`
      crew_id,
      fence_type,
      skill_level,
      duration_multiplier,
      crew:crews(id, name, is_active, max_daily_footage)
    `)
    .in('fence_type', context.fenceTypes)
    .eq('crew.is_active', true);

  // Group skills by crew
  const crewSkillMap = new Map<string, {
    crew: any;
    skills: { fenceType: string; skillLevel: string; multiplier: number }[];
  }>();

  for (const skill of skilledCrews || []) {
    if (!skill.crew) continue;
    
    const existing = crewSkillMap.get(skill.crew_id);
    if (existing) {
      existing.skills.push({
        fenceType: skill.fence_type,
        skillLevel: skill.skill_level,
        multiplier: skill.duration_multiplier,
      });
    } else {
      crewSkillMap.set(skill.crew_id, {
        crew: skill.crew,
        skills: [{
          fenceType: skill.fence_type,
          skillLevel: skill.skill_level,
          multiplier: skill.duration_multiplier,
        }],
      });
    }
  }

  // Score each crew
  for (const [crewId, crewData] of crewSkillMap) {
    // Skip if already in suggestions
    if (crewSuggestions.find(c => c.crewId === crewId)) continue;
    
    // Skip if excluded
    if (context.excludeCrewIds?.includes(crewId)) continue;

    let score = 60;
    const reasons: string[] = [];

    // Skill match scoring
    const expertSkills = crewData.skills.filter(s => s.skillLevel === 'expert');
    const standardSkills = crewData.skills.filter(s => s.skillLevel === 'standard');
    
    if (expertSkills.length > 0) {
      score += 20;
      reasons.push(`Expert in: ${expertSkills.map(s => s.fenceType).join(', ')}`);
    } else if (standardSkills.length > 0) {
      score += 10;
      reasons.push(`Certified for: ${standardSkills.map(s => s.fenceType).join(', ')}`);
    }

    // Territory match
    if (territoryAssignment?.primary_crew_id === crewId) {
      score += 15;
      reasons.push('Primary territory crew');
    } else if (territoryAssignment?.backup_crew_id === crewId) {
      score += 8;
      reasons.push('Backup territory crew');
    }

    // Get capacity info
    const crewCapacity = await getCrewCapacityInfo(
      crewId,
      context.preferredDate,
      context.totalFootage
    );

    // Capacity scoring
    if (crewCapacity.preferredDateCapacity?.canFit) {
      score += 5;
      reasons.push(`Capacity available: ${crewCapacity.preferredDateCapacity.availableFootage} LF`);
    } else if (crewCapacity.preferredDateCapacity) {
      score -= 10;
      reasons.push(`⚠️ Over capacity on preferred date`);
    }

    crewSuggestions.push({
      crewId,
      crewName: crewData.crew.name,
      score: Math.max(0, Math.min(100, score)),
      reasons,
      isPrimary: false,
      skillLevel: expertSkills.length > 0 ? 'expert' : 
                  standardSkills.length > 0 ? 'standard' : 'trainee',
      certifiedFenceTypes: crewData.skills.map(s => s.fenceType),
      ...crewCapacity,
    });
  }

  // Sort by score
  repSuggestions.sort((a, b) => b.score - a.score);
  crewSuggestions.sort((a, b) => b.score - a.score);

  // Warnings
  if (crewSuggestions.length === 0) {
    warnings.push('No crews found with matching fence type skills');
  }
  
  if (context.preferredDate && crewSuggestions.every(c => !c.preferredDateCapacity?.canFit)) {
    warnings.push('No crews have sufficient capacity on preferred date');
  }

  return {
    reps: repSuggestions.slice(0, 5),
    crews: crewSuggestions.slice(0, 5),
    warnings,
  };
}

// ============================================================================
// HELPER: Get crew capacity info
// ============================================================================

async function getCrewCapacityInfo(
  crewId: string,
  preferredDate: Date | undefined,
  neededFootage: number
): Promise<{
  nextAvailableDates: CrewSuggestion['nextAvailableDates'];
  preferredDateCapacity?: CrewSuggestion['preferredDateCapacity'];
  certifiedFenceTypes: string[];
}> {
  // Get crew's default max footage
  const { data: crew } = await supabase
    .from('crews')
    .select('max_daily_footage')
    .eq('id', crewId)
    .single();

  const maxFootage = crew?.max_daily_footage || 300;

  // Get next 14 days of capacity
  const today = startOfDay(new Date());
  const dates: Date[] = [];
  for (let i = 0; i < 14; i++) {
    dates.push(addDays(today, i));
  }

  const { data: capacityData } = await supabase
    .from('crew_daily_capacity')
    .select('*')
    .eq('crew_id', crewId)
    .gte('capacity_date', format(today, 'yyyy-MM-dd'))
    .lte('capacity_date', format(addDays(today, 14), 'yyyy-MM-dd'));

  const capacityMap = new Map(
    capacityData?.map(c => [c.capacity_date, c]) || []
  );

  // Build availability list
  const nextAvailableDates: CrewSuggestion['nextAvailableDates'] = [];
  
  for (const date of dates) {
    const dateStr = format(date, 'yyyy-MM-dd');
    const capacity = capacityMap.get(dateStr);
    
    const scheduledFootage = capacity?.scheduled_footage || 0;
    const availableFootage = maxFootage - scheduledFootage;
    const utilizationPercent = Math.round((scheduledFootage / maxFootage) * 100);

    // Only include dates with enough capacity
    if (availableFootage >= neededFootage) {
      nextAvailableDates.push({
        date,
        availableFootage,
        utilizationPercent,
      });
    }
  }

  // Get preferred date capacity
  let preferredDateCapacity: CrewSuggestion['preferredDateCapacity'] | undefined;
  
  if (preferredDate) {
    const prefDateStr = format(preferredDate, 'yyyy-MM-dd');
    const capacity = capacityMap.get(prefDateStr);
    const scheduledFootage = capacity?.scheduled_footage || 0;
    const availableFootage = maxFootage - scheduledFootage;

    preferredDateCapacity = {
      maxFootage,
      scheduledFootage,
      availableFootage,
      utilizationPercent: Math.round((scheduledFootage / maxFootage) * 100),
      canFit: availableFootage >= neededFootage,
    };
  }

  // Get certified fence types
  const { data: skills } = await supabase
    .from('crew_skills')
    .select('fence_type')
    .eq('crew_id', crewId);

  return {
    nextAvailableDates: nextAvailableDates.slice(0, 5),
    preferredDateCapacity,
    certifiedFenceTypes: skills?.map(s => s.fence_type) || [],
  };
}
```

---

## Part 4.5: Real-Time Updates (Supabase Realtime)

### Why Real-Time Matters

Multiple dispatchers may schedule simultaneously. Without real-time sync:
- Dispatcher A schedules Crew 1 at 8 AM Monday
- Dispatcher B (unaware) also schedules Crew 1 at 8 AM Monday
- Conflict discovered only when crew shows up confused

### Implementation: Supabase Realtime Subscription

```typescript
// src/features/schedule/hooks/useScheduleRealtime.ts

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

export function useScheduleRealtime(dateRange: { start: Date; end: Date }) {
  const queryClient = useQueryClient();

  useEffect(() => {
    // Subscribe to schedule_entries changes
    const channel = supabase
      .channel('schedule-changes')
      .on(
        'postgres_changes',
        {
          event: '*', // INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'schedule_entries',
          filter: `scheduled_date=gte.${dateRange.start.toISOString().split('T')[0]}`,
        },
        (payload) => {
          handleRealtimeChange(payload, queryClient);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [dateRange, queryClient]);
}

function handleRealtimeChange(payload: any, queryClient: any) {
  const { eventType, new: newRecord, old: oldRecord } = payload;

  // Invalidate relevant queries
  queryClient.invalidateQueries({ queryKey: ['schedule-entries'] });
  queryClient.invalidateQueries({ queryKey: ['crew-capacity'] });

  // Show toast notification for changes by other users
  const currentUserId = supabase.auth.getUser()?.data?.user?.id;
  if (newRecord?.created_by !== currentUserId) {
    switch (eventType) {
      case 'INSERT':
        toast.info(`New schedule entry added`, {
          description: `${newRecord.title || 'Entry'} scheduled for ${newRecord.scheduled_date}`,
        });
        break;
      case 'UPDATE':
        toast.info(`Schedule updated`, {
          description: `${newRecord.title || 'Entry'} was modified`,
        });
        break;
      case 'DELETE':
        toast.info(`Schedule entry removed`, {
          description: `An entry was removed from the calendar`,
        });
        break;
    }
  }
}
```

### Conflict Detection on Save

```typescript
// src/features/schedule/utils/conflictDetection.ts

export async function checkScheduleConflicts(
  entry: Partial<ScheduleEntry>
): Promise<{ hasConflict: boolean; conflicts: ScheduleEntry[] }> {
  const { data: existingEntries } = await supabase
    .from('schedule_entries')
    .select('*')
    .eq('scheduled_date', entry.scheduled_date)
    .or(`crew_id.eq.${entry.crew_id},sales_rep_id.eq.${entry.sales_rep_id}`)
    .neq('id', entry.id || '')
    .not('status', 'in', '("cancelled","rescheduled")');

  // Check for time overlap
  const conflicts = (existingEntries || []).filter((existing) => {
    if (!entry.start_time || !entry.end_time) return false;
    if (!existing.start_time || !existing.end_time) return false;

    return (
      entry.start_time < existing.end_time &&
      entry.end_time > existing.start_time
    );
  });

  return {
    hasConflict: conflicts.length > 0,
    conflicts,
  };
}
```

### UI: Conflict Warning Modal

When a conflict is detected, show a modal:
- "Crew A is already scheduled for 8 AM - 12 PM on this date"
- Options: "Schedule Anyway (Over-book)" | "Find Another Time" | "Cancel"

---

## Part 4.6: Travel Time Estimation

### Overview

Auto-estimate travel time between jobs for crews working multiple jobs per day.

### Database Addition

```sql
-- Add to schedule_entries table
ALTER TABLE schedule_entries ADD COLUMN travel_time_minutes INTEGER;
ALTER TABLE schedule_entries ADD COLUMN travel_from_entry_id UUID REFERENCES schedule_entries(id);
```

### Travel Time Calculator

```typescript
// src/features/schedule/utils/travelTimeCalculator.ts

interface TravelEstimate {
  durationMinutes: number;
  distanceMiles: number;
  origin: string;
  destination: string;
}

// Option 1: Simple ZIP-code based estimation (no API cost)
export function estimateTravelTimeByZip(
  originZip: string,
  destZip: string
): number {
  // Rough estimates based on DFW area
  const zipDistanceMap: Record<string, Record<string, number>> = {
    // Pre-calculated common routes
    '75001': { '75002': 15, '75080': 20, '76051': 35 },
    // ... more mappings
  };

  // Default: 25 minutes for unknown routes
  return zipDistanceMap[originZip]?.[destZip] || 25;
}

// Option 2: Google Maps API (more accurate, has cost)
export async function estimateTravelTimeGoogle(
  origin: string,
  destination: string
): Promise<TravelEstimate> {
  // Implement with Google Distance Matrix API
  // Rate limit: cache results in territory_assignments.avg_drive_time_from_yard
}
```

### Auto-Insert Travel Blocks

```typescript
// When scheduling second job of day, auto-calculate and warn
export function suggestStartTimeWithTravel(
  previousJob: ScheduleEntry,
  newJobAddress: string
): { suggestedStart: string; travelMinutes: number } {
  const travelMinutes = estimateTravelTimeByZip(
    previousJob.location_zip,
    extractZip(newJobAddress)
  );

  const previousEnd = parseTime(previousJob.end_time);
  const suggestedStart = addMinutes(previousEnd, travelMinutes + 15); // +15 buffer

  return {
    suggestedStart: format(suggestedStart, 'HH:mm'),
    travelMinutes,
  };
}
```

---

## Part 4.7: Multi-Day Job Handling

### The Challenge

A 500 LF fence job takes 3 days. Questions arise:
- What if Day 2 needs to move but Day 1 is complete?
- Can different crews work different days?
- How do drag operations work?

### Solution: Linked Entry Behavior Setting

```sql
-- Add to schedule_entries
ALTER TABLE schedule_entries ADD COLUMN
  linked_behavior TEXT DEFAULT 'move_together'
  CHECK (linked_behavior IN ('move_together', 'move_independent'));
```

### UI Behavior

When dragging a multi-day job entry:

**If `move_together`:**
- Moving Day 1 shifts all linked days proportionally
- "Move all 3 days?" confirmation shown
- Days maintain same gaps between them

**If `move_independent`:**
- Only the dragged day moves
- Other days stay put
- Useful when Day 1 complete, Day 2-3 need rescheduling

### Split Job Feature

Allow splitting a multi-day job between crews:
- "Split Job" button on job card
- Day 1-2: Crew A, Day 3: Crew B
- Creates separate entries with same parent job

---

## Part 4.8: Notifications System

### Notification Types

| Event | Recipients | Channel |
|-------|------------|---------|
| Job Scheduled | Crew Lead, Assigned Rep | In-app, Push |
| Schedule Changed | Affected Crew/Rep | In-app, Push, SMS (optional) |
| Day-Before Reminder | Crew Lead | Push, SMS |
| Morning Digest | All Crews | Email, Push |
| Customer Confirmation | Customer | Email, SMS |

### Database Schema

```sql
-- Notification preferences per user
CREATE TABLE notification_preferences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id),

  -- Channel preferences
  in_app_enabled BOOLEAN DEFAULT true,
  push_enabled BOOLEAN DEFAULT true,
  email_enabled BOOLEAN DEFAULT true,
  sms_enabled BOOLEAN DEFAULT false,  -- Opt-in only (cost)

  -- Event preferences
  notify_on_schedule_change BOOLEAN DEFAULT true,
  notify_on_new_assignment BOOLEAN DEFAULT true,
  notify_day_before_reminder BOOLEAN DEFAULT true,
  notify_morning_digest BOOLEAN DEFAULT true,
  morning_digest_time TIME DEFAULT '06:00',

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id)
);

-- Scheduled notifications queue
CREATE TABLE notification_queue (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  recipient_user_id UUID REFERENCES auth.users(id),
  recipient_phone TEXT,  -- For SMS to customers
  recipient_email TEXT,  -- For email to customers

  notification_type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  data JSONB,  -- Additional payload (job_id, entry_id, etc.)

  channel TEXT NOT NULL CHECK (channel IN ('in_app', 'push', 'email', 'sms')),

  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  scheduled_for TIMESTAMPTZ DEFAULT NOW(),
  sent_at TIMESTAMPTZ,
  error_message TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notification_queue_pending ON notification_queue(scheduled_for)
  WHERE status = 'pending';
```

### Morning Digest Implementation

```typescript
// Supabase Edge Function: send-morning-digest
// Triggered by cron at 6:00 AM daily

export async function sendMorningDigest() {
  const today = format(new Date(), 'yyyy-MM-dd');

  // Get all crews with jobs today
  const { data: todaysEntries } = await supabase
    .from('schedule_entries')
    .select(`
      *,
      job:jobs(job_number, client_name, location_address),
      crew:crews(id, name, lead_user_id)
    `)
    .eq('scheduled_date', today)
    .eq('entry_type', 'job_visit')
    .order('start_time');

  // Group by crew
  const byCrewId = groupBy(todaysEntries, 'crew_id');

  for (const [crewId, entries] of Object.entries(byCrewId)) {
    const crew = entries[0].crew;
    const totalFootage = sum(entries.map(e => e.estimated_footage || 0));

    const digest = {
      title: `Today's Schedule: ${entries.length} jobs, ${totalFootage} LF`,
      body: entries.map(e =>
        `${e.start_time} - ${e.job.client_name} (${e.estimated_footage} LF)`
      ).join('\n'),
      data: { crewId, date: today, jobIds: entries.map(e => e.job_id) }
    };

    // Queue notifications
    await queueNotification(crew.lead_user_id, 'morning_digest', digest);
  }
}
```

### Customer Appointment Confirmations (Phase 2)

```typescript
// Send confirmation when assessment is scheduled
async function sendCustomerConfirmation(entry: ScheduleEntry) {
  if (entry.entry_type !== 'assessment') return;

  const { data: request } = await supabase
    .from('service_requests')
    .select('client_name, client_email, client_phone')
    .eq('id', entry.service_request_id)
    .single();

  const message = `
    Hi ${request.client_name},

    Your fence assessment is confirmed:
    📅 ${format(entry.scheduled_date, 'EEEE, MMMM d, yyyy')}
    🕐 ${entry.start_time} - ${entry.end_time}
    📍 ${entry.location_address}

    Reply RESCHEDULE to change your appointment.
  `;

  if (request.client_email) {
    await sendEmail(request.client_email, 'Appointment Confirmed', message);
  }
  if (request.client_phone) {
    await sendSMS(request.client_phone, message);
  }
}
```

---

## Part 5: Calendar UI Implementation

### 5.1 FullCalendar Setup

```typescript
// src/features/schedule/components/calendar/ScheduleCalendar.tsx

import React, { useRef, useState, useCallback } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import resourceTimelinePlugin from '@fullcalendar/resource-timeline';
import listPlugin from '@fullcalendar/list';
import {
  EventApi,
  DateSelectArg,
  EventClickArg,
  EventDropArg,
  EventContentArg,
} from '@fullcalendar/core';
import { format, startOfMonth, endOfMonth } from 'date-fns';

import { useScheduleEntries } from '../../hooks/useScheduleEntries';
import { useScheduleRealtime } from '../../hooks/useScheduleRealtime';
import { useCrews } from '@/features/crews/hooks/useCrews';
import { useSalesReps } from '@/features/sales-reps/hooks/useSalesReps';
import { EventCard } from './EventCard';
import { CapacityBar } from './CapacityBar';
import { UnscheduledSidebar } from '../sidebar/UnscheduledSidebar';
import { QuickScheduleModal } from '../modals/QuickScheduleModal';
import { checkScheduleConflicts } from '../../utils/conflictDetection';
import { cn } from '@/lib/utils';

// ============================================================================
// TYPES
// ============================================================================

type CalendarView = 'resourceTimelineDay' | 'resourceTimelineWeek' | 'dayGridMonth' | 'listWeek';

interface ScheduleCalendarProps {
  businessUnitId?: string;
  initialDate?: Date;
  initialView?: CalendarView;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function ScheduleCalendar({
  businessUnitId,
  initialDate = new Date(),
  initialView = 'resourceTimelineWeek',
}: ScheduleCalendarProps) {
  const calendarRef = useRef<FullCalendar>(null);
  const [selectedEntry, setSelectedEntry] = useState<string | null>(null);
  const [quickScheduleItem, setQuickScheduleItem] = useState<any | null>(null);
  const [dateRange, setDateRange] = useState({
    start: startOfMonth(initialDate),
    end: endOfMonth(initialDate),
  });

  // Data hooks
  const { data: crews = [] } = useCrews({ businessUnitId });
  const { data: salesReps = [] } = useSalesReps({ businessUnitId });
  const {
    data: entries = [],
    isLoading,
    createEntry,
    updateEntry,
  } = useScheduleEntries({
    businessUnitId,
    startDate: dateRange.start,
    endDate: dateRange.end,
  });

  // Real-time updates
  useScheduleRealtime(dateRange);

  // ─────────────────────────────────────────────────────────────────────────
  // BUILD RESOURCES (Crews + Sales Reps as rows)
  // ─────────────────────────────────────────────────────────────────────────
  const resources = [
    // Crews group
    { id: 'crews', title: 'CREWS', eventColor: '#10B981' },
    ...crews.map((crew) => ({
      id: `crew-${crew.id}`,
      parentId: 'crews',
      title: crew.name,
      extendedProps: {
        type: 'crew',
        crewId: crew.id,
        maxFootage: crew.max_daily_footage || 300,
        color: crew.color || '#10B981',
      },
    })),
    // Sales Reps group
    { id: 'reps', title: 'SALES REPS', eventColor: '#3B82F6' },
    ...salesReps.map((rep) => ({
      id: `rep-${rep.id}`,
      parentId: 'reps',
      title: rep.name,
      extendedProps: {
        type: 'rep',
        repId: rep.id,
        color: '#3B82F6',
      },
    })),
  ];

  // ─────────────────────────────────────────────────────────────────────────
  // BUILD EVENTS from schedule entries
  // ─────────────────────────────────────────────────────────────────────────
  const events = entries.map((entry) => ({
    id: entry.id,
    resourceId: entry.crew_id ? `crew-${entry.crew_id}` : `rep-${entry.sales_rep_id}`,
    title: entry.title || formatEntryTitle(entry),
    start: entry.start_time
      ? `${entry.scheduled_date}T${entry.start_time}`
      : entry.scheduled_date,
    end: entry.end_time
      ? `${entry.scheduled_date}T${entry.end_time}`
      : undefined,
    allDay: entry.is_all_day,
    backgroundColor: getEventColor(entry),
    borderColor: getEventColor(entry),
    extendedProps: {
      entryType: entry.entry_type,
      jobId: entry.job_id,
      footage: entry.estimated_footage,
      materialStatus: entry.job?.material_status,
      status: entry.status,
      entry, // Full entry for modal access
    },
  }));

  // ─────────────────────────────────────────────────────────────────────────
  // EVENT HANDLERS
  // ─────────────────────────────────────────────────────────────────────────

  const handleEventClick = useCallback((info: EventClickArg) => {
    setSelectedEntry(info.event.id);
  }, []);

  const handleEventDrop = useCallback(
    async (info: EventDropArg) => {
      const { event, newResource } = info;
      const entryId = event.id;

      // Parse new assignment from resource
      let crewId: string | null = null;
      let salesRepId: string | null = null;

      if (newResource) {
        const resourceId = newResource.id;
        if (resourceId.startsWith('crew-')) {
          crewId = resourceId.replace('crew-', '');
        } else if (resourceId.startsWith('rep-')) {
          salesRepId = resourceId.replace('rep-', '');
        }
      }

      // Check for conflicts
      const newEntry = {
        id: entryId,
        scheduled_date: format(event.start!, 'yyyy-MM-dd'),
        start_time: event.allDay ? null : format(event.start!, 'HH:mm'),
        end_time: event.end && !event.allDay ? format(event.end, 'HH:mm') : null,
        crew_id: crewId,
        sales_rep_id: salesRepId,
      };

      const { hasConflict, conflicts } = await checkScheduleConflicts(newEntry);

      if (hasConflict) {
        // Show conflict modal - let user decide
        const proceed = window.confirm(
          `Conflict detected: ${conflicts[0]?.title} is already scheduled at this time. Schedule anyway?`
        );
        if (!proceed) {
          info.revert();
          return;
        }
      }

      // Update entry
      await updateEntry(newEntry);
    },
    [updateEntry]
  );

  const handleDateSelect = useCallback((info: DateSelectArg) => {
    // Open quick schedule modal for new entry
    const resourceId = info.resource?.id;
    let resourceType: 'crew' | 'rep' | null = null;
    let assigneeId: string | null = null;

    if (resourceId?.startsWith('crew-')) {
      resourceType = 'crew';
      assigneeId = resourceId.replace('crew-', '');
    } else if (resourceId?.startsWith('rep-')) {
      resourceType = 'rep';
      assigneeId = resourceId.replace('rep-', '');
    }

    setQuickScheduleItem({
      resourceType,
      assigneeId,
      resourceName: info.resource?.title,
      start: info.start,
      end: info.end,
      allDay: info.allDay,
    });
  }, []);

  const handleDatesSet = useCallback((dateInfo: any) => {
    setDateRange({
      start: dateInfo.start,
      end: dateInfo.end,
    });
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // CUSTOM EVENT RENDERING
  // ─────────────────────────────────────────────────────────────────────────

  const renderEventContent = useCallback((eventContent: EventContentArg) => {
    return <EventCard event={eventContent.event} timeText={eventContent.timeText} />;
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────

  if (isLoading) {
    return <div className="flex items-center justify-center h-96">Loading...</div>;
  }

  return (
    <div className="flex h-full">
      {/* Main Calendar Area */}
      <div className="flex-1 flex flex-col">
        {/* Capacity Bar */}
        <CapacityBar
          crews={crews}
          currentDate={dateRange.start}
        />

        {/* Calendar */}
        <div className="flex-1 overflow-hidden">
          <FullCalendar
            ref={calendarRef}
            plugins={[
              dayGridPlugin,
              timeGridPlugin,
              interactionPlugin,
              resourceTimelinePlugin,
              listPlugin,
            ]}
            initialView={initialView}
            initialDate={initialDate}

            // Header toolbar
            headerToolbar={{
              left: 'prev,next today',
              center: 'title',
              right: 'resourceTimelineDay,resourceTimelineWeek,dayGridMonth,listWeek',
            }}

            // Resources (crews + reps as rows)
            resources={resources}
            resourceAreaHeaderContent="Crews & Reps"
            resourceAreaWidth="200px"
            resourceGroupField="parentId"

            // Events
            events={events}
            eventContent={renderEventContent}
            eventClick={handleEventClick}
            eventDrop={handleEventDrop}

            // Interaction
            editable={true}
            selectable={true}
            selectMirror={true}
            select={handleDateSelect}
            droppable={true}  // Allow external drag-drop

            // Time settings
            slotMinTime="06:00:00"
            slotMaxTime="20:00:00"
            slotDuration="00:30:00"
            scrollTime="07:00:00"

            // Display
            nowIndicator={true}
            dayMaxEvents={true}
            weekends={true}
            height="100%"

            // Date change handler
            datesSet={handleDatesSet}

            // Business hours (visual highlighting)
            businessHours={{
              daysOfWeek: [1, 2, 3, 4, 5, 6], // Mon-Sat
              startTime: '07:00',
              endTime: '18:00',
            }}
          />
        </div>
      </div>

      {/* Unscheduled Sidebar */}
      <UnscheduledSidebar
        businessUnitId={businessUnitId}
        onItemScheduled={(item) => setQuickScheduleItem(item)}
      />

      {/* Quick Schedule Modal */}
      {quickScheduleItem && (
        <QuickScheduleModal
          item={quickScheduleItem}
          onClose={() => setQuickScheduleItem(null)}
          onSchedule={async (scheduleData) => {
            await createEntry(scheduleData);
            setQuickScheduleItem(null);
          }}
        />
      )}
    </div>
  );
}

// ============================================================================
// HELPERS
// ============================================================================

function formatEntryTitle(entry: any): string {
  if (entry.entry_type === 'job_visit') {
    const footage = entry.estimated_footage ? `${entry.estimated_footage} LF` : '';
    return `${entry.job?.job_number || 'Job'} ${footage}`.trim();
  }
  if (entry.entry_type === 'assessment') {
    return `Assessment: ${entry.service_request?.client_name || 'Client'}`;
  }
  return entry.title || entry.entry_type;
}

function getEventColor(entry: any): string {
  if (entry.entry_type === 'job_visit') {
    switch (entry.job?.material_status) {
      case 'staged': return '#F59E0B';   // Yellow - ready
      case 'loaded': return '#3B82F6';   // Blue - on truck
      case 'completed': return '#10B981'; // Green - done
      default: return '#6B7280';          // Gray - pending
    }
  }
  if (entry.entry_type === 'assessment') return '#8B5CF6'; // Purple
  if (entry.entry_type === 'blocked') return '#9CA3AF';    // Gray
  return '#6B7280';
}
```

### 5.2 Capacity Bar Component

```typescript
// src/features/schedule/components/calendar/CapacityBar.tsx

import React from 'react';
import { format, addDays, startOfWeek, eachDayOfInterval } from 'date-fns';
import { useCrewCapacity } from '../../hooks/useCrewCapacity';
import { cn } from '@/lib/utils';

type CalendarView = 'resourceTimelineDay' | 'resourceTimelineWeek' | 'dayGridMonth' | 'listWeek';

interface CapacityBarProps {
  crews: { id: string; name: string; color?: string }[];
  currentDate: Date;
  viewType: ViewType;
}

export function CapacityBar({ crews, currentDate, viewType }: CapacityBarProps) {
  // Get date range based on view type
  const dateRange = getDateRange(currentDate, viewType);
  
  return (
    <div className="bg-slate-50 border-b px-4 py-2">
      <div className="flex items-center gap-2 text-xs text-slate-600 mb-2">
        <span className="font-medium">Daily Capacity (Linear Feet)</span>
        <div className="flex items-center gap-3 ml-4">
          <span className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-green-500" /> Available
          </span>
          <span className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-yellow-500" /> 75-95%
          </span>
          <span className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-red-500" /> Over
          </span>
        </div>
      </div>
      
      {/* Capacity grid */}
      <div className="overflow-x-auto">
        <div className="flex gap-1 min-w-max">
          {/* Row labels */}
          <div className="w-32 shrink-0">
            <div className="h-6" /> {/* Header spacer */}
            {crews.map(crew => (
              <div 
                key={crew.id} 
                className="h-6 flex items-center text-xs truncate"
                title={crew.name}
              >
                <div 
                  className="w-2 h-2 rounded-full mr-1"
                  style={{ backgroundColor: crew.color || '#10B981' }}
                />
                {crew.name}
              </div>
            ))}
          </div>
          
          {/* Day columns */}
          {dateRange.map(date => (
            <CapacityColumn
              key={date.toISOString()}
              date={date}
              crews={crews}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

interface CapacityColumnProps {
  date: Date;
  crews: { id: string; name: string }[];
}

function CapacityColumn({ date, crews }: CapacityColumnProps) {
  const { capacityByCrewDate } = useCrewCapacity({
    crewIds: crews.map(c => c.id),
    date,
  });

  const isWeekend = [0, 6].includes(date.getDay());
  const isToday = format(date, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');

  return (
    <div className={cn(
      "w-20 shrink-0",
      isWeekend && "opacity-50"
    )}>
      {/* Date header */}
      <div className={cn(
        "h-6 text-xs font-medium text-center",
        isToday && "bg-blue-100 rounded"
      )}>
        {format(date, 'EEE M/d')}
      </div>
      
      {/* Crew capacity bars */}
      {crews.map(crew => {
        const capacity = capacityByCrewDate.get(`${crew.id}-${format(date, 'yyyy-MM-dd')}`);
        const utilization = capacity?.utilization_percent || 0;
        const scheduled = capacity?.scheduled_footage || 0;
        const max = capacity?.max_footage || 300;
        
        return (
          <div 
            key={crew.id}
            className="h-6 flex items-center px-1"
            title={`${crew.name}: ${scheduled}/${max} LF (${utilization}%)`}
          >
            <div className="w-full bg-slate-200 rounded-sm h-3 overflow-hidden">
              <div
                className={cn(
                  "h-full transition-all",
                  utilization <= 75 && "bg-green-500",
                  utilization > 75 && utilization <= 95 && "bg-yellow-500",
                  utilization > 95 && "bg-red-500"
                )}
                style={{ width: `${Math.min(100, utilization)}%` }}
              />
            </div>
            <span className="text-[10px] ml-1 text-slate-500 w-8">
              {scheduled}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function getDateRange(currentDate: Date, viewType: ViewType): Date[] {
  switch (viewType) {
    case ViewType.Day:
      return [currentDate];
    case ViewType.Week:
      const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
      return eachDayOfInterval({
        start: weekStart,
        end: addDays(weekStart, 6),
      });
    case ViewType.Month:
      // Show just the current week for month view
      const monthWeekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
      return eachDayOfInterval({
        start: monthWeekStart,
        end: addDays(monthWeekStart, 6),
      });
    default:
      return [currentDate];
  }
}
```

---

## Part 6: iCal Calendar Sync

### 6.1 iCal Feed Generator

```typescript
// src/features/schedule/utils/icalGenerator.ts

import ical, { ICalCalendar, ICalEventStatus } from 'ical-generator';
import { format, subDays, addDays } from 'date-fns';
import { supabase } from '@/lib/supabase';

// ============================================================================
// TYPES
// ============================================================================

interface CalendarFeedOptions {
  userId: string;
  token: string;
  includeJobs: boolean;
  includeAssessments: boolean;
  includeMeetings: boolean;
  includeBlockedTime: boolean;
  scope: 'assigned' | 'team' | 'all';
}

interface ScheduleEntryForFeed {
  id: string;
  entry_type: string;
  title: string;
  scheduled_date: string;
  start_time: string | null;
  end_time: string | null;
  is_all_day: boolean;
  status: string;
  notes: string | null;
  location_address: string | null;
  location_city: string | null;
  estimated_footage: number | null;
  
  // Related data
  job?: {
    job_number: string;
    client_name: string;
    material_status: string;
  };
  service_request?: {
    client_name: string;
  };
  crew?: {
    name: string;
  };
  sales_rep?: {
    name: string;
  };
}

// ============================================================================
// FEED GENERATOR
// ============================================================================

export async function generateCalendarFeed(
  options: CalendarFeedOptions
): Promise<string> {
  const startTime = Date.now();
  
  // Get user info
  const { data: user } = await supabase
    .from('profiles')
    .select('full_name, email')
    .eq('id', options.userId)
    .single();

  // Build query based on scope
  let query = supabase
    .from('schedule_entries')
    .select(`
      *,
      job:jobs(job_number, client_name, material_status),
      service_request:service_requests(client_name),
      crew:crews(name),
      sales_rep:sales_reps(name)
    `)
    .gte('scheduled_date', format(subDays(new Date(), 7), 'yyyy-MM-dd'))
    .lte('scheduled_date', format(addDays(new Date(), 90), 'yyyy-MM-dd'))
    .not('status', 'in', '("cancelled")');

  // Filter by scope
  if (options.scope === 'assigned') {
    // Get user's assigned crew or rep
    const { data: userAssignments } = await supabase
      .from('user_assignments')
      .select('crew_id, sales_rep_id')
      .eq('user_id', options.userId);
    
    const crewIds = userAssignments?.map(a => a.crew_id).filter(Boolean) || [];
    const repIds = userAssignments?.map(a => a.sales_rep_id).filter(Boolean) || [];
    
    if (crewIds.length || repIds.length) {
      query = query.or(`crew_id.in.(${crewIds.join(',')}),sales_rep_id.in.(${repIds.join(',')})`);
    }
  }

  // Filter by entry types
  const entryTypes: string[] = [];
  if (options.includeJobs) entryTypes.push('job_visit');
  if (options.includeAssessments) entryTypes.push('assessment');
  if (options.includeMeetings) entryTypes.push('meeting');
  if (options.includeBlockedTime) entryTypes.push('blocked');
  
  if (entryTypes.length < 4) {
    query = query.in('entry_type', entryTypes);
  }

  // Execute query
  const { data: entries, error } = await query.order('scheduled_date', { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch schedule entries: ${error.message}`);
  }

  // Create calendar
  const calendar = ical({
    name: `Discount Fence USA - ${user?.full_name || 'My Schedule'}`,
    timezone: 'America/Chicago',
    prodId: {
      company: 'Discount Fence USA',
      product: 'Schedule Feed',
      language: 'EN',
    },
    x: {
      'X-WR-CALNAME': `Discount Fence USA Schedule`,
      'X-WR-TIMEZONE': 'America/Chicago',
    },
  });

  // Add events
  for (const entry of entries || []) {
    addEventToCalendar(calendar, entry as ScheduleEntryForFeed);
  }

  // Log access
  const generationTime = Date.now() - startTime;
  await logFeedAccess(options.token, entries?.length || 0, generationTime);

  return calendar.toString();
}

// ============================================================================
// EVENT FORMATTER
// ============================================================================

function addEventToCalendar(
  calendar: ICalCalendar,
  entry: ScheduleEntryForFeed
): void {
  // Build event title
  let title = entry.title || formatEventTitle(entry);
  
  // Build description
  let description = formatEventDescription(entry);
  
  // Build location
  let location = entry.location_address 
    ? `${entry.location_address}, ${entry.location_city || ''}`
    : undefined;

  // Parse times
  const startDate = new Date(entry.scheduled_date);
  let endDate = new Date(entry.scheduled_date);
  
  if (!entry.is_all_day && entry.start_time && entry.end_time) {
    const [startHour, startMin] = entry.start_time.split(':').map(Number);
    const [endHour, endMin] = entry.end_time.split(':').map(Number);
    
    startDate.setHours(startHour, startMin, 0, 0);
    endDate.setHours(endHour, endMin, 0, 0);
  }

  // Map status
  let eventStatus: ICalEventStatus = ICalEventStatus.CONFIRMED;
  if (entry.status === 'cancelled') eventStatus = ICalEventStatus.CANCELLED;
  if (entry.status === 'unscheduled') eventStatus = ICalEventStatus.TENTATIVE;

  // Create event
  calendar.createEvent({
    uid: `${entry.id}@discountfenceusa.com`,
    start: startDate,
    end: endDate,
    allDay: entry.is_all_day,
    summary: title,
    description,
    location,
    status: eventStatus,
    url: getEventUrl(entry),
    categories: [{ name: formatCategory(entry.entry_type) }],
    
    // Custom properties for rich clients
    x: {
      'X-DFUSA-TYPE': entry.entry_type,
      'X-DFUSA-STATUS': entry.status,
      ...(entry.estimated_footage && { 'X-DFUSA-FOOTAGE': String(entry.estimated_footage) }),
      ...(entry.job?.material_status && { 'X-DFUSA-MATERIAL-STATUS': entry.job.material_status }),
    },
  });
}

function formatEventTitle(entry: ScheduleEntryForFeed): string {
  switch (entry.entry_type) {
    case 'job_visit':
      const footage = entry.estimated_footage ? ` (${entry.estimated_footage} LF)` : '';
      return `${entry.job?.job_number || 'Job'}: ${entry.job?.client_name || 'Installation'}${footage}`;
    
    case 'assessment':
      return `Assessment: ${entry.service_request?.client_name || 'Site Visit'}`;
    
    case 'meeting':
      return `Meeting: ${entry.title || 'Team Meeting'}`;
    
    case 'blocked':
      return entry.title || 'Blocked Time';
    
    default:
      return entry.title || 'Schedule Entry';
  }
}

function formatEventDescription(entry: ScheduleEntryForFeed): string {
  const lines: string[] = [];
  
  if (entry.entry_type === 'job_visit') {
    if (entry.job?.job_number) lines.push(`Job: ${entry.job.job_number}`);
    if (entry.job?.client_name) lines.push(`Client: ${entry.job.client_name}`);
    if (entry.estimated_footage) lines.push(`Footage: ${entry.estimated_footage} LF`);
    if (entry.job?.material_status) lines.push(`Materials: ${formatMaterialStatus(entry.job.material_status)}`);
    if (entry.crew?.name) lines.push(`Crew: ${entry.crew.name}`);
  }
  
  if (entry.entry_type === 'assessment') {
    if (entry.service_request?.client_name) lines.push(`Client: ${entry.service_request.client_name}`);
    if (entry.sales_rep?.name) lines.push(`Rep: ${entry.sales_rep.name}`);
  }
  
  if (entry.notes) {
    lines.push('');
    lines.push(`Notes: ${entry.notes}`);
  }
  
  // Add link back to app
  lines.push('');
  lines.push(`View in app: ${getEventUrl(entry)}`);
  
  return lines.join('\n');
}

function formatMaterialStatus(status: string): string {
  const statusMap: Record<string, string> = {
    'not_sent': 'Not sent to yard',
    'sent_to_yard': 'Sent to yard',
    'picking': 'Being picked',
    'staged': 'Staged and ready',
    'loaded': 'Loaded on truck',
    'completed': 'Complete',
  };
  return statusMap[status] || status;
}

function formatCategory(entryType: string): string {
  const categoryMap: Record<string, string> = {
    'job_visit': 'Installation',
    'assessment': 'Assessment',
    'meeting': 'Meeting',
    'blocked': 'Blocked',
    'travel': 'Travel',
  };
  return categoryMap[entryType] || 'Other';
}

function getEventUrl(entry: ScheduleEntryForFeed): string {
  if (entry.job_id) {
    return `https://app.discountfenceusa.com/jobs/${entry.job_id}`;
  }
  if (entry.service_request_id) {
    return `https://app.discountfenceusa.com/requests/${entry.service_request_id}`;
  }
  return `https://app.discountfenceusa.com/schedule?date=${entry.scheduled_date}`;
}

// ============================================================================
// ACCESS LOGGING
// ============================================================================

async function logFeedAccess(
  token: string,
  eventCount: number,
  generationTimeMs: number
): Promise<void> {
  // Get token ID
  const { data: tokenData } = await supabase
    .from('user_calendar_tokens')
    .select('id')
    .eq('token', token)
    .single();

  if (!tokenData) return;

  // Update token last accessed
  await supabase
    .from('user_calendar_tokens')
    .update({
      last_accessed_at: new Date().toISOString(),
      access_count: supabase.rpc('increment', { row_id: tokenData.id }),
    })
    .eq('id', tokenData.id);

  // Log access
  await supabase
    .from('calendar_sync_log')
    .insert({
      token_id: tokenData.id,
      event_count: eventCount,
      generation_time_ms: generationTimeMs,
    });
}
```

### 6.2 API Endpoint

```typescript
// src/app/api/calendar/feed/[token]/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { generateCalendarFeed } from '@/features/schedule/utils/icalGenerator';
import { supabase } from '@/lib/supabase';

export async function GET(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const { token } = params;

    // Validate token
    const { data: tokenData, error } = await supabase
      .from('user_calendar_tokens')
      .select('*')
      .eq('token', token)
      .eq('is_active', true)
      .single();

    if (error || !tokenData) {
      return new NextResponse('Invalid or expired calendar feed token', { 
        status: 401 
      });
    }

    // Generate feed
    const icalContent = await generateCalendarFeed({
      userId: tokenData.user_id,
      token: token,
      includeJobs: tokenData.include_jobs,
      includeAssessments: tokenData.include_assessments,
      includeMeetings: tokenData.include_meetings,
      includeBlockedTime: tokenData.include_blocked_time,
      scope: tokenData.scope,
    });

    // Return with proper headers
    return new NextResponse(icalContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': `attachment; filename="dfusa-schedule.ics"`,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    });

  } catch (error) {
    console.error('Calendar feed error:', error);
    return new NextResponse('Failed to generate calendar feed', { 
      status: 500 
    });
  }
}
```

### 6.3 Calendar Sync Modal (User Settings)

```typescript
// src/features/schedule/components/modals/CalendarSyncModal.tsx

import React, { useState } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { 
  Copy, 
  RefreshCw, 
  Calendar, 
  ExternalLink,
  CheckCircle 
} from 'lucide-react';
import { useCalendarToken } from '../../hooks/useCalendarToken';
import { cn } from '@/lib/utils';

interface CalendarSyncModalProps {
  open: boolean;
  onClose: () => void;
}

export function CalendarSyncModal({ open, onClose }: CalendarSyncModalProps) {
  const { 
    token, 
    preferences,
    isLoading,
    regenerateToken,
    updatePreferences,
  } = useCalendarToken();
  
  const [copied, setCopied] = useState(false);

  const feedUrl = token 
    ? `${window.location.origin}/api/calendar/feed/${token}.ics`
    : '';

  const handleCopy = async () => {
    await navigator.clipboard.writeText(feedUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRegenerate = async () => {
    if (confirm('This will invalidate your current feed URL. Any existing calendar subscriptions will stop working. Continue?')) {
      await regenerateToken();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Sync to External Calendar
          </DialogTitle>
          <DialogDescription>
            Add your schedule to Outlook, Google Calendar, or Apple Calendar
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Feed URL */}
          <div className="space-y-2">
            <Label>Your Personal Calendar Feed</Label>
            <div className="flex gap-2">
              <input
                type="text"
                readOnly
                value={feedUrl}
                className="flex-1 px-3 py-2 text-sm border rounded-md bg-slate-50 truncate"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={handleCopy}
                className={cn(copied && "text-green-600")}
              >
                {copied ? <CheckCircle className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={handleRegenerate}
                title="Generate new URL"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-slate-500">
              This URL is private. Anyone with this link can view your schedule.
            </p>
          </div>

          {/* Instructions */}
          <div className="space-y-3">
            <Label>Setup Instructions</Label>
            
            {/* Outlook */}
            <details className="group border rounded-lg">
              <summary className="flex items-center justify-between p-3 cursor-pointer hover:bg-slate-50">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 bg-blue-600 rounded flex items-center justify-center">
                    <span className="text-white text-xs font-bold">O</span>
                  </div>
                  <span className="font-medium">Microsoft Outlook</span>
                </div>
                <ExternalLink className="h-4 w-4 text-slate-400 group-open:rotate-90 transition" />
              </summary>
              <div className="px-3 pb-3 text-sm text-slate-600 space-y-2">
                <ol className="list-decimal list-inside space-y-1">
                  <li>Open Outlook and go to <strong>Calendar</strong></li>
                  <li>Click <strong>Add calendar</strong> → <strong>Subscribe from web</strong></li>
                  <li>Paste the URL above and click <strong>Import</strong></li>
                  <li>Name it "Discount Fence USA" and choose a color</li>
                </ol>
                <p className="text-xs text-slate-500 mt-2">
                  Outlook checks for updates every 3-24 hours automatically.
                </p>
              </div>
            </details>

            {/* Google Calendar */}
            <details className="group border rounded-lg">
              <summary className="flex items-center justify-between p-3 cursor-pointer hover:bg-slate-50">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 bg-red-500 rounded flex items-center justify-center">
                    <span className="text-white text-xs font-bold">G</span>
                  </div>
                  <span className="font-medium">Google Calendar</span>
                </div>
                <ExternalLink className="h-4 w-4 text-slate-400 group-open:rotate-90 transition" />
              </summary>
              <div className="px-3 pb-3 text-sm text-slate-600 space-y-2">
                <ol className="list-decimal list-inside space-y-1">
                  <li>Open <strong>Google Calendar</strong> (calendar.google.com)</li>
                  <li>Click the <strong>+</strong> next to "Other calendars"</li>
                  <li>Select <strong>From URL</strong></li>
                  <li>Paste the URL above and click <strong>Add calendar</strong></li>
                </ol>
                <p className="text-xs text-slate-500 mt-2">
                  Google Calendar syncs every 12-24 hours.
                </p>
              </div>
            </details>

            {/* Apple Calendar */}
            <details className="group border rounded-lg">
              <summary className="flex items-center justify-between p-3 cursor-pointer hover:bg-slate-50">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 bg-slate-800 rounded flex items-center justify-center">
                    <span className="text-white text-xs font-bold">🍎</span>
                  </div>
                  <span className="font-medium">Apple Calendar</span>
                </div>
                <ExternalLink className="h-4 w-4 text-slate-400 group-open:rotate-90 transition" />
              </summary>
              <div className="px-3 pb-3 text-sm text-slate-600 space-y-2">
                <ol className="list-decimal list-inside space-y-1">
                  <li>Open <strong>Calendar</strong> on your Mac</li>
                  <li>Go to <strong>File</strong> → <strong>New Calendar Subscription</strong></li>
                  <li>Paste the URL and click <strong>Subscribe</strong></li>
                  <li>Set "Auto-refresh" to your preference</li>
                </ol>
                <p className="text-xs text-slate-500 mt-2">
                  Works on iPhone/iPad too via iCloud.
                </p>
              </div>
            </details>
          </div>

          {/* Feed Preferences */}
          <div className="space-y-3 border-t pt-4">
            <Label>Include in Feed</Label>
            
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="include-jobs"
                  checked={preferences?.include_jobs ?? true}
                  onCheckedChange={(checked) => 
                    updatePreferences({ include_jobs: !!checked })
                  }
                />
                <Label htmlFor="include-jobs" className="font-normal">
                  Jobs assigned to me
                </Label>
              </div>
              
              <div className="flex items-center gap-2">
                <Checkbox
                  id="include-assessments"
                  checked={preferences?.include_assessments ?? true}
                  onCheckedChange={(checked) => 
                    updatePreferences({ include_assessments: !!checked })
                  }
                />
                <Label htmlFor="include-assessments" className="font-normal">
                  Assessments assigned to me
                </Label>
              </div>
              
              <div className="flex items-center gap-2">
                <Checkbox
                  id="include-meetings"
                  checked={preferences?.include_meetings ?? true}
                  onCheckedChange={(checked) => 
                    updatePreferences({ include_meetings: !!checked })
                  }
                />
                <Label htmlFor="include-meetings" className="font-normal">
                  Team meetings
                </Label>
              </div>
              
              <div className="flex items-center gap-2">
                <Checkbox
                  id="include-blocked"
                  checked={preferences?.include_blocked_time ?? false}
                  onCheckedChange={(checked) => 
                    updatePreferences({ include_blocked_time: !!checked })
                  }
                />
                <Label htmlFor="include-blocked" className="font-normal">
                  Blocked time / PTO
                </Label>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

---

## Part 7: API Architecture (Vite + Supabase)

> **Note:** This project uses Vite + React (not Next.js), so there are no `/api/*` routes. Instead, we use:
> 1. **Direct Supabase calls** via `supabase-js` client for CRUD operations
> 2. **Supabase Edge Functions** for server-side operations (iCal feeds, notifications)
> 3. **Database Functions (RPC)** for complex business logic

### 7.1 Direct Supabase Client Calls (No API needed)

```typescript
// These operations use supabase-js directly from React hooks
// Located in: src/features/schedule/api/scheduleApi.ts

// Schedule Entries CRUD
supabase.from('schedule_entries').select('*').gte('scheduled_date', startDate)
supabase.from('schedule_entries').insert(newEntry)
supabase.from('schedule_entries').update(changes).eq('id', entryId)
supabase.from('schedule_entries').delete().eq('id', entryId)

// Crew Capacity
supabase.from('crew_daily_capacity').select('*').in('crew_id', crewIds)

// Unscheduled Items
supabase.from('jobs').select('*').is('scheduled_date', null)
supabase.from('service_requests').select('*').eq('status', 'pending_assessment')
```

### 7.2 Supabase Edge Functions (Server-side)

These require server-side execution for security or external API access.

```bash
# Create edge functions
supabase functions new calendar-feed
supabase functions new send-notifications
supabase functions new calculate-suggestions
```

#### Calendar Feed Edge Function

```typescript
// supabase/functions/calendar-feed/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

serve(async (req) => {
  const url = new URL(req.url);
  const token = url.pathname.split('/').pop()?.replace('.ics', '');

  if (!token) {
    return new Response('Missing token', { status: 400 });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  // Validate token
  const { data: tokenData, error } = await supabase
    .from('user_calendar_tokens')
    .select('*')
    .eq('token', token)
    .eq('is_active', true)
    .single();

  if (error || !tokenData) {
    return new Response('Invalid token', { status: 401 });
  }

  // Generate iCal content (use ical-generator logic)
  const icalContent = await generateCalendarFeed(supabase, tokenData);

  return new Response(icalContent, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'attachment; filename="dfusa-schedule.ics"',
    },
  });
});
```

**Deployed URL:** `https://<project>.supabase.co/functions/v1/calendar-feed/<token>.ics`

### 7.3 Database Functions (RPC)

For complex queries that benefit from running in the database:

```sql
-- Get assignment suggestions (runs as database function for performance)
CREATE OR REPLACE FUNCTION get_assignment_suggestions(
  p_community_id UUID,
  p_property_zip TEXT,
  p_fence_types TEXT[],
  p_footage INTEGER,
  p_preferred_date DATE
) RETURNS JSONB AS $$
DECLARE
  result JSONB;
BEGIN
  -- Complex suggestion logic here
  -- Returns { reps: [...], crews: [...], warnings: [...] }
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Call from client:
-- supabase.rpc('get_assignment_suggestions', { p_community_id: '...', ... })
```

### 7.4 API Summary

| Operation | Method | Implementation |
|-----------|--------|----------------|
| Schedule CRUD | Direct | `supabase.from('schedule_entries')` |
| Crew Capacity | Direct | `supabase.from('crew_daily_capacity')` |
| Unscheduled Items | Direct | `supabase.from('jobs').select()` |
| Assignment Suggestions | RPC | `supabase.rpc('get_assignment_suggestions')` |
| Duration Calculator | Client | Local TypeScript function |
| iCal Feed | Edge Function | `/functions/v1/calendar-feed/:token` |
| Send Notifications | Edge Function | `/functions/v1/send-notifications` |
| Morning Digest | Edge + Cron | Supabase cron triggers edge function |

---

## Part 8: React Components Summary

```
src/features/schedule/
├── pages/
│   └── SchedulePage.tsx                 # Main page with calendar + sidebar
│
├── components/
│   ├── calendar/
│   │   ├── ScheduleCalendar.tsx         # Main calendar (FullCalendar wrapper)
│   │   ├── ScheduleHeader.tsx           # Date navigation, view toggle, filters
│   │   ├── EventCard.tsx                # Custom event card rendering
│   │   ├── CapacityBar.tsx              # Daily LF capacity per crew
│   │   └── ResourceLabel.tsx            # Custom crew/rep labels
│   │
│   ├── sidebar/
│   │   ├── UnscheduledSidebar.tsx       # Jobs/Assessments awaiting scheduling
│   │   ├── UnscheduledJobCard.tsx       # Draggable job card
│   │   ├── UnscheduledAssessmentCard.tsx
│   │   └── SidebarFilters.tsx           # Filter unscheduled by type, BU
│   │
│   ├── modals/
│   │   ├── QuickScheduleModal.tsx       # "Find a Time" with AI suggestions
│   │   ├── EditScheduleModal.tsx        # Edit existing entry
│   │   ├── RescheduleModal.tsx          # Reschedule with reason
│   │   ├── CalendarSyncModal.tsx        # iCal feed setup
│   │   └── CapacityWarningModal.tsx     # Over-capacity confirmation
│   │
│   ├── cards/
│   │   ├── JobEventCard.tsx             # Job-specific card content
│   │   ├── AssessmentEventCard.tsx      # Assessment-specific card
│   │   ├── BlockedTimeCard.tsx          # Blocked/vacation display
│   │   └── MaterialStatusBadge.tsx      # Material status indicator
│   │
│   └── filters/
│       ├── FilterBar.tsx                # Main filter toolbar
│       ├── CrewFilter.tsx               # Multi-select crews
│       ├── RepFilter.tsx                # Multi-select reps
│       ├── StatusFilter.tsx             # Status checkboxes
│       └── FilterPresets.tsx            # "My Schedule", "Needs Attention"
│
├── hooks/
│   ├── useScheduleEntries.ts            # CRUD for schedule entries (TanStack Query)
│   ├── useScheduleRealtime.ts           # Supabase realtime subscription
│   ├── useCrewCapacity.ts               # Capacity data by crew/date
│   ├── useUnscheduledItems.ts           # Jobs/assessments not scheduled
│   ├── useAssignmentSuggestions.ts      # Get rep/crew suggestions
│   ├── useDurationCalculator.ts         # Calculate job duration
│   ├── useCalendarToken.ts              # iCal feed management
│   └── useScheduleFilters.ts            # Filter state management
│
├── utils/
│   ├── durationCalculator.ts            # SKU-based duration calc
│   ├── assignmentSuggester.ts           # Rep/Crew suggestions
│   ├── capacityUtils.ts                 # Capacity calculations
│   ├── conflictDetection.ts             # Schedule conflict checking
│   ├── travelTimeCalculator.ts          # Travel time estimates
│   ├── colorUtils.ts                    # Event colors
│   └── scheduleValidation.ts            # Input validation
│
├── types/
│   └── schedule.types.ts                # All TypeScript interfaces
│
└── api/
    └── scheduleApi.ts                   # Supabase client wrappers
```

---

## Part 9: Implementation Plan

> **Philosophy:** Get visual feedback fast, then layer in intelligence. Each phase delivers usable functionality.

### Phase 1: MVP Calendar (Get Visual Feedback Fast)

**Goal:** Working calendar that displays and allows basic scheduling.

- [ ] **Database Setup**
  - [ ] Core tables: `schedule_entries`, `crew_daily_capacity`
  - [ ] Triggers for capacity auto-update
  - [ ] Seed data for testing

- [ ] **FullCalendar Integration**
  - [ ] Install FullCalendar packages (already done!)
  - [ ] Basic `ScheduleCalendar.tsx` component
  - [ ] Crews and Sales Reps as resource rows
  - [ ] Display existing schedule entries

- [ ] **Basic CRUD**
  - [ ] Create entry by clicking on calendar
  - [ ] Drag-and-drop to reschedule
  - [ ] Click event to view details
  - [ ] Basic edit/delete modal

**Deliverable:** Users can see and manually schedule jobs on a visual calendar.

---

### Phase 2: Intelligence Layer

**Goal:** Smart scheduling with suggestions and capacity awareness.

- [ ] **Duration Calculator**
  - [ ] `sku_duration_rates` table + seed data
  - [ ] `gate_duration_rates` table + seed data
  - [ ] `calculateJobDuration()` function
  - [ ] Display estimated hours on job cards

- [ ] **Assignment Suggester**
  - [ ] `community_rep_preferences` table
  - [ ] `territory_assignments` table
  - [ ] `crew_skills` table
  - [ ] `suggestAssignments()` function
  - [ ] QuickScheduleModal with suggestions

- [ ] **Capacity Tracking**
  - [ ] `CapacityBar` component showing daily LF usage
  - [ ] Visual warnings for over-capacity
  - [ ] Capacity shown in tooltips

- [ ] **Unscheduled Sidebar**
  - [ ] Jobs awaiting scheduling
  - [ ] Assessments awaiting scheduling
  - [ ] Drag from sidebar to calendar
  - [ ] Filter by business unit

**Deliverable:** Smart suggestions when scheduling, visual capacity feedback.

---

### Phase 3: Real-Time & Conflict Handling

**Goal:** Multi-user safety and live updates.

- [ ] **Real-Time Updates**
  - [ ] Supabase Realtime subscription
  - [ ] Toast notifications for external changes
  - [ ] Auto-refresh queries on change

- [ ] **Conflict Detection**
  - [ ] Check conflicts before save
  - [ ] Conflict warning modal
  - [ ] "Schedule Anyway" option with overbooking

- [ ] **Multi-Day Jobs**
  - [ ] Link entries via `parent_entry_id`
  - [ ] `linked_behavior` setting (move_together vs move_independent)
  - [ ] Split job between crews feature

**Deliverable:** Safe for multiple dispatchers to use simultaneously.

---

### Phase 4: Calendar Sync & Notifications

**Goal:** External calendar integration and proactive communication.

- [ ] **iCal Feed**
  - [ ] Supabase Edge Function for feed generation
  - [ ] `user_calendar_tokens` table
  - [ ] CalendarSyncModal UI
  - [ ] Feed preferences (what to include)

- [ ] **Notifications (Optional)**
  - [ ] `notification_preferences` table
  - [ ] `notification_queue` table
  - [ ] Morning digest edge function + cron
  - [ ] Schedule change notifications

- [ ] **Travel Time (Optional)**
  - [ ] ZIP-code based estimates
  - [ ] Auto-suggest start times
  - [ ] Visual travel blocks on calendar

**Deliverable:** Crews see schedule in Outlook/Google, get proactive notifications.

---

### Phase 5: Polish & Optimization

**Goal:** Production-ready experience.

- [ ] **Filters & Presets**
  - [ ] Filter by crew, rep, status
  - [ ] "My Schedule" preset
  - [ ] "Needs Attention" preset (over-capacity, missing materials)

- [ ] **Performance**
  - [ ] Virtual scrolling for large calendars
  - [ ] Query optimization
  - [ ] Loading states

- [ ] **Mobile**
  - [ ] Responsive calendar views
  - [ ] Touch-friendly interactions
  - [ ] Mobile-optimized sidebar

**Deliverable:** Fast, polished experience on all devices.

---

## Quick Start Commands

```bash
# FullCalendar packages (already installed)
npm install @fullcalendar/core @fullcalendar/react @fullcalendar/daygrid \
  @fullcalendar/timegrid @fullcalendar/interaction @fullcalendar/list \
  @fullcalendar/resource @fullcalendar/resource-timeline

# Additional dependencies
npm install @dnd-kit/core @dnd-kit/sortable ical-generator @tanstack/react-virtual

# Run database migrations
npx supabase db push

# Deploy edge functions
npx supabase functions deploy calendar-feed

# Start development
npm run dev
```

---

## Files to Create First

1. `src/features/schedule/types/schedule.types.ts` - All TypeScript interfaces
2. `src/features/schedule/components/calendar/ScheduleCalendar.tsx` - Main calendar (FullCalendar)
3. `src/features/schedule/hooks/useScheduleEntries.ts` - TanStack Query hook for CRUD
4. `src/features/schedule/hooks/useScheduleRealtime.ts` - Real-time subscription
5. `src/features/schedule/utils/durationCalculator.ts` - Duration calculation
6. `supabase/functions/calendar-feed/index.ts` - Edge function for iCal feed

---

## Roadmap Integration

Consider adding these to your roadmap system:

| Code | Title | Status |
|------|-------|--------|
| O-CAL-001 | Calendar MVP (Phase 1) | pending |
| O-CAL-002 | Smart Scheduling Intelligence (Phase 2) | pending |
| O-CAL-003 | Real-Time & Conflicts (Phase 3) | pending |
| O-CAL-004 | Calendar Sync & Notifications (Phase 4) | pending |
| O-CAL-005 | Polish & Mobile (Phase 5) | pending |

---

**This document is ready for Claude Code implementation.**
