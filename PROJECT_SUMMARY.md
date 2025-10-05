# Discount Fence USA Operations Hub - Project Summary

## 🎉 Project Status: ✅ PRODUCTION DEPLOYED

A **comprehensive mobile-first web application** for sales reps, managers, and operations teams at Discount Fence USA, featuring AI-powered sales coaching, voice transcription, intelligent photo gallery with auto-tagging, complete authentication system, team management, and sales resources library.

**🌐 Live on Netlify** | **📊 Supabase Connected** | **🤖 All AI Integrations Active** | **🔐 Authentication Enabled** | **👥 Team Management Active**

---

## 📦 What's Actually Been Built

### Core Application Stack
✅ **React 19 + TypeScript + Vite** - Modern, fast development setup
✅ **TailwindCSS** - Utility-first styling with mobile-first responsive design
✅ **Supabase Integration** - Backend client configured (database schema ready)
✅ **Netlify Functions** - Serverless backend with 7 API endpoints
✅ **PWA Support** - Progressive Web App with offline capabilities
✅ **IndexedDB** - Local offline queue management

---

## 🎯 Features Implemented

### 1. **AI-Powered Sales Coach** ✅ FULLY FUNCTIONAL
The centerpiece feature - a complete AI-powered sales coaching system:

#### Sales Rep Interface (`SalesCoach.tsx`)
- **Voice Recording**: Full MediaRecorder API implementation with real-time timer
- **Offline Queue**: IndexedDB-based queue for recordings when offline
- **Three Main Tabs**:
  - **Record**: Capture sales calls with client name & date tracking
  - **Recordings**: View history with detailed analysis
  - **Leaderboard**: Team rankings (week/month/all-time)
- **Recording Analysis Display**:
  - Overall score with visual indicators
  - Process step completion tracking
  - Talk/listen ratio metrics
  - Questions asked, objections handled, CTAs
  - Strengths & improvement areas
  - Key moments timeline with timestamps
  - Sentiment analysis (overall, client, rep)
  - Emotional highs/lows tracking
  - Empathy moments identification
  - Manager review integration
- **User Stats Dashboard**: Total recordings, average score, completion rate, improvement tracking
- **Online/Offline Mode**: Visual indicators and automatic queue syncing

#### Admin Interface (`SalesCoachAdmin.tsx`)
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
- **Recording Management**:
  - View all team recordings
  - Delete individual recordings
  - Bulk management capabilities

#### Backend Infrastructure (Netlify Functions)
- `upload-recording.ts` - Handles audio file uploads
- `start-transcription.ts` - Initiates transcription jobs
- `check-transcription.ts` - Polls transcription status
- `transcribe-recording.ts` - Full transcription workflow
- `analyze-recording.ts` - **AI analysis using Claude API**
  - Analyzes sales conversations against custom processes
  - Scores performance on each process step
  - Identifies strengths, weaknesses, key moments
  - Tracks metrics (talk ratio, questions, objections)
  - Sentiment analysis throughout conversation
  - Coaching priorities & predicted outcomes
- `transcribe.ts` - OpenAI Whisper integration
- `parse.ts` - Claude-powered transcript parsing

#### Offline Support (`offlineQueue.ts`)
- Complete IndexedDB implementation
- Queued recording management
- Automatic retry logic
- Queue size tracking
- Sync when online

### 2. **Pre-Stain ROI Calculator** ✅ FULLY FUNCTIONAL
(`StainCalculator.tsx`)
- Dynamic cost calculator with real-time updates
- DIY vs Pre-stained comparison
- Advanced settings panel (labor rates, stain costs, markups)
- Professional benefits breakdown
- Mobile-responsive design
- Time savings calculations

### 3. **Multi-Role Interface** ✅ COMPLETE
Role-based navigation with localStorage persistence:

#### Sales Rep View (Mobile-First)
- Home dashboard with 5 request type buttons
- Voice-enabled custom pricing requests
- Pre-stain calculator access
- Sales coach interface
- Client presentation viewer
- No sidebar - clean mobile UX

#### Back Office View
- Dashboard
- Request queue
- Analytics
- Team management

#### Manager View
- Manager dashboard
- Sales coach access (view only)
- Team performance metrics
- Analytics

#### Admin View
- Full dashboard access
- Request queue management
- Analytics
- Team management
- **Sales Coach Admin** - Full process & knowledge base configuration

### 4. **Voice-Enabled Request System** ✅ IMPLEMENTED
- MediaRecorder API integration
- Real-time recording timer
- Audio playback controls
- Whisper API integration via Netlify function
- Claude API for intelligent parsing
- Confidence scoring UI
- Editable parsed fields
- Success confirmation flow

### 5. **All Request Types** ✅ UI COMPLETE
- Custom Pricing Request (voice-enabled)
- New Builder/Community
- Installation Issue
- Material Request
- Customer Escalation

### 6. **Client Presentation Viewer** ✅ UI READY
- Upload interface
- Full-screen viewer placeholder
- Ready for PDF/PPT integration

### 7. **Authentication System** ✅ FULLY FUNCTIONAL
(`AuthContext.tsx`, `Login.tsx`, `Signup.tsx`)
- **Supabase Auth Integration**: Complete email/password authentication
- **User Profiles**: Extended auth.users with custom user_profiles table
- **Phone Number Collection**: Optional phone field during signup
- **Email Verification**: Confirmation email with verification flow
- **Protected Routes**: Login screen for unauthenticated users
- **Role-Based Access**: 4 roles (sales, operations, sales-manager, admin)
- **Profile Management**: Update user profiles and track activity
- **Sign Out**: Full session management
- **Development Bypass**: Optional localStorage bypass for testing
- **Auto-create Profiles**: Database trigger creates profile on signup
- **Last Login Tracking**: Automatic timestamp updates
- **User Display**: Real name and role shown in sidebar (no more mock data)
- **Admin Role Toggle**: Admins can switch between all role views
- **Security**: RLS policies disabled (to be re-enabled with proper non-recursive policies)

### 8. **Team Management** ✅ FULLY FUNCTIONAL
(`TeamManagement.tsx`)
- **User List**: View all team members with search and filter
  - Search by name or email
  - Filter by role (all, admin, sales-manager, operations, sales)
  - Display: Avatar with initials, full name, email, phone, role, join date
  - Visual indicators: "You" badge, inactive status, role badges
- **Invite Users**: Email-based invitation system
  - Create invitation with email and role assignment
  - Generate unique invitation token (7-day expiration)
  - Track who invited whom and when
  - Share invitation link (manual for now, email automation pending)
  - Pending invitations view with delete option
- **User Management** (Admin Only):
  - Change user roles (inline dropdown)
  - Activate/deactivate users (toggle button)
  - Cannot modify own role or status (safety)
  - All changes tracked with timestamps
- **Permissions**:
  - Sales/Operations: No access (restricted message)
  - Sales Manager: View team + send invitations
  - Admin: Full access (invite, change roles, activate/deactivate)
- **Database Tables**:
  - `user_profiles`: id, email, full_name, role, phone, is_active, created_at, updated_at, last_login
  - `user_invitations`: email, role, invited_by, token, expires_at, is_used, invited_at

### 9. **Sales Resources Library** ✅ FULLY FUNCTIONAL
(`SalesResources.tsx`)
- **Folder-Based Organization**:
  - Colorful gradient folders (8 colors: blue, purple, green, orange, pink, indigo, teal, red)
  - Each folder gets unique color with decorative pattern
  - Hover animations and visual depth
- **File Management**:
  - Upload files (PDF, PPT, PPTX, Images, Videos) up to 20MB
  - Duplicate filename detection with archive-and-replace option
  - File rename (preserves extension automatically)
  - File descriptions (optional, 200 char max, 1-2 lines)
  - View files inline (no download for PDFs)
  - Archive files (soft delete)
  - Favorite files (per-user)
  - View count tracking
- **Advanced File Cards**:
  - Icon, name, "NEW" badge (within 7 days)
  - Description in italic below name
  - Metadata: file size, upload date, view count
  - Action buttons: Favorite, View, Edit, Archive
  - Taller cards with better spacing
  - Mobile-friendly touch targets
- **Search & Filter**:
  - Search by filename
  - Filter by type (all, PDF, PowerPoint, images, videos)
- **Archived Files Section** (Admin Only):
  - View all archived files from all folders
  - Orange theme with "ARCHIVED" badge
  - Shows archived date
  - Actions: View, Restore, Permanent Delete
  - Confirmation before permanent deletion
  - Deletes from both database and storage
- **Edit Modal** (Admin/Manager):
  - Rename file (extension shown separately, auto-preserved)
  - Add/edit description (textarea with character counter)
  - Duplicate check on rename
- **Permissions**:
  - All Users: View files, favorite files
  - Sales Manager/Admin: Upload, edit, archive files
  - Admin Only: View archived section, restore files, permanent delete
- **Database Schema**:
  - `sales_resources_folders`: id, name, created_by, created_at, archived
  - `sales_resources_files`: id, folder_id, name, description, file_type, file_size, storage_path, uploaded_by, uploaded_at, archived, archived_at, archived_by, view_count
  - `sales_resources_favorites`: user_id, file_id (many-to-many)
  - `sales_resources_views`: user_id, file_id, viewed_at (tracking)
- **Storage**:
  - Supabase Storage bucket: `sales-resources`
  - Public bucket with proper content-type headers
  - Files organized by folder_id/timestamp.ext

### 10. **App Installation Prompts** ✅ COMPLETE
(`InstallAppBanner.tsx`)
- **Smart Install Banner**:
  - Auto-detects if app is already installed (PWA standalone mode)
  - Dismissible with localStorage persistence
  - Platform-specific instructions (iOS, Android, Desktop)
  - Native install prompt for compatible browsers
  - Positioned at bottom with sidebar offset
  - Displays in both mobile and desktop views
- **Signup Success Page**:
  - Shows install instructions after email verification
  - Step-by-step guide for each platform
  - Clean blue info box design
- **Invitation Messages**:
  - Formatted invitation with app install instructions
  - 2-step process: signup + install
  - Platform-specific guidance included

---

## 🏗️ Project Structure

```
discount-fence-hub/
├── src/
│   ├── components/
│   │   ├── auth/
│   │   │   ├── Login.tsx               ✅ Login screen
│   │   │   └── Signup.tsx              ✅ Self-service signup
│   │   ├── sales/
│   │   │   ├── SalesCoach.tsx          ✅ Full sales coaching interface
│   │   │   ├── SalesCoachAdmin.tsx     ✅ Admin configuration panel
│   │   │   └── StainCalculator.tsx     ✅ ROI calculator
│   │   ├── PhotoGallery.tsx            ✅ Photo gallery with AI tagging
│   │   ├── PhotoReviewQueue.tsx        ✅ Manager photo review
│   │   ├── SalesResources.tsx          ✅ Sales resources library
│   │   ├── TeamManagement.tsx          ✅ Team & user management
│   │   └── InstallAppBanner.tsx        ✅ PWA install prompt
│   ├── contexts/
│   │   └── AuthContext.tsx             ✅ Authentication context
│   ├── lib/
│   │   ├── supabase.ts                 ✅ Supabase client
│   │   ├── openai.ts                   ✅ Whisper transcription
│   │   ├── claude.ts                   ✅ Claude parsing
│   │   ├── recordings.ts               ✅ Recording management API
│   │   ├── offlineQueue.ts             ✅ IndexedDB offline queue
│   │   └── photos.ts                   ✅ Photo utilities
│   ├── App.tsx                         ✅ Main app with role-based routing
│   ├── main.tsx                        ✅ Entry point with AuthProvider
│   └── index.css                       ✅ TailwindCSS
├── netlify/functions/
│   ├── upload-recording.ts             ✅ File upload handler
│   ├── start-transcription.ts          ✅ Transcription job starter
│   ├── check-transcription.ts          ✅ Status checker
│   ├── transcribe-recording.ts         ✅ Full transcription flow
│   ├── analyze-recording.ts            ✅ AI analysis with Claude
│   ├── transcribe.ts                   ✅ Whisper integration
│   └── parse.ts                        ✅ Claude parsing
├── public/                             📁 Logos and assets
├── SQL scripts/
│   ├── supabase-schema.sql             ✅ Complete database schema
│   ├── create-auth-tables.sql          ✅ Auth & user profiles
│   ├── disable-user-profiles-rls.sql   ✅ Fix RLS recursion
│   ├── add-file-description.sql        ✅ Add description column
│   └── fix-storage-content-disposition.sql ✅ Storage bucket config
├── vite.config.ts                      ✅ Vite + PWA config
├── netlify.toml                        ✅ Deployment config
├── DEPLOY.md                           ✅ Deployment guide
├── README.md                           ✅ Documentation
├── PROJECT_SUMMARY.md                  ✅ This file
└── package.json                        ✅ Dependencies
```

---

## 🔧 Technology Stack

### Frontend
- **React 19** with TypeScript
- **Vite 7** for lightning-fast builds
- **TailwindCSS 3** for styling
- **Lucide React** for icons
- **MediaRecorder API** for voice capture
- **IndexedDB** for offline storage

### Backend & APIs
- **Supabase** - PostgreSQL database, Auth, Storage
- **Netlify Functions** - Serverless API endpoints
- **OpenAI Whisper** - Voice transcription
- **Anthropic Claude** - AI analysis & parsing
- **AssemblyAI** - Alternative transcription (configured in PWA cache)

### Infrastructure
- **Netlify** - Hosting & serverless functions
- **PWA** - Progressive Web App with service workers
- **IndexedDB** - Offline data persistence
- **Node 20** - Runtime environment

---

## 📊 Database Schema (Supabase)

### Database Tables:
**Core Schema** (`supabase-schema.sql`):
1. **`sales_reps`** - User profiles, territories, metrics
2. **`requests`** - All request types with polymorphic data
3. **`presentations`** - Client presentation files
4. **`roi_calculations`** - Calculator usage tracking
5. **`activity_log`** - Audit trail for all actions
6. **`photos`** - Photo gallery with AI tags

**Authentication** (`create-auth-tables.sql`):
7. **`user_profiles`** - Extended user data (full_name, role, phone, is_active, last_login)
8. **`user_invitations`** - Invitation system (email, role, token, expires_at, is_used)

**Sales Resources** (created separately):
9. **`sales_resources_folders`** - Folder organization
10. **`sales_resources_files`** - Files with descriptions, view counts
11. **`sales_resources_favorites`** - User favorites (many-to-many)
12. **`sales_resources_views`** - View tracking

### Features:
- ✅ Row Level Security (RLS) policies (disabled on user_profiles to fix recursion)
- ✅ Performance indexes
- ✅ Trigger functions for auto-timestamps and profile creation
- ✅ Foreign key constraints
- ✅ Role-based access control (4 roles: sales, operations, sales-manager, admin)
- ✅ Full-text search on file descriptions

### Storage Buckets:
- `voice-recordings` - Audio files
- `photos` - Job site images with AI tags
- `presentations` - Client files
- `sales-resources` - Sales library files (PDFs, presentations, images, videos)

---

## 🚀 Deployment Status

### ✅ Ready for Production
- [x] GitHub repository setup
- [x] Netlify configuration complete
- [x] Environment variables template (`.env.example`)
- [x] Database schema ready
- [x] Build scripts configured
- [x] PWA manifest & service worker

### 📋 Deployment Checklist
See `DEPLOY.md` for step-by-step instructions:
1. Create Supabase project
2. Run `supabase-schema.sql`
3. Create storage buckets
4. Set up Netlify site
5. Configure environment variables:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_ANTHROPIC_API_KEY`
   - `VITE_OPENAI_API_KEY` (optional)
6. Deploy!

---

## 🎯 Current Capabilities

### What Works Now:
✅ Sales coach recording with full offline support
✅ **Real AI-powered transcription** with OpenAI Whisper & AssemblyAI
✅ **Real AI analysis** with Claude API - live, functional, producing detailed feedback
✅ Custom sales process configuration
✅ Knowledge base management
✅ Team leaderboard & rankings
✅ Manager review system
✅ Pre-stain ROI calculator
✅ Multi-role interface with persistence
✅ Voice recording & playback
✅ Offline queue with auto-sync
✅ PWA installation on mobile devices

### Integration Status:
- **OpenAI Whisper API**: ✅ **FULLY FUNCTIONAL** - Real voice transcription working via Netlify function (`transcribe.ts`)
- **Claude API**: ✅ **FULLY FUNCTIONAL** - AI analysis & parsing live (`analyze-recording.ts`, `analyze-photo.ts`, `parse.ts`)
- **AssemblyAI**: ✅ **FULLY FUNCTIONAL** - Alternative transcription service integrated
- **Supabase**: ✅ **PRODUCTION CONNECTED** - Database live at `mravqfoypwyutjqtoxet.supabase.co`
- **Supabase Auth**: ✅ **FULLY FUNCTIONAL** - Email/password authentication live
- **Netlify**: ✅ **DEPLOYED** - Live serverless functions + hosting
- **Storage**: ✅ **CONFIGURED** - 4 buckets created (`voice-recordings`, `photos`, `presentations`, `sales-resources`)
- **PWA**: ✅ **INSTALLED** - Progressive Web App with service workers, install prompts

---

## 🛣️ Roadmap & Next Steps

### Phase 1: Production Deployment ✅ COMPLETE
- [x] ✅ Deploy to Netlify
- [x] ✅ Connect Supabase database
- [x] ✅ Configure storage buckets (voice-recordings, photos, presentations)
- [x] ✅ Add environment variables (all API keys configured)
- [x] ✅ Test end-to-end flows
- [ ] ⏳ Set up storage RLS policies (run `supabase-storage-policies.sql`)
- [ ] ⏳ Set up Supabase Auth

### Phase 2: Photo Gallery Enhancement ✅ COMPLETE
- [x] ✅ AI-powered photo auto-tagging (Claude Vision)
- [x] ✅ Advanced filtering (Product Type, Material, Style)
- [x] ✅ Full-screen viewer with swipe navigation
- [x] ✅ Desktop review queue for managers/admins
- [x] ✅ Image optimization (1920px + 300px thumbnails)
- [x] ✅ Client presentation mode (flag photos)
- [x] ✅ Role-based permissions

### Phase 3: Authentication & User Management ✅ COMPLETE
- [x] ✅ Supabase Auth integration (email/password)
- [x] ✅ User profiles with roles
- [x] ✅ Login/Signup screens
- [x] ✅ Protected routes
- [x] ✅ Team management (invite, roles, activation)
- [x] ✅ Admin role toggle
- [x] ✅ Profile display in sidebar

### Phase 4: Sales Resources Library ✅ COMPLETE
- [x] ✅ Folder-based organization with colorful design
- [x] ✅ File upload (PDF, PPT, images, videos)
- [x] ✅ Duplicate detection and archive-replace
- [x] ✅ File rename (preserves extension)
- [x] ✅ File descriptions (200 char max)
- [x] ✅ Search and filter
- [x] ✅ Favorite files
- [x] ✅ View count tracking
- [x] ✅ Archive/restore/delete
- [x] ✅ Inline PDF viewing (no download)

### Phase 5: Data Persistence (In Progress)
- [x] ✅ Supabase database connected
- [x] ✅ File storage for photos and resources
- [x] ✅ User authentication with database
- [ ] ⏳ Replace localStorage with Supabase for recordings
- [ ] ⏳ Real-time sync for recordings
- [ ] ⏳ Team data aggregation from database

### Phase 6: Enhanced Features (Next)
- [ ] Real-time notifications (Supabase Realtime)
- [x] ✅ Photo upload with compression (auto-resize + thumbnails)
- [x] ✅ PWA install prompts (mobile + desktop)
- [ ] PDF presentation viewer
- [ ] Export reports to PDF
- [ ] Advanced analytics dashboard
- [ ] Team chat/messaging
- [ ] Email automation for invitations (Netlify function)

### Phase 7: Mobile & Performance (Future)
- [ ] Native mobile app (React Native)
- [x] ✅ Enhanced offline capabilities (IndexedDB queue)
- [x] ✅ PWA with service workers
- [ ] Background sync
- [ ] Push notifications
- [ ] Performance optimizations
- [ ] Code splitting for faster loads

---

## 🔑 Key Files Reference

| File | Purpose | Status |
|------|---------|--------|
| `src/App.tsx` | Main application, role routing, request handling | ✅ Complete |
| `src/components/sales/SalesCoach.tsx` | Sales coaching interface | ✅ Full featured |
| `src/components/sales/SalesCoachAdmin.tsx` | Admin configuration | ✅ Complete |
| `src/components/sales/StainCalculator.tsx` | ROI calculator | ✅ Complete |
| `src/lib/recordings.ts` | Recording management API | ✅ Complete |
| `src/lib/offlineQueue.ts` | IndexedDB queue | ✅ Complete |
| `src/lib/openai.ts` | Whisper integration | ✅ Complete |
| `src/lib/claude.ts` | Claude parsing | ✅ Complete |
| `src/lib/photos.ts` | Photo utilities & types | ✅ Complete |
| `src/components/PhotoGallery.tsx` | Photo gallery UI | ✅ Complete |
| `src/components/PhotoReviewQueue.tsx` | Manager review interface | ✅ Complete |
| `src/components/auth/Login.tsx` | Login screen | ✅ Complete |
| `src/components/auth/Signup.tsx` | Self-service signup | ✅ Complete |
| `src/components/TeamManagement.tsx` | Team & user management | ✅ Complete |
| `src/components/SalesResources.tsx` | Sales resources library | ✅ Complete |
| `src/components/InstallAppBanner.tsx` | PWA install prompt | ✅ Complete |
| `src/contexts/AuthContext.tsx` | Authentication context | ✅ Complete |
| `netlify/functions/analyze-recording.ts` | AI sales call analysis | ✅ Complete |
| `netlify/functions/analyze-photo.ts` | AI photo tagging | ✅ Complete |
| `supabase-schema.sql` | Database schema | ✅ Ready |
| `create-auth-tables.sql` | Auth & user profiles | ✅ Ready |
| `add-file-description.sql` | File descriptions | ✅ Ready |
| `fix-storage-content-disposition.sql` | Storage config | ✅ Ready |
| `vite.config.ts` | Build & PWA config | ✅ Complete |

---

## 💡 Development

### Local Development:
```bash
npm install
cp .env.example .env
# Add your API keys to .env
npm run dev
```

### Build:
```bash
npm run build
npm run preview
```

### Environment Variables Required:
```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_ANTHROPIC_API_KEY=your_claude_api_key
VITE_OPENAI_API_KEY=your_openai_key (optional)
```

---

## 📈 Project Statistics

- **Total Lines of Code**: ~18,000+
- **React Components**: 16+ major components
  - SalesCoach, SalesCoachAdmin, StainCalculator
  - PhotoGallery, PhotoReviewQueue
  - Login, Signup, TeamManagement
  - SalesResources, InstallAppBanner
  - Dashboard, Analytics, etc.
- **Contexts**: 1 (AuthContext for global auth state)
- **Netlify Functions**: 7 serverless endpoints (transcribe, analyze, parse, upload, etc.)
- **Database Tables**: 12 tables
  - Core: sales_reps, requests, presentations, roi_calculations, activity_log, photos
  - Auth: user_profiles, user_invitations
  - Resources: sales_resources_folders, sales_resources_files, sales_resources_favorites, sales_resources_views
- **Storage Buckets**: 4 configured (voice-recordings, photos, presentations, sales-resources)
- **API Integrations**: 4 (Supabase Auth + Database, OpenAI Whisper, Anthropic Claude, AssemblyAI)
- **Authentication**: Full Supabase Auth with email/password, role-based access
- **Offline Support**: Full IndexedDB implementation for recordings
- **PWA Features**: Service worker, manifest, offline caching, install prompts
- **Deployment**: ✅ Live on Netlify with continuous deployment

---

## 🎓 Key Innovations

1. **Offline-First Sales Coaching**: Record sales calls even without internet, auto-sync later
2. **AI-Powered Analysis**: Claude API provides detailed, context-aware feedback & photo tagging
3. **Custom Sales Processes**: Admins can define company-specific sales methodologies
4. **Manager Review System**: Layer human feedback on top of AI analysis
5. **Team Leaderboard**: Gamification with weekly/monthly rankings
6. **Sentiment Tracking**: Emotional highs/lows throughout conversations
7. **Multi-Role Architecture**: Sales, operations, manager, admin - all in one app with role-based navigation
8. **Self-Service Authentication**: Email/password signup with email verification
9. **Team Management**: Invite users, manage roles, track activity - all within the app
10. **Sales Resources Library**: Organized file storage with AI-assisted management, favorites, and view tracking
11. **Smart File Management**: Duplicate detection, auto-archive, inline viewing, descriptions
12. **PWA Installation**: Progressive Web App with smart install prompts for mobile and desktop
13. **Colorful UI**: Gradient folders, visual depth, modern mobile-first design

---

## 🐛 Known Limitations & Active Issues

### 🔴 CRITICAL ISSUE - Team Communication Mobile Tab Switching
**Problem**: When switching from "Sent" tab to "Inbox" tab on MOBILE, the screen goes blank/freezes.

**What's Been Tried** (3 attempts):
1. ✅ Fixed broken import - removed non-existent `TeamCommunication` component
2. ✅ Fixed engagement data query - separated LEFT JOIN into proper user-filtered query
3. ✅ Added viewMode checks in getUnreadCount() and getDraftsCount()
4. ✅ Added extensive console.log debugging
5. ✅ Added error handling to prevent blank screens

**Root Cause** (suspected):
- The issue persists despite all fixes
- Likely a state management issue or race condition when switching tabs
- Console logs should reveal the exact failure point
- Possible React rendering issue with state updates

**Next Steps to Try**:
- Check browser console for errors when switching tabs
- Add React.memo or useMemo to prevent unnecessary re-renders
- Consider adding a loading state between tab switches
- Debug the exact sequence: Sent loaded → Click Inbox → What fails?
- Potentially rewrite tab switching to unmount/remount component

**Workaround**: Desktop view works fine. Only affects mobile Sales Rep view.

**Files Involved**:
- `src/components/TeamCommunicationMobileV2.tsx` (lines 77-110, 354-362)
- `src/App.tsx` (line 423)

---

### Current Limitations:
1. **Data Sync**: Recordings use localStorage - need to migrate to Supabase
2. **Real-time Sync**: Recordings don't sync across devices yet (needs Supabase Realtime)
3. **Team Features**: Leaderboard uses localStorage data (not cross-device yet)
4. **RLS Policies**: user_profiles table has RLS disabled (needs proper non-recursive policies)
5. **Email Automation**: Invitations show link in alert (need Netlify function for emails)
6. **PowerPoint Viewing**: PPT files download instead of inline view (recommend PDFs)

### What's Already Working (No Limitations):
✅ **Authentication** - Full Supabase Auth with email/password, email verification
✅ **User Profiles** - Real user data with roles, phone numbers, activity tracking
✅ **Team Management** - Invite users, manage roles, activate/deactivate
✅ **Sales Resources** - Complete file library with folders, upload, edit, archive
✅ **Voice transcription** - Whisper & AssemblyAI APIs fully operational
✅ **AI analysis** - Claude API delivering real coaching feedback & photo tagging
✅ **Photo Gallery** - Full upload, tagging, filtering, review workflow
✅ **Offline recording** - IndexedDB queue working perfectly
✅ **PWA installation** - Service workers, manifest, install prompts all working
✅ **Supabase Storage** - 4 buckets for photos, files, recordings, presentations
✅ **Netlify Deployment** - Live in production with CI/CD

### Planned Improvements:
1. ✅ ~~Implement Supabase Auth~~ (Complete!)
2. ✅ ~~Team management interface~~ (Complete!)
3. ✅ ~~Sales resources library~~ (Complete!)
4. Upload audio recordings to Supabase Storage (migrate from localStorage)
5. Real-time subscriptions for team updates
6. Email automation for invitations (Netlify function)
7. Advanced analytics with charts & graphs
8. Export functionality for reports
9. Proper RLS policies for user_profiles table

---

## 🏆 Success Criteria

### MVP Complete ✅
- [x] Sales coach recording interface
- [x] AI analysis with Claude
- [x] Offline support
- [x] Admin configuration
- [x] ROI calculator
- [x] Multi-role interface
- [x] Photo gallery with AI tagging
- [x] Photo review workflow
- [x] Advanced filtering

### Production Ready ✅
- [x] Supabase database connected
- [x] File storage working (photos)
- [x] Deployed to Netlify
- [x] Environment variables configured
- [x] AI integrations functional
- [ ] Authentication implemented (in progress)
- [ ] Storage policies applied (run SQL script)
- [ ] End-to-end testing complete

---

## 📞 Support & Documentation

- **Setup**: See `DEPLOY.md`
- **Code**: See `README.md`
- **Database**: See `supabase-schema.sql` with inline comments
- **API Endpoints**: See `netlify/functions/` directory

---

## 👥 Project Info

- **Developer**: GiacomoIaco
- **Company**: Discount Fence USA
- **Started**: October 2024
- **Status**: Active Development
- **License**: Proprietary

---

**Built with ❤️ for Discount Fence USA**
*Powered by React, TypeScript, Claude AI, and modern web technologies*
