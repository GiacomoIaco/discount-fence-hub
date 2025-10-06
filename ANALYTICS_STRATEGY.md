# Analytics Strategy & Consolidation Plan

## 🎯 Strategic Decision: Unified Analytics Dashboard

### Current State
Currently, analytics capabilities are scattered:
1. **Analytics.tsx** - Basic request analytics (win rate, volume)
2. **Sales Coach** - Individual performance metrics, team leaderboard
3. **Photo Gallery** - No analytics (quality scores, AI confidence, usage)
4. **App Usage** - No tracking (logins, feature usage, time spent)

### Recommendation: **UNIFIED DASHBOARD WITH DRILL-DOWN**

## 📊 Proposed Analytics Architecture

### **Main Analytics Dashboard** (analytics section in sidebar)

#### **Overview Tab** - Executive Summary
- **Key Metrics Cards** (Top Row):
  - Total Requests (30 days)
  - Win Rate %
  - Average Response Time
  - Team Productivity Score

- **Quick Insights** (Second Row):
  - Requests by Type (pie chart)
  - Trends (line chart - last 30 days)
  - SLA Compliance (gauge)
  - Top Performers (mini leaderboard)

#### **Requests Tab** - Detailed Request Analytics
**From existing Analytics.tsx + enhancements:**
- Request volume over time (daily/weekly/monthly)
- Win/Loss analysis with reasons
- Type distribution (pricing, material, warranty, etc.)
- Stage duration (time in each stage)
- Urgency distribution
- Response time metrics
- Assignment patterns
- Geographic distribution (if territory data available)
- **Filters**: Date range, type, assignee, submitter

#### **Team Performance Tab** - People Analytics
**Consolidated from Sales Coach leaderboard + request metrics:**
- Individual performance scorecards:
  - Requests handled
  - Average response time
  - Win rate
  - Sales coach scores
  - Customer satisfaction (if we add ratings)
- Team comparisons
- Skill development tracking
- Coaching effectiveness metrics
- **Filters**: Time period, role, team

#### **Sales Coach Tab** - Sales Performance
**From Sales Coach analytics:**
- Team-wide sales metrics
- Process adherence scores
- Common strengths/weaknesses
- Question-asking trends
- Objection handling success
- Sentiment analysis aggregates
- Improvement over time
- **Drill-down**: Click to see individual recordings

#### **Photo Gallery Tab** - Content Analytics
**NEW - track photo usage and quality:**
- Photos uploaded (over time)
- AI confidence score distribution
- Quality score trends
- Enhancement usage
- Most used tags
- Popular content categories
- Publishing workflow efficiency
- **Filters**: Date range, photographer, category

#### **App Usage Tab** - Platform Analytics
**NEW - track overall app health:**
- Daily/Weekly/Monthly active users
- Feature usage breakdown:
  - Most used sections
  - Time spent per feature
  - Mobile vs Desktop usage
- Login patterns (peak hours, days)
- Offline usage frequency
- PWA installation rate
- Error rates by feature
- Performance metrics (load times)

### 🔄 Navigation Pattern

```
Main App Sidebar
└── Analytics (📊 icon)
    ├── Overview (default view)
    ├── Requests
    ├── Team Performance
    ├── Sales Coach
    ├── Photo Gallery
    └── App Usage
```

**Within each tab:**
- Date range selector (Last 7/30/90 days, Custom)
- Export button (CSV/PDF)
- Refresh button
- Additional filters specific to that section

**Drill-down pattern:**
- Click on any chart/metric → opens filtered detailed view
- Click on team member → opens individual performance detail
- Click on request type → filters to show those requests
- "View Details" links to actual records (requests, recordings, photos)

---

## 🏗️ Implementation Plan

### Phase 1: Consolidate Existing Analytics ✅ (Current State)
- [x] Basic request analytics in Analytics.tsx
- [x] Sales Coach leaderboard
- [x] Win rate tracking

### Phase 2: Unified Dashboard Structure (Week 1-2)
- [ ] Create tabbed analytics interface
- [ ] Move existing request analytics to "Requests" tab
- [ ] Add "Overview" tab with summary cards
- [ ] Design consistent chart components
- [ ] Add date range selector

### Phase 3: Team Performance (Week 2-3)
- [ ] Aggregate request data by assignee
- [ ] Integrate Sales Coach scores
- [ ] Create individual scorecards
- [ ] Add team comparison views
- [ ] Build performance trends

### Phase 4: Sales Coach Analytics (Week 3-4)
- [ ] Aggregate recording analysis data
- [ ] Add process step completion trends
- [ ] Create sentiment analysis aggregates
- [ ] Build improvement tracking
- [ ] Add coaching ROI metrics

### Phase 5: Photo & Content Analytics (Week 4-5)
- [ ] Track photo upload metrics
- [ ] Analyze AI confidence trends
- [ ] Monitor enhancement usage
- [ ] Tag popularity analysis
- [ ] Quality trend tracking

### Phase 6: App Usage Analytics (Week 5-6)
- [ ] Implement usage tracking (privacy-conscious)
- [ ] Track feature engagement
- [ ] Monitor login patterns
- [ ] Measure PWA adoption
- [ ] Performance monitoring

### Phase 7: Advanced Features (Week 6+)
- [ ] Export capabilities (CSV, PDF, Excel)
- [ ] Scheduled reports (email digest)
- [ ] Custom dashboards per role
- [ ] Predictive analytics (ML trends)
- [ ] Anomaly detection

---

## 🎨 Design Principles

### 1. **Role-Based Views**
- **Sales**: Focus on personal performance, team leaderboard
- **Operations**: Request queue health, SLA compliance
- **Sales Manager**: Team performance, coaching effectiveness
- **Admin**: Full analytics access, app health, ROI

### 2. **Progressive Disclosure**
- Start with high-level overview
- Allow drill-down to details
- Keep charts simple and clear
- Provide export for deep analysis

### 3. **Actionable Insights**
- Don't just show data, show what it means
- Highlight problems (red), opportunities (green)
- Suggest actions based on trends
- Compare to benchmarks/goals

### 4. **Real-Time Updates**
- Use Supabase Realtime for live metrics
- Auto-refresh every 5 minutes
- Manual refresh button
- "Last updated" timestamp

### 5. **Performance**
- Cache expensive queries
- Use aggregation tables for historical data
- Lazy load charts (only render visible tabs)
- Optimize database queries with indexes

---

## 📈 Key Metrics by Stakeholder

### **Sales Reps**
- My win rate vs team average
- My response time vs target
- My sales coach score trend
- My requests this week/month

### **Operations Team**
- Queue health (new, pending, breached)
- SLA compliance %
- Assignment distribution
- Response time averages

### **Sales Managers**
- Team win rate
- Individual performance rankings
- Coaching ROI (score improvement)
- Sales process adherence

### **Admins**
- Platform-wide KPIs
- User engagement
- Feature adoption rates
- System health
- ROI on AI features (cost vs value)

---

## 💾 Database Requirements

### New Tables Needed:

#### `analytics_app_usage`
```sql
- id (uuid)
- user_id (uuid, FK to auth.users)
- feature (text) -- e.g., 'requests', 'photo-gallery', 'sales-coach'
- action (text) -- e.g., 'view', 'create', 'edit'
- duration_seconds (int, nullable)
- timestamp (timestamptz)
- device_type (text) -- 'mobile', 'desktop'
- session_id (uuid)
```

#### `analytics_photo_metrics`
```sql
- id (uuid)
- photo_id (uuid, FK to photos)
- uploaded_at (timestamptz)
- ai_confidence (int)
- quality_score (int)
- was_enhanced (boolean)
- published_at (timestamptz, nullable)
- tags_count (int)
```

#### `analytics_request_metrics` (aggregate table)
```sql
- id (uuid)
- date (date)
- request_type (text)
- stage (text)
- assignee_id (uuid, FK to user_profiles)
- count (int)
- avg_response_time_hours (decimal)
- avg_completion_time_hours (decimal)
- win_count (int, for pricing)
- loss_count (int, for pricing)
```

### Indexes Needed:
```sql
CREATE INDEX idx_analytics_usage_user_timestamp ON analytics_app_usage(user_id, timestamp DESC);
CREATE INDEX idx_analytics_usage_feature_timestamp ON analytics_app_usage(feature, timestamp DESC);
CREATE INDEX idx_analytics_photo_uploaded_at ON analytics_photo_metrics(uploaded_at DESC);
CREATE INDEX idx_analytics_request_date ON analytics_request_metrics(date DESC);
```

---

## 🔒 Privacy & Compliance

### Data Collection Guidelines:
1. **No PII in analytics**: Aggregate only, use IDs not names
2. **User consent**: Inform users about usage tracking
3. **Data retention**: Keep analytics data for 1 year max
4. **Anonymization**: Option to view team trends without individual names
5. **Opt-out**: Allow users to opt out of personal tracking (keep team aggregates)

### GDPR/Privacy Considerations:
- Document what data is collected and why
- Provide data export for users
- Allow data deletion on user request
- Use session-based tracking (not persistent IDs)
- No third-party analytics tools (all in-house)

---

## 📊 Chart Library Selection

### Recommended: **Recharts**
**Pros:**
- React-native, composable
- Great TypeScript support
- Responsive out of the box
- Good documentation
- Works well with TailwindCSS

**Alternative: Chart.js with react-chartjs-2**
**Pros:**
- More chart types
- Better performance for large datasets
- More customization options

**Decision**: Start with Recharts for speed, migrate to Chart.js if needed

---

## 🚀 Success Metrics

After implementing unified analytics, measure success by:

1. **User Engagement**:
   - % of users who view analytics weekly
   - Average time spent in analytics section
   - Most viewed tabs/charts

2. **Decision Impact**:
   - Track if analytics views correlate with behavior changes
   - Survey: "Have analytics helped you improve?"
   - Measure if response times improve after viewing analytics

3. **Business Value**:
   - Faster identification of bottlenecks
   - Improved win rates through insights
   - Better resource allocation
   - Reduced SLA breaches

---

## 🎯 Next Actions

**For Decision:**
1. ✅ **Approve unified dashboard approach** vs distributed
2. **Prioritize tabs**: Which to build first?
   - Recommendation: Overview → Requests → Team Performance → Others
3. **Privacy approach**: Full tracking or opt-in?
   - Recommendation: Opt-out (track by default, allow disable)

**For Development:**
1. Create shared chart components
2. Build tabbed analytics container
3. Migrate existing Analytics.tsx to "Requests" tab
4. Add "Overview" tab with summary
5. Implement usage tracking infrastructure

---

**Document Status**: Draft for Review
**Last Updated**: January 2025
**Next Review**: After Phase 2 completion
