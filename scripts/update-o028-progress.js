import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const sessionNotes = `## Session Dec 11, 2025 - API Integration Working!

### Completed
- OAuth flow implemented and tested
- Tokens stored in qbo_tokens table (auto-refresh ready)
- Successfully connected to QBO Sandbox
- Verified API calls work (CompanyInfo, Customer query)

### Files Created
- netlify/functions/qbo-auth.ts - Initiates OAuth flow
- netlify/functions/qbo-callback.ts - Handles token exchange
- netlify/functions/qbo-test.ts - Tests API connection
- migrations/138_qbo_tokens.sql - Token storage table

### Netlify Env Vars Configured
- QBO_CLIENT_ID (secret)
- QBO_CLIENT_SECRET (secret)
- QBO_ENVIRONMENT = sandbox
- QBO_REDIRECT_URI = https://discount-fence-hub.netlify.app/.netlify/functions/qbo-callback

### Intuit Developer Portal
- Redirect URI added: https://discount-fence-hub.netlify.app/.netlify/functions/qbo-callback
- Currently using Development/Sandbox keys
- Production keys available when ready

### Test Results
- Company: Sandbox Company_US_1
- 29 customers in sandbox
- Token expires: ~1 hour (auto-refresh implemented)
- Refresh token expires: March 22, 2026 (100 days)

### Next Steps (Future Session)
1. Change QBO_ENVIRONMENT to "production" and reconnect to real IES
2. Build Client → Customer sync function
3. Build Community → Sub-Customer sync function
4. Build $0 Sales Receipt for material transfers
5. Consider negotiating Silver tier for Projects API access`;

async function main() {
  const { data, error } = await supabase
    .from('roadmap_items')
    .update({
      session_notes: sessionNotes,
      status: 'in_progress',
      updated_at: new Date().toISOString()
    })
    .eq('code', 'O-028')
    .select('code, title, status');

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('Updated:', data);
}

main();
