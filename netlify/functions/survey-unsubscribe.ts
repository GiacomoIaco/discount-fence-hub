import type { Handler, HandlerEvent } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

const handler: Handler = async (event: HandlerEvent) => {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      },
      body: '',
    };
  }

  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'text/html; charset=utf-8',
  };

  try {
    // Get token from query params
    const token = event.queryStringParameters?.token;

    if (!token) {
      return {
        statusCode: 400,
        headers,
        body: renderPage('Invalid Request', 'No unsubscribe token provided.', false),
      };
    }

    // Find the recipient by token
    const { data: recipient, error: recipientError } = await supabase
      .from('survey_recipients')
      .select(`
        id,
        recipient_email,
        recipient_name,
        contact_id
      `)
      .eq('response_token', token)
      .single();

    if (recipientError || !recipient) {
      return {
        statusCode: 404,
        headers,
        body: renderPage('Not Found', 'This unsubscribe link is invalid or has expired.', false),
      };
    }

    // If GET request, show confirmation page
    if (event.httpMethod === 'GET') {
      const confirmParam = event.queryStringParameters?.confirm;

      if (confirmParam !== 'true') {
        // Show confirmation form
        return {
          statusCode: 200,
          headers,
          body: renderConfirmPage(recipient.recipient_email || 'this email', token),
        };
      }
    }

    // Process unsubscribe (GET with confirm=true or POST)
    const now = new Date().toISOString();

    // Mark the contact as unsubscribed if contact_id exists
    if (recipient.contact_id) {
      await supabase
        .from('survey_population_contacts')
        .update({
          unsubscribed_at: now,
          is_active: false
        })
        .eq('id', recipient.contact_id);
    }

    // Also mark any contacts with matching email as unsubscribed
    if (recipient.recipient_email) {
      await supabase
        .from('survey_population_contacts')
        .update({
          unsubscribed_at: now,
          is_active: false
        })
        .eq('contact_email', recipient.recipient_email);
    }

    return {
      statusCode: 200,
      headers,
      body: renderPage(
        'Unsubscribed Successfully',
        `You have been unsubscribed from our surveys. You will no longer receive survey invitations at ${recipient.recipient_email || 'this email address'}.`,
        true
      ),
    };

  } catch (error) {
    console.error('Unsubscribe error:', error);
    return {
      statusCode: 500,
      headers,
      body: renderPage('Error', 'An error occurred while processing your request. Please try again later.', false),
    };
  }
};

function renderPage(title: string, message: string, success: boolean): string {
  const iconColor = success ? '#10b981' : '#ef4444';
  const icon = success
    ? `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="${iconColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>`
    : `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="${iconColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>`;

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} - Discount Fence USA</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .container {
      background: white;
      border-radius: 16px;
      box-shadow: 0 4px 24px rgba(0,0,0,0.1);
      padding: 48px;
      max-width: 480px;
      text-align: center;
    }
    .icon { margin-bottom: 24px; }
    h1 {
      font-size: 24px;
      font-weight: 600;
      color: #111827;
      margin-bottom: 16px;
    }
    p {
      color: #6b7280;
      line-height: 1.6;
      font-size: 16px;
    }
    .footer {
      margin-top: 32px;
      padding-top: 24px;
      border-top: 1px solid #e5e7eb;
      color: #9ca3af;
      font-size: 14px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="icon">${icon}</div>
    <h1>${title}</h1>
    <p>${message}</p>
    <div class="footer">Discount Fence USA</div>
  </div>
</body>
</html>
  `;
}

function renderConfirmPage(email: string, token: string): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Unsubscribe - Discount Fence USA</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .container {
      background: white;
      border-radius: 16px;
      box-shadow: 0 4px 24px rgba(0,0,0,0.1);
      padding: 48px;
      max-width: 480px;
      text-align: center;
    }
    .icon { margin-bottom: 24px; }
    h1 {
      font-size: 24px;
      font-weight: 600;
      color: #111827;
      margin-bottom: 16px;
    }
    p {
      color: #6b7280;
      line-height: 1.6;
      font-size: 16px;
      margin-bottom: 24px;
    }
    .email {
      font-weight: 600;
      color: #111827;
    }
    .btn {
      display: inline-block;
      padding: 12px 32px;
      border-radius: 8px;
      font-size: 16px;
      font-weight: 500;
      text-decoration: none;
      cursor: pointer;
      transition: all 0.2s;
    }
    .btn-danger {
      background: #ef4444;
      color: white;
      border: none;
    }
    .btn-danger:hover {
      background: #dc2626;
    }
    .btn-secondary {
      background: #f3f4f6;
      color: #374151;
      border: 1px solid #d1d5db;
      margin-left: 12px;
    }
    .btn-secondary:hover {
      background: #e5e7eb;
    }
    .buttons {
      margin-top: 24px;
    }
    .footer {
      margin-top: 32px;
      padding-top: 24px;
      border-top: 1px solid #e5e7eb;
      color: #9ca3af;
      font-size: 14px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="icon">
      <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
        <polyline points="22,6 12,13 2,6"></polyline>
      </svg>
    </div>
    <h1>Unsubscribe from Surveys</h1>
    <p>Are you sure you want to unsubscribe <span class="email">${email}</span> from our surveys?</p>
    <p>You will no longer receive survey invitations from Discount Fence USA.</p>
    <div class="buttons">
      <a href="?token=${token}&confirm=true" class="btn btn-danger">Yes, Unsubscribe</a>
    </div>
    <div class="footer">Discount Fence USA</div>
  </div>
</body>
</html>
  `;
}

export { handler };
