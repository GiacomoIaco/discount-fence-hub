# Photo Gallery Feature

## Overview
Photo gallery system for managing project photos with AI-powered tagging, review workflow, and client selection capabilities. Supports multiple user roles with different permissions and workflows.

## Architecture

### External Dependencies
This feature depends on:
- **Photo Library**: `src/lib/photos.ts` - Photo types, utilities, filtering, and image processing
- **Database**: `src/lib/supabase.ts` - Supabase client for data access
- **Toast Notifications**: `src/lib/toast.ts` - User feedback (showSuccess, showError)
- **Analytics Component**: `src/components/PhotoAnalytics.tsx` - Photo analytics dashboard
- **UI Framework**: Tailwind CSS, Lucide React icons

### Database Schema
- **Migration**: `migrations/008_add_photo_tagging_fields.sql`
- **Tables**:
  - `request_attachments` (photos stored as attachments with tagging fields)
- **Fields Added**: tags, suggested_tags, quality_score, confidence_score, ai_analysis, tagging_status
- **Indexes**: GIN index on tags for efficient filtering, index on tagging_status

### Entry Point
- **Main Component**: `PhotoGalleryRefactored.tsx`
- **Route**: `/photos` (configured in main App.tsx)
- **Access**: Multiple roles (sales, operations, sales-manager, admin)

## File Structure

```
photos/
├── README.md                     # This file
├── FEATURE_MANIFEST.json         # Machine-readable metadata
├── index.ts                      # Public API
├── PhotoGalleryRefactored.tsx   # Main component
├── components/                   # UI components
│   ├── BulkEditToolbar.tsx      # Bulk selection/edit toolbar
│   ├── PhotoDetailModal.tsx     # Full-screen photo viewer
│   ├── PhotoFilters.tsx         # Filter sidebar
│   ├── PhotoGrid.tsx            # Photo grid layout
│   ├── PhotoReviewModal.tsx     # Manager review workflow
│   ├── PhotoUploadModal.tsx     # Upload dialog
│   ├── TagManagementModal.tsx   # Tag management (admin)
│   └── index.ts                 # Component exports
└── hooks/                        # Custom hooks
    ├── usePhotoActions.ts       # Photo actions (like, favorite, delete)
    ├── usePhotoBulkEdit.ts      # Bulk operations
    ├── usePhotoEnhance.ts       # AI enhancement
    ├── usePhotoFilters.ts       # Filtering logic
    ├── usePhotoGallery.ts       # Core gallery state
    ├── usePhotoReview.ts        # Manager review workflow
    ├── usePhotoUpload.ts        # Upload handling
    ├── useTagManagement.ts      # Tag CRUD operations
    └── index.ts                 # Hook exports
```

## Key Concepts

### Photo Lifecycle
1. **Upload** → Sales rep uploads photos (mobile/desktop)
2. **Pending** → Photo enters review queue with AI-suggested tags
3. **Review** → Manager reviews, adjusts tags, sets quality score
4. **Saved/Published** → Manager approves (saved = internal, published = client-visible)
5. **Archived** → Photo can be archived if not suitable

### Role-Based Workflows

**Sales Rep:**
- Upload photos from camera or library
- View published photos
- Mark photos as favorites
- Client selection mode (sessionId-based)

**Sales Manager/Operations:**
- All sales rep capabilities
- Review pending photos
- Edit tags and quality scores
- Publish/save/archive photos
- Bulk operations (status change, delete)
- View analytics

**Admin:**
- All manager capabilities
- Manage custom tags (add/delete)
- Full system access

### Photo Status States
- `pending` - Awaiting manager review
- `saved` - Approved but not public
- `published` - Visible to clients
- `archived` - Removed from active gallery

### Filtering System
Photos can be filtered by:
- **Product Type** (Wood Vertical, Iron, Railing, etc.)
- **Material** (Wood, Iron, Aluminum, Vinyl, etc.)
- **Style** (Shadow Box, Board on Board, etc.)
- **Favorites** - User's favorite photos
- **Liked** - Photos with likes > 0

Filters use AND logic across categories, OR within categories.

### Client Selection System
Uses session-based selection tracking:
- Each gallery viewing session gets a unique `sessionId`
- Sales reps can select photos for client presentations
- Selections are tracked with timestamps
- Multiple selections per photo supported (different sessions)

## Development

### Adding a New Component
1. Create component in `components/` folder
2. Export from `components/index.ts`
3. Import in `PhotoGalleryRefactored.tsx` or other components
4. Keep components focused and reusable

### Adding a New Hook
1. Create hook in `hooks/` folder
2. Export from `hooks/index.ts`
3. Follow naming convention: `usePhoto*`
4. Handle loading and error states consistently

### Testing
Currently no automated tests. Manual testing checklist:

**Upload Flow:**
- [ ] Camera capture works on mobile
- [ ] Library selection works
- [ ] Multiple photo upload
- [ ] Image resizing/compression
- [ ] Upload progress feedback

**Review Flow (Manager):**
- [ ] Pending queue shows new photos
- [ ] Tag editing works
- [ ] Quality score updates
- [ ] Publish/save/archive actions
- [ ] AI enhancement preview

**Filtering:**
- [ ] Tag filters work (AND/OR logic)
- [ ] Favorite filter works
- [ ] Liked filter works
- [ ] Filter count badge updates
- [ ] Clear filters works

**Bulk Operations:**
- [ ] Select mode toggles
- [ ] Select all works
- [ ] Deselect all works
- [ ] Bulk status change
- [ ] Bulk delete with confirmation

## Future Enhancements
- [ ] AI-powered auto-tagging on upload
- [ ] Bulk enhance (apply AI enhancement to multiple photos)
- [ ] AI recommended selection for client presentations
- [ ] Photo flagging system (quality issues)
- [ ] Advanced analytics (upload trends, quality metrics)
- [ ] Photo comparison view
- [ ] Export selections as PDF/portfolio

## Notes
- Photo gallery is shared across request/project contexts
- Photos stored in `request_attachments` table (legacy name)
- AI enhancement uses external API (endpoint in usePhotoEnhance)
- Image processing happens client-side (resizing, compression)
- Session-based selections are client-side only (not persisted)
- Quality scores are subjective (manager judgment)
- This feature has moderate isolation - depends on shared photo library
- Consider extracting photo library utilities into feature if full isolation needed
