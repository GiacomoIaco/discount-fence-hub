# 📸 Bulk Photo Upload Guide

This guide explains how to bulk upload photos from local folders to your app, with optional AI auto-tagging.

## 🚀 Quick Start

### 1. Setup Database (One-Time)

Run this SQL in your Supabase SQL Editor:

```sql
-- Copy contents from: migrations/008_add_photo_tagging_fields.sql
```

This adds AI tagging fields to the `request_attachments` table.

### 2. Configure Environment

Add these variables to your `.env` file:

```bash
# Supabase (already configured)
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_anon_key

# For bulk upload script
SUPABASE_SERVICE_KEY=your_service_role_key  # From Supabase Dashboard > Settings > API
DEFAULT_USER_ID=your_user_id                 # UUID of the user uploading photos

# For AI tagging (already configured if using Netlify)
VITE_NETLIFY_FUNCTIONS_URL=https://your-app.netlify.app/.netlify/functions
# OR for local dev:
# VITE_NETLIFY_FUNCTIONS_URL=http://localhost:8888/.netlify/functions
```

### 3. Organize Your Photos

Create a folder structure like this:

```
my-photos/
├── project-a/
│   ├── IMG_001.jpg
│   ├── IMG_002.jpg
│   └── subfolder/
│       └── IMG_003.jpg
├── project-b/
│   ├── fence1.jpg
│   └── fence2.jpg
└── misc/
    └── gate.jpg
```

The script will find ALL images in ALL subfolders recursively.

## 📤 Upload Photos

### Basic Upload (No Tagging)

```bash
npm run bulk-upload /path/to/photos <request-id>
```

Example:
```bash
npm run bulk-upload "C:\Photos\Fence Project" abc-123-def-456
```

### Upload with AI Auto-Tagging

```bash
npm run bulk-upload /path/to/photos <request-id> --tag
```

Example:
```bash
npm run bulk-upload "C:\Photos\Fence Project" abc-123-def-456 --tag
```

### Advanced Options

**Custom batch size** (default: 10):
```bash
npm run bulk-upload /path/to/photos <request-id> --tag --batch-size 5
```

**Specify user ID** (overrides .env):
```bash
npm run bulk-upload /path/to/photos <request-id> --user-id user-uuid-here
```

**All together**:
```bash
npm run bulk-upload "C:\Photos" abc-123 --tag --batch-size 5 --user-id user-uuid
```

## 🔍 How It Works

### Upload Process

1. **Scan** - Recursively finds all images (.jpg, .jpeg, .png, .webp, .gif, .heic)
2. **Upload** - Uploads to Supabase Storage (`request-attachments` bucket)
3. **Database** - Creates record in `request_attachments` table
4. **Tag** (optional) - Calls AI function to analyze and tag photos

### AI Tagging

When `--tag` is used, each photo is:
- Analyzed by GPT-5 Vision
- Tagged with product type, material, and style
- Given a quality score (1-10)
- Given a confidence score (0-100)
- Stored with AI analysis notes

Tags are automatically applied from these categories:
- **Product Types**: Wood Vertical Fence, Iron Fence, Railing, Decks, etc.
- **Materials**: Wood, Iron, Aluminum, Vinyl, Glass, etc.
- **Styles**: Shadow Box, Board on Board, Stained, etc.

### Batch Processing

- Photos are processed in configurable batches (default: 10)
- 2-second delay between batches to avoid rate limits
- Failed uploads don't stop the process
- Summary report at the end

## 🎯 Finding Request IDs

You need a `request-id` to upload photos. Find it:

1. **From URL**: Open a request, URL shows: `/requests/<request-id>`
2. **From Database**: Query Supabase `requests` table
3. **From Console**: Use browser dev tools on request page

Example request ID: `abc-123-def-456-ghi-789`

## 📊 Status Tracking

Photos have a `tagging_status` field:

- **pending** - Uploaded but not yet tagged
- **processing** - Currently being tagged by AI
- **completed** - Successfully tagged
- **failed** - Tagging failed (see `ai_analysis` for error)

## 🔧 Troubleshooting

### "Missing Supabase credentials"
- Add `SUPABASE_SERVICE_KEY` to `.env`
- Get it from: Supabase Dashboard → Settings → API → Service Role Key

### "No user ID provided"
- Add `DEFAULT_USER_ID` to `.env`
- Or use `--user-id` flag with each command

### "Folder not found"
- Use absolute path: `C:\Photos\...` (Windows) or `/Users/name/Photos/...` (Mac)
- Or relative path from project root: `./my-photos`

### "Tagging failed"
- Ensure `VITE_NETLIFY_FUNCTIONS_URL` is set
- Check if Netlify functions are deployed
- For local dev, run: `netlify dev` in another terminal

### Photos upload but don't appear in app
- Check request ID is correct
- Verify user has permission to view the request
- Check browser console for errors

## 💡 Tips

### For Your 300-Photo Launch

1. **Organize first**: Group photos by project/request
2. **Test with small batch**: Try 5-10 photos first
3. **Upload without tagging**: Quick upload, tag later
4. **Then tag in batches**: Use smaller `--batch-size` for tagging

Example workflow:
```bash
# Step 1: Quick upload (no tagging)
npm run bulk-upload ./all-photos request-id-1

# Step 2: Tag in small batches (avoids rate limits)
npm run bulk-upload ./batch-1 request-id-1 --tag --batch-size 5
npm run bulk-upload ./batch-2 request-id-1 --tag --batch-size 5
```

### Managing Multiple Requests

If photos are in subfolders by project:
```
all-photos/
├── request-a/
├── request-b/
└── request-c/
```

Upload separately:
```bash
npm run bulk-upload ./all-photos/request-a <request-a-id>
npm run bulk-upload ./all-photos/request-b <request-b-id>
npm run bulk-upload ./all-photos/request-c <request-c-id>
```

### Re-tagging Failed Photos

Query photos with `tagging_status = 'failed'` in Supabase, then manually re-tag using the photo review queue in the app.

## 📝 Next Steps

After bulk upload:

1. ✅ Check photos appear in request attachments
2. ✅ Review AI-suggested tags in the app
3. ✅ Adjust tags manually if needed
4. ✅ Use the photo gallery features (favorite, enhance, etc.)

## 🆘 Support

If you encounter issues:
1. Check this guide's Troubleshooting section
2. Review the console output for errors
3. Check Supabase logs in dashboard
4. Verify .env variables are set correctly
