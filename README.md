# Discount Fence USA Operations Hub

A comprehensive, mobile-first web application for sales reps, managers, and operations teams at Discount Fence USA. Features AI-powered sales coaching, voice transcription, photo gallery with auto-tagging, complete authentication system, team management, and sales resources library.

🌐 **Live App**: [Deployed on Netlify]
📊 **Database**: Supabase (PostgreSQL)
🤖 **AI Integrations**: OpenAI Whisper + Anthropic Claude + AssemblyAI
🔐 **Authentication**: Supabase Auth with Role-Based Access
👥 **Team Management**: User invitations and role management
📚 **Sales Resources**: Organized file library with AI assistance

---

## ✨ Features

### 🎯 For Sales Reps (Mobile-First)

#### AI Sales Coach
- **Voice Recording**: Record sales calls with clients
- **AI-Powered Analysis**: Claude analyzes conversations against custom sales processes
- **Performance Metrics**: Talk/listen ratio, questions asked, objections handled
- **Sentiment Analysis**: Track emotional highs/lows throughout conversations
- **Leaderboard**: Team rankings (week/month/all-time)
- **Offline Support**: Record even without internet, auto-sync later
- **Manager Reviews**: Layer human feedback on top of AI insights

#### Photo Gallery 📸
- **Smart Upload**: Camera or library, multi-select (10+ photos at once)
- **AI Auto-Tagging**: Claude Vision analyzes photos and suggests tags
- **Advanced Filtering**: Filter by Product Type, Material, Style, Favorites
- **Full-Screen Viewer**: Swipe navigation, like, favorite, flag for clients
- **Image Optimization**: Auto-resize (1920px) + thumbnails (300px)
- **Client Presentation Mode**: Flag photos for client presentations
- **Role-Based Access**: Sales see published only, Managers review pending

#### Voice-Enabled Requests
- **Record Instead of Type**: Use voice for custom pricing requests
- **AI Transcription**: OpenAI Whisper converts speech to text
- **Smart Parsing**: Claude extracts customer details automatically
- **Confidence Scoring**: See how confident the AI is about each field
- **Edit Before Submit**: Review and adjust parsed data

#### Pre-Stain ROI Calculator
- **Live Calculations**: Real-time DIY vs Pre-stained cost comparison
- **Professional Presentation**: Show customers the value proposition
- **Advanced Settings**: Customize labor rates, stain costs, markups
- **Time Savings**: Calculate labor hours saved

#### Client Presentations
- **Full-Screen Viewer**: Present to clients professionally
- **Upload Management**: Add/modify presentation files
- **Easy Access**: Quick access from mobile home screen

#### Sales Resources Library 📚
- **Folder Organization**: Colorful gradient folders (8 colors)
- **File Management**: Upload PDFs, presentations, images, videos (up to 20MB)
- **Smart Features**: Duplicate detection, file rename, descriptions
- **Search & Filter**: By filename and file type
- **Favorites**: Save important files for quick access
- **Inline Viewing**: PDFs and images open in browser (no download)
- **View Tracking**: See how many times files are viewed
- **Mobile Access**: Full access from sales mobile view

#### 5 Request Types
1. **Custom Pricing** (voice-enabled)
2. **New Builder/Community**
3. **Installation Issue**
4. **Material Request**
5. **Customer Escalation**

---

### 🏢 For Operations & Managers (Desktop)

#### Authentication & Access
- **Email/Password Login**: Secure Supabase authentication
- **Email Verification**: Confirm email on signup
- **Role-Based Access**: 4 roles (Sales, Operations, Sales Manager, Admin)
- **Profile Management**: Update user information
- **Last Login Tracking**: Monitor user activity

#### Photo Review Queue
- **Pending Photos**: See all photos awaiting approval
- **AI Suggestions**: Review AI-generated tags and quality scores
- **Tag Management**: Edit tags from predefined categories
- **Quality Scoring**: Rate photos 1-10 for presentation value
- **Batch Actions**: Publish, save drafts, or archive photos
- **Manager Notes**: Add review notes for the team

#### Request Queue Management
- **Dashboard**: Overview of all incoming requests
- **Request Tracking**: Monitor status from submission to completion
- **Team Analytics**: Performance metrics and insights
- **Response Workflow**: Streamlined approval process

#### Sales Coach Admin
- **Custom Sales Processes**: Define company-specific methodologies
- **Knowledge Base**: Company info, products, objections, best practices
- **Recording Management**: View all team recordings, delete if needed
- **Process Steps**: Set key behaviors for each step

#### Team Management
- **User List**: View all team members with search and filter
- **Invite Users**: Email-based invitations with role assignment
- **Role Management**: Change user roles (Admin only)
- **User Activation**: Enable/disable user access (Admin only)
- **Pending Invitations**: Track and manage sent invitations
- **Permissions**: Role-specific access (Sales Manager can invite, Admin has full control)

#### Sales Resources Management
- **File Upload**: Add PDFs, presentations, images, videos
- **Edit Files**: Rename files and add descriptions (Admin/Manager)
- **Archive System**: Soft delete with restore capability
- **Permanent Delete**: Admin-only permanent removal
- **Duplicate Prevention**: Automatic check with archive-and-replace option
- **Inline Viewing**: Open files in browser instead of download

---

## 🛠️ Tech Stack

### Frontend
- **React 19** + TypeScript
- **Vite 7** - Lightning-fast builds
- **TailwindCSS 3** - Utility-first styling
- **Lucide React** - Beautiful icons
- **PWA** - Progressive Web App with offline support

### Backend & APIs
- **Supabase** - PostgreSQL database, Auth, Storage, Realtime
- **Netlify Functions** - Serverless backend (7 endpoints)
- **OpenAI Whisper** - ✅ Voice transcription (LIVE)
- **Anthropic Claude** - ✅ AI analysis & parsing (LIVE)
- **AssemblyAI** - ✅ Alternative transcription (LIVE)

### Infrastructure
- **Netlify** - ✅ Deployed and live
- **Node 20** - Runtime environment
- **IndexedDB** - Offline data persistence

---

## 🚀 Quick Start

### 1. Clone & Install

```bash
git clone https://github.com/GiacomoIaco/discount-fence-hub.git
cd discount-fence-hub
npm install
```

### 2. Environment Setup

The `.env` file is already configured with:

```env
# Supabase (✅ Connected)
VITE_SUPABASE_URL=https://mravqfoypwyutjqtoxet.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_...

# OpenAI (✅ Connected)
VITE_OPENAI_API_KEY=sk-proj-...

# Anthropic Claude (✅ Connected)
VITE_ANTHROPIC_API_KEY=sk-ant-...
```

### 3. Database Setup (Already Done ✅)

All tables exist:
- ✅ Core: `sales_reps`, `requests`, `presentations`, `roi_calculations`, `activity_log`, `photos`
- ✅ Auth: `user_profiles`, `user_invitations`
- ✅ Resources: `sales_resources_folders`, `sales_resources_files`, `sales_resources_favorites`, `sales_resources_views`

Storage buckets:
- ✅ `voice-recordings`
- ✅ `photos`
- ✅ `presentations`
- ✅ `sales-resources`

**SQL Scripts** (run these in Supabase SQL Editor if needed):
- `create-auth-tables.sql` - Creates authentication tables
- `add-file-description.sql` - Adds description field to files
- `fix-storage-content-disposition.sql` - Configures storage bucket for inline viewing
- `supabase-storage-policies.sql` - Enables photo uploads

### 4. Run Development Server

```bash
npm run dev
```

Visit `http://localhost:5173`

### 5. Build for Production

```bash
npm run build
npm run preview  # Preview production build
```

---

## 📁 Project Structure

```
discount-fence-hub/
├── src/
│   ├── components/
│   │   ├── auth/
│   │   │   ├── Login.tsx               # Login screen
│   │   │   └── Signup.tsx              # Self-service signup
│   │   ├── sales/
│   │   │   ├── SalesCoach.tsx          # AI sales coaching
│   │   │   ├── SalesCoachAdmin.tsx     # Admin configuration
│   │   │   └── StainCalculator.tsx     # ROI calculator
│   │   ├── PhotoGallery.tsx            # Photo gallery feature
│   │   ├── PhotoReviewQueue.tsx        # Manager review interface
│   │   ├── SalesResources.tsx          # Sales resources library
│   │   ├── TeamManagement.tsx          # Team & user management
│   │   └── InstallAppBanner.tsx        # PWA install prompt
│   ├── contexts/
│   │   └── AuthContext.tsx             # Authentication context
│   ├── lib/
│   │   ├── supabase.ts                 # Supabase client
│   │   ├── openai.ts                   # Whisper transcription
│   │   ├── claude.ts                   # Claude parsing
│   │   ├── recordings.ts               # Recording management
│   │   ├── offlineQueue.ts             # IndexedDB offline queue
│   │   └── photos.ts                   # Photo utilities
│   ├── App.tsx                         # Main app with routing
│   ├── main.tsx                        # Entry point
│   └── index.css                       # TailwindCSS
├── netlify/functions/
│   ├── upload-recording.ts             # File upload
│   ├── transcribe-recording.ts         # Full transcription flow
│   ├── analyze-recording.ts            # AI analysis
│   ├── analyze-photo.ts                # Photo AI analysis
│   ├── transcribe.ts                   # Whisper integration
│   └── parse.ts                        # Claude parsing
├── scripts/
│   ├── check-supabase-buckets.ts       # Verify storage buckets
│   └── check-supabase-tables.ts        # Verify database tables
├── public/                             # Static assets
├── SQL scripts/
│   ├── supabase-schema.sql             # Core database schema
│   ├── create-auth-tables.sql          # Auth & user profiles
│   ├── add-file-description.sql        # File description field
│   └── fix-storage-content-disposition.sql # Storage config
├── netlify.toml                        # Netlify config
├── vite.config.ts                      # Vite + PWA config
├── DEPLOY.md                           # Deployment guide
├── PROJECT_SUMMARY.md                  # Detailed feature list
└── README.md                           # This file
```

---

## 🎯 Current Capabilities

### ✅ Fully Functional
1. **AI Sales Coach** - Record, transcribe, analyze sales calls
2. **Photo Gallery** - AI-powered photo management with review workflow
3. **Authentication** - Supabase Auth with email/password, role-based access
4. **Team Management** - Invite users, manage roles, track activity
5. **Sales Resources Library** - Organized file storage with advanced features
6. **Voice Requests** - Speak your pricing requests
7. **Pre-Stain Calculator** - Professional ROI presentations
8. **Multi-Role Interface** - Sales, Operations, Manager, Admin
9. **Offline Support** - Queue recordings when offline, sync later
10. **PWA** - Install as app on mobile devices with smart prompts

### 🔗 Live Integrations
- ✅ **Supabase Auth** - Email/password authentication
- ✅ **Supabase Database** - PostgreSQL with 12 tables
- ✅ **Supabase Storage** - 4 buckets for files
- ✅ **OpenAI Whisper** - Real voice transcription
- ✅ **Claude API** - AI analysis & parsing
- ✅ **AssemblyAI** - Alternative transcription
- ✅ **Netlify** - Deployed and live

---

## 🔐 User Roles & Permissions

### Sales Role
- View/use: Presentations, Sales Coach, Photo Gallery, Calculator, Requests, Sales Resources
- Upload photos (pending approval)
- Record sales calls
- Submit requests
- View and favorite files
- **Cannot**: Access review queues, manage team, upload/edit files

### Operations Role
- Full dashboard access
- Request queue management
- View team members
- **Cannot**: Access Sales Coach Admin, review photos, manage team, edit resources

### Sales Manager Role
- All sales permissions
- Photo review queue
- Sales Coach analytics
- Team performance
- **Invite users** and assign roles
- **Upload/edit files** in Sales Resources
- View and manage team members
- **Cannot**: Change roles, activate/deactivate users, delete permanently

### Admin Role
- **Full access** to everything
- Sales Coach Admin configuration
- **Full team management** (roles, activation)
- **Full file management** (upload, edit, archive, restore, permanent delete)
- Delete any photo
- System configuration
- View archived files section

---

## 📸 Photo Gallery Features

### Tag Categories (Customizable)

**Product Types** (12 options):
- Wood Vertical/Horizontal Fence
- Iron Fence
- Farm/Ranch Style
- Vinyl Fence
- Aluminum & Composite
- Chain Link
- Railing
- Automatic Gates
- Retaining Wall
- Decks
- Pergola

**Materials** (7 options):
- Wood, Iron, Aluminum, Composite, Vinyl, Glass, Cable

**Styles** (5 options):
- Shadow Box, Board on Board, Exposed Post, Cap & Trim, Good Neighbor, Stained

**To customize**: Edit `src/lib/photos.ts` → `TAG_CATEGORIES`

---

## 🧪 Testing

### Check Supabase Connection
```bash
npm run check:tables   # Verify database tables
npm run check:buckets  # Verify storage buckets
```

### Test Features
1. **Sales Coach**: Record → Transcribe → Analyze
2. **Photo Gallery**: Upload → AI tags → Review → Publish
3. **Voice Request**: Record → Parse → Submit
4. **Calculator**: Enter values → See live calculations

---

## 🚀 Deployment Status

### ✅ Production Ready
- [x] GitHub repository
- [x] Netlify deployment (live)
- [x] Supabase database (connected)
- [x] Storage buckets (created)
- [x] Environment variables (configured)
- [x] AI integrations (fully functional)
- [x] PWA manifest & service worker
- [ ] Storage policies (run `supabase-storage-policies.sql`)

### Next Steps
1. Run `supabase-storage-policies.sql` in Supabase SQL Editor
2. Test photo upload end-to-end
3. Add Supabase Auth (email/password)
4. Configure custom domain (optional)

---

## 📊 Project Stats

- **Total Lines of Code**: ~18,000+
- **React Components**: 16+ major components
  - SalesCoach, SalesCoachAdmin, StainCalculator
  - PhotoGallery, PhotoReviewQueue
  - Login, Signup, TeamManagement
  - SalesResources, InstallAppBanner
  - Dashboard, Analytics, etc.
- **Netlify Functions**: 7 serverless endpoints
- **Database Tables**: 12 tables
  - Core: sales_reps, requests, presentations, roi_calculations, activity_log, photos
  - Auth: user_profiles, user_invitations
  - Resources: sales_resources_folders, sales_resources_files, sales_resources_favorites, sales_resources_views
- **Storage Buckets**: 4 configured (voice-recordings, photos, presentations, sales-resources)
- **API Integrations**: 4 (Supabase Auth + Database, OpenAI, Anthropic, AssemblyAI)
- **Authentication**: Full Supabase Auth with role-based access
- **Offline Support**: Full IndexedDB implementation
- **PWA Features**: Service worker, manifest, offline caching, install prompts

---

## 🎓 Key Innovations

1. **Offline-First Sales Coaching** - Record without internet, sync later
2. **AI-Powered Photo Tagging** - Claude Vision analyzes photos automatically
3. **Voice-to-Request** - Speak instead of typing
4. **Custom Sales Processes** - Admins define company methodologies
5. **Manager Review System** - Human + AI feedback
6. **Team Leaderboards** - Gamification with rankings
7. **Multi-Role Architecture** - One app for all users
8. **Self-Service Authentication** - Email/password signup with verification
9. **Team Management** - Invite users, manage roles, track activity
10. **Sales Resources Library** - Organized file storage with AI assistance
11. **Smart File Management** - Duplicate detection, auto-archive, inline viewing
12. **PWA Installation** - Progressive Web App with smart prompts
13. **Colorful UI** - Gradient folders, visual depth, modern design

---

## 🛣️ Roadmap

### Phase 1: Production ✅ COMPLETE
- [x] Deploy to Netlify
- [x] Connect Supabase
- [x] AI integrations
- [x] Set up authentication
- [x] Team management
- [x] Sales resources library
- [ ] Storage policies (SQL script available)

### Phase 2: Enhancements (In Progress)
- [x] PWA install prompts
- [x] Photo gallery with AI
- [x] File upload with compression
- [ ] Email automation for invitations
- [ ] Push notifications
- [ ] Real-time team chat
- [ ] Advanced analytics dashboard
- [ ] Export reports to PDF
- [ ] Custom domain

### Phase 3: Mobile (Future)
- [x] PWA with service workers
- [x] Offline capabilities (IndexedDB)
- [ ] React Native app
- [ ] Background sync
- [ ] Push notifications
- [ ] Enhanced offline mode

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📝 License

Proprietary software owned by Discount Fence USA.

---

## 👥 Team

- **Developer**: GiacomoIaco
- **Company**: Discount Fence USA
- **Started**: October 2024
- **Status**: ✅ Production Deployed

---

## 📧 Support

For documentation:
- **Setup**: See `DEPLOY.md`
- **Features**: See `PROJECT_SUMMARY.md` (comprehensive feature documentation)
- **Code**: See this `README.md`
- **Database**: See SQL scripts in root directory

For issues: Create an issue in the GitHub repository

---

**Built with ❤️ for Discount Fence USA**
*Powered by React, TypeScript, Claude AI, and modern web technologies*
