import { Handler } from '@netlify/functions';

export const handler: Handler = async () => {
  return {
    statusCode: 200,
    body: JSON.stringify({
      hasSupabaseUrl: !!process.env.VITE_SUPABASE_URL,
      hasServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      hasResendKey: !!process.env.RESEND_API_KEY,
      supabaseUrlLength: process.env.VITE_SUPABASE_URL?.length || 0,
      serviceKeyLength: process.env.SUPABASE_SERVICE_ROLE_KEY?.length || 0,
      resendKeyLength: process.env.RESEND_API_KEY?.length || 0,
    }),
  };
};
