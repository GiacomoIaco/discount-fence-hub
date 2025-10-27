# Deployment Instructions

## Step 1: Create GitHub Repository

1. Go to https://github.com/new
2. Repository name: `discount-fence-hub`
3. Description: `Operations Hub for Discount Fence USA - Sales rep mobile app and operations dashboard`
4. Public repository
5. **Do NOT** initialize with README, .gitignore, or license (we already have these)
6. Click "Create repository"

## Step 2: Push Code to GitHub

Run these commands in your terminal from the `discount-fence-hub` directory:

```bash
git remote add origin https://github.com/GiacomoIaco/discount-fence-hub.git
git branch -M main
git push -u origin main
```

## Step 3: Set Up Supabase

1. Go to https://supabase.com and create a new project
2. Name: `discount-fence-operations`
3. Database password: [choose a strong password]
4. Region: [choose closest to your users]

### 3.1: Run Database Schema

1. In Supabase dashboard, go to SQL Editor
2. Open `supabase-schema.sql` from your project
3. Copy and paste the entire contents
4. Click "Run" to execute

### 3.2: Create Storage Buckets

1. Go to Storage in Supabase dashboard
2. Create these buckets:
   - `voice-recordings` (private)
   - `photos` (private)
   - `presentations` (public)

### 3.3: Set Storage Policies

For `voice-recordings` and `photos` buckets:

```sql
-- Allow authenticated users to upload
CREATE POLICY "Users can upload"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'voice-recordings' AND auth.role() = 'authenticated');

-- Users can view their own files
CREATE POLICY "Users can view own files"
ON storage.objects FOR SELECT
USING (bucket_id = 'voice-recordings' AND auth.uid() = owner);

-- Users can delete their own files
CREATE POLICY "Users can delete own files"
ON storage.objects FOR DELETE
USING (bucket_id = 'voice-recordings' AND auth.uid() = owner);
```

For `presentations` bucket:

```sql
-- Anyone authenticated can view
CREATE POLICY "Authenticated users can view"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'presentations');

-- Authenticated users can upload
CREATE POLICY "Authenticated users can upload"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'presentations');
```

### 3.4: Get API Keys

1. Go to Project Settings > API
2. Copy:
   - Project URL
   - anon/public key

## Step 4: Deploy to Netlify

### Option A: Via Netlify Dashboard

1. Go to https://app.netlify.com
2. Click "Add new site" > "Import an existing project"
3. Choose GitHub and select `GiacomoIaco/discount-fence-hub`
4. Build settings:
   - Build command: `npm run build`
   - Publish directory: `dist`
5. Environment variables:
   - `VITE_SUPABASE_URL` = [your Supabase project URL]
   - `VITE_SUPABASE_ANON_KEY` = [your Supabase anon key]
6. Click "Deploy site"

### Option B: Via Netlify CLI

```bash
# Install Netlify CLI globally
npm install -g netlify-cli

# Login to Netlify
netlify login

# Initialize site
netlify init

# Deploy
netlify deploy --prod
```

When prompted, set environment variables in the Netlify dashboard:
- Settings > Environment variables
- Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`

## Step 5: Set Up Supabase Authentication

1. In Supabase dashboard, go to Authentication > Providers
2. Enable Email provider
3. Configure redirect URLs:
   - Add your Netlify URL: `https://your-site.netlify.app`
   - Add localhost for development: `http://localhost:5173`

## Step 6: Test the Deployment

1. Visit your Netlify URL
2. Test the sales rep interface
3. Try the Pre-Stain Calculator
4. Test voice recording (if microphone permissions allowed)

## Step 7: Configure Custom Domain (Optional)

1. In Netlify dashboard, go to Domain settings
2. Add custom domain (e.g., `hub.discountfenceusa.com`)
3. Follow DNS configuration instructions
4. Update Supabase redirect URLs to include custom domain

## Troubleshooting

### Issue: "Supabase client is not configured"
- Check environment variables in Netlify
- Ensure they start with `VITE_` prefix
- Redeploy after adding/changing env vars

### Issue: Authentication not working
- Verify redirect URLs in Supabase match your deployment URL
- Check browser console for errors

### Issue: Voice recording not working
- Ensure HTTPS (required for microphone access)
- Check browser permissions

## Next Steps

1. Add real Whisper API integration for voice transcription
2. Add Claude API for intelligent request parsing
3. Implement authentication flow
4. Build out Operations dashboard
5. Add real-time notifications
6. Implement photo upload to Supabase Storage

---

## Quick Reference Commands

```bash
# Local development
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Push to GitHub
git add .
git commit -m "your message"
git push origin main

# Deploy to Netlify (with CLI)
netlify deploy --prod
```
