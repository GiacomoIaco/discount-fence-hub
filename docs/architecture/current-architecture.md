# Discount Fence USA Operations Hub - Project Summary

## 🎉 Project Status: ✅ PRODUCTION DEPLOYED

A **comprehensive enterprise web application** for sales, operations, and management teams at Discount Fence USA, featuring request management system, AI-powered sales coaching, intelligent photo gallery, team collaboration, and analytics dashboard.

**🌐 Live on Netlify** | **📊 Supabase Connected** | **🤖 All AI Integrations Active** | **🔐 Role-Based Access Control** | **📱 Progressive Web App**

---

## 📦 Latest Updates (October 2025)

## 🏗️ Current Architecture (October 27, 2025)

### Feature-Based Structure - ✅ COMPLETED

The app has been fully restructured from monolithic components/ to a feature-based architecture with 11 self-contained features:

| # | Feature | Description | Lines of Code | Key Components |
|---|---------|-------------|---------------|----------------|
| 1 | **photos** | Photo gallery, bulk upload, AI auto-tagging, review queue | ~2,500 | PhotoGalleryRefactored, BulkPhotoUpload, PhotoReviewQueue, PhotoAnalytics |
| 2 | **surveys** | Survey builder, renderer, responses, results | ~800 | SimpleSurveyBuilder, SurveyRenderer, SurveyResponse, SurveyResults |
| 3 | **communication** | Direct messages, announcements, team chat | ~1,400 | DirectMessages, MessageComposer, AnnouncementsView |
| 4 | **settings** | Team management, assignment rules, menu visibility | ~900 | Settings, TeamManagement, AssignmentRules, MenuVisibilitySettings |
| 5 | **requests** | Request workflow & management system | ~1,800 | RequestHub, MyRequestsView, RequestQueue, RequestDetail, RequestForm |
| 6 | **analytics** | Performance analytics & reporting dashboard | ~600 | Analytics, AnalyticsTabs, OverviewTab, RequestsTab |
| 7 | **user-profile** | User profiles, avatars, voice samples | ~800 | UserProfileView, UserProfileEditor, VoiceSampleRecorder |
| 8 | **sales-resources** | Document management library | 1,032 | SalesResources (complete document management system) |
| 9 | **ai-coach** | AI-powered sales call coaching | 1,807 | SalesCoach, SalesCoachAdmin |
| 10 | **sales-tools** | Client presentations & calculators | 1,226 | ClientPresentation, PresentationUpload, PresentationViewer, StainCalculator |
| 11 | **bom_calculator** | Bill of Materials calculator | 3,026 | BOMCalculator (full estimation system) |

**Total:** ~14,691 lines of feature code

### Feature Structure

Each feature follows a consistent structure:
```
features/[feature-name]/
├── index.ts              # Public API - exports only what should be accessible
├── [MainComponent].tsx   # Primary feature component
├── components/           # Internal components (not exported)
├── hooks/                # Feature-specific hooks
├── types/                # TypeScript type definitions
├── lib/                  # Feature-specific utilities
└── docs/                 # Feature documentation
```

### Shared Infrastructure

**Global Components** (`src/components/`):
- `auth/` - Login, Signup (global authentication)
- `shared/` - Shared utility components
- `skeletons/` - Loading state components
- Root-level: CustomToast, ErrorBoundary, PWAUpdatePrompt, InstallAppBanner

**Global Services** (`src/lib/`):
- `supabase.ts` - Database client
- `toast.ts` - Notification system
- `queryClient.ts` - React Query configuration
- `claude.ts`, `openai.ts` - AI service integrations
- `storage.ts` - Storage utilities
- `validation.ts` - Shared validation logic
- `offlineQueue.ts` - Offline support

**Global Hooks** (`src/hooks/`):
- `useEscalationEngine.ts` - Cross-feature escalation logic
- `useMenuVisibility.ts` - Global menu configuration
- `useRequestNotifications.ts` - Global notification system

**Type Definitions** (`src/types/`):
- `chat.ts` - Chat and messaging types
- `index.ts` - Shared type exports

### Architecture Benefits Achieved

✅ **Code Organization:**
- Clear feature boundaries
- Easy to find related code
- Co-located documentation

✅ **Maintainability:**
- No circular dependencies
- Controlled public APIs via index.ts
- Feature isolation

✅ **Scalability:**
- Easy to add new features
- Team can work on features independently
- Clear ownership boundaries

✅ **Performance:**
- Lazy loading via React.lazy()
- Code splitting per feature
- Reduced initial bundle size

---


### Phase 4: Notification & Menu Control Systems - COMPLETE ✅ (October 10, 2025)

#### 1. **Request Notification System** ✅ TESTED & WORKING
- **Real-time Badge Counts**: Shows unread request count on "My Requests" menu item
- **PWA Badge API**: Home screen app icon displays notification count
- **View Tracking**: `request_views` table tracks when users last viewed each request
- **Auto Mark-as-Read**: Requests marked as read when opened
- **Smart Algorithm**: Compares `request.updated_at` with `request_views.last_viewed_at`
  - Never viewed = Unread
  - Updated since last view = Unread
- **Live Updates**: Real-time subscriptions to requests and request_views tables
- **Database Migration**: `010_request_notifications.sql`
- **React Hook**: `useRequestNotifications.ts` - Provides unreadCount and markRequestAsRead
- **Integrated**: MyRequestsView passes onMarkAsRead callback

**Impact:**
- ✅ Sales reps see badge count of requests needing attention
- ✅ PWA users see count on home screen icon (Chrome/Edge)
- ✅ Real-time updates as requests are created/updated
- ✅ No polling required - Supabase subscriptions handle updates

#### 2. **Menu Visibility Control System** ✅ PRODUCTION
- **Admin Control Panel**: Manage which menu items are visible to which roles
- **Role-Based Visibility**: Checkbox grid (11 menu items × 4 roles)
- **User-Level Overrides**: Enable/disable menu items for specific users
- **Override Management Modal**: Search users, set individual permissions
- **Real-time Updates**: Changes reflect immediately across all sessions
- **Database Migration**: `009_menu_visibility_control.sql`
- **React Hook**: `useMenuVisibility.ts` - Provides canSeeMenuItem function
- **Admin UI**: `MenuVisibilitySettings.tsx` - Full management interface
- **Settings Integration**: New "Menu Visibility" tab in Settings page

**Controlled Menu Items:**
1. Dashboard
2. Announcements (Team Communication)
3. Chat (Direct Messages)
4. Client Presentation
5. AI Sales Coach
6. Photo Gallery
7. Pre-Stain Calculator
8. My Requests
9. Analytics
10. Sales Resources
11. Settings

**Impact:**
- ✅ Hide beta features from production users
- ✅ Customize experience per role
- ✅ Enable selective rollouts to specific users
- ✅ Override count badges show active user exceptions

#### 3. **Mobile Photo Viewer Improvements** ✅ PRODUCTION
- **Removed Arrow Navigation**: Mobile uses swipe gestures only (cleaner UI)
- **Screen Orientation Unlock**: Photos can be viewed in landscape/portrait
- **Auto-Lock to Portrait**: Returns to portrait when closing photo viewer
- **Version Code Display**: Replaced mobile greeting with build version
- **Consistent Branding**: Same version display as desktop

**Impact:**
- ✅ Cleaner mobile photo viewing experience
- ✅ Natural phone rotation like native photo apps
- ✅ Users can verify they're on latest version

---

### Phase 1: Production Polish - COMPLETE ✅ (January 2025)

**Quick Wins Transformation:**

#### 1. **Error Boundaries** ✅
- **Professional Error UI**: No more blank white screens on errors
- **ErrorBoundary Component**: Catches React errors gracefully
- **Try Again & Go Home**: User-friendly recovery options
- **Error Details**: Collapsible section for debugging
- **Wrapped All Sections**: Protects every major app area

#### 2. **Toast Notifications** ✅
- **88 Alerts Replaced**: Zero blocking browser alerts remaining
- **4 Toast Types**: Success (green), Error (red), Warning (orange), Info (blue)
- **Non-Blocking**: Toasts auto-dismiss, don't interrupt workflow
- **15 Components Updated**: PhotoGallery, SalesResources, RequestForm, StainCalculator, MessageComposer, TeamManagement, AssignmentRules, RequestQueue, PresentationUpload, PhotoReviewQueue, SalesCoach, ClientPresentation, PresentationViewer, SalesCoachAdmin, PhotoAnalytics
- **Toast Utility Library**: Consistent styling across all notifications

#### 3. **Loading Skeletons** ✅
- **5 Skeleton Components**: Smooth loading animations
  - `Skeleton` - Base component (text, circular, rectangular variants)
  - `RequestListSkeleton` - For request loading states
  - `PhotoGallerySkeleton` - For photo grid loading
  - `UserProfileSkeleton` - For profile loading
  - `AnalyticsChartSkeleton` - For chart loading
- **Integrated**: MyRequestsView shows skeletons during data fetch
- **Animate-Pulse**: CSS animation for professional effect

#### 4. **PWA Icons** ✅
- **Full Icon Set**: All platforms covered
  - `favicon.ico` - Browser tabs
  - `favicon-96x96.png` - Modern browsers
  - `favicon.svg` - Vector fallback
  - `apple-touch-icon.png` - iOS home screen (180x180)
  - `web-app-manifest` icons (192x192, 512x512)
- **Updated HTML**: Proper icon references with comments
- **Professional Branding**: Consistent fence icon everywhere

**Impact:**
- ✅ Zero browser alerts (88 replaced with toasts)
- ✅ Zero app crashes (error boundaries everywhere)
- ✅ Professional loading states (skeletons replace spinners)
- ✅ Proper branding (icons on all platforms)

---

### Phase 3B: Advanced Request Management Features ✅ PRODUCTION (January 2025)

**6 Major Features Added:**

#### 1. **Stage Management Controls** ✅
- **Workflow Buttons**: Change stages directly from request detail
- **4 Stage Options**: New → Pending → Completed → Archived
- **Visual Design**: Color-coded buttons with icons (PlayCircle, Clock, CheckCircle, Archive)
- **Smart Display**: Current stage button is hidden
- **Direct Updates**: Changes reflected immediately with refresh callback

#### 2. **Request Editing** ✅
- **Edit Button**: Header button to enter edit mode
- **Save/Cancel Actions**: Clear controls during editing
- **Editable Fields**:
  - Customer information (name, address, phone, email)
  - Description (textarea with placeholder)
  - Special requirements (textarea with placeholder)
- **Inline Updates**: Changes save without page reload

#### 3. **Activity Timeline** ✅
- **Visual Timeline**: Vertical timeline with connecting line
- **Timeline Dots**: Current activity highlighted, past activities dimmed
- **Activity Cards**: Blue-themed cards with action, details, and timestamp
- **Formatted Display**: Date and time shown in readable format
- **Auto-scroll**: Most recent activities at top

#### 4. **Advanced Filtering** ✅
- **Assignee Filter**: Filter by team member or unassigned
- **Submitter Filter**: Filter by who created the request
- **SLA Status Filter**: On Track, At Risk, or Breached
- **Combined Filters**: Works with existing type, stage, and search filters
- **User Dropdown**: Populated from team members

#### 5. **Quote Status Management** ✅
- **Status Dropdown**: Won, Lost, Awaiting, Not Set
- **Pricing Requests Only**: Button appears only for pricing type
- **Color-Coded Display**: Green (won), Red (lost), Blue (awaiting), Gray (not set)
- **Change Button**: Quick access to update status
- **Activity Logging**: Status changes tracked in timeline

#### 6. **Desktop Right Sidebar** ✅
- **Photo Gallery Preview**: 2-column grid of attached photos
- **Click to View**: Photos open in new tab at full size
- **Quick Actions Card**:
  - Print Request button
  - Email Customer (if email available)
  - Call Customer (if phone available)
- **Request Metadata**:
  - Created date
  - Project number
  - Request type
  - Urgency level (color-coded)
- **Responsive Design**: Hidden on mobile, 384px width on desktop

#### 7. **Statistics Dashboard** ✅
- **My Requests View**: 4-card statistics bar
- **Real-time Counts**:
  - Total requests
  - New requests (green)
  - In Progress/Pending (yellow)
  - Completed requests (purple)
- **Gradient Design**: Color-coded backgrounds matching stages
- **Live Updates**: Refreshes with request data

#### 8. **Audio Playback** ✅
- **HTML5 Player**: Native audio controls for voice recordings
- **Duration Display**: Shows recording length in MM:SS format
- **Combined View**: Audio player + transcript in same purple card
- **Metadata**: Preload set for faster loading

#### 9. **Refresh Without Reload** ✅
- **Smart Updates**: Uses refresh callback instead of page reload
- **No Navigation Loss**: Stays on current request detail view
- **All Actions**: Assignee change, stage change, quote status, editing
- **Fallback**: Still reloads if callback not available

### Phase 3A: Complete Request Management System ✅ PRODUCTION

#### 1. **Unified Request System with Desktop/Mobile Views** ✅
- **Universal Navigation**: All roles see same menu, permissions enforced in components
- **Desktop View**: Full-featured interface with sidebar navigation
- **Mobile View**: Streamlined field-optimized interface (all roles can switch)
- **View Toggle**: Persistent localStorage preference per user
- **Responsive Design**: Automatic mobile detection, manual override available

#### 2. **Request List with Advanced Filtering** ✅
- **Search Bar**: Filter by customer name, project number, or title
- **Type Filter**: Pricing, Material, Warranty, New Builder, Support
- **Stage Filter**: New, Pending, Completed, Archived
- **Tab System**: Active, Completed, Archived requests
- **Real-time Updates**: Live data from Supabase with auto-refresh

#### 3. **Request Detail View with Full Information** ✅
- **Comprehensive Header**: Title, type, submitter, submission date
- **Status Card**:
  - Current stage with visual indicators
  - Age tracking (hours/days with color coding)
  - Urgency level (Critical/High/Medium/Low)
  - Quote status (Won/Lost/Awaiting) for pricing requests
  - **Assignee Display**: Shows who is assigned
  - **Assignee Management**: Change button with dropdown to reassign
- **Customer Information**: Name, address, phone, email
- **Project Details**: Project number, fence type, linear feet, square footage
- **Voice Recording**: Original audio playback with transcript display
- **Messaging System**: Internal team communication with user names
- **Add Notes**: Comment on requests with timestamp

#### 4. **Assignment System** ✅
- **Auto-Assignment**: Rules-based automatic assignment to team members
- **Manual Assignment**: Change assignee via dropdown in request detail
- **Assignment Rules Admin**:
  - Create rules based on request type, urgency, and territory
  - Set default assignees for each rule
  - Priority ordering for multiple matching rules
- **Unassignment**: Can set requests back to unassigned status
- **Assignment Tracking**: Timestamps and history

#### 5. **Team Communication & Collaboration** ✅
- **Internal Messaging**: Add comments to any request
- **User Identification**: Real names shown instead of generic labels
- **Message History**: Full conversation thread per request
- **Timestamps**: When each message was sent
- **User Profiles**: Integration with user_profiles for names

#### 6. **Analytics Dashboard** ✅
- **Win Rate Tracking**: Quote won/lost/awaiting percentages
- **Request Volume**: Total requests by type and stage
- **Response Times**: Average time to first response
- **Team Performance**: Assignments and completion rates
- **Visual Charts**: Bar charts and pie charts for data visualization

#### 7. **Settings Consolidation** ✅
- **Unified Settings Page**: Merged Team + Assignment Rules
- **Tabbed Interface**: Easy switching between settings categories
- **Team Management**:
  - View all team members
  - Invite new users
  - Change roles (admin only)
  - Activate/deactivate users
- **Assignment Rules**: Configure auto-assignment logic

#### 8. **UI/UX Improvements** ✅
- **Compact Sidebar**:
  - Version moved to header (logo | version | close button)
  - Reduced spacing between menu items
  - Sign out button next to user profile
  - Scrollable navigation for long menus
- **Role Simulation**: Admins can switch between all role views
- **Real-time Data**: All components use live Supabase data
- **Loading States**: Spinners and skeletons for better UX

---

## 🎯 Complete Feature List

### 1. **Request Management System** ✅ PRODUCTION

#### Request Submission (RequestHub)
- **Voice-Enabled Forms**: Speak to fill out requests
- **5 Request Types**:
  - Pricing Request (custom quotes)
  - Material Request (inventory/supplies)
  - Warranty Request (customer issues)
  - New Builder Request (new client onboarding)
  - Support Request (general help)
- **Voice Recording**: Attach audio explanation to requests
- **AI Transcription**: GPT-4o-transcribe converts speech to text
- **Photo Attachments**: Add job site photos to requests
- **Customer Information**: Name, address, phone, email
- **Project Details**: Project number, fence type, measurements
- **Urgency Levels**: Critical, High, Medium, Low
- **Offline Support**: Queue requests when offline

#### Request List (MyRequestsView)
- **Personal Queue**: See all your submitted requests
- **Advanced Filters**: Search, type, stage filters
- **Status Tabs**: Active, Completed, Archived
- **Request Cards**:
  - Type icon and color coding
  - Customer name
  - Stage badge with age indicator
  - Quote amount for pricing requests
- **Click to View**: Open full detail view
- **New Request Button**: Quick access to submit new requests

#### Request Detail (RequestDetail)
- **Complete Information Display**:
  - Request header with back button
  - Type, submitter, submission date
  - Status card with stage, age, urgency
  - Quote status for pricing requests
  - Assignee with change functionality
  - Customer contact information
  - Project specifications
  - Voice recording playback
  - Transcript view
- **Team Communication**:
  - Message thread
  - Add new comments
  - User names on all messages
  - Timestamps
- **Workflow Actions** (Coming):
  - Edit request
  - Change stage
  - Update quote status

#### Request Queue (Operations)
- **All Requests View**: See entire company queue
- **Advanced Filtering**:
  - Search by customer/project/title
  - Filter by stage
  - Filter by type
  - Filter by SLA status (breached/at risk/on track)
  - Filter by assignee
  - Filter by submitter
- **Statistics Bar**:
  - Total requests
  - New requests
  - Pending requests
  - At risk (SLA)
  - Breached (SLA)
- **Assignment Management**: Quick assign from list
- **Bulk Operations** (Coming): Multi-select actions

#### Assignment Rules System
- **Rule Configuration**:
  - Match by request type
  - Match by urgency
  - Match by territory/region
  - Set default assignee
  - Priority ordering
- **Auto-Assignment**: Rules apply automatically on creation
- **Manual Override**: Can always reassign manually
- **Rule Management**: Create, edit, delete rules

### 2. **AI-Powered Photo Gallery** ✅ PRODUCTION

#### Photo Upload & Analysis
- **Drag & Drop Upload**: Multiple photos with progress tracking
- **AI Auto-Tagging**: GPT-5 analyzes and suggests tags
- **Confidence Scoring**: 0-100 confidence per photo
- **Quality Assessment**: 1-10 quality score
- **Image Optimization**: Auto-resize to 1920px + 300px thumbnails
- **Storage**: Supabase Storage with organized folder structure

#### Photo Enhancement
- **Gemini 2.5 Flash Image**: Professional AI enhancement
- **Enhancement Features**:
  - Brightness & clarity optimization
  - Detail sharpening
  - Noise reduction
  - Natural color enhancement
- **Preview Mode**: Toggle between original and enhanced
- **Publish Options**: Save enhanced version when publishing

#### Bulk Operations
- **Select Mode**: Multi-select photos for batch operations
- **AI Recommended**: Auto-select 80%+ confidence photos
- **Bulk Actions**: Publish, Save, Archive, Delete
- **Status Management**: Pending → Saved → Published → Archived

#### Tag Management (Admin)
- **Custom Tags**: Add new tags to any category
- **Built-in Tags**: Protected default tags (25 total)
- **Categories**: Product Types, Materials, Styles
- **Tag Operations**: Add, view, delete custom tags
- **Persistence**: localStorage for custom tags

### 3. **AI-Powered Sales Coach** ✅ PRODUCTION

#### Sales Rep Interface
- **Voice Recording**: Full MediaRecorder API with real-time timer
- **Offline Queue**: IndexedDB-based queue when offline
- **Three Main Tabs**:
  - **Record**: Capture sales calls with client name & date
  - **Recordings**: View history with detailed analysis
  - **Leaderboard**: Team rankings (week/month/all-time)
- **Analysis Display**:
  - Overall score with visual indicators
  - Process step completion tracking
  - Talk/listen ratio metrics
  - Questions asked, objections handled, CTAs
  - Strengths & improvement areas
  - Key moments timeline with timestamps
  - Sentiment analysis (overall, client, rep)
  - Emotional highs/lows tracking
  - Empathy moments identification

#### Admin Interface
- **Sales Process Management**:
  - Create/edit custom sales processes
  - Define process steps with key behaviors
  - Set default processes
- **Knowledge Base Editor**:
  - Company information
  - Product catalog
  - Common objections & responses
  - Best practices library
  - Industry context

### 4. **Team Management & Collaboration** ✅ PRODUCTION

#### User Management
- **Team List**: View all team members with search
- **Invite System**: Email-based invitations with unique tokens
- **Role Management**: Change user roles (sales/operations/sales-manager/admin)
- **Activate/Deactivate**: Control user access
- **Profile Display**: Real names, roles, last login

#### Communication
- **Request Messaging**: Internal team chat per request
- **User Identification**: Real names on all messages
- **Mentions** (Coming): @mention team members
- **Notifications** (Coming): Email/push notifications

### 5. **Analytics Dashboard** ✅ PRODUCTION

#### Request Analytics
- **Win Rate**: Quote success percentage
- **Request Volume**: By type, stage, time period
- **Response Times**: Average time to first response
- **Team Performance**: By assignee
- **SLA Compliance**: On-time completion rates

#### Visual Charts
- **Bar Charts**: Request volume over time
- **Pie Charts**: Request type distribution
- **Line Graphs**: Trends and patterns
- **Heatmaps**: Busiest times/days

### 6. **Authentication & Authorization** ✅ PRODUCTION

#### Supabase Auth Integration
- **Email/Password**: Standard authentication
- **Email Verification**: Confirmation flow
- **Password Reset**: Self-service recovery
- **Session Management**: Secure token handling
- **Protected Routes**: Login required for all features

#### Role-Based Access Control (RBAC)
- **4 Roles**: Sales, Operations, Sales Manager, Admin
- **Permission System**: Role-based feature access
- **Role Simulation**: Admins can switch between role views
- **Profile Management**: Update user information

### 7. **Sales Resources Library** ✅ PRODUCTION

#### File Management
- **Upload Files**: PDF, PPT, PPTX, Images, Videos up to 20MB
- **Folder Organization**: Colorful folders with patterns
- **File Operations**:
  - Rename files
  - Add descriptions
  - Archive/restore
  - Favorite files (per-user)
  - View count tracking
- **Search & Filter**: By filename and type
- **Inline Viewing**: PDF preview

### 8. **Pre-Stain ROI Calculator** ✅ PRODUCTION

#### Calculator Features
- **Dynamic Cost Calculation**: Real-time updates
- **DIY vs Pre-stained Comparison**
- **Advanced Settings**: Labor rates, stain costs, markups
- **Professional Benefits**: Time savings breakdown
- **Mobile-Responsive Design**

### 9. **Client Presentation Viewer** ✅ PRODUCTION

#### Presentation Features
- **PDF Viewer**: Full-screen presentation mode
- **Upload System**: Store client presentations
- **Version Management**: Multiple versions per client
- **Access Control**: Role-based viewing

---

## 🏗️ Complete Project Structure

```
discount-fence-hub/
├── src/
│   ├── components/
│   │   ├── auth/
│   │   │   ├── Login.tsx                    ✅ Login screen
│   │   │   └── Signup.tsx                   ✅ Self-service signup
│   │   ├── requests/
│   │   │   ├── RequestHub.tsx               ✅ Submit new requests
│   │   │   ├── RequestList.tsx              ✅ Personal request queue
│   │   │   ├── RequestDetail.tsx            ✅ Full request view
│   │   │   ├── MyRequestsView.tsx           ✅ My requests container
│   │   │   └── RequestCard.tsx              ✅ Request card component
│   │   ├── operations/
│   │   │   └── RequestQueue.tsx             ✅ Operations queue
│   │   ├── admin/
│   │   │   └── AssignmentRules.tsx          ✅ Assignment rule config
│   │   ├── sales/
│   │   │   ├── SalesCoach.tsx               ✅ Sales coaching interface
│   │   │   ├── SalesCoachAdmin.tsx          ✅ Admin configuration
│   │   │   └── StainCalculator.tsx          ✅ ROI calculator
│   │   ├── PhotoGallery.tsx                 ✅ Photo gallery with AI
│   │   ├── Analytics.tsx                    ✅ Analytics dashboard
│   │   ├── TeamManagement.tsx               ✅ Team & user management
│   │   ├── Settings.tsx                     ✅ Unified settings page
│   │   ├── Dashboard.tsx                    ✅ Main dashboard
│   │   └── InstallAppBanner.tsx             ✅ PWA install prompt
│   ├── contexts/
│   │   └── AuthContext.tsx                  ✅ Authentication context
│   ├── hooks/
│   │   └── useRequests.ts                   ✅ Request management hooks
│   ├── lib/
│   │   ├── supabase.ts                      ✅ Supabase client
│   │   ├── requests.ts                      ✅ Request API functions
│   │   ├── recordings.ts                    ✅ Recording management
│   │   ├── photos.ts                        ✅ Photo utilities
│   │   └── offlineQueue.ts                  ✅ IndexedDB queue
│   ├── types.ts                             ✅ TypeScript type definitions
│   ├── App.tsx                              ✅ Main app with routing
│   ├── main.tsx                             ✅ Entry point
│   └── index.css                            ✅ TailwindCSS styles
├── netlify/functions/
│   ├── upload-recording.ts                  ✅ Audio upload handler
│   ├── transcribe.ts                        ✅ GPT-4o-transcribe
│   ├── analyze-recording.ts                 ✅ Claude Sonnet 4.5 analysis
│   ├── parse.ts                             ✅ Claude parsing
│   ├── analyze-photo.ts                     ✅ GPT-5 photo tagging
│   └── enhance-photo.ts                     ✅ Gemini 2.5 enhancement
├── public/                                  📁 Logos and assets
├── SQL scripts/
│   ├── supabase-schema.sql                  ✅ Complete database schema
│   ├── create-auth-tables.sql               ✅ Auth & user profiles
│   ├── add-confidence-score.sql             ✅ Photo confidence scoring
│   └── fix-storage-content-disposition.sql  ✅ Storage config
└── PROJECT_SUMMARY.md                       ✅ This file
```

---

## 📊 Database Schema (Supabase)

### Core Tables:
1. **`requests`** - All request types with full details
2. **`request_notes`** - Internal team messages per request
3. **`request_activity`** - Audit trail for all request changes
4. **`assignment_rules`** - Auto-assignment configuration
5. **`user_profiles`** - Extended user data with roles
6. **`user_invitations`** - Team invitation system
7. **`photos`** - Photo gallery with AI tags & scores
8. **`sales_resources_files`** - Sales library files
9. **`sales_resources_folders`** - Folder organization
10. **`sales_resources_favorites`** - User favorites
11. **`presentations`** - Client presentation files
12. **`roi_calculations`** - Calculator usage tracking

### Storage Buckets:
- `voice-recordings` - Audio files from requests
- `photos` - Job site images with AI enhancements
- `presentations` - Client files
- `sales-resources` - Sales library files

---

## 🚀 Current Development Priorities

### HIGH PRIORITY (In Progress):
1. **Request Editing** - Edit request details after submission
2. **Activity Timeline** - Visual timeline of all request changes
3. **Stage Management** - Change request stages with workflow buttons
4. **Statistics Dashboard** - Add stats to My Requests view

### MEDIUM PRIORITY (Planned):
5. **Missing Filters** - Add assignee, submitter, SLA filters to RequestList
6. **Quote Status Management** - Update quote status (Won/Lost/Awaiting)
7. **Audio Playback** - Play original voice recordings in RequestDetail
8. **Right Sidebar** - Desktop layout with photo/file preview panel

### Analytics Strategy Decision:
**Question**: Should Analytics be the unified hub for all metrics (Requests, Photos, AI Coach, App Usage)?
- **Option A**: Unified Analytics Dashboard - One place for all metrics
- **Option B**: Distributed Analytics - Each section has its own analytics
- **Recommendation**: Unified dashboard with drill-down into specific areas

---

## 🔧 Technology Stack

### Frontend
- **React 19** with TypeScript
- **Vite 7** for fast builds
- **TailwindCSS 3** for styling
- **Lucide React** for icons
- **IndexedDB** for offline storage

### Backend & APIs
- **Supabase** - PostgreSQL, Auth, Storage, Realtime
- **Netlify Functions** - Serverless API endpoints
- **OpenAI GPT-5** - Photo analysis
- **Google Gemini 2.5 Flash** - Photo enhancement
- **OpenAI GPT-4o-transcribe** - Voice transcription
- **Anthropic Claude Sonnet 4.5** - AI analysis & parsing

### Infrastructure
- **Netlify** - Hosting & deployment
- **PWA** - Service workers & offline support
- **Node 20** - Runtime environment

---

## 📈 Project Statistics

- **Total Lines of Code**: ~25,000+
- **React Components**: 25+ major components
- **Netlify Functions**: 6 serverless endpoints
- **Database Tables**: 12 tables
- **Storage Buckets**: 4 configured
- **API Integrations**: 5 AI models + Supabase
- **Deployment**: ✅ Live on Netlify
- **Users**: Sales, Operations, Managers, Admins

---

## 💡 Environment Variables Required

```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_ANTHROPIC_API_KEY=your_claude_api_key
VITE_OPENAI_API_KEY=your_openai_key
VITE_GOOGLE_API_KEY=your_google_api_key
```

---

## 👥 Project Info

- **Developer**: GiacomoIaco
- **Company**: Discount Fence USA
- **Started**: October 2024
- **Current Phase**: Phase 3 - Request Management ✅ Complete
- **Next Phase**: Phase 4 - Advanced Features & Analytics
- **Status**: Active Development
- **License**: Proprietary

---

**Built with ❤️ for Discount Fence USA**
*Powered by React, TypeScript, Supabase, and cutting-edge AI*
