# Jobber Jobs Data - Complete Analysis & Dashboard Proposal

## Executive Summary

| Metric | Value |
|--------|-------|
| **Total Revenue** | $18,257,376.31 |
| **Total Jobs** | 8,305 |
| **Billable Jobs (>$300)** | 6,092 (73%) |
| **Warranty Jobs** | 1,752 (21%) |
| **Avg Billable Job Value** | $2,997 |
| **Avg Cycle Time** | 14.9 days |
| **Jobs with PO** | 82.5% |
| **Jobs with Invoice** | 97.1% |

---

## 🚨 Critical Finding: $5.67M Attribution Gap

**The Problem:** 38% of jobs ($5.67M) have no "Salesperson" field populated, but DO have "Builder Rep" filled in.

**Root Cause:** Jobber workflow inconsistency — some jobs have Salesperson, others only have Builder Rep.

**Solution:** Create `effective_salesperson` logic:
```
1. Use "Salesperson" if present
2. Else use "Builder Rep" if present  
3. Else use first name from "Visits assigned to"
4. Else mark as "(Unassigned)"
```

**With This Fix - Corrected Leaderboard:**

| Rank | Salesperson | Revenue | Jobs | Billable | Warranty | Avg Value |
|------|-------------|---------|------|----------|----------|-----------|
| 1 | Yamil Hernandez | $4,620,851 | 1,783 | 1,360 | 343 | $3,398 |
| 2 | Danny Story | $2,794,127 | 876 | 654 | 156 | $4,272 |
| 3 | Sean Hood | $1,998,278 | 834 | 721 | 72 | $2,772 |
| 4 | Jason Castro | $1,573,910 | 791 | 495 | 194 | $3,180 |
| 5 | Michael Hidalgo | $1,571,711 | 314 | 245 | 55 | $6,415 |
| 6 | Edward Samaripa | $1,422,782 | 1,120 | 691 | 354 | $2,059 |
| 7 | Hector Sandoval | $1,194,813 | 746 | 613 | 102 | $1,949 |
| 8 | Brian Ojeda | $878,443 | 616 | 453 | 143 | $1,939 |
| 9 | German Alarcon | $588,704 | 288 | 244 | 39 | $2,413 |
| 10 | Adam Sells | $526,251 | 259 | 196 | 59 | $2,685 |

---

## 📊 Proposed Dashboard Sections

### 1. **Executive Summary Cards** (Top Row)
| Card | Value | Secondary |
|------|-------|-----------|
| Total Revenue | $18.26M | Period: Last 12 months |
| Billable Jobs | 6,092 | 73% of total |
| Avg Job Value | $2,997 | Jobs > $300 |
| Avg Cycle Time | 15 days | Create → Close |
| Open Pipeline | $505K | 191 jobs |
| QBO Synced | 64% | Material + Crew Pay |

### 2. **Revenue Trend Chart**
- Monthly revenue bars (primary)
- Job count line overlay (secondary axis)
- Ability to split by location
- 12-month rolling view

### 3. **Salesperson Performance Table**
| Column | Description | Sortable |
|--------|-------------|----------|
| Rank | Position by revenue | ✓ |
| Name | Effective salesperson | ✓ |
| Revenue | Total revenue | ✓ |
| Billable Jobs | Jobs > $300 | ✓ |
| All Jobs | Total job count | ✓ |
| Warranties | Warranty count | ✓ |
| Avg Value | Revenue / Billable Jobs | ✓ |
| Create→Sched | Avg days to schedule | ✓ |
| Sched→Close | Avg days to complete | ✓ |
| Total Cycle | Avg total days | ✓ |

**Click row → Drill into individual salesperson detail**

### 4. **Salesperson Detail View** (Drill-down)
- Monthly revenue chart for that person
- Client breakdown
- Community breakdown
- Cycle time trend
- Top 10 jobs by value
- Warranty ratio trend

### 5. **Location Analysis**
| Location | Revenue | Jobs | % of Total |
|----------|---------|------|------------|
| Austin | $12,823,048 | 4,864 | 70.2% |
| San Antonio | $4,303,149 | 2,878 | 23.6% |
| Houston | $1,131,180 | 557 | 6.2% |

*Note: Houston started mid-2025*

### 6. **Project Type Breakdown**
| Type | Revenue | Jobs | % |
|------|---------|------|---|
| Fence + | $15,223,555 | 4,573 | 83.4% |
| Deck ONLY | $1,566,128 | 470 | 8.6% |
| Railing ONLY | $953,251 | 873 | 5.2% |
| Services/Repairs | $330,340 | 683 | 1.8% |
| Warranty | $8,724 | 1,461 | 0.0% |

### 7. **Client (Builder) Analysis**
Top 15 builders with:
- Revenue
- Job count
- Avg job value
- Primary salesperson
- Communities served

### 8. **Community Analysis**
Top communities with:
- Revenue
- Job count
- Primary builder
- Primary salesperson

### 9. **Cycle Time Analysis**
| Stage | Average | Median |
|-------|---------|--------|
| Create → Schedule | 7.9 days | 5.0 days |
| Schedule → Close | 7.1 days | 5.0 days |
| **Total Cycle** | 14.9 days | 11.0 days |

**Distribution Chart:**
- 0-7 days: 31.0% (1,840 jobs)
- 8-14 days: 40.1% (2,379 jobs)
- 15-30 days: 21.0% (1,249 jobs)
- 31-60 days: 6.2% (370 jobs)
- 61+ days: 1.7% (101 jobs)

### 10. **Day of Week Patterns**
Jobs created: Mon-Thu heavy, drops Friday, minimal weekends
Jobs scheduled: More even distribution including Friday

### 11. **Crew Performance**
| Crew | Jobs | Notes |
|------|------|-------|
| DAVID - David Vazquez Albor | 594 | Top performer |
| CHIKITO - Javier Policarpo | 513 | |
| CABEZON Alex | 488 | |
| LUIS A - Luis Alberto Maya | 413 | |
| VICTOR - Javier Ramirez | 406 | |

Total Crew Pay: $2,781,590 across 5,913 jobs (avg $470/job)

### 12. **Open Pipeline View**
- 191 jobs currently open
- $505,298 in pending revenue
- Breakdown by salesperson, location, age

### 13. **QBO Sync Status**
| Status | Jobs | Revenue |
|--------|------|---------|
| Material + Crew Pay | 3,263 | $11,567,058 |
| Not Started | 3,954 | $5,740,364 |
| Unable to Complete | 367 | $405,299 |
| Only Material | 334 | $316,392 |
| Only Crew Pay | 381 | $228,262 |

### 14. **Rock Fee Tracking**
- 3,135 jobs contain rock fee (38%)
- 4,564 jobs require rock fee (55%)
- 3,311 jobs pay crew rock fee (40%)

---

## 🔧 Technical Implementation Notes

### Name Normalization Map
```typescript
const NAME_NORMALIZATION: Record<string, string> = {
  'YAMIL': 'Yamil Hernandez',
  'YAMIL HERNANDEZ': 'Yamil Hernandez',
  'SEAN HOOD': 'Sean Hood',
  'JASON CASTRO': 'Jason Castro',
  'EDWARD SAMARIPA': 'Edward Samaripa',
  'DANNY STORY': 'Danny Story',
  'MICHAEL HIDALGO': 'Michael Hidalgo',
  'BRIAN OJEDA': 'Brian Ojeda',
  'JORGE MORALES': 'Jorge Morales',
  'JASON COLEMAN': 'Jason Coleman',
  'ANDREW LUCIO': 'Andrew Lucio',
  'HECTOR SANDOVAL': 'Hector Sandoval',
  'GERMAN ALARCON': 'German Alarcon',
  'CRAIG GERSHEN': 'Craig Gershen',
  'Michael Hidalgo ': 'Michael Hidalgo', // trailing space
};
```

### Effective Salesperson Logic
```typescript
function getEffectiveSalesperson(row: JobberRow): string {
  // Priority 1: Salesperson field
  const salesperson = normalize(row['Salesperson']);
  if (salesperson) return salesperson;
  
  // Priority 2: Builder Rep field
  const builderRep = normalize(row['Builder Rep']);
  if (builderRep && builderRep !== '[Add Builder Rep]') return builderRep;
  
  // Priority 3: First person from Visits assigned to
  const visits = row['Visits assigned to'];
  if (visits) {
    const first = visits.split(',')[0].split(' and ')[0].trim();
    return normalize(first);
  }
  
  return '(Unassigned)';
}
```

### Job Classification Logic
```typescript
interface JobClassification {
  isWarranty: boolean;
  isSubstantial: boolean;
  projectCategory: 'fence' | 'deck' | 'railing' | 'service' | 'warranty' | 'other';
}

function classifyJob(row: JobberRow): JobClassification {
  const revenue = parseFloat(row['Total revenue ($)']) || 0;
  const projectType = (row['Project Type'] || '').toLowerCase();
  
  return {
    isWarranty: projectType.includes('warranty') || revenue === 0,
    isSubstantial: revenue > 300,
    projectCategory: getProjectCategory(projectType),
  };
}
```

### Cycle Time Calculation
```typescript
function calculateCycleTimes(row: JobberRow) {
  const created = parseDate(row['Created date']);
  const scheduled = parseDate(row['Scheduled start date']);
  const closed = parseDate(row['Closed date']);
  
  return {
    daysToSchedule: created && scheduled ? diffDays(scheduled, created) : null,
    daysToClose: scheduled && closed ? diffDays(closed, scheduled) : null,
    totalCycleDays: created && closed ? diffDays(closed, created) : null,
    status: closed ? 'completed' : scheduled ? 'scheduled' : 'not_scheduled',
  };
}
```

---

## 📋 Filter Options

### Global Filters (Apply to All Views)
- **Date Range**: Last 30/60/90/180/365 days, YTD, Custom
- **Location**: All, Austin, San Antonio, Houston
- **Salesperson**: Dropdown of all salespeople
- **Include Warranties**: Toggle

### View-Specific Filters
- **Project Type**: Fence+, Deck, Railing, Services, Warranty
- **Client/Builder**: Dropdown
- **Community**: Dropdown
- **Pricing Tier**: Dropdown
- **QBO Status**: All, Synced, Not Started, etc.

---

## 📈 KPIs to Track Over Time

### Weekly KPIs
| KPI | Target | Current |
|-----|--------|---------|
| New Jobs Created | N/A | ~150/week |
| Jobs Closed | N/A | ~150/week |
| Revenue Closed | N/A | ~$350K/week |
| Avg Cycle Time | <14 days | 14.9 days |
| Warranty Ratio | <15% | 21% |

### Monthly Comparisons
- Revenue vs Prior Month
- Revenue vs Same Month Last Year
- Job Count Trend
- Avg Job Value Trend
- Cycle Time Trend

### Salesperson Targets
- Track individual trends
- Compare to team average
- Identify coaching opportunities

---

## 🔮 Advanced Analytics (Future)

### 1. Seasonality Analysis
- Identify peak months
- Plan crew capacity
- Forecast revenue

### 2. Builder Performance Scoring
- Revenue per job
- Warranty rate
- Payment speed
- Volume trend

### 3. Profitability Analysis
*(Note: Currently costs not tracked in Jobber - only 40 jobs have cost data)*
- Compare estimated vs actual costs
- Margin by project type
- Crew efficiency

### 4. Lead Time Prediction
- ML model to predict cycle time
- Based on: Project type, location, builder, job value

### 5. Risk Detection
- Jobs aging without scheduling
- Unusual warranty patterns
- Revenue concentration risk

---

## 🚀 Implementation Phases

### Phase 1: Core Dashboard (Week 1)
- [ ] Import with effective salesperson logic
- [ ] Summary cards
- [ ] Monthly trend chart
- [ ] Salesperson leaderboard table
- [ ] Basic filters (date, location, salesperson)

### Phase 2: Drill-downs (Week 2)
- [ ] Salesperson detail view
- [ ] Client analysis
- [ ] Community analysis
- [ ] Project type breakdown

### Phase 3: Operational Views (Week 3)
- [ ] Open pipeline tracker
- [ ] Cycle time analysis
- [ ] QBO sync status
- [ ] Day of week patterns

### Phase 4: Advanced Features (Week 4)
- [ ] Crew performance
- [ ] Rock fee tracking
- [ ] Export to Excel/PDF
- [ ] Scheduled email reports

---

## 📝 Data Quality Notes

### Fields with Good Data Quality
- Job #, Client name, Dates (Created, Scheduled, Closed)
- Total revenue, FRANCHISE LOCATION
- Project Type, Community, PO number

### Fields with Partial Data
- Salesperson (62% filled, but Builder Rep compensates)
- Quote # (43% filled)
- Procurement Estimates (spotty)

### Fields with Poor Data
- Total costs (only 40 records - not used in Jobber)
- Some custom fields inconsistently used

### Recommendations
1. **Enforce Builder Rep entry** in Jobber workflow
2. **Use Standard Product codes** consistently
3. **Track actual costs** for profitability analysis
4. **Standardize community names** (case sensitivity issues)

---

## 📊 Sample SQL Queries

### Effective Salesperson with Normalization
```sql
SELECT 
  COALESCE(
    NULLIF(TRIM(salesperson), ''),
    NULLIF(TRIM(builder_rep), ''),
    SPLIT_PART(visits_assigned_to, ',', 1)
  ) AS effective_salesperson,
  COUNT(*) AS job_count,
  SUM(total_revenue) AS total_revenue
FROM jobber_builder_jobs
WHERE total_revenue > 300
GROUP BY 1
ORDER BY 3 DESC;
```

### Monthly Trend with Location Split
```sql
SELECT 
  DATE_TRUNC('month', created_date) AS month,
  franchise_location,
  COUNT(*) AS job_count,
  SUM(total_revenue) AS revenue
FROM jobber_builder_jobs
WHERE created_date >= NOW() - INTERVAL '12 months'
GROUP BY 1, 2
ORDER BY 1, 2;
```

### Cycle Time Distribution
```sql
SELECT 
  CASE 
    WHEN total_cycle_days <= 7 THEN '0-7 days'
    WHEN total_cycle_days <= 14 THEN '8-14 days'
    WHEN total_cycle_days <= 30 THEN '15-30 days'
    WHEN total_cycle_days <= 60 THEN '31-60 days'
    ELSE '60+ days'
  END AS cycle_bucket,
  COUNT(*) AS job_count
FROM jobber_builder_jobs
WHERE total_cycle_days IS NOT NULL
  AND is_substantial = true
GROUP BY 1
ORDER BY MIN(total_cycle_days);
```

---

**Document Created:** January 14, 2026  
**Data Source:** Jobber One-off Jobs Report (8,305 records)  
**Prepared By:** Claude Analysis
