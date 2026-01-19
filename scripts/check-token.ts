import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY!
);

async function check() {
  const { data: tokenData } = await supabase
    .from('jobber_tokens')
    .select('*')
    .eq('id', 'residential')
    .single();

  console.log('Token ID:', tokenData?.id);
  console.log('Expires At:', tokenData?.access_token_expires_at);

  const expiresAt = new Date(tokenData?.access_token_expires_at);
  const now = new Date();

  console.log('Now:', now.toISOString());
  console.log('Is expired:', expiresAt < now);
  console.log('Token prefix:', tokenData?.access_token?.substring(0, 20) + '...');
}

check();
