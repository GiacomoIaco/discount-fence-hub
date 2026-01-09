import { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface VerifyOTPRequest {
  userId: string;
  phone: string;
  code: string;
}

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    const { userId, phone, code }: VerifyOTPRequest = JSON.parse(event.body || '{}');

    if (!userId || !phone || !code) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing userId, phone, or code' }),
      };
    }

    // Format phone to match stored format
    let formattedPhone = phone.replace(/[^\d+]/g, '');
    if (!formattedPhone.startsWith('+')) {
      if (formattedPhone.length === 10) {
        formattedPhone = '+1' + formattedPhone;
      } else if (formattedPhone.length === 11 && formattedPhone.startsWith('1')) {
        formattedPhone = '+' + formattedPhone;
      }
    }

    // Find the most recent unverified code for this user/phone
    const { data: verificationCode, error: fetchError } = await supabase
      .from('phone_verification_codes')
      .select('*')
      .eq('user_id', userId)
      .eq('phone', formattedPhone)
      .is('verified_at', null)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (fetchError || !verificationCode) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'No valid verification code found. Please request a new code.' }),
      };
    }

    // Check attempts
    if (verificationCode.attempts >= 5) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Too many incorrect attempts. Please request a new code.' }),
      };
    }

    // Increment attempts
    await supabase
      .from('phone_verification_codes')
      .update({ attempts: verificationCode.attempts + 1 })
      .eq('id', verificationCode.id);

    // Check if code matches
    if (verificationCode.code !== code) {
      const remainingAttempts = 4 - verificationCode.attempts;
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: `Incorrect code. ${remainingAttempts} attempt${remainingAttempts !== 1 ? 's' : ''} remaining.`,
        }),
      };
    }

    // Mark code as verified
    const { error: updateCodeError } = await supabase
      .from('phone_verification_codes')
      .update({ verified_at: new Date().toISOString() })
      .eq('id', verificationCode.id);

    if (updateCodeError) {
      console.error('Error marking code as verified:', updateCodeError);
    }

    // Update user profile with verified phone
    const { error: updateProfileError } = await supabase
      .from('user_profiles')
      .update({
        phone: formattedPhone,
        phone_verified_at: new Date().toISOString(),
      })
      .eq('id', userId);

    if (updateProfileError) {
      console.error('Error updating user profile:', updateProfileError);
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Failed to update profile with verified phone' }),
      };
    }

    console.log('Phone verified successfully for user:', userId);

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        message: 'Phone number verified successfully',
        phone: formattedPhone,
      }),
    };
  } catch (error) {
    console.error('Error verifying OTP:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Failed to verify code',
        details: error instanceof Error ? error.message : 'Unknown error',
      }),
    };
  }
};
