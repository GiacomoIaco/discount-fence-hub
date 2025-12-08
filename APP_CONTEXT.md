# Discount Fence Hub - App Context

> This document provides context for AI analysis of roadmap ideas. Focus on UX, workflows, and business value rather than technical implementation details.

## Business Overview

**Discount Fence Enterprises USA** is a fence installation company based in South Florida. The Discount Fence Hub app is their internal operations platform that connects:
- Sales representatives in the field
- Yard workers who pick and stage materials
- Operations managers who oversee requests and scheduling
- Leadership who track KPIs and business performance

## User Personas

### Sales Rep (Mobile-First)
- Works primarily on phone/tablet in the field
- Needs quick access to: pricing calculator, photo gallery, AI sales coach, client presentations
- Submits pricing requests and material requests to operations
- Communicates with team via chat and announcements

### Yard Worker (Mobile-Only, "yard" role)
- Works exclusively on phone in the material yard
- Primary workflow: View pick lists → Pick materials → Mark items complete → Stage for loading
- Needs: Large touch targets, outdoor-readable UI, quick actions
- May use QR codes to claim and process pick lists

### Operations Manager
- Works on desktop, manages incoming requests
- Reviews pricing requests, assigns to team members, tracks status
- Monitors yard activity, pick list progress, delivery schedules
- Needs: Queue views, bulk actions, assignment rules, escalation alerts

### Admin
- Full access to all features
- Manages users, roles, menu visibility, system settings
- Accesses analytics, leadership dashboards, roadmap
- Can switch between role views to test/debug

### Leadership
- Focuses on KPIs, business intelligence, operating plans
- Uses Leadership Hub for annual targets, function workspaces
- Reviews analytics dashboards and reports

## Core Workflows

### Quote-to-Delivery Flow
1. **Sales creates quote** using BOM Calculator (fence type, dimensions, materials)
2. **Quote generates BOM** (Bill of Materials) with itemized costs
3. **Customer approves** → Project created
4. **Pick List generated** for yard team
5. **Yard picks materials** using mobile pick list interface
6. **Materials staged** in yard by delivery date
7. **Loaded onto truck** and delivered

### Request Flow
1. Sales rep submits request (pricing, support, material)
2. Request appears in Operations Queue
3. Ops manager reviews, assigns, processes
4. Status updates visible to submitter
5. Escalation engine auto-escalates stale requests

### Communication Flow
- **Announcements**: Company-wide broadcasts from leadership/admin
- **Team Chat**: Real-time messaging between team members
- **Direct Messages**: Private 1:1 conversations
- **Request Notes**: Thread-based discussion on specific requests

## Key Features by Hub

### Ops Hub (BOM Calculator)
- **BOM Calculator**: Build fence quotes with material/labor costs
- **Pick Lists**: Desktop view for operations to manage all projects
- **Yard Mobile**: Mobile-optimized pick list interface for yard workers
- **Analytics**: Yard performance metrics, worker productivity

### Requests Hub
- **Request Form**: Submit pricing/support/material requests
- **Request Queue**: Operations view with filtering, assignment
- **My Requests**: Personal view of submitted requests
- **Request Detail**: Full conversation thread, status history

### Communication
- **Team Announcements**: Broadcast messages with engagement tracking
- **Direct Messages**: Private conversations
- **Message Composer**: Rich text, mentions, attachments

### Sales Tools
- **AI Sales Coach**: Chat-based assistant for sales questions
- **Pre-Stain Calculator**: Calculate stain coverage needs
- **Client Presentation**: Customer-facing material showcase
- **Photo Gallery**: Browse fence style photos by category
- **Sales Resources**: Training materials, documents

### Analytics
- **Sales Analytics**: Revenue, quotes, conversion rates
- **Operations Analytics**: Request volume, response times
- **Yard Analytics**: Pick times, worker performance

### Leadership Hub
- **Operating Plan**: Annual targets by function
- **Function Workspaces**: Department-specific KPI tracking
- **Target Management**: Set and track quarterly goals

### Settings
- **User Management**: Create/edit users, assign roles
- **Menu Visibility**: Control which roles see which features
- **Assignment Rules**: Auto-routing rules for requests

## UX Patterns Used

### Navigation
- **Desktop**: Collapsible sidebar with sections, hub auto-collapses sidebar for max workspace
- **Mobile**: Bottom sheet navigation, swipe gestures, back button handling
- **Role-based visibility**: Menu items shown/hidden per role via database config

### Mobile Optimization
- Large touch targets (44px minimum)
- Sticky headers with collapse/expand for filters
- Card-based lists with swipe actions
- Pull-to-refresh patterns

### Data Display
- Status badges with consistent color coding
- Importance stars (1-5)
- Complexity indicators (XS, S, M, L, XL)
- Real-time updates via Supabase subscriptions

### Forms & Input
- Voice recording for idea capture
- Auto-save drafts (localStorage)
- Validation with inline errors
- Progressive disclosure (show more options as needed)

## Integration Points

### External Systems
- **ServiceTitan**: Field service management (planned export)
- **QuickBooks Online**: Accounting (planned sync)

### Internal Integrations
- BOM Calculator → Pick Lists → Yard Mobile (material flow)
- Requests → Assignments → Notifications (request flow)
- Announcements → Engagement Tracking → Analytics (communication flow)

## Design Principles

1. **Mobile-first for field workers**: Yard and sales features prioritize mobile UX
2. **Desktop-first for operations**: Queue management, analytics work best on larger screens
3. **Role-appropriate complexity**: Sales sees simple tools, admin sees configuration
4. **Real-time where it matters**: Pick lists, chat, notifications use live updates
5. **Offline consideration**: Critical mobile features should degrade gracefully

## When Analyzing Roadmap Ideas

Focus on:
- **User impact**: Which persona benefits? How does their workflow improve?
- **Integration**: How does this connect with existing features?
- **UX considerations**: Mobile vs desktop, touch targets, information density
- **Business value**: Does this reduce time, errors, or improve customer experience?
- **Workflow fit**: Where in the Quote-to-Delivery or Request flow does this belong?

Avoid:
- Detailed technical implementation steps (that's for Claude Code during development)
- Framework/library recommendations
- Testing strategies
- Code architecture decisions
