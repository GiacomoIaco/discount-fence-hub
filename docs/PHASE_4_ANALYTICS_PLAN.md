# Phase 4: Advanced Analytics - Implementation Plan

**Created:** December 6, 2024
**Status:** Planning

---

## Executive Summary

This plan outlines the implementation of Phase 4: Advanced Analytics for the BOM Calculator Hub. Building on the existing price history infrastructure (migration 078), we'll create comprehensive analytics dashboards for:
- **Material costs** - price trends, top movers, cost impact
- **Labor rates** - rate changes, BU comparison
- **Project performance** - status pipeline, estimator stats
- **SKU usage** - most used SKUs, cost trends
- **Business unit comparison** - benchmarking across yards
- **Yard operations** - worker performance, staging volume, stale projects alerts

---

## Current State Assessment

### Existing Infrastructure
| Component | Status | Notes |
|-----------|--------|-------|
| material_price_history table | Done | Automatic trigger logs all price changes |
| labor_rate_history table | Done | Automatic trigger logs all rate changes |
| price_change_summary view | Done | Monthly aggregation by type |
| PriceHistoryModal | Done | Timeline view for individual items |
| AnalyticsPage (basic) | Done | SKU stats, material/labor counts, recent activity |

### Database Tables Available for Analytics
- `materials` - SKU codes, costs, categories
- `labor_rates` + `labor_codes` - labor by business unit
- `bom_projects` - projects with status, BU, dates, staging dates
- `bom_project_lines` - project line items with footage, costs
- `business_units` - ATX, SA, HOU yards
- `material_price_history` - historical material prices
- `labor_rate_history` - historical labor rates
- `project_status_history` - status changes with timestamps (for yard analytics)
- `pick_progress` - item-level picking data by user

---

## Implementation Phases

### Phase 4.1: Material Price Analytics Dashboard
**Priority: High | Complexity: Medium | Est. Effort: 2-3 sessions**

#### 4.1.1 Database Changes
```sql
-- New view for material price trends
CREATE VIEW v_material_price_trends AS
SELECT
  m.id,
  m.material_code,
  m.material_name,
  m.category,
  m.unit_cost as current_price,
  mph.changed_at,
  mph.old_price,
  mph.new_price,
  mph.price_change,
  mph.price_change_percent,
  DATE_TRUNC('week', mph.changed_at) as week,
  DATE_TRUNC('month', mph.changed_at) as month
FROM materials m
LEFT JOIN material_price_history mph ON m.id = mph.material_id
ORDER BY mph.changed_at DESC;

-- Top movers view (biggest price changes in period)
CREATE VIEW v_material_top_movers AS
SELECT
  material_id,
  material_code,
  material_name,
  SUM(price_change) as total_change,
  COUNT(*) as change_count,
  AVG(price_change_percent) as avg_change_percent
FROM material_price_history
WHERE changed_at >= NOW() - INTERVAL '30 days'
GROUP BY material_id, material_code, material_name
ORDER BY ABS(SUM(price_change)) DESC;
```

#### 4.1.2 UI Components
| Component | Description |
|-----------|-------------|
| `MaterialPriceTrendsChart` | Line chart showing price over time (Recharts) |
| `TopMoversCard` | Table of materials with biggest price changes |
| `CategoryPriceCard` | Avg price by category with trend indicators |
| `PriceAlertsSection` | Configurable alerts (>X% change notification) |
| `CostImpactCalculator` | Calculate cost impact for X footage |

#### 4.1.3 Page Layout
```
┌─────────────────────────────────────────────────────────────┐
│ Material Price Analytics                    [7d][30d][90d]  │
├─────────────────────────────────────────────────────────────┤
│ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────┐ │
│ │ Total SKUs  │ │ Price       │ │ Top Movers  │ │ Alerts  │ │
│ │    847      │ │ Changes: 23 │ │     5       │ │    2    │ │
│ └─────────────┘ └─────────────┘ └─────────────┘ └─────────┘ │
├─────────────────────────────────────────────────────────────┤
│ Price Trends Chart (12 weeks)                  [By Category]│
│ ┌─────────────────────────────────────────────────────────┐ │
│ │     ^                                                   │ │
│ │     │    ___/\___                                      │ │
│ │     │___/        \___                                  │ │
│ │     └─────────────────────────────────────────────────→│ │
│ └─────────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────┤
│ Top Movers (Last 30 Days)              │ Category Breakdown │
│ ┌───────────────────────────────────┐  │ ┌────────────────┐ │
│ │ +12.5% 2x4x8 Cedar Rail           │  │ │ Posts     $XXX │ │
│ │ +8.2%  Picket Dog Ear 6ft         │  │ │ Rails     $XXX │ │
│ │ -5.1%  Post Cap Steel             │  │ │ Pickets   $XXX │ │
│ └───────────────────────────────────┘  │ └────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

---

### Phase 4.2: Labor Rate Analytics
**Priority: High | Complexity: Low | Est. Effort: 1-2 sessions**

#### 4.2.1 Database Changes
```sql
-- Labor rate comparison by BU
CREATE VIEW v_labor_rate_comparison AS
SELECT
  lc.code as labor_code,
  lc.description,
  bu.code as bu_code,
  bu.name as bu_name,
  lr.rate,
  lrh.old_rate,
  lrh.rate_change,
  lrh.rate_change_percent,
  lrh.changed_at
FROM labor_rates lr
JOIN labor_codes lc ON lr.labor_code_id = lc.id
JOIN business_units bu ON lr.business_unit_id = bu.id
LEFT JOIN labor_rate_history lrh ON lr.id = lrh.labor_rate_id
ORDER BY lc.code, bu.code;
```

#### 4.2.2 UI Components
| Component | Description |
|-----------|-------------|
| `LaborRateTrendsChart` | Rate changes over time by labor code |
| `BUComparisonTable` | Side-by-side rates: ATX vs SA vs HOU |
| `LaborCodeAnalysis` | Drill-down into specific labor codes |
| `RateChangeTimeline` | Visual timeline of rate adjustments |

---

### Phase 4.3: Projects & Bundles Analytics
**Priority: High | Complexity: Medium | Est. Effort: 2-3 sessions**

#### 4.3.1 Database Changes
```sql
-- Project analytics view
CREATE VIEW v_project_analytics AS
SELECT
  p.id,
  p.project_name,
  p.customer_name,
  p.business_unit_id,
  bu.code as bu_code,
  p.status,
  p.created_at,
  p.updated_at,
  p.created_by,
  u.raw_user_meta_data->>'name' as created_by_name,
  COUNT(pl.id) as line_count,
  SUM(pl.footage) as total_footage,
  SUM(pl.material_cost) as total_material_cost,
  SUM(pl.labor_cost) as total_labor_cost,
  SUM(pl.material_cost + pl.labor_cost) as total_cost,
  SUM(pl.material_cost + pl.labor_cost) / NULLIF(SUM(pl.footage), 0) as cost_per_foot
FROM bom_projects p
LEFT JOIN bom_project_lines pl ON p.id = pl.project_id
LEFT JOIN business_units bu ON p.business_unit_id = bu.id
LEFT JOIN auth.users u ON p.created_by = u.id
GROUP BY p.id, bu.code, u.raw_user_meta_data;

-- Projects by status summary
CREATE VIEW v_project_status_summary AS
SELECT
  status,
  COUNT(*) as count,
  DATE_TRUNC('week', created_at) as week
FROM bom_projects
GROUP BY status, DATE_TRUNC('week', created_at);
```

#### 4.3.2 UI Components
| Component | Description |
|-----------|-------------|
| `ProjectStatusPipeline` | Visual pipeline: Draft → Ready → Sent → Complete |
| `EstimatorLeaderboard` | Projects by user with metrics |
| `CostPerFootTrend` | Avg cost/ft over time by fence type |
| `ProjectVolumeChart` | Projects created per week/month |
| `ProfitabilityAnalysis` | If sell price available, show margins |

#### 4.3.3 Page Layout
```
┌─────────────────────────────────────────────────────────────┐
│ Projects Analytics                          [This Month ▼]  │
├─────────────────────────────────────────────────────────────┤
│ Pipeline                                                    │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐        │
│ │ Draft    │→│ Ready    │→│ Sent     │→│ Complete │        │
│ │    12    │ │    8     │ │    5     │ │    45    │        │
│ └──────────┘ └──────────┘ └──────────┘ └──────────┘        │
├─────────────────────────────────────────────────────────────┤
│ Estimator Performance              │ Cost/Ft by Fence Type │
│ ┌────────────────────────────────┐ │ ┌─────────────────────┐│
│ │ 1. John S.  - 28 projects      │ │ │ Wood 6ft: $18.50   ││
│ │ 2. Maria G. - 22 projects      │ │ │ Wood 8ft: $24.20   ││
│ │ 3. Alex R.  - 15 projects      │ │ │ Iron 4ft: $45.00   ││
│ └────────────────────────────────┘ │ └─────────────────────┘│
├─────────────────────────────────────────────────────────────┤
│ Projects Created (Last 12 Weeks)                            │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │    ▄█▄                    ▄▄▄                           │ │
│ │ ▄██████▄  ▄██▄       ▄▄█████████▄                      │ │
│ │ W1 W2 W3 W4 W5 W6 W7 W8 W9 W10 W11 W12                │ │
│ └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

---

### Phase 4.4: SKU Performance Analytics
**Priority: Medium | Complexity: Medium | Est. Effort: 2 sessions**

#### 4.4.1 Database Changes
```sql
-- SKU usage analytics (most used SKUs)
CREATE VIEW v_sku_usage AS
SELECT
  pl.sku_code,
  pl.sku_name,
  pl.fence_type,
  COUNT(DISTINCT pl.project_id) as project_count,
  SUM(pl.footage) as total_footage,
  SUM(pl.material_cost) as total_material_cost,
  SUM(pl.labor_cost) as total_labor_cost,
  AVG(pl.material_cost / NULLIF(pl.footage, 0)) as avg_material_cost_per_ft,
  AVG(pl.labor_cost / NULLIF(pl.footage, 0)) as avg_labor_cost_per_ft
FROM bom_project_lines pl
GROUP BY pl.sku_code, pl.sku_name, pl.fence_type
ORDER BY total_footage DESC;

-- SKU cost trends
CREATE VIEW v_sku_cost_trends AS
SELECT
  pl.sku_code,
  pl.sku_name,
  DATE_TRUNC('month', p.created_at) as month,
  AVG(pl.material_cost / NULLIF(pl.footage, 0)) as avg_cost_per_ft,
  SUM(pl.footage) as monthly_footage
FROM bom_project_lines pl
JOIN bom_projects p ON pl.project_id = p.id
GROUP BY pl.sku_code, pl.sku_name, DATE_TRUNC('month', p.created_at);
```

#### 4.4.2 UI Components
| Component | Description |
|-----------|-------------|
| `MostUsedSKUsTable` | Top 20 SKUs by footage |
| `SKUCostTrend` | Cost/ft trend for selected SKU |
| `SlowMovingSKUs` | SKUs with declining usage |
| `SKUMarginAnalysis` | Material + labor cost breakdown |

---

### Phase 4.5: Business Unit Comparison
**Priority: Medium | Complexity: Low | Est. Effort: 1 session**

#### 4.5.1 UI Components
| Component | Description |
|-----------|-------------|
| `BUCostComparison` | Material costs by BU |
| `BULaborComparison` | Labor rates by BU |
| `BUProjectVolume` | Projects by BU |
| `BUBenchmarking` | Avg cost/ft by BU |

#### 4.5.2 Data Points to Compare
- Average material cost per foot
- Average labor cost per foot
- Number of projects
- Total footage
- Average project size
- Labor rate differences by code

---

### Phase 4.6: Trend Analysis
**Priority: Low | Complexity: High | Est. Effort: 3-4 sessions**

#### 4.6.1 Features
| Feature | Description |
|---------|-------------|
| Seasonal Patterns | Identify high/low seasons |
| Year-over-Year | Compare to same period last year |
| Cost Forecasting | Project future costs based on trends |
| Anomaly Detection | Flag unusual price movements |

#### 4.6.2 Implementation Notes
- Requires sufficient historical data (6+ months)
- May need statistical libraries (simple-statistics)
- Start with basic trend lines, add sophistication later

---

### Phase 4.8: Yard Operations Analytics
**Priority: High | Complexity: Medium | Est. Effort: 2-3 sessions**

#### 4.8.1 Database Changes
```sql
-- Yard worker performance view
CREATE VIEW v_yard_worker_performance AS
SELECT
  psh.changed_by as worker_id,
  u.raw_user_meta_data->>'name' as worker_name,
  DATE_TRUNC('day', psh.changed_at) as work_date,
  COUNT(*) FILTER (WHERE psh.new_status = 'staged') as projects_staged,
  COUNT(*) FILTER (WHERE psh.new_status = 'loaded') as projects_loaded,
  COUNT(*) FILTER (WHERE psh.new_status = 'complete') as projects_completed
FROM project_status_history psh
LEFT JOIN auth.users u ON psh.changed_by = u.id
WHERE psh.new_status IN ('staged', 'loaded', 'complete')
GROUP BY psh.changed_by, u.raw_user_meta_data->>'name', DATE_TRUNC('day', psh.changed_at);

-- Daily staging volume
CREATE VIEW v_daily_staging_volume AS
SELECT
  DATE_TRUNC('day', psh.changed_at) as work_date,
  bu.code as yard_code,
  COUNT(*) as projects_staged
FROM project_status_history psh
JOIN bom_projects p ON psh.project_id = p.id
JOIN business_units bu ON p.business_unit_id = bu.id
WHERE psh.new_status = 'staged'
GROUP BY DATE_TRUNC('day', psh.changed_at), bu.code
ORDER BY work_date DESC;

-- Average time metrics (staged to loaded, loaded to complete)
CREATE VIEW v_yard_time_metrics AS
SELECT
  p.id as project_id,
  p.project_code,
  bu.code as yard_code,
  staged.changed_at as staged_at,
  loaded.changed_at as loaded_at,
  completed.changed_at as completed_at,
  EXTRACT(EPOCH FROM (loaded.changed_at - staged.changed_at)) / 3600 as hours_staged_to_loaded,
  EXTRACT(EPOCH FROM (completed.changed_at - loaded.changed_at)) / 3600 as hours_loaded_to_complete,
  EXTRACT(EPOCH FROM (completed.changed_at - staged.changed_at)) / 3600 as hours_staged_to_complete
FROM bom_projects p
JOIN business_units bu ON p.business_unit_id = bu.id
LEFT JOIN LATERAL (
  SELECT changed_at FROM project_status_history
  WHERE project_id = p.id AND new_status = 'staged'
  ORDER BY changed_at LIMIT 1
) staged ON true
LEFT JOIN LATERAL (
  SELECT changed_at FROM project_status_history
  WHERE project_id = p.id AND new_status = 'loaded'
  ORDER BY changed_at LIMIT 1
) loaded ON true
LEFT JOIN LATERAL (
  SELECT changed_at FROM project_status_history
  WHERE project_id = p.id AND new_status = 'complete'
  ORDER BY changed_at LIMIT 1
) completed ON true
WHERE staged.changed_at IS NOT NULL;

-- Stale projects (staged for more than 3 business days)
CREATE VIEW v_stale_yard_projects AS
SELECT
  p.id,
  p.project_code,
  p.project_name,
  p.customer_name,
  bu.code as yard_code,
  p.status,
  staged.changed_at as staged_at,
  p.expected_pickup_date,
  -- Calculate business days since staged
  (SELECT COUNT(*) FROM generate_series(
    staged.changed_at::date,
    CURRENT_DATE,
    '1 day'::interval
  ) d WHERE EXTRACT(DOW FROM d) NOT IN (0, 6)) - 1 as business_days_staged
FROM bom_projects p
JOIN business_units bu ON p.business_unit_id = bu.id
LEFT JOIN LATERAL (
  SELECT changed_at FROM project_status_history
  WHERE project_id = p.id AND new_status = 'staged'
  ORDER BY changed_at DESC LIMIT 1
) staged ON true
WHERE p.status IN ('staged', 'loaded')
  AND staged.changed_at IS NOT NULL
  AND (SELECT COUNT(*) FROM generate_series(
    staged.changed_at::date,
    CURRENT_DATE,
    '1 day'::interval
  ) d WHERE EXTRACT(DOW FROM d) NOT IN (0, 6)) - 1 >= 3;
```

#### 4.8.2 UI Components
| Component | Description |
|-----------|-------------|
| `YardWorkerLeaderboard` | Orders staged by person (daily/weekly/monthly) |
| `DailyStagingChart` | Bar chart of staging volume per day |
| `YardTimeMetrics` | Avg time: staged→loaded, loaded→complete |
| `StaleProjectsAlert` | Projects sitting 3+ business days |
| `YardPerformanceCards` | Quick stats: today's staging, avg cycle time |

#### 4.8.3 Page Layout
```
┌─────────────────────────────────────────────────────────────┐
│ Yard Operations Analytics                   [This Week ▼]   │
├─────────────────────────────────────────────────────────────┤
│ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────┐ │
│ │ Staged      │ │ Avg Time    │ │ Loaded      │ │ Stale   │ │
│ │ Today: 12   │ │ to Load:    │ │ Today: 8    │ │ ⚠️ 3    │ │
│ │ Week: 45    │ │ 4.2 hrs     │ │ Week: 38    │ │         │ │
│ └─────────────┘ └─────────────┘ └─────────────┘ └─────────┘ │
├─────────────────────────────────────────────────────────────┤
│ Staging Volume (Last 14 Days)                               │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │     ▄▄                                                  │ │
│ │  ▄▄████▄▄     ▄▄▄▄                    ▄▄▄▄▄▄           │ │
│ │  ████████▄▄▄▄██████▄▄  ▄▄▄▄  ▄▄▄▄▄▄▄▄████████▄▄▄       │ │
│ │  M  T  W  Th F  S  Su M  T  W  Th F  S  Su             │ │
│ └─────────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────┤
│ Worker Leaderboard            │ Time Metrics by Yard       │
│ ┌───────────────────────────┐ │ ┌─────────────────────────┐│
│ │ 🥇 Carlos M.  - 28 staged │ │ │ ATX: 3.5 hrs avg       ││
│ │ 🥈 Jose R.    - 22 staged │ │ │ SA:  4.8 hrs avg       ││
│ │ 🥉 Miguel S.  - 18 staged │ │ │ HOU: 4.1 hrs avg       ││
│ └───────────────────────────┘ │ └─────────────────────────┘│
├─────────────────────────────────────────────────────────────┤
│ ⚠️ Stale Projects (3+ Business Days in Yard)               │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ ABC-045 | Smith Residence | ATX | Staged 5 days | ⚡    │ │
│ │ DEF-089 | Johnson Home    | SA  | Staged 4 days | ⚡    │ │
│ │ GHI-123 | Davis Property  | HOU | Staged 3 days | ⚡    │ │
│ └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

#### 4.8.4 Stale Projects Alert (Also in Pick Lists Page)
In addition to the Analytics page, add a prominent alert to the **Pick Lists page**:

```typescript
// Add to YardSchedulePage.tsx
const StaleProjectsBanner = ({ count, onClick }) => (
  <div className="bg-amber-50 border-l-4 border-amber-500 p-4 mb-4 cursor-pointer hover:bg-amber-100"
       onClick={onClick}>
    <div className="flex items-center">
      <AlertTriangle className="w-5 h-5 text-amber-600 mr-3" />
      <div>
        <p className="font-medium text-amber-800">
          {count} project{count !== 1 ? 's' : ''} have been in the yard for 3+ business days
        </p>
        <p className="text-sm text-amber-600">Click to view and take action</p>
      </div>
    </div>
  </div>
);
```

---

### Phase 4.7: Export & Scheduled Reports
**Priority: Low | Complexity: Medium | Est. Effort: 2 sessions**

#### 4.7.1 Export Formats
| Format | Library | Notes |
|--------|---------|-------|
| Excel | xlsx | Full data with multiple sheets |
| PDF | jspdf + html2canvas | Formatted report with charts |
| CSV | Native | Simple data export |

#### 4.7.2 Report Types
- Material Price Summary
- Labor Rate Summary
- Project Performance
- SKU Usage Report
- Business Unit Comparison

#### 4.7.3 Scheduling (Future)
- Supabase Edge Functions for scheduled jobs
- Email delivery via Resend or similar
- Weekly/monthly automated reports

---

## Technical Implementation Details

### Chart Library
**Recommendation: Recharts**
- Already used in the codebase (if not, lightweight and React-native)
- Good documentation
- Supports line, bar, area, pie charts
- Responsive and accessible

```bash
npm install recharts
```

### Data Fetching Strategy
- Use TanStack Query (already in use)
- Implement query keys by timeframe
- Cache analytics data for 5 minutes
- Refresh on window focus

### New Page Structure
```
src/features/bom_calculator/pages/
├── AnalyticsPage.tsx          # Current basic dashboard
├── analytics/
│   ├── MaterialPriceAnalytics.tsx
│   ├── LaborRateAnalytics.tsx
│   ├── ProjectAnalytics.tsx
│   ├── SKUPerformance.tsx
│   ├── BusinessUnitComparison.tsx
│   └── TrendAnalysis.tsx
└── analytics/components/
    ├── TimeFrameSelector.tsx
    ├── TrendChart.tsx
    ├── TopMoversCard.tsx
    ├── StatusPipeline.tsx
    └── ExportButton.tsx
```

### Navigation Updates
Add sub-navigation to Analytics page:
```typescript
type AnalyticsSection =
  | 'overview'
  | 'materials'
  | 'labor'
  | 'projects'
  | 'skus'
  | 'business-units'
  | 'trends';
```

---

## Implementation Order

| Step | Task | Priority | Dependencies |
|------|------|----------|--------------|
| 1 | Install Recharts (if needed) | High | None |
| 2 | Create analytics views (SQL migration) | High | None |
| 3 | Build TimeFrameSelector component | High | None |
| 4 | Build Yard Operations Analytics page | High | Views, Recharts |
| 5 | Add Stale Projects alert to Pick Lists | High | Stale view |
| 6 | Build Material Price Analytics page | High | Views, Recharts |
| 7 | Build Project Analytics page | High | Views |
| 8 | Build Labor Rate Analytics page | Medium | Views |
| 9 | Build SKU Performance page | Medium | Views |
| 10 | Build BU Comparison page | Medium | Views |
| 11 | Add export functionality | Medium | All pages |
| 12 | Build Trend Analysis | Low | 6+ months data |
| 13 | Add scheduled reports | Low | Export, Edge Functions |

---

## Success Metrics

| Metric | Target |
|--------|--------|
| Page Load Time | < 2 seconds |
| Chart Render Time | < 500ms |
| Data Freshness | < 5 min cache |
| Export Time | < 5 seconds for 1000 rows |

---

## Questions to Clarify Before Starting

1. **Price Alerts**: Should alerts be stored in DB or session-only?
2. **User Preferences**: Save preferred timeframe/filters per user?
3. **Historical Data**: How far back should charts go (6 months? 1 year? all time)?
4. **Access Control**: Analytics visible to all operations users or admins only?
5. **Export Format**: Any specific Excel template requirements?

---

## Next Steps

1. Review and approve this plan
2. Start with Phase 4.1 (Material Price Analytics) or 4.3 (Project Analytics) based on business priority
3. Create database migration for analytics views
4. Build first analytics page with charts

---

*Plan Version: 1.0*
*Author: Claude*
