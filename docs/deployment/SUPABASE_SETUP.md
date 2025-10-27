# Supabase Setup Guide for Photo Gallery

## Current Status
✅ Supabase is connected
- URL: `https://mravqfoypwyutjqtoxet.supabase.co`
- Anon Key: Configured in `.env`

✅ Storage buckets created:
- `voice-recordings` ✅
- `photos` ✅ (used for Photo Gallery)
- `presentations` ✅

✅ Database tables created:
- All tables exist including `photos` table

## Storage Bucket Configuration

### ✅ Current Setup - Using Existing `photos` Bucket

The Photo Gallery feature is configured to use your existing **`photos`** bucket.

**Folder Structure:**
```
photos/
├── {userId}/
│   ├── full/
│   │   └── {photoId}.jpg      (max 1920px width)
│   └── thumb/
│       └── {photoId}.jpg      (max 300px width)
```

**Recommended Settings for `photos` bucket:**
- Name: `photos` ✅
- Public: **No (Private)** 🔒
- File size limit: 50 MB
- Allowed MIME types: `image/*`

**Folder Structure:**
```
photo-gallery/
├── {userId}/
│   ├── full/
│   │   └── {photoId}.jpg      (max 1920px width)
│   └── thumb/
│       └── {photoId}.jpg      (max 300px width)
```

**Storage Policies (RLS):**
```sql
-- Allow authenticated users to upload
CREATE POLICY "Users can upload photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'photo-gallery' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Sales users can view published photos
CREATE POLICY "Users can view published photos"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'photo-gallery' AND
  (
    -- Users can see their own photos
    auth.uid()::text = (storage.foldername(name))[1]
    OR
    -- Or if the photo is published (check photos table)
    EXISTS (
      SELECT 1 FROM public.photos
      WHERE url LIKE '%' || name || '%'
      AND status = 'published'
    )
  )
);

-- Users can delete their own photos
CREATE POLICY "Users can delete own photos"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'photo-gallery' AND auth.uid()::text = (storage.foldername(name))[1]);
```

---

### 2. **voice-recordings** (For voice transcription feature)
**Purpose**: Store audio recordings from voice requests

**Settings:**
- Name: `voice-recordings`
- Public: **No (Private)** 🔒
- File size limit: 25 MB
- Allowed MIME types: `audio/*`

---

### 3. **presentations** (For client presentations)
**Purpose**: Store PDF/PPT files for client presentations

**Settings:**
- Name: `presentations`
- Public: **No (Private)** 🔒
- File size limit: 100 MB
- Allowed MIME types: `application/pdf`, `application/vnd.ms-powerpoint`, `application/vnd.openxmlformats-officedocument.presentationml.presentation`

---

## How to Create Buckets

### Option 1: Supabase Dashboard (Recommended)

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project: `mravqfoypwyutjqtoxet`
3. Click **Storage** in the left sidebar
4. Click **New bucket** button
5. Fill in:
   - **Name**: `photo-gallery`
   - **Public bucket**: ❌ **Uncheck** (keep it private)
   - **File size limit**: 50 MB
   - **Allowed MIME types**: Leave empty (will allow all image types)
6. Click **Create bucket**
7. Repeat for `voice-recordings` and `presentations`

---

### Option 2: SQL Script

Run this in Supabase SQL Editor:

```sql
-- Create photo-gallery bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'photo-gallery',
  'photo-gallery',
  false,
  52428800,  -- 50 MB
  '{image/*}'
);

-- Create voice-recordings bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'voice-recordings',
  'voice-recordings',
  false,
  26214400,  -- 25 MB
  '{audio/*}'
);

-- Create presentations bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'presentations',
  'presentations',
  false,
  104857600,  -- 100 MB
  '{application/pdf,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation}'
);
```

---

## Database Setup

### Run the Photo Gallery Schema

1. Go to **SQL Editor** in Supabase Dashboard
2. Click **New query**
3. Copy contents of `supabase-schema.sql`
4. Run the query
5. Verify tables created:
   - ✅ `photos`
   - ✅ `sales_reps`
   - ✅ `requests`
   - ✅ `presentations`
   - ✅ `roi_calculations`
   - ✅ `activity_log`

---

## Testing the Photo Gallery

### Test Upload Flow

1. Switch to **Admin** role in the app
2. Navigate to **Photo Gallery**
3. Click the **+** button
4. Choose "Take Photo" or "Choose from Library"
5. Select an image
6. Photo should upload and appear with "Pending Review" badge

### Test Review Queue

1. As **Admin** or **Sales Manager**
2. Navigate to **Photo Review** (new menu item)
3. See the pending photo
4. Review AI-suggested tags
5. Adjust quality score
6. Click **Publish to Gallery**
7. Photo should now appear in main gallery without pending badge

### Test Filtering

1. In Photo Gallery, click **Filter** button (bottom-left)
2. Select some tags (e.g., "Wood", "Shadow Box")
3. See live count update
4. Click **Apply**
5. Gallery should show only matching photos

---

## Troubleshooting

### "No buckets found" error
**Cause**: Anon key doesn't have permission to list buckets (this is normal)
**Solution**: Create buckets via Supabase Dashboard (Option 1 above)

### Photos not uploading
**Check:**
1. Bucket `photo-gallery` exists
2. Storage policies are set up
3. User is authenticated
4. Console for error messages

### AI tagging not working
**Check:**
1. `VITE_ANTHROPIC_API_KEY` is set in `.env`
2. Netlify function `analyze-photo` is deployed
3. Check Netlify function logs for errors

### Photos upload but don't appear
**Check:**
1. Photo status is 'published' (not 'pending')
2. User role has permission to view
3. Check browser console for Supabase errors

---

## Next Steps After Setup

1. ✅ Create storage buckets
2. ✅ Run `supabase-schema.sql`
3. ✅ Set up storage RLS policies
4. ✅ Test upload flow
5. ✅ Test review queue
6. ✅ Test filtering
7. 📸 Upload some real fence photos!
8. 🎨 Customize tag categories if needed (edit `src/lib/photos.ts`)

---

## Contact & Support

If you see existing buckets in Supabase Dashboard but the script says "No buckets found", that's normal - the anon key doesn't have permission to list buckets. Just verify in the Dashboard that you have:

- [ ] photo-gallery
- [ ] voice-recordings
- [ ] presentations

All set up as **private buckets** ✅
