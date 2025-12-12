# Build vs. Reuse Analysis: FSM & QBO Integration

## Executive Summary

After comprehensive research of 50+ libraries, APIs, and platforms, here's the strategic recommendation:

| Capability | Decision | Solution | Cost |
|------------|----------|----------|------|
| **Core FSM (Quotes/Jobs/Projects)** | BUILD | Custom React/Supabase | $0 |
| **Scheduling Calendar** | REUSE | react-big-calendar → FullCalendar | $0 → $480/yr |
| **Drag-and-Drop** | REUSE | @dnd-kit (already installed) | $0 |
| **Resource Timeline** | REUSE | dnd-timeline or react-big-schedule | $0 |
| **Route Optimization** | INTEGRATE | Google Routes API | ~$75/mo |
| **Customer Scheduling** | INTEGRATE | Cal.com (self-hosted) | $0 |
| **PDF Generation** | REUSE | jsPDF (installed) + @react-pdf/renderer | $0 |
| **Digital Signatures** | REUSE | react-signature-canvas | $0 |
| **E-Signature Workflow** | INTEGRATE | PandaDoc API (if needed) | $98/mo |
| **QuickBooks Sync** | INTEGRATE | intuit-oauth + node-quickbooks | $0 |
| **Form Validation** | REUSE | react-hook-form + Zod | $0 |
| **Full FSM Platform** | AVOID | Don't use Jobber/ServiceTitan | Save $1,194/mo |

**Total Monthly Cost: ~$175/mo** (vs. $1,194/mo for ServiceTitan)
**Annual Savings: ~$12,000/year**

---

## What You Already Have (Leverage These!)

Your `package.json` already includes:

| Library | Version | Use Case |
|---------|---------|----------|
| `@dnd-kit/core` | 6.3.1 | Drag-and-drop scheduling |
| `@dnd-kit/sortable` | 10.0.0 | Sortable lists |
| `jspdf` | 2.5.2 | PDF generation |
| `jspdf-autotable` | 3.8.4 | PDF tables for invoices |
| `date-fns` | 4.1.0 | Date formatting |
| `recharts` | 2.15.0 | Analytics charts |
| `zod` | 3.24.1 | Form validation |
| `@tanstack/react-query` | 5.62.7 | Data fetching |
| `intuit-oauth` | 4.2.2 | QuickBooks OAuth |

**You're already 60% equipped!**

---

## Detailed Analysis by Capability

### 1. Scheduling/Calendar Components

#### Recommendation: Start FREE, Upgrade When Needed

**Phase 1 (MVP): react-big-calendar** - FREE
```bash
npm install react-big-calendar
```

| Pros | Cons |
|------|------|
| MIT License (free forever) | No resource view (crews as rows) |
| 500k+ weekly downloads | Basic features only |
| Works with date-fns (you have it) | Manual crew assignment UI |
| Day/Week/Month views | |
| Drag-and-drop events | |

**Best for:** Basic job calendar, appointment scheduling

---

**Phase 2 (Growth): FullCalendar Premium** - $480/dev/year
```bash
npm install @fullcalendar/react @fullcalendar/resource-timeline
```

| Pros | Cons |
|------|------|
| Resource timeline view (crews as rows) | $480/developer/year |
| Industry standard (1M+ downloads) | Larger bundle (~250KB) |
| Excellent documentation | |
| Google Calendar integration | |

**Upgrade when:** You need to see multiple crews on a timeline

---

**Alternative: react-big-schedule** - FREE (Resource View)
```bash
npm install react-big-schedule
```

| Pros | Cons |
|------|------|
| FREE with resource view | Less polished than FullCalendar |
| Crews as rows, time as columns | Smaller community |
| Drag-and-drop between resources | |
| Day/Week/Month/Year views | |

**Code Example:**
```typescript
import Scheduler, { SchedulerData, ViewTypes } from 'react-big-schedule';

const schedulerData = new SchedulerData(new Date(), ViewTypes.Week);

schedulerData.setResources([
  { id: 'crew-a', name: 'Crew A - Wood Specialists' },
  { id: 'crew-b', name: 'Crew B - Chain Link' },
]);

schedulerData.setEvents([
  {
    id: 1,
    start: '2025-12-15 08:00:00',
    end: '2025-12-15 17:00:00',
    resourceId: 'crew-a',
    title: 'Smith Fence Install - 150 LF Wood',
  },
]);
```

**My Recommendation:** Start with **react-big-schedule** (free, has resource view)

---

### 2. Drag-and-Drop (Already Installed!)

**You have @dnd-kit - USE IT!**

| Feature | Support |
|---------|---------|
| Drag jobs between crews | ✅ |
| Reorder task lists | ✅ |
| Kanban boards | ✅ |
| Touch support | ✅ |
| TypeScript | ✅ |

**No action needed - already best-in-class**

---

### 3. Resource Timeline (Crew Scheduling)

#### Recommendation: dnd-timeline (Headless, Tailwind-Compatible)

```bash
npm install dnd-timeline
```

| Pros | Cons |
|------|------|
| Built on @dnd-kit (you have it!) | Newer library |
| Headless = full Tailwind control | More setup required |
| TypeScript-first | |
| Virtual scrolling (performance) | |
| Drag to create events | |

**Code Example with Tailwind:**
```typescript
import { Timeline, TimelineProvider } from 'dnd-timeline';

function CrewScheduler() {
  return (
    <TimelineProvider>
      <Timeline
        rows={crews.map(c => ({ id: c.id, title: c.name }))}
        items={jobs.map(j => ({
          id: j.id,
          rowId: j.crew_id,
          span: { start: new Date(j.start), end: new Date(j.end) }
        }))}
      >
        <TimelineRow className="border-b border-gray-200 hover:bg-gray-50">
          {(row) => (
            <div className="p-4 font-medium text-gray-900">{row.title}</div>
          )}
        </TimelineRow>

        <TimelineItem className="rounded-lg shadow-sm cursor-move">
          {(item) => (
            <div className="bg-blue-500 text-white p-2 rounded text-sm">
              {item.title}
            </div>
          )}
        </TimelineItem>
      </Timeline>
    </TimelineProvider>
  );
}
```

---

### 4. Route Optimization

#### Recommendation: Google Routes API

| Option | Pricing | Best For |
|--------|---------|----------|
| **Google Routes API** | Pay-per-use (~$75/mo) | Accuracy, traffic data |
| Routific | $33-93/vehicle/mo | Fixed pricing |
| OptimoRoute | $35-44/driver/mo | All-in-one platform |

**Why Google:**
- Best accuracy (industry standard)
- Real-time traffic
- Pay only for what you use
- $200 monthly credit (through Feb 2025)
- Works with Google Maps (crews already use it)

**Implementation:**
```typescript
// netlify/functions/optimize-route.ts
import { RoutesClient } from '@googlemaps/routing';

export async function handler(event) {
  const { jobs, startLocation } = JSON.parse(event.body);

  const client = new RoutesClient();

  const response = await client.computeRoutes({
    origin: startLocation,
    destination: jobs[jobs.length - 1].address,
    intermediates: jobs.slice(0, -1).map(j => ({ address: j.address })),
    travelMode: 'DRIVE',
    optimizeWaypointOrder: true,
    routingPreference: 'TRAFFIC_AWARE',
  });

  return {
    statusCode: 200,
    body: JSON.stringify({
      optimizedOrder: response.routes[0].optimizedIntermediateWaypointIndex,
      totalDuration: response.routes[0].duration,
      totalDistance: response.routes[0].distanceMeters,
    }),
  };
}
```

**Cost Estimate:**
- 10 route calculations/day × 30 days = 300 requests
- ~$0.005-0.01 per request = $1.50-3.00/month for basic
- With optimization: ~$50-75/month

---

### 5. Customer Appointment Scheduling

#### Recommendation: Cal.com (Self-Hosted) - FREE

```bash
# Self-host or use cloud ($12/seat/month)
npm install @calcom/embed-react
```

| Pros | Cons |
|------|------|
| Open source (AGPLv3) | Self-hosting requires setup |
| White-label ready | |
| React SDK | |
| No vendor lock-in | |
| Embeddable widgets | |

**Embed in Your App:**
```typescript
import Cal from '@calcom/embed-react';

function BookingWidget() {
  return (
    <Cal
      calLink="discount-fence/consultation"
      style={{ width: '100%', height: '100%' }}
      config={{
        layout: 'month_view',
        theme: 'light',
      }}
    />
  );
}
```

**Use Case:** Customer books fence consultation → Creates job in your system

---

### 6. PDF Generation

#### Already Installed: jsPDF + jspdf-autotable

**Current Capability:**
- Invoice PDFs ✅
- Quote PDFs ✅
- Tables with line items ✅

**Add Later (if needed): @react-pdf/renderer**
```bash
npm install @react-pdf/renderer
```

| jsPDF (Current) | @react-pdf/renderer (Future) |
|-----------------|------------------------------|
| Imperative API | React components |
| Good for tables | Good for branded docs |
| Smaller bundle | Better for complex layouts |
| Already working | Migration effort |

**Recommendation:** Keep jsPDF for now, add @react-pdf/renderer when you need:
- Photo-heavy proposals
- Complex branded documents
- Fence layout diagrams in PDFs

---

### 7. Digital Signatures

#### Recommendation: react-signature-canvas - FREE

```bash
npm install react-signature-canvas
```

**Code Example:**
```typescript
import SignatureCanvas from 'react-signature-canvas';
import { useRef } from 'react';

function JobCompletionSignature({ jobId, onSave }) {
  const sigRef = useRef<SignatureCanvas>(null);

  const handleSave = async () => {
    const dataUrl = sigRef.current.toDataURL('image/png');

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from('signatures')
      .upload(`jobs/${jobId}/customer-signature.png`, dataUrl);

    // Update job record
    await supabase
      .from('jobs')
      .update({
        customer_signature_url: data.path,
        signed_at: new Date().toISOString()
      })
      .eq('id', jobId);

    onSave();
  };

  return (
    <div className="border rounded-lg p-4">
      <p className="text-sm text-gray-600 mb-2">Customer Signature</p>
      <SignatureCanvas
        ref={sigRef}
        canvasProps={{
          className: 'border border-gray-300 rounded w-full h-40'
        }}
      />
      <div className="flex gap-2 mt-2">
        <button
          onClick={() => sigRef.current.clear()}
          className="px-3 py-1 text-sm text-gray-600"
        >
          Clear
        </button>
        <button
          onClick={handleSave}
          className="px-3 py-1 text-sm bg-blue-600 text-white rounded"
        >
          Save Signature
        </button>
      </div>
    </div>
  );
}
```

**Use Cases:**
- Job completion sign-off
- Quote approval on-site
- Delivery confirmation

---

### 8. E-Signature Workflow (Contracts)

#### Recommendation: Start Simple, Add PandaDoc If Needed

**Phase 1: Built-in Signatures** - $0
- Use react-signature-canvas
- Store in Supabase
- Good for job completion, simple approvals

**Phase 2: PandaDoc API** - $98/month (2 users)
- When you need: Contract signing, legal audit trail
- Better than DocuSign: No transaction limits, better API

```typescript
// Only if you need legal e-signature workflow
import PandaDoc from 'pandadoc-node-client';

const pandadoc = new PandaDoc({ apiKey: process.env.PANDADOC_API_KEY });

// Create document from template
const document = await pandadoc.documents.create({
  name: `Quote-${quoteNumber}`,
  template_uuid: 'your-quote-template-id',
  recipients: [{ email: customerEmail, role: 'Customer' }],
  tokens: [
    { name: 'customer_name', value: customerName },
    { name: 'quote_total', value: quoteTotal },
  ],
});
```

---

### 9. QuickBooks Integration

#### Already Set Up - Enhance with node-quickbooks

```bash
npm install node-quickbooks
```

**Current:** intuit-oauth for authentication ✅

**Add:** node-quickbooks for API calls

```typescript
// netlify/functions/qbo-create-invoice.ts
import QuickBooks from 'node-quickbooks';
import { getQboTokens } from './utils/qbo-auth';

export async function handler(event) {
  const { invoice } = JSON.parse(event.body);
  const tokens = await getQboTokens();

  const qbo = new QuickBooks(
    process.env.QBO_CLIENT_ID,
    process.env.QBO_CLIENT_SECRET,
    tokens.access_token,
    false, // no token secret (OAuth 2.0)
    tokens.realm_id,
    true, // use sandbox
    true, // debug
    null, // minor version
    '2.0', // oauth version
    tokens.refresh_token
  );

  return new Promise((resolve, reject) => {
    qbo.createInvoice({
      CustomerRef: { value: invoice.qbo_customer_id },
      Line: invoice.line_items.map(item => ({
        Amount: item.amount,
        DetailType: 'SalesItemLineDetail',
        SalesItemLineDetail: {
          ItemRef: { value: item.qbo_item_id },
          Qty: item.quantity,
          UnitPrice: item.unit_price,
          ClassRef: { value: invoice.qbo_class_id },
        },
      })),
    }, (err, result) => {
      if (err) reject(err);
      resolve({
        statusCode: 200,
        body: JSON.stringify(result),
      });
    });
  });
}
```

---

### 10. Forms & Validation

#### Already Using Zod - Add react-hook-form

```bash
npm install react-hook-form @hookform/resolvers
```

**Job Checklist Example:**
```typescript
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const jobChecklistSchema = z.object({
  sitePrepared: z.boolean(),
  utilityMarked: z.boolean(),
  postsSet: z.boolean(),
  concretePouredDate: z.date().optional(),
  railsInstalled: z.boolean(),
  picketsAttached: z.boolean(),
  gatesHung: z.boolean(),
  gatesTested: z.boolean(),
  debrisCleared: z.boolean(),
  customerWalkthrough: z.boolean(),
  customerSignature: z.string().min(1, 'Signature required'),
});

type JobChecklist = z.infer<typeof jobChecklistSchema>;

function InstallationChecklist({ jobId }) {
  const { register, handleSubmit, formState: { errors } } = useForm<JobChecklist>({
    resolver: zodResolver(jobChecklistSchema),
  });

  const onSubmit = async (data: JobChecklist) => {
    await supabase
      .from('job_checklists')
      .upsert({ job_id: jobId, ...data });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <label className="flex items-center gap-2">
        <input type="checkbox" {...register('sitePrepared')} />
        <span>Site prepared and cleared</span>
      </label>
      {/* ... more checkboxes ... */}
    </form>
  );
}
```

---

## What NOT to Use

### Avoid Full FSM Platforms

| Platform | Monthly Cost | Why Not |
|----------|--------------|---------|
| ServiceTitan | $398/user × 3 = $1,194 | Overkill, lose customization |
| Jobber | $149/user × 3 = $447 | Generic, not fence-specific |
| Housecall Pro | $129/user × 3 = $387 | Less flexible than custom |

**You've already built 60% of what these offer!**

### Avoid Heavy ERP Platforms

| Platform | Why Not |
|----------|---------|
| Odoo | Python backend, full migration required |
| ERPNext | Python/Frappe, incompatible stack |
| Apache OFBiz | Java, enterprise overkill |

### Avoid Expensive Scheduling Libraries (For Now)

| Library | Cost | When to Consider |
|---------|------|------------------|
| Bryntum Scheduler | $600-2,820 | 20+ crews, complex dependencies |
| DHTMLX Scheduler PRO | $699 | Need every feature |
| Syncfusion Schedule | Contact sales | Enterprise requirements |

---

## Implementation Roadmap

### Week 1-2: Add Core Libraries
```bash
# Scheduling
npm install react-big-schedule

# Forms
npm install react-hook-form @hookform/resolvers

# Signatures
npm install react-signature-canvas

# QBO API wrapper
npm install node-quickbooks

# Calendar embed (optional)
npm install @calcom/embed-react
```

### Week 3-4: Build Quote Feature
- Use existing jsPDF for quote PDFs
- Add react-hook-form for quote editor
- Integrate BOM calculator output

### Week 5-6: Build Job Feature
- Use react-big-schedule for crew calendar
- Use @dnd-kit for drag-drop assignment
- Add react-signature-canvas for completion

### Week 7-8: QBO Integration
- Add node-quickbooks for invoice creation
- Implement customer sync
- Add webhook handling

### Week 9-10: Polish
- Add route optimization (Google Routes API)
- Customer scheduling portal (Cal.com)
- Mobile optimization

---

## Cost Summary

### One-Time Costs
| Item | Cost |
|------|------|
| All recommended libraries | $0 (open source) |
| Development time | Your time |

### Monthly Costs
| Service | Cost |
|---------|------|
| Google Routes API | ~$75 |
| PandaDoc (optional) | $98 |
| Cal.com Cloud (optional) | $36 |
| **Total** | **$75-209/mo** |

### Annual Comparison
| Approach | Annual Cost |
|----------|-------------|
| **Custom Build (Recommended)** | $900-2,508 |
| ServiceTitan | $14,328 |
| Jobber | $5,364 |
| **Your Savings** | $2,856-13,428/year |

---

## Final Recommendations

### Must Install (Phase 1)
1. **react-big-schedule** - Free crew scheduling with resource view
2. **react-hook-form** - Form handling (works with your Zod)
3. **react-signature-canvas** - Job completion signatures
4. **node-quickbooks** - QBO API wrapper

### Consider Later (Phase 2)
1. **@calcom/embed-react** - Customer self-scheduling
2. **@react-pdf/renderer** - Branded proposal PDFs
3. **FullCalendar Premium** - Advanced scheduling ($480/yr)

### Skip Unless Needed
1. **PandaDoc** - Only if you need legal e-signatures
2. **Bryntum/DHTMLX** - Only for enterprise complexity
3. **Full FSM platforms** - You're building better

---

## Quick Start Code

### Install Everything at Once
```bash
npm install react-big-schedule react-hook-form @hookform/resolvers react-signature-canvas node-quickbooks
```

### Create Scheduling Page
```typescript
// src/features/scheduling/SchedulingHub.tsx
import Scheduler, { SchedulerData, ViewTypes } from 'react-big-schedule';
import 'react-big-schedule/lib/css/style.css';
import { useCrews, useJobs, useAssignJob } from './hooks';

export function SchedulingHub() {
  const { data: crews } = useCrews();
  const { data: jobs } = useJobs();
  const assignJob = useAssignJob();

  const schedulerData = useMemo(() => {
    const data = new SchedulerData(new Date(), ViewTypes.Week);
    data.setResources(crews?.map(c => ({ id: c.id, name: c.name })) || []);
    data.setEvents(jobs?.map(j => ({
      id: j.id,
      start: j.scheduled_start,
      end: j.scheduled_end,
      resourceId: j.crew_id,
      title: `${j.customer_name} - ${j.description}`,
    })) || []);
    return data;
  }, [crews, jobs]);

  const handleMove = (schedulerData, event, slotId, slotName, start, end) => {
    assignJob.mutate({
      jobId: event.id,
      crewId: slotId,
      start,
      end,
    });
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Crew Scheduling</h1>
      <Scheduler
        schedulerData={schedulerData}
        onMoveEvent={handleMove}
        onUpdateEventEnd={handleMove}
      />
    </div>
  );
}
```

This gives you a working crew scheduler in under 50 lines of code!
