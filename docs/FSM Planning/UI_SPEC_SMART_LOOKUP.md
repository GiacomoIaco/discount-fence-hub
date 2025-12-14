# UI Specification: Smart Lookup
## Unified Client & Property Search Pattern

---

**Version:** 1.0  
**Created:** December 2024  
**Status:** Ready for Implementation  
**Component Location:** `src/components/common/SmartLookup/`

---

## Table of Contents

1. [Overview](#1-overview)
2. [Design Principles](#2-design-principles)
3. [Client Lookup](#3-client-lookup)
4. [Property Lookup](#4-property-lookup)
5. [Builder Cascade](#5-builder-cascade-community--lot)
6. [New Entity Slide-Out](#6-new-entity-slide-out)
7. [Component Architecture](#7-component-architecture)
8. [Search Algorithm](#8-search-algorithm)
9. [State Management](#9-state-management)
10. [Accessibility](#10-accessibility)
11. [Implementation Guide](#11-implementation-guide)

---

## 1. Overview

### The Problem with "New vs Existing"

Traditional FSM software forces users to make a choice BEFORE typing:

```
❌ BAD UX:
┌─────────────────────────────────────┐
│  Client: [○ Existing  ○ New]        │  ← User must decide first
│                                     │
│  [Search existing...]               │  ← Only after selecting "Existing"
│        - OR -                       │
│  [Create new client form...]        │  ← Only after selecting "New"
└─────────────────────────────────────┘

Problems:
1. User doesn't know if client exists yet
2. Duplicates created when "New" selected but client exists
3. Extra clicks and cognitive load
4. Frustrating for high-volume data entry
```

### The Smart Lookup Solution

```
✅ GOOD UX:
┌─────────────────────────────────────┐
│  Client: [Start typing...]          │  ← Just one input
│                                     │
│  System automatically:              │
│  • Searches as user types           │
│  • Shows matches (name/phone/email) │
│  • Offers "Create new" option       │
│  • Pre-fills new form with typed    │
└─────────────────────────────────────┘
```

### Where This Pattern Is Used

| Location | Lookup Type | Notes |
|----------|-------------|-------|
| New Request | Client + Property | Both lookups |
| New Quote | Client + Property | Often pre-filled from Request |
| Edit Quote | Client + Property | Editable on Quote, not after |
| Quick Create | Client | Simplified flow |
| Scheduling | Client lookup only | When booking from call |

---

## 2. Design Principles

### 2.1 Progressive Disclosure

1. **Start Simple**: Single input field
2. **Show Matches**: Dropdown appears only when typing
3. **Expand on Action**: Slide-out only when creating new

### 2.2 Search Everywhere

The same query searches multiple fields simultaneously:

| User Types | System Searches |
|------------|-----------------|
| "John" | name ILIKE '%john%' |
| "512-555" | phone LIKE '%512555%' (normalized) |
| "john@" | email ILIKE '%john@%' |
| "ABC Build" | company_name ILIKE '%abc build%' |

### 2.3 Prevent Duplicates

- Show potential matches prominently
- Warn if entered data matches existing
- Make selection easier than creation

### 2.4 Context Preservation

- User can see main form while creating new entity
- Pre-fill new entity form with typed data
- Auto-select after creation (no extra clicks)

---

## 3. Client Lookup

### 3.1 Visual States

**State 1: Empty/Initial**
```
┌─────────────────────────────────────────────────────────────┐
│  👤 Client                                                  │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ 🔍 Search by name, phone, or email...                 │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

**State 2: Typing (2+ characters)**
```
┌─────────────────────────────────────────────────────────────┐
│  👤 Client                                                  │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ John Sm                                           [×] │  │
│  └───────────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ 🔍 Searching...                                       │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

**State 3: Results Found**
```
┌─────────────────────────────────────────────────────────────┐
│  👤 Client                                                  │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ John Sm                                           [×] │  │
│  └───────────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────────┐  │
│  │                                                       │  │
│  │  📋 2 MATCHES FOUND                                   │  │
│  │  ─────────────────────────────────────────────────    │  │
│  │                                                       │  │
│  │  ┌─────────────────────────────────────────────────┐  │  │
│  │  │ 👤 John Smith                                   │  │  │
│  │  │    📞 (512) 555-1234  •  ✉️ john@email.com      │  │  │
│  │  │    🏢 ABC Builders                              │  │  │
│  │  │    📍 3 properties                              │  │  │
│  │  └─────────────────────────────────────────────────┘  │  │
│  │                                                       │  │
│  │  ┌─────────────────────────────────────────────────┐  │  │
│  │  │ 👤 Johnny Smithson                              │  │  │
│  │  │    📞 (512) 555-9999  •  ✉️ johnny@xyz.com      │  │  │
│  │  │    🏢 XYZ Corp                                  │  │  │
│  │  │    📍 1 property                                │  │  │
│  │  └─────────────────────────────────────────────────┘  │  │
│  │                                                       │  │
│  │  ─────────────────────────────────────────────────    │  │
│  │  ➕ Create new client "John Sm..."                    │  │
│  │                                                       │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

**State 4: No Results**
```
┌─────────────────────────────────────────────────────────────┐
│  👤 Client                                                  │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ Unique Name Here                                  [×] │  │
│  └───────────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────────┐  │
│  │                                                       │  │
│  │  No matching clients found                            │  │
│  │                                                       │  │
│  │  ─────────────────────────────────────────────────    │  │
│  │  ➕ Create new client "Unique Name Here"              │  │
│  │                                                       │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

**State 5: Client Selected**
```
┌─────────────────────────────────────────────────────────────┐
│  👤 Client                                                  │
│  ┌───────────────────────────────────────────────────────┐  │
│  │                                                       │  │
│  │  👤 John Smith                                   [×]  │  │
│  │     📞 (512) 555-1234  •  ✉️ john@email.com           │  │
│  │     🏢 ABC Builders                                   │  │
│  │                                                       │  │
│  │     [Edit Client]  [View History]                     │  │
│  │                                                       │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 Result Item Design

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  👤 John Smith                                 [Match: name]│ ← Match indicator
│     📞 (512) 555-1234  •  ✉️ john@email.com                 │ ← Contact info
│     🏢 ABC Builders                                         │ ← Company (if exists)
│     📍 3 properties                                         │ ← Property count
│                                                             │
│  ─────────────────────────────────────────────────────────  │ ← Separator (if has history)
│  📅 Last: Quote #42 on Nov 15, 2024                        │ ← Recent activity
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 3.3 Match Highlighting

When displaying results, highlight the matching portion:

```
Search: "john@"

Result:
  👤 John Smith
     📞 (512) 555-1234  •  ✉️ [john@]email.com   ← "john@" highlighted
```

Implementation:
```typescript
function highlightMatch(text: string, query: string): React.ReactNode {
  if (!query) return text;
  
  const index = text.toLowerCase().indexOf(query.toLowerCase());
  if (index === -1) return text;
  
  return (
    <>
      {text.slice(0, index)}
      <mark className="bg-yellow-200 rounded px-0.5">
        {text.slice(index, index + query.length)}
      </mark>
      {text.slice(index + query.length)}
    </>
  );
}
```

---

## 4. Property Lookup

### 4.1 Context: After Client Selection

Property lookup only appears AFTER a client is selected:

```
1. Client selected → Property lookup appears
2. Shows client's existing properties first
3. Allows search for new address
4. "Add new property" option
```

### 4.2 Visual States

**State 1: Client Selected, Property Not Selected**
```
┌─────────────────────────────────────────────────────────────┐
│  👤 Client: John Smith ✓                                    │
│                                                             │
│  📍 Property                                                │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ Select or add property...                         [▼] │  │
│  └───────────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────────┐  │
│  │                                                       │  │
│  │  📍 JOHN SMITH'S PROPERTIES (3)                       │  │
│  │  ─────────────────────────────────────────────────    │  │
│  │                                                       │  │
│  │  🏠 123 Oak Street                                    │  │
│  │     Austin, TX 78701                                  │  │
│  │     📅 Last: Quote sent Nov 15                        │  │
│  │                                                       │  │
│  │  🏠 456 Cedar Lane                                    │  │
│  │     Austin, TX 78702                                  │  │
│  │     📅 Last: Job completed Oct 3                      │  │
│  │                                                       │  │
│  │  🏠 789 Pine Ave                                      │  │
│  │     Round Rock, TX 78664                              │  │
│  │     (No history)                                      │  │
│  │                                                       │  │
│  │  ─────────────────────────────────────────────────    │  │
│  │  ➕ Add new property for John Smith                   │  │
│  │                                                       │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

**State 2: Typing Address (Search Mode)**
```
┌─────────────────────────────────────────────────────────────┐
│  📍 Property                                                │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ 999 New Street                                    [×] │  │
│  └───────────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────────┐  │
│  │                                                       │  │
│  │  No matching properties found for John Smith          │  │
│  │                                                       │  │
│  │  ─────────────────────────────────────────────────    │  │
│  │  ➕ Add "999 New Street" as new property              │  │
│  │                                                       │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

**State 3: Property Selected**
```
┌─────────────────────────────────────────────────────────────┐
│  📍 Property                                                │
│  ┌───────────────────────────────────────────────────────┐  │
│  │                                                       │  │
│  │  🏠 123 Oak Street                               [×]  │  │
│  │     Austin, TX 78701                                  │  │
│  │                                                       │  │
│  │     [🗺️ View Map]  [Edit Property]                    │  │
│  │                                                       │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
│  ⚠️ Similar request exists for this address (Dec 1)        │ ← Duplicate warning
│     [View Request]                                          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 4.3 Duplicate Detection

When a property is selected or address entered, check for existing entities:

```typescript
async function checkForDuplicates(propertyId: string, address: string) {
  // Check recent requests at this property
  const recentRequests = await supabase
    .from('service_requests')
    .select('id, request_number, status, created_at')
    .eq('property_id', propertyId)
    .gte('created_at', subDays(new Date(), 30))
    .not('status', 'in', ['archived', 'converted']);
  
  // Check active quotes
  const activeQuotes = await supabase
    .from('quotes')
    .select('id, quote_number, status, created_at')
    .eq('property_id', propertyId)
    .not('status', 'in', ['archived', 'converted', 'declined']);
  
  // Check active jobs
  const activeJobs = await supabase
    .from('jobs')
    .select('id, job_number, status, created_at')
    .eq('property_id', propertyId)
    .not('status', 'eq', 'completed');
  
  return {
    hasRecentRequest: recentRequests.data.length > 0,
    hasActiveQuote: activeQuotes.data.length > 0,
    hasActiveJob: activeJobs.data.length > 0,
    details: {
      requests: recentRequests.data,
      quotes: activeQuotes.data,
      jobs: activeJobs.data,
    }
  };
}
```

---

## 5. Builder Cascade (Community → Lot)

### 5.1 When to Use

When client `is_builder = true` OR `client_type = 'home_builder'`, add cascading dropdowns:

```
Client: ABC Builders (Home Builder) ✓
           ↓
Community: [Select community...]
           ↓ (after community selected)
Lot/Plot:  [Select or enter lot...]
```

### 5.2 Visual Design

```
┌─────────────────────────────────────────────────────────────┐
│  👤 Client: ABC Builders ✓                        [Builder] │ ← Badge indicating builder
│                                                             │
│  🏘️ Community                                               │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ Select community...                               [▼] │  │
│  └───────────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────────┐  │
│  │                                                       │  │
│  │  🏘️ ABC BUILDERS COMMUNITIES                          │  │
│  │  ─────────────────────────────────────────────────    │  │
│  │                                                       │  │
│  │  Cypress Creek                                        │  │
│  │     📍 Austin, TX  •  42 active lots                  │  │
│  │                                                       │  │
│  │  Willow Springs                                       │  │
│  │     📍 Round Rock, TX  •  28 active lots              │  │
│  │                                                       │  │
│  │  Oak Ridge Estates                                    │  │
│  │     📍 Cedar Park, TX  •  15 active lots              │  │
│  │                                                       │  │
│  │  ─────────────────────────────────────────────────    │  │
│  │  ➕ Add new community                                 │  │
│  │                                                       │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

**After Community Selected:**

```
┌─────────────────────────────────────────────────────────────┐
│  🏘️ Community: Cypress Creek ✓                              │
│                                                             │
│  🏠 Lot/Plot                                                │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ Search or enter lot number...                     [▼] │  │
│  └───────────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────────┐  │
│  │                                                       │  │
│  │  🏠 CYPRESS CREEK LOTS                                │  │
│  │  ─────────────────────────────────────────────────    │  │
│  │                                                       │  │
│  │  Lot 12 - 123 Oak St                                  │  │
│  │     ● Has active quote (QUO-2024-041)                 │  │
│  │                                                       │  │
│  │  Lot 18 - 456 Cedar Ln                                │  │
│  │     ● Job in progress (JOB-2024-038)                  │  │
│  │                                                       │  │
│  │  Lot 24 - 789 Pine Ave                                │  │
│  │     ○ No active work                                  │  │
│  │                                                       │  │
│  │  Lot 31 - (no address yet)                            │  │
│  │     ○ No active work                                  │  │
│  │                                                       │  │
│  │  ─────────────────────────────────────────────────    │  │
│  │  ➕ Add new lot to Cypress Creek                      │  │
│  │                                                       │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### 5.3 Data Structure for Builder Cascade

```typescript
// Community belongs to a Builder (Client)
interface Community {
  id: string;
  name: string;
  client_id: string;           // The builder
  city: string;
  state: string;
  active_lots_count: number;
  created_at: Date;
}

// Lot belongs to a Community
interface Lot {
  id: string;
  community_id: string;
  lot_number: string;          // "Lot 12", "42", etc.
  property_id?: string;        // Links to property (for address)
  status: 'available' | 'sold' | 'in_progress' | 'completed';
  
  // Denormalized for quick access
  address?: string;
  has_active_quote: boolean;
  has_active_job: boolean;
}

// When lot selected, auto-create/link property
async function selectLot(lot: Lot, community: Community) {
  let property: Property;
  
  if (lot.property_id) {
    // Lot already has property
    property = await getProperty(lot.property_id);
  } else if (lot.address) {
    // Lot has address but no property - create one
    property = await createProperty({
      client_id: community.client_id,
      address: lot.address,
      city: community.city,
      state: community.state,
    });
    
    // Link property to lot
    await updateLot(lot.id, { property_id: property.id });
  } else {
    // Lot has no address - prompt for address
    throw new Error('LOT_NEEDS_ADDRESS');
  }
  
  return property;
}
```

---

## 6. New Entity Slide-Out

### 6.1 Design: Right-Side Slide-Out Panel

When user clicks "Create new client/property", a slide-out panel appears from the right:

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│  NEW REQUEST                                                                    │
├─────────────────────────────────────────────────────────────┬───────────────────┤
│                                                             │                   │
│  👤 Client                                                  │ ➕ NEW CLIENT     │
│  ┌───────────────────────────────────────────────────────┐  │ ────────────────  │
│  │ John Sm...                                            │  │                   │
│  │ ➕ Create new client "John Sm..."  ← clicked          │  │ Name*            │
│  └───────────────────────────────────────────────────────┘  │ [John Sm       ] │ ← Pre-filled!
│                                                             │                   │
│  [Rest of form visible but dimmed ~50% opacity]             │ Company          │
│                                                             │ [              ] │
│  📍 Property                                                │                   │
│  [Select or add property...]                                │ Phone*           │
│                                                             │ [              ] │
│  🔧 Job Details                                             │                   │
│  [Job type...]                                              │ Email            │
│  [Job source...]                                            │ [              ] │
│  [Description...]                                           │                   │
│                                                             │ ─────────────────│
│                                                             │                   │
│                                                             │ 📍 FIRST PROPERTY│
│                                                             │   (Optional)     │
│                                                             │                   │
│                                                             │ Address          │
│                                                             │ [              ] │
│                                                             │                   │
│                                                             │ City     State   │
│                                                             │ [      ] [TX ▼] │
│                                                             │                   │
│                                                             │ Zip              │
│                                                             │ [      ]         │
│                                                             │                   │
│                                                             │ ─────────────────│
│                                                             │                   │
│                                                             │ [Cancel] [Create]│
│                                                             │                   │
└─────────────────────────────────────────────────────────────┴───────────────────┘
```

### 6.2 Slide-Out Specifications

```css
.slide-out-panel {
  /* Position */
  position: fixed;
  top: 64px;                    /* Below header */
  right: 0;
  bottom: 0;
  
  /* Dimensions */
  width: 400px;
  max-width: 90vw;
  
  /* Animation */
  transform: translateX(100%);
  transition: transform 300ms ease-in-out;
  
  /* When open */
  &.open {
    transform: translateX(0);
  }
  
  /* Styling */
  background: white;
  border-left: 1px solid #E5E7EB;
  box-shadow: -4px 0 15px rgba(0, 0, 0, 0.1);
  
  /* Content */
  overflow-y: auto;
  padding: 24px;
}

/* Backdrop */
.slide-out-backdrop {
  position: fixed;
  inset: 0;
  top: 64px;
  background: rgba(0, 0, 0, 0.3);
  opacity: 0;
  transition: opacity 300ms;
  
  &.open {
    opacity: 1;
  }
}
```

### 6.3 New Client Form Fields

```typescript
interface NewClientFormData {
  // Required
  name: string;
  phone: string;
  
  // Optional
  company_name?: string;
  email?: string;
  
  // Client Type
  client_type: 'residential' | 'commercial' | 'home_builder';
  is_builder: boolean;
  
  // First Property (optional)
  first_property?: {
    address: string;
    city: string;
    state: string;
    zip: string;
  };
}

// Validation
const clientSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  phone: z.string().regex(/^\d{10}$/, 'Enter a valid 10-digit phone number'),
  email: z.string().email().optional().or(z.literal('')),
  company_name: z.string().optional(),
  client_type: z.enum(['residential', 'commercial', 'home_builder']),
  first_property: z.object({
    address: z.string().min(5),
    city: z.string().min(2),
    state: z.string().length(2),
    zip: z.string().regex(/^\d{5}(-\d{4})?$/),
  }).optional(),
});
```

### 6.4 New Property Form Fields

```typescript
interface NewPropertyFormData {
  // Required
  address: string;
  city: string;
  state: string;
  zip: string;
  
  // Optional
  unit?: string;
  gate_code?: string;
  notes?: string;
  
  // For Builders
  community_id?: string;
  lot_number?: string;
}
```

### 6.5 Behavior After Creation

```typescript
async function handleCreateClient(data: NewClientFormData) {
  // 1. Create client
  const client = await createClient(data);
  
  // 2. Create property if provided
  let property: Property | null = null;
  if (data.first_property) {
    property = await createProperty({
      client_id: client.id,
      ...data.first_property,
    });
  }
  
  // 3. Close slide-out
  setSlideOutOpen(false);
  
  // 4. Auto-select newly created client
  setSelectedClient(client);
  
  // 5. Auto-select property if created
  if (property) {
    setSelectedProperty(property);
  }
  
  // 6. Focus next field (property if not created, or job type)
  if (!property) {
    propertyInputRef.current?.focus();
  } else {
    jobTypeInputRef.current?.focus();
  }
}
```

---

## 7. Component Architecture

### 7.1 File Structure

```
src/components/common/SmartLookup/
├── index.ts
├── ClientLookup.tsx              # Main client lookup component
├── PropertyLookup.tsx            # Property lookup (after client selected)
├── BuilderCascade.tsx            # Community → Lot cascade
├── components/
│   ├── LookupInput.tsx           # The search input field
│   ├── LookupDropdown.tsx        # Results dropdown container
│   ├── LookupResultItem.tsx      # Single result item
│   ├── CreateNewOption.tsx       # "Create new..." option
│   ├── SelectedDisplay.tsx       # Shows selected entity
│   ├── MatchHighlight.tsx        # Highlights matching text
│   └── DuplicateWarning.tsx      # Warning for potential duplicates
├── slideout/
│   ├── SlideOutPanel.tsx         # The slide-out container
│   ├── NewClientForm.tsx         # New client form
│   ├── NewPropertyForm.tsx       # New property form
│   └── NewCommunityForm.tsx      # New community form (builders)
├── hooks/
│   ├── useClientSearch.ts        # Client search logic
│   ├── usePropertySearch.ts      # Property search logic
│   ├── useDuplicateCheck.ts      # Duplicate detection
│   └── useSlideOut.ts            # Slide-out state management
└── types.ts
```

### 7.2 Main Component Interfaces

```typescript
// src/components/common/SmartLookup/types.ts

export interface ClientLookupProps {
  // Value
  value: Client | null;
  onChange: (client: Client | null) => void;
  
  // Optional filters
  businessUnitId?: string;
  clientType?: 'residential' | 'commercial' | 'home_builder' | 'all';
  
  // Callbacks
  onClientCreated?: (client: Client) => void;
  
  // Display
  placeholder?: string;
  disabled?: boolean;
  error?: string;
  
  // Refs for focus management
  nextFieldRef?: React.RefObject<HTMLElement>;
}

export interface PropertyLookupProps {
  // Required: client must be selected first
  clientId: string;
  client: Client;
  
  // Value
  value: Property | null;
  onChange: (property: Property | null) => void;
  
  // Callbacks
  onPropertyCreated?: (property: Property) => void;
  onDuplicateDetected?: (duplicates: DuplicateInfo) => void;
  
  // Display
  placeholder?: string;
  disabled?: boolean;
  error?: string;
}

export interface BuilderCascadeProps {
  // Required: builder client
  builderId: string;
  builder: Client;
  
  // Values
  selectedCommunity: Community | null;
  selectedLot: Lot | null;
  onCommunityChange: (community: Community | null) => void;
  onLotChange: (lot: Lot | null) => void;
  
  // Returns the final property
  onPropertyResolved: (property: Property) => void;
}

export interface SearchResult<T> {
  items: T[];
  query: string;
  matchField: string;
  isLoading: boolean;
  isEmpty: boolean;
}
```

### 7.3 ClientLookup Implementation

```typescript
// src/components/common/SmartLookup/ClientLookup.tsx

import React, { useState, useRef, useCallback } from 'react';
import { useClientSearch } from './hooks/useClientSearch';
import { useSlideOut } from './hooks/useSlideOut';
import { LookupInput } from './components/LookupInput';
import { LookupDropdown } from './components/LookupDropdown';
import { LookupResultItem } from './components/LookupResultItem';
import { CreateNewOption } from './components/CreateNewOption';
import { SelectedDisplay } from './components/SelectedDisplay';
import { SlideOutPanel } from './slideout/SlideOutPanel';
import { NewClientForm } from './slideout/NewClientForm';
import { ClientLookupProps, Client } from './types';

export function ClientLookup({
  value,
  onChange,
  businessUnitId,
  clientType = 'all',
  onClientCreated,
  placeholder = 'Search by name, phone, or email...',
  disabled = false,
  error,
  nextFieldRef,
}: ClientLookupProps) {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  
  const { results, isLoading } = useClientSearch(query, {
    businessUnitId,
    clientType,
  });
  
  const { isSlideOutOpen, openSlideOut, closeSlideOut } = useSlideOut();

  // Handle client selection
  const handleSelect = useCallback((client: Client) => {
    onChange(client);
    setQuery('');
    setIsOpen(false);
    
    // Focus next field
    nextFieldRef?.current?.focus();
  }, [onChange, nextFieldRef]);

  // Handle create new click
  const handleCreateNew = useCallback(() => {
    openSlideOut();
    setIsOpen(false);
  }, [openSlideOut]);

  // Handle new client created
  const handleClientCreated = useCallback((newClient: Client) => {
    closeSlideOut();
    onChange(newClient);
    onClientCreated?.(newClient);
    nextFieldRef?.current?.focus();
  }, [closeSlideOut, onChange, onClientCreated, nextFieldRef]);

  // Handle clear selection
  const handleClear = useCallback(() => {
    onChange(null);
    inputRef.current?.focus();
  }, [onChange]);

  // If client is selected, show selected display
  if (value) {
    return (
      <SelectedDisplay
        type="client"
        data={value}
        onClear={handleClear}
        onEdit={() => {/* Open edit modal */}}
        disabled={disabled}
      />
    );
  }

  return (
    <>
      <div className="relative">
        <LookupInput
          ref={inputRef}
          value={query}
          onChange={setQuery}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder}
          disabled={disabled}
          error={error}
          icon={<User className="w-4 h-4" />}
        />

        {isOpen && query.length >= 2 && (
          <LookupDropdown
            onClose={() => setIsOpen(false)}
          >
            {isLoading ? (
              <div className="p-4 text-center text-gray-500">
                Searching...
              </div>
            ) : results.length > 0 ? (
              <>
                <div className="px-3 py-2 text-xs font-medium text-gray-500 uppercase">
                  {results.length} match{results.length !== 1 ? 'es' : ''} found
                </div>
                {results.map((client) => (
                  <LookupResultItem
                    key={client.id}
                    type="client"
                    data={client}
                    query={query}
                    onClick={() => handleSelect(client)}
                  />
                ))}
              </>
            ) : (
              <div className="px-3 py-2 text-sm text-gray-500">
                No matching clients found
              </div>
            )}
            
            <CreateNewOption
              type="client"
              query={query}
              onClick={handleCreateNew}
            />
          </LookupDropdown>
        )}
      </div>

      {/* New Client Slide-Out */}
      <SlideOutPanel
        isOpen={isSlideOutOpen}
        onClose={closeSlideOut}
        title="New Client"
      >
        <NewClientForm
          initialName={query}
          onSubmit={handleClientCreated}
          onCancel={closeSlideOut}
        />
      </SlideOutPanel>
    </>
  );
}
```

---

## 8. Search Algorithm

### 8.1 Client Search Query

```typescript
// src/components/common/SmartLookup/hooks/useClientSearch.ts

import { useState, useEffect, useMemo } from 'react';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { supabase } from '@/lib/supabase';

interface UseClientSearchOptions {
  businessUnitId?: string;
  clientType?: string;
  limit?: number;
}

export function useClientSearch(
  query: string,
  options: UseClientSearchOptions = {}
) {
  const { businessUnitId, clientType = 'all', limit = 10 } = options;
  
  const [results, setResults] = useState<ClientSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  
  // Debounce the query to avoid too many requests
  const debouncedQuery = useDebouncedValue(query, 300);
  
  // Normalize phone for search
  const normalizedPhone = useMemo(() => {
    return query.replace(/\D/g, '');
  }, [query]);

  useEffect(() => {
    if (debouncedQuery.length < 2) {
      setResults([]);
      return;
    }
    
    const searchClients = async () => {
      setIsLoading(true);
      
      try {
        let queryBuilder = supabase
          .from('clients')
          .select(`
            id,
            name,
            company_name,
            phone,
            email,
            client_type,
            is_builder,
            properties:properties(count),
            recent_activity:service_requests(
              id,
              request_number,
              created_at
            )
          `)
          .or(`
            name.ilike.%${debouncedQuery}%,
            company_name.ilike.%${debouncedQuery}%,
            email.ilike.%${debouncedQuery}%,
            phone.like.%${normalizedPhone}%
          `)
          .limit(limit);
        
        // Apply business unit filter if specified
        if (businessUnitId) {
          queryBuilder = queryBuilder.eq('business_unit_id', businessUnitId);
        }
        
        // Apply client type filter if specified
        if (clientType !== 'all') {
          queryBuilder = queryBuilder.eq('client_type', clientType);
        }
        
        const { data, error } = await queryBuilder;
        
        if (error) throw error;
        
        // Transform results with match info
        const transformedResults = data.map(client => ({
          ...client,
          matchField: determineMatchField(client, debouncedQuery, normalizedPhone),
          propertyCount: client.properties?.[0]?.count ?? 0,
          lastActivity: client.recent_activity?.[0] ?? null,
        }));
        
        // Sort by relevance (exact matches first, then partial)
        transformedResults.sort((a, b) => {
          const aExact = isExactMatch(a, debouncedQuery, normalizedPhone);
          const bExact = isExactMatch(b, debouncedQuery, normalizedPhone);
          if (aExact && !bExact) return -1;
          if (!aExact && bExact) return 1;
          return 0;
        });
        
        setResults(transformedResults);
      } catch (error) {
        console.error('Client search error:', error);
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    };
    
    searchClients();
  }, [debouncedQuery, normalizedPhone, businessUnitId, clientType, limit]);

  return { results, isLoading };
}

function determineMatchField(
  client: any,
  query: string,
  phone: string
): 'name' | 'company' | 'phone' | 'email' {
  const q = query.toLowerCase();
  
  if (phone.length >= 3 && client.phone?.includes(phone)) {
    return 'phone';
  }
  if (client.email?.toLowerCase().includes(q)) {
    return 'email';
  }
  if (client.company_name?.toLowerCase().includes(q)) {
    return 'company';
  }
  return 'name';
}

function isExactMatch(
  client: any,
  query: string,
  phone: string
): boolean {
  const q = query.toLowerCase();
  return (
    client.name?.toLowerCase() === q ||
    client.phone === phone ||
    client.email?.toLowerCase() === q
  );
}
```

### 8.2 Property Search Query

```typescript
// src/components/common/SmartLookup/hooks/usePropertySearch.ts

export function usePropertySearch(
  clientId: string,
  query: string
) {
  const [results, setResults] = useState<PropertySearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  
  const debouncedQuery = useDebouncedValue(query, 300);

  useEffect(() => {
    const searchProperties = async () => {
      setIsLoading(true);
      
      try {
        let queryBuilder = supabase
          .from('properties')
          .select(`
            id,
            address,
            city,
            state,
            zip,
            unit,
            latest_request:service_requests(
              id,
              request_number,
              status,
              created_at
            ),
            latest_quote:quotes(
              id,
              quote_number,
              status,
              created_at
            ),
            latest_job:jobs(
              id,
              job_number,
              status,
              created_at
            )
          `)
          .eq('client_id', clientId)
          .order('created_at', { ascending: false });
        
        // If query provided, filter by address
        if (debouncedQuery.length >= 2) {
          queryBuilder = queryBuilder.ilike('address', `%${debouncedQuery}%`);
        }
        
        const { data, error } = await queryBuilder.limit(10);
        
        if (error) throw error;
        
        // Transform with activity info
        const transformedResults = data.map(property => ({
          ...property,
          hasActiveRequest: property.latest_request?.some(
            r => !['archived', 'converted'].includes(r.status)
          ),
          hasActiveQuote: property.latest_quote?.some(
            q => !['archived', 'converted', 'declined'].includes(q.status)
          ),
          hasActiveJob: property.latest_job?.some(
            j => j.status !== 'completed'
          ),
          lastActivity: getLastActivity(property),
        }));
        
        setResults(transformedResults);
      } catch (error) {
        console.error('Property search error:', error);
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    };
    
    searchProperties();
  }, [clientId, debouncedQuery]);

  return { results, isLoading };
}
```

---

## 9. State Management

### 9.1 Form Integration with React Hook Form

```typescript
// Example: Using SmartLookup with React Hook Form

import { useForm, Controller } from 'react-hook-form';
import { ClientLookup } from '@/components/common/SmartLookup';

function NewRequestForm() {
  const form = useForm<RequestFormData>({
    defaultValues: {
      client: null,
      property: null,
      // ...
    }
  });

  return (
    <form onSubmit={form.handleSubmit(onSubmit)}>
      <Controller
        name="client"
        control={form.control}
        rules={{ required: 'Client is required' }}
        render={({ field, fieldState }) => (
          <ClientLookup
            value={field.value}
            onChange={field.onChange}
            error={fieldState.error?.message}
            nextFieldRef={propertyInputRef}
          />
        )}
      />
      
      {form.watch('client') && (
        <Controller
          name="property"
          control={form.control}
          rules={{ required: 'Property is required' }}
          render={({ field, fieldState }) => (
            <PropertyLookup
              clientId={form.watch('client').id}
              client={form.watch('client')}
              value={field.value}
              onChange={field.onChange}
              error={fieldState.error?.message}
            />
          )}
        />
      )}
      
      {/* Rest of form */}
    </form>
  );
}
```

### 9.2 Slide-Out State Hook

```typescript
// src/components/common/SmartLookup/hooks/useSlideOut.ts

import { useState, useCallback } from 'react';

export function useSlideOut() {
  const [isSlideOutOpen, setIsSlideOutOpen] = useState(false);
  const [slideOutType, setSlideOutType] = useState<'client' | 'property' | 'community' | null>(null);
  const [slideOutData, setSlideOutData] = useState<any>(null);

  const openSlideOut = useCallback((type: 'client' | 'property' | 'community', data?: any) => {
    setSlideOutType(type);
    setSlideOutData(data);
    setIsSlideOutOpen(true);
  }, []);

  const closeSlideOut = useCallback(() => {
    setIsSlideOutOpen(false);
    // Delay clearing type/data for animation
    setTimeout(() => {
      setSlideOutType(null);
      setSlideOutData(null);
    }, 300);
  }, []);

  return {
    isSlideOutOpen,
    slideOutType,
    slideOutData,
    openSlideOut,
    closeSlideOut,
  };
}
```

---

## 10. Accessibility

### 10.1 ARIA Attributes

```tsx
<div
  role="combobox"
  aria-expanded={isOpen}
  aria-haspopup="listbox"
  aria-owns="client-lookup-listbox"
>
  <input
    type="text"
    role="searchbox"
    aria-autocomplete="list"
    aria-controls="client-lookup-listbox"
    aria-activedescendant={activeItemId}
    placeholder={placeholder}
  />
  
  <ul
    id="client-lookup-listbox"
    role="listbox"
    aria-label="Search results"
  >
    {results.map((result, index) => (
      <li
        key={result.id}
        id={`client-result-${result.id}`}
        role="option"
        aria-selected={index === activeIndex}
      >
        {/* Result content */}
      </li>
    ))}
  </ul>
</div>
```

### 10.2 Keyboard Navigation

| Key | Action |
|-----|--------|
| ↓ / ↑ | Navigate results |
| Enter | Select highlighted result |
| Escape | Close dropdown |
| Tab | Move to next field (selects if only one result) |

```typescript
function handleKeyDown(e: React.KeyboardEvent) {
  switch (e.key) {
    case 'ArrowDown':
      e.preventDefault();
      setActiveIndex((prev) => 
        prev < results.length ? prev + 1 : prev
      );
      break;
    case 'ArrowUp':
      e.preventDefault();
      setActiveIndex((prev) => 
        prev > 0 ? prev - 1 : 0
      );
      break;
    case 'Enter':
      e.preventDefault();
      if (activeIndex >= 0 && results[activeIndex]) {
        handleSelect(results[activeIndex]);
      } else if (activeIndex === results.length) {
        // "Create new" option selected
        handleCreateNew();
      }
      break;
    case 'Escape':
      setIsOpen(false);
      break;
    case 'Tab':
      if (results.length === 1) {
        // Auto-select single result
        handleSelect(results[0]);
      }
      break;
  }
}
```

---

## 11. Implementation Guide

### 11.1 Implementation Checklist

**Phase 1: Core Components**
- [ ] Create folder structure
- [ ] Implement `LookupInput` component
- [ ] Implement `LookupDropdown` component
- [ ] Implement `LookupResultItem` component
- [ ] Implement `SelectedDisplay` component
- [ ] Implement `CreateNewOption` component

**Phase 2: Client Lookup**
- [ ] Implement `useClientSearch` hook
- [ ] Implement `ClientLookup` component
- [ ] Add phone normalization
- [ ] Add match highlighting
- [ ] Add keyboard navigation

**Phase 3: Property Lookup**
- [ ] Implement `usePropertySearch` hook
- [ ] Implement `PropertyLookup` component
- [ ] Add duplicate detection
- [ ] Add activity indicators

**Phase 4: Slide-Out Forms**
- [ ] Implement `SlideOutPanel` component
- [ ] Implement `NewClientForm`
- [ ] Implement `NewPropertyForm`
- [ ] Add form validation
- [ ] Add auto-select after creation

**Phase 5: Builder Cascade**
- [ ] Implement `BuilderCascade` component
- [ ] Implement community lookup
- [ ] Implement lot lookup
- [ ] Implement `NewCommunityForm`
- [ ] Handle lot → property resolution

**Phase 6: Polish**
- [ ] Add loading states
- [ ] Add error handling
- [ ] Add accessibility attributes
- [ ] Add animations
- [ ] Add mobile responsiveness

### 11.2 Usage Examples

```typescript
// Basic usage in Request form
<ClientLookup
  value={selectedClient}
  onChange={setSelectedClient}
  placeholder="Search by name, phone, or email..."
/>

// With business unit filter
<ClientLookup
  value={selectedClient}
  onChange={setSelectedClient}
  businessUnitId={currentBusinessUnit}
/>

// Builders only
<ClientLookup
  value={selectedClient}
  onChange={setSelectedClient}
  clientType="home_builder"
/>

// Property lookup (appears after client selected)
{selectedClient && (
  <PropertyLookup
    clientId={selectedClient.id}
    client={selectedClient}
    value={selectedProperty}
    onChange={setSelectedProperty}
    onDuplicateDetected={handleDuplicateWarning}
  />
)}

// Builder cascade (for home builder clients)
{selectedClient?.is_builder && (
  <BuilderCascade
    builderId={selectedClient.id}
    builder={selectedClient}
    selectedCommunity={community}
    selectedLot={lot}
    onCommunityChange={setCommunity}
    onLotChange={setLot}
    onPropertyResolved={setSelectedProperty}
  />
)}
```

---

*Document Version: 1.0*  
*Ready for Claude Code Implementation*
