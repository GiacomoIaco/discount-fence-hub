# Database Migrations

## How to Run Migrations

1. Go to your Supabase Dashboard: https://supabase.com/dashboard
2. Select your project
3. Go to "SQL Editor" in the left sidebar
4. Open the migration file and copy its contents
5. Paste into the SQL Editor
6. Click "Run" to execute

## Migration History

### 003_add_missing_request_columns.sql (REQUIRED - Not Yet Run)
**Status:** ⚠️ NEEDS TO BE RUN

Adds missing columns to the `requests` table that are required by the application:
- `title` (required field for all requests)
- `description`, `customer_name`, `customer_address`, `customer_phone`, `customer_email`
- `fence_type`, `linear_feet`, `square_footage`
- `urgency`, `deadline`, `special_requirements`
- `voice_recording_url`, `voice_duration`, `transcript`, `transcript_confidence`
- `photo_urls` (array of photo URLs)
- `submitted_at` (timestamp when request was created)

**Why needed:** The Request interface in the code expects these fields, but they don't exist in the database yet.

### 002_enhanced_requests_system.sql (Previously Run)
Adds enhanced request management features:
- SLA tracking, assignment, priority scoring
- New tables for notes, activity log, assignment rules
- Triggers for automation

### 001_initial_schema.sql (Previously Run)
Initial database schema creation.
