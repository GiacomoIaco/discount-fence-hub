# Netlify Environment Variables

This document lists all environment variables configured in Netlify for the Discount Fence Hub application.

## Complete List of Environment Variables

### AI/ML Services
- **ANTHROPIC_API_KEY** - Anthropic Claude API key for AI features
- **VITE_ANTHROPIC_API_KEY** - Frontend Anthropic API key
- **VITE_OPENAI_API_KEY** - OpenAI API key for AI features
- **VITE_ASSEMBLYAI_API_KEY** - AssemblyAI API key for transcription
- **GOOGLE_API_KEY** - Google services API key

### Email Service
- **SENDGRID_API_KEY** - SendGrid API key for sending invitation emails
  - Sender: giacomo@discountfenceusa.com
  - Must be verified in SendGrid/Twilio

### Database (Supabase)
- **VITE_SUPABASE_URL** - Supabase project URL (public, used in frontend)
- **VITE_SUPABASE_ANON_KEY** - Supabase anonymous/public key (used in frontend)
- **SUPABASE_SERVICE_ROLE_KEY** - Supabase service role key (backend only, bypasses RLS)
  - ⚠️ Keep secret! Only for Netlify Functions
  - Used for admin operations (user deletion, invitations, etc.)

## Scope
All variables are set to:
- **All scopes**
- **Same value in all deploy contexts**

## Security Notes
- ✅ Frontend keys (VITE_*) are safe to expose in client
- ⚠️ Backend keys (SENDGRID_API_KEY, SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY, GOOGLE_API_KEY) must remain server-side only
- Never commit actual key values to git
- Service role key bypasses Row Level Security - use carefully

## Last Updated
2025-10-09

## Required for Features
- **User Invitations**: SENDGRID_API_KEY, SUPABASE_SERVICE_ROLE_KEY, VITE_SUPABASE_URL
- **User Deletion**: SUPABASE_SERVICE_ROLE_KEY
- **AI Features**: ANTHROPIC_API_KEY, VITE_ANTHROPIC_API_KEY, VITE_OPENAI_API_KEY
- **Voice Transcription**: VITE_ASSEMBLYAI_API_KEY
- **Photo Analysis**: VITE_ANTHROPIC_API_KEY, GOOGLE_API_KEY
