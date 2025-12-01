# Leadership Hub Feature

## Overview
The Leadership Hub provides strategic planning and initiative tracking for business functions.

## Component Architecture

### Active Components (In Production)

| Component | Purpose | Accessed Via |
|-----------|---------|--------------|
| `LeadershipHub.tsx` | Main hub container | Navigation sidebar "Leadership" |
| `FunctionWorkspace.tsx` | Function tabs container | Clicking a function in the sidebar |
| `InitiativeTimelineTab.tsx` | Weekly initiative tracking with drag-drop reordering | "Initiatives" tab |
| `AnnualPlanTab.tsx` | Annual planning with areas and initiatives | "Annual Plan 2025" tab |
| `QuarterlyPlanTab.tsx` | Quarterly objectives | "Quarterly Plan 2025" tab |
| `StrategyTab.tsx` | Strategy development | "Strategy and Planning" tab |
| `AnnualBonusKPIsTab.tsx` | KPI tracking | "Annual Bonus KPIs 2025" tab |
| `InitiativeDetailModal.tsx` | Initiative details/editing | Clicking an initiative |
| `InitiativeCard.tsx` | Initiative card display | Card view in Annual Plan |
| `TaskRow.tsx` | Task display in tables | Initiative tables |
| `TaskEditModal.tsx` | Task editing | Clicking a task |

### Archived/Reference Components (Not in Current UI)

These components were built for alternative UI layouts and are kept for potential future use:

| Component | Purpose | Notes |
|-----------|---------|-------|
| `FunctionView.tsx` | Alternative function view with Cards/Table toggle | Has drag-drop, different column layout |
| `InitiativeTableView.tsx` | Full table view with inline editing | Columns: Status, Priority, This Week, Next Week, Progress, Goals |
| `MyInitiativesView.tsx` | User's initiatives across all functions | May be integrated into MyTodos |
| `SortableTaskList.tsx` | Drag-drop task list component | Generic reusable component |

### Settings Components

| Component | Purpose |
|-----------|---------|
| `Settings/FunctionSettings.tsx` | Function management |
| `Settings/AreaSettings.tsx` | Area management |
| `Settings/AccessManagement.tsx` | Owners and members |
| `Settings/EmailSettings.tsx` | Email notification settings |

## Data Flow

```
Function → Areas → Initiatives → Tasks
                              → Weekly Updates
                              → Goal Links
```

## Key Features

- **Drag-drop reordering**: Initiatives can be reordered within areas (InitiativeTimelineTab)
- **Weekly tracking**: Track progress week-by-week with previous/current week columns
- **Week locking**: Past weeks become read-only with grace period
- **Active/Inactive filtering**: Filter initiatives by status
- **Goal linking**: Connect initiatives to annual/quarterly goals

## Hooks

- `useLeadershipQuery.ts` - All leadership data queries and mutations
- `useGoalsQuery.ts` - Goals and tasks queries
- `useWeeklyMetricsQuery.ts` - Weekly metrics tracking

---
*Last updated: December 2025*
